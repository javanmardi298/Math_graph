/**
 * Building blocks for step-by-step lessons (vertical 9:16, one idea per step, a plain
 * caption on every step). Lessons live in packs (src/lessons/*.js) that are loaded only
 * when someone opens or adds them, so the app does not grow with them.
 *
 *   circleLesson  one Circle Lab simulation, played 2–4 times with different settings
 *   mathLesson    2D / 3D formula layers played one after another, a caption per step
 */
import { Y, S } from '../circle-stories.js';

const TAGS = 'math, physics, learn, education, science, satisfying, shorts';

/**
 * @param {string} name
 * @param {string} rule  Circle Lab simulation
 * @param {{lab?:object, more?:object, look?:object, sound?:object, say:string}[]} steps
 * @param {object} o  hook, title, desc, tags, palette, instrument, duration, bpm, audio, pitch
 */
export function circleLesson(name, rule, steps, o = {}) {
  const layer = (s) => Y(rule, s.lab || {}, {
    text: s.say,
    more: s.more || {},
    look: { palette: o.palette || 'neon', ...(o.look || {}), ...(s.look || {}) },
    sound: { instrument: o.instrument || 'kalimba', pitch: o.pitch || 'angle', ...(o.sound || {}), ...(s.sound || {}) },
    ...(s.seed || o.seed ? { seed: s.seed || o.seed } : {}),
  });
  const [first, ...rest] = steps.map(layer);
  return S(`Lesson · ${name}`, first, rest, {
    duration: o.duration || 10 * steps.length, bpm: o.bpm || 110, audio: o.audio || {},
    hook: o.hook, title: o.title, desc: o.desc, tags: o.tags || TAGS,
  });
}

const STEP_COLORS = ['#22e4ff', '#8cff5a', '#ffd23d', '#ff3d9a', '#b18cff'];

/**
 * @param {string} name
 * @param {'2d'|'3d'} mode
 * @param {{say:string, layer:object, layers?:object[]}[]} steps  layer: a formula layer (type, exprs, range …);
 *        `layers` adds more layers that play with it in the same step
 * @param {object} o  view, hook, title, desc, tags, duration, past ('ghost'|'keep'|'hide'), visual, camera, audio, rhythm
 */
export function mathLesson(name, mode, steps, o = {}) {
  const duration = o.duration || 9 * steps.length;
  const seg = duration / steps.length;
  const layers = steps.flatMap((s, i) => [s.layer, ...(s.layers || [])].map((l, j) => ({
    name: `Step ${i + 1}`, wave: 'triangle', volume: 1, width: 5, samples: 1400,
    color: STEP_COLORS[(i + j) % STEP_COLORS.length], ...l, withPrev: j > 0,
  })));
  return {
    name: `Lesson · ${name}`, mode,
    transport: { duration, bpm: o.bpm || 100 },
    view: o.view || { xMin: -4, xMax: 4, yMin: -5, yMax: 5 },
    sequence: { enabled: true, past: o.past || 'ghost' },
    layers,
    visual: { aspect: '9:16', drawMode: 'trace', marker: { shape: 'circle', size: 30 }, ...(o.visual || {}) },
    camera: o.camera || {},
    audio: { master: 0.95, scale: 'pentatonic', root: 2, noteLow: 48, noteHigh: 84, articulation: 'pluck', reverb: { mix: 0.3, decay: 3 }, ...(o.audio || {}) },
    ...(o.rhythm ? { rhythm: o.rhythm } : {}),
    overlay: {
      layout: 4, name: { enabled: false },
      // formulas just below the Shorts title zone, bigger than usual
      formulas: { enabled: true, x: 0.06, y: 0.15, size: 1.5 },
      texts: steps.map((s, i) => ({
        id: `step${i + 1}`, text: s.say, x: 0.5, y: 0.7, size: 0.62, color: '#ffffff', font: 'display', align: 'center',
        bold: true, box: true, glow: false, start: i === 0 ? 0 : i * seg, end: i === steps.length - 1 ? 0 : (i + 1) * seg,
      })),
    },
    hook: { text: o.hook },
    youtube: { title: `${o.title} #shorts`, description: `${o.desc}\n\n#math #learn #shorts`, tags: o.tags || TAGS },
  };
}
