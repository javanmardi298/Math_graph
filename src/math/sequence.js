/**
 * Layer playback order. Together: every layer spans the whole timeline.
 * In sequence: enabled layers split the timeline into equal slices and play
 * one after another; a layer is 'future' before its slice, 'active' during
 * it and 'past' after it.
 *
 * @param {object[]} layers all layers (disabled ones are skipped)
 * @param {object} layer the layer to ask about
 * @param {number} time timeline seconds
 * @param {number} duration timeline length in seconds
 * @param {boolean} inSequence
 * @returns {{u:number, phase:'active'|'past'|'future'}} u = the layer's own progress 0..1
 */
export function layerTiming(layers, layer, time, duration, inSequence) {
  if (!inSequence) return { u: Math.min(Math.max(time / duration, 0), 1), phase: 'active' };
  const order = layers.filter((l) => l.enabled);
  const j = order.indexOf(layer);
  if (j < 0) return { u: 0, phase: 'future' };
  const seg = duration / order.length;
  const current = Math.min(order.length - 1, Math.max(0, Math.floor(time / seg)));
  if (j < current) return { u: 1, phase: 'past' };
  if (j > current) return { u: 0, phase: 'future' };
  return { u: Math.min(Math.max((time - j * seg) / seg, 0), 1), phase: 'active' };
}
