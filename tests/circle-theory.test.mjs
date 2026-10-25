import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultCircle, eventsUntil, CIRCLE_RULES, ruleGroups, captionLine, formulaLine, CircleSim } from '../src/circle/sim.js';
import { notesForEvents } from '../src/circle/sound.js';

const cfgOf = (rule, lab = {}) => ({ ...defaultCircle(), rule, lab: { [rule]: lab } });
const notes = (rule, lab, dur = 30, bpm = 120) => {
  const cfg = cfgOf(rule, lab);
  return notesForEvents(eventsUntil(cfg, dur, { duration: dur, bpm }), cfg, { scale: 'chromatic', root: 0, noteLow: 40, noteHigh: 80 });
};

test('the new scenes are registered in their own groups', () => {
  assert.ok(CIRCLE_RULES.fifths && CIRCLE_RULES.roots);
  const groups = Object.fromEntries(ruleGroups());
  assert.ok(groups['Music theory'].some(([id]) => id === 'fifths'));
  assert.ok(groups['Complex numbers'].some(([id]) => id === 'roots'));
  assert.ok(captionLine(cfgOf('fifths')) && captionLine(cfgOf('roots')) && formulaLine(cfgOf('roots')));
});

test('walking the circle of fifths up from C plays C G D A … (power chords: root + fifth)', () => {
  const n = notes('fifths', { mode: 'walk', chord: 'power', every: 2, steps: 5, base: 48 });
  const roots = n.map((x) => x.midi);
  assert.deepEqual([0, 2, 4, 6, 8].map((i) => roots[i] % 12), [0, 7, 2, 9, 4]);
  assert.equal(roots[1] - roots[0], 7, 'a power chord is a fifth');
});

test('going down in fourths from C reaches F, B♭, E♭ …', () => {
  const n = notes('fifths', { mode: 'walk', dir: 'down', chord: 'note', every: 1, steps: 4, base: 48 });
  assert.deepEqual(n.slice(0, 4).map((x) => x.midi % 12), [0, 5, 10, 3]);
});

test('the chord progression I V vi IV in C is C, G, Am, F triads', () => {
  const n = notes('fifths', { mode: 'family', prog: 'I V vi IV', chord: 'triad', every: 2, base: 48 }).map((x) => x.midi);
  assert.deepEqual(n.slice(0, 3).map((m) => m - 48), [0, 4, 7]);
  assert.deepEqual(n.slice(3, 6).map((m) => m - 48), [7, 11, 14]); // G major
  assert.deepEqual(n.slice(6, 9).map((m) => m - 48), [9, 12, 16]); // A minor
  assert.deepEqual(n.slice(9, 12).map((m) => m - 48), [5, 9, 12]); // F major
});

test('a scale is 7 neighbours: stacking fifths F C G D A E B, then C D E F G A B C', () => {
  const n = notes('fifths', { mode: 'scale', every: 1, base: 48 }).map((x) => x.midi % 12);
  assert.deepEqual(n.slice(0, 7), [5, 0, 7, 2, 9, 4, 11]);
  assert.deepEqual(n.slice(7, 15), [0, 2, 4, 5, 7, 9, 11, 0]);
});

test('the comma: the 13th note is 23.46 cents above the first, played together', () => {
  const n = notes('fifths', { mode: 'comma', every: 1, base: 48 }, 20);
  assert.equal(n.length, 14);
  assert.ok(Math.abs(n[12].midi - 48 - 0.2346) < 1e-3, `got ${n[12].midi}`);
  assert.equal(n[13].midi, 48);
});

test('roots: z^n = 1 places n roots, one note each', () => {
  const n = notes('roots', { mode: 'roots', n: 6, n2: 6, every: 1 }, 20);
  assert.equal(n.length, 6);
  const grow = notes('roots', { mode: 'roots', n: 3, n2: 5, every: 1 }, 60);
  assert.equal(grow.length, 3 + 4 + 5);
});

test('powers of a root: m = 2 on n = 7 visits all 7 and closes; n = 6 closes after 3', () => {
  assert.equal(notes('roots', { mode: 'power', n: 7, m: 2, every: 1 }, 30).length, 8);
  assert.equal(notes('roots', { mode: 'power', n: 6, m: 2, every: 1 }, 30).length, 4);
  const all = notes('roots', { mode: 'power', n: 6, all: true, every: 1 }, 120).length;
  assert.equal(all, (6 + 1) + (3 + 1) + (2 + 1) + (3 + 1) + (6 + 1));
});

test('euler and multiply play and the scenes draw without errors', () => {
  assert.ok(notes('roots', { mode: 'euler', every: 1, sweep: 4 }, 12).length >= 4);
  assert.ok(notes('roots', { mode: 'multiply', angle: 90, steps: 8, every: 1 }, 30).length >= 8);
  // draw on a recording canvas context
  const calls = [];
  const store = {};
  const g = new Proxy(store, { get: (t, k) => (k in t ? t[k] : (...a) => { calls.push(k); }) });
  const pal = { ring: '#fff', glow: '#0ff', ball: '#fff', line: () => '#fff' };
  for (const [rule, labs] of [['fifths', ['walk', 'family', 'scale', 'relative', 'comma']], ['roots', ['roots', 'power', 'multiply', 'sum', 'euler']]]) {
    for (const mode of labs) {
      const cfg = cfgOf(rule, { mode });
      const sim = new CircleSim(cfg, { duration: 30, bpm: 120 });
      sim.advance(9);
      const D = { g, X: (x) => 500 + x * 400, Y: (y) => 500 - y * 400, R: 400, k: 1, pal, look: {}, time: 9, lastHit: 8.5, energy: 0 };
      sim.scene.draw(sim, sim.P, D);
      assert.ok(typeof sim.scene.stats(sim, sim.P) === 'string', `${rule}/${mode}`);
    }
  }
  assert.ok(calls.length > 100);
});
