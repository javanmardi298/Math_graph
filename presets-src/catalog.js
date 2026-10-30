/**
 * The preset catalog: every built-in preset sorted onto a shelf, the "Start here" picks
 * and the lesson packs. scripts/build-presets.mjs turns this into the JSON files in
 * presets/ that the app loads on demand; nothing here ships inside the app itself.
 *
 * To add a preset: put it in one of the lists below (or a new file), run
 *   node scripts/build-presets.mjs
 * and it appears in the library. To add a shelf: add it to SHELVES.
 */
import { LENGTHS, withLength } from './lengths.js';
import { SCENES } from '../src/circle/scenes.js';
import { FORMULA_PRESETS } from './formulas.js';
import { CIRCLE_PRESETS } from './circle-classic.js';
import { LAB_PRESETS } from './circle-lab.js';
import { TOPIC_PRESETS } from './topics.js';
import { SOUND_PRESETS } from './sound.js';
import { STACK_PRESETS } from './circle-stories.js';
import { SHOWCASE_PRESETS } from './sound-showcase.js';
import { SOUND_SHAPE_PRESETS } from './sound-shapes.js';
import { CURVE_PRESETS } from './sound-curves.js';
import { LAYER_PRESETS } from './sound-layers.js';
import { THEORY_PRESETS } from './circle-theory.js';
import { HARMONOGRAPH_PRESETS } from './harmonograph.js';
import { SPIRO_PRESETS } from './spirograph.js';
import { CINEMATIC_PRESETS } from './cinematic.js';
import { CINEMATIC2_PRESETS } from './cinematic2.js';
import { SCIENCE_PRESETS } from './science.js';
import { MOOD_PRESETS } from './moods.js';

/** Shelves in library order: [id, name, section]. */
export const SHELVES = [
  ['start', '★ Start here', 'Picks'],
  ['sound-graph', 'Sound · What does it sound like?', 'Sound of math'],
  ['sound-curves', 'Sound · Melodic shapes (bow tie, necktie, knots)', 'Sound of math'],
  ['sound-layers', 'Sound · Layered shows (melodies, keyframes)', 'Sound of math'],
  ['sound-quiz', 'Sound · Guess the shape & A or B', 'Sound of math'],
  ['sound-waves', 'Sound · Waves, notes & intervals', 'Sound of math'],
  ['sound-shapes', 'Sound · Shapes in moods (46)', 'Sound of math'],
  ['sound-showcase', 'Sound · Showcase (50 sounds, on a spectrum)', 'Sound of math'],
  ['music-theory', 'Music · Circle of fifths & theory', 'Sound of math'],
  ['math-fourier', 'Math · Fourier, names & flags', 'Math'],
  ['math-pi', 'Math · Pi', 'Math'],
  ['math-calculus', 'Math · Calculus & trig', 'Math'],
  ['math-fractals', 'Math · Fractals', 'Math'],
  ['math-complex', 'Math · Roots of unity & complex numbers', 'Math'],
  ['math-harmonograph', 'Math · Harmonograph (pendulums that draw)', 'Math'],
  ['math-spirograph', 'Math · Spirograph & guilloche', 'Math'],
  ['math-patterns', 'Math · Patterns & rhythm', 'Math'],
  ['math-machines', 'Math · Drawing machines', 'Math'],
  ['physics', 'Physics · Vibration, cymatics & fields', 'Physics'],
  ['stories', 'Stories, races & split screens', 'Stories'],
  ['classic', 'Satisfying · Classic circle', 'Satisfying'],
  ['multiply', 'Satisfying · Multiply & split', 'Satisfying'],
  ['fill', 'Satisfying · Fill the screen', 'Satisfying'],
  ['bounce', 'Satisfying · Bounce & draw', 'Satisfying'],
  ['growth', 'Satisfying · Growth & colour wars', 'Satisfying'],
  ['games', 'Games · Battles & formulas', 'Satisfying'],
  ['formulas-2d', 'Formulas · 2D curves', 'Formulas'],
  ['formulas-3d', 'Formulas · 3D', 'Formulas'],
  ['formulas-cinematic', 'Formulas · Cinematic (glitch, string art, laser web)', 'Formulas'],
  ['showcase-films', '★ Showcase films (everything the app can do)', 'Picks'],
  ['mood-psychedelic', 'Mood · Psychedelic', 'Moods'],
  ['mood-satisfying', 'Mood · Satisfying (perfect loops)', 'Moods'],
  ['mood-asmr', 'Mood · ASMR (slow and soft)', 'Moods'],
  ['mood-minimal', 'Mood · Minimal', 'Moods'],
  ['science-chaos', 'Science · Chaos & strange attractors', 'Science'],
  ['science-shapes', 'Science · Shapes in 3D (knots, surfaces, orbitals)', 'Science'],
  ['science-numbers', 'Science · Numbers (zeta, primes, golden angle)', 'Science'],
  ['science-motion', 'Science · Motion & sync (fireflies, three bodies, pendulums)', 'Science'],
];

/** Circle Lab simulation group → shelf. */
const GROUP_SHELF = {
  'Classic circle': 'classic', 'Multiply & split': 'multiply', 'Fill the screen': 'fill', 'Bounce & draw': 'bounce',
  'Battles & growth': 'growth', 'Battles & formulas': 'games', 'Patterns & rhythm': 'math-patterns', 'Drawing machines': 'math-machines',
  'Vibration & waves': 'physics', 'Waves & sound': 'sound-waves', 'Fourier & curves': 'math-fourier', 'Calculus & trig': 'math-calculus',
  Pi: 'math-pi', Fractals: 'math-fractals', 'Music theory': 'music-theory', 'Complex numbers': 'math-complex', Harmonograph: 'math-harmonograph', Spirograph: 'math-spirograph', 'Motion & sync': 'science-motion', Numbers: 'science-numbers',
};
/** Older explicit categories → shelf. */
const CATEGORY_SHELF = { 'Formulas · Sound of a graph': 'sound-graph', 'Formulas · Guess & compare': 'sound-quiz', 'Sound · Showcase': 'sound-showcase', 'Sound · Shapes in moods': 'sound-shapes', 'Sound · Melodic shapes': 'sound-curves', 'Sound · Layered shows': 'sound-layers', 'Music · Circle of fifths': 'music-theory', 'Math · Complex numbers': 'math-complex', 'Math · Harmonograph': 'math-harmonograph', 'Math · Spirograph': 'math-spirograph', 'Formulas · Cinematic': 'formulas-cinematic', 'Science · Chaos & attractors': 'science-chaos', 'Science · Shapes in 3D': 'science-shapes', 'Science · Numbers': 'science-numbers', 'Science · Motion & sync': 'science-motion', 'Mood · Psychedelic': 'mood-psychedelic', 'Mood · Satisfying': 'mood-satisfying', 'Mood · ASMR': 'mood-asmr', 'Mood · Minimal': 'mood-minimal', 'Showcase · Films': 'showcase-films' };

/** The shelf of a preset. */
export function shelfOf(p) {
  if (p.$category && CATEGORY_SHELF[p.$category]) return CATEGORY_SHELF[p.$category];
  if (p.mode === 'circle') {
    if (p.circle?.layers?.length) return 'stories';
    return GROUP_SHELF[SCENES[p.circle?.rule]?.group] || 'classic';
  }
  return p.mode === '3d' ? 'formulas-3d' : 'formulas-2d';
}

/** "Start here": the formats that do best in the niche, one of each. */
export const START_HERE = [
  'Fourier Draws a Cat', 'What Does a Heart Sound Like?', 'Guess the Shape: Heart', 'sin vs cos vs tan', 'A or B: Heart or Butterfly?',
  'Fourier Draws Batman', 'Flags Drawn by Math', 'Random Dots Find π', 'Which Series Finds π First?', 'Mandelbrot Zoom',
  'The Sound of a Derivative', 'Unit Circle to Sine Wave', 'Koch Snowflake', "Kundt's Tubes", 'Sand on a Singing Plate', 'Your Name in Circles',
];

/** Every built-in preset, in source order. */
const SOURCES = [...FORMULA_PRESETS, ...CIRCLE_PRESETS, ...LAB_PRESETS, ...TOPIC_PRESETS, ...SOUND_PRESETS, ...STACK_PRESETS, ...SOUND_SHAPE_PRESETS, ...SHOWCASE_PRESETS, ...CURVE_PRESETS, ...LAYER_PRESETS, ...THEORY_PRESETS, ...HARMONOGRAPH_PRESETS, ...SPIRO_PRESETS, ...CINEMATIC_PRESETS, ...CINEMATIC2_PRESETS, ...SCIENCE_PRESETS, ...MOOD_PRESETS];
// a typo in lengths.js must not pass silently
for (const n of Object.keys(LENGTHS)) if (!SOURCES.some((p) => p.name === n)) throw new Error(`lengths.js: no preset called "${n}"`);
export const ALL_PRESETS = SOURCES.map(withLength);

/** The preset the app opens with when nothing was saved (shipped inside the app). */
export const DEFAULT_NAME = 'Bass Drop';
