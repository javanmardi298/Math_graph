/**
 * The Daily plan, kept in this browser (localStorage 'mmv.daily.v1'):
 *   settings  see DEFAULT_SETTINGS in planner.js
 *   days      { 'YYYY-MM-DD': { items: [card …], plannedAt } }
 *   queue     [{ id, name, shelf, preset, addedAt }]  presets waiting for a slot
 *   history   [{ date, source, key }]                  what was uploaded (repeat checks)
 *   ideas     [card …]                                 the last "Suggest ideas" batch
 * Old days (more than 60 days back) are dropped so it never grows without end.
 */
import { DEFAULT_SETTINGS, addDays, daysBetween, dayKey } from './planner.js';

export const DAILY_KEY = 'mmv.daily.v1';
const KEEP_DAYS = 60;

export function emptyDaily() {
  return { settings: { ...DEFAULT_SETTINGS, times: [...DEFAULT_SETTINGS.times] }, days: {}, queue: [], history: [], ideas: [] };
}

export function readDaily(storage = globalThis.localStorage) {
  const d = emptyDaily();
  try {
    const raw = JSON.parse(storage.getItem(DAILY_KEY) || 'null');
    if (raw && typeof raw === 'object') {
      Object.assign(d.settings, raw.settings || {});
      d.days = raw.days && typeof raw.days === 'object' ? raw.days : {};
      d.queue = Array.isArray(raw.queue) ? raw.queue : [];
      d.history = Array.isArray(raw.history) ? raw.history : [];
      d.ideas = Array.isArray(raw.ideas) ? raw.ideas : [];
    }
  } catch { /* storage blocked or broken: start fresh */ }
  return d;
}

/** Save; returns false when the browser refused (full or blocked). */
export function writeDaily(d, storage = globalThis.localStorage, today = dayKey()) {
  const oldest = addDays(today, -KEEP_DAYS);
  for (const k of Object.keys(d.days)) if (daysBetween(oldest, k) < 0) delete d.days[k];
  d.history = d.history.filter((h) => daysBetween(addDays(today, -365), h.date) >= 0).slice(-2000);
  try { storage.setItem(DAILY_KEY, JSON.stringify(d)); return true; } catch { return false; }
}
