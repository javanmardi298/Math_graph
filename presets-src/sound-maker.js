/**
 * Makes a complete preset out of a sound preset and a shape: the shape is drawn and played
 * in the sound's register, with the scale, instrument, effects and drone of the sound, in a
 * colour mood that fits it. The recipe is the one of a hand-tuned butterfly:
 *
 *   a scale that is not plain major + a pad or pluck that suits it + a long, dark reverb and
 *   a slow modulation for the mysterious ones; a warm two-colour gradient on a near-black
 *   background of the same hue (grid and axes the same hue, dim); a soft glow (bloom 0.47) so
 *   the line stays crisp; the camera gently follows the pen; the whole curve is played once
 *   in the video; the register keeps the melody where the sound is beautiful.
 *
 * Two kinds: "series" (formula on screen, no spectrum) and "showcase" (a big spectrum, the
 * sound's name and scale on screen).
 */
import { SOUND_PRESETS } from './sounds.js';
import { SHAPES, layerOf } from './shapes.js';
import { melodyFor } from './sound-registers.js';
import { SCALE_LABELS, noteName } from '../src/math/music.js';
import { INSTRUMENTS } from '../src/audio/instruments.js';

/** group → [colour 1, colour 2] (the line runs from one to the other). */
const MOOD = {
  'Clean & classic': ['#5ad1ff', '#b79cff'], 'Lo-fi & chill': ['#7be0c3', '#ffd27a'], 'Ambient & space': ['#6aa8ff', '#c58cff'],
  'Psychedelic & trippy': ['#ff4fd8', '#6a5cff'], 'Synthwave & retro': ['#ff5fa8', '#ffb347'], 'EDM & dance': ['#3df0ff', '#ff3d9a'],
  'Cinematic & dark': ['#ff6a3d', '#ffc84a'], 'India (ragas)': ['#ff9a3d', '#ff4f87'], 'Arabic & Turkish (maqam)': ['#ffc247', '#ff6f4a'],
  'Persian (dastgah)': ['#4fd1c5', '#ffd166'], 'East Asia & gamelan': ['#ff7a2f', '#ff75c6'], Africa: ['#a7e05a', '#ffb347'],
  'Europe folk & Jewish': ['#e0a35a', '#ff6b6b'], 'Math & science': ['#5ee0ff', '#a4ff9e'], 'Kids & cute': ['#ff8ad8', '#ffe066'],
  'Satisfying & ASMR': ['#8be3d0', '#c4b5fd'],
};
const WORLD = /India|Arabic|Persian|East Asia|Africa|Europe/;

const hex = (n) => Math.round(Math.min(255, Math.max(0, n * 255))).toString(16).padStart(2, '0');
function hsl(h, s, l) {
  const a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}
function hueOf(c) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
/** Colours of a mood: the two line colours and a background, grid and axes in the hue of the first. */
export function palette(group) {
  const [c1, c2] = MOOD[group] || MOOD['Clean & classic'];
  const h = hueOf(c1);
  return { c1, c2, background: hsl(h, 0.62, 0.035), gridColor: hsl(h, 0.5, 0.11), axesColor: hsl(h, 0.42, 0.34) };
}

/** "Raga Yaman (Kalyan thaat)" → "Raga Yaman"; "Hirajoshi" → "the Hirajoshi scale". */
export function scaleName(scale) {
  const label = (SCALE_LABELS[scale] || scale).replace(/\s*\(.*\)\s*$/, '');
  if (scale === 'continuous') return 'a continuous glide';
  if (/^(Raga|Maqam|Dastgah|Avaz)\b/.test(label)) return label;
  return `the ${label} scale`;
}

const TAGS = 'sound of math, what math sounds like, graph sound, math animation, math visualization, math music, sonification, shorts';
const GROUP_TAGS = {
  'India (ragas)': 'raga, indian classical music', 'Arabic & Turkish (maqam)': 'maqam, arabic music', 'Persian (dastgah)': 'persian music, dastgah',
  'East Asia & gamelan': 'japanese scale, chinese music, gamelan', Africa: 'african music, mbira, kora', 'Europe folk & Jewish': 'folk music, flamenco, klezmer',
  'Psychedelic & trippy': 'psychedelic, microtonal', 'Ambient & space': 'ambient music, relaxing', 'Lo-fi & chill': 'lofi, chill music',
};

/**
 * @param {string} soundName a sound preset (sounds.js)
 * @param {string} shapeId a shape (shapes.js)
 * @param {{kind?:'series'|'showcase', name?:string, category:string}} o
 */
export function makeSoundPreset(soundName, shapeId, { kind = 'series', name, category }) {
  const sound = SOUND_PRESETS.find((s) => s.name === soundName);
  if (!sound) throw new Error(`sound-maker: no sound preset called "${soundName}"`);
  const sh = SHAPES[shapeId];
  if (!sh) throw new Error(`sound-maker: no shape called "${shapeId}"`);
  const showcase = kind === 'showcase';
  const m = melodyFor(sound, shapeId, showcase ? 1.3 : 0); // the showcase leaves the top of the frame free for the spectrum
  const pal = palette(sound.group);
  const sc = scaleName(sound.audio.scale);
  const inst = INSTRUMENTS[sound.instrument]?.label || sound.instrument;
  const [lo, hi] = sound.register;
  const label = sh.label;
  let title = showcase ? `${soundName} 🎧 listen to this scale` : `What does a ${label.toLowerCase()} ${sh.emoji} sound like in ${sc}?`;
  if (title.length > 90) title = `What does a ${label.toLowerCase()} sound like in ${sc}?`;
  return {
    name: name || (showcase ? `Showcase · ${soundName}` : `${label} · ${soundName}`),
    $category: category, mode: '2d',
    transport: { duration: m.duration, speed: m.speed, bpm: m.bpm },
    view: m.view,
    layers: [{ name: label, ...layerOf(shapeId), wave: sound.instrument, color: pal.c1, color2: pal.c2, colorMode: 'gradient', width: 5, volume: 1 }],
    visual: {
      aspect: '9:16', background: pal.background, gridColor: pal.gridColor, axesColor: pal.axesColor, drawMode: 'trace',
      bloom: { enabled: true, strength: 0.47, radius: 0.22, threshold: 0.13 }, trail: { enabled: true, count: 220 },
      marker: { shape: 'circle', size: 30, smoothing: 0.35 }, analyzer: showcase ? 'spectrum' : 'off',
    },
    camera: { track: 0.12, trackSpeed: 0.17 },
    audio: { ...sound.audio, noteLow: m.noteLow, noteHigh: m.noteHigh, master: 0.9 },
    rhythm: { showGrid: false, ...m.rhythm },
    overlay: showcase
      ? { layout: 4, name: { enabled: false }, formulas: { enabled: false }, texts: [], title: { enabled: true, text: soundName, subtitle: true, subtitleText: `${(SCALE_LABELS[sound.audio.scale] || '').replace(/\s*\(.*\)\s*$/, '')} · ${inst}`, x: 0.06, y: 0.045, size: 1.45 }, analyzer: { x: 0.04, y: 0.105, size: 3 } }
      : { layout: 4, name: { enabled: false }, formulas: { enabled: true, x: 0.06, y: 0.13, size: 0.8 }, texts: [] },
    hook: { text: showcase ? `Listen to ${soundName}` : `What does a ${label.toLowerCase()} sound like in ${sc}?` },
    youtube: {
      title: `${title} #shorts`,
      description: showcase
        ? `${soundName}: ${SCALE_LABELS[sound.audio.scale]}, played on ${inst.toLowerCase()}, notes ${noteName(lo)} to ${noteName(hi)}. The shape wanders through the scale and every note you hear lights up the spectrum.\n\nWhich sound should I show next? 👇\n\n#music #scales #sound${WORLD.test(sound.group) ? ' #worldmusic' : ''} #shorts`
        : `A ${label.toLowerCase()} drawn and played in ${sc} on ${inst.toLowerCase()}: the higher the pen, the higher the note (${noteName(lo)} to ${noteName(hi)}).\n\nWhich shape should I play next? 👇\n\n#math #sound #mathanimation${WORLD.test(sound.group) ? ' #worldmusic' : ''} #shorts`,
      tags: `${TAGS}, ${GROUP_TAGS[sound.group] || 'music scales'}, ${label.toLowerCase()}`.slice(0, 480),
    },
  };
}
