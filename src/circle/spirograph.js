/**
 * Spirograph and guilloche: two Circle Lab scenes for toothed wheels that roll inside or outside
 * one another, and for the engine-turned patterns of banknotes and watch dials.
 *
 * Spirograph (hypotrochoid, epitrochoid, and the cycloids when the pen sits on the rim)
 *   inside   x = (R−r)·cos θ + d·cos(kθ),   y = (R−r)·sin θ − d·sin(kθ),   k = (R−r)/r
 *   outside  x = (R+r)·cos θ − d·cos(kθ),   y = (R+r)·sin θ − d·sin(kθ),   k = (R+r)/r
 * R and r are numbers of teeth, d is how far from the wheel's centre the pen hole is. The pattern
 * repeats after r / gcd(R, r) turns of the wheel and has R / gcd(R, r) petals; with an irrational
 * ratio it never closes. Also: a gear in a gear in a ring (compound), a lobed (non-circular) wheel,
 * and your own x(t), y(t).
 *
 * The toy (ring, wheels with holes, pen) is a separate element drawn over the ink: shown, hidden,
 * faded in or out, restyled (toy / blueprint / brass / neon), recoloured, moved, rotated, scaled.
 * Everything is deterministic and pure up to draw().
 */
import { tryCompile } from '../math/parser.js';
import { hexA } from './palettes.js';
import { PAPERS, INK_STYLES, FRAMES, paintPaper, drawFrame, makeCanvas, rng } from './harmonograph.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const gcd = (a, b) => { a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b)); while (b) [a, b] = [b, a % b]; return a || 1; };

export { PAPERS, INK_STYLES, FRAMES };

export const SPIRO_KINDS = {
  hypo: 'Wheel inside the ring (hypotrochoid)',
  epi: 'Wheel outside the ring (epitrochoid)',
  compound: 'A gear in a gear in a ring',
  lobed: 'Lobed (non-circular) wheel in the ring',
  formula: 'My own formula',
};
export const TOY_STYLES = { toy: 'Toy (coloured plastic)', brass: 'Brass', blueprint: 'Blueprint outline', neon: 'Neon outline' };
export const TOY_SHOW = {
  on: 'Always shown',
  off: 'Hidden',
  intro: 'Shown at the start, then fades away',
  outro: 'Fades away when the drawing is finished',
  inout: 'Fades in, and fades away at the end',
};
export const COLOR_BY = {
  time: 'Along the drawing', turn: 'Each turn of the wheel', speed: 'Pen speed', radius: 'Distance from the centre', angle: 'Direction of the pen', pen: 'Each pen its own colour',
};
export const EASES = { steady: 'Steady', intro: 'Slow start, then faster', smooth: 'Slow start and slow end' };

/** Classic gear sets of the toy: ring teeth and the wheels that fit. */
export const GEAR_SETS = [
  ['96 / 30', 96, 30], ['96 / 32', 96, 32], ['96 / 42', 96, 42], ['96 / 45', 96, 45], ['96 / 63', 96, 63], ['105 / 30', 105, 30], ['105 / 45', 105, 45],
  ['144 / 52', 144, 52], ['150 / 56', 150, 56], ['84 / 24', 84, 24], ['72 / 18', 72, 18],
];

export const SPIRO_DEFAULTS = {
  kind: 'hypo', R: 96, r: 30, d: 21, r2: 14, d2: 8, m: 7, lobes: 3, lobeAmt: 0.2,
  fx: '(ring-wheel)*cos(t) + d*cos(k*t)', fy: '(ring-wheel)*sin(t) - d*sin(k*t)', dFormula: '',
  turns: 0, maxTurns: 60, drawTime: 24, ease: 'intro',
  pens: 1, dStep: 4,
  ink: 'fine', colorBy: 'time', hue0: 0, hueRate: 1, width: 1.1,
  paper: 'desk', frame: 'none', size: 1, x: 0, y: 0, rot: 0,
  toyShow: 'on', toyOpacity: 1, toyFade: 1.5, toyIntro: 8, toyStyle: 'toy', toyRing: '#ff8a3d', toyWheel: '#7fd0ff', toyWheel2: '#ffd27f', toyPen: '#d02030',
  toyHoles: true, toyShadow: true, toyDetach: false, toyDx: 0, toyDy: 0, toyScale: 1, toyRot: 0,
  sound: 'gear', every: 6, base: 48, tuning: 'just', ratioEvery: 1.5,
};

/* ------------------------------------------------------------------------- the machine */

// (the formula parser ignores letter case, so R and r would be the same name: ring and wheel it is)
const VARS = ['t', 'ring', 'wheel', 'd', 'k'];

/**
 * The pen of one setting: position (in teeth) at wheel-orbit angle th for pen `i` (each pen
 * sits dStep further from the centre), and the geometry of the toy at that angle.
 */
export function spiroMachine(P) {
  const kind = P.kind in SPIRO_KINDS ? P.kind : 'hypo';
  const R = Math.max(2, +P.R || 96), r = Math.max(1, +P.r || 30);
  const inside = kind !== 'epi';
  const k = inside ? (R - r) / r : (R + r) / r;
  const r2 = Math.max(1, +P.r2 || 14), m = +P.m || 7;
  const lobes = Math.max(2, Math.round(+P.lobes || 3)), amt = +P.lobeAmt || 0;
  const dForm = String(P.dFormula || '').trim() ? tryCompile(String(P.dFormula), ['t', 'd', 'ring', 'wheel']) : null;
  const dOf = (th, d) => {
    if (kind === 'lobed') d *= 1 + amt * Math.cos(lobes * th);
    if (dForm?.ok) { const v = dForm.fn({ t: th, d, ring: R, wheel: r }); if (Number.isFinite(v)) d = v; }
    return d;
  };
  let fx = null, fy = null;
  if (kind === 'formula') {
    const cx = tryCompile(String(P.fx || ''), VARS), cy = tryCompile(String(P.fy || ''), VARS);
    fx = cx.ok ? cx.fn : null; fy = cy.ok ? cy.fn : null;
  }
  const scope = { t: 0, ring: R, wheel: r, d: 0, k };
  const at = (th, d0) => {
    const d = dOf(th, d0);
    switch (kind) {
      case 'epi': return [(R + r) * Math.cos(th) - d * Math.cos(k * th), (R + r) * Math.sin(th) - d * Math.sin(k * th)];
      case 'compound': {
        const psi1 = -k * th, o = m * th;
        const bx = (R - r) * Math.cos(th) + (r - r2) * Math.cos(o), by = (R - r) * Math.sin(th) + (r - r2) * Math.sin(o);
        const psi2 = psi1 - ((r - r2) / r2) * (o - psi1);
        return [bx + (+P.d2 || 0) * (d0 / (+P.d || 1)) * Math.cos(psi2), by + (+P.d2 || 0) * (d0 / (+P.d || 1)) * Math.sin(psi2)];
      }
      case 'formula': {
        scope.t = th; scope.d = d;
        const x = fx ? fx(scope) : 0, y = fy ? fy(scope) : 0;
        return [Number.isFinite(x) ? x : 0, Number.isFinite(y) ? y : 0];
      }
      default: return [(R - r) * Math.cos(th) + d * Math.cos(k * th), (R - r) * Math.sin(th) - d * Math.sin(k * th)];
    }
  };
  /** Rolling toy at angle th: centres and turning of the parts (all in teeth). */
  const rig = (th, d0) => {
    const d = dOf(th, d0);
    if (kind === 'epi') {
      const a = k * th + Math.PI, c = [(R + r) * Math.cos(th), (R + r) * Math.sin(th)];
      return { ring: { x: 0, y: 0, R, outer: true }, wheels: [{ x: c[0], y: c[1], rp: r, N: Math.round(r), rot: a, lobed: 0 }], pen: [c[0] + d * Math.cos(a), c[1] + d * Math.sin(a)], pa: a };
    }
    const psi1 = -k * th, c = [(R - r) * Math.cos(th), (R - r) * Math.sin(th)];
    if (kind === 'compound') {
      const o = m * th, psi2 = psi1 - ((r - r2) / r2) * (o - psi1);
      const b = [c[0] + (r - r2) * Math.cos(o), c[1] + (r - r2) * Math.sin(o)];
      const dd = (+P.d2 || 0) * (d0 / (+P.d || 1));
      return { ring: { x: 0, y: 0, R, outer: false }, wheels: [{ x: c[0], y: c[1], rp: r, N: Math.round(r), rot: psi1, lobed: 0 }, { x: b[0], y: b[1], rp: r2, N: Math.round(r2), rot: psi2, lobed: 0 }], pen: [b[0] + dd * Math.cos(psi2), b[1] + dd * Math.sin(psi2)], pa: psi2 };
    }
    return { ring: { x: 0, y: 0, R, outer: false }, wheels: [{ x: c[0], y: c[1], rp: r, N: Math.round(r), rot: psi1, lobed: kind === 'lobed' ? lobes : 0, amt }], pen: [c[0] + d * Math.cos(psi1), c[1] + d * Math.sin(psi1)], pa: psi1 };
  };
  // number of wheel orbits until the pattern closes (capped), and how many petals it has
  let orbits;
  const Rr = Math.round(R * 100), rr = Math.round(r * 100);
  if (kind === 'compound' || kind === 'formula' || kind === 'lobed') orbits = Math.max(1, rr / gcd(Rr, rr));
  else orbits = rr / gcd(Rr, rr);
  const cap = clamp(+P.maxTurns || 60, 1, 400);
  const closes = orbits <= cap;
  const turns = +P.turns > 0 ? +P.turns : Math.min(orbits, cap);
  const petals = inside ? Rr / gcd(Rr, rr) : Rr / gcd(Rr, rr);
  const maxW = Math.max(1, Math.abs(k)) + (kind === 'compound' ? Math.abs(m) * (1 + (r - r2) / r2) : kind === 'lobed' ? lobes : 0);
  // the largest distance of the pen from the centre (to fit the drawing in the frame)
  let E = 1;
  const N = 1600, d0 = +P.d || 0;
  for (let i = 0; i <= N; i++) { const [x, y] = at((i / N) * TAU * Math.min(turns, 12), d0); E = Math.max(E, Math.hypot(x, y)); }
  if ((+P.pens || 1) > 1) for (let i = 0; i <= N; i += 4) { const [x, y] = at((i / N) * TAU * Math.min(turns, 12), d0 + (P.pens - 1) * (+P.dStep || 0)); E = Math.max(E, Math.hypot(x, y)); }
  return { at, rig, kind, R, r, k, E, turns, orbits, closes, petals, maxW, inside, formulaOk: kind !== 'formula' || !!(fx && fy) };
}

/** What the person is told: how many turns until the drawing closes and how many petals it has. */
export function closureInfo(P) {
  const m = spiroMachine(P);
  if (m.kind === 'formula') return 'A formula: no gears.';
  if (!m.closes) return `Does not close within ${P.maxTurns} turns: it keeps filling the page.`;
  const g = gcd(Math.round(m.R * 100), Math.round(m.r * 100));
  if (m.kind === 'compound' || m.kind === 'lobed') return `Closes after about ${Math.round(m.orbits)} turns of the wheel.`;
  return `Closes after ${Math.round(m.orbits)} turn${m.orbits === 1 ? '' : 's'} of the wheel, ${Math.round(m.petals)} petals (gcd = ${g / 100}).`;
}

const easeOf = (e, x) => {
  x = clamp(x, 0, 1);
  if (e === 'steady') return x;
  if (e === 'smooth') return x * x * (3 - 2 * x);
  return x < 0.2 ? 0.05 * (x / 0.2) ** 2 : 0.05 + (x - 0.2) * (0.95 / 0.8); // a slow start (the first fifth of the time draws 5%), then a steady pace
};

/** A closing, good-looking gear set (deterministic per seed). */
export function luckySpiro(seed = 1) {
  const R0 = rng(seed * 2246822519 + 3266489917);
  let best = null;
  for (let tries = 0; tries < 30; tries++) {
    const kind = ['hypo', 'hypo', 'hypo', 'epi', 'compound'][Math.floor(R0() * 5)];
    const Rt = [60, 72, 84, 96, 105, 120, 144][Math.floor(R0() * 7)];
    const r = [18, 20, 24, 28, 30, 32, 35, 36, 40, 42, 45, 48, 52, 56, 63][Math.floor(R0() * 15)];
    if (r >= Rt * 0.8) continue;
    const g = gcd(Rt, r), orbits = r / g, petals = Rt / g;
    if (orbits > 14 || petals < 3 || petals > 40) continue;
    const d = Math.round(r * (0.45 + R0() * 0.65));
    const lab = { kind, R: Rt, r, d, r2: Math.max(8, Math.round(r * (0.3 + R0() * 0.3))), d2: Math.round(5 + R0() * 8), m: [3, 5, 7, 9, -4][Math.floor(R0() * 5)], drawTime: 24 };
    const m = spiroMachine({ ...SPIRO_DEFAULTS, ...lab });
    const seen = new Set();
    for (let i = 0; i < 3000; i++) { const [x, y] = m.at((i / 3000) * TAU * m.turns, d); seen.add(`${Math.floor((x / m.E + 1) * 12)},${Math.floor((y / m.E + 1) * 12)}`); }
    const score = -Math.abs(seen.size / 576 - 0.4);
    if (!best || score > best.score) best = { lab, score };
  }
  const looks = [['desk', 'fine', 'indigo'], ['desk', 'ink', 'sepia'], ['cream', 'ink', 'indigo'], ['velvet', 'neon', 'rainbow'], ['midnight', 'fine', 'ice'], ['blueprint', 'fine', 'mono'], ['ember', 'brush', 'fire'], ['velvet', 'brush', 'rosegold']];
  const [paper, ink, palette] = looks[Math.floor(R0() * looks.length)];
  const dark = !PAPERS[paper].light;
  return { lab: { ...(best?.lab || { R: 96, r: 30, d: 21 }), paper, ink, colorBy: ['time', 'time', 'turn', 'radius'][Math.floor(R0() * 4)], toyStyle: dark ? 'neon' : 'toy' }, look: { palette, background: PAPERS[paper].bg } };
}

/** Teeth for an interval: R : r ≈ ratio with R near `R` (e.g. 3:2 → 96 : 64). */
export function gearsForRatio(ratio, R = 96) { return { R, r: Math.max(8, Math.round(R / ratio)) }; }

/* ------------------------------------------------------------------------------ toy parts */

/** The outline of a toothed wheel as a list of points (teeth units). `internal` = teeth point inward (a ring). */
export function gearPoints(cx, cy, rp, N, rot, internal = false, lobes = 0, amt = 0) {
  const n = Math.max(6, Math.round(N)), p = TAU / n;
  const th = Math.min(0.62 * TAU, rp * 0.2); // tooth height in teeth units
  const rr = internal ? rp + th / 2 : rp - th / 2, rt = internal ? rp - th / 2 : rp + th / 2;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = rot + i * p;
    for (const [o, rad] of [[-0.32, rr], [-0.17, rt], [0.17, rt], [0.32, rr]]) {
      const ang = a + o * p, s = lobes ? 1 + amt * Math.cos(lobes * (ang - rot)) : 1;
      out.push([cx + rad * s * Math.cos(ang), cy + rad * s * Math.sin(ang)]);
    }
  }
  return out;
}

function polyPath(g, pts) { g.moveTo(pts[0][0], pts[0][1]); for (const q of pts) g.lineTo(q[0], q[1]); g.closePath(); }

/**
 * Draw the toy. `T` maps teeth coordinates to pixels; `u` = pixels per tooth.
 * @param {object} rig from spiroMachine().rig
 */
export function drawToy(g, T, u, rig, P, alpha) {
  if (alpha <= 0.002) return;
  const style = P.toyStyle in TOY_STYLES ? P.toyStyle : 'toy';
  const map = (pts) => pts.map((q) => T(q[0], q[1]));
  g.save();
  g.globalAlpha = alpha;
  g.lineJoin = 'round';
  const lw = Math.max(1, u * 0.35);
  const fillFor = (col, c, rad) => {
    if (style === 'toy') {
      const gr = g.createRadialGradient(c[0] - rad * 0.3, c[1] - rad * 0.35, rad * 0.1, c[0], c[1], rad * 1.1);
      gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(0.45, col); gr.addColorStop(1, 'rgba(15,25,70,0.85)');
      return gr;
    }
    if (style === 'brass') {
      const gr = g.createRadialGradient(c[0] - rad * 0.3, c[1] - rad * 0.4, rad * 0.1, c[0], c[1], rad * 1.1);
      gr.addColorStop(0, '#fff3b8'); gr.addColorStop(0.5, '#d9a640'); gr.addColorStop(1, '#6a4a10');
      return gr;
    }
    return 'rgba(8,24,60,0.35)';
  };
  const outline = () => {
    if (style === 'blueprint') { g.strokeStyle = '#dff0ff'; g.lineWidth = lw * 0.8; }
    else if (style === 'neon') { g.strokeStyle = '#8fe9ff'; g.lineWidth = lw; g.shadowColor = '#8fe9ff'; g.shadowBlur = 12; }
    else { g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = lw * 0.6; }
    g.stroke(); g.shadowBlur = 0;
  };
  // ring or disk
  const ring = rig.ring, rc = T(ring.x, ring.y);
  const ringTeeth = gearPoints(ring.x, ring.y, ring.R, Math.round(ring.R), 0.3, !ring.outer);
  const ringPx = map(ringTeeth);
  const rim = Math.max(6, ring.R * 0.18);
  const edge = T(ring.x + ring.R + rim, ring.y);
  const rimPx = Math.hypot(edge[0] - rc[0], edge[1] - rc[1]);
  if (P.toyShadow && style !== 'blueprint' && style !== 'neon') {
    g.save(); g.globalAlpha = alpha * 0.22; g.fillStyle = '#000'; g.translate(u * 2.5, u * 3.2);
    g.beginPath();
    if (!ring.outer) { g.arc(rc[0], rc[1], rimPx, 0, TAU); polyPath(g, ringPx); g.fill('evenodd'); } else { polyPath(g, ringPx); g.fill(); }
    g.restore();
  }
  g.beginPath();
  const ringCol = style === 'toy' ? P.toyRing : '#d9a640';
  if (!ring.outer) {
    g.arc(rc[0], rc[1], rimPx, 0, TAU); polyPath(g, ringPx);
    g.fillStyle = style === 'toy' ? ringCol : fillFor(ringCol, rc, rimPx);
    g.globalAlpha = alpha * (style === 'toy' ? 0.9 : 1);
    g.fill('evenodd'); g.globalAlpha = alpha; outline();
    if (style === 'toy') { g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = lw; g.beginPath(); g.arc(rc[0], rc[1], rimPx - u * 1.6, Math.PI * 1.05, Math.PI * 1.6); g.stroke(); }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.4;
      const q = T((ring.R + rim * 0.55) * Math.cos(a), (ring.R + rim * 0.55) * Math.sin(a));
      g.fillStyle = style === 'blueprint' || style === 'neon' ? 'rgba(223,240,255,0.5)' : 'rgba(0,0,0,0.3)';
      g.beginPath(); g.arc(q[0], q[1], u * 1.4, 0, TAU); g.fill();
    }
  } else {
    polyPath(g, ringPx);
    g.fillStyle = style === 'toy' ? hexA(ringCol, 0.9) : fillFor(ringCol, rc, ring.R * u);
    g.fill(); outline();
    g.beginPath(); g.arc(rc[0], rc[1], ring.R * u * 0.82, 0, TAU); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = lw * 0.8; g.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.2, q = T(ring.R * 0.55 * Math.cos(a), ring.R * 0.55 * Math.sin(a));
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.arc(q[0], q[1], ring.R * u * 0.09, 0, TAU); g.fill();
    }
  }
  // wheels
  rig.wheels.forEach((w, i) => {
    const c = T(w.x, w.y);
    const pts = gearPoints(w.x, w.y, w.rp, w.N, w.rot, false, w.lobed, w.amt);
    const px = map(pts);
    const col = i === 0 ? P.toyWheel : P.toyWheel2;
    if (P.toyShadow && style !== 'blueprint' && style !== 'neon') {
      g.save(); g.globalAlpha = alpha * 0.2; g.fillStyle = '#000'; g.translate(u * 1.6, u * 2.2); g.beginPath(); polyPath(g, px); g.fill(); g.restore();
    }
    g.beginPath(); polyPath(g, px);
    g.fillStyle = style === 'toy' ? fillFor(col, c, w.rp * u) : fillFor(col, c, w.rp * u);
    g.globalAlpha = alpha * (style === 'toy' ? 0.88 : 1); g.fill(); g.globalAlpha = alpha; outline();
    if (P.toyHoles) {
      for (const s of [0, Math.PI]) for (let j = 1; j <= 5; j++) {
        const dd = w.rp * (0.2 + 0.14 * j), a = w.rot + s + 0.35;
        const q = T(w.x + dd * Math.cos(a), w.y + dd * Math.sin(a));
        g.fillStyle = style === 'blueprint' || style === 'neon' ? 'rgba(223,240,255,0.6)' : 'rgba(5,10,40,0.7)';
        g.beginPath(); g.arc(q[0], q[1], Math.max(1.4, u * (1.0 + w.rp * 0.012)), 0, TAU); g.fill();
      }
    }
    g.beginPath(); g.arc(c[0], c[1], w.rp * u * 0.2, 0, TAU); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = lw; g.stroke();
  });
  // the pen
  const pp = T(rig.pen[0], rig.pen[1]);
  g.save(); g.translate(pp[0], pp[1]); g.rotate(-0.9);
  const pl = Math.max(30, u * 26);
  g.fillStyle = '#222'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-u * 1.2, -pl * 0.22); g.lineTo(u * 1.2, -pl * 0.22); g.closePath(); g.fill();
  g.fillStyle = P.toyPen; g.fillRect(-u * 1.5, -pl, u * 3, pl * 0.78);
  g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(-u * 0.9, -pl * 0.97, u * 0.9, pl * 0.7);
  g.restore();
  g.fillStyle = '#111'; g.beginPath(); g.arc(pp[0], pp[1], Math.max(2, u * 0.9), 0, TAU); g.fill();
  g.restore();
}

/* ------------------------------------------------------------------------------- the scene */

function grow(a, n) {
  if (a.length >= n) return a;
  const b = new Float32Array(Math.max(n, a.length * 2));
  b.set(a);
  return b;
}

const CAP = 400000;

export const spirograph = {
  label: 'Spirograph (toothed wheels draw)', group: 'Spirograph',
  defaults: SPIRO_DEFAULTS,
  controls: [
    ['kind', 'Machine', 's', SPIRO_KINDS],
    ['R', 'Ring teeth R', 'r', 20, 200, 1], ['r', 'Wheel teeth r', 'r', 6, 160, 1], ['d', 'Pen hole distance d', 'r', 0, 120, 0.5],
    ['r2', 'Second wheel teeth (compound)', 'r', 5, 80, 1], ['d2', 'Second pen distance', 'r', 0, 60, 0.5], ['m', 'Second wheel orbit speed', 'r', -12, 12, 1],
    ['lobes', 'Lobes (non-circular)', 'r', 2, 8, 1], ['lobeAmt', 'Lobe depth', 'r', 0, 0.6, 0.01],
    ['fx', 'x(t, ring, wheel, d, k)', 'f', '(ring-wheel)*cos(t) + d*cos(k*t)', ['t', 'ring', 'wheel', 'd', 'k']], ['fy', 'y(t, ring, wheel, d, k)', 'f', '(ring-wheel)*sin(t) - d*sin(k*t)', ['t', 'ring', 'wheel', 'd', 'k']],
    ['dFormula', 'd(t, d, ring, wheel): pen distance over time', 'f', '', ['t', 'd', 'ring', 'wheel']],
    ['turns', 'Turns of the wheel (0 = until it closes)', 'r', 0, 200, 1], ['drawTime', 'Time to draw (s)', 'r', 4, 120, 1], ['ease', 'Pace', 's', EASES],
    ['pens', 'Pens', 'r', 1, 3, 1], ['dStep', 'Distance between pens', 'r', 0.5, 20, 0.5],
    ['ink', 'Ink', 's', INK_STYLES], ['colorBy', 'Colour follows', 's', COLOR_BY], ['hue0', 'Colour offset', 'r', 0, 1, 0.01], ['hueRate', 'Colour cycles over the drawing', 'r', 0, 8, 0.05], ['width', 'Line width', 'r', 0.3, 5, 0.05],
    ['paper', 'Paper', 's', Object.fromEntries(Object.entries(PAPERS).map(([k, v]) => [k, v.label]))], ['frame', 'Frame', 's', FRAMES],
    ['size', 'Size', 'r', 0.3, 1.5, 0.01], ['x', 'Move left / right', 'r', -1.5, 1.5, 0.01], ['y', 'Move up / down', 'r', -1.5, 1.5, 0.01], ['rot', 'Rotate', 'r', -180, 180, 1, '°'],
    ['toyShow', 'The toy (gears)', 's', TOY_SHOW], ['toyOpacity', 'Toy opacity', 'r', 0, 1, 0.01], ['toyFade', 'Fade time (s)', 'r', 0.2, 8, 0.1], ['toyIntro', 'Visible at the start for (s)', 'r', 1, 60, 0.5],
    ['toyStyle', 'Toy look', 's', TOY_STYLES], ['toyHoles', 'Pen holes', 't'], ['toyShadow', 'Shadow', 't'],
    ['toyDetach', 'Move the toy separately', 't'], ['toyDx', 'Toy: left / right', 'r', -1.5, 1.5, 0.01], ['toyDy', 'Toy: up / down', 'r', -1.5, 1.5, 0.01], ['toyScale', 'Toy: size', 'r', 0.2, 2, 0.01], ['toyRot', 'Toy: rotate', 'r', -180, 180, 1, '°'],
    ['sound', 'Sound', 's', { gear: 'Every few teeth', petal: 'A note on every petal', ratio: 'The two gears as an interval', off: 'Silent' }],
    ['every', 'A note every (teeth)', 'r', 1, 48, 1], ['ratioEvery', 'Interval repeats every (s)', 'r', 0.4, 8, 0.1], ['base', 'Lowest note (MIDI)', 'r', 24, 84, 1], ['tuning', 'Tuning', 's', { just: 'Exact ratios', equal: 'Piano keys' }],
  ],

  init(S, P) {
    const m = spiroMachine(P);
    const pens = clamp(Math.round(+P.pens || 1), 1, 3);
    const unit = Math.min(S.W.hw, S.W.hh);
    const rim = Math.max(6, m.R * 0.18);
    const Rout = m.kind === 'epi' ? m.R + 2 * m.r + 4 : m.R + rim;
    const kw = Math.min((0.8 * unit) / m.E, (0.9 * unit) / Rout);
    const sc = (S.sc = { m, pens, kw, th: 0, tau: 0, n: 0, pts: [], tooth: 0, lastR: [0, 0], nextRatio: 0, doneT: null, petal: 0 });
    for (let i = 0; i < pens; i++) sc.pts.push({ x: new Float32Array(4096), y: new Float32Array(4096), t: new Float32Array(4096) });
    this.push(S, 0);
    sc.n = 1;
  },

  dOf(P, i) { return (+P.d || 0) + i * (+P.dStep || 0); },

  push(S, th) {
    const sc = S.sc, P = S.P;
    for (let i = 0; i < sc.pens; i++) {
      const pts = sc.pts[i], j = sc.n;
      pts.x = grow(pts.x, j + 1); pts.y = grow(pts.y, j + 1); pts.t = grow(pts.t, j + 1);
      const [x, y] = sc.m.at(th, this.dOf(P, i));
      pts.x[j] = x; pts.y[j] = y; pts.t[j] = th;
    }
  },

  step(S, P, dt, emit) {
    const sc = S.sc;
    const Th = TAU * sc.m.turns;
    const dtau = dt / Math.max(1, +P.drawTime || 24);
    if (sc.tau >= 1) { if (sc.doneT == null) sc.doneT = S.t; return; }
    const tau = Math.min(1, sc.tau + dtau);
    const thNew = Th * easeOf(P.ease, tau), dTh = thNew - sc.th;
    const sub = clamp(Math.ceil((dTh * sc.m.maxW) / 0.05), 1, 60);
    for (let i = 1; i <= sub && sc.n < CAP; i++) { this.push(S, sc.th + (dTh * i) / sub); sc.n++; }
    sc.th = thNew; sc.tau = tau;
    const [x, y] = sc.m.at(sc.th, this.dOf(P, 0));
    const wx = x * sc.kw, wy = y * sc.kw;
    const ang = Math.atan2(y, x), rr = Math.hypot(x, y);
    if (P.sound === 'gear') {
      const teeth = Math.floor((sc.m.R * sc.th) / TAU / Math.max(1, +P.every || 6));
      while (sc.tooth < teeth) {
        sc.tooth++;
        emit({ type: 'hit', ball: sc.tooth, x: wx, y: wy, angle: ang, pitch: ((sc.tooth * (+P.every || 6)) % sc.m.R) / sc.m.R, vel: 0.9 });
      }
    } else if (P.sound === 'petal') {
      if (sc.lastR[1] > sc.lastR[0] && sc.lastR[1] >= rr) { sc.petal++; emit({ type: 'hit', ball: sc.petal, x: wx, y: wy, angle: ang, pitch: clamp(sc.lastR[1] / sc.m.E, 0, 1), vel: 0.9 }); }
      sc.lastR = [sc.lastR[1], rr];
    } else if (P.sound === 'ratio') {
      while (S.st >= sc.nextRatio) {
        sc.nextRatio += Math.max(0.2, +P.ratioEvery || 1.5);
        const base = +P.base || 48;
        let up = base + 12 * Math.log2(sc.m.R / sc.m.r);
        while (up > base + 36) up -= 12;
        if (P.tuning === 'equal') up = Math.round(up);
        emit({ type: 'hit', ball: 0, x: wx, y: wy, angle: ang, midi: base, vel: 0.9, together: true });
        emit({ type: 'hit', ball: 1, x: wx, y: wy, angle: ang, midi: up, vel: 0.8, together: true });
      }
    }
  },

  draw(S, P, D) {
    const { g } = D;
    const w = g.canvas?.width ?? 1080, h = g.canvas?.height ?? 1920;
    const sc = S.sc;
    const paper = PAPERS[P.paper] || PAPERS.velvet;
    if (P.paper !== 'default') paintPaper(g, P.paper, w, h, D.k);
    if (P.frame && P.frame !== 'none') drawFrame(g, P.frame, D, S, paper.light);
    const ks = sc.kw * (+P.size || 1), rho = ((+P.rot || 0) * Math.PI) / 180, c0 = Math.cos(rho), s0 = Math.sin(rho);
    const px = (x, y) => [D.X((+P.x || 0) + (c0 * x - s0 * y) * ks), D.Y((+P.y || 0) + (s0 * x + c0 * y) * ks)];
    paintSpiroInk(S, P, D, w, h, paper.light, px);
    // the toy: its own opacity, and optionally its own place, size and angle
    const a = toyAlpha(P, S.t, sc);
    const rig = sc.m.rig(sc.th, this.dOf(P, 0));
    let T = px, u = ks * (D.R);
    if (P.toyDetach) {
      const ts = (+P.toyScale || 1), rr = rho + ((+P.toyRot || 0) * Math.PI) / 180, cc = Math.cos(rr), ss = Math.sin(rr);
      T = (x, y) => [D.X((+P.x || 0) + (+P.toyDx || 0) + (cc * x - ss * y) * ks * ts), D.Y((+P.y || 0) + (+P.toyDy || 0) + (ss * x + cc * y) * ks * ts)];
      u = ks * ts * D.R;
    }
    if (sc.m.kind !== 'formula') drawToy(g, T, u, rig, P, a);
    // the pen tip stays visible when the toy is hidden
    if (a < 0.98) {
      const pp = px(rig.pen[0], rig.pen[1]);
      g.save(); g.globalAlpha = 1 - a; g.fillStyle = paper.light ? '#2a1c0c' : '#ffffff'; g.shadowColor = D.pal.glow; g.shadowBlur = 16 * D.k;
      g.beginPath(); g.arc(pp[0], pp[1], 5 * D.k * 1.4, 0, TAU); g.fill(); g.restore();
    }
  },

  stats: (S) => `turn ${(S.sc.th / TAU).toFixed(1)} of ${Math.round(S.sc.m.turns)}`,
  formula: (P) => {
    const f = (v) => +(+v).toFixed(2);
    if (P.kind === 'formula') return `x = ${P.fx},  y = ${P.fy}`;
    if (P.kind === 'compound') return `ring ${f(P.R)} · wheel ${f(P.r)} · wheel ${f(P.r2)}`;
    return `${P.kind === 'epi' ? 'outside' : 'inside'}: R = ${f(P.R)}, r = ${f(P.r)}, d = ${f(P.d)}`;
  },
};

/** Opacity of the toy now, from its show mode and the progress of the drawing. */
export function toyAlpha(P, time, sc) {
  const base = clamp(+P.toyOpacity, 0, 1), f = Math.max(0.05, +P.toyFade || 1.5);
  switch (P.toyShow) {
    case 'off': return 0;
    case 'intro': { const t = time - Math.max(0, +P.toyIntro || 8); return base * clamp(1 - t / f, 0, 1); }
    case 'outro': return base * (sc.doneT == null ? 1 : clamp(1 - (time - sc.doneT) / f, 0, 1));
    case 'inout': return base * clamp(time / f, 0, 1) * (sc.doneT == null ? 1 : clamp(1 - (time - sc.doneT) / f, 0, 1));
    default: return base;
  }
}

function paintSpiroInk(S, P, D, w, h, light, px) {
  const { g, pal, k } = D;
  const sc = S.sc;
  const key = [P.ink, P.colorBy, P.width, P.hue0, P.hueRate, P.size, P.x, P.y, P.rot, light, w, h].join('|');
  let ink = sc.ink;
  if (!ink || sc.inkKey !== key) {
    if (!ink) ink = sc.ink = makeCanvas(w, h);
    ink.width = w; ink.height = h;
    sc.inkKey = key;
    sc.inked = new Array(sc.pens).fill(0);
  }
  const ig = ink.getContext('2d');
  ig.lineCap = 'round'; ig.lineJoin = 'round';
  ig.globalCompositeOperation = light ? 'source-over' : 'lighter';
  const lw = Math.max(0.5, (+P.width || 1.1) * k * 1.6) * (light ? 1.25 : 1);
  const run = 20;
  const Th = TAU * sc.m.turns;
  for (let pen = 0; pen < sc.pens; pen++) {
    const pts = sc.pts[pen];
    let i0 = sc.inked[pen];
    while (i0 < sc.n - 1) {
      const i1 = Math.min(sc.n - 1, i0 + run), mid = (i0 + i1) >> 1;
      const tm = pts.t[mid];
      let len = 0;
      for (let i = i0 + 1; i <= i1; i++) len += Math.hypot(pts.x[i] - pts.x[i - 1], pts.y[i] - pts.y[i - 1]);
      const dth = Math.max(1e-6, pts.t[i1] - pts.t[i0]);
      const vel = clamp(len / dth / (sc.m.E * 1.5), 0, 1);
      let hue = +P.hue0 || 0;
      switch (P.colorBy) {
        case 'turn': hue += Math.floor(tm / TAU) / Math.max(1, sc.m.turns) * (+P.hueRate || 1) + ((tm / TAU) % 1) * 0.06; break;
        case 'speed': hue += 0.65 * (1 - vel); break;
        case 'radius': hue += (Math.hypot(pts.x[mid], pts.y[mid]) / sc.m.E) * (+P.hueRate || 1) * 0.5; break;
        case 'angle': hue += Math.atan2(pts.y[i1] - pts.y[i0], pts.x[i1] - pts.x[i0]) / TAU; break;
        case 'pen': hue += pen / Math.max(1, sc.pens) + (tm / Th) * 0.1; break;
        default: hue += (tm / Th) * (+P.hueRate || 1);
      }
      ig.strokeStyle = pal.line(hue);
      const path = () => {
        ig.beginPath();
        let q = px(pts.x[i0], pts.y[i0]);
        ig.moveTo(q[0], q[1]);
        for (let i = i0 + 1; i <= i1; i++) { q = px(pts.x[i], pts.y[i]); ig.lineTo(q[0], q[1]); }
        ig.stroke();
      };
      switch (P.ink) {
        case 'neon': ig.globalAlpha = light ? 0.1 : 0.13; ig.lineWidth = lw * 4.2; path(); ig.globalAlpha = light ? 0.95 : 0.9; ig.lineWidth = lw; path(); break;
        case 'brush': ig.globalAlpha = light ? 0.85 : 0.6; ig.lineWidth = lw * (0.55 + 2.0 * (1 - vel)); path(); break;
        case 'ink': ig.globalAlpha = light ? 0.95 : 0.7; ig.lineWidth = lw * (light ? 1.05 : 0.8); path(); break;
        default: ig.globalAlpha = light ? 0.6 : 0.34; ig.lineWidth = Math.max(0.6, lw * 0.6); path();
      }
      i0 = i1;
    }
    sc.inked[pen] = Math.max(sc.inked[pen], i0);
  }
  ig.globalAlpha = 1; ig.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.drawImage(ink, 0, 0);
  void pal;
}

/* ===================================================================== guilloche */

export const GUILLOCHE_TYPES = {
  rosette: 'Rosette (banknote)',
  dial: 'Engine-turned dial (watch)',
  ribbon: 'Border ribbon with corner rosettes (certificate)',
  lathe: 'Rose-engine moiré',
  formula: 'My own formula',
};
export const GUILLOCHE_COLORS = { palette: 'Palette (colour changes along the lines)', bands: 'Three inks in bands', mono: 'One ink' };

export const GUILLOCHE_DEFAULTS = {
  type: 'rosette', lines: 42, revealTime: 20, ease: 'steady',
  R: 64, r: 24, d: 14, dStep: 0.1, turnStep: 4.5,
  rings: 90, lobes: 12, amp: 0.012, ampGrow: 0.4, phaseStep: 0.18, innerR: 0.06, harmonic: 5, harmonic2: 0.5, rays: 120,
  strands: 26, waves: 8, bandAmp: 0.045, corners: true, centre: true,
  fR: '0.3 + 0.6*u + 0.04*sin(8*a + k*0.15)',
  colors: 'bands', ink1: '#1f5a8a', ink2: '#2a8a6a', ink3: '#8a2a5a', hue0: 0, hueSpan: 1, width: 0.9, alpha: 0.8,
  paper: 'cream', frame: 'none', size: 1, x: 0, y: 0, rot: 0,
  furniture: 'none', rig: false, rigOpacity: 1,
  sound: 'sweep', base: 48, every: 0.6,
};

/** How many lines (strokes) a guilloche of these settings has. */
export function guillocheLines(P) {
  switch (P.type) {
    case 'ribbon': return 4 * Math.round(+P.strands || 26) + (P.corners ? 4 * 8 : 0) + (P.centre ? 36 : 0);
    case 'dial': case 'lathe': return Math.round(+P.rings || 90);
    default: return Math.round(+P.lines || 42);
  }
}

const rot2 = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

/** Points of one guilloche line: normalized coordinates (−1 … 1 = the drawing circle), or world:true for the ribbon. */
export function guillocheLine(P, k, W, formulaFn) {
  const n = guillocheLines(P), pts = [];
  const type = P.type;
  if (type === 'rosette' || (type === 'ribbon' && k >= 4 * Math.round(+P.strands || 26))) {
    let R = +P.R || 60, r = +P.r || 31, d = (+P.d || 14) + k * (+P.dStep || 0), phase = k * ((+P.turnStep || 0) * Math.PI) / 180, s = 1 / (R - r + d), ox = 0, oy = 0;
    if (type === 'ribbon') {
      const j = k - 4 * Math.round(+P.strands || 26), corner = P.corners ? 32 : 0;
      d = 10 + (j % 8) * 0.5; phase = (j % 8) * 0.15;
      if (j < corner) { // corner rosettes
        const c = Math.floor(j / 8), unit = Math.min(W.hw, W.hh);
        ox = (c % 2 ? 1 : -1) * W.hw * 0.86; oy = (c < 2 ? 1 : -1) * W.hh * 0.9; s = (0.11 * unit) / (R - r + d);
      } else { const unit = Math.min(W.hw, W.hh); s = (0.42 * unit) / (R - r + d); ox = 0; oy = 0; }
      const orbits = r / gcd(R, r), N = 1200;
      for (let i = 0; i <= N; i++) {
        const th = (i / N) * TAU * orbits, kk = (R - r) / r;
        const [x, y] = rot2((R - r) * Math.cos(th) + d * Math.cos(kk * th), (R - r) * Math.sin(th) - d * Math.sin(kk * th), phase);
        pts.push([ox + x * s, oy + y * s]);
      }
      return { pts, world: true };
    }
    const orbits = Math.max(1, Math.round(r / gcd(R, r))), N = 1400, kk = (R - r) / r;
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * TAU * orbits;
      const [x, y] = rot2((R - r) * Math.cos(th) + d * Math.cos(kk * th), (R - r) * Math.sin(th) - d * Math.sin(kk * th), phase);
      pts.push([x * s, y * s]);
    }
    return { pts, world: false };
  }
  if (type === 'dial' || type === 'lathe') {
    const rings = n, u = k / Math.max(1, rings - 1);
    const dial = type === 'dial';
    const inner = +P.innerR || (dial ? 0.06 : 0.07);
    const r0 = inner + u * (0.98 - inner);
    const lobes = Math.round(+P.lobes || 12), amp = (+P.amp || 0.012) * (1 + (+P.ampGrow || 0) * (dial ? u : u * 2)), ph = k * (+P.phaseStep || 0.15);
    const h2 = Math.round(+P.harmonic || 5), a2 = amp * (+P.harmonic2 || 0);
    const N = 720;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU;
      const rr = r0 + amp * Math.sin(lobes * a + ph) + (dial ? a2 * Math.sin(h2 * a - ph * 0.5) : 0);
      pts.push([rr * Math.cos(a), rr * Math.sin(a)]);
    }
    return { pts, world: false };
  }
  if (type === 'ribbon') {
    const strands = Math.round(+P.strands || 26);
    const side = Math.floor(k / strands), j = k % strands;
    const hw = W.hw * 0.92, hh = W.hh * 0.92, unit = Math.min(W.hw, W.hh), amp = (+P.bandAmp || 0.045) * unit * 1.3, waves = Math.round(+P.waves || 8);
    const width = unit * 0.2, off = (j / (strands - 1) - 0.5) * width * 0.28;
    const N = 500, horizontal = side < 2, len = horizontal ? hw : hh, edge = horizontal ? (side === 0 ? hh : -hh) : (side === 2 ? -hw : hw);
    const inward = horizontal ? (side === 0 ? -1 : 1) : (side === 2 ? 1 : -1);
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * 2 - 1, sw = amp * Math.sin(waves * Math.PI * (t + 1) + (j / strands) * TAU * 1.0);
      const along = t * len, across = edge + inward * (width * 0.5 + off + sw);
      pts.push(horizontal ? [along, across] : [across, along]);
    }
    return { pts, world: true };
  }
  // formula: polar rings r(a, k, n, u)
  const N = 720, u = k / Math.max(1, n - 1);
  const sc = { a: 0, k, n, u };
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * TAU; sc.a = a;
    const rr = formulaFn ? formulaFn(sc) : 0.5;
    const v = Number.isFinite(rr) ? clamp(rr, -1.4, 1.4) : 0;
    pts.push([v * Math.cos(a), v * Math.sin(a)]);
  }
  return { pts, world: false };
}

export const guilloche = {
  label: 'Guilloche (engine-turned patterns)', group: 'Spirograph',
  defaults: GUILLOCHE_DEFAULTS,
  controls: [
    ['type', 'Pattern', 's', GUILLOCHE_TYPES],
    ['lines', 'Lines', 'r', 6, 160, 1], ['revealTime', 'Time to draw (s)', 'r', 3, 90, 1], ['ease', 'Pace', 's', EASES],
    ['R', 'Rosette: ring teeth R', 'r', 20, 200, 1], ['r', 'Rosette: wheel teeth r', 'r', 6, 160, 1], ['d', 'Rosette: pen distance d', 'r', 0, 100, 0.5], ['dStep', 'Rosette: d grows per line', 'r', -1, 1, 0.01], ['turnStep', 'Rosette: turn per line', 'r', 0, 30, 0.1, '°'],
    ['rings', 'Rings', 'r', 20, 220, 1], ['lobes', 'Waves around each ring', 'r', 2, 40, 1], ['amp', 'Wave size', 'r', 0, 0.06, 0.001], ['ampGrow', 'Waves grow outward', 'r', 0, 3, 0.05], ['phaseStep', 'Shift per ring', 'r', 0, 1, 0.005], ['innerR', 'Inner radius', 'r', 0, 0.4, 0.005], ['harmonic', 'Second wave count', 'r', 2, 24, 1], ['harmonic2', 'Second wave size', 'r', 0, 2, 0.05], ['rays', 'Sunburst rays', 'r', 0, 240, 1],
    ['strands', 'Ribbon strands', 'r', 6, 50, 1], ['waves', 'Ribbon waves', 'r', 2, 24, 1], ['bandAmp', 'Ribbon wave size', 'r', 0.005, 0.12, 0.001], ['corners', 'Corner rosettes', 't'], ['centre', 'Centre rosette', 't'],
    ['fR', 'r(a, k, n, u)', 'f', '0.3 + 0.6*u + 0.04*sin(8*a + k*0.15)', ['a', 'k', 'n', 'u']],
    ['colors', 'Colours', 's', GUILLOCHE_COLORS], ['ink1', 'Ink 1', 'x', '#1f5a8a'], ['ink2', 'Ink 2', 'x', '#2a8a6a'], ['ink3', 'Ink 3', 'x', '#8a2a5a'], ['hue0', 'Colour offset', 'r', 0, 1, 0.01], ['hueSpan', 'Colour range', 'r', 0, 3, 0.05], ['width', 'Line width', 'r', 0.3, 4, 0.05], ['alpha', 'Line strength', 'r', 0.1, 1, 0.01],
    ['paper', 'Paper', 's', Object.fromEntries(Object.entries(PAPERS).map(([k, v]) => [k, v.label]))], ['frame', 'Frame', 's', FRAMES],
    ['size', 'Size', 'r', 0.3, 1.5, 0.01], ['x', 'Move left / right', 'r', -1.5, 1.5, 0.01], ['y', 'Move up / down', 'r', -1.5, 1.5, 0.01], ['rot', 'Rotate', 'r', -180, 180, 1, '°'],
    ['furniture', 'Dial furniture', 's', { none: 'None', ticks: 'Bezel and hour marks', hands: 'Bezel, marks and hands' }],
    ['sound', 'Sound', 's', { sweep: 'A note per line (rising)', off: 'Silent' }], ['base', 'Lowest note (MIDI)', 'r', 24, 84, 1], ['every', 'Note every (lines)', 'r', 1, 20, 1],
  ],

  init(S, P) {
    const c = String(P.fR || '').trim() ? tryCompile(String(P.fR), ['a', 'k', 'n', 'u']) : null;
    S.sc = { fn: c?.ok ? c.fn : null, count: guillocheLines(P), drawn: 0, lastNote: -1, ink: null };
  },
  step(S, P, dt, emit) {
    const sc = S.sc;
    const tau = clamp(S.st / Math.max(1, +P.revealTime || 20), 0, 1);
    sc.pos = easeOf(P.ease, tau) * sc.count;
    if (P.sound === 'sweep') {
      const every = Math.max(1, Math.round(+P.every || 1));
      while (sc.lastNote + every <= Math.floor(sc.pos) && sc.lastNote + every < sc.count) {
        sc.lastNote += every;
        emit({ type: 'hit', ball: sc.lastNote, x: 0, y: 0, angle: (sc.lastNote / sc.count) * TAU, pitch: sc.lastNote / sc.count, vel: 0.8 });
      }
    }
  },
  draw(S, P, D) {
    const { g, pal, k } = D;
    const w = g.canvas?.width ?? 1080, h = g.canvas?.height ?? 1920;
    const sc = S.sc;
    const paper = PAPERS[P.paper] || PAPERS.cream;
    if (P.paper !== 'default') paintPaper(g, P.paper, w, h, k);
    if (P.frame && P.frame !== 'none') drawFrame(g, P.frame, D, S, paper.light);
    const unit = Math.min(S.W.hw, S.W.hh);
    const ks = unit * 0.94 * (+P.size || 1), rho = ((+P.rot || 0) * Math.PI) / 180, c0 = Math.cos(rho), s0 = Math.sin(rho);
    const key = [P.type, P.lines, P.R, P.r, P.d, P.dStep, P.turnStep, P.rings, P.lobes, P.amp, P.ampGrow, P.phaseStep, P.innerR, P.harmonic, P.harmonic2, P.strands, P.waves, P.bandAmp, P.corners, P.centre, P.fR, P.colors, P.ink1, P.ink2, P.ink3, P.hue0, P.hueSpan, P.width, P.alpha, P.size, P.x, P.y, P.rot, w, h, paper.light].join('|');
    if (!sc.ink || sc.key !== key) {
      if (!sc.ink) sc.ink = makeCanvas(w, h);
      sc.ink.width = w; sc.ink.height = h; sc.key = key; sc.drawn = 0;
      const c = String(P.fR || '').trim() ? tryCompile(String(P.fR), ['a', 'k', 'n', 'u']) : null;
      sc.fn = c?.ok ? c.fn : null; sc.count = guillocheLines(P);
    }
    const ig = sc.ink.getContext('2d');
    const colorOf = (kk) => {
      const u = kk / Math.max(1, sc.count - 1);
      if (P.colors === 'mono') return P.ink1;
      if (P.colors === 'bands') return [P.ink1, P.ink2, P.ink3][Math.min(2, Math.floor(u * 3))];
      return pal.line((+P.hue0 || 0) + u * (+P.hueSpan || 1));
    };
    const toPx = (line, pt) => (line.world ? [D.X((+P.x || 0) + pt[0]), D.Y((+P.y || 0) + pt[1])] : [D.X((+P.x || 0) + (c0 * pt[0] - s0 * pt[1]) * ks), D.Y((+P.y || 0) + (s0 * pt[0] + c0 * pt[1]) * ks)]);
    const strokeLine = (c, line, upto, alpha) => {
      const n = Math.max(2, Math.floor(line.pts.length * upto));
      c.beginPath();
      for (let i = 0; i < n; i++) { const q = toPx(line, line.pts[i]); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }
      c.globalAlpha = alpha; c.stroke();
    };
    ig.lineCap = 'round'; ig.lineJoin = 'round'; ig.lineWidth = Math.max(0.5, (+P.width || 0.9) * k * 1.6);
    ig.globalCompositeOperation = paper.light ? 'source-over' : 'lighter';
    const whole = Math.min(sc.count, Math.floor(sc.pos ?? 0));
    for (; sc.drawn < whole; sc.drawn++) { ig.strokeStyle = colorOf(sc.drawn); strokeLine(ig, guillocheLine(P, sc.drawn, S.W, sc.fn), 1, +P.alpha || 0.8); }
    ig.globalAlpha = 1; ig.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.drawImage(sc.ink, 0, 0);
    // the line being drawn right now
    if (whole < sc.count) {
      const part = (sc.pos ?? 0) - whole;
      g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = Math.max(0.5, (+P.width || 0.9) * k * 1.6) * 1.5; g.strokeStyle = colorOf(whole);
      strokeLine(g, guillocheLine(P, whole, S.W, sc.fn), clamp(part, 0.02, 1), 1);
      g.restore();
    }
    if (P.type === 'dial' && P.furniture && P.furniture !== 'none') dialFurniture(g, D, P, ks, +P.x || 0, +P.y || 0, sc.drawn >= sc.count - 1, paper.light);
    if (P.type === 'dial' && +P.rays > 0 && sc.drawn >= 1) rays(g, D, P, ks, paper.light);
  },
  stats: (S) => `line ${Math.min(S.sc.count, Math.floor(S.sc.pos ?? 0))} of ${S.sc.count}`,
  formula: (P) => ({ rosette: `rosette ${P.R} : ${P.r}`, dial: `${P.rings} rings, ${P.lobes} waves`, ribbon: `${P.strands} strands, ${P.waves} waves`, lathe: `${P.rings} rings, ${P.lobes} lobes`, formula: `r = ${P.fR}` }[P.type] || ''),
};

function rays(g, D, P, ks, light) {
  const n = Math.round(+P.rays);
  g.save(); g.globalCompositeOperation = light ? 'source-over' : 'lighter';
  const cx = D.X(+P.x || 0), cy = D.Y(+P.y || 0);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    g.strokeStyle = light ? `rgba(40,30,20,${0.04 + 0.04 * Math.sin(i * 0.7) ** 2})` : `rgba(255,235,190,${0.04 + 0.05 * Math.sin(i * 0.7) ** 2})`;
    g.lineWidth = Math.max(0.5, D.k * 1.1);
    g.beginPath(); g.moveTo(cx + Math.cos(a) * ks * 0.06 * D.R, cy - Math.sin(a) * ks * 0.06 * D.R); g.lineTo(cx + Math.cos(a) * ks * 0.97 * D.R, cy - Math.sin(a) * ks * 0.97 * D.R); g.stroke();
  }
  g.restore();
}

function dialFurniture(g, D, P, ks, ox, oy, done, light) {
  const cx = D.X(ox), cy = D.Y(oy), R = ks * D.R, k = D.k;
  g.save();
  g.strokeStyle = light ? '#7a5a1a' : '#caa24a'; g.lineWidth = Math.max(2, 5 * k * 1.4);
  g.beginPath(); g.arc(cx, cy, R * 1.02, 0, TAU); g.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU - Math.PI / 2;
    g.strokeStyle = light ? '#7a5a1a' : '#e8c868'; g.lineWidth = Math.max(2, (i % 3 ? 5 : 10) * k * 1.4);
    g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9); g.lineTo(cx + Math.cos(a) * R * 0.98, cy + Math.sin(a) * R * 0.98); g.stroke();
  }
  if (P.furniture === 'hands' && done) {
    g.lineCap = 'round'; g.strokeStyle = light ? '#5a3a10' : '#e8c868';
    g.lineWidth = Math.max(3, 7 * k * 1.4); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(-1.1) * R * 0.52, cy + Math.sin(-1.1) * R * 0.52); g.stroke();
    g.lineWidth = Math.max(2, 5 * k * 1.4); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(0.4) * R * 0.75, cy + Math.sin(0.4) * R * 0.75); g.stroke();
    g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(cx, cy, 9 * k * 1.4, 0, TAU); g.fill();
  }
  g.restore();
}

/** Guilloche settings that look good (deterministic per seed). */
export function luckyGuilloche(seed = 1) {
  const R0 = rng(seed * 1597334677 + 3812015801);
  const type = ['rosette', 'rosette', 'dial', 'lathe', 'ribbon'][Math.floor(R0() * 5)];
  const looks = [
    ['cream', 'bands', '#1f5a8a', '#2a8a6a', '#8a2a5a', 'indigo'], ['parchment', 'bands', '#2a5a3a', '#7a2a3a', '#c08a20', 'sepia'], ['velvet', 'palette', '#9ff6ff', '#ffd23d', '#ff6fa8', 'ice'],
    ['ember', 'palette', '#ffd23d', '#ff7a2f', '#fff0dc', 'fire'], ['midnight', 'palette', '#b9a8ff', '#7fe3ff', '#ffd9a8', 'aurora'],
  ];
  const [paper, colors, a, b, c, palette] = looks[Math.floor(R0() * looks.length)];
  const Rr = [60, 72, 84, 96][Math.floor(R0() * 4)], r = [19, 25, 31, 35, 43][Math.floor(R0() * 5)];
  const lab = { type, paper, colors, ink1: a, ink2: b, ink3: c, R: Rr, r, d: 8 + Math.floor(R0() * 12), lines: 30 + Math.floor(R0() * 24), turnStep: +(2 + R0() * 8).toFixed(1), lobes: 6 + Math.floor(R0() * 14), rings: 70 + Math.floor(R0() * 60), phaseStep: +(0.08 + R0() * 0.2).toFixed(3) };
  return { lab, look: { palette, background: PAPERS[paper].bg } };
}
