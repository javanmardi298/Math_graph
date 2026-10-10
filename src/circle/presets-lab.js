/**
 * Presets for the newer Circle Lab simulations (vertical 9:16 Shorts): each one with a
 * hook line for the first seconds and a YouTube title / description / tags.
 */
const TAGS = 'satisfying, simulation, math, physics, generative art, asmr, oddly satisfying, shorts';

const L = (name, rule, lab, { look = {}, sound = {}, speed, seed, duration = 30, bpm = 120, audio = {}, hook, title, desc, tags, text } = {}) => ({
  name, mode: 'circle', transport: { duration, bpm },
  overlay: { layout: 4, name: { enabled: false } }, // light text: just the question / caption line
  visual: { aspect: '9:16' },
  audio: { scale: 'minorPentatonic', root: 9, noteLow: 50, noteHigh: 86, reverb: { decay: 3.5, mix: 0.35 }, delay: { time: 0.375, feedback: 0.3, mix: 0.16 }, ...audio },
  circle: {
    rule, ...(seed ? { seed } : {}), lab: { [rule]: lab },
    look: { trail: 'lines', ...look },
    sound: { instrument: 'kalimba', pitch: 'angle', volume: 0.7, maxRate: 24, ...sound },
    ...(speed ? { speed: { from: 1, to: 1, curve: 'linear', pulse: 0, ...speed } } : {}),
    ...(text ? { text } : {}),
  },
  hook: { text: hook },
  youtube: { title: `${title} #shorts`, description: `${desc}\n\n#satisfying #simulation #shorts`, tags: tags || TAGS },
});

export const LAB_PRESETS = [
  /* ------------------------------------------------------- multiply & split */
  L('Every Hit Makes 3', 'triple', { coreN: 3, spread: 70 }, {
    look: { palette: 'rainbow' }, sound: { instrument: 'marimba', pitch: 'rise', volume: 1, maxRate: 14 }, speed: { from: 0.8, to: 1.4, curve: 'smooth' },
    hook: 'Every ball that hits the triangle becomes 3',
    title: '1 ball → 3 → 9 → 27 … → 729 🔺', desc: 'A spinning triangle sits in the middle of the circle. Every ball that hits it splits into three. Powers of three explode fast: 729 balls in seconds.',
  }),
  L('Square Core Doubler', 'boxcore', { coreN: 2 }, {
    look: { palette: 'candy' }, sound: { instrument: 'music-box', pitch: 'angle' },
    hook: 'Hit the square, become two', title: 'Hit the square, become two 🟪', desc: 'A rotating square in a tall box doubles every ball that touches it. Watch the box fill up to 512 balls.',
  }),
  L('Grenade', 'shatter', { wallN: 3 }, {
    look: { palette: 'fire', ringWidth: 4 }, sound: { instrument: 'synth-pluck', pitch: 'rise', drum: 'kick' }, bpm: 124,
    hook: 'One hit and it shatters into 3…', title: 'Every bounce shatters it into 3 pieces 💥', desc: 'One big shard bounces in the box. Every time it hits a wall it shatters into three smaller pieces, which shatter again… until the box is packed with 500 colourful shards.',
  }),
  L('Escape & Multiply', 'escapeplus', { escapeN: 3 }, {
    look: { palette: 'rainbow' }, sound: { instrument: 'kalimba', pitch: 'angle', volume: 0.4 }, speed: { from: 1, to: 1.3, curve: 'build' },
    hook: 'Every ball that escapes adds 3 more', title: 'Every escape adds 3 new balls 🌈', desc: 'A ball bounces inside a ring with a spinning gap. Every ball that slips out falls to the floor and three new balls appear in the middle. The more there are, the faster they escape, until the whole screen is full.',
  }),
  L('Escape Hexagon', 'escapeplus', { arena: 'poly', sides: 6, arenaSize: 0.66, gap: 40, gapSpin: 0.9, escapeN: 2 }, {
    look: { palette: 'aurora' }, sound: { instrument: 'bell', pitch: 'melody', melody: 'canon', length: 0.5, volume: 0.5 },
    hook: 'Can they all get out of the hexagon?', title: 'Escape the spinning hexagon, multiply ⬡', desc: 'A hexagon with one open side spins slowly. Each ball that finds the way out adds two more inside. Every bounce plays the next note of Pachelbel’s Canon (public domain).',
  }),
  L('Chain Reaction', 'chain', {}, {
    look: { palette: 'sunset' }, sound: { instrument: 'marimba', pitch: 'angle' },
    hook: 'When two balls touch, a new one is born', title: 'Every touch makes a new ball 💫', desc: 'Three balls bounce in a capsule. Whenever two of them touch, a third one appears. A chain reaction that ends with 420 balls packed wall to wall.',
  }),
  L('Mitosis', 'mitosis', { divide: 3, childScale: 0.86 }, {
    look: { palette: 'aurora' }, sound: { instrument: 'glass-pad', pitch: 'rise', length: 0.9 }, bpm: 100,
    hook: 'One cell. How many at the end?', title: '1 cell → 512 cells, on the beat 🧫', desc: 'One cell divides into two every three beats. Each generation is a little smaller and pushes the others away, until the whole box is a living tissue.',
  }),

  /* --------------------------------------------------------- fill the screen */
  L('Galton Board', 'galton', {}, {
    look: { palette: 'neon' }, sound: { instrument: 'kalimba', pitch: 'angle', maxRate: 18 }, duration: 34,
    hook: 'Pure luck. Same shape every time?', title: 'Pure chance always draws a bell curve 🔔', desc: 'Every ball goes left or right at each peg, 50/50. Nobody aims, yet the bins always fill into the same bell curve: the normal distribution, live.',
    tags: 'galton board, bell curve, normal distribution, probability, statistics, math, satisfying, shorts',
  }),
  L('Pyramid Cascade', 'pyramid', { rows: 5 }, {
    look: { palette: 'gold' }, sound: { instrument: 'harp', pitch: 'angle', drum: 'hat' },
    hook: 'Where will they land?', title: 'Thousands of balls vs a pyramid 🔺', desc: 'Balls drop on the tip of a pyramid of triangles, slide off the corners row by row and pile up at the bottom, a new colour every 50 balls.',
  }),
  L('Beat Fill', 'beatfill', { emitRamp: 8, colorEvery: 24 }, {
    look: { palette: 'candy' }, sound: { instrument: 'marimba', pitch: 'angle', drum: 'kick' }, bpm: 118,
    hook: 'Can it fill the whole capsule?', title: 'Filling the capsule, one beat at a time 🍬', desc: 'One ball drops on every half beat, one more per drop every bar, a new colour every 24 balls. Layer after layer until the capsule is full.',
  }),
  L('Pachinko Rain', 'pachinko', {}, {
    look: { palette: 'ocean' }, sound: { instrument: 'music-box', pitch: 'angle', maxRate: 20 },
    hook: 'Every pin plays a note', title: '700 balls rain through 100 pins 🌧️', desc: 'Every pin rings a note when a ball hits it, higher at the top, lower at the bottom. The rain slowly fills the floor.',
  }),
  L('Paper Cut ×256', 'paper', { mode: 'half' }, {
    look: { palette: 'candy' }, sound: { instrument: 'marimba', pitch: 'angle' },
    hook: 'Cut it in half… again… and again', title: 'Cut in half, 8 times: 256 pieces ✂️', desc: 'Scissors cut a sheet of paper in half. Then each half in half. Each cut is faster than the last. After 255 cuts: 256 pieces, every one a different colour.',
  }),
  L('Golden Paper', 'paper', { mode: 'golden', cut0: 0.9, decay: 0.95 }, {
    look: { palette: 'sunset' }, sound: { instrument: 'harp', pitch: 'angle', length: 0.6 },
    hook: 'Cut off a square. Repeat.', title: 'Cut off a square, again and again: the golden spiral 🌀', desc: 'Every cut removes the biggest square from the rectangle. The squares spiral inwards and their quarter circles draw a spiral, then each square is cut again into a mosaic.',
  }),
  L('Sierpiński Scissors', 'paper', { mode: 'tri', cut0: 0.9, decay: 0.9, max: 729 }, {
    look: { palette: 'rainbow' }, sound: { instrument: 'bell', pitch: 'angle' },
    hook: 'Cut out the middle. Forever.', title: 'Cut out the middle triangle, forever 🔻', desc: 'Every triangle is cut into four and the middle one falls away. Repeat with the three that are left: the Sierpiński triangle appears, one cut at a time.',
  }),
  L('Mondrian Cuts', 'paper', { mode: 'quad', cut0: 1, decay: 0.9, max: 340 }, {
    look: { palette: 'pastel' }, sound: { instrument: 'e-piano', pitch: 'rise' },
    hook: 'Every cut makes four', title: 'One sheet, cut into four, again and again 🟥🟦', desc: 'Each cut is a cross that makes four pieces. They keep getting smaller and faster until the sheet becomes a pastel mosaic.',
  }),
  L('Circle Packing', 'packing', { shape: 'box' }, {
    look: { palette: 'ocean' }, sound: { instrument: 'kalimba', pitch: 'angle' },
    hook: 'They grow until they touch', title: 'Grow until you touch someone 🫧', desc: 'Circles appear in empty places and grow until they bump into a neighbour or a wall, then freeze with a note: big ones low, tiny ones high. 600 circles later the box is full.',
  }),

  /* ------------------------------------------------------- patterns & rhythm */
  L('Radar: Every Ping Adds One', 'radar', { action: 'add', blips: 2 }, {
    look: { palette: 'matrix' }, sound: { instrument: 'bell', pitch: 'angle', length: 0.4 },
    hook: 'Every ping adds a new target', title: 'Every radar ping adds a target 📡', desc: 'The beam sweeps around. Every target it touches pings and spawns a new one a golden angle away. Two targets become 256 before the end.',
  }),
  L('Radar Countdown', 'radar', { action: 'remove', blips: 120, sweep: 0.35 }, {
    look: { palette: 'matrix' }, sound: { instrument: 'synth-pluck', pitch: 'angle' }, speed: { from: 0.7, to: 1.6, curve: 'build' },
    hook: 'Every ping deletes a dot. How long until none?', title: '120 targets, every ping deletes one 🟢', desc: 'A radar sweep removes every target it touches. The sweep speeds up; the screen empties; the last ping is the loudest.',
  }),
  L('Radar Push', 'radar', { action: 'turn', blips: 40, turn: -30, sweep: 0.5 }, {
    look: { palette: 'aurora' }, sound: { instrument: 'marimba', pitch: 'angle' },
    hook: 'The beam pushes every target', title: 'The radar beam pushes everything 📡', desc: 'Every ping kicks the target 30° backwards, so it meets the beam again sooner. Watch the targets bunch up into a rhythm.',
  }),
  L('Sierpiński From Chaos', 'chaos', { corners: 3, ratio: 0.5 }, {
    look: { palette: 'rainbow' }, sound: { instrument: 'kalimba', pitch: 'ball' },
    hook: 'Random jumps. Watch what appears.', title: 'Random jumps draw a perfect triangle 🔺', desc: 'Pick a random corner, jump halfway there, leave a dot. Repeat 160,000 times. Pure randomness draws the Sierpiński triangle.',
    tags: 'chaos game, sierpinski, fractal, randomness, math, satisfying, shorts',
  }),
  L('Golden Pentagon Chaos', 'chaos', { corners: 5, ratio: 0.618, rate0: 3 }, {
    look: { palette: 'gold' }, sound: { instrument: 'harp', pitch: 'ball' },
    hook: 'Random jumps. What shape appears?', title: 'Jump 1/φ of the way: a golden fractal ⭐', desc: 'Five corners. Jump 0.618 (1 over the golden ratio) of the way to a random one. The dots build a pentagon of pentagons.',
  }),
  L('Never Twice Square', 'chaos', { corners: 4, ratio: 0.5, rule: 'norepeat' }, {
    look: { palette: 'candy' }, sound: { instrument: 'e-piano', pitch: 'ball' },
    hook: 'Random jumps, one small rule', title: 'Never pick the same corner twice 🟦', desc: 'In a square, random half-jumps just fill it with noise. Add one rule (never the same corner twice) and a fractal appears.',
  }),
  L('Sunflower', 'phyllo', { color: 'spiral' }, {
    look: { palette: 'gold' }, sound: { instrument: 'kalimba', pitch: 'angle' }, speed: { from: 1, to: 1.2, curve: 'smooth' },
    hook: 'How does a sunflower place its seeds?', title: 'Turn 137.5° per seed: a sunflower 🌻', desc: 'Every new seed turns by the golden angle (137.508°) and sits a little further out. No other angle packs seeds so evenly: you can count 21 and 34 spirals.',
    tags: 'golden angle, phyllotaxis, sunflower, fibonacci, golden ratio, math, satisfying, shorts',
  }),
  L('One Degree Off', 'phyllo', { angle: 137.3, color: 'golden' }, {
    look: { palette: 'rainbow' }, sound: { instrument: 'bell', pitch: 'angle' },
    hook: 'What if the sunflower is a tiny bit off?', title: 'What if the sunflower is 0.2° off? 🌀', desc: 'The same seed rule with 137.3° instead of the golden angle: the seeds line up into spokes and leave gaps. Nature picks the golden one.',
  }),
  L('Pendulum Wave', 'pendulum', { count: 15, base: 20, cycle: 30 }, {
    look: { palette: 'rainbow' }, sound: { instrument: 'marimba', pitch: 'ball', length: 0.5 }, audio: { scale: 'pentatonic', root: 2, noteLow: 50, noteHigh: 90 },
    hook: '15 pendulums, one moment of sync', title: '15 pendulums, waves, chaos… and sync 🌊', desc: 'Pendulum k swings 20 + k times every 30 seconds. They start together, split into travelling waves and chaos, and line up perfectly again at the end. Every swing is a note.',
  }),
  L('DNA Zip', 'dna', { pairs: 40, zip: 0.5 }, {
    look: { palette: 'neon' }, sound: { instrument: 'e-piano', pitch: 'ball', length: 0.5 }, audio: { scale: 'major', root: 0, noteLow: 55, noteHigh: 84 },
    hook: 'Building DNA, one pair per beat', title: 'Building a DNA helix, one base pair per beat 🧬', desc: 'The double helix zips up from the bottom: one base pair per half beat, A with T, G with C, each with its own note.',
    tags: 'dna, double helix, biology, science, satisfying, animation, shorts',
  }),
  L('Polygon Polyrhythm', 'polygons', { from: 3, to: 10, lap: 8 }, {
    look: { palette: 'rainbow' }, sound: { instrument: 'kalimba', pitch: 'ball' }, audio: { scale: 'pentatonic', root: 2, noteLow: 50, noteHigh: 88 },
    hook: 'One note on every corner', title: 'Triangle to decagon: a note on every corner 🔺⬠⬡', desc: 'Eight nested polygons, one dot each, all finishing a lap at the same time. More corners means more notes: 3 against 4 against 5 … against 10.',
  }),
  L('Sorting: Quicksort', 'sorting', { algo: 'quick', bars: 64, time: 20 }, {
    look: { palette: 'rainbow' }, sound: { instrument: 'square', pitch: 'angle', length: 0.1, maxRate: 40, volume: 1 }, audio: { scale: 'continuous', noteLow: 48, noteHigh: 96 },
    hook: 'Can you hear it sorting?', title: 'Quicksort, but you can hear it 🌈', desc: '64 bars in random order, sorted by quicksort. Every comparison plays the height of the bar, so you hear the order appear. Then a green check sweep.',
    tags: 'sorting algorithm, quicksort, programming, computer science, satisfying, sound of sorting, shorts',
  }),
  L('Sorting: Merge Sort', 'sorting', { algo: 'merge', bars: 96, time: 22 }, {
    look: { palette: 'candy' }, sound: { instrument: 'triangle', pitch: 'angle', length: 0.1, maxRate: 40, volume: 1 }, audio: { scale: 'continuous', noteLow: 48, noteHigh: 96 },
    hook: 'Can you hear it sorting?', title: 'Merge sort, with sound 🍬', desc: 'Merge sort splits the 96 bars in halves, sorts the halves and merges them back. Listen for the rising sweeps when two halves merge.',
    tags: 'sorting algorithm, merge sort, programming, computer science, satisfying, shorts',
  }),
  L('Sorting: Bubble Sort', 'sorting', { algo: 'bubble', bars: 32, time: 24 }, {
    look: { palette: 'sunset' }, sound: { instrument: 'synth-pluck', pitch: 'angle', length: 0.1, maxRate: 30, volume: 0.5 }, audio: { scale: 'continuous', noteLow: 48, noteHigh: 92 },
    hook: 'The slowest sort, the most satisfying', title: 'Bubble sort: slow, simple, satisfying 🫧', desc: 'The big bars bubble up to the right one swap at a time. 32 bars, every comparison a note.',
  }),

  /* -------------------------------------------------------- drawing machines */
  L('Harmonograph', 'harmono', { f1: 3, f3: 3.006, f2: 2, f4: 2.004, decay: 0.012 }, {
    look: { palette: 'aurora', trailWidth: 1.1 }, sound: { instrument: 'glass-pad', pitch: 'angle', length: 1.2 },
    hook: 'Two pendulums, one pen', title: 'Two swinging pendulums draw this ✍️', desc: 'A harmonograph: two pendulums move one pen. Their slightly different rhythms and slow damping draw a figure that keeps shifting.',
  }),
  L('Venus Dance', 'orbits', { inner: 13, outer: 8, cycle: 24, r1: 0.72 }, {
    look: { palette: 'gold', trailWidth: 0.8 }, sound: { instrument: 'bell', pitch: 'angle', length: 0.8, volume: 0.5 },
    hook: 'Earth and Venus draw a flower', title: 'Connect Earth and Venus every few days 🌸', desc: 'Venus goes around the Sun 13 times while Earth goes 8. Draw a line between them every few days and a five-petal rose appears.',
    tags: 'venus, earth, orbit, astronomy, space, pentagram, math art, satisfying, shorts',
  }),
  L('Spirograph Star', 'spiro', { r: 0.37, d: 0.75, rate: 1.6 }, {
    look: { palette: 'rainbow', trailWidth: 1.3 }, sound: { instrument: 'harp', pitch: 'angle' },
    hook: 'A wheel inside a wheel', title: 'A wheel rolling inside a wheel 🌀', desc: 'The classic spirograph: a small wheel rolls inside a big one and a pen on it draws petals. Each petal tip is a note.',
  }),
  L('Cardioid to Chaos', 'times', { points: 200, from: 2, to: 21, build: 5, morph: 22 }, {
    look: { palette: 'rainbow' }, sound: { instrument: 'e-piano', pitch: 'angle' },
    hook: 'Lines on a circle draw a heart', title: 'Times tables on a circle: × 2 draws a heart ❤️', desc: '200 points on a circle; connect point i to point 2i. A cardioid appears. Then the multiplier slides up to 21 and new shapes bloom: nephroid at × 3, flowers after that.',
    tags: 'times tables, cardioid, mathologer, modular arithmetic, math art, satisfying, shorts',
  }),
  L('Fractal Tree', 'tree', { depth: 11, angle: 24, beats: 1 }, {
    look: { palette: 'aurora' }, sound: { instrument: 'harp', pitch: 'angle', length: 0.9 }, bpm: 90,
    hook: 'Every beat, every branch splits', title: 'Every beat, every branch splits in two 🌳', desc: 'One rule: each branch grows two shorter branches, 24° apart. Eleven beats later there are 4,095 branches and blossoms swaying in the wind.',
  }),
  L('Ball in a Spinning Hexagon', 'hexagon', {}, {
    look: { palette: 'rainbow', trailWidth: 1 }, sound: { instrument: 'marimba', pitch: 'angle' },
    hook: 'Can the ball stay inside?', title: 'A ball in a spinning hexagon 🔷', desc: 'Gravity pulls, the walls spin and kick the ball. Its path paints a rainbow web.',
  }),
  L('Closing In', 'shrink', { shrink: 0.006 }, {
    look: { palette: 'sunset' }, sound: { instrument: 'synth-pluck', pitch: 'rise' }, speed: { from: 0.8, to: 1.5, curve: 'build' },
    hook: 'Every hit, the wall closes in', title: 'Every bounce, the wall closes in 🔴', desc: 'Two balls, one circle that shrinks with every hit. Less room, faster hits, until the walls trap them.',
  }),
  L('Square Billiard', 'billiard', { angle: 37.5 }, {
    look: { palette: 'neon', trailWidth: 1.1 }, sound: { instrument: 'bell', pitch: 'angle' },
    hook: 'One ball, no friction, a square table', title: 'A billiard ball that never stops 🎱', desc: 'Launched at 37.5° on a perfect square table with no friction, the ball weaves a fabric of lines that slowly fills the table.',
  }),
  L('Colour War', 'colorwar', { teams: 4, balls: 64 }, {
    look: { palette: 'neon' }, sound: { instrument: 'synth-pluck', pitch: 'ball' }, seed: 11,
    hook: 'Which colour takes over?', title: 'Which colour wins? 🔴🔵🟢🟡', desc: '64 balls, 4 teams. When two balls collide, the faster one paints the other in its colour. Pick your team before it ends.',
  }),
  L('Grow Until Jammed', 'growpack', {}, {
    look: { palette: 'pastel' }, sound: { instrument: 'kalimba', pitch: 'rise' },
    hook: 'They grow with every bounce', title: 'Every bounce makes them bigger 🫧', desc: 'Ten balls grow a little every time they hit the wall. They get bigger and slower until they jam the capsule.',
  }),
  L('Coral Reef', 'coral', {}, {
    look: { palette: 'ocean' }, sound: { instrument: 'glass-pad', pitch: 'angle', length: 0.8 },
    hook: 'Watch a reef grow', title: 'Random walkers grow a coral reef 🪸', desc: 'Particles wander at random and freeze the moment they touch the reef. Branches catch more walkers than valleys, so the reef grows into a forest (diffusion-limited aggregation).',
  }),
  L('Snow Crystal', 'snowflake', {}, {
    look: { palette: 'mono' }, sound: { instrument: 'music-box', pitch: 'angle' },
    hook: 'Random dust becomes a crystal', title: 'Random dust grows a crystal ❄️', desc: 'Dust drifts in from the edge and sticks when it touches the crystal in the middle. Over a thousand grains later: a snowflake-like fractal.',
  }),

  /* ------------------------------------------------- battles & formulas */
  L('Rock Paper Scissors', 'rps', { kinds: 3, each: 20 }, {
    seed: 13, look: { palette: 'neon', bloom: 0.45 }, sound: { instrument: 'marimba', pitch: 'ball', maxRate: 16, volume: 1 },
    hook: 'Rock, paper or scissors: who wins?', title: 'Rock vs paper vs scissors: who wins? 🪨📄✂️',
    desc: '60 players, 3 teams. Paper covers rock, rock crushes scissors, scissors cut paper: whoever loses joins the winner. Everyone chases its prey and runs from its hunter, a little more aggressive every second (chase = 0.1 + 0.03·t). The graph shows who is winning.',
    tags: 'rock paper scissors, simulation, battle, who wins, satisfying, math, shorts',
  }),
  L('Rock Paper Scissors Lizard Spock', 'rps', { kinds: 5, each: 12 }, {
    seed: 9, look: { palette: 'neon', bloom: 0.45 }, sound: { instrument: 'kalimba', pitch: 'ball', maxRate: 16 }, audio: { scale: 'pentatonic', root: 2 },
    hook: 'Five teams. Who wins?', title: 'Rock, paper, scissors, lizard, Spock: who wins? 🖖🦎',
    desc: 'Five teams, and each one beats exactly two others. One formula decides every fight: a beats b when (a − b) mod 5 is odd. Watch the alliances shift on the graph.',
    tags: 'rock paper scissors lizard spock, simulation, battle, who wins, math, shorts',
  }),
  L('RPS Whirlpool', 'rps', { kinds: 3, each: 20, flow: 0.7, flowX: '-y', flowY: 'x' }, {
    seed: 7, look: { palette: 'aurora', bloom: 0.45 }, sound: { instrument: 'harp', pitch: 'ball', maxRate: 16, volume: 0.9 },
    hook: 'Same battle, but in a whirlpool', title: 'Rock paper scissors inside a whirlpool 🌀',
    desc: 'The same battle, but everyone drifts in the flow field v = (−y, x): a rotating whirlpool. The armies get stretched into spirals.',
  }),
  L('RPS Wave Field', 'rps', { kinds: 3, each: 20, flow: 0.6, flowX: 'sin(3*y + t)', flowY: 'cos(3*x - t)' }, {
    seed: 11, look: { palette: 'candy', bloom: 0.45 }, sound: { instrument: 'music-box', pitch: 'ball', maxRate: 16, volume: 0.85 },
    hook: 'A battle on moving waves', title: 'Rock paper scissors on a sea of waves 🌊',
    desc: 'Every player drifts in the wave field v = (sin(3y + t), cos(3x − t)) while it hunts. Currents carry the armies into each other.',
  }),
  L('Scissors vs Flowers', 'predator', { theme: 'garden' }, {
    look: { palette: 'candy', bloom: 0.5 }, sound: { instrument: 'kalimba', pitch: 'angle', maxRate: 18 },
    hook: 'Flowers grow. Scissors cut. Who survives?', title: 'Scissors vs flowers: who survives? ✂️🌸',
    desc: 'Flowers multiply; scissors hunt them. Every cut feeds a pair of scissors, enough food splits it in two, hunger kills it. Boom, bust, boom: the Lotka–Volterra equations F′ = αF − βFS, S′ = δFS − γS, played out live, with the graph below.',
    tags: 'predator prey, lotka volterra, ecosystem simulation, math, biology, satisfying, shorts',
  }),
  L('Needles vs Bubbles', 'predator', { theme: 'bubbles', speed: 0.55 }, {
    look: { palette: 'ocean', bloom: 0.5 }, sound: { instrument: 'music-box', pitch: 'angle', maxRate: 18 },
    hook: 'Bubbles multiply, needles pop them', title: 'Needles vs bubbles: who wins? 🫧📍',
    desc: 'Bubbles multiply, needles hunt them, eat to split, starve to death. The populations rise and fall like the Lotka–Volterra equations predict.',
  }),
  L('Katana', 'slicer', { ba: '1.1*t' }, {
    look: { palette: 'rainbow' }, sound: { instrument: 'synth-pluck', pitch: 'angle', maxRate: 20 },
    hook: 'Every ball it touches: cut in half', title: 'A blade cuts every ball in half 🗡️',
    desc: 'A blade turns at a = 1.1·t radians and slices every ball it crosses into two halves with the same total area (r → r/√2). Five balls become hundreds.',
  }),
  L('Lissajous Blade', 'slicer', { ba: '2.4*t', bx: '0.5*sin(2*t)', by: '0.5*sin(3*t)', len: 1, balls: 7 }, {
    look: { palette: 'sunset' }, sound: { instrument: 'marimba', pitch: 'angle', maxRate: 20 },
    hook: 'Every ball it touches is cut in half', title: 'A blade on a Lissajous path slices everything ✨',
    desc: 'The blade spins while its centre follows the Lissajous curve (0.5 sin 2t, 0.5 sin 3t). Every ball it touches splits in two.',
  }),
  L('Star Blades', 'slicer', { ba: '0.6*t + 0.8*sin(2*t)', blades: 3, len: 0.9, balls: 4, size: 0.2, speed: 0.45, minR: 0.014, max: 600 }, {
    look: { palette: 'fire' }, sound: { instrument: 'bell', pitch: 'angle', maxRate: 18 },
    hook: 'Three blades. How many pieces?', title: 'Three blades, swinging back and forth ⭐',
    desc: 'A six-pointed star of blades turns by a = 0.6t + 0.8 sin 2t: forward, back, forward. Every ball it crosses is cut in two.',
  }),
  L('Knife Hit', 'knives', {}, {
    look: { palette: 'sunset' }, sound: { instrument: 'marimba', pitch: 'angle', volume: 1, drum: 'snare' }, bpm: 116,
    hook: 'Will the next knife hit another one?', title: 'Every beat, a knife. Don’t hit another one! 🔪',
    desc: 'A knife flies on every beat into a target spinning at ω = 1.6 + 1.3·sin(0.8t). Land too close to another knife and it bounces off. Level n needs n + 5 knives; then the target bursts.',
    tags: 'knife hit, game, satisfying, rhythm, physics, shorts',
  }),
  L('Knife Hit: Chaos Spin', 'knives', { spin: '3*sin(1.3*t)*cos(0.5*t) + 0.3*n', more: 'n + 6', every: 0.5 }, {
    look: { palette: 'fire' }, sound: { instrument: 'synth-pluck', pitch: 'angle', drum: 'kick' }, bpm: 124,
    hook: 'It spins back and forth. Faster every level.', title: 'Knife hit, but the target goes crazy 🌀🔪',
    desc: 'The target follows ω = 3 sin(1.3t) cos(0.5t) + 0.3n: it stops, reverses and spins faster every level. A knife every half beat.',
  }),
  L('Rose Popper', 'popper', { x: 'cos(4*t)*cos(t)', y: 'cos(4*t)*sin(t)', rate: 0.21 }, {
    look: { palette: 'rainbow', trailWidth: 2 }, sound: { instrument: 'kalimba', pitch: 'angle', maxRate: 20 },
    hook: 'Popping balloons draws a flower', title: 'Popping 320 balloons draws a flower 🎈🌸',
    desc: 'A spike follows the rose curve r = cos 4θ (x = cos 4t cos t, y = cos 4t sin t) through 320 balloons. The balloons it pops reveal the eight petals.',
  }),
  L('Heart Popper', 'popper', { x: '16*sin(t)^3/17', y: '(13*cos(t) - 5*cos(2*t) - 2*cos(3*t) - cos(4*t))/17', rate: 0.21 }, {
    look: { palette: 'candy', trailWidth: 2.4 }, sound: { instrument: 'music-box', pitch: 'angle', maxRate: 20 },
    hook: 'What will it draw?', title: 'A formula pops a heart into 320 balloons ❤️🎈',
    desc: 'The heart curve x = 16 sin³t, y = 13 cos t − 5 cos 2t − 2 cos 3t − cos 4t, traced by a spike through a field of balloons.',
    tags: 'heart curve, math art, balloons, satisfying, love, formula, shorts',
  }),
  L('Spiral Popper', 'popper', { x: 't/6.3*cos(4*t)', y: 't/6.3*sin(4*t)', rate: 0.21, spike: 0.07 }, {
    look: { palette: 'aurora', trailWidth: 2 }, sound: { instrument: 'harp', pitch: 'angle', maxRate: 20 },
    hook: 'A spiral, popped balloon by balloon', title: 'An Archimedean spiral through 320 balloons 🌀🎈',
    desc: 'The spike moves along r = t/6.3 while turning 4 times faster (x = r cos 4t, y = r sin 4t): an Archimedean spiral carved out of balloons.',
  }),
  L('Lissajous Popper', 'popper', { x: 'sin(3*t)', y: 'sin(4*t)', rate: 0.21, spike: 0.07 }, {
    look: { palette: 'neon', trailWidth: 2 }, sound: { instrument: 'e-piano', pitch: 'angle', maxRate: 20 },
    hook: 'What shape will it pop?', title: 'x = sin 3t, y = sin 4t, popped into balloons 🎈',
    desc: 'A Lissajous figure: the spike swings 3 times left-right while it swings 4 times up-down, popping every balloon on its way.',
  }),
];
