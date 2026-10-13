import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SOUND_SHAPE_PRESETS } from '../presets-src/sound-shapes.js';
import { SHOWCASE_PRESETS } from '../presets-src/sound-showcase.js';
import { SOUND_PRESETS } from '../presets-src/sounds.js';
import { CompiledLayer } from '../src/math/layers.js';
import { createLayer, normalize } from '../src/state.js';
import { yToMidi } from '../src/math/music.js';

const ctx = { t: 0, params: { a: 1, b: 1, c: 1, d: 1 }, view: { xMin: 0, xMax: 1 } };

/** The notes a preset's drawing plays (raw pitch, before the scale snaps it). */
function span(p) {
  const l = p.layers[0];
  const c = new CompiledLayer(createLayer({ type: l.type, exprs: l.exprs, range: l.range }));
  assert.ok(c.ok, `${p.name}: compiles`);
  const map = { yMin: p.view.yMin, yMax: p.view.yMax, noteLow: p.audio.noteLow, noteHigh: p.audio.noteHigh, scale: 'continuous', root: 0 };
  const pt = { x: 0, y: 0, z: 0 };
  let lo = Infinity, hi = -Infinity, inside = true;
  for (let i = 0; i <= 800; i++) {
    c.at(i / 800, ctx, pt);
    const n = yToMidi(pt.y, map);
    lo = Math.min(lo, n); hi = Math.max(hi, n);
    if (pt.x < p.view.xMin || pt.x > p.view.xMax || pt.y < p.view.yMin || pt.y > p.view.yMax) inside = false;
  }
  return { lo, hi, inside };
}

test('46 shape-in-a-mood presets: unique, vertical, on the sound’s register, fully inside the frame', () => {
  assert.equal(SOUND_SHAPE_PRESETS.length, 46);
  assert.equal(new Set(SOUND_SHAPE_PRESETS.map((p) => p.name)).size, 46);
  const sounds = new Map(SOUND_PRESETS.map((s) => [s.name, s]));
  for (const p of SOUND_SHAPE_PRESETS) {
    const s = sounds.get(p.name.split(' · ')[1]);
    assert.ok(s, p.name);
    const { lo, hi, inside } = span(p);
    assert.ok(inside, `${p.name}: the shape fits the frame`);
    assert.ok(Math.abs(lo - s.register[0]) < 0.05 && Math.abs(hi - s.register[1]) < 0.05, `${p.name}: plays ${lo.toFixed(2)}–${hi.toFixed(2)}, the register is ${s.register}`);
    assert.equal(p.audio.scale, s.audio.scale);
    assert.equal(p.layers[0].wave, s.instrument);
    assert.equal(p.visual.aspect, '9:16');
    assert.equal(p.visual.analyzer, 'off');
    assert.ok(p.overlay.formulas.enabled);
    assert.ok(p.hook.text && p.youtube.title.endsWith('#shorts') && p.youtube.title.length <= 100, p.name);
    assert.ok(p.youtube.tags.length <= 500);
    assert.ok(p.transport.speed > 0.5 && p.transport.speed < 1.5);
    assert.equal(normalize(p).layers.length, 1);
  }
});

test('the showcase plays each sound in its own register too, with the sound’s own tempo and speed', () => {
  const sounds = new Map(SOUND_PRESETS.map((s) => [s.name, s]));
  for (const p of SHOWCASE_PRESETS) {
    const s = sounds.get(p.name.replace('Showcase · ', ''));
    const { lo, hi, inside } = span(p);
    assert.ok(inside, p.name);
    assert.ok(Math.abs(lo - s.register[0]) < 0.05 && Math.abs(hi - s.register[1]) < 0.05, `${p.name}: ${lo.toFixed(2)}–${hi.toFixed(2)} vs ${s.register}`);
    assert.equal(p.transport.speed, s.melody.speed);
    assert.equal(p.transport.bpm, s.melody.bpm);
  }
});

test('the series is on its own shelf and in an importable pack', () => {
  const idx = JSON.parse(readFileSync(new URL('../presets/index.json', import.meta.url), 'utf8'));
  assert.equal(idx.shelves.find((s) => s.id === 'sound-shapes').count, 46);
  const pack = JSON.parse(readFileSync(new URL('../packs/sound-shapes.mmv.json', import.meta.url), 'utf8'));
  assert.equal(pack.presets.length, 46);
});
