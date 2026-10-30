import test from 'node:test';
import assert from 'node:assert/strict';
import { CINEMATIC_PRESETS } from '../presets-src/cinematic.js';
import { createLayer, normalize } from '../src/state.js';
import { CompiledLayer } from '../src/math/layers.js';
import { SCALES } from '../src/math/music.js';
import { INSTRUMENTS } from '../src/audio/instruments.js';
import { BACKDROPS, paintBackdrop } from '../src/render/backdrops.js';
import { ENDINGS } from '../src/camera-moves.js';

const ctx = (over = {}) => ({ view: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }, t: 0, params: { a: 1, b: 1, c: 1, d: 1 }, ...over });

test('six formulas in three styles in 2D, six in 3D, all with a final shot and a closing chord', () => {
  assert.equal(CINEMATIC_PRESETS.length, 24);
  assert.equal(new Set(CINEMATIC_PRESETS.map((p) => p.name)).size, 24);
  for (const p of CINEMATIC_PRESETS) {
    const D = p.transport.duration;
    assert.ok(['glitch', 'string', 'web'].includes(p.visual.fx.style), p.name);
    assert.ok(p.visual.backdrop in BACKDROPS && p.camera.ending in ENDINGS, p.name);
    assert.ok(p.audio.scale in SCALES, p.name);
    const chord = p.layers.filter((l) => l.hidden);
    assert.equal(chord.length, 4, p.name);
    for (const c of chord) assert.ok(Math.abs(c.start - (D - p.camera.endingSecs)) < 1e-6, `${p.name}: the chord starts with the final shot`);
    assert.ok(p.layers.filter((l) => !l.hidden).length >= 3, `${p.name}: several layers`);
    for (const l of p.layers) if (INSTRUMENTS[l.wave] === undefined) assert.ok(['sine', 'triangle', 'square', 'sawtooth'].includes(l.wave), `${p.name}: ${l.wave}`);
    // the film: a close-up that pulls back before the final shot
    const z = p.keyframes.tracks['camera.zoom'];
    assert.ok(z[0].value > 2 && z.at(-1).value === 1 && z.at(-1).time < D - 1.5, p.name);
    assert.equal(p.keyframes.tracks['camera.track'][0].value, 1);
  }
});

test('every formula compiles and draws a finite curve of the expected size', () => {
  for (const p of CINEMATIC_PRESETS) {
    const st = normalize(p);
    for (const l of st.layers.filter((x) => !x.hidden)) {
      const c = new CompiledLayer(l);
      assert.ok(c.ok, `${p.name} / ${l.name}: ${JSON.stringify(c.errors)}`);
      const pts = c.sample(ctx({ view: st.view }));
      let max = 0;
      for (let i = 0; i < pts.length; i++) { assert.ok(Number.isFinite(pts[i]), p.name); max = Math.max(max, Math.abs(pts[i])); }
      assert.ok(max > 0 && max <= st.view.xMax * 1.01, `${p.name}: the curve fits its window (${max} vs ${st.view.xMax})`);
    }
  }
});

test('the closing chord plays notes inside the note range', () => {
  for (const p of CINEMATIC_PRESETS) {
    const { noteLow, noteHigh } = p.audio, { yMin, yMax } = p.view;
    for (const l of p.layers.filter((x) => x.hidden)) {
      const midi = noteLow + ((+l.exprs.y - yMin) / (yMax - yMin)) * (noteHigh - noteLow);
      assert.ok(midi > 30 && midi < 100, `${p.name}: ${midi}`);
    }
  }
});

test('backdrops paint on a canvas without error, the same way twice', () => {
  const run = (kind) => {
    const calls = [];
    const g = new Proxy({}, { get: (_, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : (...a) => { calls.push(`${String(k)}${a.length}`); } ), set: () => true });
    paintBackdrop(g, kind, 270, 480, '#04050a', '#4f6bff');
    return calls.join();
  };
  for (const k of Object.keys(BACKDROPS)) assert.equal(run(k), run(k), k);
  assert.ok(run('stars').length > run('solid').length);
  void createLayer;
});
