/**
 * Motion, sync and number scenes for the Circle Lab: simulations where the maths *is* the motion,
 * each with a sound that grows out of it.
 *
 *   kuramoto   fireflies that fall into step (Kuramoto model): dθᵢ/dt = ωᵢ + K·r·sin(ψ − θᵢ)
 *   shepard    the Shepard scale: a chord of octaves that rises forever and never gets higher
 *   threebody  three equal masses on the figure-eight orbit (Chenciner–Montgomery), or Burrau's
 *              3-4-5 problem; a ghost copy with a tiny nudge shows chaos
 *   dpendulum  double pendulums that start a hair apart and fall out of step
 *   primes     the Sacks spiral (r = √n, θ = 2π√n) or Ulam's square spiral of primes
 *   brachisto  beads racing down a line, an arc, a parabola and a cycloid (the cycloid wins), or
 *              the tautochrone: from any height on a cycloid they arrive together
 *
 * Same contract as scenes.js: init / step (emits sound events) / draw / stats / formula.
 */
import { hexA } from './palettes.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const PENT = [0, 2, 4, 7, 9];
const pentMidi = (j, base = 60) => base + 12 * Math.floor(j / 5) + PENT[((j % 5) + 5) % 5];

function glow(g, x, y, r, color, k, blur = 16) {
  g.fillStyle = color; g.shadowColor = color; g.shadowBlur = blur * k;
  g.beginPath(); g.arc(x, y, Math.max(0.5, r), 0, TAU); g.fill();
  g.shadowBlur = 0;
}

/** A Gaussian-ish random number from the scene's seeded random. */
const gauss = (rand) => { let s = 0; for (let i = 0; i < 6; i++) s += rand(); return (s - 3) / Math.SQRT2; };

/* ================================================================ Kuramoto */

export const kuramoto = {
  label: 'Fireflies falling into step (Kuramoto)', group: 'Motion & sync',
  defaults: { count: 40, freq: 0.7, spread: 0.18, k0: 0, k1: 2.2, rise: 14, layout: 'swarm', notes: 'pent' },
  controls: [
    ['count', 'Fireflies', 'r', 4, 120, 1], ['freq', 'Average flashes per second', 'r', 0.2, 2, 0.01], ['spread', 'How different they are', 'r', 0, 0.6, 0.01],
    ['k0', 'Pull at the start', 'r', 0, 4, 0.01], ['k1', 'Pull at the end', 'r', 0, 6, 0.01], ['rise', 'The pull grows over', 'r', 1, 60, 0.5, ' s'],
    ['layout', 'Show them as', 's', { swarm: 'A swarm of fireflies', ring: 'Dots on a circle (phase)' }], ['notes', 'Each one sings', 's', { pent: 'its own note (pentatonic)', one: 'the same note' }],
  ],
  K(S, P) { const q = clamp(S.st / Math.max(0.1, P.rise), 0, 1); return P.k0 + (P.k1 - P.k0) * q * q * (3 - 2 * q); },
  init(S, P) {
    const n = Math.max(2, P.count | 0);
    S.sc = { o: Array.from({ length: n }, (_, i) => ({ i, th: S.rand() * TAU, w: TAU * P.freq * (1 + P.spread * gauss(S.rand)), x: (S.rand() * 2 - 1) * S.W.hw * 0.86, y: (S.rand() * 2 - 1) * S.W.hh * 0.62, flash: -9 })), r: 0, psi: 0 };
  },
  step(S, P, dt, emit) {
    const o = S.sc.o, n = o.length, K = this.K(S, P);
    let cx = 0, cy = 0;
    for (const p of o) { cx += Math.cos(p.th); cy += Math.sin(p.th); }
    cx /= n; cy /= n;
    const r = Math.hypot(cx, cy), psi = Math.atan2(cy, cx);
    S.sc.r = r; S.sc.psi = psi;
    let fired = 0;
    for (const p of o) {
      const before = p.th;
      p.th += (p.w + K * r * Math.sin(psi - p.th)) * dt; // mean-field form of Σ (K/N) sin(θⱼ − θᵢ)
      if (Math.floor(p.th / TAU) > Math.floor(before / TAU)) {
        p.flash = S.t;
        if (fired++ < 8) emit({ type: 'hit', ball: p.i, x: p.x, y: p.y, angle: p.th, pitch: p.i / n, midi: P.notes === 'one' ? 69 : pentMidi(p.i % 12, 62), vel: 0.55, together: true, balls: n });
      }
    }
  },
  draw(S, P, D) {
    const { g, pal, k, time } = D, sc = S.sc, n = sc.o.length;
    if (P.layout === 'ring') {
      g.strokeStyle = hexA(pal.ring, 0.4); g.lineWidth = 2 * k; g.beginPath(); g.arc(D.X(0), D.Y(0), 0.9 * D.R, 0, TAU); g.stroke();
      // the order parameter: the average of all the arrows (length r: 0 = scattered, 1 = in step)
      const ax = Math.cos(sc.psi) * sc.r * 0.9, ay = Math.sin(sc.psi) * sc.r * 0.9;
      g.strokeStyle = pal.glow; g.lineWidth = 4 * k; g.shadowColor = pal.glow; g.shadowBlur = 18 * k;
      g.beginPath(); g.moveTo(D.X(0), D.Y(0)); g.lineTo(D.X(ax), D.Y(ay)); g.stroke(); g.shadowBlur = 0;
      for (const p of sc.o) {
        const fl = Math.max(0, 1 - (time - p.flash) / 0.35);
        glow(g, D.X(Math.cos(p.th) * 0.9), D.Y(Math.sin(p.th) * 0.9), (6 + 8 * fl) * k, pal.line(p.i / n), k, 10 + 30 * fl);
      }
    } else {
      for (const p of sc.o) {
        const fl = Math.max(0, 1 - (time - p.flash) / 0.6), wob = 0.02 * Math.sin(time * 0.7 + p.i);
        const x = D.X(p.x + wob), y = D.Y(p.y + 0.02 * Math.cos(time * 0.5 + p.i * 1.7));
        g.globalAlpha = 0.18 + 0.82 * fl;
        glow(g, x, y, (3 + 12 * fl) * k, pal.line(0.12 + 0.1 * (p.i / n)), k, 8 + 40 * fl);
        g.globalAlpha = 1;
      }
    }
    // a bar for how in step they are
    const w = 0.8 * D.R, x0 = D.X(-0.4), y0 = D.Y(-S.W.hh * 0.78);
    g.fillStyle = hexA(pal.ring, 0.18); g.fillRect(x0, y0, w, 6 * k);
    g.fillStyle = pal.glow; g.fillRect(x0, y0, w * sc.r, 6 * k);
  },
  stats: (S, P) => `in step: ${Math.round(S.sc.r * 100)}% · pull K ${kuramoto.K(S, P).toFixed(2)}`,
  formula: () => 'dθᵢ/dt = ωᵢ + K·r·sin(ψ − θᵢ)',
};

/* ================================================================= Shepard */

export const shepard = {
  label: 'Shepard scale: rising forever', group: 'Motion & sync',
  defaults: { step: 0.45, octaves: 6, centre: 66, width: 13, dir: 'up', look: 'spiral' },
  controls: [
    ['step', 'A step every', 'r', 0.12, 2, 0.01, ' s'], ['octaves', 'Octaves stacked', 'r', 3, 8, 1], ['centre', 'Loudest around (MIDI)', 'r', 40, 90, 1],
    ['width', 'How wide the loud band is', 'r', 4, 30, 0.5], ['dir', 'Direction', 's', { up: 'Up forever', down: 'Down forever' }],
    ['look', 'Picture', 's', { spiral: 'Spiral staircase (pitch helix)', stairs: 'Endless staircase (Penrose)' }],
  ],
  /** The notes sounding at step k: one per octave, loudness from a bell over pitch. */
  chord(P, k) {
    const pc = ((k % 12) + 12) % 12, out = [];
    for (let o = 0; o < P.octaves; o++) {
      const midi = 24 + 12 * o + pc;
      out.push({ midi, vel: Math.exp(-(((midi - P.centre) / P.width) ** 2) / 2) });
    }
    return out;
  },
  init(S) { S.sc = { k: -1 }; },
  step(S, P, dt, emit) {
    const k = Math.floor(S.st / P.step) * (P.dir === 'down' ? -1 : 1);
    if (k === S.sc.k) return;
    S.sc.k = k;
    for (const n of this.chord(P, k)) if (n.vel > 0.02) emit({ type: 'hit', ball: n.midi, x: 0, y: 0, angle: 0, midi: n.midi, vel: n.vel, together: true, balls: P.octaves });
  },
  draw(S, P, D) {
    const { g, pal, k } = D;
    const s = (S.st / P.step) * (P.dir === 'down' ? -1 : 1); // continuous step count
    const total = 12 * P.octaves;
    if (P.look === 'stairs') {
      // an endless square staircase: 12 steps per loop, climbing as the notes do, seen from above
      const steps = 48;
      for (let i = 0; i < steps; i++) {
        const q = ((i - s) % 12 + 12) % 12, side = Math.floor(q / 3), f = (q % 3) / 3;
        const L = 0.8, c = [[-L + 2 * L * f, -L], [L, -L + 2 * L * f], [L - 2 * L * f, L], [-L, L - 2 * L * f]][side];
        const depth = 1 - i / steps, sc = 0.25 + 0.75 * depth;
        const lit = Math.exp(-((((i - 24) / 10) ** 2)));
        g.globalAlpha = 0.15 + 0.85 * depth;
        g.fillStyle = pal.line((q / 12 + i / steps) % 1);
        g.fillRect(D.X(c[0] * sc) - 9 * k * sc, D.Y(c[1] * sc) - 9 * k * sc, 18 * k * sc, 18 * k * sc);
        if (lit > 0.3) glow(g, D.X(c[0] * sc), D.Y(c[1] * sc), 6 * k * sc * lit, '#ffffff', k, 18);
      }
      g.globalAlpha = 1;
      return;
    }
    // pitch helix seen from above: angle = pitch class, radius = octave; every note glides one
    // step out per beat, brightness = the loudness bell, so the outer turns fade and new inner ones appear
    for (let j = 0; j < total; j++) {
      const pitch = 24 + (((j + s) % total) + total) % total; // every note glides up with s and wraps from the top to the bottom
      const a = -Math.PI / 2 + (pitch / 12) * TAU;
      const rr = 0.12 + 0.86 * ((pitch - 24) / total);
      const loud = Math.exp(-(((pitch - P.centre) / P.width) ** 2) / 2);
      const x = D.X(Math.cos(a) * rr), y = D.Y(Math.sin(a) * rr);
      g.globalAlpha = 0.08 + 0.92 * loud;
      glow(g, x, y, (2 + 9 * loud) * k, pal.line(((pitch % 12) / 12)), k, 6 + 26 * loud);
    }
    g.globalAlpha = 1;
    g.strokeStyle = hexA(pal.ring, 0.25); g.lineWidth = 1.2 * k; g.beginPath();
    for (let i = 0; i <= 400; i++) { const pitch = 24 + (i / 400) * total, a = -Math.PI / 2 + ((pitch + s) / 12) * TAU, rr = 0.12 + 0.86 * ((pitch - 24) / total); const x = D.X(Math.cos(a) * rr), y = D.Y(Math.sin(a) * rr); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  },
  stats: (S, P) => `step ${Math.floor(S.st / P.step)} · back to the same chord every 12`,
  formula: () => 'octaves × bell(pitch): up a semitone each step, forever',
};

/* ============================================================= three bodies */

/** Figure-eight initial conditions (Chenciner & Montgomery 2000, after Simó), G = m = 1. */
export const FIGURE8 = { x: 0.97000436, y: -0.24308753, vx: 0.466203685, vy: 0.43236573, T: 6.32591398 };

function bodies(kind, nudge = 0) {
  if (kind === 'burrau') return [{ m: 3, x: 1, y: 3, vx: 0, vy: 0 }, { m: 4, x: -2, y: -1, vx: 0, vy: 0 }, { m: 5, x: 1 + nudge, y: -1, vx: 0, vy: 0 }];
  const f = FIGURE8;
  return [{ m: 1, x: f.x + nudge, y: f.y, vx: f.vx, vy: f.vy }, { m: 1, x: -f.x, y: -f.y, vx: f.vx, vy: f.vy }, { m: 1, x: 0, y: 0, vx: -2 * f.vx, vy: -2 * f.vy }];
}

/** One leapfrog (kick-drift-kick) step; small softening keeps close passes finite. */
function nbodyStep(b, h, eps = 1e-3) {
  const acc = () => {
    for (const p of b) { p.ax = 0; p.ay = 0; }
    for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
      const dx = b[j].x - b[i].x, dy = b[j].y - b[i].y, r2 = dx * dx + dy * dy + eps * eps, inv = 1 / (r2 * Math.sqrt(r2));
      b[i].ax += b[j].m * dx * inv; b[i].ay += b[j].m * dy * inv; b[j].ax -= b[i].m * dx * inv; b[j].ay -= b[i].m * dy * inv;
    }
  };
  acc();
  for (const p of b) { p.vx += 0.5 * h * p.ax; p.vy += 0.5 * h * p.ay; p.x += h * p.vx; p.y += h * p.vy; }
  acc();
  for (const p of b) { p.vx += 0.5 * h * p.ax; p.vy += 0.5 * h * p.ay; }
}

const minDist = (b) => Math.min(Math.hypot(b[0].x - b[1].x, b[0].y - b[1].y), Math.hypot(b[0].x - b[2].x, b[0].y - b[2].y), Math.hypot(b[1].x - b[2].x, b[1].y - b[2].y));

export const threebody = {
  label: 'Three bodies (figure-eight, Burrau 3-4-5)', group: 'Motion & sync',
  defaults: { kind: 'eight', speed: 1.6, ghost: 0.002, ghostShow: true, trail: 2.2, zoom: 1 },
  controls: [
    ['kind', 'Start', 's', { eight: 'Figure-eight (a perfect dance)', burrau: 'Burrau: masses 3, 4, 5 at rest (chaos)' }], ['speed', 'Orbits per second (speed)', 'r', 0.2, 6, 0.01],
    ['ghost', 'Nudge of the ghost copy', 'r', 0, 0.05, 0.0001], ['ghostShow', 'Show the ghost copy', 't'], ['trail', 'Trail length', 'r', 0.2, 8, 0.1, ' s'], ['zoom', 'Zoom', 'r', 0.2, 3, 0.01],
  ],
  init(S, P) {
    S.sc = { a: bodies(P.kind), b: bodies(P.kind, P.ghost), trail: [[], [], []], ghostTrail: [[], [], []], T: 0, last: [0, 0, 0] };
  },
  step(S, P, dt, emit) {
    const sc = S.sc, sim = dt * P.speed * (P.kind === 'eight' ? 1 : 0.6);
    let left = sim;
    while (left > 1e-9) {
      const d = Math.min(minDist(sc.a), minDist(sc.b));
      const h = Math.min(left, clamp(0.002 * d * d * 10, 2e-6, 0.002)); // smaller steps on close passes
      nbodyStep(sc.a, h); if (P.ghostShow || P.ghost) nbodyStep(sc.b, h);
      left -= h; sc.T += h;
    }
    const sx = this.scale(P);
    sc.a.forEach((p, i) => {
      sc.trail[i].push([p.x * sx, p.y * sx, S.t]);
      // a note when a body crosses the vertical line through the centre of mass
      const side = Math.sign(p.x);
      if (side && sc.last[i] && side !== sc.last[i]) emit({ type: 'hit', ball: i, x: p.x * sx, y: p.y * sx, angle: Math.atan2(p.y, p.x), midi: [60, 64, 67][i] + (P.kind === 'burrau' ? [-5, 0, 5][i] : 0), vel: 0.7, balls: 3 });
      sc.last[i] = side;
    });
    sc.b.forEach((p, i) => sc.ghostTrail[i].push([p.x * sx, p.y * sx, S.t]));
    for (const tr of [...sc.trail, ...sc.ghostTrail]) while (tr.length && tr[0][2] < S.t - P.trail) tr.shift();
  },
  scale(P) { return (P.kind === 'eight' ? 0.8 : 0.22) * P.zoom; },
  draw(S, P, D) {
    const { g, pal, k } = D, sc = S.sc;
    const line = (tr, col, w, a) => {
      for (let i = 1; i < tr.length; i++) {
        g.globalAlpha = a * (i / tr.length);
        g.strokeStyle = col; g.lineWidth = w * k * (0.3 + 0.7 * i / tr.length);
        g.beginPath(); g.moveTo(D.X(tr[i - 1][0]), D.Y(tr[i - 1][1])); g.lineTo(D.X(tr[i][0]), D.Y(tr[i][1])); g.stroke();
      }
      g.globalAlpha = 1;
    };
    const cols = [pal.line(0.05), pal.line(0.4), pal.line(0.75)];
    if (P.ghostShow) sc.ghostTrail.forEach((tr, i) => line(tr, '#ffffff', 2, 0.25));
    sc.trail.forEach((tr, i) => line(tr, cols[i], 4, 0.95));
    const sx = this.scale(P);
    if (P.ghostShow) sc.b.forEach((p) => glow(g, D.X(p.x * sx), D.Y(p.y * sx), 6 * k, 'rgba(255,255,255,0.5)', k, 10));
    sc.a.forEach((p, i) => glow(g, D.X(p.x * sx), D.Y(p.y * sx), (8 + 3 * Math.sqrt(p.m)) * k, cols[i], k, 26));
  },
  stats: (S) => {
    const sc = S.sc, dev = Math.max(...sc.a.map((p, i) => Math.hypot(p.x - sc.b[i].x, p.y - sc.b[i].y)));
    return `time ${sc.T.toFixed(1)} · ghost is ${dev < 0.01 ? 'still together' : `${dev.toFixed(2)} away`}`;
  },
  formula: (P) => (P.kind === 'eight' ? 'a = Σ m (rⱼ − rᵢ)/|rⱼ − rᵢ|³ · figure-eight, period 6.326' : 'Burrau 1913: masses 3, 4, 5 at rest on a 3-4-5 triangle'),
};

/* ========================================================= double pendulum */

/** Equations of motion of the double pendulum (point masses, massless rods; as on myphysicslab). */
export function dpAcc(t1, t2, w1, w2, m1 = 1, m2 = 1, l1 = 1, l2 = 1, gr = 9.81) {
  const d = t1 - t2, den = 2 * m1 + m2 - m2 * Math.cos(2 * t1 - 2 * t2);
  const a1 = (-gr * (2 * m1 + m2) * Math.sin(t1) - m2 * gr * Math.sin(t1 - 2 * t2) - 2 * Math.sin(d) * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * Math.cos(d))) / (l1 * den);
  const a2 = (2 * Math.sin(d) * (w1 * w1 * l1 * (m1 + m2) + gr * (m1 + m2) * Math.cos(t1) + w2 * w2 * l2 * m2 * Math.cos(d))) / (l2 * den);
  return [a1, a2];
}
function dpStep(p, h) {
  const f = (s) => { const [a1, a2] = dpAcc(s[0], s[1], s[2], s[3]); return [s[2], s[3], a1, a2]; };
  const s = [p.t1, p.t2, p.w1, p.w2];
  const k1 = f(s), k2 = f(s.map((v, i) => v + (h / 2) * k1[i])), k3 = f(s.map((v, i) => v + (h / 2) * k2[i])), k4 = f(s.map((v, i) => v + h * k3[i]));
  [p.t1, p.t2, p.w1, p.w2] = s.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}
/** Energy (for the tests): kinetic + potential, m = l = 1. */
export function dpEnergy(p, gr = 9.81) {
  const v1 = p.w1 * p.w1, v2 = v1 + p.w2 * p.w2 + 2 * p.w1 * p.w2 * Math.cos(p.t1 - p.t2);
  return 0.5 * v1 + 0.5 * v2 - gr * (2 * Math.cos(p.t1) + Math.cos(p.t2));
}

export const dpendulum = {
  label: 'Double pendulums falling apart (chaos)', group: 'Motion & sync',
  defaults: { count: 7, angle: 150, diff: 0.0005, speed: 1, trail: 2.5, rods: true },
  controls: [
    ['count', 'Pendulums', 'r', 1, 30, 1], ['angle', 'Start angle', 'r', 30, 179, 0.5, '°'], ['diff', 'Difference between them', 'r', 0, 0.02, 0.0001, ' rad'],
    ['speed', 'Speed', 'r', 0.2, 3, 0.01], ['trail', 'Trail length', 'r', 0, 10, 0.1, ' s'], ['rods', 'Show the rods', 't'],
  ],
  init(S, P) {
    const n = Math.max(1, P.count | 0), a = (P.angle * Math.PI) / 180;
    S.sc = { p: Array.from({ length: n }, (_, i) => ({ i, t1: a + i * P.diff, t2: a + i * P.diff, w1: 0, w2: 0, tr: [], side: 0 })) };
  },
  step(S, P, dt, emit) {
    const sim = dt * P.speed, n = Math.max(1, Math.ceil(sim / 0.002)), h = sim / n, L = 0.46;
    for (const p of S.sc.p) {
      for (let i = 0; i < n; i++) dpStep(p, h);
      const x = L * (Math.sin(p.t1) + Math.sin(p.t2)), y = 0.25 - L * (Math.cos(p.t1) + Math.cos(p.t2));
      p.tr.push([x, y, S.t]);
      while (p.tr.length && p.tr[0][2] < S.t - P.trail) p.tr.shift();
      const side = Math.sign(x);
      if (side && p.side && side !== p.side) emit({ type: 'hit', ball: p.i, x, y, angle: Math.atan2(y, x), pitch: clamp((y + 0.7) / 1.4, 0, 1), vel: 0.6, balls: S.sc.p.length });
      p.side = side;
    }
  },
  draw(S, P, D) {
    const { g, pal, k } = D, L = 0.46, n = S.sc.p.length;
    for (const p of S.sc.p) {
      const col = pal.line(n > 1 ? p.i / (n - 1) : 0.3);
      for (let i = 1; i < p.tr.length; i++) {
        g.globalAlpha = 0.85 * (i / p.tr.length);
        g.strokeStyle = col; g.lineWidth = 2.4 * k;
        g.beginPath(); g.moveTo(D.X(p.tr[i - 1][0]), D.Y(p.tr[i - 1][1])); g.lineTo(D.X(p.tr[i][0]), D.Y(p.tr[i][1])); g.stroke();
      }
      g.globalAlpha = 1;
      const x1 = L * Math.sin(p.t1), y1 = 0.25 - L * Math.cos(p.t1), x2 = x1 + L * Math.sin(p.t2), y2 = y1 - L * Math.cos(p.t2);
      if (P.rods) {
        g.strokeStyle = hexA(col, 0.6); g.lineWidth = 2 * k;
        g.beginPath(); g.moveTo(D.X(0), D.Y(0.25)); g.lineTo(D.X(x1), D.Y(y1)); g.lineTo(D.X(x2), D.Y(y2)); g.stroke();
        glow(g, D.X(x1), D.Y(y1), 5 * k, col, k, 8);
      }
      glow(g, D.X(x2), D.Y(y2), 7 * k, col, k, 20);
    }
    glow(g, D.X(0), D.Y(0.25), 5 * k, '#ffffff', k, 10);
  },
  stats: (S) => { const a = S.sc.p[0], b = S.sc.p.at(-1); return `spread: ${Math.abs(a.t2 - b.t2).toFixed(3)} rad`; },
  formula: () => "θ₁'' , θ₂'' from Lagrange's equations · start a hair apart",
};

/* ================================================================== primes */

const isPrime = (n) => { if (n < 2) return false; if (n % 2 === 0) return n === 2; for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false; return true; };
/** Ulam's square spiral: position of n (1 at the centre). */
function ulam(n) {
  if (n === 1) return [0, 0];
  const k = Math.ceil((Math.sqrt(n) - 1) / 2), t = 2 * k + 1, m = t * t, side = t - 1;
  if (n >= m - side) return [k - (m - n), -k];
  if (n >= m - 2 * side) return [-k, -k + (m - side - n)];
  if (n >= m - 3 * side) return [-k + (m - 2 * side - n), k];
  return [k, k - (m - 3 * side - n)];
}

export const primes = {
  label: 'Prime spirals (Sacks, Ulam)', group: 'Numbers',
  defaults: { kind: 'sacks', max: 6000, rate0: 30, accel: 1.28, all: 0.12, euler: true, size: 1 },
  controls: [
    ['kind', 'Spiral', 's', { sacks: 'Sacks: r = √n, θ = 2π√n', ulam: 'Ulam: square spiral' }], ['max', 'Numbers', 'r', 100, 40000, 100],
    ['rate0', 'Numbers per second at the start', 'r', 1, 200, 1], ['accel', 'Speed-up per second', 'r', 1, 1.6, 0.01],
    ['all', 'Show the other numbers', 'r', 0, 0.6, 0.01], ['euler', 'Light up n² + n + 41 (Euler)', 't'], ['size', 'Dot size', 'r', 0.3, 3, 0.01],
  ],
  init(S) { S.sc = { n: 0, primes: 0 }; },
  count(S, P) { const t = S.st; return Math.min(P.max, Math.floor(Math.abs(P.accel - 1) < 1e-6 ? P.rate0 * t : (P.rate0 * (P.accel ** t - 1)) / Math.log(P.accel))); },
  pos(P, n) {
    if (P.kind === 'ulam') { const [x, y] = ulam(n), s = 0.95 / Math.ceil(Math.sqrt(P.max) / 2); return [x * s, y * s]; }
    const r = Math.sqrt(n) / Math.sqrt(P.max) * 0.97, a = TAU * Math.sqrt(n);
    return [Math.cos(a) * r, Math.sin(a) * r];
  },
  step(S, P, dt, emit) {
    const want = this.count(S, P);
    let sounds = 0;
    while (S.sc.n < want) {
      const n = ++S.sc.n;
      if (!isPrime(n)) continue;
      S.sc.primes++;
      const [x, y] = this.pos(P, n);
      if (sounds++ < 3) emit({ type: 'hit', ball: n % 24, x, y, angle: Math.atan2(y, x), pitch: Math.hypot(x, y), vel: 0.5, balls: S.sc.primes });
    }
  },
  draw(S, P, D) {
    const { g, pal, k } = D, N = S.sc.n, r0 = Math.max(0.8, (P.kind === 'ulam' ? 260 : 330) / Math.sqrt(P.max)) * k * P.size;
    for (let n = 1; n <= N; n++) {
      const pr = isPrime(n), eu = P.euler && (() => { const q = (-1 + Math.sqrt(1 + 4 * (n - 41))) / 2; return n >= 41 && Math.abs(q - Math.round(q)) < 1e-9; })();
      if (!pr && !eu && P.all <= 0) continue;
      const [x, y] = this.pos(P, n);
      if (eu) { glow(g, D.X(x), D.Y(y), r0 * 1.6, '#ffd166', k, 14); continue; }
      g.globalAlpha = pr ? 1 : P.all;
      g.fillStyle = pr ? pal.line((Math.sqrt(n) / Math.sqrt(P.max)) * 0.8) : '#ffffff';
      g.fillRect(D.X(x) - r0 / 2, D.Y(y) - r0 / 2, r0, r0);
    }
    g.globalAlpha = 1;
  },
  stats: (S) => `numbers: ${S.sc.n} · primes: ${S.sc.primes}`,
  formula: (P) => (P.kind === 'ulam' ? 'primes on a square spiral: they line up on diagonals' : 'n at r = √n, θ = 2π√n: primes line up on curves'),
};

/* ========================================================== brachistochrone */

/** The cycloid from (0, 0) through (X, −Y): returns R and the end angle φ (solves (φ − sin φ)/(1 − cos φ) = X/Y). */
export function cycloidThrough(X, Y) {
  let lo = 1e-6, hi = TAU - 1e-6;
  for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if ((m - Math.sin(m)) / (1 - Math.cos(m)) < X / Y) lo = m; else hi = m; }
  const phi = (lo + hi) / 2;
  return { R: Y / (1 - Math.cos(phi)), phi };
}

/** A path as a polyline, with arc length; a bead slides along it from rest (v = √(2g·drop)). */
function makePath(pts) {
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, s, len: s.at(-1) };
}
function pathAt(P, d) {
  let lo = 0, hi = P.s.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P.s[m] <= d) lo = m; else hi = m; }
  const f = (d - P.s[lo]) / Math.max(1e-12, P.s[hi] - P.s[lo]);
  return [P.pts[lo][0] + (P.pts[hi][0] - P.pts[lo][0]) * f, P.pts[lo][1] + (P.pts[hi][1] - P.pts[lo][1]) * f];
}

export const brachisto = {
  label: 'Fastest slide: the brachistochrone race', group: 'Motion & sync',
  defaults: { kind: 'race', slow: 0.35, beads: 5 },
  controls: [
    ['kind', 'Experiment', 's', { race: 'Race: line, arc, parabola, cycloid', tautochrone: 'Tautochrone: from any height, all arrive together' }],
    ['slow', 'Slow motion', 'r', 0.05, 1.5, 0.01], ['beads', 'Beads (tautochrone)', 'r', 2, 9, 1],
  ],
  init(S, P) {
    const A = [-0.8, 0.75], X = 1.6, Y = 1.1; // from A to B = A + (X, −Y)
    const N = 600, lines = [];
    const add = (name, f) => lines.push({ name, path: makePath(Array.from({ length: N + 1 }, (_, i) => f(i / N))) });
    const { R, phi } = cycloidThrough(X, Y);
    if (P.kind === 'tautochrone') {
      // the cycloid from its cusp to its lowest point (φ = π): beads start at different heights
      const Rt = Y / 2;
      const cyc = makePath(Array.from({ length: N + 1 }, (_, i) => { const p = (i / N) * Math.PI * 2; return [A[0] + Rt * (p - Math.sin(p)), A[1] - Rt * (1 - Math.cos(p))]; }));
      const nb = Math.max(2, P.beads | 0);
      // start points: φ0 between 0.05π and 0.95π (all on the left half), the bottom is at φ = π
      S.sc = { kind: 'taut', cyc, Rt, beads: Array.from({ length: nb }, (_, i) => { const p0 = Math.PI * (0.06 + 0.86 * (i / (nb - 1))); return { i, p0, d: cyc.s[Math.round((p0 / (TAU)) * N)], v: 0, done: false }; }) };
      return;
    }
    add('straight line', (u) => [A[0] + X * u, A[1] - Y * u]);
    add('circular arc', (u) => { const a = (Math.PI / 2) * u; return [A[0] + X * (1 - Math.cos(a)), A[1] - Y * Math.sin(a)]; }); // drops steeply first, then flattens
    add('parabola', (u) => [A[0] + X * u, A[1] - Y * (2 * u - u * u)]);
    add('cycloid', (u) => { const p = phi * u; return [A[0] + R * (p - Math.sin(p)), A[1] - R * (1 - Math.cos(p))]; });
    S.sc = { kind: 'race', A, lines: lines.map((l, i) => ({ ...l, i, d: 1e-5, v: 0, done: false, at: null })) };
  },
  step(S, P, dt, emit) {
    const sc = S.sc, g = 9.81, sim = dt * P.slow, n = 40, h = sim / n;
    const run = (path, b, y0) => {
      for (let i = 0; i < n && !b.done; i++) {
        const [, y] = pathAt(path, b.d);
        b.v = Math.sqrt(Math.max(1e-9, 2 * g * (y0 - y)));
        b.d += b.v * h;
        if (b.d >= path.len - 1e-6) { b.d = path.len; b.done = true; return true; }
      }
      return false;
    };
    if (sc.kind === 'taut') {
      const bottom = sc.cyc.s[Math.round((sc.cyc.s.length - 1) / 2)];
      for (const b of sc.beads) {
        if (b.done) continue;
        const y0 = sc.cyc.pts[Math.round((b.p0 / TAU) * (sc.cyc.pts.length - 1))][1];
        const path = { ...sc.cyc, len: bottom };
        if (run(path, b, y0 + 1e-6)) { b.at = S.st; emit({ type: 'hit', ball: b.i, x: 0, y: 0, angle: 0, midi: pentMidi(b.i, 60), vel: 0.8, together: true, balls: sc.beads.length }); }
      }
      return;
    }
    for (const b of sc.lines) if (!b.done && run(b.path, b, sc.A[1] + 1e-6)) { b.at = S.st; emit({ type: 'hit', ball: b.i, x: 0, y: 0, angle: 0, midi: [72, 67, 64, 60][b.i], vel: 0.85, balls: 4 }); }
  },
  draw(S, P, D) {
    const { g, pal, k } = D, sc = S.sc;
    const stroke = (pts, col, w) => { g.strokeStyle = col; g.lineWidth = w * k; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(D.X(x), D.Y(y)) : g.moveTo(D.X(x), D.Y(y)))); g.stroke(); };
    if (sc.kind === 'taut') {
      stroke(sc.cyc.pts.slice(0, Math.round(sc.cyc.pts.length / 2) + 1), hexA(pal.ring, 0.8), 3);
      for (const b of sc.beads) {
        const [x, y] = pathAt(sc.cyc, b.d), col = pal.line(b.i / sc.beads.length);
        glow(g, D.X(x), D.Y(y), 9 * k, col, k, b.done ? 34 : 16);
      }
      return;
    }
    sc.lines.forEach((l) => {
      const col = pal.line(l.i / 4);
      stroke(l.path.pts, hexA(col, 0.55), 2.5);
      const [x, y] = pathAt(l.path, l.d);
      glow(g, D.X(x), D.Y(y), 9 * k, col, k, l.done ? 34 : 16);
      if (l.done) { g.fillStyle = col; g.font = `${Math.round(16 * k)}px system-ui`; g.textAlign = 'left'; g.fillText(`${l.name}: ${(l.at * P.slow).toFixed(3)} s`, D.X(-0.85), D.Y(-0.55 - 0.1 * l.i)); }
    });
  },
  stats: (S, P) => (S.sc.kind === 'taut' ? `arrived: ${S.sc.beads.filter((b) => b.done).length}` : `finished: ${S.sc.lines.filter((l) => l.done).length} / 4`),
  formula: () => 'x = R(φ − sin φ), y = −R(1 − cos φ): the fastest slide',
};

export const MOTION_SCENES = { kuramoto, shepard, threebody, dpendulum, primes, brachisto };
