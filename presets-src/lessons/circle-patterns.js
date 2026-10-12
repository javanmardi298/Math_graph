/**
 * Lessons for growth, patterns & rhythm, drawing machines and battles.
 */
import { circleLesson as L } from './kit.js';

export const GROWTH = [
  L('Colour War', 'colorwar', [
    { lab: { teams: 2, balls: 40 }, say: 'Touch a ball, take its colour' },
    { lab: { teams: 3, balls: 60 }, say: 'Three teams: luck decides' },
    { lab: { teams: 4, balls: 64 }, say: 'Four teams: one will win' },
  ], { palette: 'neon', instrument: 'synth-pluck', pitch: 'ball', seed: 11, hook: 'Which colour takes over?', title: 'A colour war decided by chance 🎨', desc: 'Every time two balls touch, one takes the other\'s colour. Random meetings slowly push one colour to win: a random walk, like genes in a population.' }),

  L('Grow Until Jammed', 'growpack', [
    { lab: { grow: 0.003 }, say: 'Each hit makes a ball grow' },
    { lab: { grow: 0.006 }, say: 'Grow faster: they start to touch' },
    { lab: { grow: 0.012, balls: 20 }, say: 'No room left: jammed!' },
  ], { palette: 'candy', hook: 'When does it jam?', title: 'Balls grow until nothing can move 🔒', desc: 'Every bounce makes a ball bigger. With less and less room the balls start pushing each other until the whole box jams.' }),

  L('Growing a Reef', 'coral', [
    { lab: { walkers: 20 }, say: 'Wandering balls stick when they touch' },
    { lab: { walkers: 44 }, say: 'Branches grow where balls arrive first' },
    { lab: { walkers: 80, jitter: 5 }, say: 'Random walks build a coral' },
  ], { palette: 'aurora', hook: 'Can random steps build a coral?', title: 'Random walks grow a coral reef 🪸', desc: 'Balls wander at random and freeze when they touch the reef. The tips catch balls first, so they grow faster and branch: diffusion-limited aggregation.' }),

  L('How a Snowflake Grows', 'snowflake', [
    { lab: { walkers: 30, jitter: 1 }, say: 'Dust wanders until it touches the crystal' },
    { lab: { walkers: 60, jitter: 2.2 }, say: 'Arms grow out from the centre' },
    { lab: { walkers: 100, jitter: 4 }, say: 'More dust, finer branches' },
  ], { palette: 'mono', instrument: 'music-box', hook: 'How does a crystal grow?', title: 'A crystal grows from random dust ❄️', desc: 'Particles wander at random and stick to the crystal when they touch it. Arms that reach further catch more dust, so the crystal grows branches.' }),
];

export const PATTERNS = [
  L('Radar Rules', 'radar', [
    { lab: { action: 'add', blips: 2 }, say: 'Every ping adds a target' },
    { lab: { action: 'grow', blips: 6 }, say: 'Every ping makes targets grow' },
    { lab: { action: 'turn', blips: 12 }, say: 'Every ping pushes them around' },
  ], { palette: 'neon', instrument: 'synth-pluck', hook: 'What does each ping do?', title: 'One radar, three rules 📡', desc: 'The radar sweeps round at a steady speed. Each time it passes a target something happens: add one, grow, or push it on. Simple rules, different patterns.' }),

  L('The Chaos Game', 'chaos', [
    { lab: { corners: 3, ratio: 0.5, rate0: 40, accel: 1.8 }, say: 'Jump halfway to a random corner…' },
    { lab: { corners: 4, ratio: 0.5, rule: 'norepeat', rate0: 40, accel: 1.8 }, say: 'Square, never the same corner twice' },
    { lab: { corners: 5, ratio: 0.618, rate0: 40, accel: 1.8 }, say: 'Five corners, golden jumps' },
  ], { palette: 'rainbow', instrument: 'kalimba', pitch: 'ball', hook: 'Can random jumps draw a perfect shape?', title: 'Random jumps draw perfect fractals 🔺', desc: 'Pick a random corner, jump part of the way there, put a dot, repeat. Out of pure chance a perfect fractal appears: the Sierpiński triangle, then two more.' }),

  L('The Golden Angle', 'phyllo', [
    { lab: { angle: 90, rate0: 20, accel: 1.3 }, say: 'Turn ¼ for each seed: 4 straight arms' },
    { lab: { angle: 137.1, rate0: 20, accel: 1.3 }, say: 'Almost golden: gaps open up' },
    { lab: { angle: 137.508, rate0: 20, accel: 1.3 }, say: 'The golden angle: no gaps at all' },
  ], { palette: 'gold', hook: 'Why do sunflowers use 137.5°?', title: 'Why sunflowers use the golden angle 🌻', desc: 'Each new seed turns by the same angle. A simple fraction of a turn gives straight arms with gaps. The golden angle, 137.5°, never lines up, so the seeds pack perfectly.', tags: 'golden angle, phyllotaxis, sunflower, fibonacci, math, learn, shorts' }),

  L('Pendulum Wave', 'pendulum', [
    { lab: { count: 8, base: 10, cycle: 9 }, say: 'Each pendulum swings a bit faster' },
    { lab: { count: 15, base: 10, cycle: 9 }, say: 'They drift into snakes and waves' },
    { lab: { count: 22, base: 10, cycle: 9 }, say: 'Then all line up again' },
  ], { palette: 'rainbow', instrument: 'marimba', pitch: 'ball', hook: 'Will they line up again?', title: 'Pendulums that drift apart and meet again 🌊', desc: 'Pendulum k makes exactly one more swing per cycle than pendulum k − 1. In between they form waves and snakes; after one cycle they all line up again.' }),

  L('The DNA Ladder', 'dna', [
    { lab: { pairs: 12, zip: 0.5 }, say: 'Two strands, joined by pairs' },
    { lab: { pairs: 30, zip: 0.25 }, say: 'A pairs with T, C pairs with G' },
    { lab: { pairs: 40, turns: 4, zip: 0.2 }, say: 'The ladder twists into a helix' },
  ], { palette: 'aurora', instrument: 'e-piano', hook: 'Why is DNA a twisted ladder?', title: 'DNA zips up one pair at a time 🧬', desc: 'DNA is a ladder whose rungs are base pairs: A with T, C with G. The ladder twists into a double helix.' }),

  L('Sorting Algorithms', 'sorting', [
    { lab: { algo: 'bubble', bars: 24, time: 8, finale: false }, say: 'Bubble sort: swap neighbours' },
    { lab: { algo: 'insertion', bars: 32, time: 8, finale: false }, say: 'Insertion sort: slide each bar in' },
    { lab: { algo: 'quick', bars: 64, time: 8 }, say: 'Quick sort: split and conquer' },
  ], { palette: 'rainbow', instrument: 'synth-pluck', hook: 'Which sort is the fastest?', title: 'Three sorting algorithms you can hear 📊', desc: 'Bubble sort swaps neighbours, insertion sort slides each bar into place, quick sort splits the list around a pivot. Same job, very different speeds.', tags: 'sorting algorithm, computer science, coding, algorithms, learn, shorts' }),

  L('Polyrhythm Polygons', 'polygons', [
    { lab: { from: 3, to: 4, lap: 8 }, say: 'Triangle and square: 3 against 4' },
    { lab: { from: 3, to: 6, lap: 8 }, say: 'Add 5 and 6 corners' },
    { lab: { from: 3, to: 10, lap: 8 }, say: 'Eight shapes, eight rhythms' },
  ], { palette: 'rainbow', pitch: 'ball', hook: 'Can you hear 3 against 4?', title: 'Each shape plays its own rhythm 🔺🟥', desc: 'A dot runs round each polygon in the same time and plays a note on every corner. A triangle plays 3 notes per lap, a square 4: a polyrhythm.' }),
];

export const MACHINES = [
  L('The Harmonograph', 'harmono', [
    { lab: { f1: 2, f2: 1, f3: 2, f4: 1, decay: 0.02, rate: 2 }, say: '2 to 1: a figure eight' },
    { lab: { f1: 3, f2: 2, f3: 3, f4: 2, decay: 0.02, rate: 2 }, say: '3 to 2: a fifth in music' },
    { lab: { f1: 3, f2: 2, f3: 3.01, f4: 2.005, decay: 0.012, rate: 2 }, say: 'Slightly out of tune: it spirals' },
  ], { palette: 'aurora', instrument: 'glass-pad', sound: { length: 1 }, hook: 'What does a musical interval look like?', title: 'Pendulums draw musical intervals ✍️', desc: 'Two swinging pendulums move a pen. Their frequency ratio, 2:1 or 3:2, decides the shape; a tiny detune makes it rotate and spiral.' }),

  L('Planet Dance', 'orbits', [
    { lab: { inner: 3, outer: 2, cycle: 9 }, say: 'Laps 3 to 2: a simple loop' },
    { lab: { inner: 5, outer: 3, cycle: 9 }, say: 'Laps 5 to 3: more petals' },
    { lab: { inner: 13, outer: 8, cycle: 9 }, say: 'Venus and Earth, 13 to 8: a flower' },
  ], { palette: 'gold', instrument: 'bell', hook: 'What shape do Venus and Earth draw?', title: 'Venus and Earth draw a five-petal flower 🪐', desc: 'Draw a line between two planets every few days. Venus goes round the Sun 13 times while Earth goes 8 times, and the lines make a five-petal flower.' }),

  L('Fractal Tree', 'tree', [
    { lab: { angle: 15, depth: 8, beats: 0.5 }, say: 'Each branch splits in two' },
    { lab: { angle: 30, depth: 10, beats: 0.4 }, say: 'Wider angle, rounder crown' },
    { lab: { angle: 60, ratio: 0.68, depth: 10, beats: 0.4 }, say: '60°: a snowflake-like tree' },
  ], { palette: 'aurora', instrument: 'harp', hook: 'How many branches after 10 splits?', title: 'One rule grows a whole tree 🌳', desc: 'Every branch ends in two shorter branches. After 10 levels there are 1024 tips. Change the angle and the same rule grows a very different tree.' }),

  L('Times Tables on a Circle', 'times', [
    { lab: { from: 2, to: 2, build: 3, morph: 5 }, say: '× 2 on a circle: a heart (cardioid)' },
    { lab: { from: 3, to: 3, build: 3, morph: 5 }, say: '× 3: two loops (nephroid)' },
    { lab: { from: 4, to: 9, build: 2, morph: 7 }, say: 'Keep multiplying: more petals' },
  ], { palette: 'rainbow', instrument: 'e-piano', hook: 'What does ×2 look like?', title: 'Times tables draw hearts on a circle ❤️', desc: 'Put 200 points on a circle and join point n to point 2n. A heart shape appears: the cardioid. ×3 makes a nephroid, and higher tables add more petals.' }),

  L('Spirograph', 'spiro', [
    { lab: { r: 0.5, d: 1, rate: 2 }, say: 'Half-size wheel, pen on the rim: a straight line!' },
    { lab: { r: 0.37, d: 0.75, rate: 2 }, say: 'Pen inside the wheel: a star of loops' },
    { lab: { r: 0.25, d: 1, rate: 2 }, say: 'A quarter wheel: a four-point star' },
  ], { palette: 'rainbow', instrument: 'harp', hook: 'What does a wheel in a wheel draw?', title: 'A wheel inside a wheel draws stars 🌀', desc: 'A small wheel rolls inside a big one with a pen on it. The ratio of the two sizes decides how many loops the curve has.' }),
];

export const BATTLES = [
  L('Rock, Paper, Scissors', 'rps', [
    { lab: { kinds: 3, each: 10 }, say: 'Rock beats scissors, scissors beat paper…' },
    { lab: { kinds: 3, each: 20 }, say: 'Chasers grow faster over time' },
    { lab: { kinds: 5, each: 12 }, say: 'Add lizard and Spock: 5 teams' },
  ], { palette: 'neon', instrument: 'marimba', pitch: 'ball', seed: 13, sound: { volume: 1 }, hook: 'Who wins rock, paper, scissors?', title: 'Rock, paper, scissors, lizard, Spock 🪨📄✂️', desc: 'Each team chases the one it beats and runs from the one that beats it. With three teams nobody is best; with five, every team still beats two and loses to two.' }),

  L('Predator and Prey', 'predator', [
    { lab: { flowers: 30, hunters: 1, alpha: 0.5 }, say: 'Flowers multiply, scissors cut them' },
    { lab: { flowers: 40, hunters: 2, alpha: 0.7 }, say: 'More food, more hunters…' },
    { lab: { flowers: 40, hunters: 4, alpha: 0.9, gamma: 0.2 }, say: '…then they starve: boom and bust' },
  ], { palette: 'candy', hook: 'Can the hunters wipe out the flowers?', title: 'Predator and prey: boom and bust 🌸✂️', desc: 'Flowers multiply, hunters eat them and multiply too. Too many hunters and the food runs out, they die back, and the flowers recover: the Lotka–Volterra cycle.' }),

  L('The Slicing Blade', 'slicer', [
    { lab: { blades: 1, ba: '1.1*t', balls: 4 }, say: 'Every ball the blade touches is cut in half' },
    { lab: { blades: 2, ba: '1.1*t', balls: 5 }, say: 'Two blades: twice the cuts' },
    { lab: { blades: 1, ba: '3*sin(t)', len: 2.2, balls: 6 }, say: 'Blade angle 3·sin(t): it swings' },
  ], { palette: 'rainbow', instrument: 'synth-pluck', hook: 'How many pieces after 20 seconds?', title: 'A blade cuts every ball in half 🗡️', desc: 'Every ball the blade touches is cut into two smaller balls. The blade angle is a formula: a steady turn, or a swing back and forth.' }),

  L('Knife Hit', 'knives', [
    { lab: { spin: '1.5', more: 'n + 4' }, say: 'Constant spin: easy to time' },
    { lab: { spin: '1.6 + 1.3*sin(0.8*t)', more: 'n + 5' }, say: 'The speed changes: harder' },
    { lab: { spin: '3*sin(t)', more: 'n + 6' }, say: 'It turns back and forth!' },
  ], { palette: 'fire', instrument: 'marimba', hook: 'Can you hit it without touching a knife?', title: 'Knife hit: the spin is a formula 🔪', desc: 'Knives are thrown on the beat into a spinning target. The spin speed is a formula of time: steady, wobbling, or reversing.' }),

  L('Spike Draws a Formula', 'popper', [
    { lab: { x: 'cos(t)', y: 'sin(t)', rate: 0.6, count: 200 }, say: 'x = cos t, y = sin t: a circle' },
    { lab: { x: 'sin(2*t)', y: 'sin(3*t)', rate: 0.5, count: 260 }, say: 'sin 2t and sin 3t: a Lissajous curve' },
    { lab: { x: 'cos(4*t)*cos(t)', y: 'cos(4*t)*sin(t)', rate: 0.5, count: 320 }, say: 'r = cos 4t: an eight-petal rose' },
  ], { palette: 'candy', instrument: 'music-box', hook: 'What will the formula draw?', title: 'A spike follows a formula and pops balloons 🎈', desc: 'The spike moves along x(t), y(t). A circle, a Lissajous curve and a rose: each formula pops a different pattern.' }),
];
