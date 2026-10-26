/**
 * Tuning, key and scale of a transcribed melody, using the app's own scale list (so the
 * answer can be set straight into the Sound tab). Works in quarter tones, so a melody in a
 * maqam or dastgah (neutral thirds, koron) is recognised as such instead of being forced
 * onto the nearest piano keys.
 */
import { SCALES, SCALE_LABELS, SCALE_PERIOD } from '../math/music.js';

const mod = (a, n) => ((a % n) + n) % n;

/**
 * How far the notes sit from a piano tuned to A = 440, and whether they are microtonal.
 * @returns {{cents:number, microtonal:boolean, tight:number}}
 */
export function estimateTuning(notes) {
  const w = notes.map((n) => (n.end - n.start) * n.vel);
  const total = w.reduce((a, b) => a + b, 0) || 1;
  const resultant = (period) => {
    let c = 0, s = 0;
    notes.forEach((n, i) => {
      const a = ((n.midi * 100) / period) * 2 * Math.PI;
      c += w[i] * Math.cos(a); s += w[i] * Math.sin(a);
    });
    return { r: Math.hypot(c, s) / total, cents: (Math.atan2(s, c) / (2 * Math.PI)) * period };
  };
  const semi = resultant(100), quarter = resultant(50);
  // Clustering on the semitone grid → ordinary (possibly a little off-pitch) music.
  if (semi.r >= 0.8 || quarter.r < 0.8) {
    const cents = Math.abs(semi.cents) < 6 ? 0 : semi.cents;
    return { cents, microtonal: false, tight: semi.r };
  }
  // Clustering on the quarter-tone grid only → quarter-tone music (offset is ambiguous by 50, keep it small).
  return { cents: Math.abs(quarter.cents) < 6 ? 0 : quarter.cents, microtonal: true, tight: quarter.r };
}

/** Scale keys the matcher may suggest (period 12, steps on the quarter-tone grid, up to 9 notes). */
function candidates(microtonal) {
  const out = [];
  for (const [key, steps] of Object.entries(SCALES)) {
    if (!steps || SCALE_PERIOD[key] !== 12 || key === 'chromatic' || steps.length > 9) continue;
    if (steps.some((s) => Math.abs(s * 2 - Math.round(s * 2)) > 1e-6)) continue;
    const fractional = steps.some((s) => Math.abs(s - Math.round(s)) > 1e-6);
    if (fractional && !microtonal) continue;
    out.push(key);
  }
  return out;
}

/**
 * Rank (scale, key) pairs by how much of the melody they contain, with a small price for
 * large scales and a bonus for a tonic the melody leans on or ends on.
 * @param {{start:number,end:number,midi:number,vel:number}[]} notes
 * @param {{cents:number, microtonal:boolean}} tuning
 * @returns {{scale:string, label:string, root:number, coverage:number, score:number}[]} best first (distinct pitch sets)
 */
export function rankScales(notes, tuning) {
  if (!notes.length) return [];
  const bins = new Float64Array(24); // quarter tones
  let total = 0;
  for (const n of notes) {
    const q = mod(Math.round(((n.midi - tuning.cents / 100) * 2)), 24);
    const w = (n.end - n.start) * (0.4 + n.vel);
    bins[q] += w; total += w;
  }
  const first = mod(Math.round((notes[0].midi - tuning.cents / 100) * 2), 24);
  const last = mod(Math.round((notes[notes.length - 1].midi - tuning.cents / 100) * 2), 24);
  const seen = new Set();
  const ranked = [];
  const order = candidates(tuning.microtonal);
  for (const key of order) {
    const steps = SCALES[key].map((s) => Math.round(s * 2));
    for (let root = 0; root < 12; root++) {
      const set = steps.map((s) => mod(s + root * 2, 24)).sort((a, b) => a - b);
      const sig = `${root}:${set.join(',')}`;
      if (seen.has(sig)) continue; // the same pitches under another name: keep the first (common) name
      seen.add(sig);
      let inside = 0;
      for (const q of set) inside += bins[q];
      const coverage = inside / total;
      const r = root * 2, fifth = mod(r + 14, 24);
      const bonus = 0.12 * (bins[r] / total) + 0.05 * (bins[fifth] / total) + 0.04 * (first === r ? 1 : 0) + 0.08 * (last === r ? 1 : 0);
      ranked.push({ scale: key, label: SCALE_LABELS[key], root, coverage, score: coverage - 0.014 * set.length + bonus - 0.0006 * order.indexOf(key) });
    }
  }
  return ranked.sort((a, b) => b.score - a.score);
}

/** The lowest and highest note, as whole MIDI numbers. */
export function noteRange(notes) {
  let lo = Infinity, hi = -Infinity;
  for (const n of notes) { lo = Math.min(lo, n.midi); hi = Math.max(hi, n.midi); }
  return { lo: Math.floor(lo + 1e-6), hi: Math.ceil(hi - 1e-6) };
}
