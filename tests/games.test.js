"use strict";

// Pruebas de los juegos: cada respuesta marcada como correcta debe serlo.
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../integral_core.js");
const G = require("../games.js");

// Generador pseudoaleatorio con semilla, para rondas reproducibles.
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

test("primitivas: solo la opción correcta deriva en el integrando", () => {
  for (const item of G.PRIMITIVE_ITEMS) {
    const f = C.compile(item.integrand);
    assert.ok(C.verifyAntiderivative(f, C.compile(item.correct)), `${item.correct} debería ser primitiva de ${item.integrand}`);
    for (const wrong of item.distractors) {
      assert.ok(!C.verifyAntiderivative(f, C.compile(wrong)), `${wrong} no debería ser primitiva de ${item.integrand}`);
    }
  }
});

test("métodos y derivadas: la respuesta está entre las opciones", () => {
  for (const item of G.METHOD_ITEMS) assert.ok(G.METHOD_OPTIONS.includes(item.answer), item.tex);
  for (const item of G.DERIVATIVE_ITEMS) assert.ok(G.DERIVATIVE_OPTIONS.includes(item.answer), item.tex);
});

test("área: la opción correcta es la integral y las opciones son distintas", () => {
  const rng = seeded(7);
  for (let i = 0; i < 60; i++) {
    const q = G.areaQuestion(rng);
    const { expr, a, b } = q.art;
    const value = C.integrateNumeric(C.compile(expr), a, b).value;
    assert.ok(Math.abs(Number(q.correctId) - value) < 0.006, `${expr} en [${a}, ${b}]`);
    const ids = q.options.map(o => o.id);
    assert.equal(new Set(ids).size, ids.length, `opciones repetidas: ${ids}`);
    assert.ok(ids.includes(q.correctId));
    assert.ok(ids.length >= 3, `muy pocas opciones: ${ids}`);
  }
});

test("las rondas tienen 10 preguntas sin repetir y una respuesta válida", () => {
  for (const mode of Object.keys(G.MODES)) {
    const round = G.makeRound(mode, seeded(42));
    assert.equal(round.length, G.ROUND_SIZE, mode);
    for (const q of round) {
      assert.ok(q.options.some(o => o.id === q.correctId), `${mode}: ${q.questionTex}`);
      assert.ok(q.questionTex && q.explainTex && q.why, mode);
    }
    if (mode !== "area") assert.equal(new Set(round.map(q => q.questionTex)).size, round.length, `${mode} repite preguntas`);
  }
});
