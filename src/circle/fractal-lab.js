/**
 * The fractal workshop (Fractals tab): four Circle Lab scenes.
 *
 *   fractal    escape-time explorer. One rule z → f(z) + c repeated; the colour of a point is how
 *              fast its orbit escapes. Families (FRACTAL_TYPES): Mandelbrot, Multibrot z^p, Burning
 *              Ship, Tricorn, Celtic, Buffalo, Perpendicular, Heart, Phoenix, Lambda (logistic) and
 *              Newton basins of z^p − 1. Every family has a Mandelbrot view (c = the pixel) and Julia
 *              views (c fixed, z₀ = the pixel). Journeys: zoom into a spot, let c travel (Julia morph),
 *              let the power grow, pan, or stand still while the colours cycle.
 *              Colouring: smooth, bands, orbit traps, stripes, binary decomposition.
 *              Drawn by the graphics card (a shader) and, for zooms deeper than its 32-bit numbers
 *              reach (about ×10⁵), by exact 64-bit arithmetic on the processor.
 *   buddha     Buddhabrot: the paths of escaping points pile up into a ghostly figure.
 *   lyapunov   Markus–Lyapunov fractals: the logistic map driven by a rhythm such as AB or AABAB;
 *              colour = how chaotic the population is for growth rates (a, b).
 *   ifs        iterated function systems by the chaos game: Barnsley's fern, Sierpiński triangle and
 *              carpet, dragon, Lévy C, maple leaf, Koch curve, spirals, trees, snowflakes.
 *
 * Sound: the zoom depth, the travelling c, or the orbit of a wandering point (each orbit step a note:
 * calm inside the set, a falling run where it escapes).
 *
 * Same contract as scenes.js (init / step / draw / stats / formula). Deterministic.
 */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const frac = (x) => x - Math.floor(x);

/* =============================================================== palettes */

export const FRACTAL_PALETTES = {
  fire: ['#000000', '#3a0610', '#a11d0e', '#ff7a1a', '#ffd76a', '#ffffff', '#ffd76a', '#ff7a1a', '#a11d0e', '#3a0610'],
  ocean: ['#000510', '#002a5c', '#0a6fb5', '#3ed1e8', '#e8fbff', '#3ed1e8', '#0a6fb5', '#002a5c'],
  neon: ['#07021a', '#3d1a8a', '#22e4ff', '#ffffff', '#ff3d9a', '#3d1a8a'],
  gold: ['#0a0600', '#4a2a00', '#c87f0a', '#ffe08a', '#fffbe8', '#ffe08a', '#c87f0a', '#4a2a00'],
  rainbow: ['#ff004c', '#ff8a00', '#ffe600', '#4dff6a', '#00d4ff', '#5b4dff', '#d24dff'],
  mono: ['#000000', '#3a3f55', '#a9b4dd', '#ffffff', '#a9b4dd', '#3a3f55'],
  twilight: ['#0b0221', '#2b0a5c', '#7a1fa2', '#ff5e8a', '#ffd3a8', '#ff5e8a', '#7a1fa2', '#2b0a5c'],
  electric: ['#000000', '#001a66', '#0050ff', '#00e5ff', '#ffffff', '#fff200', '#ff6a00', '#330000'],
  ice: ['#020814', '#0e2a4f', '#3f7fbf', '#bfe9ff', '#ffffff', '#bfe9ff', '#3f7fbf', '#0e2a4f'],
  forest: ['#020a04', '#0f3b1c', '#2f8f46', '#b7e86b', '#fffbd0', '#b7e86b', '#2f8f46', '#0f3b1c'],
  candy: ['#2a0033', '#ff3d9a', '#ffd1ec', '#7df9ff', '#6a5cff', '#ffd23d', '#ff3d9a'],
  lava: ['#000000', '#290000', '#7a0000', '#e03000', '#ff9a00', '#fff36a', '#ffffff', '#2a1a40'],
  inferno: ['#000004', '#1b0c41', '#4a0c6b', '#781c6d', '#a52c60', '#cf4446', '#ed6925', '#fb9b06', '#f7d13d', '#fcffa4'],
  viridis: ['#440154', '#472d7b', '#3b528b', '#2c728e', '#21918c', '#28ae80', '#5ec962', '#addc30', '#fde725'],
  zebra: ['#000000', '#ffffff', '#000000', '#ffffff', '#111111', '#eeeeee'],
  pastel: ['#fdf2ff', '#ffc6e0', '#c6b5ff', '#b5e8ff', '#c9ffe8', '#fff3b5', '#ffc6e0'],
  copper: ['#000000', '#3b1c0a', '#a1561d', '#f0a060', '#ffe6c8', '#7fd0c8', '#0d3b46'],
  aurora: ['#01030f', '#05304a', '#0fae8f', '#9bffb0', '#f4ffd0', '#b28cff', '#2a0f55'],
  // dark palettes: the picture stays low, so white text on top of it is always readable
  dusk: ['#020308', '#0a0d24', '#1a1840', '#3a2358', '#6b3460', '#a05a5a', '#6b3460', '#3a2358', '#1a1840', '#0a0d24'],
  ash: ['#020202', '#101214', '#23272b', '#3d4347', '#5f666b', '#8a8f92', '#5f666b', '#3d4347', '#23272b', '#101214'],
};
export const PALETTE_LABELS = { fire: 'Fire', ocean: 'Ocean', neon: 'Neon', gold: 'Gold', rainbow: 'Rainbow', mono: 'Silver', twilight: 'Twilight', electric: 'Electric', ice: 'Ice', forest: 'Forest', candy: 'Candy', lava: 'Lava', inferno: 'Inferno', viridis: 'Viridis', zebra: 'Zebra', pastel: 'Pastel', copper: 'Copper and teal', aurora: 'Aurora', dusk: 'Dusk (dark)', ash: 'Ash (dark)' };

const luts = new Map();
/**
 * 256-step RGB lookup of a palette (cyclic unless `open`: inferno and viridis run once and mirror back).
 * `tone` = { bright, contrast, sat } (1 = unchanged) is baked into the table, so it costs nothing per pixel.
 */
export function paletteLut(name, tone = null) {
  const b = Math.round((tone?.bright ?? 1) * 100) / 100, k = Math.round((tone?.contrast ?? 1) * 100) / 100, sa = Math.round((tone?.sat ?? 1) * 100) / 100;
  const key = b === 1 && k === 1 && sa === 1 ? name : `${name}|${b}|${k}|${sa}`;
  if (luts.has(key)) return luts.get(key);
  let stops = (FRACTAL_PALETTES[name] || FRACTAL_PALETTES.fire).map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  if (name === 'inferno' || name === 'viridis') stops = [...stops, ...stops.slice(1, -1).reverse()];
  const out = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const u = (i / 256) * stops.length, a = Math.floor(u) % stops.length, n = (a + 1) % stops.length, f = u - Math.floor(u);
    const rgb = [0, 1, 2].map((c) => stops[a][c] + (stops[n][c] - stops[a][c]) * f);
    if (key !== name) {
      const grey = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
      for (let c = 0; c < 3; c++) rgb[c] = clamp(((grey + (rgb[c] - grey) * sa - 127.5) * k + 127.5) * b, 0, 255);
    }
    for (let c = 0; c < 3; c++) out[i * 4 + c] = rgb[c];
    out[i * 4 + 3] = 255;
  }
  if (luts.size > 200) luts.clear(); // keyframed brightness makes many tables
  luts.set(key, out);
  return out;
}
/** The tone of a scene's settings (null when untouched), and its cache key. */
const toneOf = (P) => ((P.bright ?? 1) !== 1 || (P.contrast ?? 1) !== 1 || (P.sat ?? 1) !== 1 ? { bright: P.bright ?? 1, contrast: P.contrast ?? 1, sat: P.sat ?? 1 } : null);

/* ================================================================== types */

/**
 * The families. flags = [fold x before, fold y before, conjugate, fold real part after, fold imaginary part after]:
 * one loop serves them all: z ← fold(z)^p (conjugated or folded) + c.
 * kind: 0 = that loop, 1 = Phoenix, 2 = Lambda, 3 = Newton. `view` = [centre x, centre y, width] of the whole set.
 */
export const FRACTAL_TYPES = {
  mandelbrot: { label: 'Mandelbrot', formula: 'z → z² + c', kind: 0, flags: [0, 0, 0, 0, 0], view: [-0.6, 0, 3.4], julia: [-0.8, 0.156] },
  multibrot: { label: 'Multibrot (z to a power)', formula: 'z → z^p + c', kind: 0, flags: [0, 0, 0, 0, 0], view: [0, 0, 3.2], julia: [0.4, 0.4], power: 3 },
  burningship: { label: 'Burning Ship', formula: 'z → (|Re z| + i|Im z|)² + c', kind: 0, flags: [1, 1, 0, 0, 0], view: [-0.5, -0.55, 3.6], julia: [-1.3, -0.05], flip: true },
  tricorn: { label: 'Tricorn (Mandelbar)', formula: 'z → conj(z)² + c', kind: 0, flags: [0, 0, 1, 0, 0], view: [-0.2, 0, 4], julia: [-0.1, 0.9] },
  celtic: { label: 'Celtic', formula: 'z → |Re(z²)| + i·Im(z²) + c', kind: 0, flags: [0, 0, 0, 1, 0], view: [-0.6, 0, 4], julia: [-0.9, 0.2] },
  buffalo: { label: 'Buffalo', formula: 'z → |Re(z²)| + i|Im(z²)| + c', kind: 0, flags: [0, 0, 0, 1, 1], view: [-0.5, -0.5, 4], julia: [-0.7, -0.3], flip: true },
  perpendicular: { label: 'Perpendicular Mandelbrot', formula: 'z → (|Re z| − i·Im z)² + c', kind: 0, flags: [1, 0, 1, 0, 0], view: [-0.6, 0, 4], julia: [-0.9, 0.1] },
  heart: { label: 'Heart (perpendicular ship)', formula: 'z → (Re z + i|Im z|)² + c', kind: 0, flags: [0, 1, 0, 0, 0], view: [-0.5, -0.3, 4], julia: [-0.6, -0.4], flip: true },
  phoenix: { label: 'Phoenix', formula: 'zₙ₊₁ = zₙ² + Re(c) + Im(c)·zₙ₋₁', kind: 1, flags: [0, 0, 0, 0, 0], view: [0, 0, 3], julia: [0.5667, -0.5], juliaOnly: true },
  lambda: { label: 'Lambda (logistic map)', formula: 'z → c·z·(1 − z)', kind: 2, flags: [0, 0, 0, 0, 0], view: [1, 0, 6.4], julia: [3.02, 0.6] },
  newton: { label: 'Newton basins', formula: 'z → z − a·(z^p − 1) / (p·z^(p−1))', kind: 3, flags: [0, 0, 0, 0, 0], view: [0, 0, 3.4], julia: [0, 0], power: 3 },
};

/** Famous places to zoom into: [type, x, y]. Found on the boundary, so the picture stays alive on the way in. */
export const FRACTAL_SPOTS = {
  seahorse: ['Seahorse valley', 'mandelbrot', -0.7429476736060684, 0.13128137344313265],
  spiral: ['A double spiral', 'mandelbrot', -0.7613868094161869, -0.08491442689113037],
  elephant: ['Elephant valley', 'mandelbrot', 0.2759353624, 0.0069166138],
  lightning: ['Lightning', 'mandelbrot', -0.170337, -1.06506],
  needle: ['A tiny copy on the needle', 'mandelbrot', -1.7548776662466927, 0],
  tendrils: ['Tendrils', 'mandelbrot', -0.2263, 1.11617],
  starfish: ['Starfish', 'mandelbrot', -0.374004139, 0.659792175],
  feigenbaum: ['Feigenbaum point (period doubling)', 'mandelbrot', -1.4011551890, 0],
  ship: ['The ship itself', 'burningship', -1.7625, -0.0281],
  shipMast: ['Masts of the armada', 'burningship', -1.9417, -0.0045],
  tricornArm: ['A tricorn arm', 'tricorn', -1.0027, 0.0008],
  celticEye: ['Celtic knot', 'celtic', -1.1953, 0.3073],
  custom: ['My point', null, 0, 0],
};

/** Paths of c for Julia journeys. Each returns [re, im] for a phase in turns. */
export const JULIA_PATHS = {
  circle: { label: 'Round a circle |c| = r', at: (u, P) => [P.jr * Math.cos(TAU * u), P.jr * Math.sin(TAU * u)] },
  cardioid: { label: 'Along the edge of the main cardioid', at: (u, P) => { const a = TAU * u, k = P.jr / 0.7885; return [k * (0.5 * Math.cos(a) - 0.25 * Math.cos(2 * a)), k * (0.5 * Math.sin(a) - 0.25 * Math.sin(2 * a))]; } },
  bulb: { label: 'Round the period-2 bulb', at: (u) => [-1 + 0.255 * Math.cos(TAU * u), 0.255 * Math.sin(TAU * u)] },
  line: { label: 'Back and forth between two points', at: (u, P) => { const k = 0.5 - 0.5 * Math.cos(TAU * u); return [P.jx + (P.jx2 - P.jx) * k, P.jy + (P.jy2 - P.jy) * k]; } },
  fixed: { label: 'Stay at one point', at: (u, P) => [P.jx, P.jy] },
};

const COLORINGS = { smooth: 0, bands: 1, trap: 2, stripes: 3, angle: 4 };
const TRAPS = { point: 0, cross: 1, circle: 2, line: 3 };

/* ======================================================= one frame's setup */

/** Everything a frame needs, from the settings and the time: the same numbers feed the shader and the CPU. */
function frameOf(S, P) {
  const T = FRACTAL_TYPES[P.type] || FRACTAL_TYPES.mandelbrot;
  const t = S.st, dur = Math.max(4, (S.duration || 30) - (P.wait || 0) - 1);
  const u = clamp((t - (P.wait || 0)) / dur, 0, 1), ease = u * u * (3 - 2 * u);
  const julia = !!P.julia || T.juliaOnly;
  let [cx, cy, span] = julia && T.kind !== 3 ? [T.kind === 2 ? 0.5 : 0, 0, T.kind === 2 ? 3.2 : 3.4] : T.view;
  let power = T.kind === 0 || T.kind === 3 ? (P.type === 'mandelbrot' ? 2 : P.power) : 2;
  let zoom = 1;
  if (P.journey === 'zoom') {
    const spot = FRACTAL_SPOTS[P.spot];
    const target = spot && spot[1] ? [spot[2], spot[3]] : [P.cx, P.cy];
    zoom = 10 ** (P.depth * u);
    // glide from the whole set to the spot during the first tenth of the zoom, then dive
    const k = 1 - 1 / Math.max(1, zoom ** 0.9);
    cx += (target[0] - cx) * k; cy += (target[1] - cy) * k;
  } else if (P.journey === 'pan') {
    cx += span * 0.22 * Math.cos(TAU * 0.03 * t); cy += span * 0.16 * Math.sin(TAU * 0.041 * t);
    zoom = P.zoom || 1;
  } else zoom = P.zoom || 1;
  zoom *= 10 ** (P.zexp || 0); // extra zoom as a power of ten: keys on it dive at a steady pace
  if (P.journey !== 'zoom' && (P.cx || P.cy) && P.spot === 'custom') { cx = P.cx; cy = P.cy; }
  if (P.journey === 'power') power = P.power + (P.power2 - P.power) * ease;
  span /= zoom;
  const path = JULIA_PATHS[P.jpath] || JULIA_PATHS.circle;
  const c = P.journey === 'julia' ? path.at(t * P.jspeed + (P.jphase || 0), P) : julia ? (P.jpath === 'fixed' || P.journey !== 'julia' ? [P.jx, P.jy] : path.at(0, P)) : [0, 0];
  const iter = P.iter > 0 ? Math.round(P.iter) : Math.round(clamp(140 + 105 * Math.log10(Math.max(1, zoom)), 140, 1800));
  return {
    T, julia, cx, cy, span, zoom, power, c, iter,
    rot: TAU * (P.rotate || 0) * t, offset: (P.cycle || 0) * t + (P.shift || 0),
    coloring: COLORINGS[P.coloring] ?? 0, trap: TRAPS[P.trap] ?? 0, density: P.density ?? 1, interior: P.interior === 'glow' ? 1 : 0, relax: P.relax ?? 1,
  };
}

/* ============================================================ CPU renderer */

/**
 * The orbit of one point: used for the exact (64-bit) picture, the orbit drawn on top and the sound.
 * Returns { n, zx, zy, inside, trap, stripe } and, with `keep`, the points of the orbit.
 */
export function orbit(F, px, py, keep = null) {
  const { T, julia, power: p, iter } = F, [fx, fy, cj, ax, ay] = T.flags, kind = T.kind;
  let zx, zy, cr, ci;
  if (kind === 3) { zx = px; zy = py; cr = 0; ci = 0; }
  else if (julia) { zx = px; zy = py; cr = F.c[0]; ci = F.c[1]; }
  else { cr = px; ci = py; zx = kind === 2 ? 0.5 : 0; zy = 0; }
  let ox = 0, oy = 0, n = 0, trap = 1e9, stripe = 0;
  const B = kind === 3 ? 0 : 1e4, two = Math.abs(p - 2) < 1e-9;
  for (; n < iter; n++) {
    let nx, ny;
    if (kind === 0) {
      let x = fx ? Math.abs(zx) : zx, y = fy ? Math.abs(zy) : zy;
      if (cj) y = -y;
      if (two) { nx = x * x - y * y; ny = 2 * x * y; }
      else { const r = Math.hypot(x, y); if (r === 0) { nx = 0; ny = 0; } else { const a = Math.atan2(y, x) * p, m = r ** p; nx = m * Math.cos(a); ny = m * Math.sin(a); } }
      if (ax) nx = Math.abs(nx);
      if (ay) ny = Math.abs(ny);
      nx += cr; ny += ci;
    } else if (kind === 1) {
      nx = zx * zx - zy * zy + cr + ci * ox; ny = 2 * zx * zy + ci * oy;
      ox = zx; oy = zy;
    } else if (kind === 2) {
      const wx = zx - (zx * zx - zy * zy), wy = zy - 2 * zx * zy; // z(1 − z)
      nx = cr * wx - ci * wy; ny = cr * wy + ci * wx;
    } else {
      // Newton for z^p − 1: z − a (z^p − 1) / (p z^(p−1))
      const r = Math.hypot(zx, zy) || 1e-12, a = Math.atan2(zy, zx), m1 = r ** (p - 1);
      const dx = p * m1 * Math.cos(a * (p - 1)), dy = p * m1 * Math.sin(a * (p - 1));
      const fxr = m1 * r * Math.cos(a * p) - 1, fyi = m1 * r * Math.sin(a * p);
      const dd = dx * dx + dy * dy || 1e-30;
      nx = zx - F.relax * (fxr * dx + fyi * dy) / dd; ny = zy - F.relax * (fyi * dx - fxr * dy) / dd;
      if ((nx - zx) ** 2 + (ny - zy) ** 2 < 1e-10) { zx = nx; zy = ny; n++; break; }
    }
    zx = nx; zy = ny;
    if (keep) keep.push(zx, zy);
    const r2 = zx * zx + zy * zy;
    if (F.coloring === 2 || F.interior) {
      const d = F.trap === 1 ? Math.min(Math.abs(zx), Math.abs(zy)) : F.trap === 2 ? Math.abs(Math.sqrt(r2) - 1) : F.trap === 3 ? Math.abs(zy) : Math.sqrt(r2);
      if (d < trap) trap = d;
    }
    if (F.coloring === 3) stripe += 0.5 + 0.5 * Math.sin(5 * Math.atan2(zy, zx));
    if (kind !== 3 && r2 > B) { n++; break; }
    if (!(r2 < 1e30)) { n++; break; }
  }
  const r2 = zx * zx + zy * zy;
  const inside = kind === 3 ? false : !(r2 > B);
  return { n, zx, zy, r2, inside, trap, stripe };
}

/** Palette coordinate (0 … 1, cyclic) and brightness of an orbit's result. */
function shadeOf(F, o) {
  const { T } = F, p = F.power;
  if (T.kind === 3) {
    const k = Math.round((Math.atan2(o.zy, o.zx) / TAU) * p);
    return [frac(((k % p) + p) % p / p + 0.03 + F.offset), clamp(1.15 - 0.045 * o.n * (0.5 + F.density * 0.5), 0.12, 1)];
  }
  if (o.inside) return F.interior ? [frac(Math.sqrt(o.trap) * 0.9 + F.offset), 0.55] : [0, 0];
  const logp = Math.log(Math.max(1.0001, T.kind === 0 ? p : 2));
  const nu = o.n + 1 - Math.log(Math.max(1e-9, Math.log(Math.max(o.r2, 1.0001)) / 2)) / logp;
  let t, b = 1;
  switch (F.coloring) {
    case 1: t = (o.n * F.density) / 40; break;
    case 2: t = Math.sqrt(o.trap) * F.density * 0.9; b = clamp(1.2 - o.trap * 0.6, 0.25, 1); break;
    case 3: t = (o.stripe / Math.max(1, o.n)) * F.density * 1.5 + nu * 0.004; break;
    case 4: t = (nu * F.density) / 40; b = o.zy > 0 ? 1 : 0.62; break;
    default: t = (nu * F.density) / 40;
  }
  return [frac(t + F.offset), b];
}

function renderCpu(F, lut, img, W, H) {
  const px = img.data, s = F.span / W, cos = Math.cos(F.rot), sin = Math.sin(F.rot), flip = F.T.flip ? -1 : 1;
  for (let j = 0; j < H; j++) {
    const v = (H / 2 - j) * s * flip;
    for (let i = 0; i < W; i++) {
      const u = (i - W / 2) * s;
      const o = orbit(F, F.cx + u * cos - v * sin, F.cy + u * sin + v * cos);
      const [t, b] = shadeOf(F, o), k = (Math.floor(t * 256) & 255) * 4, q = (j * W + i) * 4;
      px[q] = lut[k] * b; px[q + 1] = lut[k + 1] * b; px[q + 2] = lut[k + 2] * b; px[q + 3] = 255;
    }
  }
}

/* ============================================================ GPU renderer */

const FRAG = `
precision highp float;
uniform vec2 uRes, uCenter, uC, uRot;
uniform float uSpan, uPower, uIter, uJulia, uKind, uFx, uFy, uConj, uAx, uAy, uColoring, uDensity, uOffset, uInterior, uTrap, uRelax, uFlip;
uniform sampler2D uPal;
const float TAU = 6.283185307179586;
void main() {
  vec2 q = (gl_FragCoord.xy - 0.5 * uRes) * (uSpan / uRes.x);
  q.y *= uFlip;
  vec2 pt = uCenter + vec2(q.x * uRot.x - q.y * uRot.y, q.x * uRot.y + q.y * uRot.x);
  vec2 z, c, old = vec2(0.0);
  if (uKind > 2.5) { z = pt; c = vec2(0.0); }
  else if (uJulia > 0.5) { z = pt; c = uC; }
  else { c = pt; z = uKind > 1.5 ? vec2(0.5, 0.0) : vec2(0.0); }
  float n = 0.0, trap = 1e9, stripe = 0.0, r2 = 0.0;
  bool done = false;
  for (int i = 0; i < 1800; i++) {
    if (float(i) >= uIter) break;
    vec2 w;
    if (uKind < 0.5) {
      float x = uFx > 0.5 ? abs(z.x) : z.x, y = uFy > 0.5 ? abs(z.y) : z.y;
      if (uConj > 0.5) y = -y;
      if (abs(uPower - 2.0) < 1e-5) w = vec2(x * x - y * y, 2.0 * x * y);
      else { float r = length(vec2(x, y)); if (r == 0.0) w = vec2(0.0); else { float a = atan(y, x) * uPower; w = pow(r, uPower) * vec2(cos(a), sin(a)); } }
      if (uAx > 0.5) w.x = abs(w.x);
      if (uAy > 0.5) w.y = abs(w.y);
      w += c;
    } else if (uKind < 1.5) {
      w = vec2(z.x * z.x - z.y * z.y + c.x + c.y * old.x, 2.0 * z.x * z.y + c.y * old.y);
      old = z;
    } else if (uKind < 2.5) {
      vec2 m = vec2(z.x - (z.x * z.x - z.y * z.y), z.y - 2.0 * z.x * z.y);
      w = vec2(c.x * m.x - c.y * m.y, c.x * m.y + c.y * m.x);
    } else {
      float r = max(length(z), 1e-12), a = atan(z.y, z.x), m1 = pow(r, uPower - 1.0);
      vec2 d = uPower * m1 * vec2(cos(a * (uPower - 1.0)), sin(a * (uPower - 1.0)));
      vec2 f = vec2(m1 * r * cos(a * uPower) - 1.0, m1 * r * sin(a * uPower));
      float dd = max(dot(d, d), 1e-30);
      w = z - uRelax * vec2(f.x * d.x + f.y * d.y, f.y * d.x - f.x * d.y) / dd;
      if (dot(w - z, w - z) < 1e-10) { z = w; n += 1.0; done = true; break; }
    }
    z = w;
    r2 = dot(z, z);
    float dtrap = uTrap < 0.5 ? sqrt(r2) : uTrap < 1.5 ? min(abs(z.x), abs(z.y)) : uTrap < 2.5 ? abs(sqrt(r2) - 1.0) : abs(z.y);
    trap = min(trap, dtrap);
    stripe += 0.5 + 0.5 * sin(5.0 * atan(z.y, z.x));
    n += 1.0;
    if (uKind < 2.5 && r2 > 1e4) { done = true; break; }
  }
  float t = 0.0, b = 1.0;
  if (uKind > 2.5) {
    float k = floor(atan(z.y, z.x) / TAU * uPower + 0.5);
    t = fract(mod(k, uPower) / uPower + 0.03 + uOffset);
    b = clamp(1.15 - 0.045 * n * (0.5 + uDensity * 0.5), 0.12, 1.0);
  } else if (!done) {
    if (uInterior > 0.5) { t = fract(sqrt(trap) * 0.9 + uOffset); b = 0.55; } else b = 0.0;
  } else {
    float logp = log(max(1.0001, uKind < 0.5 ? uPower : 2.0));
    float nu = n + 1.0 - log(max(1e-9, log(max(r2, 1.0001)) / 2.0)) / logp;
    if (uColoring < 0.5) t = nu * uDensity / 40.0;
    else if (uColoring < 1.5) t = n * uDensity / 40.0;
    else if (uColoring < 2.5) { t = sqrt(trap) * uDensity * 0.9; b = clamp(1.2 - trap * 0.6, 0.25, 1.0); }
    else if (uColoring < 3.5) t = stripe / max(1.0, n) * uDensity * 1.5 + nu * 0.004;
    else { t = nu * uDensity / 40.0; b = z.y > 0.0 ? 1.0 : 0.62; }
    t = fract(t + uOffset);
  }
  gl_FragColor = vec4(texture2D(uPal, vec2(t, 0.5)).rgb * b, 1.0);
}`;

const gpu = { canvas: null, gl: null, prog: null, loc: {}, pal: '', failed: false };
function gpuReady() {
  if (gpu.failed) return false;
  if (gpu.gl && !gpu.gl.isContextLost()) return true;
  try {
    const c = (gpu.canvas = document.createElement('canvas'));
    const gl = c.getContext('webgl', { antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    if (!gl || gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision < 23) throw new Error('no highp');
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }'));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.REPEAT], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gpu.gl = gl; gpu.prog = prog; gpu.loc = {}; gpu.pal = '';
    return true;
  } catch { gpu.failed = true; return false; }
}

function renderGpu(F, palette, W, H, tone = null) {
  const { gl, canvas } = gpu;
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  gl.viewport(0, 0, W, H);
  const lut = paletteLut(palette, tone);
  if (gpu.pal !== lut) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, lut); gpu.pal = lut; }
  const U = (name) => (gpu.loc[name] ||= gl.getUniformLocation(gpu.prog, name));
  const f = F.T.flags;
  gl.uniform2f(U('uRes'), W, H); gl.uniform2f(U('uCenter'), F.cx, F.cy); gl.uniform2f(U('uC'), F.c[0], F.c[1]);
  gl.uniform2f(U('uRot'), Math.cos(F.rot), Math.sin(F.rot));
  const set = { uSpan: F.span, uPower: F.power, uIter: Math.min(1800, F.iter), uJulia: F.julia ? 1 : 0, uKind: F.T.kind, uFx: f[0], uFy: f[1], uConj: f[2], uAx: f[3], uAy: f[4],
    uColoring: F.coloring, uDensity: F.density, uOffset: frac(F.offset), uInterior: F.interior, uTrap: F.trap, uRelax: F.relax, uFlip: F.T.flip ? -1 : 1 };
  for (const [k, v] of Object.entries(set)) gl.uniform1f(U(k), v);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  return canvas;
}

/* ================================================================= fractal */

let cpuCanvas = null;

const fractal = {
  label: 'Fractal explorer (Mandelbrot, Julia, Burning Ship, Newton …)', group: 'Fractals',
  defaults: {
    type: 'mandelbrot', julia: false, journey: 'zoom', spot: 'seahorse', cx: -0.7429476736060684, cy: 0.13128137344313265, depth: 6, zoom: 1, wait: 1,
    jpath: 'circle', jr: 0.7885, jspeed: 0.04, jx: -0.8, jy: 0.156, jx2: 0.285, jy2: 0.01, power: 3, power2: 6, relax: 1,
    colors: 'fire', coloring: 'smooth', density: 1, cycle: 0.02, interior: 'black', trap: 'point', rotate: 0, res: 540, iter: 0,
    sound: 'journey', nps: 2, showOrbit: false, bleed: true,
    bright: 1, contrast: 1, sat: 1, shift: 0, zexp: 0, jphase: 0,
  },
  controls: [
    ['type', 'Family', 's', Object.fromEntries(Object.entries(FRACTAL_TYPES).map(([k, v]) => [k, `${v.label}:  ${v.formula}`]))],
    ['julia', 'Julia view (c fixed, the picture is the plane of z)', 't'],
    ['journey', 'Journey', 's', { zoom: 'Zoom into a spot', julia: 'Julia morph: c travels', power: 'The power grows', pan: 'Slow pan', still: 'Stand still (colours cycle)' }],
    ['spot', 'Zoom: into', 's', Object.fromEntries(Object.entries(FRACTAL_SPOTS).map(([k, v]) => [k, v[0]]))],
    ['cx', 'My point: real part', 'r', -2.5, 2.5, 0.0000001], ['cy', 'My point: imaginary part', 'r', -2.5, 2.5, 0.0000001],
    ['depth', 'Zoom: ×10 to the power', 'r', 0.5, 13, 0.5], ['zoom', 'Fixed zoom (other journeys)', 'r', 0.3, 200, 0.1], ['zexp', 'Extra zoom: ×10 to the power (key this for your own dive)', 'r', 0, 13, 0.01], ['wait', 'Seconds before it starts', 'r', 0, 6, 0.5],
    ['jpath', 'Julia: path of c', 's', Object.fromEntries(Object.entries(JULIA_PATHS).map(([k, v]) => [k, v.label]))],
    ['jr', 'Julia: size of the path', 'r', 0.1, 1.2, 0.0001], ['jspeed', 'Julia: rounds per second (0 = only keys move c)', 'r', 0, 0.3, 0.001],
    ['jphase', 'Julia: place on the path, in rounds (key this for exact timing)', 'r', 0, 4, 0.001],
    ['jx', 'Julia: c real part (fixed / start)', 'r', -2, 2, 0.0001], ['jy', 'Julia: c imaginary part', 'r', -2, 2, 0.0001],
    ['jx2', 'Julia: end point, real part', 'r', -2, 2, 0.0001], ['jy2', 'Julia: end point, imaginary part', 'r', -2, 2, 0.0001],
    ['power', 'Power p (Multibrot, Newton)', 'r', 2, 9, 0.01], ['power2', 'Power at the end (power journey)', 'r', 2, 9, 0.01], ['relax', 'Newton: step a (1 = classic)', 'r', 0.3, 1.9, 0.01],
    ['colors', 'Palette', 's', PALETTE_LABELS],
    ['coloring', 'Colouring', 's', { smooth: 'Smooth (how fast it escapes)', bands: 'Bands (whole steps)', trap: 'Orbit trap (how close the orbit comes)', stripes: 'Stripes (direction of the orbit)', angle: 'Binary decomposition (checkered)' }],
    ['trap', 'Trap shape', 's', { point: 'A point', cross: 'A cross', circle: 'A circle', line: 'A line' }],
    ['density', 'Colour bands (density)', 'r', 0.1, 6, 0.05], ['cycle', 'Colour cycling per second', 'r', -0.5, 0.5, 0.005],
    ['shift', 'Colour shift (rounds of the palette; key this)', 'r', 0, 4, 0.01],
    ['bright', 'Brightness', 'r', 0.2, 2.5, 0.01], ['contrast', 'Contrast', 'r', 0.4, 2.5, 0.01], ['sat', 'Colour strength (0 = grey)', 'r', 0, 2, 0.01],
    ['interior', 'Inside the set', 's', { black: 'Black', glow: 'Glow (how close the orbit comes to the trap)' }],
    ['rotate', 'Turn the picture (rounds per second)', 'r', -0.2, 0.2, 0.002],
    ['iter', 'Iterations (0 = automatic)', 'r', 0, 1800, 10], ['res', 'Detail (pixels across)', 'r', 160, 1080, 20],
    ['sound', 'Sound from', 's', { journey: 'The journey (depth, c, power)', orbit: 'The orbit of a wandering point', off: 'Silent' }],
    ['nps', 'Notes per beat', 'r', 0, 8, 1], ['showOrbit', 'Draw the orbit of the wandering point', 't'],
    ['bleed', 'Fill the whole frame (off = only the safe area)', 't'],
  ],
  init(S) { S.sc = { tick: -1 }; },
  frame(S, P) { return frameOf(S, P); },
  /** The wandering point whose orbit is drawn and played: c itself on a Julia journey, else a slow loop in the view. */
  wanderer(S, P, F) {
    if (F.julia && F.T.kind !== 3) return [0, 0]; // the critical orbit of the current c
    const t = S.st;
    return [F.cx + F.span * 0.3 * Math.cos(TAU * 0.037 * t + 1), F.cy + F.span * 0.22 * Math.sin(TAU * 0.053 * t)];
  },
  step(S, P, dt, emit) {
    if (P.sound === 'off' || P.nps <= 0) return;
    const q = Math.floor((S.st * S.bpm * P.nps) / 60);
    if (q === S.sc.tick) return;
    S.sc.tick = q;
    const F = frameOf(S, P);
    if (P.sound === 'orbit') {
      // the k-th point of the orbit of the wandering point: its distance from the origin is the pitch
      const [wx, wy] = this.wanderer(S, P, F), pts = [];
      orbit({ ...F, iter: 16 }, wx, wy, pts);
      const k = (q % 8) * 2, r = Math.hypot(pts[k] ?? 0, pts[k + 1] ?? 0);
      if (Number.isFinite(r) && k < pts.length) emit({ type: 'hit', ball: q % 8, x: 0, y: 0, angle: Math.atan2(pts[k + 1] || 0, pts[k] || 0), pitch: clamp(r / 2.2, 0, 1) });
      return;
    }
    const base = P.journey === 'zoom' ? Math.log10(F.zoom) / Math.max(1, P.depth) : P.journey === 'power' ? (F.power - 2) / 7 : 0.5 + 0.3 * Math.sin(Math.atan2(F.c[1], F.c[0]));
    emit({ type: 'hit', ball: q % 8, x: 0, y: 0, angle: 0, pitch: clamp(0.15 + 0.6 * base + [0, 0.1, 0.2, 0.1][q % 4], 0, 1) });
  },
  draw(S, P, D) {
    const { g, k } = D, { hw, hh } = S.W;
    const F = frameOf(S, P);
    // 32-bit numbers on the graphics card are exact enough down to a width of about 3e-5
    const deep = F.span < 3e-5;
    const useGpu = !deep && gpuReady();
    // the picture fills the whole frame (bleed) or only the safe area in the middle; either way the
    // safe area shows the same part of the plane, so titles and captions sit over the margins
    const cv = g.canvas, bleed = P.bleed !== false && cv && (D.look?.zoom ?? 1) >= 0.99;
    const box = bleed ? { x: 0, y: 0, w: cv.width, h: cv.height } : { x: D.X(-hw), y: D.Y(hh), w: 2 * hw * D.R, h: 2 * hh * D.R };
    if (bleed) { F.cx += ((cv.width / 2 - D.X(0)) / D.R) * (F.span / (2 * hw)) * Math.cos(F.rot); F.cy += ((D.Y(0) - cv.height / 2) / D.R) * (F.span / (2 * hw)) * (F.T.flip ? -1 : 1); F.spanBand = F.span; F.span *= cv.width / (2 * hw * D.R); }
    const W = clamp(Math.round(useGpu ? P.res : Math.min(P.res, deep ? 300 : 260)), 80, 1080), H = Math.max(2, Math.round((W * box.h) / box.w));
    let src;
    if (useGpu) src = renderGpu(F, P.colors, W, H, toneOf(P));
    else {
      const c = (cpuCanvas ||= document.createElement('canvas'));
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      const cg = c.getContext('2d'), img = cg.createImageData(W, H);
      renderCpu(F, paletteLut(P.colors, toneOf(P)), img, W, H);
      cg.putImageData(img, 0, 0);
      src = c;
    }
    g.imageSmoothingEnabled = true;
    g.drawImage(src, box.x, box.y, box.w, box.h);
    if (P.showOrbit) {
      const [wx, wy] = this.wanderer(S, P, frameOf(S, P)), pts = [wx, wy];
      orbit({ ...F, iter: 60 }, wx, wy, pts);
      // world point → canvas pixel, through the middle of the drawn box
      const cos = Math.cos(-F.rot), sin = Math.sin(-F.rot), sc = box.w / F.span, flip = F.T.flip ? -1 : 1, mx = box.x + box.w / 2, my = box.y + box.h / 2;
      const SX = (x, y) => mx + ((x - F.cx) * cos - (y - F.cy) * sin) * sc, SY = (x, y) => my - ((x - F.cx) * sin + (y - F.cy) * cos) * sc * flip;
      g.save();
      g.beginPath(); g.rect(box.x, box.y, box.w, box.h); g.clip();
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.4 * k; g.lineJoin = 'round'; g.shadowColor = '#000'; g.shadowBlur = 4 * k;
      g.beginPath();
      for (let i = 0; i < pts.length; i += 2) { if (!Number.isFinite(pts[i]) || Math.abs(pts[i]) > 50) break; const x = SX(pts[i], pts[i + 1]), y = SY(pts[i], pts[i + 1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
      g.fillStyle = '#ffffff';
      for (let i = 0; i < Math.min(pts.length, 40); i += 2) { if (!Number.isFinite(pts[i]) || Math.abs(pts[i]) > 50) break; g.beginPath(); g.arc(SX(pts[i], pts[i + 1]), SY(pts[i], pts[i + 1]), (i ? 2.6 : 5) * k, 0, TAU); g.fill(); }
      g.restore();
    }
  },
  stats(S, P) {
    const F = frameOf(S, P);
    if (P.journey === 'julia' || (F.julia && F.T.kind !== 3)) return `c = ${F.c[0].toFixed(4)} ${F.c[1] < 0 ? '−' : '+'} ${Math.abs(F.c[1]).toFixed(4)}i`;
    if (P.journey === 'power') return `p = ${F.power.toFixed(2)}`;
    const z = F.zoom;
    return `zoom × ${z < 1e4 ? Math.round(z).toLocaleString('en') : z.toExponential(1).replace('e+', ' × 10^')}`;
  },
  formula: (P) => (FRACTAL_TYPES[P.type] || FRACTAL_TYPES.mandelbrot).formula,
};

/* ================================================================== buddha */

const buddha = {
  label: 'Buddhabrot (the paths of escaping points)', group: 'Fractals',
  defaults: { rate: 2600, minIter: 12, maxIter: 300, anti: false, colors: 'twilight', gain: 1.4, res: 300, nps: 2 },
  controls: [
    ['rate', 'Orbits per second', 'r', 100, 8000, 50], ['minIter', 'Only orbits longer than', 'r', 1, 200, 1], ['maxIter', 'and shorter than', 'r', 20, 2000, 10],
    ['anti', 'Anti-Buddhabrot (the orbits that stay)', 't'], ['colors', 'Palette', 's', PALETTE_LABELS], ['gain', 'Brightness', 'r', 0.3, 4, 0.05],
    ['res', 'Detail (pixels across)', 'r', 120, 500, 10], ['nps', 'Notes per beat (pitch = length of an orbit)', 'r', 0, 8, 1],
  ],
  init(S, P) {
    const { hw, hh } = S.W, W = clamp(P.res | 0, 80, 500), H = Math.round((W * hh) / hw);
    S.sc = { W, H, acc: new Float32Array(W * H), count: 0, peak: 1, tick: -1, lastLen: 0, buf: new Float64Array(P.maxIter * 2 + 2) };
  },
  step(S, P, dt, emit) {
    const sc = S.sc, { W, H } = sc, want = Math.floor(S.st * P.rate);
    const scale = W / 3.4, max = Math.round(P.maxIter), min = Math.round(P.minIter), buf = sc.buf;
    while (sc.count < want) {
      sc.count++;
      const cr = -2.2 + 3.4 * S.rand(), ci = -1.7 + 3.4 * S.rand();
      // inside the main cardioid or the period-2 bulb: never escapes
      const q = (cr - 0.25) ** 2 + ci * ci, known = q * (q + (cr - 0.25)) <= 0.25 * ci * ci || (cr + 1) ** 2 + ci * ci <= 0.0625;
      if (known && !P.anti) continue;
      let zx = 0, zy = 0, n = 0;
      for (; n < max; n++) { const t = zx * zx - zy * zy + cr; zy = 2 * zx * zy + ci; zx = t; buf[n * 2] = zx; buf[n * 2 + 1] = zy; if (zx * zx + zy * zy > 16) break; }
      const escaped = n < max;
      if (P.anti ? escaped : !escaped || n < min) continue;
      sc.lastLen = n;
      // the picture is turned: the real axis runs up, so the figure sits upright
      for (let i = 0; i < n; i++) {
        const px = Math.floor(W / 2 + buf[i * 2 + 1] * scale), py = Math.floor(H / 2 + (buf[i * 2] + 0.45) * scale);
        if (px >= 0 && px < W && py >= 0 && py < H) { const v = ++sc.acc[py * W + px]; if (v > sc.peak) sc.peak = v; }
      }
    }
    if (P.nps > 0) {
      const tq = Math.floor((S.st * S.bpm * P.nps) / 60);
      if (tq !== sc.tick) { sc.tick = tq; emit({ type: 'hit', ball: tq % 8, x: 0, y: 0, angle: 0, pitch: clamp(Math.log(1 + sc.lastLen) / Math.log(1 + max), 0, 1) }); }
    }
  },
  draw(S, P, D) {
    const sc = S.sc, { W, H } = sc, { hw, hh } = S.W;
    const c = (buddha.canvas ||= document.createElement('canvas'));
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const cg = c.getContext('2d'), img = cg.createImageData(W, H), px = img.data, L = paletteLut(P.colors);
    const norm = 1 / Math.sqrt(sc.peak);
    for (let i = 0; i < W * H; i++) {
      const v = clamp(Math.sqrt(sc.acc[i]) * norm * P.gain, 0, 1), k = Math.min(255, Math.floor(v * 255 * 0.52)) * 4, b = Math.min(1, v * 2.4);
      px[i * 4] = L[k] * b + 255 * Math.max(0, v - 0.8); px[i * 4 + 1] = L[k + 1] * b + 255 * Math.max(0, v - 0.8); px[i * 4 + 2] = L[k + 2] * b + 255 * Math.max(0, v - 0.8); px[i * 4 + 3] = 255;
    }
    cg.putImageData(img, 0, 0);
    D.g.imageSmoothingEnabled = true;
    D.g.drawImage(c, D.X(-hw), D.Y(hh), 2 * hw * D.R, 2 * hh * D.R);
  },
  stats(S) { return `${S.sc.count.toLocaleString('en')} points tried`; },
  formula: () => 'every point of every escaping orbit of z → z² + c',
};

/* ================================================================ lyapunov */

const lyapunov = {
  label: 'Lyapunov fractal (order and chaos of a population)', group: 'Fractals',
  defaults: { seq: 'AB', a0: 2, a1: 4, b0: 2, b1: 4, colors: 'copper', iters: 120, res: 260, cycle: 0.01, reveal: 6, nps: 2 },
  controls: [
    ['seq', 'Rhythm of the two growth rates (A and B)', 'x', 'AB'],
    ['a0', 'A from', 'r', 0, 4, 0.01], ['a1', 'A to', 'r', 0, 4, 0.01], ['b0', 'B from', 'r', 0, 4, 0.01], ['b1', 'B to', 'r', 0, 4, 0.01],
    ['colors', 'Palette', 's', PALETTE_LABELS], ['iters', 'Generations', 'r', 40, 600, 10], ['res', 'Detail (pixels across)', 'r', 100, 420, 10],
    ['cycle', 'Colour cycling per second', 'r', -0.3, 0.3, 0.005], ['reveal', 'Seconds to scan the picture in', 'r', 0, 30, 0.5], ['nps', 'Notes per beat (pitch = order or chaos under the scan)', 'r', 0, 8, 1],
  ],
  init(S, P) {
    const { hw, hh } = S.W, W = clamp(P.res | 0, 60, 420), H = Math.round((W * hh) / hw);
    const seq = (String(P.seq || 'AB').toUpperCase().replace(/[^AB]/g, '') || 'AB').slice(0, 24), n = Math.round(P.iters), field = new Float32Array(W * H);
    for (let j = 0; j < H; j++) {
      const b = P.b1 - ((P.b1 - P.b0) * j) / (H - 1);
      for (let i = 0; i < W; i++) {
        const a = P.a0 + ((P.a1 - P.a0) * i) / (W - 1);
        let x = 0.5, sum = 0;
        for (let m = 0; m < 40; m++) x = (seq[m % seq.length] === 'A' ? a : b) * x * (1 - x);
        for (let m = 0; m < n; m++) { const r = seq[m % seq.length] === 'A' ? a : b; x = r * x * (1 - x); sum += Math.log(Math.abs(r * (1 - 2 * x)) + 1e-12); }
        field[j * W + i] = sum / n;
      }
    }
    S.sc = { W, H, field, seq, tick: -1 };
  },
  step(S, P, dt, emit) {
    if (P.nps <= 0) return;
    const sc = S.sc, q = Math.floor((S.st * S.bpm * P.nps) / 60);
    if (q === sc.tick) return;
    sc.tick = q;
    // a point walks a slow loop over the picture; order sounds low and calm, chaos high
    const i = Math.floor(sc.W * (0.5 + 0.4 * Math.cos(S.st * 0.21))), j = Math.floor(sc.H * (0.5 + 0.4 * Math.sin(S.st * 0.13)));
    const v = sc.field[clamp(j, 0, sc.H - 1) * sc.W + clamp(i, 0, sc.W - 1)];
    emit({ type: 'hit', ball: q % 8, x: 0, y: 0, angle: 0, pitch: clamp(0.5 + v * 0.45, 0, 1) });
  },
  draw(S, P, D) {
    const sc = S.sc, { W, H, field } = sc, { hw, hh } = S.W;
    const c = (lyapunov.canvas ||= document.createElement('canvas'));
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const cg = c.getContext('2d'), img = cg.createImageData(W, H), px = img.data, L = paletteLut(P.colors);
    const shown = P.reveal > 0 ? clamp(S.st / P.reveal, 0, 1) * H : H, off = P.cycle * S.st;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const v = field[j * W + i], q = (j * W + i) * 4;
      if (j > shown) { px[q] = px[q + 1] = px[q + 2] = 0; px[q + 3] = 255; continue; }
      if (v > 0) { const b = clamp(v * 1.6, 0, 1) * 40; px[q] = 4 + b * 0.3; px[q + 1] = 6 + b * 0.5; px[q + 2] = 16 + b; } // chaos: deep blue-black
      else { const k = (Math.floor(frac(Math.sqrt(-v) * 0.75 + off) * 256) & 255) * 4; px[q] = L[k]; px[q + 1] = L[k + 1]; px[q + 2] = L[k + 2]; }
      px[q + 3] = 255;
    }
    cg.putImageData(img, 0, 0);
    D.g.imageSmoothingEnabled = true;
    D.g.drawImage(c, D.X(-hw), D.Y(hh), 2 * hw * D.R, 2 * hh * D.R);
  },
  stats(S) { return `rhythm ${S.sc.seq}`; },
  formula: () => 'xₙ₊₁ = rₙ xₙ (1 − xₙ),  λ = mean of ln|rₙ(1 − 2xₙ)|',
};

/* ===================================================================== ifs */

/** Affine maps [a, b, c, d, e, f, weight]: (x, y) → (a x + b y + e, c x + d y + f). `box` = [xmin, xmax, ymin, ymax]. */
export const IFS_SYSTEMS = {
  fern: { label: "Barnsley's fern", box: [-2.6, 2.9, 0, 10], maps: [[0, 0, 0, 0.16, 0, 0, 0.01], [0.85, 0.04, -0.04, 0.85, 0, 1.6, 0.85], [0.2, -0.26, 0.23, 0.22, 0, 1.6, 0.07], [-0.15, 0.28, 0.26, 0.24, 0, 0.44, 0.07]] },
  fern2: { label: 'Cyclosorus fern', box: [-1.6, 1.6, 0, 7.2], maps: [[0, 0, 0, 0.25, 0, -0.4, 0.02], [0.95, 0.005, -0.005, 0.93, -0.002, 0.5, 0.84], [0.035, -0.2, 0.16, 0.04, -0.09, 0.02, 0.07], [-0.04, 0.2, 0.16, 0.04, 0.083, 0.12, 0.07]] },
  sierpinski: { label: 'Sierpiński triangle', box: [0, 1, 0, 0.9], maps: [[0.5, 0, 0, 0.5, 0, 0, 1], [0.5, 0, 0, 0.5, 0.5, 0, 1], [0.5, 0, 0, 0.5, 0.25, 0.433, 1]] },
  carpet: { label: 'Sierpiński carpet', box: [0, 1, 0, 1], maps: [0, 1, 2, 3, 5, 6, 7, 8].map((i) => [1 / 3, 0, 0, 1 / 3, (i % 3) / 3, Math.floor(i / 3) / 3, 1]) },
  vicsek: { label: 'Vicsek cross', box: [0, 1, 0, 1], maps: [1, 3, 4, 5, 7].map((i) => [1 / 3, 0, 0, 1 / 3, (i % 3) / 3, Math.floor(i / 3) / 3, 1]) },
  dragon: { label: 'Heighway dragon', box: [-0.45, 1.25, -0.45, 0.75], maps: [[0.5, -0.5, 0.5, 0.5, 0, 0, 1], [-0.5, -0.5, 0.5, -0.5, 1, 0, 1]] },
  twindragon: { label: 'Twin dragon', box: [-0.4, 1.4, -0.75, 0.75], maps: [[0.5, -0.5, 0.5, 0.5, 0, 0, 1], [0.5, -0.5, 0.5, 0.5, 1, 0, 1]].map(([a, b, c, d, e, f, w], i) => [a, b, c, d, i ? 0.5 : 0, i ? -0.5 : 0, w]) },
  levy: { label: 'Lévy C curve', box: [-0.6, 1.6, -0.35, 1.1], maps: [[0.5, -0.5, 0.5, 0.5, 0, 0, 1], [0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 1]] },
  koch: { label: 'Koch curve', box: [0, 1, -0.1, 0.4], maps: [[1 / 3, 0, 0, 1 / 3, 0, 0, 1], [1 / 6, -0.2887, 0.2887, 1 / 6, 1 / 3, 0, 1], [1 / 6, 0.2887, -0.2887, 1 / 6, 0.5, 0.2887, 1], [1 / 3, 0, 0, 1 / 3, 2 / 3, 0, 1]] },
  maple: { label: 'Maple leaf', box: [-3.6, 3.6, -3.2, 3.9], maps: [[0.14, 0.01, 0, 0.51, -0.08, -1.31, 0.1], [0.43, 0.52, -0.45, 0.5, 1.49, -0.75, 0.35], [0.45, -0.49, 0.47, 0.47, -1.62, -0.74, 0.35], [0.49, 0, 0, 0.51, 0.02, 1.62, 0.2]] },
  tree: { label: 'Tree', box: [-0.55, 0.55, 0, 1.1], maps: [[0, 0, 0, 0.5, 0, 0, 0.05], [0.42, -0.42, 0.42, 0.42, 0, 0.2, 0.4], [0.42, 0.42, -0.42, 0.42, 0, 0.2, 0.4], [0.1, 0, 0, 0.1, 0, 0.2, 0.15]] },
  spiral: { label: 'Spiral', box: [-7.5, 8.5, -8, 6.5], maps: [[0.787879, -0.424242, 0.242424, 0.859848, 1.758647, 1.408065, 0.9], [-0.121212, 0.257576, 0.151515, 0.05303, -6.721654, 1.377236, 0.05], [0.181818, -0.136364, 0.090909, 0.181818, 6.086107, 1.568035, 0.05]] },
  crystal: { label: 'Crystal', box: [0, 1, 0, 1], maps: [[0.255, 0, 0, 0.255, 0.3726, 0.6714, 1], [0.255, 0, 0, 0.255, 0.1146, 0.2232, 1], [0.255, 0, 0, 0.255, 0.6306, 0.2232, 1], [0.37, -0.642, 0.642, 0.37, 0.6356, -0.0061, 1]] },
  pentaflake: { label: 'Pentaflake', box: [-1.05, 1.05, -1.05, 1.05], maps: Array.from({ length: 5 }, (_, i) => { const r = 0.381966, a = Math.PI / 2 + (TAU * i) / 5; return [r, 0, 0, r, (1 - r) * Math.cos(a), (1 - r) * Math.sin(a), 1]; }) },
  hexaflake: { label: 'Hexaflake', box: [-1.05, 1.05, -1.05, 1.05], maps: [...Array.from({ length: 6 }, (_, i) => { const a = (TAU * i) / 6; return [1 / 3, 0, 0, 1 / 3, (2 / 3) * Math.cos(a), (2 / 3) * Math.sin(a), 1]; }), [1 / 3, 0, 0, 1 / 3, 0, 0, 1]] },
  pythagoras: { label: 'Pythagoras tree (leaves)', box: [-2.6, 3.6, 0, 4.2], maps: [[0.5, -0.5, 0.5, 0.5, 0, 1, 1], [0.5, 0.5, -0.5, 0.5, 0.5, 1.5, 1], [1, 0, 0, 1, 0, 0, 0.25]].map((m, i) => (i === 2 ? [0.02, 0, 0, 0.5, 0.5, 0, 0.15] : m)) },
};

const ifs = {
  label: 'Chaos game and IFS (fern, dragon, snowflakes …)', group: 'Fractals',
  defaults: { system: 'fern', rate0: 40, accel: 1.5, max: 150000, dot: 1, colorBy: 'map', spin: 0, nps: 3 },
  controls: [
    ['system', 'Fractal', 's', Object.fromEntries(Object.entries(IFS_SYSTEMS).map(([k, v]) => [k, `${v.label} (${v.maps.length} rules)`]))],
    ['rate0', 'Points per second at the start', 'r', 1, 400, 1], ['accel', 'Speed-up per second', 'r', 1, 2, 0.01], ['max', 'Most points', 'r', 5000, 190000, 5000],
    ['dot', 'Dot size', 'r', 0.4, 3, 0.1], ['colorBy', 'Colour by', 's', { map: 'The rule that made the point', height: 'Height', time: 'When it was drawn' }],
    ['nps', 'Notes per beat (pitch = the rule chosen)', 'r', 0, 8, 1],
  ],
  init(S, P) {
    const sys = IFS_SYSTEMS[P.system] || IFS_SYSTEMS.fern, total = sys.maps.reduce((s, m) => s + m[6], 0);
    const [x0, x1, y0, y1] = sys.box, { hw, hh } = S.W;
    const sc = Math.min((hw * 1.9) / (x1 - x0), (hh * 1.9) / (y1 - y0));
    S.sc = { sys, total, x: 0, y: 0, count: 0, tick: -1, last: 0, place: (x, y) => [(x - (x0 + x1) / 2) * sc, (y - (y0 + y1) / 2) * sc], yr: [y0, y1] };
  },
  step(S, P, dt, emit) {
    const sc = S.sc, { sys } = sc;
    // points so far: rate0 per second, growing by `accel` every second, up to the cap
    const want = Math.min(P.max, Math.floor(P.accel > 1.001 ? (P.rate0 * (P.accel ** S.st - 1)) / Math.log(P.accel) : P.rate0 * S.st));
    let guard = 0;
    while (sc.count < want && guard++ < 6000) {
      let r = S.rand() * sc.total, k = 0;
      while (k < sys.maps.length - 1 && r > sys.maps[k][6]) { r -= sys.maps[k][6]; k++; }
      const [a, b, c, d, e, f] = sys.maps[k];
      const nx = a * sc.x + b * sc.y + e, ny = c * sc.x + d * sc.y + f;
      sc.x = nx; sc.y = ny; sc.last = k; sc.count++;
      if (sc.count > 12) {
        const [X, Y] = sc.place(nx, ny);
        const hue = P.colorBy === 'height' ? (ny - sc.yr[0]) / (sc.yr[1] - sc.yr[0]) * 0.8 : P.colorBy === 'time' ? frac(sc.count / 30000) : k / sys.maps.length + 0.08;
        S.addDot(X, Y, P.dot, hue, 0.9);
      }
    }
    if (P.nps > 0) {
      const tq = Math.floor((S.st * S.bpm * P.nps) / 60);
      if (tq !== sc.tick) { sc.tick = tq; const [X, Y] = sc.place(sc.x, sc.y); emit({ type: 'hit', ball: sc.last, x: X, y: Y, angle: Math.atan2(Y, X), pitch: clamp(sc.last / Math.max(1, sys.maps.length - 1), 0, 1), balls: sc.count }); }
    }
  },
  draw(S, P, D) {
    // the dots are inked by the view; mark the newest point
    const [X, Y] = S.sc.place(S.sc.x, S.sc.y), { g, k } = D;
    g.fillStyle = '#ffffff'; g.shadowColor = D.pal.glow; g.shadowBlur = 12 * k;
    g.beginPath(); g.arc(D.X(X), D.Y(Y), 3.5 * k, 0, TAU); g.fill(); g.shadowBlur = 0;
  },
  stats(S) { return `${S.sc.count.toLocaleString('en')} points · ${S.sc.sys.maps.length} rules`; },
  formula: (P) => `${(IFS_SYSTEMS[P.system] || IFS_SYSTEMS.fern).maps.length} shrinking maps, one chosen by chance each step`,
};

export const FRACTAL_LAB = { fractal, buddha, lyapunov, ifs };

/** For tests. */
export const _internals = { frameOf, shadeOf };
