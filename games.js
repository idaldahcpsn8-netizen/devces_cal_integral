"use strict";

/*
 * Juegos de Yos_Sphere: bancos de preguntas y generadores de rondas.
 * Sin DOM; en Node se exporta para verificar con pruebas que cada respuesta
 * correcta lo es (y que los distractores no lo son).
 */

const YosGames = (() => {
  const Core = typeof IntegralCore !== "undefined" ? IntegralCore : require("./integral_core.js");

  const ROUND_SIZE = 10;

  const METHOD_OPTIONS = ["Integración inmediata", "Fracciones parciales", "Cambio de variable", "Integración por partes"];
  const DERIVATIVE_OPTIONS = ["Potencia", "Producto", "Cociente", "Cadena"];

  // Elige el método de integración.
  const METHOD_ITEMS = [
    { tex: "\\int x^{2}\\,dx", answer: "Integración inmediata", result: "\\frac{x^{3}}{3}+C", why: "Regla de la potencia: se suma 1 al exponente y se divide entre el nuevo exponente." },
    { tex: "\\int \\cos x\\,dx", answer: "Integración inmediata", result: "\\sin x+C", why: "Es una integral de la tabla: la derivada de sin x es cos x." },
    { tex: "\\int e^{x}\\,dx", answer: "Integración inmediata", result: "e^{x}+C", why: "La exponencial es su propia derivada." },
    { tex: "\\int \\frac{1}{x}\\,dx", answer: "Integración inmediata", result: "\\ln|x|+C", why: "Integral logarítmica de la tabla." },
    { tex: "\\int \\ln x\\,dx", answer: "Integración por partes", result: "x\\ln x-x+C", why: "Con u = ln x y dv = dx, la integral restante es inmediata." },
    { tex: "\\int x\\,e^{x}\\,dx", answer: "Integración por partes", result: "x\\,e^{x}-e^{x}+C", why: "u = x se simplifica al derivar; dv = eˣ dx se integra fácil." },
    { tex: "\\int x\\sin x\\,dx", answer: "Integración por partes", result: "\\sin x-x\\cos x+C", why: "u = x y dv = sin x dx: el polinomio desaparece al derivar." },
    { tex: "\\int x^{2}\\ln x\\,dx", answer: "Integración por partes", result: "\\frac{x^{3}}{3}\\ln x-\\frac{x^{3}}{9}+C", why: "u = ln x y dv = x² dx." },
    { tex: "\\int \\frac{x+5}{x^{2}+3x+2}\\,dx", answer: "Fracciones parciales", result: "4\\ln|x+1|-3\\ln|x+2|+C", why: "El denominador factoriza como (x + 1)(x + 2)." },
    { tex: "\\int \\frac{1}{x^{2}-1}\\,dx", answer: "Fracciones parciales", result: "\\frac{1}{2}\\ln\\left|\\frac{x-1}{x+1}\\right|+C", why: "x² − 1 = (x − 1)(x + 1): se separa en dos fracciones simples." },
    { tex: "\\int \\frac{3}{(x-1)(x+2)}\\,dx", answer: "Fracciones parciales", result: "\\ln|x-1|-\\ln|x+2|+C", why: "Se escribe como A/(x − 1) + B/(x + 2) con A = 1 y B = −1." },
    { tex: "\\int 2x\\cos(x^{2})\\,dx", answer: "Cambio de variable", result: "\\sin(x^{2})+C", why: "Con u = x², du = 2x dx aparece completo." },
    { tex: "\\int \\frac{x}{x^{2}+1}\\,dx", answer: "Cambio de variable", result: "\\frac{1}{2}\\ln(x^{2}+1)+C", why: "u = x² + 1, du = 2x dx: queda ½ ∫ du/u." },
    { tex: "\\int \\frac{e^{x}}{1+e^{x}}\\,dx", answer: "Cambio de variable", result: "\\ln(1+e^{x})+C", why: "u = 1 + eˣ y du = eˣ dx." }
  ];

  // Elige la regla de derivación principal.
  const DERIVATIVE_ITEMS = [
    { tex: "\\frac{d}{dx}\\,x^{5}", answer: "Potencia", result: "5x^{4}", why: "d/dx xⁿ = n·xⁿ⁻¹." },
    { tex: "\\frac{d}{dx}\\,x^{-3}", answer: "Potencia", result: "-3x^{-4}", why: "La regla de la potencia también vale para exponentes negativos." },
    { tex: "\\frac{d}{dx}\\left(x^{2}\\sin x\\right)", answer: "Producto", result: "2x\\sin x+x^{2}\\cos x", why: "(uv)' = u'v + uv' con u = x² y v = sin x." },
    { tex: "\\frac{d}{dx}\\left(x\\,e^{x}\\right)", answer: "Producto", result: "e^{x}(x+1)", why: "(uv)' = u'v + uv' con u = x y v = eˣ." },
    { tex: "\\frac{d}{dx}\\left(x^{3}\\ln x\\right)", answer: "Producto", result: "3x^{2}\\ln x+x^{2}", why: "Producto de x³ por ln x." },
    { tex: "\\frac{d}{dx}\\,\\frac{x+1}{x-1}", answer: "Cociente", result: "\\frac{-2}{(x-1)^{2}}", why: "(u/v)' = (u'v − uv')/v²." },
    { tex: "\\frac{d}{dx}\\,\\frac{\\sin x}{x}", answer: "Cociente", result: "\\frac{x\\cos x-\\sin x}{x^{2}}", why: "Cociente de sin x entre x." },
    { tex: "\\frac{d}{dx}\\,\\frac{x^{2}}{x+1}", answer: "Cociente", result: "\\frac{x^{2}+2x}{(x+1)^{2}}", why: "(u/v)' con u = x² y v = x + 1." },
    { tex: "\\frac{d}{dx}\\,\\sin(x^{2})", answer: "Cadena", result: "2x\\cos(x^{2})", why: "Función externa sin(u) con u = x²." },
    { tex: "\\frac{d}{dx}\\,\\sqrt{x+1}", answer: "Cadena", result: "\\frac{1}{2\\sqrt{x+1}}", why: "Raíz de una función interna." },
    { tex: "\\frac{d}{dx}\\,e^{x^{3}}", answer: "Cadena", result: "3x^{2}e^{x^{3}}", why: "Exponencial de u = x³: se multiplica por u' = 3x²." },
    { tex: "\\frac{d}{dx}\\,\\ln(\\cos x)", answer: "Cadena", result: "-\\tan x", why: "ln(u) con u = cos x: u'/u = −sin x / cos x." }
  ];

  // ¿Cuál es la primitiva? Las opciones están escritas en el formato de la app
  // para poder verificarlas: F'(x) debe ser igual al integrando solo en la correcta.
  const PRIMITIVE_ITEMS = [
    { integrand: "x^3", correct: "x^4/4", distractors: ["3x^2", "x^4", "x^4/3"], why: "Potencia: xⁿ⁺¹/(n + 1)." },
    { integrand: "cos(x)", correct: "sin(x)", distractors: ["-sin(x)", "-cos(x)", "tan(x)"], why: "La derivada de sin x es cos x." },
    { integrand: "exp(2x)", correct: "exp(2x)/2", distractors: ["2exp(2x)", "exp(2x)", "exp(2x+1)/(2x+1)"], why: "Cambio lineal: se divide entre el coeficiente de x." },
    { integrand: "1/x", correct: "ln(abs(x))", distractors: ["-1/x^2", "ln(x^2)", "x^0/0.5"], why: "Integral logarítmica: ∫ dx/x = ln|x|." },
    { integrand: "2x*cos(x^2)", correct: "sin(x^2)", distractors: ["cos(x^2)", "x^2*sin(x^2)", "-sin(x^2)"], why: "Con u = x², du = 2x dx." },
    { integrand: "x*exp(x)", correct: "x*exp(x) - exp(x)", distractors: ["x*exp(x) + exp(x)", "x^2*exp(x)/2", "exp(x)"], why: "Por partes con u = x y dv = eˣ dx." },
    { integrand: "1/(1+x^2)", correct: "atan(x)", distractors: ["ln(1+x^2)", "asin(x)", "-1/(1+x^2)^2"], why: "Es la derivada de arctan x." },
    { integrand: "sec(x)^2", correct: "tan(x)", distractors: ["sec(x)^3/3", "-tan(x)", "2sec(x)*tan(x)"], why: "La derivada de tan x es sec² x." },
    { integrand: "sqrt(x)", correct: "2/3*x^(3/2)", distractors: ["1/(2sqrt(x))", "3/2*x^(3/2)", "x^(3/2)"], why: "√x = x^(1/2): se suma 1 al exponente." },
    { integrand: "sin(3x)", correct: "-cos(3x)/3", distractors: ["cos(3x)/3", "-3cos(3x)", "-cos(3x)"], why: "∫ sin(ax) dx = −cos(ax)/a." },
    { integrand: "ln(x)", correct: "x*ln(x) - x", distractors: ["1/x", "x*ln(x)", "ln(x)^2/2"], why: "Por partes con u = ln x y dv = dx." },
    { integrand: "1/(x+2)", correct: "ln(abs(x+2))", distractors: ["-1/(x+2)^2", "ln(abs(x))+2", "(x+2)^2/2"], why: "∫ du/u con u = x + 2." },
    { integrand: "3x^2 + 2x", correct: "x^3 + x^2", distractors: ["6x + 2", "x^3 + 2x^2", "3x^3 + x^2"], why: "Se integra término a término con la regla de la potencia." },
    { integrand: "exp(x)*cos(exp(x))", correct: "sin(exp(x))", distractors: ["cos(exp(x))", "exp(x)*sin(exp(x))", "-sin(exp(x))"], why: "Con u = eˣ, du = eˣ dx." }
  ];

  // Estima el área: funciones positivas en intervalos donde el área se ve bien.
  const AREA_FUNCTIONS = [
    { expr: "x^2", bounds: [[0, 2], [0, 3], [1, 3]] },
    { expr: "sin(x) + 1", bounds: [[0, 3], [0, 4], [1, 5]] },
    { expr: "sqrt(x)", bounds: [[0, 4], [1, 4], [0, 9]] },
    { expr: "4 - x^2", bounds: [[-2, 2], [0, 2], [-1, 1]] },
    { expr: "exp(x/2)", bounds: [[0, 2], [0, 3], [-1, 2]] },
    { expr: "2x + 1", bounds: [[0, 3], [1, 4], [0, 2]] },
    { expr: "1/x", bounds: [[1, 3], [1, 5], [0.5, 2]] },
    { expr: "x^3/4 + 1", bounds: [[0, 2], [-1, 2], [0, 3]] },
    { expr: "cos(x) + 2", bounds: [[0, 3], [-1, 2], [0, 6]] }
  ];

  function shuffle(list, rng = Math.random) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function choice(list, rng = Math.random) {
    return list[Math.floor(rng() * list.length)];
  }

  // Tres distractores numéricos plausibles y bien separados del valor real.
  function areaDistractors(value, width, rng = Math.random) {
    const candidates = shuffle([
      value * 0.5, value * 1.5, value * 2, value * 0.7, value * 1.35,
      value + width, value - width / 2, value + 1, value - 1, value * 0.6
    ], rng);
    const picked = [];
    const separated = (a, b) => Math.abs(a - b) > 0.12 * Math.max(1, Math.abs(value));
    for (const c of candidates) {
      if (!(c > 0)) continue;
      const rounded = Number(c.toFixed(2));
      if (!separated(rounded, value)) continue;
      if (picked.some(p => !separated(p, rounded))) continue;
      picked.push(rounded);
      if (picked.length === 3) break;
    }
    return picked;
  }

  function areaQuestion(rng = Math.random) {
    const f = choice(AREA_FUNCTIONS, rng);
    const [a, b] = choice(f.bounds, rng);
    const fn = Core.compile(f.expr);
    const value = Core.integrateNumeric(fn, a, b).value;
    const correct = Number(value.toFixed(2));
    const options = shuffle([correct, ...areaDistractors(value, b - a, rng)], rng);
    return {
      kind: "Estima el área",
      prompt: "¿Cuánto mide el área sombreada?",
      questionTex: `\\int_{${Core.fmt(a)}}^{${Core.fmt(b)}}\\left(${Core.exprToLatex(f.expr)}\\right)dx`,
      art: { expr: f.expr, a, b },
      options: options.map(v => ({ id: String(v), text: Core.fmt(v, 2) })),
      correctId: String(correct),
      explainTex: `\\int_{${Core.fmt(a)}}^{${Core.fmt(b)}}\\left(${Core.exprToLatex(f.expr)}\\right)dx\\approx ${Core.fmt(value, 4)}`,
      why: "El área bajo una curva positiva es su integral definida. Compara con un rectángulo: base × altura promedio."
    };
  }

  function choiceQuestion(item, kind, prompt, options) {
    return {
      kind,
      prompt,
      questionTex: item.tex,
      options: options.map(text => ({ id: text, text })),
      correctId: item.answer,
      explainTex: `${item.tex}=${item.result}`,
      why: item.why
    };
  }

  function primitiveQuestion(item, rng = Math.random) {
    const options = shuffle([item.correct, ...item.distractors], rng);
    return {
      kind: "¿Cuál es la primitiva?",
      prompt: "Elige F(x) tal que F′(x) sea el integrando.",
      questionTex: `\\int ${Core.exprToLatex(item.integrand)}\\,dx`,
      options: options.map(expr => ({ id: expr, tex: `${Core.exprToLatex(expr)}+C` })),
      correctId: item.correct,
      explainTex: `\\int ${Core.exprToLatex(item.integrand)}\\,dx=${Core.exprToLatex(item.correct)}+C`,
      why: item.why
    };
  }

  const MODES = {
    methods: { label: "Métodos", title: "Métodos de integración", size: () => METHOD_ITEMS.length },
    derivatives: { label: "Derivadas", title: "Reglas de derivación", size: () => DERIVATIVE_ITEMS.length },
    primitives: { label: "Primitivas", title: "¿Cuál es la primitiva?", size: () => PRIMITIVE_ITEMS.length },
    area: { label: "Área", title: "Estima el área", size: () => ROUND_SIZE }
  };

  // Una ronda: hasta 10 preguntas en orden aleatorio, sin repetir dentro de la ronda.
  function makeRound(mode, rng = Math.random) {
    if (mode === "area") return Array.from({ length: ROUND_SIZE }, () => areaQuestion(rng));
    if (mode === "derivatives") {
      return shuffle(DERIVATIVE_ITEMS, rng).slice(0, ROUND_SIZE)
        .map(item => choiceQuestion(item, "Reglas de derivación", "¿Qué regla aplicas primero?", shuffle(DERIVATIVE_OPTIONS, rng)));
    }
    if (mode === "primitives") return shuffle(PRIMITIVE_ITEMS, rng).slice(0, ROUND_SIZE).map(item => primitiveQuestion(item, rng));
    return shuffle(METHOD_ITEMS, rng).slice(0, ROUND_SIZE)
      .map(item => choiceQuestion(item, "Métodos de integración", "¿Con qué método se resuelve?", shuffle(METHOD_OPTIONS, rng)));
  }

  return {
    ROUND_SIZE,
    MODES,
    METHOD_OPTIONS,
    DERIVATIVE_OPTIONS,
    METHOD_ITEMS,
    DERIVATIVE_ITEMS,
    PRIMITIVE_ITEMS,
    AREA_FUNCTIONS,
    shuffle,
    areaDistractors,
    areaQuestion,
    makeRound
  };
})();

if (typeof module === "object" && module.exports) {
  module.exports = YosGames;
}
