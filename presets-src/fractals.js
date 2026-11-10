/**
 * Fractal presets (from the Fractals tab's gallery) and "textbook" presets: the graph styles of
 * the Shorts the app was asked to match (white paper with a typeset formula, a legend and drum
 * ticks; areas that fill with a live number; shapes filled as they are drawn; a shape unrolled
 * into a wave; a function over its derivative; a wall of lights).
 */
import { GALLERY } from '../src/circle/fractal-gallery.js';
import { SCENES } from '../src/circle/scenes.js';

const TAGS = 'math, fractal, mandelbrot, math art, satisfying, education, shorts';
const r3 = (v) => +v.toFixed(4);

/* ---------------------------------------------------------------- fractals */

const HOOKS = {
  'Seahorse valley': 'How deep does it go?', 'Julia morph': 'One number changes everything', 'Burning Ship': 'A ship made of one formula',
  'Newton: three roots': 'Three roots fight for every point', 'Buddhabrot': 'The ghost inside the Mandelbrot set', "Barnsley's fern": 'Four rules and pure chance',
  'Orbits you can hear': 'What does a fractal sound like?', 'The power grows': 'What if the 2 becomes a 7?', 'Dragon': 'Two rules draw a dragon',
};

export const FRACTAL_PRESETS = GALLERY.map(([name, rule, lab, extra = {}]) => {
  const D = extra.duration || (rule === 'fractal' && lab.journey === 'zoom' ? 36 : 30);
  const scene = SCENES[rule], P = { ...scene.defaults, ...lab };
  const hook = HOOKS[name] || { fractal: 'One rule, repeated forever', buddha: 'Every escaping path leaves a mark', lyapunov: 'Order and chaos, side by side', ifs: 'A few rules and pure chance' }[rule];
  return {
    name: `Fractal · ${name}`, $category: 'Fractals', mode: 'circle', transport: { duration: D, bpm: 96 },
    overlay: { layout: 4, name: { enabled: false } }, visual: { aspect: '9:16' },
    audio: { scale: 'minorPentatonic', root: 2, noteLow: 43, noteHigh: 86, reverb: { decay: 4.2, mix: 0.4, tone: 0.6, preDelay: 0.02 }, delay: { time: 0.375, feedback: 0.28, mix: 0.14, pingpong: true } },
    circle: {
      rule, lab: { [rule]: lab },
      look: { palette: extra.palette || 'aurora', background: '#03040a', ambience: false, counter: false, sparks: false, trail: 'lines' },
      sound: { instrument: extra.instrument || 'glass-pad', pitch: 'angle', volume: 0.6, length: 0.6, maxRate: 16 },
      text: { formula: '', counter: '', show: 'formula' },
    },
    camera: { ending: 'blackout', endingSecs: 2.5 },
    hook: { text: hook },
    youtube: { title: `${hook} #shorts`, description: `${scene.formula(P)}\n\nWhich fractal next? 👇\n\n#fractal #math #shorts`, tags: TAGS },
    about: { title: name, math: `${scene.label}. Rule: ${scene.formula(P)}.`, sources: [{ label: 'Fractals tab (Create → Fractals)', url: '' }] },
  };
});

/* ---------------------------------------------------------------- textbook */

const PAPER = { background: '#ffffff', gridColor: '#ffffff', axesColor: '#111111', showGrid: false, showAxes: true, showLabels: false, drawMode: 'ghost', bloom: { enabled: false }, trail: { enabled: false }, fx: { style: 'ink' }, tone: 'off' };
const DARK = { background: '#05060c', gridColor: '#151a2c', axesColor: '#8a93b0', showGrid: false, showAxes: true, showLabels: false, bloom: { enabled: true, strength: 0.5, radius: 0.4, threshold: 0.15 }, trail: { enabled: false }, tone: 'soft' };
const base = (name, o) => ({
  name, $category: 'Textbook', mode: o.mode || '2d', transport: { duration: o.D || 24, bpm: o.bpm || 120 }, view: o.view, layers: o.layers,
  visual: { aspect: o.aspect || '9:16', ...(o.paper ? PAPER : DARK), marker: { shape: 'circle', size: 20, cursorLine: false, smoothing: 0.2, lens: o.lens ?? 0 }, ...(o.visual || {}) },
  overlay: { layout: 4, name: { enabled: false }, formulas: { enabled: true, math: true, x: 0.5, y: o.fy ?? 0.1, size: o.fs ?? 1.2 }, legend: { enabled: !!o.legend }, axes: o.axes || { x: '', y: '' }, drumTicks: !!o.ticks, ...(o.overlay || {}) },
  audio: { scale: o.scale || 'minorPentatonic', root: o.root ?? 9, noteLow: o.lo ?? 40, noteHigh: o.hi ?? 84, glide: 20, articulation: o.articulation || 'legato', drumKit: o.kit || '808', reverb: { decay: 1.8, mix: 0.18, tone: 0.8, preDelay: 0 }, ...(o.audio || {}) },
  ...(o.drums ? { drums: { enabled: true, volume: 0.8, kick: 'off', snare: 'off', hat: 'off', clap: 'off', ...Object.fromEntries(Object.keys(o.drums).map((k) => [k, 'pattern'])), patterns: { kick: '', snare: '', hat: '', clap: '', openhat: '', tom: '', perc: '', ...o.drums } } } : {}),
  ...(o.sequence ? { sequence: { enabled: true, past: o.sequence } } : {}),
  ...(o.camera ? { camera: o.camera } : { camera: { ending: 'off' } }),
  hook: { text: o.hook },
  youtube: { title: `${o.hook} #shorts`, description: `${o.desc || ''}\n\n#math #shorts`, tags: 'math, physics, graph, formula, music, education, shorts' },
  about: { title: name, math: o.desc || '', sources: [] },
});
const INK = { color: '#111111', colorMode: 'solid', width: 3.5 };
const BLUE = { color: '#2a56d6', colorMode: 'solid', width: 3.5 };

// the first digits of π as a staircase: digit d at step k (a nested "x < k ? d : …")
const PI_DIGITS = '3141592653589793238462643383279';
const stairs = (vals, w = 1) => vals.reduceRight((acc, v, i) => (i === vals.length - 1 ? `${v}` : `x < ${r3((i + 1) * w)} ? ${v} : ${acc}`), '');

export const TEXTBOOK_PRESETS = [
  base('Doppler: Can You Hear It Getting Faster?', {
    paper: true, D: 16, bpm: 140, view: { xMin: 0, xMax: 16, yMin: 0, yMax: 12 }, lens: 0.05, legend: true, ticks: true, axes: { x: 't', y: 'f' },
    layers: [
      { name: 'car', type: 'function', exprs: { y: '6 + 4*(1 - 2/(1 + exp(-(9 + x)*(mod(x, 4*0.85^floor(x/4)) - 0.5))))', z: '0' }, ...INK, wave: 'lead-saw', volume: 0.5, caption: "f' = f \\frac{c}{c - v_r}" },
      { name: '808', type: 'function', exprs: { y: '1.8 + 1.2*exp(-4*mod(x, 4))', z: '0' }, ...BLUE, wave: '808', volume: 0.9, octave: -1, caption: '-' },
    ],
    drums: { kick: 'X.....x...x.....', snare: '........X.......', hat: 'x.x.x.x.x.x.xxxx' }, hook: 'Can you hear it getting faster?',
    desc: 'The Doppler effect: a source coming towards you sounds higher, f′ = f·c/(c − v). Each pass of the car is a falling S-curve in pitch; the passes come faster and faster.',
  }),
  base('How Many Curves Make a Square?', {
    paper: true, D: 24, bpm: 120, view: { xMin: 0, xMax: 12.566, yMin: -2.4, yMax: 2.4 }, lens: 0.05, legend: true, ticks: true, axes: { x: 't', y: 'f' }, sequence: 'ghost',
    layers: [1, 2, 4, 8, 16].map((n, i) => ({
      name: i === 4 ? 'lead = 16 curves' : `${n} curve${n > 1 ? 's' : ''}`, type: 'function', legend: i === 4 ? 'lead = 16 curves' : '-',
      exprs: { y: Array.from({ length: n }, (_, k) => `sin(${2 * k + 1}*2x)/${2 * k + 1}`).join(' + ').replace(/^/, '1.6*(') + ')', z: '0' }, ...INK, wave: 'square', volume: 0.35, samples: 1600,
      caption: n === 1 ? 'y = \\sin x' : n === 2 ? 'y = \\sin x + \\frac{\\sin 3x}{3}' : 'y = \\sin x + \\frac{\\sin 3x}{3} + \\cdots',
    })),
    drums: { kick: 'X...x...X...x...', clap: '....X.......X...', hat: '..x...x...x...x.' }, hook: 'How many curves make a square?',
    desc: 'A square wave is a sum of odd sine waves: sin x + sin 3x / 3 + sin 5x / 5 + … With 1, 2, 4, 8 and 16 terms the corners sharpen (and the Gibbs overshoot never goes away).',
  }),
  base('What Does an Octave Sound Like?', {
    paper: true, D: 13, bpm: 120, view: { xMin: 0, xMax: 13, yMin: 0, yMax: 13 }, axes: { x: 'n', y: 'f' }, scale: 'chromatic', root: 9, lo: 57, hi: 70, articulation: 'pluck',
    layers: [{ name: 'height = pitch', type: 'function', exprs: { y: 'mod(x, 1) < 0.5 ? floor(x) + 1 : 0.02', z: '0' }, ...INK, width: 3, wave: 'e-piano', samples: 2600, caption: 'f = 220 \\cdot 2^{n/12}' }],
    legend: true, hook: 'What does an octave sound like?', overlay: { texts: [] },
    desc: 'Twelve equal steps make an octave: each note is 2^(1/12) ≈ 1.0595 times the one before, and after twelve steps the frequency has exactly doubled: f = 220 · 2^(n/12).',
  }),
  base("Can Pi's Digits Make a Beat?", {
    paper: true, D: 16, bpm: 120, view: { xMin: 0, xMax: 32, yMin: -1, yMax: 11 }, lens: 0.05, legend: true, ticks: true, axes: { x: 't', y: 'f' }, scale: 'minorPentatonic', articulation: 'pluck',
    layers: [
      { name: 'lead', type: 'function', exprs: { y: stairs([...PI_DIGITS].map(Number)), z: '0' }, color: '#8a8a8a', colorMode: 'solid', width: 3, wave: 'synth-pluck', samples: 3200, caption: '\\pi = 3.14159265\\ldots' },
      { name: '808', type: 'function', exprs: { y: stairs([3, 1, 4, 1, 5, 9, 2, 6], 4).replace(/(\d+)(?= :|$)/g, '$1'), z: '0' }, ...BLUE, wave: '808', octave: -2, volume: 0.9, samples: 1200, caption: '-' },
    ],
    drums: { kick: 'X..x..x.X..x..x.', clap: '....X.......X...', hat: 'x.xxx.x.x.xxx.xx' }, hook: "Can pi's digits make a beat?",
    desc: 'Each digit of π = 3.14159265358979… is a step of the melody (the digit is the height), and the bass walks through the first eight digits.',
  }),
  base('Integral: The Area Under sin x', {
    D: 18, view: { xMin: -0.25, xMax: 3.4, yMin: -0.35, yMax: 1.6 }, fy: 0.7, fs: 1.25, scale: 'major', root: 0, lo: 55, hi: 79,
    layers: [{ name: 'sin x', type: 'function', exprs: { y: 'x >= 0 && x <= pi ? sin(x) : 0', z: '0' }, color: '#58b7ff', color2: '#b06bff', colorMode: 'gradient', width: 3.5, fill: 'under', fillAlpha: 0.38, fillColor: '#3558d8', readout: 'area', wave: 'glass-pad', caption: '\\int_0^{\\pi} \\sin x \\, dx = 2' }],
    visual: { showAxes: true, drawMode: 'ghost', marker: { shape: 'circle', size: 14, cursorLine: true, smoothing: 0.1, lens: 0 } }, overlay: { readout: { y: 0.6, size: 1, digits: 3 } },
    hook: 'How big is the area under one arch?', desc: 'The area under sin x from 0 to π fills up as the line sweeps across: exactly 2.',
  }),
  base('A Mathematical Way to Say I Love You', {
    D: 18, view: { xMin: -1.9, xMax: 1.9, yMin: -3.6, yMax: 3.2 }, fy: 0.13, fs: 0.9, scale: 'major', root: 5, lo: 55, hi: 84,
    layers: [{ name: 'heart', type: 'parametric', range: { min: 0, max: 6.2832 }, exprs: { x: '1.25*sin(s)^3', y: '(13cos(s) - 5cos(2s) - 2cos(3s) - cos(4s))/13 + 0.2', z: '0' }, color: '#ff3b3b', colorMode: 'solid', width: 3, fill: 'origin', fillAlpha: 0.5, wave: 'music-box', samples: 1200, caption: '(x^2 + y^2 - 1)^3 - x^2 y^3 = 0' }],
    visual: { showGrid: true, backdrop: 'blueprint', backdropColor: '#3a3a3a', drawMode: 'trace' }, overlay: { title: { enabled: true, text: 'A Mathematical Way to Say I Love You', size: 0.8, y: 0.05 } },
    hook: 'A mathematical way to say I love you', desc: 'The heart curve (x² + y² − 1)³ − x²y³ = 0, drawn as a parametric curve and filled as the pen goes round.',
  }),
  base('A Mathematical Way to Give Flowers', {
    D: 20, view: { xMin: -1.25, xMax: 1.25, yMin: -2.3, yMax: 2.15 }, fy: 0.13, fs: 0.85, scale: 'pentatonic', root: 2, lo: 55, hi: 86,
    layers: [{ name: 'rose', type: 'parametric', range: { min: 0, max: 6.2832 }, exprs: { x: 'cos(4s)cos(s)', y: 'cos(4s)sin(s)', z: '0' }, color: '#a43bff', colorMode: 'solid', width: 3, fill: 'origin', fillAlpha: 0.5, wave: 'harp', samples: 1600, caption: 'x = 30\\cos(4t)\\cos(t)\ny = 30\\cos(4t)\\sin(t)' }],
    visual: { showGrid: true, backdrop: 'blueprint', backdropColor: '#3a3a3a', drawMode: 'trace' }, overlay: { title: { enabled: true, text: 'A Mathematical Way to Give Flowers', size: 0.8, y: 0.05 } },
    hook: 'A mathematical way to give flowers', desc: 'A rose curve r = cos 4θ: eight petals, each filled as the pen sweeps it out.',
  }),
  base('Math Is Beautiful: r = 4 sin(240θ/25) + 10', {
    D: 28, view: { xMin: -15, xMax: 15, yMin: -31, yMax: 22 }, fy: 0.16, fs: 1.3, scale: 'wholeTone', root: 0, lo: 48, hi: 84,
    layers: [{ name: 'ring', type: 'polar', range: { min: 0, max: 157.08 }, exprs: { r: '4sin(240theta/25) + 10', z: '0' }, color: '#ffe93b', colorMode: 'solid', width: 2.4, wave: 'vibraphone', samples: 9000, caption: 'r = 4 \\sin\\left(\\frac{240\\theta}{25}\\right) + 10' }],
    visual: { showAxes: false, drawMode: 'trace', bloom: { enabled: true, strength: 0.35, radius: 0.3, threshold: 0.2 } }, overlay: { formulas: { enabled: true, math: true, x: 0.5, y: 0.16, size: 1.3, tint: false } },
    camera: { ending: 'auto', endingSecs: 3 }, hook: 'One line of maths draws this', desc: 'r = 4 sin(240θ/25) + 10. The fraction 240/25 = 48/5 means the curve closes after 5 turns... of 2π each ×5: 25 full turns of θ, weaving 48 waves round the ring.',
  }),
  base("Euler's Formula: You're Moving Forward", {
    mode: '3d', D: 24, view: { xMin: -3, xMax: 3, yMin: -3, yMax: 3 }, fy: 0.72, fs: 1.1, scale: 'major', root: 7, lo: 52, hi: 84,
    layers: [
      { name: 'helix', type: 'parametric', range: { min: 0, max: 31.416 }, exprs: { x: '1.3cos(s)', y: 's/6.2 - 2.5', z: '1.3sin(s)' }, color: '#ff8ad8', colorMode: 'solid', width: 3, wave: 'glass-pad', samples: 1800, caption: 'e^{i\\omega t} = \\cos(\\omega t) + i \\sin(\\omega t)' },
      { name: 'cos', type: 'parametric', range: { min: 0, max: 31.416 }, exprs: { x: '1.3cos(s)', y: '-2.5', z: '0' }, color: '#5fe05f', colorMode: 'solid', width: 3, wave: 'sine', volume: 0.25, caption: '-' },
    ],
    visual: { showAxes: true, showGrid: false, drawMode: 'trace', fog: { enabled: false } }, camera: { ending: 'auto', endingSecs: 3, autoRotate: true, rotateSpeed: 0.5 },
    overlay: { texts: [{ id: 'T1', text: "You're not going in circles", x: 0.5, y: 0.2, size: 0.62, color: '#6fe36f', font: 'display', bold: false }, { id: 'T2', text: "You're moving forward!", x: 0.5, y: 0.245, size: 0.62, color: '#ff8ad8', font: 'display', bold: false }] },
    hook: "You're not going in circles", desc: 'e^(iωt) = cos ωt + i sin ωt: seen from the front it is a circle, seen from the side a sine wave. With time as the third axis it is a helix that never comes back.',
  }),
];

const circle = (name, rule, lab, o = {}) => ({
  name, $category: 'Textbook', mode: 'circle', transport: { duration: o.D || 30, bpm: o.bpm || 100 },
  overlay: { layout: 4, name: { enabled: false }, formulas: { enabled: false } }, visual: { aspect: '9:16' },
  audio: { scale: o.scale || 'pentatonic', root: o.root ?? 0, noteLow: 48, noteHigh: 84, reverb: { decay: 2.8, mix: 0.3, tone: 0.7, preDelay: 0 } },
  circle: { rule, lab: { [rule]: lab }, look: { palette: o.pal || 'neon', background: o.bg || '#0a0a0d', ambience: false, counter: false, sparks: false }, sound: { instrument: o.inst || 'kalimba', pitch: 'angle', volume: 0.7, length: 0.4, maxRate: 16 } },
  camera: { ending: 'off' }, hook: { text: o.hook },
  youtube: { title: `${o.hook} #shorts`, description: `${o.desc}\n\n#math #shorts`, tags: 'math, waves, calculus, education, satisfying, shorts' },
  about: { title: name, math: o.desc, sources: [] },
});

TEXTBOOK_PRESETS.push(
  circle('The Geometry of Waves: Shapes Unrolled', 'shapewave', { rows: 'circle rose square star', title: 'The Geometry of Waves', speed: 0.25, cycles: 3 }, { hook: 'Every shape hides a wave', inst: 'vibraphone', desc: 'A point runs round a shape; its height, unrolled in time, is a wave. A circle gives a sine, a square a trapezoid, a star a zig-zag.' }),
  circle('Hearts, Stars and Flowers as Waves', 'shapewave', { rows: 'heart star6 rose5 spiro', title: 'Shapes as Waves', speed: 0.2, cycles: 2 }, { hook: 'What does a heart look like as a wave?', inst: 'harp', pal: 'candy', desc: 'The same idea with a heart, a six-pointed star, a five-petal rose and a spirograph figure.' }),
  circle('Derivative Visualization', 'derivgraph', { f: '0.5*x^3 - 2*x', title: 'Derivative Visualization', textF: 'f(x) = ½x³ − 2x', textD: 'f′(x) = 3⁄2 x² − 2' }, { hook: 'The slope draws a new curve', inst: 'e-piano', bg: '#101012', desc: 'The slope of f at each point is the height of f′ below: where f turns round, f′ crosses zero.' }),
  circle('Sine, Cosine and Minus Sine', 'derivgraph', { f: 'sin(x)', xmin: -6.3, xmax: 6.3, second: true, title: 'Three Derivatives of sin x', textF: 'f(x) = sin x', textD: 'f′ = cos x,  f″ = −sin x', period: 10 }, { hook: 'Differentiate sin twice…', inst: 'glass-pad', bg: '#101012', desc: 'The derivative of sin is cos, and the derivative of cos is −sin: three stacked graphs, one moving point.' }),
  circle('LED Thermometer', 'dotmatrix', { mode: 'number', value: 'floor(18 + 6*sin(t/3))', unit: '°C', color: 'magenta', cols: 34, block: 3, scanSpeed: 4 }, { hook: 'Numbers made of light', inst: 'music-box', bg: '#08080a', desc: 'Block digits on a matrix of lights, with a magenta-to-cyan gradient; a scan line plays the lit cells like a music box.' }),
  circle('A Sine Wave on a Wall of Lights', 'dotmatrix', { mode: 'plot', f: 'sin(x + t) + sin(3*x - t)/3', cols: 44, color: 'gradient', scanSpeed: 6 }, { hook: 'A wave on a wall of lights', inst: 'kalimba', pal: 'rainbow', bg: '#08080a', desc: 'y = sin(x + t) + sin(3x − t)/3 sampled onto a grid of lights and played column by column.' }),
  circle('The Perforated Hourglass', 'dotmatrix', { mode: 'region', region: 'abs(abs(x) - 0.62*abs(y) - 0.06*sin(3*y + t)) - 0.11', style: 'plate', color: 'amber', cols: 40, scan: true, scanSpeed: 3 }, { hook: 'A formula cut into a plate', inst: 'marimba', bg: '#1a1208', desc: 'A perforated plate: the holes are a grid, the solid bands are where |x| ≈ 0.62·|y| (an X that breathes with time).' }),
);
