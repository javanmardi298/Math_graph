/**
 * Vibration & waves: grains that start as random chaos and are shaken into a shape.
 *
 *   chladni  sand (or rice) on a vibrating plate. A grain is kicked harder where the
 *            plate moves more, so it wanders off the moving parts and stays on the lines
 *            that stand still (the nodes). Every few beats the frequency (n, m) steps up
 *            and the sand jumps into the next figure.
 *              square / tall plate  f = cos nπu·cos mπv − cos mπu·cos nπv
 *              round plate          f = Jₙ(αₙₘ r)·cos nθ   (Bessel functions)
 *              your formula         f(x, y, n, m, t)
 *   tubes    Kundt's tubes: dust in a row of tubes piles up at the nodes of a standing
 *            wave; tube k sings harmonic k (k + 1 piles)
 *   ripple   interference: waves from 2–6 sources cancel along curves where sand gathers
 *   filings  iron filings around magnets turn from random sticks into field lines
 *
 * One small engine: the vibration field is sampled once per figure on a grid; each grain
 * takes a random kick ∝ |f| plus a slide down ∇f², 60 times a second. Deterministic.
 */
import { tryCompile } from '../math/parser.js';
import { frac, hexA } from './palettes.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const SUB = 1 / 60; // grain update step (simulation seconds)

/* ---------------------------------------------------------------- maths */

/** Bessel function of the first kind, Jₙ(x) = 1/π ∫₀^π cos(nτ − x sin τ) dτ. */
export function besselJ(n, x) {
  const N = 64;
  let s = 0;
  for (let i = 0; i < N; i++) { const t = ((i + 0.5) / N) * Math.PI; s += Math.cos(n * t - x * Math.sin(t)); }
  return s / N;
}

/** Jₙ′(x) = (Jₙ₋₁(x) − Jₙ₊₁(x)) / 2 */
export const besselJd = (n, x) => (besselJ(n - 1, x) - besselJ(n + 1, x)) / 2;

const zeroCache = new Map();
/**
 * m-th positive zero of Jₙ′ (m = 1, 2, …): the plate's edge is free, so it moves
 * (sand leaves the rim) and the nodal circles are inside.
 */
export function besselZero(n, m) {
  const key = `${n},${m}`;
  if (zeroCache.has(key)) return zeroCache.get(key);
  const f = (x) => besselJd(n, x);
  let found = 0, a = 0.3, fa = f(a), z = NaN;
  for (let x = 0.35; x < 80; x += 0.05) {
    const fx = f(x);
    if (fa * fx < 0) {
      let lo = a, hi = x;
      for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid; }
      if (++found === m) { z = (lo + hi) / 2; break; }
    }
    a = x; fa = fx;
  }
  zeroCache.set(key, z);
  return z;
}

/** "1,2 2,3 3,5" → [[1,2],[2,3],[3,5]] */
export function parseModes(text, fallback = [[1, 2]]) {
  const out = String(text || '').split(/[\s;|]+/).map((p) => p.split(/[,:x×]/).map(Number)).filter((p) => p.length >= 2 && p.every(Number.isFinite));
  return out.length ? out : fallback;
}

function randn(S) {
  const u = Math.max(1e-9, S.rand()), v = S.rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

/* --------------------------------------------------------------- the grid */

/**
 * Sample a field over the box [-sx, sx] × [-sy, sy] (world units): values normalised to
 * max |f| = 1 and the gradient of f² (where grains slide to).
 */
function makeGrid(sx, sy, fn, res = 110) {
  const nx = res, ny = Math.max(16, Math.round((res * sy) / sx));
  const val = new Float32Array(nx * ny);
  let mx = 1e-9;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = -sx + (2 * sx * i) / (nx - 1), y = -sy + (2 * sy * j) / (ny - 1);
    const v = fn(x, y);
    val[j * nx + i] = Number.isFinite(v) ? v : 0;
    mx = Math.max(mx, Math.abs(val[j * nx + i]));
  }
  for (let k = 0; k < val.length; k++) val[k] /= mx;
  const gx = new Float32Array(nx * ny), gy = new Float32Array(nx * ny);
  const dx = (2 * sx) / (nx - 1), dy = (2 * sy) / (ny - 1);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = (ii, jj) => { const v = val[clamp(jj, 0, ny - 1) * nx + clamp(ii, 0, nx - 1)]; return v * v; };
    gx[j * nx + i] = (a(i + 1, j) - a(i - 1, j)) / (2 * dx);
    gy[j * nx + i] = (a(i, j + 1) - a(i, j - 1)) / (2 * dy);
  }
  return { nx, ny, sx, sy, dx, dy, val, gx, gy };
}

/** Bilinear lookup → [f, ∂x f², ∂y f²]. */
function sample(G, x, y, out) {
  const fx = clamp((x + G.sx) / G.dx, 0, G.nx - 1.001), fy = clamp((y + G.sy) / G.dy, 0, G.ny - 1.001);
  const i = fx | 0, j = fy | 0, u = fx - i, v = fy - j;
  const k = j * G.nx + i;
  const lerp = (A) => (A[k] * (1 - u) + A[k + 1] * u) * (1 - v) + (A[k + G.nx] * (1 - u) + A[k + G.nx + 1] * u) * v;
  out[0] = lerp(G.val); out[1] = lerp(G.gx); out[2] = lerp(G.gy);
  return out;
}

/* ------------------------------------------------------- shared grain bits */

function scatter(S, n, inside, box) {
  const x = new Float32Array(n), y = new Float32Array(n), ang = new Float32Array(n), e = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let px, py, tries = 0;
    do { px = (S.rand() * 2 - 1) * box[0]; py = (S.rand() * 2 - 1) * box[1]; } while (!inside(px, py) && ++tries < 30);
    x[i] = px; y[i] = py; ang[i] = S.rand() * Math.PI; e[i] = 1;
  }
  return { n, x, y, ang, e };
}

/** One shake of every grain in the (blended) field. */
function shake(S, g, gridA, gridB, blend, amp, drift, inside, keep) {
  const a = [0, 0, 0], b = [0, 0, 0];
  const sq = Math.sqrt(SUB);
  for (let i = 0; i < g.n; i++) {
    let x = g.x[i], y = g.y[i];
    sample(gridB, x, y, b);
    let f = b[0], gx = b[1], gy = b[2];
    if (gridA && blend < 1) {
      sample(gridA, x, y, a);
      f = a[0] + (f - a[0]) * blend; gx = a[1] + (gx - a[1]) * blend; gy = a[2] + (gy - a[2]) * blend;
    }
    const kick = amp * Math.abs(f) * sq;
    let mx = -drift * gx * SUB, my = -drift * gy * SUB;
    const m = Math.hypot(mx, my);
    if (m > 0.012) { mx *= 0.012 / m; my *= 0.012 / m; }
    const nx = x + mx + kick * randn(S), ny = y + my + kick * randn(S);
    if (inside(nx, ny)) { x = nx; y = ny; } else { const k = keep(nx, ny); x = k[0]; y = k[1]; }
    g.x[i] = x; g.y[i] = y;
    g.e[i] = g.e[i] * 0.9 + Math.abs(f) * 0.1;
    if (kick > 0.004) g.ang[i] += (S.rand() - 0.5) * 1.5;
  }
}

/** Draw grains: sand dots, rice sticks or glowing palette dots (settled ones shine). */
function drawGrains(D, g, look, colorOf) {
  const { g: ctx, k } = D;
  const s = (look.grain === 'rice' ? 1.6 : 1.1) * k * (D.look.ballSize ?? 1);
  if (look.grain === 'rice') {
    ctx.lineCap = 'round'; ctx.lineWidth = s * 1.1;
    for (let i = 0; i < g.n; i++) {
      const x = D.X(g.x[i]), y = D.Y(g.y[i]), c = Math.cos(g.ang[i]) * s * 2.2, d = Math.sin(g.ang[i]) * s * 2.2;
      ctx.strokeStyle = colorOf(i);
      ctx.beginPath(); ctx.moveTo(x - c, y - d); ctx.lineTo(x + c, y + d); ctx.stroke();
    }
    return;
  }
  for (let i = 0; i < g.n; i++) { ctx.fillStyle = colorOf(i); ctx.fillRect(D.X(g.x[i]) - s, D.Y(g.y[i]) - s, s * 2, s * 2); }
}

function grainColor(look, pal) {
  if (look.grain === 'sand') return (e) => (e < 0.12 ? '#fff1c9' : `rgba(233,214,160,${0.35 + 0.5 * (1 - e)})`);
  if (look.grain === 'rice') return (e) => (e < 0.12 ? '#ffffff' : `rgba(240,240,232,${0.4 + 0.5 * (1 - e)})`);
  return (e) => pal.line(0.15 + e * 0.6);
}

/** Which figure is on now, and since when. */
function step(S, P, count) {
  const beat = 60 / S.bpm;
  const len = beat * Math.max(0.25, P.every);
  if (S.st < P.wait) return { k: -1, since: S.st };
  const k = Math.min(count - 1, Math.floor((S.st - P.wait) / len));
  return { k, since: S.st - P.wait - k * len };
}

/* ================================================================ chladni */

const plateBox = (S, P) => {
  const m = Math.min(S.W.hw, S.W.hh) * 0.95;
  if (P.plate === 'tall') return [S.W.hw * 0.95, S.W.hh * 0.95];
  return [m, m];
};

function chladniField(S, P, n, m, k = 0) {
  const [sx, sy] = plateBox(S, P);
  if (P.plate === 'circle') {
    const z = besselZero(Math.round(n), Math.max(1, Math.round(m))) || 3.83;
    return makeGrid(sx, sy, (x, y) => { const r = Math.min(1, Math.hypot(x, y) / sx); return besselJ(Math.round(n), z * r) * Math.cos(n * Math.atan2(y, x)); });
  }
  if (P.plate === 'formula') {
    const c = tryCompile(String(P.formula || '0'), ['x', 'y', 'n', 'm', 't']);
    const fn = c.ok ? c.fn : () => 0;
    return makeGrid(sx, sy, (x, y) => fn({ x: x / sx, y: y / sy, n, m, t: S.st }));
  }
  const sign = P.sign === '+' ? 1 : P.sign === '-' ? -1 : (k % 2 ? -1 : 1);
  return makeGrid(sx, sy, (x, y) => {
    const u = (x + sx) / (2 * sx), v = (y + sy) / (2 * sy);
    return Math.cos(n * Math.PI * u) * Math.cos(m * Math.PI * v) + sign * Math.cos(m * Math.PI * u) * Math.cos(n * Math.PI * v);
  });
}

const chladni = {
  label: 'Chladni plate: sound shapes the sand', group: 'Vibration & waves',
  defaults: { plate: 'square', modes: '1,3 2,4 1,5 3,5 2,6 4,6 3,7 5,7', every: 4, wait: 1.2, grains: 7000, shake: 0.55, drift: 0.12, sign: '+', grain: 'sand', formula: 'sin(n*pi*x)*sin(m*pi*y) + sin(m*pi*x)*sin(n*pi*y)', showWave: false },
  controls: [
    ['plate', 'Plate', 's', { square: 'Square', tall: 'Tall (whole safe area)', circle: 'Round (Bessel)', formula: 'My formula f(x, y, n, m, t)' }],
    ['modes', 'Figures n,m one after another', 'x', '1,2 1,3 2,3 1,5 3,4'], ['every', 'Beats per figure', 'r', 1, 16, 0.5],
    ['formula', 'Plate formula (for “My formula”)', 'f', 'sin(n*pi*x)*sin(m*pi*y) + sin(m*pi*x)*sin(n*pi*y)', ['x', 'y', 'n', 'm', 't']],
    ['grains', 'Grains', 'r', 500, 20000, 100], ['grain', 'Grain', 's', { sand: 'Sand', rice: 'Rice', glow: 'Glowing (palette)' }],
    ['shake', 'Vibration strength', 'r', 0.05, 2, 0.01], ['drift', 'Slide to the still lines', 'r', 0, 0.6, 0.005],
    ['sign', 'Square plate: mode mix', 's', { '+': 'cos·cos + cos·cos', '-': 'cos·cos − cos·cos', alt: 'Take turns + / −' }], ['wait', 'Quiet at the start', 'r', 0, 5, 0.1, ' s'], ['showWave', 'Show the vibration', 't'],
  ],
  init(S, P) {
    const [sx, sy] = plateBox(S, P);
    const round = P.plate === 'circle';
    const inside = round ? (x, y) => x * x + y * y < sx * sx : (x, y) => Math.abs(x) < sx && Math.abs(y) < sy;
    S.sc = { modes: parseModes(P.modes), g: scatter(S, clamp(P.grains | 0, 100, 30000), inside, [sx, sy]), inside, round, sx, sy, k: -2, A: null, B: null, changed: 0, acc: 0, beat: -1 };
    S.sc.keep = round ? (x, y) => { const r = Math.hypot(x, y) || 1; return [(x / r) * sx * 0.995, (y / r) * sx * 0.995]; } : (x, y) => [clamp(x, -sx * 0.995, sx * 0.995), clamp(y, -sy * 0.995, sy * 0.995)];
  },
  step(S, P, dt, emit) {
    const sc = S.sc;
    const { k, since } = step(S, P, sc.modes.length);
    if (k !== sc.k && k >= 0) {
      const [n, m] = sc.modes[k];
      sc.A = sc.B; sc.B = chladniField(S, P, n, m, k); sc.k = k; sc.changed = S.st;
      emit({ type: 'fill', ball: k, x: 0, y: 0, angle: 0, pitch: clamp((n * n + m * m) / 60, 0, 1) });
    }
    const b = Math.floor((S.st * S.bpm) / 60);
    if (b !== sc.beat) { sc.beat = b; if (sc.k >= 0) emit({ type: 'hit', ball: sc.k, x: 0, y: 0, angle: 0, pitch: clamp((sc.modes[sc.k][0] ** 2 + sc.modes[sc.k][1] ** 2) / 60, 0, 1) }); }
    if (sc.k < 0) return;
    sc.acc += dt;
    while (sc.acc >= SUB) {
      sc.acc -= SUB;
      const age = S.st - sc.changed;
      const blend = clamp(age / 0.8, 0, 1);
      const amp = P.shake * (0.3 + 1.4 * Math.exp(-age / 0.7));
      // on a round plate the slide alone would pile the sand at the centre: let the shaking sort it
      shake(S, sc.g, sc.A, sc.B, blend, amp, sc.round ? P.drift * 0.25 : P.drift, sc.inside, sc.keep);
    }
    void since;
  },
  draw(S, P, D) {
    const { g, pal, k } = D, sc = S.sc;
    drawPlate(D, sc, P.plate === 'circle', S);
    if (P.showWave && sc.B) drawWave(D, sc.B, pal, S.st);
    const col = grainColor(P, pal);
    drawGrains(D, sc.g, P, (i) => col(sc.g.e[i]));
    // a pulse from the centre on every figure change
    const age = S.st - sc.changed;
    if (sc.k >= 0 && age < 0.8) { g.globalAlpha = 1 - age / 0.8; g.strokeStyle = pal.ring; g.lineWidth = 3 * k; g.beginPath(); g.arc(D.X(0), D.Y(0), age * 0.8 * Math.max(sc.sx, sc.sy) * D.R, 0, TAU); g.stroke(); g.globalAlpha = 1; }
  },
  stats(S) { const sc = S.sc; return sc.k < 0 ? 'silence…' : `figure ${sc.k + 1} · n = ${sc.modes[sc.k][0]}, m = ${sc.modes[sc.k][1]}`; },
  formula: (P) => (P.plate === 'circle' ? 'f = Jₙ(αr)·cos nθ' : P.plate === 'formula' ? `f = ${P.formula}` : `f = cos nπx·cos mπy ${P.sign === '+' ? '+' : P.sign === '-' ? '−' : '±'} cos mπx·cos nπy`),
};

function drawPlate(D, sc, round, S) {
  const { g, pal, k } = D;
  const X0 = D.X(-sc.sx), Y0 = D.Y(sc.sy), w = 2 * sc.sx * D.R, h = 2 * sc.sy * D.R;
  const gr = g.createLinearGradient(X0, Y0, X0 + w, Y0 + h);
  gr.addColorStop(0, '#2a2f3a'); gr.addColorStop(0.5, '#171b24'); gr.addColorStop(1, '#262b36');
  g.fillStyle = gr;
  g.beginPath();
  if (round) g.arc(D.X(0), D.Y(0), sc.sx * D.R, 0, TAU); else g.rect(X0, Y0, w, h);
  g.fill();
  g.strokeStyle = hexA(pal.ring, 0.8); g.lineWidth = 3 * k; g.shadowColor = pal.glow; g.shadowBlur = 16 * k;
  g.stroke(); g.shadowBlur = 0;
  // the bolt in the middle shakes with the sound
  const j = sc.k >= 0 ? Math.sin(S.st * 90) * 1.5 * k : 0;
  g.fillStyle = '#8b93a5'; g.beginPath(); g.arc(D.X(0) + j, D.Y(0), 7 * k, 0, TAU); g.fill();
  g.fillStyle = '#3b4150'; g.beginPath(); g.arc(D.X(0) + j, D.Y(0), 3 * k, 0, TAU); g.fill();
}

/** The vibration itself, faint: bright where the plate moves, dark on the still lines. */
function drawWave(D, G, pal, t) {
  const { g } = D;
  const c = (drawWave.c ||= document.createElement('canvas'));
  if (c.width !== G.nx || c.height !== G.ny) { c.width = G.nx; c.height = G.ny; }
  const cg = c.getContext('2d');
  const img = cg.createImageData(G.nx, G.ny);
  const n = parseInt(String(pal.glow).slice(1), 16), r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
  const ph = Math.cos(t * 12);
  for (let j = 0; j < G.ny; j++) for (let i = 0; i < G.nx; i++) {
    const v = G.val[j * G.nx + i] * ph, o = ((G.ny - 1 - j) * G.nx + i) * 4;
    img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = Math.abs(v) * 70;
  }
  cg.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(c, D.X(-G.sx), D.Y(G.sy), 2 * G.sx * D.R, 2 * G.sy * D.R);
}

/* ================================================================== tubes */

const tubes = {
  label: "Kundt's tubes: dust piles at the nodes", group: 'Vibration & waves',
  defaults: { count: 7, grains: 900, every: 2, wait: 0.6, shake: 0.5, grain: 'sand' },
  controls: [['count', 'Tubes (harmonics)', 'r', 2, 12, 1], ['grains', 'Grains per tube', 'r', 100, 3000, 50], ['every', 'Beats before the next tube starts', 'r', 0.5, 8, 0.5],
    ['shake', 'Vibration strength', 'r', 0.05, 2, 0.01], ['grain', 'Grain', 's', { sand: 'Sand', rice: 'Rice', glow: 'Glowing (palette)' }]],
  init(S, P) {
    const n = clamp(P.count | 0, 2, 12), { hw, hh } = S.W;
    const gap = (2 * hh * 0.94) / n, half = gap * 0.28, sx = hw * 0.92;
    const rows = [];
    for (let i = 0; i < n; i++) {
      const cy = hh * 0.94 - gap * (i + 0.5);
      const h = i + 1; // harmonic
      const G = makeGrid(sx, half, (x) => Math.sin(h * Math.PI * ((x + sx) / (2 * sx))), 160);
      const inside = (x, y) => Math.abs(x) < sx && Math.abs(y) < half;
      rows.push({ h, cy, half, G, g: scatter(S, clamp(P.grains | 0, 50, 4000), inside, [sx, half]), inside, start: null });
    }
    S.sc = { rows, sx, acc: 0, beat: -1, keep: (x, y) => [clamp(x, -sx * 0.995, sx * 0.995), clamp(y, -half * 0.99, half * 0.99)] };
  },
  step(S, P, dt, emit) {
    const sc = S.sc, beat = 60 / S.bpm;
    sc.rows.forEach((r, i) => {
      if (r.start == null && S.st >= P.wait + i * beat * P.every) {
        r.start = S.st;
        emit({ type: 'hit', ball: i, x: 0, y: r.cy, angle: 0, pitch: Math.log2(r.h) / Math.log2(sc.rows.length) });
      }
    });
    // on every beat the singing tubes play an arpeggio of their harmonics
    const bt = Math.floor((S.st * S.bpm) / 30);
    if (bt !== sc.beat) {
      sc.beat = bt;
      const on = sc.rows.filter((r) => r.start != null && r.start < S.st - 0.05);
      if (on.length) { const r = on[bt % on.length]; emit({ type: 'hit', ball: r.h - 1, x: 0, y: r.cy, angle: 0, pitch: Math.log2(r.h) / Math.log2(sc.rows.length) }); }
    }
    sc.acc += dt;
    while (sc.acc >= SUB) {
      sc.acc -= SUB;
      for (const r of sc.rows) {
        if (r.start == null) continue;
        const age = S.st - r.start;
        shake(S, r.g, null, r.G, 1, P.shake * (0.3 + 1.2 * Math.exp(-age / 0.8)), 0.1, r.inside, sc.keep);
      }
    }
  },
  draw(S, P, D) {
    const { g, pal, k } = D, sc = S.sc;
    const col = grainColor(P, pal);
    for (const r of sc.rows) {
      const on = r.start != null;
      g.strokeStyle = hexA(pal.ring, on ? 0.7 : 0.25); g.lineWidth = 2 * k;
      g.strokeRect(D.X(-sc.sx), D.Y(r.cy + r.half), 2 * sc.sx * D.R, 2 * r.half * D.R);
      g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(D.X(-sc.sx), D.Y(r.cy + r.half), 2 * sc.sx * D.R, 2 * r.half * D.R);
      if (on) { // the standing wave, faint
        g.strokeStyle = hexA(pal.glow, 0.35); g.lineWidth = 1.5 * k; g.beginPath();
        for (let i = 0; i <= 80; i++) { const u = i / 80, x = -sc.sx + 2 * sc.sx * u, y = r.cy + Math.sin(r.h * Math.PI * u) * r.half * 0.8 * Math.cos(S.st * 14); i ? g.lineTo(D.X(x), D.Y(y)) : g.moveTo(D.X(x), D.Y(y)); }
        g.stroke();
      }
      const shifted = { ...r.g, y: r.g.y.map((y) => y + r.cy) };
      drawGrains(D, shifted, P, (i) => col(r.g.e[i]));
      g.fillStyle = hexA(pal.ring, 0.8); g.font = `600 ${13 * k}px ui-monospace, monospace`; g.textAlign = 'right'; g.textBaseline = 'middle';
      g.fillText(`×${r.h}`, D.X(-sc.sx) - 6 * k, D.Y(r.cy));
    }
  },
  stats(S) { return `tubes singing: ${S.sc.rows.filter((r) => r.start != null).length}`; },
  formula: () => 'harmonic k: k + 1 piles',
};

/* ================================================================= ripple */

const ripple = {
  label: 'Wave interference: where waves cancel, sand stays', group: 'Vibration & waves',
  defaults: { steps: '2:0.32 2:0.2 3:0.26 4:0.22 5:0.2 6:0.17', every: 4, wait: 1, grains: 7000, shake: 0.5, drift: 0.1, grain: 'glow', spread: 0.35 },
  controls: [['steps', 'Sources : wavelength, one after another', 'x', '2:0.3 3:0.25 4:0.2'], ['every', 'Beats per step', 'r', 1, 16, 0.5], ['spread', 'Sources apart', 'r', 0.05, 0.9, 0.01],
    ['grains', 'Grains', 'r', 500, 20000, 100], ['grain', 'Grain', 's', { sand: 'Sand', rice: 'Rice', glow: 'Glowing (palette)' }], ['shake', 'Vibration strength', 'r', 0.05, 2, 0.01]],
  sources(P, n) { const out = []; for (let i = 0; i < n; i++) { const a = Math.PI / 2 + (i * TAU) / n; out.push([Math.cos(a) * P.spread, Math.sin(a) * P.spread]); } return n === 2 ? [[-P.spread, 0], [P.spread, 0]] : out; },
  init(S, P) {
    const sx = S.W.hw * 0.95, sy = S.W.hh * 0.95;
    const inside = (x, y) => Math.abs(x) < sx && Math.abs(y) < sy;
    S.sc = { list: parseModes(P.steps, [[2, 0.3]]), g: scatter(S, clamp(P.grains | 0, 100, 30000), inside, [sx, sy]), inside, sx, sy, k: -2, A: null, B: null, changed: 0, acc: 0, beat: -1, keep: (x, y) => [clamp(x, -sx * 0.995, sx * 0.995), clamp(y, -sy * 0.995, sy * 0.995)] };
  },
  step(S, P, dt, emit) {
    const sc = S.sc;
    const { k } = step(S, P, sc.list.length);
    if (k !== sc.k && k >= 0) {
      const [n, lam] = sc.list[k];
      const src = this.sources(P, Math.max(1, Math.round(n)));
      const kk = TAU / Math.max(0.02, lam);
      sc.A = sc.B;
      // time-averaged amplitude |Σ e^{i k r_j}|: zero on the lines where the waves cancel
      sc.B = makeGrid(sc.sx, sc.sy, (x, y) => { let re = 0, im = 0; for (const [a, b] of src) { const r = Math.hypot(x - a, y - b); re += Math.cos(kk * r); im += Math.sin(kk * r); } return Math.hypot(re, im); });
      sc.k = k; sc.changed = S.st; sc.src = src; sc.lam = lam;
      emit({ type: 'fill', ball: k, x: 0, y: 0, angle: 0, pitch: clamp(1 - lam, 0, 1) });
    }
    if (sc.k < 0) return;
    const bt = Math.floor((S.st * S.bpm) / 60);
    if (bt !== sc.beat) { sc.beat = bt; emit({ type: 'hit', ball: bt % sc.src.length, x: 0, y: 0, angle: 0, pitch: clamp(1 - sc.lam + 0.1 * (bt % 3), 0, 1) }); }
    sc.acc += dt;
    while (sc.acc >= SUB) {
      sc.acc -= SUB;
      const age = S.st - sc.changed;
      shake(S, sc.g, sc.A, sc.B, clamp(age / 0.8, 0, 1), P.shake * (0.3 + 1.3 * Math.exp(-age / 0.7)), P.drift, sc.inside, sc.keep);
    }
  },
  draw(S, P, D) {
    const { g, pal, k } = D, sc = S.sc;
    g.strokeStyle = hexA(pal.ring, 0.6); g.lineWidth = 2 * k; g.strokeRect(D.X(-sc.sx), D.Y(sc.sy), 2 * sc.sx * D.R, 2 * sc.sy * D.R);
    if (sc.src) {
      // rings travelling out of every source
      for (const [a, b] of sc.src) {
        for (let r = (S.st * 0.35) % sc.lam; r < 2.6; r += sc.lam) {
          g.globalAlpha = 0.18 * (1 - r / 2.6); g.strokeStyle = pal.glow; g.lineWidth = 1.5 * k;
          g.beginPath(); g.arc(D.X(a), D.Y(b), r * D.R, 0, TAU); g.stroke();
        }
        g.globalAlpha = 1;
        g.fillStyle = '#ffffff'; g.shadowColor = pal.glow; g.shadowBlur = 18 * k;
        g.beginPath(); g.arc(D.X(a), D.Y(b), (6 + 2 * Math.sin(S.st * 20)) * k, 0, TAU); g.fill(); g.shadowBlur = 0;
      }
    }
    const col = grainColor(P, pal);
    drawGrains(D, sc.g, P, (i) => col(sc.g.e[i]));
  },
  stats(S) { const sc = S.sc; return sc.k < 0 ? 'silence…' : `${sc.src.length} sources · wavelength ${sc.lam}`; },
  formula: () => 'amplitude = |Σ e^{i·k·r}|',
};

/* ================================================================ filings */

const MAGNETS = {
  bar: [[0, 0.32, 1], [0, -0.32, -1]],
  attract: [[-0.45, 0.25, 1], [-0.45, -0.25, -1], [0.45, 0.25, 1], [0.45, -0.25, -1]],
  repel: [[-0.45, 0.25, 1], [-0.45, -0.25, -1], [0.45, 0.25, -1], [0.45, -0.25, 1]],
  quad: [[0.4, 0.4, 1], [-0.4, 0.4, -1], [-0.4, -0.4, 1], [0.4, -0.4, -1]],
  ring: Array.from({ length: 6 }, (_, i) => [Math.cos((i * TAU) / 6) * 0.55, Math.sin((i * TAU) / 6) * 0.55, i % 2 ? 1 : -1]),
};

const filings = {
  label: 'Iron filings show the magnetic field', group: 'Vibration & waves',
  defaults: { setups: 'bar attract repel quad ring', every: 6, wait: 0.8, grains: 3800, tap: 0.6, paper: 'dark' },
  controls: [['setups', 'Magnets, one after another (bar attract repel quad ring)', 'x', 'bar attract repel'], ['every', 'Beats per setup', 'r', 1, 16, 0.5],
    ['grains', 'Filings', 'r', 500, 12000, 100], ['tap', 'Tapping strength', 'r', 0.05, 2, 0.01], ['paper', 'Paper', 's', { dark: 'Dark', light: 'White paper' }]],
  init(S, P) {
    const sx = S.W.hw * 0.95, sy = S.W.hh * 0.95;
    const inside = (x, y) => Math.abs(x) < sx && Math.abs(y) < sy;
    const list = String(P.setups || 'bar').split(/[\s,]+/).filter((s) => MAGNETS[s]);
    S.sc = { list: list.length ? list : ['bar'], g: scatter(S, clamp(P.grains | 0, 100, 20000), inside, [sx, sy]), sx, sy, k: -2, changed: 0, acc: 0, beat: -1 };
  },
  field(sc, x, y) {
    let bx = 0, by = 0;
    for (const [a, b, q] of MAGNETS[sc.list[sc.k]]) { const dx = x - a, dy = y - b, r2 = dx * dx + dy * dy + 0.004; bx += (q * dx) / r2; by += (q * dy) / r2; }
    return [bx, by];
  },
  step(S, P, dt, emit) {
    const sc = S.sc;
    const { k } = step(S, P, sc.list.length);
    if (k !== sc.k && k >= 0) { sc.k = k; sc.changed = S.st; emit({ type: 'fill', ball: k, x: 0, y: 0, angle: 0, pitch: k / sc.list.length }); }
    const b = Math.floor((S.st * S.bpm) / 60);
    if (b !== sc.beat) { sc.beat = b; if (sc.k >= 0) emit({ type: 'hit', ball: b % 8, x: 0, y: 0, angle: 0, pitch: frac(b * 0.125) }); }
    if (sc.k < 0) return;
    sc.acc += dt;
    while (sc.acc >= SUB) {
      sc.acc -= SUB;
      const age = S.st - sc.changed, beatPh = frac((S.st * S.bpm) / 60);
      const tap = P.tap * (0.25 + Math.exp(-age / 0.6)) * (beatPh < 0.12 ? 3 : 0.4); // a tap on every beat
      const g = sc.g;
      for (let i = 0; i < g.n; i++) {
        const [bx, by] = this.field(sc, g.x[i], g.y[i]);
        const B = Math.hypot(bx, by);
        // turn towards the field line (filings have no head or tail: angle mod π)
        let d = Math.atan2(by, bx) - g.ang[i];
        d = ((d + Math.PI / 2) % Math.PI + Math.PI) % Math.PI - Math.PI / 2;
        g.ang[i] += d * Math.min(1, 0.15 + B * 0.05) + (S.rand() - 0.5) * tap * 0.3;
        // the tap makes them jitter a little in place
        g.x[i] = clamp(g.x[i] + (S.rand() - 0.5) * tap * 0.004, -sc.sx, sc.sx);
        g.y[i] = clamp(g.y[i] + (S.rand() - 0.5) * tap * 0.004, -sc.sy, sc.sy);
        g.e[i] = g.e[i] * 0.95 + Math.abs(d) * 0.05;
      }
    }
  },
  draw(S, P, D) {
    const { g, pal, k } = D, sc = S.sc;
    const light = P.paper === 'light';
    g.fillStyle = light ? '#ece8df' : 'rgba(255,255,255,0.03)';
    g.fillRect(D.X(-sc.sx), D.Y(sc.sy), 2 * sc.sx * D.R, 2 * sc.sy * D.R);
    g.strokeStyle = hexA(pal.ring, 0.5); g.lineWidth = 2 * k; g.strokeRect(D.X(-sc.sx), D.Y(sc.sy), 2 * sc.sx * D.R, 2 * sc.sy * D.R);
    const gr = sc.g, L = 6.5 * k * (D.look.ballSize ?? 1);
    g.lineCap = 'round'; g.lineWidth = 1.8 * k;
    for (let i = 0; i < gr.n; i++) {
      const x = D.X(gr.x[i]), y = D.Y(gr.y[i]), c = Math.cos(gr.ang[i]) * L, s = -Math.sin(gr.ang[i]) * L;
      // aligned filings are bright; strong field (near the poles) a little warmer
      const B = sc.k >= 0 ? Math.hypot(...this.field(sc, gr.x[i], gr.y[i])) : 0;
      const al = 1 - Math.min(1, gr.e[i] * 4);
      g.strokeStyle = light ? `rgba(40,42,50,${0.4 + 0.55 * al})` : pal.line(0.15 + Math.min(0.6, B * 0.05));
      g.globalAlpha = light ? 1 : 0.35 + 0.65 * al;
      g.beginPath(); g.moveTo(x - c, y - s); g.lineTo(x + c, y + s); g.stroke();
    }
    g.globalAlpha = 1;
    if (sc.k >= 0) {
      for (const [a, b, q] of MAGNETS[sc.list[sc.k]]) {
        g.fillStyle = q > 0 ? '#ff3b5c' : '#3b8bff'; g.shadowColor = g.fillStyle; g.shadowBlur = 14 * k;
        g.beginPath(); g.arc(D.X(a), D.Y(b), 12 * k, 0, TAU); g.fill(); g.shadowBlur = 0;
        g.fillStyle = '#fff'; g.font = `700 ${13 * k}px ui-sans-serif, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(q > 0 ? 'N' : 'S', D.X(a), D.Y(b));
      }
    }
  },
  stats(S) { const sc = S.sc; return sc.k < 0 ? 'no magnet yet…' : `magnets: ${sc.list[sc.k]}`; },
  formula: () => 'B = Σ q·(p − pᵢ) / |p − pᵢ|²',
};

export const CYMATICS = { chladni, tubes, ripple, filings };
