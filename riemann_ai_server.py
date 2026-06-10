from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import urllib.error
import urllib.request


ROOT = os.path.dirname(os.path.abspath(__file__))


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
    question = config.get("question") or ""
    system_prompt = config.get("systemPrompt") or "Responde en español."
    max_tokens = int(config.get("maxTokens") or 700)
    temperature = float(config.get("temperature") if config.get("temperature") is not None else 0.2)
    top_p = float(config.get("topP") if config.get("topP") is not None else 1)

    if not endpoint or not api_key or not model:
        raise ValueError("Falta endpoint, API key o modelo.")

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

    def do_POST(self):
        if self.path != "/api/ai":
            self.send_error(404)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            config = json.loads(self.rfile.read(length).decode("utf-8"))
            endpoint, headers, body = build_request(config)
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
        except Exception as error:
            self.send_json(500, {"error": str(error)})


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 5174), Handler)
    print("Dev_Aldah_V3 server running at http://127.0.0.1:5174/riemann_sumas_javascript.html")
    server.serve_forever()
