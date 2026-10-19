"""Pruebas del servidor local: python -m unittest discover -s tests"""

import http.client
import os
import sys
import threading
import unittest
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import riemann_ai_server as server  # noqa: E402


class HandlerTests(unittest.TestCase):
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

    def request(self, method, path):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        connection.request(method, path)
        response = connection.getresponse()
        data = response.read()
        headers = dict(response.getheaders())
        connection.close()
        return response.status, data, headers

    def test_serves_index_with_home_menu(self):
        status, data, headers = self.request("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn(b'id="home"', data)
        self.assertIn(b"integral_core.js", data)
        self.assertEqual(headers.get("Cache-Control"), "no-store")

    def test_serves_scripts_and_vendor_files(self):
        for path in ["/integral_core.js", "/riemann_sumas_javascript.js", "/vendor/katex/katex.min.js"]:
            status, _, _ = self.request("GET", path)
            self.assertEqual(status, 200, path)

    def test_assistant_proxy_was_removed(self):
        status, _, _ = self.request("POST", "/api/ai")
        self.assertIn(status, (404, 405, 501))

    def test_missing_file(self):
        status, _, _ = self.request("GET", "/no-existe.js")
        self.assertEqual(status, 404)


if __name__ == "__main__":
    unittest.main()
