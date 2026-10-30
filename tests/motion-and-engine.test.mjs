import test from 'node:test';
import assert from 'node:assert/strict';
import { CircleSim, defaultCircle } from '../src/circle/sim.js';
import { dpEnergy, FIGURE8, cycloidThrough, shepard, brachisto } from '../src/circle/motion.js';
import { createLayer } from '../src/state.js';
import { CompiledLayer } from '../src/math/layers.js';
import { FUNCTIONS } from '../src/math/parser.js';
import { filmTracks } from '../src/anim/film.js';

const mk = (rule, lab, duration = 60) => { const c = defaultCircle(); c.rule = rule; c.lab = { [rule]: lab }; return new CircleSim(c, { duration, bpm: 100 }); };
const ctx = { t: 0, params: { a: 1, b: 1, c: 1, d: 1 }, view: {} };

test('figure-eight three-body orbit comes back to its start after one period', () => {
  const s = mk('threebody', { speed: 1, ghost: 0 });
  for (let t = 0; s.sc.T < FIGURE8.T - 0.004; t += 1 / 480) s.advance(t, () => {});
  const a = s.sc.a[0];
  assert.ok(Math.hypot(a.x - FIGURE8.x, a.y - FIGURE8.y) < 0.02, `${a.x}, ${a.y}`);
});

test('double pendulum: the equations conserve energy, and twins drift apart', () => {
  const s = mk('dpendulum', { count: 2, angle: 150, diff: 1e-4 });
  const e0 = dpEnergy(s.sc.p[0]);
  for (let t = 0; t < 25; t += 1 / 30) s.advance(t, () => {});
  assert.ok(Math.abs(dpEnergy(s.sc.p[0]) - e0) < 1e-3);
  assert.ok(Math.abs(s.sc.p[0].t2 - s.sc.p[1].t2) > 0.1, 'chaos separates them');
});

test('brachistochrone: the cycloid wins; tautochrone: all arrive together at π√(R/g)', () => {
  let s = mk('brachisto', { kind: 'race', slow: 0.35 });
  for (let t = 0; t < 30; t += 1 / 60) s.advance(t, () => {});
  const at = Object.fromEntries(s.sc.lines.map((l) => [l.name, l.at]));
  assert.ok(at.cycloid < at['straight line'] && at.cycloid < at.parabola && at.cycloid <= at['circular arc']);
  s = mk('brachisto', { kind: 'tautochrone', slow: 0.35, beads: 5 });
  const sc = s.sc, T = Math.PI * Math.sqrt(sc.R / 9.81); // π√(R/g): time from any start to the bottom
  for (const b of sc.beads) {
    const [x, y] = brachisto.tautAt(sc, b, T), bottom = [sc.A[0] + sc.R * Math.PI, sc.A[1] - 2 * sc.R];
    assert.ok(Math.hypot(x - bottom[0], y - bottom[1]) < 1e-6, `bead ${b.i}`);
    assert.ok(Math.hypot(...brachisto.tautAt(sc, b, 0).map((v, i) => v - brachisto.tautAt(sc, b, 4 * T)[i])) < 1e-6, 'periodic');
  }
  const { R, phi } = cycloidThrough(1.6, 1.1);
  assert.ok(Math.abs(R * (phi - Math.sin(phi)) - 1.6) < 1e-6 && Math.abs(R * (1 - Math.cos(phi)) - 1.1) < 1e-6);
});

test('Kuramoto: weak pull stays scattered, strong pull falls into step', () => {
  const weak = mk('kuramoto', { k0: 0, k1: 0, spread: 0.3 }), strong = mk('kuramoto', { k0: 3, k1: 3, spread: 0.1 });
  for (let t = 0; t < 30; t += 1 / 30) { weak.advance(t, () => {}); strong.advance(t, () => {}); }
  assert.ok(weak.sc.r < 0.5 && strong.sc.r > 0.9, `${weak.sc.r} ${strong.sc.r}`);
});

test('Shepard scale: the chord after 12 steps is the same chord (it loops)', () => {
  const P = shepard.defaults;
  assert.deepEqual(shepard.chord(P, 0), shepard.chord(P, 12));
  assert.notDeepEqual(shepard.chord(P, 0), shepard.chord(P, 1));
  for (const n of shepard.chord(P, 5)) assert.ok(n.vel > 0 && n.vel <= 1);
});

test('primes: Sacks and Ulam spirals count the primes below the limit', () => {
  const s = mk('primes', { max: 1000, rate0: 500, accel: 1 });
  for (let t = 0; t < 5; t += 1 / 30) s.advance(t, () => {});
  assert.equal(s.sc.primes, 168);
});

test('zeta on the critical line vanishes at the first zeros; ζ(2) = π²/6', () => {
  const re = FUNCTIONS.zetare[0], im = FUNCTIONS.zetaim[0];
  for (const t of [14.134725142, 21.022039639, 25.010857580]) assert.ok(Math.hypot(re(t), im(t)) < 1e-6, String(t));
  assert.ok(Math.abs(re(2, 0) - Math.PI ** 2 / 6) < 1e-9);
  assert.equal(FUNCTIONS.isprime[0](97), 1);
});

test('flows, maps and (u, v) surfaces compile and give finite points', () => {
  const lorenz = new CompiledLayer(createLayer({ type: 'ode', exprs: { x: '10*(y-x)', y: 'x*(28-z)-y', z: 'x*y-8/3*z' }, samples: 4000, sim: { x0: 1, y0: 1, z0: 1, dt: 0.01, up: 'z', cz: 25 } }));
  const pts = lorenz.sample(ctx);
  assert.equal(pts.length, 4001 * 3);
  assert.ok(pts.every(Number.isFinite) && Math.max(...pts.map(Math.abs)) < 60);
  const cliff = new CompiledLayer(createLayer({ type: 'map', exprs: { x: 'sin(-1.4*y)+cos(-1.4*x)', y: 'sin(1.6*x)+0.7*cos(1.6*y)', z: '0' }, samples: 5000 }));
  const c = cliff.sample(ctx);
  assert.ok(c.every(Number.isFinite) && Math.max(...c.map(Math.abs)) <= 2.0001);
  const mob = new CompiledLayer(createLayer({ type: 'psurface', exprs: { x: '(1+v*cos(u/2))*cos(u)', y: 'v*sin(u/2)', z: '(1+v*cos(u/2))*sin(u)', pv: '0' }, range: { min: 0, max: 6.283 } }));
  assert.ok(mob.ok);
  const p = mob.surfAt(0, 0.5, ctx);
  assert.ok(Math.abs(p.x - 1.5) < 1e-9 && Math.abs(p.y) < 1e-9);
});

test('films: looping films end where they began; openings and finales write keyframes', () => {
  const T = filmTracks({ D: 24, open: 'spiral', climax: 'surge', finale: 'both', loop: true, endingSecs: 4 });
  for (const keys of Object.values(T)) assert.deepEqual(keys.at(-1).value, keys[0].value);
  const F = filmTracks({ D: 24, open: 'blackout', climax: 'speed', finale: 'both', endingSecs: 4 });
  assert.equal(F['visual.exposure'][0].value, 0);
  assert.ok(F['visual.letterbox'].at(-1).value === 1 && F['transport.speed'].some((k) => k.value > 1.5));
});
