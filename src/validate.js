/**
 * A health check for a preset (a whole state), for people and for agents (window.mmv.validate()).
 * It finds what silently goes wrong: settings that do nothing (misspelt or left over), values
 * outside their range, formulas that do not compile, keys and texts after the end of the video,
 * and text that will be hard to read. Pure: no DOM, the tests run it over every built-in preset.
 *
 * Every problem is { level, path, message }:
 *   error    the video will not be what was meant (a broken formula, an unknown scene)
 *   warning  probably a mistake (a key after the end, an unknown setting)
 *   info     worth a look (a value beyond its slider, a long tail, text over a busy picture)
 */
import { defaultState, createLayer, LAYER_TYPES, GLOBAL_VARS } from './state.js';
import { animatable } from './anim/keyframes.js';
import { SCALES } from './math/music.js';
import { INSTRUMENTS } from './audio/instruments.js';
import { SCENES } from './circle/scenes.js';
import { CIRCLE_RULES, defaultCircle } from './circle/sim.js';
import { BLENDS, TRANSITIONS } from './circle/stack.js';
import { tryCompile } from './math/parser.js';

/** Variables a loudness formula may use. */
export const VOL_VARS = ['x', 'y', 'z', 'u', 't'];

/** Parts of the state that hold free-form content (their keys are data, not settings). */
const FREE = new Set(['keyframes.tracks', 'circle.lab', 'overlay.texts', 'markers', 'layers', 'circle.layers', 'drums.patterns', 'params']);
/** Keys files carry that are not settings. */
const META = new Set(['$format', 'version', 'id', 'savedAt', 'collection', 'favorite', 'tags', 'note', 'meta', 'shelf', 'source', 'thumb', 'lesson', 'about']);

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const fmt = (n) => (Number.isInteger(n) ? String(n) : String(+(+n).toFixed(3)));

/** Keys of `obj` that `shape` does not have, as dotted paths. */
function unknownKeys(obj, shape, base, out, skip = FREE) {
  if (!isObj(obj) || !isObj(shape)) return;
  for (const k of Object.keys(obj)) {
    const path = base ? `${base}.${k}` : k;
    if (skip.has(path) || (!base && META.has(k))) continue;
    if (!(k in shape)) { out.push(path); continue; }
    unknownKeys(obj[k], shape[k], path, out, skip);
  }
}

/** One scene's settings checked against its controls. */
function checkScene(cfg, base, add) {
  if (!cfg) return;
  if (!(cfg.rule in CIRCLE_RULES)) { add('error', `${base}.rule`, `Unknown simulation “${cfg.rule}”. See mmv.describe() for the list.`); return; }
  const sc = SCENES[cfg.rule];
  for (const rule of Object.keys(cfg.lab || {})) if (!SCENES[rule] && !(rule in CIRCLE_RULES)) add('warning', `${base}.lab.${rule}`, `Settings for a simulation that does not exist (“${rule}”).`);
  const own = cfg.lab?.[cfg.rule];
  if (!sc || !isObj(own)) return;
  for (const [key, v] of Object.entries(own)) {
    const ctl = (sc.controls || []).find((x) => x && x[0] === key);
    const path = `${base}.lab.${cfg.rule}.${key}`;
    if (!ctl) { if (!(key in (sc.defaults || {}))) add('warning', path, `“${key}” is not a setting of ${cfg.rule}: it does nothing.`); continue; }
    if (ctl[2] === 'r' && typeof v === 'number' && (v < ctl[3] - 1e-9 || v > ctl[4] + 1e-9)) add('info', path, `${fmt(v)} is outside ${fmt(ctl[3])} … ${fmt(ctl[4])} (${ctl[1]}).`);
    if (ctl[2] === 's' && isObj(ctl[3]) && !(v in ctl[3])) add('error', path, `“${v}” is not one of: ${Object.keys(ctl[3]).join(', ')}.`);
  }
}

/**
 * @param {object} state a preset or a whole state
 * @returns {{ok:boolean, errors:number, warnings:number, problems:{level:string, path:string, message:string}[], summary:object}}
 */
export function validateState(state) {
  const problems = [];
  const add = (level, path, message) => problems.push({ level, path, message });
  const base = defaultState();
  const dur = Math.max(0.5, +state.transport?.duration || base.transport.duration);
  const circle = state.mode === 'circle';

  // settings that do not exist
  const unknown = [];
  unknownKeys(state, base, '', unknown);
  const layerShape = createLayer({});
  (state.layers || []).forEach((l, i) => unknownKeys(l, layerShape, `layers.${i}`, unknown, new Set([`layers.${i}.exprs`, `layers.${i}.look`])));
  const circleShape = defaultCircle();
  (state.circle?.layers || []).forEach((l, i) => unknownKeys(l.cfg, circleShape, `circle.layers.${i}.cfg`, unknown, new Set([`circle.layers.${i}.cfg.lab`, `circle.layers.${i}.cfg.layers`])));
  for (const p of unknown) add('warning', p, 'Unknown setting: it does nothing (misspelt, or from an older version).');

  // sound
  const a = state.audio || {};
  if (a.scale && !(a.scale in SCALES)) add('error', 'audio.scale', `Unknown scale “${a.scale}”.`);
  if (a.noteLow >= a.noteHigh) add('warning', 'audio.noteLow', 'The lowest note is not below the highest note: every point plays the same pitch.');

  // formula layers
  if (!circle) {
    const enabled = (state.layers || []).filter((l) => l.enabled !== false);
    if (!enabled.length) add('error', 'layers', 'No layer is switched on: the video is empty.');
    (state.layers || []).forEach((l, i) => {
      const type = LAYER_TYPES[l.type ?? 'function']; // a partial preset: missing settings are the defaults
      if (!type) { add('error', `layers.${i}.type`, `Unknown layer type “${l.type}”.`); return; }
      if (l.enabled === false) return;
      for (const [key] of type.fields) {
        const c = tryCompile(l.exprs?.[key] ?? createLayer.defaults[key], key === 'path' ? ['x', ...GLOBAL_VARS] : [...type.vars, ...GLOBAL_VARS]);
        if (!c.ok) add('error', `layers.${i}.exprs.${key}`, `Formula “${l.exprs?.[key]}”: ${c.error}`);
      }
      if (l.volExpr && String(l.volExpr).trim()) {
        const c = tryCompile(l.volExpr, VOL_VARS);
        if (!c.ok) add('error', `layers.${i}.volExpr`, `Loudness formula “${l.volExpr}”: ${c.error}`);
      }
      if (l.wave && !(l.wave in INSTRUMENTS)) add('error', `layers.${i}.wave`, `Unknown instrument “${l.wave}”.`);
      if (l.range && !(l.range.max > l.range.min)) add('error', `layers.${i}.range`, 'The range is empty (max is not above min).');
      for (const k of ['start', 'captionStart']) if (l[k] > dur) add('warning', `layers.${i}.${k}`, `Starts at ${fmt(l[k])} s, after the end of the video (${fmt(dur)} s).`);
    });
    const tl = state.camera?.trackLayer;
    if (tl > (state.layers || []).length) add('warning', 'camera.trackLayer', `The camera follows layer ${tl}, but there are only ${(state.layers || []).length} layers.`);
  } else {
    checkScene(state.circle, 'circle', add);
    (state.circle?.layers || []).forEach((l, i) => {
      checkScene(l.cfg, `circle.layers.${i}.cfg`, add);
      if (l.start > dur) add('warning', `circle.layers.${i}.start`, `Starts at ${fmt(l.start)} s, after the end of the video (${fmt(dur)} s).`);
      if (l.blend && !(l.blend in BLENDS)) add('error', `circle.layers.${i}.blend`, `Unknown blend mode “${l.blend}”: ${Object.keys(BLENDS).join(', ')}.`);
    });
    if (state.circle?.blend && !(state.circle.blend in BLENDS)) add('error', 'circle.blend', `Unknown blend mode “${state.circle.blend}”.`);
    if (state.circle?.transition && !(state.circle.transition in TRANSITIONS)) add('error', 'circle.transition', `Unknown transition “${state.circle.transition}”: ${Object.keys(TRANSITIONS).join(', ')}.`);
  }

  // keyframes
  const known = new Map(animatable({ ...base, ...state, layers: state.layers || [], circle: state.circle || base.circle }).map((x) => [x.path, x]));
  let lastEvent = 0;
  for (const [path, keys] of Object.entries(state.keyframes?.tracks || {})) {
    if (!Array.isArray(keys) || !keys.length) continue;
    const info = known.get(path);
    if (!info) { add('warning', `keyframes.tracks.${path}`, 'This property cannot be animated (or belongs to a layer / scene that is not there): its keys do nothing.'); continue; }
    const late = keys.filter((k) => k.time > dur + 1e-6);
    if (late.length) add('warning', `keyframes.tracks.${path}`, `${late.length} key${late.length > 1 ? 's' : ''} of “${info.label}” after the end of the video (${fmt(dur)} s): the last at ${fmt(late[late.length - 1].time)} s never plays.`);
    for (const k of keys) {
      if (k.time <= dur) lastEvent = Math.max(lastEvent, k.time);
      if ((info.kind === 'number' || info.kind === 'step') && typeof k.value === 'number' && (k.value < info.min - 1e-9 || k.value > info.max + 1e-9)) { add('info', `keyframes.tracks.${path}`, `Key at ${fmt(k.time)} s: ${fmt(k.value)} is outside ${fmt(info.min)} … ${fmt(info.max)} (${info.label}).`); break; }
      if (info.kind === 'choice' && !info.options.includes(k.value)) { add('error', `keyframes.tracks.${path}`, `Key at ${fmt(k.time)} s: “${k.value}” is not a choice of ${info.label}.`); break; }
    }
  }

  // text on the video
  const texts = state.overlay?.texts || [];
  texts.forEach((t, i) => {
    if (t.start > dur) add('warning', `overlay.texts.${i}.start`, `Text “${String(t.text || '').slice(0, 30)}” appears at ${fmt(t.start)} s, after the end of the video (${fmt(dur)} s).`);
    else if (t.end > dur + 1e-6) add('info', `overlay.texts.${i}.end`, `Text “${String(t.text || '').slice(0, 30)}” is set to leave at ${fmt(t.end)} s, after the end (${fmt(dur)} s).`);
    lastEvent = Math.max(lastEvent, Math.min(dur, Math.max(+t.start || 0, +t.end || 0)));
  });
  for (const m of state.markers || []) if (m.time > dur) add('warning', 'markers', `Story beat “${m.label}” is at ${fmt(m.time)} s, after the end of the video (${fmt(dur)} s).`);

  // readability: plain text over a picture that fills the frame
  if (circle) {
    const full = [state.circle, ...(state.circle?.layers || []).map((l) => l.cfg)].some((cfg) => cfg?.rule === 'fractal' && cfg.lab?.fractal?.bleed !== false);
    const bare = texts.filter((t) => t.text && !t.box).length;
    if (full && bare) add('info', 'overlay.texts', `${bare} text box${bare > 1 ? 'es' : ''} without a background over a fractal that fills the frame: switch on the box of the text, or use a dark palette (dusk, ash) or lower brightness.`);
  }

  // a length that looks left over from another preset
  if (lastEvent > 0 && lastEvent < dur * 0.5 && dur - lastEvent > 8) add('info', 'transport.duration', `Everything timed (keys, texts) is over by ${fmt(lastEvent)} s, but the video is ${fmt(dur)} s long. Is the length left over from another preset?`);

  const errors = problems.filter((p) => p.level === 'error').length, warnings = problems.filter((p) => p.level === 'warning').length;
  return {
    ok: errors === 0, errors, warnings, problems,
    summary: { name: state.name || '', mode: state.mode || base.mode, seconds: dur, layers: circle ? 1 + (state.circle?.layers || []).length : (state.layers || []).length, keyframes: Object.values(state.keyframes?.tracks || {}).reduce((n, k) => n + (k?.length || 0), 0), texts: texts.length },
  };
}

/** A short line for a toast: "2 warnings: …" ('' when nothing is wrong). */
export function validationLine(result, max = 2) {
  const list = result.problems.filter((p) => p.level !== 'info');
  if (!list.length) return '';
  const head = [result.errors && `${result.errors} error${result.errors > 1 ? 's' : ''}`, result.warnings && `${result.warnings} warning${result.warnings > 1 ? 's' : ''}`].filter(Boolean).join(', ');
  return `${head}: ${list.slice(0, max).map((p) => p.message).join(' · ')}${list.length > max ? ` · and ${list.length - max} more (Export tab → Check this video)` : ''}`;
}

/**
 * What a simulation is and which settings it has, with ranges and defaults (window.mmv.describe).
 * Without a name: the list of every simulation.
 */
export function describeScene(rule) {
  if (!rule) return Object.entries(CIRCLE_RULES).map(([id, label]) => ({ rule: id, label, group: SCENES[id]?.group || 'Classic', settings: (SCENES[id]?.controls || []).length }));
  const sc = SCENES[rule];
  if (!sc) return rule in CIRCLE_RULES ? { rule, label: CIRCLE_RULES[rule], group: 'Classic', path: 'circle', settings: [], note: 'A classic simulation: its settings are the chord / physics / split / grow / escape / poly groups of state.circle.' } : null;
  return {
    rule, label: sc.label, group: sc.group || '', path: `circle.lab.${rule}`,
    use: `mmv.set('mode', 'circle'); mmv.set('circle.rule', '${rule}'); mmv.set('circle.lab.${rule}', { … })`,
    settings: (sc.controls || []).filter(Boolean).map(([key, label, kind, x, y, step]) => ({
      key, label, path: `circle.lab.${rule}.${key}`, default: sc.defaults?.[key],
      ...(kind === 'r' ? { type: 'number', min: x, max: y, step } : kind === 's' ? { type: 'choice', options: Object.keys(x || {}) } : kind === 't' ? { type: 'switch' } : { type: 'text' }),
      keyframes: kind !== 'x',
    })),
    stage: 'circle.look (palette, zoom, dx, dy, glow, counter …), circle.sound (instrument, volume, length …), circle.opacity, circle.blend',
  };
}
