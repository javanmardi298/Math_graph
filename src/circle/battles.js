/**
 * Battles and blades: Circle Lab scenes where two or more kinds of things fight, and
 * sharp things meet round things. Every one of them runs on a formula you can edit:
 *
 *   rps       rock, paper, scissors (or + lizard, Spock): a beats b ⇔ (a − b) mod n is odd;
 *             each one chases its prey, runs from its hunter and drifts in a flow field
 *             v = (fx(x, y, t), fy(x, y, t)); the loser joins the winner's team
 *   predator  scissors vs flowers (or needles vs bubbles): flowers multiply, scissors cut
 *             them, eat to split and starve to death: the Lotka–Volterra equations
 *             F′ = αF(1 − F/K) − βFS, S′ = δβFS − γS played out by agents, with a live graph
 *   slicer    a blade moving along a(t), x(t), y(t) cuts every ball it crosses in two
 *   knives    knives thrown on the beat into a target spinning at ω(t, n)
 *   popper    a spiky star follows the curve (x(t), y(t)) through a field of balloons:
 *             what is left draws the curve (rose, heart, spiral …)
 *
 * Same contract as scenes.js; deterministic, no DOM.
 */
import { tryCompile } from '../math/parser.js';
import { hexA } from './palettes.js';
import { drawScissors, drawRock, drawPaper, drawLizard, drawSpock, drawFlower, drawBubble, drawNeedle, drawKnife, drawBalloon } from './icons.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wrapPi = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

/** Compile a formula once; a bad formula or a non-finite value gives `fallback`. */
function formula(src, vars, fallback = 0) {
  const c = tryCompile(String(src ?? ''), vars);
  if (!c.ok) return () => fallback;
  return (scope) => { const v = c.fn(scope); return Number.isFinite(v) ? v : fallback; };
}

/** The error of a formula ('' when it is fine), for the panel. */
export function formulaError(src, vars) {
  const c = tryCompile(String(src ?? ''), vars);
  return c.ok ? '' : c.error;
}

/** "cos(4*t)*sin(t)" → "cos(4t)·sin(t)" for the on-screen title line. */
export const pretty = (s) => String(s).replace(/\^2\b/g, '²').replace(/\^3\b/g, '³').replace(/(\d)\s*\*\s*([a-zπφ])(?![a-z(])/gi, '$1$2').replace(/\*/g, '·').replace(/\bpi\b/g, 'π').replace(/\bphi\b/g, 'φ').replace(/\s+/g, ' ').trim();

function glowDot(g, x, y, r, color, k, blur = 16) {
  g.fillStyle = color; g.shadowColor = color; g.shadowBlur = blur * k;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.shadowBlur = 0;
}

/** Keep a mover inside the arena (circle of radius R or square of half-side R); bounce. */
function contain(a, rad, arena, R) {
  if (arena === 'square') {
    const m = R - rad;
    if (a.x > m) { a.x = m; a.vx = -Math.abs(a.vx); } else if (a.x < -m) { a.x = -m; a.vx = Math.abs(a.vx); }
    if (a.y > m) { a.y = m; a.vy = -Math.abs(a.vy); } else if (a.y < -m) { a.y = -m; a.vy = Math.abs(a.vy); }
    return;
  }
  const d = Math.hypot(a.x, a.y), m = R - rad;
  if (d > m && d > 0) {
    const nx = a.x / d, ny = a.y / d;
    a.x = nx * m; a.y = ny * m;
    const vn = a.vx * nx + a.vy * ny;
    if (vn > 0) { a.vx -= 2 * vn * nx; a.vy -= 2 * vn * ny; }
  }
}

function drawArena(D, arena, R) {
  const { g, pal, k } = D;
  g.strokeStyle = pal.ring; g.lineWidth = (D.look.ringWidth ?? 5) * k * 0.8;
  g.shadowColor = pal.glow; g.shadowBlur = 18 * k * (D.look.glow ?? 1);
  g.beginPath();
  if (arena === 'square') g.rect(D.X(-R), D.Y(R), 2 * R * D.R, 2 * R * D.R);
  else g.arc(D.X(0), D.Y(0), R * D.R, 0, TAU);
  g.stroke();
  g.shadowBlur = 0;
  g.fillStyle = hexA(pal.glow, 0.05);
  g.fill();
}

/** Record counts every 0.2 s for the live graph. */
function record(S, values) {
  const sc = S.sc;
  if (S.t >= (sc.nextRec ?? 0)) { sc.hist.push(values); sc.nextRec = S.t + 0.2; if (sc.hist.length > 2000) sc.hist.shift(); }
}

/**
 * Live graph in the strip under the arena: stacked shares (who is winning) or lines
 * (each series scaled to its own maximum).
 */
function drawGraph(D, S, colors, { stacked = false, labels = [] } = {}) {
  const { g, k } = D;
  const top = -1.04, bottom = -S.W.hh * 0.985;
  if (top - bottom < 0.06) return;
  const hist = S.sc.hist;
  const x0 = -S.W.hw * 0.97, x1 = S.W.hw * 0.97;
  g.fillStyle = 'rgba(255,255,255,0.05)';
  g.fillRect(D.X(x0), D.Y(top), (x1 - x0) * D.R, (top - bottom) * D.R);
  if (hist.length < 2) return;
  const n = hist.length, X = (i) => D.X(x0 + ((x1 - x0) * i) / Math.max(1, n - 1));
  if (stacked) {
    const series = colors.length;
    const tot = hist.map((h) => h.reduce((a, b) => a + b, 0) || 1);
    let below = hist.map(() => 0);
    for (let s = 0; s < series; s++) {
      const above = hist.map((h, i) => below[i] + h[s] / tot[i]);
      g.beginPath();
      above.forEach((v, i) => (i ? g.lineTo(X(i), D.Y(bottom + (top - bottom) * v)) : g.moveTo(X(i), D.Y(bottom + (top - bottom) * v))));
      for (let i = n - 1; i >= 0; i--) g.lineTo(X(i), D.Y(bottom + (top - bottom) * below[i]));
      g.closePath();
      g.fillStyle = hexA(colors[s], 0.85); g.fill();
      below = above;
    }
  } else {
    colors.forEach((c, s) => {
      const mx = Math.max(1, ...hist.map((h) => h[s]));
      g.strokeStyle = c; g.lineWidth = 2.5 * k; g.lineJoin = 'round';
      g.shadowColor = c; g.shadowBlur = 8 * k;
      g.beginPath();
      hist.forEach((h, i) => { const y = D.Y(bottom + (top - bottom) * 0.9 * (h[s] / mx)); i ? g.lineTo(X(i), y) : g.moveTo(X(i), y); });
      g.stroke(); g.shadowBlur = 0;
      if (labels[s]) {
        g.fillStyle = c; g.font = `600 ${15 * k}px ui-monospace, monospace`; g.textAlign = 'right'; g.textBaseline = 'top';
        g.fillText(labels[s], D.X(x1) - 6 * k, D.Y(top) + 4 * k + s * 18 * k);
      }
    });
  }
}

/* ======================================================= rock paper scissors */

export const RPS_NAMES = ['rock', 'paper', 'scissors', 'spock', 'lizard'];
const RPS_COLORS = ['#ff8a3d', '#4dc3ff', '#ff4d8d', '#b07bff', '#3fe07a'];
/** a beats b ⇔ (a − b) mod n is odd (n = 3: paper > rock > scissors > paper; n = 5 adds Spock and lizard). */
export const beats = (a, b, n) => ((((a - b) % n) + n) % n) % 2 === 1;

function drawRpsIcon(g, type, x, y, a, s, time, id) {
  const c = RPS_COLORS[type];
  switch (type) {
    case 0: drawRock(g, x, y, a, s, c, id + 1); break;
    case 1: drawPaper(g, x, y, a * 0.3, s, c); break;
    case 2: drawScissors(g, x - Math.cos(a) * s * 0.3, y - Math.sin(a) * s * 0.3, a, s * 0.62, 0.12 + 0.22 * Math.abs(Math.sin(time * 9 + id)), c); break;
    case 3: drawSpock(g, x, y, a * 0.2, s, c); break;
    default: drawLizard(g, x, y, a, s, c, time + id);
  }
}

const rps = {
  label: 'Rock, paper, scissors battle', group: 'Battles & formulas',
  defaults: { kinds: 3, each: 20, speed: 0.3, chase: '0.1 + 0.03*t', flee: 1.2, size: 0.11, arena: 'circle', flowX: '-y', flowY: 'x', flow: 0 },
  controls: [
    ['kinds', 'Teams', 's', { 3: 'Rock, paper, scissors', 5: '+ Spock and lizard' }],
    ['each', 'Of each at the start', 'r', 2, 60, 1], ['speed', 'Speed', 'r', 0.1, 1.5, 0.01], ['chase', 'Chase prey c(t)', 'f', '0.1 + 0.03*t', ['t']], ['flee', 'Run from danger', 'r', 0, 3, 0.05],
    ['size', 'Size', 'r', 0.03, 0.16, 0.001], ['arena', 'Arena', 's', { circle: 'Circle', square: 'Square' }],
    ['flowX', 'Flow field: x speed (x, y, t)', 'f', '-y', ['x', 'y', 't']], ['flowY', 'Flow field: y speed (x, y, t)', 'f', 'x', ['x', 'y', 't']], ['flow', 'Flow strength', 'r', 0, 2, 0.01],
  ],
  init(S, P) {
    const n = P.kinds == 5 ? 5 : 3;
    const a = [];
    let id = 0;
    for (let t = 0; t < n; t++) {
      const home = Math.PI / 2 + (t * TAU) / n;
      for (let i = 0; i < Math.max(1, P.each | 0); i++) {
        const ang = home + (S.rand() - 0.5) * (TAU / n) * 0.8, r = 0.35 + 0.5 * Math.sqrt(S.rand());
        const dir = S.rand() * TAU;
        a.push({ id: id++, type: t, x: Math.cos(ang) * r * 0.9, y: Math.sin(ang) * r * 0.9, vx: Math.cos(dir) * P.speed, vy: Math.sin(dir) * P.speed, rot: S.rand() * TAU, flash: -9, tx: 0, ty: 0 });
      }
    }
    S.sc = { a, n, hist: [], steer: 0, done: false, fc: formula(P.chase, ['t'], 0.5), fx: formula(P.flowX, ['x', 'y', 't']), fy: formula(P.flowY, ['x', 'y', 't']), boom: [] };
  },
  counts(S) { const c = new Array(S.sc.n).fill(0); for (const a of S.sc.a) c[a.type]++; return c; },
  step(S, P, dt, emit) {
    const sc = S.sc, A = sc.a, n = sc.n, R = 0.97, cr = P.size * 0.42;
    if (--sc.steer <= 0) {
      sc.steer = 5;
      const chase = sc.fc({ t: S.st });
      for (const a of A) {
        let prey = null, pd = Infinity, thr = null, td = Infinity;
        for (const b of A) {
          if (b.type === a.type) continue;
          const d = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
          if (beats(a.type, b.type, n)) { if (d < pd) { pd = d; prey = b; } } else if (d < td) { td = d; thr = b; }
        }
        let dx = 0, dy = 0;
        if (prey) { const d = Math.sqrt(pd) || 1; dx += (chase * (prey.x - a.x)) / d; dy += (chase * (prey.y - a.y)) / d; }
        if (thr) { const d = Math.sqrt(td) || 1, w = Math.max(0, 1 - d / 0.7); dx -= (P.flee * w * (thr.x - a.x)) / d; dy -= (P.flee * w * (thr.y - a.y)) / d; }
        if (P.flow) { const s = { x: a.x, y: a.y, t: S.st }; dx += P.flow * sc.fx(s); dy += P.flow * sc.fy(s); }
        dx += (S.rand() - 0.5) * 0.6; dy += (S.rand() - 0.5) * 0.6;
        const L = Math.hypot(dx, dy) || 1;
        a.tx = (dx / L) * P.speed; a.ty = (dy / L) * P.speed;
      }
    }
    for (const a of A) {
      a.vx += (a.tx - a.vx) * Math.min(1, dt * 3); a.vy += (a.ty - a.vy) * Math.min(1, dt * 3);
      a.x += a.vx * dt; a.y += a.vy * dt;
      a.rot += dt * 0.8 * (a.id % 2 ? 1 : -1);
      contain(a, cr, P.arena, R);
    }
    for (let i = 0; i < A.length; i++) {
      const a = A[i];
      for (let j = i + 1; j < A.length; j++) {
        const b = A[j];
        const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 >= 4 * cr * cr) continue;
        const d = Math.sqrt(d2) || 1e-6, push = (2 * cr - d) / 2;
        a.x -= (dx / d) * push; a.y -= (dy / d) * push; b.x += (dx / d) * push; b.y += (dy / d) * push;
        if (a.type === b.type) continue;
        const win = beats(a.type, b.type, n) ? a : b, lose = win === a ? b : a;
        lose.type = win.type; lose.flash = S.t;
        sc.boom.push({ x: lose.x, y: lose.y, t: S.t, type: win.type });
        emit({ type: 'hit', ball: win.type, x: lose.x, y: lose.y, angle: Math.atan2(lose.y, lose.x), pitch: win.type / n, balls: A.length });
      }
    }
    sc.boom = sc.boom.filter((b) => S.t - b.t < 0.6);
    const c = this.counts(S);
    record(S, c);
    if (!sc.done && c.some((v) => v === A.length)) { sc.done = true; sc.winner = c.findIndex((v) => v === A.length); emit({ type: 'fill', ball: sc.winner, x: 0, y: 0, angle: 0 }); }
  },
  draw(S, P, D) {
    const { g, k, time } = D;
    const sc = S.sc;
    drawArena(D, P.arena, 0.97);
    drawGraph(D, S, RPS_COLORS.slice(0, sc.n), { stacked: true });
    const s = P.size * D.R * (D.look.ballSize ?? 1);
    for (const b of sc.boom) {
      const age = (time - b.t) / 0.6;
      g.globalAlpha = 1 - age; g.strokeStyle = RPS_COLORS[b.type]; g.lineWidth = 3 * k;
      g.beginPath(); g.arc(D.X(b.x), D.Y(b.y), s * (0.4 + age * 1.2), 0, TAU); g.stroke();
    }
    g.globalAlpha = 1;
    for (const a of sc.a) {
      const x = D.X(a.x), y = D.Y(a.y);
      const fl = Math.max(0, 1 - (time - a.flash) / 0.35);
      const pop = 1 + 0.35 * fl;
      if (fl > 0) { g.fillStyle = hexA(RPS_COLORS[a.type], 0.5 * fl); g.beginPath(); g.arc(x, y, s * 0.62 * pop, 0, TAU); g.fill(); }
      drawRpsIcon(g, a.type, x, y, -Math.atan2(a.vy, a.vx) * 0.25 + a.rot * 0.15, s * pop, time, a.id);
    }
    if (sc.done) {
      const age = time - (sc.doneT ??= time);
      g.globalAlpha = Math.max(0, 0.3 - age * 0.2);
      g.fillStyle = RPS_COLORS[sc.winner];
      g.beginPath(); g.arc(D.X(0), D.Y(0), 0.97 * D.R, 0, TAU); g.fill();
      g.globalAlpha = 1;
    }
  },
  stats(S) { return this.counts(S).map((c, i) => `${RPS_NAMES[i]} ${c}`).join(' · '); },
  formula: (P) => (P.flow ? `v = chase + ${P.flow}·(${pretty(P.flowX)}, ${pretty(P.flowY)})` : `a beats b ⇔ (a − b) mod ${P.kinds == 5 ? 5 : 3} is odd`),
};

/* ============================================ predator and prey (scissors vs flowers) */

const THEMES = {
  garden: { prey: 'flowers', hunter: 'scissors', preyColor: '#5cff8a', hunterColor: '#ff5c8a' },
  bubbles: { prey: 'bubbles', hunter: 'needles', preyColor: '#5cd6ff', hunterColor: '#ffd25c' },
};

const predator = {
  label: 'Scissors vs flowers (predator & prey)', group: 'Battles & formulas',
  defaults: { theme: 'garden', flowers: 40, hunters: 2, alpha: 0.7, cap: 200, gamma: 0.14, delta: 0.22, speed: 0.5, size: 0.1 },
  controls: [
    ['theme', 'Who', 's', { garden: 'Scissors vs flowers', bubbles: 'Needles vs bubbles' }],
    ['flowers', 'Flowers at the start', 'r', 1, 150, 1], ['hunters', 'Hunters at the start', 'r', 1, 20, 1],
    ['alpha', 'α: flowers multiply (per second)', 'r', 0, 2, 0.01], ['cap', 'K: most flowers', 'r', 20, 500, 1],
    ['gamma', 'γ: hunters get tired (per second)', 'r', 0, 1, 0.005], ['delta', 'δ: energy per cut (2 = split)', 'r', 0.05, 1, 0.01],
    ['speed', 'Hunter speed', 'r', 0.1, 2, 0.01], ['size', 'Size', 'r', 0.03, 0.16, 0.001],
  ],
  init(S, P) {
    const fl = [], hu = [];
    for (let i = 0; i < Math.max(1, P.flowers | 0); i++) fl.push(this.flower(S, null));
    for (let i = 0; i < Math.max(1, P.hunters | 0); i++) hu.push(this.hunter(S, P));
    S.sc = { fl, hu, cuts: [], dead: [], hist: [], steer: 0, lastEmpty: { h: -9, f: -9 }, born: 0 };
  },
  flower(S, near) {
    let x, y;
    for (let i = 0; i < 12; i++) {
      if (near) { const a = S.rand() * TAU, d = 0.1 + 0.1 * S.rand(); x = near.x + Math.cos(a) * d; y = near.y + Math.sin(a) * d; } else { const a = S.rand() * TAU, r = 0.92 * Math.sqrt(S.rand()); x = Math.cos(a) * r; y = Math.sin(a) * r; }
      if (Math.hypot(x, y) < 0.92) break;
    }
    const r = Math.hypot(x, y);
    if (r > 0.92) { x *= 0.92 / r; y *= 0.92 / r; }
    return { x, y, hue: S.rand(), rot: S.rand() * TAU, petals: 5 + Math.floor(S.rand() * 3), born: S.t };
  },
  hunter(S, P, from) {
    const a = S.rand() * TAU;
    const x = from ? from.x : Math.cos(a) * 0.9, y = from ? from.y : Math.sin(a) * 0.9;
    return { x, y, vx: 0, vy: 0, tx: 0, ty: 0, E: from ? from.E : 0.7, born: S.t, ang: a + Math.PI, id: (S.sc?.born ?? 0) + Math.floor(S.rand() * 1e6) };
  },
  step(S, P, dt, emit) {
    const sc = S.sc, R = 0.97, reach = P.size * 0.5;
    // flowers multiply: logistic growth α·F·(1 − F/K)
    const F = sc.fl.length, p = P.alpha * dt * Math.max(0, 1 - F / P.cap);
    const babies = [];
    for (const f of sc.fl) if (S.rand() < p) babies.push(this.flower(S, f));
    sc.fl.push(...babies);
    // hunters steer to the nearest flower
    if (--sc.steer <= 0) {
      sc.steer = 4;
      for (const h of sc.hu) {
        let best = null, bd = Infinity;
        for (const f of sc.fl) { const d = (f.x - h.x) ** 2 + (f.y - h.y) ** 2; if (d < bd) { bd = d; best = f; } }
        let dx = best ? best.x - h.x : -h.x, dy = best ? best.y - h.y : -h.y;
        dx += (S.rand() - 0.5) * 0.3; dy += (S.rand() - 0.5) * 0.3;
        const L = Math.hypot(dx, dy) || 1;
        h.tx = (dx / L) * P.speed; h.ty = (dy / L) * P.speed;
      }
    }
    const born = [];
    for (const h of sc.hu) {
      h.vx += (h.tx - h.vx) * Math.min(1, dt * 4); h.vy += (h.ty - h.vy) * Math.min(1, dt * 4);
      h.x += h.vx * dt; h.y += h.vy * dt;
      if (Math.hypot(h.vx, h.vy) > 0.05) h.ang = Math.atan2(h.vy, h.vx);
      contain(h, reach, 'circle', R);
      h.E -= P.gamma * dt;
      for (let i = sc.fl.length - 1; i >= 0; i--) {
        const f = sc.fl[i];
        if ((f.x - h.x) ** 2 + (f.y - h.y) ** 2 > reach * reach * 1.6) continue;
        sc.fl.splice(i, 1);
        sc.cuts.push({ x: f.x, y: f.y, t: S.t, hue: f.hue, rot: f.rot });
        h.E += P.delta; h.snap = S.t;
        emit({ type: 'hit', ball: 0, x: f.x, y: f.y, angle: Math.atan2(f.y, f.x), pitch: 0.35 + 0.6 * f.hue, balls: sc.fl.length });
        if (h.E >= 1.4) {
          h.E /= 2;
          const kid = this.hunter(S, P, h);
          kid.x += 0.04; kid.ang = h.ang + 1;
          born.push(kid);
          emit({ type: 'hit', ball: 1, x: h.x, y: h.y, angle: 0, pitch: 1, balls: sc.hu.length + 1 });
        }
        break;
      }
    }
    // hunters keep a little distance from each other
    for (let i = 0; i < sc.hu.length; i++) for (let j = i + 1; j < sc.hu.length; j++) {
      const a = sc.hu[i], b = sc.hu[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = P.size * 0.9;
      if (d < m && d > 1e-6) { const p = (m - d) / 2; a.x -= (dx / d) * p; a.y -= (dy / d) * p; b.x += (dx / d) * p; b.y += (dy / d) * p; }
    }
    for (const h of sc.hu) if (h.E <= 0) { sc.dead.push({ ...h, t: S.t }); emit({ type: 'hit', ball: 2, x: h.x, y: h.y, angle: 0, pitch: 0, balls: 0 }); }
    sc.hu = sc.hu.filter((h) => h.E > 0).concat(born);
    // nobody left? a new one arrives a little later, so the cycle goes on
    if (!sc.hu.length) { if (S.t - sc.lastEmpty.h > 2.5 && sc.lastEmpty.h > 0) { sc.hu.push(this.hunter(S, P)); sc.lastEmpty.h = -9; } else if (sc.lastEmpty.h < 0) sc.lastEmpty.h = S.t; }
    if (!sc.fl.length) { if (S.t - sc.lastEmpty.f > 2 && sc.lastEmpty.f > 0) { for (let i = 0; i < 3; i++) sc.fl.push(this.flower(S, null)); sc.lastEmpty.f = -9; } else if (sc.lastEmpty.f < 0) sc.lastEmpty.f = S.t; }
    sc.cuts = sc.cuts.filter((c) => S.t - c.t < 0.9);
    sc.dead = sc.dead.filter((c) => S.t - c.t < 1.5);
    record(S, [sc.fl.length, sc.hu.length]);
  },
  draw(S, P, D) {
    const { g, k, time } = D;
    const sc = S.sc, th = THEMES[P.theme] || THEMES.garden, s = P.size * D.R * (D.look.ballSize ?? 1);
    drawArena(D, 'circle', 0.97);
    drawGraph(D, S, [th.preyColor, th.hunterColor], { labels: [th.prey, th.hunter] });
    for (const f of sc.fl) {
      const bloom = clamp((time - f.born) / 0.5, 0, 1);
      const col = `hsl(${(P.theme === 'bubbles' ? 180 : 300) + 90 * f.hue} 90% 66%)`;
      if (P.theme === 'bubbles') drawBubble(g, D.X(f.x), D.Y(f.y), s * 0.45 * (0.3 + 0.7 * bloom), col);
      else drawFlower(g, D.X(f.x), D.Y(f.y), f.rot + Math.sin(time * 1.5 + f.hue * 9) * 0.08, s, col, 0.2 + 0.8 * bloom ** 0.6, f.petals);
    }
    for (const c of sc.cuts) {
      const age = (time - c.t) / 0.9;
      const col = `hsl(${(P.theme === 'bubbles' ? 180 : 300) + 90 * c.hue} 90% 70%)`;
      g.globalAlpha = 1 - age; g.fillStyle = col;
      for (let i = 0; i < 7; i++) {
        const a = c.rot + (i / 7) * TAU, d = s * (0.2 + age * 1.3);
        g.save(); g.translate(D.X(c.x) + Math.cos(a) * d, D.Y(c.y) + Math.sin(a) * d + age * age * s);
        g.rotate(a + age * 5); g.beginPath(); g.ellipse(0, 0, s * 0.16, s * 0.07, 0, 0, TAU); g.fill(); g.restore();
      }
    }
    g.globalAlpha = 1;
    for (const h of sc.dead) {
      const age = (time - h.t) / 1.5;
      g.globalAlpha = 1 - age;
      this.drawHunter(g, P, D.X(h.x), D.Y(h.y) + age * age * 120 * k, -h.ang + age * 4, s, '#777', 0.05);
    }
    g.globalAlpha = 1;
    for (const h of sc.hu) {
      const snap = Math.max(0, 1 - (time - (h.snap ?? -9)) / 0.25);
      const x = D.X(h.x), y = D.Y(h.y);
      // energy ring: full = about to split, empty = about to starve
      g.strokeStyle = hexA(th.hunterColor, 0.15); g.lineWidth = 2 * k;
      g.beginPath(); g.arc(x, y, s * 0.75, 0, TAU); g.stroke();
      g.strokeStyle = hexA(th.hunterColor, 0.7); g.beginPath(); g.arc(x, y, s * 0.75, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(h.E / 1.4, 0, 1)); g.stroke();
      this.drawHunter(g, P, x, y, -h.ang, s, th.hunterColor, 0.08 + 0.32 * (snap > 0 ? 1 - snap : Math.abs(Math.sin(time * 8 + h.id))));
    }
  },
  drawHunter(g, P, x, y, a, s, color, open) {
    if (P.theme === 'bubbles') drawNeedle(g, x, y, a, s * 1.1, color);
    else drawScissors(g, x - Math.cos(a) * s * 0.3, y - Math.sin(a) * s * 0.3, a, s * 0.7, open, color);
  },
  stats(S, P) { const th = THEMES[P.theme] || THEMES.garden; return `${th.prey} ${S.sc.fl.length} · ${th.hunter} ${S.sc.hu.length}`; },
  formula: () => 'F′ = αF − βFS,  S′ = δFS − γS',
};

/* =================================================================== slicer */

const slicer = {
  label: 'Blade slices every ball in half', group: 'Battles & formulas',
  defaults: { balls: 5, size: 0.17, speed: 0.55, minR: 0.022, max: 500, ba: '1.1*t', bx: '0', by: '0', len: 1.9, blades: 1, arena: 'circle' },
  controls: [
    ['ba', 'Blade angle a(t)', 'f', '1.1*t', ['t']], ['bx', 'Blade centre x(t)', 'f', '0.5*sin(2*t)', ['t']], ['by', 'Blade centre y(t)', 'f', '0.5*sin(3*t)', ['t']],
    ['len', 'Blade length', 'r', 0.3, 2.4, 0.01], ['blades', 'Blades', 'r', 1, 6, 1],
    ['balls', 'Balls at the start', 'r', 1, 40, 1], ['size', 'Ball size', 'r', 0.04, 0.4, 0.005], ['speed', 'Ball speed', 'r', 0, 2, 0.01],
    ['minR', 'Smallest piece', 'r', 0.005, 0.1, 0.001], ['max', 'Most pieces', 'r', 10, 1500, 1], ['arena', 'Arena', 's', { circle: 'Circle', square: 'Square' }],
  ],
  init(S, P) {
    const b = [];
    const n = Math.max(1, P.balls | 0);
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996 + 0.5, r = n === 1 ? 0.5 : 0.25 + 0.5 * Math.sqrt(i / n), d = S.rand() * TAU;
      b.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, vx: Math.cos(d) * P.speed, vy: Math.sin(d) * P.speed, r: P.size * (0.75 + 0.5 * S.rand()), hue: i / n, cutT: -9, gen: 0 });
    }
    S.sc = { b, slices: 0, done: false, fa: formula(P.ba, ['t']), fx: formula(P.bx, ['t']), fy: formula(P.by, ['t']) };
  },
  blades(S, P, t) {
    const sc = S.sc, a = sc.fa({ t }), cx = clamp(sc.fx({ t }), -2, 2), cy = clamp(sc.fy({ t }), -2, 2);
    const n = Math.max(1, P.blades | 0), out = [];
    for (let i = 0; i < n; i++) {
      const ang = a + (i * Math.PI) / n, ux = Math.cos(ang), uy = Math.sin(ang);
      out.push({ ang, x1: cx - (ux * P.len) / 2, y1: cy - (uy * P.len) / 2, x2: cx + (ux * P.len) / 2, y2: cy + (uy * P.len) / 2, ux, uy });
    }
    return out;
  },
  step(S, P, dt, emit) {
    const sc = S.sc;
    const bl = this.blades(S, P, S.st);
    const born = [];
    for (const b of sc.b) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      contain(b, b.r, P.arena, 0.97);
      if (S.t - b.cutT < 0.3 || b.r < P.minR || sc.b.length + born.length >= P.max) continue;
      for (const L of bl) {
        const ex = L.x2 - L.x1, ey = L.y2 - L.y1, k = clamp(((b.x - L.x1) * ex + (b.y - L.y1) * ey) / (ex * ex + ey * ey), 0, 1);
        const d = Math.hypot(b.x - (L.x1 + ex * k), b.y - (L.y1 + ey * k));
        if (d > b.r * 0.8) continue;
        const nx = -L.uy, ny = L.ux, r = b.r / Math.SQRT2;
        const side = Math.sign((b.x - L.x1) * nx + (b.y - L.y1) * ny) || 1;
        const kick = 0.45 + 0.3 * P.speed;
        const c = { x: b.x - nx * r * 0.55, y: b.y - ny * r * 0.55, vx: b.vx * 0.8 - nx * kick, vy: b.vy * 0.8 - ny * kick, r, hue: b.hue + 0.09, cutT: S.t, cutAng: L.ang, side: -1, gen: b.gen + 1 };
        Object.assign(b, { x: b.x + nx * r * 0.55, y: b.y + ny * r * 0.55, vx: b.vx * 0.8 + nx * kick, vy: b.vy * 0.8 + ny * kick, r, hue: b.hue - 0.05, cutT: S.t, cutAng: L.ang, side: 1, gen: b.gen + 1 });
        void side;
        born.push(c);
        sc.slices++;
        emit({ type: 'hit', ball: b.gen, x: b.x, y: b.y, angle: Math.atan2(b.y, b.x), pitch: clamp(1 - r / P.size, 0, 1), balls: sc.b.length + born.length });
        break;
      }
    }
    sc.b.push(...born);
    if (!sc.done && (sc.b.length >= P.max || sc.b.every((b) => b.r < P.minR))) { sc.done = true; emit({ type: 'fill', ball: 0, x: 0, y: 0, angle: 0 }); }
  },
  draw(S, P, D) {
    const { g, pal, k, time } = D;
    const sc = S.sc;
    drawArena(D, P.arena, 0.97);
    // the blade centre's path (the formula) for the last few seconds
    if (P.bx.trim() !== '0' || P.by.trim() !== '0') {
      g.strokeStyle = hexA(pal.ring, 0.35); g.lineWidth = 1.5 * k; g.setLineDash([4 * k, 6 * k]);
      g.beginPath();
      for (let i = 0; i <= 120; i++) { const t = S.st - 4 + (i / 120) * 4; const x = D.X(clamp(sc.fx({ t }), -2, 2)), y = D.Y(clamp(sc.fy({ t }), -2, 2)); i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke(); g.setLineDash([]);
    }
    for (const b of sc.b) {
      const x = D.X(b.x), y = D.Y(b.y), r = Math.max(1.5 * k, b.r * D.R);
      const age = (time - b.cutT) / 0.35;
      const col = pal.line(b.hue);
      const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, col); gr.addColorStop(1, col);
      g.fillStyle = gr;
      if (age < 1) {
        // fresh half: a half disc whose flat side faces the cut, healing into a ball
        const a = -b.cutAng;
        g.beginPath(); g.arc(x, y, r, a + (b.side > 0 ? Math.PI : 0), a + (b.side > 0 ? TAU : Math.PI)); g.closePath(); g.fill();
        g.globalAlpha = age; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.globalAlpha = 1;
        g.strokeStyle = '#ffffff'; g.globalAlpha = 1 - age; g.lineWidth = 2 * k;
        g.beginPath(); g.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke(); g.globalAlpha = 1;
      } else { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    }
    // the blade, with a short motion blur
    for (let ghost = 5; ghost >= 0; ghost--) {
      const bl = this.blades(S, P, S.st - ghost * 0.012);
      for (const L of bl) {
        const nx = -L.uy * 0.018, ny = L.ux * 0.018;
        g.globalAlpha = ghost ? 0.12 : 1;
        g.beginPath();
        g.moveTo(D.X(L.x1), D.Y(L.y1)); g.lineTo(D.X((L.x1 + L.x2) / 2 + nx), D.Y((L.y1 + L.y2) / 2 + ny));
        g.lineTo(D.X(L.x2), D.Y(L.y2)); g.lineTo(D.X((L.x1 + L.x2) / 2 - nx), D.Y((L.y1 + L.y2) / 2 - ny)); g.closePath();
        g.fillStyle = ghost ? pal.glow : '#e9f1ff';
        if (!ghost) { g.shadowColor = pal.glow; g.shadowBlur = 22 * k; }
        g.fill(); g.shadowBlur = 0;
        if (!ghost) { g.strokeStyle = '#ffffff'; g.lineWidth = 1.2 * k; g.beginPath(); g.moveTo(D.X(L.x1), D.Y(L.y1)); g.lineTo(D.X(L.x2), D.Y(L.y2)); g.stroke(); }
      }
    }
    g.globalAlpha = 1;
    const c = this.blades(S, P, S.st)[0];
    glowDot(g, D.X((c.x1 + c.x2) / 2), D.Y((c.y1 + c.y2) / 2), 6 * k, '#ffffff', k, 18);
  },
  stats: (S) => `pieces: ${S.sc.b.length}`,
  formula: (P) => (P.bx.trim() !== '0' || P.by.trim() !== '0' ? `blade at (${pretty(P.bx)}, ${pretty(P.by)})` : `blade angle a = ${pretty(P.ba)}`),
};

/* =================================================================== knives */

const knives = {
  label: 'Knife hit: throw on the beat into a spinning target', group: 'Battles & formulas',
  defaults: { spin: '1.6 + 1.3*sin(0.8*t)', more: 'n + 5', every: 1, gap: 11, size: 0.42, levels: 99 },
  controls: [
    ['spin', 'Target spin ω(t, n) (turns: rad/s)', 'f', '1.6 + 1.3*sin(0.8*t)', ['t', 'n']], ['more', 'Knives in level n', 'f', 'n + 5', ['n']],
    ['every', 'Beats between throws', 'r', 0.25, 4, 0.25], ['gap', 'Bounce off if closer than', 'r', 2, 40, 0.5, '°'], ['size', 'Target size', 'r', 0.2, 0.7, 0.01],
  ],
  init(S, P) {
    S.sc = { n: 1, phi: 0, stuck: [], fly: null, fails: [], bursts: [], next: 0.4, wait: 0, hits: 0, misses: 0, fw: formula(P.spin, ['t', 'n'], 1.5), fc: formula(P.more, ['n'], 6), stickT: -9 };
    S.sc.need = this.need(S, P);
  },
  need(S) { return clamp(Math.round(S.sc.fc({ n: S.sc.n })), 1, 40); },
  geo(S, P) { return { cy: S.W.hh * 0.32, R: P.size, y0: -S.W.hh * 0.78, L: 0.34 }; },
  step(S, P, dt, emit) {
    const sc = S.sc, G = this.geo(S, P), beat = 60 / S.bpm;
    sc.phi += sc.fw({ t: S.st, n: sc.n }) * dt;
    if (sc.wait && S.st >= sc.wait) { sc.wait = 0; sc.n++; sc.need = this.need(S, P); sc.next = S.st + beat * 0.5; }
    if (!sc.fly && !sc.wait && S.st >= sc.next) { sc.fly = { y: G.y0 }; sc.next = Math.max(sc.next + beat * P.every, S.st + 0.1); }
    if (sc.fly) {
      sc.fly.y += 7 * dt;
      const tip = sc.fly.y + G.L * 0.6;
      if (tip >= G.cy - G.R + 0.02) {
        const local = wrapPi(-Math.PI / 2 - sc.phi);
        const gap = (P.gap * Math.PI) / 180;
        if (sc.stuck.some((a) => Math.abs(wrapPi(a - local)) < gap)) {
          sc.misses++;
          sc.fails.push({ t: S.t, y: sc.fly.y, vx: (S.rand() - 0.5) * 1.6, spin: (S.rand() < 0.5 ? -1 : 1) * (6 + 6 * S.rand()) });
          emit({ type: 'hit', ball: 0, x: 0, y: G.cy - G.R, angle: -Math.PI / 2, pitch: 0, balls: sc.stuck.length });
        } else {
          sc.stuck.push(local); sc.hits++; sc.stickT = S.t;
          emit({ type: 'hit', ball: sc.stuck.length, x: 0, y: G.cy - G.R, angle: -Math.PI / 2, pitch: sc.stuck.length / sc.need, balls: sc.stuck.length });
          if (sc.stuck.length >= sc.need) {
            sc.bursts.push({ t: S.t, phi: sc.phi, stuck: sc.stuck.slice(), n: sc.n });
            emit({ type: 'fill', ball: sc.n, x: 0, y: G.cy, angle: 0 });
            sc.stuck = []; sc.wait = S.st + 1.3;
          }
        }
        sc.fly = null;
      }
    }
    sc.fails = sc.fails.filter((f) => S.t - f.t < 1.4);
    sc.bursts = sc.bursts.filter((b) => S.t - b.t < 1.6);
  },
  draw(S, P, D) {
    const { g, pal, k, time } = D;
    const sc = S.sc, G = this.geo(S, P), s = G.L * D.R;
    const cx = D.X(0), cy = D.Y(G.cy), Rp = G.R * D.R;
    const knifeAt = (local, phi, rr = 1) => {
      const th = local + phi, ux = Math.cos(th), uy = Math.sin(th);
      const d = (G.R - 0.06 + G.L * 0.6) * rr;
      drawKnife(g, D.X(ux * d), D.Y(G.cy + uy * d), Math.atan2(uy, -ux), s, pal.line(0.1 + local * 0.05));
    };
    // target (hidden while it bursts)
    if (!sc.wait) {
      const pulse = 1 + 0.05 * Math.max(0, 1 - (time - sc.stickT) / 0.15);
      g.save(); g.translate(cx, cy); g.scale(pulse, pulse); g.translate(-cx, -cy);
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, Rp);
      gr.addColorStop(0, hexA(pal.glow2 || pal.glow, 0.9)); gr.addColorStop(1, hexA(pal.glow, 0.55));
      g.fillStyle = gr; g.shadowColor = pal.glow; g.shadowBlur = 30 * k;
      g.beginPath(); g.arc(cx, cy, Rp, 0, TAU); g.fill(); g.shadowBlur = 0;
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2 * k;
      for (let i = 1; i <= 4; i++) { g.beginPath(); g.arc(cx, cy, (Rp * i) / 4.6, 0, TAU); g.stroke(); }
      for (let i = 0; i < 8; i++) { const a = -(sc.phi + (i * TAU) / 8); g.beginPath(); g.moveTo(cx + Math.cos(a) * Rp * 0.25, cy + Math.sin(a) * Rp * 0.25); g.lineTo(cx + Math.cos(a) * Rp * 0.95, cy + Math.sin(a) * Rp * 0.95); g.stroke(); }
      g.strokeStyle = pal.ring; g.lineWidth = 4 * k; g.beginPath(); g.arc(cx, cy, Rp, 0, TAU); g.stroke();
      g.restore();
      for (const a of sc.stuck) knifeAt(a, sc.phi);
    }
    // bursts: wedges and knives fly apart
    for (const b of sc.bursts) {
      const age = time - b.t, f = age / 1.6;
      g.globalAlpha = Math.max(0, 1 - f);
      for (let i = 0; i < 8; i++) {
        const a = -(b.phi + (i * TAU) / 8 + Math.PI / 8), d = age * 260 * k;
        g.save(); g.translate(cx + Math.cos(a) * d, cy + Math.sin(a) * d + age * age * 300 * k); g.rotate(age * (i % 2 ? 4 : -4));
        g.fillStyle = pal.line(i / 8); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, Rp, -Math.PI / 8, Math.PI / 8); g.closePath(); g.fill();
        g.restore();
      }
      for (const a of b.stuck) knifeAt(a, b.phi + age * 3, 1 + age * 1.5);
      g.globalAlpha = 1;
    }
    // missed knives bounce away
    for (const f of sc.fails) {
      const age = time - f.t;
      g.globalAlpha = Math.max(0, 1 - age / 1.4);
      drawKnife(g, D.X(f.vx * age), D.Y(f.y - 2.5 * age * age + 0.8 * age), -Math.PI / 2 + f.spin * age, s, '#ff4d6d');
      g.globalAlpha = 1;
    }
    // flying / waiting knife
    const ky = sc.fly ? sc.fly.y : G.y0;
    drawKnife(g, D.X(0), D.Y(ky), -Math.PI / 2, s, pal.line(0.1));
    // knives left in this level
    const left = sc.wait ? 0 : sc.need - sc.stuck.length - (sc.fly ? 1 : 0);
    for (let i = 0; i < sc.need; i++) {
      g.globalAlpha = i < left ? 0.9 : 0.15;
      drawKnife(g, D.X(-S.W.hw * 0.86), D.Y(G.y0 + 0.08 + i * 0.07), 0, s * 0.45, pal.line(0.1));
    }
    g.globalAlpha = 1;
  },
  stats: (S) => `level ${S.sc.n} · ${S.sc.stuck.length}/${S.sc.need}`,
  formula: (P) => `ω = ${pretty(P.spin)}`,
};

/* =================================================================== popper */

const popper = {
  label: 'Spike draws a formula through balloons', group: 'Battles & formulas',
  defaults: { x: 'cos(4*t)*cos(t)', y: 'cos(4*t)*sin(t)', rate: 0.22, count: 320, spike: 0.09, points: 6, refill: 0, arena: 'box' },
  controls: [
    ['x', 'Path x(t)', 'f', 'cos(4*t)*cos(t)', ['t']], ['y', 'Path y(t)', 'f', 'cos(4*t)*sin(t)', ['t']], ['rate', 't per second', 'r', 0.02, 2, 0.005],
    ['count', 'Balloons', 'r', 20, 800, 1], ['spike', 'Spike size', 'r', 0.02, 0.25, 0.005], ['points', 'Spike points', 'r', 3, 12, 1],
    ['refill', 'Balloons come back after (s, 0 = never)', 'r', 0, 20, 0.5], ['arena', 'Field', 's', { box: 'Tall box (whole safe area)', circle: 'Circle' }],
  ],
  init(S, P) {
    const { hw, hh } = S.W, box = P.arena !== 'circle';
    const ex = box ? hw * 0.96 : 0.96, ey = box ? hh * 0.96 : 0.96;
    const b = [];
    for (let tries = 0; tries < 9000 && b.length < P.count; tries++) {
      const r = 0.028 + 0.06 * S.rand() ** 1.5;
      const x = (S.rand() * 2 - 1) * (ex - r), y = (S.rand() * 2 - 1) * (ey - r);
      if (!box && Math.hypot(x, y) > 0.96 - r) continue;
      if (b.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + r + 0.004)) continue;
      b.push({ x, y, r, hue: S.rand(), popT: null, id: b.length });
    }
    S.sc = { b, popped: 0, fx: formula(P.x, ['t']), fy: formula(P.y, ['t']), ex, ey, last: null };
    S.sc.last = this.pos(S, 0);
  },
  pos(S, t) { const sc = S.sc; return [clamp(sc.fx({ t }), -1.2, 1.2) * sc.ex * 0.97, clamp(sc.fy({ t }), -1.2, 1.2) * sc.ey * 0.97]; },
  step(S, P, dt, emit) {
    const sc = S.sc;
    const [x, y] = this.pos(S, S.st * P.rate);
    S.addSegment(sc.last[0], sc.last[1], x, y, S.t, S.st * 0.03);
    sc.last = [x, y];
    let sounds = 0;
    for (const b of sc.b) {
      if (b.popT != null) {
        if (P.refill > 0 && S.t - b.popT > P.refill) { b.popT = null; b.back = S.t; }
        continue;
      }
      if ((b.x - x) ** 2 + (b.y - y) ** 2 > (P.spike + b.r * 0.85) ** 2) continue;
      b.popT = S.t; sc.popped++;
      if (sounds++ < 2) emit({ type: 'hit', ball: b.id, x: b.x, y: b.y, angle: Math.atan2(b.y, b.x), pitch: clamp(1 - (b.r - 0.028) / 0.06, 0, 1), balls: sc.popped });
    }
  },
  draw(S, P, D) {
    const { g, pal, k, time } = D;
    const sc = S.sc;
    for (const b of sc.b) {
      const x = D.X(b.x), y = D.Y(b.y), r = b.r * D.R;
      const col = pal.line(b.hue);
      if (b.popT != null) {
        const age = (time - b.popT) / 0.45;
        if (age > 1) continue;
        g.globalAlpha = 1 - age; g.strokeStyle = col; g.lineWidth = 2.5 * k;
        g.beginPath(); g.arc(x, y, r * (1 + age), 0, TAU); g.stroke();
        g.fillStyle = col;
        for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + b.id, d = r * (0.6 + age * 1.6); g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 2.5 * k * (1 - age), 0, TAU); g.fill(); }
        g.globalAlpha = 1;
        continue;
      }
      const grow = b.back ? clamp((time - b.back) / 0.4, 0, 1) : 1;
      drawBalloon(g, x, y, r * 0.88 * grow, col, Math.sin(time * 1.3 + b.id) * 0.08);
    }
    // the spike star
    const [px, py] = sc.last, n = Math.max(3, P.points | 0), R = P.spike * D.R;
    g.save(); g.translate(D.X(px), D.Y(py)); g.rotate(time * 6);
    g.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * TAU, rr = i % 2 ? R * 0.35 : R; i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.closePath();
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, R);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#9aa7c2');
    g.fillStyle = gr; g.shadowColor = pal.glow; g.shadowBlur = 22 * k; g.fill(); g.shadowBlur = 0;
    g.strokeStyle = pal.ring; g.lineWidth = 1.5 * k; g.stroke();
    g.restore();
  },
  stats: (S) => `popped: ${S.sc.popped} / ${S.sc.b.length}`,
  formula: (P) => `x = ${pretty(P.x)},  y = ${pretty(P.y)}`,
};

export const BATTLES = { rps, predator, slicer, knives, popper };
