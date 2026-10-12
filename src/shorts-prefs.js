/**
 * The Shorts opening and ending (hook, teaser, flash, boom, fade-out) are a choice about
 * the channel, not about one preset: they are kept in this browser and applied to every
 * preset you load and every video you export. Before this they were part of each preset,
 * so loading another preset silently switched the hook off again. On by default.
 */
const KEY = 'mmv.shorts.v1';
export const SHORTS_DEFAULTS = { hook: { enabled: true, teaser: 0.8, flash: true, impact: true }, outro: 0.6 };

const merge = (raw) => ({
  hook: { ...SHORTS_DEFAULTS.hook, ...(raw?.hook || {}) },
  outro: Number.isFinite(raw?.outro) ? raw.outro : SHORTS_DEFAULTS.outro,
});

let prefs = merge(null);
try { prefs = merge(JSON.parse(globalThis.localStorage?.getItem(KEY) || 'null')); } catch { /* private mode */ }

export const getShorts = () => prefs;

/** Remember the hook and fade-out settings of a state's `record`. */
export function saveShorts(record) {
  prefs = merge({ hook: record?.hook, outro: record?.outro });
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(prefs)); } catch { /* storage full or blocked */ }
  return prefs;
}

/** Put the remembered hook and fade-out settings into a state's `record` (a loaded preset's own are ignored). */
export function applyShorts(record) {
  record.hook = { ...prefs.hook };
  record.outro = prefs.outro;
  return record;
}
