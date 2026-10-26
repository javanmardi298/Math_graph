/**
 * From transcribed notes to the pendulum frequencies of a harmonograph: the strongest pitch
 * classes (by time × loudness) become pendulums, tuned to the just ratio of their interval above
 * the tonic, so the drawing is the shape of the chord or scale the recording uses.
 */

/** Just-intonation ratio of each semitone above the tonic. */
export const JUST_RATIO = [1, 16 / 15, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 45 / 32, 3 / 2, 8 / 5, 5 / 3, 9 / 5, 15 / 8];

/**
 * @param {{start:number,end:number,pitch:number,vel:number}[]} notes
 * @param {{count?:number, just?:boolean}} [o]
 * @returns {{tonic:number, intervals:number[], ratios:number[], freqs:{fa:number,fb:number,fc:number,fd:number}}|null}
 *   tonic = pitch class 0..11; intervals = semitones above it (ascending, 0 first)
 */
export function chordFromNotes(notes, { count = 4, just = true } = {}) {
  if (!notes.length) return null;
  const w = new Float64Array(12);
  for (const n of notes) w[((Math.round(n.pitch) % 12) + 12) % 12] += (n.end - n.start) * (0.4 + n.vel);
  const order = [...w.keys()].sort((a, b) => w[b] - w[a]);
  const top = w[order[0]];
  const tonic = order[0];
  const pcs = order.filter((pc) => w[pc] >= top * 0.12).slice(0, count);
  const intervals = [...new Set(pcs.map((pc) => (pc - tonic + 12) % 12))].sort((a, b) => a - b);
  const ratio = (i) => (just ? JUST_RATIO[i] : 2 ** (i / 12));
  const ratios = intervals.map(ratio);
  // fill four pendulums: with fewer notes, the octave and detuned doubles make up the numbers
  const fill = ratios.slice();
  if (fill.length === 1) fill.push(2);
  while (fill.length < 4) fill.push(fill.length === 2 ? fill[0] * 1.004 : fill[1] * 0.997);
  const f = (r) => +(2 * r).toFixed(4);
  return { tonic, intervals, ratios, freqs: { fa: f(fill[0]), fb: f(fill[1]), fc: f(fill[2]), fd: f(fill[3]) } };
}
