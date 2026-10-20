/**
 * The one place that decides how a point on a curve sounds.
 * Shared by the live synth, the offline WAV renderer and the MIDI exporter,
 * so all three always agree.
 */
import { yToMidi, quantize } from '../math/music.js';
import { MELODIES, parseNotes } from '../circle/sound.js';

/**
 * @param {object} layer
 * @param {{x:number,y:number,z:number}} point current playhead point
 * @param {object} state app state (view + audio)
 * @param {boolean} anySolo true when at least one layer is soloed
 * @returns {{id:string, midi:number|null, gain:number, pan:number, wave:string}}
 */
export function voiceFrame(layer, point, state, anySolo) {
  const { view, audio } = state;
  const silent = !layer.enabled || layer.mute || (anySolo && !layer.solo);
  const midi = silent ? null : yToMidi(point.y, { ...audio, yMin: view.yMin, yMax: view.yMax }, layer.octave);
  const zRange = (view.yMax - view.yMin) / 2 || 1;
  const zn = Number.isFinite(point.z) ? Math.max(-1, Math.min(1, point.z / zRange)) : 0;
  let gain = layer.volume;
  let pan = layer.pan;
  if (layer.zMap === 'volume') gain *= Math.max(0.05, Math.min(1.6, 1 + 0.6 * zn));
  else if (layer.zMap === 'pan') pan = Math.max(-1, Math.min(1, pan + zn));
  return { id: layer.id, midi, gain: silent ? 0 : gain, pan, wave: layer.wave };
}

export const hasSolo = (layers) => layers.some((l) => l.enabled && l.solo);

const parsed = new Map();

/**
 * The note of a layer that plays a written melody: the layer's pass (0..1) is cut into one
 * slice per note, so the drawing is the melody's tempo (and speed keyframes change it).
 * Notes are snapped to the scale unless it is continuous. null = the layer plays by height.
 */
export function melodyMidi(layer, u, audio) {
  if (layer.pitchFrom !== 'melody') return null;
  const text = layer.melody === 'custom' ? layer.notes : MELODIES[layer.melody]?.notes;
  let notes = parsed.get(text);
  if (!notes) { notes = parseNotes(text); if (parsed.size > 50) parsed.clear(); parsed.set(text, notes); }
  if (!notes.length) return null;
  const n = notes.length * Math.max(1, Math.round(layer.melodyLoops || 1));
  const k = Math.min(n - 1, Math.floor(Math.min(Math.max(u, 0), 1) * n));
  const m = notes[k % notes.length] + (layer.octave || 0) * 12;
  return audio.scale === 'continuous' ? m : quantize(m, audio.scale, audio.root || 0);
}
