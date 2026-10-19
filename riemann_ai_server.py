"""Servidor local de Yos_Sphere: sirve la aplicación en http://127.0.0.1:5174/."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os


ROOT = os.path.dirname(os.path.abspath(__file__))
HOST = "127.0.0.1"
PORT = 5174


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # Durante el desarrollo, que el navegador recargue siempre los últimos archivos.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Yos_Sphere en http://{HOST}:{PORT}/")
    server.serve_forever()


if __name__ == "__main__":
    main()
