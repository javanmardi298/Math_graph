import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shortsTiming, mapVideoTime, frameEffects, hookTextFor } from '../src/export/shorts.js';

const rec = { hook: { enabled: true, teaser: 0.8, flash: true, impact: true }, outro: 0.6 };

test('video = teaser + timeline + outro', () => {
  const T = shortsTiming(rec, 20);
  assert.equal(T.total, 21.4);
  assert.equal(mapVideoTime(T, 0.4).phase, 'teaser');
  assert.ok(Math.abs(mapVideoTime(T, 0.4).time - 20) < 0.01); // the teaser shows the finished picture
  assert.deepEqual(mapVideoTime(T, 0.8 + 5), { phase: 'main', time: 5, k: 0.25 });
  assert.equal(mapVideoTime(T, 21.3).phase, 'outro');
  assert.ok(T.hookEnd >= 2);
});

test('flash at the cut, black at the very end', () => {
  const T = shortsTiming(rec, 10);
  assert.ok(frameEffects(T, 0.81).flash > 0.7);
  assert.equal(frameEffects(T, 3).flash, 0);
  assert.equal(frameEffects(T, T.total - 0.01).black, 1);
  assert.equal(frameEffects(T, 5).black, 0);
});

test('hook off: plain timeline plus the fade-out', () => {
  const T = shortsTiming({ hook: { enabled: false }, outro: 0.5 }, 10);
  assert.equal(T.total, 10.5);
  assert.equal(mapVideoTime(T, 0).phase, 'main');
  assert.equal(frameEffects(T, 0.1).flash, 0);
});

test('hook line falls back to the YouTube title without hashtags', () => {
  assert.equal(hookTextFor({ name: 'n', youtube: { title: 'Can circles draw a square? 🔄 #shorts #math' } }), 'Can circles draw a square? 🔄');
  assert.equal(hookTextFor({ name: 'n', hook: { text: 'Wait for it' }, youtube: { title: 'x' } }), 'Wait for it');
  assert.equal(hookTextFor({ name: 'Rose' }), 'Rose');
});
