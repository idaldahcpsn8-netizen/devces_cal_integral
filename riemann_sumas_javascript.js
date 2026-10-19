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
  fileName: "Sin archivo",
  template: null,
  showSolution: false
};

let activeMathInput = null;


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

// Juegos: rondas generadas por games.js (YosGames). El récord de racha se
// guarda por juego en el navegador, si está disponible.
const GAME_STATE = {
  mode: "methods",
  round: [],
  index: 0,
  score: 0,
  streak: 0,
  best: 0,
  results: [],
  locked: false
};

function gameBestKey(mode) {
  return `yos-sphere:best:${mode}`;
}

function loadGameBest(mode) {
  try {
    return Number(localStorage.getItem(gameBestKey(mode))) || 0;
  } catch {
    return 0;
  }
}

function saveGameBest(mode, value) {
  try {
    localStorage.setItem(gameBestKey(mode), String(value));
  } catch {
    // Sin almacenamiento (modo privado): el récord dura solo esta sesión.
  }
}

function currentGameQuestion() {
  return GAME_STATE.round[GAME_STATE.index];
}

function startGameRound(mode = GAME_STATE.mode) {
  GAME_STATE.mode = YosGames.MODES[mode] ? mode : "methods";
  GAME_STATE.round = YosGames.makeRound(GAME_STATE.mode);
  GAME_STATE.index = 0;
  GAME_STATE.score = 0;
  GAME_STATE.streak = 0;
  GAME_STATE.best = loadGameBest(GAME_STATE.mode);
  GAME_STATE.results = [];
  GAME_STATE.locked = false;
  renderGame();
}

// Dibujo pequeño de la región: curva, área sombreada y ejes.
function gameAreaSVG({ expr, a, b }) {
  const fn = compile(expr);
  const pad = (b - a) * 0.18;
  const left = a - pad;
  const right = b + pad;
  const W = 320;
  const H = 150;
  const samples = [];
  let top = 0;
  for (let i = 0; i <= 120; i++) {
    const x = left + (right - left) * i / 120;
    const y = fn(x);
    samples.push([x, Number.isFinite(y) ? y : NaN]);
    if (x >= a && x <= b && Number.isFinite(y)) top = Math.max(top, y);
  }
  top = top * 1.18 || 1;
  const sx = x => 12 + (x - left) / (right - left) * (W - 24);
  const sy = y => H - 18 - Math.max(-0.1 * top, Math.min(y, top * 1.3)) / top * (H - 34);
  const curve = samples.filter(([, y]) => Number.isFinite(y))
    .map(([x, y], i) => `${i ? "L" : "M"}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join(" ");
  const inside = samples.filter(([x, y]) => x >= a && x <= b && Number.isFinite(y));
  const ya = fn(a);
  const yb = fn(b);
  const pts = [[a, Number.isFinite(ya) ? ya : 0], ...inside, [b, Number.isFinite(yb) ? yb : 0]];
  const region = `M${sx(a).toFixed(1)} ${sy(0).toFixed(1)} ` +
    pts.map(([x, y]) => `L${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join(" ") +
    ` L${sx(b).toFixed(1)} ${sy(0).toFixed(1)} Z`;
  const yAxis = left < 0 && right > 0 ? `<line class="ga-axis" x1="${sx(0).toFixed(1)}" y1="8" x2="${sx(0).toFixed(1)}" y2="${H - 10}"/>` : "";
  return `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Área bajo f(x) entre ${fmt(a)} y ${fmt(b)}">
      <path class="ga-region" d="${region}"/>
      <line class="ga-axis" x1="6" y1="${sy(0).toFixed(1)}" x2="${W - 6}" y2="${sy(0).toFixed(1)}"/>
      ${yAxis}
      <line class="ga-bound" x1="${sx(a).toFixed(1)}" y1="${sy(0).toFixed(1)}" x2="${sx(a).toFixed(1)}" y2="${sy(Number.isFinite(ya) ? ya : 0).toFixed(1)}"/>
      <line class="ga-bound" x1="${sx(b).toFixed(1)}" y1="${sy(0).toFixed(1)}" x2="${sx(b).toFixed(1)}" y2="${sy(Number.isFinite(yb) ? yb : 0).toFixed(1)}"/>
      <path class="ga-curve" d="${curve}"/>
      <text class="ga-label" x="${sx(a).toFixed(1)}" y="${H - 2}">${fmt(a)}</text>
      <text class="ga-label" x="${sx(b).toFixed(1)}" y="${H - 2}">${fmt(b)}</text>
    </svg>`;
}

function renderGameProgress() {
  const list = $("gameProgress");
  if (!list) return;
  list.innerHTML = GAME_STATE.round.map((_, i) => {
    const result = GAME_STATE.results[i];
    const cls = result === true ? "is-right" : result === false ? "is-miss" : i === GAME_STATE.index ? "is-current" : "";
    return `<li class="${cls}"><span class="sr-only">Pregunta ${i + 1}</span></li>`;
  }).join("");
}

function renderGameStats() {
  $("gameScore").textContent = GAME_STATE.score;
  $("gameStreak").textContent = GAME_STATE.streak;
  $("gameBest").textContent = GAME_STATE.best;
}

function renderGame() {
  if (!$("gameExpression") || typeof YosGames === "undefined") return;
  if (!GAME_STATE.round.length) {
    startGameRound();
    return;
  }
  document.querySelectorAll(".game-tab").forEach(tab => {
    const active = tab.dataset.game === GAME_STATE.mode;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  renderGameProgress();
  renderGameStats();

  const finished = GAME_STATE.index >= GAME_STATE.round.length;
  $("gamePanel").hidden = finished;
  $("gameSummary").hidden = !finished;
  if (finished) {
    renderGameSummary();
    return;
  }

  const question = currentGameQuestion();
  $("gameKind").textContent = `${question.kind} · ${GAME_STATE.index + 1}/${GAME_STATE.round.length}`;
  $("gamePrompt").textContent = question.prompt;
  renderMath($("gameExpression"), question.questionTex, false);
  const art = $("gameArt");
  art.hidden = !question.art;
  art.closest(".game-question").classList.toggle("has-art", Boolean(question.art));
  art.innerHTML = question.art ? gameAreaSVG(question.art) : "";

  if (!GAME_STATE.locked) {
    $("gameFeedbackText").textContent = "Elige una opción (teclas 1–4).";
    $("gameExplain").innerHTML = "";
    $("gameFeedback").className = "game-feedback";
  }
  $("gameNextBtn").disabled = !GAME_STATE.locked;
  $("gameNextBtn").textContent = GAME_STATE.index === GAME_STATE.round.length - 1 ? "Ver resultado" : "Siguiente";

  const arena = $("bubbleArena");
  arena.innerHTML = "";
  arena.classList.toggle("is-math", question.options.some(option => option.tex));
  question.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bubble-option";
    button.dataset.id = option.id;
    button.style.setProperty("--bubble-delay", `${index * 45}ms`);
    const key = `<kbd aria-hidden="true">${index + 1}</kbd>`;
    button.innerHTML = option.tex ? `${key}${mathToString(`\\displaystyle ${option.tex}`, false)}` : `${key}<span>${escapeHtml(option.text)}</span>`;
    button.setAttribute("aria-label", `Opción ${index + 1}: ${option.text || option.id}`);
    button.addEventListener("click", () => answerGame(option.id));
    arena.appendChild(button);
  });
}

function renderGameSummary() {
  const total = GAME_STATE.round.length;
  const ratio = total ? GAME_STATE.score / total : 0;
  const circumference = 2 * Math.PI * 52;
  const ring = $("gameRing");
  ring.style.strokeDasharray = `${circumference}`;
  ring.style.strokeDashoffset = `${circumference}`;
  requestAnimationFrame(() => { ring.style.strokeDashoffset = `${circumference * (1 - ratio)}`; });
  $("gameSummaryScore").textContent = `${GAME_STATE.score}/${total}`;
  $("gameSummaryTitle").textContent = ratio === 1 ? "¡Ronda perfecta!" : ratio >= 0.7 ? "¡Muy bien!" : ratio >= 0.4 ? "Vas por buen camino" : "Sigue practicando";
  $("gameSummaryText").textContent = `${YosGames.MODES[GAME_STATE.mode].title}: ${GAME_STATE.score} de ${total} aciertos. Tu mejor racha en este juego es ${GAME_STATE.best}.`;
}

function setGameMode(mode) {
  if (mode === GAME_STATE.mode && GAME_STATE.round.length && GAME_STATE.index < GAME_STATE.round.length) return;
  startGameRound(mode);
}

function answerGame(id) {
  const question = currentGameQuestion();
  if (GAME_STATE.locked || !question) return;
  const correct = id === question.correctId;
  GAME_STATE.locked = true;
  GAME_STATE.results[GAME_STATE.index] = correct;
  if (correct) {
    GAME_STATE.score += 1;
    GAME_STATE.streak += 1;
    if (GAME_STATE.streak > GAME_STATE.best) {
      GAME_STATE.best = GAME_STATE.streak;
      saveGameBest(GAME_STATE.mode, GAME_STATE.best);
    }
  } else {
    GAME_STATE.streak = 0;
  }

  document.querySelectorAll(".bubble-option").forEach(button => {
    button.classList.toggle("is-correct", button.dataset.id === question.correctId);
    button.classList.toggle("is-wrong", button.dataset.id === id && !correct);
    button.disabled = true;
  });

  const answer = question.options.find(option => option.id === question.correctId);
  const answerText = answer.text || "la marcada en verde";
  const streakText = correct && GAME_STATE.streak >= 3 ? ` Racha de ${GAME_STATE.streak}.` : "";
  $("gameFeedback").className = `game-feedback ${correct ? "is-right" : "is-miss"}`;
  $("gameFeedbackText").textContent = `${correct ? "¡Correcto!" : `No. La respuesta es ${answerText}.`}${streakText} ${question.why}`;
  renderMath($("gameExplain"), question.explainTex, true);
  renderGameProgress();
  renderGameStats();
  $("gameNextBtn").disabled = false;
  $("gameNextBtn").focus({ preventScroll: true });
}

function nextGame() {
  if (!GAME_STATE.locked) return;
  GAME_STATE.index += 1;
  GAME_STATE.locked = false;
  renderGame();
}

function resetGame() {
  startGameRound(GAME_STATE.mode);
}

function handleGameKey(event) {
  if (document.body.dataset.section !== "games" || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target.closest?.("input, textarea, select")) return;
  const buttons = [...document.querySelectorAll("#bubbleArena .bubble-option")];
  const index = Number(event.key) - 1;
  if (index >= 0 && index < buttons.length && !GAME_STATE.locked) {
    event.preventDefault();
    buttons[index].click();
  } else if (event.key === "Enter" && GAME_STATE.locked && event.target.tagName !== "BUTTON") {
    event.preventDefault();
    nextGame();
  }
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
    blue: token("--curve", "#2563eb"),
    curveGlow: token("--curve-glow", "rgba(37,99,235,.16)"),
    blueSoft: token("--pos-fill", "rgba(20,184,166,.22)"),
    blueLine: token("--pos-line", "rgba(13,148,136,.55)"),
    redSoft: token("--neg-fill", "rgba(236,72,153,.16)"),
    redLine: token("--neg-line", "rgba(219,39,119,.5)"),
    red: token("--red", "#db2777"),
    orange: token("--sample", "#f59e0b"),
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

  // Halo luminoso bajo la curva
  traces.push({
    x: curve.x,
    y: curve.y,
    type: "scatter",
    mode: "lines",
    line: { color: colors.curveGlow, width: 12 },
    hoverinfo: "skip",
    showlegend: false
  });
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
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
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

// Cifra que se anima desde el valor que se ve en pantalla hasta el nuevo.
// Si llega otro valor a mitad de camino, la animación continúa desde donde iba.
function setAnimatedNumber(el, value, text = fmt(value), format = fmt) {
  if (!el) return;
  cancelAnimationFrame(el._tween || 0);
  const from = el._shown;
  if (!Number.isFinite(value) || !Number.isFinite(from) || REDUCED_MOTION || from === value) {
    el._shown = Number.isFinite(value) ? value : NaN;
    el.textContent = text;
    return;
  }
  const start = performance.now();
  const duration = 520;
  const step = now => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 4);
    const current = from + (value - from) * eased;
    el._shown = current;
    if (t < 1) {
      el.textContent = format(current);
      el._tween = requestAnimationFrame(step);
    } else {
      el._shown = value;
      el.textContent = text;
    }
  };
  el._tween = requestAnimationFrame(step);
}

function updateMetrics(input) {
  const infinite = $("infinityInput").checked;
  const error = Math.abs(STATE.data.sum - STATE.exact);
  setAnimatedNumber($("metricN"), infinite ? NaN : input.manualN, infinite ? "∞" : String(input.manualN), v => String(Math.round(v)));
  setAnimatedNumber($("metricDx"), infinite ? NaN : STATE.data.dx, infinite ? "0" : fmt(STATE.data.dx));
  setAnimatedNumber($("metricSum"), infinite ? STATE.exact : STATE.data.sum, infinite ? integralLabel() : fmt(STATE.data.sum));
  setAnimatedNumber($("metricIntegral"), STATE.exact, integralLabel());
  setAnimatedNumber($("metricError"), integralHasValue() ? (infinite ? 0 : error) : NaN, !integralHasValue() ? "—" : fmt(infinite ? 0 : error));
  setAnimatedNumber($("metricTotal"), STATE.areas.total, Number.isFinite(STATE.areas.total) ? fmt(STATE.areas.total) : "—");
}

// ▶ Animar n: aumenta n paso a paso para ver cómo S_n se acerca a la integral.
const PLAY_STEPS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25, 32, 40, 50, 64, 80, 100, 128, 160, 200, 256, 320, 400, 500];
let playTimer = 0;

function stopPlayLimit() {
  if (!playTimer) return;
  clearTimeout(playTimer);
  playTimer = 0;
  const button = $("playLimitBtn");
  if (button) {
    button.setAttribute("aria-pressed", "false");
    button.querySelector(".play-label").textContent = "Animar n";
  }
}

function togglePlayLimit() {
  if (playTimer) {
    stopPlayLimit();
    return;
  }
  $("infinityInput").checked = false;
  const button = $("playLimitBtn");
  button.setAttribute("aria-pressed", "true");
  button.querySelector(".play-label").textContent = "Detener";
  let index = 0;
  const tick = () => {
    const n = PLAY_STEPS[index];
    $("nInput").value = n;
    $("nRange").value = n;
    updateAll();
    index++;
    if (index >= PLAY_STEPS.length) {
      playTimer = 0;
      stopPlayLimit();
      setStatus(`S_n se acerca a la integral: con n = ${n}, error ${$("metricError").textContent}`);
      return;
    }
    playTimer = setTimeout(tick, index < 8 ? 520 : 300);
  };
  playTimer = setTimeout(tick, 0);
}

// Indicador de la navegación que se desliza a la sección activa.
function moveNavIndicator() {
  const nav = document.querySelector(".section-nav");
  const active = nav?.querySelector(".section-tab.is-active");
  if (!nav || !active) return;
  nav.style.setProperty("--nav-x", `${active.offsetLeft}px`);
  nav.style.setProperty("--nav-w", `${active.offsetWidth}px`);
}

// Brillo suave que sigue al puntero sobre las tarjetas.
function bindGlowCards() {
  if (typeof matchMedia === "function" && !matchMedia("(hover: hover)").matches) return;
  document.querySelectorAll(".graph-shell, .stat, .result-box, .game-question, .scard").forEach(card => card.classList.add("glow-card"));
  document.addEventListener("pointermove", event => {
    const card = event.target.closest?.(".glow-card");
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    card.style.setProperty("--my", `${event.clientY - rect.top}px`);
  }, { passive: true });
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
      <td>${fmt(r.sample, 3)}</td>
      <td>${fmt(r.y, 3)}</td>
      <td>${fmt(r.area, 3)}</td>
      <td>${fmt(r.cum, 3)}</td>`;
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
    updateFormulas(input);

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

// Resalta el valor final de un resultado con el color de acento.
function highlightTex(tex) {
  return `\\textcolor{#2563eb}{${tex}}`;
}

function definiteResultTex(solution) {
  const d = solution.definite;
  const integral = `\\int_{${boundTex(d.a)}}^{${boundTex(d.b)}}\\!\\left(${exprToLatex(solution.expr)}\\right)dx`;
  if (d.status === "divergent") return `${integral}\\quad\\text{diverge}`;
  if (d.status === "undefined") return `${integral}\\quad\\text{no existe en }\\mathbb{R}`;
  if (d.method === "symbolic") {
    const exact = `\\left[${exprToLatex(solution.anti)}\\right]_{${boundTex(d.a)}}^{${boundTex(d.b)}}`;
    const rounded = Math.round(d.value);
    const piForm = piMultipleText(d.value);
    const exactValue = fractionValueText(d.value) ? valueTex(d.value)
      : Math.abs(d.value - rounded) < 1e-10 ? String(rounded)
      : piForm ? exprToLatex(piForm) : "";
    return `${integral}=${exact}${exactValue ? `=${highlightTex(exactValue)}` : ""}\\approx ${highlightTex(fmt(d.value, 8))}`;
  }
  return `${integral}\\approx ${highlightTex(fmt(d.value, 8))}`;
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
  lastIntegralText = "";
  $("integralCopyBtn").disabled = true;
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
  lastIntegralText = solutionText(solution);
  $("integralCopyBtn").disabled = !lastIntegralText;
  if (solution.definite) {
    renderMath(result, definiteResultTex(solution), true);
    result.classList.remove("is-fresh");
    void result.offsetWidth;
    result.classList.add("is-fresh");
  } else if (solution.anti) {
    renderMath(result, `\\int\\!\\left(${exprToLatex(solution.expr)}\\right)dx=${highlightTex(`${exprToLatex(solution.anti)}+C`)}`, true);
  } else {
    result.textContent = "Sin primitiva elemental. Añade límites a y b para calcular el valor numérico.";
  }
  renderSteps("integralSteps", integralSolutionSteps(solution));
  animateSteps("#integralSteps");
}


// Tabla de integrales: cada fila tiene un ejemplo que se resuelve al tocar «Probar».
const INTEGRAL_TABLE = [
  { name: "Potencia", tex: "\\int x^{n}\\,dx=\\frac{x^{n+1}}{n+1}+C,\\quad n\\neq -1", expr: "x^3" },
  { name: "Logaritmo", tex: "\\int \\frac{1}{x}\\,dx=\\ln|x|+C", expr: "1/x", a: "1", b: "e" },
  { name: "Exponencial", tex: "\\int e^{x}\\,dx=e^{x}+C", expr: "exp(x)" },
  { name: "Base a", tex: "\\int a^{x}\\,dx=\\frac{a^{x}}{\\ln a}+C", expr: "2^x" },
  { name: "Seno", tex: "\\int \\sin x\\,dx=-\\cos x+C", expr: "sin(x)", a: "0", b: "pi" },
  { name: "Coseno", tex: "\\int \\cos x\\,dx=\\sin x+C", expr: "cos(x)" },
  { name: "Secante²", tex: "\\int \\sec^{2}x\\,dx=\\tan x+C", expr: "sec(x)^2" },
  { name: "Arcotangente", tex: "\\int \\frac{dx}{1+x^{2}}=\\arctan x+C", expr: "1/(1+x^2)", a: "-inf", b: "inf" },
  { name: "Arcoseno", tex: "\\int \\frac{dx}{\\sqrt{1-x^{2}}}=\\arcsin x+C", expr: "1/sqrt(1-x^2)", a: "0", b: "1/2" },
  { name: "Cambio lineal", tex: "\\int f(ax+b)\\,dx=\\frac{1}{a}F(ax+b)+C", expr: "cos(3x+1)" },
  { name: "Sustitución", tex: "\\int f\\big(g(x)\\big)\\,g'(x)\\,dx=F\\big(g(x)\\big)+C", expr: "2x*cos(x^2)" },
  { name: "Por partes", tex: "\\int u\\,dv=uv-\\int v\\,du", expr: "x*exp(x)" },
  { name: "Fracciones parciales", tex: "\\int \\frac{A}{x-r}\\,dx=A\\ln|x-r|+C", expr: "(x+5)/(x^2+3x+2)" },
  { name: "Gaussiana", tex: "\\int_{-\\infty}^{\\infty}e^{-x^{2}}\\,dx=\\sqrt{\\pi}", expr: "exp(-x^2)", a: "-inf", b: "inf" }
];

function renderIntegralTable() {
  const host = $("integralTableRows");
  if (!host) return;
  host.innerHTML = INTEGRAL_TABLE.map((row, index) => `
    <div class="it-row">
      <span class="it-name">${row.name}</span>
      <div class="it-math">${mathToString(`\\displaystyle ${row.tex}`, false)}</div>
      <button class="it-try" type="button" data-row="${index}" aria-label="Probar ${row.name}">Probar</button>
    </div>`).join("");
}

function tryIntegralTableRow(index) {
  const row = INTEGRAL_TABLE[index];
  if (!row) return;
  $("integralExpr").value = row.expr;
  $("integralA").value = row.a || "";
  $("integralB").value = row.b || "";
  solveIntegralAdvanced();
  $("integralPreview").scrollIntoView({ behavior: REDUCED_MOTION ? "auto" : "smooth", block: "start" });
}

// Texto plano del último resultado, para copiarlo.
let lastIntegralText = "";

function solutionText(solution) {
  const d = solution.definite;
  if (d && Number.isFinite(d.value)) {
    const exact = fractionValueText(d.value) || piMultipleText(d.value);
    return exact ? `${exact} ≈ ${fmt(d.value, 12)}` : fmt(d.value, 12);
  }
  if (d) return integralLabel(d.value, d.status);
  return solution.anti ? `${linearExpr(solution.anti)} + C` : "";
}

function copyIntegralResult() {
  const button = $("integralCopyBtn");
  if (!lastIntegralText) return;
  const done = ok => {
    button.textContent = ok ? "¡Copiado!" : "No se pudo copiar";
    clearTimeout(button._reset);
    button._reset = setTimeout(() => { button.textContent = "Copiar resultado"; }, 1600);
  };
  const fallback = () => {
    const area = document.createElement("textarea");
    area.value = lastIntegralText;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    done(ok);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(lastIntegralText).then(() => done(true), fallback);
  } else {
    fallback();
  }
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
    if (name === "pFormulas" && STATE.input) updateFormulas(STATE.input);
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
  moveNavIndicator();
  if (section !== "riemann") stopPlayLimit();
}

function setWorkspaceSection(section) {
  const workspace = document.querySelector(".workspace");
  if (!workspace) return;
  workspace.classList.remove("section-import", "section-riemann", "section-integrals", "section-games");
  workspace.classList.add(`section-${section}`);
  document.body.dataset.section = section;
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
    updateAll();
    return;
  }

  showDetailsPanel();
  if (section === "integrals") {
    switchTab("pTools");
    switchSub("sInt");
    solveIntegralAdvanced();
    setStatus("Integrales");
    return;
  }

  if (section === "games") {
    switchTab("pGames");
    renderGame();
    setStatus("Juegos");
  }
}

// ── Pantalla de inicio y navegación por #ancla ────────────────────────────
// Sin ancla se muestra el menú de inicio; #riemann, #integrals, #import y #games
// abren cada sección. Así el botón «atrás» del navegador vuelve al menú.
const SECTIONS = ["riemann", "integrals", "import", "games"];
let currentSection = null;

function showHome() {
  currentSection = null;
  stopPlayLimit();
  document.body.classList.add("is-home");
  document.body.dataset.section = "home";
  document.title = "Yos_Sphere";
}

function route() {
  const section = location.hash.replace(/^#/, "");
  if (!SECTIONS.includes(section)) {
    showHome();
    return;
  }
  const wasHome = document.body.classList.contains("is-home");
  document.body.classList.remove("is-home");
  if (section !== currentSection || wasHome) {
    currentSection = section;
    switchMainSection(section);
    requestAnimationFrame(() => {
      moveNavIndicator();
      if (section === "riemann" && typeof Plotly !== "undefined") Plotly.Plots.resize("plotlyGraph");
    });
    window.scrollTo(0, 0);
  }
}

function goToSection(section) {
  if (location.hash === `#${section}`) route();
  else location.hash = section;
}

function goHome() {
  if (!location.hash || location.hash === "#") {
    showHome();
    return;
  }
  // Quita el ancla sin dejar «#» en la dirección cuando el navegador lo permite.
  try {
    history.pushState(null, "", location.pathname + location.search);
    route();
  } catch (_) {
    location.hash = "";
  }
}

// Fórmulas del panel: cada tarjeta muestra la fórmula general y, debajo, la
// misma fórmula con los valores actuales (a, b, n, método) ya sustituidos.
const FORMULA_ANTI_CACHE = { expr: null, anti: null };

function cachedAntiderivative(expr) {
  if (FORMULA_ANTI_CACHE.expr !== expr) {
    FORMULA_ANTI_CACHE.expr = expr;
    try {
      FORMULA_ANTI_CACHE.anti = solveIntegral(expr, "", "").anti || null;
    } catch {
      FORMULA_ANTI_CACHE.anti = null;
    }
  }
  return FORMULA_ANTI_CACHE.anti;
}

function texNumber(value, digits = 5) {
  const text = fmt(value, digits);
  return value < 0 ? `(${text})` : text;
}

function formulaCard({ title, hint = "", generic, live = "", active = false, note = "" }) {
  return `
    <article class="formula-card${active ? " is-active" : ""}">
      <header><strong>${title}</strong>${hint ? `<span>${hint}</span>` : ""}</header>
      <div class="fc-generic">${mathToString(generic, true)}</div>
      ${live ? `<div class="fc-live">${mathToString(live, true)}</div>` : ""}
      ${note ? `<p class="fc-note">${note}</p>` : ""}
    </article>`;
}

function updateFormulas(input) {
  const host = $("formulaCards");
  if (!host || !STATE.data) return;
  // Solo se dibuja con el panel visible; switchTab lo actualiza al abrirlo.
  if (!$("pFormulas").classList.contains("show")) return;
  const infinite = $("infinityInput").checked;
  const n = infinite ? "n" : String(input.manualN);
  const a = texNumber(input.a);
  const b = fmt(input.b);
  const dx = STATE.data.dx;
  const rects = STATE.data.rects;
  const f = `f(x)=${exprToLatex(input.expr)}`;

  const samples = [
    { method: "left", name: "Izquierda", rule: "x_i^*=a+(i-1)\\,\\Delta x", first: input.a },
    { method: "right", name: "Derecha", rule: "x_i^*=a+i\\,\\Delta x", first: input.a + dx },
    { method: "midpoint", name: "Punto medio", rule: "x_i^*=a+\\left(i-\\tfrac{1}{2}\\right)\\Delta x", first: input.a + dx / 2 }
  ];
  const sampleRows = samples.map(s => `
      <div class="fc-sample${s.method === input.method ? " is-active" : ""}">
        <span>${s.name}${s.method === input.method ? "<small>en uso</small>" : ""}</span>
        ${mathToString(s.rule, false)}
        ${s.method === input.method && !infinite ? `<em>${mathToString(`x_1^*=${fmt(s.first)}`, false)}</em>` : ""}
      </div>`).join("");

  const sumLive = infinite
    ? `S_n\\xrightarrow[n\\to\\infty]{}${integralTex()}`
    : `S_{${n}}=\\sum_{i=1}^{${n}}f(x_i^*)\\cdot ${fmt(dx)}\\approx ${fmt(STATE.data.sum)}`;
  const firstTerms = !infinite && rects.length
    ? rects.slice(0, 2).map(r => `${texNumber(r.y, 4)}`).join("+") + (rects.length > 2 ? "+\\cdots" : "")
    : "";

  const cards = [
    formulaCard({ title: "Función e intervalo", generic: f, live: `[a,b]=[${fmt(input.a)},\\,${b}]` }),
    formulaCard({
      title: "Ancho de cada rectángulo",
      generic: "\\Delta x=\\frac{b-a}{n}",
      live: infinite ? "\\Delta x\\to 0" : `\\Delta x=\\frac{${b}-${a}}{${n}}=${fmt(dx)}`
    }),
    `<article class="formula-card">
      <header><strong>Punto de muestra</strong><span>${methodLabel(input.method)}</span></header>
      <div class="fc-samples">${sampleRows}</div>
    </article>`,
    formulaCard({
      title: "Suma de Riemann",
      generic: "S_n=\\sum_{i=1}^{n}f(x_i^*)\\,\\Delta x",
      live: sumLive,
      note: firstTerms ? `Primeras alturas: ${mathToString(`f(x_1^*)+f(x_2^*)+\\cdots=${firstTerms}`, false)}` : ""
    }),
    formulaCard({
      title: "Integral definida",
      generic: "\\int_a^b f(x)\\,dx=\\lim_{n\\to\\infty}S_n",
      live: `\\int_{${fmt(input.a)}}^{${b}}\\left(${exprToLatex(input.expr)}\\right)dx=${integralTex()}`,
      active: true
    })
  ];

  const anti = integralHasValue() ? cachedAntiderivative(input.expr) : null;
  if (anti) {
    cards.push(formulaCard({
      title: "Teorema fundamental",
      hint: "regla de Barrow",
      generic: "\\int_a^b f(x)\\,dx=F(b)-F(a),\\quad F'=f",
      live: `F(x)=${exprToLatex(anti)}`
    }));
  }

  if (integralHasValue() && !infinite) {
    const bound = riemannErrorBound(input.expr, input.a, input.b, input.manualN, input.method);
    const error = Math.abs(STATE.data.sum - STATE.exact);
    const midpoint = input.method === "midpoint";
    const generic = midpoint
      ? "|E_n|\\le\\frac{M_2\\,(b-a)^3}{24\\,n^2},\\quad M_2=\\max|f''|"
      : "|E_n|\\le\\frac{M_1\\,(b-a)^2}{2\\,n},\\quad M_1=\\max|f'|";
    const width = Math.abs(input.b - input.a);
    const live = bound
      ? (midpoint
        ? `|E_{${n}}|\\le\\frac{${fmt(bound.max, 4)}\\cdot ${fmt(width)}^3}{24\\cdot ${n}^2}=${fmt(bound.bound)}`
        : `|E_{${n}}|\\le\\frac{${fmt(bound.max, 4)}\\cdot ${fmt(width)}^2}{2\\cdot ${n}}=${fmt(bound.bound)}`)
      : "";
    cards.push(formulaCard({
      title: "Cota del error",
      hint: midpoint ? "orden 1/n²" : "orden 1/n",
      generic,
      live,
      note: bound
        ? `Error real: ${mathToString(`|S_{${n}}-I|=${fmt(error)}`, false)}${error <= bound.bound * (1 + 1e-9) + 1e-12 ? " — dentro de la cota." : "."}`
        : `La cota no aplica: ${midpoint ? "f″" : "f′"} no está acotada (o no existe) en el intervalo.`
    }));
  }

  host.innerHTML = cards.join("");
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
  goToSection("riemann");
  updateAll();
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
  ctx.strokeStyle = "rgba(37,99,235,.10)";
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
    ctx.fillStyle = "rgba(37,99,235,.16)";
    ctx.strokeStyle = "rgba(37,99,235,.4)";
    ctx.lineWidth = 1;
    for (const rect of selection.rects) {
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }

    ctx.fillStyle = "rgba(37,99,235,.05)";
    ctx.strokeStyle = "#2563eb";
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

  // El contorno automático tiene muchos puntos: se dibujan pequeños y sin número.
  const compact = A4.autoMarked && A4.points.length > 12;
  A4.points.forEach((point, index) => {
    ctx.fillStyle = "#2563eb";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = compact ? 1.5 : 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, compact ? 3.5 : 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (compact) return;
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
  renderA4Solution(selection);
}

// ── Plantillas de la hoja A4 (a4_templates.js) ──────────────────────────────

function renderA4TemplateList() {
  const host = $("a4TemplateList");
  if (!host || typeof A4Templates === "undefined") return;
  host.innerHTML = A4Templates.TEMPLATES.map(t => `
    <button class="a4-template" type="button" data-template="${t.id}">
      <img src="${A4Templates.svgDataUrl(t)}" alt="" loading="lazy" width="105" height="148">
      <span>${t.name}</span>
    </button>`).join("");
}

function syncA4TemplateCard() {
  const t = A4.template;
  document.querySelectorAll(".a4-template").forEach(button => {
    button.classList.toggle("is-active", Boolean(t) && button.dataset.template === t.id);
  });
  $("a4TemplateCard").hidden = !t;
  if (!t) return;
  $("a4TemplateTitle").textContent = t.name;
  $("a4TemplateText").textContent = t.statement;
  $("a4SolutionBtn").textContent = A4.showSolution ? "Ocultar solución" : "Ver solución";
  $("a4SolutionBtn").setAttribute("aria-expanded", String(A4.showSolution));
  $("a4Solution").hidden = !A4.showSolution;
  if (A4.showSolution) renderA4Solution();
}

// Solución: integral, valor exacto y comparación con lo que midió el alumno.
function renderA4Solution(selection = getA4Selection()) {
  const t = A4.template;
  const host = $("a4Solution");
  if (!t || !host || host.hidden) return;
  const exact = A4Templates.exactArea(t);
  const decimal = fmt(exact, 4);
  const value = t.exact === decimal
    ? `=\\textcolor{#2563eb}{${decimal}}\\ \\text{cm}^2`
    : `${t.exact ? `=${t.exact}` : ""}\\approx\\textcolor{#2563eb}{${decimal}}\\ \\text{cm}^2`;
  let comparison = "<p>Marca el contorno (a mano o con «Marcar contorno») para comparar tu medición.</p>";
  if (A4.points.length >= 3) {
    const error = Math.abs(selection.area - exact) / exact * 100;
    const polygonError = Math.abs(selection.polygonArea - exact) / exact * 100;
    comparison = `
      <div class="a4-compare"><span>Tu medición con rectángulos</span><b>${fmt(selection.area, 3)} cm² · error ${fmt(error, 2)} %</b></div>
      <div class="a4-compare"><span>Área de tu polígono</span><b>${fmt(selection.polygonArea, 3)} cm² · error ${fmt(polygonError, 2)} %</b></div>`;
  }
  const lines = A4Templates.solutionLines(t);
  lines.push(`\\phantom{A}${value}`);
  host.innerHTML = `<div class="a4-solution-math">${lines.map(line => mathToString(line, true)).join("")}</div>${comparison}`;
}

function loadA4Template(id) {
  const t = A4Templates.find(id);
  if (!t) return;
  const image = new Image();
  image.onload = () => {
    A4.image = image;
    A4.fileName = `Plantilla: ${t.name}`;
    A4.template = t;
    A4.showSolution = false;
    A4.points = [];
    $("importFileInput").value = "";
    syncA4TemplateCard();
    renderA4Canvas();
    setStatus(`Plantilla «${t.name}» cargada: rodea el área marcada en rosa`);
    document.querySelector(".a4-workbench")?.scrollIntoView({ behavior: REDUCED_MOTION ? "auto" : "smooth", block: "start" });
  };
  image.src = A4Templates.svgDataUrl(t);
}

function autoMarkA4Template() {
  if (!A4.template) return;
  A4.points = A4Templates.boundary(A4.template).map(cmToCanvasPoint);
  A4.autoMarked = true;
  renderA4Canvas();
}

function toggleA4Solution() {
  A4.showSolution = !A4.showSolution;
  syncA4TemplateCard();
}

function forgetA4Template() {
  A4.template = null;
  A4.showSolution = false;
  syncA4TemplateCard();
}

function clearA4Points() {
  A4.points = [];
  A4.autoMarked = false;
  renderA4Canvas();
}

function removeA4File() {
  forgetA4Template();
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
  forgetA4Template();
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
  forgetA4Template();
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


function bindEvents() {
  document.querySelectorAll(".section-tab").forEach(tab => tab.addEventListener("click", () => goToSection(tab.dataset.section)));
  document.querySelectorAll("[data-go]").forEach(card => card.addEventListener("click", () => goToSection(card.dataset.go)));
  $("homeBtn")?.addEventListener("click", goHome);
  window.addEventListener("hashchange", route);
  window.addEventListener("popstate", route);
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
    A4.autoMarked = false;
    A4.points.push(canvasPointFromEvent(event));
    renderA4Canvas();
  });
  $("a4UndoBtn").addEventListener("click", () => {
    A4.points.pop();
    renderA4Canvas();
  });
  $("a4ClearBtn").addEventListener("click", clearA4Points);
  $("a4TemplateList").addEventListener("click", event => {
    const button = event.target.closest(".a4-template");
    if (button) loadA4Template(button.dataset.template);
  });
  $("a4AutoBtn").addEventListener("click", autoMarkA4Template);
  $("a4SolutionBtn").addEventListener("click", toggleA4Solution);

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
  $("playLimitBtn")?.addEventListener("click", togglePlayLimit);
  ["exprInput", "aInput", "bInput", "nInput", "nRange", "infinityInput"].forEach(id => {
    $(id).addEventListener("input", stopPlayLimit);
  });
  document.querySelectorAll(".seg-btn, .chip[data-example], #resetBtn").forEach(el => el.addEventListener("click", stopPlayLimit));
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
  $("gameAgainBtn").addEventListener("click", resetGame);
  $("integralCopyBtn").addEventListener("click", copyIntegralResult);
  $("integralTableRows").addEventListener("click", event => {
    const button = event.target.closest(".it-try");
    if (button) tryIntegralTableRow(Number(button.dataset.row));
  });
  document.addEventListener("keydown", handleGameKey);


  window.addEventListener("resize", () => {
    moveNavIndicator();
    if (STATE.input) drawGraph(STATE.input);
  });
}


function init() {
  bindEvents();
  initIcons();
  renderA4TemplateList();
  renderA4Canvas();
  renderIntegralTable();
  switchTab("pTabla");
  updateAll();
  updateMathPreviews();
  solveIntegralAdvanced();
  renderGame();
  bindGlowCards();
  route();
  document.fonts?.ready?.then(moveNavIndicator);
}

init();
