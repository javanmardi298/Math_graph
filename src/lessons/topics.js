/**
 * Lessons for Fourier drawing & calculus, π, and fractals.
 */
import { circleLesson as L } from './kit.js';

const MATH_TAGS = 'math animation, math visualization, learn math, mathematics, education, shorts';

export const FOURIER_CALC = [
  L('Fourier Drawing', 'fdraw', [
    { lab: { shape: 'heart', rounds: '1 2', period: 4.5 }, say: 'One circle draws a circle…' },
    { lab: { shape: 'heart', rounds: '4 12', period: 4.5 }, say: '…add circles: a heart appears' },
    { lab: { shape: 'cat', rounds: '10 250', period: 4.5 }, say: 'Enough circles draw anything' },
  ], { palette: 'candy', instrument: 'harp', hook: 'Can circles draw anything?', title: 'Fourier animation: how circles draw any shape ❤️🐱', desc: 'Each spinning circle is one frequency. One circle draws a circle; a few draw a heart; 250 draw a cat. That is the Fourier series in two dimensions.', tags: `fourier animation, fourier series, epicycles, ${MATH_TAGS}` }),

  L('What Is a Derivative?', 'tangent', [
    { lab: { f: '0.5*x', sweep: 8, deriv: false }, say: 'A straight line: the same slope everywhere' },
    { lab: { f: '0.25*x^2 - 2', sweep: 8 }, say: 'A parabola: the slope grows steadily' },
    { lab: { f: 'sin(x)', sweep: 8 }, say: 'The slope of sin x is cos x' },
  ], { palette: 'neon', instrument: 'synth-pluck', sound: { volume: 0.6 }, hook: 'What is a derivative, really?', title: 'Derivative animation: what the slope really means 📈', desc: 'The derivative is the slope of the tangent line at every point. A line has one slope, a parabola’s slope grows in a straight line, and the slope of sin x draws cos x.', tags: `derivative, calculus, ${MATH_TAGS}` }),

  L('What Is an Integral?', 'riemann', [
    { lab: { f: '2', a: -2, b: 2, steps: '1 4', every: 6, xmin: -3, xmax: 3, ymin: -1, ymax: 4 }, say: 'A flat line: area = height × width' },
    { lab: { f: '0.5*x + 2', a: -2, b: 2, steps: '2 8 32', every: 4, xmin: -3, xmax: 3, ymin: -1, ymax: 4 }, say: 'A slope: rectangles get close…' },
    { lab: { f: '1 + sin(x) + 0.1*x^2', a: -3, b: 3, steps: '4 16 64 128', every: 3 }, say: '…infinitely thin ones give the integral' },
  ], { palette: 'ocean', instrument: 'marimba', hook: 'How do you measure a curved area?', title: 'Integral animation: area under a curve 📊', desc: 'Cut the area into rectangles and add them up. Thinner rectangles, smaller error: in the limit you get the exact area, the integral.', tags: `integral, riemann sum, calculus, ${MATH_TAGS}` }),

  L('Taylor Series', 'taylor', [
    { lab: { fn: 'cos', terms: 4, every: 2 }, say: '1 − x²/2 + x⁴/24 … becomes cos x' },
    { lab: { fn: 'exp', terms: 6, every: 1.5 }, say: '1 + x + x²/2 + … becomes eˣ' },
    { lab: { fn: 'ln', terms: 8, every: 1 }, say: 'ln(1 + x) only works between −1 and 1' },
  ], { palette: 'aurora', instrument: 'e-piano', hook: 'How does a calculator know sin and cos?', title: 'Taylor series animation: polynomials that become curves 〰️', desc: 'Adding powers of x, each with the right size, rebuilds cos x and eˣ. For ln(1 + x) it only works between −1 and 1: the radius of convergence.', tags: `taylor series, calculus, ${MATH_TAGS}` }),

  L('The Unit Circle', 'unitcircle', [
    { lab: { speed: 0.12, show: 'sin' }, say: 'The height of the point: sin θ' },
    { lab: { speed: 0.12, show: 'cos' }, say: 'How far right it is: cos θ' },
    { lab: { speed: 0.12, show: 'both', tan: true }, say: 'Both together, plus tan θ' },
  ], { palette: 'neon', instrument: 'harp', hook: 'Where do sine and cosine come from?', title: 'Unit circle animation: sin, cos and tan explained 🔄', desc: 'A point turns on a circle of radius 1. Its height is sin θ, its sideways position is cos θ, and the slope of the radius is tan θ.', tags: `unit circle, trigonometry, sine, cosine, ${MATH_TAGS}` }),
];

export const PI_LESSONS = [
  L('Archimedes and π', 'archimedes', [
    { lab: { sides: '6', every: 30 }, say: 'Hexagons inside and outside: 3 < π < 3.47' },
    { lab: { sides: '12 24', every: 8 }, say: 'Double the sides: the gap shrinks' },
    { lab: { sides: '48 96', every: 8 }, say: '96 sides: π ≈ 3.14' },
  ], { palette: 'gold', instrument: 'bell', hook: 'How did Archimedes find π?', title: 'Pi animation: how Archimedes trapped π 🥧', desc: 'A polygon inside the circle is shorter than the circle, one outside is longer. Doubling the sides again and again, Archimedes squeezed π to 3.14.', tags: `pi animation, archimedes, pi, ${MATH_TAGS}` }),

  L('π From Randomness', 'montecarlo', [
    { lab: { rate0: 3, accel: 1.15, max: 300 }, say: 'Random dots: some land in the circle' },
    { lab: { rate0: 20, accel: 1.35, max: 5000 }, say: 'inside ÷ all ≈ π/4' },
    { lab: { rate0: 200, accel: 1.4, max: 40000 }, say: 'More dots, more correct digits' },
  ], { palette: 'ocean', instrument: 'kalimba', hook: 'Can random dots find π?', title: 'Pi animation: π from random dots 🎯', desc: 'The circle covers π/4 of the square, so π/4 of random dots land inside. Count them and you get π, slowly: ten times more dots for each new digit.', tags: `pi animation, monte carlo, probability, ${MATH_TAGS}` }),

  L("Buffon's Needle", 'buffon', [
    { lab: { rate0: 1.5, accel: 1.1, max: 40 }, say: 'Drop needles as long as the gap' },
    { lab: { rate0: 10, accel: 1.3, max: 600 }, say: 'Count the ones that cross a line' },
    { lab: { rate0: 60, accel: 1.3, max: 3000 }, say: 'π ≈ 2 × needles ÷ crossings' },
  ], { palette: 'candy', instrument: 'marimba', hook: 'Can needles on a floor find π?', title: "Buffon's needle: find π by dropping needles 🪡", desc: 'A needle as long as the gap between lines crosses a line with probability 2/π. Drop enough of them and count: π appears from chance.', tags: `pi animation, buffon's needle, probability, ${MATH_TAGS}` }),

  L('Series for π', 'series', [
    { lab: { kind: 'leibniz', terms: 40, per: 0.25 }, say: 'Leibniz: 4(1 − 1/3 + 1/5 − …) is slow' },
    { lab: { kind: 'nilakantha', terms: 20, per: 0.5 }, say: 'Nilakantha: much faster' },
    { lab: { kind: 'wallis', terms: 40, per: 0.25 }, say: 'Wallis: a product, not a sum' },
  ], { palette: 'gold', instrument: 'marimba', hook: 'Which formula finds π fastest?', title: 'Three formulas for π, and how fast they get there 🥧', desc: 'Leibniz needs hundreds of terms for two digits. Nilakantha gets five digits in twenty terms. Wallis multiplies instead of adding.', tags: `pi animation, leibniz series, infinite series, ${MATH_TAGS}` }),

  L('The Digits of π', 'pidigits', [
    { lab: { mode: 'grid', rate0: 3, accel: 1.1, max: 200 }, say: '3.14159… every digit a colour and a note' },
    { lab: { mode: 'walk', rate0: 10, accel: 1.3, max: 1200 }, say: 'Every digit a direction: a random walk' },
    { lab: { mode: 'chords', rate0: 20, accel: 1.35, max: 2000 }, say: 'Every digit joined to the next' },
  ], { palette: 'rainbow', instrument: 'kalimba', hook: 'Do the digits of π have a pattern?', title: 'Pi visualized three ways: colours, a walk, a circle 🌈', desc: 'The digits of π never repeat. As colours, as a walk and as chords around a circle, they look random, and every digit shows up about equally often.', tags: `pi animation, digits of pi, ${MATH_TAGS}` }),
];

export const FRACTAL_LESSONS = [
  L('The Mandelbrot Set', 'mandel', [
    { lab: { spot: 'seahorse', depth: 1, colors: 'fire' }, say: 'z → z² + c: does it run away?' },
    { lab: { spot: 'seahorse', depth: 4, colors: 'fire' }, say: 'Zoom in: more detail…' },
    { lab: { spot: 'needle', depth: 1.5, colors: 'neon' }, say: '…and tiny copies of the whole set' },
  ], { palette: 'fire', instrument: 'glass-pad', sound: { length: 1 }, bpm: 90, hook: 'What is the Mandelbrot set?', title: 'Fractal zoom: what the Mandelbrot set is 🔥', desc: 'For each point c, repeat z → z² + c from z = 0. If z stays small, c is in the set (black). Zoom in and the edge never gets simpler, with small copies of the whole set.', tags: `fractal zoom, mandelbrot, fractals, ${MATH_TAGS}` }),

  L('Julia Sets', 'mandel', [
    { lab: { set: 'julia', juliaR: 0.35, juliaSpeed: 0.01, colors: 'ocean' }, say: 'Small c: a round, solid shape' },
    { lab: { set: 'julia', juliaR: 0.7885, juliaSpeed: 0.02, colors: 'ocean' }, say: 'Near the edge: lace and spirals' },
    { lab: { set: 'julia', juliaR: 1, juliaSpeed: 0.03, colors: 'neon' }, say: 'Too big: it breaks into dust' },
  ], { palette: 'ocean', instrument: 'glass-pad', sound: { length: 1.2 }, bpm: 80, hook: 'One number shapes a whole fractal', title: 'Julia set animation: one number, three worlds 🌀', desc: 'Same formula z → z² + c, now with c fixed and the start point varying. Small c gives a solid blob, c near the Mandelbrot edge gives lace, larger c breaks it into dust.', tags: `julia set, fractals, ${MATH_TAGS}` }),

  L('Fractal Curves', 'lsystem', [
    { lab: { curve: 'koch', steps: '0 1 2 3', every: 3 }, say: 'Koch: every line → 4 smaller lines' },
    { lab: { curve: 'dragon', steps: '2 6 10 13', every: 3 }, say: 'Dragon: fold a paper strip again and again' },
    { lab: { curve: 'hilbert', steps: '1 3 5', every: 4 }, say: 'Hilbert: one line that fills a square' },
  ], { palette: 'aurora', instrument: 'kalimba', hook: 'Can one rule make infinite detail?', title: 'Fractal curves: Koch, dragon and Hilbert in 30 s ❄️🐉', desc: 'A single replacement rule, repeated, makes a snowflake with an infinitely long edge, the paper-folding dragon, and a line that fills a whole square.', tags: `fractals, koch snowflake, dragon curve, hilbert curve, ${MATH_TAGS}` }),
];
