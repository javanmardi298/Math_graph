import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cameraMove, endingShot, CAMERA_MOVE_DEFAULTS } from '../src/camera-moves.js';

test('no moves: the camera stays where it is', () => {
  const m = cameraMove(CAMERA_MOVE_DEFAULTS, { time: 5, progress: 0.3, bpm: 120 });
  assert.deepEqual(m, { zoom: 1, dx: 0, dy: 0, roll: 0, flare: 0, active: false });
});

test('push-in grows over the video, pull-out shrinks; both end/start at ×1', () => {
  const at = (c, p) => cameraMove({ ...CAMERA_MOVE_DEFAULTS, ...c }, { progress: p }).zoom;
  assert.equal(at({ push: 0.5 }, 0), 1);
  assert.ok(at({ push: 0.5 }, 0.5) > 1 && at({ push: 0.5 }, 1) > at({ push: 0.5 }, 0.5));
  assert.ok(Math.abs(at({ push: 0.5 }, 1) - 1.6) < 1e-9);
  assert.ok(at({ push: -0.5 }, 0) > at({ push: -0.5 }, 0.5));
  assert.equal(at({ push: -0.5 }, 1), 1);
  assert.equal(at({ zoom: 2 }, 0.7), 2);
});

test('drift, shake, sway and spin are deterministic and bounded', () => {
  const c = { ...CAMERA_MOVE_DEFAULTS, drift: 1, shake: 1, sway: 1, spin: 10 };
  for (let t = 0; t < 60; t += 0.37) {
    const a = cameraMove(c, { time: t, progress: t / 60, bpm: 100 }), b = cameraMove(c, { time: t, progress: t / 60, bpm: 100 });
    assert.deepEqual(a, b);
    assert.ok(Math.abs(a.dx) < 0.05 && Math.abs(a.dy) < 0.05);
    assert.ok(Math.abs(a.roll - 10 * t) < 3.5);
  }
  assert.equal(cameraMove({ ...CAMERA_MOVE_DEFAULTS, breathe: 1 }, { time: 0, bpm: 120 }).zoom, 1.05); // on the beat
  assert.ok(cameraMove({ ...CAMERA_MOVE_DEFAULTS, breathe: 1 }, { time: 0.25, bpm: 120 }).zoom < 1.001); // between beats
});

test('the final shot: nothing before it, a pull-back and a glow flare inside it, none on short videos', () => {
  const c = { ...CAMERA_MOVE_DEFAULTS, ending: 'zoomout', endingSecs: 2 };
  assert.equal(cameraMove(c, { time: 10, duration: 20 }).active, false);
  const mid = cameraMove(c, { time: 19, duration: 20 });
  assert.ok(mid.active && mid.zoom < 1 && mid.flare > 0);
  assert.ok(cameraMove(c, { time: 20, duration: 20 }).zoom < mid.zoom);
  assert.equal(endingShot({ ending: 'off' }, { time: 19.5, duration: 20 }), null);
  assert.equal(endingShot(c, { time: 3.5, duration: 4 }), null); // too short to carry a final shot
  assert.ok(cameraMove({ ...CAMERA_MOVE_DEFAULTS, ending: 'pushin', endingSecs: 2 }, { time: 20, duration: 20 }).zoom > 1);
});

test('every final shot is finite, ends where it says, and "off" does nothing', async () => {
  const { ENDINGS } = await import('../src/camera-moves.js');
  for (const id of Object.keys(ENDINGS)) {
    const m = cameraMove({ ...CAMERA_MOVE_DEFAULTS, ending: id, endingSecs: 2 }, { time: 19.6, duration: 20 });
    for (const v of [m.zoom, m.dx, m.dy, m.roll, m.flare]) assert.ok(Number.isFinite(v), id);
    assert.equal(m.active, id !== 'off', id);
  }
  assert.ok(cameraMove({ ...CAMERA_MOVE_DEFAULTS, ending: 'crash', endingSecs: 2 }, { time: 20, duration: 20 }).zoom > 1.5);
  assert.ok(cameraMove({ ...CAMERA_MOVE_DEFAULTS, ending: 'slide', endingSecs: 2 }, { time: 20, duration: 20 }).dx > 0);
});
