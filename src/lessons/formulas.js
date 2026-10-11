/**
 * Formula lessons for the 2D and 3D modes: each step adds one formula layer and a plain
 * caption, the earlier steps stay as faint ghosts so you can compare. Higher on the
 * graph = higher note, so every curve is also a melody.
 */
import { mathLesson as M } from './kit.js';

const fn = (y, more = {}) => ({ type: 'function', exprs: { y }, ...more });
const par = (x, y, z = '0', max = 2 * Math.PI, more = {}) => ({ type: 'parametric', exprs: { x, y, z }, range: { min: 0, max }, ...more });
const polar = (r, max = 2 * Math.PI, more = {}) => ({ type: 'polar', exprs: { r }, range: { min: 0, max }, ...more });
// surfaces: a 64 × 64 grid (more is a white blur), coloured by height
const surf = (f, path = '2.5 sin(0.9x)', more = {}) => ({ type: 'surface', exprs: { f, path }, samples: 64, width: 2, colorMode: 'pitch', color2: '#ff3d9a', wave: 'sawtooth', volume: 1, ...more });
const SOFT_3D = { bloom: { strength: 0.7, threshold: 0.1 }, fog: { enabled: true, density: 0.03 } };

const WAVE_VIEW = { xMin: 0, xMax: 6.3, yMin: -5, yMax: 5 };
const SQUARE_VIEW = { xMin: -3, xMax: 3, yMin: -5.3, yMax: 5.3 }; // same scale on both axes in 9:16

export const FORMULAS_2D = [
  M('Amplitude', '2d', [
    { say: 'y = sin x: one gentle wave', layer: fn('sin(x)') },
    { say: 'Twice as tall: 2·sin x', layer: fn('2 sin(x)') },
    { say: 'Amplitude = how loud, how tall', layer: fn('3.5 sin(x)') },
  ], { view: WAVE_VIEW, hook: 'What does the number in front do?', title: 'Amplitude: the height of a wave 📈', desc: 'Multiply sin x by a number and the wave gets taller. In sound, a taller wave is a louder sound. Here, a taller curve also reaches higher notes.' }),

  M('Frequency', '2d', [
    { say: 'sin x: one wave in 2π', layer: fn('2.5 sin(x)') },
    { say: 'sin 2x: twice as many waves', layer: fn('2.5 sin(2x)') },
    { say: 'sin 4x: more waves, faster wobble', layer: fn('2.5 sin(4x)') },
  ], { view: WAVE_VIEW, hook: 'What does the number inside do?', title: 'Frequency: how many waves fit 〰️', desc: 'Multiply x inside the sine and the waves squeeze together. More waves per second is a higher frequency: a higher pitch.' }),

  M('Phase Shift', '2d', [
    { say: 'sin x starts at zero', layer: fn('2.5 sin(x)') },
    { say: 'sin(x − 1): the same wave, moved right', layer: fn('2.5 sin(x - 1)') },
    { say: 'cos x is sin x shifted by π/2', layer: fn('2.5 cos(x)') },
  ], { view: WAVE_VIEW, hook: 'Is cosine just a moved sine?', title: 'Phase shift: sine and cosine are the same wave 🔁', desc: 'Subtract a number inside the sine and the whole wave slides to the right. Slide it by a quarter turn (π/2) and you get the cosine.' }),

  M('Adding Waves', '2d', [
    { say: 'A slow wave…', layer: fn('2 sin(x)') },
    { say: '…a fast small wave…', layer: fn('0.7 sin(5x)') },
    { say: '…added together: a new shape', layer: fn('2 sin(x) + 0.7 sin(5x)', { width: 6 }) },
  ], { view: WAVE_VIEW, hook: 'What do two waves make together?', title: 'Add two waves, get a new one ➕', desc: 'Waves simply add, point by point. A slow wave plus a fast one makes a wobbly shape. Every sound you hear is made of sine waves added up like this.' }),

  M('Square Wave from Sines', '2d', [
    { say: 'sin x', layer: fn('3 sin(x)') },
    { say: '+ sin 3x / 3', layer: fn('3 (sin(x) + sin(3x)/3)') },
    { say: '+ sin 5x / 5 + sin 7x / 7 …', layer: fn('3 (sin(x) + sin(3x)/3 + sin(5x)/5 + sin(7x)/7 + sin(9x)/9 + sin(11x)/11 + sin(13x)/13)', { wave: 'square', volume: 0.35 }) },
  ], { view: WAVE_VIEW, hook: 'Can smooth waves make sharp corners?', title: 'Smooth sines add up to a square wave ⬛', desc: 'Add sin x, sin 3x/3, sin 5x/5 … the odd harmonics, each smaller than the last. The sum gets closer and closer to a square wave: the Fourier series.' }),

  M('Lines and Slopes', '2d', [
    { say: 'y = x: up one for every step right', layer: fn('x') },
    { say: 'y = 2x: steeper, twice as fast', layer: fn('2x') },
    { say: 'y = −x/2 + 2: going down', layer: fn('-x/2 + 2') },
  ], { view: { xMin: -4, xMax: 4, yMin: -7, yMax: 7 }, hook: 'What does the slope sound like?', title: 'Slope: how fast a line climbs 📐', desc: 'In y = m·x + b, m is the slope: how much the line climbs for every step to the right. A steeper line rises in pitch faster; a negative slope falls.' }),

  M('Parabolas', '2d', [
    { say: 'y = x²: a U shape', layer: fn('x^2 - 3') },
    { say: 'Move it: (x − 1.5)² − 3', layer: fn('(x - 1.5)^2 - 3') },
    { say: 'Flip it: −x² + 4', layer: fn('-x^2 + 4') },
  ], { view: { xMin: -3.5, xMax: 3.5, yMin: -5, yMax: 7 }, hook: 'How do you move a parabola?', title: 'Parabolas: move and flip a U 🎢', desc: 'y = x² makes a U. Subtract inside the bracket and it moves sideways; add outside and it moves up; a minus sign flips it upside down. Thrown balls fly in parabolas.' }),

  M('Growth and Decay', '2d', [
    { say: 'Doubling: 2^x grows faster and faster', layer: fn('0.1*2^x - 3') },
    { say: 'Halving: e^(−x) dies away', layer: fn('6 exp(-x) - 3') },
    { say: 'A fading note: e^(−x/2)·sin 6x', layer: fn('4 exp(-0.5x) sin(6x)') },
  ], { view: { xMin: 0, xMax: 6, yMin: -5, yMax: 5 }, hook: 'Why do plucked notes fade?', title: 'Exponential growth and decay 📉', desc: '2^x doubles with every step: exponential growth. e^(−x) keeps halving: decay. Multiply a wave by decay and you get the shape of a plucked string fading away.' }),

  M('Absolute Value', '2d', [
    { say: '|x|: negatives turn positive, a V', layer: fn('|x| - 2') },
    { say: '|sin x|: every dip flips up', layer: fn('3 |sin(x)| - 2') },
    { say: 'Shrinking bounces: a bouncing ball', layer: fn('6 |cos(1.5x)| exp(-0.35(x + 3)) - 3', { style: 'dots' }) },
  ], { view: { xMin: -3, xMax: 3, yMin: -4, yMax: 5 }, hook: 'What do the bars | | do?', title: 'Absolute value: flip the negatives ⤴️', desc: 'Absolute value turns every negative number positive. A line becomes a V, a sine wave becomes a row of bumps, and with decay it becomes a bouncing ball.' }),

  M('The Sound of a Formula', '2d', [
    { say: 'Higher on the graph = higher note', layer: fn('x') },
    { say: 'Falling line, falling pitch', layer: fn('-x') },
    { say: 'A wave goes up and down: a siren', layer: fn('3 sin(pi x/2)') },
  ], { view: { xMin: -4, xMax: 4, yMin: -6, yMax: 6 }, audio: { scale: 'continuous', glide: 40 }, hook: 'What does a graph sound like?', title: 'Listen to a graph: height = pitch 🎵', desc: 'The pen moves along the graph and its height sets the pitch. A rising line is a rising note, a falling line falls, a wave sounds like a siren.' }),

  M('Saw, Square, Triangle', '2d', [
    { say: 'mod(x, 1): climb and drop, a sawtooth', layer: fn('3 mod(x, 1.5) - 2', { wave: 'sawtooth', volume: 0.35 }) },
    { say: 'sign(sin x): only up or down, a square', layer: fn('1.5 sign(sin(2x))', { wave: 'square', volume: 0.35 }) },
    { say: 'Straight ramps up and down: a triangle', layer: fn('2 tri(x/3)', { wave: 'triangle' }) },
  ], { view: WAVE_VIEW, hook: 'Where do synth sounds come from?', title: 'Sawtooth, square, triangle: the synth waves 🎛️', desc: 'Three simple functions make the three classic synth waves: mod gives a sawtooth, the sign of a sine gives a square, and straight ramps up and down give a triangle.' }),

  M('Polar Curves', '2d', [
    { say: 'r = 2: the same distance everywhere, a circle', layer: polar('2') },
    { say: 'r = 1.4(1 + cos θ): a heart (cardioid)', layer: polar('1.4 (1 + cos(theta))') },
    { say: 'r = 0.2θ: further each turn, a spiral', layer: polar('0.2 theta', 4 * Math.PI) },
  ], { view: SQUARE_VIEW, hook: 'What if distance depends on the angle?', title: 'Polar curves: circles, hearts and spirals 🌀', desc: 'In polar form you give the distance r for every angle θ. A constant draws a circle, 1 + cos θ draws a heart, and r growing with θ draws a spiral.' }),

  M('Rose Curves', '2d', [
    { say: 'r = 2.6 cos 2θ: 4 petals', layer: polar('2.6 cos(2theta)') },
    { say: 'r = 2.6 cos 3θ: 3 petals', layer: polar('2.6 cos(3theta)') },
    { say: 'r = 2.6 cos 5θ: 5 petals (odd n gives n)', layer: polar('2.6 cos(5theta)') },
  ], { view: SQUARE_VIEW, past: 'keep', visual: { marker: { shape: 'star', size: 26 } }, hook: 'How many petals does cos 2θ have?', title: 'Rose curves: count the petals 🌹', desc: 'r = cos(nθ) draws a rose. Odd n gives n petals, even n gives 2n petals. So cos 2θ has 4, cos 3θ has 3 and cos 5θ has 5.' }),

  M('Parametric Curves', '2d', [
    { say: 'x = cos s, y = sin s: a circle', layer: par('2.4 cos(s)', '2.4 sin(s)') },
    { say: 'Stretch y: an ellipse', layer: par('2.4 cos(s)', '4.2 sin(s)') },
    { say: 'x = sin 3s, y = sin 2s: a Lissajous knot', layer: par('2.4 sin(3s)', '4.2 sin(2s)') },
  ], { view: SQUARE_VIEW, hook: 'What if x and y both follow a formula?', title: 'Parametric curves: circle, ellipse, Lissajous ➰', desc: 'Give x and y each their own formula of s and the pen draws a path. Cos and sin draw a circle, stretching one draws an ellipse, and different speeds draw a Lissajous figure.' }),
];

export const FORMULAS_3D = [
  M('Circle to Helix', '3d', [
    { say: 'A circle lying flat', layer: par('2 cos(s)', '0', '2 sin(s)', 2 * Math.PI) },
    { say: 'Climb while turning: a helix', layer: par('2 cos(s)', '0.35s - 4', '2 sin(s)', 8 * Math.PI) },
    { say: 'Widen while climbing: a cone spiral', layer: par('0.1s cos(s)', '0.35s - 4', '0.1s sin(s)', 8 * Math.PI) },
  ], { view: { xMin: -3, xMax: 3, yMin: -5, yMax: 5 }, camera: { autoRotate: true, rotateSpeed: 1.2, fov: 50 }, visual: { showGrid: false, ...SOFT_3D }, hook: 'How do you turn a circle into a spring?', title: 'From a circle to a helix to a spiral 🌀', desc: 'A circle turns in a flat plane. Let it climb while it turns and you get a helix, the shape of a spring and of DNA. Let it widen as well and it becomes a cone spiral.' }),

  M('Surfaces', '3d', [
    { say: 'height = sin x · cos y: hills and valleys', layer: surf('sin(x) cos(y)') },
    { say: 'x² − y²: a saddle', layer: surf('0.15 (x^2 - y^2)') },
    { say: 'A ripple: sin of the distance', layer: surf('1.2 sin(2 hypot(x, y)) / (1 + 0.3 hypot(x, y))') },
  ], { view: { xMin: -5, xMax: 5, yMin: -3, yMax: 3 }, past: 'hide', camera: { autoRotate: true, rotateSpeed: 0.5 }, visual: SOFT_3D, audio: { master: 1, noteLow: 40, noteHigh: 76 }, hook: 'What does a formula of x and y look like?', title: 'Formulas that make landscapes ⛰️', desc: 'A formula of two variables gives a height for every point: a landscape. sin x · cos y makes hills, x² − y² a saddle, and a sine of the distance a ripple.' }),

  M('Bowls and Bells', '3d', [
    { say: 'x² + y²: a bowl (paraboloid)', layer: surf('0.2 (x^2 + y^2) - 2') },
    { say: 'e^(−r²): a bell, the 3D bell curve', layer: surf('3 exp(-(x^2 + y^2)/3) - 1') },
    { say: 'cos x + cos y: an egg box', layer: surf('cos(x) + cos(y)') },
  ], { view: { xMin: -5, xMax: 5, yMin: -3, yMax: 3 }, past: 'hide', camera: { autoRotate: true, rotateSpeed: 0.5 }, visual: SOFT_3D, audio: { master: 1, noteLow: 40, noteHigh: 76 }, hook: 'Can you guess the shape from the formula?', title: 'Bowl, bell, egg box: guess the formula 🥣', desc: 'x² + y² curves up in every direction: a bowl. e^(−r²) is the bell curve spun around. cos x + cos y repeats in both directions like an egg box.' }),

  M('Knots', '3d', [
    { say: 'Round a ring: a simple loop', layer: par('2.5 cos(s)', '2.5 sin(s)', '0') },
    { say: '2 turns round, 3 through: a trefoil knot', layer: par('(2 + cos(3s)) cos(2s)', '(2 + cos(3s)) sin(2s)', 'sin(3s)', 2 * Math.PI, { colorMode: 'rainbow' }) },
    { say: '3 round, 5 through: a (3,5) knot', layer: par('(2 + cos(5s)) cos(3s)', '(2 + cos(5s)) sin(3s)', 'sin(5s)', 2 * Math.PI, { colorMode: 'rainbow', samples: 2000 }) },
  ], { view: { xMin: -3.5, xMax: 3.5, yMin: -5, yMax: 5 }, past: 'hide', camera: { autoRotate: true, rotateSpeed: 1, fov: 50 }, visual: SOFT_3D, hook: 'Can a formula tie a knot?', title: 'Formulas that tie knots 🪢', desc: 'Go round a ring p times while winding through it q times and the curve ties a torus knot. 2 and 3 give the trefoil, the simplest real knot.' }),

  M('3D Lissajous', '3d', [
    { say: 'x = sin s, y = sin 2s: a figure eight', layer: par('3 sin(s)', '3 sin(2s)', '0') },
    { say: 'Add depth: z = sin 3s', layer: par('3 sin(s)', '3 sin(2s)', '3 sin(3s)') },
    { say: '3 : 4 : 5: a tangled ball of string', layer: par('3 sin(3s)', '3 sin(4s)', '3 sin(5s + pi/4)', 2 * Math.PI, { colorMode: 'rainbow', samples: 2000 }) },
  ], { view: { xMin: -4, xMax: 4, yMin: -5, yMax: 5 }, past: 'hide', camera: { autoRotate: true, rotateSpeed: 0.8, fov: 50 }, visual: { drawMode: 'ghost', ...SOFT_3D }, hook: 'What happens with three frequencies?', title: 'Lissajous curves in 3D 🧶', desc: 'Give x, y and z sine waves with different frequencies. 1 and 2 make a figure eight; add a third and it lifts into 3D; 3 : 4 : 5 makes a tangle that still closes perfectly.' }),
];
