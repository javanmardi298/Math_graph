/**
 * Lessons for the Circle Lab basics: the classic circle, multiply & split, fill the screen,
 * bounce & draw. Every lesson plays one simulation 3 times, changing one thing each step.
 */
import { circleLesson as L } from './kit.js';

export const CLASSIC = [
  L('Jumping Around a Circle', 'chord', [
    { more: { chord: { step: '1/4', speed: 2.6 } }, say: 'Jump ¼ of a turn: a square' },
    { more: { chord: { step: '2/5', speed: 2.8 } }, say: 'Jump 2/5 of a turn: a star' },
    { more: { chord: { step: '1/phi^2', speed: 3 } }, say: 'Jump by the golden ratio: it never closes' },
  ], { palette: 'gold', instrument: 'marimba', hook: 'Which jumps close into a shape?', title: 'Fractions draw stars, the golden ratio never closes ⭐', desc: 'A point jumps the same fraction of a turn again and again. A simple fraction like 1/4 or 2/5 closes into a shape; the golden ratio never lands on the same spot twice.' }),

  L('Gravity Bends the Path', 'bounce', [
    { more: { physics: { gravity: 0, speed: 1.5 } }, say: 'No gravity: straight lines' },
    { more: { physics: { gravity: 2.4, speed: 1.5 } }, say: 'Add gravity: every path bends' },
    { more: { physics: { gravity: 2.4, speed: 1.4, speedGain: 1.02, maxSpeed: 4 } }, say: 'Faster after every bounce: chaos' },
  ], { palette: 'aurora', hook: 'What does gravity do to a bounce?', title: 'Straight lines, then gravity bends them 🏀', desc: 'Without gravity a ball travels in straight lines. With gravity every flight becomes a parabola. Speed it up a little on every bounce and the path turns chaotic.' }),

  L('Doubling Is Fast', 'split', [
    { more: { physics: { speed: 1.4, size: 0.04 }, split: { angle: 12, max: 8 } }, say: 'Every bounce: one ball becomes two' },
    { more: { physics: { speed: 1.5, size: 0.03 }, split: { angle: 14, max: 64 } }, say: '1, 2, 4, 8, 16, 32, 64…' },
    { more: { physics: { speed: 1.6, size: 0.025 }, split: { angle: 30, max: 128 } }, say: 'Seven doublings: 128 balls' },
  ], { palette: 'rainbow', instrument: 'marimba', pitch: 'rise', hook: 'How fast does doubling grow?', title: 'Doubling: 1 ball becomes 128 in seconds 🟢', desc: 'Every time a ball bounces it splits in two. 1, 2, 4, 8 … after seven doublings there are 128. That is exponential growth.' }),

  L('Growing Ball', 'grow', [
    { more: { physics: { speed: 2.2, size: 0.04 }, grow: { amount: 0.006, until: 0.4 } }, say: 'Every bounce makes it a little bigger' },
    { more: { physics: { speed: 2, size: 0.04 }, grow: { amount: 0.008, until: 0.85 } }, say: 'Bigger ball: shorter trips, faster notes' },
    { more: { physics: { speed: 2, size: 0.04, gravity: 2 }, grow: { amount: 0.0025, until: 0.9 } }, say: 'With gravity, until it fills the circle' },
  ], { palette: 'sunset', hook: 'Why do the notes get faster?', title: 'A ball that grows on every bounce 🟠', desc: 'The ball grows a little each time it hits the circle. The bigger it gets, the shorter its trip across, so the bounces (and the notes) come faster and faster.' }),

  L('Escape the Rings', 'escape', [
    { more: { escape: { rings: 3, inner: 0.4, gap: 60, spin: 0.8 }, physics: { speed: 1.6 } }, say: 'Find the gap to get out' },
    { more: { escape: { rings: 6, inner: 0.32, gap: 34, spin: 0.9 }, physics: { speed: 1.6 } }, say: 'More rings, smaller gaps' },
    { more: { escape: { rings: 9, inner: 0.25, gap: 26, spin: 1.3 }, physics: { speed: 1.8 } }, say: 'Nine spinning rings: will it escape?' },
  ], { palette: 'neon', instrument: 'bell', hook: 'Can the ball get out?', title: 'Escape the spinning rings 🔓', desc: 'A ball bounces inside spinning rings, each with a gap. It only escapes when it hits a gap at the right moment: a game of chance and angles.' }),

  L('Many Rhythms at Once', 'polyrhythm', [
    { more: { poly: { dots: 4, base: 20, cycle: 10 } }, say: '4 dots, each a little faster' },
    { more: { poly: { dots: 10, base: 20, cycle: 10 } }, say: '10 dots drift into waves…' },
    { more: { poly: { dots: 20, base: 20, cycle: 10 } }, say: '…and all line up again' },
  ], { palette: 'rainbow', instrument: 'e-piano', pitch: 'ball', hook: 'Will they ever line up again?', title: 'Many rhythms, one moment of sync 🌈', desc: 'Dot k swings one more time per cycle than the dot before it. They drift apart into waves and patterns, and after one full cycle they all line up again.' }),
];

export const MULTIPLY = [
  L('Powers of 2, 3 and 4', 'triple', [
    { lab: { coreN: 2, max: 64 }, say: 'Hit the core: 1 ball becomes 2' },
    { lab: { coreN: 3, max: 243 }, say: 'Now 3: 1, 3, 9, 27, 81, 243' },
    { lab: { coreN: 4, max: 256, coreShape: 'square' }, say: '4 at a time: 1, 4, 16, 64, 256' },
  ], { palette: 'rainbow', instrument: 'marimba', pitch: 'rise', hook: 'Which grows faster: ×2, ×3 or ×4?', title: 'Powers of 2, 3 and 4 with bouncing balls 🔺', desc: 'Every ball that hits the core becomes N balls. With N = 2 you get powers of two, with 3 powers of three, with 4 powers of four: the bigger N, the faster the explosion.' }),

  L('Plus One or Times Two', 'boxcore', [
    { lab: { coreAction: 'clone', max: 64 }, say: 'Clone: one more each hit (+1)' },
    { lab: { coreAction: 'split', coreN: 2, max: 256 }, say: 'Split: doubles each hit (×2)' },
    { lab: { coreAction: 'recolor', balls: 12, max: 64 }, say: 'Recolour: same balls, new colours' },
  ], { palette: 'candy', instrument: 'music-box', hook: 'Adding or multiplying: which wins?', title: '+1 or ×2: the difference is huge 🟪', desc: 'Adding one ball per hit grows slowly and steadily. Doubling per hit explodes. The same box, the same core, two very different kinds of growth.' }),

  L('Shatter Into Pieces', 'shatter', [
    { lab: { wallN: 2, max: 128 }, say: 'Each wall hit: 2 smaller pieces' },
    { lab: { wallN: 3, max: 300 }, say: '3 pieces: the box fills faster' },
    { lab: { wallN: 4, childScale: 0.8, max: 400 }, say: 'Pieces shrink every time: a geometric series' },
  ], { palette: 'fire', instrument: 'synth-pluck', pitch: 'rise', hook: 'How small can the pieces get?', title: 'Every hit shatters it into smaller pieces 💥', desc: 'A shard breaks into N smaller pieces at every wall. Each generation is smaller by the same factor: a geometric series you can watch.' }),

  L('Escape and Multiply', 'escapeplus', [
    { lab: { escapeN: 1 }, say: 'Each escape brings 1 new ball' },
    { lab: { escapeN: 2 }, say: 'Each escape brings 2' },
    { lab: { escapeN: 4 }, say: 'Each escape brings 4: it explodes' },
  ], { palette: 'rainbow', sound: { volume: 0.45 }, hook: 'How many balls per escape fills the screen?', title: 'Every escape brings new balls 🌈', desc: 'A ball slips out of a ring with a gap and new balls appear. One per escape keeps it calm; four per escape fills the whole screen.' }),

  L('Chain Reaction', 'chain', [
    { lab: { balls: 2, max: 60, arena: 'circle' }, say: 'Every touch makes a new ball' },
    { lab: { balls: 3, max: 160, arena: 'circle', size: 0.04 }, say: 'More balls, more touches' },
    { lab: { balls: 4, max: 420, arena: 'circle', size: 0.035 }, say: 'It snowballs until the space is full' },
  ], { palette: 'sunset', instrument: 'marimba', hook: 'What happens when every touch makes a ball?', title: 'A chain reaction you can hear 🔁', desc: 'Whenever two balls touch a new one appears. More balls mean more touches, which mean even more balls: a chain reaction.' }),

  L('Cells Divide', 'mitosis', [
    { lab: { divide: 4 }, say: 'A cell divides every 4 beats' },
    { lab: { divide: 2 }, say: 'Every 2 beats: twice as fast' },
    { lab: { divide: 1 }, say: 'Every beat: 1, 2, 4, 8, 16…' },
  ], { palette: 'aurora', instrument: 'kalimba', hook: 'How fast can cells fill a box?', title: 'Cells dividing on the beat 🦠', desc: 'Each cell splits in two after a fixed time. The shorter that time, the faster the colony fills the box: doubling, the maths of growth.' }),
];

export const FILL = [
  L('The Bell Curve', 'galton', [
    { lab: { rows: 4, emitMax: 220 }, say: 'Each peg: left or right, 50/50' },
    { lab: { rows: 8, emitMax: 300 }, say: 'More rows, a smoother hill' },
    { lab: { rows: 14, emitMax: 420 }, say: 'Many rows: the bell curve' },
  ], { palette: 'gold', instrument: 'marimba', hook: 'Where will most balls land?', title: 'Random bounces make a bell curve 🔔', desc: 'Every peg sends a ball left or right at random. Most balls end up near the middle because there are many more paths there: the normal distribution, from pure chance.', tags: 'galton board, bell curve, probability, statistics, math, learn, shorts' }),

  L('Pyramid Cascade', 'pyramid', [
    { lab: { rows: 3, emitRamp: 0, emitMax: 250 }, say: 'Balls slide down the pyramids' },
    { lab: { rows: 5, emitRamp: 12, emitMax: 450 }, say: 'One more ball every 12 drops' },
    { lab: { rows: 7, emitRamp: 6, emitMax: 650 }, say: 'Faster and faster until it is full' },
  ], { palette: 'gold', instrument: 'harp', hook: 'Which pyramid fills up first?', title: 'Balls cascade down the pyramids 🔻', desc: 'Balls fall on rows of triangles and slide off their sides. Every few drops one more ball is added, so the pile grows faster and faster.' }),

  L('Fill on the Beat', 'beatfill', [
    { lab: { emitRamp: 0, emitMax: 160 }, say: 'One ball on every beat' },
    { lab: { emitRamp: 8, emitMax: 320 }, say: 'One more ball every 8 drops' },
    { lab: { emit: 2, emitRamp: 6, colorEvery: 12, emitMax: 520 }, say: 'New colour every bar: layers of time' },
  ], { palette: 'candy', instrument: 'marimba', sound: { drum: 'kick' }, hook: 'How long until it is full?', title: 'Filling a capsule on the beat 🥁', desc: 'Balls drop in time with the music. Each colour is one bar, so the stripes are a picture of time passing.' }),

  L('Pachinko Rain', 'pachinko', [
    { lab: { rows: 5, pegSize: 0.012, emitMax: 300 }, say: 'A few pegs: balls fall almost straight' },
    { lab: { rows: 9, emitMax: 450 }, say: 'More pegs, more bounces' },
    { lab: { rows: 13, pegSize: 0.018, emitMax: 600 }, say: 'Dense pegs: every path is random' },
  ], { palette: 'neon', instrument: 'synth-pluck', hook: 'Can you predict one ball?', title: 'Pachinko: you cannot predict one ball 🎰', desc: 'One ball is impossible to predict, but thousands together make a smooth pile. That is how probability works.' }),

  L('Halve, Halve, Halve', 'paper', [
    { lab: { mode: 'half', max: 64, cut0: 0.5 }, say: 'Halve: 2, 4, 8, 16, 32, 64' },
    { lab: { mode: 'quad', max: 256, cut0: 0.6 }, say: 'Quarter: 4, 16, 64, 256' },
    { lab: { mode: 'golden', max: 24, cut0: 0.5 }, say: 'Golden cuts: a spiral appears' },
  ], { palette: 'candy', instrument: 'marimba', hook: 'How many cuts to make 64 pieces?', title: 'Cutting paper: powers of 2 and the golden spiral ✂️', desc: 'Halving again and again gives 2, 4, 8 … pieces. Cutting into four gives powers of 4. Cutting off squares by the golden ratio leaves a golden spiral.' }),

  L('Circle Packing', 'packing', [
    { lab: { maxR: 0.32, rate0: 3 }, say: 'Circles grow until they touch' },
    { lab: { maxR: 0.12, rate0: 8 }, say: 'Small circles fill the gaps evenly' },
    { lab: { shape: 'circle', maxR: 0.25, rate0: 5 }, say: 'Circles inside a circle' },
  ], { palette: 'aurora', instrument: 'kalimba', hook: 'How many circles fit?', title: 'Circles grow until they touch 🫧', desc: 'Each new circle starts in an empty spot and grows until it touches another. Big ones first, then smaller and smaller ones fill the gaps.' }),
];

export const BOUNCE = [
  L('From Triangle to Circle', 'hexagon', [
    { lab: { sides: 3 }, say: 'A ball in a spinning triangle' },
    { lab: { sides: 6 }, say: 'Six sides: a hexagon' },
    { lab: { sides: 14 }, say: 'Many sides: almost a circle' },
  ], { palette: 'neon', hook: 'How many sides make a circle?', title: 'A polygon with more sides becomes a circle 🔷', desc: 'The more sides a regular polygon has, the closer it gets to a circle. A bouncing ball draws each one for us.' }),

  L('The Shrinking Arena', 'shrink', [
    { lab: { shrink: 0.003, speedGain: 1 }, say: 'Every hit, the arena gets smaller' },
    { lab: { shrink: 0.006, speedGain: 1.012 }, say: 'And the ball a little faster' },
    { lab: { shrink: 0.01, balls: 3, speedGain: 1.01 }, say: 'Three balls: the end comes quickly' },
  ], { palette: 'sunset', hook: 'How long until it is too small?', title: 'The arena shrinks with every bounce ⭕', desc: 'Each bounce makes the circle a little smaller. Smaller circle, shorter trips, more bounces: the shrinking speeds itself up.' }),

  L('Billiard Angles', 'billiard', [
    { lab: { angle: 45 }, say: '45°: the same loop forever' },
    { lab: { angle: 26.565 }, say: 'Slope 1:2: a repeating pattern' },
    { lab: { angle: 37.5 }, say: 'An uneven angle fills the whole table' },
  ], { palette: 'gold', instrument: 'harp', hook: 'Which angle fills the table?', title: 'A billiard ball draws with angles 🎱', desc: 'Shoot at 45° and the ball repeats one loop. A simple slope repeats a bigger pattern. An uneven angle never repeats and slowly fills the whole square.' }),
];
