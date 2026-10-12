/**
 * Remix engine: new presets from existing ones, without an AI model. A remix keeps
 * what makes a preset work (its format, timing, safe-area layout, sound design) and
 * changes what the viewer sees as "new": the subject (which shape, curve, flag, word,
 * fractal spot, function …), the colours, the instrument and a little of the numbers.
 * Titles, hooks, descriptions, tags and a pinned comment are written from templates
 * that fit the format (sound of a graph, guess the shape, A or B, Fourier, π …).
 *
 * Everything is a pure function of (preset, seed), so the same day always gets the
 * same remix, and a "🎲 another one" is just a new seed.
 */

/** Small, fast, seedable random numbers. */
export function rng(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hash(String(seed));
  const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.pick = (list) => list[Math.floor(r() * list.length)];
  r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  r.range = (lo, hi) => lo + r() * (hi - lo);
  r.shuffle = (list) => { const l = [...list]; for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return l; };
  return r;
}
export function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

const clone = (x) => JSON.parse(JSON.stringify(x));
const PALETTES = ['neon', 'rainbow', 'sunset', 'gold', 'aurora', 'candy', 'ocean', 'fire', 'pastel', 'matrix', 'mono'];
const INSTRUMENTS = ['kalimba', 'marimba', 'harp', 'e-piano', 'bell', 'music-box', 'glass-pad', 'synth-pluck', 'vibrato-lead', 'flute-synth', 'space-arp', 'chiptune'];
const SCALES = ['minorPentatonic', 'pentatonic', 'major', 'dorian', 'minor'];

/* ------------------------------------------------------------- the formats */

/** What kind of Short a preset is (drives titles, comments and the daily mix). */
export function formatOf(p, shelf = '') {
  const rule = p.circle?.rule;
  if (shelf === 'sound-quiz' || /^Guess/.test(p.name)) return /^A or B/.test(p.name) ? 'ab' : 'quiz';
  if (/^A or B/.test(p.name)) return 'ab';
  if (shelf === 'sound-graph') return 'sound';
  if (p.circle?.layers?.length) return 'story';
  if (rule === 'fdraw') return p.circle.lab?.fdraw?.flag && p.circle.lab.fdraw.flag !== 'none' ? 'flag' : p.circle.lab?.fdraw?.shape === 'text' ? 'name' : 'fourier';
  if (['archimedes', 'montecarlo', 'buffon', 'series', 'pidigits'].includes(rule)) return 'pi';
  if (['tangent', 'riemann', 'taylor', 'unitcircle'].includes(rule)) return 'calculus';
  if (['mandel', 'lsystem'].includes(rule)) return 'fractal';
  if (['chladni', 'tubes', 'ripple', 'filings', 'string', 'travel', 'fourier', 'beats', 'scope', 'doppler'].includes(rule)) return 'physics';
  if (p.mode !== 'circle') return 'formula';
  return 'satisfying';
}

/** Comments are the weakest number on a new channel: every format gets a question to pin. */
export const PINNED = {
  sound: ['What does it remind you of? 👇', 'Which curve should I play next?', 'Close your eyes: could you guess the shape?'],
  quiz: ['At which second did you guess it? 👇', 'What did you guess first? 🤔', 'Too easy or too hard? Next one is harder.'],
  ab: ['Team A or Team B? 👇', 'A or B, and why?', 'Vote: A or B! Next round tomorrow.'],
  fourier: ['What should the circles draw next? 👇', 'How many circles did you think it needed?', 'Comment a shape, I’ll draw the best one.'],
  name: ['Comment your name, I’ll draw it with circles ✍️', 'Which word should the circles write next?'],
  flag: ['Which flag should be next? 👇', 'Which flag do you think is the hardest?'],
  pi: ['How many digits of π do you know? 👇', 'Which method is your favourite?', 'Did you know π could be found this way?'],
  calculus: ['Did this make it click? 👇', 'Which topic should I animate next?', 'Was this easier than in class?'],
  fractal: ['How deep should I zoom next time? 👇', 'Which colours look best?', 'Pause at any frame: what do you see?'],
  physics: ['Have you seen this in real life? 👇', 'Which experiment should I do next?'],
  satisfying: ['Did you watch it twice? 👀', 'Which rule should I try next? 👇', 'Guess the final count before the end!'],
  story: ['Which part was your favourite? 👇', 'Top or bottom? 👇'],
  formula: ['Which formula should I draw next? 👇', 'Could you hear the shape?'],
};

const HASHTAGS = {
  sound: '#math #sound #mathanimation', quiz: '#mathquiz #puzzle #math', ab: '#math #sound #aorb', fourier: '#fourier #mathanimation #math', name: '#fourier #mathanimation #name',
  flag: '#flags #fourier #mathanimation', pi: '#pi #math #mathanimation', calculus: '#calculus #math #learnmath', fractal: '#fractal #fractalzoom #mathart',
  physics: '#physics #science #satisfying', satisfying: '#satisfying #simulation #oddlysatisfying', story: '#math #satisfying #simulation', formula: '#math #mathanimation #graph',
};
const TAGS = {
  sound: 'sound of math, what math sounds like, graph sound, math animation, math visualization, sonification',
  quiz: 'guess the shape, math quiz, sound of math, math puzzle, math animation', ab: 'a or b, which sounds better, sound of math, math animation',
  fourier: 'fourier animation, fourier series, epicycles, math animation, math visualization', name: 'fourier animation, your name, epicycles, name art, math animation',
  flag: 'flags drawn by math, flags, fourier animation, epicycles, math animation', pi: 'pi animation, pi, math animation, math visualization',
  calculus: 'calculus, math animation, learn math, math visualization', fractal: 'fractal zoom, fractals, mandelbrot, math art, generative art',
  physics: 'physics, science, satisfying, simulation, cymatics', satisfying: 'satisfying, simulation, oddly satisfying, asmr, generative art', story: 'math animation, satisfying, simulation',
  formula: 'math animation, graph, math visualization, sound of math',
};

/* ---------------------------------------------------------------- subjects */

/** Curves for "sound of a graph", "guess the shape" and "A or B" (2D, 9:16, equal scale). */
export const CURVES = [
  { name: 'heart', emoji: '❤️', type: 'parametric', exprs: { x: '2.6 sin(s)^3', y: '0.17 (13cos(s) - 5cos(2s) - 2cos(3s) - cos(4s)) + 0.4' }, max: 6.283185307179586 },
  { name: 'butterfly', emoji: '🦋', type: 'parametric', exprs: { x: '0.62 sin(s) (exp(cos(s)) - 2cos(4s) - sin(s/12)^5)', y: '0.62 cos(s) (exp(cos(s)) - 2cos(4s) - sin(s/12)^5) + 0.6' }, max: 37.69911184307752, samples: 4000 },
  { name: 'infinity sign', emoji: '♾️', type: 'parametric', exprs: { x: '2.8 cos(s) / (1 + sin(s)^2)', y: '2.8 sin(s) cos(s) / (1 + sin(s)^2)' }, max: 6.283185307179586 },
  { name: 'star', emoji: '⭐', type: 'parametric', exprs: { x: '2.8 cos(s)^3', y: '2.8 sin(s)^3' }, max: 6.283185307179586 },
  { name: 'spiral', emoji: '🌀', type: 'polar', exprs: { r: '0.15 theta' }, max: 18.84955592153876, samples: 2400 },
  { name: 'golden spiral', emoji: '🐚', type: 'polar', exprs: { r: '0.08 phi^(2theta/pi)' }, max: 12.566370614359172, samples: 2400 },
  { name: 'flower', emoji: '🌸', type: 'polar', exprs: { r: '2.8 cos(4theta)' }, max: 6.283185307179586 },
  { name: 'three-leaf clover', emoji: '☘️', type: 'polar', exprs: { r: '2.8 cos(3theta)' }, max: 6.283185307179586 },
  { name: 'cardioid', emoji: '🫀', type: 'polar', exprs: { r: '1.4 (1 + cos(theta))' }, max: 6.283185307179586 },
  { name: 'figure eight', emoji: '8️⃣', type: 'parametric', exprs: { x: '2.4 sin(s)', y: '2.4 sin(s) cos(s)' }, max: 6.283185307179586 },
  { name: 'pretzel', emoji: '🥨', type: 'parametric', exprs: { x: '2.6 sin(3s)', y: '3.6 sin(2s)' }, max: 6.283185307179586 },
  { name: 'gear', emoji: '⚙️', type: 'polar', exprs: { r: '2.2 + 0.4 tanh(4 sin(10theta))' }, max: 6.283185307179586 },
  { name: 'crown', emoji: '👑', type: 'polar', exprs: { r: '2 + 0.8 abs(sin(2.5theta))' }, max: 6.283185307179586 },
  { name: 'egg', emoji: '🥚', type: 'parametric', exprs: { x: '2 cos(s)', y: '2.8 sin(s) (1 + 0.15 cos(s))' }, max: 6.283185307179586 },
];

/** What Fourier circles can draw. */
const FD_SHAPES = [['cat', 'a cat', '🐱'], ['pi', 'π', '🥧'], ['heart', 'a heart', '❤️'], ['note', 'a music note', '🎵'], ['star', 'a star', '⭐'], ['butterfly', 'a butterfly', '🦋'], ['infinity', 'infinity', '♾️'], ['flower', 'a flower', '🌸'], ['batman', 'the Batman logo', '🦇']];
const FD_FLAGS = [['japan', 'Japan', '🇯🇵'], ['canada', 'Canada', '🇨🇦'], ['switzerland', 'Switzerland', '🇨🇭'], ['turkey', 'Türkiye', '🇹🇷'], ['vietnam', 'Vietnam', '🇻🇳']];
/** Circles each flag needs, round by round (a maple leaf needs far more than a disc). */
const FLAG_ROUNDS = { japan: '1 2 4', canada: '6 25 100 400', switzerland: '2 6 20 80', turkey: '5 20 80 300', vietnam: '2 5 15 60' };
const WORDS = ['MATH', 'PI', 'HELLO', 'LOVE', 'WOW', 'GENIUS', 'E = MC2', 'I ♥ PI', 'FOURIER', 'MATH ♥', '2026', 'NICE', 'SCIENCE', 'WAVES'];

const SPOTS = [['seahorse', 'seahorse valley'], ['spiral', 'a spiral'], ['lightning', 'the lightning branch'], ['needle', 'a tiny copy of itself']];
const CURVES_L = [['koch', 'Koch snowflake', '❄️'], ['dragon', 'Dragon curve', '🐉'], ['hilbert', 'Hilbert curve', '🟩'], ['arrowhead', 'Sierpiński arrowhead', '🔺'], ['gosper', 'Gosper curve', '🌊'], ['levy', 'Lévy C curve', '🌀']];
const TANGENT_F = [['sin(x) + 0.3*x', 'sin x + 0.3x'], ['x^3/6 - x', 'x³/6 − x'], ['0.4*x^2 - 2', 'a parabola'], ['2*cos(1.5*x)', '2 cos 1.5x'], ['3*exp(-x^2/2) - 1', 'the bell curve'], ['x*sin(x)/2', 'x sin x']];
const TAYLOR_F = [['sin', 'sin x'], ['cos', 'cos x'], ['exp', 'eˣ'], ['atan', 'arctan x'], ['ln', 'ln(1 + x)']];

/* ------------------------------------------------------------------ remix */

const T = (text, start, end = 0, { y = 0.7, size = 0.62 } = {}) => ({ id: `t${Math.round(start * 10)}-${text.length}`, text, x: 0.5, y, size, color: '#ffffff', font: 'display', align: 'center', bold: true, box: true, glow: false, start, end });
const layerOf = (c, extra = {}) => ({ name: extra.name || c.name, type: c.type, exprs: c.type === 'polar' ? { ...c.exprs } : { z: '0', ...c.exprs }, range: { min: 0, max: c.max }, samples: c.samples || 1600, wave: 'triangle', volume: 1, width: 5, colorMode: 'gradient', ...extra });
const SQUARE = { xMin: -3.2, xMax: 3.2, yMin: -5.7, yMax: 5.7 };

/** A fresh 2D "sound of a graph" / quiz / A-or-B preset from the curve bank. */
function formulaShort(kind, r, c1, c2) {
  const colors = r.shuffle(['#22e4ff', '#ff3d9a', '#ffd23d', '#8cff5a', '#b18cff', '#ff9d3d']);
  const base = {
    mode: '2d', transport: { duration: kind === 'ab' ? 20 : kind === 'quiz' ? 15 : 14, bpm: 100 }, view: SQUARE,
    visual: { aspect: '9:16', drawMode: 'trace', marker: { shape: r.pick(['circle', 'star', 'diamond']), size: 28 }, trail: { count: 220 }, hideUntil: 0 },
    audio: { master: 0.95, scale: kind === 'ab' ? r.pick(['continuous', 'pentatonic']) : 'continuous', glide: r.int(20, 60), noteLow: 45, noteHigh: 84, articulation: 'legato', reverb: { mix: 0.3, decay: 3 }, delay: { mix: 0.12 } },
    overlay: { layout: 4, name: { enabled: false }, formulas: { enabled: true, x: 0.06, y: 0.15, size: 1.3 }, texts: [] },
  };
  if (kind === 'sound') {
    return { ...base, name: `What Does a ${cap(c1.name)} Sound Like?`, layers: [layerOf(c1, { color: colors[0], color2: colors[1] })], overlay: { ...base.overlay, texts: [T('Comment what it sounds like 👇', base.transport.duration - 3)] } };
  }
  if (kind === 'quiz') {
    const hide = 8;
    return { ...base, name: `Guess the Shape: ${cap(c1.name)}`, layers: [layerOf(c1, { name: 'Mystery shape', color: colors[0], color2: colors[1] })], visual: { ...base.visual, hideUntil: hide },
      overlay: { ...base.overlay, texts: [T('Guess the shape 🎧', 0, hide, { y: 0.45, size: 0.8 }), T(`${cap(c1.name)} ${c1.emoji}! Did you get it?`, hide + 0.2, 13), T('Comment your guess 👇', 13)] } };
  }
  return { ...base, name: `A or B: ${cap(c1.name)} or ${cap(c2.name)}?`, sequence: { enabled: true, past: 'hide' },
    layers: [layerOf(c1, { name: 'A', color: colors[0], color2: colors[1] }), layerOf(c2, { name: 'B', color: colors[2], color2: colors[3] })],
    overlay: { ...base.overlay, texts: [T(`A ${c1.emoji}`, 0, 9, { y: 0.72, size: 0.9 }), T(`B ${c2.emoji}`, 9, 18, { y: 0.72, size: 0.9 }), T('A or B? 👇', 18)] } };
}
const cap = (s) => s.replace(/(^|\s)\S/g, (m) => m.toUpperCase());

/** Jitter a number by ±f (keeps integers integer, never flips the sign). */
const jitter = (r, v, f = 0.12) => (Number.isInteger(v) ? Math.max(v > 0 ? 1 : v, Math.round(v * (1 + r.range(-f, f)))) : +(v * (1 + r.range(-f, f))).toFixed(4));

/**
 * Remix a preset. Returns { preset, subject, format }: the new preset (partial state),
 * a short subject ("a cat", "seahorse valley" …, used in titles and to avoid repeats)
 * and its format.
 * @param {object} p source preset (partial state, as in the catalog)
 * @param {number|string} seed
 * @param {{shelf?:string, keepSubject?:boolean}} [o]
 */
export function remix(p, seed, { shelf = '', keepSubject = false } = {}) {
  const r = rng(seed);
  const format = formatOf(p, shelf);
  let q = clone(p);
  let subject = '';
  delete q.$category; delete q.$shelf;

  // formula Shorts: a new curve from the bank
  if (['sound', 'quiz', 'ab'].includes(format) && !keepSubject) {
    const [c1, c2] = r.shuffle(CURVES);
    q = formulaShort(format, r, c1, c2);
    subject = format === 'ab' ? `${c1.name} vs ${c2.name}` : c1.name;
  } else if (p.mode === 'circle' && !p.circle.layers?.length) {
    const rule = q.circle.rule, lab = (q.circle.lab ||= {})[rule] ||= {};
    if (!keepSubject) subject = remixSubject(rule, lab, r, format);
    // colours and sound
    q.circle.look = { ...(q.circle.look || {}), palette: format === 'flag' ? 'mono' : r.pick(PALETTES) };
    q.circle.sound = { ...(q.circle.sound || {}), instrument: r.pick(INSTRUMENTS) };
    q.circle.seed = r.int(1, 9999);
  } else if (p.mode === 'circle') {
    // stories: new colours for every step, same script
    for (const l of [q.circle, ...(q.circle.layers || []).map((x) => x.cfg)]) { l.look = { ...(l.look || {}), palette: r.pick(PALETTES) }; l.seed = r.int(1, 9999); }
  } else {
    // other formula presets: new colours, a small change of tempo/scale
    q.layers = (q.layers || []).map((l) => ({ ...l, color: r.pick(['#22e4ff', '#ff3d9a', '#ffd23d', '#8cff5a', '#b18cff']) }));
  }
  if (q.transport?.bpm) q.transport.bpm = jitter(r, q.transport.bpm, 0.06);
  if (q.audio && format !== 'sound' && format !== 'quiz' && format !== 'ab' && q.audio.scale && q.audio.scale !== 'continuous') q.audio = { ...q.audio, scale: r.pick(SCALES), root: r.int(0, 11) };
  q.youtube = youtubeFor(q, format, subject, r, p);
  q.hook = { text: q.hook?.text && keepSubject ? q.hook.text : hookFor(format, subject, r, p) };
  if (!subject) subject = p.name;
  q.name = nameFor(q, p, format, subject);
  return { preset: q, subject, format };
}

/** Change what the scene shows; returns the subject as words. */
function remixSubject(rule, lab, r, format) {
  if (rule === 'fdraw') {
    if (format === 'flag') { const [id, name] = r.pick(FD_FLAGS); lab.flag = id; lab.rounds = FLAG_ROUNDS[id]; return `the flag of ${name}`; }
    if (format === 'name') { const w = r.pick(WORDS); lab.shape = 'text'; lab.text = w; return `“${w}”`; }
    const [id, name] = r.pick(FD_SHAPES); lab.shape = id; lab.flag = 'none';
    const top = r.pick([150, 250, 300, 400]);
    lab.rounds = [r.int(2, 4), r.int(8, 15), r.int(30, 60), top].join(' ');
    return name;
  }
  if (rule === 'mandel') {
    if (r() < 0.3) { lab.set = 'julia'; lab.juliaR = +r.range(0.7, 0.8).toFixed(4); lab.colors = r.pick(['ocean', 'neon', 'gold', 'rainbow']); return 'a Julia set'; }
    const [id, name] = r.pick(SPOTS.slice(0, 3)); lab.set = 'mandelbrot'; lab.spot = id; lab.depth = r.int(6, 8); lab.colors = r.pick(['fire', 'ocean', 'neon', 'gold', 'rainbow']); return name;
  }
  if (rule === 'lsystem') { const [id, name] = r.pick(CURVES_L); lab.curve = id; lab.steps = { koch: '0 1 2 3 4 5', dragon: '1 3 5 7 9 11 13', hilbert: '1 2 3 4 5 6', arrowhead: '1 2 3 4 5 6 7', gosper: '0 1 2 3 4', levy: '1 3 5 7 9 11 13' }[id]; return name; }
  if (rule === 'tangent') { const [f, name] = r.pick(TANGENT_F); lab.f = f; return name; }
  if (rule === 'riemann') { const [f, name] = r.pick(TANGENT_F); lab.f = `1.5 + 0.5*(${f})`; return `the area under ${name}`; }
  if (rule === 'taylor') { const [f, name] = r.pick(TAYLOR_F); lab.fn = f; return name; }
  if (rule === 'pidigits') { lab.mode = r.pick(['walk', 'chords', 'grid']); return { walk: 'a walk', chords: 'a circle of chords', grid: 'a grid of colours' }[lab.mode]; }
  if (rule === 'series') { lab.kind = r.pick(['leibniz', 'nilakantha', 'wallis']); return `the ${lab.kind[0].toUpperCase() + lab.kind.slice(1)} series`; }
  if (rule === 'chladni') { lab.plate = r.pick(['square', 'tall', 'circle']); lab.grain = r.pick(['sand', 'rice', 'glow']); return `a ${lab.plate === 'tall' ? 'tall' : lab.plate === 'circle' ? 'round' : 'square'} plate`; }
  if (rule === 'filings') { lab.setups = r.pick(['bar attract repel', 'wire wires coil', 'quad ring bar']); return 'magnetic fields'; }
  // everything else: nudge the numbers a little (same character, different run)
  for (const [k, v] of Object.entries(lab)) if (typeof v === 'number' && !/^(max|every|wait|count|terms|steps)$/.test(k)) lab[k] = jitter(r, v, 0.1);
  return '';
}

/* ------------------------------------------------------------------ words */

const TITLE = {
  sound: ['What does a {s} sound like? {e}', 'I turned a {s} into sound {e}', 'This is the sound of a {s} {e}', 'Can you hear a {s}? {e}'],
  quiz: ['Guess this shape from its sound 🎧', 'Only 1% can guess this shape by ear 🎧', 'Listen first: what shape is this? 🤔', 'Can you hear the shape? 🎧'],
  ab: ['A or B: which sounds better? 🅰️🅱️', '{s}: which sounds better?', 'Vote: A or B? 🎧'],
  fourier: ['Fourier animation: spinning circles draw {s} {e}', 'Can spinning circles draw {s}? {e}', 'How many circles to draw {s}? {e}'],
  name: ['Spinning circles write {s} ✍️', 'I wrote {s} with spinning circles ✍️'],
  flag: ['Drawing {s} with spinning circles {e}', 'Can circles draw {s}? {e}'],
  pi: ['Pi animation: finding π with {s} 🥧', 'π, shown as {s} 🥧', 'Can you find π like this? 🥧'],
  calculus: ['Calculus animation: {s} 📈', 'This is what {s} really means 📈'],
  fractal: ['Fractal zoom into {s} 🔥', 'Zooming forever into {s} 🌀', '{s}: one rule, infinite detail ❄️'],
};
const HOOK = {
  sound: ['What does a {s} sound like?', 'Close your eyes and listen'], quiz: ['Guess the shape from the sound', 'Listen first. Guess the shape.'],
  ab: ['A or B: which sounds better?', 'Pick one: A or B'], fourier: ['Can circles draw {s}?', 'Only spinning circles. Watch.'],
  name: ['Circles can even write', 'Watch circles write {s}'], flag: ['Which flag is this?', 'Can circles draw a flag?'],
  pi: ['Can you find π like this?', 'π, from {s}'], calculus: ['What is {s}, really?'], fractal: ['How deep does it go?', 'Zooming forever'],
};
/** Titles for remixes of formats without templates (satisfying, physics, stories …). */
const AGAIN = ['{s}', '{s} · part 2', 'Round 2: {s}', '{s} (new run)', 'Again, but different: {s}'];
const fill = (t, s, e = '') => t.replace('{s}', s).replace('{e}', e).replace(/\s+$/, '').trim();
const emojiOf = (s) => (CURVES.find((c) => c.name === s)?.emoji || FD_SHAPES.find((x) => x[1] === s)?.[2] || FD_FLAGS.find((x) => s.includes(x[1]))?.[2] || '');

function youtubeFor(q, format, subject, r, src) {
  const tpl = TITLE[format];
  const base = src.youtube || {};
  const plain = (base.title || q.name).replace(/\s*#shorts\s*$/i, '');
  // no template for this format (or nothing new to name): same title, marked as a new round
  let title = tpl && subject ? fill(r.pick(tpl), format === 'ab' ? cap(subject).replace(' Vs ', ' vs ') : subject, emojiOf(subject)) : fill(r.pick(AGAIN), plain);
  title = (title[0].toUpperCase() + title.slice(1)).slice(0, 88);
  const why = (base.description || '').split('\n\n')[0] || `${q.name}.`;
  const ask = r.pick(PINNED[format] || PINNED.satisfying);
  const description = `${why}\n\n${ask}\n\n${HASHTAGS[format] || '#math'} #shorts`;
  const tags = [...new Set(`${TAGS[format] || ''}, ${base.tags || ''}`.split(',').map((t) => t.trim()).filter(Boolean))].slice(0, 15).join(', ');
  return { title: `${title} #shorts`, description, tags };
}
function hookFor(format, subject, r, src) {
  const tpl = HOOK[format];
  return tpl && subject ? fill(r.pick(tpl), subject) : src.hook?.text || '';
}
function nameFor(q, src, format, subject) {
  if (['sound', 'quiz', 'ab'].includes(format)) return q.name;
  if (subject && subject !== src.name) return `${src.name} · ${subject.replace(/[“”]/g, '')}`;
  return `${src.name} · remix`;
}

/** The question to pin as the first comment. */
export const pinnedFor = (format, seed) => rng(`${seed}:pin`).pick(PINNED[format] || PINNED.satisfying);
