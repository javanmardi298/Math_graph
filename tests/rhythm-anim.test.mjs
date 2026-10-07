import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gridAt, stepSeconds, barsToSeconds } from '../src/math/rhythm.js';
import { evaluate, upsertKey, removeKey, applyValues, valuesAt } from '../src/anim/keyframes.js';
import { DrumScanner } from '../src/audio/drum-scanner.js';

const close = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);

test('grid steps at 120 bpm', () => {
  const r = { division: '1/8', swing: 0 };
  close(stepSeconds(r, 120), 0.25);
  const g = gridAt(0.6, r, 120);
  assert.equal(g.index, 2);
  close(g.start, 0.5);
  close(g.phase, 0.4);
  close(barsToSeconds(4, 120), 8);
});
test('swing delays the off-step', () => {
  const r = { division: '1/8', swing: 1 };
  assert.equal(gridAt(0.3, r, 120).index, 0); // off-step now starts at 0.375
  assert.equal(gridAt(0.4, r, 120).index, 1);
  close(gridAt(0.4, r, 120).start, 0.375);
});
test('keyframes interpolate numbers, colours and hold', () => {
  const tracks = {};
  upsertKey(tracks, 'params.a', 2, 10, 'linear');
  upsertKey(tracks, 'params.a', 0, 0, 'linear');
  assert.deepEqual(tracks['params.a'].map((k) => k.time), [0, 2]);
  close(evaluate(tracks['params.a'], 1), 5);
  assert.equal(evaluate(tracks['params.a'], -1), 0);
  assert.equal(evaluate(tracks['params.a'], 9), 10);
  upsertKey(tracks, 'params.a', 0.01, 4, 'hold'); // replaces the key at 0
  assert.equal(tracks['params.a'].length, 2);
  assert.equal(evaluate(tracks['params.a'], 1.9), 4);
  upsertKey(tracks, 'visual.background', 0, '#000000', 'linear');
  upsertKey(tracks, 'visual.background', 1, '#ffffff', 'linear');
  assert.equal(evaluate(tracks['visual.background'], 0.5), '#808080');
  removeKey(tracks, 'visual.background', 0);
  removeKey(tracks, 'visual.background', 0);
  assert.equal(tracks['visual.background'], undefined);
});
test('applyValues writes into state and reports what changed', () => {
  const state = { params: { a: 1 }, layers: [{ color: '#000000' }], visual: { bloom: { strength: 1 } } };
  const changed = applyValues(state, valuesAt({ 'params.a': [{ time: 0, value: 3 }], 'layer.0.color': [{ time: 0, value: '#ff0000' }] }, 0));
  assert.equal(state.params.a, 3);
  assert.equal(state.layers[0].color, '#ff0000');
  assert.deepEqual([...changed].sort(), ['layer:0', 'params']);
  assert.equal(applyValues(state, valuesAt({ 'params.a': [{ time: 0, value: 3 }] }, 0)).size, 0);
});
test('drum scanner finds peaks, valleys, crossings and beats', () => {
  const s = new DrumScanner();
  const cfg = { kick: 'valley', snare: 'peak', hat: 'zero', clap: 'beat', sensitivity: 0.05 };
  const ctx = { mid: 0, range: 2, bpm: 120, rhythm: { division: '1/8' } };
  // sin(2πt): peaks at .25, 1.25; valleys at .75, 1.75; crossings at .5, 1, 1.5 (not 0: no prior sample)
  const y = (t) => Math.sin(2 * Math.PI * t);
  const ev = [...s.scan(0, 1, y, cfg, ctx), ...s.scan(1, 2, y, cfg, ctx)];
  const times = (k) => ev.filter((e) => e.kind === k).map((e) => +e.time.toFixed(2));
  assert.deepEqual(times('snare'), [0.25, 1.25]);
  assert.deepEqual(times('kick'), [0.75, 1.75]);
  assert.deepEqual(times('hat'), [0.5, 1, 1.5]);
  assert.deepEqual(times('clap'), [0, 0.5, 1, 1.5, 2]);
});
