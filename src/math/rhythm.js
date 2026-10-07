/**
 * Beat grid. With the grid on, the pitch is sampled once per step (sample & hold)
 * so curves turn into rhythmic notes, and the gate sets how long each note rings.
 */

/** Steps per beat for each division (a beat is a quarter note). */
export const DIVISIONS = { '1/4': 1, '1/8': 2, '1/8T': 3, '1/16': 4, '1/16T': 6, '1/32': 8 };

export const beatSeconds = (bpm) => 60 / Math.max(1, bpm);

/** Length of one grid step in seconds. */
export const stepSeconds = (rhythm, bpm) => beatSeconds(bpm) / (DIVISIONS[rhythm.division] || 2);

/**
 * Where `time` falls on the grid.
 * Swing delays every second step by up to half a step (0 = straight, 1 = full shuffle).
 * @returns {{index:number, start:number, length:number, phase:number}}
 *   index — step number, start — when the step began (s), length — its duration (s),
 *   phase — 0..1 progress through the step
 */
export function gridAt(time, rhythm, bpm) {
  const s = stepSeconds(rhythm, bpm);
  const swing = Math.min(Math.max(rhythm.swing || 0, 0), 1) * 0.5 * s;
  const pair = Math.floor(time / (2 * s));
  const inPair = time - pair * 2 * s;
  const second = inPair >= s + swing;
  const index = pair * 2 + (second ? 1 : 0);
  const start = pair * 2 * s + (second ? s + swing : 0);
  const length = second ? s - swing : s + swing;
  return { index, start, length, phase: Math.min((time - start) / length, 1) };
}

/** Seconds in `bars` bars of 4/4 at `bpm`. */
export const barsToSeconds = (bars, bpm) => bars * 4 * beatSeconds(bpm);
