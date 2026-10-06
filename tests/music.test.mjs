import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quantize, yToMidi, noteName, midiToFreq } from '../src/math/music.js';
import { writeMidi, samplesToNotes } from '../src/export/midi.js';

const map = { yMin: -3, yMax: 3, noteLow: 36, noteHigh: 84, scale: 'continuous', root: 0 };

test('y maps linearly onto the note range', () => {
  assert.equal(yToMidi(-3, map), 36);
  assert.equal(yToMidi(3, map), 84);
  assert.equal(yToMidi(0, map), 60);
  assert.equal(yToMidi(99, map), 84); // clamped
  assert.equal(yToMidi(NaN, map), null);
  assert.equal(yToMidi(0, map, 1), 72);
});
test('quantize snaps to scale', () => {
  assert.equal(quantize(61, 'major', 0), 60); // C# → C (tie goes to lower)
  assert.equal(quantize(61.6, 'major', 0), 62);
  assert.equal(quantize(66, 'pentatonic', 0), 67); // F# → G
  assert.equal(quantize(70.9, 'major', 0), 71);
  assert.equal(quantize(71.6, 'major', 0), 72); // wraps to next octave root
  assert.equal(quantize(62.3, 'continuous'), 62.3);
});
test('names and frequency', () => {
  assert.equal(noteName(60), 'C4');
  assert.equal(noteName(69), 'A4');
  assert.equal(midiToFreq(69), 440);
});
test('MIDI file is well formed', () => {
  const notes = samplesToNotes([
    { time: 0, midi: 60, vel: 100 }, { time: 0.1, midi: 60.2, vel: 100 },
    { time: 0.2, midi: 64, vel: 90 }, { time: 0.3, midi: null, vel: 0 },
  ], 0.1);
  assert.equal(notes.length, 2);
  assert.equal(notes[0].midi, 60);
  assert.ok(Math.abs(notes[0].dur - 0.2) < 1e-9);
  const bytes = writeMidi([{ name: 'Layer 1', channel: 0, program: 81, notes }], 120);
  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), 'MThd');
  assert.equal(bytes[11], 2); // tempo track + 1 layer
  assert.equal(String.fromCharCode(...bytes.slice(14, 18)), 'MTrk');
});
