"use strict";

// Pruebas del núcleo matemático: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../integral_core.js");

const close = (actual, expected, tolerance = 1e-8, message = "") => {
  const scale = Math.max(1, Math.abs(expected));
  assert.ok(Math.abs(actual - expected) <= tolerance * scale, `${message} esperado ${expected}, obtenido ${actual}`);
};

test("el analizador respeta la precedencia matemática", () => {
  const at = (expr, x) => C.compile(expr)(x);
  assert.equal(at("-x^2", 3), -9);
  assert.equal(at("-x**2", 3), -9);
  assert.equal(at("2^3^2", 0), 512);
  assert.equal(at("2^-1", 0), 0.5);
  assert.equal(at("1/2x", 4), 2);
  assert.equal(at("x/2/2", 8), 2);
  assert.equal(at("(x+1)(x-1)", 3), 8);
  assert.equal(at("x(x+1)", 2), 6);
  close(at("2sin(x)", 1), 2 * Math.sin(1));
  close(at("sinx", 1), Math.sin(1));
  close(at("sin 2x", 1), Math.sin(2));
  close(at("sin^2(x) + cos^2(x)", 0.7), 1);
  close(at("sen(x) + tg(x)", 0.3), Math.sin(0.3) + Math.tan(0.3));
  close(at("ln(x)", Math.E), 1);
  close(at("log10(x)", 1000), 3);
  close(at("π·x + √x", 4), 4 * Math.PI + 2);
  assert.equal(at("x²", 3), 9);
  assert.equal(at("|x-3|", 1), 2);
  assert.equal(at("max(x,1)", 0.5), 1);
  assert.equal(at("max(x, 1)", 4), 4);
  close(at("1e-3*x", 2), 0.002);
  close(at("2e^x", 0), 2);
  close(at("xsin(x)", 1), Math.sin(1));
  assert.equal(at("f(x) = x + 1", 1), 2);
});

test("potencias reales de base negativa", () => {
  close(C.compile("(-8)^(1/3)")(0), -2);
  close(C.compile("cbrt(x)")(-27), -3);
  close(C.compile("x^(2/3)")(-8), 4);
  assert.ok(Number.isNaN(C.compile("x^(1/2)")(-4)));
});

test("los errores de sintaxis se explican en español", () => {
  const cases = {
    "": /Escribe una función/,
    "x+*2": /Falta un término antes de «\*»/,
    "(x+1": /Falta cerrar un paréntesis/,
    "x)": /Sobra un paréntesis/,
    "sin()": /necesita un argumento/,
    "x^": /Falta un término después de «\^»/,
    "|x": /valor absoluto/,
    "y + 1": /Símbolo desconocido: «y»/,
    "3 $ x": /Carácter no válido/,
    "sin(x, 2)": /un solo argumento/,
    "constructor": /Símbolo desconocido/
  };
  for (const [expr, pattern] of Object.entries(cases)) {
    assert.throws(() => C.compile(expr), pattern, expr);
  }
});

test("normalize produce texto canónico re-analizable", () => {
  assert.equal(C.normalize("2x^2 - 3x + 1"), "2*x**2-3*x+1");
  assert.equal(C.normalize("(x + 5)/(x^2 + 3x + 2)"), "(x+5)/(x**2+3*x+2)");
  assert.equal(C.normalize("max(x,1)"), "max(x,1)");
  assert.equal(C.normalize("-x^2"), "-x**2");
  assert.equal(C.normalize("2^-1"), "2**(-1)");
  for (const expr of ["sin(x)^2/(1+x)", "-(x-1)^3", "e^(-x^2)", "1/2*x**2"]) {
    const f = C.compile(expr);
    const g = C.compile(C.normalize(expr));
    for (const x of [0.3, 1.7, -0.4]) close(g(x), f(x), 1e-12, expr);
  }
});

test("LaTeX y formato lineal respetan la asociatividad", () => {
  assert.equal(C.exprToLatex("1/2*x**2"), "\\frac{1}{2}\\,x^{2}");
  assert.equal(C.exprToLatex("(x+5)/(x**2+3*x+2)"), "\\frac{x+5}{x^{2}+3x+2}");
  assert.equal(C.exprToLatex("sin(x)^2"), "\\sin^{2}\\left(x\\right)");
  assert.equal(C.exprToLatex("e^(-x)"), "e^{-x}");
  assert.equal(C.linearExpr("1/2*x**2 - 3*log(abs(x+2))"), "1/2*x^2 - 3*ln(abs(x + 2))");
  assert.equal(C.linearExpr("(x + 5)/(x**2 + 3*x + 2)"), "(x + 5)/(x^2 + 3*x + 2)");
});

test("sumas de Riemann con valores conocidos", () => {
  const x = C.compile("x");
  assert.equal(C.riemann(x, 0, 1, 4, "left").sum, 0.375);
  assert.equal(C.riemann(x, 0, 1, 4, "right").sum, 0.625);
  close(C.riemann(C.compile("x^2"), 0, 1, 2, "right").sum, 0.625);
  close(C.riemann(C.compile("x^2"), 0, 1, 2, "midpoint").sum, 0.3125);
  close(C.riemann(x, 1, 0, 4, "left").sum, -0.625, 1e-12, "intervalo invertido");
  const withHole = C.riemann(C.compile("1/x"), -1, 1, 2, "left");
  assert.equal(withHole.invalid, 1, "x=0 es una muestra no definida");
  const big = C.riemann(C.compile("sin(x)"), 0, Math.PI, 20000, "midpoint");
  close(big.sum, 2, 1e-8);
});

test("integración numérica precisa en funciones suaves y no suaves", () => {
  const value = (expr, a, b) => C.integrateNumeric(C.compile(expr), a, b);
  close(value("x^2", 0, 1).value, 1 / 3, 1e-12);
  close(value("sin(x)", 0, Math.PI).value, 2, 1e-12);
  close(value("exp(x)", 0, 1).value, Math.E - 1, 1e-12);
  close(value("abs(x-0.3)", 0, 1).value, 0.29, 1e-10);
  close(value("floor(x)", 0, 5).value, 10, 1e-9);
  close(value("sin(50x)^2", 0, Math.PI).value, Math.PI / 2, 1e-9);
  close(value("x", 2, 1).value, -1.5, 1e-12);
  close(value("sin(x)/x", 0, Math.PI).value, 1.851937051982466, 1e-9);
  assert.equal(value("sin(x)/x", 0, Math.PI).status, "ok", "singularidad evitable");
});

test("integrales impropias convergentes", () => {
  const check = (expr, a, b, expected) => {
    const result = C.integrateNumeric(C.compile(expr), a, b);
    assert.equal(result.status, "improper", `${expr} en [${a}, ${b}]`);
    close(result.value, expected, 1e-7, expr);
  };
  check("1/sqrt(x)", 0, 1, 2);
  check("log(x)", 0, 1, -1);
  check("1/sqrt(abs(x))", -1, 1, 4);
  check("exp(-x)", 0, Infinity, 1);
  check("1/x^2", 1, Infinity, 1);
  check("1/(1+x^2)", -Infinity, Infinity, Math.PI);
  check("exp(-x^2)", -Infinity, Infinity, Math.sqrt(Math.PI));
});

test("integrales divergentes o no definidas no devuelven un número falso", () => {
  const status = (expr, a, b) => C.integrateNumeric(C.compile(expr), a, b);
  for (const [expr, a, b] of [["1/x", -1, 2], ["1/x^2", -1, 1], ["1/x", 0, 1], ["1/x", 1, Infinity], ["tan(x)", 0, 2], ["1/(x-1)^2", 0, 2], ["sin(x)", 0, Infinity]]) {
    const result = status(expr, a, b);
    assert.equal(result.status, "divergent", `${expr} en [${a}, ${b}]`);
    assert.ok(Number.isNaN(result.value));
  }
  const tan = status("tan(x)", 0, 2);
  close(tan.singularities[0], Math.PI / 2, 1e-6);
  assert.equal(status("sqrt(x)", -1, 1).status, "undefined");
});

test("áreas positiva, negativa y total", () => {
  const { areas } = C.analyzeIntegral(C.compile("sin(x)"), 0, 2 * Math.PI);
  close(areas.pos, 2, 1e-9);
  close(areas.neg, -2, 1e-9);
  close(areas.total, 4, 1e-9);
  close(areas.net, 0, 1e-9);
  const { areas: line } = C.analyzeIntegral(C.compile("x"), -1, 1);
  close(line.pos, 0.5, 1e-10);
  close(line.total, 1, 1e-10);
});

// Cada primitiva debe cumplir F'(x) = f(x) y F(b) - F(a) = ∫ f en un tramo regular.
const SYMBOLIC_CASES = [
  ["x^2", 0.2, 1.9], ["2x^2-3x+1", -1, 2], ["x(x+1)", 0, 2], ["pi", 0, 1], ["1/2", 0, 3],
  ["exp(-x)", 0, 2], ["e^x", 0, 1], ["2^x", 0, 2], ["sin(2*x+1)", 0, 1], ["(2*x+1)^3", 0, 1],
  ["1/x^2", 0.5, 2], ["4/x - 3/x**2", 0.5, 3], ["cos(x)^2", 0, 2], ["sin^2(x)", 0, 2], ["tan(x)^2", 0, 1],
  ["x*exp(x)", 0, 1], ["x^2*sin(x)", 0, 2], ["x^3*exp(2x)", 0, 1], ["1/(2*x+1)", 0, 2], ["sqrt(2*x+1)", 0, 2],
  ["x*sqrt(x^2+1)", 0, 2], ["2*x*cos(x^2)", 0, 1], ["log(x)", 0.5, 2], ["x*log(x)", 0.5, 2], ["ln(x)/x", 0.5, 2],
  ["tan(x)", 0, 1], ["sec(x)^2", 0, 1], ["sec(x)*tan(x)", 0, 1], ["sec(x)", 0, 1], ["csc(x)", 0.5, 2],
  ["1/(1+x^2)", -1, 2], ["1/(x^2+4)", 0, 2], ["1/sqrt(1-x^2)", -0.5, 0.5], ["sqrt(1-x^2)", -0.9, 0.9], ["1/sqrt(x^2+1)", 0, 2],
  ["sqrt(x^2+4)", 0, 2], ["1/sqrt(4-x^2)", 0, 1], ["(x+5)/(x^2+3x+2)", 0, 1], ["(x^3+1)/(x^2-1)", 2, 3], ["1/(x^3-x)", 2, 3],
  ["1/(x^4-1)", 2, 3], ["(3x+5)/(x-1)^2", 2, 3], ["1/(x-1)^3", 2, 3], ["(x^2+1)/(x^2+2x+5)", 0, 1], ["1/((x-1)^2*(x+2))", 2, 3],
  ["exp(x)*sin(x)", 0, 1], ["exp(2x)*cos(3x)", 0, 1], ["sin(3x)*cos(x)", 0, 1], ["sin(x)*sin(2x)", 0, 1], ["exp(x)/(1+exp(x))", 0, 1],
  ["atan(x)", 0, 1], ["x*atan(x)", 0, 1], ["asin(x)", 0, 0.5], ["acos(x)", 0, 0.5], ["abs(x)", -1, 2],
  ["|x-1|", 0, 3], ["x/(x^2+1)", 0, 2], ["(x+1)/(x-1)", 2, 3], ["1/(x*log(x))", 2, 3], ["sin(x)^3*cos(x)", 0, 1],
  ["cosh(2x)", 0, 1], ["sinh(x)", 0, 1], ["tanh(x)", 0, 1], ["x^(1/3)", 0.1, 2], ["(x^2+1)/sqrt(x)", 0.5, 2],
  ["sqrt(x)*x", 0, 2], ["cos(x)*exp(sin(x))", 0, 1], ["1/(x^2+2x+5)", 0, 1], ["(2x+3)/(x^2+4)", 0, 1], ["x^2*log(x)", 0.5, 2],
  ["x*cos(3x+1)", 0, 1], ["(x+1)*exp(x)", 0, 1], ["3*x^2*exp(x^3)", 0, 1], ["x/sqrt(1-x^2)", 0, 0.5], ["cos(x)/(1+sin(x)^2)", 0, 1]
];

test("las primitivas simbólicas son correctas (F' = f y regla de Barrow)", () => {
  for (const [expr, a, b] of SYMBOLIC_CASES) {
    const solution = C.solveIntegral(expr, String(a), String(b));
    assert.ok(solution.anti, `sin primitiva para ${expr}: ${solution.symbolicError}`);
    assert.ok(solution.verified, `primitiva no verificada para ${expr}`);
    const f = C.compile(expr);
    const numeric = C.adaptiveGaussKronrod(f, a, b).value;
    const symbolic = solution.antiFn(b) - solution.antiFn(a);
    close(symbolic, numeric, 1e-8, `${expr} en [${a}, ${b}] (F = ${solution.anti})`);
    // La primitiva impresa también debe evaluarse igual que el árbol interno.
    close(C.evaluateAntiderivative(solution.anti, a, b), symbolic, 1e-6, `texto de ${expr}`);
    assert.equal(solution.definite.method, "symbolic", expr);
  }
});

test("formas de las primitivas más comunes", () => {
  const anti = expr => C.solveIntegral(expr).anti;
  assert.equal(anti("x^2"), "1/3*x**3");
  assert.equal(anti("4/x - 3/x**2"), "4*log(abs(x)) + 3/x");
  assert.equal(anti("(x + 5)/(x**2 + 3*x + 2)"), "4*log(abs(x+1)) - 3*log(abs(x+2))");
  assert.equal(anti("2*x*cos(x**2)"), "sin(x**2)");
  assert.equal(anti("x*exp(x)"), "x*exp(x) - exp(x)");
  assert.equal(anti("1/(x-1)^3"), "-1/(2*(x - 1)**2)");
  assert.equal(anti("sin(3x)*cos(x)"), "-1/8*cos(4*x) - 1/4*cos(2*x)");
  assert.match(C.solveIntegral("x*exp(x)").rules.join(" + "), /Integración por partes/);
  assert.match(C.solveIntegral("2*x*cos(x^2)").rules.join(" + "), /Cambio de variable/);
});

test("integrandos sin primitiva elemental se resuelven numéricamente", () => {
  const indefinite = C.solveIntegral("exp(x^2)");
  assert.equal(indefinite.anti, null);
  assert.match(indefinite.symbolicError, /No encontré una primitiva elemental/);
  const definite = C.solveIntegral("exp(-x^2)", "0", "1");
  assert.equal(definite.definite.method, "numeric");
  close(definite.definite.value, 0.7468241328124271, 1e-10);
});

test("la integral definida detecta singularidades que la regla de Barrow ignoraría", () => {
  // Antes: ∫_{-1}^{1} 1/x² dx devolvía -2 y ∫_{-1}^{2} 1/x dx devolvía ln 2.
  const square = C.solveIntegral("1/x^2", "-1", "1").definite;
  assert.equal(square.status, "divergent");
  assert.ok(Number.isNaN(square.value));
  const reciprocal = C.solveIntegral("1/x", "-1", "2").definite;
  assert.equal(reciprocal.status, "divergent");
  assert.match(reciprocal.message, /diverge/);
  const log = C.solveIntegral("ln(x)", "0", "1").definite;
  assert.equal(log.status, "improper");
  close(log.value, -1, 1e-8);
  const exact = C.solveIntegral("x*exp(x)", "0", "1").definite;
  assert.equal(exact.method, "symbolic");
  close(exact.value, 1, 1e-14);
  const withPi = C.solveIntegral("sin(x)", "0", "pi").definite;
  close(withPi.value, 2, 1e-14);
  const infinite = C.solveIntegral("1/(1+x^2)", "0", "inf").definite;
  close(infinite.value, Math.PI / 2, 1e-8);
  assert.equal(C.piMultipleText(infinite.value), "pi/2");
});

test("fracciones parciales con pasos y descomposición correcta", () => {
  for (const expr of ["(x^3+1)/(x^2-4)", "1/(x^3-x)", "(x^2+1)/((x-1)^2*(x+2))", "1/(x^4-1)", "(x+5)/(x^2+3x+2)"]) {
    const partial = C.decomposePartial(expr);
    assert.ok(partial, expr);
    assert.ok(partial.steps.length >= 3, expr);
    const original = C.compile(expr);
    const decomposition = C.compile(partial.dec);
    for (const x of [0.37, 2.71, -3.3, 5.5]) close(decomposition(x), original(x), 1e-9, `${expr} → ${partial.dec}`);
  }
  assert.equal(C.decomposePartial("1/x^2"), null, "una sola fracción se integra por potencia");
  assert.equal(C.decomposePartial("sin(x)/x"), null);
});

test("los límites aceptan constantes y rechazan entradas inválidas", () => {
  close(C.evaluateBound("sqrt(2)"), Math.SQRT2);
  close(C.evaluateBound("pi/2"), Math.PI / 2);
  close(C.evaluateBound("2pi"), 2 * Math.PI);
  close(C.evaluateBound("ln(2)"), Math.LN2);
  assert.equal(C.evaluateBound("inf"), Infinity);
  assert.equal(C.evaluateBound("-∞"), -Infinity);
  assert.throws(() => C.evaluateBound("x"), /no puede depender de x/);
  assert.throws(() => C.evaluateBound(""), /Escribe el límite/);
  assert.throws(() => C.evaluateBound("abc"), /Límite inválido/);
  assert.throws(() => C.evaluateBound("1/0"), /no es finito/);
  assert.throws(() => C.evaluateBound("sqrt(-1)"), /no es un número real/);
});

test("fracciones y formato numérico", () => {
  assert.deepEqual(C.approximateFraction(0.75), { numerator: 3, denominator: 4, value: 0.75 });
  assert.equal(C.fractionApproxText(1 / 3), "1/3");
  assert.equal(C.fractionApproxText(Math.PI, 1000, 1e-12), null);
  assert.equal(C.numberExpr(0.1 + 0.2), "3/10");
  assert.equal(C.fmt(1e-7), "1.000e-7");
  assert.equal(C.fmt(Infinity), "∞");
  assert.equal(C.clampN("99999"), C.MAX_N);
  assert.equal(C.clampN("abc"), 1);
});

test("geometría de la hoja A4", () => {
  const square = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];
  assert.equal(C.polygonArea(square), 12);
  assert.equal(C.polygonArea(square.slice().reverse()), 12);
  assert.equal(C.polygonSelfIntersects(square), false);
  assert.equal(C.polygonSelfIntersects([{ x: 0, y: 0 }, { x: 4, y: 3 }, { x: 4, y: 0 }, { x: 0, y: 3 }]), true);
  assert.deepEqual(C.polygonYIntervalsAtX(2, square), [[0, 3]]);
  const triangle = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }];
  // Rectángulos de punto medio (como en la app) frente al área exacta del polígono.
  let riemannArea = 0;
  const dx = 0.5;
  for (let x = 0; x < 10; x += dx) {
    for (const [top, bottom] of C.polygonYIntervalsAtX(x + dx / 2, triangle)) riemannArea += dx * (bottom - top);
  }
  close(riemannArea, C.polygonArea(triangle), 1e-12);
});

test("importación de texto y JSON", () => {
  assert.deepEqual(C.parseImportedText("f(x) = x^2\na = 0\nb = 2\nn = 10\nmetodo = left"), { expr: "x^2", a: "0", b: "2", n: "10", method: "left" });
  assert.equal(C.parseImportedText('{"expr": "sin(x)", "a": 0, "b": 3}', "datos.json").expr, "sin(x)");
  assert.throws(() => C.parseImportedText("{ roto", "datos.json"), /JSON del archivo no es válido/);
  assert.throws(() => C.parseImportedText("   "), /vacío/);
});
