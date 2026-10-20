/**
 * Melodic shapes: ten drawings made of formulas (a bow tie, a necktie, an infinity knot...), each
 * with its own scale, instrument, effects and a note range chosen for that scale, so the drawing
 * is a short tune. The pen's height is the note; the note range is fitted to the drawing so its
 * lowest point plays exactly the lowest note and its highest point exactly the highest note
 * (both are notes of the scale: a tune that begins and ends on notes of the key sounds finished).
 *
 * Every tune is in a different key and mood; pluck sounds play a beat grid (a melody of
 * eighth notes), pad / flute sounds glide (a song line).
 */
import { CompiledLayer } from '../src/math/layers.js';
import { createLayer } from '../src/state.js';
import { SCALE_LABELS, NOTE_NAMES, scaleNotesBetween } from '../src/math/music.js';
import { hsl, hueOf } from './sound-maker.js';

const T = Math.PI * 2;
const P = (x, y, range = [0, T], samples = 2400) => ({ type: 'parametric', exprs: { x, y, z: '0' }, range, samples });
const PO = (r, range = [0, T], samples = 2400) => ({ type: 'polar', exprs: { r }, range, samples });

/** "D3" → 50. */
const midi = (name) => {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`sound-curves: bad note "${name}"`);
  return NOTE_NAMES.indexOf(m[1]) + (Number(m[2]) + 1) * 12;
};

/** Bounding box of a layer's curve. */
function measure(layer) {
  const c = new CompiledLayer(createLayer({ ...layer, range: { min: layer.range[0], max: layer.range[1] } }));
  if (!c.ok) throw new Error(`sound-curves: formula does not compile: ${JSON.stringify(c.errors)}`);
  const ctx = { t: 0, params: { a: 1, b: 1, c: 1, d: 1 }, view: { xMin: 0, xMax: 1 } }, p = { x: 0, y: 0, z: 0 };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i <= 4000; i++) {
    c.at(i / 4000, ctx, p);
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  }
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, y0, y1 };
}

const r3 = (v) => Math.round(v * 1000) / 1000;
const r2 = (v) => Math.round(v * 100) / 100;
const R = (decay, mix, tone = 1, preDelay = 0) => ({ decay, mix, tone, preDelay });
const E = (time, feedback, mix, pingpong = false) => ({ time, feedback, mix, pingpong });
const TAGS = 'sound of math, what math sounds like, math music, graph sound, math animation, math visualization, sonification, shorts';

/**
 * name, label (what it is), emoji, shape, scale, root (0 = C … 11 = B), instrument, low / high note (names),
 * mood (c1, c2 colours), audio extras, art ('pluck' → beat grid | 'legato' → glide), hook, about.
 */
const TUNES = [
  { name: 'Infinity Knot', emoji: '♾️', shape: P('2.3 sin(2s) + 0.55 sin(4s + 1)', '3.2 sin(s) + 0.45 sin(3s)'), scale: 'dorian', root: 2, wave: 'e-piano', lo: 'D3', hi: 'D5',
    mood: ['#7be0c3', '#ffd27a'], art: 'pluck', audio: { mod: { type: 'chorus', rate: 0.4, depth: 0.6, mix: 0.4 }, reverb: R(2.6, 0.3, 0.6), delay: E(0.375, 0.3, 0.15, true) },
    hook: 'What does an infinity knot sound like?', about: 'A knotted figure eight: the pen crosses itself in the middle, and the tune comes back to where it started, in D Dorian on an electric piano.' },
  { name: 'Bow Tie', emoji: '🎀', shape: P('2.8 cos(s)', '2.4 sin(2s) (0.55 + 0.45 cos(s)^2)'), scale: 'pentatonic', root: 7, wave: 'marimba', lo: 'G3', hi: 'G5',
    mood: ['#ff6fa5', '#ffd166'], art: 'pluck', audio: { reverb: R(1.6, 0.2, 0.6), delay: E(0.3, 0.25, 0.12) },
    hook: 'What does a bow tie sound like?', about: 'x = 2.8 cos t, y = 2.4 sin 2t (0.55 + 0.45 cos² t): a bow tie drawn by a formula, played on a marimba in G major pentatonic.' },
  { name: 'Necktie', emoji: '👔', shape: P('(0.4 + 0.5 exp(-((cos(s) - 0.85) / 0.1)^2) + 2.0 exp(-((cos(s) + 0.1) / 0.38)^2)) sin(s)', '3.6 cos(s)'), scale: 'blues', root: 5, wave: 'e-piano', lo: 'F3', hi: 'F5',
    mood: ['#ff6a3d', '#ffc84a'], art: 'pluck', audio: { filter: { type: 'lowpass', cutoff: 3600, q: 0.8 }, reverb: R(1.8, 0.25, 0.5), delay: E(0.4, 0.3, 0.15) },
    hook: 'What does a necktie sound like?', about: 'A knot, a narrow neck and a wide blade drawn with Gaussians; a smoky F blues on an electric piano: the knot at the top is the high note.' },
  { name: 'Figure-Eight Knot', emoji: '🪢', shape: P('1.05 (2 + cos(2s)) cos(3s)', '1.05 (2 + cos(2s)) sin(3s)'), scale: 'phrygianDominant', root: 4, wave: 'harp', lo: 'E3', hi: 'E5',
    mood: ['#ff9a3d', '#ff4f87'], art: 'pluck', audio: { reverb: R(3.6, 0.38, 0.7), delay: E(0.375, 0.3, 0.15, true) },
    hook: 'What does the figure-eight knot sound like?', about: 'x = (2 + cos 2t) cos 3t, y = (2 + cos 2t) sin 3t: the shadow of the figure-eight knot, in E Phrygian dominant on a harp.' },
  { name: 'Gift Bow', emoji: '🎁', shape: PO('2.9 abs(cos(2theta))^0.7 + 0.5'), scale: 'major', root: 7, wave: 'music-box', lo: 'G4', hi: 'G6',
    mood: ['#ff8ad8', '#ffe066'], art: 'pluck', audio: { reverb: R(2.5, 0.3, 0.8), delay: E(0.375, 0.25, 0.12) },
    hook: 'What does a gift bow sound like?', about: 'r = 2.9 |cos 2θ|^0.7 + 0.5: four loops like the bow on a present, played on a music box in G major.' },
  { name: 'Hourglass', emoji: '⏳', shape: P('(0.3 + 2.1 sin(s)^2) tanh(4 cos(s))', '3.4 sin(s)'), scale: 'hirajoshi', root: 2, wave: 'glass-pad', lo: 'D3', hi: 'D5',
    mood: ['#6aa8ff', '#c58cff'], art: 'legato', glide: 90, audio: { reverb: R(5.5, 0.45, 0.5, 0.02), mod: { type: 'flanger', rate: 0.1, depth: 0.7, mix: 0.4 }, delay: E(0.45, 0.3, 0.1) },
    hook: 'What does an hourglass sound like?', about: 'A waist squeezed to a thread: the sand falls, the pitch narrows and widens. Hirajoshi on a glass pad, a long reverb.' },
  { name: 'Pretzel Knot', emoji: '🥨', shape: P('2.6 sin(3s)', '3.6 sin(2s)'), scale: 'mixolydian', root: 7, wave: 'synth-pluck', lo: 'G3', hi: 'G5',
    mood: ['#e0a35a', '#ff6b6b'], art: 'pluck', audio: { mod: { type: 'chorus', rate: 0.6, depth: 0.5, mix: 0.4 }, reverb: R(2, 0.25, 0.6), delay: E(0.33, 0.3, 0.2, true) },
    hook: 'What does a pretzel sound like?', about: 'x = 2.6 sin 3t, y = 3.6 sin 2t: a Lissajous pretzel, played in G Mixolydian with a bright pluck.' },
  { name: 'Love Knot', emoji: '💞', shape: P('2.7 sin(s)^3 + 0.5 sin(2s)', '0.17 (13cos(s) - 5cos(2s) - 2cos(3s) - cos(4s)) + 0.4 sin(s)'), scale: 'minor', root: 9, wave: 'harp', lo: 'A2', hi: 'A4',
    mood: ['#ff5f8f', '#ffb3c6'], art: 'legato', glide: 70, audio: { drone: { volume: 0.18, octave: 2, fifth: true, bright: 0.3 }, reverb: R(4, 0.4, 0.6), delay: E(0.45, 0.3, 0.12) },
    hook: 'What does a love knot sound like?', about: 'A heart that ties itself in a knot at the bottom, in A minor on a harp with a soft drone underneath.' },
  { name: 'Fish', emoji: '🐟', shape: P('2.9 cos(s) - 1.5 sin(s)^2', '3.6 sin(s) cos(s)'), scale: 'lydian', root: 0, wave: 'flute-synth', lo: 'C4', hi: 'C6',
    mood: ['#5ee0ff', '#a4ff9e'], art: 'legato', glide: 80, audio: { motion: { tremolo: 0.15, tremoloRate: 5, autopan: 0, panRate: 0.25 }, reverb: R(3, 0.35, 0.7), delay: E(0.4, 0.35, 0.18, true) },
    hook: 'What does a fish sound like?', about: 'x = 2.9 cos t − 1.5 sin² t, y = 3.6 sin t cos t: a fish curve, swimming through C Lydian on a flute.' },
  { name: 'Guitar Pick', emoji: '🎸', shape: P('2.5 sin(s) (1 + 0.5 cos(s))', '3.4 cos(s) - 0.3 cos(2s)'), scale: 'minorPentatonic', root: 4, wave: 'synth-pluck', lo: 'E3', hi: 'E5',
    mood: ['#ff7a2f', '#ff75c6'], art: 'pluck', audio: { distortion: 0.15, filter: { type: 'lowpass', cutoff: 5200, q: 1 }, reverb: R(1.8, 0.22, 0.6), delay: E(0.375, 0.3, 0.18) },
    hook: 'What does a guitar pick sound like?', about: 'A rounded triangle, the shape of a guitar pick, played in E minor pentatonic: the riff of rock in one drawing.' },
];

/** The shape in a vertical view (equal scale, centred) and the note range that fits [lo, hi] to its lowest / highest point. */
export function fit(shape, [lo, hi]) {
  const m = measure(shape), W = 6.4, H = (W * 16) / 9;
  const view = { xMin: r3(m.cx - W / 2), xMax: r3(m.cx + W / 2), yMin: r3(m.cy - H / 2), yMax: r3(m.cy + H / 2) };
  const span = ((hi - lo) * (view.yMax - view.yMin)) / (m.y1 - m.y0);
  const noteLow = lo - ((m.y0 - view.yMin) / (view.yMax - view.yMin)) * span;
  return { view, noteLow: r2(noteLow), noteHigh: r2(noteLow + span) };
}

export const CURVE_PRESETS = TUNES.map((t) => {
  const lo = midi(t.lo), hi = midi(t.hi);
  const inKey = scaleNotesBetween(t.scale, t.root, lo, hi);
  if (!inKey.includes(lo) || !inKey.includes(hi)) throw new Error(`sound-curves: ${t.name}: ${t.lo} or ${t.hi} is not in ${t.scale} (root ${t.root})`);
  const { view, noteLow, noteHigh } = fit(t.shape, [lo, hi]);
  if (noteLow < 0 || noteHigh > 127) throw new Error(`sound-curves: ${t.name}: the fitted range ${noteLow}…${noteHigh} is outside 0…127 (make the drawing taller)`);
  const [c1, c2] = t.mood, h = hueOf(c1), pluck = t.art === 'pluck';
  const scaleLabel = (SCALE_LABELS[t.scale] || t.scale).replace(/\s*\(.*\)\s*$/, '');
  return {
    name: `${t.name}: Sound of the Shape`, $category: 'Sound · Melodic shapes', mode: '2d',
    transport: { duration: pluck ? 20 : 22, bpm: pluck ? 100 : 84 },
    view,
    layers: [{ name: t.name, ...t.shape, range: { min: +t.shape.range[0].toFixed(6), max: +t.shape.range[1].toFixed(6) }, wave: t.wave, volume: 1, width: 5, color: c1, color2: c2, colorMode: 'gradient' }],
    visual: {
      aspect: '9:16', drawMode: 'trace', background: hsl(h, 0.62, 0.035), gridColor: hsl(h, 0.5, 0.11), axesColor: hsl(h, 0.42, 0.34),
      bloom: { enabled: true, strength: 0.47, radius: 0.22, threshold: 0.13 }, trail: { enabled: true, count: 220 }, marker: { shape: 'circle', size: 30, smoothing: 0.35 },
    },
    camera: { track: 0.12, trackSpeed: 0.17 },
    audio: { master: 0.9, scale: t.scale, root: t.root, noteLow, noteHigh, articulation: t.art, glide: t.glide ?? 12, ...t.audio },
    rhythm: pluck ? { enabled: true, division: '1/8', gate: 0.8, showGrid: false } : { enabled: false, showGrid: false },
    overlay: { layout: 4, name: { enabled: false }, formulas: { enabled: true, x: 0.06, y: 0.13, size: 0.75 }, texts: [] },
    hook: { text: t.hook },
    youtube: {
      title: `${t.hook.replace(/\?$/, '')}? ${t.emoji} (math melody) #shorts`,
      description: `${t.about}\n\nThe higher the pen, the higher the note: ${t.lo} at the lowest point, ${t.hi} at the highest, all in ${NOTE_NAMES[t.root]} ${scaleLabel}.\n\nWhich shape should I play next? 👇\n\n#math #mathanimation #music #shorts`,
      tags: `${TAGS}, ${scaleLabel.toLowerCase()}, ${t.name.toLowerCase()}`.slice(0, 480),
    },
  };
});
