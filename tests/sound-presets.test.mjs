import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SCALES, SCALE_LABELS, SCALE_GROUPS, SCALE_PERIOD, quantize, scaleNotesBetween, yToMidi } from '../src/math/music.js';
import { INSTRUMENTS } from '../src/audio/instruments.js';
import { SOUND_PRESETS } from '../presets-src/sounds.js';
import { defaultState, mergeDeep } from '../src/state.js';

test('scales: well formed, labelled, grouped', () => {
  const keys = Object.keys(SCALES);
  assert.ok(keys.length >= 110, `${keys.length} scales`);
  assert.deepEqual(SCALE_GROUPS.flatMap(([, k]) => k).sort(), [...keys].sort());
  for (const k of keys) {
    assert.ok(SCALE_LABELS[k], k);
    const s = SCALES[k];
    if (!s) continue;
    assert.equal(s[0], 0, k);
    for (let i = 1; i < s.length; i++) assert.ok(s[i] > s[i - 1], `${k} rises`);
    assert.ok(s[s.length - 1] < SCALE_PERIOD[k], `${k} stays inside its period`);
  }
});

test('quantize: microtonal and non-octave scales land on scale notes', () => {
  assert.equal(quantize(63.6, 'rast', 0), 63.5);
  assert.equal(quantize(61.6, 'bayati', 0), 61.5);
  assert.equal(quantize(64.1, 'major', 0), 64);
  assert.equal(scaleNotesBetween('bohlenPierce', 0, 0, 19.02).length, 10); // 9 notes + the tritave (3:1)
  for (const m of [50.3, 61.7, 77.2]) assert.ok(scaleNotesBetween('bohlenPierce', 0, 0, 120).some((n) => Math.abs(n - quantize(m, 'bohlenPierce', 0)) < 1e-6), `${m}`);
  assert.equal(yToMidi(0, { yMin: -1, yMax: 1, noteLow: 48, noteHigh: 72, scale: 'continuous', root: 0 }), 60);
  // every note between the range ends belongs to the scale
  const pel = scaleNotesBetween('pelog', 2, 60, 84);
  for (const n of pel) assert.equal(quantize(n, 'pelog', 2), n);
});

test('sound presets: 150+ with unique names, real scales and instruments, safe values', () => {
  assert.ok(SOUND_PRESETS.length >= 150, `${SOUND_PRESETS.length}`);
  assert.equal(new Set(SOUND_PRESETS.map((s) => s.name)).size, SOUND_PRESETS.length);
  for (const s of SOUND_PRESETS) {
    const a = mergeDeep(defaultState().audio, s.audio);
    assert.ok(a.scale in SCALES, `${s.name}: ${a.scale}`);
    assert.ok(INSTRUMENTS[s.instrument], `${s.name}: ${s.instrument}`);
    assert.ok(a.noteLow < a.noteHigh && a.noteLow >= 21 && a.noteHigh <= 108, s.name);
    assert.ok(a.reverb.mix <= 0.7 && a.delay.feedback <= 0.75 && a.delay.mix <= 0.5, `${s.name}: wet levels`);
    assert.ok(['off', 'chorus', 'flanger', 'phaser'].includes(a.mod.type), s.name);
    assert.ok(a.pump.amount < 0.95 && a.crush <= 1 && a.drone.volume <= 1, s.name);
    assert.ok(s.about && s.group, s.name);
  }
});

test('the built catalog has the sound presets', () => {
  const idx = JSON.parse(readFileSync(new URL('../presets/index.json', import.meta.url), 'utf8'));
  const data = JSON.parse(readFileSync(new URL('../presets/sounds.json', import.meta.url), 'utf8'));
  assert.equal(idx.sounds.count, SOUND_PRESETS.length);
  assert.equal(data.presets.length, SOUND_PRESETS.length);
});

test('every sound has a register on its tonic and a melody whose notes stay inside it', async () => {
  const { CompiledLayer } = await import('../src/math/layers.js');
  const { createLayer } = await import('../src/state.js');
  const { yToMidi, SCALES, SCALE_PERIOD } = await import('../src/math/music.js');
  const data = JSON.parse(readFileSync(new URL('../presets/sounds.json', import.meta.url), 'utf8'));
  const ctx = { t: 0, params: { a: 1, b: 1, c: 1, d: 1 }, view: { xMin: 0, xMax: 1 } };
  for (const s of data.presets) {
    const [lo, hi] = s.register;
    assert.ok(hi - lo >= 24 && hi - lo <= 36, `${s.name}: register spans ${hi - lo} semitones`);
    assert.ok(lo >= 24 && hi <= 108, `${s.name}: ${lo}–${hi}`);
    assert.equal(((lo - s.audio.root) % 12 + 12) % 12, 0, `${s.name}: the register begins on the tonic`);
    assert.equal(s.audio.noteLow, lo);
    assert.equal(s.audio.noteHigh, hi);
    const m = s.melody, sh = data.shapes[m.shape];
    assert.ok(sh, `${s.name}: shape ${m.shape}`);
    const c = new CompiledLayer(createLayer({ type: sh.type, exprs: sh.exprs, range: sh.range }));
    assert.ok(c.ok, `${s.name}: shape compiles`);
    const map = { yMin: m.view.yMin, yMax: m.view.yMax, noteLow: m.noteLow, noteHigh: m.noteHigh, scale: s.audio.scale, root: s.audio.root };
    const p = { x: 0, y: 0, z: 0 };
    let min = Infinity, max = -Infinity, rawMin = Infinity, rawMax = -Infinity;
    for (let i = 0; i <= 600; i++) {
      c.at(i / 600, ctx, p);
      assert.ok(p.x >= m.view.xMin && p.x <= m.view.xMax && p.y >= m.view.yMin && p.y <= m.view.yMax, `${s.name}: the shape is inside the frame`);
      const note = yToMidi(p.y, map);
      min = Math.min(min, note); max = Math.max(max, note);
      const raw = yToMidi(p.y, { ...map, scale: 'continuous' });
      rawMin = Math.min(rawMin, raw); rawMax = Math.max(rawMax, raw);
    }
    assert.ok(Math.abs(rawMin - lo) < 0.05 && Math.abs(rawMax - hi) < 0.05, `${s.name}: the drawing spans ${rawMin.toFixed(2)}–${rawMax.toFixed(2)}, wanted ${lo}–${hi}`);
    const slack = SCALES[s.audio.scale] ? Math.max(1.5, SCALE_PERIOD[s.audio.scale] / 6) : 0.01; // snapping to a sparse scale may step a little past the edge
    assert.ok(min >= lo - slack && max <= hi + slack, `${s.name}: notes ${min}–${max} vs ${lo}–${hi}`);
    assert.ok(m.speed >= 0.5 && m.speed <= 1.5 && m.duration >= 12 && m.duration <= 30);
  }
});
