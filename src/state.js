/**
 * Central app state. Every subsystem (renderer, audio, UI) reads from this one
 * object and listens for changes, so presets are just snapshots of it.
 */

let nextId = 1;

/** Layer types and the formulas each one uses. */
export const LAYER_TYPES = {
  function: { label: 'y = f(x)', fields: [['y', 'y(x) ='], ['z', 'z(x) =']], vars: ['x'] },
  parametric: { label: 'Parametric', fields: [['x', 'x(s) ='], ['y', 'y(s) ='], ['z', 'z(s) =']], vars: ['s'] },
  polar: { label: 'Polar r(θ)', fields: [['r', 'r(θ) ='], ['z', 'z(θ) =']], vars: ['theta'] },
  surface: { label: 'Surface (3D)', fields: [['f', 'height(x,y) ='], ['path', 'path y(x) =']], vars: ['x', 'y'] },
};

/** Variables every formula may use in addition to its own. */
export const GLOBAL_VARS = ['t', 'a', 'b', 'c', 'd'];

export const LAYER_COLORS = ['#22e4ff', '#ff3d9a', '#ffd23d', '#8cff5a'];

export function createLayer(overrides = {}) {
  const i = (nextId - 1) % LAYER_COLORS.length;
  const layer = {
    id: `L${nextId++}`,
    name: `Layer ${nextId - 1}`,
    enabled: true,
    type: 'function',
    exprs: { y: 'sin(2x)', z: '0', x: '3cos(s)', r: '2 + cos(4theta)', f: 'sin(x)cos(y)', path: 'sin(x)' },
    range: { min: 0, max: Math.PI * 2 },
    colorMode: 'solid', // solid | gradient | rainbow | pitch
    color: LAYER_COLORS[i],
    color2: LAYER_COLORS[(i + 1) % LAYER_COLORS.length],
    width: 4,
    style: 'line', // line | dashed | dots
    wave: 'sine', // sine | square | sawtooth | triangle
    volume: 0.6,
    octave: 0,
    pan: 0,
    zMap: 'volume', // what the Z coordinate controls: volume | pan | none
    mute: false,
    solo: false,
    samples: 900,
    ...overrides,
  };
  layer.exprs = { ...createLayer.defaults, ...layer.exprs };
  return layer;
}
createLayer.defaults = { y: '0', z: '0', x: '0', r: '1', f: '0', path: '0' };

export function defaultState() {
  return {
    name: 'Untitled',
    mode: '2d',
    theme: 'dark',
    transport: { duration: 16, speed: 1, loop: true, bpm: 120 },
    view: { xMin: 0, xMax: 8, yMin: -4, yMax: 4 },
    params: { a: 1, b: 1, c: 1, d: 1 },
    layers: [createLayer({ exprs: { y: '3 * exp(-12 * mod(x, 0.5)) - 1.5' } })],
    visual: {
      background: '#04050a',
      gridColor: '#1d2440',
      axesColor: '#4a5784',
      showGrid: true,
      showAxes: true,
      showLabels: true,
      drawMode: 'trace', // full | trace | ghost
      bloom: { enabled: true, strength: 1.1, radius: 0.5, threshold: 0.05 },
      trail: { enabled: true, count: 160, size: 6 },
      marker: { shape: 'circle', size: 26, image: null, cursorLine: true, smoothing: 0.35 },
      fog: { enabled: false, density: 0.04 },
      dof: { enabled: false, focus: 14, aperture: 0.6 },
      motionBlur: { enabled: false, amount: 0.75 },
      caption: true,
      showNotes: true, // note names in the caption and the top bar
      analyzer: 'spectrum', // spectrum | wave | off
      aspect: '16:9', // fill | 16:9 | 9:16 | 1:1 | 4:5
    },
    camera: { autoRotate: false, rotateSpeed: 0.8, fov: 45, follow: false },
    audio: {
      master: 0.7,
      noteLow: 36,
      noteHigh: 84,
      scale: 'continuous',
      root: 0,
      glide: 25,
      articulation: 'legato', // legato | pluck
      filter: { type: 'lowpass', cutoff: 9000, q: 0.8 },
      distortion: 0,
      delay: { time: 0.28, feedback: 0.3, mix: 0.15 },
      reverb: { decay: 2.6, mix: 0.25 },
    },
    // Export. fileName '' = use the project name. subframes > 1 = real motion blur
    // (each video frame averages several sub-frames, like a film camera's shutter).
    record: { resolution: '1080p', fps: 60, fromStart: true, fileName: '', quality: 'high', subframes: 1 },
    // Text on the video. x/y are fractions of the frame (null = automatic position),
    // size is a multiplier. Text boxes are positioned by their centre.
    overlay: {
      title: { enabled: true, text: '', subtitle: true, subtitleText: '', x: null, y: null, size: 1, color: '' },
      formulas: { enabled: true, x: null, y: null, size: 1 },
      analyzer: { x: null, y: null, size: 1 },
      texts: [],
    },
    // Layer playback: all together, or one after another (each gets an equal slice of the timeline).
    sequence: { enabled: false, past: 'ghost' }, // past: ghost | keep | hide
    // Beat grid: sample the pitch once per step so curves become rhythmic notes.
    rhythm: { enabled: false, division: '1/8', gate: 0.8, swing: 0, showGrid: true },
    // Drum kit triggered by events on a source layer's curve (or by the clock).
    drums: { enabled: false, source: 0, volume: 0.8, kick: 'valley', snare: 'peak', hat: 'step', clap: 'off', sensitivity: 0.08, pulse: true },
    // Keyframe animation: { tracks: { [path]: [{ time, value, ease }] } }
    keyframes: { tracks: {}, autoKey: false },
  };
}

/** Get / set a value by dotted path, e.g. "visual.bloom.strength". */
export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}
function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => o[k], obj);
  target[last] = value;
}

/** Deep-merge a (possibly partial or older) snapshot over defaults. */
function mergeDeep(base, patch) {
  if (Array.isArray(patch)) return patch;
  if (patch && typeof patch === 'object' && base && typeof base === 'object' && !Array.isArray(base)) {
    const out = { ...base };
    for (const k of Object.keys(patch)) out[k] = mergeDeep(base[k], patch[k]);
    return out;
  }
  return patch === undefined ? base : patch;
}

class Store {
  constructor() {
    this.state = defaultState();
    this.listeners = new Set();
  }
  /** Subscribe to changes. fn(path) — path is "*" when everything changed (preset load). */
  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(path) {
    for (const fn of this.listeners) fn(path);
  }
  get(path) {
    return getPath(this.state, path);
  }
  set(path, value) {
    setPath(this.state, path, value);
    this.emit(path);
  }
  /** Replace the whole state from a preset/snapshot (missing keys fall back to defaults). */
  load(snapshot) {
    const merged = mergeDeep(defaultState(), structuredClone(snapshot));
    merged.layers = (merged.layers || []).map((l) => createLayer({ ...l, id: undefined, exprs: { ...l.exprs } }));
    merged.layers.forEach((l, i) => { l.id = `L${Date.now().toString(36)}${i}`; });
    this.state = merged;
    this.emit('*');
  }
  snapshot() {
    return structuredClone(this.state);
  }
}

export const store = new Store();
