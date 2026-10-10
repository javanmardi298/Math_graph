/**
 * Circle Lab presets with several layers: little stories (one simulation after another,
 * each with its own line of text) and split screens (two simulations at once).
 */
const TAGS = 'satisfying, simulation, math, physics, generative art, asmr, oddly satisfying, shorts';

/** A layer: rule + settings (partial; everything else comes from the defaults). */
const Y = (rule, lab = {}, { look = {}, sound = {}, text, speed, seed, withPrev = false, more = {} } = {}) => ({
  enabled: true, withPrev,
  cfg: { rule, ...(seed ? { seed } : {}), lab: { [rule]: lab }, look: { trail: 'lines', ...look }, sound: { instrument: 'kalimba', pitch: 'angle', volume: 0.7, maxRate: 22, ...sound }, ...(text ? { text: { formula: text } } : {}), ...(speed ? { speed: { from: 1, to: 1, curve: 'linear', pulse: 0, ...speed } } : {}), ...more },
});

/** A preset: the first layer is the main one; `combine` = 'sequence' or 'together'. */
const S = (name, first, rest, { combine = 'sequence', duration = 30, bpm = 120, audio = {}, hook, title, desc, tags, ambience = true } = {}) => ({
  name, mode: 'circle', transport: { duration, bpm },
  visual: { aspect: '9:16' },
  overlay: { layout: 4, name: { enabled: false } },
  audio: { scale: 'minorPentatonic', root: 9, noteLow: 50, noteHigh: 86, reverb: { decay: 3.5, mix: 0.35 }, delay: { time: 0.375, feedback: 0.3, mix: 0.16 }, ...audio },
  circle: { ...first.cfg, combine, layers: rest.map((l, i) => ({ id: `C${i + 2}`, ...l })), look: { ...first.cfg.look, ambience } },
  hook: { text: hook },
  youtube: { title: `${title} #shorts`, description: `${desc}\n\n#satisfying #simulation #shorts`, tags: tags || TAGS },
});

export const STACK_PRESETS = [
  S('Closes or Never Closes?', Y('chord', {}, { more: { chord: { step: '5/13', speed: 3.2 } }, look: { palette: 'sunset', trailWidth: 1.6 }, sound: { instrument: 'marimba' }, text: 'This one closes after 13 hits…' }),
    [Y('chord', {}, { more: { chord: { step: '1/phi^2', speed: 3.4, speedGain: 1.01 } }, look: { palette: 'gold', trailWidth: 1.1 }, sound: { instrument: 'bell', length: 0.5 }, text: '…this one never closes' })],
    { hook: 'Which one will close?', title: 'One closes, one never does ⭐', desc: 'Two points jump around a circle. The first jumps 5/13 of a turn and closes into a star after 13 hits. The second jumps by the golden ratio and never lands on the same spot twice.' }),

  S('Split vs Grow', Y('split', {}, { more: { physics: { speed: 1.6, size: 0.03 }, split: { angle: 10, max: 128 } }, look: { palette: 'aurora', trail: 'fade', zoom: 0.52, dy: 0.62 }, sound: { instrument: 'marimba', pitch: 'rise' } }),
    [Y('grow', {}, { more: { physics: { speed: 1.3, size: 0.04 }, grow: { amount: 0.0022, until: 0.93 } }, look: { palette: 'sunset', zoom: 0.52, dy: -0.62, trailWidth: 1 }, sound: { instrument: 'kalimba', pitch: 'angle' } })],
    { combine: 'together', hook: 'Top or bottom: which fills up first?', title: 'Split or grow: which fills the circle first? 🟢🟠', desc: 'Top: every bounce splits the ball in two. Bottom: every bounce makes the ball bigger. Same start, two rules, a race to fill the circle.' }),

  S('Three Fractals', Y('chaos', { corners: 3, rate0: 25, accel: 1.9 }, { look: { palette: 'rainbow' }, sound: { pitch: 'ball' }, text: 'Random jumps…' }),
    [Y('chaos', { corners: 5, ratio: 0.618, rate0: 25, accel: 1.9 }, { look: { palette: 'gold' }, sound: { instrument: 'harp', pitch: 'ball' }, text: '…five corners…' }),
      Y('paper', { mode: 'tri', cut0: 0.4, decay: 0.85, max: 729 }, { look: { palette: 'candy' }, sound: { instrument: 'bell' }, text: '…and with scissors' })],
    { hook: 'Can random jumps draw a perfect shape?', title: 'Three ways to draw a fractal 🔺', desc: 'Random jumps draw the Sierpiński triangle, then a golden pentagon. Then scissors cut the same triangle out of paper, one cut at a time.' }),

  S('Battle Royale', Y('rps', { chase: '0.15 + 0.08*t' }, { seed: 13, look: { palette: 'neon', bloom: 0.45 }, sound: { instrument: 'marimba', pitch: 'ball', volume: 1 }, text: 'Round 1: rock, paper, scissors' }),
    [Y('predator', {}, { look: { palette: 'candy', bloom: 0.5 }, sound: { instrument: 'kalimba' }, text: 'Round 2: scissors vs flowers' }),
      Y('colorwar', {}, { seed: 11, look: { palette: 'neon' }, sound: { instrument: 'synth-pluck', pitch: 'ball' }, text: 'Round 3: colour war' })],
    { duration: 36, hook: 'Three battles. Pick a winner!', title: 'Three battles, three winners 🏆', desc: 'Rock paper scissors, scissors vs flowers, and a four-colour war. Pick your winner before each round ends.' }),

  S('Cut, Pop, Slice', Y('paper', { mode: 'half', cut0: 0.45, decay: 0.9, max: 128 }, { look: { palette: 'candy' }, sound: { instrument: 'marimba' }, text: 'Cut…' }),
    [Y('popper', { x: '16*sin(t)^3/17', y: '(13*cos(t) - 5*cos(2*t) - 2*cos(3*t) - cos(4*t))/17', rate: 0.63, count: 260 }, { look: { palette: 'candy', trailWidth: 2.2 }, sound: { instrument: 'music-box' }, text: 'Pop…' }),
      Y('slicer', { ba: '2*t', balls: 5 }, { look: { palette: 'rainbow' }, sound: { instrument: 'synth-pluck' }, text: 'Slice!' })],
    { hook: 'The most satisfying 30 seconds?', title: 'Cut, pop, slice: 30 satisfying seconds ✂️🎈🗡️', desc: 'Scissors halve a sheet again and again, a spike pops a heart into balloons, and a blade cuts every ball in half.' }),

  S('Fill Race', Y('beatfill', { emitRamp: 6 }, { look: { palette: 'candy', zoom: 0.5, dx: -0.5 }, sound: { instrument: 'marimba', drum: 'kick' } }),
    [Y('pyramid', { emitRamp: 8 }, { look: { palette: 'gold', zoom: 0.5, dx: 0.5 }, sound: { instrument: 'harp' } })],
    { combine: 'together', bpm: 118, hook: 'Left or right: which fills first?', title: 'Left or right: which one fills up first? 🏁', desc: 'Two containers fill up with balls on the beat. The capsule on the left gets more balls every bar; the pyramid on the right sends them down its corners.' }),

  S("Nature's Maths", Y('phyllo', { rate0: 12, accel: 1.35 }, { look: { palette: 'gold' }, sound: { instrument: 'kalimba' }, text: 'A sunflower…' }),
    [Y('tree', { beats: 0.5 }, { look: { palette: 'aurora' }, sound: { instrument: 'harp', length: 0.8 }, text: '…a tree…' }),
      Y('snowflake', { walkers: 80, speed: 3.4 }, { look: { palette: 'mono' }, sound: { instrument: 'music-box' }, text: '…a snowflake' })],
    { bpm: 100, hook: 'Three things nature draws with maths', title: 'A sunflower, a tree, a snowflake: all maths 🌻🌳❄️', desc: 'Seeds turning by the golden angle, branches splitting on the beat, and dust that freezes into a crystal: three simple rules that nature uses.' }),

  S('Rhythm Machine', Y('polygons', { from: 3, to: 8, lap: 8 }, { look: { palette: 'rainbow', zoom: 0.55, dy: 0.62 }, sound: { instrument: 'kalimba', pitch: 'ball' } }),
    [Y('pendulum', { count: 12, base: 16, cycle: 30 }, { look: { palette: 'rainbow', zoom: 0.55, dy: -0.55 }, sound: { instrument: 'marimba', pitch: 'ball', volume: 0.6 } })],
    { combine: 'together', audio: { scale: 'pentatonic', root: 2, noteLow: 50, noteHigh: 88 }, hook: 'Two rhythm machines, one song', title: 'Two rhythm machines playing together 🎶', desc: 'Polygons play a note on every corner, pendulums play one on every swing. Together they drift apart and meet again.' }),

  S('Escape Story', Y('escape', {}, { more: { physics: { gravity: 2.4, speed: 1.6, size: 0.03 }, escape: { rings: 4, inner: 0.35, gap: 55, spin: 1.3 } }, look: { palette: 'neon', trail: 'fade' }, sound: { instrument: 'bell' }, text: 'First it escapes…' }),
    [Y('escapeplus', { escapeN: 4, speed: 2.6, gap: 70 }, { look: { palette: 'rainbow' }, sound: { instrument: 'kalimba', volume: 0.45 }, text: '…then every escape adds 4' }),
      Y('chain', {}, { look: { palette: 'sunset' }, sound: { instrument: 'marimba' }, text: '…until they fill everything' })],
    { duration: 33, hook: 'One ball. How does it end?', title: 'One ball escapes… and then everything fills up 🌈', desc: 'A ball breaks out of its rings, then every escaping ball brings three more, then every touch makes a new one.' }),

  S('Drawing Machines', Y('harmono', { rate: 2.6 }, { look: { palette: 'aurora', trailWidth: 1.1 }, sound: { instrument: 'glass-pad', length: 1 }, text: 'Two pendulums…' }),
    [Y('spiro', { rate: 3.2 }, { look: { palette: 'rainbow', trailWidth: 1.2 }, sound: { instrument: 'harp' }, text: '…a wheel in a wheel…' }),
      Y('orbits', { cycle: 8, every: 0.03 }, { look: { palette: 'gold', trailWidth: 0.8 }, sound: { instrument: 'bell', volume: 0.5 }, text: '…two planets…' }),
      Y('times', { build: 2.5, morph: 5, to: 6 }, { look: { palette: 'rainbow' }, sound: { instrument: 'e-piano' }, text: '…times tables' })],
    { duration: 32, hook: 'Four machines that draw by themselves', title: 'Four machines that draw by themselves ✍️', desc: 'A harmonograph, a spirograph, two orbiting planets and a times-table circle: four simple machines, four drawings.' }),
];
