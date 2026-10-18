"use strict";

/*
 * Núcleo matemático de Dev_Aldah_V3.
 *
 * - Analizador de expresiones (tokens → árbol) con mensajes de error en español.
 * - Evaluación segura y rápida de f(x) a partir del árbol (sin eval de texto libre).
 * - Integración numérica adaptativa Gauss–Kronrod (G7/K15) con detección de
 *   singularidades, integrales impropias y divergencia.
 * - Integración simbólica por reglas (potencia, cambio de variable, partes,
 *   fracciones parciales, identidades trigonométricas...) con verificación
 *   numérica de la primitiva.
 * - Utilidades de formato: LaTeX, texto lineal, fracciones.
 *
 * No toca el DOM. En el navegador expone funciones globales; en Node se
 * exporta con module.exports para las pruebas (tests/core.test.js).
 */

const IntegralCore = (() => {
  const MAX_N = 20000;
  const INFINITE_N = 1800;

  const M = {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    sqrt: Math.sqrt,
    cbrt: Math.cbrt,
    abs: Math.abs,
    exp: Math.exp,
    log: Math.log,
    ln: Math.log,
    log10: Math.log10,
    pow: (base, exponent) => realPow(base, exponent),
    min: Math.min,
    max: Math.max,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    sign: Math.sign,
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

  // ── Errores ────────────────────────────────────────────────────────────────

  class ExpressionError extends Error {
    constructor(message, position = -1) {
      super(message);
      this.name = "ExpressionError";
      this.position = position;
    }
  }

  // ── Analizador léxico ──────────────────────────────────────────────────────

  const CONSTANTS = { pi: Math.PI, e: Math.E };
  const FUNCTIONS = new Set([
    "sin", "cos", "tan", "sec", "csc", "cot", "asin", "acos", "atan",
    "sinh", "cosh", "tanh", "sqrt", "cbrt", "abs", "exp", "log", "log10",
    "floor", "ceil", "round", "sign", "min", "max", "pow"
  ]);
  const ALIASES = {
    ln: "log",
    sen: "sin",
    tg: "tan",
    ctg: "cot",
    cotg: "cot",
    cosec: "csc",
    arcsin: "asin",
    arcsen: "asin",
    arccos: "acos",
    arctan: "atan",
    arctg: "atan",
    senh: "sinh",
    raiz: "sqrt"
  };
  const INFINITY_WORDS = new Set(["inf", "infinity", "infinito", "oo"]);
  const VARIADIC = new Set(["min", "max"]);
  const SYMBOLS = {
    "+": "+", "-": "-", "−": "-", "–": "-",
    "*": "*", "·": "*", "×": "*", "⋅": "*",
    "/": "/", "÷": "/", "^": "^",
    "(": "(", ")": ")", "[": "(", "]": ")", "{": "(", "}": ")",
    ",": ",", "|": "|"
  };

  function knownWords(allowInfinity) {
    const words = new Set(["x", ...Object.keys(CONSTANTS), ...FUNCTIONS, ...Object.keys(ALIASES)]);
    if (allowInfinity) INFINITY_WORDS.forEach(word => words.add(word));
    return words;
  }

  function canonicalWord(word) {
    return ALIASES[word] || word;
  }

  // Separa identificadores pegados como "xsin" → x, sin o "pix" → pi, x.
  function splitIdentifier(word, known) {
    const n = word.length;
    const best = new Array(n + 1).fill(null);
    best[n] = [];
    for (let i = n - 1; i >= 0; i--) {
      for (let j = n; j > i; j--) {
        const piece = word.slice(i, j);
        if (!known.has(piece) || !best[j]) continue;
        const candidate = [piece, ...best[j]];
        if (!best[i] || candidate.length < best[i].length) best[i] = candidate;
      }
    }
    return best[0];
  }

  function tokenizeExpression(raw, options = {}) {
    let s = String(raw ?? "");
    s = s.replace(/^\s*(?:f\s*\(\s*x\s*\)|y)\s*=/i, "");
    const known = knownWords(options.allowInfinity);
    const tokens = [];
    let i = 0;

    while (i < s.length) {
      const ch = s[i];
      if (/\s/.test(ch)) {
        i++;
        continue;
      }

      const number = s.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
      if (number) {
        tokens.push({ type: "num", value: Number(number[0]), pos: i });
        i += number[0].length;
        continue;
      }

      if (/^log10/i.test(s.slice(i))) {
        tokens.push({ type: "id", value: "log10", pos: i });
        i += 5;
        continue;
      }

      const word = s.slice(i).match(/^[a-zA-Z_]+/);
      if (word) {
        const lower = word[0].toLowerCase();
        const pieces = known.has(lower) ? [lower] : splitIdentifier(lower, known);
        if (!pieces) throw new ExpressionError(`Símbolo desconocido: «${word[0]}». Usa x como variable.`, i);
        for (const piece of pieces) tokens.push({ type: "id", value: canonicalWord(piece), pos: i });
        i += word[0].length;
        continue;
      }

      if (s.startsWith("**", i)) {
        tokens.push({ type: "op", value: "^", pos: i });
        i += 2;
        continue;
      }
      if (SYMBOLS[ch]) {
        tokens.push({ type: "op", value: SYMBOLS[ch], pos: i });
        i++;
        continue;
      }
      if (ch === "π") {
        tokens.push({ type: "id", value: "pi", pos: i });
        i++;
        continue;
      }
      if (ch === "√") {
        tokens.push({ type: "id", value: "sqrt", pos: i });
        i++;
        continue;
      }
      if (ch === "∞" && options.allowInfinity) {
        tokens.push({ type: "id", value: "inf", pos: i });
        i++;
        continue;
      }
      if (ch === "²" || ch === "³") {
        tokens.push({ type: "op", value: "^", pos: i });
        tokens.push({ type: "num", value: ch === "²" ? 2 : 3, pos: i });
        i++;
        continue;
      }
      throw new ExpressionError(`Carácter no válido: «${ch}».`, i);
    }
    return tokens;
  }

  // ── Analizador sintáctico ──────────────────────────────────────────────────
  // suma     := producto (('+'|'-') producto)*
  // producto := unario (('*'|'/') unario | unario implícito)*
  // unario   := ('+'|'-') unario | potencia          (-x^2 = -(x^2))
  // potencia := primario ('^' unario)?               (asociativa a la derecha)

  const num = value => ({ type: "num", value });
  const VAR = () => ({ type: "var" });
  const constNode = name => ({ type: "const", name });
  const neg = arg => ({ type: "neg", arg });
  const add = (left, right) => ({ type: "add", left, right });
  const sub = (left, right) => ({ type: "sub", left, right });
  const mul = (left, right) => ({ type: "mul", left, right });
  const div = (left, right) => ({ type: "div", left, right });
  const pow = (left, right) => ({ type: "pow", left, right });
  const call = (name, ...args) => ({ type: "call", name, args });

  function parseExpression(raw, options = {}) {
    const tokens = tokenizeExpression(raw, options);
    if (!tokens.length) throw new ExpressionError("Escribe una función.");
    let index = 0;
    let absDepth = 0;

    const peek = () => tokens[index];
    const next = () => tokens[index++];
    const isOp = (token, value) => Boolean(token) && token.type === "op" && token.value === value;

    function startsPrimary(token) {
      if (!token) return false;
      if (token.type === "num" || token.type === "id") return true;
      if (isOp(token, "(")) return true;
      if (isOp(token, "|")) return absDepth === 0;
      return false;
    }

    function expectOperand(token) {
      const t = peek();
      if (!t) throw new ExpressionError(`Falta un término después de «${token.value}».`, token.pos);
    }

    function parseSum() {
      let left = parseProduct();
      while (isOp(peek(), "+") || isOp(peek(), "-")) {
        const op = next();
        expectOperand(op);
        const right = parseProduct();
        left = op.value === "+" ? add(left, right) : sub(left, right);
      }
      return left;
    }

    function parseProduct() {
      let left = parseUnary();
      while (true) {
        const token = peek();
        if (isOp(token, "*") || isOp(token, "/")) {
          next();
          expectOperand(token);
          const right = parseUnary();
          left = token.value === "*" ? mul(left, right) : div(left, right);
        } else if (startsPrimary(token)) {
          left = mul(left, parsePower());
        } else {
          break;
        }
      }
      return left;
    }

    function parseUnary() {
      const token = peek();
      if (isOp(token, "-")) {
        next();
        expectOperand(token);
        return neg(parseUnary());
      }
      if (isOp(token, "+")) {
        next();
        expectOperand(token);
        return parseUnary();
      }
      return parsePower();
    }

    function parsePower() {
      const base = parsePrimary();
      if (isOp(peek(), "^")) {
        const op = next();
        expectOperand(op);
        return pow(base, parseUnary());
      }
      return base;
    }

    function checkArity(name, args, pos) {
      if (name === "pow" && args.length !== 2) throw new ExpressionError("pow necesita dos argumentos: pow(base, exponente).", pos);
      if (!VARIADIC.has(name) && name !== "pow" && args.length !== 1) {
        throw new ExpressionError(`La función ${name} recibe un solo argumento.`, pos);
      }
    }

    function parseFunction(name, token) {
      // sin^2(x) → (sin x)^2
      let exponent = null;
      if (isOp(peek(), "^")) {
        next();
        exponent = parsePrimary();
      }
      let args;
      if (isOp(peek(), "(")) {
        next();
        if (isOp(peek(), ")")) throw new ExpressionError(`La función ${name} necesita un argumento, por ejemplo ${name}(x).`, token.pos);
        const saved = absDepth;
        absDepth = 0;
        args = [parseSum()];
        while (isOp(peek(), ",")) {
          next();
          args.push(parseSum());
        }
        absDepth = saved;
        if (!isOp(peek(), ")")) throw new ExpressionError(`Falta cerrar el paréntesis de ${name}(…).`, token.pos);
        next();
      } else {
        if (!startsPrimary(peek())) throw new ExpressionError(`La función ${name} necesita un argumento, por ejemplo ${name}(x).`, token.pos);
        let arg = parsePower();
        // "sin 2x" se lee como sin(2x)
        if (arg.type === "num" && peek() && peek().type === "id") arg = mul(arg, parsePower());
        args = [arg];
      }
      checkArity(name, args, token.pos);
      const node = name === "pow" ? pow(args[0], args[1]) : call(name, ...args);
      return exponent ? pow(node, exponent) : node;
    }

    function parsePrimary() {
      const token = next();
      if (!token) throw new ExpressionError("La expresión está incompleta.");
      if (token.type === "num") return num(token.value);
      if (token.type === "id") {
        const name = token.value;
        if (name === "x") return VAR();
        if (CONSTANTS[name] !== undefined) return constNode(name);
        if (INFINITY_WORDS.has(name)) return num(Infinity);
        if (FUNCTIONS.has(name)) return parseFunction(name, token);
        throw new ExpressionError(`Símbolo desconocido: «${name}».`, token.pos);
      }
      if (isOp(token, "(")) {
        if (isOp(peek(), ")")) throw new ExpressionError("Hay paréntesis vacíos «()».", token.pos);
        const saved = absDepth;
        absDepth = 0;
        const inner = parseSum();
        absDepth = saved;
        if (!isOp(peek(), ")")) throw new ExpressionError("Falta cerrar un paréntesis «)».", token.pos);
        next();
        return inner;
      }
      if (isOp(token, "|")) {
        absDepth++;
        const inner = parseSum();
        absDepth--;
        if (!isOp(peek(), "|")) throw new ExpressionError("Falta cerrar el valor absoluto «|».", token.pos);
        next();
        return call("abs", inner);
      }
      if (isOp(token, ")")) throw new ExpressionError("Sobra un paréntesis «)».", token.pos);
      if (isOp(token, ",")) throw new ExpressionError("La coma solo separa argumentos, por ejemplo max(x, 1).", token.pos);
      throw new ExpressionError(`Falta un término antes de «${token.value}».`, token.pos);
    }

    const ast = parseSum();
    if (index < tokens.length) {
      const token = tokens[index];
      if (isOp(token, ")")) throw new ExpressionError("Sobra un paréntesis «)».", token.pos);
      throw new ExpressionError(`No entiendo «${token.value}» en esta posición.`, token.pos);
    }
    return ast;
  }

  // ── Evaluación ─────────────────────────────────────────────────────────────

  // Potencia real: (-8)^(1/3) = -2, como en el cálculo de una variable real.
  function realPow(base, exponent) {
    if (base >= 0 || Number.isInteger(exponent) || !Number.isFinite(exponent)) return Math.pow(base, exponent);
    const fraction = approximateFraction(exponent, 99);
    if (fraction && Math.abs(fraction.value - exponent) < 1e-12 && fraction.denominator % 2 === 1) {
      const magnitude = Math.pow(-base, exponent);
      return Math.abs(fraction.numerator) % 2 === 0 ? magnitude : -magnitude;
    }
    return NaN;
  }

  function astToJs(node) {
    switch (node.type) {
      case "num": return `(${String(node.value)})`;
      case "var": return "x";
      case "const": return node.name === "pi" ? "Math.PI" : "Math.E";
      case "neg": return `(-${astToJs(node.arg)})`;
      case "add": return `(${astToJs(node.left)}+${astToJs(node.right)})`;
      case "sub": return `(${astToJs(node.left)}-${astToJs(node.right)})`;
      case "mul": return `(${astToJs(node.left)}*${astToJs(node.right)})`;
      case "div": return `(${astToJs(node.left)}/${astToJs(node.right)})`;
      case "pow": return `P(${astToJs(node.left)},${astToJs(node.right)})`;
      case "call": return `M.${node.name}(${node.args.map(astToJs).join(",")})`;
      default: throw new ExpressionError("Expresión no válida.");
    }
  }

  // Devuelve f(x) que nunca lanza: valores no reales o infinitos → NaN.
  function compile(expression) {
    const ast = typeof expression === "object" && expression ? expression : parseExpression(expression);
    const fn = new Function("x", "M", "P", `"use strict"; return ${astToJs(ast)};`);
    const compiled = x => {
      try {
        const y = Number(fn(x, M, realPow));
        return Number.isFinite(y) ? y : NaN;
      } catch (_) {
        return NaN;
      }
    };
    compiled.ast = ast;
    return compiled;
  }

  function evaluateAst(node, x = 0) {
    switch (node.type) {
      case "num": return node.value;
      case "var": return x;
      case "const": return CONSTANTS[node.name];
      case "neg": return -evaluateAst(node.arg, x);
      case "add": return evaluateAst(node.left, x) + evaluateAst(node.right, x);
      case "sub": return evaluateAst(node.left, x) - evaluateAst(node.right, x);
      case "mul": return evaluateAst(node.left, x) * evaluateAst(node.right, x);
      case "div": return evaluateAst(node.left, x) / evaluateAst(node.right, x);
      case "pow": return realPow(evaluateAst(node.left, x), evaluateAst(node.right, x));
      case "call": return M[node.name](...node.args.map(arg => evaluateAst(arg, x)));
      default: return NaN;
    }
  }

  function dependsOnX(node) {
    switch (node.type) {
      case "var": return true;
      case "num": case "const": return false;
      case "neg": return dependsOnX(node.arg);
      case "call": return node.args.some(dependsOnX);
      default: return dependsOnX(node.left) || dependsOnX(node.right);
    }
  }

  // ── Formato numérico ───────────────────────────────────────────────────────

  function fmt(value, digits = 5) {
    if (value === Infinity) return "∞";
    if (value === -Infinity) return "-∞";
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
      return { numerator: sign * Math.round(x), denominator: 1, value: sign * Math.round(x) };
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

  function fractionValueText(value) {
    return fractionApproxText(value, 1000, 1e-10);
  }

  // Reconoce múltiplos racionales de π (por ejemplo π/2) en un resultado decimal.
  function piMultipleText(value) {
    if (!Number.isFinite(value) || Math.abs(value) < 1e-12) return null;
    const ratio = value / Math.PI;
    const fraction = approximateFraction(ratio, 24);
    if (!fraction || Math.abs(fraction.value - ratio) > 1e-10) return null;
    const { numerator, denominator } = fraction;
    const top = numerator === 1 ? "pi" : numerator === -1 ? "-pi" : `${numerator}*pi`;
    return denominator === 1 ? top : `${top}/${denominator}`;
  }

  function isNiceNumber(value) {
    return Number.isFinite(value) && (Number.isInteger(value) || fractionApproxText(value, 1000, 1e-12) !== null);
  }

  // Ajusta errores de redondeo: 0.4999999999999 → 1/2.
  function snapNumber(value, tolerance = 1e-9) {
    if (!Number.isFinite(value)) return value;
    const fraction = approximateFraction(value, 1000);
    if (fraction && Math.abs(fraction.value - value) <= tolerance * Math.max(1, Math.abs(value))) return fraction.value;
    return value;
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

  // ── Impresión del árbol ────────────────────────────────────────────────────

  function numberText(value, opts) {
    if (value === Infinity) return "inf";
    if (value === -Infinity) return "-inf";
    if (opts.fractions) return numberExpr(value);
    return String(value);
  }

  function precedence(node, opts = {}) {
    switch (node.type) {
      case "add": case "sub": return 1;
      case "mul": case "div": return 2;
      case "neg": return 3;
      case "pow": return 4;
      case "num": {
        const text = numberText(node.value, opts);
        if (text.startsWith("-")) return 3;
        if (/[/e]/i.test(text)) return 2;
        return 5;
      }
      default: return 5;
    }
  }

  // Texto canónico: "2*x**2-sin(x)". Con opts.caret usa ^, con opts.spaces separa + y -.
  function astToString(node, opts = {}) {
    const wrap = (child, minPrecedence) => {
      const text = astToString(child, opts);
      return precedence(child, opts) < minPrecedence ? `(${text})` : text;
    };
    const plus = opts.spaces ? " + " : "+";
    const minus = opts.spaces ? " - " : "-";
    switch (node.type) {
      case "num": return numberText(node.value, opts);
      case "var": return "x";
      case "const": return node.name;
      case "neg": return `-${wrap(node.arg, 2)}`;
      case "add": return `${astToString(node.left, opts)}${plus}${wrap(node.right, 2)}`;
      case "sub": return `${astToString(node.left, opts)}${minus}${wrap(node.right, 2)}`;
      case "mul": return `${wrap(node.left, 2)}*${wrap(node.right, 2)}`;
      case "div": return `${wrap(node.left, 2)}/${wrap(node.right, 3)}`;
      case "pow": return `${wrap(node.left, 5)}${opts.caret ? "^" : "**"}${wrap(node.right, 4)}`;
      case "call": {
        const name = opts.lnName && node.name === "log" ? "ln" : node.name;
        return `${name}(${node.args.map(arg => astToString(arg, opts)).join(opts.spaces ? ", " : ",")})`;
      }
      default: return "";
    }
  }

  function numberLatex(value) {
    if (value === Infinity) return "\\infty";
    if (value === -Infinity) return "-\\infty";
    const text = String(value);
    const exp = text.match(/^(-?[\d.]+)e([+-]?\d+)$/i);
    if (exp) return `${exp[1]}\\times 10^{${Number(exp[2])}}`;
    return text;
  }

  const LATEX_NAMES = {
    sin: "\\sin", cos: "\\cos", tan: "\\tan", sec: "\\sec", csc: "\\csc", cot: "\\cot",
    asin: "\\arcsin", acos: "\\arccos", atan: "\\arctan",
    sinh: "\\sinh", cosh: "\\cosh", tanh: "\\tanh",
    log: "\\ln", log10: "\\log_{10}"
  };

  function isLatexAtom(node) {
    if (node.type === "var" || node.type === "const") return true;
    if (node.type === "num") return node.value >= 0 && Number.isFinite(node.value) && !/e/i.test(String(node.value));
    if (node.type === "call") return ["sqrt", "abs", "cbrt", "floor", "ceil"].includes(node.name);
    return false;
  }

  function flattenMul(node, out = []) {
    if (node.type === "mul") {
      flattenMul(node.left, out);
      flattenMul(node.right, out);
    } else {
      out.push(node);
    }
    return out;
  }

  function astToLatex(node) {
    const paren = text => `\\left(${text}\\right)`;
    const wrap = (child, minPrecedence) => {
      const text = astToLatex(child);
      return precedence(child) < minPrecedence ? paren(text) : text;
    };
    const signedRight = child => (child.type === "neg" || (child.type === "num" && child.value < 0))
      ? paren(astToLatex(child))
      : wrap(child, 2);

    switch (node.type) {
      case "num": return numberLatex(node.value);
      case "var": return "x";
      case "const": return node.name === "pi" ? "\\pi" : "e";
      case "neg": return `-${wrap(node.arg, 2)}`;
      case "add": return `${astToLatex(node.left)}+${signedRight(node.right)}`;
      case "sub": return `${astToLatex(node.left)}-${signedRight(node.right)}`;
      case "div": return `\\frac{${astToLatex(node.left)}}{${astToLatex(node.right)}}`;
      case "mul": {
        const factors = flattenMul(node);
        let out = "";
        factors.forEach((factor, index) => {
          let text = astToLatex(factor);
          if (precedence(factor) < 2 || (index > 0 && precedence(factor) === 3)) text = paren(text);
          if (index > 0) {
            const previous = factors[index - 1];
            const startsWithDigit = /^[\d.]/.test(text);
            if (startsWithDigit || (previous.type === "num" && factor.type === "num")) out += "\\cdot ";
            else if (previous.type !== "num" || /^\\frac/.test(text)) out += "\\,";
          }
          out += text;
        });
        return out;
      }
      case "pow": {
        const exponent = astToLatex(node.right);
        const base = node.left;
        if (base.type === "call" && LATEX_NAMES[base.name] && base.args.length === 1) {
          return `${LATEX_NAMES[base.name]}^{${exponent}}${paren(astToLatex(base.args[0]))}`;
        }
        const baseText = isLatexAtom(base) ? astToLatex(base) : paren(astToLatex(base));
        return `${baseText}^{${exponent}}`;
      }
      case "call": {
        const args = node.args.map(astToLatex);
        if (node.name === "sqrt") return `\\sqrt{${args[0]}}`;
        if (node.name === "cbrt") return `\\sqrt[3]{${args[0]}}`;
        if (node.name === "abs") return `\\left|${args[0]}\\right|`;
        if (node.name === "exp") return `e^{${args[0]}}`;
        if (node.name === "floor") return `\\left\\lfloor ${args[0]}\\right\\rfloor`;
        if (node.name === "ceil") return `\\left\\lceil ${args[0]}\\right\\rceil`;
        const name = LATEX_NAMES[node.name] || `\\operatorname{${node.name}}`;
        return `${name}${paren(args.join(",\\,"))}`;
      }
      default: return "";
    }
  }

  function escapeLatexText(text) {
    return String(text).replace(/[\\{}$&#^_%~]/g, char => `\\${char === "\\" ? "backslash" : char}`);
  }

  function exprToLatex(raw) {
    const text = String(raw ?? "").trim();
    if (!text) return "";
    try {
      return astToLatex(parseExpression(text, { allowInfinity: true }));
    } catch (_) {
      return `\\text{${escapeLatexText(text)}}`;
    }
  }

  // Formato lineal para chat: (x + 5)/(x^2 + 3*x + 2)
  function linearExpr(raw) {
    const text = String(raw ?? "").trim();
    try {
      return astToString(parseExpression(text, { allowInfinity: true }), { caret: true, spaces: true, lnName: true });
    } catch (_) {
      return text.replace(/\*\*/g, "^");
    }
  }

  function normalize(raw) {
    try {
      return astToString(parseExpression(raw));
    } catch (_) {
      return String(raw ?? "").trim().replace(/^f\s*\(\s*x\s*\)\s*=/i, "").replace(/\^/g, "**");
    }
  }

  function valueTex(value) {
    const fraction = fractionValueText(value);
    return fraction ? exprToLatex(fraction) : fmt(value, 8);
  }

  // ── Simplificación ─────────────────────────────────────────────────────────

  const isNum = (node, value) => node.type === "num" && (value === undefined || Math.abs(node.value - value) < 1e-15);
  const sameAst = (a, b) => astToString(a) === astToString(b);
  const hasNegativeCoefficient = node => node.type === "mul" && node.left.type === "num" && node.left.value < 0;
  const flipCoefficient = node => mul(num(-node.left.value), node.right);
  const hasNumericLead = node => node.type === "num" || (node.type === "mul" && node.left.type === "num") || (node.type === "div" && node.left.type === "num");

  function simplifyOnce(node) {
    switch (node.type) {
      case "num": case "var": case "const": return node;
      case "neg": {
        const arg = simplifyOnce(node.arg);
        if (arg.type === "num") return num(-arg.value);
        if (arg.type === "neg") return arg.arg;
        if (arg.type === "mul" && arg.left.type === "num") return mul(num(-arg.left.value), arg.right);
        if (arg.type === "div" && arg.left.type === "num") return div(num(-arg.left.value), arg.right);
        if (arg.type === "sub") return sub(arg.right, arg.left);
        return neg(arg);
      }
      case "add": {
        const l = simplifyOnce(node.left);
        const r = simplifyOnce(node.right);
        if (isNum(l, 0)) return r;
        if (isNum(r, 0)) return l;
        if (l.type === "num" && r.type === "num") return num(l.value + r.value);
        if (r.type === "neg") return sub(l, r.arg);
        if (r.type === "num" && r.value < 0) return sub(l, num(-r.value));
        if (hasNegativeCoefficient(r)) return sub(l, flipCoefficient(r));
        if (l.type === "neg") return sub(r, l.arg);
        if (r.type === "add") return add(add(l, r.left), r.right);
        if (r.type === "sub") return sub(add(l, r.left), r.right);
        return add(l, r);
      }
      case "sub": {
        const l = simplifyOnce(node.left);
        const r = simplifyOnce(node.right);
        if (isNum(r, 0)) return l;
        if (isNum(l, 0)) return neg(r);
        if (l.type === "num" && r.type === "num") return num(l.value - r.value);
        if (r.type === "neg") return add(l, r.arg);
        if (r.type === "num" && r.value < 0) return add(l, num(-r.value));
        if (hasNegativeCoefficient(r)) return add(l, flipCoefficient(r));
        if (sameAst(l, r)) return num(0);
        if (r.type === "add") return sub(sub(l, r.left), r.right);
        if (r.type === "sub") return add(sub(l, r.left), r.right);
        return sub(l, r);
      }
      case "mul": {
        const l = simplifyOnce(node.left);
        const r = simplifyOnce(node.right);
        if (isNum(l, 0) || isNum(r, 0)) return num(0);
        if (isNum(l, 1)) return r;
        if (isNum(r, 1)) return l;
        if (isNum(l, -1)) return neg(r);
        if (isNum(r, -1)) return neg(l);
        if (l.type === "num" && r.type === "num") return num(l.value * r.value);
        if (r.type === "num") return mul(r, l);
        if (l.type === "num" && (r.type === "add" || r.type === "sub") && hasNumericLead(r.left) && hasNumericLead(r.right)) {
          return { type: r.type, left: mul(l, r.left), right: mul(l, r.right) };
        }
        if (l.type === "neg") return neg(mul(l.arg, r));
        if (r.type === "neg") return neg(mul(l, r.arg));
        if (l.type === "num" && r.type === "mul" && r.left.type === "num") return mul(num(l.value * r.left.value), r.right);
        if (l.type === "num" && r.type === "div" && r.left.type === "num") return div(num(l.value * r.left.value), r.right);
        if (l.type !== "num" && r.type === "mul" && r.left.type === "num") return mul(r.left, mul(l, r.right));
        if (l.type === "div" && isNum(l.left, 1)) return div(r, l.right);
        if (r.type === "div" && isNum(r.left, 1)) return div(l, r.right);
        if (sameAst(l, r)) return pow(l, num(2));
        if (r.type === "pow" && r.right.type === "num" && sameAst(r.left, l)) return pow(l, num(r.right.value + 1));
        if (l.type === "pow" && l.right.type === "num" && sameAst(l.left, r)) return pow(r, num(l.right.value + 1));
        return mul(l, r);
      }
      case "div": {
        const l = simplifyOnce(node.left);
        const r = simplifyOnce(node.right);
        if (isNum(l, 0)) return num(0);
        if (isNum(r, 1)) return l;
        if (l.type === "num" && r.type === "num" && r.value !== 0) return num(l.value / r.value);
        if (r.type === "num" && r.value !== 0) return mul(num(1 / r.value), l);
        if (l.type === "neg") return neg(div(l.arg, r));
        if (r.type === "neg") return neg(div(l, r.arg));
        if (sameAst(l, r)) return num(1);
        return div(l, r);
      }
      case "pow": {
        const l = simplifyOnce(node.left);
        const r = simplifyOnce(node.right);
        if (isNum(r, 0)) return num(1);
        if (isNum(r, 1)) return l;
        if (l.type === "num" && r.type === "num") {
          const value = realPow(l.value, r.value);
          if (isNiceNumber(value)) return num(value);
        }
        return pow(l, r);
      }
      case "call": {
        const args = node.args.map(simplifyOnce);
        if (args.every(arg => arg.type === "num")) {
          const value = M[node.name](...args.map(arg => arg.value));
          if (isNiceNumber(value)) return num(value);
        }
        return call(node.name, ...args);
      }
      default: return node;
    }
  }

  function simplify(node) {
    let current = node;
    let text = astToString(current);
    for (let i = 0; i < 16; i++) {
      const next = simplifyOnce(current);
      const nextText = astToString(next);
      current = next;
      if (nextText === text) break;
      text = nextText;
    }
    return current;
  }

  // Forma de presentación: x^(-1) → 1/x, u^(1/2) → sqrt(u).
  function prettify(node) {
    switch (node.type) {
      case "num": case "var": case "const": return node;
      case "neg": return neg(prettify(node.arg));
      case "call": return call(node.name, ...node.args.map(prettify));
      case "pow": {
        const base = prettify(node.left);
        const exponent = prettify(node.right);
        if (exponent.type === "num") {
          if (isNum(exponent, 0.5)) return call("sqrt", base);
          if (isNum(exponent, -0.5)) return div(num(1), call("sqrt", base));
          if (exponent.value < 0) return div(num(1), isNum(exponent, -1) ? base : pow(base, num(-exponent.value)));
        }
        return pow(base, exponent);
      }
      default: return { type: node.type, left: prettify(node.left), right: prettify(node.right) };
    }
  }

  // c/y con c = p/q fraccionario → p/(q·y), para no escribir -1/2/(x-1)**2.
  function splitFractionNumerators(node) {
    switch (node.type) {
      case "num": case "var": case "const": return node;
      case "neg": return neg(splitFractionNumerators(node.arg));
      case "call": return call(node.name, ...node.args.map(splitFractionNumerators));
      case "div": {
        const left = splitFractionNumerators(node.left);
        const right = splitFractionNumerators(node.right);
        if (left.type === "num" && !Number.isInteger(left.value)) {
          const fraction = approximateFraction(left.value, 1000);
          if (fraction && Math.abs(fraction.value - left.value) < 1e-12) return div(num(fraction.numerator), mul(num(fraction.denominator), right));
        }
        return div(left, right);
      }
      default: return { type: node.type, left: splitFractionNumerators(node.left), right: splitFractionNumerators(node.right) };
    }
  }

  function finalizeAst(node) {
    return splitFractionNumerators(simplify(prettify(simplify(node))));
  }

  function substituteVar(node, replacement) {
    switch (node.type) {
      case "var": return replacement;
      case "num": case "const": return node;
      case "neg": return neg(substituteVar(node.arg, replacement));
      case "call": return call(node.name, ...node.args.map(arg => substituteVar(arg, replacement)));
      default: return { type: node.type, left: substituteVar(node.left, replacement), right: substituteVar(node.right, replacement) };
    }
  }

  // ── Derivación simbólica ───────────────────────────────────────────────────

  function differentiate(node) {
    const d = differentiate;
    switch (node.type) {
      case "num": case "const": return num(0);
      case "var": return num(1);
      case "neg": {
        const inner = d(node.arg);
        return inner && neg(inner);
      }
      case "add": case "sub": {
        const l = d(node.left);
        const r = d(node.right);
        return l && r ? { type: node.type, left: l, right: r } : null;
      }
      case "mul": {
        const l = d(node.left);
        const r = d(node.right);
        return l && r ? add(mul(l, node.right), mul(node.left, r)) : null;
      }
      case "div": {
        const l = d(node.left);
        const r = d(node.right);
        return l && r ? div(sub(mul(l, node.right), mul(node.left, r)), pow(node.right, num(2))) : null;
      }
      case "pow": {
        const baseDepends = dependsOnX(node.left);
        const exponentDepends = dependsOnX(node.right);
        if (!baseDepends && !exponentDepends) return num(0);
        if (!exponentDepends) {
          const inner = d(node.left);
          return inner && mul(mul(node.right, pow(node.left, sub(node.right, num(1)))), inner);
        }
        const exponentDerivative = d(node.right);
        if (!exponentDerivative) return null;
        if (!baseDepends) return mul(mul(node, call("log", node.left)), exponentDerivative);
        const baseDerivative = d(node.left);
        return baseDerivative && mul(node, add(mul(exponentDerivative, call("log", node.left)), div(mul(node.right, baseDerivative), node.left)));
      }
      case "call": {
        if (node.args.length !== 1) return null;
        const u = node.args[0];
        const du = d(u);
        if (!du) return null;
        const outer = {
          sin: () => call("cos", u),
          cos: () => neg(call("sin", u)),
          tan: () => pow(call("sec", u), num(2)),
          sec: () => mul(call("sec", u), call("tan", u)),
          csc: () => neg(mul(call("csc", u), call("cot", u))),
          cot: () => neg(pow(call("csc", u), num(2))),
          asin: () => div(num(1), call("sqrt", sub(num(1), pow(u, num(2))))),
          acos: () => neg(div(num(1), call("sqrt", sub(num(1), pow(u, num(2)))))),
          atan: () => div(num(1), add(num(1), pow(u, num(2)))),
          sinh: () => call("cosh", u),
          cosh: () => call("sinh", u),
          tanh: () => div(num(1), pow(call("cosh", u), num(2))),
          sqrt: () => div(num(1), mul(num(2), call("sqrt", u))),
          cbrt: () => div(num(1), mul(num(3), pow(call("cbrt", u), num(2)))),
          exp: () => call("exp", u),
          log: () => div(num(1), u),
          log10: () => div(num(1), mul(u, call("log", num(10)))),
          abs: () => div(u, call("abs", u))
        }[node.name];
        return outer ? mul(outer(), du) : null;
      }
      default: return null;
    }
  }

  // ── Polinomios ─────────────────────────────────────────────────────────────

  const MAX_POLY_DEGREE = 12;

  function trimPoly(coeffs) {
    const out = coeffs.slice();
    while (out.length > 1 && Math.abs(out[out.length - 1]) < 1e-13) out.pop();
    return out;
  }

  const polyDegree = coeffs => trimPoly(coeffs).length - 1;
  const polyEval = (coeffs, x) => coeffs.reduceRight((acc, coeff) => acc * x + coeff, 0);

  function polyAdd(a, b, sign = 1) {
    const out = new Array(Math.max(a.length, b.length)).fill(0);
    a.forEach((coeff, i) => { out[i] += coeff; });
    b.forEach((coeff, i) => { out[i] += sign * coeff; });
    return trimPoly(out);
  }

  function polyMul(a, b) {
    const out = new Array(a.length + b.length - 1).fill(0);
    a.forEach((ca, i) => b.forEach((cb, j) => { out[i + j] += ca * cb; }));
    return trimPoly(out);
  }

  function polyDerivative(coeffs) {
    if (coeffs.length <= 1) return [0];
    return trimPoly(coeffs.slice(1).map((coeff, i) => coeff * (i + 1)));
  }

  function polyIntegral(coeffs) {
    return trimPoly([0, ...coeffs.map((coeff, i) => coeff / (i + 1))]);
  }

  function polyDivide(numerator, denominator) {
    let remainder = trimPoly(numerator).slice();
    const d = trimPoly(denominator);
    const dd = d.length - 1;
    const quotient = new Array(Math.max(1, remainder.length - dd)).fill(0);
    while (remainder.length - 1 >= dd && !(remainder.length === 1 && Math.abs(remainder[0]) < 1e-13)) {
      const shift = remainder.length - 1 - dd;
      const factor = remainder[remainder.length - 1] / d[dd];
      quotient[shift] = factor;
      for (let i = 0; i <= dd; i++) remainder[i + shift] -= factor * d[i];
      remainder.pop();
      if (!remainder.length) remainder = [0];
      if (dd === 0) break;
    }
    if (dd === 0) remainder = [0];
    return { quotient: trimPoly(quotient), remainder: trimPoly(remainder.length ? remainder : [0]) };
  }

  // Coeficientes ascendentes si el árbol es un polinomio en x con coeficientes numéricos.
  function polynomialFromAst(node) {
    switch (node.type) {
      case "num": return Number.isFinite(node.value) ? [node.value] : null;
      case "const": return null;
      case "var": return [0, 1];
      case "neg": {
        const p = polynomialFromAst(node.arg);
        return p && p.map(coeff => -coeff);
      }
      case "add": case "sub": {
        const l = polynomialFromAst(node.left);
        const r = l && polynomialFromAst(node.right);
        return r ? polyAdd(l, r, node.type === "add" ? 1 : -1) : null;
      }
      case "mul": {
        const l = polynomialFromAst(node.left);
        const r = l && polynomialFromAst(node.right);
        if (!r) return null;
        const product = polyMul(l, r);
        return product.length - 1 <= MAX_POLY_DEGREE ? product : null;
      }
      case "div": {
        const l = polynomialFromAst(node.left);
        if (!l || dependsOnX(node.right) || node.right.type === "const") return null;
        const value = evaluateAst(node.right);
        if (!Number.isFinite(value) || value === 0 || !isPurelyNumeric(node.right)) return null;
        return l.map(coeff => coeff / value);
      }
      case "pow": {
        if (node.right.type !== "num") return null;
        const n = node.right.value;
        if (!Number.isInteger(n) || n < 0) return null;
        const base = polynomialFromAst(node.left);
        if (!base || (base.length - 1) * n > MAX_POLY_DEGREE) return null;
        let out = [1];
        for (let i = 0; i < n; i++) out = polyMul(out, base);
        return out;
      }
      default: return null;
    }
  }

  function isPurelyNumeric(node) {
    switch (node.type) {
      case "num": return true;
      case "var": case "const": case "call": return false;
      case "neg": return isPurelyNumeric(node.arg);
      default: return isPurelyNumeric(node.left) && isPurelyNumeric(node.right);
    }
  }

  function linearOf(node) {
    const p = polynomialFromAst(node);
    if (!p || p.length !== 2 || Math.abs(p[1]) < 1e-13) return null;
    return { a: p[1], b: p[0] };
  }

  function polynomialToAst(coeffs) {
    const p = trimPoly(coeffs);
    let out = null;
    for (let k = p.length - 1; k >= 0; k--) {
      const c = snapNumber(p[k], 1e-12);
      if (Math.abs(c) < 1e-13) continue;
      const body = k === 0 ? null : k === 1 ? VAR() : pow(VAR(), num(k));
      const magnitude = Math.abs(c);
      let term = body ? (Math.abs(magnitude - 1) < 1e-13 ? body : mul(num(magnitude), body)) : num(magnitude);
      if (!out) out = c < 0 ? neg(term) : term;
      else out = c < 0 ? sub(out, term) : add(out, term);
    }
    return out || num(0);
  }

  // x - r, x + r o x
  function linearFactorAst(root) {
    const r = snapNumber(root, 1e-12);
    if (Math.abs(r) < 1e-13) return VAR();
    return r < 0 ? add(VAR(), num(-r)) : sub(VAR(), num(r));
  }

  // ── Raíces de polinomios (Durand–Kerner + Newton) ──────────────────────────

  const cx = (re, im = 0) => ({ re, im });
  const cAdd = (a, b) => cx(a.re + b.re, a.im + b.im);
  const cSub = (a, b) => cx(a.re - b.re, a.im - b.im);
  const cMul = (a, b) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  const cDiv = (a, b) => {
    const d = b.re * b.re + b.im * b.im;
    return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
  };
  const cAbs = a => Math.hypot(a.re, a.im);
  const cPolyEval = (coeffs, z) => coeffs.reduceRight((acc, coeff) => cAdd(cMul(acc, z), cx(coeff)), cx(0));

  function polynomialRoots(coeffs) {
    const p = trimPoly(coeffs);
    const n = p.length - 1;
    if (n < 1) return [];
    if (n === 1) return [cx(-p[0] / p[1])];
    if (n === 2) {
      const [c, b, a] = p;
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const sq = Math.sqrt(disc);
        const q = -0.5 * (b + (b >= 0 ? sq : -sq));
        const r1 = q / a;
        const r2 = q !== 0 ? c / q : -b / (2 * a);
        return [cx(r1), cx(r2)];
      }
      const re = -b / (2 * a);
      const im = Math.sqrt(-disc) / (2 * Math.abs(a));
      return [cx(re, im), cx(re, -im)];
    }

    const monic = p.map(coeff => coeff / p[n]);
    const radius = 1 + Math.max(...monic.slice(0, n).map(Math.abs));
    let roots = Array.from({ length: n }, (_, k) => {
      const angle = 2 * Math.PI * k / n + 0.4;
      return cx(radius * Math.cos(angle), radius * Math.sin(angle));
    });
    for (let iter = 0; iter < 800; iter++) {
      let change = 0;
      roots = roots.map((z, i) => {
        let denominator = cx(1);
        roots.forEach((w, j) => { if (i !== j) denominator = cMul(denominator, cSub(z, w)); });
        const delta = cDiv(cPolyEval(monic, z), denominator);
        change = Math.max(change, cAbs(delta));
        return cSub(z, delta);
      });
      if (change < 1e-15 * radius) break;
    }
    const derivative = polyDerivative(monic);
    return roots.map(z => {
      let current = z;
      for (let k = 0; k < 8; k++) {
        const d = cPolyEval(derivative, current);
        if (cAbs(d) < 1e-14) break;
        const step = cDiv(cPolyEval(monic, current), d);
        current = cSub(current, step);
        if (cAbs(step) < 1e-16 * (1 + cAbs(current))) break;
      }
      return current;
    });
  }

  // Agrupa raíces repetidas y las redondea a fracciones cuando corresponde.
  function factorRoots(coeffs) {
    const roots = polynomialRoots(coeffs);
    const clusters = [];
    const centerOf = c => cx(c.sum.re / c.count, c.sum.im / c.count);
    for (const root of roots) {
      const cluster = clusters.find(c => cAbs(cSub(centerOf(c), root)) < 1e-4 * (1 + cAbs(root)));
      if (cluster) {
        cluster.sum = cAdd(cluster.sum, root);
        cluster.count++;
      } else {
        clusters.push({ sum: root, count: 1 });
      }
    }
    const tolerance = 1e-7;
    const snap = value => {
      const snapped = snapNumber(value, tolerance);
      return Math.abs(snapped) < tolerance ? 0 : snapped;
    };
    const real = [];
    const complex = [];
    for (const cluster of clusters) {
      const re = snap(cluster.sum.re / cluster.count);
      const im = snap(cluster.sum.im / cluster.count);
      if (Math.abs(im) < 1e-7 * (1 + Math.abs(re))) real.push({ root: re, multiplicity: cluster.count });
      else if (im > 0) complex.push({ p: re, q: im, multiplicity: cluster.count });
    }
    // Verifica la factorización reconstruyendo el polinomio.
    const p = trimPoly(coeffs);
    let rebuilt = [p[p.length - 1]];
    real.forEach(({ root, multiplicity }) => {
      for (let k = 0; k < multiplicity; k++) rebuilt = polyMul(rebuilt, [-root, 1]);
    });
    complex.forEach(({ p: re, q, multiplicity }) => {
      for (let k = 0; k < multiplicity; k++) rebuilt = polyMul(rebuilt, [re * re + q * q, -2 * re, 1]);
    });
    const scale = Math.max(...p.map(Math.abs));
    if (rebuilt.length !== p.length || rebuilt.some((coeff, i) => Math.abs(coeff - p[i]) > 1e-7 * scale)) return null;
    real.sort((a, b) => a.root - b.root);
    return { leading: p[p.length - 1], real, complex };
  }

  function solveLinearSystem(matrix, rhs) {
    const n = rhs.length;
    const a = matrix.map((row, i) => [...row, rhs[i]]);
    for (let col = 0; col < n; col++) {
      let pivot = col;
      for (let row = col + 1; row < n; row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
      if (Math.abs(a[pivot][col]) < 1e-14) return null;
      [a[col], a[pivot]] = [a[pivot], a[col]];
      for (let row = 0; row < n; row++) {
        if (row === col) continue;
        const factor = a[row][col] / a[col][col];
        for (let k = col; k <= n; k++) a[row][k] -= factor * a[col][k];
      }
    }
    return a.map((row, i) => row[n] / row[i]);
  }

  // ── Fracciones parciales ───────────────────────────────────────────────────

  function partialFractions(numerator, denominator) {
    const P = trimPoly(numerator);
    const Q = trimPoly(denominator);
    if (Q.length < 2 || Q.length - 1 > 6) return null;
    const { quotient, remainder } = polyDivide(P, Q);
    const factors = factorRoots(Q);
    if (!factors || factors.complex.some(c => c.multiplicity > 1)) return null;

    const basis = [];
    factors.real.forEach(({ root, multiplicity }) => {
      for (let k = 1; k <= multiplicity; k++) basis.push({ kind: "real", root, power: k, eval: x => 1 / Math.pow(x - root, k) });
    });
    factors.complex.forEach(({ p, q }) => {
      const quad = x => (x - p) * (x - p) + q * q;
      basis.push({ kind: "complexB", p, q, eval: x => x / quad(x) });
      basis.push({ kind: "complexC", p, q, eval: x => 1 / quad(x) });
    });

    const roots = [...factors.real.map(r => r.root), ...factors.complex.map(c => c.p)];
    const center = roots.reduce((sum, r) => sum + r, 0) / Math.max(1, roots.length);
    const spread = 1 + Math.max(0, ...roots.map(r => Math.abs(r - center)));
    const target = x => polyEval(remainder, x) / polyEval(Q, x);
    const samples = [];
    for (let k = 0; samples.length < basis.length + 4 && k < 400; k++) {
      const x = center + spread * (-1.37 + 0.61 * k + 0.013 * k * k);
      if (roots.every(r => Math.abs(x - r) > 0.05 * spread) && Number.isFinite(target(x))) samples.push(x);
    }
    if (samples.length < basis.length + 4) return null;

    const system = samples.slice(0, basis.length);
    const solution = solveLinearSystem(system.map(x => basis.map(b => b.eval(x))), system.map(target));
    if (!solution) return null;
    const coefficients = solution.map(value => {
      const snapped = snapNumber(value, 1e-9);
      return Math.abs(snapped) < 1e-11 ? 0 : snapped;
    });
    const ok = samples.slice(basis.length).every(x => {
      const approx = basis.reduce((sum, b, i) => sum + coefficients[i] * b.eval(x), 0);
      return Math.abs(approx - target(x)) <= 1e-8 * (1 + Math.abs(target(x)));
    });
    if (!ok) return null;
    return { quotient, remainder, factors, basis, coefficients };
  }

  function quadraticFactorAst(p, q) {
    return polynomialToAst([p * p + q * q, -2 * p, 1]);
  }

  function factoredDenominatorAst(factors) {
    let out = Math.abs(factors.leading - 1) < 1e-13 ? null : num(factors.leading);
    const push = node => { out = out ? mul(out, node) : node; };
    factors.real.forEach(({ root, multiplicity }) => {
      const lin = linearFactorAst(root);
      push(multiplicity > 1 ? pow(lin, num(multiplicity)) : lin);
    });
    factors.complex.forEach(({ p, q }) => push(quadraticFactorAst(p, q)));
    return out || num(1);
  }

  function rationalIntegral(numerator, denominator, rules) {
    const pf = partialFractions(numerator, denominator);
    if (!pf) return null;
    const { quotient, basis, coefficients, factors } = pf;
    let decomposition = null;
    let integral = null;
    const pushDec = node => { decomposition = decomposition ? add(decomposition, node) : node; };
    const pushInt = node => { integral = integral ? add(integral, node) : node; };

    if (polyDegree(quotient) > 0 || Math.abs(quotient[0]) > 1e-13) {
      pushDec(polynomialToAst(quotient));
      pushInt(polynomialToAst(polyIntegral(quotient)));
      addRule(rules, RULE.division);
    }

    let usesLog = false;
    let usesAtan = false;
    for (let i = 0; i < basis.length; i++) {
      const b = basis[i];
      const c = coefficients[i];
      if (b.kind === "real") {
        if (c === 0) continue;
        const lin = linearFactorAst(b.root);
        pushDec(div(num(c), b.power === 1 ? lin : pow(lin, num(b.power))));
        if (b.power === 1) {
          pushInt(mul(num(c), call("log", call("abs", lin))));
          usesLog = true;
        } else {
          const k = b.power - 1;
          pushInt(div(num(-c / k), k === 1 ? lin : pow(lin, num(k))));
        }
      } else if (b.kind === "complexB") {
        const B = c;
        const C = coefficients[i + 1];
        i++;
        if (B === 0 && C === 0) continue;
        const quad = quadraticFactorAst(b.p, b.q);
        const top = B === 0 ? num(C) : C === 0 ? mul(num(B), VAR()) : add(mul(num(B), VAR()), num(C));
        pushDec(div(top, quad));
        if (B !== 0) {
          pushInt(mul(num(B / 2), call("log", quad)));
          usesLog = true;
        }
        const atanCoef = snapNumber((C + B * b.p) / b.q, 1e-10);
        if (Math.abs(atanCoef) > 1e-13) {
          pushInt(mul(num(atanCoef), call("atan", div(linearFactorAst(b.p), num(b.q)))));
          usesAtan = true;
        }
      }
    }
    const nonZeroTerms = coefficients.filter(c => c !== 0).length;
    if (polyDegree(denominator) >= 2 && nonZeroTerms > 1) addRule(rules, RULE.partial);
    if (usesLog) addRule(rules, RULE.log);
    if (usesAtan) addRule(rules, RULE.atan);
    return { ast: integral || num(0), decomposition: decomposition || num(0), pf };
  }

  // ── Reglas de integración ──────────────────────────────────────────────────

  const RULE = {
    constant: "Integral de una constante",
    power: "Regla de potencia",
    log: "Integral logarítmica",
    trig: "Integral trigonométrica directa",
    trigIdentity: "Identidad trigonométrica",
    exp: "Regla exponencial",
    hyperbolic: "Integral hiperbólica",
    linearSub: "Cambio de variable lineal",
    substitution: "Cambio de variable",
    parts: "Integración por partes",
    partial: "Fracciones parciales",
    division: "División de polinomios",
    atan: "Integral de arcotangente",
    asin: "Integral de arcoseno",
    completeSquare: "Completar el cuadrado",
    abs: "Valor absoluto",
    numeric: "Integración numérica adaptativa (Gauss–Kronrod)"
  };

  const RULE_FORMULAS = {
    [RULE.constant]: "\\int k\\,dx=kx+C",
    [RULE.power]: "\\int x^n\\,dx=\\frac{x^{n+1}}{n+1}+C\\quad(n\\ne -1)",
    [RULE.log]: "\\int\\frac{1}{x}\\,dx=\\ln|x|+C",
    [RULE.trig]: "\\int\\sin x\\,dx=-\\cos x+C,\\quad\\int\\cos x\\,dx=\\sin x+C",
    [RULE.trigIdentity]: "\\sin^2 u=\\frac{1-\\cos 2u}{2},\\quad\\cos^2 u=\\frac{1+\\cos 2u}{2}",
    [RULE.exp]: "\\int e^{ax}\\,dx=\\frac{e^{ax}}{a}+C",
    [RULE.hyperbolic]: "\\int\\sinh x\\,dx=\\cosh x+C,\\quad\\int\\cosh x\\,dx=\\sinh x+C",
    [RULE.linearSub]: "\\int f(ax+b)\\,dx=\\frac{1}{a}F(ax+b)+C",
    [RULE.substitution]: "\\int f(g(x))\\,g'(x)\\,dx=F(g(x))+C",
    [RULE.parts]: "\\int u\\,dv=uv-\\int v\\,du",
    [RULE.partial]: "\\frac{P(x)}{Q(x)}=\\sum\\frac{A}{(x-r)^k}+\\sum\\frac{Bx+C}{x^2+px+q}",
    [RULE.division]: "\\frac{P(x)}{Q(x)}=S(x)+\\frac{R(x)}{Q(x)}",
    [RULE.atan]: "\\int\\frac{dx}{(x-p)^2+q^2}=\\frac{1}{q}\\arctan\\frac{x-p}{q}+C",
    [RULE.asin]: "\\int\\frac{dx}{\\sqrt{a^2-x^2}}=\\arcsin\\frac{x}{a}+C",
    [RULE.completeSquare]: "ax^2+bx+c=a\\left(x+\\frac{b}{2a}\\right)^2+c-\\frac{b^2}{4a}",
    [RULE.abs]: "\\int|x|\\,dx=\\frac{x|x|}{2}+C",
    [RULE.numeric]: "\\int_a^b f(x)\\,dx\\approx\\sum_i w_i\\,f(x_i)\\quad\\text{(Gauss–Kronrod adaptativo)}"
  };

  function addRule(rules, label) {
    if (rules && !rules.includes(label)) rules.push(label);
  }

  function formulaForRule(rule) {
    const labels = String(rule || "").split(" + ");
    const priority = [RULE.parts, RULE.partial, RULE.substitution, RULE.completeSquare, RULE.trigIdentity, RULE.atan, RULE.asin, RULE.linearSub];
    const chosen = priority.find(label => labels.includes(label)) || labels.find(label => RULE_FORMULAS[label]);
    return RULE_FORMULAS[chosen] || RULE_FORMULAS[RULE.power];
  }

  const ELEMENTARY = {
    sin: { rule: RULE.trig, G: u => neg(call("cos", u)) },
    cos: { rule: RULE.trig, G: u => call("sin", u) },
    tan: { rule: RULE.trig, G: u => neg(call("log", call("abs", call("cos", u)))) },
    cot: { rule: RULE.trig, G: u => call("log", call("abs", call("sin", u))) },
    sec: { rule: RULE.trig, G: u => call("log", call("abs", add(call("sec", u), call("tan", u)))) },
    csc: { rule: RULE.trig, G: u => neg(call("log", call("abs", add(call("csc", u), call("cot", u))))) },
    exp: { rule: RULE.exp, G: u => call("exp", u) },
    log: { rule: RULE.parts, G: u => sub(mul(u, call("log", call("abs", u))), u) },
    log10: { rule: RULE.parts, G: u => div(sub(mul(u, call("log", call("abs", u))), u), call("log", num(10))) },
    sqrt: { rule: RULE.power, G: u => mul(num(2 / 3), pow(u, num(1.5))) },
    cbrt: { rule: RULE.power, G: u => mul(num(0.75), pow(u, num(4 / 3))) },
    sinh: { rule: RULE.hyperbolic, G: u => call("cosh", u) },
    cosh: { rule: RULE.hyperbolic, G: u => call("sinh", u) },
    tanh: { rule: RULE.hyperbolic, G: u => call("log", call("cosh", u)) },
    asin: { rule: RULE.parts, G: u => add(mul(u, call("asin", u)), call("sqrt", sub(num(1), pow(u, num(2))))) },
    acos: { rule: RULE.parts, G: u => sub(mul(u, call("acos", u)), call("sqrt", sub(num(1), pow(u, num(2))))) },
    atan: { rule: RULE.parts, G: u => sub(mul(u, call("atan", u)), mul(num(0.5), call("log", add(num(1), pow(u, num(2)))))) },
    abs: { rule: RULE.abs, G: u => mul(num(0.5), mul(u, call("abs", u))) }
  };

  const TRIG_SQUARES = {
    sec: { rule: RULE.trig, G: u => call("tan", u) },
    csc: { rule: RULE.trig, G: u => neg(call("cot", u)) },
    sin: { rule: RULE.trigIdentity, G: u => sub(mul(num(0.5), u), mul(num(0.25), call("sin", mul(num(2), u)))) },
    cos: { rule: RULE.trigIdentity, G: u => add(mul(num(0.5), u), mul(num(0.25), call("sin", mul(num(2), u)))) },
    tan: { rule: RULE.trigIdentity, G: u => sub(call("tan", u), u) },
    cot: { rule: RULE.trigIdentity, G: u => neg(add(call("cot", u), u)) }
  };

  const RECIPROCAL = { sin: "csc", cos: "sec", tan: "cot", sec: "cos", csc: "sin", cot: "tan" };

  function scaleByLinear(G, lin, rules) {
    const isPlainX = Math.abs(lin.a - 1) < 1e-13 && Math.abs(lin.b) < 1e-13;
    if (!isPlainX) addRule(rules, RULE.linearSub);
    return isPlainX ? G : mul(num(1 / lin.a), G);
  }

  function integrateSqrtQuadratic(base, exponent, rules) {
    const q = polynomialFromAst(base);
    if (!q || q.length !== 3 || Math.abs(q[2]) < 1e-13) return null;
    const [C, B, A] = q;
    const h = B / (2 * A);
    const D = C - B * B / (4 * A);
    if (Math.abs(D) < 1e-12) return null;
    const u = simplify(add(VAR(), num(h)));
    const Q = polynomialToAst(q);
    if (Math.abs(h) > 1e-13) addRule(rules, RULE.completeSquare);
    if (A < 0 && D > 0) {
      const k = -A;
      const arcsin = call("asin", mul(num(Math.sqrt(k / D)), u));
      addRule(rules, RULE.asin);
      if (exponent === -0.5) return mul(num(1 / Math.sqrt(k)), arcsin);
      return add(mul(mul(num(0.5), u), call("sqrt", Q)), mul(num(D / (2 * Math.sqrt(k))), arcsin));
    }
    if (A > 0) {
      const logTerm = call("log", call("abs", add(mul(num(Math.sqrt(A)), u), call("sqrt", Q))));
      addRule(rules, RULE.log);
      if (exponent === -0.5) return mul(num(1 / Math.sqrt(A)), logTerm);
      return add(mul(mul(num(0.5), u), call("sqrt", Q)), mul(num(D / (2 * Math.sqrt(A))), logTerm));
    }
    return null;
  }

  function integrateSingle(f, rules) {
    if (f.type === "pow" && !dependsOnX(f.right)) {
      const exponentValue = evaluateAst(f.right);
      const lin = linearOf(f.left);
      if (lin) {
        if (Math.abs(exponentValue + 1) < 1e-13) {
          addRule(rules, RULE.log);
          return scaleByLinear(call("log", call("abs", f.left)), lin, rules);
        }
        addRule(rules, RULE.power);
        const n1 = isPurelyNumeric(f.right) ? num(exponentValue + 1) : add(f.right, num(1));
        return scaleByLinear(div(pow(f.left, n1), n1), lin, rules);
      }
      if (f.left.type === "call" && f.left.args.length === 1) {
        const argLin = linearOf(f.left.args[0]);
        const name = f.left.name;
        if (argLin && exponentValue === 2 && TRIG_SQUARES[name]) {
          addRule(rules, TRIG_SQUARES[name].rule);
          return scaleByLinear(TRIG_SQUARES[name].G(f.left.args[0]), argLin, rules);
        }
        if (argLin && exponentValue === -1 && RECIPROCAL[name]) {
          const entry = ELEMENTARY[RECIPROCAL[name]];
          addRule(rules, entry.rule);
          return scaleByLinear(entry.G(f.left.args[0]), argLin, rules);
        }
        if (argLin && exponentValue === -2 && (name === "cos" || name === "sin")) {
          const entry = TRIG_SQUARES[name === "cos" ? "sec" : "csc"];
          addRule(rules, entry.rule);
          return scaleByLinear(entry.G(f.left.args[0]), argLin, rules);
        }
      }
      if (exponentValue === 0.5 || exponentValue === -0.5) return integrateSqrtQuadratic(f.left, exponentValue, rules);
      return null;
    }
    if (f.type === "pow" && !dependsOnX(f.left)) {
      const lin = linearOf(f.right);
      const base = evaluateAst(f.left);
      if (!lin || !(base > 0) || Math.abs(base - 1) < 1e-15) return null;
      addRule(rules, RULE.exp);
      const G = f.left.type === "const" && f.left.name === "e" ? f : div(f, call("log", f.left));
      return scaleByLinear(G, lin, rules);
    }
    if (f.type === "call" && f.args.length === 1 && ELEMENTARY[f.name]) {
      const lin = linearOf(f.args[0]);
      if (lin) {
        addRule(rules, ELEMENTARY[f.name].rule);
        return scaleByLinear(ELEMENTARY[f.name].G(f.args[0]), lin, rules);
      }
      if (f.name === "sqrt") return integrateSqrtQuadratic(f.args[0], 0.5, rules);
    }
    return null;
  }

  // Descompone un producto en coeficiente numérico, constantes y factores con x.
  function flattenProduct(node) {
    const out = { coef: 1, constants: [], factors: [] };
    const visit = (n, inverse) => {
      if (n.type === "mul") {
        visit(n.left, inverse);
        visit(n.right, inverse);
        return;
      }
      if (n.type === "div") {
        visit(n.left, inverse);
        visit(n.right, !inverse);
        return;
      }
      if (n.type === "neg") {
        out.coef = -out.coef;
        visit(n.arg, inverse);
        return;
      }
      if (n.type === "num") {
        out.coef = inverse ? out.coef / n.value : out.coef * n.value;
        return;
      }
      let factor = n;
      if (n.type === "call" && n.name === "sqrt") factor = pow(n.args[0], num(0.5));
      if (inverse) factor = factor.type === "pow" ? pow(factor.left, factor.right.type === "num" ? num(-factor.right.value) : neg(factor.right)) : pow(factor, num(-1));
      (dependsOnX(n) ? out.factors : out.constants).push(factor);
    };
    visit(node, false);
    out.factors = combineLikeFactors(out.factors);
    return out;
  }

  // x^2 · x^(-1/2) → x^(3/2)
  function combineLikeFactors(factors) {
    const groups = new Map();
    const order = [];
    for (const factor of factors) {
      const base = factor.type === "pow" && factor.right.type === "num" ? factor.left : factor;
      const exponent = factor.type === "pow" && factor.right.type === "num" ? factor.right.value : 1;
      const key = astToString(base);
      if (factor.type === "pow" && factor.right.type !== "num") {
        order.push({ key: `${key}#${order.length}`, base: factor, exponent: 1 });
        continue;
      }
      if (groups.has(key)) {
        groups.get(key).exponent += exponent;
      } else {
        const entry = { key, base, exponent };
        groups.set(key, entry);
        order.push(entry);
      }
    }
    return order
      .filter(entry => Math.abs(entry.exponent) > 1e-13)
      .map(entry => (Math.abs(entry.exponent - 1) < 1e-13 ? entry.base : pow(entry.base, num(snapNumber(entry.exponent, 1e-12)))));
  }

  function buildProduct(factors) {
    if (!factors.length) return num(1);
    return factors.slice(1).reduce((acc, factor) => mul(acc, factor), factors[0]);
  }

  function rationalFromFactors(factors) {
    let numerator = [1];
    let denominator = [1];
    for (const factor of factors) {
      const p = polynomialFromAst(factor);
      if (p) {
        numerator = polyMul(numerator, p);
        continue;
      }
      if (factor.type === "pow" && factor.right.type === "num" && Number.isInteger(factor.right.value) && factor.right.value < 0) {
        const base = polynomialFromAst(factor.left);
        if (!base) return null;
        for (let k = 0; k < -factor.right.value; k++) denominator = polyMul(denominator, base);
        continue;
      }
      return null;
    }
    if (polyDegree(denominator) < 1) return null;
    return { numerator, denominator };
  }

  // u = g(x): busca factores de la forma k·F'(g(x))·g'(x).
  const RATIO_POINTS = [0.3719, 0.8113, 1.2297, 1.9031, 2.6113, -0.5179, -1.3311, 3.4127, 0.0917, 4.73, -2.37];

  function constantRatio(numerator, denominator) {
    const ratios = [];
    for (const x of RATIO_POINTS) {
      const top = evaluateAst(numerator, x);
      const bottom = evaluateAst(denominator, x);
      if (!Number.isFinite(top) || !Number.isFinite(bottom) || Math.abs(bottom) < 1e-12) continue;
      ratios.push(top / bottom);
    }
    if (ratios.length < 3) return null;
    const k = ratios[0];
    if (!Number.isFinite(k) || Math.abs(k) < 1e-14) return null;
    if (!ratios.every(r => Math.abs(r - k) <= 1e-9 * Math.max(1, Math.abs(k)))) return null;
    return snapNumber(k, 1e-10);
  }

  function integrateBySubstitution(factors, rules, recurse) {
    const candidates = [];
    factors.forEach((f, index) => {
      const push = (inner, outer) => {
        if (dependsOnX(inner) && !linearOf(inner)) candidates.push({ index, inner, outer });
      };
      if (factors.length > 1) push(f, VAR());
      if (f.type === "pow" && !dependsOnX(f.right)) push(f.left, pow(VAR(), f.right));
      if (f.type === "pow" && !dependsOnX(f.left)) push(f.right, pow(f.left, VAR()));
      if (f.type === "call" && f.args.length === 1) push(f.args[0], call(f.name, VAR()));
      if (f.type === "pow" && f.left.type === "call" && f.left.args.length === 1 && !dependsOnX(f.right)) {
        push(f.left.args[0], pow(call(f.left.name, VAR()), f.right));
      }
    });
    for (const candidate of candidates) {
      const derivative = differentiate(candidate.inner);
      if (!derivative) continue;
      const rest = buildProduct(factors.filter((_, j) => j !== candidate.index));
      const k = constantRatio(rest, derivative);
      if (k === null) continue;
      const localRules = [];
      const G = recurse(candidate.outer, localRules);
      if (!G) continue;
      addRule(rules, RULE.substitution);
      localRules.forEach(rule => addRule(rules, rule));
      return mul(num(k), substituteVar(G, candidate.inner));
    }
    return integrateByNestedSubstitution(factors, rules, recurse);
  }

  // u = s(x) anidada: un factor es k·s'(x) y el resto depende de x solo a través de s(x).
  // Ejemplo: cos(x)/(1 + sin(x)^2) con u = sin(x).
  function collectSubexpressions(node, out = new Map()) {
    if (!node || !dependsOnX(node)) return out;
    if (node.type === "call" || node.type === "pow" || node.type === "add" || node.type === "sub") {
      if (!linearOf(node)) out.set(astToString(node), node);
    }
    if (node.type === "neg") collectSubexpressions(node.arg, out);
    else if (node.type === "call") node.args.forEach(arg => collectSubexpressions(arg, out));
    else if (node.left) {
      collectSubexpressions(node.left, out);
      collectSubexpressions(node.right, out);
    }
    return out;
  }

  function replaceSubexpression(node, key) {
    if (astToString(node) === key) return { type: "var", placeholder: true };
    switch (node.type) {
      case "num": case "var": case "const": return node;
      case "neg": return neg(replaceSubexpression(node.arg, key));
      case "call": return call(node.name, ...node.args.map(arg => replaceSubexpression(arg, key)));
      default: return { type: node.type, left: replaceSubexpression(node.left, key), right: replaceSubexpression(node.right, key) };
    }
  }

  function hasPlainVar(node) {
    switch (node.type) {
      case "var": return !node.placeholder;
      case "num": case "const": return false;
      case "neg": return hasPlainVar(node.arg);
      case "call": return node.args.some(hasPlainVar);
      default: return hasPlainVar(node.left) || hasPlainVar(node.right);
    }
  }

  function integrateByNestedSubstitution(factors, rules, recurse) {
    if (factors.length < 2) return null;
    const subexpressions = new Map();
    factors.forEach(f => collectSubexpressions(f, subexpressions));
    let tried = 0;
    for (const [key, inner] of subexpressions) {
      if (tried++ > 16) break;
      const derivative = differentiate(inner);
      if (!derivative) continue;
      for (let i = 0; i < factors.length; i++) {
        const k = constantRatio(factors[i], derivative);
        if (k === null) continue;
        const rest = replaceSubexpression(buildProduct(factors.filter((_, j) => j !== i)), key);
        if (hasPlainVar(rest)) continue;
        const localRules = [];
        const G = recurse(rest, localRules);
        if (!G) continue;
        addRule(rules, RULE.substitution);
        localRules.forEach(rule => addRule(rules, rule));
        return mul(num(k), substituteVar(G, inner));
      }
    }
    return null;
  }

  const TABULAR = new Set(["exp", "sin", "cos", "sinh", "cosh"]);

  function isTabularFactor(f) {
    if (f.type === "call" && TABULAR.has(f.name)) return Boolean(linearOf(f.args[0]));
    if (f.type === "pow" && !dependsOnX(f.left)) return Boolean(linearOf(f.right));
    return false;
  }

  function integrateByParts(factors, rules, recurse) {
    let poly = [1];
    let other = null;
    for (const f of factors) {
      const p = polynomialFromAst(f);
      if (p) {
        poly = polyMul(poly, p);
        continue;
      }
      if (other) return null;
      other = f;
    }
    if (!other || polyDegree(poly) < 1) return null;

    if (isTabularFactor(other)) {
      addRule(rules, RULE.parts);
      let derivative = poly;
      let anti = other;
      let sign = 1;
      let result = null;
      for (let k = 0; k <= polyDegree(poly); k++) {
        anti = recurse(anti, rules);
        if (!anti) return null;
        const term = mul(polynomialToAst(derivative), anti);
        result = result ? (sign > 0 ? add(result, term) : sub(result, term)) : term;
        derivative = polyDerivative(derivative);
        sign = -sign;
      }
      return result;
    }

    if (other.type === "call" && ["log", "log10", "atan"].includes(other.name)) {
      const lin = linearOf(other.args[0]);
      if (!lin) return null;
      addRule(rules, RULE.parts);
      const Q = polyIntegral(poly);
      const linPoly = [lin.b, lin.a];
      let restNumerator;
      let restDenominator;
      if (other.name === "atan") {
        restNumerator = Q.map(c => c * lin.a);
        restDenominator = polyAdd([1], polyMul(linPoly, linPoly));
      } else {
        const scale = other.name === "log10" ? lin.a / Math.LN10 : lin.a;
        restNumerator = Q.map(c => c * scale);
        restDenominator = linPoly;
      }
      const rest = rationalIntegral(restNumerator, restDenominator, []);
      if (!rest) return null;
      return sub(mul(polynomialToAst(Q), other), rest.ast);
    }
    return null;
  }

  function trigLinear(f) {
    if (f.type !== "call" || !["sin", "cos"].includes(f.name)) return null;
    const lin = linearOf(f.args[0]);
    return lin ? { name: f.name, arg: f.args[0], lin } : null;
  }

  function expLinear(f) {
    if (f.type === "call" && f.name === "exp") {
      const lin = linearOf(f.args[0]);
      return lin ? { node: f, rate: lin.a } : null;
    }
    if (f.type === "pow" && !dependsOnX(f.left)) {
      const lin = linearOf(f.right);
      const base = evaluateAst(f.left);
      return lin && base > 0 && base !== 1 ? { node: f, rate: lin.a * Math.log(base) } : null;
    }
    return null;
  }

  function integrateKnownProduct(factors, rules, recurse) {
    if (factors.length !== 2) return null;
    const [f, g] = factors;

    // sec·tan, csc·cot con el mismo argumento lineal
    const pair = (a, b, n1, n2) => a.type === "call" && b.type === "call" && a.name === n1 && b.name === n2 && sameAst(a.args[0], b.args[0]);
    for (const [a, b] of [[f, g], [g, f]]) {
      const lin = a.type === "call" ? linearOf(a.args[0]) : null;
      if (!lin) continue;
      if (pair(a, b, "sec", "tan")) {
        addRule(rules, RULE.trig);
        return scaleByLinear(call("sec", a.args[0]), lin, rules);
      }
      if (pair(a, b, "csc", "cot")) {
        addRule(rules, RULE.trig);
        return scaleByLinear(neg(call("csc", a.args[0])), lin, rules);
      }
    }

    // e^(αx+β)·sin/cos(γx+δ)
    for (const [a, b] of [[f, g], [g, f]]) {
      const e = expLinear(a);
      const t = trigLinear(b);
      if (!e || !t) continue;
      addRule(rules, RULE.parts);
      const alpha = e.rate;
      const gamma = t.lin.a;
      const scale = 1 / (alpha * alpha + gamma * gamma);
      const sinU = call("sin", t.arg);
      const cosU = call("cos", t.arg);
      const inner = t.name === "sin"
        ? sub(mul(num(alpha * scale), sinU), mul(num(gamma * scale), cosU))
        : add(mul(num(alpha * scale), cosU), mul(num(gamma * scale), sinU));
      return mul(e.node, inner);
    }

    // Producto a suma: sin·cos, sin·sin, cos·cos con argumentos lineales
    const t1 = trigLinear(f);
    const t2 = trigLinear(g);
    if (t1 && t2) {
      addRule(rules, RULE.trigIdentity);
      const combine = (p, q, sign) => polynomialToAst([p.lin.b + sign * q.lin.b, p.lin.a + sign * q.lin.a]);
      let sum;
      if (t1.name === "sin" && t2.name === "cos") sum = add(call("sin", combine(t1, t2, 1)), call("sin", combine(t1, t2, -1)));
      else if (t1.name === "cos" && t2.name === "sin") sum = add(call("sin", combine(t2, t1, 1)), call("sin", combine(t2, t1, -1)));
      else if (t1.name === "cos") sum = add(call("cos", combine(t1, t2, -1)), call("cos", combine(t1, t2, 1)));
      else sum = sub(call("cos", combine(t1, t2, -1)), call("cos", combine(t1, t2, 1)));
      const expanded = simplify(mul(num(0.5), sum));
      return recurse(expanded, rules);
    }
    return null;
  }

  function distribute(factors) {
    if (factors.length < 2) return null;
    const index = factors.findIndex(f => f.type === "add" || f.type === "sub");
    if (index < 0) return null;
    const rest = buildProduct(factors.filter((_, j) => j !== index));
    const s = factors[index];
    return { type: s.type, left: mul(s.left, rest), right: mul(s.right, rest) };
  }

  function integrateAst(node, rules = [], depth = 0) {
    if (!node || depth > 14) return null;
    const recurse = (n, r = rules) => integrateAst(n, r, depth + 1);

    if (!dependsOnX(node)) {
      addRule(rules, RULE.constant);
      return mul(node, VAR());
    }

    switch (node.type) {
      case "var":
        addRule(rules, RULE.power);
        return mul(num(0.5), pow(VAR(), num(2)));
      case "neg": {
        const inner = recurse(node.arg);
        return inner && neg(inner);
      }
      case "add": case "sub": {
        const l = recurse(node.left);
        if (!l) return null;
        const r = recurse(node.right);
        return r ? { type: node.type, left: l, right: r } : null;
      }
      default: break;
    }

    const { coef, constants, factors } = flattenProduct(node);
    if (!factors.length) {
      addRule(rules, RULE.constant);
      return mul(node, VAR());
    }
    const product = buildProduct(factors);
    if (coef !== 1 || constants.length) {
      const inner = recurse(product);
      if (!inner) return null;
      const constant = constants.reduce((acc, c) => mul(acc, c), num(coef));
      return mul(constant, inner);
    }

    if (factors.length === 1) {
      const single = integrateSingle(factors[0], rules);
      if (single) return single;
    }

    const poly = polynomialFromAst(product);
    if (poly) {
      addRule(rules, RULE.power);
      return polynomialToAst(polyIntegral(poly));
    }

    const rational = rationalFromFactors(factors);
    if (rational) {
      const result = rationalIntegral(rational.numerator, rational.denominator, rules);
      if (result) return result.ast;
    }

    const known = integrateKnownProduct(factors, rules, recurse);
    if (known) return known;

    const parts = integrateByParts(factors, rules, recurse);
    if (parts) return parts;

    const substitution = integrateBySubstitution(factors, rules, recurse);
    if (substitution) return substitution;

    const expanded = distribute(factors);
    if (expanded) return recurse(expanded);

    if (factors.length === 1 && factors[0].type === "pow" && factors[0].left.type === "add") {
      const p = polynomialFromAst(factors[0]);
      if (p) return recurse(polynomialToAst(p));
    }
    return null;
  }

  // ── Verificación numérica de una primitiva ─────────────────────────────────

  function verifyAntiderivative(f, F, points) {
    const sample = points && points.length ? points : [-2.71, -1.93, -1.17, -0.61, -0.23, 0.37, 0.83, 1.41, 1.97, 2.63, 3.31, 4.07];
    let valid = 0;
    let failed = 0;
    for (const x of sample) {
      const fx = f(x);
      if (!Number.isFinite(fx) || Math.abs(fx) > 1e6) continue;
      const h = 1e-3 * Math.max(1, Math.abs(x));
      const values = [F(x - 2 * h), F(x - h), F(x + h), F(x + 2 * h)];
      if (values.some(v => !Number.isFinite(v))) continue;
      const derivative = (values[0] - 8 * values[1] + 8 * values[2] - values[3]) / (12 * h);
      valid++;
      if (Math.abs(derivative - fx) > 1e-5 * (1 + Math.abs(fx))) failed++;
    }
    return valid >= 3 && failed <= Math.floor(valid * 0.1);
  }

  // ── Integración numérica ───────────────────────────────────────────────────

  const XGK = [0.991455371120812639206854697526329, 0.949107912342758524526189684047851, 0.864864423359769072789712788640926, 0.741531185599394439863864773280788, 0.586087235467691130294144845693013, 0.405845151377397166906606412076961, 0.207784955007898467600689403773245, 0];
  const WGK = [0.022935322010529224963732008058970, 0.063092092629978553290700663189204, 0.104790010322250183839876322541518, 0.140653259715525918745189590510238, 0.169004726639267902826583426598550, 0.190350578064785409913256402421014, 0.204432940075298892414161999234649, 0.209482141084727828012999174891714];
  const WG = [0.129484966168869693270611432679082, 0.279705391489276667901467771423780, 0.381830050505118944950369775488975, 0.417959183673469387755102040816327];

  function gaussKronrod15(fn, a, b) {
    const center = (a + b) / 2;
    const half = (b - a) / 2;
    let nonFinite = 0;
    const f = x => {
      const y = fn(x);
      if (Number.isFinite(y)) return y;
      nonFinite++;
      return 0;
    };
    const fc = f(center);
    let kronrod = fc * WGK[7];
    let gauss = fc * WG[3];
    for (let j = 0; j < 7; j++) {
      const dx = half * XGK[j];
      const sum = f(center - dx) + f(center + dx);
      kronrod += WGK[j] * sum;
      if (j % 2 === 1) gauss += WG[(j - 1) / 2] * sum;
    }
    return { a, b, value: kronrod * half, error: Math.abs((kronrod - gauss) * half), nonFinite };
  }

  function adaptiveGaussKronrod(fn, a, b, options = {}) {
    if (a === b) return { value: 0, error: 0, converged: true, nonFinite: 0, intervals: 0 };
    const sign = b > a ? 1 : -1;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const absTol = options.absTol ?? 1e-11;
    const relTol = options.relTol ?? 1e-10;
    const maxIntervals = options.maxIntervals ?? 1200;
    const list = [gaussKronrod15(fn, lo, hi)];
    let total = list[0].value;
    let totalError = list[0].error;
    let stuck = false;

    while (totalError > Math.max(absTol, relTol * Math.abs(total)) && list.length < maxIntervals) {
      let worst = 0;
      for (let i = 1; i < list.length; i++) if (list[i].error > list[worst].error) worst = i;
      const segment = list[worst];
      const mid = (segment.a + segment.b) / 2;
      if (!(mid > segment.a && mid < segment.b)) {
        stuck = true;
        break;
      }
      const left = gaussKronrod15(fn, segment.a, mid);
      const right = gaussKronrod15(fn, mid, segment.b);
      list[worst] = left;
      list.push(right);
      total += left.value + right.value - segment.value;
      totalError += left.error + right.error - segment.error;
    }
    total = list.reduce((sum, s) => sum + s.value, 0);
    totalError = list.reduce((sum, s) => sum + s.error, 0);
    const tolerance = Math.max(absTol, relTol * Math.abs(total));
    return {
      value: sign * total,
      error: totalError,
      converged: !stuck && totalError <= Math.max(tolerance, 1e-12 * Math.abs(total)),
      nonFinite: list.reduce((sum, s) => sum + s.nonFinite, 0),
      intervals: list.length
    };
  }

  function median(values) {
    if (!values.length) return 0;
    const sorted = values.slice().sort((p, q) => p - q);
    return sorted[Math.floor(sorted.length / 2)];
  }

  // Busca polos y zonas donde f no está definida en [left, right].
  function scanSingularities(fn, left, right, samples = 1200) {
    const width = right - left;
    const xs = [];
    const ys = [];
    for (let i = 0; i <= samples; i++) {
      const x = i === samples ? right : left + width * i / samples;
      xs.push(x);
      ys.push(fn(x));
    }
    const finiteAbs = ys.filter(Number.isFinite).map(Math.abs);
    const scale = median(finiteAbs) + 1e-300;
    const poles = [];
    let undefinedCount = 0;

    const addPole = x => {
      if (x <= left || x >= right) return;
      if (poles.every(p => Math.abs(p - x) > width / samples)) poles.push(x);
    };

    const endpointSingular = (x0, direction) => {
      const y0 = fn(x0);
      const probes = [1e-4, 1e-7, 1e-10].map(d => fn(x0 + direction * d * width));
      if (Number.isFinite(y0)) return false;
      if (probes.every(v => !Number.isFinite(v))) return true;
      const [p1, p2, p3] = probes;
      if (!Number.isFinite(p2) || !Number.isFinite(p3)) return true;
      return Math.abs(p3 - p2) > 1e-5 * (1 + Math.abs(p3)) || Math.abs(p3) > 1e8 * (1 + Math.abs(p1));
    };

    for (let i = 1; i < samples; i++) {
      const x = xs[i];
      const y = ys[i];
      if (!Number.isFinite(y)) {
        const eps = Math.max(1e-9 * width, 4 * Number.EPSILON * Math.abs(x));
        const yl = fn(x - eps);
        const yr = fn(x + eps);
        const yFar = fn(x + 1000 * eps);
        // Singularidad evitable (sin(x)/x en 0): el límite existe y es el mismo a ambos lados.
        const removable = [yl, yr, yFar].every(Number.isFinite)
          && Math.abs(yl - yr) <= 1e-4 * (1 + Math.abs(yl))
          && Math.abs(yr - yFar) <= 1e-3 * (1 + Math.abs(yr));
        if (removable) continue;
        if (!Number.isFinite(yl) && !Number.isFinite(yr)) {
          undefinedCount++;
          continue;
        }
        addPole(x);
        continue;
      }
      const ay = Math.abs(y);
      const prev = Number.isFinite(ys[i - 1]) ? Math.abs(ys[i - 1]) : 0;
      const next = Number.isFinite(ys[i + 1]) ? Math.abs(ys[i + 1]) : 0;
      if (ay >= prev && ay >= next && ay > 20 * scale) {
        // Búsqueda de sección áurea del máximo de |f| entre muestras vecinas.
        let lo = xs[i - 1];
        let hi = xs[i + 1];
        const g = (Math.sqrt(5) - 1) / 2;
        const absF = t => {
          const v = fn(t);
          return Number.isFinite(v) ? Math.abs(v) : Infinity;
        };
        let c = hi - g * (hi - lo);
        let d = lo + g * (hi - lo);
        let fc = absF(c);
        let fd = absF(d);
        for (let k = 0; k < 90 && hi - lo > 1e-15 * Math.max(1, Math.abs(lo)); k++) {
          if (fc === Infinity) { hi = d; lo = c; break; }
          if (fd === Infinity) { lo = c; hi = d; break; }
          if (fc > fd) {
            hi = d;
            d = c;
            fd = fc;
            c = hi - g * (hi - lo);
            fc = absF(c);
          } else {
            lo = c;
            c = d;
            fc = fd;
            d = lo + g * (hi - lo);
            fd = absF(d);
          }
        }
        const xm = (lo + hi) / 2;
        const peak = Math.max(absF(xm), fc, fd);
        if (peak > 1e10 * (1 + scale)) addPole(snapNumber(xm, 1e-12));
      }
    }
    poles.sort((p, q) => p - q);
    return {
      poles,
      leftSingular: endpointSingular(left, 1),
      rightSingular: endpointSingular(right, -1),
      undefinedFraction: undefinedCount / Math.max(1, samples - 1)
    };
  }

  // Integral con un extremo singular: ¿I(δ) se estabiliza cuando δ → 0?
  function divergesAtEndpoint(fn, s, t) {
    const width = t - s;
    const values = [1e-2, 1e-4, 1e-6, 1e-8].map(delta => adaptiveGaussKronrod(fn, s + delta * width, t, { maxIntervals: 400 }).value);
    if (values.some(v => !Number.isFinite(v))) return true;
    const diffs = values.slice(1).map((v, i) => Math.abs(v - values[i]));
    const scale = 1e-9 * (1 + Math.abs(values[values.length - 1]));
    if (diffs[diffs.length - 1] <= scale) return false;
    const ratios = diffs.slice(1).map((d, i) => (diffs[i] > scale ? d / diffs[i] : 0));
    return ratios.every(r => r > 0.9);
  }

  // Lleva intervalos infinitos a [0, 1) con x = a + t/(1-t).
  function mapToFinite(fn, a, b) {
    if (Number.isFinite(a) && Number.isFinite(b)) return [{ fn, a, b, sign: 1, map: t => t }];
    if (a === b) return [];
    if (a > b) return mapToFinite(fn, b, a).map(piece => ({ ...piece, sign: -piece.sign }));
    const pieces = [];
    if (a === -Infinity && b === Infinity) return [...mapToFinite(fn, -Infinity, 0), ...mapToFinite(fn, 0, Infinity)];
    if (b === Infinity) {
      const map = t => a + t / (1 - t);
      pieces.push({ fn: t => fn(map(t)) / ((1 - t) * (1 - t)), a: 0, b: 1, sign: 1, map });
    } else if (a === -Infinity) {
      const map = t => b - t / (1 - t);
      pieces.push({ fn: t => fn(map(t)) / ((1 - t) * (1 - t)), a: 0, b: 1, sign: 1, map });
    }
    return pieces;
  }

  /*
   * Integral definida numérica robusta.
   * status: "ok" | "improper" (impropia convergente) | "divergent" | "undefined" | "uncertain"
   */
  function integrateNumeric(fn, a, b, options = {}) {
    const result = { value: 0, error: 0, status: "ok", singularities: [], improper: false, nonFinite: 0, undefinedFraction: 0 };
    if (Number.isNaN(a) || Number.isNaN(b)) return { ...result, value: NaN, status: "undefined" };
    if (a === b) return result;
    if (!Number.isFinite(a) || !Number.isFinite(b)) result.improper = true;

    for (const piece of mapToFinite(fn, a, b)) {
      const lo = Math.min(piece.a, piece.b);
      const hi = Math.max(piece.a, piece.b);
      const orientation = piece.b >= piece.a ? 1 : -1;
      const scan = options.scan && Number.isFinite(a) && Number.isFinite(b) ? options.scan : scanSingularities(piece.fn, lo, hi);
      result.undefinedFraction = Math.max(result.undefinedFraction, scan.undefinedFraction);
      result.singularities.push(...scan.poles.map(piece.map));
      if (scan.poles.length || scan.leftSingular || scan.rightSingular) result.improper = true;

      const integrand = options.transform ? x => options.transform(piece.fn(x)) : piece.fn;
      const cuts = [lo, ...scan.poles, hi];
      for (let i = 0; i < cuts.length - 1; i++) {
        const s = cuts[i];
        const t = cuts[i + 1];
        const part = adaptiveGaussKronrod(integrand, s, t);
        result.value += piece.sign * orientation * part.value;
        result.error += part.error;
        result.nonFinite += part.nonFinite;
        const leftSingular = i > 0 || scan.leftSingular;
        const rightSingular = i < cuts.length - 2 || scan.rightSingular;
        if (leftSingular && divergesAtEndpoint(integrand, s, (s + t) / 2)) result.status = "divergent";
        if (rightSingular && divergesAtEndpoint(integrand, t, (s + t) / 2)) result.status = "divergent";
        if (!part.converged && result.status === "ok") result.status = "uncertain";
      }
    }

    if (result.status === "ok" && result.improper) result.status = "improper";
    if (result.status === "uncertain" && result.improper) result.status = "divergent";
    if (result.undefinedFraction > 0.002) result.status = "undefined";
    if (result.status === "divergent" || result.status === "undefined") result.value = NaN;
    result.singularities = result.singularities.filter(Number.isFinite).sort((p, q) => p - q);
    return result;
  }

  function integralStatusMessage(result) {
    const where = result.singularities?.length ? ` (singularidad en x ≈ ${result.singularities.slice(0, 3).map(x => fmt(x, 4)).join(", ")})` : "";
    switch (result.status) {
      case "improper": return `Integral impropia convergente${where}.`;
      case "divergent": return `La integral diverge${where}: el área no es finita.`;
      case "undefined": return "f(x) no está definida (o no es real) en parte del intervalo; la integral no existe en los reales.";
      case "uncertain": return "La integración numérica no alcanzó la precisión pedida; el valor es aproximado.";
      default: return "";
    }
  }

  // Área neta, positiva y negativa con la misma detección de singularidades.
  function analyzeIntegral(fn, a, b) {
    const left = Math.min(a, b);
    const right = Math.max(a, b);
    const scan = scanSingularities(fn, left, right);
    const net = integrateNumeric(fn, a, b, { scan });
    const pos = integrateNumeric(fn, left, right, { scan, transform: y => (y > 0 ? y : 0) });
    const negPart = integrateNumeric(fn, left, right, { scan, transform: y => (y < 0 ? y : 0) });
    const ok = r => r.status === "ok" || r.status === "improper" || r.status === "uncertain";
    const positive = ok(pos) ? pos.value : NaN;
    const negative = ok(negPart) ? negPart.value : NaN;
    return {
      net,
      areas: { pos: positive, neg: negative, net: net.value, total: positive + Math.abs(negative) }
    };
  }

  function signedAreas(fn, a, b) {
    return analyzeIntegral(fn, a, b).areas;
  }

  // ── Sumas de Riemann ───────────────────────────────────────────────────────

  function riemann(fn, a, b, n, method) {
    const dx = (b - a) / n;
    const rects = [];
    let total = 0;
    let invalid = 0;

    for (let i = 1; i <= n; i++) {
      const p = a + (i - 1) * dx;
      const q = a + i * dx;
      let sample = p;
      if (method === "right") sample = q;
      if (method === "midpoint") sample = (p + q) / 2;

      const raw = fn(sample);
      const valid = Number.isFinite(raw);
      if (!valid) invalid++;
      const y = valid ? raw : 0;
      const area = y * dx;
      total += area;
      rects.push({ i, p, q, x0: Math.min(p, q), x1: Math.max(p, q), sample, y, area, cum: total, valid });
    }
    return { dx, rects, sum: total, invalid };
  }

  // ── Calculadora de integrales ──────────────────────────────────────────────

  function evaluateBound(text) {
    const source = String(text ?? "").trim();
    if (!source) throw new ExpressionError("Escribe el límite.");
    let ast;
    try {
      ast = parseExpression(source, { allowInfinity: true });
    } catch (error) {
      throw new ExpressionError(`Límite inválido: ${error.message}`);
    }
    if (dependsOnX(ast)) throw new ExpressionError("Un límite de integración no puede depender de x.");
    const value = evaluateAst(ast);
    if (Number.isNaN(value)) throw new ExpressionError(`Límite inválido: «${source}» no es un número real.`);
    if (!Number.isFinite(value) && !/inf|oo|∞/i.test(source)) throw new ExpressionError(`Límite inválido: «${source}» no es finito. Para infinito escribe inf o -inf.`);
    return value;
  }

  function evaluateAntiderivative(anti, a, b) {
    try {
      const F = compile(anti);
      return F(b) - F(a);
    } catch (_) {
      return NaN;
    }
  }

  function integrateExpression(expr) {
    const ast = typeof expr === "object" ? expr : parseExpression(expr);
    const rules = [];
    const raw = integrateAst(ast, rules);
    if (!raw) return null;
    const result = finalizeAst(raw);
    return { ast: result, rules, text: astToString(result, { fractions: true, spaces: true }) };
  }

  function integrateSimple(expr) {
    const result = integrateExpression(expr);
    if (!result) throw new ExpressionError(`No hay regla simbólica para: ${linearExpr(expr)}`);
    return result.text;
  }

  // Patrones con procedimiento redactado a mano (se mantienen por su explicación).
  const PARTIAL_PATTERNS = [
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
      intg: "log(x**2+4) + 3/2*atan(x/2)",
      steps: [
        { label: "Irreducible", tex: "Q(x)=x^{2}+4", desc: "No factoriza en reales." },
        { label: "Separar", tex: "\\frac{2x+3}{x^{2}+4}=\\frac{2x}{x^{2}+4}+\\frac{3}{x^{2}+4}", desc: "Derivada del denominador más constante." },
        { label: "Logaritmo", tex: "\\int\\frac{2x}{x^{2}+4}dx=\\ln(x^{2}+4)", desc: "Tipo u'/u." },
        { label: "Arcotangente", tex: "\\int\\frac{3}{x^{2}+4}dx=\\tfrac{3}{2}\\arctan\\left(\\tfrac{x}{2}\\right)", desc: "Regla de arcotangente." }
      ]
    }
  ];

  function describeFactors(factors) {
    const parts = [];
    const simple = factors.real.filter(r => r.multiplicity === 1).length;
    const repeated = factors.real.filter(r => r.multiplicity > 1).length;
    if (simple) parts.push(simple === 1 ? "un factor lineal" : `${simple} factores lineales distintos`);
    if (repeated) parts.push(repeated === 1 ? "un factor lineal repetido" : `${repeated} factores lineales repetidos`);
    if (factors.complex.length) parts.push(factors.complex.length === 1 ? "un factor cuadrático irreducible" : `${factors.complex.length} factores cuadráticos irreducibles`);
    return `El denominador tiene ${parts.join(", ")}.`;
  }

  // Fracciones parciales para P(x)/Q(x) con grado de Q ≥ 2 (hasta 6).
  function decomposePartial(expr) {
    let ast;
    try {
      ast = parseExpression(expr);
    } catch (_) {
      return null;
    }
    const clean = astToString(ast);
    const pattern = PARTIAL_PATTERNS.find(p => p.re.test(clean));
    if (pattern) {
      return { ...pattern, ast: parseExpression(pattern.intg), rules: [RULE.partial, RULE.log, ...(/atan/.test(pattern.intg) ? [RULE.atan] : [])] };
    }

    const { coef, constants, factors } = flattenProduct(ast);
    if (constants.length) return null;
    const rational = rationalFromFactors(factors);
    if (!rational || polyDegree(rational.denominator) < 2) return null;
    const numerator = rational.numerator.map(c => c * coef);
    const rules = [];
    const result = rationalIntegral(numerator, rational.denominator, rules);
    if (!result) return null;
    // Una sola fracción simple (1/x², 1/(x²+4)...) se explica mejor con su regla directa.
    const needsDivision = polyDegree(numerator) >= polyDegree(rational.denominator);
    if (!needsDivision && result.pf.coefficients.filter(c => c !== 0).length < 2) return null;

    const integral = finalizeAst(result.ast);
    const decomposition = finalizeAst(result.decomposition);
    const toText = node => astToString(node, { fractions: true, spaces: true });
    const P = polynomialToAst(numerator);
    const Q = polynomialToAst(rational.denominator);
    const { pf } = result;
    const steps = [
      { label: "Planteamiento", tex: `\\frac{${astToLatex(simplify(P))}}{${astToLatex(simplify(Q))}}`, desc: "Leemos numerador P(x) y denominador Q(x)." }
    ];
    if (polyDegree(numerator) >= polyDegree(rational.denominator)) {
      const remainderAst = div(polynomialToAst(pf.remainder), Q);
      steps.push({
        label: "División",
        tex: `\\frac{P(x)}{Q(x)}=${astToLatex(finalizeAst(polynomialToAst(pf.quotient)))}+${astToLatex(finalizeAst(remainderAst))}`,
        desc: "El grado del numerador no es menor que el del denominador: primero dividimos."
      });
    }
    steps.push(
      { label: "Factorizar", tex: `Q(x)=${astToLatex(simplify(factoredDenominatorAst(pf.factors)))}`, desc: describeFactors(pf.factors) },
      { label: "Fracciones parciales", tex: `\\frac{P(x)}{Q(x)}=${astToLatex(decomposition)}`, desc: "Planteamos A/(x−r), B/(x−r)², (Bx+C)/(x²+px+q) y resolvemos el sistema de coeficientes." },
      { label: "Integrar cada término", tex: "\\int\\frac{A}{x-r}dx=A\\ln|x-r|,\\quad\\int\\frac{A}{(x-r)^k}dx=\\frac{-A}{(k-1)(x-r)^{k-1}}", desc: "Cada término es logarítmico, de potencia o de arcotangente." }
    );
    return { dec: toText(decomposition), intg: toText(integral), steps, ast: integral, rules };
  }

  function integrationRuleName(expr, partial) {
    if (partial?.rules?.length) return partial.rules.join(" + ");
    const result = integrateExpression(expr);
    return result ? result.rules.join(" + ") : RULE.numeric;
  }

  /*
   * Resuelve la integral de la calculadora.
   * Devuelve la primitiva (verificada numéricamente), las reglas usadas y,
   * si hay límites, el valor definido con su diagnóstico (impropia, divergente...).
   */
  function solveIntegral(exprText, aText = "", bText = "") {
    const ast = parseExpression(exprText);
    const fn = compile(ast);
    const out = { expr: astToString(ast), ast, fn, partial: null, anti: null, antiAst: null, antiFn: null, rules: [], verified: false, symbolicError: "", definite: null };

    const partial = decomposePartial(exprText);
    let anti = null;
    if (partial) {
      anti = { ast: partial.ast, rules: partial.rules, text: partial.intg };
    } else {
      anti = integrateExpression(ast);
    }

    const hasBounds = String(aText).trim() !== "" && String(bText).trim() !== "";
    const a = hasBounds ? evaluateBound(aText) : NaN;
    const b = hasBounds ? evaluateBound(bText) : NaN;

    if (anti) {
      const antiFn = compile(anti.ast);
      const points = hasBounds && Number.isFinite(a) && Number.isFinite(b)
        ? [0.13, 0.29, 0.41, 0.58, 0.71, 0.87].map(t => a + (b - a) * t)
        : undefined;
      const verified = verifyAntiderivative(fn, antiFn) || (points && verifyAntiderivative(fn, antiFn, points));
      if (verified) {
        out.partial = partial;
        out.anti = anti.text;
        out.antiAst = anti.ast;
        out.antiFn = antiFn;
        out.rules = anti.rules;
        out.verified = true;
      } else {
        out.symbolicError = "La primitiva encontrada no superó la verificación numérica F'(x) = f(x).";
      }
    } else {
      out.symbolicError = `No encontré una primitiva elemental con las reglas disponibles para ${linearExpr(exprText)}.`;
    }

    if (hasBounds) {
      const numeric = integrateNumeric(fn, a, b);
      const definite = {
        a,
        b,
        numeric,
        status: numeric.status,
        value: numeric.value,
        method: "numeric",
        symbolicValue: NaN,
        message: integralStatusMessage(numeric)
      };
      if (out.antiFn && numeric.status === "ok") {
        const symbolicValue = out.antiFn(b) - out.antiFn(a);
        definite.symbolicValue = symbolicValue;
        const agrees = Number.isFinite(symbolicValue)
          && Math.abs(symbolicValue - numeric.value) <= 1e-7 * Math.max(1, Math.abs(symbolicValue)) + 10 * numeric.error;
        if (agrees) {
          definite.value = symbolicValue;
          definite.method = "symbolic";
        } else {
          definite.message = "F(b) − F(a) no coincide con la integración numérica (la primitiva no es continua en el intervalo); se muestra el valor numérico.";
        }
      }
      out.definite = definite;
    }
    return out;
  }

  // ── Geometría (hoja A4) ────────────────────────────────────────────────────

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

  // Fórmula del área de Gauss (lazada) para el polígono marcado.
  function polygonArea(points) {
    if (!points || points.length < 3) return 0;
    let twice = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const q = points[(i + 1) % points.length];
      twice += p.x * q.y - q.x * p.y;
    }
    return Math.abs(twice) / 2;
  }

  function polygonSelfIntersects(points) {
    const n = points.length;
    if (n < 4) return false;
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const intersects = (p1, p2, p3, p4) => {
      const d1 = cross(p3, p4, p1);
      const d2 = cross(p3, p4, p2);
      const d3 = cross(p1, p2, p3);
      const d4 = cross(p1, p2, p4);
      return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
    };
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (j === i + 1 || (i === 0 && j === n - 1)) continue;
        if (intersects(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n])) return true;
      }
    }
    return false;
  }

  // ── Importación de texto ───────────────────────────────────────────────────

  function parseImportedText(text, fileName = "") {
    const clean = String(text || "").trim();
    if (!clean) throw new Error("El archivo está vacío.");

    if (/\.json$/i.test(fileName) || clean.startsWith("{")) {
      let data;
      try {
        data = JSON.parse(clean);
      } catch (_) {
        throw new Error("El JSON del archivo no es válido.");
      }
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

    if (!config.expr && lines.length) config.expr = lines[0].replace(/^f\s*\(\s*x\s*\)\s*=/i, "").trim();
    return config;
  }

  return {
    MAX_N,
    INFINITE_N,
    M,
    RULE,
    ExpressionError,
    tokenizeExpression,
    parseExpression,
    compile,
    evaluateAst,
    realPow,
    astToString,
    astToLatex,
    simplify,
    differentiate,
    polynomialFromAst,
    polynomialRoots,
    partialFractions,
    normalize,
    exprToLatex,
    linearExpr,
    fmt,
    approximateFraction,
    fractionApproxText,
    fractionValueText,
    piMultipleText,
    numberExpr,
    positiveNumberExpr,
    valueTex,
    displayExpr,
    methodLabel,
    clampN,
    riemann,
    adaptiveGaussKronrod,
    scanSingularities,
    integrateNumeric,
    integralStatusMessage,
    analyzeIntegral,
    signedAreas,
    evaluateBound,
    evaluateAntiderivative,
    verifyAntiderivative,
    integrateExpression,
    integrateSimple,
    decomposePartial,
    integrationRuleName,
    formulaForRule,
    solveIntegral,
    polygonYIntervalsAtX,
    polygonArea,
    polygonSelfIntersects,
    parseImportedText
  };
})();

// En el navegador, las funciones quedan disponibles como globales para la interfaz.
const {
  MAX_N, INFINITE_N, M, compile, normalize, exprToLatex, linearExpr, fmt,
  approximateFraction, fractionApproxText, fractionValueText, piMultipleText,
  numberExpr, positiveNumberExpr, valueTex, displayExpr, methodLabel, clampN,
  riemann, integrateNumeric, integralStatusMessage, analyzeIntegral, signedAreas,
  evaluateBound, evaluateAntiderivative, decomposePartial, integrateSimple,
  integrationRuleName, formulaForRule, solveIntegral, polygonYIntervalsAtX,
  polygonArea, polygonSelfIntersects, parseImportedText
} = IntegralCore;

if (typeof module === "object" && module.exports) {
  module.exports = IntegralCore;
}
