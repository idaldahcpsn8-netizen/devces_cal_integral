"use strict";

/*
 * Plantillas de la hoja A4: escenas dibujadas a escala real (cm) en las que
 * la región que hay que medir está limitada por dos funciones. Así el área
 * exacta se conoce por una integral y se puede comparar con la medición.
 *
 * Coordenadas locales: x en cm desde el margen izquierdo de la escena,
 * y en cm hacia arriba desde la línea base. En la hoja (y hacia abajo):
 *   X = ORIGIN_X + x,   Y = baseY − y.
 */

const A4Templates = (() => {
  const Core = typeof IntegralCore !== "undefined" ? IntegralCore : require("./integral_core.js");

  const SHEET = { width: 21, height: 29.7 };
  const ORIGIN_X = 1.5;
  const TARGET = "#db2777";

  const TEMPLATES = [
    {
      id: "bridge-pool",
      exact: "56",
      name: "Piscina bajo un puente",
      statement: "Un puente de piedra tiene un arco parabólico de 12 cm de ancho y 7 cm de alto. Debajo hay una piscina que llena todo el arco. ¿Qué área tiene la cara del agua bajo el arco?",
      a: 3, b: 15, top: "7*(1 - ((x - 9)/6)^2)", bottom: "0", baseY: 20,
      draw: scene => [
        scene.sky("#dbeafe"),
        scene.sun(17, 4.2, 1.4),
        scene.cloud(4.5, 4.5, 1), scene.cloud(12, 3.2, 0.8),
        scene.ground("#a7d58f", -0.0),
        scene.rect(-1.5, 0, 21, 2.2, "#cfe8f5"),
        scene.tiles(-1.5, -0.2, 21, 2, "#b6dbee"),
        scene.region("#38bdf8"),
        scene.waves(),
        `<path d="${scene.boxMinusRegion(0, 18, 9)}" fill="#cbd5e1" fill-rule="evenodd"/>`,
        scene.bricks(0, 18, 9),
        scene.rect(-0.4, 9.7, 18.8, 0.7, "#94a3b8"),
        scene.railing(-0.2, 18.2, 9.7, 1.1),
        scene.tree(-0.6, 0, 1.2), scene.tree(18.7, 0, 1.4)
      ]
    },
    {
      id: "kidney-pool",
      exact: "21\\pi-\\frac{896}{75}",
      name: "Piscina en forma de riñón",
      statement: "Vista desde arriba de una piscina. El borde superior es medio óvalo y el inferior tiene una entrada curva. ¿Cuánta superficie de agua tiene?",
      a: 2, b: 16,
      top: "4 + 3*sqrt(1 - ((x - 9)/7)^2)",
      bottom: "4 - 3*sqrt(1 - ((x - 9)/7)^2) + 1.6*(1 - ((x - 9)/7)^2)^2",
      baseY: 19,
      draw: scene => [
        scene.rect(-1.5, 30, 21, 60, "#efe3c8"),
        scene.tiles(-1.5, 30, 21, 60, "#e3d3b0"),
        scene.region("#38bdf8", "#0ea5e9", 0.12),
        scene.waves(),
        scene.lounger(1.2, 10.2), scene.lounger(4.2, 10.2), scene.lounger(13, 10.2),
        scene.umbrella(16.6, 10.6, 1.6),
        scene.plant(0.4, -1.6, 0.9), scene.plant(17.6, -1.2, 1.1)
      ]
    },
    {
      id: "tunnel",
      exact: "30+\\frac{25\\pi}{2}",
      name: "Túnel en la montaña",
      statement: "La entrada de un túnel tiene paredes rectas de 3 cm y un techo semicircular de 5 cm de radio. ¿Cuál es el área de la entrada?",
      a: 4, b: 14, top: "3 + sqrt(25 - (x - 9)^2)", bottom: "0", baseY: 20,
      draw: scene => [
        scene.sky("#e0f2fe"),
        scene.cloud(3.5, 3.5, 0.9),
        `<path d="${scene.path([[-1.5, 0], [-1.5, 6], [2, 11], [6, 14.5], [10, 16.5], [14, 13], [17, 10.5], [19.5, 7], [19.5, 0]])} Z" fill="#84a98c"/>`,
        `<path d="${scene.path([[6, 14.5], [10, 16.5], [14, 13], [12.2, 13.4], [10, 14.6], [8, 13.6]])} Z" fill="#f8fafc"/>`,
        scene.ground("#6b8f71"),
        scene.rect(-1.5, 0, 21, 1.4, "#475569"),
        scene.dashes(-1.5, 19.5, -0.7),
        scene.region("#334155"),
        `<path d="${scene.curvePath(x => 3 + Math.sqrt(Math.max(0, 25 - (x - 9) ** 2)) + 0.6, 3.4, 14.6)}" fill="none" stroke="#a8a29e" stroke-width="0.6"/>`,
        scene.lamp(6.2, 2.4), scene.lamp(11.8, 2.4)
      ]
    },
    {
      id: "river-plot",
      exact: "48+3\\left(\\cos\\tfrac{1}{2}-\\cos\\tfrac{17}{2}\\right)",
      name: "Terreno junto al río",
      statement: "Un terreno está entre una carretera recta y la orilla de un río que ondula como y = 3 + 1.5 sen(x/2). ¿Cuánto mide el terreno de x = 1 a x = 17?",
      a: 1, b: 17, top: "3 + 1.5*sin(x/2)", bottom: "0", baseY: 18,
      draw: scene => [
        scene.rect(-1.5, 30, 21, 30, "#bfdbfe"),
        scene.riverWaves(),
        `<path d="${scene.curvePath(x => 3 + 1.5 * Math.sin(x / 2), -1.5, 19.5)} L${scene.path([[19.5, 0], [-1.5, 0]]).replace("M", "")} Z" fill="#d9f99d"/>`,
        scene.rect(-1.5, -1.8, 21, 30, "#d9f99d"),
        scene.region("#86efac"),
        `<path d="${scene.curvePath(x => 3 + 1.5 * Math.sin(x / 2), -1.5, 19.5)}" fill="none" stroke="#a16207" stroke-width="0.25"/>`,
        scene.rect(-1.5, 0, 21, 1.8, "#64748b"),
        scene.dashes(-1.5, 19.5, -0.9),
        scene.fence(1, 17),
        scene.house(7.2, 0.5, 1.6),
        scene.tree(3, 0.6, 0.9), scene.tree(13.5, 0.6, 1)
      ]
    },
    {
      id: "skate-ramp",
      exact: "\\frac{70}{3}",
      name: "Rampa de skate",
      statement: "El perfil de una rampa half-pipe sigue la curva y = 5((x − 9)/7)². ¿Cuánta superficie tiene el perfil de concreto, entre la curva y el suelo?",
      a: 2, b: 16, top: "5*((x - 9)/7)^2", bottom: "0", baseY: 19,
      draw: scene => [
        scene.sky("#fef3c7"),
        scene.sun(4, 4, 1.6),
        scene.city(),
        scene.ground("#e7e5e4"),
        scene.region("#7c8ba1"),
        `<path d="${scene.curvePath(x => 5 * ((x - 9) / 7) ** 2, 2, 16)}" fill="none" stroke="#475569" stroke-width="0.25"/>`,
        scene.rect(1.4, 5.6, 0.6, 5.6, "#64748b"), scene.rect(16, 5.6, 0.6, 5.6, "#64748b"),
        scene.rect(0.2, 5.6, 1.8, 0.4, "#475569"), scene.rect(16, 5.6, 1.8, 0.4, "#475569"),
        scene.skater(13.3, 1.9)
      ]
    },
    {
      id: "garden",
      exact: "\\frac{128}{3}",
      name: "Jardín entre dos senderos",
      statement: "Un jardín queda entre dos senderos: y = 2√x por arriba e y = x²/32 por abajo, de x = 0 a x = 16. ¿Qué área tiene el jardín?",
      a: 0, b: 16, top: "2*sqrt(x)", bottom: "x^2/32", baseY: 20,
      draw: scene => [
        scene.rect(-1.5, 30, 21, 60, "#ecfccb"),
        scene.region("#4ade80"),
        scene.flowers(),
        `<path d="${scene.curvePath(x => 2 * Math.sqrt(x), 0, 17.5)}" fill="none" stroke="#d6b98c" stroke-width="0.7" stroke-linecap="round"/>`,
        `<path d="${scene.curvePath(x => x * x / 32, 0, 17)}" fill="none" stroke="#d6b98c" stroke-width="0.7" stroke-linecap="round"/>`,
        scene.tree(2.4, 8.5, 1.2), scene.tree(14.8, 1.6, 1.1)
      ]
    },
    {
      id: "suspension-bridge",
      exact: "48",
      name: "Puente colgante",
      statement: "El cable de un puente colgante forma la parábola y = 3 + 6((x − 9)/8)² sobre la calzada (y = 2). ¿Qué área hay entre el cable y la calzada, de torre a torre?",
      a: 1, b: 17, top: "3 + 6*((x - 9)/8)^2", bottom: "2", baseY: 20,
      draw: scene => [
        scene.sky("#e0e7ff"),
        scene.sun(15.5, 3.4, 1.3),
        scene.cloud(5, 4, 1),
        scene.rect(-1.5, 2, 21, 30, "#93c5fd"),
        scene.riverWaves(-9, 0.6),
        scene.region("#fde68a"),
        scene.hangers(),
        `<path d="${scene.curvePath(x => 3 + 6 * ((x - 9) / 8) ** 2, -1.5, 19.5)}" fill="none" stroke="#b91c1c" stroke-width="0.25"/>`,
        scene.rect(-1.5, 2, 21, 0.6, "#475569"),
        scene.rect(0.5, 10.4, 1, 10.4, "#b91c1c"), scene.rect(16.5, 10.4, 1, 10.4, "#b91c1c"),
        scene.rect(0.3, 10.8, 1.4, 0.5, "#7f1d1d"), scene.rect(16.3, 10.8, 1.4, 0.5, "#7f1d1d")
      ]
    }
  ];

  function find(id) {
    return TEMPLATES.find(t => t.id === id) || null;
  }

  function regionFunctions(t) {
    return { top: Core.compile(t.top), bottom: Core.compile(t.bottom) };
  }

  function exactArea(t) {
    return Core.integrateNumeric(Core.compile(`(${t.top}) - (${t.bottom})`), t.a, t.b).value;
  }

  function toSheet(t, x, y) {
    return { x: ORIGIN_X + x, y: t.baseY - y };
  }

  // Contorno de la región en cm de la hoja: curva superior de a a b y la
  // inferior de b a a. Sirve para marcar los puntos automáticamente.
  function boundary(t, perCurve = 24) {
    const { top, bottom } = regionFunctions(t);
    const points = [];
    for (let i = 0; i <= perCurve; i++) {
      const x = t.a + (t.b - t.a) * i / perCurve;
      points.push(toSheet(t, x, top(x)));
    }
    for (let i = perCurve; i >= 0; i--) {
      const x = t.a + (t.b - t.a) * i / perCurve;
      const p = toSheet(t, x, bottom(x));
      const last = points[points.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) > 1e-6) points.push(p);
    }
    if (Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < 1e-6) points.pop();
    return points;
  }

  // Solución en líneas cortas: f(x), g(x) (si la hay) y la integral.
  function solutionLines(t) {
    const range = `_{${Core.fmt(t.a)}}^{${Core.fmt(t.b)}}`;
    const f = `f(x)=${Core.exprToLatex(t.top)}`;
    if (t.bottom === "0") return [f, `A=\\int${range}f(x)\\,dx`];
    return [f, `g(x)=${Core.exprToLatex(t.bottom)}`, `A=\\int${range}\\big[f(x)-g(x)\\big]\\,dx`];
  }

  // ── Dibujo (SVG en unidades de cm) ─────────────────────────────────────────

  const n = v => Number(v.toFixed(3));

  function makeScene(t) {
    const P = (x, y) => toSheet(t, x, y);
    const { top, bottom } = regionFunctions(t);
    const path = pts => pts.map(([x, y], i) => {
      const p = P(x, y);
      return `${i ? "L" : "M"}${n(p.x)} ${n(p.y)}`;
    }).join(" ");
    const curvePath = (fn, a, b, steps = 120) => path(Array.from({ length: steps + 1 }, (_, i) => {
      const x = a + (b - a) * i / steps;
      return [x, fn(x)];
    }));
    const regionPath = () => {
      const pts = boundary(t, 120).map(p => `${n(p.x)} ${n(p.y)}`);
      return `M${pts.join(" L")} Z`;
    };
    const rect = (x, y, w, h, fill, extra = "") => {
      const p = P(x, Math.max(y, y - h));
      const q = P(x + w, Math.min(y, y - h));
      return `<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(q.x - p.x)}" height="${n(q.y - p.y)}" fill="${fill}" ${extra}/>`;
    };
    const scene = {
      path, curvePath, rect,
      sky: color => `<rect x="0" y="0" width="${SHEET.width}" height="${t.baseY}" fill="${color}"/>`,
      ground: (color, from = 0) => rect(-1.5, from, 21, 30, color),
      sun: (x, y, r) => `<circle cx="${n(x)}" cy="${n(y)}" r="${r}" fill="#fbbf24"/>`,
      cloud: (x, y, s) => `<g fill="#ffffff"><ellipse cx="${x}" cy="${y}" rx="${1.6 * s}" ry="${0.7 * s}"/><ellipse cx="${x - 0.8 * s}" cy="${y + 0.15 * s}" rx="${0.9 * s}" ry="${0.55 * s}"/><ellipse cx="${x + 0.5 * s}" cy="${y - 0.4 * s}" rx="${0.9 * s}" ry="${0.7 * s}"/></g>`,
      region: (fill, stroke = TARGET, inset = 0) => `<path d="${regionPath()}" fill="${fill}"${inset ? ` stroke="${stroke}" stroke-width="${inset}"` : ""}/>`,
      outline: () => `<path d="${regionPath()}" fill="none" stroke="${TARGET}" stroke-width="0.12" stroke-dasharray="0.35 0.25"/>`,
      boxMinusRegion: (x0, x1, h) => `${path([[x0, 0], [x0, h], [x1, h], [x1, 0]])} Z ${regionPath()}`,
      tiles: (x, y, w, h, color) => {
        const lines = [];
        const p = P(x, y);
        for (let i = 0; i <= w; i += 1) lines.push(`M${n(p.x + i)} ${n(p.y)} V${n(p.y + h)}`);
        for (let j = 0; j <= h; j += 1) lines.push(`M${n(p.x)} ${n(p.y + j)} H${n(p.x + w)}`);
        return `<path d="${lines.join(" ")}" stroke="${color}" stroke-width="0.06"/>`;
      },
      waves: () => {
        const out = [];
        for (let y = 0.6; y < 7; y += 1.1) {
          for (let x = t.a + 0.6; x < t.b - 0.6; x += 2.2) {
            const yy = y + (x % 3) * 0.2;
            if (yy < top(x) - 0.4 && yy > bottom(x) + 0.4 && yy < top(x + 1) - 0.4 && yy > bottom(x + 1) + 0.4) {
              out.push(`<path d="${curvePath(v => yy + 0.12 * Math.sin((v - x) * Math.PI), x, x + 1, 12)}" fill="none" stroke="#e0f2fe" stroke-width="0.09" stroke-linecap="round"/>`);
            }
          }
        }
        return out.join("");
      },
      riverWaves: (yFrom = 6.8, yTo = 18) => {
        const out = [];
        for (let y = yFrom; y < yTo; y += 1.5) {
          for (let x = -0.5 + (y % 2); x < 18.5; x += 3) {
            out.push(`<path d="${curvePath(v => y + 0.12 * Math.sin((v - x) * Math.PI), x, x + 1.2, 12)}" fill="none" stroke="#eff6ff" stroke-width="0.1" stroke-linecap="round"/>`);
          }
        }
        return out.join("");
      },
      bricks: (x0, x1, h) => {
        const out = [];
        for (let y = 1; y < h; y += 1) {
          for (let x = x0; x < x1; x += 2) {
            const xs = x + (y % 2) * 1;
            if (xs + 1.6 > x1) continue;
            if (y < top(xs) + 0.3 && xs > t.a - 0.3 && xs < t.b + 0.3) continue;
            if (y < top(xs + 1.6) + 0.3 && xs + 1.6 > t.a - 0.3 && xs + 1.6 < t.b + 0.3) continue;
            out.push(rect(xs + 0.1, y, 1.6, 0.8, "#b8c2d0", 'rx="0.12"'));
          }
        }
        return out.join("");
      },
      railing: (x0, x1, y, h) => {
        const posts = [];
        for (let x = x0; x <= x1 + 1e-9; x += 1.2) posts.push(rect(x, y + h, 0.18, h, "#64748b"));
        return posts.join("") + rect(x0, y + h, x1 - x0 + 0.18, 0.2, "#64748b");
      },
      tree: (x, y, s) => {
        const trunk = rect(x - 0.15 * s, y + 1.6 * s, 0.3 * s, 1.6 * s, "#92400e");
        const c = P(x, y + 2.4 * s);
        return `${trunk}<circle cx="${n(c.x)}" cy="${n(c.y)}" r="${n(1.2 * s)}" fill="#16a34a"/><circle cx="${n(c.x - 0.5 * s)}" cy="${n(c.y + 0.3 * s)}" r="${n(0.8 * s)}" fill="#22c55e"/>`;
      },
      plant: (x, y, s) => {
        const c = P(x, y);
        return `<circle cx="${n(c.x)}" cy="${n(c.y)}" r="${n(0.9 * s)}" fill="#16a34a"/><circle cx="${n(c.x + 0.4 * s)}" cy="${n(c.y - 0.3 * s)}" r="${n(0.55 * s)}" fill="#4ade80"/>`;
      },
      lounger: (x, y) => rect(x, y, 1.1, 2.6, "#ffffff", 'rx="0.25" stroke="#cbd5e1" stroke-width="0.06"') + rect(x, y, 1.1, 0.8, "#f472b6", 'rx="0.25"'),
      umbrella: (x, y, r) => {
        const c = P(x, y);
        const slices = Array.from({ length: 8 }, (_, i) => {
          const a0 = i * Math.PI / 4;
          const a1 = a0 + Math.PI / 4;
          return `<path d="M${n(c.x)} ${n(c.y)} L${n(c.x + r * Math.cos(a0))} ${n(c.y + r * Math.sin(a0))} L${n(c.x + r * Math.cos(a1))} ${n(c.y + r * Math.sin(a1))} Z" fill="${i % 2 ? "#ffffff" : "#f97316"}"/>`;
        }).join("");
        return `${slices}<circle cx="${n(c.x)}" cy="${n(c.y)}" r="0.12" fill="#7c2d12"/>`;
      },
      dashes: (x0, x1, y) => {
        const out = [];
        for (let x = x0 + 0.3; x < x1; x += 1.6) out.push(rect(x, y + 0.08, 0.9, 0.16, "#f8fafc"));
        return out.join("");
      },
      lamp: (x, y) => {
        const c = P(x, y);
        return `<circle cx="${n(c.x)}" cy="${n(c.y)}" r="0.22" fill="#fde047"/>`;
      },
      fence: (x0, x1) => {
        const out = [];
        for (let x = x0; x <= x1 + 1e-9; x += 1) out.push(rect(x - 0.06, 0.55, 0.12, 0.55, "#a16207"));
        out.push(`<path d="${path([[x0, 0.4], [x1, 0.4]])}" stroke="#a16207" stroke-width="0.08"/>`);
        return out.join("");
      },
      house: (x, y, s) => {
        const body = rect(x, y + 1.4 * s, 2 * s, 1.4 * s, "#fef3c7", 'stroke="#92400e" stroke-width="0.06"');
        const roof = `<path d="${path([[x - 0.2 * s, y + 1.4 * s], [x + s, y + 2.3 * s], [x + 2.2 * s, y + 1.4 * s]])} Z" fill="#dc2626"/>`;
        return body + roof + rect(x + 0.8 * s, y + 0.7 * s, 0.4 * s, 0.7 * s, "#92400e");
      },
      city: () => [
        rect(-1.5, 6, 3, 6, "#e2e8f0"), rect(1.8, 9, 2.4, 9, "#cbd5e1"), rect(4.6, 7, 2.2, 7, "#e2e8f0"),
        rect(7.2, 10.5, 2.6, 10.5, "#cbd5e1"), rect(10.2, 8, 2.3, 8, "#e2e8f0"), rect(12.8, 11.5, 2.4, 11.5, "#cbd5e1"),
        rect(15.6, 7.5, 2.4, 7.5, "#e2e8f0"), rect(18.3, 9.5, 2, 9.5, "#cbd5e1")
      ].join(""),
      skater: (x, y) => {
        const c = P(x, y);
        return `<g transform="translate(${n(c.x)} ${n(c.y)}) rotate(-28)"><rect x="-0.7" y="0" width="1.4" height="0.18" rx="0.09" fill="#f97316"/><circle cx="-0.45" cy="0.3" r="0.12" fill="#1f2937"/><circle cx="0.45" cy="0.3" r="0.12" fill="#1f2937"/><path d="M-0.2 0 L0 -1 L0.25 0 M0 -1 L0 -1.9 M-0.55 -1.5 L0 -1.6 L0.55 -1.3" stroke="#1e3a8a" stroke-width="0.16" stroke-linecap="round" fill="none"/><circle cx="0" cy="-2.2" r="0.3" fill="#fcd34d"/></g>`;
      },
      flowers: () => {
        const out = [];
        const colors = ["#f472b6", "#facc15", "#ffffff", "#c084fc"];
        let k = 0;
        for (let x = t.a + 0.8; x < t.b; x += 1.1) {
          for (let y = bottom(x) + 0.6; y < top(x) - 0.4; y += 1.2) {
            const c = P(x + ((k * 0.37) % 0.5), y + ((k * 0.53) % 0.4));
            out.push(`<circle cx="${n(c.x)}" cy="${n(c.y)}" r="0.16" fill="${colors[k % colors.length]}"/>`);
            k++;
          }
        }
        return out.join("");
      },
      hangers: () => {
        const out = [];
        for (let x = t.a + 1; x < t.b; x += 1) out.push(`<path d="${path([[x, 2], [x, top(x)]])}" stroke="#7f1d1d" stroke-width="0.07"/>`);
        return out.join("");
      }
    };
    return scene;
  }

  function svg(t, { outline = true } = {}) {
    const scene = makeScene(t);
    const parts = t.draw(scene);
    if (outline) parts.push(scene.outline());
    return `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="990" viewBox="0 0 ${SHEET.width} ${SHEET.height}">` +
      `<rect width="${SHEET.width}" height="${SHEET.height}" fill="#ffffff"/>` +
      `<svg x="0" y="0" width="${SHEET.width}" height="${SHEET.height}" overflow="hidden">${parts.join("")}</svg>` +
      `<text x="1.2" y="1.7" font-family="Sora, DM Sans, sans-serif" font-size="0.9" font-weight="600" fill="#0f172a">${t.name}</text>` +
      `</svg>`;
  }

  function svgDataUrl(t, options) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg(t, options))}`;
  }

  return { SHEET, ORIGIN_X, TEMPLATES, find, exactArea, boundary, solutionLines, svg, svgDataUrl };
})();

if (typeof module === "object" && module.exports) {
  module.exports = A4Templates;
}
