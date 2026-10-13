/**
 * Where each sound sounds best, and which drawing plays it.
 *
 * Every instrument has a register in which it is beautiful (a bass below C3 growls, a music
 * box above C6 tinkles, a pad above C5 gets thin) and every scale sounds best when the melody
 * begins on its tonic and stays within about two octaves. A sound preset therefore carries:
 *
 *   register   [lowest, highest] note: begins on the tonic nearest the instrument's sweet spot
 *   melody     a shape (shapes.js) framed for a vertical video and fitted so that the shape's
 *              lowest point plays the lowest note of the register and its highest point the
 *              highest, plus the speed, tempo and length that make it flow
 *
 * The audio's own noteLow / noteHigh is the register itself (for any curve you draw, whose
 * y range is the whole view); the melody carries its own fitted noteLow / noteHigh.
 */
import { SHAPES, frame, fitRange, layerOf } from './shapes.js';

/** The shapes as the app needs them (stored once in sounds.json, referenced by id): label, emoji, layer fields. */
export const SOUND_SHAPES = Object.fromEntries(Object.entries(SHAPES).map(([id, sh]) => [id, { label: sh.label, emoji: sh.emoji, feel: sh.feel, ...layerOf(id) }]));

/** instrument → [lowest note of its sweet spot (MIDI), octaves]. 60 = C4. */
const REG = {
  sine: [55, 2.5], triangle: [55, 2.5], square: [55, 2], sawtooth: [48, 2],
  'deep-organ': [43, 2.5], 'house-stab': [55, 2], 'garage-chord': [55, 2], 'house-piano': [48, 2.5], 'deep-bass': [36, 2], 'dub-chord': [48, 2],
  'acid-303': [40, 2], 'acid-square': [40, 2], 'techno-stab': [55, 2], reese: [36, 2], 'fm-bass': [36, 2],
  'psy-bass': [36, 2], 'psy-lead': [55, 2.5], supersaw: [52, 2.5], wobble: [38, 2], 'squelch-fm': [43, 2], 'space-arp': [60, 2.5],
  'warm-pad': [46, 2.5], 'glass-pad': [46, 2.5], choir: [48, 2.5], drone: [36, 2],
  'e-piano': [48, 2.5], bell: [62, 2.5], marimba: [48, 2.5], kalimba: [60, 2.5], 'music-box': [67, 2], 'synth-pluck': [52, 2.5], harp: [48, 3],
  chiptune: [60, 2.5], 'vibrato-lead': [55, 2.5], 'flute-synth': [60, 2.5],
};
/** Moods move the whole register up or down (semitones). */
const GROUP_SHIFT = { 'Ambient & space': -5, 'Cinematic & dark': -5, 'Lo-fi & chill': -2, 'Kids & cute': 5, 'Satisfying & ASMR': 3 };
/** A few sounds that want something of their own: [lowest note, octaves]. */
const BY_NAME = {
  Starfield: [67, 2.5], 'Ice Cave': [64, 2.5], 'Crystal Bells': [64, 2.5], 'Candy Chimes': [67, 2], 'Toy Piano': [66, 2], 'Bubble Pop': [66, 2], 'Water Drops': [66, 2],
  'Glass Marbles': [70, 2], 'Frozen Kingdom': [62, 2.5], 'Music Box Dream': [67, 2], 'Lullaby': [64, 2], 'Horror Music Box': [64, 2],
  'Gamelan Pelog': [60, 2], 'Gamelan Slendro': [60, 2], 'Raga Yaman Evening': [55, 2.5], 'Raga Todi': [55, 2.5], 'Raga Marwa Dusk': [55, 2.5],
  'Maqam Bayati Ney': [57, 2], 'Dastgah Homayoun Ney': [57, 2], 'Avaz Dashti Night': [55, 2], 'Shakuhachi Breath': [57, 2], 'Chinese Yu Mode': [57, 2],
  'Highland Pipes': [57, 2], 'Theremin': [57, 2.5], 'Deep Space': [41, 2.5],
};

/** The register [lowest, highest] of a sound (MIDI notes), starting on the tonic nearest its sweet spot. */
export function registerOf({ name, instrument, group, audio }) {
  let [base, oct] = BY_NAME[name] || REG[instrument] || [55, 2.5];
  // a phone speaker has nothing below ~C2: bass instruments are never moved down
  if (!BY_NAME[name]) base = Math.max(base <= 40 ? base : 36, base + (GROUP_SHIFT[group] || 0));
  const root = audio.root || 0;
  let lo = base + ((((root - base) % 12) + 12) % 12);
  if (lo - base > 6) lo -= 12; // the tonic just below is nearer
  return [lo, lo + Math.round(oct * 12)];
}

/** Which shapes suit which mood (the sounds of a group take them in turn). */
const SHAPES_FOR = {
  'Clean & classic': ['heart', 'cardioid', 'clover', 'flower'],
  'Lo-fi & chill': ['infinity', 'figure8', 'spiral', 'limacon'],
  'Ambient & space': ['spiral', 'golden', 'infinity', 'trefoil'],
  'Psychedelic & trippy': ['butterfly', 'spiro', 'lissajous', 'pretzel', 'trefoil', 'nephroid'],
  'Synthwave & retro': ['star', 'gear', 'crown', 'pretzel'],
  'EDM & dance': ['gear', 'star', 'crown', 'lissajous'],
  'Cinematic & dark': ['spiral', 'crown', 'trefoil', 'golden'],
  'India (ragas)': ['clover', 'flower', 'heart', 'infinity', 'rose52'],
  'Arabic & Turkish (maqam)': ['cardioid', 'infinity', 'limacon', 'heart'],
  'Persian (dastgah)': ['heart', 'clover', 'infinity'],
  'East Asia & gamelan': ['flower', 'butterfly', 'star', 'rose52', 'golden'],
  Africa: ['gear', 'pretzel', 'flower', 'crown'],
  'Europe folk & Jewish': ['heart', 'pretzel', 'lissajous'],
  'Math & science': ['golden', 'infinity', 'spiral', 'lissajous', 'spiro'],
  'Kids & cute': ['heart', 'flower', 'star', 'figure8'],
  'Satisfying & ASMR': ['infinity', 'flower', 'figure8', 'spiral'],
};

/**
 * The melody of a sound: its shape, the view that frames it, the note range fitted to the
 * register, and the speed / tempo / length that suit its character. `k` = its number inside
 * its group (so neighbours get different shapes).
 */
export function melodyOf(entry, k) {
  const list = SHAPES_FOR[entry.group] || Object.keys(SHAPES);
  return melodyFor(entry, entry.melodyShape || list[k % list.length]);
}

/** The melody of a sound drawn as a given shape (`down`: shift the drawing down, see shapes.frame). */
export function melodyFor(entry, shape, down = 0) {
  if (!SHAPES[shape]) throw new Error(`sound-registers.js: "${entry.name}" wants an unknown shape "${shape}"`);
  const [lo, hi] = registerOf(entry);
  const a = entry.audio, legato = a.articulation === 'legato', pump = !!a.pump?.amount;
  const speed = legato ? 0.75 : 1;
  const bpm = pump ? 120 : legato ? 84 : 100;
  return {
    shape, view: frame(shape, down), ...fitRange(shape, [lo, hi], down),
    speed, bpm, duration: Math.round(22 * speed), // video length ≈ 22 s whatever the speed
    rhythm: legato ? { enabled: false } : { enabled: true, division: '1/8', gate: 0.8 },
  };
}
