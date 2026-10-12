/**
 * Daily tab: a posting plan that fills itself. Every day gets a few Shorts (3 by
 * default) with everything needed to publish them: the preset, a title, description,
 * tags, the opening hook, a comment to pin and a posting time. Cards can be loaded,
 * rendered (one day = one zip), swapped (🎲), edited, copied and ticked off.
 *
 * Also here: a queue (your own presets go out first), "Suggest ideas" (new remixes
 * of the catalog or of the current setup), settings, and a week CSV for scheduling.
 * Plans are made by src/daily/planner.js; all of it lives in this browser.
 */
import { loadCatalog, loadAllShelves, loadPack } from '../presets.js';
import { planDay, swapItem, ideas, planCsv, cardText, streak, themeOf, dayKey, addDays, dateOf, keyOf, finish, DEFAULT_SETTINGS } from '../daily/planner.js';
import { readDaily, writeDaily } from '../daily/store.js';
import { formatOf } from '../daily/remix.js';
import { h, group } from './controls.js';

const WEEK = 7;
const STATUS = [['planned', 'Planned'], ['rendered', 'Rendered'], ['uploaded', 'Uploaded'], ['skipped', 'Skip']];
const FORMAT_LABEL = {
  sound: 'Sound of a graph', quiz: 'Guess the shape', ab: 'A or B', fourier: 'Fourier', name: 'Name / word', flag: 'Flag', pi: 'π',
  calculus: 'Calculus', fractal: 'Fractal', physics: 'Physics', satisfying: 'Satisfying', story: 'Story', formula: 'Formula',
};
const TIPS = [
  'Render the whole day in one go (🎬), then upload all three and schedule them at the times shown.',
  'Paste the title, description and tags from the card; pin the comment question right after posting.',
  'Answer every comment in the first hour: it is the strongest signal for a new channel.',
  'Tick a card “Uploaded” so it is not suggested again for a few weeks (see Settings).',
  'Use 🎲 on a card you don’t like; put your own presets in the queue to post them first.',
  'Every few days, check which format got the most views and add more of it to the queue.',
];
const dayName = (key, o = { weekday: 'long', day: 'numeric', month: 'short' }) => dateOf(key).toLocaleDateString('en-GB', o);
const fileSafe = (s) => s.replace(/[\\/:*?"<>|#]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 70);

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* blocked in some frames */ }
  const ta = h('textarea', { style: 'position:fixed;opacity:0' });
  ta.value = text; document.body.append(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

export class DailyView {
  /**
   * @param {{loadPreset:(p:object)=>void, toast:(m:string, ms?:number)=>void, snapshot:()=>object,
   *          download:(blob:Blob, name:string)=>void, renderVideos:(items:{name:string, preset:object}[])=>Promise<string[]|void>,
   *          savePreset:(preset:object, o:{name:string, collection:string})=>void}} actions
   */
  constructor(actions) {
    this.actions = actions;
    this.data = readDaily();
    this.today = dayKey();
    this.day = this.today;      // the day shown
    this.weekStart = this.today; // first day of the strip
    this.catalog = null;
    this.state = 'loading';
    this.salt = 0;
    this.el = h('section.tab.daily');
    this.render();
    this.loadCatalog();
  }

  /* ---------------------------------------------------------------- data */

  async loadCatalog() {
    try {
      const [cat, shelves] = await Promise.all([loadCatalog(), loadAllShelves()]);
      const packs = await Promise.all(cat.packs.map(async (p) => ({ id: p.id, presets: await loadPack(p.id).catch(() => []) })));
      this.catalog = { shelves, packs };
      this.state = 'ready';
      this.ensureDays();
    } catch {
      this.state = 'failed';
    }
    this.render();
  }

  save() {
    if (!writeDaily(this.data, undefined, this.today)) this.actions.toast('The Daily plan could not be saved in this browser (storage full or blocked).', 6000);
  }

  /** What was posted or is planned elsewhere (so nothing comes back too soon). */
  historyFor(exceptDay) {
    const planned = Object.entries(this.data.days).filter(([k]) => k !== exceptDay)
      .flatMap(([k, d]) => d.items.filter((x) => x.status !== 'skipped').map((x) => ({ date: k, source: x.source, key: keyOf(x) })));
    return [...this.data.history, ...planned];
  }

  /** Plan today and the next six days if they have no plan yet (past days are left alone). */
  ensureDays() {
    if (!this.catalog) return;
    let changed = false;
    for (let i = 0; i < WEEK; i++) {
      const k = addDays(this.today, i);
      if (this.data.days[k]) continue;
      const { items, usedQueue } = planDay(k, { catalog: this.catalog, settings: this.data.settings, history: this.historyFor(k), queue: this.data.queue });
      this.data.days[k] = { items, plannedAt: Date.now() };
      this.data.queue = this.data.queue.filter((q) => !usedQueue.includes(q.id));
      changed = true;
    }
    if (changed) this.save();
  }

  /** Make a new plan for a day: cards you already rendered, uploaded or queued stay. */
  replan(k) {
    const old = this.data.days[k]?.items || [];
    const { items } = planDay(k, { catalog: this.catalog, settings: this.data.settings, history: this.historyFor(k), salt: ++this.salt });
    const keep = (x) => x && (x.status !== 'planned' || x.from === 'queue');
    const next = items.map((it, i) => (keep(old[i]) ? old[i] : it));
    for (let i = items.length; i < old.length; i++) if (keep(old[i])) next.push(old[i]);
    this.data.days[k] = { items: next, plannedAt: Date.now() };
    this.save();
    this.render();
  }

  /** The preset of a card with its (possibly edited) words applied. */
  presetOf(x) {
    const p = JSON.parse(JSON.stringify(x.preset));
    p.youtube = { title: x.title, description: x.description, tags: x.tags };
    p.hook = { ...(p.hook || {}), text: x.hook };
    return p;
  }

  setStatus(x, status) {
    x.status = status;
    this.data.history = this.data.history.filter((hh) => hh.id !== x.id);
    if (status === 'uploaded') this.data.history.push({ id: x.id, date: x.date, source: x.source, key: keyOf(x) });
    this.save();
    this.render();
  }

  async renderCards(cards) {
    const list = cards.filter((x) => x.status !== 'skipped');
    if (!list.length) return this.actions.toast('Nothing to render: every card of this day is skipped.');
    const entries = list.map((x) => ({ name: `${x.date} ${x.time.replace(':', '')} ${fileSafe(x.preset.name)}`, preset: this.presetOf(x), card: x }));
    const done = await this.actions.renderVideos(entries.map(({ name, preset }) => ({ name, preset })));
    if (!Array.isArray(done) || !done.length) return;
    for (const e of entries) if (done.includes(e.name) && e.card.status === 'planned') e.card.status = 'rendered';
    this.save();
    this.render();
  }

  enqueue(name, preset, shelf = '') {
    const clean = JSON.parse(JSON.stringify(preset));
    delete clean.$category; delete clean.$shelf; delete clean.$collection;
    this.data.queue.push({ id: `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: name || clean.name || 'My preset', shelf, preset: clean, addedAt: Date.now() });
    this.save();
    this.render();
    this.actions.toast(`“${name || clean.name}” is in the Daily queue: it goes out on the next day that has a free slot.`);
  }

  /** Put the queue into days that are still fully planned by the app (from tomorrow on). */
  placeQueue() {
    if (!this.data.queue.length) return;
    for (let i = 1; i < WEEK && this.data.queue.length; i++) {
      const k = addDays(this.today, i);
      const d = this.data.days[k];
      if (!d) continue;
      for (let s = 0; s < d.items.length && this.data.queue.length; s++) {
        const old = d.items[s];
        if (old.status !== 'planned' || old.from !== 'plan') continue;
        const q = this.data.queue.shift();
        d.items[s] = finish({ ...old, id: `${k}-${s}-${q.id}`, from: 'queue', label: 'From your queue', source: q.name, shelf: q.shelf, format: formatOf(q.preset, q.shelf), subject: q.name, remixed: false, preset: q.preset, pinned: '' }, this.data.settings);
      }
    }
    this.save();
    this.render();
  }

  /* ------------------------------------------------------------------ view */

  /** A collapsible section that stays open or closed across re-renders. */
  section(key, title, children, open = false) {
    this.opened ||= {};
    const g = group(title, children, { open: this.opened[key] ?? open });
    g.addEventListener('toggle', () => { this.opened[key] = g.open; });
    return g;
  }

  render() {
    const scrollTop = this.el.scrollTop;
    this.el.replaceChildren(h('div.tab-inner.daily-inner', {}, ...this.view()));
    this.el.scrollTop = scrollTop;
  }

  view() {
    if (this.state === 'loading') return [this.header(), h('p.hint.daily-empty', {}, 'Loading the preset catalog…')];
    if (this.state === 'failed') return [this.header(), h('p.hint.daily-empty', {}, 'The preset catalog could not be loaded (offline?).'), h('button.btn.small', { type: 'button', onclick: () => { this.state = 'loading'; this.render(); this.loadCatalog(); } }, 'Try again')];
    if (dayKey() !== this.today) { this.today = dayKey(); this.ensureDays(); }
    return [this.header(), this.strip(), this.dayView(), this.queueView(), this.ideasView(), this.settingsView(), this.tipsView()];
  }

  header() {
    const t = themeOf(this.today, this.data.settings);
    const n = streak(this.data.days, this.today);
    const wide = this.el.classList.contains('is-wide');
    return h('div.daily-head', {},
      h('div', {}, h('strong.daily-title', {}, `Today · ${t.emoji} ${t.name}`),
        h('span.hint', {}, `${dayName(this.today)}${n ? ` · 🔥 ${n}-day streak` : ''}`)),
      h('button.icon-btn', { type: 'button', title: wide ? 'Back to the side panel (Esc)' : 'Open wide (easier to read and edit)', onclick: () => this.setWide(!wide) }, wide ? '✕' : '⤢'));
  }

  /** Wide view: the tab moves over the whole window (a side panel would clip it), and back. */
  setWide(on) {
    if (on === this.el.classList.contains('is-wide')) return;
    if (on) {
      this.home = { parent: this.el.parentNode, next: this.el.nextSibling };
      document.body.append(this.el);
      this.onKey = (e) => { if (e.key === 'Escape') this.setWide(false); };
      addEventListener('keydown', this.onKey);
    } else {
      this.home?.parent.insertBefore(this.el, this.home.next);
      removeEventListener('keydown', this.onKey);
    }
    this.el.classList.toggle('is-wide', on);
    this.render();
  }

  strip() {
    const days = Array.from({ length: WEEK }, (_, i) => addDays(this.weekStart, i));
    const nav = (n) => { this.weekStart = addDays(this.weekStart, n * WEEK); this.day = this.weekStart; this.render(); };
    return h('div.daily-strip', {},
      h('button.icon-btn', { type: 'button', title: 'Previous week', onclick: () => nav(-1) }, '‹'),
      ...days.map((k) => {
        const d = this.data.days[k];
        const dots = (d?.items || []).map((x) => h(`span.dot.s-${x.status}`, { title: `${x.time} ${x.status}` }));
        const b = h('button.daily-day', { type: 'button', onclick: () => { this.day = k; this.render(); } },
          h('span.dd-w', {}, dayName(k, { weekday: 'short' })), h('span.dd-n', {}, String(dateOf(k).getDate())), h('span.dd-dots', {}, ...dots));
        b.classList.toggle('is-today', k === this.today);
        b.classList.toggle('is-active', k === this.day);
        b.classList.toggle('is-past', k < this.today);
        return b;
      }),
      h('button.icon-btn', { type: 'button', title: 'Next week', onclick: () => nav(1) }, '›'));
  }

  dayView() {
    const k = this.day;
    const d = this.data.days[k];
    const t = themeOf(k, this.data.settings);
    const head = h('div.daily-dayhead', {}, h('strong', {}, `${dayName(k)} · ${t.emoji} ${t.name}`));
    if (!d) {
      const future = k >= this.today;
      return h('div.daily-day-view', {}, head,
        h('p.hint', {}, future ? 'No plan yet for this day.' : 'Nothing was planned for this day.'),
        future ? h('button.btn.small', { type: 'button', onclick: () => { const { items } = planDay(k, { catalog: this.catalog, settings: this.data.settings, history: this.historyFor(k) }); this.data.days[k] = { items, plannedAt: Date.now() }; this.save(); this.render(); } }, 'Plan this day') : null);
    }
    const left = d.items.filter((x) => x.status === 'planned' || x.status === 'rendered').length;
    const tools = h('div.daily-tools', {},
      h('button.btn.small.export-btn', { type: 'button', title: 'Render every card of this day into one zip (videos + YouTube texts)', onclick: () => this.renderCards(d.items) }, `🎬 Render day (${d.items.filter((x) => x.status !== 'skipped').length})`),
      k >= this.today ? h('button.btn.ghost.small', { type: 'button', title: 'New picks for the cards still “planned” (rendered, uploaded and queued cards stay)', onclick: () => this.replan(k) }, '⟳ New plan') : null,
      h('button.btn.ghost.small', { type: 'button', title: 'All texts of this day as one file', onclick: () => this.actions.download(new Blob([d.items.map(cardText).join('\n――――――――――――――――\n\n')], { type: 'text/plain' }), `MathWaves ${k}.txt`) }, '⬇ Texts'),
      h('button.btn.ghost.small', { type: 'button', title: 'This week as a CSV (dates, times, titles, descriptions, tags, pinned comments)', onclick: () => this.downloadWeek() }, '⬇ Week CSV'));
    return h('div.daily-day-view', {}, head,
      h('p.hint', {}, left ? `${left} of ${d.items.length} still to post.` : d.items.length ? 'All done for this day ✓' : 'No cards.'),
      tools, ...d.items.map((x, i) => this.card(x, d, i)));
  }

  downloadWeek() {
    const items = Array.from({ length: WEEK }, (_, i) => this.data.days[addDays(this.weekStart, i)]?.items || []).flat().filter((x) => x.status !== 'skipped');
    this.actions.download(new Blob([`﻿${planCsv(items)}`], { type: 'text/csv' }), `MathWaves week ${this.weekStart}.csv`);
  }

  card(x, d, i) {
    const save = () => this.save();
    const field = (label, key, { multiline = false, max = 0 } = {}) => {
      const input = h(multiline ? 'textarea' : 'input', { spellcheck: 'true', rows: multiline ? (key === 'description' ? 6 : 2) : null });
      input.value = x[key] || '';
      const count = max ? h('span.hint.daily-count', {}, `${input.value.length}/${max}`) : null;
      input.addEventListener('input', () => { x[key] = input.value; if (count) { count.textContent = `${input.value.length}/${max}`; count.classList.toggle('over', input.value.length > max); } });
      input.addEventListener('change', save);
      count?.classList.toggle('over', input.value.length > max);
      const cp = h('button.btn.ghost.small', { type: 'button', onclick: async () => this.actions.toast(await copy(x[key] || '') ? `${label} copied.` : 'Copy is blocked here: select the text and copy it by hand.') }, 'Copy');
      return h('div.daily-field', {}, h('div.daily-field-top', {}, h('span.daily-label', {}, label), count, cp), input);
    };
    const time = h('input.daily-time', { type: 'time', value: x.time || '' });
    time.addEventListener('change', () => { x.time = time.value; save(); });
    const status = h('div.seg.daily-status', { role: 'radiogroup', 'aria-label': 'Status' },
      ...STATUS.map(([v, t]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(x.status === v), onclick: () => this.setStatus(x, v) }, t)));
    const el = h(`article.daily-card.s-${x.status}`, {},
      h('div.daily-card-top', {}, time,
        h('span.daily-chip', {}, x.label),
        (FORMAT_LABEL[x.format] || x.format) !== x.label ? h('span.daily-chip.fmt', {}, FORMAT_LABEL[x.format] || x.format) : null,
        x.remixed ? h('span.daily-chip.remix', { title: `A remix of “${x.source}”` }, 'remix') : null,
        x.from === 'queue' ? h('span.daily-chip.queue', {}, 'yours') : null),
      field('Title', 'title', { max: 100 }),
      h('p.hint.daily-src', {}, x.remixed ? `${x.preset.name} (from “${x.source}”)` : x.preset.name),
      h('div.daily-actions', {},
        h('button.btn.small', { type: 'button', onclick: () => this.actions.loadPreset(this.presetOf(x)) }, '▶ Load'),
        h('button.btn.ghost.small', { type: 'button', onclick: () => this.renderCards([x]) }, '🎬 Render'),
        h('button.btn.ghost.small', { type: 'button', title: 'Another pick for this slot', onclick: () => {
          const others = d.items.filter((o) => o !== x);
          d.items[i] = swapItem(x, { catalog: this.catalog, settings: this.data.settings, history: this.historyFor(''), others, salt: ++this.salt });
          d.items[i].time = x.time;
          save(); this.render();
        } }, '🎲'),
        h('button.btn.ghost.small', { type: 'button', title: 'Copy title, description, tags and pinned comment together', onclick: async () => this.actions.toast(await copy(cardText(x)) ? 'Everything copied.' : 'Copy is blocked here: use ⬇ Texts instead.') }, '⧉ All'),
        h('button.btn.ghost.small', { type: 'button', title: 'Save this card’s preset to your presets', onclick: () => this.actions.savePreset(this.presetOf(x), { name: x.preset.name, collection: 'Daily' }) }, '＋ Save')),
      h('details.daily-more', {}, h('summary', {}, 'Description · tags · hook · pinned comment'),
        field('Description', 'description', { multiline: true, max: 5000 }),
        field('Tags', 'tags', { multiline: true, max: 500 }),
        field('Hook (first 2 s on screen)', 'hook'),
        field('Pinned comment', 'pinned')),
      status);
    return el;
  }

  queueView() {
    const q = this.data.queue;
    const move = (i, n) => { const [it] = q.splice(i, 1); q.splice(Math.max(0, Math.min(q.length, i + n)), 0, it); this.save(); this.render(); };
    const rows = q.map((it, i) => h('div.daily-qrow', {},
      h('span.daily-qname', {}, `${i + 1}. ${it.name}`),
      h('button.icon-btn', { type: 'button', title: 'Load', onclick: () => this.actions.loadPreset(it.preset) }, '▶'),
      h('button.icon-btn', { type: 'button', title: 'Earlier', disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
      h('button.icon-btn.danger', { type: 'button', title: 'Remove from the queue', onclick: () => { q.splice(i, 1); this.save(); this.render(); } }, '✕')));
    return this.section('queue', `Queue (${q.length})`, [
      h('p.hint', {}, 'Your own presets go out first, on the next day that has a free slot. Add the current setup here, or use “Add to Daily” in a preset’s ⋯ menu (Presets tab).'),
      ...rows,
      h('div.daily-tools', {},
        h('button.btn.small', { type: 'button', onclick: () => { const s = this.actions.snapshot(); this.enqueue(s.name, s); } }, '＋ Add current setup'),
        q.length ? h('button.btn.ghost.small', { type: 'button', title: 'Put the queue into this week’s days now (replaces cards still “planned”, from tomorrow on)', onclick: () => this.placeQueue() }, 'Place in this week') : null),
    ], q.length > 0);
  }

  ideasView() {
    const list = this.data.ideas || [];
    const run = (of = null) => {
      this.data.ideas = ideas({ catalog: this.catalog, settings: this.data.settings, n: 6, salt: ++this.salt + Date.now() % 100000, of, date: this.today });
      this.save();
      this.render();
    };
    const rows = list.map((x) => h('div.daily-idea', {},
      h('div.daily-idea-text', {}, h('strong', {}, x.title.replace(/\s*#shorts$/i, '')), h('span.hint', {}, `${FORMAT_LABEL[x.format] || x.format} · from “${x.source}”`)),
      h('div.daily-actions', {},
        h('button.btn.ghost.small', { type: 'button', onclick: () => this.actions.loadPreset(this.presetOf(x)) }, '▶ Load'),
        h('button.btn.ghost.small', { type: 'button', onclick: () => this.enqueue(x.preset.name, this.presetOf(x), x.shelf) }, '＋ Queue'),
        h('button.btn.ghost.small', { type: 'button', onclick: () => this.actions.savePreset(this.presetOf(x), { name: x.preset.name, collection: 'Daily ideas' }) }, '＋ Save'))));
    return this.section('ideas', '✨ Ideas', [
      h('p.hint', {}, 'New presets made from the catalog: a new subject (shape, curve, flag, word, function, fractal spot …), colours, instrument and words. Like one? Queue it or save it.'),
      h('div.daily-tools', {},
        h('button.btn.small', { type: 'button', onclick: () => run() }, '✨ Suggest 6 ideas'),
        h('button.btn.ghost.small', { type: 'button', title: 'Six variations of what is loaded now', onclick: () => { const s = this.actions.snapshot(); run({ preset: s, shelf: '', source: s.name }); } }, 'Vary the current setup')),
      ...rows,
    ]);
  }

  settingsView() {
    const s = this.data.settings;
    const changed = (msg) => { this.save(); this.actions.toast(msg || 'Saved. New settings apply to days that are planned from now on (or press ⟳ New plan).'); this.render(); };
    const num = (label, key, min, max) => {
      const input = h('input', { type: 'number', min, max, step: 1, value: s[key] });
      input.addEventListener('change', () => { s[key] = Math.max(min, Math.min(max, Math.round(+input.value) || min)); changed(); });
      return h('div.ctl.ctl-number', {}, h('label', {}, label), input);
    };
    const flag = (label, key) => {
      const input = h('input', { type: 'checkbox', role: 'switch' });
      input.checked = !!s[key];
      input.addEventListener('change', () => { s[key] = input.checked; changed(); });
      return h('div.ctl.ctl-toggle', {}, h('label', {}, label), input);
    };
    const times = h('div.daily-times', {}, ...Array.from({ length: s.perDay }, (_, i) => {
      const t = h('input.daily-time', { type: 'time', value: s.times[i] || '' });
      t.addEventListener('change', () => { s.times[i] = t.value; changed('Saved. Times apply to newly planned days.'); });
      return t;
    }));
    const footer = h('textarea', { rows: 3, placeholder: 'e.g. New math video every day 🔔 Subscribe: @MathWaves' });
    footer.value = s.footer || '';
    footer.addEventListener('change', () => { s.footer = footer.value; changed('Saved. The footer is added to cards planned from now on.'); });
    return this.section('settings', 'Settings', [
      num('Posts per day', 'perDay', 1, 5),
      h('div.ctl', {}, h('label', {}, 'Posting times'), times),
      num('Don’t repeat a preset within (days)', 'avoidDays', 0, 90),
      flag('Weekday themes', 'themes'),
      flag('Remix presets that were posted before', 'remix'),
      flag('Include lessons', 'lessons'),
      h('div.ctl.ctl-text', {}, h('label', {}, 'Add to every description'), footer),
      h('div.daily-tools', {},
        h('button.btn.ghost.small', { type: 'button', title: 'Re-plan the coming days with these settings (cards you rendered, uploaded or queued stay)', onclick: () => { for (let i = 0; i < WEEK; i++) { const k = addDays(this.today, i); if (this.data.days[k]) this.replan(k); } this.actions.toast('This week was re-planned.'); } }, '⟳ Re-plan this week'),
        h('button.btn.ghost.small', { type: 'button', title: 'Save the whole plan (settings, days, queue, history) as a file', onclick: () => this.actions.download(new Blob([JSON.stringify({ $format: 'math-melody-daily', version: 1, ...this.data }, null, 1)], { type: 'application/json' }), `MathWaves daily plan ${this.today}.json`) }, '⬇ Backup')),
      h('p.hint', {}, `Themes: ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((n, i) => `${n} ${themeOf(addDays(this.today, (i - dateOf(this.today).getDay() + 7) % 7), { ...DEFAULT_SETTINGS, themes: true }).name.replace(/ \w+day$/, '')}`).join(' · ')}.`),
    ]);
  }

  tipsView() {
    return this.section('tips', 'Daily checklist', [h('ol.daily-tips', {}, ...TIPS.map((t) => h('li', {}, t)))]);
  }
}
