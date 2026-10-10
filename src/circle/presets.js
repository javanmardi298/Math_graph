/**
 * Circle Lab presets (vertical 9:16 for Shorts), each with its hook line and YouTube
 * title / description / tags. Partial states: everything else comes from the defaults.
 */
const TAGS = 'math, satisfying, generative art, math art, golden ratio, physics simulation, bouncing ball, asmr, shorts';

const C = (name, circle, { audio = {}, duration = 30, bpm = 120, hook, youtube, drums } = {}) => ({
  name, mode: 'circle', transport: { duration, bpm },
  visual: { aspect: '9:16' },
  audio: { scale: 'minorPentatonic', root: 9, noteLow: 52, noteHigh: 88, reverb: { decay: 3.5, mix: 0.35 }, delay: { time: 0.375, feedback: 0.3, mix: 0.18 }, ...audio },
  circle, hook: { text: hook }, youtube: { ...youtube, tags: youtube.tags || TAGS },
  ...(drums ? { drums } : {}),
});

export const CIRCLE_PRESETS = [
  C('Will It Ever Close?', { rule: 'chord', chord: { step: '1/phi^2', speed: 1.9, speedGain: 1.006 }, look: { palette: 'neon' }, sound: { instrument: 'kalimba', pitch: 'angle', volume: 0.75 } }, {
    hook: 'Will this pattern ever close?',
    youtube: { title: 'Will this pattern ever close? 🔵 #shorts', description: 'Each hit jumps 1/φ² of a turn around the circle (the golden angle, 137.5°). φ is irrational, so the point never lands on the same spot twice: the pattern never closes and slowly fills the whole disc with a golden star.\n\nEvery hit plays a note picked by where it lands on the circle.\n\n#math #goldenratio #satisfying #mathart #generativeart #shorts' },
  }),
  C('The 5/13 Star', { rule: 'chord', chord: { step: '5/13', speed: 2.4 }, look: { palette: 'sunset', trailWidth: 2 }, sound: { instrument: 'marimba', pitch: 'rise', volume: 0.8 } }, {
    duration: 25, hook: 'It closes after exactly 13 hits',
    youtube: { title: 'This star closes after exactly 13 hits ⭐ #shorts', description: 'Step 5/13 of a turn each time: a rational step p/q always comes back to the start after q hits, drawing a {13/5} star polygon. 5/13 is a Fibonacci ratio, close to the golden angle, so it looks golden… until it closes.\n\n#math #fibonacci #starpolygon #satisfying #geometry #shorts' },
  }),
  C('1/π of a Turn', { rule: 'chord', chord: { step: '1/pi', speed: 2.6, speedGain: 1.004 }, look: { palette: 'gold', trailWidth: 1.3 }, sound: { instrument: 'bell', pitch: 'angle', volume: 0.7, length: 0.6 } }, {
    hook: '1/π of a turn. Does it ever repeat?',
    youtube: { title: '1/π of a turn, forever 🥧 #shorts', description: 'Jump 0.3183… of a turn each time. π is irrational, so the path never closes. But 1/π is very close to 7/22 (hello, 22/7!), so you first see an almost-perfect 22-point star that slowly drifts into a golden rosette.\n\n#math #pi #irrational #satisfying #mathart #shorts' },
  }),
  C('Fibonacci Walkers', { rule: 'chord', chord: { step: '8/21', walkers: 3, speed: 2.2 }, look: { palette: 'rainbow', trailWidth: 1.3 }, sound: { instrument: 'e-piano', pitch: 'angle', volume: 0.7 } }, {
    hook: '3 walkers, one Fibonacci rule',
    youtube: { title: 'Three walkers, one Fibonacci rule 🌈 #shorts', description: 'Three points start a third of a circle apart and all jump 8/21 of a turn per hit (two Fibonacci numbers). Together they weave a 21-point rainbow star.\n\n#math #fibonacci #generativeart #satisfying #shorts' },
  }),
  C('One Ball Becomes 256', { rule: 'split', physics: { speed: 1.5, size: 0.022 }, split: { angle: 9, max: 256 }, look: { palette: 'aurora', trail: 'fade', trailWidth: 1.2 }, sound: { instrument: 'marimba', pitch: 'rise', drum: 'hat', volume: 0.8 } }, {
    hook: '1 ball → 256 balls',
    youtube: { title: 'Every bounce: 1 ball becomes 2 🟢 #shorts', description: 'Each time a ball hits the wall it splits in two, turning a few degrees left and right. 1, 2, 4, 8… doubling is fast: 256 balls in seconds. Exponential growth you can hear.\n\n#math #exponential #satisfying #physics #simulation #shorts' },
  }),
  C('Für Elise Bounce', { rule: 'bounce', physics: { gravity: 2.6, speed: 1.1, angle: 20, speedGain: 1.006, maxSpeed: 5 }, look: { palette: 'rainbow', trailWidth: 1.4 }, sound: { instrument: 'music-box', pitch: 'melody', melody: 'elise', volume: 0.8, length: 0.5 } }, {
    audio: { scale: 'minor', root: 9 }, hook: 'Every bounce plays the next note…',
    youtube: { title: 'Every bounce plays the next note of Für Elise 🎹 #shorts', description: 'A ball falls with gravity and bounces inside a circle with no energy loss, a little faster every time. Each bounce plays the next note of Beethoven\'s Für Elise (public domain), so the melody speeds up with the ball.\n\n#satisfying #furelise #physics #bouncingball #music #shorts' },
  }),
  C('Escape 8 Rings', { rule: 'escape', seed: 7, physics: { gravity: 2.4, speed: 1.5, size: 0.03 }, escape: { rings: 8, inner: 0.28, gap: 48, spin: 1.3 }, look: { palette: 'neon', trail: 'fade' }, sound: { instrument: 'bell', pitch: 'melody', melody: 'ode', volume: 0.75 } }, {
    duration: 20, hook: 'Will the ball escape all 8 rings?',
    youtube: { title: 'Will the ball escape all 8 rings? ⭕ #shorts', description: 'The ball bounces inside the innermost spinning ring. Only the gap lets it out, breaking the ring and freeing it into the next one. Every bounce plays the next note of Ode to Joy (public domain).\n\n#satisfying #willitescape #physics #simulation #asmr #shorts' },
  }),
  C('The Growing Ball', { rule: 'grow', physics: { speed: 1.7, size: 0.03, speedGain: 1.004 }, grow: { amount: 0.0045, until: 0.94 }, look: { palette: 'gold', trail: 'lines', trailWidth: 0.9 }, sound: { instrument: 'kalimba', pitch: 'rise', volume: 0.75 } }, {
    duration: 32, hook: 'It grows with every bounce…',
    youtube: { title: 'It grows with every bounce… until it fills the circle 🟡 #shorts', description: 'A ball bounces inside a circle and gets a little bigger after every hit. Less room means faster bounces, faster bounces mean faster growth. Each hit climbs the scale.\n\n#satisfying #physics #bouncingball #simulation #asmr #shorts' },
  }),
  C('16 Rhythms at Once', { rule: 'polyrhythm', poly: { dots: 16, base: 30, cycle: 60 }, look: { palette: 'rainbow', trail: 'none' }, sound: { instrument: 'e-piano', pitch: 'ball', volume: 0.6, length: 0.5 } }, {
    audio: { scale: 'pentatonic', root: 2, noteLow: 50, noteHigh: 96 }, hook: '16 dots, 16 different rhythms',
    youtube: { title: '16 dots, 16 rhythms, one moment of perfect sync 🌈 #shorts', description: 'Dot k swings 30 + k times per minute. Each one plays its own note when it touches the line, so you hear 16 rhythms at once that drift apart into waves, and all line up again after exactly 60 seconds.\n\n#polyrhythm #satisfying #math #music #asmr #shorts' },
  }),
  C('Six Balls, Zero Friction', { rule: 'bounce', physics: { balls: 6, speed: 1.3, angle: 15, size: 0.025 }, look: { palette: 'rainbow', trailWidth: 1 }, sound: { instrument: 'glass-pad', pitch: 'angle', volume: 0.7, length: 0.9 } }, {
    hook: '6 balls, zero friction',
    youtube: { title: 'Six balls bouncing forever, zero friction 🔮 #shorts', description: 'Six balls start in a ring and bounce inside a perfect circle with no friction. A ball in a circular billiard keeps the same angle with the wall forever, so each one draws its own rosette, and together they weave a mandala.\n\n#billiards #satisfying #physics #mathart #generativeart #shorts' },
  }),
  C('√2 − 1 Mandala', { rule: 'chord', chord: { step: 'sqrt(2) - 1', walkers: 2, speed: 2.4 }, look: { palette: 'aurora', trailWidth: 1.2 }, sound: { instrument: 'harp', pitch: 'angle', volume: 0.75 } }, {
    hook: '√2 − 1 of a turn, twice',
    youtube: { title: 'Two walkers, √2 − 1 of a turn 🌿 #shorts', description: '√2 − 1 = 0.4142… is irrational, so neither walker ever repeats. Starting on opposite sides, they knit an ever-denser aurora mandala.\n\n#math #sqrt2 #irrational #generativeart #satisfying #shorts' },
  }),
  C('Acid Escape', { rule: 'escape', physics: { gravity: 2.2, speed: 1.6, size: 0.032, speedGain: 1.002 }, escape: { rings: 5, inner: 0.35, gap: 40, spin: 1.7 }, look: { palette: 'sunset', trail: 'fade' }, sound: { instrument: 'acid-303', pitch: 'angle', drum: 'kick', volume: 0.65, length: 0.25 } }, {
    duration: 28, bpm: 128, audio: { scale: 'minor', root: 4, noteLow: 40, noteHigh: 64, delay: { time: 0.234, feedback: 0.35, mix: 0.2 } }, hook: 'Can it break out?',
    youtube: { title: 'Can it break out? Acid techno edition 🔶 #shorts', description: 'Five spinning rings, one ball, gravity. Every bounce plays an acid 303 note and a kick; every gap it finds breaks a ring.\n\n#satisfying #techno #acid #physics #simulation #shorts' },
  }),
];
