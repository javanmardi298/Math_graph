import test from 'node:test';
import assert from 'node:assert/strict';
import { synth } from './helpers/synth.mjs';
import { trackPitch } from '../src/analysis/pitch.js';
import { segmentNotes } from '../src/analysis/notes.js';
import { estimateTempo, quantizeNotes, autoDivision } from '../src/analysis/tempo.js';
import { estimateTuning, rankScales } from '../src/analysis/key.js';
import { describeTimbre, nearestInstruments } from '../src/analysis/timbre.js';
import { compareAudio } from '../src/analysis/similarity.js';
import { stairFormula } from '../src/analysis/to-preset.js';
import { mixToMono } from '../src/analysis/dsp.js';
import { CompiledLayer } from '../src/math/layers.js';
import { createLayer } from '../src/state.js';
import { analyzeFile, transcribe, buildPreset, REVERBS, instrumentCandidates } from '../src/analysis/index.js';
import { FINGERPRINTS } from '../src/analysis/fingerprints.js';
import { INSTRUMENTS } from '../src/audio/instruments.js';

const bpm = 100, beat = 60 / bpm;
const MEL = [60, 62, 64, 65, 67, 67, 69, 67, 64, 64, 62, 60, 60, 67, 72, 71];
const noteList = (mel, step = beat / 2, t0 = 0.3) => mel.map((m, i) => ({ t: t0 + i * step, d: step * 0.9, m }));
const tune = (mel, o) => synth(noteList(mel), { decay: 2, ...o });

test('pitch tracker and segmentation recover every note of a melody', async () => {
  const track = await trackPitch(tune(MEL));
  const notes = segmentNotes(track);
  assert.equal(notes.length, MEL.length);
  notes.forEach((n, i) => {
    assert.ok(Math.abs(n.midi - MEL[i]) < 0.1, `note ${i}: ${n.midi}`);
    assert.ok(Math.abs(n.start - (0.3 + i * beat / 2)) < 0.03, `start ${i}: ${n.start}`);
  });
});

test('repeated notes are separate notes and rests stay rests', async () => {
  const mel = [60, 60, 60, -1, 64, 64];
  const buf = synth(mel.map((m, i) => ({ t: 0.2 + i * 0.4, d: 0.34, m: m > 0 ? m : 0, v: m > 0 ? 1 : 0 })), { decay: 3 });
  const notes = segmentNotes(await trackPitch(buf));
  assert.deepEqual(notes.map((n) => Math.round(n.midi)), [60, 60, 60, 64, 64]);
});

test('tempo and beat phase', async () => {
  const track = await trackPitch(tune(MEL));
  const notes = segmentNotes(track);
  const t = estimateTempo(notes, track);
  assert.ok(Math.abs(t.bpm - bpm) < 1.5, `bpm ${t.bpm}`);
  assert.ok(t.confidence > 0.8);
  const q = quantizeNotes(notes, { bpm: t.bpm, offset: t.offset, division: autoDivision(notes, t.bpm, t.offset) });
  q.forEach((n, i) => assert.ok(Math.abs(n.start - (0.3 + i * beat / 2)) < 0.03));
});

test('a 432 Hz recording is detected, and ordinary tuning is left alone', async () => {
  const a = segmentNotes(await trackPitch(synth(noteList(MEL), { tuning: 432 })));
  const ta = estimateTuning(a);
  assert.ok(Math.abs(ta.cents + 31.8) < 4, `${ta.cents}`);
  const b = estimateTuning(segmentNotes(await trackPitch(tune(MEL))));
  assert.equal(b.cents, 0);
});

test('key and scale: A minor melody is A minor, a pentatonic tune is pentatonic', async () => {
  const minor = [57, 59, 60, 62, 64, 65, 64, 62, 60, 59, 57, 57];
  const n1 = segmentNotes(await trackPitch(tune(minor)));
  const r1 = rankScales(n1, estimateTuning(n1))[0];
  assert.equal(`${r1.scale}/${r1.root}`, 'minor/9');
  const penta = [60, 62, 64, 67, 69, 67, 64, 62, 60, 62, 64, 67, 69, 72, 69, 67, 64, 62, 60];
  const n2 = segmentNotes(await trackPitch(tune(penta)));
  const r2 = rankScales(n2, estimateTuning(n2))[0];
  assert.equal(`${r2.scale}/${r2.root}`, 'pentatonic/0');
});

test('quarter-tone melody is recognised as microtonal and as a maqam', async () => {
  // Rast on C: C D E-quarter-flat F G A B-quarter-flat C
  const rast = [60, 62, 63.5, 65, 67, 69, 70.5, 72, 70.5, 69, 67, 65, 63.5, 62, 60, 60];
  const n = segmentNotes(await trackPitch(tune(rast)));
  const tu = estimateTuning(n);
  assert.equal(tu.microtonal, true);
  const best = rankScales(n, tu)[0];
  assert.equal(best.scale, 'rast');
  assert.equal(best.root, 0);
});

test('timbre fingerprints tell a plucked tone from a flute-like tone', () => {
  const marks = [48, 55, 60, 67, 72].map((m, i) => ({ start: i * 1.2, end: i * 1.2 + 0.9, midi: m }));
  const mk = (o) => { const b = synth(marks.map((n) => ({ t: n.start, d: 0.9, m: n.midi })), o); return describeTimbre(mixToMono(b), b.sampleRate, marks); };
  const pluck = mk({ harm: [1, 0.6, 0.5, 0.4, 0.3, 0.2], attack: 0.003, decay: 4 });
  const flute = mk({ harm: [1, 0.1, 0.03], attack: 0.08 });
  const hits = nearestInstruments(pluck, [{ id: 'pluck', vec: pluck }, { id: 'flute', vec: flute }], 2);
  assert.equal(hits[0].id, 'pluck');
  assert.ok(hits[1].distance > hits[0].distance + 1);
});

test('similarity: the same tune scores high, a different key scores low', () => {
  const a = tune(MEL), same = tune(MEL), other = tune(MEL.map((m) => m + 3));
  assert.ok(compareAudio(a, same).score > 0.97);
  assert.ok(compareAudio(a, other).score < 0.6);
});

test('every instrument has a fingerprint and the file is current', () => {
  const ids = new Set(FINGERPRINTS.map((f) => f.id));
  for (const id of Object.keys(INSTRUMENTS)) assert.ok(ids.has(id), `${id} has no fingerprint: run node scripts/build-fingerprints.mjs`);
  for (const f of FINGERPRINTS) assert.equal(f.vec.length, 11);
});

test('the staircase formula plays each note, with rests and repeats', () => {
  const segs = [{ start: 0.5, stop: 0.9, y: 60 }, { start: 1, stop: 1.4, y: 62 }, { start: 1.5, stop: 1.9, y: 62 }, { start: 3, stop: 3.5, y: 64.5 }, { start: 4, stop: 4.2, y: 67 }];
  const f = new CompiledLayer(createLayer({ type: 'function', exprs: { y: stairFormula(segs), z: '0' } }));
  assert.ok(f.ok, JSON.stringify(f.errors));
  const view = { xMin: 0, xMax: 5, yMin: 0, yMax: 100 };
  const y = (x) => f.at(x / 5, { t: 0, params: { a: 1, b: 1, c: 1, d: 1 }, view }).y;
  assert.ok(Number.isNaN(y(0.2)));
  assert.equal(y(0.7), 60);
  assert.ok(Number.isNaN(y(0.95)));
  assert.equal(y(1.2), 62);
  assert.ok(Number.isNaN(y(1.45)));
  assert.equal(y(1.7), 62);
  assert.ok(Number.isNaN(y(2.5)));
  assert.equal(y(3.2), 64.5);
  assert.equal(y(4.1), 67);
  assert.ok(Number.isNaN(y(4.5)));
});

test('whole pipeline: file in, valid preset out', async () => {
  const buf = tune(MEL, { len: 6 });
  const session = await analyzeFile(buf, { name: 'Test tune' });
  const r = transcribe(session);
  assert.equal(r.notes.length, MEL.length);
  assert.ok(Math.abs(r.bpm - bpm) < 1.5);
  assert.equal(r.scale.scale, 'major');
  assert.ok(instrumentCandidates(session, r, 3).length === 3);
  const p = buildPreset({ notes: r.notes, bpm: r.bpm, scale: 'major', root: 0, tuning: r.tuning.hz, instrument: 'sine', articulation: 'pluck', reverb: REVERBS[1], name: 'Test tune' });
  assert.equal(p.view.yMin, p.audio.noteLow);
  assert.equal(p.view.yMax, p.audio.noteHigh);
  assert.equal(p.layers.length, 1);
  assert.equal(p.layers[0].wave, 'sine');
  assert.equal(p.audio.scale, 'major');
  assert.ok(p.transport.duration >= 4);
});
