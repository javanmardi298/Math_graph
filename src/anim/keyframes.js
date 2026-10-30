/**
 * Keyframe animation. A track is a list of { time, value, ease } sorted by time,
 * keyed by a property path. Values can be numbers, #rrggbb colours or camera poses.
 *
 * Layer properties use the layer's position in the list ("layer.0.color"), so
 * tracks survive saving and loading presets (layer ids are regenerated on load).
 */
import { SCALES } from '../math/music.js';
import { INSTRUMENTS } from '../audio/instruments.js';

export const EASES = { smooth: 'Smooth', linear: 'Linear', hold: 'Hold (step)', in: 'Ease in (slow start)', out: 'Ease out (slow end)' };

/**
 * kind: number (glides) | step (a number that jumps, e.g. the key note) | color |
 * choice (a name or a switch: scale, instrument, filter type … holds until the next key) | pose (camera view).
 */
import { FX_STYLES } from '../render/fx-styles.js';
import { BACKDROPS } from '../render/backdrops.js';

const FX_IDS = Object.keys(FX_STYLES), BACKDROP_IDS = Object.keys(BACKDROPS);
const NUM = (path, label, min, max) => ({ path, label, kind: 'number', min, max });
const STEP = (path, label, min, max) => ({ path, label, kind: 'step', min, max });
const COL = (path, label) => ({ path, label, kind: 'color' });
const CHOICE = (path, label, options) => ({ path, label, kind: 'choice', options });

const FILTERS = ['lowpass', 'highpass', 'bandpass', 'notch'];
const MODS = ['off', 'chorus', 'flanger', 'phaser'];
const DRAW = ['trace', 'ghost', 'full'];
const ANALYZERS = ['off', 'spectrum', 'wave'];
const MARKERS = ['circle', 'ring', 'star', 'diamond'];

/** The lane (row on the timeline) a property belongs to. */
export const LANES = ['Camera', 'Speed', 'Sound', 'Look', 'Formula', 'Layers'];
export function laneOf(path) {
  const root = path.split('.')[0];
  if (path === 'transport.speed') return 'Speed';
  return { camera: 'Camera', audio: 'Sound', visual: 'Look', params: 'Formula', layer: 'Layers' }[root] || 'Look';
}

/** Everything that can be animated, given the current layer list. */
export function animatable(state, scales = Object.keys(SCALES), instruments = Object.keys(INSTRUMENTS)) {
  const list = [
    { path: 'camera.pose', label: 'Camera position', kind: 'pose', group: 'Camera' },
    { ...NUM('camera.fov', 'Field of view', 20, 100), group: 'Camera' },
    { ...NUM('camera.rotateSpeed', 'Auto-rotate speed', -6, 6), group: 'Camera' },
    { ...NUM('camera.track', 'Follow the pen', 0, 1), group: 'Camera' },
    { ...NUM('camera.trackSpeed', 'Follow smoothness', 0.01, 0.3), group: 'Camera' },
    { ...NUM('camera.punch', 'Beat punch zoom', 0, 1), group: 'Camera' },
    { ...NUM('camera.roll', 'Roll (degrees)', -45, 45), group: 'Camera' },
    { ...NUM('camera.zoom', 'Zoom', 0.4, 4), group: 'Camera' },
    { ...NUM('camera.push', 'Push-in / pull-out', -1, 1), group: 'Camera' },
    { ...NUM('camera.breathe', 'Breathe', 0, 1), group: 'Camera' },
    { ...NUM('camera.drift', 'Drift', 0, 1), group: 'Camera' },
    { ...NUM('camera.shake', 'Handheld shake', 0, 1), group: 'Camera' },
    { ...NUM('camera.sway', 'Sway', 0, 1), group: 'Camera' },
    { ...NUM('camera.spin', 'Spin', -1, 1), group: 'Camera' },
    { ...NUM('transport.speed', 'Playback speed', 0.1, 5), group: 'Speed' },
    ...['a', 'b', 'c', 'd'].map((p) => ({ ...NUM(`params.${p}`, `Parameter ${p}`, -5, 5), group: 'Formula' })),
    { ...NUM('visual.bloom.strength', 'Glow strength', 0, 3), group: 'Look' },
    { ...NUM('visual.exposure', 'Exposure (0 = black)', 0, 4), group: 'Look' },
    { ...NUM('visual.letterbox', 'Cinema bars', 0, 1), group: 'Look' },
    { ...CHOICE('visual.fx.style', 'Drawing style', FX_IDS), group: 'Look' },
    { ...NUM('visual.fx.intensity', 'Line brightness', 0, 2), group: 'Look' },
    { ...NUM('visual.fx.tail', 'Lit tail', 0.02, 1), group: 'Look' },
    { ...NUM('visual.fx.offset', 'Colour split', 0, 20), group: 'Look' },
    { ...NUM('visual.fx.stringAlpha', 'String brightness', 0, 1), group: 'Look' },
    { ...CHOICE('visual.backdrop', 'Backdrop', BACKDROP_IDS), group: 'Look' },
    { ...NUM('visual.bloom.radius', 'Glow radius', 0, 1.5), group: 'Look' },
    { ...NUM('visual.bloom.threshold', 'Glow threshold', 0, 1), group: 'Look' },
    { ...NUM('visual.marker.size', 'Playhead size', 8, 90), group: 'Look' },
    { ...CHOICE('visual.marker.shape', 'Playhead shape', MARKERS), group: 'Look' },
    { ...NUM('visual.trail.size', 'Particle size', 1, 20), group: 'Look' },
    { ...STEP('visual.trail.count', 'Particle count', 0, 400), group: 'Look' },
    { ...NUM('visual.motionBlur.amount', 'Motion blur', 0, 1), group: 'Look' },
    { ...NUM('visual.fog.density', 'Fog density', 0, 0.3), group: 'Look' },
    { ...CHOICE('visual.drawMode', 'Drawing mode', DRAW), group: 'Look' },
    { ...CHOICE('visual.analyzer', 'Analyzer', ANALYZERS), group: 'Look' },
    { ...CHOICE('visual.showGrid', 'Grid on / off', [false, true]), group: 'Look' },
    { ...COL('visual.background', 'Background colour'), group: 'Look' },
    { ...COL('visual.gridColor', 'Grid colour'), group: 'Look' },
    { ...COL('visual.axesColor', 'Axes colour'), group: 'Look' },
    { ...NUM('audio.master', 'Master volume', 0, 1), group: 'Sound' },
    { ...CHOICE('audio.scale', 'Scale', scales), group: 'Sound' },
    { ...STEP('audio.root', 'Key (0 = C … 11 = B)', 0, 11), group: 'Sound' },
    { ...STEP('audio.noteLow', 'Lowest note', 0, 100), group: 'Sound' },
    { ...STEP('audio.noteHigh', 'Highest note', 12, 127), group: 'Sound' },
    { ...NUM('audio.tuning', 'Tuning (A4 Hz)', 400, 480), group: 'Sound' },
    { ...CHOICE('audio.filter.type', 'Filter type', FILTERS), group: 'Sound' },
    { ...NUM('audio.filter.cutoff', 'Filter cutoff (Hz)', 20, 20000), group: 'Sound' },
    { ...NUM('audio.filter.q', 'Filter resonance', 0.1, 18), group: 'Sound' },
    { ...NUM('audio.filter.lfo', 'Wah depth', 0, 1), group: 'Sound' },
    { ...NUM('audio.filter.lfoRate', 'Wah rate (Hz)', 0.05, 12), group: 'Sound' },
    { ...NUM('audio.distortion', 'Drive', 0, 1), group: 'Sound' },
    { ...NUM('audio.crush', 'Lo-fi crush', 0, 1), group: 'Sound' },
    { ...CHOICE('audio.mod.type', 'Modulation type', MODS), group: 'Sound' },
    { ...NUM('audio.mod.rate', 'Modulation rate', 0.05, 8), group: 'Sound' },
    { ...NUM('audio.mod.depth', 'Modulation depth', 0, 1), group: 'Sound' },
    { ...NUM('audio.mod.mix', 'Modulation mix', 0, 1), group: 'Sound' },
    { ...NUM('audio.motion.tremolo', 'Tremolo', 0, 1), group: 'Sound' },
    { ...NUM('audio.motion.autopan', 'Auto-pan', 0, 1), group: 'Sound' },
    { ...NUM('audio.pump.amount', 'Sidechain pump', 0, 1), group: 'Sound' },
    { ...NUM('audio.drone.volume', 'Drone volume', 0, 1), group: 'Sound' },
    { ...NUM('audio.delay.time', 'Delay time (s)', 0.02, 1.2), group: 'Sound' },
    { ...NUM('audio.delay.feedback', 'Delay feedback', 0, 0.92), group: 'Sound' },
    { ...NUM('audio.delay.mix', 'Delay mix', 0, 1), group: 'Sound' },
    { ...STEP('audio.reverb.decay', 'Reverb length (s)', 0.3, 12), group: 'Sound' },
    { ...NUM('audio.reverb.mix', 'Reverb mix', 0, 1), group: 'Sound' },
    { ...STEP('audio.reverb.tone', 'Reverb tone', 0, 1), group: 'Sound' },
  ];
  (state.layers || []).forEach((l, i) => {
    const group = `Layer ${i + 1} · ${l.name}`;
    list.push({ ...COL(`layer.${i}.color`, 'Colour'), group });
    list.push({ ...COL(`layer.${i}.color2`, 'Second colour'), group });
    list.push({ ...NUM(`layer.${i}.volume`, 'Volume', 0, 1), group });
    list.push({ ...NUM(`layer.${i}.width`, 'Thickness', 1, 14), group });
    list.push({ ...NUM(`layer.${i}.pan`, 'Pan', -1, 1), group });
    list.push({ ...STEP(`layer.${i}.octave`, 'Octave', -3, 3), group });
    list.push({ ...CHOICE(`layer.${i}.wave`, 'Instrument', instruments), group });
    list.push({ ...CHOICE(`layer.${i}.mute`, 'Mute', [false, true]), group });
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
  return a; // names and switches hold their value until the next key
}

/**
 * Value of a track at `time`. Before the first key it holds the first value,
 * after the last key it holds the last. The ease of a key shapes the segment
 * that LEAVES it.
 */
export function evaluate(keys, time, hold = false) {
  if (!keys?.length) return undefined;
  if (time <= keys[0].time) return keys[0].value;
  const last = keys[keys.length - 1];
  if (time >= last.time) return last.value;
  let i = 0;
  while (keys[i + 1].time < time) i++;
  const a = keys[i], b = keys[i + 1];
  let k = (time - a.time) / (b.time - a.time || 1);
  const ease = a.ease || 'smooth';
  if (ease === 'hold' || hold) k = 0;
  else if (ease === 'in') k = k * k * k;
  else if (ease === 'out') k = 1 - (1 - k) ** 3;
  else if (ease !== 'linear') k = k * k * (3 - 2 * k);
  return mix(a.value, b.value, k);
}

/** Numbers that jump instead of gliding (the key, reverb length …). */
const STEP_PATHS = new Set(animatable({ layers: [] }).filter((a) => a.kind === 'step').map((a) => a.path));
export const isStep = (path) => STEP_PATHS.has(path) || /^layer\.\d+\.octave$/.test(path);

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
  for (const [path, keys] of Object.entries(tracks || {})) if (keys.length) out.set(path, evaluate(keys, time, isStep(path)));
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

/* -------------------------------------------------------- editing helpers */

/** The keyframe path of a store path: "layers.L3.color" → "layer.2.color". null when it is not animatable. */
export function toKeyPath(state, storePath) {
  const k = storePath.split('.');
  if (k[0] === 'layers') {
    const i = (state.layers || []).findIndex((l) => l.id === k[1]);
    return i < 0 || !k[2] ? null : `layer.${i}.${k.slice(2).join('.')}`;
  }
  return storePath;
}

/** The store path of a keyframe path (for writing back through the store). */
export function toStorePath(state, keyPath) {
  const k = keyPath.split('.');
  if (k[0] === 'layer') {
    const l = state.layers?.[+k[1]];
    return l ? `layers.${l.id}.${k.slice(2).join('.')}` : null;
  }
  return keyPath;
}

/**
 * A full keyframe: the current value of every animatable property in the chosen lanes.
 * @param {Set<string>|string[]} lanes LANES to include
 * @param {object} [extra] values the state does not hold (the camera pose)
 * @returns {Record<string, any>}
 */
export function snapshotValues(state, lanes, extra = {}) {
  const want = new Set(lanes);
  const out = {};
  for (const a of animatable(state)) {
    if (!want.has(laneOf(a.path))) continue;
    const v = a.kind === 'pose' ? extra[a.path] : readValue(state, a.path);
    if (v === undefined || v === null) continue;
    out[a.path] = v && typeof v === 'object' ? structuredClone(v) : v;
  }
  return out;
}

/** Add every value of `values` as a key at `time`. */
export function addKeyframe(tracks, time, values, ease = 'smooth') {
  for (const [path, v] of Object.entries(values)) upsertKey(tracks, path, time, v, ease);
}

const TOL = 0.03;

/** Sorted distinct key times of the tracks of a lane ('all' = every lane). */
export function keyframeTimes(tracks, lane = 'all') {
  const times = [];
  for (const [path, keys] of Object.entries(tracks || {})) {
    if (lane !== 'all' && laneOf(path) !== lane) continue;
    for (const k of keys) times.push(k.time);
  }
  times.sort((a, b) => a - b);
  const out = [];
  for (const t of times) if (!out.length || t - out[out.length - 1] > TOL) out.push(t);
  return out;
}

/** The paths that have a key at `time` (within a hair) in a lane. */
export function pathsAt(tracks, time, lane = 'all') {
  return Object.keys(tracks || {}).filter((p) => (lane === 'all' || laneOf(p) === lane) && tracks[p].some((k) => Math.abs(k.time - time) <= TOL));
}

/** Move the keys at `from` (in a lane) to `to`. A key already sitting there is replaced. */
export function moveKeyframe(tracks, from, to, lane = 'all', duration = Infinity) {
  const dest = Math.min(Math.max(0, to), duration);
  for (const path of pathsAt(tracks, from, lane)) {
    const keys = tracks[path];
    const k = keys.find((x) => Math.abs(x.time - from) <= TOL);
    if (!k) continue;
    for (let i = keys.length - 1; i >= 0; i--) if (keys[i] !== k && Math.abs(keys[i].time - dest) <= 1e-6) keys.splice(i, 1);
    k.time = +dest.toFixed(4);
    keys.sort((a, b) => a.time - b.time);
  }
  return dest;
}

/** Delete the keys at `time` (in a lane). Returns how many were removed. */
export function deleteKeyframe(tracks, time, lane = 'all') {
  let n = 0;
  for (const path of pathsAt(tracks, time, lane)) {
    const keys = tracks[path];
    const i = keys.findIndex((x) => Math.abs(x.time - time) <= TOL);
    if (i >= 0) { removeKey(tracks, path, i); n++; }
  }
  return n;
}

/** Copy the keys at `from` (in a lane) to `to`. */
export function copyKeyframe(tracks, from, to, lane = 'all') {
  let n = 0;
  for (const path of pathsAt(tracks, from, lane)) {
    const k = tracks[path].find((x) => Math.abs(x.time - from) <= TOL);
    if (k) { upsertKey(tracks, path, to, k.value, k.ease, 1e-6); n++; }
  }
  return n;
}

/** Set the ease of the keys at `time` (in a lane). */
export function setEaseAt(tracks, time, ease, lane = 'all') {
  for (const path of pathsAt(tracks, time, lane)) for (const k of tracks[path]) if (Math.abs(k.time - time) <= TOL) k.ease = ease;
}
