/**
 * Circle Lab layers: several simulations in one video, the same way formula layers
 * work in 2D/3D.
 *
 *   together          every layer runs for the whole timeline, drawn on top of each other
 *                     (give them their own place with Position / Zoom)
 *   one after another the enabled layers are split into steps that play in turn; a layer
 *                     linked to the one above (withPrev) joins its step
 *
 * Layer 1 is state.circle itself (its background, light, text and counter style are the
 * video's); more layers live in state.circle.layers = [{ id, enabled, withPrev, cfg }],
 * where cfg is a complete circle setting (rule, settings, sound, palette, position …).
 * Pure: shared by the view, the soundtrack and the tests.
 */
import { layerGroups, hasWindow } from '../math/sequence.js';

export const FADE = 0.45; // seconds of cross-fade between steps

/** Every layer, the first one being state.circle itself. */
export function circleLayers(c) {
  return [{ id: 'main', enabled: true, withPrev: false, start: c.start || 0, end: c.end || 0, cfg: c }, ...(c.layers || [])];
}

/**
 * When each enabled layer plays.
 * @returns {{layer:object, start:number, end:number, group:number, groups:number}[]}
 */
export function circleSchedule(c, duration) {
  const all = circleLayers(c).filter((l) => l.enabled !== false && l.cfg);
  // layers with a time window of their own play in it, whatever the others do
  const timed = all.filter(hasWindow).map((layer) => {
    const start = Math.min(Math.max(0, layer.start || 0), duration);
    const explicitEnd = layer.end > start && layer.end < duration;
    // an explicit end makes the layer fade out there; without one it stays to the end
    return { layer, start, end: explicitEnd ? layer.end : duration, group: 0, groups: explicitEnd ? 2 : 1 };
  });
  const rest = all.filter((l) => !hasWindow(l));
  if (c.combine !== 'sequence' || rest.length < 2) return [...rest.map((layer) => ({ layer, start: 0, end: duration, group: 0, groups: 1 })), ...timed];
  const groups = layerGroups(rest);
  const seg = duration / groups.length;
  return [...groups.flatMap((g, j) => g.map((layer) => ({ layer, start: j * seg, end: (j + 1) * seg, group: j, groups: groups.length }))), ...timed];
}

/**
 * What is on screen at `time`: each entry with its own clock and opacity. A finished
 * step stays (frozen on its last frame) while the next one fades in.
 */
export function visibleAt(schedule, time) {
  const out = [];
  for (const s of schedule) {
    const last = s.group === s.groups - 1;
    if (time < s.start) continue;
    let alpha = 1;
    if (s.start > 0 && time < s.start + FADE) alpha = (time - s.start) / FADE; // fading in
    if (!last && time >= s.end) {
      if (time >= s.end + FADE) continue;
      alpha = 1 - (time - s.end) / FADE; // fading out, frozen
    }
    out.push({ ...s, local: Math.min(time, s.end) - s.start, alpha: Math.max(0, Math.min(1, alpha)) });
  }
  return out;
}

/** The layer whose text and counter are shown at `time` (the first one of the current step). */
export function headlineAt(schedule, time) {
  let g = 0;
  for (const s of schedule) if (time >= s.start) g = Math.max(g, s.group);
  return schedule.find((s) => s.group === g) || schedule[0];
}

/** A new layer: a copy of `from` (so it keeps the look) with another simulation. */
export function newLayer(from, rule, id) {
  const { layers, combine, ...cfg } = structuredClone(from);
  void layers; void combine;
  return { id, enabled: true, withPrev: false, cfg: { ...cfg, rule, lab: cfg.lab || {}, text: { ...cfg.text, formula: '' } } };
}
