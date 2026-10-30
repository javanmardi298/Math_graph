/**
 * Lessons for the motion, sync and number scenes (src/circle/motion.js): one idea per step.
 */
import { circleLesson as L } from './kit.js';

const A = { scale: 'chromatic', root: 0, noteLow: 40, noteHigh: 88, reverb: { decay: 3.2, mix: 0.32 } };
const night = { palette: 'aurora', background: '#03050b' };

export const MOTION_LESSONS = [
  L('Fireflies in Step', 'kuramoto', [
    { lab: { k0: 0, k1: 0, spread: 0.25 }, say: 'Each firefly flashes at its own speed' },
    { lab: { k0: 0.6, k1: 0.6, spread: 0.25 }, say: 'A weak pull: still out of step' },
    { lab: { k0: 0, k1: 3, rise: 8, spread: 0.25 }, say: 'Pull harder… suddenly they flash together' },
    { lab: { k0: 0, k1: 3, rise: 8, layout: 'ring', spread: 0.25 }, say: 'The arrow is the average: long = in step' },
  ], { instrument: 'glass-pad', duration: 48, audio: A, look: night, hook: 'How do fireflies flash together?', title: 'How fireflies fall into step (the Kuramoto model) ✨', desc: 'Each one nudges its phase towards the average. Above a critical pull, order appears all at once.' }),

  L('A Sound That Rises Forever', 'shepard', [
    { lab: { step: 0.5, octaves: 1 }, say: 'One note going up a semitone each step' },
    { lab: { step: 0.5, octaves: 6 }, say: 'Six octaves at once, loudest in the middle' },
    { lab: { step: 0.35, octaves: 6, look: 'pole' }, say: 'After 12 steps: the same chord again' },
  ], { instrument: 'e-piano', duration: 36, audio: A, look: { palette: 'ice', background: '#03050b' }, hook: 'Does this sound ever stop rising?', title: 'The Shepard scale: rising forever 🔁', desc: 'The top note fades out while a new bottom note fades in, so the climb never ends.' }),

  L('Three Bodies', 'threebody', [
    { lab: { kind: 'eight', ghost: 0, ghostShow: false }, say: 'Three equal suns can chase each other on a figure eight' },
    { lab: { kind: 'eight', ghost: 0.004, ghostShow: true }, say: 'Nudge one by a hair: the ghost drifts slowly away' },
    { lab: { kind: 'burrau', ghost: 0.001, ghostShow: true }, say: 'Masses 3, 4, 5 at rest: chaos, then one is thrown out' },
  ], { instrument: 'bell', duration: 45, audio: A, look: night, hook: 'Can three suns dance forever?', title: 'The three-body problem: a perfect figure eight and pure chaos ☀️', desc: 'Found in 1993 by Moore, proved by Chenciner and Montgomery in 2000: three equal masses on one figure-eight orbit.' }),

  L('Chaos in a Double Pendulum', 'dpendulum', [
    { lab: { count: 1, angle: 30 }, say: 'A small swing: calm and regular' },
    { lab: { count: 1, angle: 150 }, say: 'A big swing: wild and unpredictable' },
    { lab: { count: 9, angle: 150, diff: 0.0005 }, say: 'Nine start a hair apart… and then go their own way' },
  ], { instrument: 'marimba', duration: 42, audio: A, look: { palette: 'rainbow', background: '#03050b' }, hook: 'Why can’t we predict this?', title: 'Chaos: double pendulums that start almost the same 🌀', desc: 'The same equations, starting angles a ten-thousandth of a radian apart: after a few seconds they disagree completely.' }),

  L('Spirals of Primes', 'primes', [
    { lab: { kind: 'ulam', max: 2500, all: 0.25 }, say: 'Write the numbers on a square spiral' },
    { lab: { kind: 'ulam', max: 10000, all: 0 }, say: 'Keep only the primes: diagonal lines appear' },
    { lab: { kind: 'sacks', max: 20000, all: 0 }, say: 'On a round spiral the lines become curves' },
    { lab: { kind: 'sacks', max: 20000, all: 0, euler: true }, say: 'Gold: n² + n + 41, primes for n = 0 … 39' },
  ], { instrument: 'kalimba', duration: 48, audio: A, look: { palette: 'gold', background: '#03050b' }, hook: 'Are the primes random?', title: 'The hidden lines of the prime numbers 🔢', desc: 'Ulam noticed it in 1963, doodling in a meeting: on a spiral the primes crowd onto lines.' }),

  L('The Fastest Slide', 'brachisto', [
    { lab: { kind: 'race' }, say: 'Four slides from the same top to the same bottom' },
    { lab: { kind: 'race', slow: 0.2 }, say: 'The straight line is the shortest, but not the fastest' },
    { lab: { kind: 'tautochrone', beads: 5 }, say: 'On a cycloid, from any height, they arrive together' },
  ], { instrument: 'harp', duration: 36, audio: A, look: { palette: 'sunset', background: '#03050b' }, hook: 'Which slide is fastest?', title: 'The brachistochrone: why the fastest slide is a curve 🛝', desc: 'Johann Bernoulli’s 1696 challenge: the cycloid. It is also the tautochrone: the time to the bottom does not depend on where you start.' }),
];
