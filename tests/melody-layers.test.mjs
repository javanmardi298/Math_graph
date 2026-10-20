import test from 'node:test';
import assert from 'node:assert/strict';
import { createLayer } from '../src/state.js';
import { melodyMidi } from '../src/audio/sonify.js';
import { LAYER_PRESETS } from '../presets-src/sound-layers.js';
import { SCALES } from '../src/math/music.js';
import { INSTRUMENTS } from '../src/audio/instruments.js';
import { MELODIES } from '../src/circle/sound.js';
import { CompiledLayer } from '../src/math/layers.js';

const audio = { scale: 'chromatic', root: 0 };

test('a melody layer plays one note per slice of its pass', () => {
  const l = createLayer({ pitchFrom: 'melody', melody: 'custom', notes: 'C4 E4 G4 C5' });
  assert.equal(melodyMidi(l, 0, audio), 60);
  assert.equal(melodyMidi(l, 0.3, audio), 64);
  assert.equal(melodyMidi(l, 0.6, audio), 67);
  assert.equal(melodyMidi(l, 1, audio), 72);
});

test('loops repeat the melody, octave transposes, height layers return null', () => {
  const l = createLayer({ pitchFrom: 'melody', melody: 'custom', notes: 'C4 E4', melodyLoops: 2, octave: -1 });
  assert.deepEqual([0, 0.3, 0.6, 0.9].map((u) => melodyMidi(l, u, audio)), [48, 52, 48, 52]);
  assert.equal(melodyMidi(createLayer(), 0.5, audio), null);
  assert.equal(melodyMidi(createLayer({ pitchFrom: 'melody', melody: 'custom', notes: '' }), 0.5, audio), null);
});

test('a melody is snapped to the scale unless the scale is continuous', () => {
  const l = createLayer({ pitchFrom: 'melody', melody: 'custom', notes: 'C#4' });
  assert.ok([60, 62].includes(melodyMidi(l, 0, { scale: 'major', root: 0 })));
  assert.equal(melodyMidi(l, 0, { scale: 'continuous', root: 0 }), 61);
});

test('layered shows: every formula compiles, names exist, keyframe paths are real', () => {
  assert.ok(LAYER_PRESETS.length >= 6);
  for (const p of LAYER_PRESETS) {
    assert.ok(p.layers.length >= 2, p.name);
    p.layers.forEach((l, i) => {
      const c = new CompiledLayer(createLayer(l));
      assert.ok(c.ok, `${p.name} layer ${i + 1}: ${JSON.stringify(c.errors)}`);
      assert.ok(INSTRUMENTS[l.wave], `${p.name}: instrument ${l.wave}`);
      if (l.pitchFrom === 'melody') assert.ok(MELODIES[l.melody]?.notes, `${p.name}: melody ${l.melody}`);
    });
    assert.ok(SCALES[p.audio.scale], `${p.name}: scale`);
    assert.ok(Object.keys(p.keyframes.tracks).length >= 2, `${p.name}: keyframes`);
    for (const t of Object.values(p.keyframes.tracks)) assert.ok(t.every((k, j) => j === 0 || k.time > t[j - 1].time && k.time <= p.transport.duration), `${p.name}: key times`);
  }
});
