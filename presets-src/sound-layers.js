/**
 * Layered shows: presets with several layers (together, one after another, or with their own
 * start times), a written melody on some layers, and keyframes (speed, camera, formula
 * parameters) that make the music and the picture move together.
 *
 *   Geometry of Waves     four shapes turn into their waves, one after another, an octave apart
 *   Spirograph Snowflake  a wheel rolls round a wheel; the pattern plays a Bach arpeggio, speeding up
 *   Heart Equation Beats  y = x^(2/3) + 0.9 sqrt(3.3 - x²) sin(aπx), with a growing: the heart appears
 *   Square Wave Builder   sines are added one by one until the wave turns square
 *   Rose Garden Melody    three roses, each one plays a song (Twinkle, Ode to Joy, Greensleeves)
 *   Lissajous Canon       a knot whose phase turns; a second voice starts later and plays the same tune
 *
 * A melody's notes are absolute (they do not follow the note range), so the layers that play one
 * use the chromatic scale: every note of the tune is kept. Layers that play by height are placed
 * with `window()` so a row of the picture plays a chosen octave.
 */
import { hsl, hueOf } from './sound-maker.js';

const TAU = Math.PI * 2;
const SQUARE = { xMin: -3.2, xMax: 3.2, yMin: -5.689, yMax: 5.689 }; // equal scale in 9:16
const TAGS = 'math music, sound of math, math animation, math visualization, sonification, geometry, shorts';
const R = (decay, mix, tone = 1, preDelay = 0) => ({ decay, mix, tone, preDelay });
const E = (time, feedback, mix, pingpong = false) => ({ time, feedback, mix, pingpong });

/** Note range so that y = ya plays note na and y = yb plays nb (pitch is linear in y over the view). */
function window(view, [ya, na], [yb, nb]) {
  const k = (nb - na) / (yb - ya), r = (v) => Math.round(v * 100) / 100;
  return { noteLow: r(na + (view.yMin - ya) * k), noteHigh: r(na + (view.yMax - ya) * k) };
}

const P = (name, x, y, o = {}) => ({ name, type: 'parametric', exprs: { x, y, z: '0' }, range: { min: 0, max: TAU }, samples: 2400, wave: 'sine', volume: 1, width: 4, ...o });
const FN = (name, y, o = {}) => ({ name, type: 'function', exprs: { y }, samples: 2400, wave: 'sine', volume: 1, width: 4, ...o });
const PO = (name, r, max, o = {}) => ({ name, type: 'polar', exprs: { r }, range: { min: 0, max }, samples: 2400, wave: 'sine', volume: 1, width: 4, ...o });

/** A preset around the layers; `mood` = the hue of the background. */
function show(name, layers, { mood, view = SQUARE, duration = 28, bpm = 100, sequence = false, past = 'keep', audio = {}, visual = {}, camera = {}, params, keys = {}, hook, title, desc, tags = '', texts = [], formulas = false, formulaSize = 0.7 }) {
  const h = hueOf(mood);
  return {
    name, $category: 'Sound · Layered shows', mode: '2d',
    transport: { duration, bpm },
    view,
    ...(params ? { params } : {}),
    sequence: { enabled: sequence, past },
    layers,
    visual: {
      aspect: '9:16', drawMode: 'trace', background: hsl(h, 0.55, 0.03), gridColor: hsl(h, 0.45, 0.09), axesColor: hsl(h, 0.4, 0.28), showGrid: false, showAxes: false,
      bloom: { enabled: true, strength: 0.6, radius: 0.25, threshold: 0.12 }, trail: { enabled: true, count: 200 }, marker: { shape: 'circle', size: 26, smoothing: 0.35 }, ...visual,
    },
    camera: { track: 0.1, trackSpeed: 0.15, ...camera },
    audio: { master: 0.92, scale: 'chromatic', glide: 30, articulation: 'pluck', reverb: R(2.6, 0.3, 0.7), delay: E(0.375, 0.25, 0.12, true), ...audio },
    rhythm: { enabled: false, showGrid: false },
    overlay: { layout: 4, name: { enabled: false }, formulas: { enabled: formulas, x: 0.06, y: 0.12, size: formulaSize }, texts },
    keyframes: { tracks: Object.fromEntries(Object.entries(keys).map(([path, list]) => [path, list.map(([time, value, ease = 'smooth']) => ({ time, value, ease }))])), autoKey: false },
    hook: { text: hook },
    youtube: { title: `${title} #shorts`, description: `${desc}\n\nWhich one should I make next? 👇\n\n#math #mathanimation #music #shorts`, tags: `${TAGS}${tags ? `, ${tags}` : ''}`.slice(0, 480) },
  };
}
const T = (text, start, end = 0, { y = 0.72, size = 0.62 } = {}) => ({ id: `t${Math.round(start * 10)}-${text.length}`, text, x: 0.5, y, size, color: '#ffffff', font: 'display', align: 'center', bold: true, box: true, glow: false, start, end });

/* ------------------------------------------------------------------ 1 · Geometry of Waves */
const ROWS = [4.2, 1.4, -1.4, -4.2], H = 1.15, XC = -1.95;
const rowShape = [
  { name: 'Circle', color: '#5fb8e6', wave: 'sine', sx: 'cos(s)', sy: 'sin(s)', wy: 'sin(s)' },
  { name: 'Rose', color: '#e8798c', wave: 'kalimba', sx: 'cos(2s) cos(s)', sy: 'cos(2s) sin(s)', wy: 'cos(2s) sin(s)' },
  { name: 'Square', color: '#6fd6b5', wave: 'chiptune', sx: 'cos(s) / (cos(s)^8 + sin(s)^8)^0.125', sy: 'sin(s) / (cos(s)^8 + sin(s)^8)^0.125', wy: 'sin(s) / (cos(s)^8 + sin(s)^8)^0.125' },
  { name: 'Star', color: '#e8b87a', wave: 'synth-pluck', sx: '(4 cos(s) + cos(4s)) / 5', sy: '(4 sin(s) - sin(4s)) / 5', wy: '(4 sin(s) - sin(4s)) / 5' },
];
const waves = rowShape.flatMap((r, i) => {
  const yc = ROWS[i], common = { range: { min: 0, max: 2 * TAU }, color: r.color, color2: r.color, colorMode: 'solid', width: 3 };
  return [
    P(`${r.name}`, `${XC} + ${H} ${r.sx}`, `${yc} + ${H} ${r.sy}`, { ...common, wave: r.wave, volume: 0, samples: 1600, ...(i ? { withPrev: false } : {}) }),
    P(`${r.name} wave`, '-0.85 + 0.295 s', `${yc} + ${H} ${r.wy}`, { ...common, wave: r.wave, withPrev: true, octave: 0 }),
  ];
});

/* ------------------------------------------------------------------ list */
export const LAYER_PRESETS = [
  show('The Geometry of Waves', waves, {
    mood: '#5fb8e6', duration: 28, sequence: true, past: 'keep',
    audio: { scale: 'pentatonic', root: 0, articulation: 'legato', glide: 45, ...window(SQUARE, [4.2, 84], [-4.2, 48]), reverb: R(3, 0.35, 0.7) },
    visual: { marker: { shape: 'circle', size: 22, smoothing: 0.35 } },
    keys: { 'transport.speed': [[0, 1], [21, 1], [28, 0.8]], 'camera.zoom': [[0, 1], [28, 1.08]] },
    hook: 'Every shape has a sound', title: 'The geometry of waves: unroll a circle, a rose, a square, a star 🌊', tags: 'unit circle, sine wave, rose curve, square wave',
    desc: 'A circle unrolls into a sine wave, a rose into a stranger wave, a square into a flat-topped one, a star into a spiky one. Each wave is played, one octave apart.',
    texts: [T('Circle → sine wave', 0, 7), T('Rose', 7, 14), T('Square', 14, 21), T('Star', 21, 0)],
  }),

  /* ------------------------------------------------------------ 2 · Spirograph Snowflake */
  show('Spirograph Snowflake', [
    P('Wheel', '2 cos(s)', '2 sin(s)', { color: '#c9d1de', color2: '#c9d1de', width: 3, volume: 0, start: 0, end: 2.5 }),
    P('Pattern', '2.25 cos(s) - 0.62 cos(9s)', '2.25 sin(s) - 0.62 sin(9s)', { color: '#eaf2ff', color2: '#9ec5ff', colorMode: 'gradient', width: 4, wave: 'harp', pitchFrom: 'melody', melody: 'prelude', melodyLoops: 1, start: 2.5, end: 0, samples: 3000 }),
    P('Inner flake', '1.0 cos(s) + 0.45 cos(5s)', '1.0 sin(s) - 0.45 sin(5s)', { color: '#ffd7a8', color2: '#ff9ec4', colorMode: 'gradient', width: 4, wave: 'bell', pitchFrom: 'melody', melody: 'morning', start: 14, end: 0 }),
  ], {
    mood: '#9ec5ff', duration: 26, audio: { reverb: R(4, 0.4, 0.8), delay: E(0.375, 0.3, 0.15, true) },
    visual: { marker: { shape: 'ring', size: 30, smoothing: 0.35 } },
    keys: { 'transport.speed': [[0, 0.8], [10, 1], [20, 1.5], [26, 1]], 'camera.zoom': [[0, 1], [26, 1.18]], 'visual.bloom.strength': [[0, 0.4], [13, 1.2]], 'audio.reverb.mix': [[0, 0.2], [26, 0.5]] },
    hook: 'A wheel rolls round a wheel', title: 'A spirograph snowflake that plays Bach ❄️ (math)', tags: 'spirograph, epicycloid, bach, geometry dash',
    desc: 'A small wheel rolls around a big one and its pen draws an epitrochoid: x = 2.25 cos t − 0.62 cos 9t, y = 2.25 sin t − 0.62 sin 9t. The pattern plays the opening of Bach’s Prelude in C, and the music speeds up as the snowflake grows.',
    texts: [T('A wheel rolling around a wheel', 0, 8, { y: 0.14 })],
  }),

  /* ----------------------------------------------------------- 3 · Heart Equation Beats */
  show('Heart Equation Beats', [
    FN('Heart', 'abs(x)^(2/3) + 0.9 sqrt(3.3 - x^2) sin(2 a pi x)', { color: '#ff3d6e', color2: '#ff9ab5', colorMode: 'gradient', width: 5, wave: 'e-piano', samples: 3000, caption: 'y = x^(2/3) + 0.9 √(3.3 − x²) · sin(2aπx)' }),
    FN('Echo', 'abs(x)^(2/3) + 0.9 sqrt(3.3 - x^2) sin(2 a pi x + 1)', { color: '#ffd1dc', color2: '#ffb0c4', colorMode: 'gradient', width: 3, wave: 'warm-pad', volume: 0.45, octave: -1, samples: 3000, caption: 'echo: the same heart, shifted by one radian' }),
  ], {
    mood: '#ff3d6e', duration: 24, view: { xMin: -1.85, xMax: 1.85, yMin: -2.84, yMax: 3.74 }, params: { a: 0.5, b: 1, c: 1, d: 1 }, formulas: true, formulaSize: 0.8,
    audio: { scale: 'minorPentatonic', root: 9, articulation: 'legato', glide: 50, ...window({ yMin: -2.84, yMax: 3.74 }, [-1.3, 45], [2.3, 81]), reverb: R(3.5, 0.4, 0.6) },
    visual: { marker: { shape: 'star', size: 24, smoothing: 0.35 } }, camera: { track: 0 },
    keys: { 'params.a': [[0, 0.5], [18, 5]], 'transport.speed': [[0, 1.2], [16, 1], [24, 0.7]], 'camera.zoom': [[0, 1], [24, 1.12]], 'audio.reverb.mix': [[0, 0.2], [24, 0.55]] },
    hook: 'A mathematical way to say I love you', title: 'A mathematical way to say I love you ❤️ (the heart equation)', tags: 'heart equation, love math, valentine',
    desc: 'y = x^(2/3) + 0.9 √(3.3 − x²) sin(aπx): while a grows from 0 to 10 the ripples get faster and the heart fills in. You hear it as a trill that speeds up.',
    texts: [T('A mathematical way to say I love you', 0, 0, { y: 0.1, size: 0.55 })],
  }),

  /* -------------------------------------------------------------- 4 · Square Wave Builder */
  (() => {
    const sums = ['sin(s)', 'sin(s) + sin(3s)/3 + sin(5s)/5', 'sin(s) + sin(3s)/3 + sin(5s)/5 + sin(7s)/7 + sin(9s)/9', [1, 3, 5, 7, 9, 11, 13, 15, 17, 19].map((k) => (k === 1 ? 'sin(s)' : `sin(${k}s)/${k}`)).join(' + ')];
    const names = ['1 sine', '3 sines', '5 sines', '10 sines'], cols = ['#5fb8e6', '#6fd6b5', '#e8b87a', '#ff9ec4'], waves = ['sine', 'e-piano', 'synth-pluck', 'supersaw'];
    return show('Square Wave Builder', sums.map((f, i) => P(names[i], '-3 + 0.4775 s', `${ROWS[i]} + 1.02 (${f})`, { range: { min: 0, max: 2 * TAU }, color: cols[i], color2: cols[i], colorMode: 'solid', width: 3, wave: waves[i], samples: 3200 })), {
      mood: '#6fd6b5', duration: 28, sequence: true, past: 'keep',
      audio: { scale: 'pentatonic', root: 0, articulation: 'legato', glide: 40, ...window(SQUARE, [4.2, 84], [-4.2, 48]), reverb: R(3, 0.35, 0.7) },
      keys: { 'transport.speed': [[0, 1], [21, 1], [28, 0.75]], 'camera.zoom': [[0, 1], [28, 1.06]], 'audio.reverb.mix': [[0, 0.2], [28, 0.5]] },
      hook: 'Add sines until the wave turns square', title: 'How sine waves build a square wave 🌊 (Fourier)', tags: 'fourier series, square wave, sine wave, harmonics',
      desc: 'One sine, then three, then five, then ten: every sine you add makes the wave flatter on top and steeper at the sides, and the sound brighter. That is the Fourier series of a square wave.',
      texts: [T('1 sine', 0, 7), T('+ 2 more', 7, 14), T('+ 2 more', 14, 21), T('10 sines: almost square', 21, 0)],
    });
  })(),

  /* ---------------------------------------------------------------- 5 · Rose Garden Melody */
  show('Rose Garden Melody', [
    PO('Three petals', '2.8 cos(3theta)', Math.PI, { color: '#ff8fb1', color2: '#ffd1dc', colorMode: 'gradient', width: 5, wave: 'music-box', pitchFrom: 'melody', melody: 'twinkle' }),
    PO('Four petals', '2.8 cos(2theta)', TAU, { color: '#ffd27a', color2: '#fff0b8', colorMode: 'gradient', width: 5, wave: 'marimba', pitchFrom: 'melody', melody: 'ode' }),
    PO('Five petals', '2.8 cos(5theta)', Math.PI, { color: '#b79cff', color2: '#e3d6ff', colorMode: 'gradient', width: 5, wave: 'harp', pitchFrom: 'melody', melody: 'greensleeves' }),
  ], {
    mood: '#ff8fb1', duration: 36, sequence: true, past: 'ghost', audio: { reverb: R(3.5, 0.4, 0.8) },
    visual: { marker: { shape: 'diamond', size: 24, smoothing: 0.35 } },
    keys: { 'transport.speed': [[0, 1], [24, 1], [36, 0.8]], 'camera.zoom': [[0, 1], [36, 1.15]], 'visual.bloom.strength': [[0, 0.5], [36, 1]] },
    hook: 'Each flower plays a song', title: 'Three roses, three songs: Twinkle, Ode to Joy, Greensleeves 🌹 (math)', tags: 'rose curve, ode to joy, twinkle twinkle, greensleeves',
    desc: 'r = 2.8 cos(kθ) draws a rose with k or 2k petals. The pen walks along the petals and plays a song: Twinkle Twinkle on the three-petal rose, Ode to Joy on the four-petal, Greensleeves on the five-petal.',
    texts: [T('Twinkle Twinkle', 0, 12), T('Ode to Joy', 12, 24), T('Greensleeves', 24, 0)],
  }),

  /* ----------------------------------------------------------------- 6 · Lissajous Duet */
  show('Lissajous Duet', [
    P('Voice 1', '2.6 sin(3s + a)', '3.4 sin(2s)', { color: '#5ee0ff', color2: '#a4ff9e', colorMode: 'gradient', width: 5, wave: 'harp', pitchFrom: 'melody', melody: 'canon', start: 0, end: 24, samples: 3000 }),
    P('Voice 2', '2.6 sin(3s - a)', '3.4 sin(2s)', { color: '#ff7ab8', color2: '#ffd27a', colorMode: 'gradient', width: 5, wave: 'warm-pad', volume: 0.7, pitchFrom: 'melody', melody: 'canon', octave: -1, start: 6, end: 0, samples: 3000 }),
  ], {
    mood: '#5ee0ff', duration: 30, params: { a: 0, b: 1, c: 1, d: 1 }, audio: { reverb: R(4, 0.45, 0.7), delay: E(0.5, 0.3, 0.15, true) },
    keys: { 'params.a': [[0, 0], [30, 3]], 'transport.speed': [[0, 0.9], [15, 1.2], [30, 0.8]], 'camera.zoom': [[0, 1], [30, 1.12]], 'camera.roll': [[0, 0], [30, 6]] },
    hook: 'Two voices, one knot', title: 'A Lissajous knot that plays a canon 🎶 (math music)', tags: 'lissajous, canon, pachelbel',
    desc: 'x = 2.6 sin(3t ± a), y = 3.4 sin 2t: two Lissajous knots whose phase a slowly turns. The first voice plays the melody of Pachelbel’s Canon, the second joins six seconds later, an octave lower, just like a round.',
  }),
];
