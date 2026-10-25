/**
 * Lessons for the circle of fifths and the roots of unity (src/circle/theory.js): one
 * simulation, several modes, one idea per step.
 */
import { circleLesson as L } from './kit.js';

export const THEORY = [
  L('The Circle of Fifths', 'fifths', [
    { lab: { mode: 'walk', chord: 'power', every: 1.5, steps: 8 }, say: 'Each step up is a perfect fifth: one more ♯' },
    { lab: { mode: 'family', prog: 'I V vi IV', chord: 'triad', every: 2 }, say: 'Neighbours on the wheel make the chords of a key' },
    { lab: { mode: 'scale', every: 1 }, say: 'Seven neighbours in a row are a major scale' },
    { lab: { mode: 'relative', chord: 'triad', every: 2, steps: 5 }, say: 'Inside the wheel: each key’s minor twin' },
    { lab: { mode: 'comma', every: 1 }, say: 'Twelve fifths never quite close the circle' },
  ], { palette: 'rainbow', instrument: 'e-piano', duration: 70, bpm: 96, hook: 'How does the circle of fifths work?', title: 'The circle of fifths, step by step 🎹', tags: 'circle of fifths, music theory, chords, scales, learn music, shorts', desc: 'Walking the keys, chords as neighbours, the scale as seven neighbours, relative minors and the Pythagorean comma, on one wheel.' }),

  L('Roots of Unity', 'roots', [
    { lab: { mode: 'roots', n: 3, n2: 8, every: 0.5 }, say: 'z^n = 1 has n roots: they make a regular polygon' },
    { lab: { mode: 'roots', n: 12, n2: 12, every: 0.5, primitive: true }, say: 'Gold: the roots that can build all the others' },
    { lab: { mode: 'power', n: 7, m: 3, every: 1 }, say: 'The powers of one root draw a star' },
    { lab: { mode: 'multiply', rho: 1, angle: 90, steps: 8, every: 1.5 }, say: 'Multiplying by i turns a quarter turn' },
    { lab: { mode: 'sum', n: 5, n2: 5, every: 0.75 }, say: 'All the roots add up to zero' },
    { lab: { mode: 'euler', to: 1, sweep: 8, every: 0.5 }, say: 'e^(iπ) = −1' },
  ], { palette: 'neon', instrument: 'marimba', duration: 84, bpm: 100, audio: { scale: 'pentatonic', root: 0, noteLow: 55, noteHigh: 84 }, hook: 'What are the roots of unity?', title: 'Roots of unity and complex numbers, step by step 🔢', tags: 'roots of unity, complex numbers, euler, math, learn math, shorts', desc: 'From the roots of z^n = 1 to Euler’s identity: polygons, primitive roots, powers and stars, rotation by multiplying, the vanishing sum.' }),

  L('Chords on the Wheel', 'fifths', [
    { lab: { mode: 'family', key: '0', prog: 'I V vi IV', chord: 'triad', every: 2 }, say: 'Pop: I V vi IV, all neighbours of C' },
    { lab: { mode: 'family', key: '2', prog: 'I V vi iii IV I IV V', chord: 'triad', every: 2, names: 'sharps' }, say: 'Pachelbel’s Canon in D stays close too' },
    { lab: { mode: 'family', key: '4', prog: 'I I IV I V IV I V', chord: 'power', every: 2, base: 40 }, say: 'Rock: I IV V, three neighbours' },
  ], { palette: 'candy', instrument: 'house-piano', duration: 48, bpm: 100, hook: 'Why do some chords belong together?', title: 'Chord progressions on the circle of fifths 🎶', tags: 'chord progressions, circle of fifths, music theory, shorts', desc: 'Pop, Pachelbel and rock: three famous progressions, each a small neighbourhood on the wheel.' }),

  L('Complex Rotation', 'roots', [
    { lab: { mode: 'multiply', rho: 1, angle: 90, steps: 8, every: 1.5 }, say: 'Multiply by i: a quarter turn' },
    { lab: { mode: 'multiply', rho: 1, angle: 60, steps: 12, every: 1 }, say: 'Multiply by e^(i·60°): a sixth of a turn' },
    { lab: { mode: 'multiply', rho: 0.93, angle: 25, steps: 32, every: 0.5 }, say: 'Turn and shrink: a spiral' },
    { lab: { mode: 'euler', to: 2, sweep: 12, every: 0.5 }, say: 'Sine and cosine: the two shadows of the point' },
  ], { palette: 'aurora', instrument: 'e-piano', duration: 56, bpm: 100, audio: { scale: 'pentatonic', root: 0, noteLow: 55, noteHigh: 84 }, hook: 'What does multiplying by a complex number do?', title: 'Multiplying complex numbers is turning ↻', tags: 'complex numbers, rotation, euler, math, learn math, shorts', desc: 'Multiplication by a complex number turns and scales: from a quarter turn to a spiral, and the shadows of the point give sine and cosine.' }),
];
