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
