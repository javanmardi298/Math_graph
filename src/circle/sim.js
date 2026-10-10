/**
 * Circle Lab: deterministic "satisfying" simulations inside a circle.
 *
 *   chord       a point jumps around the circle by a fixed fraction of a turn, drawing
 *               chords (rational steps close into star polygons; irrational ones like
 *               1/φ² never close)
 *   bounce      balls bouncing inside the circle (optional gravity, speed-up per hit)
 *   split       every bounce splits a ball in two (1 → 2 → 4 → …, capped)
 *   grow        every bounce grows the ball until it fills the circle
 *   escape      nested rings with rotating gaps: the ball breaks out ring by ring
 *   polyrhythm  dots swing on nested arcs at different speeds; each end hit is a note
 *
 * The world is the unit circle (radius 1, y up). The simulation runs at a fixed step,
 * so the same settings always give the same picture and the same sound: live play,
 * scrubbing, WAV and video exports all replay it from t = 0.
 * No DOM here: rendering is in view.js, sound mapping in sound.js.
 */
import { tryCompile } from '../math/parser.js';
import { worldFor, speedAt } from './layout.js';
import { SCENES, sceneParams } from './scenes.js';

export const DT = 1 / 240;

const CLASSIC = {
  chord: 'Chord walker (golden angle, stars)',
  bounce: 'Bouncing ball',
  split: 'Split on every bounce',
  grow: 'Grow on every bounce',
  escape: 'Escape the rings',
  polyrhythm: 'Polyrhythm arcs',
};

/** Every simulation: id → label. */
export const CIRCLE_RULES = { ...CLASSIC, ...Object.fromEntries(Object.entries(SCENES).map(([id, s]) => [id, s.label])) };

/** Simulations grouped for the picker: [[group, [[id, label], …]], …] */
export function ruleGroups() {
  const groups = new Map([['Classic circle', Object.entries(CLASSIC)]]);
  for (const [id, s] of Object.entries(SCENES)) {
    if (!groups.has(s.group)) groups.set(s.group, []);
    groups.get(s.group).push([id, s.label]);
  }
  return [...groups];
}

/** Default settings (state.circle). */
export function defaultCircle() {
  return {
    rule: 'chord',
    seed: 7,
    chord: { step: '1/phi^2', walkers: 1, speed: 1.8, speedGain: 1, start: 90 },
    physics: { balls: 1, speed: 1.4, angle: 62, gravity: 0, restitution: 1, speedGain: 1, maxSpeed: 4.5, size: 0.035 },
    split: { angle: 14, max: 128 },
    grow: { amount: 0.006, until: 0.92 },
    escape: { rings: 6, inner: 0.32, gap: 34, spin: 0.9 },
    poly: { dots: 12, base: 24, cycle: 60 },
    look: {
      palette: 'neon', trail: 'lines', trailWidth: 1.6, glow: 1, ringWidth: 5, ballSize: 1,
      sparks: true, ringPulse: true, comet: true, counter: true, background: '#060814', zoom: 1, bloom: 1, ambience: true,
    },
    sound: { instrument: 'kalimba', pitch: 'angle', melody: 'ode', notes: '', drum: 'off', length: 0.35, volume: 0.6, maxRate: 30 },
    text: { formula: '', counter: '' },
    // simulation speed over time (the clock of the motion; the soundtrack stays in real time)
    speed: { from: 1, to: 1, curve: 'linear', pulse: 0 },
    // settings of the other simulations, per simulation: { triple: { coreN: 3, … }, … }
    lab: {},
  };
}

/** The step of the chord walker as a fraction of a turn (expression with phi, pi, e, sqrt…). */
export function chordStep(expr) {
  const c = tryCompile(String(expr || '0'), []);
  const v = c.ok ? c.fn({}) : NaN;
  return Number.isFinite(v) ? v : 1 / ((1 + Math.sqrt(5)) / 2) ** 2;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;
const wrapPi = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const SEGMENT_CAP = 250000;

const DOT_CAP = 200000;

export class CircleSim {
  /**
   * @param {object} cfg state.circle
   * @param {{duration?:number, bpm?:number, ratio?:number}} [env] timeline length, tempo and
   *   frame width/height (the world is the frame's safe area, see layout.js)
   */
  constructor(cfg, env = {}) {
    this.cfg = cfg;
    this.duration = env.duration ?? 30;
    this.bpm = env.bpm ?? 120;
    this.W = worldFor(env.ratio ?? 9 / 16);
    this.reset();
  }

  reset() {
    const c = this.cfg;
    this.t = 0; // real time (seconds of video)
    this.st = 0; // simulation time (runs faster / slower with the speed curve)
    this.hits = 0;
    this.balls = [];
    this.rings = [];
    this.segments = []; // permanent trail: { x1, y1, x2, y2, t, hue }
    this.dots = []; // permanent dots: { x, y, s, hue, a }
    this.walkers = [];
    this.done = false;
    this.rand = mulberry32(c.seed ?? 7);
    this.scene = SCENES[c.rule] || null;
    if (this.scene) {
      this.P = sceneParams(c);
      this.scene.init(this, this.P);
    } else if (c.rule === 'chord') this.initChord();
    else if (c.rule === 'polyrhythm') this.initPoly();
    else this.initPhysics();
  }

  /* --------------------------------------------------------------- chord */

  initChord() {
    const c = this.cfg.chord;
    this.turn = chordStep(c.step);
    const n = Math.max(1, Math.min(12, c.walkers | 0));
    for (let i = 0; i < n; i++) {
      const a = ((c.start ?? 90) * Math.PI) / 180 + (TAU * i) / n;
      const w = { i, angle: a, x: Math.cos(a), y: Math.sin(a), speed: c.speed, hue: i / n };
      this.aimWalker(w, 0);
      this.walkers.push(w);
    }
    this.balls = this.walkers;
  }

  aimWalker(w, t0) {
    const next = w.angle + TAU * this.turn;
    w.from = { x: Math.cos(w.angle), y: Math.sin(w.angle) };
    w.to = { x: Math.cos(next), y: Math.sin(next), angle: next };
    const len = Math.hypot(w.to.x - w.from.x, w.to.y - w.from.y);
    w.t0 = t0;
    w.dur = Math.max(1e-3, len / Math.max(0.05, w.speed));
  }

  stepChord(onEvent) {
    const gain = this.cfg.chord.speedGain || 1;
    for (const w of this.walkers) {
      while (this.st >= w.t0 + w.dur) {
        const at = w.t0 + w.dur;
        this.addSegment(w.from.x, w.from.y, w.to.x, w.to.y, this.t, w.hue + this.hits * 0.01);
        w.angle = w.to.angle;
        this.hits++;
        onEvent?.({ t: this.t, type: 'hit', ball: w.i, x: w.to.x, y: w.to.y, angle: w.angle, n: this.hits });
        w.speed = Math.min(12, w.speed * gain);
        this.aimWalker(w, at);
      }
      const k = (this.st - w.t0) / w.dur;
      w.x = w.from.x + (w.to.x - w.from.x) * k;
      w.y = w.from.y + (w.to.y - w.from.y) * k;
    }
  }

  /* ------------------------------------------------------------- physics */

  initPhysics() {
    const c = this.cfg, p = c.physics;
    const n = Math.max(1, Math.min(32, p.balls | 0));
    if (c.rule === 'escape') {
      const e = c.escape, k = Math.max(1, Math.min(16, e.rings | 0));
      for (let i = 0; i < k; i++) {
        const r = k === 1 ? 1 : e.inner + ((1 - e.inner) * i) / (k - 1);
        this.rings.push({ i, r, alive: true, phase: this.rand() * TAU, spin: (i % 2 ? -1 : 1) * e.spin * (1 + 0.15 * i), broke: null });
      }
    }
    for (let i = 0; i < n; i++) {
      const a = ((p.angle ?? 60) * Math.PI) / 180 + (TAU * i) / n;
      const start = c.rule === 'escape' ? 0 : 0.15;
      this.balls.push({
        i, x: start * Math.cos(a + 1.3), y: start * Math.sin(a + 1.3) + (c.rule === 'escape' ? 0 : 0.1),
        vx: Math.cos(a) * p.speed, vy: Math.sin(a) * p.speed, r: p.size, hue: i / n,
        lx: null, ly: null, lt: 0,
      });
    }
    this.nextId = n;
  }

  /** Radius of the wall the balls bounce on (escape: the innermost unbroken ring). */
  wallRadius() {
    if (this.cfg.rule !== 'escape') return 1;
    const ring = this.rings.find((r) => r.alive);
    return ring ? ring.r : 1.12;
  }

  ringAngle(ring, t = this.st) { return ring.phase + ring.spin * t; }

  stepPhysics(dt, onEvent) {
    const c = this.cfg, p = c.physics;
    const g = p.gravity || 0, e = p.restitution ?? 1, gain = p.speedGain || 1;
    const sampled = g !== 0; // curved paths are sampled; straight ones only record wall hits
    const born = [];
    for (const b of this.balls) {
      if (b.frozen) continue;
      if (b.lx === null) { b.lx = b.x; b.ly = b.y; b.lt = this.t; }
      b.vy -= g * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const R = this.wallRadius();
      const limit = R - b.r;
      const d = Math.hypot(b.x, b.y);
      if (d >= limit && d > 0) {
        const nx = b.x / d, ny = b.y / d;
        const angle = Math.atan2(ny, nx);
        const ring = c.rule === 'escape' ? this.rings.find((r) => r.alive) : null;
        if (ring && Math.abs(wrapPi(angle - this.ringAngle(ring))) < ((c.escape.gap * Math.PI) / 180) / 2) {
          ring.alive = false;
          ring.broke = this.t;
          this.hits++;
          onEvent?.({ t: this.t, type: 'escape', ball: b.i, x: b.x, y: b.y, angle, n: this.hits, ring: ring.i, left: this.rings.filter((r) => r.alive).length });
          continue;
        }
        const vn = b.vx * nx + b.vy * ny;
        if (vn > 0) {
          b.vx -= (1 + e) * vn * nx;
          b.vy -= (1 + e) * vn * ny;
        }
        b.x = nx * limit;
        b.y = ny * limit;
        let sp = Math.hypot(b.vx, b.vy) * gain;
        sp = Math.min(p.maxSpeed || 6, sp);
        const cur = Math.hypot(b.vx, b.vy) || 1;
        b.vx *= sp / cur;
        b.vy *= sp / cur;
        this.addSegment(b.lx, b.ly, b.x, b.y, this.t, b.hue + this.hits * 0.004);
        b.lx = b.x; b.ly = b.y; b.lt = this.t;
        this.hits++;
        onEvent?.({ t: this.t, type: 'hit', ball: b.i, x: b.x, y: b.y, angle, n: this.hits, balls: this.balls.length });
        if (c.rule === 'split' && this.balls.length + born.length < (c.split.max || 128)) {
          const th = ((c.split.angle || 14) * Math.PI) / 180;
          const rot = (vx, vy, a) => [vx * Math.cos(a) - vy * Math.sin(a), vx * Math.sin(a) + vy * Math.cos(a)];
          const [ax, ay] = rot(b.vx, b.vy, th);
          const [bx, by] = rot(b.vx, b.vy, -th);
          b.vx = ax; b.vy = ay;
          born.push({ i: this.nextId++, x: b.x, y: b.y, vx: bx, vy: by, r: b.r, hue: b.hue + 0.07, lx: b.x, ly: b.y, lt: this.t });
          onEvent?.({ t: this.t, type: 'split', ball: b.i, x: b.x, y: b.y, angle, n: this.hits, balls: this.balls.length + born.length });
        }
        if (c.rule === 'grow') {
          b.r = Math.min(c.grow.until, b.r + c.grow.amount);
          if (b.r >= c.grow.until - 1e-9 && !this.done) {
            this.done = true;
            onEvent?.({ t: this.t, type: 'fill', ball: b.i, x: b.x, y: b.y, angle, n: this.hits });
          }
          if (this.done) b.frozen = true;
        }
      } else if (sampled && this.t - b.lt >= 1 / 30) {
        this.addSegment(b.lx, b.ly, b.x, b.y, this.t, b.hue + this.hits * 0.004);
        b.lx = b.x; b.ly = b.y; b.lt = this.t;
      }
      // escaped every ring: keep the ball on screen with an invisible frame
      if (c.rule === 'escape' && !this.rings.some((r) => r.alive) && Math.hypot(b.x, b.y) > 1.12) {
        const dd = Math.hypot(b.x, b.y);
        b.x *= 1.12 / dd; b.y *= 1.12 / dd;
        const nx = b.x / 1.12, ny = b.y / 1.12, vn = b.vx * nx + b.vy * ny;
        if (vn > 0) { b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny; }
      }
    }
    if (born.length) this.balls.push(...born);
  }

  /* ---------------------------------------------------------- polyrhythm */

  initPoly() {
    const p = this.cfg.poly, n = Math.max(2, Math.min(32, p.dots | 0));
    for (let i = 0; i < n; i++) {
      const r = 0.25 + (0.73 * i) / (n - 1);
      this.balls.push({ i, r: 0, arc: r, passes: 0, x: -r, y: 0, hue: i / n });
    }
  }

  stepPoly(onEvent) {
    const p = this.cfg.poly;
    for (const b of this.balls) {
      // dot i makes (base + i) passes (end to end) per cycle; slowest is the innermost
      const rate = (p.base + b.i) / Math.max(1, p.cycle);
      const pos = this.st * rate;
      const passes = Math.floor(pos);
      const k = pos - passes;
      const along = passes % 2 ? 1 - k : k; // back and forth along the upper semicircle
      const a = Math.PI * (1 - along);
      b.x = b.arc * Math.cos(a);
      b.y = b.arc * Math.sin(a);
      if (passes > b.passes) {
        b.passes = passes;
        this.hits++;
        const end = passes % 2 ? 0 : Math.PI;
        onEvent?.({ t: this.t, type: 'hit', ball: b.i, x: b.arc * Math.cos(end), y: 0, angle: end, n: this.hits });
      }
    }
  }

  /* ------------------------------------------------------------- common */

  addSegment(x1, y1, x2, y2, t, hue) {
    if (this.segments.length < SEGMENT_CAP) this.segments.push({ x1, y1, x2, y2, t, hue });
  }

  /** A permanent dot (size in pixels at 1000 px, hue, alpha). */
  addDot(x, y, s, hue, a = 1) {
    if (this.dots.length < DOT_CAP) this.dots.push({ x, y, s, hue, a });
  }

  /** Current speed of the simulation clock. */
  speed(t = this.t) { return speedAt(this.cfg.speed, t, this.duration, this.bpm); }

  step(dt, onEvent) {
    this.t += dt;
    const sdt = dt * this.speed();
    this.st += sdt;
    const r = this.cfg.rule;
    if (this.scene) {
      this.scene.step(this, this.P, sdt, (e) => { this.hits++; onEvent?.({ ...e, t: this.t, n: this.hits }); });
    } else if (r === 'chord') this.stepChord(onEvent);
    else if (r === 'polyrhythm') this.stepPoly(onEvent);
    else this.stepPhysics(sdt, onEvent);
  }

  /** Advance to `time` (never backwards: reset() first). */
  advance(time, onEvent) {
    while (this.t + DT <= time + 1e-9) this.step(DT, onEvent);
  }
}

/** Every sound/visual event from 0 to `duration` (for the offline soundtrack). */
export function eventsUntil(cfg, duration, env = {}) {
  const sim = new CircleSim(cfg, { duration, ...env });
  const out = [];
  sim.advance(duration, (e) => out.push(e));
  return out;
}

/** A readable formula line for the on-screen text, e.g. "angle = 1/φ² turn". */
export function formulaLine(cfg) {
  if (cfg.text?.formula) return cfg.text.formula;
  const scene = SCENES[cfg.rule];
  if (scene) return scene.formula(sceneParams(cfg)) || '';
  const pretty = (s) => String(s).replace(/\bphi\b/g, 'φ').replace(/\bpi\b/g, 'π').replace(/\^2\b/g, '²').replace(/\^3\b/g, '³').replace(/sqrt\(([^)]+)\)/g, '√$1').replace(/\s+/g, ' ');
  switch (cfg.rule) {
    case 'chord': return `angle = ${pretty(cfg.chord.step)} turn`;
    case 'split': return 'every bounce: 1 ball → 2';
    case 'grow': return 'every bounce: the ball grows';
    case 'escape': return 'find the gap to escape';
    case 'polyrhythm': return `dot k: ${cfg.poly.base}+k swings per ${cfg.poly.cycle} s`;
    default: return cfg.physics.gravity ? 'gravity + perfect bounces' : 'perfect bounces, no friction';
  }
}
