import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../src/state.js';
import {
  evaluate, upsertKey, valuesAt, animatable, laneOf, toKeyPath, toStorePath, snapshotValues, addKeyframe,
  keyframeTimes, pathsAt, moveKeyframe, deleteKeyframe, copyKeyframe, setEaseAt, isStep,
} from '../src/anim/keyframes.js';
import { makeWarp } from '../src/anim/timewarp.js';
import { shortsTiming, mapVideoTime } from '../src/export/shorts.js';

test('names and switches hold until the next key, numbers glide', () => {
  const scale = [{ time: 0, value: 'major', ease: 'smooth' }, { time: 4, value: 'hijaz', ease: 'smooth' }];
  assert.equal(evaluate(scale, 3.9), 'major');
  assert.equal(evaluate(scale, 4), 'hijaz');
  const num = [{ time: 0, value: 0, ease: 'linear' }, { time: 4, value: 8, ease: 'linear' }];
  assert.equal(evaluate(num, 2), 4);
  const root = [{ time: 0, value: 0, ease: 'smooth' }, { time: 4, value: 7, ease: 'smooth' }];
  assert.ok(isStep('audio.root'));
  assert.equal(valuesAt({ 'audio.root': root }, 3.9).get('audio.root'), 0);
});

test('ease in starts slow, ease out ends slow', () => {
  const mk = (ease) => [{ time: 0, value: 0, ease }, { time: 10, value: 10, ease }];
  assert.ok(evaluate(mk('in'), 2) < 2);
  assert.ok(evaluate(mk('out'), 2) > 2);
});

test('everything audible and visible can be keyed', () => {
  const st = defaultState();
  const paths = new Set(animatable(st).map((a) => a.path));
  for (const p of ['audio.scale', 'audio.root', 'audio.reverb.decay', 'audio.mod.type', 'layer.0.wave', 'layer.0.mute', 'transport.speed', 'camera.zoom', 'camera.spin', 'visual.drawMode', 'visual.gridColor']) assert.ok(paths.has(p), p);
  assert.equal(laneOf('audio.scale'), 'Sound');
  assert.equal(laneOf('transport.speed'), 'Speed');
  assert.equal(laneOf('layer.2.color'), 'Layers');
});

test('store paths map to keyframe paths and back', () => {
  const st = defaultState();
  const id = st.layers[0].id;
  assert.equal(toKeyPath(st, `layers.${id}.wave`), 'layer.0.wave');
  assert.equal(toKeyPath(st, 'audio.scale'), 'audio.scale');
  assert.equal(toStorePath(st, 'layer.0.wave'), `layers.${id}.wave`);
});

test('a full keyframe holds the chosen lanes only', () => {
  const st = defaultState();
  const snap = snapshotValues(st, ['Sound', 'Speed'], {});
  assert.ok('audio.scale' in snap && 'transport.speed' in snap);
  assert.ok(!('camera.zoom' in snap) && !('visual.background' in snap));
  const tracks = {};
  addKeyframe(tracks, 3, snap);
  assert.deepEqual(keyframeTimes(tracks, 'all'), [3]);
  assert.deepEqual(keyframeTimes(tracks, 'Look'), []);
  assert.ok(pathsAt(tracks, 3, 'Speed').includes('transport.speed'));
});

test('keyframes can be moved, copied, re-eased and deleted', () => {
  const tracks = {};
  upsertKey(tracks, 'camera.zoom', 2, 1);
  upsertKey(tracks, 'audio.master', 2, 0.5);
  upsertKey(tracks, 'audio.master', 6, 0.9);
  assert.equal(moveKeyframe(tracks, 2, 5, 'all', 10), 5);
  assert.deepEqual(keyframeTimes(tracks, 'all'), [5, 6]);
  assert.equal(tracks['camera.zoom'][0].time, 5);
  // moving only one lane leaves the others
  moveKeyframe(tracks, 5, 1, 'Camera', 10);
  assert.equal(tracks['camera.zoom'][0].time, 1);
  assert.equal(tracks['audio.master'][0].time, 5);
  // dropping onto an existing key replaces it
  moveKeyframe(tracks, 5, 6, 'Sound', 10);
  assert.equal(tracks['audio.master'].length, 1);
  assert.equal(tracks['audio.master'][0].value, 0.5);
  // clamps to the length
  assert.equal(moveKeyframe(tracks, 1, 99, 'Camera', 10), 10);
  assert.equal(copyKeyframe(tracks, 6, 8, 'Sound'), 1);
  setEaseAt(tracks, 8, 'hold', 'Sound');
  assert.equal(tracks['audio.master'].find((k) => k.time === 8).ease, 'hold');
  assert.equal(deleteKeyframe(tracks, 8, 'Sound'), 1);
  assert.equal(deleteKeyframe(tracks, 6, 'all'), 1);
  assert.ok(!tracks['audio.master']);
});

test('time warp: constant speed is a plain division', () => {
  const w = makeWarp(20, 2);
  assert.equal(w.total, 10);
  assert.equal(w.real(6), 3);
  assert.equal(w.timeline(3), 6);
  assert.equal(w.animated, false);
});

test('time warp: a speed track bends time and inverts cleanly', () => {
  // 1x for the first 10 s, 2x for the last 10 s (linear ramp-free: hold)
  const keys = [{ time: 0, value: 1, ease: 'hold' }, { time: 10, value: 2, ease: 'hold' }, { time: 20, value: 2, ease: 'hold' }];
  const w = makeWarp(20, 1, keys);
  assert.ok(w.animated);
  assert.ok(Math.abs(w.total - 15) < 0.05, `total ${w.total}`);
  assert.ok(Math.abs(w.real(10) - 10) < 0.05);
  for (const t of [0, 3.3, 10, 14, 20]) assert.ok(Math.abs(w.timeline(w.real(t)) - t) < 0.02, `round trip ${t}`);
  assert.equal(w.speedAt(15), 2);
  // a slow-down in the middle makes the video longer than the timeline
  const slow = makeWarp(10, 1, [{ time: 0, value: 1 }, { time: 5, value: 0.25 }, { time: 10, value: 1 }]);
  assert.ok(slow.total > 10);
});

test('shorts timing follows the speed curve', () => {
  const keys = [{ time: 0, value: 1, ease: 'hold' }, { time: 10, value: 2, ease: 'hold' }, { time: 20, value: 2, ease: 'hold' }];
  const warp = makeWarp(20, 1, keys);
  const T = shortsTiming({ hook: { enabled: false }, outro: 0 }, 20, { warp });
  assert.ok(Math.abs(T.duration - 15) < 0.05);
  const mid = mapVideoTime(T, 10);
  assert.ok(Math.abs(mid.time - 10) < 0.1, `video second 10 shows timeline ${mid.time}`);
  const late = mapVideoTime(T, 12.5);
  assert.ok(Math.abs(late.time - 15) < 0.1);
  // no warp: unchanged behaviour
  const plain = shortsTiming({ hook: { enabled: false }, outro: 0 }, 20, { speed: 2 });
  assert.equal(plain.duration, 10);
  assert.equal(mapVideoTime(plain, 5).time, 10);
});
