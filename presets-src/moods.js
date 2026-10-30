/**
 * Mood packs and showcase films. Each pack has its own rules:
 *
 *   Psychedelic  colour that flows, spinning backdrops, morphing parameters, kaleidoscopes
 *   Satisfying   perfect loops, steady rhythm, clean lines, things that line up
 *   ASMR         slow, soft, sparse: music box, kalimba, glass; no flashes, no shakes
 *   Minimal      one idea, one line, almost nothing else
 *   Showcase     films that use everything: several layers, acts, a style switch, bars, fades
 *
 * Every formula here is different from the other collections.
 */
import { film, L, MAP, SURF, ODE, melody } from './science.js';

const TAU = Math.PI * 2;
const r3 = (v) => +v.toFixed(4);
const PSY = 'Mood · Psychedelic', SAT = 'Mood · Satisfying', ASMR = 'Mood · ASMR', MIN = 'Mood · Minimal', SHOW = 'Showcase · Films';

/** Tautochrone swing period (scene seconds) for brachisto's default size, so loops close exactly. */
const tautPeriod = (slow) => { const R = Math.min(1.25 / 2, 0.96 / Math.PI), w = Math.sqrt(9.81 / (4 * R)); return TAU / w / slow; };

export const PSYCHEDELIC = [
  film('Kaleidoscope Rose 7/4', {
    cat: PSY, mode: '2d', ext: 1.25, D: 32, c1: '#ff4fd8', backdrop: 'plasma', light2: '#ff4fd8', motion: 'spin', fx: 'kaleido', copies: 6, tail: 0.6, bloom: 0.45, intensity: 0.85, loop: 'wrap', scale: 'lydian', root: 2,
    layers: [L('Rose 7/4', 'polar', { r: 'cos(7*theta/4)' }, { range: { min: 0, max: r3(8 * Math.PI) }, samples: 4000, colorMode: 'rainbow', wave: 'glass-pad', width: 2 })],
    hook: 'Stare into the middle', title: 'A kaleidoscope rose that never ends 🌸',
    about: { math: 'r = cos(7θ/4) for θ from 0 to 8π, copied six times round the centre.', aha: 'A fraction p/q in a rose needs q turns (×2) to close; 7/4 needs 8π, then repeats exactly, so the video loops.' },
  }),
  film('Rainbow Tunnel Spiral', {
    cat: PSY, mode: '2d', ext: 1.1, D: 30, c1: '#7aa8ff', backdrop: 'tunnel', light2: '#ff4fd8', motion: 'spin', fx: 'rainbowString', strings: 160, stringAlpha: 0.14, tail: 0.5, bloom: 0.4, intensity: 0.8, loop: 'fade', scale: 'wholeTone', root: 0, open: 'spiral',
    layers: [L('Double spiral', 'parametric', { x: '0.035*s*cos(s)', y: '0.035*s*sin(s)' }, { range: { min: 0, max: r3(9 * Math.PI) }, samples: 3000, wave: 'glass-pad' }), L('Mirror arm', 'parametric', { x: '-0.035*s*cos(s)', y: '-0.035*s*sin(s)' }, { range: { min: 0, max: r3(9 * Math.PI) }, samples: 3000, wave: 'triangle', volume: 0.5, octave: 1, caption: '-' })],
    hook: 'Fall into the spiral', title: 'A rainbow tunnel made of two spirals 🌈',
    about: { math: 'Two Archimedean spirals r = 0.035θ turned half a turn apart, strings to the centre, on a whole-tone scale (no home note, so it floats).', aha: 'Equal spacing between turns is what makes the Archimedean spiral look like a tunnel when it spins.' },
  }),
  film('Liquid Lissajous', {
    cat: PSY, mode: '3d', ext: 1.4, D: 30, c1: '#ff7ad9', backdrop: 'tunnel', light2: '#7aa8ff', motion: 'breathe', fx: 'rainbow', tail: 0.7, bloom: 0.45, loop: 'fade', params: { a: 0 }, scale: 'dorian', root: 4,
    keys: { 'params.a': [{ time: 0, value: 0, ease: 'linear' }, { time: 30, value: r3(TAU), ease: 'linear' }] },
    layers: [L('Lissajous 3:4:5', 'parametric', { x: 'sin(3*s)', y: 'sin(4*s+a)', z: 'sin(5*s+a/2)' }, { range: { min: 0, max: r3(TAU) }, samples: 2400, wave: 'e-piano', width: 2.6 })],
    hook: 'A knot of light that melts', title: 'Liquid Lissajous: the phase turns, the knot flows 💧',
    about: { math: 'x = sin 3s, y = sin(4s + a), z = sin(5s + a/2), with the phase a turning once round the circle during the video.', aha: 'Only the phase changes, never the frequencies, yet the knot keeps reshaping; after one full turn of a it is back where it began.' },
  }),
  film('Clifford Plasma Morph', {
    cat: PSY, mode: '2d', ext: 2.2, D: 30, c1: '#ffcf5a', backdrop: 'plasma', light2: '#7a5cff', motion: 'drift', bloom: 0.35, loop: 'fade', params: { a: 1.7, b: 1.7, c: 0.6, d: 1.2 },
    keys: { 'params.b': [{ time: 0, value: 1.7, ease: 'smooth' }, { time: 15, value: 1.95, ease: 'smooth' }, { time: 30, value: 1.7, ease: 'smooth' }], 'params.c': [{ time: 0, value: 0.6, ease: 'smooth' }, { time: 15, value: 0.4, ease: 'smooth' }, { time: 30, value: 0.6, ease: 'smooth' }] },
    layers: [MAP('Clifford', { x: 'sin(a*y)+c*cos(a*x)', y: 'sin(b*x)+d*cos(b*y)' }, { colorMode: 'rainbow', samples: 70000, sim: { alpha: 0.18 } }), melody('E4 G4 B4 D5 F#5 D5 B4 G4 C4 E4 G4 B4 D5 B4 G4 E4', { melodyLoops: 2 })],
    hook: 'Dust that dreams', title: 'A Clifford attractor melting through colours 🫧',
    about: { math: 'xₙ₊₁ = sin(a·yₙ) + c·cos(a·xₙ), yₙ₊₁ = sin(b·xₙ) + d·cos(b·yₙ); b and c drift and come back.', aha: 'Small changes in two numbers reshape 70 000 points at once.' },
  }),
  film('Superformula Bloom', {
    cat: PSY, mode: '2d', ext: 1.6, D: 28, c1: '#a4ff9e', backdrop: 'rays', light2: '#ff4fd8', motion: 'spin', fx: 'pulse', tail: 0.6, bloom: 0.45, loop: 'fade', params: { a: 4 }, scale: 'pentatonic', root: 9,
    keys: { 'params.a': [{ time: 0, value: 4, ease: 'smooth' }, { time: 14, value: 9, ease: 'smooth' }, { time: 28, value: 4, ease: 'smooth' }] },
    layers: [L('Superformula', 'polar', { r: '(abs(cos(a*theta/4))^0.9+abs(sin(a*theta/4))^0.9)^(-1.4)' }, { range: { min: 0, max: r3(TAU) }, samples: 3000, colorMode: 'rainbow', wave: 'kalimba', width: 2.6 })],
    hook: 'One formula, every flower', title: 'Gielis’ superformula blooming from 4 to 9 petals 🌺',
    about: { math: 'r = (|cos(mθ/4)|^0.9 + |sin(mθ/4)|^0.9)^(−1.4), with m (here a) growing from 4 to 9 and back.', aha: 'Johan Gielis showed in 2003 that this one formula draws starfish, leaves, flowers and squares.' },
  }),
  film('Glitch Hypocycloid', {
    cat: PSY, mode: '2d', ext: 1.2, D: 26, c1: '#38ff7a', backdrop: 'scanlines', light2: '#38ff7a', fx: 'glitchString', strings: 120, tail: 0.3, offset: 4.5, bloom: 0.4, intensity: 0.75, open: 'flash', climax: 'switch', styleTo: 'rainbow', ending: 'whiteout', scale: 'minorPentatonic', root: 4,
    layers: [L('Hypocycloid', 'parametric', { x: '(5/7)*cos(s)+(2/7)*cos(5*s/2)', y: '(5/7)*sin(s)-(2/7)*sin(5*s/2)' }, { range: { min: 0, max: r3(2 * TAU) }, samples: 3000, color: '#38ff7a', color2: '#ff4fd8', wave: 'synth-pluck', width: 2.6 })],
    hook: 'A star rolled out of a circle', title: 'A glitching hypocycloid 👾',
    about: { math: 'A circle of radius 2 rolling inside a circle of radius 7: x = (5/7)cos t + (2/7)cos(5t/2), y = (5/7)sin t − (2/7)sin(5t/2).', aha: 'R/r = 7/2 gives a star with 7 points that closes after the small circle turns twice.' },
  }),
];

export const SATISFYING = [
  film('Marching Ants on a 5:4 Knot', {
    cat: SAT, mode: '2d', ext: 1.15, D: 24, c1: '#ffd166', backdrop: 'gradient', light2: '#ff9d4a', fx: 'ants', tail: 0.6, bloom: 0.35, loop: 'wrap', scale: 'major', root: 2,
    layers: [L('Lissajous 5:4', 'parametric', { x: 'sin(5*s)', y: 'sin(4*s+0.5)' }, { range: { min: 0, max: r3(TAU) }, samples: 2400, color: '#ffd166', color2: '#ff7a59', wave: 'marimba', width: 3 })],
    hook: 'Follow one ant', title: 'Marching ants on a Lissajous knot 🐜',
    about: { math: 'x = sin 5t, y = sin(4t + 0.5); dashes move along the curve at a steady speed.', aha: 'A closed curve and a steady flow: the eye follows forever.' },
  }),
  film('Perfect Loop: Five-Petal Tube', {
    cat: SAT, mode: '2d', ext: 1.1, D: 20, c1: '#7be0c3', backdrop: 'vignette', light2: '#4fd1c5', fx: 'tube', tail: 0.35, bloom: 0.4, loop: 'wrap', scale: 'pentatonic', root: 0,
    layers: [L('Rose 5', 'polar', { r: 'cos(5*theta)' }, { range: { min: 0, max: r3(Math.PI) }, samples: 2000, color: '#7be0c3', color2: '#ffffff', wave: 'kalimba', width: 3.4 })],
    hook: 'Where does it start?', title: 'A perfect loop: the five-petal rose 🌼',
    about: { math: 'r = cos 5θ for θ from 0 to π: an odd rose closes after half a turn.', aha: 'The lit tail chases itself round the petals; the last frame is the first frame.' },
  }),
  film('Tautochrone Swing', {
    cat: SAT, mode: 'circle', rule: 'brachisto', lab: { kind: 'tautochrone', slow: 0.5, beads: 7 }, D: r3(6 * tautPeriod(0.5)), pal: 'candy', bg: '#05030a', inst: 'music-box', loopScene: true, hook: 'They never get out of step', title: 'Seven beads that always meet at the bottom 🎯',
    about: { math: 'Beads on a cycloid swing with s(t) = s₀ cos(ωt), ω = √(g/4R): the same period from any height.', aha: 'The video lasts exactly six swings, so it loops.' },
  }),
  film('Heapsort With Sound', {
    cat: SAT, mode: 'circle', rule: 'sorting', lab: { algo: 'heap', bars: 72, time: 24 }, D: 30, pal: 'rainbow', bg: '#04040a', inst: 'kalimba', ending: 'cinema', hook: 'Watch the order appear', title: 'Heapsort: chaos to order, with sound 📊',
    about: { math: 'Heapsort builds a heap (a tree where each parent beats its children) and then pulls the largest out, again and again: n log n steps.', aha: 'The pitch is the height of the bar being moved, so you hear the order forming.' },
  }),
  film('Beads on a Torus Knot', {
    cat: SAT, mode: '3d', ext: 3.4, D: 26, c1: '#ffcf5a', backdrop: 'gradient', light2: '#ff8a3d', fx: 'beads', strings: 220, bloom: 0.4, loop: 'fade', scale: 'major', root: 5,
    layers: [L('(3, 7) torus knot', 'parametric', { x: '(2+cos(7*s))*cos(3*s)', y: '-sin(7*s)', z: '(2+cos(7*s))*sin(3*s)' }, { range: { min: 0, max: r3(TAU) }, samples: 2200, color: '#ffcf5a', color2: '#ff5a8a', wave: 'marimba', width: 2.6 })],
    hook: 'Threading 220 beads', title: 'Beads threaded on a (3, 7) torus knot 📿',
    about: { math: 'x = (2 + cos 7t) cos 3t, z = (2 + cos 7t) sin 3t, y = −sin 7t: three times round the hole, seven times round the tube.', aha: '3 and 7 share no factor, so the string never crosses itself.' },
  }),
  film('Polyrhythm: 3, 4 and 5', {
    cat: SAT, mode: 'circle', rule: 'polygons', lab: {}, D: 30, pal: 'aurora', bg: '#02040a', inst: 'marimba', ending: 'reveal', hook: 'Every corner is a note', title: 'Polygon polyrhythm: 3 against 4 against 5 🔺🟦⬟',
    about: { math: 'Dots run round nested polygons at the same speed; each corner is a beat, so a triangle plays 3, a square 4, a pentagon 5 per lap.', aha: 'Together they line up only once per lap: a polyrhythm you can see.' },
  }),
];

export const ASMR_PACK = [
  film('Prime Ticks (ASMR)', {
    cat: ASMR, mode: 'circle', rule: 'primes', lab: { kind: 'sacks', max: 3000, rate0: 5, accel: 1.11, all: 0.05, euler: false, size: 1.4 }, D: 40, pal: 'pastel', bg: '#06060a', inst: 'music-box', ending: 'breath', sound: { volume: 0.7, length: 2.2 }, audio: { reverb: { decay: 5, mix: 0.45, tone: 0.5, preDelay: 0.03 } }, bpm: 70,
    hook: 'Every tick is a prime', title: 'Prime numbers, one soft tick at a time 🎐',
    about: { math: 'Numbers appear one by one on the Sacks spiral; each prime plays a soft music-box note.', aha: 'The gaps between ticks are the gaps between primes: irregular, but never random-sounding.' },
  }),
  film('Shepard Lullaby', {
    cat: ASMR, mode: 'circle', rule: 'shepard', lab: { step: 0.9, octaves: 5, centre: 60, width: 10, look: 'spiral' }, D: r3(0.9 * 12 * 3), pal: 'pastel', bg: '#05050a', inst: 'music-box', loopScene: true, sound: { volume: 0.65, length: 2.4 }, audio: { reverb: { decay: 5.5, mix: 0.5, tone: 0.45, preDelay: 0.03 } },
    hook: 'A lullaby that rises forever', title: 'A Shepard-scale lullaby 🌙',
    about: { math: 'The Shepard scale, slowed to one step every 0.9 s, five octaves, soft and dark.', aha: 'It climbs gently forever and loops after 36 steps.' },
  }),
  film('Fireflies at Dusk', {
    cat: ASMR, mode: 'circle', rule: 'kuramoto', lab: { count: 30, freq: 0.35, k0: 0, k1: 1.6, rise: 30, spread: 0.15 }, D: 44, pal: 'gold', bg: '#030503', inst: 'glass-pad', ending: 'breath', sound: { volume: 0.6, length: 2.6 }, audio: { reverb: { decay: 6, mix: 0.5, tone: 0.4, preDelay: 0.04 } },
    hook: 'Slowly, they find each other', title: 'Fireflies at dusk, slowly falling into step 🌾',
    about: { math: 'The Kuramoto model with a very slow rise of the pull.', aha: 'Soft flashes become one shared pulse over 40 seconds.' },
  }),
  film('Ink Spiral (Fermat)', {
    cat: ASMR, mode: '2d', ext: 1.15, D: 36, light: true, backdrop: 'paper', fx: 'ink', tail: 0.7, loop: 'fade', bpm: 70, scale: 'major', root: 5, articulation: 'pluck', reverb: 5,
    layers: [L('Fermat spiral', 'parametric', { x: '0.3*sqrt(s)*cos(s)', y: '0.3*sqrt(s)*sin(s)' }, { range: { min: 0, max: r3(14 * Math.PI) }, samples: 3000, color: '#1e3a5f', color2: '#6b1f2a', wave: 'harp', width: 2.2, volume: 0.7 }), L('Second arm', 'parametric', { x: '-0.3*sqrt(s)*cos(s)', y: '-0.3*sqrt(s)*sin(s)' }, { range: { min: 0, max: r3(14 * Math.PI) }, samples: 3000, color: '#6b1f2a', color2: '#1e3a5f', wave: 'harp', width: 2.2, volume: 0.4, octave: -1, caption: '-' })],
    hook: 'The sound of a pen on paper', title: 'Fermat’s spiral in ink 🖋️',
    about: { math: 'r = 0.3√θ and r = −0.3√θ: Fermat’s spiral, the same spiral as the sunflower’s seeds.', aha: 'The turns get closer together as they grow, so each lap covers the same area.' },
  }),
  film('Soft Rose Beads', {
    cat: ASMR, mode: '2d', ext: 1.15, D: 36, c1: '#ffb3c6', bg: '#0a0608', backdrop: 'bokeh', light2: '#ff7a9a', fx: 'beads', strings: 120, bloom: 0.3, intensity: 0.85, loop: 'fade', bpm: 70, scale: 'major', root: 0, reverb: 5.5,
    layers: [L('Rose 2/5', 'polar', { r: 'cos(2*theta/5)' }, { range: { min: 0, max: r3(10 * Math.PI) }, samples: 3000, color: '#ffb3c6', color2: '#ffd8a8', wave: 'kalimba', width: 2.4, volume: 0.6 })],
    hook: 'One bead, one note', title: 'A rose of soft beads 🌷',
    about: { math: 'r = cos(2θ/5) over 10π, beads at equal steps.', aha: 'Slow, even beats: one bead, one soft kalimba note.' },
  }),
  film('Ripples on Water (ASMR)', {
    cat: ASMR, mode: 'circle', rule: 'ripple', lab: {}, D: 36, pal: 'ocean', bg: '#020509', inst: 'glass-pad', ending: 'breath', sound: { volume: 0.6, length: 2.4 }, audio: { reverb: { decay: 6, mix: 0.5, tone: 0.4, preDelay: 0.03 } },
    hook: 'Where two ripples cancel, it is still', title: 'Two ripples, calm lines in between 💧',
    about: { math: 'Two circular waves add up; where crest meets trough they cancel and the sand stays still.', aha: 'The calm lines are hyperbolas: the points whose distances to the two sources differ by half a wavelength (and 1½, 2½ …).' },
  }),
];

export const MINIMAL = [
  film('One Circle', {
    cat: MIN, mode: '2d', ext: 1.2, D: 16, bg: '#000000', backdrop: 'grain', light2: '#ffffff', fx: 'comet', tail: 0.5, bloom: 0.25, loop: 'wrap', scale: 'pentatonic', root: 0, formulas: false,
    layers: [L('Circle', 'parametric', { x: 'cos(s)', y: 'sin(s)' }, { range: { min: 0, max: r3(TAU) }, samples: 1200, colorMode: 'solid', color: '#ffffff', color2: '#ffffff', wave: 'sine', width: 2.4 })],
    hook: 'x = cos t, y = sin t', title: 'One circle. One sine. ○',
    about: { math: 'x = cos t, y = sin t. The height is a sine wave, and so is the sound.', aha: 'Every wave and every rotation starts here.' },
  }),
  film('A Single Sine', {
    cat: MIN, mode: '2d', ext: 3.2, D: 16, bg: '#000000', backdrop: 'solid', fx: 'tube', tail: 0.4, bloom: 0.25, loop: 'fade', scale: 'continuous', root: 0, formulas: false, view: { xMin: 0, xMax: r3(4 * Math.PI), yMin: -6, yMax: 6 },
    layers: [L('Sine', 'function', { y: 'sin(x)' }, { samples: 1200, colorMode: 'solid', color: '#ffffff', color2: '#ffffff', wave: 'sine', width: 2.6 })],
    hook: 'y = sin x', title: 'y = sin x, and nothing else 〰️',
    about: { math: 'y = sin x for two periods; the pitch follows the height continuously.', aha: 'The purest tone there is has this exact shape.' },
  }),
  film('Square Becomes Circle', {
    cat: MIN, mode: '2d', ext: 1.25, D: 20, bg: '#000000', backdrop: 'grain', fx: 'tube', tail: 0.5, bloom: 0.25, loop: 'wrap', drawMode: 'trace', params: { a: 2 }, scale: 'major', root: 2, formulas: false,
    keys: { 'params.a': [{ time: 0, value: 2, ease: 'smooth' }, { time: 10, value: 12, ease: 'smooth' }, { time: 20, value: 2, ease: 'smooth' }] },
    layers: [L('Superellipse', 'parametric', { x: 'sign(cos(s))*abs(cos(s))^(2/a)', y: 'sign(sin(s))*abs(sin(s))^(2/a)' }, { range: { min: 0, max: r3(TAU) }, samples: 1600, colorMode: 'solid', color: '#ffffff', color2: '#ffffff', wave: 'triangle', width: 2.6 })],
    hook: '|x|ⁿ + |y|ⁿ = 1', title: 'A circle slowly becomes a square ◯→□',
    about: { math: 'The superellipse |x|ⁿ + |y|ⁿ = 1, drawn with x = sgn(cos t)|cos t|^(2/n), n going from 2 to 12 and back.', aha: 'n = 2 is a circle; as n grows the corners fill in. Piet Hein used n = 2.5 for a famous Stockholm square.' },
  }),
  film('Archimedes in White', {
    cat: MIN, mode: '2d', ext: 1.15, D: 20, bg: '#000000', backdrop: 'solid', fx: 'ink', tail: 0.6, bloom: 0.15, loop: 'fade', scale: 'pentatonic', root: 7, formulas: false,
    layers: [L('Archimedean spiral', 'polar', { r: '0.035*theta' }, { range: { min: 0, max: r3(10 * Math.PI) }, samples: 2400, colorMode: 'solid', color: '#ffffff', color2: '#ffffff', wave: 'sine', width: 2 })],
    hook: 'r = θ', title: 'r = θ ◎',
    about: { math: 'r = 0.035θ for five turns: the gaps between turns are all equal.', aha: 'The groove of a vinyl record follows this spiral.' },
  }),
  film('Figure Eight', {
    cat: MIN, mode: '2d', ext: 1.2, D: 16, bg: '#000000', backdrop: 'grain', fx: 'comet', tail: 0.45, bloom: 0.25, loop: 'wrap', scale: 'pentatonic', root: 5, formulas: false,
    layers: [L('Lissajous 1:2', 'parametric', { x: 'sin(s)', y: 'sin(2*s)' }, { range: { min: 0, max: r3(TAU) }, samples: 1200, colorMode: 'solid', color: '#ffffff', color2: '#ffffff', wave: 'sine', width: 2.6 })],
    hook: 'One against two', title: 'An octave, drawn: 1 : 2 ∞',
    about: { math: 'x = sin t, y = sin 2t: one swing across, two up and down.', aha: 'This is what an octave looks like on an oscilloscope.' },
  }),
  film('Breathing Circle', {
    cat: MIN, mode: '2d', ext: 1.3, D: 18, bg: '#000000', backdrop: 'solid', fx: 'tube', tail: 0.55, bloom: 0.3, loop: 'wrap', params: { a: 0 }, scale: 'major', root: 0, formulas: false,
    keys: { 'params.a': [{ time: 0, value: 0, ease: 'smooth' }, { time: 9, value: 0.12, ease: 'smooth' }, { time: 18, value: 0, ease: 'smooth' }] },
    layers: [L('Circle with a pulse', 'polar', { r: '1+a*sin(6*theta)' }, { range: { min: 0, max: r3(TAU) }, samples: 1600, colorMode: 'solid', color: '#ffffff', color2: '#ffffff', wave: 'sine', width: 2.4 })],
    hook: 'In … and out', title: 'Breathe with the circle ○',
    about: { math: 'r = 1 + a·sin 6θ, with a breathing from 0 to 0.12 and back.', aha: 'A gentle six-fold ripple, slow enough to breathe with.' },
  }),
];

const LORENZ = { x: '10*(y-x)', y: 'x*(28-z)-y', z: 'x*y-8/3*z' };

export const SHOWCASE = [
  film('Chaos Is Born', {
    cat: SHOW, mode: '3d', ext: 28, D: 40, c1: '#ff7a59', backdrop: 'stars', light2: '#6a5cff', motion: 'drift', fx: 'comet', tail: 0.2, bloom: 0.55, open: 'blackout', climax: 'switch', styleTo: 'rainbow', climaxAt: 0.6, finale: 'both', ending: 'reveal', endingSecs: 5,
    yr: [-22, 22], scale: 'dorian', root: 2,
    layers: [
      ODE('Start A', LORENZ, { x0: 1, y0: 1, z0: 1, dt: 0.006, up: 'z', cz: 25 }, { color: '#ff7a59', color2: '#ffd166', wave: 'e-piano', samples: 10000 }),
      ODE('Start B (+0.00001)', LORENZ, { x0: 1.00001, y0: 1, z0: 1, dt: 0.006, up: 'z', cz: 25 }, { color: '#5ee0ff', color2: '#7aa8ff', wave: 'triangle', volume: 0.5, octave: 1, samples: 10000, caption: '-' }),
      ODE('Start C (−0.00001)', LORENZ, { x0: 0.99999, y0: 1, z0: 1, dt: 0.006, up: 'z', cz: 25 }, { color: '#c58cff', color2: '#ff7ad9', wave: 'sine', volume: 0.4, octave: -1, samples: 10000, caption: '-' }),
    ],
    hook: 'Three paths. One hundred-thousandth apart.', title: 'Chaos is born: three paths split apart 🦋',
    about: { math: 'Three Lorenz paths from starts 0.00001 apart. The film rises out of black, follows them as one comet, switches to a rainbow style at the moment they split, slows into a final reveal with cinema bars.', aha: 'Shows the film tools: an opening (blackout), a climax (style switch) and a finale (slow motion + bars), all as keyframes you can edit.' },
  }),
  film('From a Circle to a Knot', {
    cat: SHOW, mode: '3d', ext: 3.4, D: 40, c1: '#9fe8ff', backdrop: 'gradient', light2: '#7aa8ff', fx: 'tube', tail: 0.5, bloom: 0.5, open: 'flash', climax: 'speed', finale: 'both', ending: 'whiteout', endingSecs: 4.5, sequence: true, past: 'ghost',
    yr: [-1.6, 1.6], scale: 'major', root: 0,
    layers: [
      L('1 · a circle', 'parametric', { x: '2*cos(s)', y: '0', z: '2*sin(s)' }, { range: { min: 0, max: r3(TAU) }, samples: 1200, color: '#9fe8ff', color2: '#ffffff', wave: 'sine' }),
      L('2 · a wave on the circle', 'parametric', { x: '2*cos(s)', y: '0.8*sin(5*s)', z: '2*sin(s)' }, { range: { min: 0, max: r3(TAU) }, samples: 1600, color: '#7be0c3', color2: '#ffd166', wave: 'triangle' }),
      L('3 · a (2, 3) trefoil', 'parametric', { x: '(2+cos(3*s))*cos(2*s)', y: '-sin(3*s)', z: '(2+cos(3*s))*sin(2*s)' }, { range: { min: 0, max: r3(TAU) }, samples: 2000, color: '#ffd166', color2: '#ff7a59', wave: 'marimba' }),
      L('4 · a (3, 8) knot', 'parametric', { x: '(2+cos(8*s))*cos(3*s)', y: '-sin(8*s)', z: '(2+cos(8*s))*sin(3*s)' }, { range: { min: 0, max: r3(TAU) }, samples: 2400, color: '#ff7ad9', color2: '#7aa8ff', wave: 'glass-pad' }),
    ],
    hook: 'How to tie a knot with maths', title: 'From a circle to a knot in four steps 🪢',
    about: { math: 'Four layers one after another: a circle, a wave carried round it, the (2, 3) trefoil, the (3, 8) torus knot. Earlier steps stay as ghosts.', aha: 'Shows sequence mode, a white flash in, a rush at the climax and a white-out ending.' },
  }),
  film('Riemann at Midnight', {
    cat: SHOW, mode: '2d', ext: 3.4, D: 40, c1: '#ffd166', backdrop: 'cosmos', light2: '#6a5cff', motion: 'zoom', fx: 'tube', tail: 0.25, bloom: 0.5, open: 'bars', climax: 'surge', finale: 'slow', ending: 'blackout', endingSecs: 5,
    yr: [-3, 3], scale: 'minorPentatonic', root: 9,
    layers: [L('ζ(½ + it)', 'parametric', { x: 'zetare(s)', y: 'zetaim(s)' }, { range: { min: 0, max: 56 }, samples: 7000, color: '#ffd166', color2: '#ff5a8a', wave: 'e-piano', width: 2.6, caption: 'ζ(½ + it)' })],
    hook: 'Every pass through the centre is a zero', title: 'The zeta function at midnight 🌌',
    about: { math: 'ζ(½ + it) for t from 0 to 56 (eleven zeros).', aha: 'Shows cinema bars opening the film, a glow surge, a slow-motion finale and a fade to black.' },
  }),
  film('Atom Dream', {
    cat: SHOW, mode: '3d', ext: 1.6, D: 36, c1: '#5ee0ff', backdrop: 'rings', light2: '#4f6bff', motion: 'breathe', fx: 'rainbow', tail: 0.6, bloom: 0.5, open: 'orbit', climax: 'surge', finale: 'both', ending: 'cinema', endingSecs: 5, params: { a: 0 },
    keys: { 'params.a': [{ time: 0, value: 0, ease: 'smooth' }, { time: 6, value: 0, ease: 'smooth' }, { time: 18, value: 1, ease: 'smooth' }, { time: 31, value: 1, ease: 'smooth' }] },
    yr: [-1.2, 1.2], scale: 'lydian', root: 2,
    layers: [
      SURF('Orbital', { x: 'abs((1-a)*0.5*(3*cos(v)^2-1)+a*2.4*sin(v)^2*cos(v)*sin(2*u))*sin(v)*cos(u)', y: 'abs((1-a)*0.5*(3*cos(v)^2-1)+a*2.4*sin(v)^2*cos(v)*sin(2*u))*cos(v)', z: 'abs((1-a)*0.5*(3*cos(v)^2-1)+a*2.4*sin(v)^2*cos(v)*sin(2*u))*sin(v)*sin(u)', pv: '1.5708+1.1*sin(4*u)' }, { min: 0, max: r3(TAU) }, { vMin: 0, vMax: r3(Math.PI), nu: 72, nv: 48, solid: 0.18, wire: 0.45 }, { color: '#5ee0ff', color2: '#ff7ad9', wave: 'glass-pad' }),
      melody('D4 A4 F#5 E5 D5 A4 B4 F#5 G4 D5 B5 A5', { wave: 'music-box', volume: 0.5, melodyLoops: 2 }),
    ],
    hook: 'What does an electron look like?', title: 'Atom dream: d_z² melts into an f orbital ⚛️',
    about: { math: 'r(θ, φ) = |Y|: d_z² (3cos²θ − 1) blended into f_xyz (sin²θ cosθ sin 2φ) by a keyframed a, with a music-box melody layer.', aha: 'Shows a parametric surface, a parameter keyframe and a melody layer together.' },
  }),
  film('Hopf Hypnosis', {
    cat: SHOW, mode: '3d', ext: 3.4, D: 32, c1: '#ff7ad9', backdrop: 'tunnel', light2: '#7a5cff', motion: 'spin', fx: 'pulse', tail: 0.6, bloom: 0.5, loop: 'wrap', open: 'orbit', scale: 'wholeTone', root: 0,
    layers: Array.from({ length: 10 }, (_, i) => {
      const th = i < 5 ? Math.PI / 2 : Math.PI / 3, ph = ((i % 5) / 5) * TAU + (i < 5 ? 0 : 0.6), a = Math.cos(th / 2), b = Math.sin(th / 2), d = `(1-${r3(b)}*sin(s+${r3(ph)}))`;
      return L(`Fibre ${i + 1}`, 'parametric', { x: `${r3(a)}*cos(s)/${d}`, y: `${r3(b)}*cos(s+${r3(ph)})/${d}`, z: `${r3(a)}*sin(s)/${d}` }, { range: { min: 0, max: r3(TAU) }, samples: 900, colorMode: 'rainbow', volume: i < 2 ? 0.6 : 0, wave: 'glass-pad', octave: i, caption: i ? '-' : 'Hopf fibres' });
    }),
    hook: 'Ten circles, all linked', title: 'Hopf hypnosis: ten linked circles, pulsing 🌀',
    about: { math: 'Ten Hopf fibres on two tori, each a circle linked with all the others; pulse style, spinning tunnel backdrop, seamless loop.', aha: 'Shows a perfect loop: the tails chase themselves, the backdrop spin and the orbit both complete exactly one cycle.' },
  }),
];

export const MOOD_PRESETS = [...PSYCHEDELIC, ...SATISFYING, ...ASMR_PACK, ...MINIMAL, ...SHOWCASE];
