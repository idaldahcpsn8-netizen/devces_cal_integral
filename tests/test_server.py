"""Pruebas del servidor local: python -m unittest discover -s tests"""

import http.client
import json
import os
import sys
import threading
import unittest
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import riemann_ai_server as server  # noqa: E402


BASE_CONFIG = {
    "endpoint": "https://api.example.com/v1/chat/completions",
    "apiKey": "clave-de-prueba",
    "model": "modelo",
    "question": "¿Qué es una integral?",
}


class BuildRequestTests(unittest.TestCase):
    def test_infers_provider(self):
        self.assertEqual(server.infer_provider({"endpoint": "https://api.anthropic.com/v1/messages"}), "anthropic")
        self.assertEqual(server.infer_provider({"model": "gemini-2.0-flash"}), "gemini")
        self.assertEqual(server.infer_provider({"endpoint": "https://api.openai.com/v1/responses"}), "openai-responses")
        self.assertEqual(server.infer_provider({"endpoint": "https://integrate.api.nvidia.com/v1/chat/completions"}), "openai-compatible")

    def test_openai_compatible_body(self):
        endpoint, headers, body = server.build_request(dict(BASE_CONFIG))
        self.assertEqual(endpoint, BASE_CONFIG["endpoint"])
        self.assertEqual(headers["Authorization"], "Bearer clave-de-prueba")
        self.assertEqual(body["messages"][1]["content"], BASE_CONFIG["question"])
        self.assertEqual(body["max_tokens"], 700)

    def test_numeric_parameters_are_clamped(self):
        config = dict(BASE_CONFIG, maxTokens="999999", temperature=9, topP=-1)
        _, _, body = server.build_request(config)
        self.assertEqual(body["max_tokens"], 8192)
        self.assertEqual(body["temperature"], 2.0)
        self.assertEqual(body["top_p"], 0.0)

    def test_invalid_numbers_raise_value_error(self):
        with self.assertRaises(ValueError):
            server.build_request(dict(BASE_CONFIG, maxTokens="muchos"))
        with self.assertRaises(ValueError):
            server.build_request(dict(BASE_CONFIG, temperature="nan"))

    def test_rejects_unsafe_endpoints(self):
        for endpoint in ["file:///etc/passwd", "ftp://example.com/x", "http://192.168.0.10/api", "notaurl"]:
            with self.assertRaises(ValueError, msg=endpoint):
                server.build_request(dict(BASE_CONFIG, endpoint=endpoint))
        endpoint, _, _ = server.build_request(dict(BASE_CONFIG, endpoint="http://localhost:11434/v1/chat/completions"))
        self.assertTrue(endpoint.startswith("http://localhost"))

    def test_requires_question_and_credentials(self):
        with self.assertRaises(ValueError):
            server.build_request(dict(BASE_CONFIG, question="  "))
        with self.assertRaises(ValueError):
            server.build_request(dict(BASE_CONFIG, apiKey=""))

    def test_extract_text_for_each_provider(self):
        self.assertEqual(server.extract_text({"output_text": "hola"}), "hola")
        self.assertEqual(server.extract_text({"choices": [{"message": {"content": "chat"}}]}), "chat")
        self.assertEqual(server.extract_text({"content": [{"text": "claude"}]}), "claude")
        self.assertEqual(server.extract_text({"candidates": [{"content": {"parts": [{"text": "gemini"}]}}]}), "gemini")
        self.assertEqual(server.extract_text({}), "")


class HandlerTests(unittest.TestCase):
    """Peticiones reales al manejador; ninguna llega a un proveedor externo."""

    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.port = cls.httpd.server_address[1]
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def request(self, method, path, body=None, headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        connection.request(method, path, body=body, headers=headers or {})
        response = connection.getresponse()
        data = response.read()
        connection.close()
        return response.status, data

    def post_json(self, payload, content_type="application/json"):
        raw = payload if isinstance(payload, bytes) else json.dumps(payload).encode("utf-8")
        return self.request("POST", "/api/ai", raw, {"Content-Type": content_type, "Content-Length": str(len(raw))})

    def test_serves_index(self):
        status, data = self.request("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn(b"integral_core.js", data)

    def test_unknown_post_path(self):
        status, _ = self.request("POST", "/otra", b"{}", {"Content-Type": "application/json", "Content-Length": "2"})
        self.assertEqual(status, 404)

    def test_requires_json_content_type(self):
        status, data = self.post_json(BASE_CONFIG, content_type="text/plain")
        self.assertEqual(status, 415)
        self.assertIn("application/json", json.loads(data)["error"])

    def test_invalid_json(self):
        status, data = self.post_json(b"{no es json")
        self.assertEqual(status, 400)
        self.assertIn("JSON", json.loads(data)["error"])

    def test_body_must_be_object(self):
        status, _ = self.post_json([1, 2, 3])
        self.assertEqual(status, 400)

    def test_rejects_large_body(self):
        status, _ = self.post_json(b"{" + b" " * (server.MAX_BODY_BYTES + 1) + b"}")
        self.assertEqual(status, 413)

    def test_missing_fields_is_bad_request(self):
        status, data = self.post_json({"question": "hola"})
        self.assertEqual(status, 400)
        self.assertIn("Falta", json.loads(data)["error"])

    def test_unsafe_endpoint_is_bad_request(self):
        status, _ = self.post_json(dict(BASE_CONFIG, endpoint="file:///etc/passwd"))
        self.assertEqual(status, 400)


if __name__ == "__main__":
    unittest.main()
