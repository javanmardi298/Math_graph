/**
 * Audio → preset. The slow step (pitch tracking) runs once per file; everything the person can
 * change afterwards (sensitivity, tempo, grid, key, tuning) re-runs only the quick steps.
 *
 *   analyzeFile(buffer)            pitch track + loudness + a timbre fingerprint
 *   transcribe(session, options)   notes, tempo, quantized notes, tuning, ranked scales
 *   instrumentCandidates(session)  nearest app instruments by timbre
 *   verify(session, result, render) play candidates back through the synth and compare
 */
import { trackPitch } from './pitch.js';
import { segmentNotes } from './notes.js';
import { estimateTempo, autoDivision, quantizeNotes } from './tempo.js';
import { estimateTuning, rankScales, noteRange } from './key.js';
import { describeTimbre, nearestInstruments } from './timbre.js';
import { compareAudio } from './similarity.js';
import { mixToMono, median, percentile } from './dsp.js';
import { buildPreset, REVERBS } from './to-preset.js';
import { FINGERPRINTS } from './fingerprints.js';
import { INSTRUMENTS } from '../audio/instruments.js';

export { REVERBS, buildPreset };

export const MAX_SECONDS = 150;

/** Octaves (in semitones) an instrument sounds above the note it is given: music box +12, reese bass −12. */
export const shiftOf = (id) => FINGERPRINTS.find((f) => f.id === id)?.shift || 0;

/**
 * @param {AudioBuffer-like} buffer the decoded file
 * @param {{seconds?:number, name?:string}} [o]
 * @param {(p:number)=>void} [onProgress]
 */
export async function analyzeFile(buffer, o = {}, onProgress) {
  const seconds = Math.min(buffer.length / buffer.sampleRate, o.seconds ?? MAX_SECONDS);
  const ranges = o.range ? [REGISTERS[o.range]] : [REGISTERS.normal, REGISTERS.high, REGISTERS.bass];
  let best = null;
  for (let i = 0; i < ranges.length; i++) {
    const track = await trackPitch(buffer, { seconds, ...ranges[i] }, (p) => onProgress?.((i + p) / ranges.length));
    const v = voicedShare(track);
    if (!best || v > best.v) best = { track, v, range: o.range || Object.keys(REGISTERS)[i] };
    if (v >= 0.55 || o.range) break; // clearly pitched: no need to try other registers
  }
  return { buffer, track: best.track, seconds, name: o.name || 'Audio', range: best.range, voiced: best.v };
}

/** Pitch ranges the tracker can listen in (Hz). */
export const REGISTERS = { normal: { fmin: 55, fmax: 1400 }, high: { fmin: 200, fmax: 2800 }, bass: { fmin: 28, fmax: 420 } };

/** Of the frames that are loud enough to matter, how many have a clear pitch. */
function voicedShare(track) {
  const loud = percentile(track.rms, 0.98);
  let on = 0, ok = 0;
  for (let i = 0; i < track.rms.length; i++) {
    if (track.rms[i] < loud * 0.1) continue;
    on++;
    if (Number.isFinite(track.midi[i]) && track.conf[i] > 0.6) ok++;
  }
  return on ? ok / on : 0;
}

export const DEFAULTS = { sensitivity: 0.5, minNote: 0.07, octave: 0, division: 'auto', bpm: null, scale: null, root: null, snap: true, tuning: null, floorDb: 42 };

/**
 * @param {object} session from analyzeFile
 * @param {Partial<typeof DEFAULTS>} [opt]
 */
export function transcribe(session, opt = {}) {
  const o = { ...DEFAULTS, ...opt };
  const raw = segmentNotes(session.track, { sensitivity: o.sensitivity, minNote: o.minNote, octave: o.octave, floorDb: o.floorDb });
  const tempo = estimateTempo(raw, session.track);
  const bpm = o.bpm || tempo.bpm;
  const division = o.division === 'auto' ? autoDivision(raw, bpm, tempo.offset) : +o.division || 0;
  const detected = estimateTuning(raw);
  const tuning = o.tuning == null ? detected : { ...detected, cents: Math.round(1200 * Math.log2(o.tuning / 440)) };
  const q = quantizeNotes(raw, { bpm, offset: tempo.offset, division });
  const ranked = rankScales(q, tuning);
  let pick = ranked[0] || null;
  if (o.scale) pick = ranked.find((r) => r.scale === o.scale && (o.root == null || r.root === o.root)) || { scale: o.scale, label: o.scale, root: o.root ?? pick?.root ?? 0, coverage: 0, score: 0 };
  else if (o.root != null && pick) pick = ranked.find((r) => r.root === o.root) || pick;
  const fine = tuning.microtonal;
  const notes = q.map((n) => {
    const m = n.midi - tuning.cents / 100;
    return { ...n, pitch: fine ? Math.round(m * 2) / 2 : Math.round(m) };
  });
  const decays = raw.filter((n) => n.end - n.start > 0.18).map((n) => n.decay);
  const plucky = decays.length ? median(decays) < 0.4 : false;
  return {
    raw, notes, bpm, offset: tempo.offset, division, tempoConfidence: tempo.confidence, alternatives: tempo.alternatives,
    tuning: { ...tuning, hz: 440 * 2 ** (tuning.cents / 1200) }, ranked, scale: pick, snap: !!o.snap && !!pick && (o.scale ? true : pick.coverage >= 0.9),
    range: notes.length ? noteRange(notes.map((n) => ({ midi: n.pitch }))) : { lo: 60, hi: 72 }, plucky,
    loudness: percentile(session.track.rms, 0.98),
  };
}

/** The nearest instruments of the app by timbre: [{id, label, distance}]. */
export function instrumentCandidates(session, result, count = 6) {
  const mono = session.mono ||= mixToMono(session.buffer);
  const vec = describeTimbre(mono, session.buffer.sampleRate, result.raw.map((n) => ({ ...n, midi: n.midi })));
  if (!vec) return [];
  return nearestInstruments(vec, FINGERPRINTS, count).map((c) => ({ ...c, label: INSTRUMENTS[c.id]?.label || c.id, shift: shiftOf(c.id) }));
}

/** First guess of the room from how the sound dies away after notes that are followed by quiet. */
export function guessReverb(session, result) {
  const { rms, hop } = session.track;
  const slopes = [];
  const notes = result.raw;
  for (let i = 0; i < notes.length; i++) {
    const next = notes[i + 1]?.start ?? Infinity;
    if (next - notes[i].end < 0.45) continue;
    const a = Math.round(notes[i].end / hop) + 1, b = a + 40;
    if (b >= rms.length) continue;
    const d0 = 20 * Math.log10(rms[a] + 1e-6), d1 = 20 * Math.log10(rms[b] + 1e-6);
    if (d0 > -70) slopes.push((d1 - d0) / (40 * hop));
  }
  if (slopes.length < 2) return 1;
  const s = median(slopes);
  return s > -12 ? 3 : s > -26 ? 2 : s > -70 ? 1 : 0;
}

/**
 * Play the transcription back through the synth with the nearest instruments and rooms and
 * keep what is closest to the original.
 * @param {(job:{notes:object[], instrument:string, reverb:object, articulation:string, tuning:number, seconds:number})=>Promise<AudioBuffer>} render
 * @returns {Promise<{instrument:string, reverb:number, score:object, tried:{instrument:string, reverb:number, score:number}[]}>}
 */
export async function verify(session, result, render, o = {}, onProgress) {
  const seconds = Math.min(o.seconds ?? 30, session.seconds);
  const notes = result.notes.filter((n) => n.start < seconds);
  const cands = o.candidates?.length ? o.candidates : instrumentCandidates(session, result, 3).map((c) => c.id);
  const articulation = result.plucky ? 'pluck' : 'legato';
  const tried = [];
  const run = async (instrument, reverb) => {
    const buf = await render({ notes, instrument, shift: shiftOf(instrument), reverb: REVERBS[reverb], articulation, tuning: result.tuning.hz, seconds });
    const score = compareAudio(session.buffer, buf, { seconds });
    tried.push({ instrument, reverb, score: score.score });
    return score;
  };
  const guess = o.reverb ?? guessReverb(session, result);
  let best = { instrument: cands[0] || 'sine', reverb: guess, score: { score: -1 } };
  let step = 0;
  const total = cands.length + REVERBS.length - 1;
  for (const id of cands) {
    const sc = await run(id, guess);
    if (sc.score > best.score.score) best = { instrument: id, reverb: guess, score: sc };
    onProgress?.(++step / total);
  }
  for (let r = 0; r < REVERBS.length; r++) {
    if (r === guess) continue;
    const sc = await run(best.instrument, r);
    if (sc.score > best.score.score) best = { ...best, reverb: r, score: sc };
    onProgress?.(++step / total);
  }
  return { ...best, tried };
}
