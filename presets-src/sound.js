/**
 * Formula presets for Shorts (vertical, 2D/3D mode), in three formats that work in the
 * math-visualisation niche:
 *
 *   Sound of a graph   a famous curve is drawn while its height sets the pitch: you hear
 *                      the shape (continuous pitch with glide, like a voice or a siren)
 *   Guess the shape    the drawing stays hidden (visual.hideUntil) while the sound plays,
 *                      then the shape appears: viewers guess in the comments
 *   A or B             two curves one after another, then "A or B? Comment!"
 */
const COLORS = ['#22e4ff', '#ff3d9a', '#ffd23d', '#8cff5a', '#b18cff'];

/** A caption box: shown from `start` to `end` seconds (0 = to the end). */
const T = (text, start, end = 0, { y = 0.7, size = 0.62, color = '#ffffff' } = {}) => ({
  id: `t${Math.round(start * 10)}-${text.length}`, text, x: 0.5, y, size, color, font: 'display', align: 'center', bold: true, box: true, glow: false, start, end,
});

const G = (name, layers, { mode = '2d', view, duration = 16, bpm = 100, hook, title, desc, tags, texts = [], hideUntil = 0, sequence = false, past = 'ghost', audio = {}, visual = {}, camera = {}, category = 'Formulas · Sound of a graph', formulas = true } = {}) => ({
  name, mode, $category: category,
  transport: { duration, bpm },
  view,
  sequence: { enabled: sequence, past },
  layers: layers.map((l, i) => ({ name: l.name || `Curve ${i + 1}`, wave: 'triangle', volume: 1, width: 5, samples: 1600, color: COLORS[i % COLORS.length], color2: COLORS[(i + 1) % COLORS.length], colorMode: 'gradient', ...l })),
  visual: { aspect: '9:16', drawMode: 'trace', hideUntil, marker: { shape: 'circle', size: 30 }, trail: { count: 220 }, ...visual },
  camera,
  audio: { master: 0.95, scale: 'continuous', glide: 35, noteLow: 45, noteHigh: 84, articulation: 'legato', reverb: { mix: 0.3, decay: 3 }, delay: { mix: 0.12 }, ...audio },
  overlay: { layout: 4, name: { enabled: false }, formulas: { enabled: formulas, x: 0.06, y: 0.15, size: 1.3 }, texts },
  hook: { text: hook },
  youtube: { title: `${title} #shorts`, description: `${desc}\n\n#math #mathanimation #shorts`, tags },
});

const par = (x, y, max = 2 * Math.PI, more = {}) => ({ type: 'parametric', exprs: { x, y, z: '0' }, range: { min: 0, max }, ...more });
const polar = (r, max = 2 * Math.PI, more = {}) => ({ type: 'polar', exprs: { r }, range: { min: 0, max }, ...more });
const fn = (y, more = {}) => ({ type: 'function', exprs: { y }, ...more });

const SQUARE = { xMin: -3.2, xMax: 3.2, yMin: -5.7, yMax: 5.7 }; // equal scale on both axes in 9:16
const HEART = par('2.6 sin(s)^3', '0.17 (13cos(s) - 5cos(2s) - 2cos(3s) - cos(4s)) + 0.4');
const BUTTERFLY = par('0.62 sin(s) (exp(cos(s)) - 2cos(4s) - sin(s/12)^5)', '0.62 cos(s) (exp(cos(s)) - 2cos(4s) - sin(s/12)^5) + 0.6', 12 * Math.PI, { samples: 4000 });
const INFINITY = par('2.8 cos(s) / (1 + sin(s)^2)', '2.8 sin(s) cos(s) / (1 + sin(s)^2)');
const STAR = par('2.8 cos(s)^3', '2.8 sin(s)^3');
const SPIRAL = polar('0.15 theta', 6 * Math.PI, { samples: 2400 });
const SOUND_TAGS = 'sound of math, what math sounds like, graph sound, math animation, math visualization, math music, sonification, shorts';
const QUIZ_TAGS = 'guess the shape, math quiz, sound of math, graph sound, math animation, math puzzle, shorts';

export const SOUND_PRESETS = [
  /* ----------------------------------------------------------- sound of a graph */
  G('What Does a Heart Sound Like?', [{ ...HEART, name: 'Heart', color: '#ff3d9a', color2: '#ff7ab8' }], {
    view: SQUARE, duration: 12, visual: { marker: { shape: 'diamond', size: 28 } },
    hook: 'What does a heart sound like?', title: 'What does a heart ❤️ sound like? (math)', desc: 'x = 16 sin³ t, y = 13 cos t − 5 cos 2t − 2 cos 3t − cos 4t: the heart curve. Its height is the pitch, so you hear the shape as it is drawn.', tags: SOUND_TAGS,
    texts: [T('Comment what it sounds like 👇', 10, 0, { y: 0.7 })],
  }),
  G('What Does a Butterfly Sound Like?', [{ ...BUTTERFLY, name: 'Butterfly', colorMode: 'rainbow' }], {
    view: { xMin: -3.2, xMax: 3.2, yMin: -4.8, yMax: 6.6 }, duration: 20,
    hook: 'What does a butterfly sound like?', title: 'What does the butterfly curve 🦋 sound like?', desc: 'The butterfly curve by Temple Fay, drawn and played: the higher the pen, the higher the note.', tags: SOUND_TAGS,
  }),
  G('What Does Infinity Sound Like?', [{ ...INFINITY, name: 'Infinity', color: '#8cff5a', color2: '#22e4ff' }], {
    view: SQUARE, duration: 12, audio: { glide: 60 },
    hook: 'What does ∞ sound like?', title: 'What does infinity ∞ sound like?', desc: 'The lemniscate, the infinity sign as a formula, played as it is drawn. It rises, falls, and comes back forever.', tags: SOUND_TAGS,
  }),
  G('What Does a Spiral Sound Like?', [{ ...SPIRAL, name: 'Spiral', colorMode: 'rainbow' }], {
    view: SQUARE, duration: 16,
    hook: 'What does a spiral sound like?', title: 'What does a spiral 🌀 sound like?', desc: 'r = 0.15·θ: the further it turns, the further out it goes, so its wobble in pitch gets wider and wider.', tags: SOUND_TAGS,
  }),
  G('What Does a Rose Sound Like?', [{ ...polar('2.8 cos(4theta)'), name: 'Rose', color: '#ff3d9a', color2: '#ffd23d' }], {
    view: SQUARE, duration: 14, visual: { marker: { shape: 'star', size: 26 } },
    hook: 'What does a flower sound like?', title: 'What does a math rose 🌹 sound like?', desc: 'r = cos 4θ draws a rose with 8 petals. Each petal is a rise and fall in pitch.', tags: SOUND_TAGS,
  }),
  G('What Does the Golden Spiral Sound Like?', [{ ...polar('0.08 phi^(2theta/pi)', 4 * Math.PI, { samples: 2400 }), name: 'Golden spiral', color: '#ffd23d', color2: '#ff9d3d' }], {
    view: { xMin: -4.6, xMax: 4.6, yMin: -8.2, yMax: 8.2 }, duration: 16,
    hook: 'What does the golden ratio sound like?', title: 'What does the golden spiral sound like? 🐚', desc: 'r = φ^(2θ/π): every quarter turn the spiral grows by the golden ratio φ = 1.618…', tags: `${SOUND_TAGS}, golden ratio`,
  }),
  G('sin vs cos vs tan', [fn('3 sin(x)', { name: 'sin' }), fn('3 cos(x)', { name: 'cos' }), fn('clamp(tan(x), -4, 4)', { name: 'tan', samples: 3000 })], {
    view: { xMin: 0, xMax: 6.3, yMin: -5, yMax: 5 }, duration: 21, sequence: true,
    hook: 'Which trig function sounds best?', title: 'sin vs cos vs tan: which sounds best? 🎧', desc: 'Three trig functions, played one after another. sin and cos sound the same, just shifted. tan shoots off to infinity. Which one did you like?', tags: `${SOUND_TAGS}, trigonometry, sin cos tan`,
    texts: [T('sin x', 0, 7, { y: 0.7 }), T('cos x', 7, 14, { y: 0.7 }), T('tan x', 14, 19), T('Which one? Comment 👇', 19, 0)],
  }),
  G('Which Curve Sounds Scariest?', [fn('x^2 - 4', { name: 'x²' }), fn('x^3/3', { name: 'x³' }), fn('2 sqrt(x + 3) - 3', { name: '√x', samples: 2000 })], {
    view: { xMin: -3, xMax: 3, yMin: -5, yMax: 5 }, duration: 18, sequence: true, audio: { glide: 15, scale: 'chromatic' },
    hook: 'Which graph sounds the scariest?', title: 'x², x³ or √x: which graph sounds scariest? 😱', desc: 'A parabola, a cubic and a square root, played one after another. Which one is the soundtrack of a horror movie?', tags: SOUND_TAGS,
    texts: [T('x²', 0, 6), T('x³', 6, 12), T('√x', 12, 16), T('Scariest? Comment 👇', 16, 0)],
  }),
  G('The Sound of eˣ and ln x', [fn('0.08 exp(x) - 4', { name: 'eˣ' }), fn('1.4 ln(x + 0.02) - 0.5', { name: 'ln x', samples: 3000 })], {
    view: { xMin: 0, xMax: 6, yMin: -6, yMax: 6 }, duration: 16, sequence: true,
    hook: 'Explosion or calm: can you hear the difference?', title: 'eˣ vs ln x: hear exponential growth 📈', desc: 'eˣ grows faster and faster: the pitch shoots up. ln x grows slower and slower: the pitch settles down. They are mirror images of each other.', tags: `${SOUND_TAGS}, exponential, logarithm`,
    texts: [T('eˣ', 0, 8), T('ln x', 8, 0)],
  }),

  /* -------------------------------------------------------------- guess the shape */
  G('Guess the Shape: Heart', [{ ...HEART, name: 'Mystery shape', color: '#ff3d9a', color2: '#ff7ab8' }], {
    view: SQUARE, duration: 15, hideUntil: 8, category: 'Formulas · Guess & compare',
    hook: 'Guess the shape from the sound', title: 'Guess the shape from its sound 🎧 (math quiz)', desc: 'Listen first: the height of a hidden curve sets the pitch. Can you guess the shape before it appears? Comment the second you got it.', tags: QUIZ_TAGS,
    texts: [T('Guess the shape 🎧', 0, 8, { y: 0.45, size: 0.8 }), T('A heart! Did you get it?', 8.2, 13), T('Comment your guess 👇', 13, 0)],
  }),
  G('Guess the Shape: Butterfly', [{ ...BUTTERFLY, name: 'Mystery shape', colorMode: 'rainbow' }], {
    view: { xMin: -3.2, xMax: 3.2, yMin: -4.8, yMax: 6.6 }, duration: 22, hideUntil: 11, category: 'Formulas · Guess & compare',
    hook: 'This one is hard: guess the shape', title: 'Only 1% guess this shape from its sound 🎧', desc: 'A hidden curve plays its own sound. It is an animal. Can you guess which one before the reveal?', tags: QUIZ_TAGS,
    texts: [T('Guess the animal 🎧', 0, 11, { y: 0.45, size: 0.8 }), T('A butterfly! 🦋', 11.2, 19), T('Did you get it? 👇', 19, 0)],
  }),
  G('Guess the Shape: Star', [{ ...STAR, name: 'Mystery shape', color: '#ffd23d', color2: '#ff9d3d' }], {
    view: SQUARE, duration: 14, hideUntil: 7, category: 'Formulas · Guess & compare', audio: { glide: 10 },
    hook: 'Guess the shape from the sound', title: 'Guess this shape from its sound ⭐', desc: 'x = cos³ t, y = sin³ t. Four sharp corners, four sudden turns in pitch. What shape is it?', tags: QUIZ_TAGS,
    texts: [T('Guess the shape 🎧', 0, 7, { y: 0.45, size: 0.8 }), T('A star (astroid)!', 7.2, 12), T('Got it? 👇', 12, 0)],
  }),
  G('Guess the Shape: Infinity', [{ ...INFINITY, name: 'Mystery shape', color: '#8cff5a', color2: '#22e4ff' }], {
    view: SQUARE, duration: 14, hideUntil: 7, category: 'Formulas · Guess & compare', audio: { glide: 60 },
    hook: 'Guess the shape from the sound', title: 'Can you hear this shape? 🎧', desc: 'A hidden curve: up, down, up, down, and back where it started. Guess the shape before it appears!', tags: QUIZ_TAGS,
    texts: [T('Guess the shape 🎧', 0, 7, { y: 0.45, size: 0.8 }), T('Infinity ∞!', 7.2, 12), T('Got it? 👇', 12, 0)],
  }),

  /* ------------------------------------------------------------------------ A or B */
  G('A or B: Smooth or Sharp?', [fn('3 sin(2x)', { name: 'A', wave: 'sine' }), fn('3 tri(x/1.6) ', { name: 'B', wave: 'square', volume: 0.6 })], {
    view: { xMin: 0, xMax: 6.3, yMin: -5, yMax: 5 }, duration: 16, sequence: true, category: 'Formulas · Guess & compare', audio: { scale: 'pentatonic', articulation: 'pluck' },
    hook: 'A or B: which sounds better?', title: 'A or B: which wave sounds better? 🅰️🅱️', desc: 'A: a smooth sine wave. B: a sharp zig-zag played with a square tone. Same height, very different sound. Comment A or B!', tags: `${SOUND_TAGS}, a or b, which is better`,
    texts: [T('A', 0, 7, { y: 0.7, size: 1.2 }), T('B', 7, 14, { y: 0.7, size: 1.2 }), T('A or B? Comment 👇', 14, 0)],
  }),
  G('A or B: Heart or Butterfly?', [{ ...HEART, name: 'A', color: '#ff3d9a', color2: '#ff7ab8' }, { ...BUTTERFLY, name: 'B', colorMode: 'rainbow' }], {
    view: { xMin: -3.2, xMax: 3.2, yMin: -4.8, yMax: 6.6 }, duration: 22, sequence: true, past: 'hide', category: 'Formulas · Guess & compare',
    hook: 'Which shape sounds better?', title: 'Heart or butterfly: which sounds better? ❤️🦋', desc: 'Two famous curves, played by their own shape. A: the heart. B: the butterfly. Vote in the comments!', tags: `${SOUND_TAGS}, a or b`,
    texts: [T('A ❤️', 0, 10, { y: 0.72, size: 0.9 }), T('B 🦋', 10, 20, { y: 0.72, size: 0.9 }), T('A or B? 👇', 20, 0)],
  }),
];
