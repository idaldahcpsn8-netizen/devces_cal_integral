"use strict";

const MAX_N = 20000;
const INFINITE_N = 1800;
const MAX_DRAW_BARS = 260;
const TABLE_EDGE_ROWS = 22;
const TABLE_MID_ROWS = 10;

const $ = id => document.getElementById(id);

const M = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  exp: Math.exp,
  log: Math.log,
  ln: Math.log,
  log10: Math.log10,
  pow: Math.pow,
  min: Math.min,
  max: Math.max,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  sec: x => 1 / Math.cos(x),
  csc: x => 1 / Math.sin(x),
  cot: x => 1 / Math.tan(x),
  pi: Math.PI,
  PI: Math.PI,
  e: Math.E,
  E: Math.E
};

const STATE = {
  fn: null,
  input: null,
  data: null,
  exact: 0,
  areas: { pos: 0, neg: 0, net: 0, total: 0 }
};

const A4 = {
  widthCm: 21,
  heightCm: 29.7,
  cellCm: 0.5,
  points: [],
  image: null,
  fileName: "Sin archivo"
};

const AI_CONFIG_KEY = "Dev_Aldah_V3.aiConfig";
const NVIDIA_CONFIG_KEY = "Dev_Aldah_V3.nvidiaConfig";
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
    hint: "Hola, en que te puedo ayudar con los juegos?",
    reply: "En Juegos toca la burbuja del metodo correcto. Integrales practica inmediata, fracciones parciales, cambio de variable y partes; Derivadas practica reglas basicas, producto, cociente y cadena."
  }
};

const GAME_BANKS = {
  integrals: {
    label: "Integrales",
    prompt: "Elige el metodo que resuelve la integral.",
    options: [
      "Integracion inmediata",
      "Fracciones parciales",
      "Cambio de variable",
      "Integracion por partes"
    ],
    items: [
      {
        tex: "\\int x^2\\,dx",
        linear: "integral x^2 dx",
        answer: "Integracion inmediata",
        result: "1/3*x^3 + C",
        fraction: "1/3",
        why: "Regla de potencia: integral x^n dx = x^(n+1)/(n+1) + C."
      },
      {
        tex: "\\int \\ln(x)\\,dx",
        linear: "integral ln(x) dx",
        answer: "Integracion por partes",
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
        answer: "Integracion inmediata",
        result: "exp(x) + C",
        fraction: "",
        why: "La exponencial se integra directamente."
      }
    ]
  },
  derivatives: {
    label: "Derivadas",
    prompt: "Elige la regla de derivacion.",
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
        why: "Funcion externa sin(u) con u = x^2."
      },
      {
        tex: "\\frac{d}{dx}\\sqrt{x+1}",
        linear: "d/dx sqrt(x + 1)",
        answer: "Cadena",
        result: "1/(2*sqrt(x + 1))",
        fraction: "1/(2*sqrt(x + 1))",
        why: "Raiz de una funcion interna."
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

function normalize(raw) {
  let s = String(raw || "").trim();
  s = s.replace(/^f\s*\(\s*x\s*\)\s*=/i, "");
  s = s.replace(/\^/g, "**");
  s = s.replace(/√/g, "sqrt");
  s = s.replace(/\bsen\b/gi, "sin");
  s = s.replace(/\btg\b/gi, "tan");
  s = s.replace(/\bctg\b/gi, "cot");
  s = s.replace(/\barc\s*tg\b/gi, "atan");
  s = s.replace(/\bln\s*x\b/gi, "ln(x)");
  s = s.replace(/\blog\s*x\b/gi, "log(x)");
  s = s.replace(/\bsin\s*x\b/gi, "sin(x)");
  s = s.replace(/\bcos\s*x\b/gi, "cos(x)");
  s = s.replace(/\btan\s*x\b/gi, "tan(x)");

  s = s.replace(/(\d)([a-zA-Z])/g, "$1*$2");
  s = s.replace(/(\d|x|X|\))\s*\(/g, "$1*(");
  s = s.replace(/\)\s*(\d|[a-zA-Z])/g, ")*$1");
  s = s.replace(/\)\s*\(/g, ")*(");
  return s;
}

function compile(expression) {
  const s = normalize(expression);
  if (!s) throw new Error("Escribe una función.");

  const ids = s.match(/[a-zA-Z_]\w*/g) || [];
  for (const name of ids) {
    if (name !== "x" && !(name in M)) throw new Error(`Símbolo desconocido: ${name}`);
  }

  const names = Object.keys(M);
  const values = Object.values(M);
  const fn = new Function("x", ...names, `"use strict"; return (${s});`);
  return x => {
    try {
      const y = Number(fn(x, ...values));
      return Number.isFinite(y) ? y : NaN;
    } catch (_) {
      return NaN;
    }
  };
}

function finiteOrZero(fn, x) {
  const y = fn(x);
  return Number.isFinite(y) ? y : 0;
}

function fmt(value, digits = 5) {
  if (!Number.isFinite(value)) return "NaN";
  if (value !== 0 && (Math.abs(value) >= 1e5 || Math.abs(value) < 1e-4)) {
    return value.toExponential(3);
  }
  return Number(value.toFixed(digits)).toString();
}

function approximateFraction(value, maxDenominator = 10000) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const sign = numeric < 0 ? -1 : 1;
  let x = Math.abs(numeric);
  if (Math.abs(x - Math.round(x)) < 1e-12) {
    return { numerator: sign * Math.round(x), denominator: 1, value: numeric };
  }

  let previousNumerator = 0;
  let numerator = 1;
  let previousDenominator = 1;
  let denominator = 0;
  let guard = 0;

  while (guard++ < 24) {
    const whole = Math.floor(x);
    const nextNumerator = whole * numerator + previousNumerator;
    const nextDenominator = whole * denominator + previousDenominator;
    if (nextDenominator > maxDenominator) break;
    previousNumerator = numerator;
    previousDenominator = denominator;
    numerator = nextNumerator;
    denominator = nextDenominator;
    const rest = x - whole;
    if (Math.abs(rest) < 1e-12) break;
    x = 1 / rest;
  }

  if (!denominator) return null;
  return {
    numerator: sign * numerator,
    denominator,
    value: sign * numerator / denominator
  };
}

function fractionApproxText(value, maxDenominator = 10000, tolerance = 1e-9) {
  const fraction = approximateFraction(value, maxDenominator);
  if (!fraction || fraction.denominator === 1) return null;
  if (Math.abs(fraction.value - Number(value)) > tolerance) return null;
  return `${fraction.numerator}/${fraction.denominator}`;
}

function numberExpr(value, digits = 8) {
  if (!Number.isFinite(Number(value))) return "NaN";
  if (Math.abs(Number(value)) < 1e-12) return "0";
  const fraction = fractionApproxText(value, 1000, 1e-10);
  if (fraction && fraction.length <= fmt(Number(value), digits).length + 2) return fraction;
  return fmt(Number(value), digits);
}

function positiveNumberExpr(value, digits = 8) {
  return numberExpr(Math.abs(Number(value)), digits).replace(/^-/, "");
}

function displayExpr(expr) {
  return String(expr || "")
    .replace(/\s+/g, "")
    .replace(/\*\*/g, "^")
    .replace(/\*/g, "·");
}

function methodLabel(method) {
  return { left: "Izquierda", right: "Derecha", midpoint: "Punto medio" }[method] || "Punto medio";
}

function clampN(value) {
  return Math.max(1, Math.min(MAX_N, parseInt(value, 10) || 1));
}

function simpson(fn, a, b) {
  if (a === b) return 0;
  const left = Math.min(a, b);
  const right = Math.max(a, b);
  const sign = b >= a ? 1 : -1;
  let segments = 1800;
  if (segments % 2) segments++;
  const h = (right - left) / segments;
  let sum = finiteOrZero(fn, left) + finiteOrZero(fn, right);

  for (let i = 1; i < segments; i++) {
    sum += finiteOrZero(fn, left + i * h) * (i % 2 ? 4 : 2);
  }
  return sign * sum * h / 3;
}

function riemann(fn, a, b, n, method) {
  const dx = (b - a) / n;
  const rects = [];
  let total = 0;

  for (let i = 1; i <= n; i++) {
    const p = a + (i - 1) * dx;
    const q = a + i * dx;
    let sample = p;
    if (method === "right") sample = q;
    if (method === "midpoint") sample = (p + q) / 2;

    const y = finiteOrZero(fn, sample);
    const area = y * dx;
    total += area;
    rects.push({
      i,
      p,
      q,
      x0: Math.min(p, q),
      x1: Math.max(p, q),
      sample,
      y,
      area,
      cum: total
    });
  }
  return { dx, rects, sum: total };
}

function signedAreas(fn, a, b) {
  const left = Math.min(a, b);
  const right = Math.max(a, b);
  const slices = 1800;
  const dx = (right - left) / slices;
  let pos = 0;
  let neg = 0;

  for (let i = 0; i < slices; i++) {
    const area = finiteOrZero(fn, left + (i + 0.5) * dx) * dx;
    if (area >= 0) pos += area;
    else neg += area;
  }
  return { pos, neg, net: pos + neg, total: pos + Math.abs(neg) };
}

function readInputs() {
  const expr = $("exprInput").value.trim();
  const a = Number($("aInput").value);
  const b = Number($("bInput").value);
  const manualN = clampN($("nInput").value);
  const n = $("infinityInput").checked ? INFINITE_N : manualN;
  const method = $("methodInput").value;

  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) {
    throw new Error("Intervalo inválido.");
  }
  return { expr, a, b, n, manualN, method };
}

function exprToLatex(raw) {
  let s = String(raw || "").trim();
  s = s.replace(/^f\s*\(\s*x\s*\)\s*=/i, "");
  s = s.replace(/sum\(/g, "\\sum(");
  s = s.replace(/\*\*\(([^)]+)\)/g, "^{$1}");
  s = s.replace(/\*\*([-+]?\d+(?:\.\d+)?|[a-zA-Z]+)/g, "^{$1}");
  s = s.replace(/\^([-+]?\d+(?:\.\d+)?|[a-zA-Z]+)/g, "^{$1}");
  s = s.replace(/\(([^()]+)\)\/\(([^()]+)\)/g, "\\frac{$1}{$2}");
  s = s.replace(/([0-9a-zA-Z.*+-]+)\/\(([^()]+)\)/g, "\\frac{$1}{$2}");
  s = s.replace(/\(([^()]+)\)\/([0-9a-zA-Z.*+-]+)/g, "\\frac{$1}{$2}");
  s = s.replace(/(\b\d+(?:\.\d+)?|\b[a-zA-Z]\b)\/(\b\d+(?:\.\d+)?|\b[a-zA-Z]\b)/g, "\\frac{$1}{$2}");
  s = s.replace(/\bsin\b/g, "\\sin");
  s = s.replace(/\bcos\b/g, "\\cos");
  s = s.replace(/\btan\b/g, "\\tan");
  s = s.replace(/\bsec\b/g, "\\sec");
  s = s.replace(/\bcsc\b/g, "\\csc");
  s = s.replace(/\bcot\b/g, "\\cot");
  s = s.replace(/\bln\b/g, "\\ln");
  s = s.replace(/\blog\b/g, "\\ln");
  s = s.replace(/\bexp\b/g, "\\exp");
  s = s.replace(/\batan\b/g, "\\arctan");
  s = s.replace(/√/g, "\\sqrt{}");
  s = s.replace(/\bsqrt\(([^)]+)\)/g, "\\sqrt{$1}");
  s = s.replace(/\babs\(([^)]+)\)/g, "\\left|$1\\right|");
  s = s.replace(/\bpi\b/g, "\\pi");
  s = s.replace(/\bPI\b/g, "\\pi");
  s = s.replace(/(\d)\s*\*\s*([a-zA-Z\\])/g, "$1\\,$2");
  s = s.replace(/\*/g, "\\cdot ");
  return s;
}

function stripOuterParens(text) {
  let s = String(text || "").trim();
  let changed = true;
  while (changed && s.startsWith("(") && s.endsWith(")")) {
    changed = false;
    let depth = 0;
    let wraps = true;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "(") depth++;
      if (s[i] === ")") depth--;
      if (depth === 0 && i < s.length - 1) {
        wraps = false;
        break;
      }
    }
    if (wraps) {
      s = s.slice(1, -1).trim();
      changed = true;
    }
  }
  return s;
}

function splitTopLevel(text, operators) {
  const s = String(text || "");
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s[i];
    if (char === "(") depth++;
    else if (char === ")") depth--;
    else if (depth === 0 && operators.includes(char) && i > start) {
      if (char === "*" && (s[i - 1] === "*" || s[i + 1] === "*")) continue;
      if ((char === "+" || char === "-") && (s[i - 1] === "*" || s[i - 1] === "/" || s[i - 1] === "^")) continue;
      parts.push({ value: s.slice(start, i), op: parts.length ? s[start - 1] : "+" });
      start = i + 1;
    }
  }
  parts.push({ value: s.slice(start), op: parts.length ? s[start - 1] : "+" });
  return parts.filter(part => part.value !== "");
}

function findTopLevelOperator(text, operator) {
  const s = String(text || "");
  let depth = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    const char = s[i];
    if (char === ")") depth++;
    else if (char === "(") depth--;
    else if (depth === 0 && char === operator) return i;
  }
  return -1;
}

function findTopLevelPower(text) {
  const s = String(text || "");
  let depth = 0;
  for (let i = s.length - 1; i >= 1; i--) {
    const char = s[i];
    if (char === ")") depth++;
    else if (char === "(") depth--;
    else if (depth === 0 && s.slice(i - 1, i + 1) === "**") return i - 1;
  }
  return -1;
}

function latexAtom(raw) {
  let s = stripOuterParens(raw);
  if (!s) return "";

  const sumParts = splitTopLevel(s, "+-");
  if (sumParts.length > 1) {
    return sumParts.map((part, index) => {
      const value = latexAtom(part.value);
      if (index === 0) return part.op === "-" ? `-${value}` : value;
      return `${part.op === "-" ? "-" : "+"}${value}`;
    }).join(" ");
  }

  const divisionIndex = findTopLevelOperator(s, "/");
  if (divisionIndex > 0) return `\\frac{${latexAtom(s.slice(0, divisionIndex))}}{${latexAtom(s.slice(divisionIndex + 1))}}`;

  const productParts = splitTopLevel(s, "*").filter(part => part.value !== "");
  if (productParts.length > 1) return productParts.map(part => latexAtom(part.value)).join("\\,");

  const powerIndex = findTopLevelPower(s);
  if (powerIndex > 0) return `${latexAtom(s.slice(0, powerIndex))}^{${latexAtom(s.slice(powerIndex + 2))}}`;

  const fn = s.match(/^([a-zA-Z]+)\((.*)\)$/);
  if (fn) {
    const name = fn[1].toLowerCase();
    const arg = latexAtom(fn[2]);
    const names = {
      sin: "\\sin",
      cos: "\\cos",
      tan: "\\tan",
      sec: "\\sec",
      csc: "\\csc",
      cot: "\\cot",
      asin: "\\arcsin",
      acos: "\\arccos",
      atan: "\\arctan",
      log: "\\ln",
      ln: "\\ln",
      exp: "\\exp"
    };
    if (name === "sqrt") return `\\sqrt{${arg}}`;
    if (name === "abs") return `\\left|${arg}\\right|`;
    return `${names[name] || `\\operatorname{${name}}`}\\left(${arg}\\right)`;
  }

  if (/^pi$/i.test(s)) return "\\pi";
  if (s === "e") return "e";
  return s.replace(/\*/g, "\\cdot ");
}

function exprToLatex(raw) {
  const cleaned = normalize(String(raw || "").replace(/^f\s*\(\s*x\s*\)\s*=/i, "")).replace(/\s+/g, "");
  return latexAtom(cleaned);
}

function hasTopLevelParts(text, operators) {
  return splitTopLevel(stripOuterParens(text), operators).length > 1;
}

function hasTopLevelProduct(text) {
  return hasTopLevelParts(text, "*");
}

function hasTopLevelSum(text) {
  return hasTopLevelParts(text, "+-");
}

function hasTopLevelDivision(text) {
  return findTopLevelOperator(stripOuterParens(text), "/") > 0;
}

function isSimpleLinearExpr(text) {
  return /^-?(?:\d+(?:\.\d+)?|[a-zA-Z]|pi|e|[a-zA-Z]\^-?\d+(?:\.\d+)?|[a-zA-Z]+\([^()]*\))$/.test(String(text || "").trim());
}

function wrapLinearPart(text) {
  const value = String(text || "").trim();
  return isSimpleLinearExpr(value) ? value : `(${value})`;
}

function wrapLinearFactor(text, raw) {
  const value = String(text || "").trim();
  const source = stripOuterParens(raw);
  return hasTopLevelSum(source) || hasTopLevelDivision(source) ? `(${value})` : value;
}

function wrapLinearQuotientPart(text, raw, role) {
  const value = String(text || "").trim();
  const source = stripOuterParens(raw);
  if (role === "numerator") {
    return hasTopLevelSum(source) || hasTopLevelDivision(source) ? `(${value})` : value;
  }
  return hasTopLevelSum(source) || hasTopLevelProduct(source) || hasTopLevelDivision(source)
    ? `(${value})`
    : value;
}

function wrapLinearPowerPart(text, raw) {
  const value = String(text || "").trim();
  const source = stripOuterParens(raw);
  return hasTopLevelSum(source) || hasTopLevelProduct(source) || hasTopLevelDivision(source)
    ? `(${value})`
    : value;
}

function linearAtom(raw) {
  let s = stripOuterParens(raw);
  if (!s) return "";

  const sumParts = splitTopLevel(s, "+-");
  if (sumParts.length > 1) {
    return sumParts.map((part, index) => {
      const value = linearAtom(part.value);
      if (index === 0) return part.op === "-" ? `-${value}` : value;
      return `${part.op === "-" ? "-" : "+"} ${value}`;
    }).join(" ");
  }

  const divisionIndex = findTopLevelOperator(s, "/");
  if (divisionIndex > 0) {
    const numeratorRaw = s.slice(0, divisionIndex);
    const denominatorRaw = s.slice(divisionIndex + 1);
    const numerator = linearAtom(numeratorRaw);
    const denominator = linearAtom(denominatorRaw);
    return `${wrapLinearQuotientPart(numerator, numeratorRaw, "numerator")}/${wrapLinearQuotientPart(denominator, denominatorRaw, "denominator")}`;
  }

  const productParts = splitTopLevel(s, "*").filter(part => part.value !== "");
  if (productParts.length > 1) return productParts.map(part => wrapLinearFactor(linearAtom(part.value), part.value)).join("*");

  const powerIndex = findTopLevelPower(s);
  if (powerIndex > 0) {
    const baseRaw = s.slice(0, powerIndex);
    const exponentRaw = s.slice(powerIndex + 2);
    return `${wrapLinearPowerPart(linearAtom(baseRaw), baseRaw)}^${wrapLinearPowerPart(linearAtom(exponentRaw), exponentRaw)}`;
  }

  const fn = s.match(/^([a-zA-Z]+)\((.*)\)$/);
  if (fn) return `${fn[1].toLowerCase()}(${linearAtom(fn[2])})`;

  return s.replace(/\*\*/g, "^");
}

function linearExpr(raw) {
  const cleaned = normalize(String(raw || "").replace(/^f\s*\(\s*x\s*\)\s*=/i, "")).replace(/\s+/g, "");
  return linearAtom(cleaned);
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
  if (typeof gsap === "undefined") return;
  const cards = document.querySelectorAll(`${selector} .scard`);
  if (!cards.length) return;
  gsap.fromTo(cards, { opacity: 0, x: -12 }, { opacity: 1, x: 0, duration: 0.24, stagger: 0.04, ease: "power2.out" });
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
    item.fraction ? `Forma en fraccion: ${item.fraction}.` : "",
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

  const fractionText = item.fraction ? ` Forma en fraccion: ${item.fraction}.` : "";
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

function curveSamples(fn, left, right) {
  const x = [];
  const y = [];
  for (let i = 0; i <= 720; i++) {
    const xv = left + (right - left) * i / 720;
    const yv = fn(xv);
    x.push(xv);
    y.push(Number.isFinite(yv) ? yv : null);
  }
  return { x, y };
}

function drawGraph(input) {
  if (typeof Plotly === "undefined" || !STATE.fn || !STATE.data) return;

  const a = input.a;
  const b = input.b;
  const left = Math.min(a, b);
  const right = Math.max(a, b);
  const pad = Math.max((right - left) * 0.18, 0.75);
  const viewLeft = left - pad;
  const viewRight = right + pad;
  const curve = curveSamples(STATE.fn, viewLeft, viewRight);
  const traces = [];

  if ($("rectsInput").checked && !$("infinityInput").checked) {
    const skip = Math.max(1, Math.ceil(STATE.data.rects.length / MAX_DRAW_BARS));
    const bx = [];
    const by = [];
    const bw = [];
    const bc = [];
    for (let k = 0; k < STATE.data.rects.length; k += skip) {
      const r = STATE.data.rects[k];
      bx.push((r.x0 + r.x1) / 2);
      by.push(r.y);
      bw.push(Math.abs(r.x1 - r.x0) * 0.96);
      bc.push(r.y >= 0 ? "rgba(32,164,100,.32)" : "rgba(220,38,38,.26)");
    }
    traces.push({
      type: "bar",
      x: bx,
      y: by,
      width: bw,
      marker: { color: bc, line: { color: "rgba(31,41,55,.22)", width: 1 } },
      hovertemplate: "x: %{x:.4f}<br>f(x): %{y:.4f}<extra>Rectángulo</extra>",
      showlegend: false
    });
  }

  if ($("rectsInput").checked && $("infinityInput").checked) {
    const px = [];
    const py = [];
    const nx = [];
    const ny = [];
    for (let i = 0; i <= 360; i++) {
      const xv = left + (right - left) * i / 360;
      const yv = finiteOrZero(STATE.fn, xv);
      px.push(xv);
      py.push(yv >= 0 ? yv : 0);
      nx.push(xv);
      ny.push(yv < 0 ? yv : 0);
    }
    traces.push({ x: px, y: py, type: "scatter", mode: "none", fill: "tozeroy", fillcolor: "rgba(32,164,100,.22)", showlegend: false, hoverinfo: "skip" });
    traces.push({ x: nx, y: ny, type: "scatter", mode: "none", fill: "tozeroy", fillcolor: "rgba(220,38,38,.18)", showlegend: false, hoverinfo: "skip" });
  }

  traces.push({
    x: curve.x,
    y: curve.y,
    type: "scatter",
    mode: "lines",
    line: { color: "#2f80ed", width: 3 },
    name: "f(x)",
    hovertemplate: "x: %{x:.4f}<br>f(x): %{y:.4f}<extra></extra>"
  });

  if ($("samplesInput").checked && !$("infinityInput").checked) {
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
      marker: { color: "#f59e0b", size: 6, line: { color: "#ffffff", width: 1.5 } },
      hovertemplate: "x*: %{x:.4f}<br>f(x*): %{y:.4f}<extra>Muestra</extra>",
      showlegend: false
    });
  }

  const gridColor = $("gridInput").checked ? "#e4e8ef" : "transparent";
  const layout = {
    paper_bgcolor: "#ffffff",
    plot_bgcolor: "#ffffff",
    font: { family: "Inter, system-ui, sans-serif", size: 11, color: "#64748b" },
    margin: { l: 54, r: 20, t: 12, b: 42 },
    xaxis: {
      range: [viewLeft, viewRight],
      showline: true,
      linecolor: "#aeb7c5",
      mirror: false,
      gridcolor: gridColor,
      zerolinecolor: "#6b7280",
      zerolinewidth: 1.3,
      tickfont: { family: "JetBrains Mono, monospace", size: 11, color: "#64748b" }
    },
    yaxis: {
      showline: true,
      linecolor: "#aeb7c5",
      mirror: false,
      gridcolor: gridColor,
      zerolinecolor: "#6b7280",
      zerolinewidth: 1.3,
      tickfont: { family: "JetBrains Mono, monospace", size: 11, color: "#64748b" }
    },
    shapes: [
      { type: "line", x0: a, x1: a, y0: 0, y1: 1, yref: "paper", line: { color: "rgba(124,58,237,.55)", width: 1.5, dash: "dash" } },
      { type: "line", x0: b, x1: b, y0: 0, y1: 1, yref: "paper", line: { color: "rgba(124,58,237,.55)", width: 1.5, dash: "dash" } }
    ],
    annotations: [
      { x: a, y: 0, text: `a=${fmt(a, 2)}`, showarrow: false, yshift: -16, font: { size: 11, color: "#7c3aed", family: "JetBrains Mono" } },
      { x: b, y: 0, text: `b=${fmt(b, 2)}`, showarrow: false, yshift: 16, font: { size: 11, color: "#7c3aed", family: "JetBrains Mono" } }
    ],
    hovermode: "x unified",
    dragmode: "pan",
    bargap: 0,
    bargroupgap: 0
  };
  const config = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    scrollZoom: true,
    modeBarButtonsToRemove: ["select2d", "lasso2d", "autoScale2d"],
    toImageButtonOptions: { filename: "integral_studio", format: "png", scale: 2 }
  };
  Plotly.react("plotlyGraph", traces, layout, config);
}

function updateMetrics(input) {
  const infinite = $("infinityInput").checked;
  const error = Math.abs(STATE.data.sum - STATE.exact);
  $("metricN").textContent = infinite ? "∞" : String(input.manualN);
  $("metricDx").textContent = infinite ? "0" : fmt(STATE.data.dx);
  $("metricSum").textContent = fmt(infinite ? STATE.exact : STATE.data.sum);
  $("metricIntegral").textContent = fmt(STATE.exact);
  $("metricError").textContent = fmt(infinite ? 0 : error);
  $("metricTotal").textContent = fmt(STATE.areas.total);
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

  renderSteps("stepsTimeline", [
    { n: 1, label: "Planteamiento", tex: `\\int_{${fmt(input.a)}}^{${fmt(input.b)}}\\!\\left(${exprToLatex(input.expr)}\\right)dx`, desc: `Área neta bajo f(x) en [${fmt(input.a)}, ${fmt(input.b)}].` },
    { n: 2, label: "Partición", tex: `\\Delta x=\\frac{${fmt(input.b)}-(${fmt(input.a)})}{${infinite ? "n" : input.manualN}}=${fmt(STATE.data.dx)}`, desc: "Dividimos el intervalo en subintervalos iguales." },
    { n: 3, label: "Muestras", tex: sampleRule, desc: `Método seleccionado: ${method}.` },
    { n: 4, label: "Evaluación", tex: `${firstValues}${suffix}`, desc: "Primeras evaluaciones de la función." },
    { n: 5, label: "Suma", tex: `S_n=\\sum_{i=1}^{n}f(x_i^*)\\Delta x\\approx ${fmt(STATE.data.sum)}`, desc: "Suma de las áreas rectangulares." },
    { n: 6, label: "Integral", tex: `\\lim_{n\\to\\infty}S_n=\\int_{${fmt(input.a)}}^{${fmt(input.b)}}f(x)\\,dx=${fmt(STATE.exact)}`, desc: "Aproximación numérica con regla de Simpson." },
    { n: 7, label: "Error", tex: `|S_n-I|=${fmt(infinite ? 0 : error)}`, desc: "Diferencia absoluta entre la suma y la integral." },
    { n: 8, label: "Áreas", tex: `A^+=${fmt(STATE.areas.pos)},\\;A^-=${fmt(STATE.areas.neg)},\\;A_{total}=${fmt(STATE.areas.total)}`, desc: "Desglose entre área positiva, negativa y total." }
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
    $("commandInput").value = `f(x)=${input.expr}`;
  }
}

function syncMethodButtons(method) {
  document.querySelectorAll(".seg-btn").forEach(btn => {
    btn.classList.toggle("is-active", btn.dataset.method === method);
  });
}

function setStatus(message, type = "") {
  const bar = $("statusBar");
  bar.textContent = message;
  bar.className = type ? `status-pill ${type}` : "status-pill";
}

function updateAll() {
  try {
    const input = readInputs();
    STATE.input = input;
    STATE.fn = compile(input.expr);
    STATE.data = riemann(STATE.fn, input.a, input.b, input.n, input.method);
    STATE.exact = simpson(STATE.fn, input.a, input.b);
    STATE.areas = signedAreas(STATE.fn, input.a, input.b);

    $("nInput").value = input.manualN;
    $("nRange").value = input.manualN;
    syncMethodButtons(input.method);
    updateMetrics(input);
    updateChrome(input);
    updateMathPreviews();
    drawGraph(input);
    updateTable();
    updateSteps(input);
    if ($("pAssistant")?.classList.contains("show")) updateAssistant("summary");

    const status = $("infinityInput").checked
      ? "Modo límite n→∞: se muestra el área continua"
      : `OK · ${input.manualN} rectángulos · ${methodLabel(input.method)}`;
    setStatus(status);
  } catch (error) {
    setStatus(error.message, "err");
  }
}

function tokenizeTerms(expr) {
  let text = normalize(expr).replace(/\s+/g, "");
  if (!text) return [];
  if (!/^[+-]/.test(text)) text = `+${text}`;

  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 1; i < text.length; i++) {
    if (text[i] === "(") depth++;
    if (text[i] === ")") depth--;
    if ((text[i] === "+" || text[i] === "-") && depth === 0) {
      out.push(text.slice(start, i));
      start = i;
    }
  }
  out.push(text.slice(start));
  return out.filter(Boolean);
}

function evaluateNumber(text) {
  if (!/^[-0-9./]+$/.test(text)) throw new Error("Número inválido");
  return Function(`"use strict"; return (${text})`)();
}

function productWithCoefficient(coef, body) {
  const numeric = Number(coef);
  if (Math.abs(numeric - 1) < 1e-12) return body;
  if (Math.abs(numeric + 1) < 1e-12) return `-${body}`;
  return `${numberExpr(numeric)}*${body}`;
}

function integratePower(coefText, exponentText) {
  const coef = Number(evaluateNumber(coefText));
  const exponent = Number(evaluateNumber(exponentText));
  if (Math.abs(exponent + 1) < 1e-12) return productWithCoefficient(coef, "log(abs(x))");
  return productWithCoefficient(coef / (exponent + 1), `x**${numberExpr(exponent + 1)}`);
}

// Normaliza exponentes con paréntesis: x**(-1) → exponent "-1"
function parseExponent(raw) {
  const s = String(raw || "").trim();
  // acepta formas: -1, (-1), (−1), -1/2, (-1/2)
  const cleaned = s.replace(/^\((.+)\)$/, "$1");
  if (/^-?[0-9]+(?:\.[0-9]+)?(?:\/[0-9]+(?:\.[0-9]+)?)?$/.test(cleaned)) return cleaned;
  return null;
}

function integrateTerm(term) {
  let match;

  // ── Constante numérica ────────────────────────────────────────────────────
  if (/^\d+(\.\d+)?$/.test(term)) return `${term}*x`;

  // ── Monomios básicos de x ─────────────────────────────────────────────────
  if (term === "x") return "1/2*x**2";

  // ── Regla logarítmica: ∫1/x dx = ln|x| + C ───────────────────────────────
  if (term === "1/x") return "log(abs(x))";
  // x^(-1) con o sin paréntesis en el exponente
  if ((match = term.match(/^x\*\*\((-1)\)$/)) || term === "x**-1") return "log(abs(x))";

  // ── Integral de ln(x): ∫ln(x)dx = x·ln|x| − x + C  (por partes) ─────────
  if (term === "log(x)" || term === "ln(x)") return "x*log(abs(x)) - x";
  // ln(a·x) = ln(a) + ln(x) → misma antiderivada menos constante: x·ln|ax| − x
  if ((match = term.match(/^(?:log|ln)\(([0-9.\/]+)\*x\)$/))) {
    const a = match[1];
    return `x*log(abs(${a}*x)) - x`;
  }
  // ln(x + a) o ln(x − a) → (x+a)·ln|x+a| − (x+a)  (por partes con u=ln(x+a))
  if ((match = term.match(/^(?:log|ln)\(x([+-][0-9.\/]+)\)$/))) {
    const a = match[1];
    const inner = `x${a}`;
    return `(${inner})*log(abs(${inner})) - (${inner})`;
  }

  // ── Fracciones 1/(x+a): ∫1/(x+a)dx = ln|x+a| + C ────────────────────────
  if ((match = term.match(/^1\/\(x([+-][0-9.\/]+)\)$/))) return `log(abs(x${match[1]}))`;
  if ((match = term.match(/^1\/\(([0-9.\/]+)\*x([+-][0-9.\/]+)\)$/))) {
    const a = match[1], b = match[2];
    return `${numberExpr(1 / Number(evaluateNumber(a)))}*log(abs(${a}*x${b}))`;
  }

  // ── Arcotangente: ∫1/(1+x²)dx = arctan(x) + C ───────────────────────────
  if (term === "1/(1+x**2)" || term === "1/(x**2+1)") return "atan(x)";
  // ∫1/(a²+x²)dx = (1/a)·arctan(x/a)
  if ((match = term.match(/^1\/\(([0-9.\/]+)\+x\*\*2\)$/) ) || (match = term.match(/^1\/\(x\*\*2\+([0-9.\/]+)\)$/))) {
    const a2 = Number(evaluateNumber(match[1]));
    if (a2 > 0) {
      const a = Math.sqrt(a2);
      return `${numberExpr(1/a)}*atan(x/${numberExpr(a)})`;
    }
  }

  // ── Regla de potencia: ∫xⁿ dx = x^(n+1)/(n+1) + C  (n≠−1) ──────────────
  if ((match = term.match(/^([0-9.\/]+)\*?x$/))) return productWithCoefficient(Number(evaluateNumber(match[1])) / 2, "x**2");
  // x**n sin paréntesis: e.g. x**2, x**0.5, x**-2
  if ((match = term.match(/^x\*\*([-0-9/.]+)$/))) return integratePower("1", match[1]);
  // x**(n) con paréntesis: x**(-2), x**(-1/2)
  if ((match = term.match(/^x\*\*\((.+)\)$/))) {
    const exp = parseExponent(`(${match[1]})`);
    if (exp !== null) return integratePower("1", exp);
  }
  if ((match = term.match(/^([0-9.\/]+)\*x\*\*([-0-9/.]+)$/))) return integratePower(match[1], match[2]);
  if ((match = term.match(/^([0-9.\/]+)\*x\*\*\((.+)\)$/))) {
    const exp = parseExponent(`(${match[2]})`);
    if (exp !== null) return integratePower(match[1], exp);
  }

  // ── Cocientes k/x, k/xⁿ ──────────────────────────────────────────────────
  if ((match = term.match(/^([0-9.\/]+)\/x$/))) return `${match[1]}*log(abs(x))`;
  if ((match = term.match(/^([0-9.\/]+)\/x\*\*([-0-9/.]+)$/))) return integratePower(match[1], `-${match[2]}`);
  if ((match = term.match(/^([0-9.\/]+)\/\(x([+-][0-9.\/]+)\)$/))) return `${match[1]}*log(abs(x${match[2]}))`;

  // ── c·ln(x) y c·log(x) ───────────────────────────────────────────────────
  if ((match = term.match(/^([0-9.\/]+)\*log\(x\)$/))) return `${match[1]}*(x*log(abs(x)) - x)`;
  if ((match = term.match(/^([0-9.\/]+)\*ln\(x\)$/))) return `${match[1]}*(x*log(abs(x)) - x)`;

  // ── Trigonométricas: sen/cos básicos y con coeficiente ────────────────────
  if (term === "sin(x)") return "-cos(x)";
  if (term === "cos(x)") return "sin(x)";
  if (term === "tan(x)") return "-log(abs(cos(x)))";
  if (term === "sec(x)**2") return "tan(x)";
  if (term === "csc(x)**2") return "-cot(x)";
  if (term === "sec(x)*tan(x)") return "sec(x)";
  if (term === "csc(x)*cot(x)") return "-csc(x)";
  // ∫sin(ax)dx = −cos(ax)/a,  ∫cos(ax)dx = sin(ax)/a
  if ((match = term.match(/^sin\(([0-9.\/]+)\*x\)$/))) {
    const a = Number(evaluateNumber(match[1]));
    return `${numberExpr(-1/a)}*cos(${match[1]}*x)`;
  }
  if ((match = term.match(/^cos\(([0-9.\/]+)\*x\)$/))) {
    const a = Number(evaluateNumber(match[1]));
    return `${numberExpr(1/a)}*sin(${match[1]}*x)`;
  }
  if ((match = term.match(/^(\d+\.?\d*)\*sin\(x\)$/))) return `-${match[1]}*cos(x)`;
  if ((match = term.match(/^(\d+\.?\d*)\*cos\(x\)$/))) return `${match[1]}*sin(x)`;

  // ── Exponencial: ∫eˣ dx = eˣ,  ∫e^(ax) dx = e^(ax)/a ────────────────────
  if (term === "exp(x)") return "exp(x)";
  if ((match = term.match(/^exp\(([0-9.\/]+)\*x\)$/))) {
    const a = Number(evaluateNumber(match[1]));
    return `${numberExpr(1/a)}*exp(${match[1]}*x)`;
  }
  if ((match = term.match(/^(\d+\.?\d*)\*exp\(x\)$/))) return `${match[1]}*exp(x)`;
  if ((match = term.match(/^(\d+\.?\d*)\*exp\(([0-9.\/]+)\*x\)$/))) {
    const c = Number(match[1]);
    const a = Number(evaluateNumber(match[2]));
    return `${numberExpr(c/a)}*exp(${match[2]}*x)`;
  }

  // ── √x y variantes ───────────────────────────────────────────────────────
  if (term === "sqrt(x)") return "2/3*x**(3/2)";
  if ((match = term.match(/^([0-9.\/]+)\*sqrt\(x\)$/))) {
    const c = Number(evaluateNumber(match[1]));
    return `${numberExpr(2*c/3)}*x**(3/2)`;
  }

  throw new Error(`No hay regla para: ${term}`);
}

function integrateSimple(expr) {
  const terms = tokenizeTerms(expr);
  if (!terms.length) throw new Error("Expresión vacía");

  const parts = terms.map(term => {
    const sign = term[0] === "-" ? -1 : 1;
    const body = term.slice(1);
    return { sign, value: integrateTerm(body) };
  });

  return parts.map((part, index) => {
    const intrinsicNegative = part.value.startsWith("-");
    const clean = intrinsicNegative ? part.value.slice(1) : part.value;
    const sign = part.sign * (intrinsicNegative ? -1 : 1);
    if (index === 0) return sign < 0 ? `-${clean}` : clean;
    return `${sign < 0 ? "- " : "+ "}${clean}`;
  }).join(" ");
}

function evaluateBound(text) {
  const normalized = normalize(text)
    .replace(/\bpi\b/g, String(Math.PI))
    .replace(/\bPI\b/g, String(Math.PI))
    .replace(/\be\b/g, String(Math.E));
  if (!/^[-+0-9.*/()\s]+$/.test(normalized)) throw new Error("Límite inválido");
  return Function(`"use strict"; return (${normalized})`)();
}

function nearZero(value) {
  return Math.abs(Number(value)) < 1e-9;
}

function polynomialDegree(coeffs) {
  for (let i = coeffs.length - 1; i >= 0; i--) {
    if (!nearZero(coeffs[i])) return i;
  }
  return 0;
}

function multiplyPolynomial2(a, b) {
  const out = [0, 0, 0];
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      if (i + j > 2 && !nearZero(a[i] * b[j])) return null;
      if (i + j <= 2) out[i + j] += a[i] * b[j];
    }
  }
  return out;
}

function parsePolynomial2(expr) {
  let s = stripOuterParens(normalize(expr).replace(/\s+/g, ""));
  if (!s) return null;

  const squared = s.match(/^\((.+)\)\*\*2$/);
  if (squared) {
    const base = parsePolynomial2(squared[1]);
    return base && polynomialDegree(base) === 1 ? multiplyPolynomial2(base, base) : null;
  }

  const product = s.match(/^\((.+)\)\*\((.+)\)$/);
  if (product) {
    const left = parsePolynomial2(product[1]);
    const right = parsePolynomial2(product[2]);
    return left && right ? multiplyPolynomial2(left, right) : null;
  }

  const coeffs = [0, 0, 0];
  const terms = tokenizeTerms(s);
  for (const term of terms) {
    const sign = term[0] === "-" ? -1 : 1;
    const body = term.slice(1);
    let match;

    if (/^[0-9.\/]+$/.test(body)) {
      coeffs[0] += sign * Number(evaluateNumber(body));
      continue;
    }
    if (body === "x") {
      coeffs[1] += sign;
      continue;
    }
    if (body === "x**2") {
      coeffs[2] += sign;
      continue;
    }
    if ((match = body.match(/^x\*\*([0-2])$/))) {
      coeffs[Number(match[1])] += sign;
      continue;
    }
    if ((match = body.match(/^([0-9.\/]+)\*?x(?:\*\*([0-2]))?$/))) {
      coeffs[Number(match[2] || 1)] += sign * Number(evaluateNumber(match[1]));
      continue;
    }
    return null;
  }
  return coeffs;
}

function polynomialValue(coeffs, x) {
  return coeffs.reduce((sum, coeff, degree) => sum + coeff * x ** degree, 0);
}

function polynomialDerivativeValue(coeffs, x) {
  return (coeffs[1] || 0) + 2 * (coeffs[2] || 0) * x;
}

function appendPolynomialTerm(parts, coeff, body = "") {
  if (nearZero(coeff)) return;
  const sign = coeff < 0 ? "-" : "+";
  const abs = Math.abs(coeff);
  const text = body
    ? `${Math.abs(abs - 1) < 1e-9 ? "" : `${positiveNumberExpr(abs)}*`}${body}`
    : positiveNumberExpr(abs);
  if (!parts.length) parts.push(coeff < 0 ? `-${text}` : text);
  else parts.push(`${sign} ${text}`);
}

function polynomialToExpr(coeffs) {
  const parts = [];
  appendPolynomialTerm(parts, coeffs[2] || 0, "x**2");
  appendPolynomialTerm(parts, coeffs[1] || 0, "x");
  appendPolynomialTerm(parts, coeffs[0] || 0);
  return parts.length ? parts.join(" ") : "0";
}

function compactExpression(text) {
  return String(text || "").replace(/\s+/g, "");
}

function linearFactorFromRoot(root) {
  if (nearZero(root)) return "x";
  return root < 0 ? `x+${positiveNumberExpr(root)}` : `x-${positiveNumberExpr(root)}`;
}

function fractionTerm(coef, denominator) {
  return `${positiveNumberExpr(coef)}/(${denominator})`;
}

function bodyWithCoefficient(coef, body) {
  const abs = Math.abs(coef);
  return Math.abs(abs - 1) < 1e-9 ? body : `${positiveNumberExpr(abs)}*${body}`;
}

function appendSignedText(parts, signedValue, positiveText) {
  if (nearZero(signedValue)) return;
  if (!parts.length) parts.push(signedValue < 0 ? `-${positiveText}` : positiveText);
  else parts.push(`${signedValue < 0 ? "-" : "+"} ${positiveText}`);
}

function appendSignedBody(parts, signedValue, body) {
  appendSignedText(parts, signedValue, bodyWithCoefficient(signedValue, body));
}

function decomposePartialGeneric(clean) {
  const divisionIndex = findTopLevelOperator(clean, "/");
  if (divisionIndex <= 0) return null;

  const numeratorRaw = clean.slice(0, divisionIndex);
  const denominatorRaw = clean.slice(divisionIndex + 1);
  const numerator = parsePolynomial2(numeratorRaw);
  const denominator = parsePolynomial2(denominatorRaw);
  if (!numerator || !denominator || polynomialDegree(denominator) !== 2) return null;

  const a = denominator[2];
  const b = denominator[1];
  const c = denominator[0];
  if (nearZero(a)) return null;

  const numeratorDegree = polynomialDegree(numerator);
  if (numeratorDegree > 2) return null;
  const quotient = numeratorDegree === 2 ? numerator[2] / a : 0;
  const remainder = numerator.map((coeff, index) => coeff - quotient * (denominator[index] || 0));
  const denominatorText = compactExpression(polynomialToExpr(denominator));
  const decParts = [];
  const intParts = [];
  const steps = [
    { label: "Planteamiento", tex: `\\frac{${exprToLatex(numeratorRaw)}}{${exprToLatex(denominatorRaw)}}`, desc: "Leemos numerador y denominador." }
  ];

  appendSignedText(decParts, quotient, positiveNumberExpr(quotient));
  appendSignedBody(intParts, quotient, "x");

  const discriminant = b * b - 4 * a * c;

  if (discriminant > 1e-9) {
    const sqrtD = Math.sqrt(discriminant);
    const r1 = (-b + sqrtD) / (2 * a);
    const r2 = (-b - sqrtD) / (2 * a);
    const f1 = linearFactorFromRoot(r1);
    const f2 = linearFactorFromRoot(r2);
    const A = polynomialValue(remainder, r1) / (a * (r1 - r2));
    const B = polynomialValue(remainder, r2) / (a * (r2 - r1));

    appendSignedText(decParts, A, fractionTerm(A, f1));
    appendSignedText(decParts, B, fractionTerm(B, f2));
    appendSignedBody(intParts, A, `log(abs(${f1}))`);
    appendSignedBody(intParts, B, `log(abs(${f2}))`);

    steps.push(
      { label: "Factorizar", tex: `${exprToLatex(denominatorText)}=${exprToLatex(`(${f1})*(${f2})`)}`, desc: "El denominador tiene dos factores lineales reales." },
      { label: "Fracciones parciales", tex: `${exprToLatex(clean)}=${exprToLatex(decParts.join(" "))}`, desc: "Calculamos constantes por sustitucion en las raices." },
      { label: "Regla", tex: "\\int\\frac{k}{x-r}\\,dx=k\\ln|x-r|", desc: "Cada factor lineal produce un logaritmo." }
    );
    return { dec: decParts.join(" "), intg: intParts.join(" ") || "0", steps };
  }

  if (Math.abs(discriminant) <= 1e-9) {
    const root = -b / (2 * a);
    const factor = linearFactorFromRoot(root);
    const A = polynomialDerivativeValue(remainder, root) / a;
    const B = polynomialValue(remainder, root) / a;

    appendSignedText(decParts, A, fractionTerm(A, factor));
    appendSignedText(decParts, B, fractionTerm(B, `(${factor})**2`));
    appendSignedBody(intParts, A, `log(abs(${factor}))`);
    appendSignedText(intParts, -B, fractionTerm(-B, factor));

    steps.push(
      { label: "Factor repetido", tex: `${exprToLatex(denominatorText)}=${exprToLatex(`(${factor})**2`)}`, desc: "El denominador tiene una raiz doble." },
      { label: "Fracciones parciales", tex: `${exprToLatex(clean)}=${exprToLatex(decParts.join(" "))}`, desc: "Usamos A/(x-r)+B/(x-r)^2." },
      { label: "Regla", tex: "\\int\\frac{k}{(x-r)^2}\\,dx=-\\frac{k}{x-r}", desc: "El segundo termino se integra como potencia -2." }
    );
    return { dec: decParts.join(" "), intg: intParts.join(" ") || "0", steps };
  }

  const positiveDelta = 4 * a * c - b * b;
  if (positiveDelta <= 1e-9 || a <= 0) return null;
  const alpha = (remainder[1] || 0) / (2 * a);
  const beta = (remainder[0] || 0) - alpha * b;
  const derivativeText = compactExpression(polynomialToExpr([b, 2 * a, 0]));
  const sqrtDelta = Math.sqrt(positiveDelta);
  const atanArgument = `(${derivativeText})/${numberExpr(sqrtDelta)}`;
  const atanCoef = 2 * beta / sqrtDelta;

  appendSignedBody(decParts, alpha, `(${derivativeText})/(${denominatorText})`);
  appendSignedText(decParts, beta, fractionTerm(beta, denominatorText));
  appendSignedBody(intParts, alpha, `log(abs(${denominatorText}))`);
  appendSignedBody(intParts, atanCoef, `atan(${atanArgument})`);

  steps.push(
    { label: "Cuadratica irreducible", tex: `${exprToLatex(denominatorText)}`, desc: "No hay raices reales, asi que aparece logaritmo y arcotangente." },
    { label: "Separar", tex: `${exprToLatex(clean)}=${exprToLatex(decParts.join(" "))}`, desc: "Separamos una parte tipo D'(x)/D(x) y una constante sobre D(x)." },
    { label: "Reglas", tex: "\\int\\frac{D'}{D}dx=\\ln|D|,\\quad \\int\\frac{dx}{x^2+a^2}=\\frac{1}{a}\\arctan\\frac{x}{a}", desc: "Combinamos logaritmo y arcotangente." }
  );
  return { dec: decParts.join(" "), intg: intParts.join(" ") || "0", steps };
}

function decomposePartial(expr) {
  const clean = normalize(expr).replace(/\s+/g, "");
  const patterns = [
    {
      re: /^\(x\+5\)\/\(x\*\*2\+3\*x\+2\)$/,
      dec: "4/(x+1) - 3/(x+2)",
      intg: "4*log(abs(x+1)) - 3*log(abs(x+2))",
      steps: [
        { label: "Factorizar", tex: "Q(x)=x^{2}+3x+2=(x+1)(x+2)", desc: "Factores lineales." },
        { label: "Planteamiento", tex: "\\frac{x+5}{(x+1)(x+2)}=\\frac{A}{x+1}+\\frac{B}{x+2}", desc: "Constantes A y B." },
        { label: "Ecuación", tex: "x+5=A(x+2)+B(x+1)", desc: "Multiplicamos por el denominador." },
        { label: "Resolver", tex: "x=-1\\Rightarrow A=4,\\;x=-2\\Rightarrow B=-3", desc: "Sustituimos las raíces del denominador." }
      ]
    },
    {
      re: /^\(x\*\*2-5\*x\+9\)\/\(x\*\*2-5\*x\+6\)$/,
      dec: "1 - 3/(x-2) + 3/(x-3)",
      intg: "x - 3*log(abs(x-2)) + 3*log(abs(x-3))",
      steps: [
        { label: "División", tex: "\\frac{x^{2}-5x+9}{x^{2}-5x+6}=1+\\frac{3}{x^{2}-5x+6}", desc: "Fracción impropia." },
        { label: "Factorizar", tex: "x^{2}-5x+6=(x-2)(x-3)", desc: "Cuadrática factorizable." },
        { label: "Parciales", tex: "\\frac{3}{(x-2)(x-3)}=\\frac{A}{x-2}+\\frac{B}{x-3}", desc: "Planteamiento." },
        { label: "Coeficientes", tex: "A=-3,\\;B=3", desc: "Usamos x=2 y x=3." }
      ]
    },
    {
      re: /^\(3\*x\+5\)\/\(x-1\)\*\*2$/,
      dec: "3/(x-1) + 8/(x-1)**2",
      intg: "3*log(abs(x-1)) - 8/(x-1)",
      steps: [
        { label: "Factor repetido", tex: "Q(x)=(x-1)^{2}", desc: "Multiplicidad 2." },
        { label: "Planteamiento", tex: "\\frac{3x+5}{(x-1)^{2}}=\\frac{A}{x-1}+\\frac{B}{(x-1)^{2}}", desc: "Potencias crecientes." },
        { label: "Ecuación", tex: "3x+5=A(x-1)+B", desc: "Multiplicamos por el denominador." },
        { label: "Resolver", tex: "A=3,\\;B=8", desc: "x=1 para B y coeficientes para A." }
      ]
    },
    {
      re: /^\(2\*x\+3\)\/\(x\*\*2\+4\)$/,
      dec: "2*x/(x**2+4) + 3/(x**2+4)",
      intg: "log(x**2+4) + (3/2)*atan(x/2)",
      steps: [
        { label: "Irreducible", tex: "Q(x)=x^{2}+4", desc: "No factoriza en reales." },
        { label: "Separar", tex: "\\frac{2x+3}{x^{2}+4}=\\frac{2x}{x^{2}+4}+\\frac{3}{x^{2}+4}", desc: "Derivada del denominador más constante." },
        { label: "Logaritmo", tex: "\\int\\frac{2x}{x^{2}+4}dx=\\ln(x^{2}+4)", desc: "Tipo u'/u." },
        { label: "Arcotangente", tex: "\\int\\frac{3}{x^{2}+4}dx=\\tfrac{3}{2}\\arctan\\left(\\tfrac{x}{2}\\right)", desc: "Regla de arcotangente." }
      ]
    }
  ];
  return patterns.find(pattern => pattern.re.test(clean)) || decomposePartialGeneric(clean);
}

function integrationRuleName(expr, partial) {
  const clean = normalize(expr).replace(/\s+/g, "");
  if (partial) return "Fracciones parciales + integral logarítmica";
  // Logaritmo natural como integrando: ∫ln(x)dx
  if (/^(?:log|ln)\((?:[0-9.\/]+\*)?x(?:[+-][0-9.\/]+)?\)$/.test(clean) || /\*(?:log|ln)\(x\)/.test(clean))
    return "Integración por partes: ∫ln(x)dx = x·ln|x| − x + C";
  // Arcotangente
  if (/1\/\((?:1\+x\*\*2|x\*\*2\+1|[0-9.\/]+\+x\*\*2|x\*\*2\+[0-9.\/]+)\)/.test(clean))
    return "Integral de arcotangente: ∫1/(a²+x²)dx = (1/a)·arctan(x/a) + C";
  // Logarítmica 1/x  (incluyendo x**(-1), x**-1)
  if (/(?:^|[+\-])1\/x$|(?:^|[+\-])1\/x[+\-]|x\*\*-1|x\*\*\(-1\)|(?:^|[+\-])[0-9.\/]+\/x/.test(clean))
    return "Integral logarítmica: ∫(1/x)dx = ln|x| + C";
  // 1/(x+a)
  if (/1\/\(x[+-]/.test(clean)) return "Integral logarítmica: ∫1/(x+a)dx = ln|x+a| + C";
  // Trigonométrica
  if (/sin|cos|tan|sec|csc|cot/.test(clean)) return "Regla trigonométrica directa";
  // Exponencial
  if (/exp\(/.test(clean)) return "Regla exponencial: ∫e^(ax)dx = e^(ax)/a + C";
  // Raíz
  if (/sqrt\(x\)/.test(clean)) return "Regla de potencia: ∫√x dx = (2/3)x^(3/2) + C";
  // Potencia general
  if (/x(?:\*\*)?/.test(clean)) return "Regla de potencia: ∫xⁿ dx = xⁿ⁺¹/(n+1) + C  (n≠−1)";
  return "Reglas simbólicas locales + verificación numérica";
}

function formulaForRule(rule) {
  if (rule.includes("partes") && rule.includes("ln"))
    return "\\int\\ln(x)\\,dx=x\\ln|x|-x+C \\quad\\text{(integración por partes: }u=\\ln x,\\,dv=dx)";
  if (rule.includes("arcotangente"))
    return "\\int\\frac{1}{a^2+x^2}\\,dx=\\frac{1}{a}\\arctan\\!\\left(\\frac{x}{a}\\right)+C";
  if (rule.includes("1/(x+a)"))
    return "\\int\\frac{1}{x+a}\\,dx=\\ln|x+a|+C";
  if (rule.includes("logarítmica"))
    return "\\int\\frac{1}{x}\\,dx=\\ln|x|+C \\quad\\text{(regla logarítmica fundamental)}";
  if (rule.includes("trigonométrica"))
    return "\\int\\sin x\\,dx=-\\cos x+C,\\quad\\int\\cos x\\,dx=\\sin x+C";
  if (rule.includes("exponencial"))
    return "\\int e^{ax}\\,dx=\\frac{e^{ax}}{a}+C";
  if (rule.includes("√x") || rule.includes("sqrt"))
    return "\\int\\sqrt{x}\\,dx=\\frac{2}{3}x^{3/2}+C";
  if (rule.includes("Simpson"))
    return "\\int_a^b f(x)dx\\approx\\frac{h}{3}\\left[f(x_0)+4f(x_1)+2f(x_2)+\\cdots+f(x_n)\\right]";
  return "\\int x^n\\,dx=\\frac{x^{n+1}}{n+1}+C\\quad(n\\ne -1)";
}

function evaluateAntiderivative(anti, a, b) {
  try {
    const F = compile(anti);
    return F(b) - F(a);
  } catch (_) {
    return NaN;
  }
}

function fractionValueText(value) {
  return fractionApproxText(value, 1000, 1e-10);
}

function valueTex(value) {
  const fraction = fractionValueText(value);
  return fraction ? exprToLatex(fraction) : fmt(value, 8);
}

function renderSolverSummary(rule, exactTex, decimal, partial) {
  const summary = $("solverSummary");
  if (!summary) return;
  const fraction = Number.isFinite(decimal) ? fractionValueText(decimal) : "";
  const fractionHtml = fraction
    ? `<div><span>Fraccion</span><b class="summary-math">${mathToString(exprToLatex(fraction), false)}</b></div>`
    : "";
  const partialHtml = partial
    ? `<div><span>Fracción parcial</span><b class="summary-math">${mathToString(exprToLatex(partial.dec), false)}</b></div>`
    : "";
  summary.innerHTML = `
    <div><span>Regla usada</span><b>${rule}</b></div>
    <div><span>Resultado exacto</span><b class="summary-math">${mathToString(exactTex, false)}</b></div>
    <div><span>Decimal</span><b>${Number.isFinite(decimal) ? fmt(decimal, 8) : "Sin límites definidos"}</b></div>
    ${fractionHtml}
    ${partialHtml}`;
}

function solveIntegralAdvanced() {
  const expr = $("integralExpr").value;
  const aText = $("integralA").value.trim();
  const bText = $("integralB").value.trim();
  const result = $("integralResult");
  result.style.color = "";
  updateMathPreviews();

  try {
    const partial = decomposePartial(expr);
    const antiderivative = partial?.intg || integrateSimple(expr);
    const latexExpr = exprToLatex(expr);
    const latexAnti = exprToLatex(antiderivative);
    const rule = integrationRuleName(expr, partial);
    updateMathPreviews();

    if (aText && bText) {
      const fn = compile(expr);
      const a = Number(evaluateBound(aText));
      const b = Number(evaluateBound(bText));
      const symbolicValue = evaluateAntiderivative(antiderivative, a, b);
      const value = Number.isFinite(symbolicValue) ? symbolicValue : simpson(fn, a, b);
      const exactTex = `\\left[${latexAnti}\\right]_{${fmt(a)}}^{${fmt(b)}}`;
      const valueFraction = fractionValueText(value);
      const finalValueTex = valueTex(value);
      const exactWithValueTex = valueFraction ? `${exactTex}=${finalValueTex}` : exactTex;
      renderSolverSummary(rule, exactWithValueTex, value, partial);
      renderMath(result, `\\int_{${fmt(a)}}^{${fmt(b)}}\\!\\left(${latexExpr}\\right)dx=${exactWithValueTex}\\approx ${fmt(value, 8)}`, true);

      const steps = [
        { n: 1, label: "Planteamiento", tex: `\\int_{${fmt(a)}}^{${fmt(b)}}\\!\\left(${latexExpr}\\right)dx`, desc: "Identificamos una integral definida." }
      ];
      if (partial) steps.push(...partial.steps.map((step, index) => ({ n: index + 2, label: step.label, tex: step.tex, desc: step.desc })));
      const n = steps.length + 1;
      steps.push(
        { n, label: "Fórmula usada", tex: formulaForRule(rule), desc: rule },
        { n: n + 1, label: "Antiderivada", tex: `F(x)=${latexAnti}+C`, desc: "Calculamos una primitiva simbólica." },
        { n: n + 2, label: "Evaluación", tex: exactWithValueTex, desc: "Aplicamos el teorema fundamental del cálculo." },
        { n: n + 3, label: "Decimal", tex: `\\approx ${fmt(value, 8)}`, desc: "Valor numérico final." }
      );
      if (valueFraction) {
        steps.splice(steps.length - 1, 0, { n: 0, label: "Fraccion", tex: finalValueTex, desc: "Equivalente fraccionario del resultado." });
        steps.forEach((step, index) => { step.n = index + 1; });
      }
      renderSteps("integralSteps", steps);
    } else {
      const exactTex = `${latexAnti}+C`;
      renderSolverSummary(rule, exactTex, NaN, partial);
      renderMath(result, `\\int\\!\\left(${latexExpr}\\right)dx=${exactTex}`, true);

      const steps = [
        { n: 1, label: "Planteamiento", tex: `\\int\\!\\left(${latexExpr}\\right)dx`, desc: "Identificamos una integral indefinida." }
      ];
      if (partial) steps.push(...partial.steps.map((step, index) => ({ n: index + 2, label: step.label, tex: step.tex, desc: step.desc })));
      const n = steps.length + 1;
      steps.push(
        { n, label: "Fórmula usada", tex: formulaForRule(rule), desc: rule },
        { n: n + 1, label: "Resultado exacto", tex: exactTex, desc: "La constante C representa todas las primitivas." }
      );
      renderSteps("integralSteps", steps);
    }
    animateSteps("#integralSteps");
  } catch (error) {
    if (aText && bText) {
      try {
        const fn = compile(expr);
        const a = Number(evaluateBound(aText));
        const b = Number(evaluateBound(bText));
        const value = simpson(fn, a, b);
        const rule = "Integración numérica por Simpson";
        renderSolverSummary(rule, `\\int_{${fmt(a)}}^{${fmt(b)}} f(x)\\,dx`, value, null);
        renderMath(result, `\\int_{${fmt(a)}}^{${fmt(b)}}\\!\\left(${exprToLatex(expr)}\\right)dx\\approx ${fmt(value, 8)}`, true);
        renderSteps("integralSteps", [
          { n: 1, label: "Sin regla simbólica", tex: `\\int_{${fmt(a)}}^{${fmt(b)}}\\!\\left(${exprToLatex(expr)}\\right)dx`, desc: "No encontré una primitiva exacta con las reglas locales." },
          { n: 2, label: "Fórmula usada", tex: formulaForRule(rule), desc: "Usamos Simpson compuesto para aproximar el área." },
          { n: 3, label: "Decimal", tex: `\\approx ${fmt(value, 8)}`, desc: "Resultado aproximado." }
        ]);
      } catch (inner) {
        result.textContent = `Error: ${inner.message}`;
        result.style.color = "var(--red)";
      }
    } else {
      result.textContent = `Error: ${error.message}`;
      result.style.color = "var(--red)";
      renderSteps("integralSteps", [
        { n: 1, label: "Sin regla", tex: "", desc: "Para indefinidas soporta polinomios, sin, cos, exp, 1/x, sec(x)**2 y fracciones parciales reconocidas. Para funciones generales coloca límites a y b para obtener decimal." }
      ]);
    }
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
    $("importFileInput").click();
    setStatus("Importa texto, imagen o PDF");
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

function parseImportedText(text, fileName = "") {
  const clean = String(text || "").trim();
  if (!clean) throw new Error("El archivo está vacío.");

  if (/\.json$/i.test(fileName) || clean.startsWith("{")) {
    const data = JSON.parse(clean);
    return {
      expr: data.expr || data.expression || data.funcion || data.function,
      a: data.a,
      b: data.b,
      n: data.n,
      method: data.method || data.metodo
    };
  }

  const config = {};
  const lines = clean.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (const line of lines) {
    const match = line.match(/^([a-zA-Z_]\w*)\s*[:=,]\s*(.+)$/);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (["f", "fx", "expr", "expression", "funcion", "function"].includes(key)) config.expr = value;
    if (key === "a") config.a = value;
    if (key === "b") config.b = value;
    if (key === "n") config.n = value;
    if (["method", "metodo"].includes(key)) config.method = value;
  }

  if (!config.expr && lines.length) config.expr = lines[0].replace(/^f\s*\(\s*x\s*\)\s*=/i, "");
  return config;
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

function polygonYIntervalsAtX(x, polygon) {
  const ys = [];
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i];
    const q = polygon[(i + 1) % polygon.length];
    if (Math.abs(p.x - q.x) < 1e-12) continue;
    const minX = Math.min(p.x, q.x);
    const maxX = Math.max(p.x, q.x);
    if (x < minX || x >= maxX) continue;
    const t = (x - p.x) / (q.x - p.x);
    ys.push(p.y + t * (q.y - p.y));
  }
  ys.sort((a, b) => a - b);

  const intervals = [];
  for (let i = 0; i < ys.length - 1; i += 2) {
    if (ys[i + 1] > ys[i]) intervals.push([ys[i], ys[i + 1]]);
  }
  return intervals;
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

  return {
    rects,
    segments: rects.length,
    area: rects.reduce((sum, rect) => sum + rect.area, 0)
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
  ctx.strokeStyle = "rgba(47,128,237,.12)";
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
    ctx.fillStyle = "rgba(47,128,237,.24)";
    ctx.strokeStyle = "rgba(47,128,237,.55)";
    ctx.lineWidth = 1;
    for (const rect of selection.rects) {
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }

    ctx.fillStyle = "rgba(32,164,100,.08)";
    ctx.strokeStyle = "rgba(32,164,100,.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    A4.points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.stroke();
  } else if (A4.points.length > 1) {
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    A4.points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
  }

  A4.points.forEach((point, index) => {
    ctx.fillStyle = "#2f80ed";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1f2937";
    ctx.font = "700 13px Inter, sans-serif";
    ctx.fillText(String(index + 1), point.x + 8, point.y - 8);
  });

  updateA4Metrics(selection);
}

function updateA4Metrics(selection = getA4Selection()) {
  $("a4FileName").textContent = A4.fileName;
  $("a4PointCount").textContent = String(A4.points.length);
  $("a4RectCount").textContent = String(selection.segments);
  $("a4AreaCm").textContent = A4.points.length >= 3 ? `${fmt(selection.area, 3)} cm²` : "0 cm²";
  $("a4PointList").innerHTML = A4.points.length
    ? [
      A4.points.length >= 3
        ? `<div>Riemann punto medio: ${selection.segments} rectángulos · Δx=${fmt(A4.cellCm, 2)} cm</div>`
        : "<div>Marca al menos 3 puntos para cerrar el área.</div>",
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
  if (/decimal|aprox|valor/i.test(question)) return "Para obtener decimal coloca limites a y b. La app evalua la antiderivada si existe; si no, usa Simpson compuesto.";
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
    return { input, fn: STATE.fn, data: STATE.data, exact: STATE.exact, areas: STATE.areas };
  }
  const fn = compile(input.expr);
  return {
    input,
    fn,
    data: riemann(fn, input.a, input.b, input.n, input.method),
    exact: simpson(fn, input.a, input.b),
    areas: signedAreas(fn, input.a, input.b)
  };
}

function buildRiemannSolutionText() {
  try {
    const { input, data, exact, areas } = currentRiemannSnapshot();
    const first = data.rects[0];
    const infinite = $("infinityInput")?.checked;
    const visibleN = infinite ? "n -> infinito" : String(input.manualN);
    const error = Math.abs((infinite ? exact : data.sum) - exact);
    return [
      "Solucion dinamica de la suma de Riemann:",
      `Funcion: f(x)=${linearExpr(input.expr)}.`,
      `Intervalo: [${fmt(input.a)}, ${fmt(input.b)}]. Rectangulos: ${visibleN}. Metodo: ${methodLabel(input.method)}.`,
      `Formula usada: Delta x = (b - a)/n y ${riemannFormulaText(input.method)}.`,
      `Delta x = (${fmt(input.b)} - (${fmt(input.a)}))/${infinite ? "n" : input.manualN} = ${fmt(data.dx)}.`,
      `Primer rectangulo: [${fmt(first.p)}, ${fmt(first.q)}], x_1* = ${fmt(first.sample)}, f(x_1*) = ${fmt(first.y)}, area_1 = ${fmt(first.area)}.`,
      valueLine(infinite ? exact : data.sum, "Suma"),
      valueLine(exact, "Integral de referencia"),
      `Error: ${fmt(error, 8)}.`,
      `Area positiva: ${fmt(areas.pos, 8)}. Area negativa: ${fmt(areas.neg, 8)}. Area total: ${fmt(areas.total, 8)}.`
    ].join("\n");
  } catch (error) {
    return `No pude resolver la suma de Riemann: ${error.message}`;
  }
}

function linearRuleFormula(rule) {
  const cleanRule = normalizeQueryText(rule);
  if (cleanRule.includes("fracciones parciales")) return "A/(x - r1) + B/(x - r2); integral k/(x - r) dx = k*ln(abs(x - r)) + C";
  if (cleanRule.includes("por partes")) return "integral ln(x) dx = x*ln(abs(x)) - x + C";
  if (cleanRule.includes("arcotangente")) return "integral 1/(1 + x^2) dx = atan(x) + C";
  if (cleanRule.includes("logaritmica")) return "integral u'/u dx = ln(abs(u)) + C";
  if (cleanRule.includes("trigonometrica")) return "integral sin(x) dx = -cos(x) + C; integral cos(x) dx = sin(x) + C";
  if (cleanRule.includes("exponencial")) return "integral exp(x) dx = exp(x) + C";
  if (cleanRule.includes("simpson")) return "Simpson compuesto: area aprox. = h/3*(f(x0)+4*f(x1)+2*f(x2)+...+f(xn))";
  return "integral x^n dx = x^(n + 1)/(n + 1) + C, con n != -1";
}

function buildIntegralSolutionText() {
  const expr = $("integralExpr")?.value || "";
  const aText = $("integralA")?.value.trim() || "";
  const bText = $("integralB")?.value.trim() || "";
  const hasBounds = Boolean(aText && bText);

  try {
    const partial = decomposePartial(expr);
    const antiderivative = partial?.intg || integrateSimple(expr);
    const rule = integrationRuleName(expr, partial);
    const lines = [
      "Solucion dinamica de la integral:",
      `Integrando: ${linearExpr(expr)}.`,
      `Formula usada: ${linearRuleFormula(rule)}.`,
      `Regla detectada: ${rule}.`
    ];
    if (partial) lines.push(`Fraccion parcial: ${linearExpr(partial.dec)}.`);
    lines.push(`Antiderivada: F(x) = ${linearExpr(antiderivative)} + C.`);

    if (hasBounds) {
      const a = Number(evaluateBound(aText));
      const b = Number(evaluateBound(bText));
      const symbolicValue = evaluateAntiderivative(antiderivative, a, b);
      const value = Number.isFinite(symbolicValue) ? symbolicValue : simpson(compile(expr), a, b);
      lines.push(`Evaluacion exacta: F(${fmt(b)}) - F(${fmt(a)}).`);
      lines.push(valueLine(value, "Integral definida"));
    } else {
      lines.push("Decimal: sin limites definidos. Si colocas a y b, calculo el valor decimal.");
    }

    if (partial?.steps?.length) {
      lines.push("Procedimiento:");
      partial.steps.forEach((step, index) => {
        lines.push(`${index + 1}. ${step.label}: ${step.desc}`);
      });
    } else {
      lines.push("Procedimiento: identificar la regla, integrar termino a termino y sumar la constante C.");
    }
    return lines.join("\n");
  } catch (error) {
    if (hasBounds) {
      try {
        const a = Number(evaluateBound(aText));
        const b = Number(evaluateBound(bText));
        const value = simpson(compile(expr), a, b);
        return [
          "No encontre primitiva simbolica local para esta forma.",
          "Use integracion numerica por Simpson compuesto.",
          `Integrando: ${linearExpr(expr)}. Intervalo: [${fmt(a)}, ${fmt(b)}].`,
          valueLine(value, "Integral aproximada")
        ].join("\n");
      } catch (inner) {
        return `No pude resolver la integral: ${inner.message}`;
      }
    }
    return `No pude resolver esta indefinida con las reglas locales: ${error.message}. Prueba con limites a y b para decimal por Simpson.`;
  }
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
  if (!config.endpoint && !config.apiKey && !config.model) {
    try { config = JSON.parse(localStorage.getItem(NVIDIA_CONFIG_KEY) || "{}"); } catch (_) {}
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
    const answer = await askAi(buildUnifiedAiQuestion(question, key), "Eres la unica IA configurada desde el panel Asistente de Dev_Aldah_V3. Usa el contexto de la seccion activa y responde solo en espanol claro, directo y con pasos cortos. Escribe las matematicas en formato lineal: usa 3/2, (x + 5)/(x^2 + 3*x + 2) y parentesis solo cuando eviten ambiguedad. No uses LaTeX ni fracciones verticales.", { maxTokens: 700, temperature: 0.2, topP: 0.8 });
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
    const answer = await askAi(buildUnifiedAiQuestion(question, key), "Eres la unica IA configurada desde el panel Asistente de Dev_Aldah_V3. Responde solo en espanol claro, breve y paso a paso. Escribe las matematicas en formato lineal: usa 3/2, (x + 5)/(x^2 + 3*x + 2) y parentesis solo cuando eviten ambiguedad. No uses LaTeX ni fracciones verticales.", { maxTokens: 900, temperature: 0.2, topP: 0.8 });
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
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
  $("nvidiaConfigStatus").textContent = config.apiKey
    ? `IA unica guardada (${aiProviderLabel(config)}). Asistente y secciones usan esta misma API.`
    : "Guarde endpoint/modelo. Falta la API key unica.";
  updateUnifiedAiIndicators();
}

function clearNvidiaConfig() {
  localStorage.removeItem(AI_CONFIG_KEY);
  localStorage.removeItem(NVIDIA_CONFIG_KEY);
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
    .forEach(id => $(id).addEventListener("input", updateAll));

  $("nInput").addEventListener("input", () => {
    $("nRange").value = clampN($("nInput").value);
    updateAll();
  });
  $("nRange").addEventListener("input", () => {
    $("nInput").value = $("nRange").value;
    updateAll();
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
      Plotly.downloadImage("plotlyGraph", { format: "png", width: 1600, height: 900, filename: "integral_studio" });
    }
  });

  $("integralSolveBtn").addEventListener("click", solveIntegralAdvanced);
  ["integralExpr", "integralA", "integralB"].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("focus", event => { activeMathInput = event.target; });
    el.addEventListener("input", updateMathPreviews);
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
    cycleExample("integralExpr", ["4/x - 3/x**2", "x**2", "sin(x)", "(x + 5)/(x**2 + 3*x + 2)", "(2*x + 3)/(x**2 + 4)"]);
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

  window.addEventListener("resize", () => {
    try { drawGraph(readInputs()); } catch (_) {}
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
      <span class="wm-icon">∫</span>
      <div>
        <strong>Dev_Aldah_V3 · Asistente IA</strong>
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
    
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
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
.wm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem}
.wm-card{background:var(--surface,#1e2330);border:1px solid var(--border,rgba(255,255,255,.09));border-radius:1.1rem;padding:2rem;max-width:480px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,.5);animation:wmIn .25s cubic-bezier(.34,1.56,.64,1)}
@keyframes wmIn{from{opacity:0;transform:scale(.9) translateY(12px)}to{opacity:1;transform:none}}
.wm-header{display:flex;gap:1rem;align-items:flex-start;margin-bottom:1.5rem}
.wm-icon{font-size:2.2rem;line-height:1;color:var(--accent,#7c3aed)}
.wm-header strong{display:block;font-size:1.05rem;color:var(--text,#f1f5f9)}
.wm-header p{font-size:.82rem;color:var(--muted,#94a3b8);margin:.2rem 0 0}
.wm-body{display:flex;flex-direction:column;gap:1rem}
.wm-step{display:flex;gap:.9rem;align-items:flex-start}
.wm-num{flex-shrink:0;width:1.6rem;height:1.6rem;border-radius:50%;background:var(--accent,#7c3aed);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.8rem}
.wm-step b{display:block;font-size:.88rem;color:var(--text,#f1f5f9);margin-bottom:.2rem}
.wm-step p,.wm-step a{font-size:.82rem;color:var(--muted,#94a3b8)}
.wm-step a{color:var(--accent,#7c3aed);text-decoration:underline}
.wm-input{width:100%;margin-top:.35rem;padding:.55rem .8rem;border-radius:.55rem;border:1px solid var(--border,rgba(255,255,255,.12));background:var(--surface2,#111827);color:var(--text,#f1f5f9);font-family:"JetBrains Mono",monospace;font-size:.85rem;outline:none}
.wm-input:focus{border-color:var(--accent,#7c3aed)}
.wm-status{font-size:.82rem;min-height:1.2em;font-weight:500;transition:color .2s}
.wm-footer{display:flex;gap:.7rem;margin-top:1.5rem;flex-wrap:wrap}
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
  banner.innerHTML = `<span>El Asistente IA necesita configuración.</span><button type="button" id="noKeySetupBtn">Configurar gratis →</button>`;
  banner.style.cssText = "position:fixed;bottom:1rem;left:50%;transform:translateX(-50%);background:var(--surface,#1e2330);border:1px solid var(--accent,#7c3aed);border-radius:2rem;padding:.5rem 1.1rem;display:flex;align-items:center;gap:.8rem;font-size:.82rem;color:var(--muted,#94a3b8);z-index:900;box-shadow:0 8px 24px rgba(0,0,0,.4);white-space:nowrap";
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
  injectNoKeyBanner();
  maybeShowWelcomeModal();
}

init();
