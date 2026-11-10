/**
 * Graph-style Circle Lab scenes added for "textbook" Shorts:
 *
 *   shapewave    the geometry of waves: a point runs round a shape (circle, rose, square, star …) and
 *                its height is unrolled into a wave next to it; several shapes in rows
 *   derivgraph   a function and its derivative as two stacked graphs, a dashed line linking the
 *                moving point on f to the value of f′ below (optionally f″)
 *   dotmatrix    a matrix of lights (or a perforated plate): big block digits that count, a curve
 *                y = f(x), or a region f(x, y) < 0; a scan line plays the lit cells like a music box
 *
 * Same contract as scenes.js (init / step / draw / stats / formula); deterministic, no DOM.
 */
import { tryCompile } from '../math/parser.js';
import { hexA } from './palettes.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function compile(src, vars, fallback) {
  let c = tryCompile(String(src ?? ''), vars);
  if (!c.ok) c = tryCompile(fallback, vars);
  return (scope) => { const v = c.fn(scope); return Number.isFinite(v) ? v : NaN; };
}

function label(D, s, x, y, { size = 15, color = '#ffffff', align = 'center', weight = 600, alpha = 0.92, font = 'ui-sans-serif, system-ui, sans-serif' } = {}) {
  const { g, k } = D;
  g.save(); g.globalAlpha = alpha; g.fillStyle = color;
  g.font = `${weight} ${size * k}px ${font}`; g.textAlign = align; g.textBaseline = 'middle';
  g.fillText(s, x, y); g.restore();
}

/* ============================================================== shapewave */

/** Regular polygon / star outline as a closed path of points, walked at constant speed. */
function polyPath(pts) {
  const seg = pts.map((p, i) => { const q = pts[(i + 1) % pts.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]); });
  const total = seg.reduce((s, x) => s + x, 0);
  return (u) => {
    let d = ((u % 1) + 1) % 1 * total;
    for (let i = 0; i < pts.length; i++) {
      if (d <= seg[i] || i === pts.length - 1) { const k = seg[i] ? d / seg[i] : 0, p = pts[i], q = pts[(i + 1) % pts.length]; return [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]; }
      d -= seg[i];
    }
    return pts[0];
  };
}
const ngon = (n, r = 1, rot = Math.PI / 2) => Array.from({ length: n }, (_, i) => [r * Math.cos(rot + (TAU * i) / n), r * Math.sin(rot + (TAU * i) / n)]);
const star = (n, r1 = 1, r2 = 0.42) => Array.from({ length: n * 2 }, (_, i) => { const r = i % 2 ? r2 : r1, a = Math.PI / 2 + (Math.PI * i) / n; return [r * Math.cos(a), r * Math.sin(a)]; });
const polar = (r) => (u) => { const th = TAU * u, v = r(th); return [v * Math.cos(th), v * Math.sin(th)]; };

/** The shapes: name → point(u), u = 0 … 1 once round, inside the unit circle. */
export const WAVE_SHAPES = {
  circle: polar(() => 1),
  ellipse: (u) => [Math.cos(TAU * u), 0.55 * Math.sin(TAU * u)],
  rose: polar((th) => Math.cos(2 * th)),
  rose3: polar((th) => Math.cos(3 * th)),
  rose5: polar((th) => Math.cos(5 * th)),
  square: polyPath([[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([x, y]) => [x * 0.8, y * 0.8])),
  triangle: polyPath(ngon(3)),
  pentagon: polyPath(ngon(5)),
  hexagon: polyPath(ngon(6, 1, 0)),
  star: polyPath(star(5)),
  star6: polyPath(star(6, 1, 0.55)),
  heart: (u) => { const t = TAU * u; return [(16 * Math.sin(t) ** 3) / 17, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17 + 0.12]; },
  cardioid: polar((th) => 0.5 * (1 + Math.cos(th))),
  lemniscate: (u) => { const t = TAU * u, d = 1 + Math.sin(t) ** 2; return [Math.cos(t) / d, (Math.sin(t) * Math.cos(t)) / d * 1.6]; },
  astroid: (u) => [Math.cos(TAU * u) ** 3, Math.sin(TAU * u) ** 3],
  spiro: (u) => { const t = TAU * u; return [(0.62 * Math.cos(t) + 0.38 * Math.cos(-4 * t)), (0.62 * Math.sin(t) + 0.38 * Math.sin(-4 * t))]; },
};
const ROW_COLORS = ['#5cc8e6', '#e88aa0', '#6fd6b4', '#f0b060', '#b59cff', '#ffe066'];

const shapewave = {
  label: 'Geometry of waves: a shape unrolled into a wave', group: 'Calculus & trig',
  defaults: { rows: 'circle rose square star', speed: 0.25, cycles: 3, part: 'y', formula: 'cos(3*theta)', notes: 2, title: '' },
  controls: [
    ['rows', `Shapes, top to bottom (${Object.keys(WAVE_SHAPES).join(', ')}, formula)`, 'x', 'circle rose square star'],
    ['formula', 'My shape r(θ) (use the name “formula” above)', 'f', 'cos(3*theta)', ['theta', 't']],
    ['speed', 'Times round per second', 'r', 0.05, 1.5, 0.01],
    ['cycles', 'Rounds across the wave', 'r', 1, 6, 1],
    ['part', 'The wave shows', 's', { y: 'the height of the point (y)', x: 'its sideways position (x)', r: 'its distance from the centre (r)' }],
    ['notes', 'Notes per beat (pitch = the wave)', 'r', 0, 8, 1],
    ['title', 'Title above (empty = none)', 'x', ''],
  ],
  init(S) { S.sc = { tick: -1 }; },
  shapes(P) {
    const r = compile(P.formula, ['theta', 't'], 'cos(3*theta)');
    return String(P.rows || 'circle').toLowerCase().split(/[\s,]+/).filter(Boolean).slice(0, 6)
      .map((name) => ({ name, at: name === 'formula' ? polar((th) => r({ theta: th, t: 0 })) : WAVE_SHAPES[name] || WAVE_SHAPES.circle }));
  },
  value(P, pt) { return P.part === 'x' ? pt[0] : P.part === 'r' ? Math.hypot(pt[0], pt[1]) * 2 - 1 : pt[1]; },
  step(S, P, dt, emit) {
    if (P.notes <= 0) return;
    const q = Math.floor((S.st * S.bpm * P.notes) / 60);
    if (q === S.sc.tick) return;
    S.sc.tick = q;
    const rows = this.shapes(P), i = q % rows.length, u = S.st * P.speed;
    const v = this.value(P, rows[i].at(u));
    emit({ type: 'hit', ball: i, x: 0, y: 0, angle: TAU * u, pitch: clamp(0.5 + 0.45 * v, 0, 1) });
  },
  draw(S, P, D) {
    const { g, k } = D, { hw, hh } = S.W;
    const rows = this.shapes(P), n = rows.length;
    const top = hh * (P.title ? 0.8 : 0.94), rowH = (top + hh * 0.94) / n;
    const R = Math.min(rowH * 0.4, hw * 0.26);
    const sx = -hw * 0.94 + R * 1.05, wx0 = sx + R * 1.5, wx1 = hw * 0.95;
    const u = S.st * P.speed, cyc = Math.max(1, Math.round(P.cycles)), prog = (u % cyc) / cyc, lap = Math.floor(u / cyc);
    if (P.title) {
      const grad = g.createLinearGradient(D.X(-hw * 0.8), 0, D.X(hw * 0.8), 0);
      grad.addColorStop(0, '#6fd6b4'); grad.addColorStop(0.5, '#5cc8e6'); grad.addColorStop(1, '#b59cff');
      g.save(); g.fillStyle = grad; g.font = `700 ${40 * k}px ui-sans-serif, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(P.title, D.X(0), D.Y(hh * 0.93)); g.restore();
    }
    rows.forEach((row, i) => {
      const cy = top - rowH * (i + 0.5), col = ROW_COLORS[i % ROW_COLORS.length];
      const X = (x) => D.X(sx + x * R), Y = (y) => D.Y(cy + y * R);
      // the shape
      g.strokeStyle = col; g.lineWidth = 2.4 * k; g.lineJoin = 'round'; g.shadowColor = col; g.shadowBlur = 6 * k;
      g.beginPath();
      for (let j = 0; j <= 360; j++) { const p = row.at(j / 360); j ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])); }
      g.closePath(); g.stroke(); g.shadowBlur = 0;
      // axes of the wave
      const WX = (c) => D.X(wx0 + (wx1 - wx0) * c);
      g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1 * k;
      g.beginPath(); g.moveTo(WX(0), Y(-1.1)); g.lineTo(WX(0), Y(1.1)); g.moveTo(WX(0), Y(0)); g.lineTo(WX(1), Y(0)); g.stroke();
      for (let c = 1; c <= cyc; c++) { g.beginPath(); g.moveTo(WX(c / cyc), Y(-0.07)); g.lineTo(WX(c / cyc), Y(0.07)); g.stroke(); }
      // the wave: the whole of it faintly after the first pass, bright up to the point
      const wave = (to, alpha, width) => {
        g.strokeStyle = hexA(col, alpha); g.lineWidth = width * k; g.beginPath();
        const m = Math.max(2, Math.round(480 * to));
        for (let j = 0; j <= m; j++) { const c = (to * j) / m; const v = this.value(P, row.at(c * cyc)); j ? g.lineTo(WX(c), Y(v)) : g.moveTo(WX(c), Y(v)); }
        g.stroke();
      };
      if (lap > 0) wave(1, 0.22, 1.6);
      g.shadowColor = col; g.shadowBlur = 8 * k; wave(prog, 1, 2.6); g.shadowBlur = 0;
      // the moving point, its guide line, and the end of the wave
      const p = row.at(u), v = this.value(P, p);
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1 * k; g.setLineDash([4 * k, 5 * k]);
      g.beginPath(); g.moveTo(X(p[0]), Y(p[1])); g.lineTo(WX(prog), Y(v)); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(X(p[0]), Y(p[1]), 5.5 * k, 0, TAU); g.fill();
      g.fillStyle = col; g.beginPath(); g.arc(WX(prog), Y(v), 5.5 * k, 0, TAU); g.fill();
    });
  },
  stats(S, P) { return `${this.shapes(P).map((r) => r.name).join(' · ')}`; },
  formula: (P) => (P.part === 'x' ? 'wave = x of the point' : P.part === 'r' ? 'wave = distance from the centre' : 'wave = height of the point'),
};

/* ============================================================= derivgraph */

const derivgraph = {
  label: 'Function and derivative: two graphs, one moving point', group: 'Calculus & trig',
  defaults: { f: '0.5*x^3 - 2*x', xmin: -2.6, xmax: 2.6, period: 8, second: false, tangent: true, textF: 'f(x) = ½x³ − 2x', textD: "f′(x) = 3⁄2 x² − 2", title: 'Derivative Visualization', notes: 4 },
  controls: [
    ['f', 'Function f(x)', 'f', '0.5*x^3 - 2*x', ['x', 't']],
    ['xmin', 'x from', 'r', -20, 0, 0.1], ['xmax', 'x to', 'r', 0, 20, 0.1],
    ['period', 'Seconds for one pass', 'r', 2, 40, 0.5],
    ['second', 'Third graph: the second derivative', 't'],
    ['tangent', 'Show the tangent line on f', 't'],
    ['title', 'Title (empty = none)', 'x', 'Derivative Visualization'],
    ['textF', 'Text in the top box', 'x', 'f(x) = …'], ['textD', 'Text in the bottom box', 'x', "f′(x) = …"],
    ['notes', 'Notes per beat (pitch = the slope)', 'r', 0, 8, 1],
  ],
  init(S, P) {
    const f = compile(P.f, ['x', 't'], 'sin(x)');
    const F = (x) => f({ x, t: 0 }), h = 1e-3;
    const d1 = (x) => (F(x + h) - F(x - h)) / (2 * h), d2 = (x) => (F(x + h) - 2 * F(x) + F(x - h)) / (h * h);
    const range = (fn) => {
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i <= 200; i++) { const v = fn(P.xmin + ((P.xmax - P.xmin) * i) / 200); if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }
      if (!(hi > lo)) { lo -= 1; hi += 1; }
      const pad = (hi - lo) * 0.12;
      return [Math.min(lo - pad, -pad), Math.max(hi + pad, pad)];
    };
    S.sc = { tick: -1, fns: [F, d1, d2], ranges: [range(F), range(d1), range(d2)] };
  },
  xAt(S, P) { const u = (S.st / P.period) % 2; return P.xmin + (P.xmax - P.xmin) * (u < 1 ? u : 2 - u); }, // there and back
  step(S, P, dt, emit) {
    if (P.notes <= 0) return;
    const q = Math.floor((S.st * S.bpm * P.notes) / 60);
    if (q === S.sc.tick) return;
    S.sc.tick = q;
    const m = S.sc.fns[1](this.xAt(S, P)), [lo, hi] = S.sc.ranges[1];
    emit({ type: 'hit', ball: q % 12, x: 0, y: 0, angle: 0, pitch: clamp((m - lo) / (hi - lo), 0, 1) });
  },
  draw(S, P, D) {
    const { g, k } = D, { hw, hh } = S.W, sc = S.sc;
    const n = P.second ? 3 : 2, cols = ['#f0a04e', '#7fd3b6', '#b59cff'];
    const headroom = (P.title ? 0.12 : 0) + (P.textF ? 0.13 : 0), foot = P.textD ? 0.13 : 0;
    const top = hh * (0.96 - headroom * 2), bottom = -hh * (0.96 - foot * 2), gh = (top - bottom) / n;
    const X = (x) => D.X(-hw * 0.86 + ((x - P.xmin) / (P.xmax - P.xmin)) * hw * 1.72);
    const x = this.xAt(S, P);
    const serif = '"Latin Modern Math", "Cambria Math", "Times New Roman", serif';
    if (P.title) {
      const grad = g.createLinearGradient(D.X(-hw * 0.7), 0, D.X(hw * 0.7), 0);
      grad.addColorStop(0, '#e9c98a'); grad.addColorStop(0.5, '#c78fb5'); grad.addColorStop(1, '#8fd0c0');
      g.save(); g.fillStyle = grad; g.font = `500 ${46 * k}px ${serif}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(P.title, D.X(0), D.Y(hh * 0.9)); g.restore();
    }
    const box = (text, y, col) => {
      if (!text) return;
      g.save(); g.font = `italic 500 ${30 * k}px ${serif}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const tw = g.measureText(text).width + 44 * k, th = 62 * k, bx = D.X(0) - tw / 2, by = D.Y(y) - th / 2;
      g.strokeStyle = col; g.lineWidth = 2 * k; g.beginPath(); g.roundRect ? g.roundRect(bx, by, tw, th, 8 * k) : g.rect(bx, by, tw, th); g.stroke();
      g.fillStyle = col; g.fillText(text, D.X(0), D.Y(y)); g.restore();
    };
    box(P.textF, top + hh * 0.13, cols[0]);
    box(P.textD, bottom - hh * 0.13, cols[1]);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const fn = sc.fns[i], [lo, hi] = sc.ranges[i];
      const y1 = top - gh * i - gh * 0.08, y0 = top - gh * (i + 1) + gh * 0.08;
      const Y = (v) => D.Y(y0 + ((clamp(v, lo, hi) - lo) / (hi - lo)) * (y1 - y0));
      // axes with ticks
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.6 * k;
      g.beginPath(); g.moveTo(X(P.xmin), Y(0)); g.lineTo(X(P.xmax), Y(0)); g.stroke();
      if (P.xmin <= 0 && P.xmax >= 0) { g.beginPath(); g.moveTo(X(0), Y(lo)); g.lineTo(X(0), Y(hi)); g.stroke(); }
      for (let t = Math.ceil(P.xmin); t <= P.xmax; t++) if (t) { g.beginPath(); g.moveTo(X(t), Y(0) - 6 * k); g.lineTo(X(t), Y(0) + 6 * k); g.stroke(); }
      const stepY = Math.max(1, Math.round((hi - lo) / 6));
      if (P.xmin <= 0 && P.xmax >= 0) for (let t = Math.ceil(lo / stepY) * stepY; t <= hi; t += stepY) if (t) { g.beginPath(); g.moveTo(X(0) - 6 * k, Y(t)); g.lineTo(X(0) + 6 * k, Y(t)); g.stroke(); }
      // the curve: f whole, the derivatives up to the moving point (they are being "drawn" by it)
      const upto = i === 0 ? P.xmax : x;
      g.strokeStyle = cols[i]; g.lineWidth = 4 * k; g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath();
      let pen = false;
      for (let j = 0; j <= 300; j++) { const xx = P.xmin + ((upto - P.xmin) * j) / 300, v = fn(xx); if (!Number.isFinite(v)) { pen = false; continue; } pen ? g.lineTo(X(xx), Y(v)) : g.moveTo(X(xx), Y(v)); pen = true; }
      g.stroke();
      if (i > 0) { g.strokeStyle = hexA(cols[i], 0.2); g.lineWidth = 2 * k; g.beginPath(); for (let j = 0; j <= 200; j++) { const xx = P.xmin + ((P.xmax - P.xmin) * j) / 200, v = fn(xx); j ? g.lineTo(X(xx), Y(v)) : g.moveTo(X(xx), Y(v)); } g.stroke(); }
      if (i === 0 && P.tangent) {
        const m = sc.fns[1](x), v = fn(x), len = (P.xmax - P.xmin) * 0.14;
        g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 2 * k; g.beginPath(); g.moveTo(X(x - len), Y(v - m * len)); g.lineTo(X(x + len), Y(v + m * len)); g.stroke();
      }
      pts.push([X(x), Y(fn(x)), cols[i]]);
    }
    // the dashed link through the moving points
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.6 * k; g.setLineDash([7 * k, 7 * k]);
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); g.lineTo(pts[n - 1][0], pts[n - 1][1]); g.stroke(); g.setLineDash([]);
    pts.forEach(([px, py, col], i) => { g.fillStyle = i ? '#ffffff' : '#ffe08a'; g.strokeStyle = col; g.lineWidth = 2 * k; g.beginPath(); g.arc(px, py, 7 * k, 0, TAU); g.fill(); g.stroke(); });
  },
  stats(S, P) { const x = this.xAt(S, P); return `x = ${x.toFixed(2)} · f = ${S.sc.fns[0](x).toFixed(2)} · f′ = ${S.sc.fns[1](x).toFixed(2)}`; },
  formula: (P) => `f(x) = ${P.f}`,
};

/* ============================================================== dotmatrix */

// 5 × 7 block glyphs (rows top to bottom, 1 = lit)
const GLYPHS = {
  0: '01110 10001 10001 10001 10001 10001 01110', 1: '00100 01100 00100 00100 00100 00100 01110', 2: '01110 10001 00001 00110 01000 10000 11111',
  3: '11110 00001 00001 01110 00001 00001 11110', 4: '00010 00110 01010 10010 11111 00010 00010', 5: '11111 10000 11110 00001 00001 10001 01110',
  6: '01110 10000 10000 11110 10001 10001 01110', 7: '11111 00001 00010 00100 01000 01000 01000', 8: '01110 10001 10001 01110 10001 10001 01110',
  9: '01110 10001 10001 01111 00001 00001 01110', '-': '00000 00000 00000 11111 00000 00000 00000', '.': '00000 00000 00000 00000 00000 01100 01100',
  ':': '00000 01100 01100 00000 01100 01100 00000', '°': '01100 10010 10010 01100 00000 00000 00000', C: '01110 10001 10000 10000 10000 10001 01110',
  F: '11111 10000 10000 11110 10000 10000 10000', '%': '11001 11010 00010 00100 01000 01011 10011', '+': '00000 00100 00100 11111 00100 00100 00000',
  '=': '00000 00000 11111 00000 11111 00000 00000', π: '00000 11111 01010 01010 01010 01010 10011', ' ': '00000 00000 00000 00000 00000 00000 00000',
  x: '00000 10001 01010 00100 01010 10001 00000', '♥': '01010 11111 11111 11111 01110 00100 00000',
};
for (const kk of Object.keys(GLYPHS)) GLYPHS[kk] = GLYPHS[kk].split(' ');

const dotmatrix = {
  label: 'LED matrix: block digits, curves and shapes from lights', group: 'Patterns & rhythm',
  defaults: { mode: 'number', value: 'floor(10 + 8*sin(t/2))', unit: '°C', f: 'sin(x) + sin(3*x)/3', region: 'abs(abs(x) - 0.55*abs(y)) - 0.12 - 0.5*y*y*0', cols: 32, style: 'led', color: 'gradient', scan: true, scanSpeed: 4, block: 3 },
  controls: [
    ['mode', 'Show', 's', { number: 'A number in big block digits', plot: 'A curve y = f(x)', region: 'A shape: f(x, y) < 0' }],
    ['value', 'Number: value(t), t in seconds', 'f', 'floor(t)', ['t']],
    ['unit', 'Number: small text after it (° C F % …)', 'x', '°C'],
    ['f', 'Curve f(x), x from −π to π, drawn between −1.5 and 1.5', 'f', 'sin(x)', ['x', 't']],
    ['region', 'Shape: lit where f(x, y) < 0 (x, y from −1 to 1)', 'f', 'x^2 + y^2 - 0.6', ['x', 'y', 't']],
    ['cols', 'Lights across', 'r', 8, 72, 1],
    ['block', 'Number: lights per block', 'r', 1, 6, 1],
    ['style', 'Look', 's', { led: 'Glowing lights on dark glass', plate: 'Perforated plate (holes in a coloured sheet)', pixels: 'Flat pixels' }],
    ['color', 'Colour', 's', { gradient: 'Gradient across (palette)', magenta: 'Magenta to cyan', amber: 'Amber', green: 'Green', white: 'White' }],
    ['scan', 'A scan line plays the lit cells', 't'],
    ['scanSpeed', 'Scan: columns per beat', 'r', 0.5, 16, 0.5],
  ],
  init(S, P) {
    S.sc = { col: -1, value: compile(P.value, ['t'], 'floor(t)'), f: compile(P.f, ['x', 't'], 'sin(x)'), region: compile(P.region, ['x', 'y', 't'], 'x^2+y^2-0.6'), cells: null, key: '' };
  },
  /** The grid of this moment: { cols, rows, lit: Uint8Array } (cached while nothing changes). */
  grid(S, P) {
    const sc = S.sc, { hw, hh } = S.W;
    const cols = clamp(Math.round(P.cols), 8, 72), rows = Math.max(6, Math.round((cols * hh) / hw));
    const t = S.st;
    let key, fill;
    if (P.mode === 'number') {
      const v = sc.value({ t });
      const str = `${Number.isFinite(v) ? Math.round(v) : 0}`;
      key = `n|${str}`;
      fill = (lit) => {
        const main = [...str], unit = [...String(P.unit || '')];
        // the largest block size (up to the one asked for) at which the whole text fits
        let b = clamp(Math.round(P.block), 1, 6), gw, gap, ub, wMain, wUnit;
        for (; b >= 1; b--) {
          gw = 5 * b; gap = b; ub = Math.max(1, Math.round(b / 2));
          wMain = main.length * gw + (main.length - 1) * gap;
          wUnit = unit.length ? gap * 2 + unit.length * 5 * ub + (unit.length - 1) * ub : 0;
          if (wMain + wUnit <= cols - 2 && 7 * b <= rows - 2) break;
        }
        b = Math.max(1, b);
        const x0 = Math.round((cols - wMain - wUnit) / 2), y0 = Math.round((rows - 7 * b) / 2);
        const put = (ch, gx, gy, s) => { const gl = GLYPHS[ch] || GLYPHS[' ']; for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (gl[r][c] === '1') for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) { const X = gx + c * s + dx, Y = gy + r * s + dy; if (X >= 0 && X < cols && Y >= 0 && Y < rows) lit[Y * cols + X] = 1; } };
        main.forEach((ch, i) => put(ch, x0 + i * (gw + gap), y0, b));
        unit.forEach((ch, i) => put(ch, x0 + wMain + gap * 2 + i * 6 * ub, y0, ub));
      };
    } else if (P.mode === 'plot') {
      key = `p|${Math.round(t * 30)}`;
      fill = (lit) => { for (let c = 0; c < cols; c++) { const x = -Math.PI + (TAU * c) / (cols - 1), v = sc.f({ x, t }); const r = Math.round((rows - 1) * (0.5 - clamp(v, -1.5, 1.5) / 3)); if (Number.isFinite(v)) lit[clamp(r, 0, rows - 1) * cols + c] = 1; } };
    } else {
      key = `r|${Math.round(t * 30)}`;
      fill = (lit) => { for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const x = -1 + (2 * c) / (cols - 1), y = (1 - (2 * r) / (rows - 1)) * (rows / cols); if (sc.region({ x, y, t }) < 0) lit[r * cols + c] = 1; } };
    }
    key += `|${cols}|${rows}|${P.block}|${P.unit}`;
    if (sc.key !== key) { const lit = new Uint8Array(cols * rows); fill(lit); sc.cells = { cols, rows, lit }; sc.key = key; }
    return sc.cells;
  },
  scanCol(S, P, cols) { return Math.floor((S.st * S.bpm * P.scanSpeed) / 60) % cols; },
  step(S, P, dt, emit) {
    if (!P.scan) return;
    const G = this.grid(S, P), c = this.scanCol(S, P, G.cols);
    if (c === S.sc.col) return;
    S.sc.col = c;
    let n = 0;
    // the lit cells of this column, bottom to top; runs of neighbours count as one note (their middle)
    for (let r = G.rows - 1; r >= 0 && n < 4; r--) {
      if (!G.lit[r * G.cols + c]) continue;
      let r2 = r; while (r2 - 1 >= 0 && G.lit[(r2 - 1) * G.cols + c]) r2--;
      const mid = (r + r2) / 2;
      emit({ type: 'hit', ball: n, x: 0, y: 0, angle: 0, pitch: clamp(1 - mid / (G.rows - 1), 0, 1), together: n > 0 });
      n++; r = r2;
    }
  },
  colorAt(P, D, u) {
    if (P.color === 'magenta') { const a = [255, 40, 220], b = [0, 220, 255]; return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * u)).join(',')})`; }
    if (P.color === 'amber') return '#f2b04a';
    if (P.color === 'green') return '#37f08a';
    if (P.color === 'white') return '#f4f7ff';
    return D.pal.line(u * 0.999);
  },
  draw(S, P, D) {
    const { g, k } = D, { hw, hh } = S.W;
    const G = this.grid(S, P), { cols, rows, lit } = G;
    const cw = (hw * 1.96) / cols, ch = (hh * 1.96) / rows, cell = Math.min(cw, ch);
    const x0 = -(cols * cell) / 2, y0 = (rows * cell) / 2;
    const px = cell * D.R, gapPx = px * (P.style === 'pixels' ? 0.04 : 0.14), rad = P.style === 'pixels' ? 0 : px * 0.16;
    const scan = P.scan ? this.scanCol(S, P, cols) : -1;
    if (P.style === 'plate') { g.fillStyle = this.colorAt(P, D, 0.5); g.fillRect(D.X(x0) - px * 0.3, D.Y(y0) - px * 0.3, cols * px + px * 0.6, rows * px + px * 0.6); }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const on = lit[r * cols + c], x = D.X(x0 + c * cell) + gapPx / 2, y = D.Y(y0 - r * cell) + gapPx / 2, s = px - gapPx;
      const col = this.colorAt(P, D, c / Math.max(1, cols - 1));
      if (P.style === 'plate') {
        // a plate: the shape is the solid sheet, everything else is a square hole
        if (on) continue;
        g.fillStyle = c === scan ? 'rgba(0,0,0,0.55)' : 'rgba(20,14,8,0.82)';
        g.fillRect(x + s * 0.08, y + s * 0.08, s * 0.84, s * 0.84);
        g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + s * 0.08, y + s * 0.84, s * 0.84, s * 0.08);
        continue;
      }
      g.globalAlpha = on ? 1 : c === scan ? 0.16 : 0.055;
      g.fillStyle = on ? col : '#ffffff';
      if (on && P.style === 'led') { g.shadowColor = col; g.shadowBlur = (c === scan ? 22 : 9) * k; }
      g.beginPath(); g.roundRect ? g.roundRect(x, y, s, s, rad) : g.rect(x, y, s, s); g.fill();
      g.shadowBlur = 0;
      if (on && c === scan) { g.globalAlpha = 0.55; g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect ? g.roundRect(x, y, s, s, rad) : g.rect(x, y, s, s); g.fill(); }
    }
    g.globalAlpha = 1;
    if (P.mode === 'plot') label(D, `y = ${P.f}`, D.X(0), D.Y(-y0) + 26 * k, { size: 16, color: 'rgba(255,255,255,0.8)', font: 'ui-monospace, monospace' });
  },
  stats(S, P) { const G = this.grid(S, P); let n = 0; for (const v of G.lit) n += v; return `${G.cols} × ${G.rows} lights · ${n} lit`; },
  formula: (P) => (P.mode === 'number' ? `value = ${P.value}` : P.mode === 'plot' ? `y = ${P.f}` : `${P.region} < 0`),
};

export const SHAPES_LAB = { shapewave, derivgraph, dotmatrix };
