/**
 * Math & waves lessons: short layered stories, one idea per step, a plain caption on every
 * step. They sit on their own shelf ("Circle · Math lessons") and also ship as an
 * importable pack file (packs/math-lessons.mmv.json, made by scripts/build-pack.mjs).
 */
import { Y, S } from './presets-stack.js';
import { LAB_PRESETS } from './presets-lab.js';

const TAGS = 'math, physics, waves, sound, education, learn, science, satisfying, shorts';
const lesson = (...a) => ({ ...S(...a), $category: 'Circle · Math lessons' });
const opts = (o) => ({ duration: 33, bpm: 100, tags: TAGS, ...o });

export const LESSON_PRESETS = [
  lesson('Lesson · What Is a Wave?',
    Y('travel', { lambdas: '0.9', speed: 0.45, show: 'rope' }, { look: { palette: 'ocean' }, sound: { instrument: 'synth-pluck', volume: 0.6 }, text: 'The beads only bob up and down…' }),
    [Y('travel', { lambdas: '0.9 0.5 0.3', every: 6, show: 'both' }, { look: { palette: 'ocean' }, sound: { instrument: 'synth-pluck', volume: 0.6 }, text: '…a shorter wave is a higher note…' }),
      Y('string', { modes: '1 2 3 4', every: 4 }, { look: { palette: 'aurora' }, sound: { instrument: 'harp', length: 0.8 }, text: '…and tied at both ends, only whole waves fit' })],
    opts({ hook: 'What is a wave, really?', title: 'What is a wave? Explained in 30 seconds 🌊', desc: 'Step 1: in a wave nothing travels but the shape; each bead only moves up and down. Step 2: speed = frequency × wavelength, so a shorter wave is a higher note. Step 3: a string tied at both ends only fits whole half-waves: the harmonics.' })),

  lesson('Lesson · The Harmonic Series',
    Y('string', { modes: '1 2 3 4 5 6', every: 3 }, { look: { palette: 'aurora' }, sound: { instrument: 'harp', length: 0.8 }, text: 'A string: 1, 2, 3 … loops…' }),
    [Y('tubes', { pipe: 'open', count: 6, every: 1.5, wait: 0.3 }, { look: { palette: 'gold' }, sound: { instrument: 'marimba', length: 0.6 }, text: '…an open tube: the same notes…' }),
      Y('tubes', { pipe: 'half', count: 6, every: 1.5, wait: 0.3 }, { look: { palette: 'gold' }, sound: { instrument: 'marimba', length: 0.6 }, text: '…close one end: only the odd ones' })],
    opts({ hook: 'Why do instruments sound different?', title: 'The harmonic series: why a flute and a clarinet differ 🎶', desc: 'A string and an open tube can sing every harmonic: 1, 2, 3, 4 … A tube closed at one end can only sing the odd ones: 1, 3, 5 … The dust in the tubes shows where the air stands still.' })),

  lesson('Lesson · Any Wave from Circles',
    Y('fourier', { wave: 'square', terms: 8, every: 2 }, { look: { palette: 'neon' }, sound: { instrument: 'e-piano', volume: 0.6 }, text: 'Circles add up to a square…' }),
    [Y('fourier', { wave: 'saw', terms: 8, every: 2 }, { look: { palette: 'sunset' }, sound: { instrument: 'e-piano', volume: 0.6 }, text: '…a sawtooth…' }),
      Y('fourier', { wave: 'triangle', terms: 5, every: 3 }, { look: { palette: 'aurora' }, sound: { instrument: 'e-piano', volume: 0.6 }, text: '…a triangle: any wave' })],
    opts({ hook: 'Can circles draw any shape?', title: 'Fourier series: circles that draw any wave 🔵', desc: 'Each spinning circle is one sine wave. Stack them, biggest first, and they draw a square wave, a sawtooth, a triangle. Sound works the same way: every note is a sum of sines.', tags: 'fourier series, epicycles, math, education, shorts' })),

  lesson('Lesson · Waves Add Up',
    Y('beats', { gaps: '2 1 0.5', every: 4 }, { look: { palette: 'gold' }, sound: { instrument: 'glass-pad', length: 1.2, volume: 0.6 }, text: 'Two close notes: a wobble…' }),
    [Y('ripple', { layout: 'line', steps: '2:0.3 2:0.18', spread: 0.4, every: 6, wait: 0.3 }, { look: { palette: 'ocean' }, sound: { instrument: 'glass-pad', length: 1.2, volume: 0.6 }, text: '…two sources: still lines…' }),
      Y('ripple', { steps: '3:0.25 5:0.2', every: 6, wait: 0.3 }, { look: { palette: 'ocean' }, sound: { instrument: 'glass-pad', length: 1.2, volume: 0.6 }, text: '…more sources: a pattern' })],
    opts({ hook: 'What happens when two waves meet?', title: 'When two waves meet: beats and interference 〰️', desc: 'Waves simply add. In time, two close notes drift in and out of step and you hear beats. In space, two sources make lines where crest meets trough and the water stays still.', tags: 'interference, beats, double slit, waves, physics, education, shorts' })),

  lesson('Lesson · Intervals Are Ratios',
    Y('scope', { intervals: '1:1 2:1', every: 5 }, { look: { palette: 'neon', bloom: 0.5 }, sound: { instrument: 'e-piano', length: 1.2, volume: 0.6 }, text: 'Same note, then an octave…' }),
    [Y('scope', { intervals: '3:2 4:3', every: 5 }, { look: { palette: 'neon', bloom: 0.5 }, sound: { instrument: 'e-piano', length: 1.2, volume: 0.6 }, text: '…a fifth and a fourth…' }),
      Y('scope', { intervals: '16:15 45:32', every: 5 }, { look: { palette: 'fire', bloom: 0.5 }, sound: { instrument: 'e-piano', length: 1.2, volume: 0.6 }, text: '…messy ratios sound tense' })],
    opts({ hook: 'Why do some notes sound good together?', title: 'Why some notes sound good together 🎹', desc: 'Two notes sound sweet when their frequencies make a simple ratio: 2:1 (octave), 3:2 (fifth), 4:3 (fourth). An oscilloscope shows it: simple ratios draw calm closed shapes, messy ones scribble.', tags: 'music theory, intervals, lissajous, harmony, math, shorts' })),

  lesson('Lesson · Moving Sound',
    Y('doppler', { machs: '0 0.6', every: 5 }, { look: { palette: 'fire' }, sound: { instrument: 'synth-pluck', volume: 0.6 }, text: 'Still, then moving: squeezed waves…' }),
    [Y('doppler', { machs: '1 1.6', every: 6 }, { look: { palette: 'fire' }, sound: { instrument: 'synth-pluck', volume: 0.6 }, text: '…faster than sound: a cone' })],
    opts({ duration: 26, hook: 'Why does a siren change its pitch?', title: 'The Doppler effect and the sonic boom 🚑', desc: 'A moving source squeezes the waves ahead (higher pitch) and stretches them behind (lower pitch). Faster than its own sound, the waves pile up into a cone: the sonic boom.', tags: 'doppler effect, sonic boom, sound, physics, education, shorts' })),

  lesson('Lesson · Invisible Fields',
    Y('filings', { setups: 'bar', every: 30 }, { look: { palette: 'neon' }, sound: { instrument: 'synth-pluck', volume: 0.55 }, text: 'A magnet…' }),
    [Y('filings', { setups: 'wire', every: 30, wait: 0.3 }, { look: { palette: 'gold' }, sound: { instrument: 'marimba', volume: 0.8 }, text: '…a wire with a current…' }),
      Y('filings', { setups: 'coil', every: 30, wait: 0.3 }, { look: { palette: 'gold' }, sound: { instrument: 'marimba', volume: 0.8 }, text: '…a coil: a magnet again' })],
    opts({ hook: 'Can electricity make a magnet?', title: 'From a magnet to a wire to a coil 🧲⚡', desc: 'Iron filings show the field of a bar magnet, of a single wire carrying a current (circles), and of a coil, which looks just like the bar magnet. That is how electromagnets and motors work.', tags: 'electromagnetism, magnetic field, iron filings, physics, education, shorts' })),

  lesson('Lesson · Numbers on a Circle',
    Y('times', { build: 2, morph: 4, to: 4 }, { look: { palette: 'rainbow' }, sound: { instrument: 'e-piano' }, text: 'Times tables on a circle…' }),
    [Y('chord', {}, { more: { chord: { step: '2/7', speed: 3.2 } }, look: { palette: 'gold', trailWidth: 1.4 }, sound: { instrument: 'marimba' }, text: '…a fraction closes into a star…' }),
      Y('phyllo', { rate0: 12, accel: 1.35 }, { look: { palette: 'gold' }, sound: { instrument: 'kalimba' }, text: '…the golden angle never repeats' })],
    opts({ hook: 'What do numbers look like on a circle?', title: 'Three secrets of numbers on a circle 🌻', desc: 'Multiply around a circle and a heart shape appears. Jump by a fraction and you close into a star. Jump by the golden angle and you never land twice: that is how sunflowers pack their seeds.', tags: 'times tables, golden angle, phyllotaxis, math, education, shorts' })),
];

/** The whole pack: the lessons plus the single-idea wave presets. */
export const PACK_NAME = 'Math & waves lessons';
const PACK_EXTRA = ['Harmonics on a String', 'Higher Note, Shorter Wave', 'Square Wave from Circles', 'Sawtooth from Circles', 'Beats', 'Music You Can See', 'Sonic Boom',
  'Open vs Closed Tubes', 'Double Slit', 'Beam Steering', 'Field Around a Wire', 'Draw a Field'];
export const lessonPack = () => [...LESSON_PRESETS, ...PACK_EXTRA.map((n) => LAB_PRESETS.find((p) => p.name === n)).filter(Boolean)];
