/**
 * Pitch mapping: turns a function value Y into a musical pitch.
 * Y is mapped linearly from the view range [yMin, yMax] onto a MIDI note range,
 * then optionally snapped to a scale so any curve sounds "in key".
 */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Semitone offsets from the root for each scale. `null` = continuous (no quantize). */
export const SCALES = {
  continuous: null,
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  wholeTone: [0, 2, 4, 6, 8, 10],
  hirajoshi: [0, 2, 3, 7, 8],
};

export const SCALE_LABELS = {
  continuous: 'Continuous (glide)', chromatic: 'Chromatic', major: 'Major', minor: 'Natural minor',
  pentatonic: 'Major pentatonic', minorPentatonic: 'Minor pentatonic', blues: 'Blues', dorian: 'Dorian',
  harmonicMinor: 'Harmonic minor', wholeTone: 'Whole tone', hirajoshi: 'Hirajoshi',
};

export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const freqToMidi = (f) => 69 + 12 * Math.log2(f / 440);
export const noteName = (m) => `${NOTE_NAMES[((Math.round(m) % 12) + 12) % 12]}${Math.floor(Math.round(m) / 12) - 1}`;

/** Snap a (fractional) MIDI note to the nearest note of a scale rooted at `root` (0 = C). */
export function quantize(midi, scale, root = 0) {
  const steps = SCALES[scale];
  if (!steps) return midi;
  const rel = midi - root;
  const octave = Math.floor(rel / 12);
  const within = rel - octave * 12;
  let best = steps[0], bestDist = Infinity;
  for (const s of [...steps, steps[0] + 12]) {
    const d = Math.abs(within - s);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return root + octave * 12 + best;
}

/**
 * Y value → MIDI note (fractional when continuous).
 * @param {number} y
 * @param {{yMin:number,yMax:number,noteLow:number,noteHigh:number,scale:string,root:number}} map
 * @param {number} [octaveShift] per-layer transpose in octaves
 */
export function yToMidi(y, map, octaveShift = 0) {
  if (!Number.isFinite(y)) return null;
  const k = (y - map.yMin) / (map.yMax - map.yMin || 1);
  const clamped = Math.min(Math.max(k, 0), 1);
  const raw = map.noteLow + clamped * (map.noteHigh - map.noteLow) + octaveShift * 12;
  return quantize(raw, map.scale, map.root);
}
