import test from 'node:test';
import assert from 'node:assert/strict';
import { SCIENCE_PRESETS } from '../presets-src/science.js';
import { MOOD_PRESETS } from '../presets-src/moods.js';
import { SCIENCE2_PRESETS } from '../presets-src/science2.js';
import { normalize } from '../src/state.js';
import { CompiledLayer } from '../src/math/layers.js';
import { SCENES } from '../src/circle/scenes.js';
import { FX_STYLES } from '../src/render/fx-styles.js';
import { BACKDROPS } from '../src/render/backdrops.js';
import { ENDINGS } from '../src/camera-moves.js';
import { shelfOf } from '../presets-src/catalog.js';

const ALL = [...SCIENCE_PRESETS, ...MOOD_PRESETS, ...SCIENCE2_PRESETS];
const ctx = (st) => ({ t: 0, params: { a: 1, b: 1, c: 1, d: 1, ...(st.params || {}) }, view: st.view });

test('every new preset explains its maths in the panel (about), not on the video', () => {
  assert.ok(ALL.length >= 60);
  for (const p of ALL) {
    assert.ok(p.about && p.about.math && p.about.math.length > 20, `${p.name}: about.math`);
    assert.ok(!(p.overlay?.texts || []).length, `${p.name}: no teaching text drawn on the video`);
    assert.ok(shelfOf(p) && !['formulas-2d', 'formulas-3d', 'classic'].includes(shelfOf(p)), `${p.name}: on its own shelf (${shelfOf(p)})`);
  }
  assert.equal(new Set(ALL.map((p) => p.name)).size, ALL.length);
});

test('formula presets compile, stay inside their window and use known styles', () => {
  for (const p of ALL.filter((x) => x.mode !== 'circle')) {
    const st = normalize(p);
    assert.ok(st.visual.fx.style in FX_STYLES && st.visual.backdrop in BACKDROPS && st.camera.ending in ENDINGS, p.name);
    for (const l of st.layers.filter((x) => !x.hidden)) {
      const c = new CompiledLayer(l);
      assert.ok(c.ok, `${p.name} / ${l.name}: ${JSON.stringify(c.errors)}`);
      if (l.type === 'psurface') {
        const q = c.surfAt((l.range.min + l.range.max) / 2, (l.surf.vMin + l.surf.vMax) / 2, ctx(st));
        assert.ok([q.x, q.y, q.z].every(Number.isFinite), `${p.name}: surface point`);
        continue;
      }
      const pts = c.sample(ctx(st));
      let finite = 0, max = 0;
      for (const v of pts) if (Number.isFinite(v)) { finite++; max = Math.max(max, Math.abs(v)); }
      assert.equal(finite, pts.length, `${p.name} / ${l.name}: finite`);
      const v = st.view, lim = Math.max(Math.abs(v.xMin), Math.abs(v.xMax), Math.abs(v.yMin), Math.abs(v.yMax)) * 1.05;
      assert.ok(max > 0 && max <= lim, `${p.name} / ${l.name}: fits its window (${max.toFixed(2)} ≤ ${lim.toFixed(2)})`);
    }
  }
});

test('loops close: every animated value returns to its start, and no final shot interrupts', () => {
  for (const p of ALL) {
    const looping = p.visual?.loop && p.visual.loop !== 'off';
    const sceneLoop = p.mode === 'circle' && p.camera.ending === 'off';
    if (!looping && !sceneLoop) continue;
    assert.equal(p.camera.ending, 'off', p.name);
    for (const [path, keys] of Object.entries(p.keyframes.tracks)) {
      if (keys.length < 2) continue;
      const a = keys[0].value, b = keys.at(-1).value;
      if (path === 'params.a' && Math.abs(Math.abs(b - a) - 2 * Math.PI) < 1e-3) continue; // a phase that turns once round
      assert.deepEqual(b, a, `${p.name}: ${path}`);
    }
  }
});

test('circle-scene presets use real scenes and periodic ones last a whole number of periods', () => {
  for (const p of ALL.filter((x) => x.mode === 'circle')) {
    assert.ok(SCENES[p.circle.rule], `${p.name}: ${p.circle.rule}`);
    const lab = p.circle.lab[p.circle.rule];
    if (p.circle.rule === 'shepard' && p.camera.ending === 'off') {
      const steps = p.transport.duration / lab.step;
      assert.ok(Math.abs(steps / 12 - Math.round(steps / 12)) < 1e-3, `${p.name}: whole number of 12-step cycles`);
    }
    if (p.circle.rule === 'pendulum' && p.camera.ending === 'off') assert.equal(p.transport.duration % lab.cycle, 0, p.name);
  }
});
