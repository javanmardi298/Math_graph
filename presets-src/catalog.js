/**
 * The preset catalog: every built-in preset sorted onto a shelf, the "Start here" picks
 * and the lesson packs. scripts/build-presets.mjs turns this into the JSON files in
 * presets/ that the app loads on demand; nothing here ships inside the app itself.
 *
 * To add a preset: put it in one of the lists below (or a new file), run
 *   node scripts/build-presets.mjs
 * and it appears in the library. To add a shelf: add it to SHELVES.
 */
import { SCENES } from '../src/circle/scenes.js';
import { FORMULA_PRESETS } from './formulas.js';
import { CIRCLE_PRESETS } from './circle-classic.js';
import { LAB_PRESETS } from './circle-lab.js';
import { TOPIC_PRESETS } from './topics.js';
import { SOUND_PRESETS } from './sound.js';
import { STACK_PRESETS } from './circle-stories.js';

/** Shelves in library order: [id, name, section]. */
export const SHELVES = [
  ['start', '★ Start here', 'Picks'],
  ['sound-graph', 'Sound · What does it sound like?', 'Sound of math'],
  ['sound-quiz', 'Sound · Guess the shape & A or B', 'Sound of math'],
  ['sound-waves', 'Sound · Waves, notes & intervals', 'Sound of math'],
  ['math-fourier', 'Math · Fourier, names & flags', 'Math'],
  ['math-pi', 'Math · Pi', 'Math'],
  ['math-calculus', 'Math · Calculus & trig', 'Math'],
  ['math-fractals', 'Math · Fractals', 'Math'],
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
];

/** Circle Lab simulation group → shelf. */
const GROUP_SHELF = {
  'Classic circle': 'classic', 'Multiply & split': 'multiply', 'Fill the screen': 'fill', 'Bounce & draw': 'bounce',
  'Battles & growth': 'growth', 'Battles & formulas': 'games', 'Patterns & rhythm': 'math-patterns', 'Drawing machines': 'math-machines',
  'Vibration & waves': 'physics', 'Waves & sound': 'sound-waves', 'Fourier & curves': 'math-fourier', 'Calculus & trig': 'math-calculus',
  Pi: 'math-pi', Fractals: 'math-fractals',
};
/** Older explicit categories → shelf. */
const CATEGORY_SHELF = { 'Formulas · Sound of a graph': 'sound-graph', 'Formulas · Guess & compare': 'sound-quiz' };

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
export const ALL_PRESETS = [...FORMULA_PRESETS, ...CIRCLE_PRESETS, ...LAB_PRESETS, ...TOPIC_PRESETS, ...SOUND_PRESETS, ...STACK_PRESETS];

/** The preset the app opens with when nothing was saved (shipped inside the app). */
export const DEFAULT_NAME = 'Bass Drop';
