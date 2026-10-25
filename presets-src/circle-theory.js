/**
 * Circle Lab presets for the two theory scenes (src/circle/theory.js), vertical 9:16:
 *
 *   Circle of fifths   walk the keys up and down, chord progressions, scales, relative minors,
 *                      the Pythagorean comma, and a four-step story
 *   Roots of unity     the roots appear, grow, light up (primitive roots), powers and star
 *                      polygons, every step size, multiplying by i and spirals, the sum, Euler,
 *                      and a four-step story
 *
 * Each preset shows one ability of its scene (a mode and the options that go with it).
 */
import { Y, S } from './circle-stories.js';

const TAGS_MUSIC = 'circle of fifths, music theory, chords, keys, scales, learn music, math and music, shorts';
const TAGS_MATH = 'roots of unity, complex numbers, euler, math visualization, learn math, geometry, shorts';

/** Beats → seconds at a tempo, plus a little time to settle. */
const secs = (beats, bpm, extra = 3) => Math.ceil((beats * 60) / bpm + extra);

const T = (name, rule, lab, { look = {}, sound = {}, speed, duration, bpm = 100, audio = {}, hook, title, desc, tags, text } = {}) => ({
  name, mode: 'circle', transport: { duration, bpm },
  overlay: { layout: 4, name: { enabled: false } },
  visual: { aspect: '9:16' },
  audio: { scale: 'chromatic', root: 0, noteLow: 48, noteHigh: 72, reverb: { decay: 3, mix: 0.3 }, delay: { time: 0.375, feedback: 0.25, mix: 0.12 }, ...audio },
  circle: {
    rule, lab: { [rule]: lab },
    look: { trail: 'lines', ringWidth: 4, ambience: true, ...look },
    sound: { instrument: 'e-piano', pitch: 'angle', volume: 0.8, maxRate: 24, length: 0.9, ...sound },
    ...(speed ? { speed: { from: 1, to: 1, curve: 'linear', pulse: 0, ...speed } } : {}),
    ...(text ? { text } : {}),
  },
  hook: { text: hook },
  youtube: { title: `${title} #shorts`, description: `${desc}\n\nWhich one should I do next? 👇\n\n#shorts`, tags },
});

const F = (name, lab, o) => T(name, 'fifths', lab, { tags: TAGS_MUSIC, ...o });
const R = (name, lab, o) => T(name, 'roots', lab, { tags: TAGS_MATH, ...o });

const IN = (cat, p) => ({ ...p, $category: cat });

export const THEORY_PRESETS = [
  /* ---------------------------------------------------------------- circle of fifths */
  F('Circle of Fifths: Walk the Keys', { mode: 'walk', chord: 'power', every: 2, steps: 24, base: 48 }, {
    duration: secs(48, 110, 2), bpm: 110, look: { palette: 'rainbow' }, sound: { instrument: 'e-piano', length: 1.1 },
    hook: 'Every step is a perfect fifth', title: 'The circle of fifths: walk all 12 keys 🎹', speed: { from: 1, to: 1.25, curve: 'smooth' },
    desc: 'C → G → D → A → E → B … each step up is a perfect fifth (a frequency ratio of 3 : 2) and adds one sharp to the key. Twelve steps and you are back where you started. Power chords (root + fifth) play every key.',
  }),
  F('Circle of Fourths: Flats Going Down', { mode: 'walk', dir: 'down', chord: 'triad', names: 'flats', every: 2, steps: 12, base: 48 }, {
    duration: secs(24, 100, 3), look: { palette: 'sunset' }, sound: { instrument: 'harp', length: 1.3 },
    hook: 'Go the other way: add a flat every step', title: 'Circle of fourths: add a flat every step 🎼', speed: { from: 0.9, to: 1.1, curve: 'linear' },
    desc: 'The same wheel read anticlockwise: C → F → B♭ → E♭ → A♭ … each step up in fourths adds one flat. Triads this time. Jazz players know this as the “cycle of fourths”.',
  }),
  F('Pop Chords: I V vi IV', { mode: 'family', key: '0', prog: 'I V vi IV I V vi IV', chord: 'triad', every: 2, base: 48 }, {
    duration: secs(16, 96, 3), bpm: 96, look: { palette: 'candy' }, sound: { instrument: 'house-piano', length: 1.4 },
    hook: 'Four chords in thousands of songs', title: 'The four chords behind hundreds of pop songs 🎶', speed: { from: 1, to: 1, curve: 'linear', pulse: 0.5 },
    desc: 'C – G – Am – F: the I V vi IV progression sits right next to the key on the wheel (the neighbours C, G, F and the minors Am, Em, Dm). That closeness is why the chords sound so natural together.',
  }),
  F('Pachelbel’s Canon Chords in D', { mode: 'family', key: '2', prog: 'I V vi iii IV I IV V', chord: 'triad', every: 2, base: 50, names: 'sharps' }, {
    duration: secs(16, 84, 3), bpm: 84, look: { palette: 'gold' }, sound: { instrument: 'harp', length: 1.6 },
    hook: 'The most copied chords in music', title: 'Pachelbel’s Canon as a path on the circle of fifths 🎻', audio: { reverb: { decay: 4.5, mix: 0.4 } },
    desc: 'D – A – Bm – F♯m – G – D – G – A: the Canon in D (public domain). On the circle of fifths the whole piece stays inside one small neighbourhood.',
  }),
  F('Three-Chord Rock: I IV V in E', { mode: 'family', key: '4', prog: 'I I IV I V IV I V', chord: 'power', every: 2, base: 40 }, {
    duration: secs(16, 120, 3), bpm: 120, look: { palette: 'fire' }, sound: { instrument: 'synth-pluck', length: 0.55, drum: 'kick' },
    audio: { distortion: 0.3, reverb: { decay: 1.6, mix: 0.2 } }, speed: { from: 1, to: 1.2, curve: 'build' },
    hook: 'Three chords is all you need', title: 'Three chords, a thousand songs: I IV V in E 🎸', 
    desc: 'E, A and B are neighbours on the wheel: the three chords of rock and blues. Power chords (root + fifth) and a kick on every chord change.',
  }),
  F('A Scale Is Seven Neighbours (C)', { mode: 'scale', key: '0', every: 1, base: 48 }, {
    duration: secs(16, 100, 4), look: { palette: 'aurora' }, sound: { instrument: 'bell', length: 1.2 },
    hook: 'Seven notes in a row on the wheel', title: 'Why the major scale is seven neighbours 🔔', audio: { reverb: { decay: 4, mix: 0.4 } },
    desc: 'F C G D A E B: seven keys in a row on the circle of fifths. Play them in the order of pitch (C D E F G A B C) and you have the C major scale. Every major scale is seven neighbours of the wheel.',
  }),
  F('A Scale Is Seven Neighbours (E♭)', { mode: 'scale', key: '3', every: 1, base: 48, names: 'flats' }, {
    duration: secs(16, 100, 4), look: { palette: 'ocean' }, sound: { instrument: 'music-box', length: 1.2 },
    hook: 'Move the seven, change the key', title: 'Slide the seven neighbours: E♭ major 🎵', audio: { reverb: { decay: 3.5, mix: 0.35 } },
    desc: 'The same pattern, three steps round the wheel: E♭ major is the seven neighbours A♭ E♭ B♭ F C G D, with 3 flats in its key signature. Slide the seven and the key changes.',
  }),
  F('Major and Its Twin Minor', { mode: 'relative', chord: 'triad', every: 2, steps: 12, base: 48, names: 'mixed' }, {
    duration: secs(24, 96, 3), bpm: 96, look: { palette: 'pastel' }, sound: { instrument: 'e-piano', length: 1.0 },
    hook: 'Same notes, a different home', title: 'Every major key has a minor twin 👯', speed: { from: 1, to: 1.2, curve: 'smooth' },
    desc: 'C major and A minor use exactly the same notes and the same key signature: the minor sits just inside the major on the wheel. Each step plays the major chord, then its relative minor.',
  }),
  F('The Pythagorean Comma', { mode: 'comma', every: 1, base: 48 }, {
    duration: secs(14, 80, 6), bpm: 80, look: { palette: 'neon', ringWidth: 3 }, sound: { instrument: 'sine', length: 1.6, volume: 0.95 },
    audio: { reverb: { decay: 5, mix: 0.4 } },
    hook: 'Twelve fifths should come home. They don’t.', title: 'Why 12 perfect fifths never close the circle 🤯',
    desc: '(3/2)^12 = 129.746… but 2^7 = 128. Twelve perfect fifths overshoot seven octaves by 23.46 cents (the Pythagorean comma). At the end you hear the starting C against the twelfth C: two notes that should be the same, beating. Equal temperament hides the gap by shrinking every fifth a tiny bit.',
  }),
  /* a story: four ideas, one after another */
  IN('Music · Circle of fifths', S('Circle of Fifths in 4 Steps', Y('fifths', { mode: 'walk', chord: 'power', every: 1.5, steps: 8, base: 48 }, { look: { palette: 'rainbow' }, sound: { instrument: 'e-piano', length: 1 }, text: '1. Every step is a perfect fifth' }),
    [Y('fifths', { mode: 'family', prog: 'I V vi IV', chord: 'triad', every: 2, base: 48 }, { look: { palette: 'candy' }, sound: { instrument: 'house-piano', length: 1.3 }, text: '2. Neighbours make chords' }),
      Y('fifths', { mode: 'scale', every: 1, base: 48 }, { look: { palette: 'aurora' }, sound: { instrument: 'bell', length: 1.2 }, text: '3. Seven neighbours are a scale' }),
      Y('fifths', { mode: 'comma', every: 1, base: 48 }, { look: { palette: 'neon' }, sound: { instrument: 'sine', length: 1.6 }, text: '4. But twelve fifths never close' })],
    { duration: 56, bpm: 96, hook: 'The circle of fifths in four steps', title: 'The circle of fifths in 4 steps 🎹', tags: TAGS_MUSIC,
      desc: 'Keys, chords, scales and the comma that spoils the circle: one wheel, four ideas. Step by step.' })),

  /* ------------------------------------------------------------- roots of unity */
  R('Roots of Unity: z⁶ = 1', { mode: 'roots', n: 6, n2: 6, every: 1, labels: true }, {
    duration: secs(8, 100, 5), look: { palette: 'neon' }, sound: { instrument: 'marimba', length: 0.7 },
    audio: { scale: 'pentatonic', root: 0, noteLow: 55, noteHigh: 84 },
    hook: 'Six numbers whose sixth power is 1', title: 'The 6 roots of z⁶ = 1 make a hexagon ⬡',
    desc: 'The solutions of z⁶ = 1 are the six points e^(2πik/6) on the unit circle. They split the circle into six equal arcs and join into a regular hexagon. One note for each root.',
  }),
  R('Roots Grow: Triangle to Dodecagon', { mode: 'roots', n: 3, n2: 12, every: 0.5, labels: true }, {
    duration: secs(60, 130, 2), bpm: 130, look: { palette: 'rainbow' }, sound: { instrument: 'kalimba', length: 0.5 },
    audio: { scale: 'pentatonic', root: 0, noteLow: 55, noteHigh: 91 }, speed: { from: 1, to: 1.2, curve: 'build' },
    hook: 'What do the roots of z^n = 1 look like?', title: 'Roots of unity: n from 3 to 12 📐',
    desc: 'z³ = 1 gives a triangle, z⁴ = 1 a square, z⁵ = 1 a pentagon … every n gives a regular polygon. More roots, more notes: each polygon plays its own scale.',
  }),
  R('Primitive Roots Light Up (n = 12)', { mode: 'roots', n: 12, n2: 12, every: 0.5, primitive: true, labels: true }, {
    duration: secs(14, 100, 5), look: { palette: 'pastel' }, sound: { instrument: 'bell', length: 0.9 },
    audio: { scale: 'chromatic', noteLow: 60, noteHigh: 72 },
    hook: 'Only some roots can build all the others', title: 'Primitive roots of unity: 4 of 12 light up ✨',
    desc: 'A root e^(2πik/12) is primitive when its powers reach every other root: that happens exactly when k and 12 share no factor. For n = 12 that is k = 1, 5, 7, 11 (gold): φ(12) = 4.',
  }),
  R('Powers of a Root: a 7-Point Star', { mode: 'power', n: 7, m: 3, every: 1, labels: true }, {
    duration: secs(10, 100, 5), look: { palette: 'gold' }, sound: { instrument: 'harp', length: 1.1 },
    audio: { scale: 'pentatonic', noteLow: 55, noteHigh: 84 },
    hook: 'Take a root. Keep multiplying.', title: 'The powers of one root draw a star ⭐',
    desc: 'Let ω = e^(2πi·3/7). Its powers ω, ω², ω³ … jump 3 places each time and draw the star polygon {7/3}. After 7 steps it is back at 1 having visited every root: it generates them all.',
  }),
  R('Which Step Sizes Reach Every Root? (n = 12)', { mode: 'power', n: 12, all: true, every: 0.5, labels: true }, {
    duration: secs(60, 120, 3), bpm: 120, look: { palette: 'rainbow' }, sound: { instrument: 'marimba', length: 0.4 },
    audio: { scale: 'chromatic', noteLow: 48, noteHigh: 60 }, speed: { from: 1, to: 1, curve: 'linear' },
    hook: 'Which jumps visit all 12 points?', title: 'Step size and symmetry: only 1, 5, 7 and 11 reach all 12 🔢',
    desc: 'Jump m places round 12 points. If m and 12 share a factor you get stuck in a smaller polygon (m = 6: just 2 points!). Only m = 1, 5, 7, 11 visit all 12: the numbers coprime to 12.',
  }),
  R('Multiply by i: a Quarter Turn', { mode: 'multiply', rho: 1, angle: 90, steps: 8, every: 1.5, labels: true }, {
    duration: secs(14, 90, 4), bpm: 90, look: { palette: 'aurora' }, sound: { instrument: 'e-piano', length: 0.9 },
    audio: { scale: 'pentatonic', noteLow: 55, noteHigh: 84 },
    hook: 'What does multiplying by i do?', title: 'Multiplying by i turns a point 90° 🔄',
    desc: 'Multiply any complex number by i and it turns a quarter turn: 1 → i → −1 → −i → 1. Four times and you are back: i⁴ = 1.',
  }),
  R('A Spiral from Multiplying', { mode: 'multiply', rho: 0.93, angle: 25, steps: 32, every: 0.5, labels: true }, {
    duration: secs(16, 120, 4), bpm: 120, look: { palette: 'sunset' }, sound: { instrument: 'music-box', length: 0.6 },
    audio: { scale: 'minorPentatonic', root: 9, noteLow: 57, noteHigh: 93 },
    hook: 'Turn a little, shrink a little', title: 'Multiply by 0.93·e^(i·25°) and a spiral appears 🌀',
    desc: 'Multiplication by ρ·e^(iφ) turns by φ and scales by ρ. Do it again and again and the points follow a logarithmic spiral: the shape of shells and galaxies.',
  }),
  R('The Roots Always Add Up to Zero', { mode: 'sum', n: 3, n2: 7, every: 0.5, labels: true }, {
    duration: secs(30, 110, 2), bpm: 110, look: { palette: 'candy' }, sound: { instrument: 'synth-pluck', length: 0.45 },
    audio: { scale: 'pentatonic', noteLow: 55, noteHigh: 84 },
    hook: 'Add the roots. What is left?', title: 'The roots of unity always add up to 0 ➕',
    desc: '1 + ω + ω² + … + ω^(n−1) = 0. Put the vectors head to tail and they walk round a regular polygon and end exactly where they started. Try n = 3, 4, 5, 6, 7.',
  }),
  R('Euler’s Identity: e^(iπ) + 1 = 0', { mode: 'euler', to: 1, sweep: 10, every: 0.5, labels: true }, {
    duration: 16, bpm: 100, look: { palette: 'neon' }, sound: { instrument: 'glass-pad', length: 0.8, volume: 0.9 },
    audio: { scale: 'pentatonic', noteLow: 48, noteHigh: 84, reverb: { decay: 4, mix: 0.4 } },
    hook: 'The most beautiful equation in maths', title: 'Euler’s identity e^(iπ) + 1 = 0 🤯',
    desc: 'e^(iθ) = cos θ + i sin θ is a point going round the unit circle. After half a turn (θ = π) it lands on −1: e^(iπ) = −1. Two notes play the horizontal and vertical shadows of the point.',
  }),
  R('A Full Turn: e^(iθ) = cos θ + i sin θ', { mode: 'euler', to: 2, sweep: 14, every: 0.5, labels: true }, {
    duration: 20, bpm: 100, look: { palette: 'ocean' }, sound: { instrument: 'marimba', length: 0.6 },
    audio: { scale: 'minorPentatonic', root: 9, noteLow: 48, noteHigh: 84 },
    hook: 'Sine and cosine are shadows of one point', title: 'Sine and cosine are two shadows of one turning point 🎡',
    desc: 'A point at angle θ on the unit circle has x = cos θ and y = sin θ. Its shadow on the horizontal axis plays one note, its shadow on the vertical axis another: you hear the two waves.',
  }),
  IN('Math · Complex numbers', S('Complex Numbers in 4 Steps', Y('roots', { mode: 'roots', n: 6, n2: 6, every: 1 }, { look: { palette: 'neon' }, sound: { instrument: 'marimba', length: 0.7 }, text: '1. z⁶ = 1 has six roots' }),
    [Y('roots', { mode: 'power', n: 7, m: 3, every: 1 }, { look: { palette: 'gold' }, sound: { instrument: 'harp', length: 1 }, text: '2. Powers of one root draw a star' }),
      Y('roots', { mode: 'sum', n: 5, n2: 5, every: 0.75 }, { look: { palette: 'candy' }, sound: { instrument: 'synth-pluck', length: 0.5 }, text: '3. The roots add up to zero' }),
      Y('roots', { mode: 'euler', to: 1, sweep: 8, every: 0.5 }, { look: { palette: 'aurora' }, sound: { instrument: 'glass-pad', length: 0.8 }, text: '4. e^(iπ) = −1' })],
    { duration: 56, bpm: 100, audio: { scale: 'pentatonic', root: 0, noteLow: 55, noteHigh: 84 }, hook: 'Complex numbers in four steps', title: 'Roots of unity in 4 steps 🔢', tags: TAGS_MATH,
      desc: 'Six roots, a star from powers, the sum that vanishes, and Euler’s identity: four pictures of complex numbers on the unit circle.' })),
];
