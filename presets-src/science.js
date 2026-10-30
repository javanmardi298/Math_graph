/**
 * Science presets: real mathematics and physics, each as a short film (an opening, a climax, a
 * final shot or a seamless loop that fits its shape). What the maths is about lives in `about`,
 * shown in the Presets panel, never on the video.
 *
 *   Chaos & attractors   Lorenz (and the butterfly effect), Rössler, Aizawa, Thomas, Chen, Sprott A,
 *                        Clifford and de Jong maps as breathing clouds, double pendulums, Burrau
 *   Shapes in 3D         Hopf fibration, Lissajous-toric knots, Möbius strip, Klein bottle, Dini,
 *                        catenoid ↔ helicoid, Enneper, orbitals
 *   Numbers              ζ(½ + it) and its zeros, prime spirals, times tables, the golden angle,
 *                        the Euler (Cornu) spiral
 *   Motion & sync        fireflies, Shepard scale, three bodies, pendulum wave, brachistochrone
 *
 * Plus four mood packs (psychedelic, satisfying, ASMR, minimal) and showcase films.
 */
import { hsl, hueOf } from './sound-maker.js';
import { chordLayer, R } from './cinematic.js';
import { filmTracks } from '../src/anim/film.js';

const TAU = Math.PI * 2;
const r3 = (v) => +v.toFixed(4);
const TAGS = 'math, science, chaos, math art, math animation, physics, satisfying, shorts';

/** Note range so that y = ya plays MIDI na and y = yb plays nb (pitch is linear in y over the window). */
function notes(view, [ya, na], [yb, nb]) {
  const k = (nb - na) / (yb - ya);
  return { noteLow: r3(na + (view.yMin - ya) * k), noteHigh: r3(na + (view.yMax - ya) * k) };
}

const SRC = {
  attractors: { label: 'Strange attractors (equations and parameters)', url: 'https://en.wikipedia.org/wiki/Lorenz_system' },
  thomas: { label: 'Thomas attractor', url: 'https://arxiv.org/html/2408.09525v1' },
  chen: { label: 'Chen system', url: 'https://pcabala.github.io/AttractorBuilder/en/systems/chen' },
  sprott: { label: 'Sprott, Some simple chaotic flows', url: 'https://sprott.physics.wisc.edu/pubs/paper212.htm' },
  clifford: { label: 'Clifford attractor', url: 'https://generative-art-site.pages.dev/attractors/clifford_attractor' },
  zeta: { label: 'Spirals of the zeta function', url: 'https://arxiv.org/pdf/2306.00460' },
  hopf: { label: 'Villarceau circles and the Hopf fibration', url: 'https://en.wikipedia.org/wiki/Villarceau_circles' },
  knots: { label: 'Lissajous-toric knots', url: 'https://arxiv.org/pdf/1610.04418' },
  catenoid: { label: 'Catenoid ↔ helicoid', url: 'https://en.wikipedia.org/wiki/Catenoid' },
  dini: { label: 'Dini’s surface (MathWorld)', url: 'https://mathworld.wolfram.com/DinisSurface.html' },
  enneper: { label: 'Enneper surface', url: 'https://virtualmathmuseum.org/Surface/enneper/enneper.html' },
  harmonics: { label: 'Table of spherical harmonics', url: 'https://en.wikipedia.org/wiki/Table_of_spherical_harmonics' },
  euler: { label: 'Euler spiral', url: 'https://en.wikipedia.org/wiki/Euler_spiral' },
  golden: { label: 'Golden angle', url: 'https://en.wikipedia.org/wiki/Golden_angle' },
  cardioid: { label: 'The heart of the Mandelbrot set', url: 'https://logosconcarne.com/2020/03/26/the-heart-of-the-mandelbrot/' },
  primes: { label: 'Spiralling primes', url: 'https://thatsmaths.com/2019/09/12/spiraling-primes/' },
  sacks: { label: 'Sacks spiral (Math::PlanePath)', url: 'https://metacpan.org/pod/Math::PlanePath::SacksSpiral' },
  kuramoto: { label: 'Kuramoto model (Strogatz, Brockmann)', url: 'https://complexity-explorables.org/explorables/ride-my-kuramotocycle' },
  shepard: { label: 'Shepard tone', url: 'https://en.wikipedia.org/wiki/Shepard_tone' },
  eight: { label: 'Chenciner & Montgomery, the figure-eight orbit', url: 'https://arxiv.org/pdf/math/0011268' },
  burrau: { label: 'The Pythagorean three-body problem', url: 'https://arxiv.org/pdf/1604.06673' },
  dpend: { label: 'Double pendulum (myphysicslab)', url: 'https://www.myphysicslab.com/pendulum/double-pendulum-en.html' },
  pwave: { label: 'Pendulum wave', url: 'https://en.wikipedia.org/wiki/Pendulum_wave' },
  brachisto: { label: 'Brachistochrone / tautochrone', url: 'https://www.mathwords.com/t/tautochrone.htm' },
  chladni: { label: 'Chladni figures', url: 'https://paulbourke.net/geometry/chladni/' },
};
const src = (...ids) => ids.map((i) => SRC[i]);

/* ------------------------------------------------------------- formula films */

/**
 * A 2D / 3D film. `ext` = half width of the window (3D: a cube), `yr` = [low, high] y of the
 * drawing for the note range, `loop` = 'off' | 'wrap' (closed curves) | 'fade' (open ones).
 */
function film(name, o) {
  if (o.mode === 'circle') return circleFilm({ name, $o: o });
  const D = o.D ?? 28, is3d = o.mode === '3d', ext = o.ext ?? 4, loop = o.loop || 'off', looping = loop !== 'off';
  const view = o.view || (is3d ? { xMin: -ext, xMax: ext, yMin: -ext, yMax: ext } : { xMin: -ext, xMax: ext, yMin: r3((-ext * 16) / 9), yMax: r3((ext * 16) / 9) });
  const H = hueOf(o.c1 || '#5ee0ff'), light = !!o.light;
  const endingSecs = o.endingSecs ?? 4.2;
  const [ylo, yhi] = o.yr || [-ext * 0.9, ext * 0.9];
  const audio = { master: 0.9, scale: o.scale || 'pentatonic', root: o.root ?? 0, ...notes(view, [ylo, (o.lo ?? 45) + (o.root ?? 0)], [yhi, (o.hi ?? 81) + (o.root ?? 0)]), glide: 30, articulation: o.articulation || 'pluck', reverb: R(o.reverb ?? 3.4, 0.38, 0.7), delay: { time: 0.375, feedback: 0.26, mix: 0.13, pingpong: true }, ...(o.audio || {}) };
  const tracks = {
    ...filmTracks({ D, open: o.open || 'none', climax: o.climax || 'none', finale: looping ? 'none' : o.finale || 'both', loop: looping, is3d, endingSecs, bloom: o.bloom ?? 0.6, intensity: o.intensity ?? 1, styleFrom: o.fx || 'off', styleTo: o.styleTo, climaxAt: o.climaxAt }),
    ...(o.keys || {}),
  };
  const chord = !looping && o.chord !== false ? [[0, 0.45], [7, 0.38], [12, 0.42], [-12, 0.55]].map(([semi, vol], i) => chordLayer(`Closing chord ${i + 1}`, 60 + (o.root ?? 0) + semi, view, audio, D - endingSecs, vol)) : [];
  return {
    name, $category: o.cat, mode: is3d ? '3d' : '2d', transport: { duration: D, bpm: o.bpm ?? 90 }, view,
    ...(o.params ? { params: o.params } : {}),
    sequence: { enabled: !!o.sequence, past: o.past || 'keep' },
    layers: [...o.layers, ...chord],
    visual: {
      aspect: '9:16', drawMode: o.drawMode || 'trace', background: o.bg || (light ? '#efe6d2' : hsl(H, 0.55, 0.03)), gridColor: hsl(H, 0.45, 0.09), axesColor: hsl(H, 0.4, 0.26), showGrid: false, showAxes: false,
      backdrop: o.backdrop || 'solid', backdropColor: o.light2 || (light ? '#c9a66b' : o.c1 || '#5ee0ff'), backdropMotion: o.motion || 'still', tone: light ? 'off' : 'soft', exposure: 1,
      loop, loopSecs: o.loopSecs ?? 2.6, letterbox: 0,
      fx: { style: o.fx || 'off', tail: o.tail ?? 0.35, offset: o.offset ?? 3, strings: o.strings ?? 90, stringAlpha: o.stringAlpha ?? 0.16, hold: looping ? 0 : o.hold ?? 3.5, intensity: o.intensity ?? 1, copies: o.copies ?? 6 },
      bloom: { enabled: !light, strength: o.bloom ?? 0.6, radius: 0.45, threshold: 0.12 }, trail: { enabled: o.trail ?? !light, count: 120, size: 4 },
      marker: { shape: 'circle', size: o.marker ?? 22, smoothing: 0.3, cursorLine: false },
      ...(is3d ? { fog: { enabled: o.fog !== 0, density: o.fog ?? r3(0.5 / (ext * 5)) } } : {}),
    },
    camera: {
      ending: looping ? 'off' : o.ending || 'reveal', endingSecs, endingBars: 0, track: 0, trackSpeed: 0.1, zoom: 1, roll: 0, fov: 45,
      autoRotate: is3d && o.orbit !== false, rotateSpeed: o.rotate ?? (looping ? r3(60 / D) : 0.8), ...(o.camera || {}),
    },
    audio, rhythm: { enabled: false, showGrid: false },
    overlay: { layout: 4, name: { enabled: false }, formulas: { enabled: o.formulas !== false, x: 0.06, y: 0.12, size: 0.5, start: r3(D * 0.4), end: r3(looping ? D - 2 : D - endingSecs) }, texts: [] },
    keyframes: { tracks, autoKey: false },
    hook: { text: o.hook },
    youtube: { title: `${o.title || o.hook} #shorts`, description: `${o.desc || o.about?.math || ''}\n\nWhich one should I make next? 👇\n\n#math #science #shorts`, tags: `${TAGS}${o.tags ? `, ${o.tags}` : ''}`.slice(0, 480) },
    about: { title: name.replace(/:.*$/, ''), sources: [], ...o.about },
  };
}

/** A layer of the given type with sensible defaults. */
const L = (name, type, exprs, o = {}) => ({ name, type, exprs: { x: '0', y: '0', z: '0', ...exprs }, width: 2.4, colorMode: 'gradient', color: '#5ee0ff', color2: '#ff7ad9', wave: 'sine', volume: 0.9, samples: 3000, ...o });
/** A hidden layer that only plays a written melody (for clouds of points, which have no pen). */
const melody = (notesStr, o = {}) => ({ name: 'Melody', type: 'function', exprs: { y: '0', z: '0' }, hidden: true, caption: '-', pitchFrom: 'melody', melody: 'custom', notes: notesStr, melodyLoops: 1, wave: 'glass-pad', volume: 0.7, samples: 200, ...o });

const ODE = (name, exprs, sim, o = {}) => L(name, 'ode', exprs, { sim, samples: 12000, width: 2, ...o });
const MAP = (name, exprs, o = {}) => L(name, 'map', exprs, { samples: 90000, width: 1.5, volume: 0, sim: { alpha: 0.22, ...(o.sim || {}) }, ...o });
const SURF = (name, exprs, range, surf, o = {}) => L(name, 'psurface', exprs, { range, surf, samples: 2400, width: 3, ...o });

/* ---------------------------------------------------------------- chaos */

const CHAOS = 'Science · Chaos & attractors';
const LORENZ = { x: '10*(y-x)', y: 'x*(28-z)-y', z: 'x*y-8/3*z' };

export const CHAOS_PRESETS = [
  film('The Butterfly Effect (Lorenz)', {
    cat: CHAOS, mode: '3d', ext: 28, D: 34, c1: '#ff7a59', backdrop: 'stars', light2: '#6a5cff', fx: 'comet', tail: 0.22, bloom: 0.55, open: 'blackout', climax: 'surge', climaxAt: 0.62, finale: 'both', ending: 'reveal',
    yr: [-22, 22], scale: 'dorian', root: 2, instrument: 'glass-pad',
    layers: [
      ODE('Lorenz · start A', LORENZ, { x0: 1, y0: 1, z0: 1, dt: 0.006, skip: 0, up: 'z', cz: 25 }, { color: '#ff7a59', color2: '#ffd166', wave: 'e-piano', samples: 9000 }),
      ODE('Lorenz · start B (+0.0001)', LORENZ, { x0: 1.0001, y0: 1, z0: 1, dt: 0.006, skip: 0, up: 'z', cz: 25 }, { color: '#5ee0ff', color2: '#c58cff', wave: 'triangle', volume: 0.55, octave: 1, samples: 9000, caption: '-' }),
    ],
    hook: 'Two paths, 0.0001 apart', title: 'The butterfly effect: two paths that start 0.0001 apart 🦋',
    about: { math: 'Lorenz system dx/ds = 10(y − x), dy/ds = x(28 − z) − y, dz/ds = xy − 8/3·z, solved step by step (Runge–Kutta) from two starts that differ by 0.0001 in x.', aha: 'For a while the two paths are one line. Then the tiny difference doubles again and again until they disagree completely: a deterministic system that cannot be predicted far ahead.', why: 'Edward Lorenz found it in 1963 in a simplified weather model; it is why forecasts fade after about two weeks.', look: 'Comet style, two colours, rising out of black; the glow surges when they split.', sources: src('attractors') },
  }),
  film('Lorenz Attractor: Wings', {
    cat: CHAOS, mode: '3d', ext: 28, D: 30, c1: '#5ee0ff', backdrop: 'nebula', light2: '#4f6bff', fx: 'tube', tail: 0.5, bloom: 0.5, open: 'orbit', loop: 'fade',
    yr: [-22, 22], scale: 'lydian', root: 5,
    layers: [ODE('Lorenz', LORENZ, { x0: 0.1, y0: 0, z0: 0, dt: 0.007, skip: 400, up: 'z', cz: 25 }, { color: '#5ee0ff', color2: '#ff7ad9', wave: 'glass-pad' })],
    hook: 'Order hidden in chaos', title: 'The Lorenz attractor: never repeats, never escapes 🌀',
    about: { math: 'dx/ds = σ(y − x), dy/ds = x(ρ − z) − y, dz/ds = xy − βz with σ = 10, ρ = 28, β = 8/3.', aha: 'The path loops round one wing, then the other, in an order that never repeats, yet it never leaves the butterfly shape: a strange attractor.', why: 'Convection in the atmosphere, lasers, water wheels and dynamos follow the same equations.', sources: src('attractors') },
  }),
  film('Rössler Attractor', {
    cat: CHAOS, mode: '3d', ext: 15, D: 28, c1: '#ffcf5a', backdrop: 'rays', light2: '#ff8a3d', fx: 'rainbow', tail: 0.4, bloom: 0.5, open: 'spiral', climax: 'zoomhit', ending: 'whirl',
    yr: [-12, 12], scale: 'phrygian', root: 4,
    layers: [ODE('Rössler', { x: '-y-z', y: 'x+0.2*y', z: '0.2+z*(x-5.7)' }, { x0: 1, y0: 1, z0: 0, dt: 0.02, skip: 300, up: 'z', cz: 9 }, { color: '#ffcf5a', color2: '#ff5a8a', wave: 'marimba', samples: 10000 })],
    hook: 'A spiral that suddenly jumps', title: 'The Rössler attractor: a spiral with a sudden fold 🌪️',
    about: { math: 'dx/ds = −y − z, dy/ds = x + 0.2y, dz/ds = 0.2 + z(x − 5.7).', aha: 'One single non-linear term (zx) is enough for chaos: the path spirals out flat, then is lifted and folded back, like kneading dough.', why: 'Otto Rössler designed it in 1976 as the simplest flow that stretches and folds.', sources: src('attractors') },
  }),
  film('Aizawa Attractor', {
    cat: CHAOS, mode: '3d', ext: 2, D: 30, c1: '#c58cff', backdrop: 'cosmos', light2: '#8b7bff', fx: 'echo', tail: 0.45, bloom: 0.55, open: 'orbit', loop: 'fade',
    yr: [-1.5, 1.5], scale: 'harmonicMinor', root: 9,
    layers: [ODE('Aizawa', { x: '(z-0.7)*x-3.5*y', y: '3.5*x+(z-0.7)*y', z: '0.6+0.95*z-z^3/3-(x^2+y^2)*(1+0.25*z)+0.1*z*x^3' }, { x0: 0.1, y0: 0, z0: 0, dt: 0.01, skip: 300, up: 'z', cz: 0.6 }, { color: '#c58cff', color2: '#5ee0ff', wave: 'glass-pad', samples: 14000, width: 1.6 })],
    hook: 'A planet made of one line', title: 'The Aizawa attractor: a sphere with a tunnel 🪐',
    about: { math: 'dx/ds = (z − b)x − dy, dy/ds = dx + (z − b)y, dz/ds = c + az − z³/3 − (x² + y²)(1 + ez) + fzx³ with a = 0.95, b = 0.7, c = 0.6, d = 3.5, e = 0.25, f = 0.1.', aha: 'A single endless line wraps a ball and dives through a tube along its axis.', why: 'A torus-like attractor related to the forced Lorenz system; a favourite of 3D-printed maths sculpture.', sources: src('attractors') },
  }),
  film('Thomas Attractor', {
    cat: CHAOS, mode: '3d', ext: 5, D: 30, c1: '#7be0c3', backdrop: 'hex', light2: '#4fd1c5', fx: 'tube', tail: 0.55, bloom: 0.5, open: 'push', loop: 'fade',
    yr: [-4, 4], scale: 'pentatonic', root: 7,
    layers: [ODE('Thomas', { x: 'sin(y)-0.19*x', y: 'sin(z)-0.19*y', z: 'sin(x)-0.19*z' }, { x0: 0.1, y0: 0, z0: 0, dt: 0.05, skip: 400 }, { color: '#7be0c3', color2: '#ffd27a', wave: 'kalimba', samples: 12000 })],
    hook: 'Three sines, endless wandering', title: 'Thomas’ attractor: x, y and z chase each other 🔺',
    about: { math: 'dx/ds = sin y − bx, dy/ds = sin z − by, dz/ds = sin x − bz with b = 0.19.', aha: 'The same rule for each coordinate, shifted round (x → y → z → x). Friction b below about 0.208 lets chaos in; lower b gives a random walk in a lattice.', why: 'René Thomas proposed it as a model of feedback circuits in biology.', sources: src('thomas') },
  }),
  film('Chen Attractor', {
    cat: CHAOS, mode: '3d', ext: 28, D: 28, c1: '#ff4f8a', backdrop: 'tunnel', light2: '#ff4f8a', fx: 'glitch', tail: 0.25, bloom: 0.45, intensity: 0.8, offset: 4, open: 'flash', climax: 'shake', ending: 'crash',
    yr: [-22, 22], scale: 'minorPentatonic', root: 9,
    layers: [ODE('Chen', { x: '35*(y-x)', y: '-7*x-x*z+28*y', z: 'x*y-3*z' }, { x0: -10, y0: 0, z0: 37, dt: 0.002, skip: 800, up: 'z', cz: 23 }, { color: '#ff4f8a', color2: '#5ee0ff', wave: 'synth-pluck', samples: 15000 })],
    hook: 'Lorenz’s wild twin', title: 'The Chen attractor: Lorenz’s wild twin ⚡',
    about: { math: 'dx/ds = a(y − x), dy/ds = (c − a)x − xz + cy, dz/ds = xy − bz with a = 35, b = 3, c = 28.', aha: 'Almost the Lorenz equations, one sign different, and the wings become sharper and more tangled.', why: 'Guanrong Chen found it in 1999 while controlling chaos.', sources: src('chen') },
  }),
  film('Sprott A: Chaos in Five Terms', {
    cat: CHAOS, mode: '3d', ext: 5.6, D: 26, c1: '#9fe8ff', backdrop: 'blueprint', light2: '#4f9bff', fx: 'pulse', tail: 0.5, bloom: 0.5, open: 'follow', climax: 'surge', ending: 'cinema',
    yr: [-3, 3], scale: 'dorian', root: 0,
    layers: [ODE('Sprott A', { x: 'y', y: '-x+y*z', z: '1-y^2' }, { x0: 0, y0: 5, z0: 0, dt: 0.02, skip: 0 }, { color: '#9fe8ff', color2: '#c4b5fd', wave: 'e-piano', samples: 10000 })],
    hook: 'Is this the simplest chaos?', title: 'Five terms are enough for chaos 🧩',
    about: { math: "x' = y, y' = −x + yz, z' = 1 − y²: Sprott's case A.", aha: 'Julien Sprott searched by computer for the simplest chaotic flows and found 19 with five or six terms. This one conserves volume, like a frictionless system.', why: 'It is the Nosé–Hoover thermostat in disguise, used to model a gas at a fixed temperature.', sources: src('sprott') },
  }),
  film('Clifford Cloud: Breathing', {
    cat: CHAOS, mode: '2d', ext: 2.3, D: 30, c1: '#ff4fd8', backdrop: 'grain', fx: 'off', bloom: 0.35, intensity: 1, loop: 'fade', motion: 'still', formulas: true,
    params: { a: -1.4, b: 1.6, c: 1, d: 0.7 },
    keys: { 'params.a': [{ time: 0, value: -1.4, ease: 'smooth' }, { time: 15, value: -1.62, ease: 'smooth' }, { time: 30, value: -1.4, ease: 'smooth' }], 'params.d': [{ time: 0, value: 0.7, ease: 'smooth' }, { time: 15, value: 0.86, ease: 'smooth' }, { time: 30, value: 0.7, ease: 'smooth' }] },
    layers: [MAP('Clifford', { x: 'sin(a*y)+c*cos(a*x)', y: 'sin(b*x)+d*cos(b*y)' }, { color: '#ff4fd8', color2: '#5ee0ff', samples: 70000 }), melody('D4 F4 A4 C5 A4 F4 E4 G4 B4 D5 B4 G4', { melodyLoops: 2 })],
    hook: 'Smoke from one equation', title: 'A Clifford attractor that breathes 💨',
    about: { math: 'xₙ₊₁ = sin(a·yₙ) + c·cos(a·xₙ), yₙ₊₁ = sin(b·xₙ) + d·cos(b·yₙ): 70 000 points, each from the last.', aha: 'No point is placed by hand; the cloud is where the sequence keeps coming back. Changing a and d a little makes the whole cloud flow.', why: 'Clifford Pickover’s maps are a classic of generative art.', sources: src('clifford') },
  }),
  film('De Jong Cloud', {
    cat: CHAOS, mode: '2d', ext: 2.2, D: 28, c1: '#ffd166', backdrop: 'vignette', light2: '#ff9d4a', fx: 'off', bloom: 0.35, loop: 'fade',
    params: { a: -2, b: -2, c: -1.2, d: 2 },
    keys: { 'params.c': [{ time: 0, value: -1.2, ease: 'smooth' }, { time: 14, value: -1.35, ease: 'smooth' }, { time: 28, value: -1.2, ease: 'smooth' }] },
    layers: [MAP('De Jong', { x: 'sin(a*y)-cos(b*x)', y: 'sin(c*x)-cos(d*y)' }, { color: '#ffd166', color2: '#ff5a8a', samples: 70000 }), melody('A3 C4 E4 G4 E4 C4 F3 A3 C4 E4 C4 A3', { wave: 'kalimba', melodyLoops: 2 })],
    hook: 'Silk from sines', title: 'The Peter de Jong attractor 🧣',
    about: { math: 'xₙ₊₁ = sin(a·yₙ) − cos(b·xₙ), yₙ₊₁ = sin(c·xₙ) − cos(d·yₙ) with a = b = −2, c = −1.2, d = 2.', aha: 'Four numbers decide everything; most choices give dust, a few give silk.', sources: src('clifford') },
  }),
];

/* ---------------------------------------------------------------- shapes */

const SHAPES = 'Science · Shapes in 3D';

/** Hopf fibres over points (θ, φ) of the 2-sphere, stereographically projected: each one a circle. */
function hopfFibre(theta, phi, i, n, c1, c2) {
  const a = Math.cos(theta / 2), b = Math.sin(theta / 2), P = r3(phi);
  const d = `(1-${r3(b)}*sin(s+${P}))`;
  return L(`Fibre ${i + 1}`, 'parametric', { x: `${r3(a)}*cos(s)/${d}`, y: `${r3(b)}*cos(s+${P})/${d}`, z: `${r3(a)}*sin(s)/${d}` }, {
    range: { min: 0, max: r3(TAU) }, samples: 900, width: 2.4, color: i % 2 ? c2 : c1, color2: i % 2 ? c1 : c2, volume: i < 2 ? 0.7 : 0, wave: i ? 'triangle' : 'glass-pad', octave: i % 3, caption: i ? '-' : 'Hopf fibre: (cos(θ/2)·e^{is}, sin(θ/2)·e^{i(s+φ)}) → 3D',
  });
}

export const SHAPE_PRESETS = [
  film('Hopf Fibration: Every Circle Linked', {
    cat: SHAPES, mode: '3d', ext: 3.4, D: 30, c1: '#7aa8ff', backdrop: 'nebula', light2: '#6a5cff', fx: 'rainbow', tail: 0.5, bloom: 0.55, open: 'orbit', loop: 'wrap',
    yr: [-2.5, 2.5], scale: 'lydian', root: 2,
    layers: [...Array.from({ length: 8 }, (_, i) => hopfFibre(Math.PI / 2, (i / 8) * TAU, i, 8, '#7aa8ff', '#ff9ad9')), ...Array.from({ length: 4 }, (_, i) => hopfFibre(Math.PI / 4, (i / 4) * TAU + 0.4, 8 + i, 4, '#ffd166', '#7be0c3'))],
    hook: 'Every circle passes through every other', title: 'The Hopf fibration: circles that are all linked 🔗',
    about: { math: 'The 3-sphere is made of circles, one over each point of an ordinary sphere (Hopf, 1931). Each circle here is (cos(θ/2)e^{is}, sin(θ/2)e^{i(s+φ)}) projected stereographically to 3D.', aha: 'Circles over the same latitude lie on one torus as Villarceau circles, and every one is linked with every other.', why: 'It describes the spin of quantum particles (qubits on the Bloch sphere) and appears in Dirac’s monopole and liquid crystals.', sources: src('hopf') },
  }),
  film('Lissajous-Toric Knot', {
    cat: SHAPES, mode: '3d', ext: 3.4, D: 26, c1: '#ff9a5a', backdrop: 'stars', light2: '#ffd166', fx: 'prism', tail: 0.5, bloom: 0.5, open: 'spiral', loop: 'wrap',
    yr: [-1, 1], scale: 'pentatonic', root: 4,
    layers: [L('Knot', 'parametric', { x: '(2+sin(5*s))*cos(2*s)', y: 'cos(3*(s+0.3))', z: '(2+sin(5*s))*sin(2*s)' }, { range: { min: 0, max: r3(TAU) }, color: '#ff9a5a', color2: '#ffd166', wave: 'marimba', width: 3 })],
    hook: 'A knot from three sine waves', title: 'A Lissajous-toric knot: three waves tie themselves 🪢',
    about: { math: 'x = (2 + sin 5t) cos 2t, z = (2 + sin 5t) sin 2t, y = cos(3(t + 0.3)): a vertical Lissajous wave carried round a circle.', aha: 'Three whole numbers (2, 5, 3) and a phase decide which knot you get. No torus knot can be made from plain Lissajous waves; going round the circle is what makes it possible.', sources: src('knots') },
  }),
  film('Torus Knot (2, 5) in Glass', {
    cat: SHAPES, mode: '3d', ext: 3.4, D: 26, c1: '#9fe8ff', backdrop: 'gradient', light2: '#7aa8ff', fx: 'tube', tail: 0.5, bloom: 0.5, open: 'push', loop: 'wrap',
    yr: [-1, 1], scale: 'major', root: 0,
    layers: [L('Torus knot', 'parametric', { x: '(2+cos(5*s))*cos(2*s)', y: '-sin(5*s)', z: '(2+cos(5*s))*sin(2*s)' }, { range: { min: 0, max: r3(TAU) }, color: '#9fe8ff', color2: '#ffffff', wave: 'glass-pad', width: 3.4 })],
    hook: 'Two turns one way, five the other', title: 'A (2, 5) torus knot 💎',
    about: { math: 'x = (2 + cos 5t) cos 2t, z = (2 + cos 5t) sin 2t, y = −sin 5t: twice round the hole, five times round the tube.', aha: 'If the two numbers share no factor, the line never meets itself: a knot. (2, 3) is the trefoil.', sources: src('knots') },
  }),
  film('Möbius Strip: One Side Only', {
    cat: SHAPES, mode: '3d', ext: 1.9, D: 26, c1: '#7be0c3', backdrop: 'vignette', light2: '#4fd1c5', fx: 'comet', tail: 0.3, bloom: 0.45, open: 'orbit', loop: 'wrap',
    yr: [-0.6, 0.6], scale: 'dorian', root: 2,
    layers: [SURF('Möbius strip', { x: '(1+v/2*cos(u/2))*cos(u)', y: 'v/2*sin(u/2)', z: '(1+v/2*cos(u/2))*sin(u)', pv: '0.7*sin(u/2)' }, { min: 0, max: r3(2 * TAU) }, { vMin: -1, vMax: 1, nu: 140, nv: 10, uMin: 0, uMax: r3(TAU), solid: 0.2, wire: 0.5 }, { color: '#7be0c3', color2: '#c58cff', wave: 'kalimba' })],
    hook: 'Can a pen draw on both sides?', title: 'The Möbius strip: the pen visits “both” sides without lifting 🎗️',
    about: { math: 'x = (1 + v/2·cos(u/2))cos u, z = (1 + v/2·cos(u/2))sin u, y = v/2·sin(u/2). The pen rides v = 0.7·sin(u/2) for two full turns.', aha: 'After one turn the pen is on the “other side”; after two it is back. There is only one side and one edge.', why: 'Conveyor belts are made as Möbius strips so they wear evenly on both faces.', sources: [] },
  }),
  film('Klein Bottle', {
    cat: SHAPES, mode: '3d', ext: 3.3, D: 28, c1: '#c58cff', backdrop: 'cosmos', light2: '#8b7bff', fx: 'pulse', tail: 0.5, bloom: 0.35, open: 'orbit', loop: 'fade',
    yr: [-1.2, 1.2], scale: 'harmonicMinor', root: 9,
    layers: [SURF('Klein bottle', { x: '(2+cos(u/2)*sin(v)-sin(u/2)*sin(2*v))*cos(u)', y: 'sin(u/2)*sin(v)+cos(u/2)*sin(2*v)', z: '(2+cos(u/2)*sin(v)-sin(u/2)*sin(2*v))*sin(u)', pv: '3*u' }, { min: 0, max: r3(TAU) }, { vMin: 0, vMax: r3(TAU), nu: 120, nv: 40, solid: 0.06, wire: 0.3 }, { color: '#c58cff', color2: '#5ee0ff', wave: 'glass-pad' })],
    hook: 'A bottle with no inside', title: 'The Klein bottle: no inside, no outside 🍶',
    about: { math: 'The figure-8 immersion: x = (2 + cos(u/2) sin v − sin(u/2) sin 2v) cos u, z = (…) sin u, y = sin(u/2) sin v + cos(u/2) sin 2v.', aha: 'A closed surface with only one side. In 3D it has to pass through itself; in 4D it would not.', sources: [] },
  }),
  film('Catenoid Becomes a Helicoid', {
    cat: SHAPES, mode: '3d', ext: 2.3, D: 28, c1: '#ffd166', backdrop: 'gradient', light2: '#ff8a3d', fx: 'tube', tail: 0.45, bloom: 0.45, open: 'orbit', loop: 'fade', params: { a: 1 },
    keys: { 'params.a': [{ time: 0, value: 1, ease: 'smooth' }, { time: 4, value: 1, ease: 'smooth' }, { time: 14, value: 0, ease: 'smooth' }, { time: 20, value: 0, ease: 'smooth' }, { time: 28, value: 1, ease: 'smooth' }] },
    yr: [-2, 2], scale: 'major', root: 7,
    layers: [SURF('Minimal surface', { x: 'cos(a*pi/2)*sinh(v)*sin(u)+sin(a*pi/2)*cosh(v)*cos(u)', y: 'u*cos(a*pi/2)+v*sin(a*pi/2)', z: '-cos(a*pi/2)*sinh(v)*cos(u)+sin(a*pi/2)*cosh(v)*sin(u)', pv: '0.9*sin(2*u)' }, { min: r3(-Math.PI), max: r3(Math.PI) }, { vMin: -1.2, vMax: 1.2, nu: 90, nv: 30, solid: 0.1, wire: 0.4 }, { color: '#ffd166', color2: '#ff5a8a', wave: 'harp' })],
    hook: 'A soap film that twists into a spiral', title: 'A catenoid twists into a helicoid without stretching 🧼',
    about: { math: 'x = cos θ sinh v sin u + sin θ cosh v cos u, y = u cos θ + v sin θ, z = −cos θ sinh v cos u + sin θ cosh v sin u, with θ = a·90°: a = 1 catenoid, a = 0 helicoid.', aha: 'Every shape in between is also a minimal surface (a soap film), and the change bends it without stretching a single distance.', why: 'The catenoid is the soap film between two rings; the helicoid is a spiral ramp.', sources: src('catenoid') },
  }),
  film('Dini’s Surface', {
    cat: SHAPES, mode: '3d', ext: 2.4, D: 26, c1: '#ff7ad9', backdrop: 'plasma', light2: '#ff7ad9', fx: 'rainbow', tail: 0.5, bloom: 0.45, open: 'orbit', loop: 'fade',
    yr: [-2, 2], scale: 'lydian', root: 4,
    layers: [SURF('Dini', { x: 'cos(u)*sin(v)', y: 'cos(v)+ln(tan(v/2))+0.2*u-1.3', z: 'sin(u)*sin(v)', pv: '0.5+0.45*sin(u/2)' }, { min: 0, max: r3(2 * TAU) }, { vMin: 0.06, vMax: 2, nu: 160, nv: 30, solid: 0.15, wire: 0.45 }, { color: '#ff7ad9', color2: '#7aa8ff', wave: 'glass-pad' })],
    hook: 'A twisted trumpet with constant curvature', title: 'Dini’s surface: a twisted pseudosphere 🎺',
    about: { math: 'x = a cos u sin v, z = a sin u sin v, y = a(cos v + ln tan(v/2)) + bu with a = 1, b = 0.2.', aha: 'Everywhere on it the curvature is the same negative number: it is a twisted piece of hyperbolic geometry.', sources: src('dini') },
  }),
  film('Enneper Surface', {
    cat: SHAPES, mode: '3d', ext: 3.6, D: 24, c1: '#7be0c3', backdrop: 'hex', light2: '#4fd1c5', fx: 'ants', tail: 0.5, bloom: 0.45, open: 'orbit', loop: 'fade',
    yr: [-2, 2], scale: 'pentatonic', root: 2,
    layers: [SURF('Enneper', { x: 'u-u^3/3+u*v^2', y: 'u^2-v^2', z: 'v-v^3/3+v*u^2', pv: '1.2*sin(2*u)' }, { min: -1.4, max: 1.4 }, { vMin: -1.4, vMax: 1.4, nu: 60, nv: 60, solid: 0.16, wire: 0.5 }, { color: '#7be0c3', color2: '#ffd27a', wave: 'kalimba' })],
    hook: 'A saddle that folds through itself', title: 'Enneper’s minimal surface 🌿',
    about: { math: 'x = u − u³/3 + uv², z = v − v³/3 + vu², y = u² − v² (Enneper, 1864).', aha: 'Like a soap film it has zero mean curvature everywhere, yet grown a little further it passes through itself.', sources: src('enneper') },
  }),
  film('Orbitals: d to d', {
    cat: SHAPES, mode: '3d', ext: 1.6, D: 28, c1: '#5ee0ff', backdrop: 'rings', light2: '#4f6bff', fx: 'tube', tail: 0.5, bloom: 0.35, open: 'orbit', loop: 'fade', params: { a: 0 },
    keys: { 'params.a': [{ time: 0, value: 0, ease: 'smooth' }, { time: 5, value: 0, ease: 'smooth' }, { time: 13, value: 1, ease: 'smooth' }, { time: 20, value: 1, ease: 'smooth' }, { time: 28, value: 0, ease: 'smooth' }] },
    yr: [-1.2, 1.2], scale: 'dorian', root: 0,
    layers: [SURF('Orbital', { x: 'abs((1-a)*0.5*(3*cos(v)^2-1)+a*1.3*sin(v)^2*sin(2*u))*sin(v)*cos(u)', y: 'abs((1-a)*0.5*(3*cos(v)^2-1)+a*1.3*sin(v)^2*sin(2*u))*cos(v)', z: 'abs((1-a)*0.5*(3*cos(v)^2-1)+a*1.3*sin(v)^2*sin(2*u))*sin(v)*sin(u)', pv: '1.5708+1.2*sin(3*u)' }, { min: 0, max: r3(TAU) }, { vMin: 0, vMax: r3(Math.PI), nu: 72, nv: 48, solid: 0.08, wire: 0.32 }, { color: '#5ee0ff', color2: '#ff7ad9', wave: 'glass-pad' })],
    hook: 'The shapes inside an atom', title: 'Atomic orbitals: d_z² becomes d_xy ⚛️',
    about: { math: 'Distance from the centre in each direction = |Y(θ, φ)|, the angular part of the hydrogen wave function: d_z² ∝ 3cos²θ − 1, d_xy ∝ sin²θ sin 2φ, blended by a.', aha: 'The lobes are the directions where an electron is most likely to be found. The same spherical harmonics describe how a drum or a planet vibrates.', why: 'They explain the shapes of molecules and the colours of gems.', sources: src('harmonics') },
  }),
];

/* ---------------------------------------------------------------- numbers */

const NUMBERS = 'Science · Numbers';

/** Fresnel integrals ∫₀ᵗ cos(s²/2) ds, ∫₀ᵗ sin(s²/2) ds by Simpson's rule (for the Euler spiral's start). */
function fresnel(t, n = 20000) {
  let c = 0, s = 0;
  const h = t / n;
  for (let i = 0; i <= n; i++) { const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2, x = i * h; c += w * Math.cos((x * x) / 2); s += w * Math.sin((x * x) / 2); }
  return [(c * h) / 3, (s * h) / 3];
}
const [FC, FS] = fresnel(-7);

export const NUMBER_PRESETS = [
  film('The Riemann Zeta Spiral', {
    cat: NUMBERS, mode: '2d', ext: 3.4, D: 34, c1: '#ffd166', backdrop: 'stars', light2: '#ffb347', fx: 'comet', tail: 0.18, bloom: 0.55, open: 'follow', climax: 'surge', ending: 'reveal',
    yr: [-3, 3], scale: 'minorPentatonic', root: 9, chord: true,
    layers: [L('ζ(½ + it)', 'parametric', { x: 'zetare(s)', y: 'zetaim(s)' }, { range: { min: 0, max: 50 }, samples: 6000, color: '#ffd166', color2: '#ff5a8a', wave: 'e-piano', width: 2.6, caption: 'ζ(½ + it),  0 ≤ t ≤ 50' })],
    hook: 'The most famous unsolved problem, drawn', title: 'The Riemann zeta function on the critical line 🌀',
    about: { math: 'The curve is ζ(½ + it) for t from 0 to 50, computed from the alternating series with Borwein’s acceleration. Each time it passes through the centre (t ≈ 14.13, 21.02, 25.01, 30.42, 32.94 …) is a zero.', aha: 'The Riemann hypothesis says every non-trivial zero lies on this line, so this curve is where the action is. The zeros control how the prime numbers are spread.', why: 'A proof is worth a million dollars (Clay Millennium Prize).', sources: src('zeta') },
  }),
  film('Zeta: On the Line and Off It', {
    cat: NUMBERS, mode: '2d', ext: 3.4, D: 30, c1: '#5ee0ff', backdrop: 'blueprint', light2: '#4f9bff', fx: 'tube', tail: 0.3, bloom: 0.5, open: 'push', climax: 'zoomhit', ending: 'cinema',
    yr: [-3, 3], scale: 'dorian', root: 2,
    layers: [
      L('σ = ½ (critical line)', 'parametric', { x: 'zetare(s)', y: 'zetaim(s)' }, { range: { min: 0, max: 40 }, samples: 5000, color: '#5ee0ff', color2: '#ffffff', wave: 'e-piano', caption: 'σ = ½: passes through 0' }),
      L('σ = ¾', 'parametric', { x: 'zetare(0.75,s)', y: 'zetaim(0.75,s)' }, { range: { min: 0, max: 40 }, samples: 5000, color: '#ff7ad9', color2: '#ffd166', wave: 'triangle', volume: 0.5, octave: 1, caption: 'σ = ¾: never does (if Riemann was right)' }),
    ],
    hook: 'One line touches zero, the other never does', title: 'Why the critical line is special 🎯',
    about: { math: 'Blue: ζ(½ + it). Pink: ζ(¾ + it). Both for t from 0 to 40.', aha: 'The blue curve keeps passing through the centre; the pink one loops around but never touches it. The Riemann hypothesis claims that is true for every σ other than ½.', sources: src('zeta') },
  }),
  film('The Euler Spiral', {
    cat: NUMBERS, mode: '2d', ext: 1.1, D: 26, c1: '#ff9a5a', backdrop: 'paper', light: true, fx: 'ink', tail: 0.6, open: 'follow', ending: 'breath',
    yr: [-0.9, 0.9], scale: 'major', root: 5,
    layers: [ODE('Euler spiral', { x: 'cos((s-7)^2/2)', y: 'sin((s-7)^2/2)', z: '0' }, { x0: r3(FC), y0: r3(FS), z0: 0, dt: 0.0018, skip: 0 }, { samples: 7800, color: '#2b1d14', color2: '#a33b1d', wave: 'harp', width: 2.6, caption: "x' = cos(s²/2),  y' = sin(s²/2)" })],
    hook: 'The curve of every highway exit', title: 'The Euler spiral: why roads curve like this 🛣️',
    about: { math: 'x(t) = ∫cos(s²/2) ds, y(t) = ∫sin(s²/2) ds (the Fresnel integrals), from t = −7 to 7. Its curvature grows exactly in step with its length.', aha: 'Turning the steering wheel at a steady rate drives this curve, so it is the comfortable way to enter a bend.', why: 'Railway and highway transitions (clothoids), Fresnel diffraction of light (the Cornu spiral), and Euler’s 1744 elastic springs.', sources: src('euler') },
  }),
  film('Hearts in the Times Table', {
    cat: NUMBERS, mode: 'circle', rule: 'times', lab: { points: 240, from: 2, to: 34, build: 6, morph: 30 }, D: 40, pal: 'sunset', bg: '#06030a', inst: 'kalimba', open: 'blackout', ending: 'reveal', hook: 'Multiply by 2 on a circle and a heart appears',
    title: 'The times table hides the Mandelbrot heart ❤️',
    about: { math: 'Point k on a circle of 240 points is joined to point k × m (mod 240), with m slowly growing from 2 to 34.', aha: '×2 draws a cardioid, ×3 a nephroid, ×4 a three-cusped curve … The ×2 heart is the same cardioid as the main body of the Mandelbrot set, because multiplying complex numbers adds their angles.', sources: src('cardioid') },
  }),
  film('The Golden Angle', {
    cat: NUMBERS, mode: 'circle', rule: 'phyllo', lab: { angle: 137.508, max: 1400, rate0: 6, accel: 1.18, color: 'spiral', spin: 0.03 }, D: 30, pal: 'gold', bg: '#070502', inst: 'music-box', open: 'push', ending: 'whirl', hook: 'Why 137.5°?',
    title: 'The golden angle: how a sunflower packs its seeds 🌻',
    about: { math: 'Seed n sits at angle n × 137.508° and distance √n (Vogel’s model). 137.508° = 360° / φ², φ = (1 + √5)/2.', aha: 'Any other angle leaves gaps or spokes; the golden one, the “most irrational” angle, packs the seeds evenly and shows 21 and 34 spirals, two Fibonacci numbers.', sources: src('golden') },
  }),
  film('Prime Spiral (Sacks)', {
    cat: NUMBERS, mode: 'circle', rule: 'primes', lab: { kind: 'sacks', max: 24000, rate0: 40, accel: 1.3, all: 0.05, euler: true }, D: 32, pal: 'aurora', bg: '#02040a', inst: 'kalimba', open: 'none', ending: 'reveal', hook: 'Are the primes random?',
    title: 'The hidden curves of the prime numbers 🔢',
    about: { math: 'Number n is placed at r = √n, θ = 2π√n (Sacks, 1994): one perfect square per turn. Only the primes are lit; gold marks n² + n + 41.', aha: 'The primes gather on curves. Each curve is a quadratic polynomial; some, like Euler’s n² + n + 41 (prime for n = 0 … 39), are unusually rich in primes, and no one fully knows why.', sources: src('sacks', 'primes') },
  }),
  film('Ulam’s Prime Diagonals', {
    cat: NUMBERS, mode: 'circle', rule: 'primes', lab: { kind: 'ulam', max: 14000, rate0: 30, accel: 1.3, all: 0.08, euler: false }, D: 28, pal: 'ice', bg: '#02040a', inst: 'music-box', open: 'none', ending: 'cinema', hook: 'Ulam doodled this in a boring meeting',
    title: 'Ulam’s spiral: the primes line up on diagonals 📐',
    about: { math: 'Write 1, 2, 3 … on a square spiral and light up the primes.', aha: 'Stanisław Ulam noticed in 1963 that the primes crowd onto diagonal lines: each diagonal is a quadratic like 4n² + bn + c.', sources: src('primes') },
  }),
];

/* ---------------------------------------------------------------- motion */

const MOTION = 'Science · Motion & sync';

export const MOTION_PRESETS = [
  film('Fireflies Fall Into Step', { cat: MOTION, mode: 'circle', rule: 'kuramoto', lab: { count: 48, k0: 0, k1: 2.6, rise: 18, spread: 0.2 }, D: 32, pal: 'gold', bg: '#020503', inst: 'glass-pad', ending: 'reveal', hook: 'Nobody leads them…', title: 'How fireflies flash together (no leader) ✨',
    about: { math: 'Kuramoto model: each phase θᵢ turns at its own speed ωᵢ plus K·r·sin(ψ − θᵢ), where r e^{iψ} is the average of all of them. K grows over the video.', aha: 'Below a critical pull nothing happens; just above it, order appears suddenly, a phase transition. No firefly is in charge.', why: 'Heart pacemaker cells, applause, power grids, pendulum clocks on one beam and the Millennium Bridge wobble.', sources: src('kuramoto') } }),
  film('Kuramoto Circle', { cat: MOTION, mode: 'circle', rule: 'kuramoto', lab: { count: 32, k0: 0, k1: 3, rise: 14, spread: 0.25, layout: 'ring' }, D: 28, pal: 'aurora', bg: '#02040a', inst: 'kalimba', ending: 'cinema', hook: 'Watch the arrow grow', title: 'Synchronisation on a circle: the arrow is the crowd 🧭',
    about: { math: 'Each dot is a phase on the circle; the arrow is their average (length r: 0 scattered, 1 in step).', aha: 'The arrow stays short, then grows in a few seconds once the pull passes its critical value.', sources: src('kuramoto') } }),
  film('The Endless Rise (Shepard Scale)', { cat: MOTION, mode: 'circle', rule: 'shepard', lab: { step: 0.42, octaves: 6, centre: 66, width: 12, look: 'spiral' }, D: r3(0.42 * 12 * 6), pal: 'ice', bg: '#02040a', inst: 'e-piano', loopScene: true, hook: 'Is this sound ever going to stop rising?', title: 'The Shepard scale: a sound that rises forever 🔁',
    about: { math: 'Each step plays C, C#, D … in six octaves at once, loudest in the middle (a bell over pitch). After 12 steps the chord is exactly the same as at the start.', aha: 'The highest note fades out as a new lowest note fades in, so the ear never hears the climb end. The video lasts exactly 6 × 12 steps, so it loops seamlessly.', why: 'Used in film scores for endless tension (Dunkirk) and in Super Mario 64’s endless staircase.', sources: src('shepard') } }),
  film('Shepard Barber Pole', { cat: MOTION, mode: 'circle', rule: 'shepard', lab: { step: 0.36, octaves: 7, centre: 64, width: 14, look: 'pole' }, D: r3(0.36 * 12 * 6), pal: 'rainbow', bg: '#020203', inst: 'glass-pad', loopScene: true, hook: 'An optical illusion for your ears', title: 'A barber pole for your ears 💈',
    about: { math: 'The same Shepard scale drawn as bands of light that climb the screen and fade at both ends.', aha: 'Like a barber pole, the stripes seem to rise forever while staying in place.', sources: src('shepard') } }),
  film('Three Suns: The Figure Eight', { cat: MOTION, mode: 'circle', rule: 'threebody', lab: { kind: 'eight', speed: 1.4, ghost: 0.003, ghostShow: true, trail: 2.4 }, D: 36, pal: 'sunset', bg: '#05030a', inst: 'bell', ending: 'reveal', hook: 'Three suns can dance forever… almost', title: 'The figure-eight three-body orbit ☀️☀️☀️',
    about: { math: 'Three equal masses pulled by Newton’s gravity, starting from Chenciner and Montgomery’s initial conditions (x₁ = −x₂ ≈ (0.970, −0.243), x₃ = 0). Period ≈ 6.326.', aha: 'The general three-body problem has no formula and is usually chaotic, yet this one dance repeats exactly. The ghost started 0.003 away and slowly leaves the dance.', why: 'Found numerically by Cris Moore in 1993, proved to exist in 2000.', sources: src('eight') } }),
  film('Three Stars, One Thrown Out', { cat: MOTION, mode: 'circle', rule: 'threebody', lab: { kind: 'burrau', speed: 1.2, ghost: 0.0005, ghostShow: true, trail: 3, zoom: 1 }, D: 34, pal: 'fire', bg: '#060203', inst: 'marimba', open: 'blackout', ending: 'cinema', hook: 'Masses 3, 4 and 5 at rest. What happens?', title: 'Burrau’s three-body problem: chaos, then an ejection 💥',
    about: { math: 'Masses 3, 4 and 5 start at rest on the corners of a 3-4-5 right triangle (Burrau, 1913). A ghost copy starts 0.0005 away.', aha: 'After a long chaotic dance the smallest star is flung out and the other two leave as a pair. The ghost ends up doing something completely different.', sources: src('burrau') } }),
  film('Double Pendulums Fall Apart', { cat: MOTION, mode: 'circle', rule: 'dpendulum', lab: { count: 12, angle: 155, diff: 0.0004, trail: 2.2 }, D: 30, pal: 'rainbow', bg: '#03030a', inst: 'marimba', ending: 'whirl', hook: 'Twelve pendulums, almost identical', title: 'Chaos: twelve double pendulums that start a hair apart 🌈',
    about: { math: 'Each double pendulum follows Lagrange’s equations (point masses on light rods); the starting angles differ by 0.0004 rad.', aha: 'For a few seconds they move as one. Then the tiny difference explodes and the rainbow scatters: sensitive dependence on initial conditions.', sources: src('dpend') } }),
  film('Pendulum Wave: 40-Second Loop', { cat: MOTION, mode: 'circle', rule: 'pendulum', lab: { count: 18, base: 24, cycle: 40, swing: 24 }, D: 40, pal: 'ocean', bg: '#02050a', inst: 'kalimba', loopScene: true, hook: 'Watch the patterns appear and vanish', title: 'Pendulum wave: 18 pendulums, one 40-second loop 🌊',
    about: { math: 'Pendulum k swings 24 + k times in 40 s, so its length is L = g·T²/(4π²) with T = 40/(24 + k).', aha: 'Waves, snakes, spirals and apparent chaos all come from the slowly changing phase differences; after exactly 40 s every pendulum is back in line, so the video loops.', sources: src('pwave') } }),
  film('The Fastest Slide', { cat: MOTION, mode: 'circle', rule: 'brachisto', lab: { kind: 'race', slow: 0.18 }, D: 20, pal: 'sunset', bg: '#05030a', inst: 'harp', ending: 'cinema', hook: 'Which slide wins?', title: 'The brachistochrone race: the curve beats the straight line 🛝',
    about: { math: 'Frictionless beads slide from the same start to the same end along a straight line, an arc, a parabola and a cycloid (x = R(φ − sin φ), y = −R(1 − cos φ)).', aha: 'The straight line is shortest but slowest; the cycloid dives steeply, gains speed early and wins.', why: 'Johann Bernoulli’s 1696 challenge, solved by Newton overnight.', sources: src('brachisto') } }),
  film('Tautochrone: All Arrive Together', { cat: MOTION, mode: 'circle', rule: 'brachisto', lab: { kind: 'tautochrone', slow: 0.5, beads: 6 }, D: 24, pal: 'candy', bg: '#05030a', inst: 'music-box', ending: 'reveal', hook: 'Different heights, same time', title: 'The tautochrone: from any height they arrive together 🎯',
    about: { math: 'On a cycloid the distance s along the curve from the bottom obeys s″ = −(g/4R)·s, so every bead reaches the bottom after π√(R/g), wherever it starts.', aha: 'Higher beads have farther to go but the slope is steeper: it balances exactly. Huygens used this to build a more accurate pendulum clock.', sources: src('brachisto') } }),
  film('Chladni: Sand Finds the Silence', { cat: MOTION, mode: 'circle', rule: 'chladni', lab: { modes: '1,2 2,3 1,4 3,4 2,5 3,5 4,5', every: 4, grains: 9000, grain: 'sand' }, D: 34, pal: 'gold', bg: '#0a0806', inst: 'glass-pad', ending: 'reveal', hook: 'Sound draws these patterns', title: 'Chladni figures: the sand gathers where the plate is still 🔊',
    about: { math: 'The plate’s vibration is close to cos(nπx)cos(mπy) ± cos(mπx)cos(nπy); sand is shaken off moving places and settles on the nodal lines where the value is 0.', aha: 'Higher notes (bigger n, m) give finer patterns. Violin makers still use this to tune the tops of instruments.', sources: src('chladni') } }),
];

/* ------------------------------------------------------- circle-mode films */

/** Circle-scene presets reuse `film()` options: rule, lab, pal, bg, inst, open, ending … */
function circleFilm(p) {
  const o = p.$o;
  const D = o.D ?? 30, looping = !!o.loopScene;
  const endingSecs = o.endingSecs ?? 4;
  // the Circle Lab has no pen to follow, so its films are gentle: a slow settle from a closer view (or
  // bars opening), the scene's own drama in the middle, and bars closing in before the final shot
  const k = (list) => list.map(([time, value, ease = 'smooth']) => ({ time: r3(time), value, ease }));
  const tracks = {};
  if (o.open && o.open !== 'none') tracks['camera.zoom'] = k([[0, o.open === 'blackout' ? 1.25 : 1.15], [D * 0.3, 1]]);
  if (o.open === 'blackout' || o.open === 'bars') tracks['visual.letterbox'] = k([[0, 1], [2.5, 0]]);
  if (!looping) tracks['visual.letterbox'] = [...(tracks['visual.letterbox'] || k([[0, 0]])), ...k([[D - endingSecs - 0.3, 0], [D - endingSecs + 1, 1], [D, 1]])];
  return {
    name: p.name, $category: o.cat, mode: 'circle', transport: { duration: D, bpm: o.bpm ?? 100 },
    overlay: { layout: 4, name: { enabled: false } }, visual: { aspect: '9:16', letterbox: 0 },
    audio: { scale: 'chromatic', root: 0, noteLow: 40, noteHigh: 88, reverb: { decay: 3.4, mix: 0.36, tone: 0.7, preDelay: 0.02 }, delay: { time: 0.375, feedback: 0.24, mix: 0.12, pingpong: true }, ...(o.audio || {}) },
    circle: { rule: o.rule, lab: { [o.rule]: o.lab }, look: { palette: o.pal || 'aurora', background: o.bg || '#03050b', ...(o.look || {}) }, sound: { instrument: o.inst || 'kalimba', pitch: 'angle', volume: 0.85, maxRate: 24, length: 1.4, ...(o.sound || {}) } },
    camera: { ending: looping ? 'off' : o.ending || 'reveal', endingSecs, endingBars: 0 },
    keyframes: { tracks, autoKey: false },
    hook: { text: o.hook },
    youtube: { title: `${o.title || o.hook} #shorts`, description: `${o.about?.math || ''}\n\nWhich one should I make next? 👇\n\n#math #science #shorts`, tags: TAGS },
    about: { title: p.name, sources: [], ...o.about },
  };
}

export const SCIENCE_PRESETS = [...CHAOS_PRESETS, ...SHAPE_PRESETS, ...NUMBER_PRESETS, ...MOTION_PRESETS];
export { film, L, ODE, MAP, SURF, melody, src, SRC };
