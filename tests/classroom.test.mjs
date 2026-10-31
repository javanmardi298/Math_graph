import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSROOM_PRESETS } from '../presets-src/classroom.js';
import { normalize } from '../src/state.js';
import { CompiledLayer } from '../src/math/layers.js';
import { layerTiming } from '../src/math/sequence.js';

test('five lessons of about five minutes, 16:9, with large centred formulas', () => {
  assert.equal(CLASSROOM_PRESETS.length, 5);
  for (const p of CLASSROOM_PRESETS) {
    assert.ok(p.transport.duration >= 270 && p.transport.duration <= 330, `${p.name}: ${p.transport.duration}`);
    assert.equal(p.visual.aspect, '16:9');
    assert.equal(p.overlay.formulas.align, 'center');
    assert.ok(p.overlay.formulas.size >= 1.5);
    // little text: short step titles only
    for (const t of p.overlay.texts) assert.ok(t.text.length <= 60, `${p.name}: "${t.text}"`);
    assert.ok(p.about?.math);
  }
});

test('steps follow each other: one main formula at a time, layers compile', () => {
  for (const p of CLASSROOM_PRESETS) {
    const st = normalize(p), D = st.transport.duration;
    for (const l of st.layers) assert.ok(new CompiledLayer(l).ok, `${p.name} / ${l.name}`);
    for (let t = 6; t < D - 8; t += 3) {
      const shown = st.layers.filter((l) => l.caption !== '-' && t >= l.captionStart && t <= l.captionEnd);
      assert.ok(shown.length <= 1, `${p.name} at ${t}s: ${shown.map((l) => l.name)}`);
    }
    const pose = st.keyframes.tracks['camera.pose'];
    assert.ok(pose.length > 10 && pose.every((k, i) => !i || k.time >= pose[i - 1].time), `${p.name}: camera frames each step`);
  }
});

test('drawFor: a layer finishes drawing early and stays until its window ends', () => {
  const l = { start: 10, end: 40, drawFor: 5 };
  assert.equal(layerTiming([l], l, 5, 60, false).phase, 'future');
  assert.equal(layerTiming([l], l, 12.5, 60, false).u, 0.5);
  const later = layerTiming([l], l, 30, 60, false);
  assert.ok(later.u === 1 && later.phase === 'active');
  assert.equal(layerTiming([l], l, 41, 60, false).phase, 'past');
});
