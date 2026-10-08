import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixWebmDuration } from '../src/export/webm-duration.js';

// A 2.5 s recording made by Chrome's MediaRecorder: no Duration in its Segment Info.
const raw = readFileSync(new URL('./fixtures/chrome-recording.webm', import.meta.url));

/** Duration (seconds) written in a WebM's Info, or null. */
function durationOf(bytes) {
  const i = bytes.indexOf(Buffer.from([0x15, 0x49, 0xa9, 0x66]));
  const d = bytes.indexOf(Buffer.from([0x44, 0x89, 0x88]), i);
  return d < 0 || d - i > 200 ? null : bytes.readDoubleBE(d + 3) / 1000;
}

test('adds the duration to a Chrome WebM recording', async () => {
  assert.equal(durationOf(raw), null);
  const fixed = Buffer.from(await (await fixWebmDuration(new Blob([raw]), 2.5)).arrayBuffer());
  assert.equal(durationOf(fixed), 2.5);
  assert.ok(Math.abs(fixed.length - raw.length) < 32);
  // Everything after the Info element is untouched
  assert.deepEqual(fixed.subarray(fixed.length - 1000), raw.subarray(raw.length - 1000));
});

test('replaces an existing duration instead of adding a second one', async () => {
  const once = await fixWebmDuration(new Blob([raw]), 2.5);
  const twice = Buffer.from(await (await fixWebmDuration(once, 7)).arrayBuffer());
  assert.equal(durationOf(twice), 7);
  assert.equal(twice.length, (await once.arrayBuffer()).byteLength);
});

test('leaves files it does not understand alone', async () => {
  const notWebm = new Blob([new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70])]);
  assert.equal(await fixWebmDuration(notWebm, 3), notWebm);
});
