"use strict";

// Pruebas de las plantillas de la hoja A4.
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../integral_core.js");
const T = require("../a4_templates.js");

test("cada plantilla tiene un área positiva que coincide con su contorno", () => {
  for (const t of T.TEMPLATES) {
    const area = T.exactArea(t);
    assert.ok(area > 0, t.id);
    const fine = C.polygonArea(T.boundary(t, 400));
    assert.ok(Math.abs(fine - area) / area < 1e-3, `${t.id}: polígono ${fine} vs integral ${area}`);
  }
});

test("la curva superior nunca queda por debajo de la inferior", () => {
  for (const t of T.TEMPLATES) {
    const top = C.compile(t.top);
    const bottom = C.compile(t.bottom);
    for (let i = 0; i <= 200; i++) {
      const x = t.a + (t.b - t.a) * i / 200;
      assert.ok(top(x) - bottom(x) >= -1e-9, `${t.id} en x=${x}`);
    }
  }
});

test("el contorno cabe en la hoja y no se cruza", () => {
  for (const t of T.TEMPLATES) {
    const points = T.boundary(t);
    assert.ok(points.every(p => p.x >= 0 && p.x <= T.SHEET.width && p.y >= 0 && p.y <= T.SHEET.height), t.id);
    assert.equal(C.polygonSelfIntersects(points), false, t.id);
  }
});

test("la forma exacta coincide con el valor numérico", () => {
  const exact = {
    "bridge-pool": 56,
    "kidney-pool": 21 * Math.PI - 896 / 75,
    tunnel: 30 + 25 * Math.PI / 2,
    "river-plot": 48 + 3 * (Math.cos(0.5) - Math.cos(8.5)),
    "skate-ramp": 70 / 3,
    garden: 128 / 3,
    "suspension-bridge": 48
  };
  for (const t of T.TEMPLATES) {
    assert.ok(t.exact, t.id);
    assert.ok(Math.abs(T.exactArea(t) - exact[t.id]) < 1e-6, `${t.id}: ${T.exactArea(t)} vs ${exact[t.id]}`);
  }
});

test("el dibujo es un SVG válido del tamaño de la hoja", () => {
  for (const t of T.TEMPLATES) {
    const svg = T.svg(t);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="700" height="990"/);
    assert.ok(!svg.includes("NaN") && !svg.includes("undefined"), t.id);
  }
});

test("la solución se escribe en líneas f(x), g(x) y la integral", () => {
  for (const t of T.TEMPLATES) {
    const lines = T.solutionLines(t);
    assert.equal(lines.length, t.bottom === "0" ? 2 : 3, t.id);
    assert.match(lines[0], /^f\(x\)=/);
    assert.match(lines[lines.length - 1], /^A=\\int_/);
  }
});
