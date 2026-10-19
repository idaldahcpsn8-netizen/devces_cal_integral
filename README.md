# Yos_Sphere

Interfaz web educativa para visualizar sumas de Riemann, resolver integrales y trabajar con áreas sobre una hoja A4 importada desde imagen o PDF.

## Funciones principales

- **Menú de inicio**: al entrar se elige la sección. Cada sección tiene su propio enlace (`#riemann`, `#integrals`, `#import`, `#games`), así que el botón «atrás» del navegador vuelve al menú, y pulsar **Yos_Sphere** arriba a la izquierda también.

- **Suma de Riemann** con métodos izquierda, derecha y punto medio (hasta 20 000 rectángulos), tabla, fórmulas y pasos. La pestaña **Fórmulas** muestra cada fórmula general y, debajo, la misma con los valores actuales sustituidos (Δx, primer punto de muestra, Sₙ, la integral, F(x) por el teorema fundamental) y la **cota teórica del error** (M₁(b−a)²/2n o M₂(b−a)³/24n²) comparada con el error real. El botón **Animar n** recorre n = 1…500 para ver cómo la suma converge. La integral de referencia se calcula con cuadratura adaptativa de Gauss–Kronrod y avisa cuando la integral **diverge**, es **impropia** o la función **no está definida** en parte del intervalo.
- **Calculadora de integrales** con teclado matemático:
  - Primitivas por regla de potencia, cambio de variable (lineal y general), integración por partes, fracciones parciales (denominadores hasta grado 6, raíces repetidas y factores cuadráticos), identidades trigonométricas, arcoseno/arcotangente y raíces de cuadráticas.
  - Cada primitiva se **verifica numéricamente** (F′(x) = f(x)) antes de mostrarse.
  - Integrales definidas con límites como `0`, `pi/2`, `sqrt(2)`, `inf` o `-inf`. Si la función tiene un polo en el intervalo, no se aplica la regla de Barrow a ciegas: se informa si la integral converge o diverge.
  - Si no hay primitiva elemental (por ejemplo `exp(-x^2)`), se da el valor numérico.
  - El valor final se resalta, se muestra la forma exacta (fracción o múltiplo de π) y se puede **copiar** con un botón.
  - **Tabla de integrales** desplegable con las fórmulas básicas; «Probar» carga y resuelve un ejemplo de cada una.
- **Importar archivo**: imagen/PDF en hoja A4, marcar puntos y aproximar el área con rectángulos de punto medio; se compara con el área exacta del polígono y se avisa si el contorno se cruza.
- **Juegos** por rondas de 10 preguntas, con progreso, aciertos, racha y mejor racha (guardada en el navegador):
  - *Métodos*: elegir cómo se resuelve una integral (inmediata, cambio de variable, partes, fracciones parciales).
  - *Derivadas*: elegir la regla (potencia, producto, cociente, cadena).
  - *Primitivas*: elegir la F(x) correcta entre cuatro opciones escritas como fórmulas.
  - *Área*: estimar el área sombreada bajo una curva dibujada.
  - Cada respuesta muestra la explicación y el resultado con fórmula. Se juega con el ratón o con las teclas 1–4 y Enter.

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

Luego abre <http://127.0.0.1:5174/> (sirve `index.html`). El servidor solo usa la biblioteca estándar de Python; la app también funciona abriendo `index.html` directamente.

## Pruebas

```bash
npm test
```

Ejecuta `node --test` (núcleo matemático, `tests/core.test.js`; juegos, `tests/games.test.js`, que comprueba que cada respuesta correcta lo es y que ningún distractor de «Primitivas» deriva en el integrando) y `python3 -m unittest discover -s tests` (servidor, `tests/test_server.py`). No requieren dependencias externas ni acceso a red.

## Archivos

- `index.html` — estructura de la interfaz.
- `integral_core.js` — núcleo matemático sin DOM: analizador de expresiones, integración numérica y simbólica, formato LaTeX/lineal. Se puede probar en Node.
- `games.js` — bancos de preguntas y generador de rondas de los juegos (sin DOM, probado en Node).
- `riemann_sumas_javascript.js` — interfaz: menú de inicio, gráficas, tablas, calculadora, hoja A4 y juegos.
- `riemann_sumas_javascript.css` — estilos.
- `riemann_ai_server.py` — servidor local de archivos.
- `vendor/katex/` — KaTeX 0.16.11 (licencia MIT) con sus fuentes, para que las fórmulas se dibujen sin depender de una CDN.
- `tests/` — pruebas automatizadas.
