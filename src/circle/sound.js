/**
 * Which note each Circle Lab event plays.
 *
 *   angle    where the hit lands on the circle picks the note (the circle is a keyboard)
 *   melody   every hit plays the next note of a melody (public-domain tunes, or your own)
 *   rise     every hit climbs one step up the scale, wrapping around
 *   ball     each ball / dot has its own note (polyrhythm style)
 *
 * Hits can come thousands per second (splitting balls), so notes are thinned to a
 * maximum rate and quieter when dense: the soundtrack stays musical, never a buzz.
 */
import { quantize, SCALES } from '../math/music.js';

const N = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "E4 D#4 C5" → MIDI numbers ("-" = rest is skipped). */
export function parseNotes(text) {
  return String(text || '').split(/[\s,]+/).map((tok) => {
    const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(tok.trim());
    if (!m) return null;
    return 12 * (+m[3] + 1) + N[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }).filter((x) => x != null);
}

/** Public-domain melodies (opening phrases). */
export const MELODIES = {
  ode: { label: 'Ode to Joy (Beethoven)', notes: 'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4 D4 D4 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4 C4 C4' },
  elise: { label: 'Für Elise (Beethoven)', notes: 'E5 D#5 E5 D#5 E5 B4 D5 C5 A4 C4 E4 A4 B4 E4 G#4 B4 C5 E4 E5 D#5 E5 D#5 E5 B4 D5 C5 A4 C4 E4 A4 B4 E4 C5 B4 A4' },
  twinkle: { label: 'Twinkle Twinkle (traditional)', notes: 'C4 C4 G4 G4 A4 A4 G4 F4 F4 E4 E4 D4 D4 C4 G4 G4 F4 F4 E4 E4 D4 G4 G4 F4 F4 E4 E4 D4' },
  greensleeves: { label: 'Greensleeves (traditional)', notes: 'A4 C5 D5 E5 F5 E5 D5 B4 G4 A4 B4 C5 A4 A4 G#4 A4 B4 G#4 E4 A4 C5 D5 E5 F5 E5 D5 B4 G4 A4 B4 C5 B4 A4 G#4 F#4 G#4 A4' },
  prelude: { label: 'Prelude in C arpeggio (Bach)', notes: 'C4 E4 G4 C5 E5 G4 C5 E5 C4 D4 A4 D5 F5 A4 D5 F5 B3 D4 G4 D5 F5 G4 D5 F5 C4 E4 G4 C5 E5 G4 C5 E5' },
  canon: { label: 'Canon bass line (Pachelbel)', notes: 'D3 A2 B2 F#2 G2 D2 G2 A2 D4 A3 B3 F#3 G3 D3 G3 A3 F#5 E5 D5 C#5 B4 A4 B4 C#5' },
  morning: { label: 'Morning Mood (Grieg)', notes: 'G4 E4 D4 C4 D4 E4 G4 E4 D4 C4 D4 E4 D4 E4 G4 E4 G4 A4 E4 A4 G4 E4 D4 C4' },
  scale: { label: 'Rising scale', notes: '' },
  custom: { label: 'My own notes…', notes: '' },
};

/** Note numbers of the scale between low and high. */
function scaleNotes(audio) {
  const steps = SCALES[audio.scale] || SCALES.major;
  const out = [];
  for (let m = audio.noteLow; m <= audio.noteHigh; m++) if (steps.includes((((m - audio.root) % 12) + 12) % 12)) out.push(m);
  return out.length ? out : [60];
}

/**
 * Turn simulation events into notes.
 * @param {object[]} events from CircleSim
 * @param {object} cfg state.circle
 * @param {object} audio state.audio (scale, root, note range)
 * @param {{last:number, k:number, burst:number}} [run] carried between calls when streaming (live play)
 * @returns {{t:number, midi:number, vel:number, kind:string, ball:number}[]}
 */
export function notesForEvents(events, cfg, audio, run = { last: -1, k: 0, burst: 0 }) {
  run.recent ||= [];
  const s = cfg.sound;
  const scale = scaleNotes(audio);
  const melody = s.pitch === 'melody'
    ? (s.melody === 'custom' ? parseNotes(s.notes) : parseNotes(MELODIES[s.melody]?.notes || '')) : [];
  const minGap = 1 / Math.max(4, s.maxRate || 30);
  const out = [];
  let { last, k, burst } = run;
  for (const e of events) {
    if (e.type === 'split' && cfg.rule === 'split') continue; // the hit that caused it already sounds
    if (e.t - last < minGap) { burst++; continue; }
    const density = Math.min(1, 1 / Math.sqrt(1 + burst * 0.5));
    burst = 0;
    last = e.t;
    let midi;
    if (e.type === 'escape') midi = scale[Math.min(scale.length - 1, Math.round(scale.length * 0.85))] + 12;
    else if (e.type === 'fill') midi = scale[0];
    else if (s.pitch === 'melody' && melody.length) midi = melody[k % melody.length];
    else if (s.pitch === 'rise') midi = scale[k % scale.length];
    else if (s.pitch === 'ball') midi = scale[(e.ball * 2) % scale.length] + 12 * Math.floor((e.ball * 2) / scale.length);
    else {
      const frac = ((((e.angle ?? 0) / (2 * Math.PI)) % 1) + 1) % 1;
      midi = quantize(audio.noteLow + frac * (audio.noteHigh - audio.noteLow), audio.scale === 'continuous' ? 'major' : audio.scale, audio.root);
    }
    k++;
    // Many notes a second add up: keep the overall loudness steady (∝ 1/√rate above 4 notes/s).
    run.recent.push(e.t);
    while (run.recent.length && run.recent[0] < e.t - 1) run.recent.shift();
    const rateGain = Math.min(1, Math.sqrt(6 / run.recent.length));
    out.push({ t: e.t, midi, vel: (e.type === 'escape' || e.type === 'fill' ? 1 : 0.8 * rateGain) * density, kind: e.type, ball: e.ball });
  }
  Object.assign(run, { last, k, burst });
  return out;
}
