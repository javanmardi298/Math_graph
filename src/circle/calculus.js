/**
 * Calculus & trig, drawn on a graph in the safe area (formulas are editable):
 *
 *   tangent     a point slides along f(x); its tangent line shows the slope, and the slope
 *               draws the derivative f'(x) underneath. Pitch follows the slope.
 *   riemann     the area under f(x) from rectangles: 2, 4, 8 … 128 of them close in on the
 *               exact integral (left, middle or right rule).
 *   taylor      a polynomial grows term by term until it hugs sin x, cos x, eˣ, ln(1+x) …
 *   unitcircle  a point turns on the unit circle; its height draws sin θ, its x draws cos θ.
 *
 * Same contract as scenes.js; deterministic, no DOM.
 */
import { tryCompile } from '../math/parser.js';
import { hexA } from './palettes.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmt = (v, d = 2) => (Math.abs(v) < 1e-9 ? '0' : v.toFixed(d));

function fn(src, fallback = 'sin(x)') {
  let c = tryCompile(String(src ?? ''), ['x', 't']);
  if (!c.ok) c = tryCompile(fallback, ['x', 't']);
  return (x, t = 0) => { const v = c.fn({ x, t }); return Number.isFinite(v) ? v : NaN; };
}

function text(D, s, x, y, { size = 15, color, align = 'center', weight = 600, alpha = 0.9 } = {}) {
  const { g, k } = D;
  g.save(); g.globalAlpha = alpha; g.fillStyle = color || '#ffffff';
  g.font = `${weight} ${size * k}px ui-sans-serif, system-ui, sans-serif`; g.textAlign = align; g.textBaseline = 'middle';
  g.fillText(s, x, y); g.restore();
}

/**
 * A graph: math box [x0, x1] × [y0, y1] drawn into the world box (cx, cy, half sizes w, h).
 * Returns px(x) / py(y) mappers to canvas pixels and helpers to draw axes and curves.
 */
function graph(D, box, view) {
  const { cx, cy, w, h } = box, { x0, x1, y0, y1 } = view;
  const wx = (x) => cx - w + ((x - x0) / (x1 - x0)) * 2 * w, wy = (y) => cy - h + ((y - y0) / (y1 - y0)) * 2 * h;
  const G = { px: (x) => D.X(wx(x)), py: (y) => D.Y(wy(clamp(y, y0 - (y1 - y0), y1 + (y1 - y0)))), view, box };
  G.axes = (pal) => {
    const { g, k } = D;
    g.strokeStyle = hexA(pal.ring, 0.14); g.lineWidth = 1 * k;
    for (let x = Math.ceil(x0); x <= x1; x++) { g.beginPath(); g.moveTo(G.px(x), G.py(y0)); g.lineTo(G.px(x), G.py(y1)); g.stroke(); }
    for (let y = Math.ceil(y0); y <= y1; y++) { g.beginPath(); g.moveTo(G.px(x0), G.py(y)); g.lineTo(G.px(x1), G.py(y)); g.stroke(); }
    g.strokeStyle = hexA(pal.ring, 0.55); g.lineWidth = 1.6 * k;
    if (y0 <= 0 && y1 >= 0) { g.beginPath(); g.moveTo(G.px(x0), G.py(0)); g.lineTo(G.px(x1), G.py(0)); g.stroke(); }
    if (x0 <= 0 && x1 >= 0) { g.beginPath(); g.moveTo(G.px(0), G.py(y0)); g.lineTo(G.px(0), G.py(y1)); g.stroke(); }
  };
  G.curve = (f, color, width = 3, { from = x0, to = x1, n = 400, glow = 0, dash } = {}) => {
    const { g, k } = D;
    g.save();
    g.beginPath(); g.rect(G.px(x0), G.py(y1), G.px(x1) - G.px(x0), G.py(y0) - G.py(y1)); g.clip();
    g.strokeStyle = color; g.lineWidth = width * k; g.lineJoin = 'round';
    if (glow) { g.shadowColor = color; g.shadowBlur = glow * k; }
    if (dash) g.setLineDash(dash.map((v) => v * k));
    g.beginPath();
    let pen = false;
    for (let i = 0; i <= n; i++) {
      const x = from + ((to - from) * i) / n, y = f(x);
      if (!Number.isFinite(y) || Math.abs(y) > 1e6) { pen = false; continue; }
      pen ? g.lineTo(G.px(x), G.py(y)) : g.moveTo(G.px(x), G.py(y)); pen = true;
    }
    g.stroke(); g.restore();
  };
  return G;
}

/** Where the moving point is: sweeps the view there and back, `sweep` seconds one way. */
const sweepX = (S, P, x0, x1) => {
  const u = (S.st / Math.max(1, P.sweep)) % 2;
  const v = u < 1 ? u : 2 - u;
  return x0 + (x1 - x0) * (0.04 + 0.92 * (0.5 - 0.5 * Math.cos(Math.PI * v)));
};

const VIEW = (P) => ({ x0: P.xmin, x1: P.xmax, y0: P.ymin, y1: P.ymax });

/* ================================================================ tangent */

const tangent = {
  label: 'Derivative: a tangent line slides along a curve', group: 'Calculus & trig',
  defaults: { f: 'sin(x) + 0.3*x', xmin: -4, xmax: 4, ymin: -3, ymax: 3, sweep: 10, deriv: true, notes: 4 },
  controls: [
    ['f', 'Curve f(x)', 'f', 'x^3/6 - x', ['x', 't']],
    ['sweep', 'Seconds to cross the graph', 'r', 3, 30, 0.5], ['deriv', 'Draw the derivative f′(x) underneath', 't'],
    ['xmin', 'x from', 'r', -20, 0, 0.5], ['xmax', 'x to', 'r', 0, 20, 0.5], ['ymin', 'y from', 'r', -20, 0, 0.5], ['ymax', 'y to', 'r', 0, 20, 0.5],
    ['notes', 'Notes per beat (pitch = slope)', 'r', 0, 8, 1],
  ],
  init(S, P) { S.sc = { f: fn(P.f), tick: -1 }; },
  slope(sc, x) { const h = 1e-3; return (sc.f(x + h) - sc.f(x - h)) / (2 * h); },
  step(S, P, dt, emit) {
    const sc = S.sc;
    if (P.notes <= 0) return;
    const q = Math.floor((S.st * S.bpm * P.notes) / 60);
    if (q === sc.tick) return;
    sc.tick = q;
    const x = sweepX(S, P, P.xmin, P.xmax), m = this.slope(sc, x);
    emit({ type: 'hit', ball: q % 12, x: 0, y: 0, angle: 0, pitch: clamp(0.5 + Math.atan(m) / Math.PI, 0, 1) });
  },
  draw(S, P, D) {
    const { g, pal, k } = D, sc = S.sc, { hw, hh } = S.W;
    const two = P.deriv;
    const top = graph(D, { cx: 0, cy: two ? hh * 0.42 : 0, w: hw * 0.92, h: two ? hh * 0.5 : hh * 0.85 }, VIEW(P));
    top.axes(pal);
    top.curve((x) => sc.f(x, S.st), pal.line(0.1), 3.5, { glow: 10 });
    const x = sweepX(S, P, P.xmin, P.xmax), y = sc.f(x), m = this.slope(sc, x);
    // the tangent line
    const L = (P.xmax - P.xmin) * 0.22;
    g.strokeStyle = '#ffd25c'; g.lineWidth = 3 * k; g.shadowColor = '#ffd25c'; g.shadowBlur = 10 * k;
    g.beginPath(); g.moveTo(top.px(x - L), top.py(y - m * L)); g.lineTo(top.px(x + L), top.py(y + m * L)); g.stroke(); g.shadowBlur = 0;
    // rise over run
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.5 * k; g.setLineDash([4 * k, 4 * k]);
    g.beginPath(); g.moveTo(top.px(x), top.py(y)); g.lineTo(top.px(x + 1), top.py(y)); g.lineTo(top.px(x + 1), top.py(y + m)); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(top.px(x), top.py(y), 7 * k, 0, TAU); g.fill();
    text(D, `slope = ${fmt(m)}`, top.px(x), top.py(y) - 22 * k, { size: 17, color: '#ffd25c' });
    if (two) {
      const bot = graph(D, { cx: 0, cy: -hh * 0.5, w: hw * 0.92, h: hh * 0.36 }, VIEW(P));
      bot.axes(pal);
      text(D, 'slope of f  =  f′(x)', bot.px(P.xmin) + 6 * k, bot.py(P.ymax) + 12 * k, { size: 13, align: 'left', alpha: 0.7 });
      // the derivative, drawn as far as the point has been
      const reached = S.st >= P.sweep ? P.xmax : x;
      bot.curve((u) => this.slope(sc, u), '#ffd25c', 3, { to: reached, glow: 8 });
      g.fillStyle = '#ffd25c'; g.beginPath(); g.arc(bot.px(x), bot.py(m), 6 * k, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,210,92,0.35)'; g.lineWidth = 1 * k; g.setLineDash([3 * k, 4 * k]);
      g.beginPath(); g.moveTo(top.px(x), top.py(y)); g.lineTo(bot.px(x), bot.py(m)); g.stroke(); g.setLineDash([]);
    }
  },
  stats(S, P) { const x = sweepX(S, P, P.xmin, P.xmax); return `x = ${fmt(x)} · slope f′(x) = ${fmt(this.slope(S.sc, x))}`; },
  formula: (P) => `f(x) = ${P.f},  slope = f′(x)`,
};

/* ================================================================ riemann */

function simpson(f, a, b, n = 2000) {
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}

const riemann = {
  label: 'Integral: rectangles fill the area under a curve', group: 'Calculus & trig',
  defaults: { f: '1 + sin(x) + 0.1*x^2', a: -3, b: 3, steps: '2 4 8 16 32 64 128', every: 4, wait: 0.5, rule: 'mid', xmin: -3.5, xmax: 3.5, ymin: -1, ymax: 4 },
  controls: [
    ['f', 'Curve f(x)', 'f', 'x^2', ['x', 't']],
    ['a', 'From x =', 'r', -20, 20, 0.1], ['b', 'To x =', 'r', -20, 20, 0.1],
    ['steps', 'Rectangles, one count after another', 'x', '2 4 8 16 32 64 128'], ['every', 'Beats per count', 'r', 1, 16, 0.5],
    ['rule', 'Rectangle height from', 's', { left: 'Left edge', mid: 'Middle', right: 'Right edge' }],
    ['xmin', 'x from', 'r', -20, 0, 0.5], ['xmax', 'x to', 'r', 0, 20, 0.5], ['ymin', 'y from', 'r', -20, 0, 0.5], ['ymax', 'y to', 'r', 0, 20, 0.5],
  ],
  init(S, P) {
    const f = fn(P.f, 'x^2');
    const list = String(P.steps || '').split(/[\s,;]+/).map(Number).filter((v) => v >= 1).map((v) => Math.min(2000, Math.round(v)));
    S.sc = { f, list: list.length ? list : [4, 16, 64], exact: simpson((x) => f(x) || 0, P.a, P.b), k: -1 };
  },
  at(S, P) { const len = (60 / S.bpm) * Math.max(0.5, P.every); return S.st < P.wait ? -1 : Math.min(S.sc.list.length - 1, Math.floor((S.st - P.wait) / len)); },
  sum(sc, P, n) {
    const w = (P.b - P.a) / n, off = P.rule === 'left' ? 0 : P.rule === 'right' ? 1 : 0.5;
    let s = 0;
    for (let i = 0; i < n; i++) s += (sc.f(P.a + (i + off) * w) || 0) * w;
    return s;
  },
  step(S, P, dt, emit) {
    const sc = S.sc, k = this.at(S, P);
    if (k !== sc.k && k >= 0) {
      sc.k = k;
      const n = sc.list[k];
      // a quick run up the scale, one note per rectangle (at most 16)
      const m = Math.min(16, n);
      for (let i = 0; i < m; i++) emit({ type: 'hit', ball: i, x: 0, y: 0, angle: 0, pitch: clamp(0.25 + (0.6 * i) / m + 0.05 * k, 0, 1), together: i > 0 && n > 16 });
    }
  },
  draw(S, P, D) {
    const { g, pal, k } = D, sc = S.sc, { hw, hh } = S.W;
    const G = graph(D, { cx: 0, cy: -0.05, w: hw * 0.92, h: hh * 0.72 }, VIEW(P));
    G.axes(pal);
    const step = this.at(S, P);
    if (step >= 0) {
      const n = sc.list[step], w = (P.b - P.a) / n, off = P.rule === 'left' ? 0 : P.rule === 'right' ? 1 : 0.5;
      const len = (60 / S.bpm) * Math.max(0.5, P.every), since = S.st - P.wait - step * len;
      const shown = Math.min(n, Math.ceil(n * clamp(since / (len * 0.5), 0.05, 1)));
      for (let i = 0; i < shown; i++) {
        const x = P.a + i * w, y = sc.f(x + off * w) || 0;
        g.fillStyle = hexA(pal.glow, 0.35); g.strokeStyle = hexA(pal.ring, 0.8); g.lineWidth = Math.min(1.5, 60 / n) * k;
        const X0 = G.px(x), X1 = G.px(x + w), Y0 = G.py(0), Y1 = G.py(y);
        g.fillRect(X0, Math.min(Y0, Y1), X1 - X0, Math.abs(Y1 - Y0)); if (n <= 64) g.strokeRect(X0, Math.min(Y0, Y1), X1 - X0, Math.abs(Y1 - Y0));
      }
    }
    G.curve((x) => sc.f(x, S.st), '#ffffff', 3.5, { glow: 10 });
    for (const x of [P.a, P.b]) { g.strokeStyle = 'rgba(255,210,92,0.8)'; g.lineWidth = 2 * k; g.beginPath(); g.moveTo(G.px(x), G.py(P.ymin)); g.lineTo(G.px(x), G.py(P.ymax)); g.stroke(); }
    if (step >= 0) {
      const n = sc.list[step], s = this.sum(sc, P, n);
      text(D, `${n} rectangles: ${fmt(s, 4)}`, D.X(0), D.Y(-hh * 0.86), { size: 20, color: '#ffd25c' });
      text(D, `exact area: ${fmt(sc.exact, 4)}`, D.X(0), D.Y(-hh * 0.95), { size: 15, color: '#7fffd4', alpha: 0.85 });
    }
  },
  stats(S, P) { const s = this.at(S, P); if (s < 0) return 'ready…'; const n = S.sc.list[s]; return `${n} rectangles · error ${fmt(Math.abs(this.sum(S.sc, P, n) - S.sc.exact), 4)}`; },
  formula: (P) => `∫ from ${P.a} to ${P.b} of ${P.f} dx ≈ Σ f(xᵢ)·Δx`,
};

/* ================================================================== taylor */

const fact = (n) => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; };
/** Taylor coefficients at 0: [a0, a1, a2 …] and the function itself. */
const SERIES = {
  sin: { f: Math.sin, c: (n) => (n % 2 ? ((n - 1) / 2 % 2 ? -1 : 1) / fact(n) : 0), name: 'sin x', view: [-7, 7, -3, 3] },
  cos: { f: Math.cos, c: (n) => (n % 2 ? 0 : (n / 2 % 2 ? -1 : 1) / fact(n)), name: 'cos x', view: [-7, 7, -3, 3] },
  exp: { f: Math.exp, c: (n) => 1 / fact(n), name: 'eˣ', view: [-4, 3, -1, 12] },
  ln: { f: (x) => (x > -1 ? Math.log(1 + x) : NaN), c: (n) => (n ? (n % 2 ? 1 : -1) / n : 0), name: 'ln(1+x)', view: [-1.5, 2.5, -3, 2] },
  geo: { f: (x) => 1 / (1 - x), c: () => 1, name: '1/(1−x)', view: [-2, 1.5, -2, 8] },
  atan: { f: Math.atan, c: (n) => (n % 2 ? ((n - 1) / 2 % 2 ? -1 : 1) / n : 0), name: 'arctan x', view: [-3, 3, -2.5, 2.5] },
};

const taylor = {
  label: 'Taylor series: a polynomial learns a curve', group: 'Calculus & trig',
  defaults: { fn: 'sin', terms: 10, every: 2, wait: 0.5 },
  controls: [
    ['fn', 'Function', 's', { sin: 'sin x', cos: 'cos x', exp: 'eˣ', ln: 'ln(1 + x)', geo: '1/(1 − x)', atan: 'arctan x' }],
    ['terms', 'Most terms', 'r', 1, 20, 1], ['every', 'Beats per new term', 'r', 0.5, 8, 0.5],
  ],
  init(S, P) {
    const s = SERIES[P.fn] || SERIES.sin;
    const powers = [];
    for (let n = 0; powers.length < P.terms && n < 60; n++) if (s.c(n) !== 0) powers.push(n);
    S.sc = { s, powers, k: -1 };
  },
  at(S, P) { const len = (60 / S.bpm) * Math.max(0.5, P.every); return S.st < P.wait ? -1 : Math.min(S.sc.powers.length - 1, Math.floor((S.st - P.wait) / len)); },
  poly(sc, x, m) { let s = 0; for (let i = 0; i <= m; i++) { const n = sc.powers[i]; s += sc.s.c(n) * x ** n; } return s; },
  step(S, P, dt, emit) {
    const sc = S.sc, k = this.at(S, P);
    if (k !== sc.k && k >= 0) { sc.k = k; emit({ type: 'hit', ball: k, x: 0, y: 0, angle: 0, pitch: clamp(0.2 + k * 0.07, 0, 1) }); }
  },
  draw(S, P, D) {
    const { pal } = D, sc = S.sc, { hw, hh } = S.W, [x0, x1, y0, y1] = sc.s.view;
    const G = graph(D, { cx: 0, cy: 0, w: hw * 0.92, h: hh * 0.8 }, { x0, x1, y0, y1 });
    G.axes(pal);
    G.curve(sc.s.f, '#ffffff', 3, { dash: [6, 5] });
    const k = this.at(S, P);
    if (k >= 1) G.curve((x) => this.poly(sc, x, k - 1), hexA(pal.glow, 0.3), 2.5);
    if (k >= 0) G.curve((x) => this.poly(sc, x, k), pal.line(k / sc.powers.length), 4, { glow: 12, n: 600 });
    if (k >= 0) {
      const terms = sc.powers.slice(0, k + 1).map((n, i) => {
        const c = sc.s.c(n), a = Math.abs(c), sign = c < 0 ? '− ' : i ? '+ ' : '';
        const coef = Math.abs(a - 1) < 1e-12 ? '' : a === 1 / fact(n) && n > 1 ? `1/${n}!·` : a < 1 ? `${+a.toFixed(3)}·` : `${a}·`;
        const pow = n === 0 ? (coef ? coef.slice(0, -1) : '1') : `${coef}x${n > 1 ? superscript(n) : ''}`;
        return `${sign}${pow}`;
      });
      const line = terms.length > 5 ? [...terms.slice(0, 4), '…', terms.at(-1)].join(' ') : terms.join(' ');
      text(D, line, D.X(0), D.Y(-hh * 0.9), { size: 17, color: '#ffd25c' });
    }
  },
  stats(S, P) { const k = this.at(S, P); return k < 0 ? 'ready…' : `${k + 1} term${k ? 's' : ''} · up to x${superscript(S.sc.powers[k])}`; },
  formula: (P) => `${(SERIES[P.fn] || SERIES.sin).name} = Σ f⁽ⁿ⁾(0)·xⁿ/n!`,
};
function superscript(n) { return String(n).split('').map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]).join(''); }

/* ============================================================== unit circle */

const unitcircle = {
  label: 'Unit circle: sine and cosine from a turning point', group: 'Calculus & trig',
  defaults: { speed: 0.2, show: 'both', tan: false, notes: 4 },
  controls: [
    ['speed', 'Turns per second', 'r', 0.05, 1, 0.01],
    ['show', 'Draw', 's', { both: 'sin and cos', sin: 'sin only', cos: 'cos only' }],
    ['tan', 'Show tan θ too', 't'], ['notes', 'Notes per beat (pitch = sin θ)', 'r', 0, 8, 1],
  ],
  init(S) { S.sc = { tick: -1 }; },
  th(S, P) { return TAU * P.speed * S.st; },
  step(S, P, dt, emit) {
    const sc = S.sc;
    if (P.notes <= 0) return;
    const q = Math.floor((S.st * S.bpm * P.notes) / 60);
    if (q === sc.tick) return;
    sc.tick = q;
    const th = this.th(S, P);
    emit({ type: 'hit', ball: q % 12, x: Math.cos(th) * 0.3, y: Math.sin(th) * 0.3, angle: th, pitch: 0.5 + 0.45 * Math.sin(th) });
  },
  draw(S, P, D) {
    const { g, pal, k } = D, { hw, hh } = S.W, th = this.th(S, P);
    const R = hw * 0.32, cx = -hw * 0.55, cy = hh * 0.45;
    const X = (x) => D.X(cx + x * R), Y = (y) => D.Y(cy + y * R);
    // circle and axes
    g.strokeStyle = hexA(pal.ring, 0.25); g.lineWidth = 1.2 * k;
    g.beginPath(); g.moveTo(X(-1.25), Y(0)); g.lineTo(X(1.25), Y(0)); g.moveTo(X(0), Y(-1.25)); g.lineTo(X(0), Y(1.25)); g.stroke();
    g.strokeStyle = hexA(pal.ring, 0.75); g.lineWidth = 2.5 * k; g.beginPath(); g.arc(X(0), Y(0), R * D.R, 0, TAU); g.stroke();
    const c = Math.cos(th), s = Math.sin(th);
    // the angle
    g.strokeStyle = '#ffd25c'; g.lineWidth = 2 * k; g.beginPath(); g.arc(X(0), Y(0), R * D.R * 0.22, 0, -(th % TAU), true); g.stroke();
    // radius, sin (vertical), cos (horizontal)
    g.strokeStyle = '#ffffff'; g.lineWidth = 2.5 * k; g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(c), Y(s)); g.stroke();
    const sinC = '#ff5c8a', cosC = '#5cd3ff';
    if (P.show !== 'cos') { g.strokeStyle = sinC; g.lineWidth = 4 * k; g.beginPath(); g.moveTo(X(c), Y(0)); g.lineTo(X(c), Y(s)); g.stroke(); }
    if (P.show !== 'sin') { g.strokeStyle = cosC; g.lineWidth = 4 * k; g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(c), Y(0)); g.stroke(); }
    if (P.tan && Math.abs(c) > 0.08) {
      const t = s / c;
      g.strokeStyle = '#b6ff5c'; g.lineWidth = 2.5 * k; g.beginPath(); g.moveTo(X(1), Y(0)); g.lineTo(X(1), Y(clamp(t, -1.6, 1.6))); g.stroke();
      g.strokeStyle = 'rgba(182,255,92,0.4)'; g.lineWidth = 1.5 * k; g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(1), Y(clamp(t, -1.6, 1.6))); g.stroke();
    }
    g.fillStyle = '#ffffff'; g.shadowColor = pal.glow; g.shadowBlur = 14 * k; g.beginPath(); g.arc(X(c), Y(s), 7 * k, 0, TAU); g.fill(); g.shadowBlur = 0;
    // sin θ drawn to the right (time runs right), cos θ drawn downwards
    const span = hw * 0.95 - (cx + R * 1.35), back = 1 / P.speed;
    if (P.show !== 'cos') {
      const x0 = cx + R * 1.35;
      g.strokeStyle = 'rgba(255,92,138,0.35)'; g.lineWidth = 1 * k; g.setLineDash([3 * k, 4 * k]); g.beginPath(); g.moveTo(X(c), Y(s)); g.lineTo(D.X(x0), Y(s)); g.stroke(); g.setLineDash([]);
      g.strokeStyle = sinC; g.lineWidth = 3.5 * k; g.shadowColor = sinC; g.shadowBlur = 10 * k; g.beginPath();
      for (let i = 0; i <= 240; i++) { const tt = S.st - (back * i) / 240; if (tt < 0) break; const v = Math.sin(TAU * P.speed * tt); const x = D.X(x0 + (span * i) / 240); i ? g.lineTo(x, Y(v)) : g.moveTo(x, Y(v)); }
      g.stroke(); g.shadowBlur = 0;
      text(D, `sin θ = ${fmt(s)}`, D.X(x0 + span / 2), Y(1.45), { size: 17, color: sinC });
    }
    if (P.show !== 'sin') {
      const y0 = cy - R * 1.35, spanY = y0 + hh * 0.92;
      g.strokeStyle = 'rgba(92,211,255,0.35)'; g.lineWidth = 1 * k; g.setLineDash([3 * k, 4 * k]); g.beginPath(); g.moveTo(X(c), Y(s)); g.lineTo(X(c), D.Y(y0)); g.stroke(); g.setLineDash([]);
      g.strokeStyle = cosC; g.lineWidth = 3.5 * k; g.shadowColor = cosC; g.shadowBlur = 10 * k; g.beginPath();
      for (let i = 0; i <= 240; i++) { const tt = S.st - (back * i) / 240; if (tt < 0) break; const v = Math.cos(TAU * P.speed * tt); const y = D.Y(y0 - (spanY * i) / 240); i ? g.lineTo(X(v), y) : g.moveTo(X(v), y); }
      g.stroke(); g.shadowBlur = 0;
      text(D, `cos θ = ${fmt(c)}`, X(0) + R * D.R * 1.15, D.Y(y0 - spanY * 0.5), { size: 17, color: cosC, align: 'left' });
    }
    const deg = Math.round(((th * 180) / Math.PI) % 360);
    text(D, `θ = ${deg}°`, X(0), Y(-1.45), { size: 16, color: '#ffd25c' });
  },
  stats(S, P) { const th = this.th(S, P); return `θ = ${Math.round(((th * 180) / Math.PI) % 360)}° · sin = ${fmt(Math.sin(th))} · cos = ${fmt(Math.cos(th))}`; },
  formula: () => 'point = (cos θ, sin θ)',
};

export const CALCULUS = { tangent, riemann, taylor, unitcircle };
