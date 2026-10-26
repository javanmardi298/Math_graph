/**
 * Spirograph and guilloche lessons (src/circle/spirograph.js): vertical, one idea per step.
 */
import { circleLesson as L } from './kit.js';
import { PAPERS } from '../../src/circle/harmonograph.js';

const look = (paper, palette, extra = {}) => {
  const p = PAPERS[paper];
  return { palette, background: p.bg, bloom: p.light ? 0 : 1, glow: p.light ? 0.4 : 1, ...extra };
};
const desk = (lab, extra = {}) => ({ kind: 'hypo', paper: 'desk', ink: 'fine', colorBy: 'time', drawTime: 12, ...lab, ...extra });
const A = { scale: 'chromatic', root: 0, noteLow: 40, noteHigh: 88, reverb: { decay: 3, mix: 0.3 } };

export const SPIRO_LESSONS = [
  L('How a Spirograph Works', 'spirograph', [
    { lab: desk({ R: 96, r: 30, d: 21 }), say: 'A wheel with teeth rolls inside a ring with teeth', look: look('desk', 'indigo') },
    { lab: desk({ R: 96, r: 30, d: 21, toyShow: 'off' }), say: 'A pen in one hole of the wheel draws', look: look('desk', 'indigo') },
    { lab: desk({ R: 96, r: 30, d: 21, size: 1.05 }), say: 'The drawing has 16 petals and closes after 5 turns', look: look('desk', 'indigo') },
    { lab: desk({ R: 96, r: 30, d: 12 }), say: 'A hole nearer the centre: smoother', look: look('desk', 'indigo') },
    { lab: desk({ R: 96, r: 30, d: 30 }), say: 'On the rim: sharp points', look: look('desk', 'indigo') },
  ], { instrument: 'kalimba', duration: 70, bpm: 100, audio: A, hook: 'How does a Spirograph work?', title: 'How a Spirograph works, step by step 🌀', tags: 'spirograph, geometry, gears, math art, shorts', desc: 'A toothed wheel in a toothed ring, a pen in a hole, and the numbers of teeth that decide the shape.' }),

  L('Teeth Decide the Shape', 'spirograph', [
    { lab: desk({ R: 96, r: 30, d: 21 }), say: '96 and 30: 16 petals, 5 turns', look: look('desk', 'indigo') },
    { lab: desk({ R: 96, r: 32, d: 22 }), say: '96 and 32: 3 petals, 1 turn', look: look('desk', 'rainbow') },
    { lab: desk({ R: 96, r: 42, d: 30 }), say: '96 and 42: 16 petals, 7 turns', look: look('desk', 'peacock') },
    { lab: desk({ R: 96, r: 63, d: 44, drawTime: 16 }), say: '96 and 63: 32 petals, 21 turns', look: look('desk', 'candy') },
    { lab: desk({ R: 100, r: 38.2, d: 27, turns: 40, drawTime: 18, maxTurns: 40 }), say: 'Golden ratio: it never closes', look: look('desk', 'sepia') },
  ], { instrument: 'harp', duration: 80, bpm: 100, audio: A, hook: 'Which gears make which flower?', title: 'The teeth decide the shape: petals and turns 🔢', tags: 'spirograph, gcd, geometry, math, shorts', desc: 'Petals = R ÷ gcd(R, r). Turns = r ÷ gcd(R, r). A ratio that is not a fraction never closes.' }),

  L('The Pen Hole', 'spirograph', [
    { lab: desk({ R: 96, r: 40, d: 10 }), say: 'Close to the centre: nearly a circle', look: look('desk', 'indigo') },
    { lab: desk({ R: 96, r: 40, d: 20 }), say: 'Halfway: gentle waves', look: look('desk', 'indigo') },
    { lab: desk({ R: 96, r: 40, d: 32 }), say: 'Near the edge: deep loops', look: look('desk', 'indigo') },
    { lab: desk({ R: 96, r: 40, d: 40 }), say: 'On the edge: sharp points (a hypocycloid)', look: look('desk', 'indigo') },
    { lab: desk({ R: 96, r: 40, d: 50 }), say: 'Beyond the edge: knots', look: look('desk', 'indigo') },
  ], { instrument: 'marimba', duration: 70, bpm: 100, audio: A, hook: 'Does the hole matter?', title: 'How the pen hole changes the drawing 🕳️', tags: 'spirograph, hypotrochoid, geometry, shorts', desc: 'The same gears with the pen at five distances from the centre of the wheel.' }),

  L('Inside and Outside', 'spirograph', [
    { lab: desk({ kind: 'hypo', R: 84, r: 24, d: 18 }), say: 'Inside the ring: loops point inward', look: look('desk', 'indigo') },
    { lab: desk({ kind: 'epi', R: 64, r: 22, d: 16 }), say: 'Around a disk: loops point outward', look: look('desk', 'rainbow') },
    { lab: desk({ kind: 'epi', R: 40, r: 40, d: 40, turns: 1, size: 0.9 }), say: 'Equal circles: a cardioid', look: look('desk', 'candy') },
    { lab: desk({ kind: 'epi', R: 80, r: 40, d: 40, turns: 1, size: 0.85 }), say: 'Half the size: a nephroid', look: look('desk', 'aurora') },
  ], { instrument: 'harp', duration: 56, bpm: 100, audio: A, hook: 'Roll it inside or outside?', title: 'Inside, outside and the curves they make 🪐', tags: 'epitrochoid, hypotrochoid, cardioid, nephroid, shorts', desc: 'A wheel rolling inside a ring (hypotrochoid) or around a disk (epitrochoid), and the famous curves you get with the pen on the rim.' }),

  L('Beyond the Toy', 'spirograph', [
    { lab: desk({ kind: 'compound', R: 120, r: 48, d: 20, r2: 19, d2: 9, m: 7, turns: 6, toyRing: '#ff6b9a' }), say: 'A gear in a gear in a ring', look: look('desk', 'peacock') },
    { lab: desk({ kind: 'lobed', R: 96, r: 34, d: 22, lobes: 3, lobeAmt: 0.2, paper: 'velvet', toyStyle: 'neon', ink: 'neon' }), say: 'A wheel that is not round', look: look('velvet', 'aurora') },
    { lab: desk({ R: 105, r: 41, d: 33, dFormula: 'd*(0.35 + 0.65*sin(0.075*t)^2)', turns: 41, toyShow: 'off', paper: 'midnight' }), say: 'A pen that moves in and out', look: look('midnight', 'ice') },
    { lab: desk({ kind: 'formula', fx: '(ring-wheel)*cos(t) + d*cos(k*t)*(1 + 0.3*sin(0.5*t))', fy: '(ring-wheel)*sin(t) - d*sin(k*t)*(1 + 0.3*sin(0.5*t))', R: 96, r: 30, d: 22, turns: 10, paper: 'cream', ink: 'ink' }), say: 'Or write the formula yourself', look: look('cream', 'indigo') },
  ], { instrument: 'glass-pad', duration: 64, bpm: 100, audio: A, hook: 'What can a real Spirograph not do?', title: 'Beyond the toy: gears in gears, odd wheels, formulas 🎡', tags: 'spirograph, math art, gears, shorts', desc: 'Compound gears, a lobed wheel, a pen that moves in and out, and your own formula.' }),

  L('What Is a Guilloche?', 'guilloche', [
    { lab: { type: 'rosette', R: 64, r: 24, d: 14, lines: 42, revealTime: 10, colors: 'bands', ink1: '#1f5a8a', ink2: '#2a8a6a', ink3: '#8a2a5a', paper: 'cream' }, say: 'A rosette: one curve, drawn again and again, each turned a little', look: look('cream', 'indigo') },
    { lab: { type: 'dial', rings: 90, lobes: 12, revealTime: 10, rays: 120, furniture: 'hands', colors: 'bands', ink1: '#c9d6e8', ink2: '#9fb4ff', ink3: '#ffffff', paper: 'velvet', width: 0.8 }, say: 'A watch dial: rings with waves that shift', look: look('velvet', 'mono') },
    { lab: { type: 'ribbon', strands: 26, waves: 8, revealTime: 12, corners: true, centre: true, ink1: '#2a5a3a', ink2: '#7a2a3a', ink3: '#c08a20', paper: 'parchment' }, say: 'A border: strands that weave', look: look('parchment', 'sepia') },
    { lab: { type: 'lathe', rings: 140, lobes: 9, amp: 0.027, ampGrow: 0.6, innerR: 0.07, phaseStep: 0.11, revealTime: 10, colors: 'palette', hue0: 0.12, hueSpan: 0.15, paper: 'ember', width: 0.8 }, say: 'Rose-engine work: a moiré of rings', look: look('ember', 'gold') },
  ], { instrument: 'music-box', duration: 52, bpm: 100, audio: A, hook: 'What is the pattern on a banknote?', title: 'Guilloche: the engraver’s pattern, step by step 🔏', tags: 'guilloche, banknote, watch dial, engraving, shorts', desc: 'Four kinds of guilloche: rosette, engine-turned dial, interwoven border and rose-engine moiré.' }),
];
