/**
 * Lessons for vibration & waves: one per simulation, plus longer stories that walk
 * through an idea with several simulations.
 */
import { circleLesson as L } from './kit.js';
import { Y, S as story } from '../circle-stories.js';

const TAGS = 'math, physics, waves, sound, education, learn, science, satisfying, shorts';
const opts = (o) => ({ duration: 33, bpm: 100, tags: TAGS, ...o });
const S = (...a) => story(...a);

export const STORIES = [
  S('Lesson · What Is a Wave?',
    Y('travel', { lambdas: '0.9', speed: 0.45, show: 'rope' }, { look: { palette: 'ocean' }, sound: { instrument: 'synth-pluck', volume: 0.6 }, text: 'The beads only bob up and down…' }),
    [Y('travel', { lambdas: '0.9 0.5 0.3', every: 6, show: 'both' }, { look: { palette: 'ocean' }, sound: { instrument: 'synth-pluck', volume: 0.6 }, text: '…a shorter wave is a higher note…' }),
      Y('string', { modes: '1 2 3 4', every: 4 }, { look: { palette: 'aurora' }, sound: { instrument: 'harp', length: 0.8 }, text: '…and tied at both ends, only whole waves fit' })],
    opts({ hook: 'What is a wave, really?', title: 'What is a wave? Explained in 30 seconds 🌊', desc: 'Step 1: in a wave nothing travels but the shape; each bead only moves up and down. Step 2: speed = frequency × wavelength, so a shorter wave is a higher note. Step 3: a string tied at both ends only fits whole half-waves: the harmonics.' })),

  S('Lesson · The Harmonic Series',
    Y('string', { modes: '1 2 3 4 5 6', every: 3 }, { look: { palette: 'aurora' }, sound: { instrument: 'harp', length: 0.8 }, text: 'A string: 1, 2, 3 … loops…' }),
    [Y('tubes', { pipe: 'open', count: 6, every: 1.5, wait: 0.3 }, { look: { palette: 'gold' }, sound: { instrument: 'marimba', length: 0.6 }, text: '…an open tube: the same notes…' }),
      Y('tubes', { pipe: 'half', count: 6, every: 1.5, wait: 0.3 }, { look: { palette: 'gold' }, sound: { instrument: 'marimba', length: 0.6 }, text: '…close one end: only the odd ones' })],
    opts({ hook: 'Why do instruments sound different?', title: 'The harmonic series: why a flute and a clarinet differ 🎶', desc: 'A string and an open tube can sing every harmonic: 1, 2, 3, 4 … A tube closed at one end can only sing the odd ones: 1, 3, 5 … The dust in the tubes shows where the air stands still.' })),

  S('Lesson · Any Wave from Circles',
    Y('fourier', { wave: 'square', terms: 8, every: 2 }, { look: { palette: 'neon' }, sound: { instrument: 'e-piano', volume: 0.6 }, text: 'Circles add up to a square…' }),
    [Y('fourier', { wave: 'saw', terms: 8, every: 2 }, { look: { palette: 'sunset' }, sound: { instrument: 'e-piano', volume: 0.6 }, text: '…a sawtooth…' }),
      Y('fourier', { wave: 'triangle', terms: 5, every: 3 }, { look: { palette: 'aurora' }, sound: { instrument: 'e-piano', volume: 0.6 }, text: '…a triangle: any wave' })],
    opts({ hook: 'Can circles draw any shape?', title: 'Fourier series: circles that draw any wave 🔵', desc: 'Each spinning circle is one sine wave. Stack them, biggest first, and they draw a square wave, a sawtooth, a triangle. Sound works the same way: every note is a sum of sines.', tags: 'fourier series, epicycles, math, education, shorts' })),

  S('Lesson · Waves Add Up',
    Y('beats', { gaps: '2 1 0.5', every: 4 }, { look: { palette: 'gold' }, sound: { instrument: 'glass-pad', length: 1.2, volume: 0.6 }, text: 'Two close notes: a wobble…' }),
    [Y('ripple', { layout: 'line', steps: '2:0.3 2:0.18', spread: 0.4, every: 6, wait: 0.3 }, { look: { palette: 'ocean' }, sound: { instrument: 'glass-pad', length: 1.2, volume: 0.6 }, text: '…two sources: still lines…' }),
      Y('ripple', { steps: '3:0.25 5:0.2', every: 6, wait: 0.3 }, { look: { palette: 'ocean' }, sound: { instrument: 'glass-pad', length: 1.2, volume: 0.6 }, text: '…more sources: a pattern' })],
    opts({ hook: 'What happens when two waves meet?', title: 'When two waves meet: beats and interference 〰️', desc: 'Waves simply add. In time, two close notes drift in and out of step and you hear beats. In space, two sources make lines where crest meets trough and the water stays still.', tags: 'interference, beats, double slit, waves, physics, education, shorts' })),

  S('Lesson · Intervals Are Ratios',
    Y('scope', { intervals: '1:1 2:1', every: 5 }, { look: { palette: 'neon', bloom: 0.5 }, sound: { instrument: 'e-piano', length: 1.2, volume: 0.6 }, text: 'Same note, then an octave…' }),
    [Y('scope', { intervals: '3:2 4:3', every: 5 }, { look: { palette: 'neon', bloom: 0.5 }, sound: { instrument: 'e-piano', length: 1.2, volume: 0.6 }, text: '…a fifth and a fourth…' }),
      Y('scope', { intervals: '16:15 45:32', every: 5 }, { look: { palette: 'fire', bloom: 0.5 }, sound: { instrument: 'e-piano', length: 1.2, volume: 0.6 }, text: '…messy ratios sound tense' })],
    opts({ hook: 'Why do some notes sound good together?', title: 'Why some notes sound good together 🎹', desc: 'Two notes sound sweet when their frequencies make a simple ratio: 2:1 (octave), 3:2 (fifth), 4:3 (fourth). An oscilloscope shows it: simple ratios draw calm closed shapes, messy ones scribble.', tags: 'music theory, intervals, lissajous, harmony, math, shorts' })),

  S('Lesson · Moving Sound',
    Y('doppler', { machs: '0 0.6', every: 5 }, { look: { palette: 'fire' }, sound: { instrument: 'synth-pluck', volume: 0.6 }, text: 'Still, then moving: squeezed waves…' }),
    [Y('doppler', { machs: '1 1.6', every: 6 }, { look: { palette: 'fire' }, sound: { instrument: 'synth-pluck', volume: 0.6 }, text: '…faster than sound: a cone' })],
    opts({ duration: 26, hook: 'Why does a siren change its pitch?', title: 'The Doppler effect and the sonic boom 🚑', desc: 'A moving source squeezes the waves ahead (higher pitch) and stretches them behind (lower pitch). Faster than its own sound, the waves pile up into a cone: the sonic boom.', tags: 'doppler effect, sonic boom, sound, physics, education, shorts' })),

  S('Lesson · Invisible Fields',
    Y('filings', { setups: 'bar', every: 30 }, { look: { palette: 'neon' }, sound: { instrument: 'synth-pluck', volume: 0.55 }, text: 'A magnet…' }),
    [Y('filings', { setups: 'wire', every: 30, wait: 0.3 }, { look: { palette: 'gold' }, sound: { instrument: 'marimba', volume: 0.8 }, text: '…a wire with a current…' }),
      Y('filings', { setups: 'coil', every: 30, wait: 0.3 }, { look: { palette: 'gold' }, sound: { instrument: 'marimba', volume: 0.8 }, text: '…a coil: a magnet again' })],
    opts({ hook: 'Can electricity make a magnet?', title: 'From a magnet to a wire to a coil 🧲⚡', desc: 'Iron filings show the field of a bar magnet, of a single wire carrying a current (circles), and of a coil, which looks just like the bar magnet. That is how electromagnets and motors work.', tags: 'electromagnetism, magnetic field, iron filings, physics, education, shorts' })),

  S('Lesson · Numbers on a Circle',
    Y('times', { build: 2, morph: 4, to: 4 }, { look: { palette: 'rainbow' }, sound: { instrument: 'e-piano' }, text: 'Times tables on a circle…' }),
    [Y('chord', {}, { more: { chord: { step: '2/7', speed: 3.2 } }, look: { palette: 'gold', trailWidth: 1.4 }, sound: { instrument: 'marimba' }, text: '…a fraction closes into a star…' }),
      Y('phyllo', { rate0: 12, accel: 1.35 }, { look: { palette: 'gold' }, sound: { instrument: 'kalimba' }, text: '…the golden angle never repeats' })],
    opts({ hook: 'What do numbers look like on a circle?', title: 'Three secrets of numbers on a circle 🌻', desc: 'Multiply around a circle and a heart shape appears. Jump by a fraction and you close into a star. Jump by the golden angle and you never land twice: that is how sunflowers pack their seeds.', tags: 'times tables, golden angle, phyllotaxis, math, education, shorts' })),
];

export const VIBRATION = [
  L('Chladni Plates', 'chladni', [
    { lab: { plate: 'square', modes: '1,3 2,4', every: 6, wait: 0.3 }, say: 'Sand leaves the moving parts…' },
    { lab: { plate: 'square', modes: '3,5 4,6', every: 6, wait: 0.3 }, say: '…higher note, more lines' },
    { lab: { plate: 'circle', modes: '2,1 2,2', every: 6, wait: 0.3, grain: 'glow', shake: 0.8 }, say: 'A round plate: circles and spokes' },
  ], { palette: 'gold', instrument: 'bell', sound: { length: 1 }, bpm: 100, hook: 'What does a note look like?', title: 'Sand shows the shape of a note 🔊', desc: 'A plate vibrates at one note. Sand is thrown off where the plate moves and gathers on the lines that stand still. Higher notes have more still lines.', tags: 'chladni, cymatics, vibration, sound, physics, learn, shorts' }),

  L("Kundt's Tubes", 'tubes', [
    { lab: { pipe: 'fixed', count: 4, every: 1.5, wait: 0.3 }, say: 'Dust piles where the air stays still' },
    { lab: { pipe: 'open', count: 5, every: 1.2, wait: 0.3 }, say: 'Harmonic k: k half-waves fit' },
    { lab: { pipe: 'half', count: 5, every: 1.2, wait: 0.3 }, say: 'One end closed: odd harmonics only' },
  ], { palette: 'gold', instrument: 'marimba', sound: { length: 0.6 }, bpm: 100, hook: 'Can you see a sound wave?', title: 'Dust in a tube shows standing waves 🎵', desc: 'A sound wave stands still in each tube and the dust piles up at the still points. Tube k fits k half-waves; a tube closed at one end only fits odd ones.' }),

  L('Interference', 'ripple', [
    { lab: { steps: '2:0.3', every: 30, wait: 0.3 }, say: 'Two sources: still lines appear' },
    { lab: { layout: 'line', steps: '2:0.18', spread: 0.4, every: 30, wait: 0.3 }, say: 'Shorter waves: more lines (double slit)' },
    { lab: { layout: 'line', steps: '6:0.2 6:0.2', spread: 0.12, phase: '0.8*j*(k - 0.5)', every: 8, wait: 0.3 }, say: 'Delay each source: the beam turns' },
  ], { palette: 'ocean', instrument: 'glass-pad', sound: { length: 1.2, volume: 0.6 }, bpm: 100, hook: 'Where do two waves cancel?', title: 'Waves add up, and cancel out 🌊', desc: 'Where a crest meets a crest the waves add up; where a crest meets a trough they cancel and the sand stays. Delay each source a little and the strong beam turns: that is how phased arrays steer.' }),

  L('Magnetic Fields', 'filings', [
    { lab: { setups: 'bar', every: 30, wait: 0.3 }, say: 'Filings line up along the field' },
    { lab: { setups: 'attract repel', every: 8, wait: 0.3 }, say: 'Opposite poles join, same poles push' },
    { lab: { setups: 'wire', every: 30, wait: 0.3 }, say: 'A wire with a current: circles' },
  ], { palette: 'neon', instrument: 'synth-pluck', sound: { volume: 0.55 }, hook: 'Can you see a magnetic field?', title: 'Iron filings make magnetic fields visible 🧲', desc: 'Each filing turns along the field. Around a magnet the lines run from pole to pole; around a wire carrying a current they go in circles.' }),
];

export const WAVES = [
  L('Standing Waves', 'string', [
    { lab: { modes: '1 2', every: 4 }, say: 'Tied at both ends: whole loops only' },
    { lab: { modes: '3 4', every: 4 }, say: 'Each loop more: a higher note' },
    { lab: { modes: '5 6 8', every: 3 }, say: 'Notes 1, 2, 3 … the harmonic series' },
  ], { palette: 'aurora', instrument: 'harp', sound: { length: 0.8 }, bpm: 100, hook: 'Why does a string play these notes?', title: 'Why a string only plays certain notes 🎸', desc: 'A string tied at both ends can only fit whole half-waves. Harmonic n has n loops, a wavelength of 2L/n and n times the frequency of the first.' }),

  L('Wavelength and Frequency', 'travel', [
    { lab: { lambdas: '0.9', show: 'rope' }, say: 'The wave moves, the beads only bob' },
    { lab: { lambdas: '0.45', show: 'rope' }, say: 'Half the wavelength: twice the frequency' },
    { lab: { lambdas: '0.6 0.3', every: 8, show: 'sound' }, say: 'Sound: air squeezes and stretches' },
  ], { palette: 'ocean', instrument: 'synth-pluck', sound: { volume: 0.6 }, bpm: 100, hook: 'What is a wavelength?', title: 'Wavelength and frequency in 30 seconds 🌊', desc: 'Speed = frequency × wavelength. At the same speed, a wave half as long passes twice as often: a higher note. Sound is the same wave, made of squeezed and stretched air.' }),

  L('Fourier Series', 'fourier', [
    { lab: { wave: 'square', terms: 3, every: 3 }, say: 'Add circles: sin x + sin 3x/3 + …' },
    { lab: { wave: 'square', terms: 12, every: 1 }, say: 'More circles: a sharper square' },
    { lab: { wave: 'triangle', terms: 6, every: 2 }, say: 'Other sizes draw a triangle' },
  ], { palette: 'neon', instrument: 'e-piano', sound: { volume: 0.6 }, bpm: 100, hook: 'Can circles draw a square?', title: 'Circles that draw a square wave 🔵', desc: 'Each spinning circle is one sine wave. Add them, biggest first, and a square wave appears. Different circle sizes draw a triangle instead.' }),

  L('Beats', 'beats', [
    { lab: { gaps: '2', every: 30 }, say: '6 and 8 a second: 2 wobbles a second' },
    { lab: { gaps: '0.5', every: 30 }, say: 'Closer notes, slower wobble' },
    { lab: { gaps: '0', every: 30 }, say: 'Same note: no wobble, in tune' },
  ], { palette: 'gold', instrument: 'glass-pad', sound: { length: 1.2, volume: 0.6 }, bpm: 100, hook: 'How do musicians tune by ear?', title: 'How to tune by ear: listen for beats 〰️', desc: 'Two close notes add up to a sound that swells and fades |f₁ − f₂| times a second. As the notes get closer the wobble slows down; when it stops they are in tune.' }),

  L('Intervals on a Scope', 'scope', [
    { lab: { intervals: '2:1', every: 30 }, say: 'Octave, 2:1: a calm figure' },
    { lab: { intervals: '3:2', every: 30 }, say: 'Fifth, 3:2: still simple' },
    { lab: { intervals: '45:32', every: 30 }, say: 'Tritone, 45:32: a tangle, tense sound' },
  ], { palette: 'neon', instrument: 'e-piano', sound: { length: 1.2, volume: 0.6 }, look: { bloom: 0.55 }, bpm: 100, hook: 'Which interval sounds the sweetest?', title: 'What musical intervals look like 🎹', desc: 'An oscilloscope draws one note against another. Simple ratios draw calm shapes and sound sweet; complicated ratios scribble and sound tense.' }),

  L('The Doppler Effect', 'doppler', [
    { lab: { machs: '0', every: 30 }, say: 'Standing still: circles all around' },
    { lab: { machs: '0.6', every: 30 }, say: 'Moving: higher ahead, lower behind' },
    { lab: { machs: '1.5', every: 30 }, say: 'Faster than sound: a shock cone' },
  ], { palette: 'fire', instrument: 'synth-pluck', sound: { volume: 0.6 }, bpm: 100, hook: 'Why does a siren change pitch?', title: 'The Doppler effect, then a sonic boom 🚑', desc: 'A moving source squeezes its waves in front and stretches them behind, so the pitch is higher ahead and lower behind. Faster than sound, the waves pile into a cone.' }),
];
