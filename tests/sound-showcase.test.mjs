import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SHOWCASE_PRESETS } from '../presets-src/sound-showcase.js';
import { SOUND_PRESETS } from '../presets-src/sounds.js';
import { SCALES } from '../src/math/music.js';
import { normalize } from '../src/state.js';

test('50 showcase presets: unique, playable, with a spectrum and YouTube texts', () => {
  assert.equal(SHOWCASE_PRESETS.length, 50);
  assert.equal(new Set(SHOWCASE_PRESETS.map((p) => p.name)).size, 50);
  const sounds = new Set(SOUND_PRESETS.map((s) => s.name));
  for (const p of SHOWCASE_PRESETS) {
    assert.ok(sounds.has(p.name.replace('Showcase · ', '')), p.name);
    assert.ok(p.audio.scale in SCALES, p.name);
    assert.equal(p.visual.analyzer, 'spectrum');
    assert.equal(p.visual.aspect, '9:16');
    assert.ok(p.audio.noteLow < p.audio.noteHigh);
    assert.ok(p.youtube.title.length <= 100 && p.youtube.title.endsWith('#shorts'), p.name);
    assert.ok(p.youtube.tags.length <= 500);
    assert.ok(p.hook.text);
    assert.equal(normalize(p).layers.length, 1);
  }
});

test('the showcase is on its own shelf and in an importable pack', () => {
  const idx = JSON.parse(readFileSync(new URL('../presets/index.json', import.meta.url), 'utf8'));
  assert.equal(idx.shelves.find((s) => s.id === 'sound-showcase').count, 50);
  const pack = JSON.parse(readFileSync(new URL('../packs/sound-showcase.mmv.json', import.meta.url), 'utf8'));
  assert.equal(pack.$format, 'math-melody-presets');
  assert.equal(pack.presets.length, 50);
});
