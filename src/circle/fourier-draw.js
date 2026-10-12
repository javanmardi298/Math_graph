/**
 * Fourier drawing: spinning circles (epicycles) that draw any closed shape.
 *
 * The shape is sampled into N points z_n = x_n + i·y_n, its discrete Fourier transform
 * gives one circle per frequency k (radius |c_k|, start angle arg c_k, k turns per round),
 * and the tip of the chain of circles, z(θ) = Σ c_k·e^{ikθ}, retraces the shape. Each
 * round uses more circles, so the drawing sharpens: 3 circles, 10, 40 … the whole cat.
 *
 * Shapes: built-ins (cat, π, heart, note, star, butterfly, infinity, flower, Batman logo,
 * maple leaf, crescent & star, cross, circle), any text (a single-stroke font: names,
 * words), your own formula x(s), y(s), or any SVG path (paste the d="…" of an icon).
 * Flags: the emblem is drawn by the circles on its flag, then filled with its colour.
 * Same contract as scenes.js; deterministic, no DOM.
 */
import { tryCompile } from '../math/parser.js';
import { hexA } from './palettes.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const N = 1024; // points on the shape = most circles

/* ------------------------------------------------------------------ shapes */

const param = (fx, fy, t1 = TAU, n = 1500) => Array.from({ length: n }, (_, i) => { const t = (t1 * i) / n; return [fx(t), fy(t)]; });

/** Catmull-Rom through the points (closed): smooth outlines from a few hand-placed points. */
function smooth(pts, per = 12) {
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let j = 0; j < per; j++) {
      const t = j / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((a) => 0.5 * (2 * p1[a] + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t3)));
    }
  }
  return out;
}

/** A stroke drawn there and back again: lines (π, letters) become a closed path. */
const there = (pts) => [...pts, ...pts.slice(1, -1).reverse()];

export const SHAPES = {
  cat: () => smooth([
    [0.18, -1], [-0.3, -1], [-0.55, -0.93], [-0.82, -0.85], [-0.98, -0.62], [-0.96, -0.36], [-0.86, -0.3], [-0.84, -0.55], [-0.72, -0.72],
    [-0.56, -0.72], [-0.6, -0.42], [-0.52, -0.08], [-0.36, 0.2], [-0.42, 0.42], [-0.4, 0.66], [-0.46, 0.98], [-0.24, 0.8], [-0.06, 0.82],
    [0.12, 0.98], [0.14, 0.66], [0.12, 0.42], [0.02, 0.26], [0.04, 0.04], [0.16, -0.3], [0.2, -0.62], [0.32, -0.86], [0.34, -0.98],
  ], 14),
  pi: () => there([
    [0.95, 0.72], [0.82, 0.62], [0.6, 0.58], [0.25, 0.58], [-0.25, 0.58], [-0.6, 0.58], [-0.82, 0.55], [-0.98, 0.42],
    [-0.82, 0.55], [-0.6, 0.58], [-0.35, 0.58], [-0.36, 0.2], [-0.42, -0.3], [-0.55, -0.7], [-0.7, -0.9],
    [-0.55, -0.7], [-0.42, -0.3], [-0.36, 0.2], [-0.35, 0.58], [0.25, 0.58], [0.26, 0.1], [0.28, -0.4], [0.36, -0.78], [0.52, -0.92], [0.72, -0.86], [0.84, -0.7],
  ].flatMap((p, i, a) => (i ? lerpTo(a[i - 1], p, 8) : [p]))),
  heart: () => param((t) => (16 * Math.sin(t) ** 3) / 17, (t) => (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17),
  note: () => smooth([
    [-0.62, -0.98], [-0.86, -0.86], [-0.88, -0.66], [-0.66, -0.52], [-0.38, -0.56], [-0.22, -0.66], [-0.2, -0.3], [-0.2, 0.3], [-0.2, 0.96],
    [0.05, 0.8], [0.34, 0.6], [0.5, 0.32], [0.46, 0.02], [0.34, -0.14], [0.4, 0.12], [0.32, 0.38], [0.1, 0.56], [-0.08, 0.62], [-0.08, 0.2], [-0.08, -0.4], [-0.12, -0.78], [-0.34, -0.96],
  ], 12),
  star: () => Array.from({ length: 10 }, (_, i) => { const a = Math.PI / 2 + (i * TAU) / 10, r = i % 2 ? 0.42 : 1; return [r * Math.cos(a), r * Math.sin(a)]; }).flatMap((p, i, a) => lerpTo(a[(i - 1 + a.length) % a.length], p, 20)),
  butterfly: () => param((t) => Math.sin(t) * (Math.exp(Math.cos(t)) - 2 * Math.cos(4 * t) - Math.sin(t / 12) ** 5), (t) => Math.cos(t) * (Math.exp(Math.cos(t)) - 2 * Math.cos(4 * t) - Math.sin(t / 12) ** 5), 12 * Math.PI, 3000),
  infinity: () => param((t) => Math.cos(t) / (1 + Math.sin(t) ** 2), (t) => (Math.sin(t) * Math.cos(t)) / (1 + Math.sin(t) ** 2)),
  flower: () => param((t) => (0.55 + 0.45 * Math.cos(5 * t)) * Math.cos(t), (t) => (0.55 + 0.45 * Math.cos(5 * t)) * Math.sin(t)),
  batman: () => mirror([
    [0, 0.17], [0.05, 0.2], [0.08, 0.42], [0.12, 0.22], [0.19, 0.17], [0.4, 0.23], [0.64, 0.35], [0.86, 0.45], [1, 0.52],
    [0.97, 0.3], [0.91, 0.08], [0.82, -0.12], [0.72, -0.08], [0.64, -0.06], [0.57, -0.2], [0.48, -0.3], [0.36, -0.22], [0.26, -0.2],
    [0.16, -0.34], [0.07, -0.46], [0, -0.56],
  ]),
  leaf: () => mirror([
    [0, 1], [0.1, 0.8], [0.2, 0.86], [0.18, 0.52], [0.38, 0.72], [0.45, 0.6], [0.63, 0.66], [0.57, 0.44], [0.68, 0.39], [0.43, 0.19], [0.48, 0.06],
    [0.08, 0.12], [0.06, -0.28], [0.04, -0.52], [0, -0.52],
  ]),
  cross: () => [[-0.2, 0.6], [0.2, 0.6], [0.2, 0.2], [0.6, 0.2], [0.6, -0.2], [0.2, -0.2], [0.2, -0.6], [-0.2, -0.6], [-0.2, -0.2], [-0.6, -0.2], [-0.6, 0.2], [-0.2, 0.2]]
    .flatMap((p, i, a) => lerpTo(a[(i - 1 + a.length) % a.length], p, 10)),
  crescent: () => crescent(),
  crescentstar: () => {
    const c = crescent(), st = star5(0.3, 0.12, 0.62, 0);
    return [...c, ...lerpTo(c.at(-1), st[0], 6), ...st, ...lerpTo(st.at(-1), c[0], 6)];
  },
  circle: () => param(Math.cos, Math.sin),
  text: () => SHAPES.heart(), // replaced by textPoints(P.text) in shapeSamples
};

/** Right half from the top centre down to the bottom centre → the whole symmetric outline. */
function mirror(half) {
  const pts = [...half, ...half.slice(1, -1).reverse().map(([x, y]) => [-x, y])];
  return pts.flatMap((p, i, a) => lerpTo(a[(i - 1 + a.length) % a.length], p, 8));
}
/** A crescent: an arc of the unit circle, back along a smaller circle further right. */
function crescent() {
  const th = (50 * Math.PI) / 180, c = 0.32, r = Math.hypot(Math.cos(th) - c, Math.sin(th)), ph = Math.atan2(Math.sin(th), Math.cos(th) - c);
  const out = [];
  for (let i = 0; i <= 160; i++) { const a = th + ((TAU - 2 * th) * i) / 160; out.push([Math.cos(a), Math.sin(a)]); }
  // back up along the left side of the smaller circle (through 180°): the hollow
  for (let i = 0; i <= 160; i++) { const a = -ph - ((TAU - 2 * ph) * i) / 160; out.push([c + r * Math.cos(a), r * Math.sin(a)]); }
  return out;
}
function star5(R, r, cx, cy) {
  const pts = Array.from({ length: 10 }, (_, i) => { const a = Math.PI / 2 + (i * TAU) / 10, q = i % 2 ? r : R; return [cx + q * Math.cos(a), cy + q * Math.sin(a)]; });
  return pts.flatMap((p, i, a) => lerpTo(a[(i - 1 + a.length) % a.length], p, 8));
}

/* -------------------------------------------------------------------- text */

/**
 * A single-stroke font on a 4 × 6 grid: each glyph is a list of strokes "x,y x,y …".
 * Strokes are joined by straight moves and the whole text is drawn there and back, so
 * the circles can write it as one closed line.
 */
const FONT = {
  A: '0,0 2,6 4,0|1,3 3,3', B: '0,0 0,6 3,6 4,5 4,4 3,3 0,3|3,3 4,2 4,1 3,0 0,0', C: '4,5 3,6 1,6 0,5 0,1 1,0 3,0 4,1',
  D: '0,0 0,6 2,6 4,4 4,2 2,0 0,0', E: '4,6 0,6 0,0 4,0|0,3 3,3', F: '4,6 0,6 0,0|0,3 3,3', G: '4,5 3,6 1,6 0,5 0,1 1,0 3,0 4,1 4,3 2,3',
  H: '0,6 0,0|4,6 4,0|0,3 4,3', I: '1,6 3,6|2,6 2,0|1,0 3,0', J: '4,6 4,1 3,0 1,0 0,1', K: '0,6 0,0|4,6 0,2|1,3 4,0', L: '0,6 0,0 4,0',
  M: '0,0 0,6 2,3 4,6 4,0', N: '0,0 0,6 4,0 4,6', O: '1,0 0,1 0,5 1,6 3,6 4,5 4,1 3,0 1,0', P: '0,0 0,6 3,6 4,5 4,4 3,3 0,3',
  Q: '1,0 0,1 0,5 1,6 3,6 4,5 4,1 3,0 1,0|2,2 4,0', R: '0,0 0,6 3,6 4,5 4,4 3,3 0,3|2,3 4,0', S: '4,5 3,6 1,6 0,5 0,4 1,3 3,3 4,2 4,1 3,0 1,0 0,1',
  T: '0,6 4,6|2,6 2,0', U: '0,6 0,1 1,0 3,0 4,1 4,6', V: '0,6 2,0 4,6', W: '0,6 1,0 2,4 3,0 4,6', X: '0,6 4,0|4,6 0,0', Y: '0,6 2,3 4,6|2,3 2,0',
  Z: '0,6 4,6 0,0 4,0', 0: '1,0 0,1 0,5 1,6 3,6 4,5 4,1 3,0 1,0|0,1 4,5', 1: '1,5 2,6 2,0|1,0 3,0', 2: '0,5 1,6 3,6 4,5 4,4 0,0 4,0',
  3: '0,5 1,6 3,6 4,5 4,4 3,3 1,3|3,3 4,2 4,1 3,0 1,0 0,1', 4: '3,0 3,6 0,2 4,2', 5: '4,6 0,6 0,3 3,3 4,2 4,1 3,0 0,0',
  6: '4,5 3,6 1,6 0,5 0,1 1,0 3,0 4,1 4,2 3,3 0,3', 7: '0,6 4,6 1,0', 8: '1,3 0,4 0,5 1,6 3,6 4,5 4,4 3,3 1,3 0,2 0,1 1,0 3,0 4,1 4,2 3,3',
  9: '4,3 1,3 0,4 0,5 1,6 3,6 4,5 4,1 3,0 1,0', '!': '2,6 2,2|2,0.6 2,0', '?': '0,5 1,6 3,6 4,5 4,4 2,3 2,1.8|2,0.6 2,0', '-': '1,3 3,3',
  '.': '2,0.6 2,0', '+': '2,1 2,5|0,3 4,3', '=': '0,2 4,2|0,4 4,4', '♥': '2,0 0,3 0,5 1,6 2,5 3,6 4,5 4,3 2,0', π: '0,5 4,5|1,5 1,0|3,5 3,0 4,0',
  "'": '2,6 2,4', '&': '4,0 1,4 1,5 2,6 3,5 3,4 0,1 1,0 3,0 4,2',
};

/** The text as one closed line (strokes there and back), centred. Unknown letters are skipped. */
export function textPoints(str) {
  const pts = [];
  let x0 = 0;
  for (const ch of String(str || '').toUpperCase().slice(0, 24)) {
    if (ch === ' ') { x0 += 4; continue; }
    const g = FONT[ch] ?? FONT[ch.toLowerCase()];
    if (!g) continue;
    for (const stroke of g.split('|')) {
      const s = stroke.trim().split(/\s+/).map((p) => p.split(',').map(Number)).map(([x, y]) => [x0 + x, y]);
      if (pts.length) pts.push(...lerpTo(pts.at(-1), s[0], 6));
      s.forEach((p, i) => { if (i) pts.push(...lerpTo(s[i - 1], p, 8)); else pts.push(p); });
    }
    x0 += 6;
  }
  return pts.length > 1 ? there(pts) : [];
}

/* -------------------------------------------------------------------- flags */

/**
 * Flags: the background bands (drawn in world units inside the flag rectangle), the
 * emblem the circles draw (shape, centre, size as parts of the flag height) and its colour.
 */
export const FLAGS = {
  japan: { name: 'Japan', ratio: 1.5, bands: [['#ffffff', 0, 1, 'v']], shape: 'circle', at: [0, 0], size: 0.3, fill: '#bc002d', light: true },
  canada: { name: 'Canada', ratio: 2, bands: [['#d80621', 0, 0.25, 'v'], ['#ffffff', 0.25, 0.75, 'v'], ['#d80621', 0.75, 1, 'v']], shape: 'leaf', at: [0, 0.02], size: 0.34, fill: '#d80621', light: true },
  switzerland: { name: 'Switzerland', ratio: 1, bands: [['#da291c', 0, 1, 'v']], shape: 'cross', at: [0, 0], size: 0.32, fill: '#ffffff' },
  turkey: { name: 'Türkiye', ratio: 1.5, bands: [['#e30a17', 0, 1, 'v']], shape: 'crescentstar', at: [-0.12, 0], size: 0.27, fill: '#ffffff' },
  vietnam: { name: 'Vietnam', ratio: 1.5, bands: [['#da251d', 0, 1, 'v']], shape: 'star', at: [0, 0], size: 0.3, fill: '#ffff00' },
};
export const SHAPE_NAMES = { cat: 'Cat', pi: 'π', heart: 'Heart', note: 'Music note', star: 'Star', butterfly: 'Butterfly', infinity: 'Infinity', flower: 'Flower', batman: 'Batman logo', leaf: 'Maple leaf', crescentstar: 'Crescent and star', crescent: 'Crescent', cross: 'Cross', circle: 'Circle', text: 'Text (type below)', formula: 'My formula x(s), y(s)', svg: 'SVG path (paste d="…")' };

function lerpTo(a, b, n) { const out = []; for (let i = 1; i <= n; i++) out.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]); return out; }

/**
 * Points along an SVG path (M L H V C S Q T Z, absolute and relative; arcs as straight
 * lines). Sub-paths are joined, so the pen never lifts. y is flipped (SVG y points down).
 */
export function svgPoints(d) {
  const toks = String(d || '').match(/[MLHVCSQTAZmlhvcsqtaz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
  const pts = [];
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, cx = 0, cy = 0;
  const num = () => Number(toks[i++]);
  const isNum = () => i < toks.length && !/[a-z]/i.test(toks[i]);
  const curve = (P) => { for (let j = 1; j <= 16; j++) { const t = j / 16; pts.push(bez(P, t)); } };
  while (i < toks.length) {
    if (!isNum()) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === 'Z') { pts.push([sx, sy]); x = sx; y = sy; continue; }
    if (!isNum()) break;
    if (C === 'M') { x = ox + num(); y = oy + num(); sx = x; sy = y; pts.push([x, y]); cmd = rel ? 'l' : 'L'; }
    else if (C === 'L') { x = ox + num(); y = oy + num(); pts.push([x, y]); }
    else if (C === 'H') { x = ox + num(); pts.push([x, y]); }
    else if (C === 'V') { y = oy + num(); pts.push([x, y]); }
    else if (C === 'C') { const p = [[x, y], [ox + num(), oy + num()], [ox + num(), oy + num()], [ox + num(), oy + num()]]; curve(p); [cx, cy] = p[2]; [x, y] = p[3]; }
    else if (C === 'S') { const p = [[x, y], [2 * x - cx, 2 * y - cy], [ox + num(), oy + num()], [ox + num(), oy + num()]]; curve(p); [cx, cy] = p[2]; [x, y] = p[3]; }
    else if (C === 'Q') { const q = [ox + num(), oy + num()], e = [ox + num(), oy + num()]; curve([[x, y], q, e]); [cx, cy] = q; [x, y] = e; }
    else if (C === 'T') { const q = [2 * x - cx, 2 * y - cy], e = [ox + num(), oy + num()]; curve([[x, y], q, e]); [cx, cy] = q; [x, y] = e; }
    else if (C === 'A') { num(); num(); num(); num(); num(); x = ox + num(); y = oy + num(); pts.push([x, y]); }
    else break;
  }
  return pts.map(([a, b]) => [a, -b]);
}
function bez(P, t) {
  let Q = P;
  while (Q.length > 1) Q = Q.slice(1).map((p, j) => [Q[j][0] + (p[0] - Q[j][0]) * t, Q[j][1] + (p[1] - Q[j][1]) * t]);
  return Q[0];
}

/** The shape as N points evenly spaced along its length, centred, largest side = 2. */
export function shapeSamples(P) {
  let pts;
  const shape = FLAGS[P.flag]?.size ? FLAGS[P.flag].shape : P.shape;
  if (shape === 'svg') pts = svgPoints(P.svg);
  else if (shape === 'text') pts = textPoints(P.text);
  else if (shape === 'formula') {
    const fx = tryCompile(String(P.x || '0'), ['s']), fy = tryCompile(String(P.y || '0'), ['s']);
    pts = fx.ok && fy.ok ? param((s) => fx.fn({ s }), (s) => fy.fn({ s })) : [];
  } else pts = (SHAPES[shape] || SHAPES.heart)();
  pts = pts.filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
  if (pts.length < 3) pts = SHAPES.heart();
  // even spacing along the (closed) path
  const seg = pts.map((p, i) => Math.hypot(pts[(i + 1) % pts.length][0] - p[0], pts[(i + 1) % pts.length][1] - p[1]));
  const total = seg.reduce((a, b) => a + b, 0) || 1;
  const out = [];
  let j = 0, acc = 0;
  for (let n = 0; n < N; n++) {
    const want = (total * n) / N;
    while (j < pts.length - 1 && acc + seg[j] < want) acc += seg[j++];
    const f = seg[j] ? (want - acc) / seg[j] : 0, a = pts[j], b = pts[(j + 1) % pts.length];
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  const xs = out.map((p) => p[0]), ys = out.map((p) => p[1]);
  const mx = (Math.max(...xs) + Math.min(...xs)) / 2, my = (Math.max(...ys) + Math.min(...ys)) / 2;
  const s = 2 / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-9);
  return out.map(([a, b]) => [(a - mx) * s, (b - my) * s]);
}

/** Circles of the drawing, biggest first: [k (turns per round), radius, start angle]. */
export function epicycles(samples) {
  const out = [];
  for (let k = -N / 2 + 1; k < N / 2; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      const a = (-TAU * k * n) / N, [x, y] = samples[n];
      re += x * Math.cos(a) - y * Math.sin(a); im += x * Math.sin(a) + y * Math.cos(a);
    }
    out.push([k, Math.hypot(re, im) / N, Math.atan2(im, re)]);
  }
  // the fixed centre (k = 0) first, then by size
  return out.sort((a, b) => (a[0] === 0 ? -1 : b[0] === 0 ? 1 : b[1] - a[1]));
}

/** Tip of the first `m` circles at round angle θ. */
function tip(C, m, th) {
  let x = 0, y = 0;
  for (let i = 0; i < m; i++) { const [k, r, p] = C[i]; x += r * Math.cos(k * th + p); y += r * Math.sin(k * th + p); }
  return [x, y];
}

const fdraw = {
  label: 'Fourier drawing: circles draw any shape', group: 'Fourier & curves',
  defaults: { shape: 'cat', text: 'MATH', flag: 'none', fill: '', rounds: '3 8 25 80 250', period: 6, wait: 0.4, size: 0.9, ghost: true, arms: 60, notes: 4, x: 'cos(s) + cos(3*s)/3', y: 'sin(s) - sin(3*s)/3', svg: 'M 10 80 Q 52.5 10 95 80 T 180 80 L 180 140 L 10 140 Z' },
  controls: [
    ['shape', 'Shape', 's', SHAPE_NAMES],
    ['text', 'Text to write (A–Z, 0–9, ! ? + = π ♥)', 'x', 'MATH'],
    ['flag', 'Draw on a flag', 's', { none: 'No flag', ...Object.fromEntries(Object.entries(FLAGS).map(([k, f]) => [k, f.name])) }],
    ['fill', 'Fill colour when finished (empty = none)', 'x', '#ff3d9a'],
    ['rounds', 'Circles in each round, one after another', 'x', '3 8 25 80 250'],
    ['period', 'Seconds per round', 'r', 2, 20, 0.5],
    ['size', 'Size', 'r', 0.3, 1.2, 0.01],
    ['arms', 'Circles drawn (the rest still count)', 'r', 5, 200, 1],
    ['ghost', 'Show the target faintly', 't'],
    ['notes', 'Notes per beat (the pen’s height is the pitch)', 'r', 0, 8, 1],
    ['x', 'My formula x(s), s from 0 to 2π', 'f', 'cos(s) + cos(3*s)/3', ['s']],
    ['y', 'My formula y(s)', 'f', 'sin(s) - sin(3*s)/3', ['s']],
    ['svg', 'SVG path d="…" (for “SVG path”)', 'x', 'M 0 0 L 100 0 L 50 80 Z'],
  ],
  init(S, P) {
    const samples = shapeSamples(P);
    const rounds = String(P.rounds || '').split(/[\s,;]+/).map(Number).filter((v) => v >= 1).map((v) => Math.min(N - 1, Math.round(v)));
    S.sc = { samples, C: epicycles(samples), rounds: rounds.length ? rounds : [250], r: -1, tick: -1 };
  },
  /** Round r and the angle θ in it now. */
  at(S, P) {
    const sc = S.sc, T = Math.max(0.5, P.period), t = S.st - P.wait;
    if (t < 0) return { r: -1, th: 0 };
    const r = Math.min(sc.rounds.length - 1, Math.floor(t / T));
    const last = r === sc.rounds.length - 1;
    const u = last ? (t - r * T) / T : Math.min(1, (t - r * T) / T);
    return { r, th: TAU * u, done: u >= 1 };
  },
  step(S, P, dt, emit) {
    const sc = S.sc, { r, th } = this.at(S, P);
    if (r < 0) return;
    const m = sc.rounds[r] + 1;
    if (r !== sc.r) { sc.r = r; emit({ type: 'fill', ball: r, x: 0, y: 0, angle: 0, pitch: r / sc.rounds.length }); }
    if (P.notes > 0) {
      const q = Math.floor((S.st * S.bpm * P.notes) / 60);
      if (q !== sc.tick) {
        sc.tick = q;
        const [x, y] = tip(sc.C, m, th);
        emit({ type: 'hit', ball: q % 16, x: x * 0.5, y: y * 0.5, angle: Math.atan2(y, x), pitch: clamp((y + 1) / 2, 0, 1) });
      }
    }
  },
  draw(S, P, D) {
    const { g, pal, k } = D, sc = S.sc;
    const flag = FLAGS[P.flag];
    let sz = Math.min(S.W.hw, S.W.hh) * 0.82 * P.size, ox = 0, oy = 0.05;
    if (flag) {
      // the flag, as big as fits, with its emblem placed and sized like the real one
      const fw = Math.min(2 * S.W.hw * 0.94, 2 * S.W.hh * 0.6 * flag.ratio), fh = fw / flag.ratio, fx = -fw / 2, fy = oy - fh / 2;
      for (const [col, a0, a1, dir] of flag.bands) {
        g.fillStyle = col;
        if (dir === 'v') g.fillRect(D.X(fx + a0 * fw), D.Y(fy + fh), (a1 - a0) * fw * D.R, fh * D.R);
        else g.fillRect(D.X(fx), D.Y(fy + fh - a0 * fh), fw * D.R, (a1 - a0) * fh * D.R);
      }
      sz = fh * flag.size; ox = flag.at[0] * fw; oy += flag.at[1] * fh;
    }
    const X = (x) => D.X(x * sz + ox), Y = (y) => D.Y(y * sz + oy);
    const fill = flag?.fill || P.fill;
    if (P.ghost) {
      g.strokeStyle = hexA(pal.ring, 0.16); g.lineWidth = 2 * k; g.setLineDash([3 * k, 5 * k]); g.beginPath();
      sc.samples.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.closePath(); g.stroke(); g.setLineDash([]);
    }
    const { r, th } = this.at(S, P);
    if (r < 0) return;
    const m = sc.rounds[r] + 1;
    // the last round's finished drawing, faint
    if (r > 0) {
      const pm = sc.rounds[r - 1] + 1;
      g.strokeStyle = hexA(pal.glow, 0.22); g.lineWidth = 2 * k; g.beginPath();
      for (let j = 0; j <= 300; j++) { const [x, y] = tip(sc.C, pm, (TAU * j) / 300); j ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)); }
      g.stroke();
    }
    // what the pen has drawn this round
    const steps = Math.max(2, Math.ceil((th / TAU) * 500));
    // on a flag the pen draws in the emblem's colour (visible on white flags too)
    const ink = flag ? flag.fill : pal.line(r / Math.max(1, sc.rounds.length));
    g.strokeStyle = ink; g.lineWidth = 4 * k; g.shadowColor = flag ? 'transparent' : pal.glow; g.shadowBlur = 14 * k; g.lineJoin = 'round';
    g.beginPath();
    for (let j = 0; j <= steps; j++) { const [x, y] = tip(sc.C, m, (th * j) / steps); j ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)); }
    g.stroke(); g.shadowBlur = 0;
    // finished: fill the shape with its colour
    const last = r === sc.rounds.length - 1, T = Math.max(0.5, P.period);
    const doneFor = S.st - P.wait - (sc.rounds.length - 1) * T - T;
    if (fill && last && doneFor > 0) {
      g.globalAlpha = Math.min(1, doneFor / 0.6); g.fillStyle = fill; g.beginPath();
      for (let j = 0; j <= 400; j++) { const [x, y] = tip(sc.C, m, (TAU * j) / 400); j ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)); }
      g.closePath(); g.fill('evenodd'); g.globalAlpha = 1;
    }
    // the circles
    let x = 0, y = 0;
    const shown = Math.min(m, Math.max(2, P.arms | 0));
    for (let i = 0; i < m; i++) {
      const [kk, rr, p] = sc.C[i];
      const nx = x + rr * Math.cos(kk * th + p), ny = y + rr * Math.sin(kk * th + p);
      if (i > 0 && i < shown) {
        const a = 0.55 * (1 - i / (shown + 1)) + 0.1;
        const guide = flag?.light ? '#1a1a2e' : flag ? '#ffffff' : pal.ring;
        g.strokeStyle = hexA(guide, a * 0.6); g.lineWidth = 1.2 * k; g.beginPath(); g.arc(X(x), Y(y), rr * sz * D.R, 0, TAU); g.stroke();
        g.strokeStyle = hexA(flag?.light ? '#1a1a2e' : '#ffffff', a); g.lineWidth = 1.6 * k; g.beginPath(); g.moveTo(X(x), Y(y)); g.lineTo(X(nx), Y(ny)); g.stroke();
      }
      x = nx; y = ny;
    }
    g.fillStyle = '#ffffff'; g.shadowColor = pal.glow; g.shadowBlur = 16 * k;
    g.beginPath(); g.arc(X(x), Y(y), 6 * k, 0, TAU); g.fill(); g.shadowBlur = 0;
  },
  stats(S, P) { const { r } = this.at(S, P); return r < 0 ? 'ready…' : `circles: ${S.sc.rounds[r]}`; },
  formula: () => 'z(t) = Σ cₖ · e^{ikt}',
};

export const FOURIER_DRAW = { fdraw };
