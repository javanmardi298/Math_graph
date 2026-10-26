/**
 * The Harmonograph: a Circle Lab scene for the drawing machine of damped pendulums.
 *
 * Pen position (all of it is a closed formula in the pen time u = simulation time × rate):
 *   lateral    x = A sin(fa·u + pa)·e,  y = B sin(fb·u + pb)·e          two pendulums
 *   quad       x = A sin(fa·u + pa) + C sin(fc·u + pc),  y = B … + D …   four pendulums (two per axis)
 *   rotary     quad, then turned by a rotating table  θ = table·u + tp
 *   lissajous  lateral without damping
 *   epicycle   a pen on circles on circles: A e^{i fa u} + B e^{−i fb u} + C e^{i fc u} + D e^{−i fd u}
 *   formula    your own x(t, s, a, b, c, d) and y(t, s, a, b, c, d); s is the swing (the damping), a..d the four frequencies
 * with the damping e = exp(−3·u / (life·rate)): `life` seconds until the swing is down to 5%.
 *
 * Frequencies are ratios, so the shape is the geometry of the interval between the pendulums
 * (3 : 2 is a fifth, 2 : 1 an octave …), and the pendulums sound at exactly those ratios.
 *
 * The drawing is kept as points (pure, deterministic, tested in Node). draw() paints the paper, the
 * frame, the ink (with symmetry, several pens, speed- and time-dependent colour), the dials and the pen.
 */
import { tryCompile } from '../math/parser.js';
import { SCALES } from '../math/music.js';
import { hexA } from './palettes.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mod = (a, n) => ((a % n) + n) % n;

/** Frequency ratios of the common intervals (just intonation): [ratio text, name, value]. */
export const INTERVALS = [
  ['1:1', 'Unison', 1], ['2:1', 'Octave', 2], ['3:2', 'Perfect fifth', 3 / 2], ['4:3', 'Perfect fourth', 4 / 3],
  ['5:4', 'Major third', 5 / 4], ['6:5', 'Minor third', 6 / 5], ['9:8', 'Whole tone', 9 / 8], ['5:3', 'Major sixth', 5 / 3],
  ['8:5', 'Minor sixth', 8 / 5], ['7:4', 'Harmonic seventh', 7 / 4], ['16:15', 'Half step', 16 / 15], ['45:32', 'Tritone', 45 / 32],
];

export const KINDS = {
  lateral: 'Lateral: two pendulums (x and y)',
  quad: 'Four pendulums (two per axis)',
  rotary: 'Rotary: four pendulums on a turning table',
  lissajous: 'Lissajous: two pendulums, no damping',
  epicycle: 'Epicycles: circles on circles',
  formula: 'My own formula',
};

export const PAPERS = {
  default: { label: 'Lab background (lights and dust)', light: false, bg: '#060814' },
  velvet: { label: 'Black velvet', light: false, bg: '#05060d' },
  midnight: { label: 'Midnight sky', light: false, bg: '#0a0d2c' },
  blueprint: { label: 'Blueprint', light: false, bg: '#0b2a5b' },
  chalk: { label: 'Chalkboard', light: false, bg: '#15241d' },
  ember: { label: 'Dark ember', light: false, bg: '#160806' },
  parchment: { label: 'Old parchment', light: true, bg: '#e6d6b0' },
  cream: { label: 'Cream paper', light: true, bg: '#f3eee2' },
};

export const INK_STYLES = {
  neon: 'Neon (glow)',
  fine: 'Fine liner (many thin lines build up)',
  brush: 'Brush (thick where the pen is slow)',
  ink: 'Pen and ink',
};

export const COLOR_BY = {
  time: 'Along the drawing (time)', speed: 'Pen speed', angle: 'Direction of the pen', radius: 'Distance from the centre', pen: 'Each pen its own colour',
};

export const FRAMES = { none: 'No frame', line: 'Thin line', double: 'Double line', ornate: 'Ornate corners' };

const DEFAULTS = {
  kind: 'quad',
  aa: 1, ab: 1, ac: 1, ad: 1,
  fa: 3, fb: 2, fc: 3.006, fd: 2.004,
  pa: 90, pb: 0, pc: 0, pd: 45,
  table: 0.5, tp: 0,
  life: 40, rate: 2.2,
  fit: 'auto',
  fx: 's*(sin(a*t)+sin(c*t))/2', fy: 's*(sin(b*t+1.57)+sin(d*t))/2',
  // ink
  pens: 1, penGap: 0.4, ink: 'neon', colorBy: 'time', hue0: 0, hueRate: 0.012, width: 1.2, ghost: false,
  // paper and furniture
  paper: 'velvet', frame: 'none', dials: false, pen: 'dot',
  // symmetry
  sym: 1, mirror: false,
  // sound
  sound: 'strum', arp: 'up', every: 0.5, base: 48, tuning: 'just',
};

export const HARMONOGRAPH_DEFAULTS = DEFAULTS;

/* ------------------------------------------------------------------------ the machine */

const FORMULA_VARS = ['t', 's', 'a', 'b', 'c', 'd'];

/** The functions of one setting: pen position at pen time u. Compiled once per simulation. */
export function machine(P) {
  const kind = P.kind in KINDS ? P.kind : 'quad';
  const d2r = Math.PI / 180;
  const A = [P.aa, P.ab, P.ac, P.ad].map((v) => Math.abs(+v) || 0);
  const F = [P.fa, P.fb, P.fc, P.fd].map((v) => +v || 0);
  const Ph = [P.pa, P.pb, P.pc, P.pd].map((v) => (+v || 0) * d2r);
  const rate = Math.max(0.01, +P.rate || 1);
  const life = kind === 'lissajous' ? 0 : +P.life || 0;
  const env = (u) => (life > 0 ? Math.exp((-3 * u) / (life * rate)) : 1);
  let fx = null, fy = null;
  if (kind === 'formula') {
    const cx = tryCompile(String(P.fx ?? ''), FORMULA_VARS), cy = tryCompile(String(P.fy ?? ''), FORMULA_VARS);
    fx = cx.ok ? cx.fn : null; fy = cy.ok ? cy.fn : null;
  }
  const scope = { t: 0, s: 1, a: F[0], b: F[1], c: F[2], d: F[3] };
  const sx = A[0] + A[2] || 1, sy = A[1] + A[3] || 1;
  const sr = A[0] + A[1] + A[2] + A[3] || 1;
  const table = +P.table || 0, tp = (+P.tp || 0) * d2r;
  const at = (u) => {
    const e = env(u);
    switch (kind) {
      case 'lateral': case 'lissajous':
        return [(A[0] * Math.sin(F[0] * u + Ph[0]) * e) / (A[0] || 1), (A[1] * Math.sin(F[1] * u + Ph[1]) * e) / (A[1] || 1)];
      case 'epicycle': {
        let x = 0, y = 0;
        for (let i = 0; i < 4; i++) {
          const a = (i % 2 ? -1 : 1) * F[i] * u + (i % 2 ? -1 : 1) * Ph[i];
          x += A[i] * Math.cos(a); y += A[i] * Math.sin(a);
        }
        return [(x * e) / sr, (y * e) / sr];
      }
      case 'formula': {
        scope.t = u; scope.s = e;
        const x = fx ? fx(scope) : 0, y = fy ? fy(scope) : 0;
        return [Number.isFinite(x) ? clamp(x, -1.3, 1.3) : 0, Number.isFinite(y) ? clamp(y, -1.3, 1.3) : 0];
      }
      default: {
        const x = ((A[0] * Math.sin(F[0] * u + Ph[0]) + A[2] * Math.sin(F[2] * u + Ph[2])) * e) / sx;
        const y = ((A[1] * Math.sin(F[1] * u + Ph[1]) + A[3] * Math.sin(F[3] * u + Ph[3])) * e) / sy;
        if (kind !== 'rotary') return [x, y];
        const th = table * u + tp, c = Math.cos(th), s = Math.sin(th);
        return [x * c - y * s, x * s + y * c];
      }
    }
  };
  // fastest angular speed in the drawing: sets how finely the pen path is sampled
  const maxW = Math.max(1, ...F.map(Math.abs)) + (kind === 'rotary' ? Math.abs(table) : 0);
  return { at, env, maxW, kind, formulaOk: kind !== 'formula' || !!(fx && fy) };
}

/** Which pendulums make a sound for a machine kind (indices into A, B, C, D). */
export const sounding = (P) => (['lateral', 'lissajous'].includes(P.kind) ? [0, 1] : [0, 1, 2, 3]).filter((i) => Math.abs(+P[['aa', 'ab', 'ac', 'ad'][i]]) > 0);

/** MIDI note of pendulum i: its frequency ratio to pendulum A, from the base note. */
export function toneMidi(P, i) {
  const f = [P.fa, P.fb, P.fc, P.fd].map((v) => Math.abs(+v) || 1);
  let m = (+P.base || 48) + 12 * Math.log2(f[i] / f[0]);
  if (P.tuning === 'equal') m = Math.round(m);
  while (m > (+P.base || 48) + 36) m -= 12;
  return m;
}

/* ------------------------------------------------------------------- a good-looking random machine */

/** Small deterministic generator (the same seed gives the same machine everywhere). */
function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const SIMPLE = [[1, 1], [2, 1], [3, 2], [4, 3], [5, 4], [5, 3], [3, 1], [5, 2], [6, 5], [7, 4], [7, 5], [8, 5], [9, 8]];
const LUCKY_LOOKS = [
  ['velvet', 'neon', 'rainbow', false], ['velvet', 'fine', 'ice', false], ['midnight', 'neon', 'aurora', false], ['blueprint', 'fine', 'mono', false],
  ['chalk', 'fine', 'pastel', false], ['ember', 'neon', 'fire', false], ['parchment', 'ink', 'sepia', true], ['cream', 'ink', 'indigo', true],
  ['velvet', 'brush', 'rosegold', false], ['midnight', 'brush', 'peacock', false],
];

/**
 * A machine that draws something worth watching: simple ratios, a slight detune so the figure turns
 * into a rosette, damping that spirals into the middle, and (after trying a few) a figure that fills a
 * fair share of the frame without being a blob.
 * @returns {{lab:object, look:{palette:string, background:string}}}
 */
export function luckyMachine(seed = 1, { kind = null } = {}) {
  const R = rng(seed * 2654435761 + 12345);
  let best = null;
  for (let tries = 0; tries < 24; tries++) {
    const k = kind || ['quad', 'quad', 'quad', 'rotary', 'lateral', 'epicycle'][Math.floor(R() * 6)];
    const [n1, d1] = SIMPLE[Math.floor(R() * SIMPLE.length)];
    const [n2, d2] = SIMPLE[Math.floor(R() * SIMPLE.length)];
    const base = 1 + Math.floor(R() * 3);
    const detune = (R() < 0.5 ? -1 : 1) * (0.001 + R() * 0.011);
    const fa = base * 2, fb = (fa * n1) / d1;
    const lab = {
      kind: k, fa, fb, fc: fa * (1 + detune), fd: ((fa * n2) / d2) * (1 - detune),
      aa: 1, ab: 1, ac: +(0.5 + R() * 0.5).toFixed(2), ad: +(0.5 + R() * 0.5).toFixed(2),
      pa: [0, 30, 45, 60, 90, 120][Math.floor(R() * 6)], pb: [0, 90, 45][Math.floor(R() * 3)], pc: [0, 90, 180][Math.floor(R() * 3)], pd: [0, 45, 90][Math.floor(R() * 3)],
      table: k === 'rotary' ? [0.25, 0.5, 1, 2][Math.floor(R() * 4)] * (R() < 0.5 ? 1 : -1) : 0.5,
      life: 26 + Math.floor(R() * 36), rate: 2.2,
      sym: R() < 0.35 ? [3, 4, 5, 6, 8][Math.floor(R() * 5)] : 1, mirror: R() < 0.3,
    };
    // keep every frequency inside the sliders (0.25 … 12): drop an octave while the top one is too high
    while (Math.max(lab.fa, lab.fb, lab.fc, lab.fd) > 11.5) for (const key of ['fa', 'fb', 'fc', 'fd']) lab[key] /= 2;
    for (const key of ['fa', 'fb', 'fc', 'fd']) lab[key] = +lab[key].toFixed(4);
    // coverage of the figure on a coarse grid
    const m = machine({ ...DEFAULTS, ...lab });
    const seen = new Set();
    const N = 2400, span = 30 * lab.rate;
    for (let i = 0; i < N; i++) { const [x, y] = m.at((i / N) * span); seen.add(`${Math.floor((x + 1.3) * 10)},${Math.floor((y + 1.3) * 10)}`); }
    const cover = seen.size / 676;
    const score = -Math.abs(cover - 0.3);
    if (!best || score > best.score) best = { lab, score };
    if (cover > 0.2 && cover < 0.5) break;
  }
  const [paper, ink, palette, light] = LUCKY_LOOKS[Math.floor(R() * LUCKY_LOOKS.length)];
  Object.assign(best.lab, { paper, ink, colorBy: ['time', 'time', 'speed', 'angle', 'radius'][Math.floor(R() * 5)], frame: R() < 0.5 ? 'double' : 'none', dials: R() < 0.3, hue0: +R().toFixed(2) });
  return { lab: best.lab, look: { palette, background: PAPERS[paper].bg }, light };
}

/* ----------------------------------------------------------------- tuning the pendulums to a scale */

/**
 * Pendulum frequencies for scale degrees, so the drawing is the shape of that scale's intervals.
 * @param {string} scale key of math/music.js SCALES
 * @param {number[]} degrees 1-based scale degrees (1 = tonic, 8 = the octave …), up to four
 * @returns {{fa:number,fb:number,fc:number,fd:number}} with the first degree at `base`
 */
export function tuneToScale(scale, degrees, base = 2) {
  const steps = SCALES[scale] || SCALES.major;
  const period = 12;
  const semis = (d) => {
    const i = d - 1, n = steps.length;
    return steps[mod(i, n)] + period * Math.floor(i / n);
  };
  const ds = (degrees.length ? degrees : [1, 3, 5, 8]).slice(0, 4);
  while (ds.length < 4) ds.push(ds[ds.length - 1] || 1);
  const f = ds.map((d) => +(base * 2 ** ((semis(d) - semis(ds[0])) / 12)).toFixed(4));
  return { fa: f[0], fb: f[1], fc: f[2], fd: f[3] };
}

/* ----------------------------------------------------------------------------- the scene */

const CAP = 300000;

function grow(a, n) {
  if (a.length >= n) return a;
  const b = new Float32Array(Math.max(n, a.length * 2));
  b.set(a);
  return b;
}

export const harmonograph = {
  label: 'Harmonograph (the drawing machine of pendulums)', group: 'Harmonograph',
  defaults: DEFAULTS,
  controls: [
    ['kind', 'Machine', 's', KINDS],
    ['fa', 'Pendulum A (x) frequency', 'r', 0.25, 12, 0.001], ['fb', 'Pendulum B (y) frequency', 'r', 0.25, 12, 0.001],
    ['fc', 'Pendulum C (x) frequency', 'r', 0.25, 12, 0.001], ['fd', 'Pendulum D (y) frequency', 'r', 0.25, 12, 0.001],
    ['pa', 'Phase A', 'r', 0, 360, 1, '°'], ['pb', 'Phase B', 'r', 0, 360, 1, '°'], ['pc', 'Phase C', 'r', 0, 360, 1, '°'], ['pd', 'Phase D', 'r', 0, 360, 1, '°'],
    ['aa', 'Size A', 'r', 0, 1, 0.01], ['ab', 'Size B', 'r', 0, 1, 0.01], ['ac', 'Size C', 'r', 0, 1, 0.01], ['ad', 'Size D', 'r', 0, 1, 0.01],
    ['table', 'Table turning speed (rotary)', 'r', -4, 4, 0.01], ['tp', 'Table start angle', 'r', 0, 360, 1, '°'],
    ['life', 'Swing lasts (s, 0 = never fades)', 'r', 0, 180, 1], ['rate', 'Drawing speed', 'r', 0.2, 8, 0.05],
    ['fx', 'x(t, s, a, b, c, d)', 'f', 's*(sin(a*t)+sin(c*t))/2', ['t', 's', 'a', 'b', 'c', 'd']], ['fy', 'y(t, s, a, b, c, d)', 'f', 's*(sin(b*t+1.57)+sin(d*t))/2', ['t', 's', 'a', 'b', 'c', 'd']],
    ['fit', 'Shape', 's', { auto: 'Automatic', square: 'True proportions', fill: 'Stretch to the frame' }],
    ['pens', 'Pens', 'r', 1, 4, 1], ['penGap', 'Gap between pens', 'r', 0.02, 3, 0.01], ['ink', 'Ink', 's', INK_STYLES], ['colorBy', 'Colour by', 's', COLOR_BY],
    ['hue0', 'Colour offset', 'r', 0, 1, 0.01], ['hueRate', 'Colour change along the drawing', 'r', 0, 0.1, 0.001], ['width', 'Line width', 'r', 0.3, 5, 0.05], ['ghost', 'Show a hint of the final shape', 't'],
    ['paper', 'Paper', 's', Object.fromEntries(Object.entries(PAPERS).map(([k, v]) => [k, v.label]))], ['frame', 'Frame', 's', FRAMES], ['dials', 'Pendulum dials', 't'],
    ['pen', 'Pen', 's', { dot: 'Glowing dot', nib: 'Nib', none: 'Hidden' }],
    ['sym', 'Symmetry (copies around the centre)', 'r', 1, 12, 1], ['mirror', 'Mirror each copy', 't'],
    ['sound', 'Sound', 's', { strum: 'Strum the pendulums', chord: 'Chord', cross: 'Every time the pen crosses the middle', off: 'Silent' }],
    ['arp', 'Strum order', 's', { up: 'Up', down: 'Down', pingpong: 'Up and down' }], ['every', 'A note every', 'r', 0.1, 4, 0.05, ' s'],
    ['base', 'Pendulum A plays (MIDI note)', 'r', 24, 84, 1], ['tuning', 'Tuning', 's', { just: 'Exact ratios (just intonation)', equal: 'Piano keys (equal temperament)' }],
  ],

  init(S, P) {
    const m = machine(P);
    const pens = clamp(Math.round(+P.pens || 1), 1, 4);
    const sc = (S.sc = { m, u: 0, pens, pts: [], n: 0, next: 0, k: 0, lastX: 0, lastVx: 0, crossN: 0 });
    for (let i = 0; i < pens; i++) sc.pts.push({ x: new Float32Array(4096), y: new Float32Array(4096), u: new Float32Array(4096) });
    const gap = +P.penGap || 0;
    for (let i = 0; i < pens; i++) this.push(S, i, 0, gap * i);
    sc.n = 1;
    sc.pos = this.where(S, P, 0);
  },

  /** World position of the pen (before symmetry) for pen time u. */
  where(S, P, u) {
    const [x, y] = S.sc.m.at(u);
    const { hw, hh } = S.W;
    const margin = P.dials ? 0.84 : 0.95;
    // auto: fill the tall frame unless the drawing needs true proportions (symmetry, circles, rotation)
    const fill = P.fit === 'fill' || (P.fit === 'auto' && (+P.sym || 1) <= 1 && (P.kind === 'lateral' || P.kind === 'quad' || P.kind === 'lissajous'));
    const sx = fill ? hw : Math.min(hw, hh);
    const sy = fill ? hh : Math.min(hw, hh);
    return [x * sx * margin, y * sy * margin + (P.dials ? -0.05 * hh : 0)];
  },

  push(S, pen, u, shift) {
    const sc = S.sc, pts = sc.pts[pen];
    const i = pen === 0 ? sc.n : sc.n;
    pts.x = grow(pts.x, i + 1); pts.y = grow(pts.y, i + 1); pts.u = grow(pts.u, i + 1);
    const [x, y] = this.where(S, S.P, u + shift);
    pts.x[i] = x; pts.y[i] = y; pts.u[i] = u;
  },

  step(S, P, dt, emit) {
    const sc = S.sc;
    const du = dt * P.rate;
    const sub = clamp(Math.ceil((sc.m.maxW * du) / 0.045), 1, 24);
    const gap = +P.penGap || 0;
    for (let i = 1; i <= sub && sc.n < CAP; i++) {
      const u = sc.u + (du * i) / sub;
      for (let p = 0; p < sc.pens; p++) this.push(S, p, u, gap * p);
      sc.n++;
    }
    sc.u += du;
    const [x, y] = this.where(S, P, sc.u);
    const vx = x - sc.lastX;
    const e = sc.m.env(sc.u);
    sc.pos = [x, y];
    const ang = Math.atan2(y, x);
    if (P.sound === 'cross') {
      if (vx * sc.lastVx < 0 && e > 0.03) {
        const idx = sounding(P);
        const i = idx[sc.crossN++ % Math.max(1, idx.length)] ?? 0;
        emit({ type: 'hit', ball: i, x, y, angle: ang, midi: toneMidi(P, i), vel: clamp(0.3 + 0.7 * e, 0.1, 1) });
      }
    } else if (P.sound === 'strum' || P.sound === 'chord') {
      while (S.st >= sc.next) {
        sc.next += Math.max(0.05, +P.every || 0.5);
        const ev = sc.m.env(sc.next * P.rate - Math.max(0.05, +P.every || 0.5) * P.rate);
        if (ev < 0.03) continue;
        const idx = sounding(P);
        if (!idx.length) continue;
        if (P.sound === 'chord') {
          idx.forEach((i) => emit({ type: 'hit', ball: i, x, y, angle: ang, midi: toneMidi(P, i), vel: clamp(0.3 + 0.7 * ev, 0.1, 1), together: true }));
        } else {
          let order = idx;
          if (P.arp === 'down') order = idx.slice().reverse();
          else if (P.arp === 'pingpong') order = idx.concat(idx.slice(1, -1).reverse());
          const i = order[sc.k++ % order.length];
          emit({ type: 'hit', ball: i, x, y, angle: ang, midi: toneMidi(P, i), vel: clamp(0.3 + 0.7 * ev, 0.1, 1) });
        }
      }
    }
    sc.lastVx = vx || sc.lastVx;
    sc.lastX = x;
  },

  /* ------------------------------------------------------------------------ painting */

  draw(S, P, D) {
    const { g } = D;
    const w = g.canvas?.width ?? 1080, h = g.canvas?.height ?? 1920;
    const sc = S.sc;
    const paper = PAPERS[P.paper] || PAPERS.velvet;
    if (P.paper !== 'default') paintPaper(g, P.paper, w, h, D.k);
    if (P.frame && P.frame !== 'none') drawFrame(g, P.frame, D, S, paper.light);
    if (P.ghost) drawGhost(g, S, P, D, paper.light);
    paintInk(S, P, D, w, h, paper.light);
    drawFurniture(g, S, P, D, paper.light);
    void sc;
  },

  stats: (S) => `swing ${Math.round(S.sc.m.env(S.sc.u) * 100)}%`,
  formula: (P) => {
    const f = (v) => +(+v).toFixed(3);
    if (P.kind === 'formula') return `x = ${P.fx},  y = ${P.fy}`;
    if (P.kind === 'lateral' || P.kind === 'lissajous') return `x: sin ${f(P.fa)}t   y: sin ${f(P.fb)}t`;
    return `A ${f(P.fa)} · B ${f(P.fb)} · C ${f(P.fc)} · D ${f(P.fd)}`;
  },
};

/* ------------------------------------------------------------------------------ paper */

const paperCache = new Map();

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function buildPaper(kind, w, h, k) {
  const c = makeCanvas(w, h), g = c.getContext('2d');
  const R = rng(kind.length * 977 + 13);
  const base = PAPERS[kind].bg;
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const radial = (cx, cy, r0, r1, stops) => {
    const gr = g.createRadialGradient(cx, cy, r0, cx, cy, r1);
    for (const [o, col] of stops) gr.addColorStop(o, col);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  };
  const diag = Math.hypot(w, h);
  if (kind === 'velvet') {
    radial(w / 2, h * 0.46, 0, diag * 0.55, [[0, '#14173a'], [0.55, '#080a1c'], [1, '#02030a']]);
  } else if (kind === 'midnight') {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#04061a'); gr.addColorStop(0.55, '#141048'); gr.addColorStop(1, '#2a1a5c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 170; i++) {
      g.globalAlpha = 0.2 + 0.7 * R() ** 2;
      g.fillStyle = R() < 0.2 ? '#ffd9a8' : '#dfe8ff';
      g.beginPath(); g.arc(R() * w, R() * h, (0.4 + 1.4 * R() ** 3) * k * 1.6, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
  } else if (kind === 'blueprint') {
    radial(w / 2, h / 2, 0, diag * 0.6, [[0, '#14418a'], [1, '#07204a']]);
    const cell = 42 * k * 1.6;
    g.lineWidth = Math.max(1, k * 1.4);
    for (let i = 0, x = (w % cell) / 2; x < w; x += cell, i++) { g.strokeStyle = i % 5 ? 'rgba(160,205,255,0.13)' : 'rgba(160,205,255,0.3)'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let i = 0, y = (h % cell) / 2; y < h; y += cell, i++) { g.strokeStyle = i % 5 ? 'rgba(160,205,255,0.13)' : 'rgba(160,205,255,0.3)'; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  } else if (kind === 'chalk') {
    radial(w / 2, h / 2, 0, diag * 0.6, [[0, '#1f3429'], [1, '#0c1612']]);
    g.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = `rgba(230,240,235,${0.003 + 0.007 * R()})`;
      g.lineWidth = (40 + 120 * R()) * k;
      g.beginPath(); const x = R() * w, y = R() * h; g.moveTo(x, y); g.quadraticCurveTo(x + (R() - 0.5) * w * 0.4, y + (R() - 0.5) * h * 0.2, x + (R() - 0.5) * w * 0.5, y + (R() - 0.5) * h * 0.3); g.stroke();
    }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${0.02 + 0.05 * R()})`; g.fillRect(R() * w, R() * h, 1.5 * k * 1.6, 1.5 * k * 1.6); }
  } else if (kind === 'ember') {
    const gr = g.createLinearGradient(0, h, 0, 0);
    gr.addColorStop(0, '#3a1208'); gr.addColorStop(0.5, '#1a0907'); gr.addColorStop(1, '#0a0405');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    radial(w / 2, h * 0.5, 0, diag * 0.5, [[0, 'rgba(255,120,50,0.12)'], [1, 'rgba(255,120,50,0)']]);
  } else if (kind === 'parchment' || kind === 'cream') {
    const parch = kind === 'parchment';
    for (let i = 0; i < (parch ? 46 : 18); i++) {
      const x = R() * w, y = R() * h, r = (0.15 + 0.35 * R()) * Math.max(w, h);
      radial(x, y, 0, r, [[0, parch ? `rgba(${150 + 40 * R() | 0},${105 + 30 * R() | 0},50,${0.05 + 0.07 * R()})` : `rgba(210,200,180,${0.05 + 0.05 * R()})`], [1, 'rgba(0,0,0,0)']]);
    }
    for (let i = 0; i < (parch ? 1400 : 500); i++) {
      g.strokeStyle = parch ? `rgba(110,80,40,${0.04 + 0.06 * R()})` : `rgba(120,110,90,${0.03 + 0.04 * R()})`;
      g.lineWidth = Math.max(0.6, 0.8 * k);
      const x = R() * w, y = R() * h, a = R() * TAU, l = (4 + 16 * R()) * k * 1.6;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    radial(w / 2, h / 2, Math.min(w, h) * 0.3, diag * 0.62, [[0, 'rgba(0,0,0,0)'], [1, parch ? 'rgba(120,80,30,0.55)' : 'rgba(90,80,60,0.22)']]);
  }
  return c;
}

function paintPaper(g, kind, w, h, k) {
  const key = `${kind}|${w}x${h}`;
  let c = paperCache.get(key);
  if (!c) {
    if (paperCache.size > 6) paperCache.clear();
    c = buildPaper(kind, w, h, k);
    paperCache.set(key, c);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.drawImage(c, 0, 0);
}

/* ------------------------------------------------------------------------------ frame */

function drawFrame(g, style, D, S, light) {
  const { hw, hh } = S.W, { k } = D;
  const col = light ? 'rgba(80,56,28,0.7)' : hexA(D.pal.ring, 0.5);
  const x0 = D.X(-hw), x1 = D.X(hw), y0 = D.Y(hh), y1 = D.Y(-hh);
  g.save();
  g.strokeStyle = col; g.fillStyle = col; g.lineWidth = Math.max(1, 2 * k);
  const rr = (inset, r) => {
    const a = x0 + inset, b = y0 + inset, c = x1 - inset, d = y1 - inset;
    g.beginPath();
    g.moveTo(a + r, b); g.lineTo(c - r, b); g.quadraticCurveTo(c, b, c, b + r); g.lineTo(c, d - r); g.quadraticCurveTo(c, d, c - r, d);
    g.lineTo(a + r, d); g.quadraticCurveTo(a, d, a, d - r); g.lineTo(a, b + r); g.quadraticCurveTo(a, b, a + r, b); g.closePath(); g.stroke();
  };
  rr(0, 16 * k);
  if (style === 'double' || style === 'ornate') { g.lineWidth = Math.max(1, 1 * k); rr(10 * k, 10 * k); }
  if (style === 'ornate') {
    g.lineWidth = Math.max(1, 1.4 * k);
    for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
      const a0 = sx > 0 ? (sy > 0 ? Math.PI : Math.PI * 0.5) : (sy > 0 ? Math.PI * 1.5 : 0);
      g.beginPath(); g.arc(cx + sx * 26 * k, cy + sy * 26 * k, 14 * k, a0, a0 + Math.PI / 2, false); g.stroke();
      g.beginPath(); g.moveTo(cx + sx * 8 * k, cy + sy * 8 * k); g.lineTo(cx + sx * 46 * k, cy + sy * 8 * k); g.moveTo(cx + sx * 8 * k, cy + sy * 8 * k); g.lineTo(cx + sx * 8 * k, cy + sy * 46 * k); g.stroke();
    }
    for (const [cx, cy] of [[(x0 + x1) / 2, y0 + 10 * k], [(x0 + x1) / 2, y1 - 10 * k], [x0 + 10 * k, (y0 + y1) / 2], [x1 - 10 * k, (y0 + y1) / 2]]) {
      g.beginPath(); g.moveTo(cx, cy - 6 * k); g.lineTo(cx + 6 * k, cy); g.lineTo(cx, cy + 6 * k); g.lineTo(cx - 6 * k, cy); g.closePath(); g.fill();
    }
  }
  g.restore();
}

/* ------------------------------------------------------------------------------- ink */

/** Where copies of a point go: rotations (and mirrors) around the centre of the drawing. */
function copies(P) {
  const n = clamp(Math.round(+P.sym || 1), 1, 12);
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n, c = Math.cos(a), s = Math.sin(a);
    out.push([c, -s, s, c]);
    if (P.mirror) out.push([c, s, s, -c]); // reflect in the x axis, then rotate
  }
  return out;
}

function paintInk(S, P, D, w, h, light) {
  const { g, pal, k } = D;
  const sc = S.sc;
  let ink = sc.ink;
  if (!ink || ink.width !== w || ink.height !== h || sc.inkKey !== `${P.ink}|${P.sym}|${P.mirror}|${P.colorBy}|${P.width}|${P.hue0}|${P.hueRate}|${light}`) {
    if (!ink) ink = sc.ink = makeCanvas(w, h);
    ink.width = w; ink.height = h;
    sc.inkKey = `${P.ink}|${P.sym}|${P.mirror}|${P.colorBy}|${P.width}|${P.hue0}|${P.hueRate}|${light}`;
    sc.inked = new Array(sc.pens).fill(0);
  }
  const ig = ink.getContext('2d');
  const cps = copies(P);
  const run = cps.length <= 4 ? 18 : cps.length <= 12 ? 36 : 60; // longer runs for many copies: fewer, bigger strokes
  ig.lineCap = 'round'; ig.lineJoin = 'round';
  ig.globalCompositeOperation = light ? 'source-over' : 'lighter';
  const lw = Math.max(0.5, (+P.width || 1.2) * k * 1.6) * (light ? 1.35 : 1);
  const dense = light ? 1 : Math.min(1, 2.4 / Math.sqrt(cps.length)); // many additive copies would burn out the centre
  const cx = D.X(0), cy = D.Y(0), R = D.R;
  const mapCopy = (m, x, y) => [cx + (m[0] * x + m[1] * y) * R, cy - (m[2] * x + m[3] * y) * R];
  for (let p = 0; p < sc.pens; p++) {
    const pts = sc.pts[p];
    let i0 = sc.inked[p];
    const end = sc.n;
    while (i0 < end - 1) {
      const i1 = Math.min(end - 1, i0 + run);
      // colour and width of this run
      const dx = pts.x[i1] - pts.x[i0], dy = pts.y[i1] - pts.y[i0];
      const du = Math.max(1e-6, pts.u[i1] - pts.u[i0]);
      let len = 0;
      for (let i = i0 + 1; i <= i1; i++) len += Math.hypot(pts.x[i] - pts.x[i - 1], pts.y[i] - pts.y[i - 1]);
      const vel = clamp(len / du / 7, 0, 1.5);
      const mx = pts.x[i0 + ((i1 - i0) >> 1)], my = pts.y[i0 + ((i1 - i0) >> 1)];
      const um = pts.u[i0 + ((i1 - i0) >> 1)];
      let hue = (+P.hue0 || 0);
      switch (P.colorBy) {
        case 'speed': hue += 0.65 * (1 - Math.min(1, vel)); break;
        case 'angle': hue += Math.atan2(dy, dx) / TAU; break;
        case 'radius': hue += Math.hypot(mx, my) / Math.max(0.4, Math.min(S.W.hw, S.W.hh)) * 0.9; break;
        case 'pen': hue += p / Math.max(1, sc.pens) + um * 0.002; break;
        default: hue += um * (+P.hueRate || 0.012);
      }
      const col = pal.line(hue);
      const path = (m) => {
        ig.beginPath();
        let [px, py] = mapCopy(m, pts.x[i0], pts.y[i0]);
        ig.moveTo(px, py);
        for (let i = i0 + 1; i <= i1; i++) { [px, py] = mapCopy(m, pts.x[i], pts.y[i]); ig.lineTo(px, py); }
      };
      ig.strokeStyle = col;
      const style = P.ink;
      if (style === 'neon') {
        ig.globalAlpha = (light ? 0.1 : 0.13) * dense; ig.lineWidth = lw * 4.2; for (const m of cps) { path(m); ig.stroke(); }
        ig.globalAlpha = (light ? 0.95 : 0.9) * (light ? 1 : Math.max(0.35, dense)); ig.lineWidth = lw; for (const m of cps) { path(m); ig.stroke(); }
      } else if (style === 'fine') {
        ig.globalAlpha = (light ? 0.55 : 0.3) * dense; ig.lineWidth = Math.max(0.6, lw * 0.55); for (const m of cps) { path(m); ig.stroke(); }
      } else if (style === 'brush') {
        ig.globalAlpha = (light ? 0.85 : 0.6) * dense; ig.lineWidth = lw * (0.55 + 2.1 * (1 - Math.min(1, vel))); for (const m of cps) { path(m); ig.stroke(); }
      } else {
        ig.globalAlpha = light ? 0.95 : 0.7; ig.lineWidth = lw * (light ? 1.05 : 0.8); for (const m of cps) { path(m); ig.stroke(); }
      }
      i0 = i1;
    }
    sc.inked[p] = Math.max(sc.inked[p], i0);
  }
  ig.globalAlpha = 1;
  ig.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.drawImage(ink, 0, 0);
}

/** A faint line of the whole drawing to come (guess-the-shape videos). */
function drawGhost(g, S, P, D, light) {
  const sc = S.sc, total = (S.duration || 30) * P.rate;
  const key = `${S.duration}|${P.rate}|${P.kind}|${P.fa}|${P.fb}|${P.fc}|${P.fd}|${P.pa}|${P.pb}|${P.pc}|${P.pd}|${P.life}|${P.table}|${P.aa}|${P.ab}|${P.ac}|${P.ad}|${P.fx}|${P.fy}|${P.fit}|${P.dials}`;
  if (sc.ghostKey !== key) {
    sc.ghostKey = key;
    const N = 3000;
    sc.ghost = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) { const [x, y] = harmonograph.where(S, P, (i / (N - 1)) * total); sc.ghost[2 * i] = x; sc.ghost[2 * i + 1] = y; }
  }
  g.save();
  g.strokeStyle = light ? 'rgba(60,40,20,0.14)' : 'rgba(255,255,255,0.1)';
  g.lineWidth = Math.max(1, D.k * 1.4);
  const cx = D.X(0), cy = D.Y(0), R = D.R;
  for (const m of copies(P)) {
    g.beginPath();
    for (let i = 0; i < sc.ghost.length / 2; i++) {
      const x = sc.ghost[2 * i], y = sc.ghost[2 * i + 1];
      const px = cx + (m[0] * x + m[1] * y) * R, py = cy - (m[2] * x + m[3] * y) * R;
      if (i) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.stroke();
  }
  g.restore();
}

/* ------------------------------------------------------------------- dials and the pen */

function drawFurniture(g, S, P, D, light) {
  const sc = S.sc, { k, pal } = D;
  const col = light ? '#3b2a14' : pal.ring;
  if (P.dials) {
    const idx = P.kind === 'epicycle' || P.kind === 'formula' || P.kind === 'rotary' || P.kind === 'quad' ? [0, 1, 2, 3] : [0, 1];
    const list = idx.map((i) => ({ i, f: [P.fa, P.fb, P.fc, P.fd][i], p: [P.pa, P.pb, P.pc, P.pd][i], name: 'ABCD'[i] }));
    if (P.kind === 'rotary') list.push({ i: 4, f: P.table, p: P.tp, name: '⟳' });
    const { hw, hh } = S.W;
    const e = sc.m.env(sc.u), n = list.length;
    list.forEach((d, j) => {
      const x = D.X(-hw * 0.78 + (j + 0.5) * ((hw * 1.56) / n)), y = D.Y(hh * 0.9), r = 0.075 * D.R;
      g.save();
      g.lineWidth = Math.max(1, 1.6 * k);
      g.strokeStyle = hexA(col, light ? 0.35 : 0.3);
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
      g.strokeStyle = hexA(col, 0.9);
      g.lineWidth = Math.max(1.5, 3 * k);
      g.beginPath(); g.arc(x, y, r * 1.18, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(e, 0, 1)); g.stroke();
      const a = d.f * sc.u + (+d.p || 0) * Math.PI / 180;
      g.lineWidth = Math.max(1.5, 2.4 * k);
      g.strokeStyle = pal.glow;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * 0.9, y - Math.sin(a) * r * 0.9); g.stroke();
      g.fillStyle = hexA(col, 0.85);
      g.font = `${Math.round(13 * k * 1.5)}px ui-monospace, monospace`; g.textAlign = 'center'; g.textBaseline = 'top';
      g.fillText(d.name, x, y + r * 1.4);
      g.restore();
    });
  }
  if (P.pen === 'none' || !sc.pos) return;
  const cps = copies(P).slice(0, P.sym > 1 ? 1 : 1);
  const [x, y] = sc.pos;
  const px = D.X(x * cps[0][0] + y * cps[0][1]), py = D.Y(x * cps[0][2] + y * cps[0][3]);
  g.save();
  g.shadowColor = pal.glow; g.shadowBlur = 20 * k;
  if (P.pen === 'nib') {
    g.fillStyle = light ? '#2a1c0c' : '#ffffff';
    g.translate(px, py); g.rotate(-0.5);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(-7 * k * 1.6, -26 * k * 1.6); g.lineTo(7 * k * 1.6, -26 * k * 1.6); g.closePath(); g.fill();
  } else {
    g.fillStyle = light ? '#2a1c0c' : '#ffffff';
    g.beginPath(); g.arc(px, py, 6 * k * 1.4, 0, TAU); g.fill();
  }
  g.restore();
}
