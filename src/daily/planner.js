/**
 * Daily planner: every day gets a small, balanced set of Shorts (3 by default), ready
 * to render and upload, with title, description, tags, hook and a comment to pin.
 *
 * How a day is filled (all deterministic, no AI model):
 *   1. your queue first (presets you added with "Add to Daily"),
 *   2. then one pick per slot from that weekday's theme (each slot names shelves),
 *   3. a preset that was never posted goes out as it is; one that was posted before
 *      comes back as a remix (new subject, colours, instrument, words),
 *   4. nothing posted in the last N days (default 21) is picked again.
 * The same date and history always give the same plan; 🎲 swaps one card.
 */
import { rng, remix, formatOf, pinnedFor } from './remix.js';

/** Satisfying shelves, used as the "easy watch" slot. */
const CHILL = ['classic', 'multiply', 'fill', 'bounce', 'growth', 'games', 'stories', 'math-patterns', 'math-machines'];

/** One theme per weekday (index = Date.getDay(), 0 = Sunday). Each slot lists shelves to pick from. */
export const THEMES = [
  { name: 'Quiz Sunday', emoji: '🎧', slots: [{ label: 'Guess the shape', shelves: ['sound-quiz'], want: 'quiz' }, { label: 'A or B', shelves: ['sound-quiz'], want: 'ab' }, { label: 'Your name / flags', shelves: ['math-fourier'], want: ['name', 'flag'] }] },
  { name: 'Fourier Monday', emoji: '✍️', slots: [{ label: 'Fourier draws', shelves: ['math-fourier'] }, { label: 'Sound of a graph', shelves: ['sound-graph'] }, { label: 'Satisfying', shelves: CHILL }] },
  { name: 'Sound Tuesday', emoji: '🔊', slots: [{ label: 'Sound of a graph', shelves: ['sound-graph'] }, { label: 'Waves & notes', shelves: ['sound-waves'] }, { label: 'Guess the shape', shelves: ['sound-quiz'], want: 'quiz' }] },
  { name: 'π & Calculus Wednesday', emoji: '🥧', slots: [{ label: 'π', shelves: ['math-pi'] }, { label: 'Calculus', shelves: ['math-calculus'] }, { label: 'Satisfying', shelves: CHILL }] },
  { name: 'Fractal Thursday', emoji: '❄️', slots: [{ label: 'Fractal', shelves: ['math-fractals'] }, { label: 'Patterns', shelves: ['math-patterns', 'math-machines'] }, { label: 'Sound of a graph', shelves: ['sound-graph'] }] },
  { name: 'Physics Friday', emoji: '🧲', slots: [{ label: 'Physics', shelves: ['physics'] }, { label: 'Waves & notes', shelves: ['sound-waves'] }, { label: 'Formula art', shelves: ['formulas-2d', 'formulas-3d'] }] },
  { name: 'Satisfying Saturday', emoji: '🌀', slots: [{ label: 'Satisfying', shelves: ['bounce', 'multiply', 'fill', 'growth'] }, { label: 'Story', shelves: ['stories'] }, { label: 'Game', shelves: ['games', 'classic'] }] },
];
/** Extra slots (4th, 5th post of a day) when themes are off or a day asks for more. */
const EXTRA = [{ label: 'Fourier draws', shelves: ['math-fourier'] }, { label: 'Satisfying', shelves: CHILL }, { label: 'Sound', shelves: ['sound-graph', 'sound-quiz'] }];
/** With themes off: a fixed, balanced mix. */
const MIXED = [{ label: 'Math topic', shelves: ['math-fourier', 'math-pi', 'math-calculus', 'math-fractals', 'physics'] }, { label: 'Sound', shelves: ['sound-graph', 'sound-quiz', 'sound-waves'] }, { label: 'Satisfying', shelves: CHILL }];

/** Lesson packs that fit a shelf (used when "include lessons" is on). */
const PACK_SHELF = {
  'waves-stories': 'sound-waves', waves: 'sound-waves', vibration: 'physics', 'formulas-2d': 'formulas-2d', 'formulas-3d': 'formulas-3d',
  'fourier-calculus': 'math-calculus', pi: 'math-pi', fractals: 'math-fractals', classic: 'classic', multiply: 'multiply', fill: 'fill',
  bounce: 'bounce', growth: 'growth', patterns: 'math-patterns', machines: 'math-machines', battles: 'games',
};

export const DEFAULT_SETTINGS = {
  perDay: 3, times: ['12:00', '17:00', '20:00', '14:00', '22:00'], avoidDays: 21, themes: true,
  remix: true, lessons: false, footer: '', channel: 'MathWaves',
};

/* ------------------------------------------------------------------- dates */

/** 'YYYY-MM-DD' of a local date. */
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Date of a 'YYYY-MM-DD' key (local noon, safe across DST). */
export const dateOf = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const addDays = (key, n) => { const d = dateOf(key); d.setDate(d.getDate() + n); return dayKey(d); };
export const daysBetween = (a, b) => Math.round((dateOf(b) - dateOf(a)) / 86400000);
export const themeOf = (key, settings = DEFAULT_SETTINGS) => (settings.themes ? THEMES[dateOf(key).getDay()] : { name: 'Mixed day', emoji: '🎲', slots: MIXED });

/** The slots of a day (theme slots, then extras, cut to perDay). */
export function slotsOf(key, settings = DEFAULT_SETTINGS) {
  const theme = themeOf(key, settings);
  return [...theme.slots, ...EXTRA, ...EXTRA].slice(0, Math.max(1, Math.min(5, settings.perDay | 0 || 3)));
}

/* ------------------------------------------------------------------- pools */

/**
 * The candidates of a slot: [{preset, shelf, source}] from the catalog (and lessons).
 * @param {{shelves: {shelf:{id:string}, presets:object[]}[], packs?: {id:string, presets:object[]}[]}} catalog
 */
export function poolOf(slot, catalog, settings = DEFAULT_SETTINGS) {
  const out = [];
  for (const { shelf, presets } of catalog.shelves) {
    if (shelf.id === 'start' || !slot.shelves.includes(shelf.id)) continue;
    for (const p of presets) out.push({ preset: p, shelf: shelf.id, source: p.name });
  }
  if (settings.lessons) {
    for (const pk of catalog.packs || []) {
      if (!slot.shelves.includes(PACK_SHELF[pk.id])) continue;
      for (const p of pk.presets) out.push({ preset: p, shelf: PACK_SHELF[pk.id], source: p.name, lesson: true });
    }
  }
  if (!slot.want) return out;
  const want = [].concat(slot.want);
  const fit = out.filter((c) => want.includes(formatOf(c.preset, c.shelf)));
  return fit.length ? fit : out;
}

/* ----------------------------------------------------------------- items */

let uid = 0;
const newId = (date, slot) => `${date}-${slot}-${Date.now().toString(36)}${(uid++).toString(36)}`;

/** Fill in what a card needs to be published (title, description, tags, hook, pinned comment). */
export function finish(item, settings = DEFAULT_SETTINGS) {
  const p = item.preset;
  const yt = p.youtube || {};
  const title = (yt.title || p.name).trim();
  let description = (yt.description || `${p.name}.`).trim();
  if (settings.footer?.trim() && !description.includes(settings.footer.trim())) description += `\n\n${settings.footer.trim()}`;
  return {
    ...item,
    title: /#shorts/i.test(title) ? title : `${title} #shorts`,
    description,
    tags: yt.tags || '',
    hook: p.hook?.text || '',
    pinned: item.pinned || pinnedFor(item.format, item.seed),
  };
}

/**
 * One card. `remixIt` decides between the preset as it is and a remix of it.
 * @returns {{id, date, slot, label, time, source, shelf, format, subject, seed, remixed, preset, title, description, tags, hook, pinned, status}}
 */
export function makeItem({ date, slot, label, time, cand, seed, remixIt, settings, from = 'plan' }) {
  const format = formatOf(cand.preset, cand.shelf);
  let preset = cand.preset, subject = '', remixed = false;
  if (remixIt) ({ preset, subject } = remix(cand.preset, seed, { shelf: cand.shelf }), remixed = true);
  else preset = JSON.parse(JSON.stringify(preset));
  delete preset.$category; delete preset.$shelf;
  return finish({
    id: newId(date, slot), date, slot, label, time, from, source: cand.source, shelf: cand.shelf, format,
    subject: subject || cand.source, seed, remixed, preset, status: 'planned',
  }, settings);
}

/** What a card "is" for repeat checks: the source preset, plus the subject for remixes. */
export const keyOf = (it) => (it.remixed ? `${it.source}|${it.subject}` : it.source);

/**
 * Plan one day.
 * @param {string} date 'YYYY-MM-DD'
 * @param {object} ctx { catalog, settings, history: [{date, source, key}], queue: [{id, name, preset}], salt }
 * @returns {{items:object[], usedQueue:string[]}} the cards, and which queue entries they used
 */
export function planDay(date, { catalog, settings = DEFAULT_SETTINGS, history = [], queue = [], salt = 0 }) {
  const slots = slotsOf(date, settings);
  const items = [], usedQueue = [];
  const recent = new Set(), recentKeys = new Set(), ever = new Set();
  for (const h of history) {
    ever.add(h.source);
    const age = daysBetween(h.date, date);
    if (Math.abs(age) < settings.avoidDays) { recent.add(h.source); recentKeys.add(h.key); }
  }
  const time = (i) => settings.times[i] || DEFAULT_SETTINGS.times[i] || '';

  slots.forEach((slot, i) => {
    const seed = `${date}:${i}:${salt}`;
    // 1. the queue goes first
    const q = queue.find((x) => !usedQueue.includes(x.id));
    if (q) {
      usedQueue.push(q.id);
      items.push(makeItem({ date, slot: i, label: 'From your queue', time: time(i), cand: { preset: q.preset, shelf: q.shelf || '', source: q.name }, seed, remixIt: false, settings, from: 'queue' }));
      return;
    }
    // 2. a pick from the theme
    const r = rng(seed);
    let pool = poolOf(slot, catalog, settings);
    if (!pool.length) pool = poolOf(MIXED[i % MIXED.length], catalog, settings);
    const taken = new Set(items.map((x) => x.source));
    const fresh = pool.filter((c) => !recent.has(c.source) && !taken.has(c.source));
    const neverPosted = fresh.filter((c) => !ever.has(c.source));
    // 3. never posted → as it is; otherwise a remix that was not posted lately
    if (neverPosted.length) {
      items.push(makeItem({ date, slot: i, label: slot.label, time: time(i), cand: r.pick(neverPosted), seed, remixIt: false, settings }));
      return;
    }
    const notToday = pool.filter((c) => !taken.has(c.source));
    const base = fresh.length ? fresh : notToday.length ? notToday : pool;
    if (!base.length) return;
    for (let tryN = 0; tryN < 6; tryN++) {
      const it = makeItem({ date, slot: i, label: slot.label, time: time(i), cand: r.pick(base), seed: `${seed}:${tryN}`, remixIt: settings.remix, settings });
      const repeat = recentKeys.has(keyOf(it)) || items.some((x) => keyOf(x) === keyOf(it));
      if (!repeat || tryN === 5) { items.push(it); return; }
    }
  });
  return { items, usedQueue };
}

/**
 * Swap one card for another pick of the same slot (🎲). A new salt gives a new pick;
 * remixes are allowed straight away so a swap never runs dry.
 */
export function swapItem(item, { catalog, settings = DEFAULT_SETTINGS, history = [], others = [], salt = 1 }) {
  const slot = slotsOf(item.date, settings)[item.slot] || MIXED[0];
  const r = rng(`${item.date}:${item.slot}:swap:${salt}`);
  const recent = new Set(history.filter((h) => Math.abs(daysBetween(h.date, item.date)) < settings.avoidDays).map((h) => h.source));
  const taken = new Set(others.map((x) => x.source));
  let pool = poolOf(slot, catalog, settings).filter((c) => !taken.has(c.source));
  if (!pool.length) pool = poolOf(slot, catalog, settings);
  const fresh = pool.filter((c) => !recent.has(c.source) && c.source !== item.source);
  const cand = r.pick(fresh.length ? fresh : pool);
  const remixIt = settings.remix && (!fresh.length || r() < 0.5);
  return makeItem({ date: item.date, slot: item.slot, label: slot.label, time: item.time, cand, seed: `${item.date}:${item.slot}:swap:${salt}`, remixIt, settings });
}

/** Fresh ideas: n remixes from anywhere in the catalog (or of one preset). */
export function ideas({ catalog, settings = DEFAULT_SETTINGS, n = 6, salt = 0, of = null, date = '' }) {
  const r = rng(`ideas:${date}:${salt}`);
  // a shelf first, then a preset of it, so small shelves (π, fractals …) get their turn
  const shelves = catalog.shelves.filter((s) => s.shelf.id !== 'start' && s.presets.length);
  const out = [], seen = new Set();
  for (let i = 0; out.length < n && i < n * 6 && (of || shelves.length); i++) {
    const sh = of ? null : r.pick(shelves);
    const cand = of || { preset: r.pick(sh.presets), shelf: sh.shelf.id, source: '' };
    cand.source ||= cand.preset.name;
    const it = makeItem({ date, slot: i, label: 'Idea', time: '', cand, seed: `idea:${date}:${salt}:${i}`, remixIt: true, settings, from: 'idea' });
    if (seen.has(it.preset.name)) continue;
    seen.add(it.preset.name);
    out.push(it);
  }
  return out;
}

/* ----------------------------------------------------------------- export */

const csvCell = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
/** A CSV of planned cards (date, time, title, description, tags, pinned comment …) for scheduling. */
export function planCsv(items) {
  const head = ['Date', 'Time', 'Status', 'Title', 'Description', 'Tags', 'Pinned comment', 'Hook', 'Preset', 'Source', 'Format'];
  const rows = items.map((x) => [x.date, x.time, x.status, x.title, x.description, x.tags, x.pinned, x.hook, x.preset.name, x.source, x.format]);
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** Plain text of one card, ready to paste into YouTube Studio. */
export function cardText(x) {
  return `TITLE\n${x.title}\n\nDESCRIPTION\n${x.description}\n\nTAGS\n${x.tags}\n\nPINNED COMMENT\n${x.pinned}\n\nPOST AT\n${x.date} ${x.time}\n`;
}

/** Days in a row (ending today or yesterday) where every card was uploaded or skipped and one uploaded. */
export function streak(days, today) {
  let n = 0;
  for (let k = days[today] && done(days[today]) ? today : addDays(today, -1); days[k] && done(days[k]); k = addDays(k, -1)) n++;
  return n;
}
const done = (d) => d.items.length > 0 && d.items.every((x) => x.status === 'uploaded' || x.status === 'skipped') && d.items.some((x) => x.status === 'uploaded');
