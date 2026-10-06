/**
 * The one place that decides how a point on a curve sounds.
 * Shared by the live synth, the offline WAV renderer and the MIDI exporter,
 * so all three always agree.
 */
import { yToMidi } from '../math/music.js';

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
