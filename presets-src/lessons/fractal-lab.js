/**
 * Lessons for the fractal workshop (src/circle/fractal-lab.js) and the graph scenes
 * (src/circle/shapes-lab.js): one idea per step.
 */
import { circleLesson as L } from './kit.js';

const A = { scale: 'minorPentatonic', root: 2, noteLow: 43, noteHigh: 86, reverb: { decay: 3.6, mix: 0.36 } };
const dark = { background: '#03040a', ambience: false, counter: false, sparks: false };

export const FRACTAL_LAB_LESSONS = [
  L('One Rule, Repeated', 'fractal', [
    { lab: { type: 'mandelbrot', journey: 'still', colors: 'mono', showOrbit: true, sound: 'orbit', nps: 4 }, say: 'Square the number, add c, repeat: black = it never escapes' },
    { lab: { type: 'mandelbrot', journey: 'zoom', spot: 'seahorse', depth: 5, colors: 'fire' }, say: 'Zoom into the edge: the detail never ends' },
    { lab: { type: 'mandelbrot', julia: true, journey: 'julia', jpath: 'circle', colors: 'twilight' }, say: 'Fix c instead: every c has its own Julia set' },
    { lab: { type: 'burningship', journey: 'zoom', spot: 'ship', depth: 3, colors: 'lava' }, say: 'Fold the plane first: a burning ship appears' },
  ], { instrument: 'glass-pad', duration: 56, audio: A, look: dark, hook: 'What is the Mandelbrot set, really?', title: 'One rule, repeated: the Mandelbrot set, Julia sets and the Burning Ship ❄', desc: 'z → z² + c. Start at 0, repeat, and colour each c by how fast the orbit runs away.' }),

  L('Newton Fights Over Roots', 'fractal', [
    { lab: { type: 'newton', journey: 'still', power: 3, colors: 'candy' }, say: 'Each colour: the root that Newton’s method finds from there' },
    { lab: { type: 'newton', journey: 'power', power: 3, power2: 7, colors: 'rainbow' }, say: 'More roots, more borders, all tangled' },
    { lab: { type: 'newton', journey: 'still', power: 4, relax: 1.75, colors: 'electric' }, say: 'Overshoot each step: the borders boil' },
  ], { instrument: 'bell', duration: 39, audio: A, look: dark, hook: 'Which root wins?', title: 'Newton’s method: every point picks a root 🎯', desc: 'Solve z^p = 1 by Newton’s method from every point of the plane. Wherever three colours meet, they meet again at every scale.' }),

  L('The Ghost in the Set', 'buddha', [
    { lab: { rate: 600, maxIter: 60, colors: 'mono' }, say: 'Follow each escaping point and mark every step' },
    { lab: { rate: 2600, maxIter: 300, colors: 'twilight' }, say: 'Thousands of paths: a figure appears' },
    { lab: { anti: true, rate: 1500, colors: 'ocean' }, say: 'The paths that never leave draw the opposite' },
  ], { instrument: 'choir', duration: 45, audio: A, look: dark, hook: 'Who is hiding in the Mandelbrot set?', title: 'The Buddhabrot: paths of escaping points 👻', desc: 'Instead of colouring where a point starts, mark everywhere its orbit goes.' }),

  L('Order and Chaos, Side by Side', 'lyapunov', [
    { lab: { seq: 'AB', colors: 'copper' }, say: 'Two growth rates take turns: colour = calm, dark = chaos' },
    { lab: { seq: 'AABAB', a0: 2.6, b0: 2.6, colors: 'aurora' }, say: 'Change the rhythm and the map changes' },
    { lab: { seq: 'BBBBBBAAAAAA', a0: 3.4, a1: 4, b0: 2.5, b1: 3.4, colors: 'gold', iters: 240 }, say: 'A famous one: “Zircon Zity”' },
  ], { instrument: 'warm-pad', duration: 36, audio: A, look: dark, hook: 'Where does chaos begin?', title: 'Lyapunov fractals: maps of order and chaos 🗺', desc: 'A population with two alternating growth rates. The Lyapunov exponent says whether small differences die out or explode.' }),

  L('Ferns from Chance', 'ifs', [
    { lab: { system: 'sierpinski', rate0: 6 }, say: 'Jump halfway to a random corner, again and again' },
    { lab: { system: 'fern' }, say: 'Four rules, chosen by chance, always grow this fern' },
    { lab: { system: 'dragon', colorBy: 'time' }, say: 'Two rules: a dragon' },
    { lab: { system: 'maple', colorBy: 'height' }, say: 'Four others: a maple leaf' },
  ], { instrument: 'kalimba', duration: 48, audio: A, look: { ...dark, palette: 'matrix' }, hook: 'Can chance draw a fern?', title: 'The chaos game: ferns, dragons and leaves from random jumps 🌿', desc: 'Barnsley’s iterated function systems: a few shrinking maps, one picked at random each step.' }),

  L('Every Shape Hides a Wave', 'shapewave', [
    { lab: { rows: 'circle', cycles: 2 }, say: 'A point on a circle: its height is a sine wave' },
    { lab: { rows: 'circle square' }, say: 'On a square the wave gets flat tops' },
    { lab: { rows: 'circle rose square star', title: 'The Geometry of Waves' }, say: 'Every closed shape has its own wave' },
  ], { instrument: 'vibraphone', duration: 36, audio: { ...A, scale: 'pentatonic', root: 0 }, look: { ...dark, background: '#0a0a0d' }, hook: 'What wave does a star make?', title: 'The geometry of waves: shapes unrolled 🌊', desc: 'Run round a shape at steady speed and plot your height against time.' }),

  L('The Slope Draws a Curve', 'derivgraph', [
    { lab: { f: 'x^2', xmin: -2.5, xmax: 2.5, textF: 'f(x) = x²', textD: 'f′(x) = 2x', title: '' }, say: 'The slope of x² grows steadily: a straight line' },
    { lab: { f: '0.5*x^3 - 2*x', textF: 'f(x) = ½x³ − 2x', textD: 'f′(x) = 3⁄2 x² − 2', title: '' }, say: 'Where f turns round, f′ crosses zero' },
    { lab: { f: 'sin(x)', xmin: -6.3, xmax: 6.3, second: true, textF: 'f(x) = sin x', textD: 'f′ = cos x,  f″ = −sin x', title: '' }, say: 'sin → cos → −sin' },
  ], { instrument: 'e-piano', duration: 36, audio: { ...A, scale: 'major', root: 0 }, look: { ...dark, background: '#101012' }, hook: 'What is a derivative?', title: 'The derivative, drawn live under its function 📈', desc: 'The height of the lower graph is the slope of the upper one.' }),

  L('Maths on a Wall of Lights', 'dotmatrix', [
    { lab: { mode: 'number', value: 'floor(t*2)', unit: '', color: 'magenta' }, say: 'Counting in block digits' },
    { lab: { mode: 'plot', f: 'sin(x + t)', cols: 40 }, say: 'A sine wave, one light per column' },
    { lab: { mode: 'region', region: 'x^2 + y^2 - 0.5 - 0.2*sin(t)', style: 'plate', color: 'amber', cols: 36 }, say: 'A breathing circle cut into a plate' },
  ], { instrument: 'music-box', duration: 30, audio: { ...A, scale: 'pentatonic', root: 0 }, look: { ...dark, background: '#08080a', palette: 'rainbow' }, hook: 'Can lights draw maths?', title: 'Numbers, waves and shapes on a matrix of lights 💡', desc: 'Sample a number, a curve or a region onto a grid of lights; a scan line plays the lit cells.' }),
];
