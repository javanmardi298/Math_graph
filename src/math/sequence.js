/**
 * Layer playback order. Together: every layer spans the whole timeline.
 * In sequence: enabled layers are grouped into steps that play one after another.
 * A layer marked `withPrev` joins the step of the layer above it, so any number of
 * layers can be linked to play together inside a step. Each step gets an equal slice
 * of the timeline; a layer is 'future' before its step, 'active' during it and
 * 'past' after it.
 *
 * A layer can also have a time window of its own (`start` / `end` in seconds, 0 = from the
 * start / to the end): it then plays between those moments whatever the other layers do
 * (in "one after another" it no longer takes a step).
 */

/** Does the layer have its own time window? */
export const hasWindow = (l) => (l.start || 0) > 0 || (l.end || 0) > 0;

/** Steps of the sequence: arrays of enabled layers that play together. */
export function layerGroups(layers) {
  const groups = [];
  for (const l of layers) {
    if (!l.enabled || hasWindow(l)) continue;
    if (l.withPrev && groups.length) groups[groups.length - 1].push(l);
    else groups.push([l]);
  }
  return groups;
}

/**
 * @param {object[]} layers all layers (disabled ones are skipped)
 * @param {object} layer the layer to ask about
 * @param {number} time timeline seconds
 * @param {number} duration timeline length in seconds
 * @param {boolean} inSequence
 * @returns {{u:number, phase:'active'|'past'|'future'}} u = the layer's own progress 0..1
 */
export function layerTiming(layers, layer, time, duration, inSequence) {
  if (hasWindow(layer)) {
    const s = Math.min(Math.max(0, layer.start || 0), duration);
    const explicitEnd = layer.end > s && layer.end < duration;
    const e = explicitEnd ? layer.end : duration;
    if (time < s) return { u: 0, phase: 'future' };
    if (explicitEnd && time >= e) return { u: 1, phase: 'past' };
    return { u: Math.min(Math.max((time - s) / Math.max(1e-6, e - s), 0), 1), phase: 'active' };
  }
  if (!inSequence) return { u: Math.min(Math.max(time / duration, 0), 1), phase: 'active' };
  const groups = layerGroups(layers);
  const j = groups.findIndex((g) => g.includes(layer));
  if (j < 0) return { u: 0, phase: 'future' };
  const seg = duration / groups.length;
  const current = Math.min(groups.length - 1, Math.max(0, Math.floor(time / seg)));
  if (j < current) return { u: 1, phase: 'past' };
  if (j > current) return { u: 0, phase: 'future' };
  return { u: Math.min(Math.max((time - j * seg) / seg, 0), 1), phase: 'active' };
}
