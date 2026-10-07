import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textAlpha } from '../src/ui/overlay.js';

test('text boxes fade in and out of their time window', () => {
  const always = { start: 0, end: 0 };
  assert.equal(textAlpha(always, 0), 1);
  assert.equal(textAlpha(always, 99), 1);
  const intro = { start: 1, end: 3 };
  assert.equal(textAlpha(intro, 0.5), 0);
  assert.ok(Math.abs(textAlpha(intro, 1.125) - 0.5) < 1e-9); // half-way through the 0.25 s fade-in
  assert.equal(textAlpha(intro, 2), 1);
  assert.ok(Math.abs(textAlpha(intro, 2.875) - 0.5) < 1e-9); // fading out
  assert.equal(textAlpha(intro, 3.5), 0);
});
