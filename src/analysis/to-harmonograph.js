/**
 * A harmonograph preset from a transcription: the pendulums are tuned to the recording's own
 * notes (see chord.js), played with the instrument the analysis chose.
 */
import { PAPERS } from '../circle/harmonograph.js';
import { REVERBS } from './to-preset.js';

/**
 * @param {{freqs:object, tonic:number}} chord from chordFromNotes
 * @param {{name:string, instrument:string, tuning:number, reverb:number, paper?:string, palette?:string, duration?:number}} o
 */
export function harmonographPreset(chord, { name, instrument, tuning = 440, reverb = 2, paper = 'velvet', palette = 'rainbow', duration = 32 }) {
  const p = PAPERS[paper];
  const room = REVERBS[Math.max(0, Math.min(REVERBS.length - 1, reverb))];
  return {
    name, mode: 'circle', transport: { duration, bpm: 90 },
    overlay: { layout: 4, name: { enabled: false } },
    visual: { aspect: '9:16' },
    audio: { scale: 'chromatic', root: 0, noteLow: 40, noteHigh: 88, tuning: Math.round(tuning * 100) / 100, reverb: { decay: room.decay, mix: room.mix }, delay: { time: 0.375, feedback: 0.2, mix: 0 } },
    circle: {
      rule: 'harmonograph',
      lab: { harmonograph: { kind: 'quad', ...chord.freqs, aa: 1, ab: 1, ac: 0.75, ad: 0.6, pa: 90, pb: 0, pc: 45, pd: 0, life: Math.round(duration * 0.95), paper, frame: 'double', sound: 'strum', every: 0.5, base: 48 + chord.tonic, tuning: 'just' } },
      look: { trail: 'lines', palette, background: p.bg, bloom: p.light ? 0 : 1, glow: p.light ? 0.4 : 1 },
      sound: { instrument, pitch: 'angle', volume: 0.8, maxRate: 24, length: 1.6 },
    },
    hook: { text: 'The shape of this sound' },
    youtube: { title: `${name} #shorts`, description: 'A harmonograph tuned to the notes of a recording: pendulums at the same frequency ratios draw the sound.\n\n#shorts', tags: 'harmonograph, pendulum, music and math, shorts' },
  };
}
