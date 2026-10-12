/**
 * Presets for Fourier drawing, calculus, π and fractals (vertical 9:16 Shorts). Titles use
 * searchable words (fourier animation, math animation, pi animation, fractal zoom …) and
 * every preset carries its own tags and a question that invites a comment.
 */
const P = (name, rule, lab, { look = {}, sound = {}, duration = 30, bpm = 110, audio = {}, hook, title, desc, tags, hashtags = '#math #mathanimation #shorts' } = {}) => ({
  name, mode: 'circle', transport: { duration, bpm },
  overlay: { layout: 4, name: { enabled: false } },
  visual: { aspect: '9:16' },
  audio: { scale: 'minorPentatonic', root: 9, noteLow: 48, noteHigh: 86, reverb: { decay: 3.5, mix: 0.35 }, delay: { time: 0.375, feedback: 0.3, mix: 0.16 }, ...audio },
  circle: { rule, lab: { [rule]: lab }, look: { trail: 'lines', ...look }, sound: { instrument: 'kalimba', pitch: 'angle', volume: 0.7, maxRate: 24, ...sound } },
  hook: { text: hook },
  youtube: { title: `${title} #shorts`, description: `${desc}\n\n${hashtags}`, tags },
});

const FOURIER_TAGS = 'fourier animation, fourier series, fourier transform, epicycles, math animation, math visualization, mathematics, satisfying, shorts';
const CALC_TAGS = 'calculus, derivative, integral, math animation, math visualization, mathematics, learn math, shorts';
const PI_TAGS = 'pi animation, pi, π, archimedes, math animation, math visualization, mathematics, pi day, shorts';
const FRACTAL_TAGS = 'fractal zoom, fractals, mandelbrot, julia set, fractal, math animation, math art, generative art, shorts';

export const TOPIC_PRESETS = [
  /* ------------------------------------------------------- fourier drawing */
  P('Fourier Draws a Cat', 'fdraw', { shape: 'cat', rounds: '3 10 30 100 300', period: 5.5 }, {
    look: { palette: 'aurora' }, sound: { instrument: 'harp' }, duration: 30,
    hook: 'Can spinning circles draw a cat?', title: 'Fourier animation: 300 spinning circles draw a cat 🐱', desc: 'Every circle spins at its own speed. Add them up, tip to tip, and the last one draws a cat. 3 circles make a blob, 300 make the cat. This is the Fourier series. How many circles did you think it needed?', tags: FOURIER_TAGS,
  }),
  P('Fourier Draws π', 'fdraw', { shape: 'pi', rounds: '2 6 20 60 250', period: 5.5 }, {
    look: { palette: 'gold' }, sound: { instrument: 'marimba' },
    hook: 'Watch circles write the number π', title: 'Fourier animation: circles write π 🥧', desc: 'A chain of spinning circles writes the symbol π. Each round adds more circles and the letter gets sharper. Fourier series in one picture.', tags: `${FOURIER_TAGS}, pi animation`,
  }),
  P('Fourier Draws a Heart', 'fdraw', { shape: 'heart', rounds: '1 2 4 12', period: 6.5 }, {
    look: { palette: 'candy' }, sound: { instrument: 'music-box' },
    hook: 'How many circles make a heart?', title: 'How many spinning circles draw a heart? ❤️', desc: 'One circle draws a circle. Two draw an egg. Four already look like a heart. Twelve make it perfect. Guess the number before it appears!', tags: FOURIER_TAGS,
  }),
  P('Fourier Draws a Music Note', 'fdraw', { shape: 'note', rounds: '3 12 40 200', period: 6.5, notes: 6 }, {
    look: { palette: 'neon' }, sound: { instrument: 'e-piano', volume: 0.8 },
    hook: 'Circles that draw music, and play it', title: 'Spinning circles draw a music note, and you hear it 🎵', desc: 'The pen’s height is the pitch: you hear the drawing while the circles draw a music note.', tags: FOURIER_TAGS,
  }),
  P('Fourier Butterfly', 'fdraw', { shape: 'butterfly', rounds: '5 20 80 300', period: 6.5 }, {
    look: { palette: 'rainbow' }, sound: { instrument: 'glass-pad', length: 0.8 },
    hook: 'A butterfly made of circles', title: 'Fourier animation: a butterfly from 300 circles 🦋', desc: 'The butterfly curve, drawn by spinning circles. Each round adds circles and more detail.', tags: FOURIER_TAGS,
  }),
  P('Guess What the Circles Draw', 'fdraw', { shape: 'star', rounds: '2 5 15 60', period: 6.5, ghost: false }, {
    look: { palette: 'gold' }, sound: { instrument: 'bell' },
    hook: 'Guess what they draw before it’s done!', title: 'Guess what these spinning circles draw 🤔', desc: 'No outline, no hints. The circles start drawing; can you guess the shape before the last round? Comment your guess and the second you knew.', tags: FOURIER_TAGS,
  }),

  /* --------------------------------------------------------------- calculus */
  P('The Sound of a Derivative', 'tangent', { f: 'sin(x) + 0.3*x', sweep: 12 }, {
    look: { palette: 'neon' }, sound: { instrument: 'synth-pluck', volume: 0.6 },
    hook: 'What does a slope sound like?', title: 'What does a derivative sound like? 📈', desc: 'A tangent line slides along the curve. Its slope draws the derivative underneath and sets the pitch: steep up is high, steep down is low.', tags: CALC_TAGS,
  }),
  P('Area Under a Curve', 'riemann', { f: '1 + sin(x) + 0.1*x^2', steps: '2 4 8 16 32 64 128' }, {
    look: { palette: 'ocean' }, sound: { instrument: 'marimba' },
    hook: 'How many rectangles until it’s exact?', title: 'Integral animation: rectangles find the area 📊', desc: '2, 4, 8 … 128 rectangles under a curve. The more you use, the closer their total gets to the true area: that limit is the integral.', tags: `${CALC_TAGS}, riemann sum`,
  }),
  P('Taylor Series of sin x', 'taylor', { fn: 'sin', terms: 10, every: 3 }, {
    look: { palette: 'aurora' }, sound: { instrument: 'e-piano' },
    hook: 'Can a polynomial become a sine wave?', title: 'Taylor series: a polynomial turns into sin x 〰️', desc: 'x, then x − x³/3!, then + x⁵/5! … every term hugs the sine wave a little further out. This is how calculators compute sin.', tags: `${CALC_TAGS}, taylor series`,
  }),
  P('Taylor Series of eˣ', 'taylor', { fn: 'exp', terms: 9, every: 3 }, {
    look: { palette: 'fire' }, sound: { instrument: 'e-piano' },
    hook: '1 + x + x²/2 + … = ?', title: 'Taylor series of eˣ, one term at a time 📈', desc: 'Add 1, x, x²/2!, x³/3! … and the polynomial becomes eˣ. Watch each term catch more of the curve.', tags: `${CALC_TAGS}, taylor series`,
  }),
  P('Unit Circle to Sine Wave', 'unitcircle', { speed: 0.18 }, {
    look: { palette: 'neon' }, sound: { instrument: 'harp' },
    hook: 'Where do sine and cosine come from?', title: 'Unit circle animation: where sine and cosine come from 🔄', desc: 'A point turns on a circle of radius 1. Its height draws sin θ, its sideways position draws cos θ. Trigonometry in one picture.', tags: 'unit circle, sine, cosine, trigonometry, math animation, math visualization, shorts',
  }),

  /* --------------------------------------------------------------------- pi */
  P('How Archimedes Found π', 'archimedes', {}, {
    look: { palette: 'gold' }, sound: { instrument: 'bell' },
    hook: 'How did Archimedes find π with no calculator?', title: 'How Archimedes found π with polygons 🥧', desc: 'Polygons inside and outside a circle: 6 sides, 12, 24, 48, 96. The circle’s length is trapped between them, and π is squeezed between 3.141 and 3.143.', tags: PI_TAGS,
  }),
  P('Random Dots Find π', 'montecarlo', {}, {
    look: { palette: 'ocean' }, sound: { instrument: 'kalimba' },
    hook: 'Can random dots find π?', title: 'Pi animation: 30,000 random dots find π 🎯', desc: 'Throw random dots at a square. The share that lands inside the circle is π/4. More dots, more correct digits.', tags: `${PI_TAGS}, monte carlo`,
  }),
  P("Buffon's Needle", 'buffon', {}, {
    look: { palette: 'candy' }, sound: { instrument: 'marimba' },
    hook: 'Drop needles on the floor, get π?', title: "Buffon's needle: π from dropped needles 🪡", desc: 'Drop needles as long as the gap between the lines. The chance a needle crosses a line is 2/π, so counting crossings finds π.', tags: `${PI_TAGS}, buffon's needle, probability`,
  }),
  P('π Digits Walk', 'pidigits', { mode: 'walk' }, {
    look: { palette: 'rainbow' }, sound: { instrument: 'e-piano' },
    hook: 'What do the digits of π look like?', title: 'Pi animation: 1500 digits of π as a walk 🚶', desc: 'Each digit of π is a direction: 0 is up, 1 a little to the right … 9. Step after step, the digits draw a random-looking path, and each digit plays a note.', tags: PI_TAGS,
  }),
  P('π Digits Circle', 'pidigits', { mode: 'chords' }, {
    look: { palette: 'rainbow' }, sound: { instrument: 'harp' },
    hook: 'Connect the digits of π', title: 'Pi visualized: every digit connected to the next ⭕', desc: 'Ten colours around a circle, one per digit. Each digit of π is joined to the next one. The pattern fills in evenly: every digit seems equally likely.', tags: PI_TAGS,
  }),
  P('The Sound of π', 'pidigits', { mode: 'grid', rate0: 3, accel: 1.12 }, {
    look: { palette: 'neon' }, sound: { instrument: 'kalimba', volume: 0.8 }, audio: { scale: 'major', root: 0, noteLow: 55, noteHigh: 79 },
    hook: 'What does π sound like?', title: 'What does π sound like? 🎹', desc: 'Every digit of π is a note of the scale: 3, 1, 4, 1, 5, 9 … and a colour on the grid. Does it sound like music to you?', tags: `${PI_TAGS}, pi song, sound of math`,
  }),

  /* --------------------------------------------------------------- fractals */
  P('Mandelbrot Zoom', 'mandel', { spot: 'seahorse', depth: 8, colors: 'fire' }, {
    look: { palette: 'fire' }, sound: { instrument: 'glass-pad', length: 1 }, duration: 30, bpm: 90,
    hook: 'Zooming 100,000,000 times into one formula', title: 'Fractal zoom: 100 million times into the Mandelbrot set 🔥', desc: 'Every pixel asks one question: does z → z² + c run away? Zoom 10⁸ times into seahorse valley and it never stops making new shapes.', tags: FRACTAL_TAGS,
  }),
  P('Fractal Zoom: Lightning', 'mandel', { spot: 'lightning', depth: 7, colors: 'neon' }, {
    look: { palette: 'neon' }, sound: { instrument: 'glass-pad', length: 1 }, bpm: 90,
    hook: 'Lightning hidden inside a formula', title: 'Fractal zoom: lightning inside the Mandelbrot set ⚡', desc: 'A zoom into the lightning branches of the Mandelbrot set, ten million times closer.', tags: FRACTAL_TAGS,
  }),
  P('Julia Set Morph', 'mandel', { set: 'julia', colors: 'ocean', juliaSpeed: 0.04 }, {
    look: { palette: 'ocean' }, sound: { instrument: 'glass-pad', length: 1.2 }, bpm: 80,
    hook: 'One number changes, the whole shape melts', title: 'Julia set animation: one number, endless shapes 🌀', desc: 'The same formula z → z² + c, while c slowly turns around a circle. Every c gives a different Julia set.', tags: FRACTAL_TAGS,
  }),
  P('Koch Snowflake', 'lsystem', { curve: 'koch', steps: '0 1 2 3 4 5' }, {
    look: { palette: 'mono' }, sound: { instrument: 'music-box' },
    hook: 'A shape with infinite length?', title: 'Koch snowflake: finite area, infinite length ❄️', desc: 'Replace every line by four lines a third as long, again and again. The area stays finite, but the edge grows by 4/3 each step, forever.', tags: `${FRACTAL_TAGS}, koch snowflake`,
  }),
  P('Dragon Curve', 'lsystem', { curve: 'dragon', steps: '1 3 5 7 9 11 13' }, {
    look: { palette: 'fire' }, sound: { instrument: 'synth-pluck' },
    hook: 'Fold a strip of paper 13 times', title: 'Dragon curve: fold paper in half 13 times 🐉', desc: 'Fold a strip in half again and again, unfold it to right angles: the dragon curve. Each fold doubles the number of lines.', tags: `${FRACTAL_TAGS}, dragon curve`,
  }),
  P('Hilbert Curve', 'lsystem', { curve: 'hilbert', steps: '1 2 3 4 5 6' }, {
    look: { palette: 'aurora' }, sound: { instrument: 'kalimba' },
    hook: 'One line that fills a whole square', title: 'Hilbert curve: one line that fills a square 🟩', desc: 'A single line that never crosses itself. Each step it wiggles more, and in the limit it passes through every point of the square.', tags: `${FRACTAL_TAGS}, hilbert curve, space filling curve`,
  }),
];
