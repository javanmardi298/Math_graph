/**
 * Lesson packs: step-by-step vertical lessons, one pack per shelf. A pack's presets are
 * loaded only when it is opened or added (dynamic import), so packs can grow without
 * making the app heavier. Each pack is also written as an importable file
 * (packs/<id>.mmv.json) by scripts/build-pack.mjs.
 */
export const PACKS = [
  { id: 'waves-stories', name: 'Waves & sound: stories', about: 'Longer lessons that walk through one idea with several simulations', load: () => import('./waves.js').then((m) => m.STORIES) },
  { id: 'waves', name: 'Waves & sound', about: 'Standing waves, wavelength, Fourier, beats, intervals, Doppler', load: () => import('./waves.js').then((m) => m.WAVES) },
  { id: 'vibration', name: 'Vibration & fields', about: 'Chladni plates, Kundt’s tubes, interference, magnetic fields', load: () => import('./waves.js').then((m) => m.VIBRATION) },
  { id: 'formulas-2d', name: 'Formulas 2D', about: 'Amplitude, frequency, phase, slopes, parabolas, polar and parametric curves', load: () => import('./formulas.js').then((m) => m.FORMULAS_2D) },
  { id: 'formulas-3d', name: 'Formulas 3D', about: 'Helix, surfaces, bowls and bells, knots, 3D Lissajous', load: () => import('./formulas.js').then((m) => m.FORMULAS_3D) },
  { id: 'fourier-calculus', name: 'Fourier & calculus', about: 'Fourier drawing, derivative, integral, Taylor series, unit circle', load: () => import('./topics.js').then((m) => m.FOURIER_CALC) },
  { id: 'pi', name: 'Pi', about: 'Archimedes, random dots, Buffon’s needle, series, the digits of π', load: () => import('./topics.js').then((m) => m.PI_LESSONS) },
  { id: 'fractals', name: 'Fractals', about: 'Mandelbrot zoom, Julia sets, Koch, dragon and Hilbert curves', load: () => import('./topics.js').then((m) => m.FRACTAL_LESSONS) },
  { id: 'classic', name: 'Circle: classic', about: 'Jumps, gravity, doubling, growing, escaping, polyrhythm', load: () => import('./circle-basics.js').then((m) => m.CLASSIC) },
  { id: 'multiply', name: 'Circle: multiply & split', about: 'Powers, +1 vs ×2, shattering, chain reactions, cells', load: () => import('./circle-basics.js').then((m) => m.MULTIPLY) },
  { id: 'fill', name: 'Circle: fill the screen', about: 'Bell curve, cascades, beat fill, pachinko, paper cuts, packing', load: () => import('./circle-basics.js').then((m) => m.FILL) },
  { id: 'bounce', name: 'Circle: bounce & draw', about: 'Polygons, shrinking arena, billiard angles', load: () => import('./circle-basics.js').then((m) => m.BOUNCE) },
  { id: 'growth', name: 'Circle: battles & growth', about: 'Colour war, jamming, coral, snowflakes', load: () => import('./circle-patterns.js').then((m) => m.GROWTH) },
  { id: 'patterns', name: 'Circle: patterns & rhythm', about: 'Radar, chaos game, golden angle, pendulums, DNA, sorting, polyrhythm', load: () => import('./circle-patterns.js').then((m) => m.PATTERNS) },
  { id: 'machines', name: 'Circle: drawing machines', about: 'Harmonograph, planet dance, fractal tree, times tables, spirograph', load: () => import('./circle-patterns.js').then((m) => m.MACHINES) },
  { id: 'battles', name: 'Circle: battles & formulas', about: 'Rock paper scissors, predator & prey, blades, knives, formula spike', load: () => import('./circle-patterns.js').then((m) => m.BATTLES) },
];

export const packById = (id) => PACKS.find((p) => p.id === id);
/** The collection a pack's presets go into in "My presets". */
export const collectionOf = (pack) => `Lessons · ${pack.name}`;
