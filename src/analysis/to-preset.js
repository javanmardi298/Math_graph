/**
 * Build a preset from transcribed notes. The melody is one function layer whose height is
 * the pitch: a staircase in MIDI numbers over the time in seconds, with a gap (an undefined
 * value, which the engine treats as silence) between notes, so rests and repeated notes play
 * exactly. The note range, the graph window and the pitch map are set so that y = MIDI number.
 */
import { defaultState, createLayer } from '../state.js';

const r3 = (v) => String(Math.round(v * 1000) / 1000);

/**
 * A balanced tree of `x < t ? (left) : (right)`, so evaluating a curve of hundreds of notes
 * takes a handful of comparisons per sample, and the text stays valid for the formula parser.
 * @param {{start:number, stop:number, y:number}[]} segs sorted, non-overlapping
 */
export function stairFormula(segs) {
  if (!segs.length) return '0/0';
  const leaf = (i) => `x<${r3(segs[i].stop)}?${r3(segs[i].y)}:0/0`;
  const tree = (lo, hi) => {
    if (lo === hi) return leaf(lo);
    const mid = (lo + hi) >> 1;
    return `x<${r3(segs[mid + 1].start)}?(${tree(lo, mid)}):(${tree(mid + 1, hi)})`;
  };
  return `x<${r3(segs[0].start)}?0/0:(${tree(0, segs.length - 1)})`;
}

export const REVERBS = [
  { id: 'dry', label: 'Dry', decay: 0.4, mix: 0.04 },
  { id: 'room', label: 'Room', decay: 1.2, mix: 0.17 },
  { id: 'hall', label: 'Hall', decay: 2.6, mix: 0.3 },
  { id: 'cathedral', label: 'Cathedral', decay: 4.6, mix: 0.42 },
];

/**
 * @param {object} o
 * @param {{start:number,end:number,pitch:number}[]} o.notes seconds, pitch = MIDI number (halves allowed), sorted
 * @param {number} o.bpm
 * @param {string} o.scale audio.scale key ('continuous' keeps every note exactly)
 * @param {number} o.root 0..11
 * @param {number} o.tuning A4 in Hz
 * @param {string} o.instrument instrument id
 * @param {number} [o.shift] semitones the instrument sounds above the note it is given (a multiple of 12): the layer's octave cancels it
 * @param {'pluck'|'legato'} o.articulation
 * @param {{decay:number, mix:number}} o.reverb
 * @param {string} o.name
 * @param {string} [o.aspect]
 * @param {number} [o.trim] seconds of lead-in to cut: the preset starts that much into the recording
 */
export function buildPreset({ notes, bpm, scale, root, tuning, instrument, articulation, reverb, name, aspect = '9:16', shift = 0, trim = 0 }) {
  const s = defaultState();
  const segs = notes.map((n) => {
    const len = n.end - n.start;
    return { start: Math.max(0, n.start - trim), stop: Math.max(0, n.end - trim) - Math.min(0.04, Math.max(0.012, len * 0.12)), y: n.pitch };
  }).filter((g) => g.stop > g.start);
  const end = segs.length ? segs[segs.length - 1].stop : 4;
  const duration = Math.max(4, Math.ceil((end + 0.6) * 2) / 2);
  let lo = Math.min(...notes.map((n) => n.pitch)) - 3, hi = Math.max(...notes.map((n) => n.pitch)) + 3;
  if (hi - lo < 12) { const c = (hi + lo) / 2; lo = c - 6; hi = c + 6; }
  lo = Math.max(0, Math.floor(lo)); hi = Math.min(127, Math.ceil(hi));

  s.name = name;
  s.mode = '2d';
  s.transport = { ...s.transport, duration, speed: 1, bpm: Math.round(bpm * 10) / 10 };
  s.view = { xMin: 0, xMax: duration, yMin: lo, yMax: hi };
  s.layers = [createLayer({
    name: 'Melody', type: 'function', exprs: { y: stairFormula(segs), z: '0' }, range: { min: 0, max: duration },
    wave: instrument, colorMode: 'pitch', width: 5, volume: 0.7, zMap: 'none', pitchFrom: 'height', octave: -Math.round(shift / 12),
    samples: Math.min(9000, Math.max(900, Math.ceil(duration * 100))), caption: name,
  })];
  s.audio = {
    ...s.audio, noteLow: lo, noteHigh: hi, scale, root, tuning: Math.round(tuning * 100) / 100, glide: 6, articulation,
    reverb: { ...s.audio.reverb, decay: reverb.decay, mix: reverb.mix },
    delay: { ...s.audio.delay, mix: 0 },
  };
  s.visual = { ...s.visual, aspect, showNotes: true, drawMode: 'trace' };
  return s;
}
