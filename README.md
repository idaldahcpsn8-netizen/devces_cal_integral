# Dev_Aldah_V3

Interfaz web educativa para visualizar sumas de Riemann, resolver integrales y trabajar con areas sobre una hoja A4 importada desde imagen o PDF.

## Funciones principales

- Importar imagen/PDF en hoja A4, marcar puntos y aproximar el area encerrada con rectangulos de punto medio.
- Suma de Riemann con metodos izquierda, derecha y punto medio.
- Calculadora de integrales con teclado matematico, fracciones parciales, regla usada, antiderivada, resultado exacto y decimal.
- Juegos de burbujas para reconocer metodos de integracion y reglas de derivacion.
- Asistente IA unificado: se configura una sola API desde el panel Asistente y se reutiliza en las ayudas de cada seccion.
- Respuestas matematicas lineales para chat: por ejemplo `3/2` y `(x + 5)/(x^2 + 3*x + 2)`.

## Ejecutar localmente

```bash
python riemann_ai_server.py
```

Luego abre:

```text
http://127.0.0.1:5174/riemann_sumas_javascript.html
```

## IA y claves API

La aplicacion acepta proveedores tipo OpenAI-compatible/NVIDIA, Gemini, Anthropic, OpenAI Responses y endpoints personalizados.

Las claves se escriben desde la interfaz y quedan en `localStorage` del navegador durante el desarrollo. No guardes claves reales en archivos del repositorio.

## Archivos activos

- `riemann_sumas_javascript.html`
- `riemann_sumas_javascript.css`
- `riemann_sumas_javascript.js`
- `riemann_ai_server.py`

Los archivos `dev_reaman_pip.*` y otros scripts antiguos son copias o experimentos del desarrollo.
