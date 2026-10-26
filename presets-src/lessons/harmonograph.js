/**
 * Harmonograph lessons (src/circle/harmonograph.js): step-by-step, vertical, one idea per step.
 */
import { circleLesson as L } from './kit.js';
import { PAPERS, tuneToScale } from '../../src/circle/harmonograph.js';

const look = (paper, palette, extra = {}) => {
  const p = PAPERS[paper];
  return { palette, background: p.bg, bloom: p.light ? 0 : 1, glow: p.light ? 0.4 : 1, ...extra };
};
const base = { sound: 'strum', every: 0.5, base: 48, life: 16, paper: 'midnight' };
const audio = { scale: 'chromatic', root: 0, noteLow: 40, noteHigh: 88, reverb: { decay: 3.6, mix: 0.34 } };

export const HARMONOGRAPH = [
  L('How a Harmonograph Works', 'harmonograph', [
    { lab: { ...base, kind: 'lateral', fa: 3, fb: 2, pa: 90, pb: 0, life: 60 }, say: 'Two pendulums move one pen: x and y', look: look('midnight', 'ice') },
    { lab: { ...base, kind: 'lateral', fa: 3, fb: 2, pa: 90, pb: 0, life: 14 }, say: 'As the swing dies away the line spirals in', look: look('midnight', 'aurora') },
    { lab: { ...base, kind: 'quad', fa: 3, fb: 2, fc: 3.008, fd: 2.004, pa: 90, pd: 45 }, say: 'Four pendulums: a richer figure', look: look('midnight', 'rainbow') },
    { lab: { ...base, kind: 'rotary', fa: 3, fb: 2, fc: 3.004, fd: 2.002, table: 0.25, pa: 90, pd: 45 }, say: 'Put the paper on a turntable', look: look('midnight', 'rosegold') },
    { lab: { ...base, kind: 'epicycle', fa: 5, fb: 3, fc: 8, fd: 2, aa: 1, ab: 0.6, ac: 0.4, ad: 0.3 }, say: 'Or draw with circles on circles', look: look('midnight', 'fire') },
  ], { instrument: 'e-piano', duration: 75, bpm: 90, audio, hook: 'How does a harmonograph work?', title: 'The harmonograph: pendulums that draw, step by step 〰️', tags: 'harmonograph, pendulum, lissajous, math, physics, shorts', desc: 'Two pendulums, four pendulums, a turning table and circles on circles: five ways a damped swing becomes a drawing.' }),

  L('Intervals You Can See', 'harmonograph', [
    { lab: { ...base, kind: 'lateral', fa: 2, fb: 2, pa: 90, every: 0.8 }, say: 'Unison, 1 : 1: a circle', look: look('midnight', 'ice') },
    { lab: { ...base, kind: 'lateral', fa: 2, fb: 4, pa: 90 }, say: 'Octave, 2 : 1: a figure eight', look: look('midnight', 'aurora') },
    { lab: { ...base, kind: 'lateral', fa: 2, fb: 3, pa: 90 }, say: 'Fifth, 3 : 2', look: look('midnight', 'rainbow') },
    { lab: { ...base, kind: 'lateral', fa: 3, fb: 4, pa: 90 }, say: 'Fourth, 4 : 3', look: look('midnight', 'sunset') },
    { lab: { ...base, kind: 'lateral', fa: 4, fb: 5, pa: 90 }, say: 'Major third, 5 : 4', look: look('midnight', 'gold') },
  ], { instrument: 'harp', duration: 75, bpm: 90, audio, hook: 'What does an interval look like?', title: 'Musical intervals as drawings 🎼', tags: 'intervals, harmonograph, music and math, shorts', desc: 'The ratio between two pendulums is the interval between two notes. The simpler the ratio, the simpler the drawing.' }),

  L('Why Figures Turn: Detune', 'harmonograph', [
    { lab: { ...base, kind: 'quad', fa: 3, fb: 2, fc: 3, fd: 2, pa: 90, pd: 45, life: 30 }, say: 'Perfectly tuned: one closed shape', look: look('midnight', 'ice') },
    { lab: { ...base, kind: 'quad', fa: 3, fb: 2, fc: 3.004, fd: 2.002, pa: 90, pd: 45, life: 30 }, say: 'A hair apart: the shape starts to turn', look: look('midnight', 'aurora') },
    { lab: { ...base, kind: 'quad', fa: 3, fb: 2, fc: 3.02, fd: 2.01, pa: 90, pd: 45, life: 30 }, say: 'A little more: a rosette', look: look('midnight', 'rainbow') },
    { lab: { ...base, kind: 'quad', fa: 3, fb: 2, fc: 3.08, fd: 2.04, pa: 90, pd: 45, life: 30 }, say: 'Too much: a net', look: look('midnight', 'fire') },
  ], { instrument: 'glass-pad', duration: 80, bpm: 90, audio, hook: 'Why does the drawing turn?', title: 'Detune a pendulum and the drawing turns 🌀', tags: 'harmonograph, beats, detune, music and math, shorts', desc: 'Two pendulums that are almost, but not exactly, in tune drift apart slowly. The picture turns, and the notes beat.' }),

  L('Mandalas from Pendulums', 'harmonograph', [
    { lab: { ...base, kind: 'rotary', fa: 4, fb: 5, fc: 4.005, fd: 5.01, table: 0.25, ink: 'fine', width: 0.9, sym: 1, life: 24 }, say: 'One drawing', look: look('midnight', 'ice') },
    { lab: { ...base, kind: 'rotary', fa: 4, fb: 5, fc: 4.005, fd: 5.01, table: 0.25, ink: 'fine', width: 0.9, sym: 3, life: 24 }, say: 'Three copies around the centre', look: look('midnight', 'aurora') },
    { lab: { ...base, kind: 'rotary', fa: 4, fb: 5, fc: 4.005, fd: 5.01, table: 0.25, ink: 'fine', width: 0.9, sym: 6, mirror: true, life: 24 }, say: 'Six copies, mirrored: a mandala', look: look('midnight', 'rosegold') },
    { lab: { ...base, kind: 'quad', fa: 3, fb: 5, fc: 3.01, fd: 4.99, ink: 'neon', sym: 8, life: 24, paper: 'velvet' }, say: 'Eight copies: a star', look: look('velvet', 'gold') },
  ], { instrument: 'glass-pad', duration: 80, bpm: 90, audio, hook: 'How do you make a mandala?', title: 'From one pendulum drawing to a mandala 🔯', tags: 'mandala, symmetry, harmonograph, shorts', desc: 'Copy the pen around the centre, and mirror it, and a scribble becomes a mandala.' }),

  L('Chords You Can See', 'harmonograph', [
    { lab: { ...base, kind: 'quad', fa: 2, fb: 3, fc: 4, fd: 6, sound: 'chord', every: 2, base: 40, pa: 90, pc: 0, pd: 90 }, say: 'Power chord: 2 : 3 : 4', look: look('midnight', 'ember') },
    { lab: { ...base, kind: 'quad', fa: 4, fb: 5, fc: 6, fd: 8, sound: 'chord', every: 2, pa: 90, pc: 45 }, say: 'Major chord: 4 : 5 : 6', look: look('midnight', 'rosegold') },
    { lab: { ...base, kind: 'quad', fa: 5, fb: 6, fc: 7.5, fd: 10, sound: 'chord', every: 2, base: 45, pa: 90, pc: 45 }, say: 'Minor chord: 10 : 12 : 15', look: look('midnight', 'indigo') },
    { lab: { ...base, kind: 'quad', fa: 4, fb: 5, fc: 6, fd: 7, sound: 'strum', pa: 90, pc: 45 }, say: 'Seventh chord: 4 : 5 : 6 : 7', look: look('midnight', 'sunset') },
  ], { instrument: 'harp', duration: 80, bpm: 90, audio, hook: 'What does a chord look like?', title: 'Chords drawn by four pendulums 🎹', tags: 'chords, harmonograph, music theory, shorts', desc: 'Four pendulums at the frequency ratios of a chord draw it, and sound it.' }),

  L('The Shape of a Scale', 'harmonograph', [
    { lab: { ...base, kind: 'quad', ...tuneToScale('major', [1, 3, 5, 8], 2), sound: 'strum', pa: 90, pc: 45 }, say: 'Major: degrees 1 3 5 8', look: look('midnight', 'aurora') },
    { lab: { ...base, kind: 'quad', ...tuneToScale('minor', [1, 3, 5, 8], 2), sound: 'strum', pa: 90, pc: 45 }, say: 'Minor: the third is lower', look: look('midnight', 'indigo') },
    { lab: { ...base, kind: 'quad', ...tuneToScale('rast', [1, 3, 5, 8], 2), sound: 'strum', pa: 90, pc: 45, paper: 'parchment', ink: 'ink' }, say: 'Maqam Rast: a quarter-tone third', look: look('parchment', 'sepia') },
    { lab: { ...base, kind: 'quad', ...tuneToScale('shur', [1, 3, 5, 6], 2), sound: 'strum', pa: 90, pc: 30, paper: 'cream', ink: 'ink' }, say: 'Dastgah Shur: koron', look: look('cream', 'indigo') },
  ], { instrument: 'kalimba', duration: 80, bpm: 90, audio, hook: 'Does a scale have a shape?', title: 'The shape of a scale: major, minor, maqam and dastgah 🌙', tags: 'scales, maqam, dastgah, harmonograph, shorts', desc: 'The degrees of a scale become pendulum frequencies. Quarter tones change the shape just as much as they change the sound.' }),
];
