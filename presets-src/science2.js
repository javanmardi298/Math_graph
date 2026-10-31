/**
 * Science, second series: maps, oscillators, life and waves, each a short film with its maths in
 * the About box (Presets panel), never on the video.
 *
 *   Chaos         Hénon map, Ikeda map (a laser in a ring cavity), the logistic map's road to chaos,
 *                 the driven Duffing oscillator
 *   Nature & life Barnsley's fern (4 rules + chance), predator and prey (Lotka–Volterra),
 *                 an epidemic (SIR), a heartbeat oscillator (van der Pol)
 *   Shapes        Viviani's curve, a loxodrome (constant compass bearing), a drum's modes (Bessel)
 *   Numbers       the spiral of Theodorus (√1, √2, √3 …), the Gibbs overshoot of Fourier series
 */
import { film, L, ODE, MAP, SURF, melody } from './science.js';

const TAU = Math.PI * 2;
const r3 = (v) => +v.toFixed(4);
const CHAOS = 'Science · Chaos & attractors', LIFE = 'Science · Nature & life', SHAPES = 'Science · Shapes in 3D', NUMBERS = 'Science · Numbers', SHOW = 'Showcase · Films';

const S = {
  henon: { label: 'Hénon map', url: 'https://en.wikipedia.org/wiki/H%C3%A9non_map' },
  ikeda: { label: 'Ikeda map', url: 'https://en.wikipedia.org/wiki/Ikeda_map' },
  logistic: { label: 'Logistic map (bifurcation, Feigenbaum)', url: 'https://en.wikipedia.org/wiki/Logistic_map' },
  duffing: { label: 'Duffing oscillator', url: 'https://en.wikipedia.org/wiki/Duffing_equation' },
  fern: { label: 'Barnsley fern (scipython)', url: 'https://scipython.com/book/chapter-7-matplotlib/examples/the-barnsley-fern' },
  lv: { label: 'Lotka–Volterra equations', url: 'https://en.wikipedia.org/wiki/Lotka%E2%80%93Volterra_equations' },
  sir: { label: 'SIR model', url: 'https://en.wikipedia.org/wiki/Compartmental_models_in_epidemiology' },
  vdp: { label: 'Van der Pol oscillator', url: 'https://en.wikipedia.org/wiki/Van_der_Pol_oscillator' },
  viviani: { label: 'Viviani’s curve', url: 'https://en.wikipedia.org/wiki/Viviani%27s_curve' },
  lox: { label: 'Rhumb line (loxodrome)', url: 'https://en.wikipedia.org/wiki/Rhumb_line' },
  drum: { label: 'Vibrations of a circular membrane', url: 'https://en.wikipedia.org/wiki/Vibrations_of_a_circular_membrane' },
  theodorus: { label: 'Spiral of Theodorus', url: 'https://en.wikipedia.org/wiki/Spiral_of_Theodorus' },
  gibbs: { label: 'Gibbs phenomenon (MIT OCW)', url: 'https://ocw.mit.edu/courses/18-03sc-differential-equations-fall-2011/' },
};

/** Partial sum of the square wave's Fourier series with `n` odd terms: (4/π) Σ sin((2k−1)x)/(2k−1). */
const squareSum = (n) => `(4/pi)*(${Array.from({ length: n }, (_, k) => `sin(${2 * k + 1}*x)/${2 * k + 1}`).join('+')})`;
const IKEDA_T = '(0.4-6/(1+x^2+y^2))';
// four affine rules, picked by chance (1%, 85%, 7%, 7%); rand(n) is the same number in both lines
const R1 = '(1-step(0.01,rand(n)))', R2 = '(step(0.01,rand(n))-step(0.86,rand(n)))', R3 = '(step(0.86,rand(n))-step(0.93,rand(n)))', R4 = 'step(0.93,rand(n))';
const FERN = {
  x: `${R2}*(0.85*x+0.04*y)+${R3}*(0.2*x-0.26*y)+${R4}*(-0.15*x+0.28*y)`,
  y: `${R1}*0.16*y+${R2}*(-0.04*x+0.85*y+1.6)+${R3}*(0.23*x+0.22*y+1.6)+${R4}*(0.26*x+0.24*y+0.44)`,
};

export const SCIENCE2_PRESETS = [
  /* ------------------------------------------------------------ chaos */
  film('Hénon’s Strange Attractor', {
    cat: CHAOS, mode: '2d', ext: 0.75, D: 26, c1: '#9fe8ff', backdrop: 'blueprint', light2: '#4f9bff', bloom: 0.35, loop: 'fade',
    layers: [MAP('Hénon', { x: '0.3*y', y: '1-1.4*y^2+x' }, { samples: 60000, color: '#9fe8ff', color2: '#ffffff', sim: { alpha: 0.3, skip: 50 } }), melody('C4 E4 G4 B4 D5 B4 G4 E4 A3 C4 E4 G4 B4 G4 E4 C4', { wave: 'e-piano', melodyLoops: 2 })],
    hook: 'Two lines of algebra, infinite detail', title: 'Hénon’s strange attractor: zoom in, it never ends 🔍',
    about: { math: 'xₙ₊₁ = 1 − 1.4·xₙ² + yₙ, yₙ₊₁ = 0.3·xₙ (Michel Hénon, 1976), drawn on its side: 60 000 points.', aha: 'The thin curve is really many curves, and each of those is many curves again: a fractal made by stretching and folding a plane, two lines of algebra.', why: 'Hénon built it as the simplest model of the Lorenz attractor’s cross-section; it is used to test chaos-detection methods.', sources: [S.henon] },
  }),
  film('Ikeda: Light in a Ring', {
    cat: CHAOS, mode: '2d', ext: 1.45, D: 28, c1: '#ff9a5a', backdrop: 'nebula', light2: '#ff5a8a', motion: 'drift', bloom: 0.35, loop: 'fade',
    layers: [MAP('Ikeda', { x: `1+0.9*(x*cos${IKEDA_T}-y*sin${IKEDA_T})`, y: `0.9*(x*sin${IKEDA_T}+y*cos${IKEDA_T})` }, { samples: 70000, colorMode: 'rainbow', sim: { alpha: 0.2, skip: 50, cx: 0.6, cy: -0.75 } }), melody('D4 F4 A4 D5 C5 A4 F4 E4 G4 Bb4 D5 Bb4', { wave: 'glass-pad', melodyLoops: 2 })],
    hook: 'A laser beam going round and round', title: 'The Ikeda map: light trapped in a ring of glass 🔦',
    about: { math: 'zₙ₊₁ = 1 + 0.9·zₙ·e^{i(0.4 − 6/(1 + |zₙ|²))} written in x and y: each round trip the light is weakened (0.9) and turned by an angle that depends on its brightness.', aha: 'Brightness-dependent turning is enough to scramble the beam into a spiral strange attractor.', why: 'Kensuke Ikeda’s 1979 model of a laser in a ring cavity with a nonlinear medium.', sources: [S.ikeda] },
  }),
  film('The Road to Chaos (Logistic Map)', {
    cat: SHOW, mode: '2d', ext: 0.85, D: 36, c1: '#ffd166', backdrop: 'grain', bloom: 0.4, open: 'bars', climax: 'surge', climaxAt: 0.64, finale: 'slow', ending: 'reveal', endingSecs: 4.5,
    layers: [MAP('Logistic map', { x: 'y*x*(1-x)', y: '2.8+1.2*n/90000' }, { samples: 90000, colorMode: 'gradient', color: '#5ee0ff', color2: '#ffd166', sim: { x0: 0.5, y0: 2.8, alpha: 0.28, skip: 0, cx: 0.5, cy: 3.4, scale: 1.55 } }), melody('C4 C5 C4 C5 G4 C5 E4 G4 C5 E5 G4 B4 D5 F#5 A5 C#5', { wave: 'kalimba', melodyLoops: 1 })],
    hook: 'One equation, from calm to chaos', title: 'The road to chaos: 1 → 2 → 4 → 8 → ∞ ⚡',
    about: { math: 'xₙ₊₁ = r·xₙ(1 − xₙ), with r rising slowly from 2.8 (bottom) to 4.0 (top); across the frame is where x settles.', aha: 'One value, then 2 (r = 3), 4 (r ≈ 3.449), 8 … each split comes 4.669 times sooner than the last (Feigenbaum’s constant, the same for many systems), and at r ≈ 3.5699 chaos begins. Inside the chaos a window of period 3 opens near r = 1 + √8 ≈ 3.83.', why: 'A simple model of a population with limited food; Robert May’s 1976 paper made it famous.', look: 'Bars open, the glow surges right when chaos begins (64% of the way), then a slow reveal.', sources: [S.logistic] },
  }),
  film('Duffing: A Driven Spring Goes Wild', {
    cat: CHAOS, mode: '2d', ext: 1.25, D: 30, c1: '#ff4f8a', backdrop: 'scanlines', light2: '#ff4f8a', fx: 'comet', tail: 0.12, bloom: 0.45, open: 'handheld', climax: 'zoomhit', ending: 'dutch',
    yr: [-1.2, 1.2], scale: 'phrygian', root: 4,
    layers: [ODE('Duffing', { x: 'y', y: '-0.3*y+x-x^3+0.5*cos(1.2*s)', z: '0' }, { x0: 1, y0: 0, z0: 0, dt: 0.01, skip: 0 }, { samples: 20000, color: '#ff4f8a', color2: '#ffd166', wave: 'synth-pluck', width: 2.2 })],
    hook: 'A pushed spring that never settles', title: 'The Duffing oscillator: a spring pushed into chaos 🌀',
    about: { math: "x'' + 0.3x' − x + x³ = 0.5·cos(1.2t): a spring with two dips (a double well), friction, and a periodic push. Drawn: position across, speed up and down.", aha: 'With a push of 0.2 it settles into a loop; at 0.5 it hops between the two wells at random-looking times, though nothing random is in the equation.', why: 'Georg Duffing, 1918; it models a steel beam between two magnets and stiffening springs.', sources: [S.duffing] },
  }),

  /* ---------------------------------------------------------- nature & life */
  film('Barnsley’s Fern: Four Rules and Chance', {
    cat: LIFE, mode: '2d', ext: 0.75, D: 30, c1: '#7bd389', bg: '#020603', backdrop: 'vignette', light2: '#3fa34d', bloom: 0.3, open: 'push', finale: 'bars', ending: 'rise',
    layers: [MAP('Fern', FERN, { samples: 90000, colorMode: 'gradient', color: '#2e7d32', color2: '#c5f27a', sim: { x0: 0, y0: 0, alpha: 0.35, skip: 20, cy: 5, scale: 0.24 } }), melody('G3 B3 D4 G4 A4 B4 D5 G5 E5 D5 B4 A4 G4 D4 B3 G3', { wave: 'harp', melodyLoops: 1 })],
    hook: 'A fern from four rules and a dice', title: 'Barnsley’s fern: four rules and chance grow a leaf 🌿',
    about: { math: 'Start at (0, 0). Each step roll a dice: 1% → (0, 0.16y) the stem; 85% → (0.85x + 0.04y, −0.04x + 0.85y + 1.6) the next leaflet up; 7% each → the big left and right leaflets.', aha: 'Each rule shrinks the whole fern onto one of its parts, so every leaflet is a small fern. Michael Barnsley showed in 1988 that such “iterated function systems” can draw natural shapes with a handful of numbers.', why: 'Image compression with fractals, and models of how plants grow.', sources: [S.fern] },
  }),
  film('Foxes and Rabbits (Lotka–Volterra)', {
    cat: LIFE, mode: '2d', ext: 1.45, D: 30, c1: '#ffb347', backdrop: 'gradient', light2: '#7bd389', fx: 'tube', tail: 0.4, bloom: 0.4, open: 'follow', loop: 'fade',
    yr: [-1, 1], scale: 'pentatonic', root: 7,
    layers: [3, 5.5, 8.5].map((x0, i) => ODE(`Start ${i + 1}: ${x0} rabbits`, { x: '1.1*x-0.4*x*y', y: '0.1*x*y-0.4*y', z: '0' }, { x0, y0: 1.6, z0: 0, dt: 0.01, skip: 0, cx: 6.5, cy: 3.4, scale: 0.19 }, { samples: 3000, color: ['#ffd166', '#ff9a5a', '#ff5a8a'][i], color2: '#7bd389', wave: ['marimba', 'kalimba', 'harp'][i], volume: [0.9, 0.5, 0.4][i], octave: i, caption: i ? '-' : "rabbits' = 1.1r − 0.4rf,  foxes' = 0.1rf − 0.4f" })),
    hook: 'Why do foxes and rabbits rise and fall?', title: 'Predator and prey: the endless chase in one loop 🦊🐇',
    about: { math: "Rabbits r and foxes f: r' = 1.1r − 0.4rf, f' = 0.1rf − 0.4f. Drawn as rabbits across, foxes up, from three starts.", aha: 'More rabbits → more foxes → fewer rabbits → fewer foxes → more rabbits. Each start gives its own closed loop: a quantity (0.1r − 0.4 ln r + 0.4f − 1.1 ln f) never changes, so nothing settles and nothing dies out.', why: 'Lotka (1910) and Volterra (1926), the latter to explain fish catches in the Adriatic after the First World War; Hudson’s Bay Company lynx and hare records show the same cycles.', sources: [S.lv] },
  }),
  film('An Epidemic: Flattening the Curve (SIR)', {
    cat: LIFE, mode: '2d', ext: 1.45, D: 30, c1: '#ff5a5a', backdrop: 'grain', fx: 'tube', tail: 0.6, bloom: 0.35, open: 'push', climax: 'surge', climaxAt: 0.45, ending: 'cinema',
    yr: [-0.5, 0.5], scale: 'minor', root: 9, sequence: false,
    layers: [
      ODE('R₀ = 3', { x: '-0.3*x*y', y: '0.3*x*y-0.1*y', z: '0.1*y' }, { x0: 0.99, y0: 0.01, z0: 0, dt: 0.1, skip: 0, cx: 0.5, cy: 0.16, scale: 2.6 }, { samples: 2000, color: '#ff5a5a', color2: '#ffd166', wave: 'e-piano', caption: "S' = −βSI,  I' = βSI − γI,  R' = γI" }),
      ODE('R₀ = 1.5', { x: '-0.15*x*y', y: '0.15*x*y-0.1*y', z: '0.1*y' }, { x0: 0.99, y0: 0.01, z0: 0, dt: 0.1, skip: 0, cx: 0.5, cy: 0.16, scale: 2.6 }, { samples: 2000, color: '#5ee0ff', color2: '#7bd389', wave: 'triangle', volume: 0.5, octave: 1, caption: '-' }),
    ],
    hook: 'Why flattening the curve works', title: 'An epidemic in one picture: flattening the curve 📉',
    about: { math: "S healthy, I ill, R recovered (fractions): S' = −βSI, I' = βSI − γI, R' = γI with γ = 0.1 per day; red β = 0.3 (R₀ = 3), blue β = 0.15 (R₀ = 1.5). Drawn: S across, I up, over 200 days.", aha: 'Halving contacts does not just halve the peak: the blue peak is far lower and far fewer people ever get ill, and the epidemic stops before everyone is infected, once S falls below 1/R₀ (herd immunity).', why: 'Kermack and McKendrick, 1927; the basis of the models used during COVID-19.', sources: [S.sir] },
  }),
  film('Heartbeat Oscillator (van der Pol)', {
    cat: LIFE, mode: '2d', ext: 2.3, D: 30, c1: '#ff4f6a', backdrop: 'rings', light2: '#ff4f6a', fx: 'pulse', tail: 0.5, bloom: 0.45, loop: 'fade', params: { a: 0.2 },
    keys: { 'params.a': [{ time: 0, value: 0.2, ease: 'smooth' }, { time: 15, value: 2.4, ease: 'smooth' }, { time: 30, value: 0.2, ease: 'smooth' }] },
    yr: [-3, 3], scale: 'minorPentatonic', root: 9,
    layers: [ODE('Van der Pol', { x: 'y', y: 'a*(1-x^2)*y-x', z: '0' }, { x0: 0.5, y0: 0, z0: 0, dt: 0.01, skip: 0 }, { samples: 5000, color: '#ff4f6a', color2: '#ffd1dc', wave: 'marimba', width: 2.6 })],
    hook: 'The shape of a heartbeat', title: 'The van der Pol oscillator: from a circle to a heartbeat ❤️',
    about: { math: "x'' − μ(1 − x²)x' + x = 0: negative friction when small, positive when large; μ grows from 0.2 to 2.4 and back. Drawn: position across, speed up.", aha: 'Every start ends on the same loop (a limit cycle). Small μ gives a smooth circle; large μ gives slow build-ups and sudden jumps, a relaxation oscillation, like a heartbeat.', why: 'Balthasar van der Pol, 1927, studying radio valves; later used as a model of the heart’s pacemaker.', sources: [S.vdp] },
  }),

  /* ---------------------------------------------------------- shapes */
  film('Viviani’s Curve', {
    cat: SHAPES, mode: '3d', ext: 5, D: 26, c1: '#c58cff', backdrop: 'cosmos', light2: '#8b7bff', fx: 'rainbow', tail: 0.5, bloom: 0.45, open: 'orbit', loop: 'wrap',
    yr: [-1, 1], scale: 'lydian', root: 4,
    layers: [
      L('Viviani’s curve', 'parametric', { x: '2*sin(s/2)', y: 'cos(s)', z: 'sin(s)' }, { range: { min: 0, max: r3(2 * TAU) }, samples: 2400, wave: 'glass-pad', width: 3.2, caption: 'x = 2 sin(t/2), y = cos t, z = sin t' }),
      SURF('Sphere (radius 2)', { x: '2*sin(v)*cos(u)', y: '-1+2*cos(v)', z: '2*sin(v)*sin(u)', pv: '1.5708' }, { min: 0, max: r3(TAU) }, { vMin: 0, vMax: r3(Math.PI), nu: 48, nv: 24, solid: 0.02, wire: 0.07 }, { volume: 0, color: '#7aa8ff', color2: '#7aa8ff', caption: '-', width: 1 }),
      SURF('Cylinder (radius 1)', { x: 'u', y: 'cos(v)', z: 'sin(v)', pv: '0' }, { min: -2, max: 2 }, { vMin: 0, vMax: r3(TAU), nu: 16, nv: 40, solid: 0.02, wire: 0.07 }, { volume: 0, color: '#ff7ad9', color2: '#ff7ad9', caption: '-', width: 1 }),
    ],
    hook: 'Where a ball meets a tube', title: 'Viviani’s curve: a sphere and a cylinder cross in a figure eight ♾️',
    about: { math: 'A sphere of radius 2 and a cylinder of radius 1 that touches it inside and passes through its centre meet along x = 2 sin(t/2), y = cos t, z = sin t (t from 0 to 4π).', aha: 'The crossing is one closed figure-eight-like curve on the sphere; seen from the side it is the lemniscate of Gerono. Viviani posed it in 1692 as a puzzle about a dome with four windows.', sources: [S.viviani] },
  }),
  film('Loxodrome: Steady Compass to the Pole', {
    cat: SHAPES, mode: '3d', ext: 1.25, D: 28, c1: '#5ee0ff', backdrop: 'stars', light2: '#4f6bff', fx: 'tube', tail: 0.7, bloom: 0.45, open: 'spiral', ending: 'reveal',
    yr: [-1, 1], scale: 'dorian', root: 2,
    layers: [
      L('Loxodrome', 'parametric', { x: 'cos(s)/cosh(0.15*s)', y: 'tanh(0.15*s)', z: 'sin(s)/cosh(0.15*s)' }, { range: { min: -24, max: 24 }, samples: 4000, color: '#5ee0ff', color2: '#ffd166', wave: 'e-piano', width: 2.8, caption: 'latitude = gd(0.15·longitude)' }),
      SURF('Globe', { x: 'sin(v)*cos(u)', y: 'cos(v)', z: 'sin(v)*sin(u)', pv: '1.5708' }, { min: 0, max: r3(TAU) }, { vMin: 0, vMax: r3(Math.PI), nu: 36, nv: 18, solid: 0.02, wire: 0.07 }, { volume: 0, color: '#2a3a8f', color2: '#2a3a8f', caption: '-', width: 1 }),
    ],
    hook: 'Keep the same compass heading forever…', title: 'The loxodrome: steer one heading and spiral into the pole 🧭',
    about: { math: 'On a unit globe: (cos λ / cosh kλ, tanh kλ, sin λ / cosh kλ) with k = 0.15, so the latitude is the Gudermannian gd(kλ) of the longitude.', aha: 'Sailing a fixed compass bearing crosses every meridian at the same angle, so you circle the pole infinitely often yet arrive after a finite distance. On a Mercator map this spiral is a straight line, which is why sailors loved Mercator’s map.', sources: [S.lox] },
  }),
  film('A Drum’s Three Voices (Bessel)', {
    cat: SHOW, mode: '3d', ext: 1.3, D: 30, c1: '#ffcf5a', backdrop: 'rings', light2: '#ff8a3d', fx: 'tube', tail: 0.5, bloom: 0.4, open: 'orbit', climax: 'switch', styleTo: 'rainbow', climaxAt: 0.62, finale: 'both', ending: 'cinema', endingSecs: 4.5, params: { a: 0, b: 0 },
    keys: {
      'params.b': [{ time: 0, value: 0, ease: 'smooth' }, { time: 8, value: 0, ease: 'smooth' }, { time: 11, value: 1, ease: 'smooth' }, { time: 17, value: 1, ease: 'smooth' }, { time: 20, value: 0, ease: 'smooth' }],
      'params.a': [{ time: 0, value: 0, ease: 'smooth' }, { time: 17, value: 0, ease: 'smooth' }, { time: 20, value: 1, ease: 'smooth' }],
    },
    yr: [-0.5, 0.5], scale: 'chromatic', root: 0,
    layers: [
      SURF('Drum skin', { x: 'u*cos(v)', y: '0.45*cos(2*pi*0.8*t)*((1-a-b)*besselj(0,2.405*u)+b*besselj(1,3.832*u)*cos(v)+a*besselj(0,5.52*u))', z: 'u*sin(v)', pv: '14*u' }, { min: 0, max: 1 }, { vMin: 0, vMax: r3(TAU), nu: 40, nv: 64, solid: 0.12, wire: 0.45 }, { color: '#ff8a3d', color2: '#ffd166', wave: 'glass-pad', caption: 'J₀(2.405 r) → J₁(3.832 r) cos θ → J₀(5.520 r)' }),
      melody('C3 C3 C3 C3 F#3 F#3 F#3 F#3 B3 B3 B3 B3', { wave: 'sine', volume: 0.6, melodyLoops: 1 }),
    ],
    hook: 'Why drums don’t play chords', title: 'A drum’s three voices: Bessel modes of a circular skin 🥁',
    about: { math: 'A round drum skin vibrates in modes u = Jₙ(kr)·cos(nθ)·cos(ωt), where k makes the edge still: k = 2.405, 3.832, 5.520 … (zeros of Bessel functions). Shown: the (0, 1), (1, 1) and (0, 2) modes; the melody plays their pitch ratios 1 : 1.59 : 2.30.', aha: 'Unlike a string (1 : 2 : 3 …) the drum’s overtones are not whole multiples, which is why a drum sounds like a thud, not a note. The circles and lines that stay still are the nodal lines, like Chladni sand.', look: 'The style switches to rainbow when the third mode arrives.', sources: [S.drum] },
  }),

  /* ---------------------------------------------------------- numbers */
  film('The Spiral of Theodorus', {
    cat: NUMBERS, mode: '2d', ext: 1.05, D: 28, c1: '#ffd166', backdrop: 'paper', light: true, bloom: 0, open: 'push', ending: 'breath',
    layers: [MAP('√n triangles', { x: 'x-y/sqrt(x^2+y^2)', y: 'y+x/sqrt(x^2+y^2)', z: '0' }, { samples: 320, width: 18, volume: 0, colorMode: 'gradient', color: '#1e3a5f', color2: '#a33b1d', sim: { x0: 1, y0: 0, alpha: 1, skip: 0, scale: 0.055 } }), melody('C4 D4 E4 G4 A4 C5 D5 E5 G5 A5 G5 E5 D5 C5 A4 G4', { wave: 'music-box', melodyLoops: 2, volume: 0.6 })],
    hook: '√1, √2, √3 … a spiral of triangles', title: 'The spiral of Theodorus: √2, √3, √4 … 📐',
    about: { math: 'Each step adds a side of length 1 at a right angle to the line from the centre: (x, y) → (x − y/r, y + x/r). By Pythagoras the distance from the centre goes √1, √2, √3, √4 …', aha: 'Theodorus of Cyrene (5th century BC) is said to have proved that √3 … √17 are irrational, and the 17th triangle is exactly where the spiral first overlaps itself.', sources: [S.theodorus] },
  }),
  film('Gibbs: The 9% That Never Goes Away', {
    cat: NUMBERS, mode: '2d', D: 32, c1: '#5ee0ff', bg: '#04050a', backdrop: 'blueprint', light2: '#4f9bff', fx: 'tube', tail: 0.5, bloom: 0.4, sequence: true, past: 'ghost', ending: 'zoomout',
    view: { xMin: 0, xMax: r3(2 * TAU), yMin: -2.4, yMax: 2.4 }, yr: [-1.2, 1.2], scale: 'major', root: 0,
    layers: [1, 3, 9, 40].map((n, i) => L(`${n} term${n > 1 ? 's' : ''}`, 'function', { y: squareSum(n) }, { samples: n > 10 ? 3000 : 1600, color: ['#5ee0ff', '#7be0c3', '#ffd166', '#ff7a59'][i], color2: ['#5ee0ff', '#7be0c3', '#ffd166', '#ff7a59'][i], colorMode: 'solid', wave: ['sine', 'triangle', 'square', 'sawtooth'][i], volume: 0.7, caption: `${n} sine${n > 1 ? 's' : ''}: (4/π)Σ sin((2k−1)x)/(2k−1)` })),
    hook: 'Add sines and you get a square… almost', title: 'The Gibbs phenomenon: the overshoot that never shrinks 〽️',
    about: { math: 'The square wave of height ±1 is (4/π)(sin x + sin 3x/3 + sin 5x/5 + …). Shown: 1, 3, 9 and 40 terms, one after another.', aha: 'More terms make the wave squarer, but next to each jump it still overshoots to about 1.18, 9% of the jump, however many terms you add; the spike only gets narrower.', why: 'Seen in 1898 by Albert Michelson’s harmonic analyser; it causes ringing around sharp edges in compressed images and audio.', sources: [S.gibbs] },
  }),
];
