"use strict";

const MAX_DRAW_BARS = 260;
const TABLE_EDGE_ROWS = 22;
const TABLE_MID_ROWS = 10;

const $ = id => document.getElementById(id);

const STATE = {
  fn: null,
  input: null,
  data: null,
  exact: 0,
  integral: null,
  areas: { pos: 0, neg: 0, net: 0, total: 0 }
};

const REDUCED_MOTION = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const A4 = {
  widthCm: 21,
  heightCm: 29.7,
  cellCm: 0.5,
  points: [],
  image: null,
  fileName: "Sin archivo"
};

const AI_CONFIG_KEY = "Yos_Sphere.aiConfig";
// Claves usadas antes del cambio de nombre: se leen para no perder la configuración guardada.
const LEGACY_AI_CONFIG_KEYS = ["Dev_Aldah_V3.aiConfig", "Dev_Aldah_V3.nvidiaConfig"];
let activeMathInput = null;
let chatRequestId = 0;
let sectionAiRequestId = 0;

const SECTION_HELP = {
  import: {
    title: "Ayuda IA: Importar archivo",
    hint: "Hola, ¿en qué te puedo ayudar con la hoja A4?",
    reply: "En Importar archivo puedes cargar imagen o PDF, rodear un área con puntos y calcularla con rectángulos de punto medio dentro del contorno."
  },
  riemann: {
    title: "Ayuda IA: Suma de Riemann",
    hint: "Hola, ¿en qué te puedo ayudar con la suma de Riemann?",
    reply: "En Suma de Riemann revisa f(x), el intervalo [a,b], el valor n y el método de muestra. La tabla, fórmulas y pasos se actualizan con esos datos."
  },
  integrals: {
    title: "Ayuda IA: Calculadora",
    hint: "Hola, ¿en qué te puedo ayudar con integrales?",
    reply: "En Calculadora escribe el integrando, usa límites a y b si quieres decimal, y pulsa Resolver para ver regla usada, fracción parcial, exacto y procedimiento."
  },
  games: {
    title: "Ayuda IA: Juegos",
    hint: "Hola, ¿en qué te puedo ayudar con los juegos?",
    reply: "En Juegos toca la burbuja del método correcto. Integrales practica inmediata, fracciones parciales, cambio de variable y partes; Derivadas practica reglas básicas, producto, cociente y cadena."
  }
};

const GAME_BANKS = {
  integrals: {
    label: "Integrales",
    prompt: "Elige el método que resuelve la integral.",
    options: [
      "Integración inmediata",
      "Fracciones parciales",
      "Cambio de variable",
      "Integración por partes"
    ],
    items: [
      {
        tex: "\\int x^2\\,dx",
        linear: "integral x^2 dx",
        answer: "Integración inmediata",
        result: "1/3*x^3 + C",
        fraction: "1/3",
        why: "Regla de potencia: integral x^n dx = x^(n+1)/(n+1) + C."
      },
      {
        tex: "\\int \\ln(x)\\,dx",
        linear: "integral ln(x) dx",
        answer: "Integración por partes",
        result: "x*ln(abs(x)) - x + C",
        fraction: "",
        why: "Usa partes con u = ln(x) y dv = dx."
      },
      {
        tex: "\\int \\frac{x+5}{x^2+3x+2}\\,dx",
        linear: "integral (x + 5)/(x^2 + 3*x + 2) dx",
        answer: "Fracciones parciales",
        result: "4*ln(abs(x + 1)) - 3*ln(abs(x + 2)) + C",
        fraction: "",
        why: "El denominador factoriza como (x + 1)*(x + 2)."
      },
      {
        tex: "\\int 2x\\cos(x^2)\\,dx",
        linear: "integral 2*x*cos(x^2) dx",
        answer: "Cambio de variable",
        result: "sin(x^2) + C",
        fraction: "",
        why: "Toma u = x^2, entonces du = 2*x dx."
      },
      {
        tex: "\\int e^x\\,dx",
        linear: "integral exp(x) dx",
        answer: "Integración inmediata",
        result: "exp(x) + C",
        fraction: "",
        why: "La exponencial se integra directamente."
      }
    ]
  },
  derivatives: {
    label: "Derivadas",
    prompt: "Elige la regla de derivación.",
    options: [
      "Potencia",
      "Producto",
      "Cociente",
      "Cadena"
    ],
    items: [
      {
        tex: "\\frac{d}{dx}x^5",
        linear: "d/dx x^5",
        answer: "Potencia",
        result: "5*x^4",
        fraction: "",
        why: "Regla de potencia: d/dx x^n = n*x^(n-1)."
      },
      {
        tex: "\\frac{d}{dx}\\left(x^2\\sin(x)\\right)",
        linear: "d/dx (x^2*sin(x))",
        answer: "Producto",
        result: "2*x*sin(x) + x^2*cos(x)",
        fraction: "",
        why: "Hay producto de x^2 por sin(x)."
      },
      {
        tex: "\\frac{d}{dx}\\left(\\frac{x+1}{x-1}\\right)",
        linear: "d/dx ((x + 1)/(x - 1))",
        answer: "Cociente",
        result: "-2/(x - 1)^2",
        fraction: "-2/(x - 1)^2",
        why: "Usa (u/v)' = (u'*v - u*v')/v^2."
      },
      {
        tex: "\\frac{d}{dx}\\sin(x^2)",
        linear: "d/dx sin(x^2)",
        answer: "Cadena",
        result: "2*x*cos(x^2)",
        fraction: "",
        why: "Función externa sin(u) con u = x^2."
      },
      {
        tex: "\\frac{d}{dx}\\sqrt{x+1}",
        linear: "d/dx sqrt(x + 1)",
        answer: "Cadena",
        result: "1/(2*sqrt(x + 1))",
        fraction: "1/(2*sqrt(x + 1))",
        why: "Raíz de una función interna."
      }
    ]
  }
};

const GAME_STATE = {
  mode: "integrals",
  index: 0,
  score: 0,
  answered: 0,
  locked: false
};

// Marca un campo como inválido junto al control (validación en línea).
function markField(id, message = "") {
  const el = $(id);
  if (!el) return;
  if (message) {
    el.setAttribute("aria-invalid", "true");
    el.title = message;
  } else {
    el.removeAttribute("aria-invalid");
    el.removeAttribute("title");
  }
}

function readNumberField(id, label) {
  const raw = $(id).value.trim();
  if (raw === "") {
    markField(id, `Escribe ${label}.`);
    throw new Error(`Falta el valor de ${label}.`);
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    markField(id, `${label} debe ser un número.`);
    throw new Error(`${label} debe ser un número finito.`);
  }
  markField(id);
  return value;
}

function readInputs() {
  const expr = $("exprInput").value.trim();
  const a = readNumberField("aInput", "a");
  const b = readNumberField("bInput", "b");
  const rawN = parseInt($("nInput").value, 10);
  const manualN = clampN($("nInput").value);
  const n = $("infinityInput").checked ? INFINITE_N : manualN;
  const method = $("methodInput").value;

  if (a === b) {
    markField("bInput", "b debe ser distinto de a.");
    throw new Error("El intervalo es vacío: a y b deben ser distintos.");
  }
  const nAdjusted = Number.isFinite(rawN) && rawN !== manualN;
  return { expr, a, b, n, manualN, method, nAdjusted };
}

function renderMath(el, tex, display = true) {
  if (!el || typeof katex === "undefined") {
    if (el) el.textContent = tex;
    return;
  }
  katex.render(tex, el, { displayMode: display, throwOnError: false, output: "html" });
}

function updateMathPreviews() {
  const mainExpr = $("exprInput")?.value || "";
  const integralExpr = $("integralExpr")?.value || "";
  const a = $("integralA")?.value.trim() || "";
  const b = $("integralB")?.value.trim() || "";
  document.querySelectorAll(".mode-switch [data-mode]").forEach(button => {
    const definite = Boolean(a || b);
    button.classList.toggle("is-active", button.dataset.mode === (definite ? "def" : "indef"));
  });

  renderMath($("mainExprPreview"), `f(x)=${exprToLatex(mainExpr)}`, true);
  if (a && b) {
    renderMath($("integralPreview"), `\\int_{${exprToLatex(a)}}^{${exprToLatex(b)}}\\left(${exprToLatex(integralExpr)}\\right)\\,dx`, true);
  } else {
    renderMath($("integralPreview"), `\\int\\left(${exprToLatex(integralExpr)}\\right)\\,dx`, true);
  }
}

function mathToString(tex, display = false) {
  if (typeof katex === "undefined") return tex;
  return katex.renderToString(tex, { displayMode: display, throwOnError: false, output: "html" });
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function wrapLatexLinearPart(text) {
  const value = String(text || "").trim();
  return /^[a-zA-Z0-9.+-]+(?:\^-?[a-zA-Z0-9.]+)?$/.test(value) ? value : `(${value})`;
}

function latexToLinear(text) {
  let out = String(text || "");
  for (let i = 0; i < 4; i++) {
    out = out.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_, numerator, denominator) => {
      const top = latexToLinear(numerator);
      const bottom = latexToLinear(denominator);
      return `${wrapLatexLinearPart(top)}/${wrapLatexLinearPart(bottom)}`;
    });
  }
  return out
    .replace(/\\left|\\right/g, "")
    .replace(/\\,/g, "")
    .replace(/\\cdot/g, "*")
    .replace(/\\approx/g, "≈")
    .replace(/\\int/g, "integral")
    .replace(/\\sum/g, "sum")
    .replace(/\\ln/g, "ln")
    .replace(/\\sin/g, "sin")
    .replace(/\\cos/g, "cos")
    .replace(/\\tan/g, "tan")
    .replace(/\\arctan/g, "atan")
    .replace(/\^\{([^{}]+)\}/g, "^$1")
    .replace(/[{}]/g, "")
    .trim();
}

function renderInlineAiText(text) {
  const source = String(text ?? "");
  const mathPattern = /(\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^\n$]+?)\$)/g;
  let html = "";
  let last = 0;
  let match;

  const renderPlain = plain => escapeHtml(plain)
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_, numerator, denominator) => `${wrapLatexLinearPart(latexToLinear(numerator))}/${wrapLatexLinearPart(latexToLinear(denominator))}`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

  while ((match = mathPattern.exec(source))) {
    html += renderPlain(source.slice(last, match.index));
    const tex = match[2] || match[3] || match[4] || match[5] || "";
    html += `<span class="linear-math">${escapeHtml(latexToLinear(tex))}</span>`;
    last = match.index + match[0].length;
  }
  html += renderPlain(source.slice(last));
  return html;
}

function renderAiBlock(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  let html = "";
  let listOpen = false;

  const closeList = () => {
    if (listOpen) {
      html += "</ul>";
      listOpen = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }
    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (!listOpen) {
        html += "<ul>";
        listOpen = true;
      }
      html += `<li>${renderInlineAiText(bullet[1])}</li>`;
      continue;
    }
    closeList();
    html += `<p>${renderInlineAiText(trimmed)}</p>`;
  }
  closeList();
  return html;
}

function renderAiContent(text) {
  const parts = String(text ?? "").trim().split(/```/);
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      const code = part.replace(/^\w+\s*\n/, "");
      return `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
    }
    return renderAiBlock(part);
  }).join("");
}

function setRenderedMessage(el, text) {
  el.innerHTML = `<div class="ai-message-content">${renderAiContent(text)}</div>`;
}

function stepHTML(step) {
  const math = step.tex ? `<div class="smath">${mathToString(step.tex, true)}</div>` : "";
  return `
    <div class="scard">
      <div class="srail"><div class="sdot">${step.n}</div><div class="sline"></div></div>
      <div class="sbody">
        <div class="slbl">${step.label}</div>
        ${math}
        <p class="sdesc">${step.desc}</p>
      </div>
    </div>`;
}

function renderSteps(id, steps) {
  const el = $(id);
  if (!el) return;
  el.innerHTML = steps.map(stepHTML).join("");
}

function animateSteps(selector) {
  if (typeof gsap === "undefined" || REDUCED_MOTION) return;
  const cards = document.querySelectorAll(`${selector} .scard`);
  if (!cards.length) return;
  gsap.fromTo(cards, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.22, stagger: 0.03, ease: "power3.out", clearProps: "transform" });
}

function currentGameBank() {
  return GAME_BANKS[GAME_STATE.mode] || GAME_BANKS.integrals;
}

function currentGameItem() {
  const bank = currentGameBank();
  return bank.items[GAME_STATE.index % bank.items.length];
}

function gameSolutionText() {
  const bank = currentGameBank();
  const item = currentGameItem();
  return [
    `Juego: ${bank.label}.`,
    `Ejercicio: ${item.linear}.`,
    `Respuesta correcta: ${item.answer}.`,
    `Resultado: ${item.result}.`,
    item.fraction ? `Forma en fracción: ${item.fraction}.` : "",
    `Motivo: ${item.why}`
  ].filter(Boolean).join("\n");
}

function renderGame() {
  if (!$("gameExpression")) return;
  const bank = currentGameBank();
  const item = currentGameItem();
  $("gameKind").textContent = bank.label;
  $("gamePrompt").textContent = bank.prompt;
  renderMath($("gameExpression"), item.tex, false);
  $("gameScore").textContent = `${GAME_STATE.score}/${GAME_STATE.answered}`;
  if (!GAME_STATE.locked) $("gameFeedbackText").textContent = "Toca la burbuja correcta.";

  document.querySelectorAll(".game-tab").forEach(tab => {
    tab.classList.toggle("is-active", tab.dataset.game === GAME_STATE.mode);
  });

  const arena = $("bubbleArena");
  arena.innerHTML = "";
  bank.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bubble-option";
    button.style.setProperty("--bubble-delay", `${index * 45}ms`);
    button.textContent = option;
    button.addEventListener("click", () => answerGame(option));
    arena.appendChild(button);
  });
}

function setGameMode(mode) {
  GAME_STATE.mode = GAME_BANKS[mode] ? mode : "integrals";
  GAME_STATE.index = 0;
  GAME_STATE.score = 0;
  GAME_STATE.answered = 0;
  GAME_STATE.locked = false;
  renderGame();
}

function answerGame(option) {
  if (GAME_STATE.locked) return;
  const item = currentGameItem();
  const correct = option === item.answer;
  GAME_STATE.locked = true;
  GAME_STATE.answered += 1;
  if (correct) GAME_STATE.score += 1;

  document.querySelectorAll(".bubble-option").forEach(button => {
    const isAnswer = button.textContent === item.answer;
    const isChosen = button.textContent === option;
    button.classList.toggle("is-correct", isAnswer);
    button.classList.toggle("is-wrong", isChosen && !correct);
    button.disabled = true;
  });

  const fractionText = item.fraction ? ` Forma en fracción: ${item.fraction}.` : "";
  $("gameScore").textContent = `${GAME_STATE.score}/${GAME_STATE.answered}`;
  $("gameFeedbackText").textContent = `${correct ? "Correcto." : "No. Era: " + item.answer + "."} Resultado: ${item.result}.${fractionText} ${item.why}`;
}

function nextGame() {
  const bank = currentGameBank();
  GAME_STATE.index = (GAME_STATE.index + 1) % bank.items.length;
  GAME_STATE.locked = false;
  renderGame();
}

function resetGame() {
  GAME_STATE.index = 0;
  GAME_STATE.score = 0;
  GAME_STATE.answered = 0;
  GAME_STATE.locked = false;
  renderGame();
}

// Muestrea la curva cortando el trazo en los polos y calcula un rango vertical
// robusto para que una asíntota no aplaste el resto de la gráfica.
function curveSamples(fn, left, right, singularities = []) {
  const x = [];
  const y = [];
  for (let i = 0; i <= 720; i++) {
    const xv = left + (right - left) * i / 720;
    const yv = fn(xv);
    x.push(xv);
    y.push(Number.isFinite(yv) ? yv : null);
  }

  const finite = y.filter(v => v !== null).sort((p, q) => p - q);
  if (!finite.length) return { x, y, range: null };
  const pick = q => finite[Math.min(finite.length - 1, Math.floor(q * (finite.length - 1)))];
  const lo = Math.min(0, pick(0.03));
  const hi = Math.max(0, pick(0.97));
  const span = Math.max(hi - lo, 1e-9);

  for (let i = 1; i < y.length; i++) {
    if (y[i] === null || y[i - 1] === null) continue;
    const crossesPole = singularities.some(s => s > x[i - 1] && s <= x[i]);
    const jumps = Math.sign(y[i]) !== Math.sign(y[i - 1]) && Math.abs(y[i] - y[i - 1]) > 4 * span;
    if (crossesPole || jumps) y[i] = null;
  }

  const outliers = finite[0] < lo - 3 * span || finite[finite.length - 1] > hi + 3 * span;
  return { x, y, range: outliers ? [lo - 0.35 * span, hi + 0.35 * span] : null };
}

// Colores de la gráfica tomados de los tokens del tema (claro u oscuro).
function themeColors() {
  const css = getComputedStyle(document.documentElement);
  const token = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return {
    surface: token("--surface", "#ffffff"),
    text: token("--text", "#1d1d1f"),
    muted: token("--muted", "#6e6e73"),
    line: token("--line", "rgba(60,60,67,.12)"),
    line2: token("--line-2", "rgba(60,60,67,.22)"),
    faint: token("--faint", "#aeaeb2"),
    fill: token("--fill", "rgba(118,118,128,.12)"),
    blue: token("--blue", "#007aff"),
    blueSoft: token("--blue-soft", "rgba(0,122,255,.1)"),
    blueLine: token("--blue-line", "rgba(0,122,255,.35)"),
    redSoft: token("--red-soft", "rgba(255,59,48,.1)"),
    redLine: token("--red-line", "rgba(255,59,48,.35)"),
    red: token("--red", "#d70015"),
    orange: token("--orange", "#ff9500"),
    violet: token("--violet", "#5856d6"),
    sans: token("--sans", "system-ui, sans-serif")
  };
}

// Plano cartesiano con el lenguaje de las gráficas de Apple: ejes discretos,
// rejilla tenue, curva en el azul del sistema y rectángulos translúcidos.
function drawGraph(input) {
  if (typeof Plotly === "undefined" || !STATE.fn || !STATE.data) return;
  const colors = themeColors();

  const a = input.a;
  const b = input.b;
  const left = Math.min(a, b);
  const right = Math.max(a, b);
  const pad = Math.max((right - left) * 0.18, 0.75);
  const viewLeft = left - pad;
  const viewRight = right + pad;
  const curve = curveSamples(STATE.fn, viewLeft, viewRight, STATE.integral?.singularities || []);
  const traces = [];
  const infinite = $("infinityInput").checked;

  if ($("rectsInput").checked && !infinite) {
    const skip = Math.max(1, Math.ceil(STATE.data.rects.length / MAX_DRAW_BARS));
    const bx = [];
    const by = [];
    const bw = [];
    const bc = [];
    const bl = [];
    for (let k = 0; k < STATE.data.rects.length; k += skip) {
      const r = STATE.data.rects[k];
      bx.push((r.x0 + r.x1) / 2);
      by.push(r.y);
      bw.push(Math.abs(r.x1 - r.x0) * (STATE.data.rects.length > 120 ? 1 : 0.9));
      bc.push(r.y >= 0 ? colors.blueSoft : colors.redSoft);
      bl.push(r.y >= 0 ? colors.blueLine : colors.redLine);
    }
    traces.push({
      type: "bar",
      x: bx,
      y: by,
      width: bw,
      marker: { color: bc, line: { color: bl, width: STATE.data.rects.length > 120 ? 0 : 1 }, cornerradius: STATE.data.rects.length > 60 ? 0 : 3 },
      hovertemplate: "Rectángulo<br>x* = %{x:.4f}<br>f(x*) = %{y:.4f}<extra></extra>",
      showlegend: false
    });
  }

  if ($("rectsInput").checked && infinite) {
    const px = [];
    const py = [];
    const ny = [];
    for (let i = 0; i <= 480; i++) {
      const xv = left + (right - left) * i / 480;
      const raw = STATE.fn(xv);
      const yv = Number.isFinite(raw) ? raw : 0;
      px.push(xv);
      py.push(yv >= 0 ? yv : 0);
      ny.push(yv < 0 ? yv : 0);
    }
    traces.push({ x: px, y: py, type: "scatter", mode: "none", fill: "tozeroy", fillcolor: colors.blueSoft, showlegend: false, hoverinfo: "skip" });
    traces.push({ x: px, y: ny, type: "scatter", mode: "none", fill: "tozeroy", fillcolor: colors.redSoft, showlegend: false, hoverinfo: "skip" });
  }

  traces.push({
    x: curve.x,
    y: curve.y,
    type: "scatter",
    mode: "lines",
    line: { color: colors.blue, width: 3 },
    name: "f(x)",
    showlegend: false,
    hovertemplate: "x = %{x:.4f}<br>f(x) = %{y:.4f}<extra></extra>"
  });

  if ($("samplesInput").checked && !infinite) {
    const skip = Math.max(1, Math.ceil(STATE.data.rects.length / 120));
    const sx = [];
    const sy = [];
    for (let k = 0; k < STATE.data.rects.length; k += skip) {
      sx.push(STATE.data.rects[k].sample);
      sy.push(STATE.data.rects[k].y);
    }
    traces.push({
      x: sx,
      y: sy,
      type: "scatter",
      mode: "markers",
      marker: { color: colors.surface, size: STATE.data.rects.length > 60 ? 5 : 8, line: { color: colors.orange, width: 2 } },
      hovertemplate: "Muestra<br>x* = %{x:.4f}<br>f(x*) = %{y:.4f}<extra></extra>",
      showlegend: false
    });
  }

  const showGrid = $("gridInput").checked;
  const axis = {
    showline: false,
    showgrid: showGrid,
    gridcolor: colors.line,
    gridwidth: 1,
    zeroline: true,
    zerolinecolor: colors.faint,
    zerolinewidth: 1.5,
    ticks: "",
    ticklen: 0,
    nticks: 9,
    tickfont: { family: colors.sans, size: 11, color: colors.muted },
    automargin: true,
    showspikes: true,
    spikecolor: colors.line2,
    spikethickness: 1,
    spikedash: "solid",
    spikemode: "across",
    spikesnap: "cursor"
  };
  const boundLabel = (x, text, yshift) => ({
    x,
    y: 0,
    text,
    showarrow: false,
    yshift,
    bgcolor: colors.surface,
    bordercolor: colors.line2,
    borderwidth: 1,
    borderpad: 4,
    font: { size: 11, color: colors.text, family: colors.sans }
  });
  const layout = {
    paper_bgcolor: colors.surface,
    plot_bgcolor: colors.surface,
    font: { family: colors.sans, size: 12, color: colors.muted },
    hoverlabel: {
      bgcolor: colors.surface,
      bordercolor: colors.line2,
      font: { family: colors.sans, size: 12, color: colors.text },
      align: "left"
    },
    margin: { l: 44, r: 18, t: 8, b: 30 },
    xaxis: { ...axis, range: [viewLeft, viewRight] },
    yaxis: { ...axis, ...(curve.range ? { range: curve.range } : {}) },
    shapes: [
      { type: "line", x0: a, x1: a, y0: 0, y1: 1, yref: "paper", line: { color: colors.faint, width: 1, dash: "dot" }, layer: "below" },
      { type: "line", x0: b, x1: b, y0: 0, y1: 1, yref: "paper", line: { color: colors.faint, width: 1, dash: "dot" }, layer: "below" }
    ],
    annotations: [boundLabel(a, `a = ${fmt(a, 2)}`, -18), boundLabel(b, `b = ${fmt(b, 2)}`, -18)],
    hovermode: "closest",
    hoverdistance: 24,
    dragmode: "pan",
    bargap: 0,
    bargroupgap: 0
  };
  const config = {
    responsive: true,
    displayModeBar: "hover",
    displaylogo: false,
    scrollZoom: true,
    modeBarButtonsToRemove: ["select2d", "lasso2d", "autoScale2d", "zoomIn2d", "zoomOut2d", "toggleSpikelines", "hoverClosestCartesian", "hoverCompareCartesian"],
    toImageButtonOptions: { filename: "yos_sphere", format: "png", scale: 2 }
  };
  Plotly.react("plotlyGraph", traces, layout, config);
}

function integralHasValue() {
  return Number.isFinite(STATE.exact);
}

// Texto corto para la integral según su diagnóstico (diverge, no definida...).
function integralLabel(value = STATE.exact, status = STATE.integral?.status) {
  if (status === "divergent") return "Diverge";
  if (status === "undefined") return "No definida";
  return fmt(value);
}

function integralTex(value = STATE.exact, status = STATE.integral?.status) {
  if (status === "divergent") return "\\text{diverge}";
  if (status === "undefined") return "\\text{no definida}";
  return fmt(value);
}

function updateMetrics(input) {
  const infinite = $("infinityInput").checked;
  const error = Math.abs(STATE.data.sum - STATE.exact);
  $("metricN").textContent = infinite ? "∞" : String(input.manualN);
  $("metricDx").textContent = infinite ? "0" : fmt(STATE.data.dx);
  $("metricSum").textContent = infinite ? integralLabel() : fmt(STATE.data.sum);
  $("metricIntegral").textContent = integralLabel();
  $("metricError").textContent = !integralHasValue() ? "—" : fmt(infinite ? 0 : error);
  $("metricTotal").textContent = Number.isFinite(STATE.areas.total) ? fmt(STATE.areas.total) : "—";
}

function compactTableRows(rects) {
  if (rects.length <= TABLE_EDGE_ROWS * 2 + TABLE_MID_ROWS) {
    return rects.map(r => ({ type: "row", value: r }));
  }

  const middleStart = Math.max(TABLE_EDGE_ROWS, Math.floor(rects.length / 2) - Math.floor(TABLE_MID_ROWS / 2));
  const middleEnd = Math.min(rects.length - TABLE_EDGE_ROWS, middleStart + TABLE_MID_ROWS);
  return [
    ...rects.slice(0, TABLE_EDGE_ROWS).map(r => ({ type: "row", value: r })),
    { type: "gap", hidden: middleStart - TABLE_EDGE_ROWS },
    ...rects.slice(middleStart, middleEnd).map(r => ({ type: "row", value: r })),
    { type: "gap", hidden: rects.length - TABLE_EDGE_ROWS - middleEnd },
    ...rects.slice(-TABLE_EDGE_ROWS).map(r => ({ type: "row", value: r }))
  ].filter(item => item.type === "row" || item.hidden > 0);
}

function updateTable() {
  const body = $("rectTable");
  const note = $("tableNote");
  body.innerHTML = "";

  const rows = compactTableRows(STATE.data.rects);
  const visibleRows = rows.filter(r => r.type === "row").length;
  note.textContent = STATE.data.rects.length > visibleRows
    ? `Mostrando ${visibleRows} de ${STATE.data.rects.length}: inicio, centro y final`
    : `Mostrando ${visibleRows} filas`;

  for (const item of rows) {
    const tr = document.createElement("tr");
    if (item.type === "gap") {
      tr.innerHTML = `<td colspan="6">… ${item.hidden} filas ocultas para mantener la tabla compacta …</td>`;
      body.appendChild(tr);
      continue;
    }

    const r = item.value;
    tr.innerHTML = `
      <td>${r.i}</td>
      <td>[${fmt(r.p, 3)}, ${fmt(r.q, 3)}]</td>
      <td>${fmt(r.sample)}</td>
      <td>${fmt(r.y)}</td>
      <td>${fmt(r.area)}</td>
      <td>${fmt(r.cum)}</td>`;
    body.appendChild(tr);
  }
}

function updateSteps(input) {
  const method = { left: "izquierda", right: "derecha", midpoint: "punto medio" }[input.method];
  const sampleRule = {
    left: "x_i^*=a+(i-1)\\Delta x",
    right: "x_i^*=a+i\\Delta x",
    midpoint: "x_i^*=a+\\left(i-\\tfrac{1}{2}\\right)\\Delta x"
  }[input.method];
  const firstValues = STATE.data.rects.slice(0, 3)
    .map((r, i) => `f(x_{${i + 1}}^*)=${fmt(r.y)}`)
    .join(",\\;");
  const suffix = STATE.data.rects.length > 3 ? ",\\ldots" : "";
  const infinite = $("infinityInput").checked;
  const error = Math.abs(STATE.data.sum - STATE.exact);
  const integralNote = STATE.integral?.status && STATE.integral.status !== "ok"
    ? integralStatusMessage(STATE.integral)
    : "Valor de referencia por cuadratura adaptativa de Gauss–Kronrod.";

  renderSteps("stepsTimeline", [
    { n: 1, label: "Planteamiento", tex: `\\int_{${fmt(input.a)}}^{${fmt(input.b)}}\\!\\left(${exprToLatex(input.expr)}\\right)dx`, desc: `Área neta bajo f(x) en [${fmt(input.a)}, ${fmt(input.b)}].` },
    { n: 2, label: "Partición", tex: `\\Delta x=\\frac{${fmt(input.b)}-(${fmt(input.a)})}{${infinite ? "n" : input.manualN}}=${fmt(STATE.data.dx)}`, desc: "Dividimos el intervalo en subintervalos iguales." },
    { n: 3, label: "Muestras", tex: sampleRule, desc: `Método seleccionado: ${method}.` },
    { n: 4, label: "Evaluación", tex: `${firstValues}${suffix}`, desc: "Primeras evaluaciones de la función." },
    { n: 5, label: "Suma", tex: `S_n=\\sum_{i=1}^{n}f(x_i^*)\\Delta x\\approx ${fmt(STATE.data.sum)}`, desc: "Suma de las áreas rectangulares." },
    { n: 6, label: "Integral", tex: `\\lim_{n\\to\\infty}S_n=\\int_{${fmt(input.a)}}^{${fmt(input.b)}}f(x)\\,dx=${integralTex()}`, desc: integralNote },
    { n: 7, label: "Error", tex: integralHasValue() ? `|S_n-I|=${fmt(infinite ? 0 : error)}` : "|S_n-I|\\ \\text{no aplica}", desc: integralHasValue() ? "Diferencia absoluta entre la suma y la integral." : "Sin integral finita no hay error que medir: S_n no converge a un número." },
    { n: 8, label: "Áreas", tex: Number.isFinite(STATE.areas.total) ? `A^+=${fmt(STATE.areas.pos)},\\;A^-=${fmt(STATE.areas.neg)},\\;A_{total}=${fmt(STATE.areas.total)}` : "A_{total}\\ \\text{no es finita}", desc: "Desglose entre área positiva, negativa y total." }
  ]);
}

function updateChrome(input) {
  const expr = displayExpr(input.expr);
  const infinite = $("infinityInput").checked;
  $("objectFunction").textContent = `f(x)=${expr}`;
  $("graphExpression").textContent = `f(x)=${expr}`;
  $("badgeMethod").textContent = methodLabel(input.method);
  $("badgeInterval").textContent = `[${fmt(input.a, 2)}, ${fmt(input.b, 2)}]`;
  $("badgeRows").textContent = infinite ? "límite n→∞" : `${input.manualN} rectángulos`;
  if (document.activeElement !== $("commandInput")) {
    $("commandInput").value = input.expr;
  }
}

function syncMethodButtons(method) {
  const buttons = [...document.querySelectorAll(".seg-btn")];
  buttons.forEach(btn => btn.classList.toggle("is-active", btn.dataset.method === method));
  const index = buttons.findIndex(btn => btn.dataset.method === method);
  document.querySelector(".segmented")?.style.setProperty("--seg-index", String(Math.max(0, index)));
}

function setStatus(message, type = "") {
  const bar = $("statusBar");
  bar.textContent = message;
  bar.className = type ? `status-pill ${type}` : "status-pill";
}

function computeRiemann(input) {
  const fn = compile(input.expr);
  const data = riemann(fn, input.a, input.b, input.n, input.method);
  const analysis = analyzeIntegral(fn, input.a, input.b);
  return { input, fn, data, integral: analysis.net, exact: analysis.net.value, areas: analysis.areas };
}

function riemannWarning(input) {
  const notes = [];
  if (STATE.integral && STATE.integral.status !== "ok") notes.push(integralStatusMessage(STATE.integral));
  if (STATE.data.invalid) notes.push(`f(x) no está definida en ${STATE.data.invalid} punto(s) de muestra; esos rectángulos se tomaron con altura 0.`);
  if (input.nAdjusted) notes.push(`n se ajustó a ${input.manualN} (rango permitido: 1 a ${MAX_N}).`);
  return notes.join(" ");
}

// Agrupa los eventos de entrada en un único recálculo por cuadro de animación,
// para que arrastrar el control de n siga el puntero sin acumular trabajo.
let updateFrame = 0;
function scheduleUpdate() {
  if (updateFrame) return;
  const run = () => {
    updateFrame = 0;
    updateAll();
  };
  updateFrame = typeof requestAnimationFrame === "function" ? requestAnimationFrame(run) : setTimeout(run, 0);
}

function updateAll() {
  try {
    const input = readInputs();
    markField("exprInput");
    let result;
    try {
      result = computeRiemann(input);
    } catch (error) {
      markField("exprInput", error.message);
      throw error;
    }
    Object.assign(STATE, result);
    document.querySelector(".workspace")?.classList.remove("is-stale");

    if (document.activeElement !== $("nInput")) $("nInput").value = input.manualN;
    $("nRange").value = input.manualN;
    syncMethodButtons(input.method);
    updateMetrics(input);
    updateChrome(input);
    updateMathPreviews();
    drawGraph(input);
    updateTable();
    updateSteps(input);
    if ($("pAssistant")?.classList.contains("show")) updateAssistant("summary");

    const warning = riemannWarning(input);
    const status = $("infinityInput").checked
      ? "Modo límite n→∞: se muestra el área continua"
      : `OK · ${input.manualN} rectángulos · ${methodLabel(input.method)}`;
    setStatus(warning || status, warning ? "warn" : "");
  } catch (error) {
    // Los resultados visibles corresponden a la última entrada válida: se atenúan.
    document.querySelector(".workspace")?.classList.add("is-stale");
    setStatus(error.message, "err");
  }
}

function boundTex(value) {
  if (value === Infinity) return "\\infty";
  if (value === -Infinity) return "-\\infty";
  return fmt(value);
}

function definiteResultTex(solution) {
  const d = solution.definite;
  const integral = `\\int_{${boundTex(d.a)}}^{${boundTex(d.b)}}\\!\\left(${exprToLatex(solution.expr)}\\right)dx`;
  if (d.status === "divergent") return `${integral}\\quad\\text{diverge}`;
  if (d.status === "undefined") return `${integral}\\quad\\text{no existe en }\\mathbb{R}`;
  if (d.method === "symbolic") {
    const exact = `\\left[${exprToLatex(solution.anti)}\\right]_{${boundTex(d.a)}}^{${boundTex(d.b)}}`;
    const rounded = Math.round(d.value);
    const exactValue = fractionValueText(d.value) ? valueTex(d.value) : Math.abs(d.value - rounded) < 1e-10 ? String(rounded) : "";
    return `${integral}=${exact}${exactValue ? `=${exactValue}` : ""}\\approx ${fmt(d.value, 8)}`;
  }
  return `${integral}\\approx ${fmt(d.value, 8)}`;
}

function renderSolverSummary(solution) {
  const summary = $("solverSummary");
  if (!summary) return;
  const d = solution.definite;
  const rule = solution.rules.length ? solution.rules.join(" + ") : RULE_NUMERIC_LABEL;
  const rows = [`<div><span>Regla usada</span><b>${escapeHtml(rule)}</b></div>`];
  if (solution.anti) {
    rows.push(`<div><span>Primitiva</span><b class="summary-math">${mathToString(`\\displaystyle ${exprToLatex(solution.anti)}+C`, false)}</b></div>`);
  } else {
    rows.push(`<div><span>Primitiva</span><b>Sin primitiva elemental</b></div>`);
  }
  if (d) {
    const finite = Number.isFinite(d.value);
    rows.push(`<div><span>Decimal</span><b>${finite ? fmt(d.value, 8) : escapeHtml(integralLabel(d.value, d.status))}</b></div>`);
    const fraction = finite ? fractionValueText(d.value) : "";
    const piForm = finite && !fraction ? piMultipleText(d.value) : "";
    if (fraction || piForm) {
      rows.push(`<div><span>Forma exacta</span><b class="summary-math">${mathToString(`\\displaystyle ${exprToLatex(fraction || piForm)}`, false)}</b></div>`);
    }
  } else {
    rows.push(`<div><span>Decimal</span><b>Sin límites definidos</b></div>`);
  }
  if (solution.partial) {
    rows.push(`<div><span>Fracción parcial</span><b class="summary-math">${mathToString(`\\displaystyle ${exprToLatex(solution.partial.dec)}`, false)}</b></div>`);
  }
  const note = d?.message || (!solution.anti ? solution.symbolicError : "");
  if (note) rows.push(`<div class="summary-note"><span>Diagnóstico</span><b>${escapeHtml(note)}</b></div>`);
  summary.innerHTML = rows.join("");
}

const RULE_NUMERIC_LABEL = "Integración numérica adaptativa (Gauss–Kronrod)";

function integralSolutionSteps(solution) {
  const d = solution.definite;
  const latexExpr = exprToLatex(solution.expr);
  const steps = [{
    label: "Planteamiento",
    tex: d ? `\\int_{${boundTex(d.a)}}^{${boundTex(d.b)}}\\!\\left(${latexExpr}\\right)dx` : `\\int\\!\\left(${latexExpr}\\right)dx`,
    desc: d ? "Identificamos una integral definida." : "Identificamos una integral indefinida."
  }];
  if (solution.partial) steps.push(...solution.partial.steps);
  if (solution.anti) {
    const rule = solution.rules.join(" + ");
    steps.push(
      { label: "Fórmula usada", tex: formulaForRule(rule), desc: rule },
      { label: d ? "Antiderivada" : "Resultado exacto", tex: `F(x)=${exprToLatex(solution.anti)}+C`, desc: "Primitiva verificada numéricamente: F'(x) coincide con f(x)." }
    );
  } else {
    steps.push({ label: "Sin primitiva elemental", tex: "", desc: d ? `${solution.symbolicError} Calculamos el valor numéricamente.` : `${solution.symbolicError} Escribe límites a y b para obtener el valor numérico.` });
  }
  if (d) {
    if (d.status !== "ok") steps.push({ label: "Diagnóstico", tex: "", desc: d.message });
    if (d.method === "symbolic") {
      const exact = `\\left[F(x)\\right]_{${boundTex(d.a)}}^{${boundTex(d.b)}}=F(${boundTex(d.b)})-F(${boundTex(d.a)})`;
      steps.push({ label: "Evaluación", tex: `${exact}=${valueTex(d.value)}`, desc: "Aplicamos el teorema fundamental del cálculo." });
    } else if (d.status !== "divergent" && d.status !== "undefined") {
      if (d.message && d.status === "ok") steps.push({ label: "Aviso", tex: "", desc: d.message });
      steps.push({ label: "Valor numérico", tex: formulaForRule(RULE_NUMERIC_LABEL), desc: d.status === "improper" ? "Integramos por tramos alrededor de las singularidades y comprobamos que el área converge." : "Cuadratura adaptativa: subdivide donde el error estimado es mayor." });
    }
    if (Number.isFinite(d.value)) steps.push({ label: "Decimal", tex: `\\approx ${fmt(d.value, 8)}`, desc: "Valor numérico final." });
  }
  return steps.map((step, index) => ({ ...step, n: index + 1 }));
}

function showIntegralError(message, fieldId) {
  const result = $("integralResult");
  result.textContent = `Error: ${message}`;
  result.classList.add("is-error");
  markField(fieldId, message);
  $("solverSummary").innerHTML = "";
  renderSteps("integralSteps", [{ n: 1, label: "Revisa la entrada", tex: "", desc: message }]);
}

function solveIntegralAdvanced() {
  const expr = $("integralExpr").value;
  const aText = $("integralA").value.trim();
  const bText = $("integralB").value.trim();
  const result = $("integralResult");
  result.classList.remove("is-error");
  ["integralExpr", "integralA", "integralB"].forEach(id => markField(id));
  updateMathPreviews();

  try {
    compile(expr);
  } catch (error) {
    showIntegralError(error.message, "integralExpr");
    return;
  }
  if (Boolean(aText) !== Boolean(bText)) {
    showIntegralError("Escribe ambos límites a y b, o déjalos vacíos para la integral indefinida.", aText ? "integralB" : "integralA");
    return;
  }
  for (const [id, text] of [["integralA", aText], ["integralB", bText]]) {
    if (!text) continue;
    try {
      evaluateBound(text);
    } catch (error) {
      showIntegralError(error.message, id);
      return;
    }
  }

  let solution;
  try {
    solution = solveIntegral(expr, aText, bText);
  } catch (error) {
    showIntegralError(error.message, "integralExpr");
    return;
  }

  renderSolverSummary(solution);
  if (solution.definite) {
    renderMath(result, definiteResultTex(solution), true);
  } else if (solution.anti) {
    renderMath(result, `\\int\\!\\left(${exprToLatex(solution.expr)}\\right)dx=${exprToLatex(solution.anti)}+C`, true);
  } else {
    result.textContent = "Sin primitiva elemental. Añade límites a y b para calcular el valor numérico.";
  }
  renderSteps("integralSteps", integralSolutionSteps(solution));
  animateSteps("#integralSteps");
}


function cycleExample(id, examples) {
  const current = $(id).value;
  const next = examples[(examples.indexOf(current) + 1) % examples.length];
  $(id).value = next;
}

function exportCSV() {
  if (!STATE.data) return;
  const header = "i,intervalo,xi*,f(xi*),area,parcial";
  const rows = STATE.data.rects.map(r => [
    r.i,
    `"[${r.p}; ${r.q}]"`,
    r.sample,
    r.y,
    r.area,
    r.cum
  ].join(","));
  const blob = new Blob([`\uFEFF${header}\n${rows.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "riemann.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.t === name));
  document.querySelectorAll(".pane").forEach(pane => pane.classList.toggle("show", pane.id === name));
  if (name === "pTools") {
    setSectionActive("integrals");
    setWorkspaceSection("integrals");
  } else if (name === "pAssistant") {
    setSectionActive("assistant");
    setWorkspaceSection("assistant");
  } else if (name === "pGames") {
    setSectionActive("games");
    setWorkspaceSection("games");
    renderGame();
  } else if (name === "pImport") {
    setSectionActive("import");
    setWorkspaceSection("import");
  } else {
    setSectionActive("riemann");
    setWorkspaceSection("riemann");
  }
  if (name === "pResolve") animateSteps("#stepsTimeline");
}

function switchSub(name) {
  document.querySelectorAll(".stab").forEach(tab => tab.classList.toggle("active", tab.dataset.st === name));
  document.querySelectorAll(".spane").forEach(pane => pane.classList.toggle("show", pane.id === name));
}

function setSectionActive(section) {
  document.querySelectorAll(".section-tab").forEach(tab => {
    tab.classList.toggle("is-active", tab.dataset.section === section);
  });
  updateSectionAiHelp();
}

function setWorkspaceSection(section) {
  const workspace = document.querySelector(".workspace");
  if (!workspace) return;
  workspace.classList.remove("section-import", "section-riemann", "section-integrals", "section-assistant", "section-games");
  workspace.classList.add(`section-${section}`);
}

function showDetailsPanel() {
  document.querySelector(".workspace")?.classList.remove("details-collapsed");
  setTimeout(() => {
    if (typeof Plotly !== "undefined") Plotly.Plots.resize("plotlyGraph");
  }, 80);
}

function switchMainSection(section) {
  setSectionActive(section);

  if (section === "import") {
    showDetailsPanel();
    switchTab("pImport");
    setStatus("Carga una imagen o PDF y marca el contorno");
    return;
  }

  if (section === "riemann") {
    switchTab("pTabla");
    $("exprInput").focus();
    updateAll();
    return;
  }

  showDetailsPanel();
  if (section === "integrals") {
    switchTab("pTools");
    switchSub("sInt");
    $("integralExpr").focus();
    solveIntegralAdvanced();
    setStatus("Integrales");
    return;
  }

  if (section === "assistant") {
    switchTab("pAssistant");
    updateAssistant("summary");
    setStatus("Asistente");
    return;
  }

  if (section === "games") {
    switchTab("pGames");
    renderGame();
    setStatus("Juegos");
  }
}

function initFormulas() {
  renderMath($("f1"), "\\Delta x=\\frac{b-a}{n}");
  renderMath($("f2"), "x_i=a+i\\cdot\\Delta x");
  renderMath($("f3"), "x_i^*=a+(i-1)\\,\\Delta x");
  renderMath($("f4"), "x_i^*=a+i\\,\\Delta x");
  renderMath($("f5"), "x_i^*=a+\\left(i-\\tfrac{1}{2}\\right)\\Delta x");
  renderMath($("f6"), "S_n=\\sum_{i=1}^{n}f(x_i^*)\\,\\Delta x");
  renderMath($("f7"), "\\int_a^b f(x)\\,dx=\\lim_{n\\to\\infty}S_n");
}

function initIcons() {
  if (typeof lucide !== "undefined" && lucide.createIcons) {
    lucide.createIcons();
    return;
  }

  const fallbacks = {
    upload: "UP",
    sigma: "Σ",
    bot: "AI",
    "mouse-pointer-2": "↖",
    "grid-3x3": "▦",
    crosshair: "⌖",
    "function-square": "ƒ",
    scan: "⌗",
    "rotate-ccw": "↺",
    download: "↓",
    image: "▧",
    "panel-right": "▥",
    settings: "⚙",
    activity: "∿",
    "table-2": "▤",
    "book-open": "☰",
    calculator: "=",
    "gamepad-2": "JG",
    "corner-down-left": "↵",
    sparkles: "AI",
    x: "×"
  };

  document.querySelectorAll("i[data-lucide]").forEach(icon => {
    icon.className = "fallback-icon";
    icon.textContent = fallbacks[icon.dataset.lucide] || "•";
  });
}

function applyImportedConfig(config) {
  if (!config.expr) throw new Error("No encontré una función en el archivo.");
  $("exprInput").value = config.expr;
  if (config.a !== undefined && config.a !== "") $("aInput").value = config.a;
  if (config.b !== undefined && config.b !== "") $("bInput").value = config.b;
  if (config.n !== undefined && config.n !== "") {
    const n = clampN(config.n);
    $("nInput").value = n;
    $("nRange").value = n;
  }
  if (config.method && ["left", "right", "midpoint"].includes(String(config.method))) {
    $("methodInput").value = String(config.method);
  }
  switchMainSection("riemann");
  setStatus("Archivo importado correctamente");
}

function canvasPointFromEvent(event) {
  const canvas = $("a4Canvas");
  const rect = canvas.getBoundingClientRect();
  const cssWidth = rect.width || canvas.clientWidth || canvas.width;
  const cssHeight = rect.height || canvas.clientHeight || canvas.height;
  const clientX = event.clientX ?? (event.touches?.[0]?.clientX || rect.left);
  const clientY = event.clientY ?? (event.touches?.[0]?.clientY || rect.top);
  return {
    x: Math.max(0, Math.min(canvas.width, (clientX - rect.left) * canvas.width / cssWidth)),
    y: Math.max(0, Math.min(canvas.height, (clientY - rect.top) * canvas.height / cssHeight))
  };
}

function pointToCm(point) {
  const canvas = $("a4Canvas");
  return {
    x: point.x / canvas.width * A4.widthCm,
    y: point.y / canvas.height * A4.heightCm
  };
}

function cmToCanvasPoint(point) {
  const canvas = $("a4Canvas");
  return {
    x: point.x / A4.widthCm * canvas.width,
    y: point.y / A4.heightCm * canvas.height
  };
}

function getA4Selection() {
  const points = A4.points;
  const rects = [];

  if (points.length >= 3) {
    const polygonCm = points.map(pointToCm);
    const minX = Math.max(0, Math.min(...polygonCm.map(point => point.x)));
    const maxX = Math.min(A4.widthCm, Math.max(...polygonCm.map(point => point.x)));
    const dx = A4.cellCm;

    for (let x = Math.floor(minX / dx) * dx; x < maxX; x += dx) {
      const midX = x + dx / 2;
      if (midX < minX || midX > maxX) continue;
      const intervals = polygonYIntervalsAtX(midX, polygonCm);
      for (const [topY, bottomY] of intervals) {
        const p0 = cmToCanvasPoint({ x, y: topY });
        const p1 = cmToCanvasPoint({ x: Math.min(x + dx, maxX), y: bottomY });
        rects.push({
          x: p0.x,
          y: p0.y,
          w: p1.x - p0.x,
          h: p1.y - p0.y,
          area: dx * Math.max(0, bottomY - topY)
        });
      }
    }
  }

  const polygonCm = points.map(pointToCm);
  return {
    rects,
    segments: rects.length,
    area: rects.reduce((sum, rect) => sum + rect.area, 0),
    polygonArea: polygonArea(polygonCm),
    selfIntersects: polygonSelfIntersects(polygonCm)
  };
}

function renderA4Canvas() {
  const canvas = $("a4Canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (A4.image) {
    ctx.drawImage(A4.image, 0, 0, canvas.width, canvas.height);
  }

  ctx.save();
  ctx.strokeStyle = "rgba(0,122,255,.10)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= A4.widthCm; x++) {
    const px = x / A4.widthCm * canvas.width;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= Math.floor(A4.heightCm); y++) {
    const py = y / A4.heightCm * canvas.height;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(canvas.width, py);
    ctx.stroke();
  }
  ctx.restore();

  const selection = getA4Selection();
  if (A4.points.length >= 3) {
    ctx.fillStyle = "rgba(0,122,255,.16)";
    ctx.strokeStyle = "rgba(0,122,255,.4)";
    ctx.lineWidth = 1;
    for (const rect of selection.rects) {
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }

    ctx.fillStyle = "rgba(0,122,255,.05)";
    ctx.strokeStyle = "#007aff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    A4.points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.stroke();
  } else if (A4.points.length > 1) {
    ctx.strokeStyle = "#ff9500";
    ctx.lineWidth = 2;
    ctx.beginPath();
    A4.points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
  }

  A4.points.forEach((point, index) => {
    ctx.fillStyle = "#007aff";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1d1d1f";
    ctx.font = "600 13px -apple-system, BlinkMacSystemFont, Inter, 'Segoe UI', sans-serif";
    ctx.fillText(String(index + 1), point.x + 8, point.y - 8);
  });

  updateA4Metrics(selection);
}

function updateA4Metrics(selection = getA4Selection()) {
  $("a4FileName").textContent = A4.fileName;
  $("a4PointCount").textContent = String(A4.points.length);
  $("a4RectCount").textContent = String(selection.segments);
  const closed = A4.points.length >= 3;
  $("a4AreaCm").textContent = closed ? `${fmt(selection.area, 3)} cm²` : "0 cm²";
  if ($("a4PolygonArea")) $("a4PolygonArea").textContent = closed ? `${fmt(selection.polygonArea, 3)} cm²` : "0 cm²";
  const difference = closed && selection.polygonArea > 0
    ? Math.abs(selection.area - selection.polygonArea) / selection.polygonArea * 100
    : 0;
  $("a4PointList").innerHTML = A4.points.length
    ? [
      closed
        ? `<div>Riemann punto medio: ${selection.segments} rectángulos · Δx=${fmt(A4.cellCm, 2)} cm · diferencia con el área exacta del polígono: ${fmt(difference, 2)} %</div>`
        : "<div>Marca al menos 3 puntos para cerrar el área.</div>",
      selection.selfIntersects ? "<div class=\"a4-warning\">El contorno se cruza a sí mismo: marca los puntos en orden alrededor del área.</div>" : "",
      ...A4.points.map((point, index) => {
      const cm = pointToCm(point);
      return `<div>P${index + 1}: x=${fmt(cm.x, 2)} cm, y=${fmt(cm.y, 2)} cm</div>`;
      })
    ].join("")
    : "Haz clic sobre la hoja para rodear el área.";
}

function clearA4Points() {
  A4.points = [];
  renderA4Canvas();
}

function removeA4File() {
  A4.image = null;
  A4.fileName = "Sin archivo";
  A4.points = [];
  $("importFileInput").value = "";
  renderA4Canvas();
  setStatus("Archivo quitado");
}

async function loadImageIntoA4(file) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = url;
  });
  URL.revokeObjectURL(url);
  A4.image = image;
  A4.fileName = file.name || "Imagen";
  clearA4Points();
  setStatus("Imagen cargada en hoja A4");
}

async function loadPdfIntoA4(file) {
  if (typeof pdfjsLib === "undefined") {
    throw new Error("PDF.js no está disponible. Revisa tu conexión y recarga.");
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const temp = document.createElement("canvas");
  temp.width = viewport.width;
  temp.height = viewport.height;
  await page.render({ canvasContext: temp.getContext("2d"), viewport }).promise;

  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = temp.toDataURL("image/png");
  });
  A4.image = image;
  A4.fileName = `${file.name || "PDF"} · página 1`;
  clearA4Points();
  setStatus("PDF cargado en hoja A4");
}

async function handleImportedFile(file) {
  const lower = file.name.toLowerCase();
  if (file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(lower)) {
    await loadImageIntoA4(file);
    return;
  }
  if (file.type === "application/pdf" || /\.pdf$/i.test(lower)) {
    await loadPdfIntoA4(file);
    return;
  }
  const text = await file.text();
  applyImportedConfig(parseImportedText(text, file.name));
}

function applyCommandInput() {
  const raw = $("commandInput").value.trim();
  if (!raw) return;
  $("exprInput").value = raw.includes("=") ? raw.split("=").slice(1).join("=").trim() : raw;
  updateAll();
}

function updateAssistant(mode = "summary") {
  const output = $("assistantOutput");
  const context = $("assistantContext");
  if (!output || !context) return;
  context.textContent = "Hola, ¿en qué te puedo ayudar?";
  output.textContent = "Hola, ¿en qué te puedo ayudar?";
}

function insertAtCursor(input, text) {
  if (!input) return;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.value = input.value.slice(0, start) + text + input.value.slice(end);
  const cursor = start + text.length;
  input.focus();
  input.setSelectionRange(cursor, cursor);
}

function insertTemplateAtCursor(input, template) {
  if (!input) return;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const selected = input.value.slice(start, end);

  if (template === "fraction") {
    const text = selected ? `(${selected})/()` : "()/()";
    const cursor = selected ? start + text.length - 1 : start + 1;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    input.focus();
    input.setSelectionRange(cursor, cursor);
  }
}

function backspaceAtCursor(input) {
  if (!input) return;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  if (start !== end) {
    input.value = input.value.slice(0, start) + input.value.slice(end);
    input.setSelectionRange(start, start);
  } else if (start > 0) {
    input.value = input.value.slice(0, start - 1) + input.value.slice(start);
    input.setSelectionRange(start - 1, start - 1);
  }
  input.focus();
}

function handleMathKey(button) {
  const input = activeMathInput || $("integralExpr");
  if (button.dataset.mode === "indef") {
    $("integralA").value = "";
    $("integralB").value = "";
    updateMathPreviews();
    return;
  }
  if (button.dataset.mode === "def") {
    if (!$("integralA").value) $("integralA").value = "0";
    if (!$("integralB").value) $("integralB").value = "1";
    updateMathPreviews();
    return;
  }
  if (button.dataset.template) insertTemplateAtCursor(input, button.dataset.template);
  if (button.dataset.action === "backspace") backspaceAtCursor(input);
  if (button.dataset.action === "clear") input.value = "";
  if (button.dataset.insert) insertAtCursor(input, button.dataset.insert);
  updateMathPreviews();
}

function addChatMessage(role, text) {
  const box = $("chatMessages");
  const div = document.createElement("div");
  div.className = `chat-message ${role}`;
  setRenderedMessage(div, text);
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function localAssistantReply(question) {
  const expr = $("integralExpr")?.value || STATE.input?.expr || "f(x)";
  if (/formula|log|ln/i.test(question)) return "Para logaritmos usamos la forma integral u'/u dx = ln(abs(u)) + C. Si aparece una fraccion racional, primero conviene descomponerla en fracciones parciales.";
  if (/decimal|aprox|valor/i.test(question)) return "Para obtener decimal coloca limites a y b. La app evalua la antiderivada si existe y la contrasta con integracion numerica adaptativa (Gauss-Kronrod), que tambien detecta integrales impropias y divergentes.";
  if (/primitiva|antiderivada|compar/i.test(question)) return "La calculadora muestra la antiderivada F(x) y la usa para evaluar integrales definidas cuando hay limites.";
  return `Estoy revisando ${linearExpr(expr)}. Pulsa Resolver para ver regla usada, exacto, decimal y procedimiento paso a paso.`;
}

function isGreeting(text) {
  return /^(hola|ola|buenas|buenos dias|buenas tardes|buenas noches|hey|hi)\s*[!.?]*$/i.test(String(text || "").trim());
}

function normalizeQueryText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sectionSnapshotReply(section = currentHelpSection()) {
  if (section === "integrals") {
    const expr = $("integralExpr")?.value || "sin integrando";
    const a = $("integralA")?.value.trim();
    const b = $("integralB")?.value.trim();
    const limits = a && b ? ` con limites [${linearExpr(a)}, ${linearExpr(b)}]` : " sin limites definidos";
    return `Veo la calculadora de integrales. El integrando actual es: \`${linearExpr(expr)}\`. Esta configurada${limits}.`;
  }
  if (section === "import") {
    const selection = getA4Selection();
    return `Veo la seccion de importar archivo. Archivo: **${A4.fileName}**. Puntos: **${A4.points.length}**. Rectangulos: **${selection.segments}**. Area aproximada: **${A4.points.length >= 3 ? fmt(selection.area, 3) : "0"} cm²**.`;
  }
  if (section === "games") {
    return `Veo Juegos. ${gameSolutionText()} Puntaje: **${GAME_STATE.score}/${GAME_STATE.answered}**.`;
  }
  const input = STATE.input || readInputs();
  return `Veo la suma de Riemann. La funcion actual es: \`f(x)=${linearExpr(input.expr)}\`. Intervalo: [${fmt(input.a)}, ${fmt(input.b)}], con **${input.manualN}** rectangulos y metodo **${methodLabel(input.method)}**.`;
}

function valueLine(value, label = "Resultado") {
  if (!Number.isFinite(value)) return `${label}: sin valor numerico.`;
  const fraction = fractionApproxText(value, 10000, 1e-7);
  return fraction
    ? `${label}: ${fmt(value, 8)} en decimal; fraccion aprox. ${fraction}.`
    : `${label}: ${fmt(value, 8)} en decimal.`;
}

function riemannFormulaText(method) {
  if (method === "left") return "x_i* = a + (i - 1)*Delta x";
  if (method === "right") return "x_i* = a + i*Delta x";
  return "x_i* = a + (i - 1/2)*Delta x";
}

function currentRiemannSnapshot() {
  const input = readInputs();
  const sameInput = STATE.input
    && STATE.input.expr === input.expr
    && STATE.input.a === input.a
    && STATE.input.b === input.b
    && STATE.input.n === input.n
    && STATE.input.method === input.method;
  if (sameInput && STATE.fn && STATE.data) {
    return { input, fn: STATE.fn, data: STATE.data, exact: STATE.exact, areas: STATE.areas, integral: STATE.integral };
  }
  return computeRiemann(input);
}

function buildRiemannSolutionText() {
  try {
    const { input, data, exact, areas, integral } = currentRiemannSnapshot();
    const first = data.rects[0];
    const infinite = $("infinityInput")?.checked;
    const visibleN = infinite ? "n -> infinito" : String(input.manualN);
    const finiteIntegral = Number.isFinite(exact);
    const error = Math.abs((infinite ? exact : data.sum) - exact);
    const lines = [
      "Solucion dinamica de la suma de Riemann:",
      `Funcion: f(x)=${linearExpr(input.expr)}.`,
      `Intervalo: [${fmt(input.a)}, ${fmt(input.b)}]. Rectangulos: ${visibleN}. Metodo: ${methodLabel(input.method)}.`,
      `Formula usada: Delta x = (b - a)/n y ${riemannFormulaText(input.method)}.`,
      `Delta x = (${fmt(input.b)} - (${fmt(input.a)}))/${infinite ? "n" : input.manualN} = ${fmt(data.dx)}.`,
      `Primer rectangulo: [${fmt(first.p)}, ${fmt(first.q)}], x_1* = ${fmt(first.sample)}, f(x_1*) = ${fmt(first.y)}, area_1 = ${fmt(first.area)}.`,
      valueLine(infinite ? exact : data.sum, "Suma")
    ];
    if (finiteIntegral) {
      lines.push(valueLine(exact, "Integral de referencia"), `Error: ${fmt(error, 8)}.`);
      lines.push(`Area positiva: ${fmt(areas.pos, 8)}. Area negativa: ${fmt(areas.neg, 8)}. Area total: ${fmt(areas.total, 8)}.`);
    }
    const note = integralStatusMessage(integral || {});
    if (note) lines.push(`Diagnostico: ${note}`);
    return lines.join("\n");
  } catch (error) {
    return `No pude resolver la suma de Riemann: ${error.message}`;
  }
}

function linearRuleFormula(rule) {
  const cleanRule = normalizeQueryText(rule);
  if (cleanRule.includes("fracciones parciales")) return "P(x)/Q(x) = A/(x - r1) + B/(x - r2) + ...; integral k/(x - r) dx = k*ln(abs(x - r)) + C";
  if (cleanRule.includes("por partes")) return "integral u dv = u*v - integral v du";
  if (cleanRule.includes("cambio de variable lineal")) return "integral f(a*x + b) dx = F(a*x + b)/a + C";
  if (cleanRule.includes("cambio de variable")) return "integral f(g(x))*g'(x) dx = F(g(x)) + C";
  if (cleanRule.includes("arcotangente")) return "integral 1/(1 + x^2) dx = atan(x) + C";
  if (cleanRule.includes("logaritmica")) return "integral u'/u dx = ln(abs(u)) + C";
  if (cleanRule.includes("trigonometric")) return "integral sin(x) dx = -cos(x) + C; integral cos(x) dx = sin(x) + C";
  if (cleanRule.includes("exponencial")) return "integral exp(x) dx = exp(x) + C";
  if (cleanRule.includes("numerica")) return "Gauss-Kronrod adaptativo: suma ponderada de f en nodos que se refinan donde el error es mayor";
  return "integral x^n dx = x^(n + 1)/(n + 1) + C, con n != -1";
}

function buildIntegralSolutionText() {
  const expr = $("integralExpr")?.value || "";
  const aText = $("integralA")?.value.trim() || "";
  const bText = $("integralB")?.value.trim() || "";

  let solution;
  try {
    solution = solveIntegral(expr, aText && bText ? aText : "", aText && bText ? bText : "");
  } catch (error) {
    return `No pude resolver la integral: ${error.message}`;
  }

  const lines = ["Solucion dinamica de la integral:", `Integrando: ${linearExpr(expr)}.`];
  if (solution.anti) {
    const rule = solution.rules.join(" + ");
    lines.push(`Formula usada: ${linearRuleFormula(rule)}.`, `Regla detectada: ${rule}.`);
    if (solution.partial) lines.push(`Fraccion parcial: ${linearExpr(solution.partial.dec)}.`);
    lines.push(`Antiderivada: F(x) = ${linearExpr(solution.anti)} + C (verificada: F'(x) = f(x)).`);
  } else {
    lines.push(`${solution.symbolicError}`);
  }

  const d = solution.definite;
  if (d) {
    if (d.method === "symbolic") lines.push(`Evaluacion exacta: F(${fmt(d.b)}) - F(${fmt(d.a)}).`);
    else if (Number.isFinite(d.value)) lines.push(`Formula usada: ${linearRuleFormula(RULE_NUMERIC_LABEL)}.`);
    if (d.message) lines.push(`Diagnostico: ${d.message}`);
    if (Number.isFinite(d.value)) lines.push(valueLine(d.value, "Integral definida"));
  } else {
    lines.push("Decimal: sin limites definidos. Si colocas a y b, calculo el valor decimal.");
  }

  if (solution.partial?.steps?.length) {
    lines.push("Procedimiento:");
    solution.partial.steps.forEach((step, index) => {
      lines.push(`${index + 1}. ${step.label}: ${step.desc}`);
    });
  } else if (solution.anti) {
    lines.push("Procedimiento: identificar la regla, integrar termino a termino y sumar la constante C.");
  }
  return lines.join("\n");
}

function buildImportSolutionText() {
  const selection = getA4Selection();
  const points = A4.points
    .slice(0, 6)
    .map((point, index) => {
      const cm = pointToCm(point);
      return `P${index + 1}=(${fmt(cm.x, 2)}, ${fmt(cm.y, 2)}) cm`;
    })
    .join("; ");
  const suffix = A4.points.length > 6 ? "; ..." : "";
  return [
    "Solucion del area seleccionada en hoja A4:",
    `Archivo: ${A4.fileName}.`,
    `Puntos: ${A4.points.length}${points ? ` (${points}${suffix})` : ""}.`,
    "Metodo: rectangulos verticales con punto medio dentro del contorno.",
    `Rectangulos formados: ${selection.segments}.`,
    valueLine(A4.points.length >= 3 ? selection.area : NaN, "Area aproximada en cm^2"),
    "Si un punto cae fuera de lugar, quita el ultimo punto o limpia la hoja y vuelve a marcar el contorno en orden."
  ].join("\n");
}

function localDirectReply(question, section = currentHelpSection()) {
  const q = normalizeQueryText(question);
  if (isGreeting(question)) return "Hola, ¿en qué te puedo ayudar?";
  if (/\b(que ves|que hay|contexto|resumen)\b/.test(q)) return sectionSnapshotReply(section);
  if (/\b(resuelve|resolver|solucion|soluciona|procedimiento|pasos|calcula|calcular|resultado|desarrolla|photomath|photomatch)\b/.test(q)) {
    if (section === "integrals") return buildIntegralSolutionText();
    if (section === "import") return buildImportSolutionText();
    if (section === "games") return gameSolutionText();
    return buildRiemannSolutionText();
  }
  if (/(escribe|esbribe|dime|muestra|pon|cual es|cual)\b/.test(q) && /(funcion|integrando|ecuacion|f x|fx)\b/.test(q)) {
    if (section === "integrals") {
      const expr = $("integralExpr")?.value || "";
      return `El integrando actual es: \`${linearExpr(expr)}\``;
    }
    const input = STATE.input || readInputs();
    return `La funcion actual es: \`f(x)=${linearExpr(input.expr)}\``;
  }
  return "";
}

function repeatedWordRatio(text) {
  const words = String(text || "").toLowerCase().match(/[a-záéíóúñü]{2,}/gi) || [];
  if (words.length < 18) return 0;
  const repeated = words.filter((word, index) => index > 0 && word === words[index - 1]).length;
  const common = new Map();
  for (const word of words) common.set(word, (common.get(word) || 0) + 1);
  const top = Math.max(...common.values());
  return Math.max(repeated / words.length, top / words.length);
}

function looksLikeBadAiResponse(text) {
  const value = String(text || "").trim();
  if (!value) return true;
  if (value.length > 1800) return true;
  if (repeatedWordRatio(value) > 0.22) return true;
  if ((value.match(/\b(?:19|20)\d{2}\b/g) || []).length > 2) return true;
  if (/(\.[a-z0-9]{2,},?){3,}/i.test(value)) return true;
  if (/\b(Mishima|Vampirella|VKING|eker)\b/i.test(value)) return true;
  if (/[一-龥ぁ-んァ-ンА-Яа-я]/.test(value) && !/[áéíóúñ¿¡]/i.test(value)) return true;
  if (/(the financial|directFor|tolkFor|undefined|null){2,}/i.test(value)) return true;
  const spanishHints = value.match(/\b(el|la|los|las|un|una|que|para|con|por|integral|riemann|area|funcion|hola|puedo|ayudar|paso)\b/gi) || [];
  const latinWords = value.match(/[a-záéíóúñü]{2,}/gi) || [];
  if (/\b(Refining|Final Answer|analysis|assistant|We need|Let's|Therefore|Solution)\b/i.test(value) && spanishHints.length < 2) return true;
  if (latinWords.length > 4 && spanishHints.length === 0 && !/[=+\-*/∫Σ\\]/.test(value)) return true;
  return latinWords.length > 25 && spanishHints.length < 2;
}

function usableAiResponse(answer) {
  return looksLikeBadAiResponse(answer) ? "" : String(answer).trim();
}

function inferAiProvider(config) {
  const endpoint = (config.endpoint || "").toLowerCase();
  const model = (config.model || "").toLowerCase();
  if (config.provider) return config.provider;
  if (endpoint.includes("/responses")) return "openai-responses";
  if (endpoint.includes("generativelanguage.googleapis.com") || model.includes("gemini")) return "gemini";
  if (endpoint.includes("anthropic") || model.includes("claude")) return "anthropic";
  return "openai-compatible";
}

function getAiConfig() {
  let config = {};
  try { config = JSON.parse(localStorage.getItem(AI_CONFIG_KEY) || "{}"); } catch (_) {}
  for (const key of LEGACY_AI_CONFIG_KEYS) {
    if (config.endpoint || config.apiKey || config.model) break;
    try { config = JSON.parse(localStorage.getItem(key) || "{}"); } catch (_) {}
  }
  return { ...config, provider: inferAiProvider(config) };
}

function extractAiText(data) {
  if (typeof data?.output_text === "string") return data.output_text;
  const responseText = (data?.output || []).flatMap(item => item.content || [])
    .map(part => part.text || part.input_text || "")
    .filter(Boolean)
    .join("\n");
  if (responseText) return responseText;
  const chatText = data?.choices?.[0]?.message?.content;
  if (Array.isArray(chatText)) return chatText.map(part => part.text || part.content || "").join("\n");
  if (typeof chatText === "string") return chatText;
  const geminiText = (data?.candidates?.[0]?.content?.parts || [])
    .map(part => part.text || "")
    .filter(Boolean)
    .join("\n");
  if (geminiText) return geminiText;
  const anthropicText = data?.content?.map(part => part.text || "").filter(Boolean).join("\n");
  return anthropicText || "";
}

function numberFromInput(id, fallback) {
  const value = Number($(id)?.value);
  return Number.isFinite(value) ? value : fallback;
}

function friendlyApiError(error) {
  const message = String(error?.message || error || "");
  if (/401|Unauthorized|Authentication failed/i.test(message)) {
    return "API key inválida, vencida o copiada con espacios. Genera una key nueva y vuelve a guardarla.";
  }
  if (/403|Forbidden/i.test(message)) {
    return "La key no tiene permiso para ese modelo o proveedor.";
  }
  if (/404|not found/i.test(message)) {
    return "Endpoint o modelo no encontrado. Revisa la URL y el nombre exacto del modelo.";
  }
  if (/CORS|Failed to fetch/i.test(message)) {
    return "El navegador bloqueó la llamada directa; usa el servidor local con proxy en 127.0.0.1:5174.";
  }
  return message;
}

function aiProviderLabel(config = getAiConfig()) {
  const provider = inferAiProvider(config);
  const labels = {
    "openai-compatible": "OpenAI compatible / NVIDIA",
    gemini: "Gemini",
    anthropic: "Anthropic",
    "openai-responses": "OpenAI Responses",
    custom: "endpoint propio"
  };
  return labels[provider] || provider || "IA";
}

function hasUnifiedAiConfig(config = getAiConfig()) {
  return Boolean(config.apiKey && config.endpoint && config.model);
}

function updateUnifiedAiIndicators() {
  const config = getAiConfig();
  const sectionProvider = $("sectionAiProvider");
  if (!sectionProvider) return;
  sectionProvider.textContent = hasUnifiedAiConfig(config)
    ? `IA unica del Asistente: ${aiProviderLabel(config)}`
    : "Configura la IA unica en Asistente";
}

function buildSectionAiContext(section) {
  if (section === "import") {
    const selection = getA4Selection();
    return [
      "Contexto actual de Importar archivo:",
      `Archivo: ${A4.fileName}.`,
      `Puntos marcados: ${A4.points.length}.`,
      `Rectangulos por punto medio: ${selection.segments}.`,
      `Area aproximada: ${A4.points.length >= 3 ? fmt(selection.area, 3) : "0"} cm2.`,
      `Escala: hoja A4 de ${A4.widthCm} x ${A4.heightCm} cm.`,
      "Solucion local:",
      buildImportSolutionText()
    ].join("\n");
  }

  if (section === "integrals") {
    return [
      "Contexto actual de Calculadora de integrales:",
      `Integrando: ${$("integralExpr")?.value || ""}.`,
      `Limite a: ${$("integralA")?.value || "indefinido"}.`,
      `Limite b: ${$("integralB")?.value || "indefinido"}.`,
      `Resumen: ${$("solverSummary")?.textContent?.trim() || "sin resumen"}.`,
      `Resultado visible: ${$("integralResult")?.textContent?.trim() || "sin resultado"}.`,
      "Solucion local:",
      buildIntegralSolutionText()
    ].join("\n");
  }

  if (section === "games") {
    return [
      "Contexto actual de Juegos:",
      gameSolutionText(),
      `Puntaje: ${GAME_STATE.score}/${GAME_STATE.answered}.`
    ].join("\n");
  }

  const input = STATE.input || readInputs();
  return [
    "Contexto actual de Suma de Riemann:",
    `Funcion: f(x)=${input.expr}.`,
    `Intervalo: [${input.a}, ${input.b}].`,
    `n: ${input.n}.`,
    `Metodo: ${input.method}.`,
    `Suma: ${$("metricSum")?.textContent || "0"}.`,
    `Integral aproximada: ${$("metricIntegral")?.textContent || "0"}.`,
    `Error: ${$("metricError")?.textContent || "0"}.`,
    "Solucion local:",
    buildRiemannSolutionText()
  ].join("\n");
}

function buildUnifiedAiQuestion(question, section = currentHelpSection()) {
  return `${buildSectionAiContext(section)}\n\nPregunta del usuario: ${question}`;
}

async function askAi(question, systemPrompt, runtime = {}) {
  const config = getAiConfig();
  if (!config.apiKey || !config.endpoint || !config.model) {
    return null;
  }
  if (runtime.maxTokens) {
    const configuredTokens = Number(config.maxTokens);
    config.maxTokens = Math.min(Number.isFinite(configuredTokens) ? configuredTokens : runtime.maxTokens, runtime.maxTokens);
  }
  if (runtime.temperature !== undefined) {
    const configuredTemperature = Number(config.temperature);
    config.temperature = Math.min(Number.isFinite(configuredTemperature) ? configuredTemperature : runtime.temperature, runtime.temperature);
  }
  if (runtime.topP !== undefined) {
    const configuredTopP = Number(config.topP);
    config.topP = Math.min(Number.isFinite(configuredTopP) ? configuredTopP : runtime.topP, runtime.topP);
  }

  const provider = inferAiProvider(config);
  if (["127.0.0.1", "localhost"].includes(location.hostname)) {
    try {
      const proxyResponse = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, provider, question, systemPrompt })
      });
      if (proxyResponse.ok) {
        const proxyData = await proxyResponse.json();
        if (proxyData.text) return proxyData.text;
        if (proxyData.error) throw new Error(proxyData.error);
      } else if (proxyResponse.status !== 404 && proxyResponse.status !== 405) {
        const details = await proxyResponse.text();
        throw new Error(details.slice(0, 180) || `Proxy local respondió ${proxyResponse.status}`);
      }
    } catch (error) {
      if (!/Failed to fetch|404|405/i.test(error.message)) throw error;
    }
  }

  let headers = { "Content-Type": "application/json" };
  let body;

  if (provider === "anthropic") {
    headers = {
      ...headers,
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    };
    body = {
      model: config.model,
      system: systemPrompt,
      messages: [{ role: "user", content: question }],
      temperature: config.temperature ?? 0.2,
      top_p: config.topP ?? 1,
      max_tokens: config.maxTokens ?? 700
    };
  } else if (provider === "openai-responses") {
    headers = { ...headers, "Authorization": `Bearer ${config.apiKey}` };
    body = {
      model: config.model,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question }
      ],
      temperature: config.temperature ?? 0.2,
      top_p: config.topP ?? 1,
      max_output_tokens: config.maxTokens ?? 700
    };
  } else if (provider === "gemini") {
    headers = { ...headers, "x-goog-api-key": config.apiKey };
    body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [
        { role: "user", parts: [{ text: question }] }
      ],
      generationConfig: {
        temperature: config.temperature ?? 0.2,
        topP: config.topP ?? 1,
        maxOutputTokens: config.maxTokens ?? 700
      }
    };
  } else {
    headers = { ...headers, "Authorization": `Bearer ${config.apiKey}` };
    body = {
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question }
      ],
      temperature: config.temperature ?? 0.2,
      top_p: config.topP ?? 1,
      max_tokens: config.maxTokens ?? 700,
      stream: false
    };
  }

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    let details = "";
    try { details = await response.text(); } catch (_) {}
    throw new Error(`La API respondió ${response.status}${details ? `: ${details.slice(0, 180)}` : ""}`);
  }
  const data = await response.json();
  return extractAiText(data) || "La API respondió, pero no encontré texto en la respuesta.";
}

function currentHelpSection() {
  const section = document.querySelector(".section-tab.is-active")?.dataset.section || "riemann";
  return SECTION_HELP[section] ? section : "riemann";
}

function addSectionHelpMessage(role, text) {
  const box = $("sectionAiMessages");
  if (!box) return;
  const div = document.createElement("div");
  div.className = `chat-message ${role}`;
  setRenderedMessage(div, text);
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function updateSectionAiHelp() {
  const section = document.querySelector(".section-tab.is-active")?.dataset.section || "riemann";
  const root = $("sectionAiHelp");
  if (!root) return;
  root.classList.toggle("is-hidden", section === "assistant");
  if (section === "assistant") return;

  const key = currentHelpSection();
  const help = SECTION_HELP[key];
  $("sectionAiTitle").textContent = help.title;
  $("sectionAiHint").textContent = help.hint;
  updateUnifiedAiIndicators();

  const messages = $("sectionAiMessages");
  if (messages && messages.dataset.section !== key) {
    messages.dataset.section = key;
    messages.innerHTML = "";
    addSectionHelpMessage("bot", help.hint);
  }
}

function localSectionHelpReply(question) {
  const key = currentHelpSection();
  const help = SECTION_HELP[key];
  if (/formula|render|ecuaci|latex/i.test(question)) return "Para el asistente uso formato lineal: fracciones como 3/2 y expresiones ambiguas entre parentesis, por ejemplo (x + 5)/(x^2 + 3*x + 2).";
  if (/area|punto|pdf|imagen/i.test(question)) return SECTION_HELP.import.reply;
  if (/riemann|rect|tabla|suma/i.test(question)) return SECTION_HELP.riemann.reply;
  if (/integral|fracci|decimal|primitiva/i.test(question)) return SECTION_HELP.integrals.reply;
  if (/juego|burbuja|derivada|metodo/i.test(question)) return gameSolutionText();
  return help.reply;
}

async function sendSectionHelpMessage() {
  const input = $("sectionAiInput");
  const question = input.value.trim();
  if (!question) return;
  input.value = "";
  addSectionHelpMessage("user", question);
  const requestId = ++sectionAiRequestId;

  const key = currentHelpSection();
  const direct = localDirectReply(question, key);
  if (direct) {
    addSectionHelpMessage("bot", direct);
    return;
  }

  try {
    const answer = await askAi(buildUnifiedAiQuestion(question, key), "Eres la unica IA configurada desde el panel Asistente de Yos_Sphere. Usa el contexto de la seccion activa y responde solo en espanol claro, directo y con pasos cortos. Escribe las matematicas en formato lineal: usa 3/2, (x + 5)/(x^2 + 3*x + 2) y parentesis solo cuando eviten ambiguedad. No uses LaTeX ni fracciones verticales.", { maxTokens: 700, temperature: 0.2, topP: 0.8 });
    if (requestId !== sectionAiRequestId) return;
    addSectionHelpMessage("bot", usableAiResponse(answer) || localSectionHelpReply(question));
  } catch (error) {
    if (requestId !== sectionAiRequestId) return;
    addSectionHelpMessage("bot", `${localSectionHelpReply(question)} No pude conectar con la API: ${friendlyApiError(error)}`);
  }
}

async function sendChatMessage() {
  const input = $("chatInput");
  const question = input.value.trim();
  if (!question) return;
  input.value = "";
  addChatMessage("user", question);
  const requestId = ++chatRequestId;

  const key = currentHelpSection();
  const direct = localDirectReply(question, key);
  if (direct) {
    addChatMessage("bot", direct);
    return;
  }

  try {
    const answer = await askAi(buildUnifiedAiQuestion(question, key), "Eres la unica IA configurada desde el panel Asistente de Yos_Sphere. Responde solo en espanol claro, breve y paso a paso. Escribe las matematicas en formato lineal: usa 3/2, (x + 5)/(x^2 + 3*x + 2) y parentesis solo cuando eviten ambiguedad. No uses LaTeX ni fracciones verticales.", { maxTokens: 900, temperature: 0.2, topP: 0.8 });
    if (requestId !== chatRequestId) return;
    addChatMessage("bot", usableAiResponse(answer) || localAssistantReply(question));
  } catch (error) {
    if (requestId !== chatRequestId) return;
    addChatMessage("bot", `${localAssistantReply(question)} No pude conectar con la API: ${friendlyApiError(error)}`);
  }
}

function loadNvidiaConfig() {
  try {
    const config = getAiConfig();
    if (!config.endpoint && !config.apiKey && !config.model) return;
    $("aiProviderInput").value = inferAiProvider(config);
    $("nvidiaEndpointInput").value = config.endpoint || $("nvidiaEndpointInput").value;
    $("nvidiaApiKeyInput").value = config.apiKey || "";
    $("nvidiaModelInput").value = config.model || $("nvidiaModelInput").value;
    $("aiMaxTokensInput").value = config.maxTokens || $("aiMaxTokensInput").value;
    $("aiTemperatureInput").value = config.temperature ?? $("aiTemperatureInput").value;
    $("aiTopPInput").value = config.topP ?? $("aiTopPInput").value;
    $("nvidiaConfigStatus").textContent = config.apiKey
      ? `IA unica cargada desde Asistente (${aiProviderLabel(config)}).`
      : "Endpoint y modelo cargados. Falta la API key unica.";
    updateUnifiedAiIndicators();
  } catch (_) {
    $("nvidiaConfigStatus").textContent = "No se pudo leer la configuración local.";
  }
}

function saveNvidiaConfig() {
  const config = {
    provider: $("aiProviderInput").value,
    endpoint: $("nvidiaEndpointInput").value.trim(),
    apiKey: $("nvidiaApiKeyInput").value.trim(),
    model: $("nvidiaModelInput").value.trim(),
    maxTokens: numberFromInput("aiMaxTokensInput", 2048),
    temperature: numberFromInput("aiTemperatureInput", 0.2),
    topP: numberFromInput("aiTopPInput", 1)
  };
  try {
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
  } catch (_) {
    $("nvidiaConfigStatus").textContent = "El navegador no permite guardar la configuración en este equipo.";
    return;
  }
  $("nvidiaConfigStatus").textContent = config.apiKey
    ? `IA unica guardada (${aiProviderLabel(config)}). Asistente y secciones usan esta misma API.`
    : "Guarde endpoint/modelo. Falta la API key unica.";
  updateUnifiedAiIndicators();
}

function clearNvidiaConfig() {
  try {
    localStorage.removeItem(AI_CONFIG_KEY);
    LEGACY_AI_CONFIG_KEYS.forEach(key => localStorage.removeItem(key));
  } catch (_) {}
  $("nvidiaApiKeyInput").value = "";
  $("aiMaxTokensInput").value = "2048";
  $("aiTemperatureInput").value = "0.2";
  $("aiTopPInput").value = "1";
  $("nvidiaConfigStatus").textContent = "IA unica borrada. Configurala desde Asistente.";
  updateUnifiedAiIndicators();
}

function applyProviderDefaults() {
  const provider = $("aiProviderInput").value;
  const endpointInput = $("nvidiaEndpointInput");
  const modelInput = $("nvidiaModelInput");
  if (provider === "anthropic") {
    endpointInput.value = "https://api.anthropic.com/v1/messages";
    if (!modelInput.value || modelInput.value.includes("/") || modelInput.value.startsWith("gpt")) modelInput.value = "claude-3-5-sonnet-latest";
  } else if (provider === "openai-responses") {
    endpointInput.value = "https://api.openai.com/v1/responses";
    if (!modelInput.value || modelInput.value.startsWith("claude")) modelInput.value = "gpt-4.1-mini";
  } else if (provider === "gemini") {
    endpointInput.value = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
    modelInput.value = "gemini-2.0-flash";
  } else if (provider === "openai-compatible" && !endpointInput.value) {
    endpointInput.value = "https://integrate.api.nvidia.com/v1/chat/completions";
  }
}

async function testAiConfig() {
  saveNvidiaConfig();
  $("nvidiaConfigStatus").textContent = "Probando API...";
  try {
    const answer = await askAi("Responde solamente: OK", "Responde exactamente OK si la conexión funciona.", { maxTokens: 16, temperature: 0, topP: 0.1 });
    $("nvidiaConfigStatus").textContent = `Conexión correcta: ${String(answer || "OK").slice(0, 80)}`;
  } catch (error) {
    $("nvidiaConfigStatus").textContent = `Error de API: ${friendlyApiError(error)}`;
  }
}

function bindEvents() {
  document.querySelectorAll(".section-tab").forEach(tab => tab.addEventListener("click", () => switchMainSection(tab.dataset.section)));
  document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => switchTab(tab.dataset.t)));
  document.querySelectorAll(".stab").forEach(tab => tab.addEventListener("click", () => switchSub(tab.dataset.st)));

  ["exprInput", "aInput", "bInput", "methodInput", "infinityInput", "rectsInput", "samplesInput", "gridInput"]
    .forEach(id => $(id).addEventListener("input", scheduleUpdate));

  $("nInput").addEventListener("input", () => {
    $("nRange").value = clampN($("nInput").value);
    scheduleUpdate();
  });
  $("nInput").addEventListener("change", updateAll);
  $("nRange").addEventListener("input", () => {
    $("nInput").value = $("nRange").value;
    scheduleUpdate();
  });

  document.querySelectorAll(".seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      $("methodInput").value = btn.dataset.method;
      updateAll();
    });
  });

  document.querySelectorAll(".chip[data-example]").forEach(chip => {
    chip.addEventListener("click", () => {
      $("exprInput").value = chip.dataset.example;
      updateAll();
    });
  });

  $("importFileInput").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      switchMainSection("riemann");
      return;
    }
    try {
      await handleImportedFile(file);
    } catch (error) {
      setStatus(error.message, "err");
    }
  });
  $("importBrowseBtn").addEventListener("click", () => $("importFileInput").click());
  $("a4RemoveFileBtn").addEventListener("click", removeA4File);
  $("a4Canvas").addEventListener("pointerdown", event => {
    event.preventDefault();
    A4.points.push(canvasPointFromEvent(event));
    renderA4Canvas();
  });
  $("a4UndoBtn").addEventListener("click", () => {
    A4.points.pop();
    renderA4Canvas();
  });
  $("a4ClearBtn").addEventListener("click", clearA4Points);

  $("collapseDetailsBtn").addEventListener("click", () => {
    document.querySelector(".workspace").classList.toggle("details-collapsed");
    setTimeout(() => {
      if (typeof Plotly !== "undefined") Plotly.Plots.resize("plotlyGraph");
    }, 80);
  });

  $("commandApplyBtn").addEventListener("click", applyCommandInput);
  $("commandInput").addEventListener("keydown", event => {
    if (event.key === "Enter") applyCommandInput();
  });

  $("resetBtn").addEventListener("click", () => {
    $("exprInput").value = "sin(x) + 0.5*x";
    $("aInput").value = "-2";
    $("bInput").value = "4";
    $("nInput").value = "40";
    $("nRange").value = "40";
    $("methodInput").value = "midpoint";
    $("rectsInput").checked = true;
    $("samplesInput").checked = true;
    $("gridInput").checked = true;
    $("infinityInput").checked = false;
    updateAll();
  });

  $("exportBtn").addEventListener("click", exportCSV);
  $("saveBtn").addEventListener("click", () => {
    if (typeof Plotly !== "undefined") {
      Plotly.downloadImage("plotlyGraph", { format: "png", width: 1600, height: 900, filename: "yos_sphere" });
    }
  });

  $("integralSolveBtn").addEventListener("click", solveIntegralAdvanced);
  ["integralExpr", "integralA", "integralB"].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("focus", event => { activeMathInput = event.target; });
    el.addEventListener("input", updateMathPreviews);
    el.addEventListener("keydown", event => {
      if (event.key === "Enter") solveIntegralAdvanced();
    });
  });
  document.querySelectorAll(".math-keypad button").forEach(btn => {
    btn.addEventListener("click", () => handleMathKey(btn));
  });
  $("integralUseMainBtn").addEventListener("click", () => {
    $("integralExpr").value = $("exprInput").value;
    $("integralA").value = $("aInput").value;
    $("integralB").value = $("bInput").value;
    solveIntegralAdvanced();
  });
  $("integralExampleBtn").addEventListener("click", () => {
    cycleExample("integralExpr", ["4/x - 3/x**2", "x**2", "sin(x)", "(x + 5)/(x**2 + 3*x + 2)", "(2*x + 3)/(x**2 + 4)", "x*exp(x)", "2*x*cos(x**2)", "sqrt(1 - x**2)"]);
    $("integralA").value = "";
    $("integralB").value = "";
    solveIntegralAdvanced();
  });

  document.querySelectorAll(".game-tab").forEach(btn => {
    btn.addEventListener("click", () => setGameMode(btn.dataset.game));
  });
  $("gameNextBtn").addEventListener("click", nextGame);
  $("gameResetBtn").addEventListener("click", resetGame);

  document.querySelectorAll(".assistant-prompt").forEach(btn => {
    btn.addEventListener("click", () => updateAssistant(btn.dataset.assistantPrompt));
  });
  $("assistantSettingsBtn").addEventListener("click", () => {
    $("assistantSettingsPanel").classList.toggle("show");
  });
  $("saveNvidiaConfigBtn").addEventListener("click", saveNvidiaConfig);
  $("testAiConfigBtn").addEventListener("click", testAiConfig);
  $("clearNvidiaConfigBtn").addEventListener("click", clearNvidiaConfig);
  $("aiProviderInput").addEventListener("change", applyProviderDefaults);
  $("chatSendBtn").addEventListener("click", sendChatMessage);
  $("chatInput").addEventListener("keydown", event => {
    if (event.key === "Enter") sendChatMessage();
  });
  $("sectionAiToggle").addEventListener("click", () => {
    updateSectionAiHelp();
    $("sectionAiHelp").classList.toggle("is-open");
  });
  $("sectionAiClose").addEventListener("click", () => {
    $("sectionAiHelp").classList.remove("is-open");
  });
  $("sectionAiSend").addEventListener("click", sendSectionHelpMessage);
  $("sectionAiInput").addEventListener("keydown", event => {
    if (event.key === "Enter") sendSectionHelpMessage();
  });

  const redrawForTheme = () => {
    if (STATE.input) drawGraph(STATE.input);
  };
  if (typeof matchMedia === "function") matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", redrawForTheme);
  if (typeof MutationObserver === "function") {
    new MutationObserver(redrawForTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  window.addEventListener("resize", () => {
    if (STATE.input) drawGraph(STATE.input);
  });
}

// ─── Modal de bienvenida / configuración de IA ────────────────────────────────
function buildWelcomeModal() {
  if (document.getElementById("aiWelcomeModal")) return;
  const modal = document.createElement("div");
  modal.id = "aiWelcomeModal";
  modal.innerHTML = `
<div class="wm-overlay" id="aiWmOverlay">
  <div class="wm-card">
    <div class="wm-header">
      <span class="wm-icon brand-mark" aria-hidden="true"></span>
      <div>
        <strong>Asistente de Yos_Sphere</strong>
        <p>Configura tu API de IA preferida para activar el asistente de forma global.</p>
      </div>
    </div>
    <div class="wm-body">
      <div class="wm-step">
        <span class="wm-num">1</span>
        <div>
          <b>Elige tu proveedor de IA</b>
          <select id="wmProviderSelect" class="wm-input" style="cursor:pointer; margin-top:0.35rem;">
            <option value="gemini" selected>Google Gemini 2.0 Flash (Gratis)</option>
            <option value="nvidia-deepseek-r1">NVIDIA NIM · DeepSeek R1</option>
            <option value="nvidia-deepseek-v3">NVIDIA NIM · DeepSeek V3</option>
            <option value="openai">OpenAI · GPT-4o mini</option>
            <option value="anthropic">Anthropic · Claude 3.5 Sonnet</option>
            <option value="custom">Personalizado (OpenAI compatible)</option>
          </select>
        </div>
      </div>
      <div class="wm-step">
        <span class="wm-num">2</span>
        <div>
          <b id="wmStep2Title">Obtén tu key gratuita</b>
          <p id="wmStep2Desc">Ve a <a id="wmKeyLink" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio → API keys</a> y crea una key gratuita (no necesitas tarjeta).</p>
        </div>
      </div>
      <div class="wm-step">
        <span class="wm-num">3</span>
        <div>
          <b>Pégala aquí abajo</b>
          <input id="wmApiKeyInput" type="text" placeholder="AIza..." spellcheck="false" autocomplete="off" class="wm-input">
        </div>
      </div>
      
      <!-- Collapsible Advanced settings -->
      <div style="display: flex; justify-content: flex-end; margin-top: -0.2rem; margin-bottom: -0.2rem;">
        <button id="wmToggleAdvanced" type="button" style="background: none; border: none; color: var(--accent, #7c3aed); font-size: 0.78rem; cursor: pointer; text-decoration: underline; padding: 0.2rem 0.5rem;">Mostrar opciones avanzadas</button>
      </div>
      
      <div id="wmAdvancedSection" style="display: none; border-top: 1px dashed var(--border, rgba(255,255,255,0.1)); padding-top: 0.8rem; margin-top: 0.2rem; flex-direction: column; gap: 0.8rem;">
        <div>
          <b style="font-size: 0.82rem; color: var(--text, #f1f5f9); display: block; margin-bottom: 0.2rem;">Endpoint</b>
          <input id="wmEndpointInput" type="text" class="wm-input" style="font-size:0.75rem;" spellcheck="false">
        </div>
        <div>
          <b style="font-size: 0.82rem; color: var(--text, #f1f5f9); display: block; margin-bottom: 0.2rem;">Modelo</b>
          <input id="wmModelInput" type="text" class="wm-input" style="font-size:0.75rem;" spellcheck="false">
        </div>
      </div>
      
      <div id="wmStatus" class="wm-status"></div>
    </div>
    <div class="wm-footer">
      <button id="wmSaveBtn" class="text-btn primary" type="button">Guardar y activar IA</button>
      <button id="wmSkipBtn" class="text-btn" type="button">Ahora no</button>
    </div>
  </div>
</div>`;
  document.body.appendChild(modal);

  const presets = {
    "gemini": {
      provider: "gemini",
      endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      model: "gemini-2.0-flash",
      placeholder: "AIza...",
      title: "Obtén tu key gratuita",
      link: "https://aistudio.google.com/apikey",
      linkLabel: "Google AI Studio → API keys",
      desc: "Ve a $LINK y crea una key gratuita (no necesitas tarjeta de crédito)."
    },
    "nvidia-deepseek-r1": {
      provider: "openai-compatible",
      endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
      model: "deepseek-ai/deepseek-r1",
      placeholder: "nvapi-...",
      title: "Obtén tu key de NVIDIA NIM",
      link: "https://build.nvidia.com/deepseek/deepseek-r1",
      linkLabel: "NVIDIA Build → DeepSeek R1",
      desc: "Inicia sesión en $LINK para generar tu API key (incluye créditos gratis de DeepSeek R1)."
    },
    "nvidia-deepseek-v3": {
      provider: "openai-compatible",
      endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
      model: "deepseek-ai/deepseek-v3",
      placeholder: "nvapi-...",
      title: "Obtén tu key de NVIDIA NIM",
      link: "https://build.nvidia.com/deepseek/deepseek-v3",
      linkLabel: "NVIDIA Build → DeepSeek V3",
      desc: "Inicia sesión en $LINK para generar tu API key (incluye créditos gratis de DeepSeek V3)."
    },
    "openai": {
      provider: "openai-compatible",
      endpoint: "https://api.openai.com/v1/chat/completions",
      model: "gpt-4o-mini",
      placeholder: "sk-proj-...",
      title: "Obtén tu key de OpenAI",
      link: "https://platform.openai.com/api-keys",
      linkLabel: "OpenAI Platform → API keys",
      desc: "Ve a $LINK y crea una API key. Requiere saldo precargado."
    },
    "anthropic": {
      provider: "anthropic",
      endpoint: "https://api.anthropic.com/v1/messages",
      model: "claude-3-5-sonnet-latest",
      placeholder: "sk-ant-...",
      title: "Obtén tu key de Anthropic",
      link: "https://console.anthropic.com/settings/keys",
      linkLabel: "Anthropic Console → API keys",
      desc: "Ve a $LINK y crea una API key. Requiere saldo precargado."
    },
    "custom": {
      provider: "openai-compatible",
      endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
      model: "deepseek-ai/deepseek-r1",
      placeholder: "Tu API key personalizada...",
      title: "Configura tu API personalizada",
      link: "https://build.nvidia.com/",
      linkLabel: "Panel de API",
      desc: "Ve a $LINK o al sitio de tu proveedor para obtener la key. Edita endpoint y modelo abajo."
    }
  };

  const overlay = modal.querySelector("#aiWmOverlay");
  const status  = modal.querySelector("#wmStatus");
  const keyInput = modal.querySelector("#wmApiKeyInput");
  const providerSelect = modal.querySelector("#wmProviderSelect");
  const step2Title = modal.querySelector("#wmStep2Title");
  const step2Desc = modal.querySelector("#wmStep2Desc");
  const advancedSection = modal.querySelector("#wmAdvancedSection");
  const endpointInput = modal.querySelector("#wmEndpointInput");
  const modelInput = modal.querySelector("#wmModelInput");
  const toggleAdvancedBtn = modal.querySelector("#wmToggleAdvanced");

  function updateUiForProvider() {
    const key = providerSelect.value;
    const preset = presets[key];
    if (!preset) return;
    
    step2Title.textContent = preset.title;
    
    const linkHtml = `<a href="${preset.link}" target="_blank" rel="noopener">${preset.linkLabel}</a>`;
    step2Desc.innerHTML = preset.desc.replace("$LINK", linkHtml);
    
    keyInput.placeholder = preset.placeholder;
    endpointInput.value = preset.endpoint;
    modelInput.value = preset.model;

    if (key === "custom") {
      advancedSection.style.display = "flex";
      toggleAdvancedBtn.style.display = "none";
    } else {
      if (advancedSection.style.display !== "flex") {
        advancedSection.style.display = "none";
      }
      toggleAdvancedBtn.style.display = "inline-block";
    }
  }

  providerSelect.addEventListener("change", updateUiForProvider);
  updateUiForProvider(); // Cargar estado inicial (Gemini)

  toggleAdvancedBtn.addEventListener("click", () => {
    if (advancedSection.style.display === "none" || advancedSection.style.display === "") {
      advancedSection.style.display = "flex";
      toggleAdvancedBtn.textContent = "Ocultar opciones avanzadas";
    } else {
      advancedSection.style.display = "none";
      toggleAdvancedBtn.textContent = "Mostrar opciones avanzadas";
    }
  });

  modal.querySelector("#wmSaveBtn").addEventListener("click", async () => {
    const key = keyInput.value.trim();
    if (!key) { 
      status.textContent = "Pega una API key primero."; 
      status.style.color = "var(--red, #dc2626)"; 
      return; 
    }
    
    status.textContent = "Probando conexión...";
    status.style.color = "";
    
    const keyPreset = providerSelect.value;
    const preset = presets[keyPreset];
    
    // Si el usuario tiene abierto el panel avanzado o es custom, tomar los valores ingresados
    const useInputs = (keyPreset === "custom" || advancedSection.style.display === "flex");
    const endpoint = useInputs ? endpointInput.value.trim() : preset.endpoint;
    const model = useInputs ? modelInput.value.trim() : preset.model;
    
    const config = {
      provider: preset.provider,
      endpoint: endpoint,
      model: model,
      apiKey: key,
      maxTokens: 2048,
      temperature: 0.2,
      topP: 1
    };
    
    try { localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config)); } catch (_) {}
    loadNvidiaConfig(); // sincronizar panel lateral del asistente
    
    try {
      const answer = await askAi("Responde exactamente: OK", "Responde exactamente OK.", { maxTokens: 8, temperature: 0, topP: 0.1 });
      if (answer && /ok/i.test(answer)) {
        status.textContent = "✓ Conexión correcta. ¡IA activada!";
        status.style.color = "var(--green, #16a34a)";
        const banner = document.getElementById("noKeyBanner");
        if (banner) banner.remove();
        setTimeout(() => closeWelcomeModal(), 1200);
      } else {
        status.textContent = "API respondió pero resultado inusual. Guardado de todas formas.";
        const banner = document.getElementById("noKeyBanner");
        if (banner) banner.remove();
        setTimeout(() => closeWelcomeModal(), 1500);
      }
    } catch (err) {
      status.textContent = "Error: " + (err.message || "No pude conectar. Verifica la key.");
      status.style.color = "var(--red, #dc2626)";
    }
  });

  modal.querySelector("#wmSkipBtn").addEventListener("click", closeWelcomeModal);
  overlay.addEventListener("click", e => { if (e.target === overlay) closeWelcomeModal(); });
}

function closeWelcomeModal() {
  const modal = document.getElementById("aiWelcomeModal");
  if (modal) modal.remove();
}

function maybeShowWelcomeModal() {
  const config = getAiConfig();
  if (config.apiKey) return; // ya tiene key configurada
  // Solo mostrar si el usuario abre el panel de Asistente por primera vez
  const assistantTab = document.querySelector(".section-tab[data-section='assistant']");
  if (!assistantTab) return;
  const originalClick = assistantTab.onclick;
  assistantTab.addEventListener("click", function onFirstAssistantClick() {
    buildWelcomeModal();
    assistantTab.removeEventListener("click", onFirstAssistantClick);
  }, { once: true });
}

// Agregar estilos del modal al <head>
function injectWelcomeModalStyles() {
  if (document.getElementById("wm-styles")) return;
  const style = document.createElement("style");
  style.id = "wm-styles";
  style.textContent = `
.wm-overlay{position:fixed;inset:0;background:var(--scrim);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;animation:wmFade .2s cubic-bezier(.23,1,.32,1) both}
.wm-card{background:var(--surface);border-radius:16px;padding:24px;max-width:460px;width:100%;box-shadow:var(--shadow-pop);animation:wmIn .24s cubic-bezier(.23,1,.32,1) both}
@keyframes wmFade{from{opacity:0}to{opacity:1}}
@keyframes wmIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
.wm-header{display:flex;gap:12px;align-items:flex-start;margin-bottom:20px}
.wm-icon{width:28px;height:28px;flex:none;margin-top:2px}
.wm-header strong{display:block;font:700 22px/1.15 var(--display);letter-spacing:-.025em;color:var(--text)}
.wm-header p{font-size:13px;color:var(--muted);margin:.2rem 0 0}
.wm-body{display:flex;flex-direction:column;gap:14px}
.wm-step{display:flex;gap:12px;align-items:flex-start}
.wm-num{flex-shrink:0;width:22px;height:22px;border-radius:50%;background:var(--surface-2);box-shadow:inset 0 0 0 1px var(--line-2);color:var(--text);display:flex;align-items:center;justify-content:center;font:500 11px/1 var(--mono)}
.wm-step b{display:block;font-size:13px;font-weight:600;color:var(--text);margin-bottom:.2rem}
.wm-step p,.wm-step a{font-size:13px;color:var(--muted)}
.wm-step a{color:var(--blue);text-decoration:underline;text-underline-offset:2px}
.wm-input{width:100%;margin-top:.35rem;padding:8px 10px;border-radius:8px;border:0;box-shadow:0 0 0 1px var(--line-2);background:var(--surface);color:var(--text);font:13px var(--mono);outline:none}
.wm-input:focus{box-shadow:0 0 0 1px var(--blue),0 0 0 4px var(--blue-soft)}
.wm-status{font-size:13px;min-height:1.2em;font-weight:500}
.wm-footer{display:flex;gap:8px;margin-top:20px;flex-wrap:wrap}
@media (prefers-reduced-motion:reduce){.wm-overlay,.wm-card{animation:none}}
`;
  document.head.appendChild(style);
}

// Botón de configuración IA flotante visible cuando no hay key
function injectNoKeyBanner() {
  if (document.getElementById("noKeyBanner")) return;
  const config = getAiConfig();
  if (config.apiKey) return;
  const banner = document.createElement("div");
  banner.id = "noKeyBanner";
  banner.innerHTML = `<span>El Asistente IA necesita configuración.</span><button type="button" id="noKeySetupBtn" class="text-btn primary">Configurar</button>`;
  banner.style.cssText = "position:fixed;bottom:calc(18px + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%);background:var(--surface);border-radius:999px;padding:6px 6px 6px 14px;display:flex;align-items:center;gap:10px;font-size:13px;color:var(--muted);z-index:900;box-shadow:var(--shadow-pop);white-space:nowrap;max-width:calc(100vw - 32px)";
  document.body.appendChild(banner);
  banner.querySelector("#noKeySetupBtn").addEventListener("click", () => {
    injectWelcomeModalStyles();
    buildWelcomeModal();
    banner.remove();
  });
}

function init() {
  bindEvents();
  initIcons();
  initFormulas();
  renderA4Canvas();
  loadNvidiaConfig();
  switchTab("pTabla");
  updateAll();
  updateMathPreviews();
  solveIntegralAdvanced();
  renderGame();
  updateSectionAiHelp();
  injectWelcomeModalStyles();
  maybeShowWelcomeModal();
}

init();
