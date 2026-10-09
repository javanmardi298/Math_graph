import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layerTiming } from '../src/math/sequence.js';

const A = { enabled: true }, B = { enabled: false }, C = { enabled: true }, D = { enabled: true };
const L = [A, B, C, D]; // B is off, so the order is A, C, D with 4 s each over 12 s

test('together: every layer spans the timeline', () => {
  assert.deepEqual(layerTiming(L, C, 6, 12, false), { u: 0.5, phase: 'active' });
});
test('sequence: layers take turns, disabled ones are skipped', () => {
  assert.deepEqual(layerTiming(L, A, 2, 12, true), { u: 0.5, phase: 'active' });
  assert.equal(layerTiming(L, C, 2, 12, true).phase, 'future');
  assert.deepEqual(layerTiming(L, C, 6, 12, true), { u: 0.5, phase: 'active' });
  assert.deepEqual(layerTiming(L, A, 6, 12, true), { u: 1, phase: 'past' });
  assert.equal(layerTiming(L, D, 12, 12, true).u, 1); // the end belongs to the last layer
  assert.equal(layerTiming(L, B, 6, 12, true).phase, 'future');
});

test('linked layers share a step; any number can chain', async () => {
  const { layerTiming, layerGroups } = await import('../src/math/sequence.js');
  const L = (name, withPrev = false, enabled = true) => ({ name, withPrev, enabled });
  const a = L('a'), b = L('b', true), c = L('c', true), d = L('d'), e = L('e', true, false), f = L('f', true);
  const layers = [a, b, c, d, e, f];
  assert.deepEqual(layerGroups(layers).map((g) => g.map((l) => l.name)), [['a', 'b', 'c'], ['d', 'f']]);
  // 2 steps over 10 s: a, b, c play 0-5 s together; d and f play 5-10 s
  for (const l of [a, b, c]) assert.deepEqual(layerTiming(layers, l, 2.5, 10, true), { u: 0.5, phase: 'active' });
  assert.equal(layerTiming(layers, d, 2.5, 10, true).phase, 'future');
  assert.deepEqual(layerTiming(layers, f, 7.5, 10, true), { u: 0.5, phase: 'active' });
  assert.equal(layerTiming(layers, a, 7.5, 10, true).phase, 'past');
  // the first layer can't link to anything above it
  assert.equal(layerGroups([L('x', true), L('y')]).length, 2);
});
