/**
 * Circle Lab scenes beyond bouncing balls. Each scene is
 *
 *   { label, group, defaults, controls, init(S, P), step(S, P, dt, emit), draw(S, P, D),
 *     stats(S, P), formula(P) }
 *
 * where S is the CircleSim (seeded random S.rand, world S.W = {hw, hh}, real time S.t,
 * simulation time S.st, permanent ink S.addSegment / S.addDot), P the scene's settings,
 * dt a step of simulation time (it follows the speed curve) and emit(event) a sound /
 * spark event. draw() gets D = { g, X, Y, R, k, pal, look, time, lastHit, energy }.
 *
 * The Ball Lab recipes (lab.js) are registered here too, so the UI and presets see one list.
 */
import { LAB_DEFAULTS, labInit, labStep, labDraw, labStats } from './lab.js';
import { frac, hexA } from './palettes.js';
import { drawScissors } from './icons.js';
import { BATTLES } from './battles.js';
import { CYMATICS } from './cymatics.js';
import { WAVES } from './waves.js';
import { FOURIER_DRAW } from './fourier-draw.js';
import { CALCULUS } from './calculus.js';
import { PI_SCENES } from './pi.js';
import { FRACTALS } from './fractals.js';
import { THEORY } from './theory.js';
import { harmonograph } from './harmonograph.js';
import { spirograph, guilloche } from './spirograph.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const easeOutBack = (x) => { x = clamp(x, 0, 1); const c = 1.7; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };

/** How many items an accelerating schedule has produced by time t (rate0 per s, ×accel per s). */
function accelCount(t, rate0, accel) {
  if (t <= 0) return 0;
  if (Math.abs(accel - 1) < 1e-6) return Math.floor(rate0 * t);
  return Math.floor((rate0 * (accel ** t - 1)) / Math.log(accel));
}

function glowDot(g, x, y, r, color, k, blur = 16) {
  g.fillStyle = color;
  g.shadowColor = color; g.shadowBlur = blur * k;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.shadowBlur = 0;
}

/* ================================================================ paper cut */

const paper = {
  label: 'Paper cut: halve, halve, halve…', group: 'Fill the screen',
  defaults: { mode: 'half', cut0: 0.75, decay: 0.93, minCut: 0.035, max: 256, gapSize: 0.014, scissors: true },
  controls: [
    ['mode', 'Cut', 's', { half: 'In half (1 → 2 → 4 …)', quad: 'In four', golden: 'Golden: cut off a square (spiral)', tri: 'Sierpiński: triangle → 3' }],
    ['cut0', 'First cut takes', 'r', 0.1, 2, 0.01, ' s'], ['decay', 'Each cut faster by', 'r', 0.8, 1, 0.005], ['minCut', 'Fastest cut', 'r', 0.01, 0.3, 0.005, ' s'],
    ['max', 'Most pieces', 'r', 8, 1024, 1], ['gapSize', 'Gap between pieces', 'r', 0, 0.05, 0.001], ['scissors', 'Show scissors', 't'],
  ],
  init(S, P) {
    const { hw, hh } = S.W;
    const sc = (S.sc = { pieces: [], queue: [], later: [], cut: null, cuts: 0, falling: [] });
    if (P.mode === 'tri') sc.pieces.push({ tri: [[-hw * 0.96, -hh * 0.94], [hw * 0.96, -hh * 0.94], [0, hh * 0.96]], depth: 0, hue: 0, born: -9 });
    else if (P.mode === 'golden') {
      // a true golden rectangle (1 : φ), as big as fits, so the squares spiral evenly
      const phi = (1 + Math.sqrt(5)) / 2;
      let h = hh * 1.9, w = h / phi;
      if (w > hw * 1.9) { w = hw * 1.9; h = w * phi; }
      sc.pieces.push({ x0: -w / 2, y0: -h / 2, x1: w / 2, y1: h / 2, depth: 0, hue: 0, born: -9, sq: false });
    } else sc.pieces.push({ x0: -hw * 0.95, y0: -hh * 0.95, x1: hw * 0.95, y1: hh * 0.95, depth: 0, hue: 0, born: -9, sq: false });
    sc.queue.push(sc.pieces[0]);
  },
  step(S, P, dt, emit) {
    const sc = S.sc;
    if (!sc.cut && !sc.queue.length && sc.later.length) sc.queue = sc.later.splice(0).sort((a, b) => (b.x1 - b.x0) - (a.x1 - a.x0));
    if (!sc.cut && sc.queue.length && sc.pieces.length < P.max) {
      const piece = sc.queue.shift();
      const dur = Math.max(P.minCut, P.cut0 * P.decay ** sc.cuts);
      sc.cut = { piece, start: S.st, dur, ...cutPlan(piece, P) };
    }
    const c = sc.cut;
    if (c && S.st >= c.start + c.dur) {
      sc.cut = null;
      sc.cuts++;
      const kids = c.kids;
      sc.pieces.splice(sc.pieces.indexOf(c.piece), 1);
      const gap = P.gapSize / 2;
      for (const kid of kids) {
        kid.born = S.t;
        if (kid.drop) { sc.falling.push({ ...kid, t0: S.t, vx: (S.rand() - 0.5) * 0.6, spin: (S.rand() - 0.5) * 4 }); continue; }
        if (!kid.tri) {
          // open a small gap along the new cut only (sides on the parent's edge stay put)
          const p = c.piece;
          if (kid.x0 > p.x0 + 1e-9) kid.x0 += gap;
          if (kid.x1 < p.x1 - 1e-9) kid.x1 -= gap;
          if (kid.y0 > p.y0 + 1e-9) kid.y0 += gap;
          if (kid.y1 < p.y1 - 1e-9) kid.y1 -= gap;
        }
        sc.pieces.push(kid);
        const w = kid.tri ? (kid.depth < 8 ? 1 : 0) : Math.min(kid.x1 - kid.x0, kid.y1 - kid.y0);
        // golden: finish the spiral first, then cut the squares
        if (w > 0.012) (P.mode === 'golden' && kid.sq ? sc.later : sc.queue).push(kid);
      }
      const [mx, my] = c.mid;
      emit({ type: 'hit', ball: c.piece.depth, x: mx, y: my, angle: Math.atan2(my, mx), pitch: clamp(c.piece.depth / 9, 0, 1), balls: sc.pieces.length });
      if ((sc.pieces.length >= P.max || !sc.queue.length) && !sc.done) { sc.done = true; emit({ type: 'fill', ball: 0, x: 0, y: 0, angle: 0 }); }
    }
    sc.falling = sc.falling.filter((f) => S.t - f.t0 < 2.2);
  },
  draw(S, P, D) {
    const { g, pal, k, time } = D;
    const sc = S.sc;
    g.lineJoin = 'round';
    const done = sc.done ? time - (S.sc.doneT ??= time) : -1;
    for (const p of sc.pieces) {
      const age = time - p.born;
      const pop = age < 0.35 ? 0.94 + 0.06 * easeOutBack(age / 0.35) : 1;
      const flash = Math.max(0, 1 - age / 0.4);
      const wave = done > 0 ? 0.5 + 0.5 * Math.sin(done * 4 - (p.tri ? p.tri[0][1] : p.y0) * 3) : 0;
      g.save();
      const [ccx, ccy] = p.tri ? [(p.tri[0][0] + p.tri[1][0] + p.tri[2][0]) / 3, (p.tri[0][1] + p.tri[1][1] + p.tri[2][1]) / 3] : [(p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2];
      g.translate(D.X(ccx), D.Y(ccy)); g.scale(pop, pop); g.translate(-D.X(ccx), -D.Y(ccy));
      g.beginPath();
      if (p.tri) { p.tri.forEach(([x, y], i) => (i ? g.lineTo(D.X(x), D.Y(y)) : g.moveTo(D.X(x), D.Y(y)))); g.closePath(); }
      else g.rect(D.X(p.x0), D.Y(p.y1), (p.x1 - p.x0) * D.R, (p.y1 - p.y0) * D.R);
      g.fillStyle = pal.line(p.hue);
      g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 10 * k; g.shadowOffsetY = 4 * k;
      g.globalAlpha = 0.92;
      g.fill();
      g.shadowBlur = 0; g.shadowOffsetY = 0;
      if (flash > 0 || wave > 0) { g.globalAlpha = Math.max(flash * 0.7, wave * 0.25); g.fillStyle = '#ffffff'; g.fill(); }
      g.globalAlpha = 0.9; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.2 * k; g.stroke();
      g.globalAlpha = 1;
      if (p.arc) {
        const [ax, ay, r, a0] = p.arc;
        g.strokeStyle = '#ffffff'; g.lineWidth = 3.5 * k; g.shadowColor = pal.glow; g.shadowBlur = 14 * k;
        g.beginPath(); g.arc(D.X(ax), D.Y(ay), r * D.R, -a0, -(a0 + Math.PI / 2), true); g.stroke(); g.shadowBlur = 0;
      }
      g.restore();
    }
    for (const f of sc.falling) {
      const t = time - f.t0;
      const dy = -1.6 * t * t, dx = f.vx * t;
      g.save();
      g.globalAlpha = Math.max(0, 1 - t / 2.2);
      const cx = (f.tri[0][0] + f.tri[1][0] + f.tri[2][0]) / 3, cy = (f.tri[0][1] + f.tri[1][1] + f.tri[2][1]) / 3;
      g.translate(D.X(cx + dx), D.Y(cy + dy)); g.rotate(f.spin * t);
      g.beginPath(); f.tri.forEach(([x, y], i) => (i ? g.lineTo((x - cx) * D.R, -(y - cy) * D.R) : g.moveTo((x - cx) * D.R, -(y - cy) * D.R))); g.closePath();
      g.fillStyle = pal.line(f.hue); g.fill();
      g.restore();
    }
    const c = sc.cut;
    if (c) {
      const u = clamp((S.st - c.start) / c.dur, 0, 1);
      for (const [x1, y1, x2, y2] of c.lines) {
        g.setLineDash([6 * k, 6 * k]); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5 * k;
        g.beginPath(); g.moveTo(D.X(x1), D.Y(y1)); g.lineTo(D.X(x2), D.Y(y2)); g.stroke();
        g.setLineDash([]);
        const xs = x1 + (x2 - x1) * u, ys = y1 + (y2 - y1) * u;
        g.strokeStyle = '#ffffff'; g.lineWidth = 2.5 * k; g.shadowColor = pal.glow; g.shadowBlur = 12 * k;
        g.beginPath(); g.moveTo(D.X(x1), D.Y(y1)); g.lineTo(D.X(xs), D.Y(ys)); g.stroke(); g.shadowBlur = 0;
        if (P.scissors) {
          const ang = Math.atan2(-(y2 - y1), x2 - x1);
          const size = clamp(Math.hypot(x2 - x1, y2 - y1) * D.R * 0.4, 48 * k, 130 * k);
          drawScissors(g, D.X(xs), D.Y(ys), ang + Math.PI, size, 0.06 + 0.3 * Math.abs(Math.sin(u * c.dur * 22 + 0.5)), pal.glow);
        }
      }
    }
  },
  stats: (S) => `pieces: ${S.sc.pieces.length}`,
  formula: (P) => ({ half: 'every cut: 1 piece → 2', quad: 'every cut: 1 piece → 4', golden: 'cut off a square, again and again', tri: 'Sierpiński: keep 3 of 4' }[P.mode]),
};

/** How a piece is cut: the cut line(s) and the pieces it makes. */
function cutPlan(p, P) {
  const depth = p.depth + 1;
  const hueOf = (i) => (p.hue || 0) + 0.11 + i * 0.23 + depth * 0.02;
  if (p.tri) {
    const [a, b, c] = p.tri, m = (u, v) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2];
    const ab = m(a, b), bc = m(b, c), ca = m(c, a);
    return {
      lines: [[ab[0], ab[1], bc[0], bc[1]], [bc[0], bc[1], ca[0], ca[1]], [ca[0], ca[1], ab[0], ab[1]]],
      mid: [(ab[0] + bc[0] + ca[0]) / 3, (ab[1] + bc[1] + ca[1]) / 3],
      kids: [
        { tri: [a, ab, ca], depth, hue: hueOf(0) }, { tri: [ab, b, bc], depth, hue: hueOf(1) }, { tri: [ca, bc, c], depth, hue: hueOf(2) },
        { tri: [ab, bc, ca], depth, hue: p.hue, drop: true },
      ],
    };
  }
  const { x0, y0, x1, y1 } = p, w = x1 - x0, h = y1 - y0;
  const base = { depth };
  if (P.mode === 'quad') {
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    return {
      lines: [[x0, my, x1, my], [mx, y1, mx, y0]], mid: [mx, my],
      kids: [[x0, y0, mx, my], [mx, y0, x1, my], [x0, my, mx, y1], [mx, my, x1, y1]].map(([a, b, c, d], i) => ({ ...base, x0: a, y0: b, x1: c, y1: d, hue: hueOf(i) })),
    };
  }
  if (P.mode === 'golden' && !p.sq) {
    // cut a square off one side; the side turns 90° every time, so the squares spiral inwards
    const side = (p.turn ?? 0) % 4;
    const s = Math.min(w, h);
    let sq, rest, line, arc;
    if (side === 0) { sq = [x0, y1 - s, x0 + s, y1]; rest = w > h ? [x0 + s, y0, x1, y1] : [x0, y0, x1, y1 - s]; } // top-left
    else if (side === 1) { sq = [x1 - s, y1 - s, x1, y1]; rest = w > h ? [x0, y0, x1 - s, y1] : [x0, y0, x1, y1 - s]; }
    else if (side === 2) { sq = [x1 - s, y0, x1, y0 + s]; rest = w > h ? [x0, y0, x1 - s, y1] : [x0, y0 + s, x1, y1]; }
    else { sq = [x0, y0, x0 + s, y0 + s]; rest = w > h ? [x0 + s, y0, x1, y1] : [x0, y0 + s, x1, y1]; }
    if (w > h) line = [sq[0] === x0 ? x0 + s : x1 - s, y1, sq[0] === x0 ? x0 + s : x1 - s, y0];
    else line = [x0, sq[1] === y0 ? y0 + s : y1 - s, x1, sq[1] === y0 ? y0 + s : y1 - s];
    // quarter arc inside the square, centred on the corner touching the rest
    const corner = [[sq[2], sq[1], Math.PI / 2], [sq[0], sq[1], 0], [sq[0], sq[3], -Math.PI / 2], [sq[2], sq[3], Math.PI]][side];
    arc = [corner[0], corner[1], s, corner[2]];
    return {
      lines: [line], mid: [(line[0] + line[2]) / 2, (line[1] + line[3]) / 2],
      kids: [
        { ...base, x0: sq[0], y0: sq[1], x1: sq[2], y1: sq[3], hue: hueOf(0), sq: true, arc },
        { ...base, x0: rest[0], y0: rest[1], x1: rest[2], y1: rest[3], hue: hueOf(1), turn: side + 1 },
      ],
    };
  }
  // in half, across the longer side
  if (w >= h) {
    const mx = (x0 + x1) / 2;
    return { lines: [[mx, y1, mx, y0]], mid: [mx, (y0 + y1) / 2], kids: [{ ...base, x0, y0, x1: mx, y1, hue: hueOf(0), sq: p.sq }, { ...base, x0: mx, y0, x1, y1, hue: hueOf(1), sq: p.sq }] };
  }
  const my = (y0 + y1) / 2;
  return { lines: [[x0, my, x1, my]], mid: [(x0 + x1) / 2, my], kids: [{ ...base, x0, y0, x1, y1: my, hue: hueOf(0), sq: p.sq }, { ...base, x0, y0: my, x1, y1, hue: hueOf(1), sq: p.sq }] };
}

/* ==================================================================== radar */

const radar = {
  label: 'Radar sweep: every ping adds a target', group: 'Patterns & rhythm',
  defaults: { blips: 3, sweep: 0.45, action: 'add', max: 256, rings: 5, turn: -25 },
  controls: [
    ['action', 'Every ping', 's', { add: 'Adds a new target (doubles each turn)', grow: 'Grows it; big ones split', turn: 'Pushes it around', remove: 'Removes it (count down)' }],
    ['blips', 'Targets at the start', 'r', 1, 300, 1], ['sweep', 'Sweep speed (turns/s)', 'r', 0.05, 2, 0.01], ['max', 'Most targets', 'r', 10, 600, 1],
    ['turn', 'Push angle', 'r', -90, 90, 1, '°'], ['rings', 'Range rings', 'r', 0, 10, 1],
  ],
  init(S, P) {
    const sc = (S.sc = { blips: [], pings: 0, hist: [] });
    const n = Math.max(1, P.blips | 0);
    for (let i = 0; i < n; i++) sc.blips.push(newBlip(S, (i * 2.39996 + 0.3) % TAU, 0.12 + 0.82 * Math.sqrt((i + 0.5) / n) * (0.55 + 0.45 * S.rand()), i * 0.07, 0));
  },
  step(S, P, dt, emit) {
    const sc = S.sc;
    const th = P.sweep * TAU * S.st;
    const born = [];
    for (const b of sc.blips) {
      const m = Math.floor((th - b.a) / TAU);
      if (m <= b.m) continue;
      b.m = m;
      b.ping = S.t;
      sc.pings++;
      const wa = Math.PI / 2 - b.a, x = Math.cos(wa) * b.r, y = Math.sin(wa) * b.r;
      emit({ type: 'hit', ball: b.id, x, y, angle: wa, pitch: 1 - b.r, balls: sc.blips.length });
      sc.hist.push({ t: S.t, p: 1 - b.r, hue: b.hue });
      if (P.action === 'add' && sc.blips.length + born.length < P.max) born.push(newBlip(S, b.a + 2.39996, 0.1 + frac(b.r + 0.381966) * 0.85, b.hue + 0.09, th));
      else if (P.action === 'turn') { b.a += (P.turn * Math.PI) / 180; b.m = Math.floor((th - b.a) / TAU); }
      else if (P.action === 'remove') { b.hp = (b.hp ?? 1 + Math.floor(S.rand() * 6)) - 1; if (b.hp <= 0) b.dead = S.t; else b.size *= 0.8; }
      else if (P.action === 'grow') {
        b.size *= 1.35;
        if (b.size > 2.2 && sc.blips.length + born.length < P.max) { b.size = 1; born.push(newBlip(S, b.a - 0.15, clamp(b.r + (S.rand() - 0.5) * 0.2, 0.08, 0.95), b.hue + 0.15, th)); }
      }
    }
    if (born.length) sc.blips.push(...born);
    if (P.action === 'remove') {
      sc.gone = (sc.gone || []).concat(sc.blips.filter((b) => b.dead != null)).filter((b) => S.t - b.dead < 1);
      sc.blips = sc.blips.filter((b) => b.dead == null);
      if (!sc.blips.length && !sc.done) { sc.done = true; emit({ type: 'fill', ball: 0, x: 0, y: 0, angle: 0 }); }
    } else if (sc.blips.length >= P.max && !sc.done) { sc.done = true; emit({ type: 'fill', ball: 0, x: 0, y: 0, angle: 0 }); }
    if (sc.hist.length > 400) sc.hist.splice(0, sc.hist.length - 400);
  },
  draw(S, P, D) {
    const { g, pal, k, time } = D;
    const sc = S.sc;
    const cx = D.X(0), cy = D.Y(0), Rp = D.R * 0.97;
    // scope
    const bg = g.createRadialGradient(cx, cy, 0, cx, cy, Rp);
    bg.addColorStop(0, hexA(pal.glow, 0.16)); bg.addColorStop(1, hexA(pal.glow, 0.04));
    g.fillStyle = bg; g.beginPath(); g.arc(cx, cy, Rp, 0, TAU); g.fill();
    g.strokeStyle = hexA(pal.ring, 0.25); g.lineWidth = 1.2 * k;
    for (let i = 1; i <= P.rings; i++) { g.beginPath(); g.arc(cx, cy, (Rp * i) / (P.rings + 1), 0, TAU); g.stroke(); }
    g.beginPath(); g.moveTo(cx - Rp, cy); g.lineTo(cx + Rp, cy); g.moveTo(cx, cy - Rp); g.lineTo(cx, cy + Rp); g.stroke();
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU, l = i % 6 ? 0.025 : 0.06;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * Rp, cy + Math.sin(a) * Rp); g.lineTo(cx + Math.cos(a) * Rp * (1 - l), cy + Math.sin(a) * Rp * (1 - l)); g.stroke();
    }
    g.strokeStyle = pal.ring; g.lineWidth = (D.look.ringWidth ?? 5) * k * 0.8; g.shadowColor = pal.glow; g.shadowBlur = 20 * k;
    g.beginPath(); g.arc(cx, cy, Rp, 0, TAU); g.stroke(); g.shadowBlur = 0;
    // sweep: a fading wedge behind the beam (canvas angles run clockwise)
    const th = P.sweep * TAU * S.st;
    const beam = -Math.PI / 2 + th; // canvas angle
    const wedge = 1.1;
    for (let i = 0; i < 24; i++) {
      const a1 = beam - (wedge * (i + 1)) / 24, a2 = beam - (wedge * i) / 24;
      g.fillStyle = hexA(pal.glow, 0.22 * (1 - i / 24) ** 2);
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, Rp, a1, a2 + 0.002); g.closePath(); g.fill();
    }
    g.strokeStyle = '#ffffff'; g.lineWidth = 2.5 * k; g.shadowColor = pal.glow; g.shadowBlur = 18 * k;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(beam) * Rp, cy + Math.sin(beam) * Rp); g.stroke(); g.shadowBlur = 0;
    // targets: bright when pinged, phosphor afterglow
    for (const b of sc.blips) {
      const wa = Math.PI / 2 - b.a, x = D.X(Math.cos(wa) * b.r), y = D.Y(Math.sin(wa) * b.r);
      const since = time - (b.ping ?? -99);
      const glow = b.ping == null ? 0.25 : 0.25 + 0.75 * Math.exp(-since / 1.4);
      const pop = Math.min(1, (time - b.born) / 0.3);
      const r = (5 + 3 * Math.exp(-since / 0.25)) * k * b.size * pop;
      g.globalAlpha = glow;
      glowDot(g, x, y, r, pal.line(b.hue), k, 14);
      if (since < 0.8) { g.globalAlpha = (1 - since / 0.8) * 0.8; g.strokeStyle = pal.line(b.hue); g.lineWidth = 2 * k; g.beginPath(); g.arc(x, y, r + since * 60 * k, 0, TAU); g.stroke(); }
    }
    for (const b of sc.gone || []) {
      const t = time - b.dead, wa = Math.PI / 2 - b.a, x = D.X(Math.cos(wa) * b.r), y = D.Y(Math.sin(wa) * b.r);
      g.globalAlpha = Math.max(0, 1 - t); g.strokeStyle = '#ffffff'; g.lineWidth = 2 * k;
      g.beginPath(); g.arc(x, y, 6 * k + t * 50 * k, 0, TAU); g.stroke();
    }
    g.globalAlpha = 1;
    // ping history strips above and below the scope
    const strip = (yTop, yBot, flip) => {
      const n = 64, w = (2 * S.W.hw * 0.96) / n;
      const hist = sc.hist.slice(-n);
      hist.forEach((hst, i) => {
        const age = time - hst.t, a = Math.max(0.25, Math.exp(-age / 3));
        const hgt = (yTop - yBot) * (0.15 + 0.85 * hst.p);
        g.globalAlpha = a; g.fillStyle = pal.line(hst.hue);
        const x = -S.W.hw * 0.96 + (i + n - hist.length) * w;
        g.fillRect(D.X(x), flip ? D.Y(yTop) : D.Y(yBot + hgt), w * D.R * 0.7, hgt * D.R);
      });
      g.globalAlpha = 1;
    };
    if (S.W.hh > 1.08) { strip(-1.04, -S.W.hh * 0.98, false); strip(S.W.hh * 0.98, 1.04, true); }
  },
  stats: (S) => `targets: ${S.sc.blips.length}`,
  formula: (P) => ({ add: 'every ping: +1 target', grow: 'every ping: grow, then split', turn: 'every ping: push it around', remove: 'every ping: −1 target' }[P.action]),
};

function newBlip(S, a, r, hue, th) {
  return { id: (S.sc.nextId = (S.sc.nextId || 0) + 1), a: ((a % TAU) + TAU) % TAU, r: clamp(r, 0.06, 0.95), hue, size: 1, born: S.t, m: Math.floor((th - (((a % TAU) + TAU) % TAU)) / TAU) };
}

/* =============================================================== chaos game */

function chaosVerts(S, n) {
  const { hw, hh } = S.W;
  if (n === 3) return [[0, hh * 0.96], [-hw * 0.97, -hh * 0.92], [hw * 0.97, -hh * 0.92]];
  const v = [];
  for (let i = 0; i < n; i++) { const a = Math.PI / 2 + (i * TAU) / n; v.push([Math.cos(a) * hw * 0.96, Math.sin(a) * hh * 0.94]); }
  return v;
}

const chaos = {
  label: 'Chaos game (Sierpiński from random jumps)', group: 'Patterns & rhythm',
  defaults: { corners: 3, ratio: 0.5, rule: 'none', rate0: 2, accel: 1.42, max: 160000, dot: 1.1 },
  controls: [
    ['corners', 'Corners', 'r', 3, 8, 1], ['ratio', 'Jump this far to the corner', 'r', 0.3, 0.75, 0.001],
    ['rule', 'Rule', 's', { none: 'Any corner', norepeat: 'Never the same corner twice', noneighbor: 'Not next to the last one' }],
    ['rate0', 'Dots per second at the start', 'r', 0.5, 20, 0.5], ['accel', 'Speed-up per second', 'r', 1, 1.8, 0.01], ['dot', 'Dot size', 'r', 0.4, 3, 0.1],
  ],
  init(S, P) {
    S.sc = { v: chaosVerts(S, P.corners | 0), x: 0, y: 0, last: -1, count: 0, jumps: [], hitV: [] };
    S.sc.hitV = S.sc.v.map(() => -9);
  },
  step(S, P, dt, emit) {
    const sc = S.sc, n = sc.v.length;
    const want = Math.min(P.max, accelCount(S.st, P.rate0, P.accel));
    let sounds = 0;
    while (sc.count < want) {
      let c;
      for (let tries = 0; tries < 20; tries++) {
        c = Math.floor(S.rand() * n);
        if (P.rule === 'norepeat' && c === sc.last) continue;
        if (P.rule === 'noneighbor' && sc.last >= 0 && (c === (sc.last + 1) % n || c === (sc.last + n - 1) % n)) continue;
        break;
      }
      const [vx, vy] = sc.v[c];
      const px = sc.x, py = sc.y;
      sc.x += (vx - sc.x) * P.ratio; sc.y += (vy - sc.y) * P.ratio;
      sc.last = c; sc.count++;
      sc.hitV[c] = S.t;
      if (sc.count > 3) S.addDot(sc.x, sc.y, P.dot, c / n * 0.62 + frac(sc.count / 40000) * 0.38, 0.9);
      if (sc.count < 60) { sc.jumps.push({ x1: px, y1: py, x2: sc.x, y2: sc.y, t: S.t, c }); if (sc.jumps.length > 8) sc.jumps.shift(); }
      if (sounds++ < 2) emit({ type: 'hit', ball: c, x: sc.x, y: sc.y, angle: Math.atan2(sc.y, sc.x), pitch: c / n, balls: sc.count });
    }
  },
  draw(S, P, D) {
    const { g, pal, k, time } = D;
    const sc = S.sc;
    g.strokeStyle = hexA(pal.ring, 0.25); g.lineWidth = 1.2 * k;
    g.beginPath(); sc.v.forEach(([x, y], i) => (i ? g.lineTo(D.X(x), D.Y(y)) : g.moveTo(D.X(x), D.Y(y)))); g.closePath(); g.stroke();
    for (const j of sc.jumps) {
      const a = Math.max(0, 1 - (time - j.t) / 1.2);
      if (a <= 0) continue;
      g.globalAlpha = a; g.strokeStyle = '#ffffff'; g.lineWidth = 2 * k; g.setLineDash([5 * k, 5 * k]);
      g.beginPath(); g.moveTo(D.X(j.x1), D.Y(j.y1)); g.lineTo(D.X(sc.v[j.c][0]), D.Y(sc.v[j.c][1])); g.stroke();
      g.setLineDash([]);
      glowDot(g, D.X(j.x2), D.Y(j.y2), 5 * k, '#ffffff', k);
    }
    g.globalAlpha = 1;
    sc.v.forEach(([x, y], i) => {
      const fl = Math.max(0, 1 - (time - sc.hitV[i]) / 0.25);
      glowDot(g, D.X(x), D.Y(y), (9 + 6 * fl) * k, pal.line(i / sc.v.length * 0.62), k, 20 + 20 * fl);
    });
    if (sc.count < 5000) glowDot(g, D.X(sc.x), D.Y(sc.y), 6 * k, '#ffffff', k, 20);
  },
  stats: (S) => `dots: ${S.sc.count.toLocaleString('en-US')}`,
  formula: (P) => `jump ${P.ratio === 0.5 ? '½' : P.ratio.toFixed(3)} of the way to a random corner`,
};

/* ============================================================= phyllotaxis */

const phyllo = {
  label: 'Sunflower (golden-angle seeds)', group: 'Patterns & rhythm',
  defaults: { angle: 137.508, spread: 0.033, max: 900, rate0: 3, accel: 1.2, size: 0.024, color: 'spiral', spin: 0.04 },
  controls: [
    ['angle', 'Turn per seed', 'r', 130, 145, 0.001, '°'], ['spread', 'Spacing', 'r', 0.015, 0.08, 0.001], ['size', 'Seed size', 'r', 0.008, 0.06, 0.001],
    ['rate0', 'Seeds per second at the start', 'r', 0.5, 20, 0.5], ['accel', 'Speed-up per second', 'r', 1, 1.6, 0.01], ['max', 'Most seeds', 'r', 50, 3000, 1],
    ['color', 'Colour by', 's', { spiral: '21 spirals', spiral34: '34 spirals', radius: 'Distance from the centre', golden: 'Golden hue steps' }], ['spin', 'Slow turn', 'r', -0.5, 0.5, 0.01],
  ],
  init(S) { S.sc = { n: 0 }; },
  step(S, P, dt, emit) {
    const sc = S.sc;
    const want = Math.min(P.max, accelCount(S.st, P.rate0, P.accel));
    let sounds = 0;
    while (sc.n < want) {
      const n = sc.n++;
      const r = P.spread * Math.sqrt(n);
      if (r > 0.98) { if (!sc.done) { sc.done = true; emit({ type: 'fill', ball: 0, x: 0, y: 0, angle: 0 }); } sc.n = n; break; }
      const a = (n * P.angle * Math.PI) / 180;
      if (sounds++ < 2) emit({ type: 'hit', ball: n % 21, x: Math.cos(a) * r, y: Math.sin(a) * r, angle: a, pitch: r, balls: n + 1 });
    }
  },
  draw(S, P, D) {
    const { g, pal, k, time } = D;
    const rot = P.spin * S.st;
    const born = (n) => { // when seed n appeared (inverse of the schedule)
      const c = n + 1;
      return Math.abs(P.accel - 1) < 1e-6 ? c / P.rate0 : Math.log((c * Math.log(P.accel)) / P.rate0 + 1) / Math.log(P.accel);
    };
    for (let n = 0; n < S.sc.n; n++) {
      const r = P.spread * Math.sqrt(n), a = (n * P.angle * Math.PI) / 180 + rot;
      const age = S.st - born(n);
      const pop = easeOutBack(age / 0.35);
      const rad = P.size * (0.55 + 0.75 * r) * D.R * pop;
      if (rad <= 0) continue;
      const h = P.color === 'radius' ? r * 0.8 : P.color === 'golden' ? n * 0.381966 : P.color === 'spiral34' ? (n % 34) / 34 : (n % 21) / 21;
      const x = D.X(Math.cos(a) * r), y = D.Y(Math.sin(a) * r);
      g.fillStyle = pal.line(h);
      g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
      if (age < 0.4) { g.globalAlpha = 1 - age / 0.4; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, rad * 1.1, 0, TAU); g.fill(); g.globalAlpha = 1; }
      else if (rad > 3 * k) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(x - rad * 0.25, y - rad * 0.25, rad * 0.4, 0, TAU); g.fill(); }
    }
    void time;
  },
  stats: (S) => `seeds: ${S.sc.n}`,
  formula: (P) => `seed n: turn n × ${P.angle}°, r = √n`,
};

/* ========================================================== circle packing */

const packing = {
  label: 'Circle packing (grow until they touch)', group: 'Fill the screen',
  defaults: { shape: 'box', rate0: 4, accel: 1.15, growth: 0.3, max: 600, maxR: 0.32, gap: 0.006 },
  controls: [
    ['shape', 'Container', 's', { box: 'Tall box (whole safe area)', circle: 'Circle' }], ['rate0', 'New circles per second', 'r', 0.5, 20, 0.5], ['accel', 'Speed-up per second', 'r', 1, 1.5, 0.01],
    ['growth', 'Growth speed', 'r', 0.05, 1.5, 0.01], ['maxR', 'Largest circle', 'r', 0.05, 0.8, 0.01], ['gap', 'Gap', 'r', 0, 0.03, 0.001], ['max', 'Most circles', 'r', 20, 1500, 1],
  ],
  init(S) { S.sc = { c: [], tried: 0, fails: 0 }; },
  step(S, P, dt, emit) {
    const sc = S.sc, { hw, hh } = S.W;
    const inside = (x, y, r) => (P.shape === 'circle' ? Math.hypot(x, y) + r <= 0.97 : Math.abs(x) + r <= hw * 0.97 && Math.abs(y) + r <= hh * 0.97);
    const want = Math.min(P.max, accelCount(S.st, P.rate0, P.accel));
    while (sc.tried < want && !sc.done) {
      sc.tried++;
      let ok = false;
      for (let a = 0; a < 80 && !ok; a++) {
        const x = (S.rand() * 2 - 1) * (P.shape === 'circle' ? 0.97 : hw * 0.97), y = (S.rand() * 2 - 1) * (P.shape === 'circle' ? 0.97 : hh * 0.97);
        if (!inside(x, y, 0.004)) continue;
        if (sc.c.some((c) => Math.hypot(c.x - x, c.y - y) < c.r + P.gap + 0.006)) continue;
        sc.c.push({ x, y, r: 0.003, grow: true, hue: S.rand() * 0.25 + sc.c.length * 0.003, born: S.t });
        ok = true;
      }
      if (!ok && ++sc.fails > 12) { sc.done = true; emit({ type: 'fill', ball: 0, x: 0, y: 0, angle: 0 }); }
    }
    for (const c of sc.c) {
      if (!c.grow) continue;
      c.r += P.growth * dt;
      let stop = c.r >= P.maxR || !inside(c.x, c.y, c.r);
      if (!stop) for (const o of sc.c) if (o !== c && Math.hypot(o.x - c.x, o.y - c.y) < o.r + c.r + P.gap) { stop = true; break; }
      if (stop) {
        c.grow = false; c.doneT = S.t;
        emit({ type: 'hit', ball: sc.c.indexOf(c), x: c.x, y: c.y, angle: Math.atan2(c.y, c.x), pitch: clamp(1 - c.r / P.maxR, 0, 1) ** 0.6, balls: sc.c.length });
      }
    }
  },
  draw(S, P, D) {
    const { g, pal, k, time } = D;
    if (P.shape === 'circle') { g.strokeStyle = pal.ring; g.lineWidth = 3 * k; g.shadowColor = pal.glow; g.shadowBlur = 16 * k; g.beginPath(); g.arc(D.X(0), D.Y(0), 0.985 * D.R, 0, TAU); g.stroke(); g.shadowBlur = 0; }
    for (const c of S.sc.c) {
      const x = D.X(c.x), y = D.Y(c.y), r = c.r * D.R;
      const fl = c.grow ? 1 : Math.max(0, 1 - (time - c.doneT) / 0.5);
      const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.05, x, y, r);
      gr.addColorStop(0, hexA('#ffffff', 0.35 + 0.4 * fl));
      gr.addColorStop(1, pal.line(c.hue));
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, Math.max(0.5, r - 1 * k), 0, TAU); g.fill();
      g.strokeStyle = fl > 0 ? '#ffffff' : 'rgba(255,255,255,0.35)'; g.lineWidth = (1 + 2 * fl) * k; g.stroke();
    }
  },
  stats: (S) => `circles: ${S.sc.c.length}`,
  formula: () => 'grow until you touch someone',
};

/* ============================================================ pendulum wave */

const pendulum = {
  label: 'Pendulum wave', group: 'Patterns & rhythm',
  defaults: { count: 15, base: 20, cycle: 30, swing: 22 },
  controls: [
    ['count', 'Pendulums', 'r', 3, 32, 1], ['base', 'Swings of the longest per cycle', 'r', 4, 60, 1],
    ['cycle', 'Cycle (all line up again)', 'r', 5, 120, 1, ' s'], ['swing', 'Swing angle', 'r', 5, 40, 1, '°'],
  ],
  init(S, P) {
    const n = Math.max(2, P.count | 0), { hh } = S.W;
    const fMin = P.base / P.cycle, fMax = (P.base + n - 1) / P.cycle;
    const Lmax = 2 * hh * 0.93;
    S.sc = { p: Array.from({ length: n }, (_, i) => { const f = (P.base + i) / P.cycle; return { i, f, L: Lmax * (fMin / f) ** 2, last: 0 }; }), pivot: hh * 0.97, fMax };
  },
  step(S, P, dt, emit) {
    for (const p of S.sc.p) {
      const half = Math.floor(2 * p.f * S.st);
      if (half > p.last) {
        p.last = half;
        const th = (P.swing * Math.PI) / 180 * (half % 2 ? -1 : 1);
        emit({ type: 'hit', ball: p.i, x: p.L * Math.sin(th), y: S.sc.pivot - p.L * Math.cos(th), angle: th, pitch: p.i / S.sc.p.length, balls: S.sc.p.length });
        p.hitT = S.t;
      }
    }
  },
  draw(S, P, D) {
    const { g, pal, k, time } = D;
    const sc = S.sc, th0 = (P.swing * Math.PI) / 180;
    const pts = sc.p.map((p) => { const th = th0 * Math.cos(TAU * p.f * S.st); return [p.L * Math.sin(th), sc.pivot - p.L * Math.cos(th)]; });
    g.strokeStyle = pal.ring; g.lineWidth = 6 * k; g.shadowColor = pal.glow; g.shadowBlur = 14 * k;
    g.beginPath(); g.moveTo(D.X(-S.W.hw * 0.5), D.Y(sc.pivot)); g.lineTo(D.X(S.W.hw * 0.5), D.Y(sc.pivot)); g.stroke(); g.shadowBlur = 0;
    // swing arcs
    sc.p.forEach((p) => { g.strokeStyle = hexA(pal.ring, 0.08); g.lineWidth = 1 * k; g.beginPath(); g.arc(D.X(0), D.Y(sc.pivot), p.L * D.R, Math.PI / 2 - th0, Math.PI / 2 + th0); g.stroke(); });
    // strings
    sc.p.forEach((p, i) => { g.strokeStyle = hexA(pal.ring, 0.35); g.lineWidth = 1.2 * k; g.beginPath(); g.moveTo(D.X(0), D.Y(sc.pivot)); g.lineTo(D.X(pts[i][0]), D.Y(pts[i][1])); g.stroke(); });
    // the wave through all bobs
    g.strokeStyle = hexA(pal.glow, 0.5); g.lineWidth = 2 * k;
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(D.X(x), D.Y(y)) : g.moveTo(D.X(x), D.Y(y)))); g.stroke();
    sc.p.forEach((p, i) => {
      const fl = Math.max(0, 1 - (time - (p.hitT ?? -9)) / 0.3);
      const r = (10 + 8 * (1 - i / sc.p.length)) * k * (D.look.ballSize ?? 1);
      glowDot(g, D.X(pts[i][0]), D.Y(pts[i][1]), r * (1 + 0.3 * fl), pal.line(i / sc.p.length), k, 16 + 20 * fl);
      g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(D.X(pts[i][0]) - r * 0.3, D.Y(pts[i][1]) - r * 0.3, r * 0.35, 0, TAU); g.fill();
    });
  },
  stats: (S) => `swings: ${S.sc.p.reduce((a, p) => a + p.last, 0)}`,
  formula: (P) => `pendulum k: ${P.base}+k swings per ${P.cycle} s`,
};

/* ===================================================================== DNA */

const BASES = [['A', 'T', '#ff4d6d', '#ffd23b'], ['T', 'A', '#ffd23b', '#ff4d6d'], ['G', 'C', '#3bff8a', '#3bb8ff'], ['C', 'G', '#3bb8ff', '#3bff8a']];

const dna = {
  label: 'DNA helix zipping up', group: 'Patterns & rhythm',
  defaults: { pairs: 40, turns: 2.4, spin: 0.35, zip: 0.5, radius: 0.62, colors: 'bases' },
  controls: [
    ['pairs', 'Base pairs', 'r', 8, 120, 1], ['turns', 'Turns', 'r', 0.5, 8, 0.1], ['spin', 'Spin (turns/s)', 'r', -2, 2, 0.01],
    ['zip', 'Beats per base pair', 'r', 0.125, 4, 0.125], ['radius', 'Width', 'r', 0.2, 0.95, 0.01], ['colors', 'Colours', 's', { bases: 'A T G C', palette: 'Palette' }],
  ],
  init(S, P) {
    S.sc = { pairs: Array.from({ length: P.pairs | 0 }, () => Math.floor(S.rand() * 4)), shown: 0 };
  },
  step(S, P, dt, emit) {
    const sc = S.sc, beat = 60 / S.bpm;
    const want = Math.min(sc.pairs.length, Math.floor(S.st / (beat * P.zip)) + 1);
    while (sc.shown < want) {
      const i = sc.shown++;
      const y = this.yOf(S, P, i);
      emit({ type: 'hit', ball: sc.pairs[i], x: 0, y, angle: Math.PI / 2, pitch: (sc.pairs[i] + (i % 8) * 0.5) / 8, balls: sc.shown });
      if (sc.shown === sc.pairs.length) emit({ type: 'fill', ball: 0, x: 0, y, angle: 0 });
    }
  },
  yOf(S, P, i) { const n = S.sc.pairs.length; return -S.W.hh * 0.94 + (2 * S.W.hh * 0.94 * (i + 0.5)) / n; },
  draw(S, P, D) {
    const { g, pal, k, time } = D;
    const sc = S.sc, n = sc.pairs.length, beat = 60 / S.bpm;
    const R = P.radius * S.W.hw * 0.95;
    const phaseOf = (y) => ((y + S.W.hh) / (2 * S.W.hh)) * P.turns * TAU + P.spin * TAU * S.st;
    const top = sc.shown >= n ? S.W.hh * 0.97 : this.yOf(S, P, Math.max(0, sc.shown - 1)) + (2 * S.W.hh * 0.94) / n * smooth((S.st / (beat * P.zip)) % 1);
    const strandPts = (off) => {
      const pts = [];
      for (let y = -S.W.hh * 0.97; y <= top; y += 0.01) { const ph = phaseOf(y) + off; pts.push([R * Math.cos(ph), y, Math.sin(ph)]); }
      return pts;
    };
    const drawStrand = (pts, front, color) => {
      g.lineCap = 'round';
      for (let i = 1; i < pts.length; i++) {
        const z = (pts[i][2] + pts[i - 1][2]) / 2;
        if (front ? z < 0 : z >= 0) continue;
        g.strokeStyle = color; g.globalAlpha = 0.35 + 0.65 * (z + 1) / 2;
        g.lineWidth = (5 + 5 * (z + 1) / 2) * k;
        g.beginPath(); g.moveTo(D.X(pts[i - 1][0]), D.Y(pts[i - 1][1])); g.lineTo(D.X(pts[i][0]), D.Y(pts[i][1])); g.stroke();
      }
      g.globalAlpha = 1;
    };
    const A = strandPts(0), B = strandPts(Math.PI);
    const cA = P.colors === 'palette' ? pal.line(0.1) : '#9fd8ff', cB = P.colors === 'palette' ? pal.line(0.6) : '#ff9fe0';
    drawStrand(A, false, cA); drawStrand(B, false, cB);
    // base pairs (rungs), back to front
    const rungs = [];
    for (let i = 0; i < sc.shown; i++) {
      const y = this.yOf(S, P, i), ph = phaseOf(y);
      rungs.push({ i, y, ph, z: Math.sin(ph) * 0 + Math.cos(ph) * 0 });
    }
    for (const r of rungs) {
      const [b1, b2, c1, c2] = BASES[sc.pairs[r.i]];
      const x1 = R * Math.cos(r.ph), x2 = -x1, zf = Math.abs(Math.sin(r.ph));
      const born = r.i * beat * P.zip;
      const pop = easeOutBack((S.st - born) / (beat * P.zip * 0.8));
      const flash = Math.max(0, 1 - (S.st - born) / 0.5);
      const mid = (x1 + x2) / 2;
      const col1 = P.colors === 'palette' ? pal.line(r.i * 0.05) : c1, col2 = P.colors === 'palette' ? pal.line(r.i * 0.05 + 0.5) : c2;
      g.globalAlpha = 0.45 + 0.55 * zf;
      g.lineWidth = (4 + 3 * zf) * k;
      g.strokeStyle = col1; g.beginPath(); g.moveTo(D.X(x1), D.Y(r.y)); g.lineTo(D.X(x1 + (mid - x1) * pop), D.Y(r.y)); g.stroke();
      g.strokeStyle = col2; g.beginPath(); g.moveTo(D.X(x2), D.Y(r.y)); g.lineTo(D.X(x2 + (mid - x2) * pop), D.Y(r.y)); g.stroke();
      if (flash > 0) { g.globalAlpha = flash; glowDot(g, D.X(mid), D.Y(r.y), 7 * k * (1 + flash), '#ffffff', k, 24); }
      if (Math.abs(x1 - x2) * D.R > 70 * k && zf > 0.3 && pop > 0.9) {
        g.globalAlpha = zf * 0.85; g.fillStyle = '#ffffff'; g.font = `700 ${13 * k}px ui-monospace, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(b1, D.X(x1 + (mid - x1) * 0.45), D.Y(r.y) - 10 * k); g.fillText(b2, D.X(x2 + (mid - x2) * 0.45), D.Y(r.y) - 10 * k);
      }
      g.globalAlpha = 1;
    }
    drawStrand(A, true, cA); drawStrand(B, true, cB);
    // nucleotide beads on the front strand at each pair
    for (const r of rungs) {
      for (const off of [0, Math.PI]) {
        const ph = r.ph + off, z = Math.sin(ph);
        if (z < 0) continue;
        glowDot(g, D.X(R * Math.cos(ph)), D.Y(r.y), (4 + 4 * z) * k, off ? cB : cA, k, 10);
      }
    }
    void time;
  },
  stats: (S) => `base pairs: ${S.sc.shown}`,
  formula: () => 'A–T  ·  G–C',
};

/* ============================================================ harmonograph */

const harmono = {
  label: 'Harmonograph (decaying pendulums draw)', group: 'Drawing machines',
  defaults: { f1: 3, f2: 2, f3: 3.006, f4: 2.004, p: 1.57, decay: 0.012, rate: 1.4 },
  controls: [
    ['f1', 'x frequency 1', 'r', 1, 8, 0.001], ['f3', 'x frequency 2', 'r', 1, 8, 0.001], ['f2', 'y frequency 1', 'r', 1, 8, 0.001], ['f4', 'y frequency 2', 'r', 1, 8, 0.001],
    ['p', 'Phase', 'r', 0, 3.1416, 0.01], ['decay', 'Damping', 'r', 0, 0.08, 0.001], ['rate', 'Drawing speed', 'r', 0.2, 5, 0.05],
  ],
  pos(S, P, t) {
    const d = Math.exp(-P.decay * t);
    return [S.W.hw * 0.95 * d * (Math.sin(P.f1 * t + P.p) + Math.sin(P.f3 * t)) / 2, S.W.hh * 0.95 * d * (Math.sin(P.f2 * t) + Math.sin(P.f4 * t + P.p / 2)) / 2];
  },
  init(S, P) { const [x, y] = this.pos(S, P, 0); S.sc = { x, y, vx: 0, tau: 0 }; },
  step(S, P, dt, emit) {
    const sc = S.sc;
    sc.tau += dt * P.rate;
    const [x, y] = this.pos(S, P, sc.tau);
    const vx = x - sc.x;
    S.addSegment(sc.x, sc.y, x, y, S.t, sc.tau * 0.02);
    if (vx * sc.vx < 0) emit({ type: 'hit', ball: 0, x, y, angle: Math.atan2(y, x), pitch: (y / S.W.hh + 1) / 2, balls: 0 });
    sc.x = x; sc.y = y; sc.vx = vx;
  },
  draw(S, P, D) { glowDot(D.g, D.X(S.sc.x), D.Y(S.sc.y), 7 * D.k, '#ffffff', D.k, 24); },
  stats: (S) => `t = ${S.sc.tau.toFixed(1)}`,
  formula: (P) => `x = sin ${P.f1}t + sin ${P.f3}t,  y = sin ${P.f2}t + sin ${P.f4}t`,
};

/* ================================================================= orbits */

const orbits = {
  label: 'Planet dance (lines between two orbits)', group: 'Drawing machines',
  defaults: { inner: 13, outer: 8, cycle: 24, every: 0.08, r1: 0.69 },
  controls: [
    ['inner', 'Inner planet laps', 'r', 1, 40, 1], ['outer', 'Outer planet laps', 'r', 1, 40, 1], ['cycle', 'Cycle', 'r', 4, 120, 1, ' s'],
    ['every', 'A line every', 'r', 0.02, 0.5, 0.005, ' s'], ['r1', 'Inner orbit size', 'r', 0.2, 0.95, 0.01],
  ],
  where(S, P) {
    const a1 = (TAU * P.inner * S.st) / P.cycle + Math.PI / 2, a2 = (TAU * P.outer * S.st) / P.cycle + Math.PI / 2;
    return [[Math.cos(a1) * P.r1 * 0.97, Math.sin(a1) * P.r1 * 0.97], [Math.cos(a2) * 0.97, Math.sin(a2) * 0.97]];
  },
  init(S) { S.sc = { next: 0, lines: 0 }; },
  step(S, P, dt, emit) {
    const sc = S.sc;
    while (S.st >= sc.next) {
      sc.next += P.every;
      const [[x1, y1], [x2, y2]] = this.where(S, P);
      S.addSegment(x1, y1, x2, y2, S.t, sc.lines * 0.004);
      sc.lines++;
      if (sc.lines % 2 === 0) emit({ type: 'hit', ball: sc.lines, x: x2, y: y2, angle: Math.atan2(y2, x2), pitch: clamp(1 - Math.hypot(x2 - x1, y2 - y1) / 1.9, 0, 1), balls: sc.lines });
    }
  },
  draw(S, P, D) {
    const { g, pal, k } = D;
    const [[x1, y1], [x2, y2]] = this.where(S, P);
    g.strokeStyle = hexA(pal.ring, 0.2); g.lineWidth = 1.2 * k;
    g.beginPath(); g.arc(D.X(0), D.Y(0), P.r1 * 0.97 * D.R, 0, TAU); g.stroke();
    g.beginPath(); g.arc(D.X(0), D.Y(0), 0.97 * D.R, 0, TAU); g.stroke();
    const sun = g.createRadialGradient(D.X(0), D.Y(0), 0, D.X(0), D.Y(0), 60 * k);
    sun.addColorStop(0, '#fffbe6'); sun.addColorStop(0.3, '#ffcf5a'); sun.addColorStop(1, 'rgba(255,140,40,0)');
    g.fillStyle = sun; g.beginPath(); g.arc(D.X(0), D.Y(0), 60 * k, 0, TAU); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 2 * k; g.beginPath(); g.moveTo(D.X(x1), D.Y(y1)); g.lineTo(D.X(x2), D.Y(y2)); g.stroke();
    glowDot(g, D.X(x1), D.Y(y1), 9 * k, '#ffd9a8', k, 22);
    glowDot(g, D.X(x2), D.Y(y2), 11 * k, '#7fd3ff', k, 22);
  },
  stats: (S) => `lines: ${S.sc.lines}`,
  formula: (P) => `${P.inner} laps : ${P.outer} laps`,
};

/* ================================================================ sorting */

function sortOps(algo, input) {
  const a = input.slice(), n = a.length, ops = [];
  const cmp = (i, j) => { ops.push([0, i, j, a[i]]); return a[i] - a[j]; };
  const swap = (i, j) => { ops.push([1, i, j, a[j]]); const t = a[i]; a[i] = a[j]; a[j] = t; };
  const set = (i, v) => { ops.push([2, i, v, v]); a[i] = v; };
  switch (algo) {
    case 'bubble': for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1 - i; j++) if (cmp(j, j + 1) > 0) swap(j, j + 1); break;
    case 'cocktail': {
      let lo = 0, hi = n - 1;
      while (lo < hi) {
        for (let j = lo; j < hi; j++) if (cmp(j, j + 1) > 0) swap(j, j + 1);
        hi--;
        for (let j = hi; j > lo; j--) if (cmp(j - 1, j) > 0) swap(j - 1, j);
        lo++;
      }
      break;
    }
    case 'insertion': for (let i = 1; i < n; i++) for (let j = i; j > 0 && cmp(j - 1, j) > 0; j--) swap(j - 1, j); break;
    case 'selection': for (let i = 0; i < n - 1; i++) { let m = i; for (let j = i + 1; j < n; j++) if (cmp(j, m) < 0) m = j; if (m !== i) swap(i, m); } break;
    case 'quick': {
      const q = (lo, hi) => {
        if (lo >= hi) return;
        let p = lo;
        for (let j = lo; j < hi; j++) if (cmp(j, hi) < 0) { if (p !== j) swap(p, j); p++; }
        if (p !== hi) swap(p, hi);
        q(lo, p - 1); q(p + 1, hi);
      };
      q(0, n - 1);
      break;
    }
    case 'merge': {
      const m = (lo, hi) => {
        if (hi - lo < 1) return;
        const mid = (lo + hi) >> 1;
        m(lo, mid); m(mid + 1, hi);
        const L = a.slice(lo, mid + 1), R = a.slice(mid + 1, hi + 1);
        let i = 0, j = 0, k = lo;
        while (i < L.length && j < R.length) { ops.push([0, lo + i, mid + 1 + j, L[i]]); set(k++, L[i] <= R[j] ? L[i++] : R[j++]); }
        while (i < L.length) set(k++, L[i++]);
        while (j < R.length) set(k++, R[j++]);
      };
      m(0, n - 1);
      break;
    }
    case 'heap': {
      const down = (i, size) => {
        for (;;) {
          let m = i; const l = 2 * i + 1, r = l + 1;
          if (l < size && cmp(l, m) > 0) m = l;
          if (r < size && cmp(r, m) > 0) m = r;
          if (m === i) return;
          swap(i, m); i = m;
        }
      };
      for (let i = (n >> 1) - 1; i >= 0; i--) down(i, n);
      for (let e = n - 1; e > 0; e--) { swap(0, e); down(0, e); }
      break;
    }
    case 'shell': {
      for (let gap = n >> 1; gap > 0; gap >>= 1) for (let i = gap; i < n; i++) for (let j = i; j >= gap && cmp(j - gap, j) > 0; j -= gap) swap(j - gap, j);
      break;
    }
    case 'radix': {
      for (let shift = 0; (n - 1) >> shift > 0; shift += 2) {
        const buckets = [[], [], [], []];
        for (let i = 0; i < n; i++) { ops.push([0, i, i, a[i]]); buckets[(a[i] >> shift) & 3].push(a[i]); }
        let k = 0;
        for (const b of buckets) for (const v of b) set(k++, v);
      }
      break;
    }
    default:
  }
  return ops;
}

export const SORTS = { bubble: 'Bubble sort', cocktail: 'Cocktail shaker', insertion: 'Insertion sort', selection: 'Selection sort', quick: 'Quicksort', merge: 'Merge sort', heap: 'Heapsort', shell: 'Shellsort', radix: 'Radix sort (base 4)' };

const sorting = {
  label: 'Sorting algorithm with sound', group: 'Patterns & rhythm',
  defaults: { algo: 'quick', bars: 64, time: 20, finale: true },
  controls: [['algo', 'Algorithm', 's', SORTS], ['bars', 'Bars', 'r', 8, 256, 1], ['time', 'Sorting takes', 'r', 3, 120, 1, ' s'], ['finale', 'Green check at the end', 't']],
  init(S, P) {
    const n = Math.max(4, P.bars | 0);
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(S.rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    S.sc = { a, ops: sortOps(P.algo, a), done: 0, cmp: 0, swp: 0, mark: [], check: -1, end: null };
  },
  step(S, P, dt, emit) {
    const sc = S.sc, N = sc.ops.length;
    const want = Math.min(N, Math.floor((S.st / P.time) * N));
    let sounds = 0;
    while (sc.done < want) {
      const [t, i, j, v] = sc.ops[sc.done++];
      if (t === 0) { sc.cmp++; sc.mark = [i, j, 0, S.t]; }
      else if (t === 1) { sc.swp++; const x = sc.a[i]; sc.a[i] = sc.a[j]; sc.a[j] = x; sc.mark = [i, j, 1, S.t]; }
      else { sc.swp++; sc.a[i] = j; sc.mark = [i, i, 1, S.t]; }
      if (sounds++ < 2) emit({ type: 'hit', ball: v, x: 0, y: 0, angle: 0, pitch: v / sc.a.length, balls: sc.done });
    }
    if (sc.done >= N && sc.end == null) sc.end = S.st;
    if (P.finale && sc.end != null) {
      const n = sc.a.length, k = Math.min(n, Math.floor(((S.st - sc.end) / 1.6) * n));
      while (sc.check < k - 1) {
        sc.check++;
        if (sc.check % Math.max(1, Math.ceil(n / 48)) === 0) emit({ type: 'hit', ball: sc.check, x: 0, y: 0, angle: 0, pitch: sc.check / n, balls: n });
        if (sc.check === n - 1) emit({ type: 'fill', ball: 0, x: 0, y: 0, angle: 0 });
      }
    }
  },
  draw(S, P, D) {
    const { g, pal, k, time } = D;
    const sc = S.sc, n = sc.a.length, { hw, hh } = S.W;
    const w = (2 * hw * 0.96) / n, base = -hh * 0.95, H = 2 * hh * 0.9;
    const recent = time - sc.mark[3] < 0.12 ? sc.mark : null;
    for (let i = 0; i < n; i++) {
      const v = sc.a[i], h = ((v + 1) / n) * H;
      const x = -hw * 0.96 + i * w;
      let col = pal.line(v / n);
      if (i <= sc.check) col = `hsl(${120 + 20 * (v / n)} 90% ${55 + 15 * Math.max(0, 1 - (sc.check - i) / 10)}%)`;
      if (recent && (i === recent[0] || i === recent[1])) col = recent[2] ? '#ff5470' : '#ffffff';
      g.fillStyle = col;
      g.fillRect(D.X(x) + (n < 100 ? 1 * k : 0), D.Y(base + h), Math.max(1, w * D.R - (n < 100 ? 2 * k : 0)), h * D.R);
    }
    g.strokeStyle = hexA(pal.ring, 0.4); g.lineWidth = 2 * k;
    g.beginPath(); g.moveTo(D.X(-hw * 0.98), D.Y(base)); g.lineTo(D.X(hw * 0.98), D.Y(base)); g.stroke();
    g.fillStyle = hexA(pal.ring, 0.85); g.font = `600 ${24 * k}px ui-monospace, monospace`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillText(SORTS[P.algo] || P.algo, D.X(0), D.Y(base) + 34 * k);
  },
  stats: (S) => `comparisons: ${S.sc.cmp} · writes: ${S.sc.swp}`,
  formula: (P) => SORTS[P.algo] || P.algo,
};

/* ============================================================ fractal tree */

const tree = {
  label: 'Fractal tree growing on the beat', group: 'Drawing machines',
  defaults: { depth: 11, angle: 24, ratio: 0.74, beats: 1, sway: 1, curl: 0, leaves: true },
  controls: [
    ['depth', 'Levels', 'r', 3, 13, 1], ['angle', 'Branch angle', 'r', 5, 70, 0.5, '°'], ['ratio', 'Each branch shorter by', 'r', 0.5, 0.85, 0.005],
    ['beats', 'Beats per level', 'r', 0.25, 4, 0.25], ['curl', 'Twist', 'r', -20, 20, 0.5, '°'], ['sway', 'Wind', 'r', 0, 3, 0.05], ['leaves', 'Blossoms', 't'],
  ],
  init(S, P) { S.sc = { level: -1 }; },
  step(S, P, dt, emit) {
    const lv = Math.floor(S.st / ((60 / S.bpm) * P.beats));
    while (S.sc.level < Math.min(lv, P.depth)) {
      S.sc.level++;
      emit({ type: S.sc.level === P.depth ? 'fill' : 'hit', ball: S.sc.level, x: 0, y: 0, angle: Math.PI / 2, pitch: S.sc.level / P.depth, balls: 2 ** S.sc.level });
    }
  },
  draw(S, P, D) {
    const { g, pal, k, time } = D;
    const beatT = (60 / S.bpm) * P.beats;
    const grown = S.st / beatT; // levels grown (fractional)
    const a0 = (P.angle * Math.PI) / 180, curl = (P.curl * Math.PI) / 180;
    // size the trunk so the full-grown tree fits the safe area
    const key = `${P.depth}|${P.angle}|${P.ratio}|${P.curl}`;
    if (S.sc.fitKey !== key) {
      let top = 0, side = 0;
      const walk = (x, y, ang, len, lvl) => {
        const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
        top = Math.max(top, y2); side = Math.max(side, Math.abs(x2));
        if (lvl < P.depth) { walk(x2, y2, ang + a0 + curl, len * P.ratio, lvl + 1); walk(x2, y2, ang - a0 + curl, len * P.ratio, lvl + 1); }
      };
      walk(0, 0, Math.PI / 2, 1, 0);
      S.sc.fit = Math.min((2 * S.W.hh * 0.93) / top, (S.W.hw * 0.97) / Math.max(1e-6, side));
      S.sc.fitKey = key;
    }
    const L0 = S.sc.fit;
    g.lineCap = 'round';
    const branch = (x, y, ang, len, lvl) => {
      const f = clamp(grown - lvl, 0, 1);
      if (f <= 0) return;
      const wind = P.sway * 0.025 * lvl * Math.sin(time * 1.3 + lvl * 0.6);
      const a = ang + wind;
      const x2 = x + Math.cos(a) * len * smooth(f), y2 = y + Math.sin(a) * len * smooth(f);
      g.strokeStyle = lvl < 2 ? hexA(pal.ring, 0.9) : pal.line(lvl / P.depth * 0.8);
      g.lineWidth = Math.max(1, (P.depth - lvl + 1) ** 1.25 * 1.3 * k);
      g.beginPath(); g.moveTo(D.X(x), D.Y(y)); g.lineTo(D.X(x2), D.Y(y2)); g.stroke();
      if (lvl === P.depth) {
        if (P.leaves && f > 0.6) { const p = easeOutBack((f - 0.6) / 0.4); g.fillStyle = pal.line(0.85 + (x2 + y2) * 0.2); g.beginPath(); g.arc(D.X(x2), D.Y(y2), 3.5 * k * p, 0, TAU); g.fill(); }
        return;
      }
      if (f < 1) return;
      branch(x2, y2, a + a0 + curl, len * P.ratio, lvl + 1);
      branch(x2, y2, a - a0 + curl, len * P.ratio, lvl + 1);
    };
    branch(0, -S.W.hh * 0.97, Math.PI / 2, L0, 0);
    g.strokeStyle = hexA(pal.ring, 0.4); g.lineWidth = 2 * k;
    g.beginPath(); g.moveTo(D.X(-S.W.hw * 0.7), D.Y(-S.W.hh * 0.97)); g.lineTo(D.X(S.W.hw * 0.7), D.Y(-S.W.hh * 0.97)); g.stroke();
  },
  stats: (S, P) => `branches: ${2 ** (Math.max(0, Math.min(S.sc.level, P.depth)) + 1) - 1}`,
  formula: (P) => `every beat: 1 branch → 2 (${P.angle}°)`,
};

/* ========================================================== times table */

const times = {
  label: 'Times-table circle (cardioid, nephroid …)', group: 'Drawing machines',
  defaults: { points: 200, from: 2, to: 10, build: 5, morph: 22 },
  controls: [['points', 'Points', 'r', 20, 500, 1], ['from', 'Start: × ', 'r', 1, 20, 0.01], ['to', 'End: ×', 'r', 1, 60, 0.01], ['build', 'Drawing the lines takes', 'r', 0.5, 20, 0.5, ' s'], ['morph', 'Then morph for', 'r', 1, 120, 1, ' s']],
  mult(S, P) { return S.st <= P.build ? P.from : P.from + (P.to - P.from) * smooth((S.st - P.build) / P.morph); },
  init(S) { S.sc = { drawn: 0, lastM: null }; },
  step(S, P, dt, emit) {
    const sc = S.sc, N = P.points | 0;
    const want = Math.min(N, Math.floor((S.st / P.build) * N));
    let sounds = 0;
    while (sc.drawn < want) {
      const i = sc.drawn++;
      const a = Math.PI / 2 + (i / N) * TAU;
      if (sounds++ < 2) emit({ type: 'hit', ball: i, x: Math.cos(a), y: Math.sin(a), angle: a, pitch: i / N, balls: i });
    }
    const m = this.mult(S, P);
    const step = Math.floor(m * 2);
    if (sc.lastM != null && step !== sc.lastM) emit({ type: Number.isInteger(step / 2) ? 'fill' : 'hit', ball: step, x: 0, y: 1, angle: Math.PI / 2, pitch: frac(step * 0.0625), balls: N });
    sc.lastM = step;
  },
  draw(S, P, D) {
    const { g, pal, k } = D;
    const N = P.points | 0, m = this.mult(S, P), R = 0.97;
    const pt = (i) => { const a = Math.PI / 2 + (i / N) * TAU; return [D.X(Math.cos(a) * R), D.Y(Math.sin(a) * R)]; };
    g.strokeStyle = pal.ring; g.lineWidth = 3 * k; g.shadowColor = pal.glow; g.shadowBlur = 16 * k;
    g.beginPath(); g.arc(D.X(0), D.Y(0), R * D.R, 0, TAU); g.stroke(); g.shadowBlur = 0;
    g.globalCompositeOperation = 'lighter';
    g.lineWidth = Math.max(0.8, 1.4 * k * Math.sqrt(200 / N));
    for (let i = 0; i < S.sc.drawn; i++) {
      const [x1, y1] = pt(i), [x2, y2] = pt((i * m) % N);
      g.strokeStyle = pal.line(i / N);
      g.globalAlpha = 0.55;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < N; i += Math.max(1, Math.round(N / 120))) { const [x, y] = pt(i); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, 2 * k, 0, TAU); g.fill(); }
  },
  stats: (S, P) => `× ${times.mult(S, P).toFixed(2)}`,
  formula: (P) => `point i → point i × m  (mod ${P.points})`,
};

/* ===================================================== polygon polyrhythm */

const polygons = {
  label: 'Polygon polyrhythm (a note on every corner)', group: 'Patterns & rhythm',
  defaults: { from: 3, to: 10, lap: 8, mode: 'same' },
  controls: [['from', 'Fewest corners', 'r', 2, 12, 1], ['to', 'Most corners', 'r', 3, 16, 1], ['lap', 'Beats per lap', 'r', 1, 32, 1], ['mode', 'Timing', 's', { same: 'Same lap time (n notes per lap)', beat: 'Every side takes one beat' }]],
  init(S, P) {
    const ns = [];
    for (let n = Math.max(2, P.from | 0); n <= Math.max(P.from, P.to | 0); n++) ns.push({ n, last: 0, hitT: -9 });
    S.sc = { p: ns };
  },
  u(S, P, p) { const beat = 60 / S.bpm; return P.mode === 'beat' ? S.st / (beat * p.n) : S.st / (beat * P.lap); },
  step(S, P, dt, emit) {
    S.sc.p.forEach((p, idx) => {
      const c = Math.floor(this.u(S, P, p) * p.n);
      if (c > p.last) {
        p.last = c; p.hitT = S.t;
        const r = this.radius(S, P, idx), a = Math.PI / 2 + ((c % p.n) * TAU) / p.n;
        emit({ type: 'hit', ball: idx, x: Math.cos(a) * r, y: Math.sin(a) * r, angle: a, pitch: idx / S.sc.p.length, balls: S.sc.p.length });
      }
    });
  },
  radius(S, P, idx) { const n = S.sc.p.length; return 0.2 + (0.77 * idx) / Math.max(1, n - 1); },
  draw(S, P, D) {
    const { g, pal, k, time } = D;
    S.sc.p.forEach((p, idx) => {
      const r = this.radius(S, P, idx), col = pal.line(idx / S.sc.p.length);
      const V = (i) => { const a = Math.PI / 2 + (i * TAU) / p.n; return [Math.cos(a) * r, Math.sin(a) * r]; };
      const fl = Math.max(0, 1 - (time - p.hitT) / 0.35);
      g.strokeStyle = col; g.globalAlpha = 0.6 + 0.4 * fl; g.lineWidth = (2.5 + 3 * fl) * k;
      g.beginPath(); for (let i = 0; i <= p.n; i++) { const [x, y] = V(i); i ? g.lineTo(D.X(x), D.Y(y)) : g.moveTo(D.X(x), D.Y(y)); } g.stroke();
      g.globalAlpha = 1;
      const u = this.u(S, P, p) * p.n, c = Math.floor(u), f = u - c;
      const [x1, y1] = V(c), [x2, y2] = V(c + 1);
      // trail along the perimeter
      g.strokeStyle = col; g.lineWidth = 4 * k; g.lineCap = 'round';
      g.beginPath(); g.moveTo(D.X(x1), D.Y(y1)); g.lineTo(D.X(x1 + (x2 - x1) * f), D.Y(y1 + (y2 - y1) * f)); g.stroke();
      const [cx, cy] = V(c);
      if (fl > 0) { g.globalAlpha = fl; glowDot(g, D.X(cx), D.Y(cy), (6 + 10 * fl) * k, '#ffffff', k, 24); g.globalAlpha = 1; }
      glowDot(g, D.X(x1 + (x2 - x1) * f), D.Y(y1 + (y2 - y1) * f), 11 * k, col, k, 22);
    });
  },
  stats: (S) => `notes: ${S.sc.p.reduce((a, p) => a + p.last, 0)}`,
  formula: (P) => (P.mode === 'beat' ? 'one side per beat' : `${P.from} to ${P.to} corners, one lap`),
};

/* ============================================================== spirograph */

const spiro = {
  label: 'Spirograph (a wheel rolling inside a wheel)', group: 'Drawing machines',
  defaults: { r: 0.37, d: 0.75, rate: 1.6 },
  controls: [['r', 'Small wheel', 'r', 0.05, 0.95, 0.001], ['d', 'Pen distance', 'r', 0, 1.5, 0.01], ['rate', 'Speed', 'r', 0.2, 8, 0.05]],
  pos(P, th) {
    const R = 1, r = P.r, d = P.d * r, s = 0.97 / ((R - r) + d);
    return [s * ((R - r) * Math.cos(th) + d * Math.cos(((R - r) / r) * th)), s * ((R - r) * Math.sin(th) - d * Math.sin(((R - r) / r) * th))];
  },
  init(S, P) { const [x, y] = this.pos(P, 0); S.sc = { th: 0, x, y, rr: Math.hypot(x, y), dr: 0, petals: 0 }; },
  step(S, P, dt, emit) {
    const sc = S.sc;
    sc.th += dt * P.rate;
    const [x, y] = this.pos(P, sc.th);
    S.addSegment(sc.x, sc.y, x, y, S.t, sc.th * 0.01);
    const rr = Math.hypot(x, y), dr = rr - sc.rr;
    if (sc.dr > 0 && dr <= 0) { sc.petals++; emit({ type: 'hit', ball: sc.petals, x, y, angle: Math.atan2(y, x), balls: sc.petals }); }
    sc.x = x; sc.y = y; sc.rr = rr; sc.dr = dr;
  },
  draw(S, P, D) {
    const { g, pal, k } = D;
    const R = 1, r = P.r, s = 0.97 / ((R - r) + P.d * r), th = S.sc.th;
    const cx = (R - r) * Math.cos(th) * s, cy = (R - r) * Math.sin(th) * s;
    g.strokeStyle = hexA(pal.ring, 0.3); g.lineWidth = 2 * k;
    g.beginPath(); g.arc(D.X(0), D.Y(0), R * s * D.R, 0, TAU); g.stroke();
    g.beginPath(); g.arc(D.X(cx), D.Y(cy), r * s * D.R, 0, TAU); g.stroke();
    g.strokeStyle = hexA('#ffffff', 0.6);
    g.beginPath(); g.moveTo(D.X(cx), D.Y(cy)); g.lineTo(D.X(S.sc.x), D.Y(S.sc.y)); g.stroke();
    glowDot(g, D.X(S.sc.x), D.Y(S.sc.y), 7 * k, '#ffffff', k, 22);
  },
  stats: (S) => `petals: ${S.sc.petals}`,
  formula: (P) => `wheel ${P.r} inside wheel 1`,
};

/* =============================================================== lab recipes */

const LAB_CONTROLS = {
  arena: ['arena', 'Arena', 's', { circle: 'Circle', box: 'Tall box (whole safe area)', square: 'Square', stadium: 'Stadium (tall capsule)', poly: 'Polygon', tri: 'Triangle' }],
  sides: ['sides', 'Polygon sides', 'r', 3, 12, 1], arenaSize: ['arenaSize', 'Arena size', 'r', 0.3, 1, 0.01],
  spin: ['spin', 'Arena spin', 'r', -3, 3, 0.05], shrink: ['shrink', 'Arena shrinks per hit', 'r', 0, 0.02, 0.0005],
  gap: ['gap', 'Escape gap', 'r', 0, 140, 1, '°'], gapSpin: ['gapSpin', 'Gap turns', 'r', -3, 3, 0.05],
  balls: ['balls', 'Balls at the start', 'r', 0, 120, 1], speed: ['speed', 'Speed', 'r', 0.1, 5, 0.05], angle: ['angle', 'Launch angle', 'r', 0, 360, 1, '°'],
  size: ['size', 'Ball size', 'r', 0.005, 0.2, 0.001], gravity: ['gravity', 'Gravity', 'r', 0, 8, 0.1], bounce: ['bounce', 'Bounciness', 'r', 0.2, 1.1, 0.01],
  speedGain: ['speedGain', 'Speed-up per bounce', 'r', 1, 1.08, 0.002], maxSpeed: ['maxSpeed', 'Top speed', 'r', 1, 12, 0.1], drag: ['drag', 'Air drag', 'r', 0, 3, 0.05], jitter: ['jitter', 'Wobble', 'r', 0, 10, 0.1],
  wall: ['wall', 'When a ball hits the wall', 's', { bounce: 'Just bounce', split: 'Split into N', clone: 'Add one ball', grow: 'Grow', shrink: 'Shrink (pop when tiny)', recolor: 'Change colour', speed: 'Speed up' }],
  wallN: ['wallN', 'N (wall split)', 'r', 2, 8, 1], spread: ['spread', 'Split fan angle', 'r', 2, 180, 1, '°'], childScale: ['childScale', 'New balls size ×', 'r', 0.4, 1, 0.01],
  grow: ['grow', 'Growth per hit', 'r', 0.001, 0.05, 0.001],
  core: ['core', 'Core size', 'r', 0, 0.6, 0.005], coreShape: ['coreShape', 'Core shape', 's', { circle: 'Circle', square: 'Square', tri: 'Triangle', hex: 'Hexagon' }],
  coreSpin: ['coreSpin', 'Core spin', 'r', -4, 4, 0.05], coreAction: ['coreAction', 'When a ball hits the core', 's', { split: 'Split into N', clone: 'Add one ball', bounce: 'Just bounce', recolor: 'Change colour', grow: 'Grow', shrink: 'Shrink', remove: 'Pop it' }],
  coreN: ['coreN', 'N (core split)', 'r', 2, 8, 1],
  rows: ['rows', 'Rows', 'r', 3, 18, 1], pegSize: ['pegSize', 'Peg size', 'r', 0.006, 0.05, 0.001],
  collide: ['collide', 'Balls bump each other', 't'], ballAction: ['ballAction', 'When two balls touch', 's', { bounce: 'Bounce', infect: 'Take the colour', clone: 'Make a new ball', grow: 'Both grow', recolor: 'Change colour', stick: 'Stick (coral)' }],
  ballBounce: ['ballBounce', 'Ball bounciness', 'r', 0, 1, 0.01], teams: ['teams', 'Colour teams', 'r', 2, 6, 1],
  emit: ['emit', 'Balls per drop', 'r', 0, 10, 1], emitEvery: ['emitEvery', 'Beats between drops', 'r', 0.0625, 4, 0.0625], emitRamp: ['emitRamp', 'One more per drop every … drops (0 = off)', 'r', 0, 64, 1],
  emitMax: ['emitMax', 'Balls to drop', 'r', 1, 1500, 1], colorEvery: ['colorEvery', 'New colour every … balls', 'r', 1, 200, 1],
  escapeN: ['escapeN', 'New balls per escape', 'r', 0, 6, 1], outGravity: ['outGravity', 'Gravity outside', 'r', 0, 8, 0.1],
  divide: ['divide', 'Divide every … beats', 'r', 0.25, 8, 0.25], walkers: ['walkers', 'Wandering balls', 'r', 1, 80, 1], max: ['max', 'Most balls', 'r', 2, 1500, 1],
  ink: ['ink', 'Balls draw lines', 't'], ballStyle: ['ballStyle', 'Ball look', 's', { glow: 'Glowing ball', cell: 'Cell', gem: 'Shard' }],
};

const lab = (label, group, defaults, keys, formula, statsLabel) => ({
  label, group, lab: true, defaults: { ...LAB_DEFAULTS, ...defaults },
  controls: keys.map((k) => LAB_CONTROLS[k]),
  init: labInit, step: labStep, draw: labDraw,
  stats: (S, P) => labStats(S, P, statsLabel), formula: typeof formula === 'function' ? formula : () => formula,
});

const PHYS = ['speed', 'size', 'gravity', 'bounce'];

const LAB_SCENES = {
  triple: lab('Core splits every ball into 3', 'Multiply & split',
    { arena: 'circle', core: 0.16, coreShape: 'tri', coreSpin: 0.8, coreAction: 'split', coreN: 3, spread: 70, childScale: 0.93, minR: 0.009, size: 0.03, speed: 1.6, angle: 75, max: 729 },
    ['arena', 'core', 'coreShape', 'coreSpin', 'coreAction', 'coreN', 'spread', 'childScale', 'max', 'wall', ...PHYS], (P) => `hit the core: 1 ball → ${P.coreN}`),
  boxcore: lab('Square core in a tall box', 'Multiply & split',
    { arena: 'box', core: 0.2, coreShape: 'square', coreSpin: 0.5, coreAction: 'split', coreN: 2, spread: 40, size: 0.026, speed: 1.8, angle: 70, max: 512, childScale: 0.97 },
    ['arena', 'core', 'coreShape', 'coreSpin', 'coreAction', 'coreN', 'spread', 'childScale', 'max', 'wall', ...PHYS], (P) => `hit the core: 1 → ${P.coreN}`),
  shatter: lab('Grenade: every hit shatters into 3', 'Multiply & split',
    { arena: 'box', wall: 'split', wallN: 3, spread: 80, childScale: 0.86, minR: 0.022, size: 0.16, speed: 1.5, angle: 60, gravity: 0, collide: true, ballBounce: 0.95, ballSound: false, max: 500, ballStyle: 'gem' },
    ['arena', 'wallN', 'spread', 'childScale', 'max', 'collide', 'ballStyle', ...PHYS], (P) => `every bounce: 1 → ${P.wallN} pieces`),
  escapeplus: lab('Escape & multiply (fill the screen)', 'Multiply & split',
    { arena: 'circle', arenaSize: 0.62, gap: 55, gapSpin: 0.7, escape: 'multiply', escapeN: 3, outGravity: 2.6, size: 0.026, speed: 2.2, collide: true, ballBounce: 0.55, ballSound: false, max: 700 },
    ['arenaSize', 'gap', 'gapSpin', 'escapeN', 'outGravity', 'max', ...PHYS], (P) => `every escape: +${P.escapeN} balls`),
  chain: lab('Chain reaction: every touch makes a ball', 'Multiply & split',
    { arena: 'stadium', balls: 3, size: 0.045, speed: 1.9, collide: true, ballAction: 'clone', ballBounce: 1, max: 420 },
    ['arena', 'balls', 'max', ...PHYS], 'two balls touch → a new ball'),
  mitosis: lab('Cells divide on the beat', 'Multiply & split',
    { arena: 'box', balls: 1, size: 0.17, speed: 0, divide: 2, childScale: 0.86, collide: true, ballBounce: 0.1, drag: 2.5, ballSound: false, wallSound: false, max: 700, ballStyle: 'cell', minR: 0.012 },
    ['arena', 'divide', 'childScale', 'max', 'drag', 'ballStyle'], (P) => `every ${P.divide} beats: 1 cell → 2`, 'cells'),
  galton: lab('Galton board (bell curve)', 'Fill the screen',
    { arena: 'box', balls: 0, pegs: 'galton', rows: 12, pegSize: 0.016, bins: true, gravity: 3.2, size: 0.017, bounce: 0.4, pegBounce: 0.45, pegJitter: 14, collide: true, ballBounce: 0.15, ballSound: false, wallSound: false, emit: 1, emitEvery: 0.125, emitMax: 420, emitSpeed: 0.2, emitSpread: 0.01, colorEvery: 42, emitSound: false, max: 900 },
    ['rows', 'pegSize', 'emit', 'emitEvery', 'emitMax', 'colorEvery', 'size', 'gravity'], 'left or right, 50/50 at every peg', 'balls'),
  pyramid: lab('Pyramid cascade', 'Fill the screen',
    { arena: 'box', balls: 0, pegs: 'triangles', rows: 5, gravity: 3, size: 0.02, bounce: 0.35, pegBounce: 0.3, pegJitter: 10, collide: true, ballBounce: 0.12, ballSound: false, wallSound: false, emit: 1, emitEvery: 0.25, emitRamp: 12, emitMax: 650, emitSpeed: 0.15, emitSpread: 0.03, colorEvery: 50, emitSound: false, max: 900 },
    ['rows', 'emit', 'emitEvery', 'emitMax', 'colorEvery', 'emitRamp', 'size', 'gravity'], 'drop, slide, pile up', 'balls'),
  beatfill: lab('Beat fill: drops on the beat, new colour every bar', 'Fill the screen',
    { arena: 'stadium', balls: 0, gravity: 3, size: 0.03, bounce: 0.3, collide: true, ballBounce: 0.1, drag: 0.4, ballSound: false, wallSound: false, emit: 1, emitEvery: 0.5, emitRamp: 8, emitMax: 520, emitSpeed: 0.3, emitSpread: 0.3, colorEvery: 24, max: 900 },
    ['arena', 'emit', 'emitEvery', 'emitRamp', 'emitMax', 'colorEvery', 'size', 'gravity'], 'one drop per beat, more every bar', 'balls'),
  pachinko: lab('Pachinko rain', 'Fill the screen',
    { arena: 'box', balls: 0, pegs: 'grid', rows: 9, pegSize: 0.014, gravity: 2.6, size: 0.016, bounce: 0.5, pegBounce: 0.55, pegJitter: 20, collide: true, ballBounce: 0.2, ballSound: false, wallSound: false, emit: 3, emitEvery: 0.25, emitMax: 700, emitSpeed: 0.2, emitSpread: 1.6, colorEvery: 50, emitSound: false, max: 900 },
    ['rows', 'pegSize', 'emit', 'emitEvery', 'emitMax', 'colorEvery', 'size', 'gravity'], 'every pin: a note', 'balls'),
  hexagon: lab('Ball in a spinning hexagon', 'Bounce & draw',
    { arena: 'poly', sides: 6, spin: 0.7, gravity: 2.6, size: 0.04, speed: 1.2, bounce: 0.97, ink: true, wall: 'recolor' },
    ['sides', 'spin', 'gap', 'gapSpin', 'balls', 'wall', 'ink', ...PHYS], (P) => `${P.sides} walls spinning, gravity on`),
  shrink: lab('Shrinking arena', 'Bounce & draw',
    { arena: 'circle', shrink: 0.006, minSize: 0.25, speedGain: 1.012, maxSpeed: 6, size: 0.03, speed: 1.4, ink: true, balls: 2 },
    ['arena', 'shrink', 'balls', 'speedGain', 'ink', ...PHYS], 'every hit: the wall closes in'),
  billiard: lab('Billiard in a square (lines fill it)', 'Bounce & draw',
    { arena: 'square', size: 0.02, speed: 2.4, angle: 37.5, ink: true, balls: 1 },
    ['arena', 'angle', 'balls', 'ink', ...PHYS], (P) => `launch at ${P.angle}°, no friction`),
  colorwar: lab('Colour war: who takes over?', 'Battles & growth',
    { arena: 'box', balls: 64, teams: 4, size: 0.035, speed: 1.4, collide: true, ballAction: 'infect', ballBounce: 1, max: 400 },
    ['teams', 'balls', 'arena', ...PHYS], 'the faster ball paints the other'),
  growpack: lab('Grow until jammed', 'Battles & growth',
    { arena: 'stadium', balls: 10, size: 0.02, speed: 1.5, wall: 'grow', grow: 0.006, collide: true, ballBounce: 0.95, maxR: 0.4 },
    ['arena', 'balls', 'grow', ...PHYS], 'every bounce: grow a little'),
  coral: lab('Coral (balls stick and grow a reef)', 'Battles & growth',
    { arena: 'box', walkers: 44, seed: 'floor', size: 0.012, speed: 2.6, jitter: 3, collide: true, ballAction: 'stick', max: 1000, wallSound: false },
    ['walkers', 'size', 'speed', 'jitter', 'max'], 'wander, touch, stick', 'stuck'),
  snowflake: lab('Crystal from the centre', 'Battles & growth',
    { arena: 'circle', walkers: 60, seed: 'center', size: 0.011, speed: 3, jitter: 2.2, collide: true, ballAction: 'stick', max: 1100, wallSound: false },
    ['walkers', 'size', 'speed', 'jitter', 'max'], 'wander, touch, stick', 'stuck'),
};

/* ================================================================ registry */

export const SCENES = {
  ...LAB_SCENES,
  paper, radar, chaos, phyllo, packing, pendulum, dna, harmono, orbits, sorting, tree, times, polygons, spiro,
  ...BATTLES,
  ...CYMATICS,
  ...WAVES,
  ...FOURIER_DRAW,
  ...CALCULUS,
  ...PI_SCENES,
  ...FRACTALS,
  ...THEORY,
  harmonograph,
  spirograph,
  guilloche,
};

/** Settings of a scene: its defaults, overridden by what the user / preset set. */
export function sceneParams(cfg) {
  const sc = SCENES[cfg.rule];
  return sc ? { ...sc.defaults, ...(cfg.lab?.[cfg.rule] || {}) } : null;
}
