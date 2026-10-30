/**
 * Cinematic formula shows, second series: twenty different curves, each with its own way of being
 * drawn (prism, echo, kaleidoscope, beads, ink, glitch, laser web), its own backdrop, its own
 * camera film and its own final shot. Same recipe as cinematic.js, but nothing blows out to white:
 * the bright styles run at lower brightness with soft tone mapping, and the others do not add light
 * at all (ink on paper or chalk, beads, prism).
 *
 * Camera films (the opening and the middle of the video; the last 1.8 s is always the final shot):
 *   follow    close-up on the moving point, tilted, pulling back to the whole picture
 *   dive      the whole picture first, then a dive into a close-up on the pen, then a pull back
 *   spiral    a close-up that unwinds: the roll turns back to level while it pulls out
 *   push      a wide shot that pushes in on the pen and falls back
 *   handheld  a shaky close-up that settles as it pulls out, then a gentle drift
 *   orbit     (3D) the camera circles fast at first, closing in on the pen, then slows
 */
import { hsl, hueOf } from './sound-maker.js';
import { chordLayer, R, f3 } from './cinematic.js';

const TAU = Math.PI * 2;
const TAGS = 'math art, math animation, parametric curves, famous curves, satisfying, math music, generative art, shorts';

/** The curves. expr(k, i): strings at size k for pen i (the three layers of a show); `to` = the end of the range. */
const C = {
  lis34: { label: 'Lissajous 3:4', type: 'parametric', extent: 140, to: TAU, text: 'x = 140 sin(3t + π/2)\ny = 140 sin 4t', expr: (k) => ({ x: `${f3(140 * k)}*sin(3*s+1.5708)`, y: `${f3(140 * k)}*sin(4*s)` }), z: (k) => `${f3(80 * k)}*sin(5*s)` },
  nephroid: { label: 'Nephroid', type: 'parametric', extent: 180, to: TAU, text: 'x = 45 (3 cos t − cos 3t)\ny = 45 (3 sin t − sin 3t)', expr: (k) => ({ x: `${f3(45 * k)}*(3*cos(s)-cos(3*s))`, y: `${f3(45 * k)}*(3*sin(s)-sin(3*s))` }) },
  butterfly: { label: 'Butterfly Curve', type: 'polar', extent: 232, to: 24 * Math.PI, text: 'r = e^sin t − 2 cos 4t + sin⁵((2t − π)/24)', expr: (k) => ({ r: `${f3(40 * k)}*(exp(sin(theta))-2*cos(4*theta)+sin((2*theta-pi)/24)^5)` }) },
  rose53: { label: 'Rose 5/3', type: 'polar', extent: 160, to: 6 * Math.PI, text: 'r = 160 cos(5t/3),  0 ≤ t ≤ 6π', expr: (k) => ({ r: `${f3(160 * k)}*cos(5*theta/3)` }) },
  deltoid: { label: 'Deltoid', type: 'parametric', extent: 180, to: TAU, text: 'x = 60 (2 cos t + cos 2t)\ny = 60 (2 sin t − sin 2t)', expr: (k) => ({ x: `${f3(60 * k)}*(2*cos(s)+cos(2*s))`, y: `${f3(60 * k)}*(2*sin(s)-sin(2*s))` }) },
  galaxy: { label: 'Spiral Galaxy', type: 'parametric', extent: 152, to: 8 * Math.PI, open: true, text: 'r = 6t,  three arms 120° apart', expr: (k, i) => ({ x: `${f3(6 * k)}*s*cos(s+${f3(i * 2.0944)})`, y: `${f3(6 * k)}*s*sin(s+${f3(i * 2.0944)})` }) },
  golden: { label: 'Golden Spiral', type: 'polar', extent: 156, to: 8 * Math.PI, open: true, text: 'r = 6 e^(0.13 t)', expr: (k) => ({ r: `${f3(6 * k)}*exp(0.13*theta)` }) },
  epitro: { label: 'Epitrochoid', type: 'parametric', extent: 142, to: 2 * TAU, text: 'x = 90 cos t + 50 cos(5t/2)\ny = 90 sin t + 50 sin(5t/2)', expr: (k) => ({ x: `${f3(90 * k)}*cos(s)+${f3(50 * k)}*cos(5*s/2)`, y: `${f3(90 * k)}*sin(s)+${f3(50 * k)}*sin(5*s/2)` }) },
  limacon: { label: 'Limaçon', type: 'polar', extent: 162, to: TAU, text: 'r = 60 + 100 cos t', expr: (k) => ({ r: `${f3(k)}*(60+100*cos(theta))` }) },
  torus: { label: 'Torus Knot (2,5)', type: 'parametric', extent: 182, to: 2 * TAU, text: 'x = 60 (2 + cos 2.5t) cos t\ny = 60 (2 + cos 2.5t) sin t', expr: (k) => ({ x: `${f3(60 * k)}*(2+cos(2.5*s))*cos(s)`, y: `${f3(60 * k)}*(2+cos(2.5*s))*sin(s)` }), z: (k) => `${f3(70 * k)}*sin(2.5*s)` },
  heart: { label: 'Heart', type: 'parametric', extent: 172, to: TAU, text: 'x = 160 sin³t\ny = 130 cos t − 50 cos 2t − 20 cos 3t − 10 cos 4t', expr: (k) => ({ x: `${f3(160 * k)}*sin(s)^3`, y: `${f3(10 * k)}*(13*cos(s)-5*cos(2*s)-2*cos(3*s)-cos(4*s))` }) },
  lis56: { label: 'Lissajous 5:6', type: 'parametric', extent: 140, to: TAU, text: 'x = 140 sin 5t\ny = 140 sin(6t + 1)', expr: (k) => ({ x: `${f3(140 * k)}*sin(5*s)`, y: `${f3(140 * k)}*sin(6*s+1)` }), z: (k) => `${f3(100 * k)}*sin(7*s)` },
  lemni: { label: 'Lemniscate of Bernoulli', type: 'parametric', extent: 172, to: TAU, text: 'x = 170 cos t / (1 + sin²t)\ny = 170 sin t cos t / (1 + sin²t)', expr: (k) => ({ x: `${f3(170 * k)}*cos(s)/(1+sin(s)^2)`, y: `${f3(170 * k)}*sin(s)*cos(s)/(1+sin(s)^2)` }) },
  hypo: { label: 'Hypotrochoid 8:3', type: 'parametric', extent: 122, to: 3 * TAU, text: 'x = 60 cos t + 60 cos(5t/3)\ny = 60 sin t − 60 sin(5t/3)', expr: (k) => ({ x: `${f3(60 * k)}*(cos(s)+cos(5*s/3))`, y: `${f3(60 * k)}*(sin(s)-sin(5*s/3))` }) },
  superf: { label: 'Superformula', type: 'polar', extent: 132, to: 2 * TAU, text: 'r = 130 (|cos 5t/4|^0.7 + |sin 5t/4|^0.7)^−2', expr: (k) => ({ r: `${f3(130 * k)}*(abs(cos(5*theta/4))^0.7+abs(sin(5*theta/4))^0.7)^(-2)` }), z: (k) => `${f3(50 * k)}*sin(2*theta)` },
  ribbon: { label: 'Harmonic Ribbon', type: 'parametric', extent: 132, to: TAU, text: 'x = 65 (sin 2t + sin 3t)\ny = 65 (cos 3t + cos 5t)', expr: (k) => ({ x: `${f3(65 * k)}*(sin(2*s)+sin(3*s))`, y: `${f3(65 * k)}*(cos(3*s)+cos(5*s))` }) },
  ranun: { label: 'Ranunculoid', type: 'parametric', extent: 176, to: TAU, text: 'x = 25 (6 cos t − cos 6t)\ny = 25 (6 sin t − sin 6t)', expr: (k) => ({ x: `${f3(25 * k)}*(6*cos(s)-cos(6*s))`, y: `${f3(25 * k)}*(6*sin(s)-sin(6*s))` }), z: (k) => `${f3(60 * k)}*cos(3*s)` },
  cage: { label: 'Wave Cage', type: 'parametric', extent: 172, to: TAU, text: 'x = 140 sin t + 30 sin 9t\ny = 140 cos t + 30 cos 11t', expr: (k) => ({ x: `${f3(140 * k)}*sin(s)+${f3(30 * k)}*sin(9*s)`, y: `${f3(140 * k)}*cos(s)+${f3(30 * k)}*cos(11*s)` }) },
  cardioid: { label: 'Cardioid', type: 'polar', extent: 172, to: TAU, text: 'r = 85 (1 − sin t)', expr: (k) => ({ r: `${f3(85 * k)}*(1-sin(theta))` }) },
  spirose: { label: 'Spiral Rose', type: 'polar', extent: 142, to: TAU, text: 'r = 22 t cos 3t', expr: (k) => ({ r: `${f3(22 * k)}*theta*cos(3*theta)` }) },
};

// id, drawing, backdrop, [line 1, line 2], scale, root, voice, film, final shot, seconds, hook, '3d'?, extra
const SHOWS = [
  ['lis34', 'prism', 'dusk', ['#ff7a59', '#ffd166'], 'dorian', 2, 'e-piano', 'follow', 'crash', 24, 'Three against four'],
  ['nephroid', 'echo', 'cosmos', ['#8fd3ff', '#c58cff'], 'lydian', 5, 'glass-pad', 'dive', 'rise', 28, 'The glint in your coffee cup'],
  ['butterfly', 'ink', 'paper', ['#2b1d14', '#a33b1d'], 'minorPentatonic', 9, 'harp', 'handheld', 'slide', 32, 'One equation, one butterfly', null, { light: true }],
  ['rose53', 'kaleido', 'nebula', ['#ffb3c6', '#c4b5fd'], 'major', 0, 'music-box', 'spiral', 'whirl', 28, 'A rose that needs 6π'],
  ['deltoid', 'beads', 'blueprint', ['#6ae0ff', '#ffd166'], 'phrygian', 4, 'kalimba', 'push', 'dutch', 24, 'A triangle made of curves'],
  ['galaxy', 'web', 'cosmos', ['#ffd9a0', '#ff8ab4'], 'lydian', 7, 'bell', 'dive', 'pushin', 30, 'Three arms of a galaxy'],
  ['golden', 'ink', 'chalk', ['#fff4d6', '#ffd166'], 'major', 0, 'marimba', 'follow', 'breath', 26, 'The golden spiral'],
  ['epitro', 'glitch', 'bokeh', ['#ff3d9a', '#3df0ff'], 'minorPentatonic', 9, 'synth-pluck', 'handheld', 'flare', 28, 'A planet and its moons'],
  ['limacon', 'echo', 'waves', ['#9ee7ff', '#e6ccff'], 'dorian', 2, 'harp', 'push', 'drop', 24, 'A loop inside a loop'],
  ['torus', 'prism', 'stars', ['#ff9a5a', '#ffd166'], 'harmonicMinor', 9, 'glass-pad', 'orbit', 'spin', 30, 'A knot on a donut', '3d'],
  ['heart', 'beads', 'dusk', ['#ff6a8a', '#ffc2d1'], 'major', 5, 'music-box', 'spiral', 'breath', 24, 'A heart from one formula'],
  ['lis56', 'kaleido', 'topo', ['#7be0c3', '#ffd27a'], 'pentatonic', 4, 'e-piano', 'orbit', 'whirl', 26, 'Five against six', '3d'],
  ['lemni', 'ink', 'paper', ['#1e3a5f', '#c1432d'], 'mixolydian', 7, 'harp', 'dive', 'slide', 24, 'Infinity, drawn slowly', null, { light: true }],
  ['hypo', 'prism', 'embers', ['#ff8a3d', '#ffd23d'], 'phrygianDominant', 4, 'marimba', 'spiral', 'crash', 28, 'A spirograph from one formula'],
  ['superf', 'glitch', 'rings', ['#a4ff9e', '#ff4fd8'], 'lydian', 0, 'synth-pluck', 'orbit', 'whirl', 26, 'The superformula', '3d'],
  ['ribbon', 'echo', 'aurora', ['#7aa8ff', '#ff9ad9'], 'dorian', 9, 'glass-pad', 'handheld', 'rise', 28, 'A ribbon of four harmonics'],
  ['ranun', 'web', 'stars', ['#ffcf5a', '#ff5a8a'], 'minor', 2, 'bell', 'orbit', 'crash', 28, 'Five cusps, one formula', '3d'],
  ['cage', 'kaleido', 'waves', ['#9fe8ff', '#c4b5fd'], 'pentatonic', 0, 'kalimba', 'push', 'drop', 26, 'A cage of waves', null, { copies: 3 }],
  ['cardioid', 'ink', 'paper', ['#6b1f2a', '#d4573b'], 'minorPentatonic', 9, 'harp', 'follow', 'breath', 22, 'The cardioid', null, { light: true }],
  ['spirose', 'beads', 'cosmos', ['#ffd9a0', '#9ee7ff'], 'lydian', 2, 'music-box', 'spiral', 'dutch', 26, 'A rose that unrolls'],
];

/** How each drawing is tuned (never blown out): brightness, tail, line width, bloom, tone. */
const LOOK = {
  glitch: { tail: 0.22, width: 3.0, offset: 4.5, intensity: 0.8, bloom: 0.5, strings: 90 },
  prism: { tail: 0.3, width: 3.0, offset: 3.0, intensity: 1, bloom: 0.55, strings: 90 },
  echo: { tail: 0.45, width: 2.6, offset: 3, intensity: 0.85, bloom: 0.55, strings: 90 },
  kaleido: { tail: 0.5, width: 2.4, offset: 3, intensity: 0.9, bloom: 0.55, strings: 90 },
  beads: { tail: 0.3, width: 2.4, offset: 3, intensity: 1, bloom: 0.5, strings: 150 },
  web: { tail: 0.4, width: 2.4, offset: 3, intensity: 0.8, bloom: 0.55, strings: 70 },
  ink: { tail: 0.5, width: 3.4, offset: 3, intensity: 1, bloom: 0.3, strings: 90 },
};

const k = (list) => list.map(([time, value, ease = 'smooth']) => ({ time: +time.toFixed(2), value, ease }));

/** Keyframes of a camera film: zoom, follow, roll, shake, drift, orbit speed. */
function film(kind, D, is3d) {
  const E = D - 1.9, z = is3d ? 0.7 : 1;
  const zz = (v) => +(1 + (v - 1) * z).toFixed(2);
  switch (kind) {
    case 'dive': return { 'camera.zoom': k([[0, 1], [0.28 * D, 1], [0.5 * D, zz(3.3)], [0.72 * D, zz(3)], [Math.min(0.9 * D, E), 1]]), 'camera.track': k([[0, 0], [0.28 * D, 0], [0.5 * D, 1], [0.72 * D, 1], [Math.min(0.9 * D, E), 0]]), 'camera.roll': k([[0, 0], [0.5 * D, -7], [Math.min(0.9 * D, E), 0]]) };
    case 'spiral': return { 'camera.zoom': k([[0, zz(4.2)], [0.5 * D, zz(1.7)], [0.72 * D, 1]]), 'camera.track': k([[0, 1], [0.5 * D, 0.7], [0.72 * D, 0]]), 'camera.roll': k([[0, 42], [0.72 * D, 0]]) };
    case 'push': return { 'camera.zoom': k([[0, 0.85], [0.45 * D, zz(2.5)], [0.7 * D, zz(2.5)], [Math.min(0.9 * D, E), 1]]), 'camera.track': k([[0, 0], [0.45 * D, 1], [0.7 * D, 1], [Math.min(0.9 * D, E), 0]]), 'camera.roll': k([[0, -4], [0.45 * D, 6], [Math.min(0.9 * D, E), 0]]) };
    case 'handheld': return { 'camera.zoom': k([[0, zz(3.2)], [0.4 * D, zz(2.4)], [0.65 * D, 1]]), 'camera.track': k([[0, 1], [0.4 * D, 1], [0.65 * D, 0]]), 'camera.shake': k([[0, 0.85], [0.65 * D, 0.1], [E, 0]]), 'camera.drift': k([[0, 0], [0.65 * D, 0.5], [E, 0.5]]) };
    case 'orbit': return { 'camera.zoom': k([[0, 2.4], [0.35 * D, 2], [0.6 * D, 1]]), 'camera.track': k([[0, 1], [0.35 * D, 1], [0.6 * D, 0]]), 'camera.rotateSpeed': k([[0, 5], [0.6 * D, 0.9]]) };
    default: return { 'camera.zoom': k([[0, zz(3.8)], [0.34 * D, zz(3)], [0.58 * D, 1], [E, 1]]), 'camera.track': k([[0, 1], [0.34 * D, 1], [0.58 * D, 0], [D, 0]]), 'camera.roll': k([[0, 9], [0.34 * D, 5], [0.58 * D, 0], [D, 0]]) };
  }
}

function show([id, style, backdrop, [c1, c2], scale, root, voice, filmKind, ending, D, hook, dim, extra = {}]) {
  const F = C[id], L = LOOK[style], is3d = dim === '3d', light = !!extra.light;
  const H = hueOf(c1), u = is3d ? 0.03 : 1;
  const ext = F.extent * u * (is3d ? 1.25 : 1.12), tall = is3d ? 1 : 16 / 9;
  const view = { xMin: +ext.toFixed(3) * -1, xMax: +ext.toFixed(3), yMin: +(-ext * tall).toFixed(3), yMax: +(ext * tall).toFixed(3) };
  // the curve's top plays `hi`, its bottom `lo`; pitch is linear in y over the window
  const lo = 46 + root, hi = 82 + root, ya = F.extent * u * 1.02, yb = -ya, kk = (hi - lo) / (ya - yb);
  const noteLow = +(lo - (yb - view.yMin) * kk).toFixed(2), noteHigh = +(noteLow + (view.yMax - view.yMin) * kk).toFixed(2);
  const audio = { master: 0.92, scale, root: ((root % 12) + 12) % 12, noteLow, noteHigh, glide: 30, articulation: 'pluck', reverb: R(3.2, 0.36, 0.75), delay: { time: 0.375, feedback: 0.26, mix: 0.12, pingpong: true } };
  const pens = [[1, 0, 0, voice, 1], [0.62, F.open ? 0 : Math.PI, 1, 'triangle', 0.5], [0.32, F.open ? 0 : Math.PI / 2, 2, 'sine', 0.38]];
  const layers = pens.map(([sz, off, oct, w, vol], i) => ({
    name: i ? `${F.label} · echo ${i}` : F.label, type: F.type, range: { min: +off.toFixed(4), max: +(off + F.to).toFixed(4) },
    exprs: { ...F.expr(sz * u, i), z: is3d && F.z ? F.z(sz * u) : '0' }, samples: Math.min(6000, Math.round(900 * F.to / Math.PI)),
    wave: w, volume: vol, octave: oct, width: L.width * (i ? 0.8 : 1), colorMode: 'gradient', color: i === 1 ? c2 : c1, color2: i === 1 ? c1 : c2, caption: i ? '-' : F.text,
  }));
  const start = D - 1.8;
  const chord = [[0, 0.5], [7, 0.42], [12, 0.46], [-12, 0.6]].map(([semi, vol], i) => chordLayer(`Closing chord ${i + 1}`, 60 + root + semi, view, audio, start, vol));
  const kind = { glitch: 'Glitch', prism: 'Prism', echo: 'Echo', kaleido: 'Kaleidoscope', beads: 'Beads', web: 'Laser Web', ink: 'Ink' }[style];
  const bg = light ? '#efe6d2' : hsl(H, 0.55, backdrop === 'dusk' ? 0.07 : 0.03);
  return {
    name: `${F.label}${is3d ? ' 3D' : ''}: ${kind}`, mode: is3d ? '3d' : '2d', transport: { duration: D, bpm: 96 }, view,
    sequence: { enabled: false, past: 'keep' },
    layers: [...layers.map((l) => (light ? { ...l, color: c1, color2: c2 } : l)), ...chord],
    visual: {
      aspect: '9:16', drawMode: 'trace', background: bg, gridColor: hsl(H, 0.45, 0.09), axesColor: hsl(H, 0.4, 0.26), showGrid: false, showAxes: false,
      backdrop, backdropColor: light ? '#c9a66b' : c1, tone: light ? 'off' : 'soft', exposure: 1,
      fx: { style, tail: L.tail, offset: L.offset, strings: L.strings, stringAlpha: 0.16, hold: 2, intensity: L.intensity, copies: extra.copies || 6 },
      bloom: { enabled: !light, strength: L.bloom, radius: 0.45, threshold: 0.12 }, trail: { enabled: !light, count: 140, size: 4 }, marker: { shape: 'circle', size: light ? 20 : 24, smoothing: 0.3, cursorLine: false },
      ...(is3d ? { fog: { enabled: true, density: 0.0025 } } : {}),
    },
    camera: { ending, endingSecs: 1.8, track: 1, trackSpeed: 0.1, zoom: 3.4, roll: 9, ...(is3d ? { autoRotate: true, rotateSpeed: 1 } : {}) },
    audio, rhythm: { enabled: false, showGrid: false },
    overlay: { layout: 4, name: { enabled: false }, formulas: { enabled: true, x: 0.06, y: 0.12, size: 0.6, start: D * 0.5, end: D - 1.9 }, texts: [] },
    keyframes: { tracks: film(filmKind, D, is3d), autoKey: false },
    hook: { text: hook },
    youtube: { title: `${hook} ${{ glitch: '🔴🟢🔵', prism: '🔮', echo: '🌀', kaleido: '❄️', beads: '📿', web: '🕸️', ink: '🖋️' }[style]} #shorts`, description: `${F.text.replace(/\n/g, '  ·  ')}\n\nThe formula behind it is on screen. Which curve should I draw next? 👇\n\n#math #mathart #mathanimation #shorts`, tags: TAGS },
  };
}

export const CINEMATIC2_PRESETS = SHOWS.map(show).map((p) => ({ ...p, $category: 'Formulas · Cinematic' }));
