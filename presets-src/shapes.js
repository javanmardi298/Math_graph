/**
 * Shapes that make music: curves whose height (y) is the pitch while the pen travels along
 * them. Each one is measured numerically, then framed for a vertical video (equal scale,
 * centred) and fitted to a register so the lowest and highest point of the drawing are
 * exactly the lowest and highest note you want, nothing wasted above or below.
 *
 *   x half-width of every shape ≤ 2.9, so it fits the 6.4-wide vertical view with a margin.
 *   loops: how many times the parameter goes round in one pass (the butterfly needs 2 turns,
 *   a heart one): the whole curve is drawn and played once in the video.
 *
 * This module is for authoring (presets-src/): nothing here ships inside the app.
 */
import { CompiledLayer } from '../src/math/layers.js';
import { createLayer } from '../src/state.js';

const TAU = Math.PI * 2;

/** id → { label, emoji, type, exprs, range:{min,max}, samples, feel }. feel: smooth | stepped | arpeggio | rising */
export const SHAPES = {
  heart: { label: 'Heart', emoji: '❤️', type: 'parametric', exprs: { x: '2.6 sin(s)^3', y: '0.17 (13cos(s) - 5cos(2s) - 2cos(3s) - cos(4s))' }, range: [0, TAU], feel: 'smooth' },
  butterfly: { label: 'Butterfly', emoji: '🦋', type: 'parametric', exprs: { x: '0.62 sin(s) (exp(cos(s)) - 2cos(4s) - sin(s/12)^5)', y: '0.62 cos(s) (exp(cos(s)) - 2cos(4s) - sin(s/12)^5)' }, range: [0, 4 * Math.PI], samples: 4000, feel: 'arpeggio' },
  // upright (an 8): a flat shape would need an absurd note range to fill a register
  infinity: { label: 'Infinity Sign', emoji: '♾️', type: 'parametric', exprs: { x: '2.8 sin(s) cos(s) / (1 + sin(s)^2)', y: '2.8 cos(s) / (1 + sin(s)^2)' }, range: [0, 2 * TAU], feel: 'smooth' },
  star: { label: 'Star', emoji: '⭐', type: 'parametric', exprs: { x: '2.8 cos(s)^3', y: '2.8 sin(s)^3' }, range: [0, 2 * TAU], feel: 'stepped' },
  spiral: { label: 'Spiral', emoji: '🌀', type: 'polar', exprs: { r: '0.15 theta' }, range: [0, 6 * Math.PI], samples: 2400, feel: 'rising' },
  golden: { label: 'Golden Spiral', emoji: '🐚', type: 'polar', exprs: { r: '0.08 phi^(2theta/pi)' }, range: [0, 11.5], samples: 2400, feel: 'rising' },
  flower: { label: 'Flower', emoji: '🌸', type: 'polar', exprs: { r: '2.8 cos(4theta)' }, range: [0, TAU], feel: 'arpeggio' },
  clover: { label: 'Three-leaf Clover', emoji: '☘️', type: 'polar', exprs: { r: '2.8 cos(3theta)' }, range: [0, Math.PI], feel: 'smooth' },
  rose52: { label: 'Five-petal Rose', emoji: '🌹', type: 'polar', exprs: { r: '2.8 cos(2.5theta)' }, range: [0, 4 * Math.PI], samples: 2400, feel: 'arpeggio' },
  cardioid: { label: 'Cardioid', emoji: '🫀', type: 'polar', exprs: { r: '1.4 (1 + cos(theta))' }, range: [0, TAU], feel: 'smooth' },
  figure8: { label: 'Figure Eight', emoji: '8️⃣', type: 'parametric', exprs: { x: '2.4 sin(s) cos(s)', y: '2.4 sin(s)' }, range: [0, 2 * TAU], feel: 'smooth' },
  pretzel: { label: 'Pretzel', emoji: '🥨', type: 'parametric', exprs: { x: '2.6 sin(3s)', y: '3.6 sin(2s)' }, range: [0, TAU], feel: 'arpeggio' },
  gear: { label: 'Gear', emoji: '⚙️', type: 'polar', exprs: { r: '2.2 + 0.4 tanh(4 sin(10theta))' }, range: [0, TAU], samples: 3000, feel: 'stepped' },
  crown: { label: 'Crown', emoji: '👑', type: 'polar', exprs: { r: '2 + 0.8 abs(sin(2.5theta))' }, range: [0, 4 * Math.PI], samples: 2400, feel: 'stepped' },
  trefoil: { label: 'Trefoil Knot', emoji: '🪢', type: 'parametric', exprs: { x: '0.9 (sin(s) + 2 sin(2s))', y: '0.9 (cos(s) - 2 cos(2s))' }, range: [0, TAU], feel: 'arpeggio' },
  spiro: { label: 'Spirograph', emoji: '🎡', type: 'parametric', exprs: { x: '1.1 cos(s) + 1.65 cos(2s/3)', y: '1.1 sin(s) - 1.65 sin(2s/3)' }, range: [0, 6 * Math.PI], samples: 3000, feel: 'arpeggio' },
  nephroid: { label: 'Nephroid', emoji: '🌙', type: 'parametric', exprs: { x: '0.95 (3cos(s) - cos(3s))', y: '0.95 (3sin(s) - sin(3s))' }, range: [0, TAU], feel: 'smooth' },
  limacon: { label: 'Looped Limaçon', emoji: '🐌', type: 'polar', exprs: { r: '0.9 + 1.8 cos(theta)' }, range: [0, TAU], feel: 'smooth' },
  lissajous: { label: 'Lissajous Knot', emoji: '🪀', type: 'parametric', exprs: { x: '2.7 sin(5s + 1)', y: '2.7 sin(4s)' }, range: [0, TAU], samples: 2400, feel: 'arpeggio' },
};

const cache = new Map();

/**
 * Measure a shape: its bounding box (x and y) and the share of the pass that is spent in
 * the lower, middle and upper third of its height (a shape that lives mostly in one band
 * makes a flatter melody).
 */
export function measure(id) {
  if (cache.has(id)) return cache.get(id);
  const sh = SHAPES[id];
  if (!sh) throw new Error(`shapes.js: unknown shape "${id}"`);
  const layer = createLayer({ type: sh.type, exprs: { ...sh.exprs }, range: { min: sh.range[0], max: sh.range[1] } });
  const c = new CompiledLayer(layer);
  if (!c.ok) throw new Error(`shapes.js: "${id}" does not compile: ${JSON.stringify(c.errors)}`);
  const ctx = { t: 0, params: { a: 1, b: 1, c: 1, d: 1 }, view: { xMin: 0, xMax: 1 } };
  const N = 4000, p = { x: 0, y: 0, z: 0 };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const ys = [];
  for (let i = 0; i <= N; i++) {
    c.at(i / N, ctx, p);
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    ys.push(p.y);
  }
  const m = { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, halfW: (x1 - x0) / 2, halfH: (y1 - y0) / 2, ys };
  cache.set(id, m);
  return m;
}

/** The layer fields of a shape (type, formulas, parameter range, samples). */
export const layerOf = (id) => {
  const sh = SHAPES[id];
  return { type: sh.type, exprs: { ...sh.exprs }, range: { min: +sh.range[0].toFixed(6), max: +sh.range[1].toFixed(6) }, samples: sh.samples || 1600 };
};

/**
 * Vertical 9:16 view that centres the shape at equal scale (x 6.4 wide, y 11.378 tall).
 * `down` moves the drawing down by that many units (to leave room above it for a spectrum).
 */
export function frame(id, down = 0) {
  const m = measure(id);
  const W = 6.4, H = (W * 16) / 9;
  const r = (v) => Math.round(v * 1000) / 1000;
  return { xMin: r(m.cx - W / 2), xMax: r(m.cx + W / 2), yMin: r(m.cy - H / 2 + down), yMax: r(m.cy + H / 2 + down) };
}

/**
 * The note range to set so that the shape's lowest point plays `lo` and its highest `hi`.
 * Pitch is linear in y over the view: note = noteLow + (y − yMin) / (yMax − yMin) · (noteHigh − noteLow).
 */
export function fitRange(id, [lo, hi], down = 0) {
  const m = measure(id), v = frame(id, down);
  const span = ((hi - lo) * (v.yMax - v.yMin)) / Math.max(1e-6, m.y1 - m.y0);
  const noteLow = lo - ((m.y0 - v.yMin) / (v.yMax - v.yMin)) * span;
  const r = (n) => Math.round(n * 100) / 100;
  return { noteLow: r(noteLow), noteHigh: r(noteLow + span) };
}
