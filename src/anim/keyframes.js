/**
 * Keyframe animation. A track is a list of { time, value, ease } sorted by time,
 * keyed by a property path. Values can be numbers, #rrggbb colours or camera poses.
 *
 * Layer properties use the layer's position in the list ("layer.0.color"), so
 * tracks survive saving and loading presets (layer ids are regenerated on load).
 */

export const EASES = { smooth: 'Smooth', linear: 'Linear', hold: 'Hold' };

const NUM = (path, label, min, max) => ({ path, label, kind: 'number', min, max });
const COL = (path, label) => ({ path, label, kind: 'color' });

/** Everything that can be animated, given the current layer list. */
export function animatable(state) {
  const list = [
    { path: 'camera.pose', label: 'Camera position', kind: 'pose', group: 'Camera' },
    { ...NUM('camera.fov', 'Field of view', 20, 100), group: 'Camera' },
    { ...NUM('camera.rotateSpeed', 'Auto-rotate speed', -6, 6), group: 'Camera' },
    ...['a', 'b', 'c', 'd'].map((p) => ({ ...NUM(`params.${p}`, `Parameter ${p}`, -5, 5), group: 'Formula' })),
    { ...NUM('visual.bloom.strength', 'Glow strength', 0, 3), group: 'Look' },
    { ...NUM('visual.marker.size', 'Playhead size', 8, 90), group: 'Look' },
    { ...NUM('visual.trail.size', 'Particle size', 1, 20), group: 'Look' },
    { ...NUM('visual.motionBlur.amount', 'Motion blur', 0, 1), group: 'Look' },
    { ...COL('visual.background', 'Background colour'), group: 'Look' },
    { ...NUM('audio.master', 'Master volume', 0, 1), group: 'Sound' },
    { ...NUM('audio.filter.cutoff', 'Filter cutoff (Hz)', 20, 20000), group: 'Sound' },
    { ...NUM('audio.filter.q', 'Filter resonance', 0.1, 18), group: 'Sound' },
    { ...NUM('audio.reverb.mix', 'Reverb mix', 0, 1), group: 'Sound' },
    { ...NUM('audio.delay.mix', 'Delay mix', 0, 1), group: 'Sound' },
  ];
  (state.layers || []).forEach((l, i) => {
    const group = `Layer ${i + 1} · ${l.name}`;
    list.push({ ...COL(`layer.${i}.color`, 'Colour'), group });
    list.push({ ...COL(`layer.${i}.color2`, 'Second colour'), group });
    list.push({ ...NUM(`layer.${i}.volume`, 'Volume', 0, 1), group });
    list.push({ ...NUM(`layer.${i}.width`, 'Thickness', 1, 14), group });
    list.push({ ...NUM(`layer.${i}.pan`, 'Pan', -1, 1), group });
  });
  return list;
}

export const describe = (state, path) => animatable(state).find((a) => a.path === path);

/** Read a property's current value (camera pose is supplied by the caller). */
export function readValue(state, path) {
  const keys = path.split('.');
  if (keys[0] === 'layer') return state.layers[+keys[1]]?.[keys[2]];
  return keys.reduce((o, k) => (o == null ? o : o[k]), state);
}

/** Write a property's value. Returns false if the target doesn't exist. */
export function writeValue(state, path, value) {
  const keys = path.split('.');
  if (keys[0] === 'layer') {
    const l = state.layers[+keys[1]];
    if (!l) return false;
    l[keys[2]] = value;
    return true;
  }
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o == null ? o : o[k]), state);
  if (!target) return false;
  target[last] = value;
  return true;
}

/* ------------------------------------------------------------ interpolation */

const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbToHex = (c) => `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
const lerp = (a, b, k) => a + (b - a) * k;

function mix(a, b, k) {
  if (typeof a === 'number') return lerp(a, b, k);
  if (typeof a === 'string' && a[0] === '#') {
    const ca = hexToRgb(a), cb = hexToRgb(b);
    return rgbToHex(ca.map((v, i) => lerp(v, cb[i], k)));
  }
  if (a && typeof a === 'object' && a.p) {
    // Camera pose: position, target and (2D) zoom.
    if (a.mode !== b.mode) return k < 0.5 ? a : b;
    return {
      mode: a.mode,
      p: a.p.map((v, i) => lerp(v, b.p[i], k)),
      t: a.t.map((v, i) => lerp(v, b.t[i], k)),
      zoom: lerp(a.zoom ?? 1, b.zoom ?? 1, k),
    };
  }
  return k < 0.5 ? a : b;
}

/**
 * Value of a track at `time`. Before the first key it holds the first value,
 * after the last key it holds the last. The ease of a key shapes the segment
 * that LEAVES it.
 */
export function evaluate(keys, time) {
  if (!keys?.length) return undefined;
  if (time <= keys[0].time) return keys[0].value;
  const last = keys[keys.length - 1];
  if (time >= last.time) return last.value;
  let i = 0;
  while (keys[i + 1].time < time) i++;
  const a = keys[i], b = keys[i + 1];
  let k = (time - a.time) / (b.time - a.time || 1);
  if (a.ease === 'hold') k = 0;
  else if (a.ease !== 'linear') k = k * k * (3 - 2 * k);
  return mix(a.value, b.value, k);
}

/** Add a key, replacing any key within `tolerance` seconds. Keeps keys sorted. */
export function upsertKey(tracks, path, time, value, ease = 'smooth', tolerance = 0.05) {
  const keys = (tracks[path] ||= []);
  const existing = keys.find((k) => Math.abs(k.time - time) <= tolerance);
  const v = value && typeof value === 'object' ? structuredClone(value) : value;
  if (existing) { existing.value = v; existing.ease = ease; }
  else keys.push({ time: +time.toFixed(4), value: v, ease });
  keys.sort((a, b) => a.time - b.time);
  return keys;
}

export function removeKey(tracks, path, index) {
  tracks[path]?.splice(index, 1);
  if (tracks[path] && !tracks[path].length) delete tracks[path];
}

/** Values of every track at `time`: Map path → value. */
export function valuesAt(tracks, time) {
  const out = new Map();
  for (const [path, keys] of Object.entries(tracks || {})) if (keys.length) out.set(path, evaluate(keys, time));
  return out;
}

const same = (a, b) => (typeof a === 'object' ? JSON.stringify(a) === JSON.stringify(b) : a === b);

/**
 * Write animated values into `state`.
 * @returns {Set<string>} what changed: 'params' | 'visual' | 'camera' | 'audio' | 'layer:<i>' | 'pose'
 */
export function applyValues(state, values) {
  const changed = new Set();
  for (const [path, v] of values) {
    if (path === 'camera.pose') { changed.add('pose'); continue; }
    if (v === undefined || same(readValue(state, path), v)) continue;
    if (!writeValue(state, path, v)) continue;
    const [root, idx] = path.split('.');
    changed.add(root === 'layer' ? `layer:${idx}` : root);
  }
  return changed;
}
