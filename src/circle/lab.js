/**
 * Ball Lab: one small physics engine that many Circle Lab simulations are built from.
 *
 *   arena      circle, tall box (the whole safe area), square, stadium, any polygon;
 *              it can spin, shrink on every hit and have an escape gap
 *   obstacles  a core in the middle (circle / square / triangle / hexagon), Galton pegs,
 *              a pyramid of triangles, pachinko pins, a peg ring, bin walls
 *   actions    what a hit does: split into N, clone, grow, shrink, recolour, pop, speed up;
 *              separately for walls, the core and ball-ball contacts (infect, clone,
 *              grow, stick)
 *   sources    an emitter that pours balls on the beat (more per beat as it goes, new
 *              colour every few balls), cells that divide every few beats, random
 *              walkers that stick to a growing coral (diffusion-limited aggregation)
 *   escape     balls that leave through the gap fall outside and pile up, and each
 *              escape can spawn new balls inside
 *
 * Deterministic (seeded random, fixed step); no DOM. Every recipe in LAB_SCENES is just a
 * set of these parameters, so new simulations are mostly new combinations.
 */
import { frac, hexA } from './palettes.js';

const TAU = Math.PI * 2;
const wrapPi = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const LAB_DEFAULTS = {
  arena: 'circle', sides: 6, arenaSize: 0.97, spin: 0, shrink: 0, minSize: 0.3, gap: 0, gapAt: 90, gapSpin: 0,
  balls: 1, speed: 1.5, angle: 62, size: 0.035, gravity: 0, bounce: 1, speedGain: 1, maxSpeed: 5, drag: 0, jitter: 0,
  wall: 'bounce', wallN: 2, spread: 30, childScale: 1, minR: 0.008, grow: 0.004, maxR: 0.6,
  core: 0, coreShape: 'circle', coreSpin: 0, coreY: 0, coreAction: 'split', coreN: 3,
  pegs: 'none', rows: 10, pegSize: 0.018, pegBounce: 0.5, pegJitter: 6, bins: false, funnel: false,
  collide: false, ballAction: 'bounce', ballBounce: 0.9, teams: 0, ballSound: true,
  emit: 0, emitEvery: 0.5, emitRamp: 0, emitX: 0, emitSpread: 0.04, emitSpeed: 0.6, emitMax: 300, colorEvery: 30, emitSound: true,
  escape: 'none', escapeN: 2, outGravity: 3,
  divide: 0, walkers: 0, seed: 'center',
  max: 400, ink: false, wallSound: true, ballStyle: 'glow',
};

/* --------------------------------------------------------------- geometry */

function polyShape(verts) {
  const n = verts.length;
  const edges = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = verts[i], [x2, y2] = verts[(i + 1) % n];
    const ex = x2 - x, ey = y2 - y, L = Math.hypot(ex, ey) || 1;
    edges.push({ x, y, x2, y2, nx: -ey / L, ny: ex / L }); // inward normal of a CCW polygon
  }
  return { kind: 'poly', v: verts, edges };
}

function regular(n, rad, rot, cx = 0, cy = 0) {
  const v = [];
  for (let i = 0; i < n; i++) { const a = rot + Math.PI / 2 + (i * TAU) / n; v.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]); }
  return v;
}

function rotVerts(v, rot, cx = 0, cy = 0) {
  if (!rot) return v.map(([x, y]) => [x + cx, y + cy]);
  const c = Math.cos(rot), s = Math.sin(rot);
  return v.map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}

/** The arena right now (it may spin and shrink). */
function arenaNow(S, P) {
  const { hw, hh } = S.W;
  const s = S.lab.scale * (P.arenaSize ?? 1);
  const rot = (P.spin || 0) * S.st;
  const m = Math.min(hw, hh) * s;
  let A;
  switch (P.arena) {
    case 'box': A = polyShape(rotVerts([[-hw * s, -hh * s], [hw * s, -hh * s], [hw * s, hh * s], [-hw * s, hh * s]], rot)); break;
    case 'square': A = polyShape(rotVerts([[-m, -m], [m, -m], [m, m], [-m, m]], rot)); break;
    case 'stadium': { const r = hw * s, a = Math.max(0, hh - hw) * s; A = { kind: 'stadium', r, a }; break; }
    case 'poly': A = polyShape(regular(Math.max(3, P.sides | 0), m, rot)); break;
    case 'tri': A = polyShape(regular(3, Math.min(hw * 1.15, hh * 0.98) * s * 1.0, rot)); break;
    default: A = { kind: 'circle', r: m };
  }
  A.rot = rot;
  A.omega = P.spin || 0;
  return A;
}

function arenaTop(A) {
  if (A.kind === 'circle') return A.r;
  if (A.kind === 'stadium') return A.a + A.r;
  return Math.max(...A.v.map((p) => p[1]));
}

/** Ball (inside) touching the arena wall? → inward normal and depth. */
function insideContact(px, py, r, A) {
  if (A.kind === 'circle') {
    const d = Math.hypot(px, py), pen = d + r - A.r;
    if (pen <= 0) return null;
    return d > 1e-9 ? { nx: -px / d, ny: -py / d, pen } : { nx: 0, ny: 1, pen };
  }
  if (A.kind === 'stadium') {
    const qy = clamp(py, -A.a, A.a), dx = px, dy = py - qy, d = Math.hypot(dx, dy), pen = d + r - A.r;
    if (pen <= 0) return null;
    return d > 1e-9 ? { nx: -dx / d, ny: -dy / d, pen } : { nx: 1, ny: 0, pen };
  }
  let best = null, bd = Infinity;
  for (const e of A.edges) {
    const sd = (px - e.x) * e.nx + (py - e.y) * e.ny;
    if (sd < bd) { bd = sd; best = e; }
  }
  const pen = r - bd;
  return pen > 0 ? { nx: best.nx, ny: best.ny, pen } : null;
}

function closestOnSeg(px, py, x1, y1, x2, y2) {
  const ex = x2 - x1, ey = y2 - y1, L2 = ex * ex + ey * ey || 1;
  const k = clamp(((px - x1) * ex + (py - y1) * ey) / L2, 0, 1);
  return [x1 + ex * k, y1 + ey * k];
}

/** Ball outside a solid shape touching it? → outward normal and depth. */
function outsideContact(px, py, r, O) {
  if (O.kind === 'circle') {
    const dx = px - (O.x || 0), dy = py - (O.y || 0), d = Math.hypot(dx, dy), pen = O.r + r - d;
    if (pen <= 0) return null;
    return d > 1e-9 ? { nx: dx / d, ny: dy / d, pen } : { nx: 0, ny: 1, pen };
  }
  if (O.kind === 'seg' || O.kind === 'stadium') {
    const [qx, qy] = O.kind === 'seg' ? closestOnSeg(px, py, O.x1, O.y1, O.x2, O.y2) : [0, clamp(py, -O.a, O.a)];
    const w = O.kind === 'seg' ? O.w : O.r;
    const dx = px - qx, dy = py - qy, d = Math.hypot(dx, dy), pen = w + r - d;
    if (pen <= 0) return null;
    return d > 1e-9 ? { nx: dx / d, ny: dy / d, pen } : { nx: 0, ny: 1, pen };
  }
  // convex polygon (CCW): outward normal = −inward
  let smax = -Infinity, se = null;
  for (const e of O.edges) {
    const s = -((px - e.x) * e.nx + (py - e.y) * e.ny);
    if (s > smax) { smax = s; se = e; }
  }
  if (smax < 0) return { nx: -se.nx, ny: -se.ny, pen: r - smax };
  let bd = Infinity, bq = null;
  for (const e of O.edges) {
    const q = closestOnSeg(px, py, e.x, e.y, e.x2, e.y2);
    const d = Math.hypot(px - q[0], py - q[1]);
    if (d < bd) { bd = d; bq = q; }
  }
  if (bd >= r) return null;
  return bd > 1e-9 ? { nx: (px - bq[0]) / bd, ny: (py - bq[1]) / bd, pen: r - bd } : { nx: 0, ny: 1, pen: r };
}

/** Reflect the ball's velocity off a surface moving at (wx, wy). Returns the impact speed. */
function reflect(b, nx, ny, e, wx = 0, wy = 0) {
  let rx = b.vx - wx, ry = b.vy - wy;
  const vn = rx * nx + ry * ny;
  if (vn >= 0) return 0;
  rx -= (1 + e) * vn * nx; ry -= (1 + e) * vn * ny;
  b.vx = rx + wx; b.vy = ry + wy;
  return -vn;
}

const rot2 = (vx, vy, a) => [vx * Math.cos(a) - vy * Math.sin(a), vx * Math.sin(a) + vy * Math.cos(a)];

/* --------------------------------------------------------- static layouts */

function buildObstacles(S, P) {
  const { hw, hh } = S.W;
  const obs = [];
  const peg = (x, y, r, row) => obs.push({ kind: 'circle', x, y, r, row, hitT: -9 });
  const R = Math.max(2, P.rows | 0);
  if (P.pegs === 'galton') {
    const dx = (2 * hw * 0.92) / (R + 1);
    const top = hh * 0.6, dy = dx * 0.92;
    for (let i = 0; i < R; i++) for (let j = 0; j <= i + 2; j++) peg((j - (i + 2) / 2) * dx, top - i * dy, P.pegSize, i);
    S.lab.binTop = top - R * dy + dy * 0.2;
    if (P.bins) {
      for (let j = 0; j <= R + 3; j++) {
        const x = (j - (R + 3) / 2) * dx;
        if (Math.abs(x) < hw * 0.99) obs.push({ kind: 'seg', x1: x, y1: S.lab.binTop - dy * 0.8, x2: x, y2: -hh * 2, w: 0.006, wall: true, hitT: -9 });
      }
    }
  } else if (P.pegs === 'triangles') {
    const side = (2 * hw * 0.9) / (R * 1.7 + 0.3);
    const ht = side * 0.866, dx = side * 1.7, dy = ht * 1.9;
    const top = hh * 0.62;
    for (let i = 0; i < R; i++) {
      for (let j = 0; j <= i; j++) {
        const cx = (j - i / 2) * dx, cy = top - i * dy;
        const t = polyShape([[cx - side / 2, cy - ht / 3], [cx + side / 2, cy - ht / 3], [cx, cy + (2 * ht) / 3]]);
        Object.assign(t, { x: cx, y: cy, row: i, hitT: -9, tri: true, bb: side });
        obs.push(t);
      }
    }
  } else if (P.pegs === 'grid') {
    const dx = (2 * hw * 0.9) / (R - 1 + 0.5), dy = dx * 0.87;
    for (let i = 0, y = hh * 0.7; y > -hh * 0.75; i++, y -= dy) {
      for (let j = 0; j < R; j++) { const x = (j - (R - 1) / 2) * dx + (i % 2 ? dx / 2 : 0); if (Math.abs(x) < hw * 0.92) peg(x, y, P.pegSize, i); }
    }
  } else if (P.pegs === 'ring') {
    for (let i = 0; i < R * 2; i++) { const a = (i / (R * 2)) * TAU; peg(Math.cos(a) * 0.62, Math.sin(a) * 0.62, P.pegSize * 1.6, i); }
  }
  if (P.funnel) {
    const y = hh * 0.95, w = hw * 0.9;
    obs.push({ kind: 'seg', x1: -w, y1: y, x2: -0.07, y2: y - 0.28, w: 0.008, wall: true, hitT: -9 });
    obs.push({ kind: 'seg', x1: w, y1: y, x2: 0.07, y2: y - 0.28, w: 0.008, wall: true, hitT: -9 });
  }
  // static grid for fast lookups
  const cs = 0.12, gx0 = -hw - 0.5, gy0 = -hh - 0.5;
  const nx = Math.ceil((2 * hw + 1) / cs), ny = Math.ceil((2 * hh + 1) / cs);
  const cells = Array.from({ length: nx * ny }, () => []);
  obs.forEach((o, idx) => {
    let x0, x1, y0, y1;
    if (o.kind === 'circle') { x0 = o.x - o.r; x1 = o.x + o.r; y0 = o.y - o.r; y1 = o.y + o.r; }
    else if (o.kind === 'seg') { x0 = Math.min(o.x1, o.x2) - o.w; x1 = Math.max(o.x1, o.x2) + o.w; y0 = Math.min(o.y1, o.y2) - o.w; y1 = Math.max(o.y1, o.y2) + o.w; }
    else { const xs = o.v.map((p) => p[0]), ys = o.v.map((p) => p[1]); x0 = Math.min(...xs); x1 = Math.max(...xs); y0 = Math.min(...ys); y1 = Math.max(...ys); }
    const pad = 0.1;
    for (let i = Math.max(0, Math.floor((x0 - pad - gx0) / cs)); i <= Math.min(nx - 1, Math.floor((x1 + pad - gx0) / cs)); i++) {
      for (let j = Math.max(0, Math.floor((y0 - pad - gy0) / cs)); j <= Math.min(ny - 1, Math.floor((y1 + pad - gy0) / cs)); j++) cells[j * nx + i].push(idx);
    }
  });
  S.lab.obs = obs;
  S.lab.og = { cs, gx0, gy0, nx, ny, cells };
}

function coreNow(S, P) {
  if (!(P.core > 0)) return null;
  const rot = (P.coreSpin || 0) * S.st, r = P.core * (1 + 0.06 * Math.max(0, 1 - (S.t - S.lab.coreHit) / 0.15)), y = P.coreY || 0;
  let O;
  if (P.coreShape === 'square') O = polyShape(rotVerts([[-r, -r], [r, -r], [r, r], [-r, r]], rot, 0, y));
  else if (P.coreShape === 'tri') O = polyShape(regular(3, r * 1.4, rot, 0, y));
  else if (P.coreShape === 'hex') O = polyShape(regular(6, r * 1.1, rot, 0, y));
  else O = { kind: 'circle', x: 0, y, r };
  O.rot = rot; O.y0 = y;
  return O;
}

/* ------------------------------------------------------------------ init */

function newBall(S, P, x, y, vx, vy, r, hue, extra) {
  const b = { id: S.lab.nextId++, i: 0, x, y, vx, vy, r, hue, gen: 0, team: 0, out: 0, born: S.t, lx: x, ly: y, lt: S.t, rot: S.rand() * TAU, ...extra };
  b.i = b.id;
  b.ink = !!P.ink && b.id < 40;
  return b;
}

export function labInit(S, P) {
  S.lab = { scale: 1, nextId: 0, coreHit: -9, emitted: 0, nextEmit: 0, nextDivide: 0, stuck: 0, filled: false, layer: 0, divisions: 0, splits: 0, escapes: 0, flash: [] };
  buildObstacles(S, P);
  const n = Math.max(0, Math.min(400, P.balls | 0));
  const A = arenaNow(S, P);
  for (let i = 0; i < n; i++) {
    const a = ((P.angle ?? 60) * Math.PI) / 180 + (TAU * i) / Math.max(1, n);
    let x = 0, y = 0;
    if (n > 1 || P.core > 0 || P.walkers) {
      // spread the starting balls inside the arena (golden spiral), away from the core
      const rr = Math.min(0.85, Math.max(P.core > 0 ? P.core + 0.15 : 0, 0.18 + 0.55 * Math.sqrt((i + 0.5) / n)));
      const ga = i * 2.39996 + 0.7;
      x = Math.cos(ga) * rr * Math.min(1, S.W.hw); y = Math.sin(ga) * rr * Math.min(1, S.W.hh);
      if (P.arena === 'box') y *= S.W.hh;
    } else if (P.gravity) { y = Math.min(0.4, arenaTop(A) * 0.4); }
    // with a core, aim near it: in a circle a straight path keeps its distance from the centre forever
    const dir = P.core > 0 ? Math.atan2((P.coreY || 0) - y, -x) + 0.12 + (a - (P.angle * Math.PI) / 180) : a;
    const b = newBall(S, P, x, y, Math.cos(dir) * P.speed, Math.sin(dir) * P.speed, P.size, P.teams ? (i % P.teams) / P.teams : i / Math.max(1, n));
    if (P.teams) b.team = i % P.teams;
    S.balls.push(b);
  }
  if (P.walkers) {
    S.balls.length = 0;
    if (P.seed === 'floor') {
      for (let x = -S.W.hw * 0.96; x <= S.W.hw * 0.96; x += P.size * 2) S.balls.push(newBall(S, P, x, -S.W.hh * (P.arenaSize ?? 1) + P.size, 0, 0, P.size, 0, { frozen: true, depth: 0, px: x, py: -S.W.hh * 2 }));
    } else {
      S.balls.push(newBall(S, P, 0, 0, 0, 0, P.size * 1.6, 0, { frozen: true, depth: 0, px: 0, py: 0 }));
    }
  }
  S.lab.wallEvents = 0;
}

/* ------------------------------------------------------------------ step */

function act(S, P, b, action, nx, ny, N, emit, born, where) {
  const total = () => S.balls.length + born.length;
  switch (action) {
    case 'split': case 'clone': {
      const n = action === 'clone' ? 2 : Math.max(2, N | 0);
      if (total() + n - 1 > P.max) { if (!S.lab.filled) { S.lab.filled = true; emit({ type: 'fill', ball: b.i, x: b.x, y: b.y, angle: Math.atan2(b.y, b.x) }); } return; }
      const sp = ((P.spread || 30) * Math.PI) / 180;
      const v0x = b.vx, v0y = b.vy;
      const r = Math.max(P.minR, b.r * (action === 'clone' ? 1 : P.childScale ?? 1));
      for (let k = 0; k < n; k++) {
        const a = n === 1 ? 0 : sp * (k / (n - 1) - 0.5) * (action === 'clone' ? 2 : 1);
        const [vx, vy] = rot2(v0x, v0y, action === 'clone' && k === 0 ? 0 : a);
        if (k === 0) { b.vx = vx; b.vy = vy; b.r = r; b.gen++; b.hue += 0.07; continue; }
        const c = newBall(S, P, b.x + nx * 0.002 * k, b.y + ny * 0.002 * k, vx, vy, r, b.hue + 0.05 * k, { gen: b.gen, team: b.team, out: b.out });
        born.push(c);
      }
      S.lab.splits++;
      emit({ type: 'split', ball: b.i, x: b.x, y: b.y, angle: Math.atan2(b.y, b.x), balls: total(), silent: true });
      if (total() >= P.max && !S.lab.filled) { S.lab.filled = true; emit({ type: 'fill', ball: b.i, x: b.x, y: b.y, angle: Math.atan2(b.y, b.x) }); }
      break;
    }
    case 'grow': b.r = Math.min(P.maxR, b.r + P.grow); break;
    case 'shrink': b.r *= 0.86; if (b.r < 0.006) { b.dead = true; emit({ type: 'split', ball: b.i, x: b.x, y: b.y, silent: true }); } break;
    case 'recolor': b.hue += 0.381966; break;
    case 'remove': b.dead = true; break;
    case 'speed': { const s = Math.hypot(b.vx, b.vy), t = Math.min(P.maxSpeed, s * 1.08); if (s > 0) { b.vx *= t / s; b.vy *= t / s; } break; }
    default:
  }
}

function emitBalls(S, P, A, emit, born) {
  const beat = 60 / S.bpm;
  while (S.st >= S.lab.nextEmit && S.lab.emitted < P.emitMax) {
    const k = Math.round(S.lab.nextEmit / (beat * P.emitEvery));
    const n = Math.max(1, Math.min(P.emitMax - S.lab.emitted, P.emit + (P.emitRamp ? Math.floor(k / P.emitRamp) : 0)));
    const top = arenaTop(A) - P.size * 2.2 - (P.funnel ? 0.05 : 0);
    const layer = Math.floor(S.lab.emitted / Math.max(1, P.colorEvery));
    for (let i = 0; i < n; i++) {
      const x = P.emitX * S.W.hw + (i - (n - 1) / 2) * P.size * 2.3 + (S.rand() - 0.5) * P.emitSpread;
      const b = newBall(S, P, x, top - (i % 2) * P.size, (S.rand() - 0.5) * P.emitSpeed * 0.3, -P.emitSpeed, P.size, layer * 0.125 + S.rand() * 0.03);
      b.layer = layer;
      born.push(b);
      S.lab.emitted++;
    }
    S.lab.layer = layer;
    if (P.emitSound) emit({ type: 'hit', ball: layer, x: P.emitX * S.W.hw, y: top, angle: Math.PI / 2, pitch: frac(k * 0.125 + layer * 0.0625), balls: S.balls.length + born.length });
    S.lab.nextEmit += beat * P.emitEvery;
    if (S.lab.emitted >= P.emitMax) S.lab.fillAt = S.t + 3;
  }
  if (S.lab.fillAt && S.t >= S.lab.fillAt && !S.lab.filled) { S.lab.filled = true; emit({ type: 'fill', ball: 0, x: 0, y: 0, angle: 0 }); }
}

function divideCells(S, P, emit, born) {
  const beat = 60 / S.bpm;
  while (S.st >= S.lab.nextDivide + beat * P.divide) {
    S.lab.nextDivide += beat * P.divide;
    const alive = S.balls.filter((b) => !b.dead);
    if (alive.length * 2 > P.max) { if (!S.lab.filled) { S.lab.filled = true; emit({ type: 'fill', ball: 0, x: 0, y: 0, angle: 0 }); } return; }
    S.lab.divisions++;
    for (const b of alive) {
      const a = S.rand() * TAU, d = b.r * 0.5;
      const r = Math.max(P.minR, b.r * (P.childScale ?? 1));
      const c = newBall(S, P, b.x - Math.cos(a) * d, b.y - Math.sin(a) * d, -Math.cos(a) * 0.4, -Math.sin(a) * 0.4, r, b.hue + 0.09, { gen: b.gen + 1 });
      b.x += Math.cos(a) * d; b.y += Math.sin(a) * d; b.vx = Math.cos(a) * 0.4; b.vy = Math.sin(a) * 0.4; b.r = r; b.gen++; b.hue += 0.09;
      b.divT = c.divT = S.t;
      c.px = b.x; c.py = b.y;
      born.push(c);
    }
    emit({ type: 'hit', ball: S.lab.divisions, x: 0, y: 0, angle: Math.PI / 2, pitch: frac(S.lab.divisions * 0.143), balls: alive.length * 2 });
  }
}

function spawnWalkers(S, P, A, born) {
  const moving = S.balls.filter((b) => !b.frozen && !b.dead).length + born.length;
  if (S.lab.stuck >= P.max) return;
  for (let i = moving; i < P.walkers; i++) {
    let x, y, vx, vy;
    if (P.seed === 'floor') {
      x = (S.rand() - 0.5) * 2 * S.W.hw * 0.9; y = arenaTop(A) - P.size * 2;
      const a = -Math.PI / 2 + (S.rand() - 0.5) * 1.2; vx = Math.cos(a) * P.speed; vy = Math.sin(a) * P.speed;
    } else {
      const a = S.rand() * TAU, rr = Math.min(S.W.hw, S.W.hh) * 0.9;
      x = Math.cos(a) * rr; y = Math.sin(a) * rr;
      const aim = a + Math.PI + (S.rand() - 0.5) * 1.4; vx = Math.cos(aim) * P.speed; vy = Math.sin(aim) * P.speed;
    }
    born.push(newBall(S, P, x, y, vx, vy, P.size, frac(S.lab.stuck * 0.004), { walker: true }));
  }
}

export function labStep(S, P, dt, emit0) {
  const L = S.lab;
  const born = [];
  let budget = 10; // sound/visual events per step (piles touch constantly)
  const emit = (e) => { if (e.type === 'hit' && budget-- <= 0) return; emit0(e); };
  const A = arenaNow(S, P);
  const core = coreNow(S, P);
  if (P.emit > 0) emitBalls(S, P, A, emit, born);
  if (P.divide > 0) divideCells(S, P, emit, born);
  if (P.walkers > 0) spawnWalkers(S, P, A, born);
  const e = P.bounce ?? 1;
  const gapHalf = ((P.gap || 0) * Math.PI) / 360;
  const gapC = ((P.gapAt ?? 90) * Math.PI) / 180 + (P.gapSpin || 0) * S.st + A.rot;
  const minHit = 0.12;
  const { obs, og } = L;
  const world = S.lab.worldBox || (S.lab.worldBox = polyShape([[-S.W.hw, -S.W.hh], [S.W.hw, -S.W.hh], [S.W.hw, S.W.hh], [-S.W.hw, S.W.hh]]));

  for (const b of S.balls) {
    if (b.frozen || b.dead) continue;
    const g = b.out ? P.outGravity : P.gravity;
    b.vy -= g * dt;
    if (P.drag) { const f = Math.max(0, 1 - P.drag * dt); b.vx *= f; b.vy *= f; }
    if (P.jitter) { const [vx, vy] = rot2(b.vx, b.vy, (S.rand() - 0.5) * P.jitter * dt * 8); b.vx = vx; b.vy = vy; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    let hit = false;

    // arena wall (or, once escaped, the outside of it and the frame)
    if (!b.out) {
      const c = insideContact(b.x, b.y, b.r, A);
      if (c) {
        const cxp = b.x - c.nx * (b.r - c.pen), cyp = b.y - c.ny * (b.r - c.pen);
        const ang = Math.atan2(cyp, cxp);
        if (gapHalf > 0 && Math.abs(wrapPi(ang - gapC)) < gapHalf) {
          b.out = 1;
          L.escapes++;
          emit0({ type: 'escape', ball: b.i, x: b.x, y: b.y, angle: ang, balls: S.balls.length + born.length });
          if (P.escape === 'multiply') {
            for (let k = 0; k < P.escapeN && S.balls.length + born.length < P.max; k++) {
              const a = S.rand() * TAU;
              born.push(newBall(S, P, (S.rand() - 0.5) * 0.1, (S.rand() - 0.5) * 0.1, Math.cos(a) * P.speed, Math.sin(a) * P.speed, P.size, b.hue + 0.11 * (k + 1)));
            }
          }
        } else {
          b.x += c.nx * c.pen; b.y += c.ny * c.pen;
          const wx = -A.omega * cyp, wy = A.omega * cxp;
          const vn = reflect(b, c.nx, c.ny, e, wx, wy);
          if (vn > minHit) {
            hit = true;
            if (P.speedGain !== 1) { const s = Math.hypot(b.vx, b.vy), t = Math.min(P.maxSpeed, s * P.speedGain); if (s > 0) { b.vx *= t / s; b.vy *= t / s; } }
            if (P.wallSound) emit({ type: 'hit', ball: b.i, x: cxp, y: cyp, angle: ang, balls: S.balls.length + born.length });
            if (P.shrink) L.scale = Math.max(P.minSize, L.scale * (1 - P.shrink));
            act(S, P, b, P.wall, c.nx, c.ny, P.wallN, emit, born);
          }
        }
      }
    } else {
      if (b.out === 1 && !outsideContact(b.x, b.y, b.r * 1.05, A.kind === 'poly' ? A : { ...A, x: 0, y: 0 })) b.out = 2;
      if (b.out === 2) {
        const c = outsideContact(b.x, b.y, b.r, A.kind === 'poly' ? A : { ...A, x: 0, y: 0 });
        if (c) { b.x += c.nx * c.pen; b.y += c.ny * c.pen; reflect(b, c.nx, c.ny, 0.35); }
      }
      const w = insideContact(b.x, b.y, b.r, world);
      if (w) { b.x += w.nx * w.pen; b.y += w.ny * w.pen; reflect(b, w.nx, w.ny, 0.35); }
    }

    // the core
    if (core && !b.out) {
      const c = outsideContact(b.x, b.y, b.r, core);
      if (c) {
        b.x += c.nx * c.pen; b.y += c.ny * c.pen;
        const wx = -(P.coreSpin || 0) * (b.y - core.y0), wy = (P.coreSpin || 0) * b.x;
        const vn = reflect(b, c.nx, c.ny, e, wx, wy);
        if (vn > minHit) {
          L.coreHit = S.t;
          emit({ type: 'hit', ball: b.i, x: b.x, y: b.y, angle: Math.atan2(b.y - core.y0, b.x), balls: S.balls.length + born.length });
          act(S, P, b, P.coreAction, c.nx, c.ny, P.coreN, emit, born);
          hit = true;
        }
      }
    }

    // pegs, triangles, bin walls
    if (obs.length) {
      const i = Math.floor((b.x - og.gx0) / og.cs), j = Math.floor((b.y - og.gy0) / og.cs);
      if (i >= 0 && j >= 0 && i < og.nx && j < og.ny) {
        for (const idx of og.cells[j * og.nx + i]) {
          const o = obs[idx];
          const c = outsideContact(b.x, b.y, b.r, o);
          if (!c) continue;
          b.x += c.nx * c.pen; b.y += c.ny * c.pen;
          const vn = reflect(b, c.nx, c.ny, o.wall ? 0.3 : P.pegBounce);
          if (P.pegJitter && !o.wall) { const [vx, vy] = rot2(b.vx, b.vy, ((S.rand() - 0.5) * P.pegJitter * Math.PI) / 180); b.vx = vx; b.vy = vy; }
          if (vn > 0.3 && !o.wall) {
            o.hitT = S.t;
            emit({ type: 'hit', ball: o.row ?? 0, x: b.x, y: b.y, angle: Math.atan2(b.y, b.x), pitch: 1 - (o.row ?? 0) / Math.max(1, P.rows), balls: S.balls.length + born.length });
            hit = true;
          }
        }
      }
    }

    if (b.ink && (hit || ((P.gravity || P.spin || P.jitter) && S.t - b.lt >= 1 / 30))) {
      S.addSegment(b.lx, b.ly, b.x, b.y, S.t, b.hue + S.hits * 0.003);
      b.lx = b.x; b.ly = b.y; b.lt = S.t;
    }
  }

  if (P.collide) collideBalls(S, P, emit, born);

  if (born.length) S.balls.push(...born);
  if (S.balls.some((b) => b.dead)) S.balls = S.balls.filter((b) => !b.dead);
}

/* ------------------------------------------------------- ball–ball contacts */

function collideBalls(S, P, emit, born) {
  const balls = S.balls;
  const n = balls.length;
  if (n < 2) return;
  // Uniform grid sized for a typical ball; every ball is filed in each cell its box covers,
  // so a few big shards don't make the cells huge. A stamp array skips repeated pairs.
  const rs = balls.map((b) => b.r).sort((a, b) => a - b);
  const cs = Math.max(0.03, rs[Math.floor(n * 0.9)] * 2.2);
  const x0 = -S.W.hw - 1, y0 = -S.W.hh - 1;
  const nx = Math.ceil((2 * S.W.hw + 2) / cs) + 1, ny = Math.ceil((2 * S.W.hh + 2) / cs) + 1;
  const ix0 = new Int32Array(n), ix1 = new Int32Array(n), iy0 = new Int32Array(n), iy1 = new Int32Array(n);
  const count = new Int32Array(nx * ny + 1);
  for (let i = 0; i < n; i++) {
    const b = balls[i];
    ix0[i] = clamp(Math.floor((b.x - b.r - x0) / cs), 0, nx - 1); ix1[i] = clamp(Math.floor((b.x + b.r - x0) / cs), 0, nx - 1);
    iy0[i] = clamp(Math.floor((b.y - b.r - y0) / cs), 0, ny - 1); iy1[i] = clamp(Math.floor((b.y + b.r - y0) / cs), 0, ny - 1);
    for (let y = iy0[i]; y <= iy1[i]; y++) for (let x = ix0[i]; x <= ix1[i]; x++) count[y * nx + x + 1]++;
  }
  for (let i = 1; i <= nx * ny; i++) count[i] += count[i - 1];
  const order = new Int32Array(count[nx * ny]), fill = count.slice(0, nx * ny);
  for (let i = 0; i < n; i++) for (let y = iy0[i]; y <= iy1[i]; y++) for (let x = ix0[i]; x <= ix1[i]; x++) order[fill[y * nx + x]++] = i;
  const stamp = new Int32Array(n).fill(-1);
  const e = P.ballBounce ?? 0.9;
  const pair = (a, b) => {
    if (b.dead || a.dead || (a.frozen && b.frozen)) return;
    const ddx = b.x - a.x, ddy = b.y - a.y, rr = a.r + b.r;
    const d2 = ddx * ddx + ddy * ddy;
    if (d2 >= rr * rr) return;
    const d = Math.sqrt(d2) || 1e-6, nxn = ddx / d, nyn = ddy / d, pen = rr - d;
    // frozen balls (the coral) make a walker stick instead of pushing it
    if (P.ballAction === 'stick' && (a.frozen || b.frozen)) {
      const w = a.frozen ? b : a, f = a.frozen ? a : b;
      if (w.walker) stick(S, P, w, f, emit);
      return;
    }
    const ia = a.frozen ? 0 : 1 / (a.r * a.r), ib = b.frozen ? 0 : 1 / (b.r * b.r), it = ia + ib;
    a.x -= nxn * pen * (ia / it) * 0.9; a.y -= nyn * pen * (ia / it) * 0.9;
    b.x += nxn * pen * (ib / it) * 0.9; b.y += nyn * pen * (ib / it) * 0.9;
    const vrel = (b.vx - a.vx) * nxn + (b.vy - a.vy) * nyn;
    if (vrel < 0) {
      const J = (-(1 + e) * vrel) / it;
      a.vx -= J * ia * nxn; a.vy -= J * ia * nyn;
      b.vx += J * ib * nxn; b.vy += J * ib * nyn;
    }
    if (-vrel > 0.25) ballHit(S, P, a, b, nxn, nyn, emit, born);
  };
  // only moving balls look for neighbours (frozen coral never needs to)
  for (let i = 0; i < n; i++) {
    if (balls[i].dead || balls[i].frozen) continue;
    for (let y = iy0[i]; y <= iy1[i]; y++) {
      for (let x = ix0[i]; x <= ix1[i]; x++) {
        const c = y * nx + x;
        for (let k = count[c]; k < count[c + 1]; k++) {
          const j = order[k];
          if (j === i || stamp[j] === i || (j < i && !balls[j].frozen)) continue;
          stamp[j] = i;
          pair(balls[i], balls[j]);
        }
      }
    }
  }
}

function stick(S, P, w, f, emit) {
  w.frozen = true; w.walker = false;
  w.vx = w.vy = 0;
  const d = Math.hypot(w.x - f.x, w.y - f.y) || 1;
  w.x = f.x + ((w.x - f.x) / d) * (w.r + f.r); w.y = f.y + ((w.y - f.y) / d) * (w.r + f.r);
  w.px = f.x; w.py = f.y; w.depth = (f.depth || 0) + 1; w.stuckT = S.t;
  w.hue = frac((f.hue || 0) + 0.004);
  S.lab.stuck++;
  const h = P.seed === 'floor' ? (w.y + S.W.hh) / (2 * S.W.hh) : Math.hypot(w.x, w.y) / Math.min(S.W.hw, S.W.hh);
  emit({ type: 'hit', ball: w.depth, x: w.x, y: w.y, angle: Math.atan2(w.y, w.x), pitch: clamp(h, 0, 1), balls: S.lab.stuck });
  if (S.lab.stuck >= P.max && !S.lab.filled) { S.lab.filled = true; emit({ type: 'fill', ball: 0, x: w.x, y: w.y, angle: 0 }); }
}

function ballHit(S, P, a, b, nx, ny, emit, born) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  switch (P.ballAction) {
    case 'infect': {
      if (a.team === b.team) break;
      const fast = Math.hypot(a.vx, a.vy) >= Math.hypot(b.vx, b.vy) ? a : b, slow = fast === a ? b : a;
      slow.team = fast.team; slow.hue = fast.team / P.teams; slow.infT = S.t;
      emit({ type: 'hit', ball: fast.team, x: mx, y: my, angle: Math.atan2(my, mx), balls: S.balls.length });
      const counts = teamCounts(S, P);
      if (!S.lab.filled && counts.some((c) => c === S.balls.length)) { S.lab.filled = true; emit({ type: 'fill', ball: fast.team, x: mx, y: my, angle: 0 }); }
      return;
    }
    case 'clone':
      if (S.balls.length + born.length < P.max) {
        const c = newBall(S, P, mx + ny * 0.002, my - nx * 0.002, -ny * Math.hypot(a.vx, a.vy), nx * Math.hypot(a.vx, a.vy), a.r, a.hue + 0.13);
        born.push(c);
        if (S.balls.length + born.length >= P.max && !S.lab.filled) { S.lab.filled = true; emit({ type: 'fill', ball: 0, x: mx, y: my, angle: 0 }); }
      }
      break;
    case 'grow': a.r = Math.min(P.maxR, a.r + P.grow); b.r = Math.min(P.maxR, b.r + P.grow); break;
    case 'recolor': a.hue += 0.381966; b.hue += 0.381966; break;
    default:
  }
  if (P.ballSound) emit({ type: 'hit', ball: a.i, x: mx, y: my, angle: Math.atan2(my, mx), balls: S.balls.length });
}

function teamCounts(S, P) {
  const c = new Array(P.teams).fill(0);
  for (const b of S.balls) if (!b.dead) c[b.team]++;
  return c;
}

export const TEAM_NAMES = ['red', 'blue', 'green', 'yellow', 'purple', 'cyan'];
const TEAM_COLORS = ['#ff3b5c', '#3b8bff', '#2ee87a', '#ffd23b', '#b45cff', '#2ef0ff'];

export function labStats(S, P, label) {
  if (P.teams) return teamCounts(S, P).map((c, i) => `${TEAM_NAMES[i]} ${c}`).join(' · ');
  if (P.walkers) return `${label || 'stuck'}: ${S.lab.stuck}`;
  if (P.emit > 0 && !P.collide) return `${label || 'balls'}: ${S.lab.emitted}`;
  return `${label || 'balls'}: ${S.balls.length}`;
}

/* ------------------------------------------------------------------ draw */

function outlinePoints(A) {
  const pts = [];
  if (A.kind === 'circle') for (let i = 0; i <= 200; i++) { const a = (i / 200) * TAU; pts.push([Math.cos(a) * A.r, Math.sin(a) * A.r]); }
  else if (A.kind === 'stadium') {
    for (let i = 0; i <= 60; i++) { const a = (i / 60) * Math.PI; pts.push([Math.cos(a) * A.r, A.a + Math.sin(a) * A.r]); }
    for (let i = 0; i <= 60; i++) { const a = Math.PI + (i / 60) * Math.PI; pts.push([Math.cos(a) * A.r, -A.a + Math.sin(a) * A.r]); }
    pts.push(pts[0]);
  } else {
    for (const e of A.edges) for (let i = 0; i < 30; i++) pts.push([e.x + ((e.x2 - e.x) * i) / 30, e.y + ((e.y2 - e.y) * i) / 30]);
    pts.push(pts[0]);
  }
  return pts;
}

function shapePath(g, D, O) {
  g.beginPath();
  if (O.kind === 'circle') g.arc(D.X(O.x || 0), D.Y(O.y || 0), O.r * D.R, 0, TAU);
  else if (O.kind === 'stadium') {
    g.arc(D.X(0), D.Y(O.a), O.r * D.R, Math.PI, 0);
    g.arc(D.X(0), D.Y(-O.a), O.r * D.R, 0, Math.PI);
    g.closePath();
  } else { O.v.forEach(([x, y], i) => (i ? g.lineTo(D.X(x), D.Y(y)) : g.moveTo(D.X(x), D.Y(y)))); g.closePath(); }
}

export function labDraw(S, P, D) {
  const { g, pal, k, look, time } = D;
  const A = arenaNow(S, P);
  const pulse = look.ringPulse ? Math.max(0, 1 - (time - D.lastHit) / 0.22) : 0;

  // arena: faint glass fill + glowing wall (with its gap)
  shapePath(g, D, A);
  const grad = g.createRadialGradient(D.X(0), D.Y(0), 0, D.X(0), D.Y(0), Math.max(S.W.hw, S.W.hh) * D.R);
  grad.addColorStop(0, hexA(pal.glow, 0.07 + 0.05 * pulse));
  grad.addColorStop(1, hexA(pal.glow2 || pal.glow, 0.02));
  g.fillStyle = grad;
  g.fill();
  const gapHalf = ((P.gap || 0) * Math.PI) / 360;
  const gapC = ((P.gapAt ?? 90) * Math.PI) / 180 + (P.gapSpin || 0) * S.st + A.rot;
  const pts = outlinePoints(A);
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = pal.ring;
  g.lineWidth = (look.ringWidth ?? 5) * k * (1 + 0.5 * pulse);
  g.shadowColor = pal.glow; g.shadowBlur = (18 + 18 * pulse) * k * (look.glow ?? 1);
  g.beginPath();
  let pen = false;
  for (const [x, y] of pts) {
    const inGap = gapHalf > 0 && Math.abs(wrapPi(Math.atan2(y, x) - gapC)) < gapHalf;
    if (inGap) { pen = false; continue; }
    if (pen) g.lineTo(D.X(x), D.Y(y)); else { g.moveTo(D.X(x), D.Y(y)); pen = true; }
  }
  g.stroke();
  g.shadowBlur = 0;

  // obstacles
  for (const o of S.lab.obs) {
    const fl = Math.max(0, 1 - (time - o.hitT) / 0.35);
    if (o.kind === 'seg') {
      g.strokeStyle = hexA(pal.ring, 0.7); g.lineWidth = 3 * k;
      g.beginPath(); g.moveTo(D.X(o.x1), D.Y(o.y1)); g.lineTo(D.X(o.x2), D.Y(Math.max(o.y2, -S.W.hh))); g.stroke();
    } else if (o.tri) {
      shapePath(g, D, o);
      g.fillStyle = fl > 0 ? pal.line(o.row * 0.13 + 0.05) : hexA(pal.glow, 0.16);
      g.globalAlpha = 0.35 + 0.6 * fl;
      g.fill();
      g.globalAlpha = 1;
      g.strokeStyle = pal.ring; g.lineWidth = 2.5 * k; g.stroke();
    } else {
      g.fillStyle = fl > 0 ? '#ffffff' : hexA(pal.ring, 0.75);
      g.beginPath(); g.arc(D.X(o.x), D.Y(o.y), o.r * D.R * (1 + 0.6 * fl), 0, TAU); g.fill();
      if (fl > 0) {
        g.globalAlpha = fl * 0.5; g.fillStyle = pal.line(o.row * 0.09);
        g.beginPath(); g.arc(D.X(o.x), D.Y(o.y), o.r * D.R * 3 * (1.4 - fl * 0.4), 0, TAU); g.fill(); g.globalAlpha = 1;
      }
    }
  }

  // core
  const core = coreNow(S, P);
  if (core) {
    const fl = Math.max(0, 1 - (time - S.lab.coreHit) / 0.3);
    shapePath(g, D, core);
    const cg = g.createRadialGradient(D.X(0), D.Y(core.y0), 0, D.X(0), D.Y(core.y0), P.core * D.R * 1.4);
    cg.addColorStop(0, '#ffffff');
    cg.addColorStop(0.35, pal.line(S.lab.splits * 0.02 + 0.1));
    cg.addColorStop(1, hexA(pal.glow, 0.5));
    g.fillStyle = cg;
    g.shadowColor = pal.glow; g.shadowBlur = (25 + 40 * fl) * k;
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = '#ffffff'; g.lineWidth = (2 + 3 * fl) * k; g.stroke();
  }

  // coral links
  if (P.walkers) {
    g.lineCap = 'round';
    for (const b of S.balls) {
      if (!b.frozen || b.px == null || b.depth === 0) continue;
      const age = Math.max(0, 1 - (time - (b.stuckT ?? -9)) / 0.6);
      g.strokeStyle = age > 0 ? '#ffffff' : pal.line(b.hue);
      g.lineWidth = b.r * D.R * (1.1 + age);
      g.beginPath(); g.moveTo(D.X(b.px), D.Y(b.py)); g.lineTo(D.X(b.x), D.Y(b.y)); g.stroke();
    }
  }

  D.underBalls?.();

  // balls
  const many = S.balls.length > 90;
  const style = P.ballStyle;
  for (const b of S.balls) {
    const x = D.X(b.x), y = D.Y(b.y);
    const rad = Math.max(1.5 * k, b.r * D.R * (look.ballSize ?? 1));
    const col = P.teams ? TEAM_COLORS[b.team % TEAM_COLORS.length] : pal.line(b.hue);
    if (P.walkers && b.frozen) { g.fillStyle = col; g.beginPath(); g.arc(x, y, rad * 0.9, 0, TAU); g.fill(); continue; }
    if (P.walkers) { g.fillStyle = hexA(pal.ring, 0.55); g.beginPath(); g.arc(x, y, rad * 0.8, 0, TAU); g.fill(); continue; }
    if (style === 'cell') {
      const div = Math.max(0, 1 - (time - (b.divT ?? -9)) / 0.5);
      g.fillStyle = col; g.globalAlpha = 0.28;
      g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
      g.globalAlpha = 1; g.strokeStyle = col; g.lineWidth = Math.max(1, rad * 0.14);
      g.stroke();
      g.fillStyle = div > 0 ? '#ffffff' : col;
      g.beginPath(); g.arc(x + rad * 0.12, y - rad * 0.1, rad * (0.32 + 0.15 * div), 0, TAU); g.fill();
      continue;
    }
    if (style === 'gem') {
      const n = 3 + (b.gen % 4);
      g.fillStyle = col;
      g.beginPath();
      for (let i = 0; i < n; i++) { const a = b.rot + time * 2 + (i * TAU) / n; const px = x + Math.cos(a) * rad * 1.25, py = y + Math.sin(a) * rad * 1.25; i ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = Math.max(1, rad * 0.15); g.stroke();
      continue;
    }
    if (many) {
      g.fillStyle = col;
      g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
      if (rad > 3 * k) { g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.arc(x - rad * 0.3, y - rad * 0.3, rad * 0.35, 0, TAU); g.fill(); }
      if (P.teams && time - (b.infT ?? -9) < 0.3) { g.strokeStyle = '#fff'; g.lineWidth = 2 * k; g.beginPath(); g.arc(x, y, rad * 1.4, 0, TAU); g.stroke(); }
    } else {
      const gr = g.createRadialGradient(x - rad * 0.3, y - rad * 0.3, rad * 0.1, x, y, rad);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(1, col);
      g.fillStyle = gr;
      g.shadowColor = col; g.shadowBlur = 18 * k * (look.glow ?? 1);
      g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
      g.shadowBlur = 0;
    }
  }
}

/** The arena outline for the view's ring pulse / shatter effects. */
export { arenaNow };
