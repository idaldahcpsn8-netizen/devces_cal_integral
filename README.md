# Yos_Sphere

Interfaz web educativa para visualizar sumas de Riemann, resolver integrales y trabajar con áreas sobre una hoja A4 importada desde imagen o PDF.

## Funciones principales

- **Suma de Riemann** con métodos izquierda, derecha y punto medio (hasta 20 000 rectángulos), tabla, fórmulas y pasos. La integral de referencia se calcula con cuadratura adaptativa de Gauss–Kronrod y avisa cuando la integral **diverge**, es **impropia** o la función **no está definida** en parte del intervalo.
- **Calculadora de integrales** con teclado matemático:
  - Primitivas por regla de potencia, cambio de variable (lineal y general), integración por partes, fracciones parciales (denominadores hasta grado 6, raíces repetidas y factores cuadráticos), identidades trigonométricas, arcoseno/arcotangente y raíces de cuadráticas.
  - Cada primitiva se **verifica numéricamente** (F′(x) = f(x)) antes de mostrarse.
  - Integrales definidas con límites como `0`, `pi/2`, `sqrt(2)`, `inf` o `-inf`. Si la función tiene un polo en el intervalo, no se aplica la regla de Barrow a ciegas: se informa si la integral converge o diverge.
  - Si no hay primitiva elemental (por ejemplo `exp(-x^2)`), se da el valor numérico.
- **Importar archivo**: imagen/PDF en hoja A4, marcar puntos y aproximar el área con rectángulos de punto medio; se compara con el área exacta del polígono y se avisa si el contorno se cruza.
- **Juegos** de burbujas para reconocer métodos de integración y reglas de derivación.
- **Asistente IA** unificado: se configura una sola API desde el panel Asistente y se reutiliza en las ayudas de cada sección. Las respuestas matemáticas usan formato lineal, por ejemplo `3/2` y `(x + 5)/(x^2 + 3*x + 2)`.

## Cómo escribir funciones

| Escribe | Significa |
| --- | --- |
| `x^2`, `x**2`, `x²` | potencia |
| `2x`, `x(x+1)`, `2sin(x)`, `sin x` | multiplicación implícita |
| `-x^2` | −(x²) |
| `|x-1|`, `abs(x-1)` | valor absoluto |
| `ln(x)`, `log(x)` | logaritmo natural; `log10(x)` en base 10 |
| `sen`, `tg`, `arctan`… | alias en español |
| `pi`, `π`, `e` | constantes |
| `sin^2(x)` | (sin x)² |
| `(-8)^(1/3)` | raíz cúbica real (−2) |

Los errores de escritura se explican en español y el campo afectado se marca en rojo.

## Ejecutar localmente

```bash
python3 riemann_ai_server.py
```

Luego abre <http://127.0.0.1:5174/> (sirve `index.html`). El servidor solo usa la biblioteca estándar de Python.

## Pruebas

```bash
npm test
```

Ejecuta `node --test` (núcleo matemático, `tests/core.test.js`) y `python3 -m unittest discover -s tests` (servidor, `tests/test_server.py`). No requieren dependencias externas ni acceso a red.

## IA y claves API

La aplicación acepta proveedores tipo OpenAI-compatible/NVIDIA, Gemini, Anthropic, OpenAI Responses y endpoints personalizados. El proxy local (`/api/ai`) solo acepta JSON, limita el tamaño de la petición y solo reenvía a URLs `https://` (o `http://` locales).

Las claves se escriben desde la interfaz y quedan en `localStorage` del navegador durante el desarrollo. No guardes claves reales en archivos del repositorio.

## Archivos

- `index.html` — estructura de la interfaz.
- `integral_core.js` — núcleo matemático sin DOM: analizador de expresiones, integración numérica y simbólica, formato LaTeX/lineal. Se puede probar en Node.
- `riemann_sumas_javascript.js` — interfaz: gráficas, tablas, calculadora, hoja A4, juegos y asistente.
- `riemann_sumas_javascript.css` — estilos.
- `riemann_ai_server.py` — servidor local y proxy de IA.
- `vendor/katex/` — KaTeX 0.16.11 (licencia MIT) con sus fuentes, para que las fórmulas se dibujen sin depender de una CDN.
- `tests/` — pruebas automatizadas.
