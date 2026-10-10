import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CircleSim, defaultCircle, eventsUntil, formulaLine, CIRCLE_RULES, ruleGroups } from '../src/circle/sim.js';
import { SCENES, sceneParams } from '../src/circle/scenes.js';
import { speedAt, worldFor, pixelFrame } from '../src/circle/layout.js';
import { LAB_PRESETS } from '../src/circle/presets-lab.js';
import { beats, RPS_NAMES, formulaError, pretty } from '../src/circle/battles.js';

const cfg = (rule, lab = {}, extra = {}) => ({ ...defaultCircle(), rule, lab: { [rule]: lab }, ...extra });
const env = { duration: 30, bpm: 120, ratio: 9 / 16 };

test('there are 25+ new simulations, all grouped in the picker', () => {
  assert.ok(Object.keys(SCENES).length >= 25);
  const listed = ruleGroups().flatMap(([, items]) => items.map(([id]) => id));
  assert.deepEqual(new Set(listed), new Set(Object.keys(CIRCLE_RULES)));
});

test('every scene runs, makes sound events, has a formula and a counter', () => {
  for (const id of Object.keys(SCENES)) {
    const c = cfg(id);
    const sim = new CircleSim(c, env);
    const ev = [];
    sim.advance(12, (e) => ev.push(e));
    assert.ok(ev.length > 0, `${id} makes events`);
    assert.ok(ev.every((e) => Number.isFinite(e.t) && e.t <= 12 + 1e-9), `${id} event times`);
    assert.equal(typeof formulaLine(c), 'string');
    assert.ok(SCENES[id].stats(sim, sim.P).length > 0, `${id} counter`);
  }
});

test('scenes are deterministic', () => {
  for (const id of ['triple', 'galton', 'paper', 'chaos', 'colorwar', 'coral']) {
    assert.deepEqual(eventsUntil(cfg(id), 6, env), eventsUntil(cfg(id), 6, env), id);
  }
});

test('balls stay inside the world (safe area)', () => {
  for (const id of ['triple', 'boxcore', 'shatter', 'escapeplus', 'beatfill', 'galton', 'hexagon']) {
    const sim = new CircleSim(cfg(id), env);
    sim.advance(15);
    for (const b of sim.balls) {
      assert.ok(Math.abs(b.x) <= sim.W.hw + 0.05 && Math.abs(b.y) <= sim.W.hh + 0.05, `${id}: ball at ${b.x.toFixed(2)}, ${b.y.toFixed(2)}`);
    }
  }
});

test('splitting core multiplies by N up to the cap', () => {
  const sim = new CircleSim(cfg('triple', { coreN: 3, max: 81 }), env);
  sim.advance(30);
  assert.ok(sim.balls.length <= 81 && sim.balls.length >= 60, `${sim.balls.length} balls`);
});

test('paper halves until the piece count', () => {
  const sim = new CircleSim(cfg('paper', { mode: 'half', max: 64 }), env);
  sim.advance(30);
  assert.equal(sim.sc.pieces.length, 64);
});

test('settings per simulation override the defaults', () => {
  const P = sceneParams(cfg('radar', { blips: 9 }));
  assert.equal(P.blips, 9);
  assert.equal(P.sweep, SCENES.radar.defaults.sweep);
});

test('speed curve: from → to, with a beat pulse; the simulation clock follows it', () => {
  const sp = { from: 1, to: 3, curve: 'linear', pulse: 0 };
  assert.equal(speedAt(sp, 0, 10), 1);
  assert.equal(speedAt(sp, 5, 10), 2);
  assert.equal(speedAt(sp, 10, 10), 3);
  assert.ok(speedAt({ from: 1, to: 1, curve: 'linear', pulse: 1 }, 0, 10, 120) > 1.9);
  assert.equal(speedAt({ from: 1, to: 0.2, curve: 'late' }, 5, 10), 1);
  const sim = new CircleSim(cfg('dna', {}, { speed: { from: 2, to: 2, curve: 'linear', pulse: 0 } }), env);
  sim.advance(4);
  assert.ok(Math.abs(sim.st - 8) < 0.02, `sim time ${sim.st}`);
});

test('world = safe area: taller than wide on vertical video', () => {
  const w = worldFor(9 / 16);
  assert.equal(w.hw, 1);
  assert.ok(w.hh > 1.15);
  const F = pixelFrame(1080, 1920);
  assert.ok(F.band.y > 0.15 * 1920 && F.band.y + F.band.h < 0.77 * 1920, 'between the Shorts title and caption zones');
});

test('new presets: known simulations, YouTube-safe texts', () => {
  assert.ok(LAB_PRESETS.length >= 30);
  for (const p of LAB_PRESETS) {
    assert.ok(SCENES[p.circle.rule], `${p.name}: ${p.circle.rule}`);
    assert.ok(p.hook.text && p.youtube.title.length <= 100, p.name);
    assert.ok(!/[<>]/.test(p.youtube.title + p.youtube.description), p.name);
  }
});

test('rock paper scissors (lizard Spock): one formula gives every classic rule', () => {
  const id = Object.fromEntries(RPS_NAMES.map((n, i) => [n, i]));
  const wins = [['paper', 'rock'], ['rock', 'scissors'], ['scissors', 'paper']];
  for (const [a, b] of wins) { assert.ok(beats(id[a], id[b], 3)); assert.ok(!beats(id[b], id[a], 3)); }
  const wins5 = [...wins, ['rock', 'lizard'], ['lizard', 'spock'], ['spock', 'scissors'], ['scissors', 'lizard'], ['lizard', 'paper'], ['paper', 'spock'], ['spock', 'rock']];
  for (const [a, b] of wins5) { assert.ok(beats(id[a], id[b], 5), `${a} beats ${b}`); assert.ok(!beats(id[b], id[a], 5)); }
});

test('battles: someone wins, populations rise and fall, knives level up', () => {
  const r = new CircleSim(cfg('rps', { chase: '0.1 + 0.03*t' }, { seed: 13 }), env);
  r.advance(30);
  assert.ok(SCENES.rps.counts(r).includes(60), 'one team took over');
  const p = new CircleSim(cfg('predator'), env);
  const flowers = [];
  for (let t = 1; t <= 30; t++) { p.advance(t); flowers.push(p.sc.fl.length); }
  assert.ok(Math.max(...flowers) > 100 && Math.min(...flowers.slice(5)) < 20, 'boom and bust');
  const k = new CircleSim(cfg('knives'), env);
  k.advance(30);
  assert.ok(k.sc.n >= 3 && k.sc.hits > 10);
});

test('formulas drive the blade and the spike; bad formulas fall back', () => {
  const pop = new CircleSim(cfg('popper', { x: 'cos(4*t)*cos(t)', y: 'cos(4*t)*sin(t)' }), env);
  pop.advance(20);
  assert.ok(pop.sc.popped > 50 && pop.segments.length > 1000);
  const bad = new CircleSim(cfg('slicer', { ba: 'sin(', bx: 'oops' }), env);
  bad.advance(3);
  assert.ok(bad.sc.b.length >= 1);
  assert.ok(formulaError('sin(', ['t']));
  assert.equal(formulaError('cos(4*t)*sin(t)', ['t']), '');
  assert.equal(pretty('16*sin(t)^3/17'), '16·sin(t)³/17');
});
