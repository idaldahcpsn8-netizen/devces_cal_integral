from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import urllib.error
import urllib.parse
import urllib.request


ROOT = os.path.dirname(os.path.abspath(__file__))
HOST = "127.0.0.1"
PORT = 5174
MAX_BODY_BYTES = 64 * 1024
LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1"}


def number_param(config, key, default, low, high, cast=float):
    value = config.get(key)
    if value is None or value == "":
        return default
    try:
        number = cast(value)
    except (TypeError, ValueError):
        raise ValueError(f"El parámetro {key} debe ser numérico.")
    if number != number:  # NaN
        raise ValueError(f"El parámetro {key} debe ser numérico.")
    return min(high, max(low, number))


def validate_endpoint(endpoint):
    parsed = urllib.parse.urlparse(endpoint)
    host = (parsed.hostname or "").lower()
    if parsed.scheme == "https" and host:
        return endpoint
    if parsed.scheme == "http" and host in LOCAL_HOSTS:
        return endpoint
    raise ValueError("El endpoint debe ser una URL https:// (http:// solo para servidores locales).")


def infer_provider(config):
    provider = (config.get("provider") or "").strip()
    endpoint = (config.get("endpoint") or "").lower()
    model = (config.get("model") or "").lower()
    if provider:
        return provider
    if "/responses" in endpoint:
        return "openai-responses"
    if "generativelanguage.googleapis.com" in endpoint or "gemini" in model:
        return "gemini"
    if "anthropic" in endpoint or "claude" in model:
        return "anthropic"
    return "openai-compatible"


def extract_text(data):
    if isinstance(data.get("output_text"), str):
        return data["output_text"]

    output = data.get("output") or []
    parts = []
    for item in output:
        for content in item.get("content") or []:
            text = content.get("text") or content.get("input_text")
            if text:
                parts.append(text)
    if parts:
        return "\n".join(parts)

    choices = data.get("choices") or []
    if choices:
        content = (choices[0].get("message") or {}).get("content")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            return "\n".join(part.get("text") or part.get("content") or "" for part in content)

    anthropic_parts = data.get("content") or []
    text_parts = [part.get("text") for part in anthropic_parts if part.get("text")]
    if text_parts:
        return "\n".join(text_parts)

    candidates = data.get("candidates") or []
    if candidates:
        gemini_parts = ((candidates[0].get("content") or {}).get("parts") or [])
        gemini_text = [part.get("text") for part in gemini_parts if part.get("text")]
        if gemini_text:
            return "\n".join(gemini_text)

    return ""


def build_request(config):
    provider = infer_provider(config)
    endpoint = (config.get("endpoint") or "").strip()
    api_key = (config.get("apiKey") or "").strip()
    model = (config.get("model") or "").strip()
    question = str(config.get("question") or "")
    system_prompt = str(config.get("systemPrompt") or "Responde en español.")
    max_tokens = number_param(config, "maxTokens", 700, 1, 8192, cast=lambda v: int(float(v)))
    temperature = number_param(config, "temperature", 0.2, 0.0, 2.0)
    top_p = number_param(config, "topP", 1.0, 0.0, 1.0)

    if not endpoint or not api_key or not model:
        raise ValueError("Falta endpoint, API key o modelo.")
    if not question.strip():
        raise ValueError("Falta la pregunta.")
    validate_endpoint(endpoint)

    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if provider == "anthropic":
        headers.update({
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        })
        body = {
            "model": model,
            "system": system_prompt,
            "messages": [{"role": "user", "content": question}],
            "temperature": temperature,
            "top_p": top_p,
            "max_tokens": max_tokens,
        }
    elif provider == "openai-responses":
        headers["Authorization"] = f"Bearer {api_key}"
        body = {
            "model": model,
            "input": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": question},
            ],
            "temperature": temperature,
            "top_p": top_p,
            "max_output_tokens": max_tokens,
        }
    elif provider == "gemini":
        headers["x-goog-api-key"] = api_key
        body = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [
                {"role": "user", "parts": [{"text": question}]},
            ],
            "generationConfig": {
                "temperature": temperature,
                "topP": top_p,
                "maxOutputTokens": max_tokens,
            },
        }
    else:
        headers["Authorization"] = f"Bearer {api_key}"
        body = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": question},
            ],
            "temperature": temperature,
            "top_p": top_p,
            "max_tokens": max_tokens,
            "stream": False,
        }

    return endpoint, headers, body


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def send_json(self, status, payload):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def read_json_body(self):
        content_type = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if content_type != "application/json":
            # Exigir JSON obliga a los navegadores a hacer una petición previa (CORS),
            # así otra página web no puede usar este proxy local a escondidas.
            raise PermissionError("Content-Type debe ser application/json.")
        try:
            length = int(self.headers.get("Content-Length", ""))
        except ValueError:
            raise ValueError("Falta Content-Length válido.")
        if length <= 0:
            raise ValueError("La petición está vacía.")
        if length > MAX_BODY_BYTES:
            raise OverflowError(f"La petición supera {MAX_BODY_BYTES // 1024} KB.")
        try:
            config = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ValueError("El cuerpo no es JSON válido.")
        if not isinstance(config, dict):
            raise ValueError("El cuerpo debe ser un objeto JSON.")
        return config

    def do_POST(self):
        if self.path != "/api/ai":
            self.send_error(404)
            return

        try:
            config = self.read_json_body()
            endpoint, headers, body = build_request(config)
        except PermissionError as error:
            self.send_json(415, {"error": str(error)})
            return
        except OverflowError as error:
            self.send_json(413, {"error": str(error)})
            return
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
            return

        try:
            request = urllib.request.Request(
                endpoint,
                data=json.dumps(body).encode("utf-8"),
                headers=headers,
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=45) as response:
                data = json.loads(response.read().decode("utf-8"))
            self.send_json(200, {"text": extract_text(data), "raw": data})
        except urllib.error.HTTPError as error:
            details = error.read().decode("utf-8", errors="replace")
            self.send_json(error.code, {"error": details[:800]})
        except urllib.error.URLError as error:
            self.send_json(502, {"error": f"No se pudo conectar con el proveedor: {error.reason}"})
        except json.JSONDecodeError:
            self.send_json(502, {"error": "El proveedor respondió algo que no es JSON."})
        except Exception as error:
            self.send_json(500, {"error": str(error)})


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Dev_Aldah_V3 server running at http://{HOST}:{PORT}/index.html")
    server.serve_forever()


if __name__ == "__main__":
    main()
