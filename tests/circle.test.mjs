import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CircleSim, defaultCircle, eventsUntil, chordStep, formulaLine } from '../src/circle/sim.js';
import { notesForEvents, parseNotes } from '../src/circle/sound.js';

const cfg = (rule, patch = {}) => { const c = defaultCircle(); c.rule = rule; for (const [k, v] of Object.entries(patch)) Object.assign(c[k], v); return c; };
const audio = { scale: 'minorPentatonic', root: 9, noteLow: 45, noteHigh: 81 };

test('chord: a rational step closes into a star, an irrational one never does', () => {
  assert.ok(Math.abs(chordStep('1/phi^2') - 0.381966) < 1e-6);
  const star = eventsUntil(cfg('chord', { chord: { step: '2/5', speed: 3 } }), 20).filter((e) => e.type === 'hit');
  const a0 = star[0].angle;
  assert.ok(Math.abs(Math.cos(star[5].angle - a0) - 1) < 1e-9, 'back to the first hit after 5');
  const gold = eventsUntil(cfg('chord', { chord: { step: '1/phi^2', speed: 3 } }), 20).filter((e) => e.type === 'hit');
  const repeats = gold.slice(1).some((e) => Math.abs(Math.cos(e.angle - gold[0].angle) - 1) < 1e-9);
  assert.equal(repeats, false);
});

test('same settings → same events (deterministic)', () => {
  const c = cfg('split', { physics: { gravity: 2 } });
  assert.deepEqual(eventsUntil(c, 6), eventsUntil(c, 6));
});

test('split doubles balls up to the cap; bounces stay inside the circle', () => {
  const sim = new CircleSim(cfg('split', { split: { max: 64 } }));
  sim.advance(30);
  assert.equal(sim.balls.length, 64);
  for (const b of sim.balls) assert.ok(Math.hypot(b.x, b.y) <= 1 + 1e-9);
});

test('grow fills the circle, escape breaks rings', () => {
  const g = eventsUntil(cfg('grow', { grow: { amount: 0.03, until: 0.8 } }), 60);
  assert.ok(g.some((e) => e.type === 'fill'));
  const e = eventsUntil(cfg('escape', { escape: { rings: 3, gap: 60 } }), 90).filter((x) => x.type === 'escape');
  assert.ok(e.length >= 1);
});

test('polyrhythm: dot k swings base + k times per cycle', () => {
  const ev = eventsUntil(cfg('polyrhythm', { poly: { dots: 3, base: 4, cycle: 10 } }), 10.05);
  const count = (i) => ev.filter((e) => e.ball === i).length;
  assert.deepEqual([count(0), count(1), count(2)], [4, 5, 6]);
});

test('notes: melodies, thinning and formula text', () => {
  assert.deepEqual(parseNotes('C4 D#4 Bb3'), [60, 63, 58]);
  const c = cfg('chord', { chord: { speed: 6 }, sound: { pitch: 'melody', melody: 'ode', maxRate: 10 } });
  const notes = notesForEvents(eventsUntil(c, 5), c, audio);
  assert.deepEqual(notes.slice(0, 4).map((n) => n.midi), [64, 64, 65, 67]);
  for (let i = 1; i < notes.length; i++) assert.ok(notes[i].t - notes[i - 1].t >= 0.1 - 1e-9);
  assert.equal(formulaLine(cfg('chord')), 'angle = 1/φ² turn');
});
