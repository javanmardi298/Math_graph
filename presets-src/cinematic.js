/**
 * Cinematic formula shows (2D and 3D), vertical 9:16. Six formulas × three ways of drawing them:
 *
 *   glitch   three glowing copies (red, green, cyan) a little apart, added together: chromatic
 *            aberration, a jolt now and then, a fading tail like laser sparks
 *   string   the outline, and very faint strings from the centre to points of the curve
 *   web      glowing laser lines: a fading tail, with chords from the pen back along it
 *
 * Every show is a little film. The camera starts in a close-up on the moving point (tracking it,
 * a tilted horizon), pulls back to the whole picture, and the last 1–2 seconds are a final shot:
 * the whole curve lights up, the glow flares, the camera does one last move, and a closing chord
 * (hidden layers that only play) rings out, with a deep note under it.
 *
 * The formulas are the ones of the brief, unchanged (size 100 = the first layer); the other
 * layers of a show are smaller copies that start somewhere else on the curve and play an octave
 * or two higher, so the picture is a chorus of pens.
 */
import { hsl, hueOf } from './sound-maker.js';

const TAU = Math.PI * 2;
const TAGS = 'math art, math animation, parametric curves, chromatic aberration, glitch art, string art, satisfying, math music, shorts';
const f2 = (v) => +v.toFixed(2);
export const f3 = (v) => +v.toFixed(3);
export const R = (decay, mix, tone = 1) => ({ decay, mix, tone, preDelay: 0.02 });

/** The six formulas: strings for a size k, the extent of the curve, and the text shown on the video. */
const FORMULAS = {
  knot: {
    label: 'Tri-Fold Knot', type: 'parametric', extent: 300, wave: 'sine', range: (o) => ({ min: o, max: o + TAU }),
    expr: (k) => ({ x: `${f3(100 * k)}*(sin(s)+2*sin(2*s))`, y: `${f3(100 * k)}*(cos(s)-2*cos(2*s))`, z: '0' }),
    text: 'x(t) = 100 (sin t + 2 sin 2t)\ny(t) = 100 (cos t − 2 cos 2t)',
    z: (k) => `${f3(110 * k)}*sin(3*s)`,
  },
  coil: {
    label: 'Magnetic Coil', type: 'polar', extent: 160, wave: 'sine', range: (o) => ({ min: o, max: o + TAU }),
    expr: (k) => ({ r: `${f3(k)}*(130+30*cos(24*theta))`, z: '0' }),
    text: 'r(t) = 130 + 30 cos 24t\nx = r cos t     y = r sin t',
    z: (k) => `${f3(40 * k)}*sin(12*theta)`,
  },
  supernova: {
    label: 'Supernova', type: 'polar', extent: 170, wave: 'sine', range: (o) => ({ min: o, max: o + TAU }),
    expr: (k) => ({ r: `${f3(k)}*(120+50*sin(5*theta)*cos(15*theta))`, z: '0' }),
    text: 'r(t) = 120 + 50 sin 5t cos 15t\nx = r cos t     y = r sin t',
    z: (k) => `${f3(60 * k)}*cos(5*theta)`,
  },
  rose: {
    label: 'Mystic Rose', type: 'parametric', extent: 180, wave: 'sine', range: (o) => ({ min: o, max: o + TAU }),
    expr: (k) => ({ x: `${f3(130 * k)}*cos(s)+${f3(50 * k)}*cos(7*s)`, y: `${f3(130 * k)}*sin(s)-${f3(50 * k)}*sin(7*s)`, z: '0' }),
    text: 'x(t) = 130 cos t + 50 cos 7t\ny(t) = 130 sin t − 50 sin 7t',
    z: (k) => `${f3(70 * k)}*sin(7*s)`,
  },
  bow: {
    label: 'Infinity Bow', type: 'polar', extent: 150, wave: 'sine', range: (o) => ({ min: o, max: o + TAU }),
    expr: (k) => ({ r: `${f3(150 * k)}*sin(2*theta)*cos(theta)`, z: '0' }),
    text: 'r(t) = 150 sin 2t cos t\nx = r cos t     y = r sin t',
    z: (k) => `${f3(80 * k)}*sin(theta)`,
  },
  gear: {
    label: 'Cosmic Gear', type: 'polar', extent: 150, wave: 'sine', range: (o) => ({ min: o, max: o + TAU }),
    expr: (k) => ({ r: `${f3(k)}*(120+30*cos(10*theta)*sin(2*theta))`, z: '0' }),
    text: 'r(t) = 120 + 30 cos 10t sin 2t\nx = r cos t     y = r sin t',
    z: (k) => `${f3(40 * k)}*cos(10*theta)`,
  },
};

/** The three ways of drawing, and what each one wants around it. */
const STYLES = {
  glitch: { fx: 'glitch', tail: 0.22, width: 3.2, strings: 90, stringAlpha: 0.16 },
  string: { fx: 'string', tail: 0.3, width: 2.4, strings: 140, stringAlpha: 0.2 },
  web: { fx: 'web', tail: 0.4, width: 2.6, strings: 70, stringAlpha: 0.14 },
};

/** Each show's own mood: background, light, palette of the two line colours, scale, voice, the final shot. */
const SHOWS = [
  // key, style, name, mood: [line 1, line 2, backdrop, backdrop light], scale, root, instrument, wave echoes, ending, duration, hook
  ['knot', 'glitch', ['#ff4f6a', '#2ae8ff', 'stars', '#6a5cff'], 'minorPentatonic', 9, 'synth-pluck', 'zoomout', 26, 'Three colours, one knot'],
  ['knot', 'string', ['#ffd166', '#ff7a59', 'vignette', '#ff9d4a'], 'dorian', 2, 'harp', 'pushin', 28, 'A knot made of threads'],
  ['knot', 'web', ['#5ee0ff', '#c58cff', 'nebula', '#6a5cff'], 'pentatonic', 0, 'glass-pad', 'spin', 28, 'A knot of laser light'],
  ['coil', 'glitch', ['#ff3d9a', '#3df0ff', 'horizon', '#ff3d9a'], 'minorPentatonic', 4, 'e-piano', 'flare', 24, 'A coil with a colour glitch'],
  ['coil', 'string', ['#7be0c3', '#ffd27a', 'rings', '#4fd1c5'], 'major', 7, 'music-box', 'auto', 26, '24 waves wound into a coil'],
  ['coil', 'web', ['#ff8a3d', '#ffd23d', 'aurora', '#ff6a3d'], 'harmonicMinor', 9, 'marimba', 'zoomout', 26, 'The coil of a magnet'],
  ['supernova', 'glitch', ['#a4ff9e', '#ff4fd8', 'nebula', '#ff4fd8'], 'lydian', 5, 'glass-pad', 'pushin', 28, 'A star explodes in RGB'],
  ['supernova', 'string', ['#ffe08a', '#ff6a6a', 'stars', '#ffb347'], 'phrygianDominant', 4, 'kalimba', 'spin', 28, 'The supernova of strings'],
  ['supernova', 'web', ['#6aa8ff', '#ff7ad9', 'aurora', '#6aa8ff'], 'dorian', 7, 'bell', 'zoomout', 30, 'A supernova of lasers'],
  ['rose', 'glitch', ['#ff5a7a', '#5affd2', 'scanlines', '#ff5a7a'], 'minor', 9, 'synth-pluck', 'flare', 24, 'A rose on a broken screen'],
  ['rose', 'string', ['#ffb3c6', '#ffd8a8', 'vignette', '#ff7a9a'], 'pentatonic', 0, 'harp', 'pushin', 28, 'A rose of thread'],
  ['rose', 'web', ['#c4b5fd', '#5ee0ff', 'stars', '#8b7bff'], 'lydian', 2, 'e-piano', 'auto', 28, 'A mystic rose made of light'],
  ['bow', 'glitch', ['#2ae8ff', '#ff3d6a', 'horizon', '#2ae8ff'], 'blues', 7, 'chiptune', 'zoomout', 24, 'The infinity bow, glitching'],
  ['bow', 'string', ['#8be3d0', '#c4b5fd', 'rings', '#8be3d0'], 'dorian', 5, 'harp', 'spin', 26, 'A bow tied with strings'],
  ['bow', 'web', ['#ffcf5a', '#ff5a8a', 'nebula', '#ff8a5a'], 'pentatonic', 9, 'marimba', 'pushin', 26, 'A bow of laser'],
  ['gear', 'glitch', ['#7aff9e', '#ff4f8a', 'scanlines', '#38ff7a'], 'minorPentatonic', 2, 'synth-pluck', 'pushin', 26, 'A cosmic gear in three colours'],
  ['gear', 'string', ['#e0a35a', '#ff8a6a', 'vignette', '#ffb347'], 'phrygian', 4, 'music-box', 'flare', 28, 'A gear spun from thread'],
  ['gear', 'web', ['#6ae0ff', '#a78bff', 'stars', '#4f6bff'], 'major', 0, 'bell', 'spin', 28, 'The cosmic gear web'],
];

/** Keyframes: the close-up on the pen, the pull-back, the reveal of the glow. */
function filmKeys(D, mode, g = 1) {
  const a = D * 0.34, b = D * 0.58, end = D - 1.9;
  const k = (list) => list.map(([time, value, ease = 'smooth']) => ({ time: +time.toFixed(2), value, ease }));
  return {
    'camera.zoom': k([[0, mode === '3d' ? 2.6 : 3.8], [a, mode === '3d' ? 2.2 : 3.0], [b, 1], [end, 1]]),
    'camera.track': k([[0, 1], [a, 1], [b, 0], [D, 0]]),
    'camera.roll': k([[0, 9], [a, 5], [b, 0], [D, 0]]),
    'visual.bloom.strength': k([[0, 0.7 * g], [b, 1.2 * g], [end, 1.2 * g]]),
  };
}

/** A hidden layer that only plays: one note of the closing chord. */
export function chordLayer(name, midi, view, audio, start, vol) {
  const { noteLow, noteHigh } = audio;
  const y = view.yMin + ((midi - noteLow) / (noteHigh - noteLow)) * (view.yMax - view.yMin);
  return { name, type: 'function', exprs: { y: `${f2(y)}`, z: '0' }, hidden: true, caption: '-', start, end: 0, samples: 40, wave: 'sine', volume: vol, width: 1, color: '#ffffff' };
}

function show([fk, st, [c1, c2, backdrop, light], scale, root, wave, ending, D, hook], mode) {
  const F = FORMULAS[fk], S = STYLES[st], is3d = mode === '3d';
  const H = hueOf(c1);
  // 3D works in small units (the camera and its clipping planes are made for a window a few tens wide): the same curves, 30 times smaller
  const u = is3d ? 0.03 : 1, ext = F.extent * u * (is3d ? 1.25 : 1.12), tall = is3d ? 1 : 16 / 9;
  const view = { xMin: f2(-ext), xMax: f2(ext), yMin: f2(-ext * tall), yMax: f2(ext * tall) };
  // notes: the curve's top plays `hi`, its bottom `lo`; pitch is linear in y over the window
  const lo = 46 + root, hi = 82 + root, hiY = F.extent * u * 1.02, loY = -F.extent * u * 1.02;
  const kk = (hi - lo) / (hiY - loY), win = (view.yMax - view.yMin) * kk;
  const noteLow = f2(lo - (loY - view.yMin) * kk), noteHigh = f2(noteLow + win);
  const audio = { master: 0.92, scale, root: ((root % 12) + 12) % 12, noteLow, noteHigh, glide: 30, articulation: 'pluck', reverb: R(3.2, 0.36, 0.75), delay: { time: 0.375, feedback: 0.26, mix: 0.12, pingpong: true } };
  const echoes = [[1, 0, 0, wave, 1], [0.62, Math.PI, 1, 'triangle', 0.5], [0.32, Math.PI / 2, 2, 'sine', 0.38]];
  const layers = echoes.map(([k, off, oct, w, vol], i) => ({
    name: i ? `${F.label} · echo ${i}` : F.label, type: F.type, range: F.range(off), exprs: { ...F.expr(k * u), ...(is3d ? { z: F.z(k * u) } : {}) },
    samples: 3200, wave: w, volume: vol, octave: oct, width: S.width * (i ? 0.8 : 1), colorMode: 'gradient', color: i === 1 ? c2 : c1, color2: i === 1 ? c1 : c2, caption: i ? '-' : F.text,
  }));
  const start = D - 1.8;
  const chord = [[0, 0.5], [7, 0.42], [12, 0.46], [-12, 0.6]].map(([semi, vol], i) => chordLayer(`Closing chord ${i + 1}`, 60 + root + semi, view, audio, start, vol));
  const name = `${F.label}${is3d ? ' 3D' : ''}: ${{ glitch: 'Glitch', string: 'String Art', web: 'Laser Web' }[st]}`;
  const title = `${hook} ${{ glitch: '🔴🟢🔵', string: '🧵', web: '🕸️' }[st]}`;
  return {
    name, mode, transport: { duration: D, bpm: 96 }, view,
    sequence: { enabled: false, past: 'keep' },
    layers: [...layers, ...chord],
    visual: {
      aspect: '9:16', drawMode: 'trace', background: hsl(H, 0.6, 0.028), gridColor: hsl(H, 0.45, 0.09), axesColor: hsl(H, 0.4, 0.26), showGrid: false, showAxes: false,
      backdrop, backdropColor: light,
      fx: { style: S.fx, tail: S.tail, offset: st === 'glitch' ? 5 : 3.4, strings: S.strings, stringAlpha: S.stringAlpha, hold: 2 },
      bloom: { enabled: true, strength: st === 'glitch' ? 0.75 : 1.1, radius: 0.5, threshold: 0.08 }, trail: { enabled: true, count: 160, size: 5 }, marker: { shape: 'circle', size: 26, smoothing: 0.3, cursorLine: false },
      ...(is3d ? { fog: { enabled: true, density: 0.0025 } } : {}),
    },
    camera: { ending, endingSecs: 1.8, track: 1, trackSpeed: 0.1, zoom: 3.4, roll: 9, ...(is3d ? { autoRotate: true, rotateSpeed: 0.9 } : {}) },
    audio,
    rhythm: { enabled: false, showGrid: false },
    overlay: { layout: 4, name: { enabled: false }, formulas: { enabled: true, x: 0.06, y: 0.12, size: 0.62, start: D * 0.5, end: D - 1.9 }, texts: [] },
    keyframes: { tracks: filmKeys(D, mode, st === 'glitch' ? 0.7 : 1), autoKey: false },
    hook: { text: hook },
    youtube: { title: `${title} #shorts`, description: `${F.text.replace(/\n/g, '  ·  ')}\n\nThe formula behind it is on screen. Which one should I draw next? 👇\n\n#math #mathart #mathanimation #shorts`, tags: TAGS },
  };
}

/** 18 films in 2D, and the six formulas again in 3D (a third coordinate, a slow orbit). */
const THREE_D = [[0, 'glitch'], [3, 'string'], [6, 'web'], [9, 'glitch'], [12, 'web'], [15, 'string']];
export const CINEMATIC_PRESETS = [
  ...SHOWS.map((s) => show(s, '2d')),
  ...THREE_D.map(([i, st]) => show(SHOWS[i], '3d')),
].map((p) => ({ ...p, $category: 'Formulas · Cinematic' }));
