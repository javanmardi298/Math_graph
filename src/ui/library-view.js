/**
 * Presets tab: one searchable list of built-in and saved presets, built to stay
 * usable with hundreds of entries: search, filters, collections, favourites,
 * sorting, multi-select with bulk export/move/delete, and import of many files
 * at once (.json single presets or bundles, .zip, drag & drop).
 *
 * No prompt()/confirm(): they don't work inside the claude.ai viewer, so renames,
 * moves and deletions are done inline (deletions need a second click).
 */
import { loadAllShelves, loadCatalog, loadPack } from '../presets.js';
import { CIRCLE_RULES } from '../circle/sim.js';
import {
  readLibrary, loadLibrary, saveLibrary, makeItem, uniqueName, describe, readPresetFiles,
  singleFile, bundleFile, clean, STORAGE_BUDGET,
} from '../library.js';
import { h } from './controls.js';
import { normalize } from '../state.js';

const FAV_KEY = 'mmv.favorites.v1';
const PAGE = 100;

const readFavs = () => { try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY)) || []); } catch { return new Set(); } };
const writeFavs = (s) => { try { localStorage.setItem(FAV_KEY, JSON.stringify([...s])); } catch { /* storage blocked */ } };
const fmtKB = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const safeName = (s) => (s || 'presets').replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 80) || 'presets';

export class LibraryView {
  /**
   * @param {{loadPreset:(p:object)=>void, toast:(m:string, ms?:number)=>void,
   *          snapshot:()=>object, download:(blob:Blob, name:string)=>void}} actions
   */
  constructor(actions) {
    this.actions = actions;
    this.items = readLibrary(); // instant; replaced by the IndexedDB copy a moment later
    this.backend = 'local';
    this.favs = readFavs();
    // built-in presets sit on shelves (categories); your own ones in their collections
    // built-in presets are JSON files outside the app (presets/): fetched once, here
    this.builtins = [];
    this.shelfOrder = [];
    this.packs = [];
    this.catalogState = 'loading'; // loading | ready | failed
    this.filter = { q: '', source: 'all', aspect: 'any', mode: 'any', collection: '*', sort: 'shelf' };
    this.collapsed = new Set();
    this.selected = new Set();
    this.limit = PAGE;
    this.openMenu = null; // id of the row whose action menu is open
    this.editing = null; // { id, field: 'name' | 'collection' }
    this.confirmDelete = null; // id or 'bulk' armed for a second click
    this.activeId = null;
    this.build();
    this.render();
    this.loadBuiltins();
    loadLibrary().then(({ items, backend }) => {
      this.items = items;
      this.backend = backend;
      this.render();
      this.updateQuota();
    });
  }

  /** Fetch the catalog and every shelf (small JSON files), then show them. */
  loadBuiltins() {
    this.catalogState = 'loading';
    Promise.all([loadCatalog(), loadAllShelves()]).then(([cat, shelves]) => {
      this.shelfOrder = cat.shelves.map((s) => s.name);
      // a preset can sit on two shelves ("Start here" and its own): the id says which
      this.builtins = shelves.flatMap(({ shelf, presets }) => presets.map((p) => ({
        id: shelf.id === 'start' ? `b:★:${p.name}` : `b:${p.name}`, name: p.name, collection: shelf.name, builtin: true, savedAt: 0, preset: p,
      })));
      this.packs = cat.packs.map((p) => ({ ...p, load: () => loadPack(p.id) }));
      this.catalogState = 'ready';
      this.renderPacks();
      this.render();
    }).catch(() => { this.catalogState = 'failed'; this.render(); });
  }

  updateQuota() {
    navigator.storage?.estimate?.().then((e) => { this.quota = e; this.render(); }).catch(() => {});
  }

  /* ---------------------------------------------------------------- data */

  persist() {
    saveLibrary(this.items, this.backend).then((r) => {
      if (!r.ok) {
        this.actions.toast(r.error === 'full'
          ? 'This browser’s storage is full. Export a backup, then delete presets you don’t need (custom marker images take the most space).'
          : 'Browser storage is blocked here, so presets can’t be saved. Export them as files instead.', 8000);
      }
      this.updateQuota();
    });
    return true;
  }

  all() { return [...this.builtins, ...this.items]; }
  byId(id) { return this.all().find((x) => x.id === id); }
  collections() { return [...new Set(this.items.map((x) => x.collection).filter(Boolean))].sort((a, b) => a.localeCompare(b)); }
  shelves() {
    const order = (c) => { const i = this.shelfOrder.indexOf(c); return i < 0 ? 999 : i; };
    return [...new Set(this.builtins.map((x) => x.collection))].sort((a, b) => order(a) - order(b) || a.localeCompare(b));
  }
  shelfOf(x) { return x.builtin ? x.collection : x.collection || 'My presets'; }

  visible() {
    const f = this.filter;
    const q = f.q.trim().toLowerCase();
    let list = this.all().filter((x) => {
      if (f.source === 'builtin' && !x.builtin) return false;
      if (f.source === 'mine' && x.builtin) return false;
      if (f.source === 'fav' && !this.favs.has(x.id)) return false;
      const d = describe(x.preset);
      if (f.aspect === '16:9' && d.vertical) return false;
      if (f.aspect === '9:16' && !d.vertical) return false;
      if (f.mode !== 'any' && d.mode !== f.mode) return false;
      if (f.collection !== '*' && (x.collection || '') !== f.collection) return false;
      if (q) {
        const rule = x.preset.circle ? [x.preset.circle, ...(x.preset.circle.layers || []).map((l) => l.cfg || {})].map((c) => `${c.rule || ''} ${CIRCLE_RULES[c.rule] || ''}`).join(' ') : '';
        const hay = `${x.name} ${x.collection} ${x.preset.hook?.text || ''} ${rule} ${x.preset.youtube?.title || ''} ${(x.preset.layers || []).map((l) => Object.values(l.exprs || {}).join(' ')).join(' ')}`.toLowerCase();
        if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    if (f.sort === 'recent') list = list.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    else if (f.sort === 'shelf') {
      // your own collections first, then the built-in shelves in their order; keep each shelf's own order
      const shelves = [...this.collections(), 'My presets', ...this.shelves()];
      const rank = new Map(shelves.map((c, i) => [c, i]));
      const pos = new Map(this.all().map((x, i) => [x.id, i]));
      list = list.sort((a, b) => (rank.get(this.shelfOf(a)) ?? 999) - (rank.get(this.shelfOf(b)) ?? 999) || (a.builtin ? pos.get(a.id) - pos.get(b.id) : (b.savedAt || 0) - (a.savedAt || 0)));
    } else list = list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    return list;
  }

  /* -------------------------------------------------------------- layout */

  build() {
    const f = this.filter;
    this.search = h('input.lib-search', { type: 'search', placeholder: `Search ${this.all().length} presets (name, collection, formula)…`, 'aria-label': 'Search presets', dir: 'auto' });
    let t;
    this.search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { f.q = this.search.value; this.limit = PAGE; this.render(); }, 120); });

    const chip = (key, value, label) => {
      const b = h('button.chip.lib-chip', { type: 'button', dataset: { key, value } }, label);
      b.addEventListener('click', () => { f[key] = f[key] === value && key !== 'source' ? 'any' : value; this.limit = PAGE; this.render(); });
      return b;
    };
    this.chips = h('div.lib-chips', {},
      chip('source', 'all', 'All'), chip('source', 'builtin', 'Built-in'), chip('source', 'mine', 'Mine'), chip('source', 'fav', '★ Favourites'),
      chip('aspect', '16:9', '16:9'), chip('aspect', '9:16', '9:16'), chip('mode', '2d', '2D'), chip('mode', '3d', '3D'), chip('mode', 'circle', '◎ Circle'));

    this.collSel = h('select.lib-select', { 'aria-label': 'Collection' });
    this.collSel.addEventListener('change', () => { f.collection = this.collSel.value; this.limit = PAGE; this.render(); });
    this.sortSel = h('select.lib-select', { 'aria-label': 'Sort' }, h('option', { value: 'shelf' }, 'By shelf'), h('option', { value: 'name' }, 'Sort: A–Z'), h('option', { value: 'recent' }, 'Sort: newest'));
    this.sortSel.addEventListener('change', () => { f.sort = this.sortSel.value; this.render(); });

    this.bulk = h('div.lib-bulk', { hidden: true });
    this.list = h('div.lib-list', { role: 'list' });
    this.more = h('button.btn.ghost.small.lib-more', { type: 'button', hidden: true, onclick: () => { this.limit += PAGE; this.render(); } });
    this.count = h('p.hint.lib-count');
    this.report = h('div.lib-report', { hidden: true });

    // Save current setup
    this.saveName = h('input.lib-input', { placeholder: 'Name for the current setup', 'aria-label': 'Preset name', dir: 'auto' });
    this.saveColl = h('input.lib-input', { placeholder: 'Collection (optional)', 'aria-label': 'Collection', list: 'lib-collections', dir: 'auto' });
    this.collList = h('datalist#lib-collections');
    const save = h('button.btn', { type: 'button', onclick: () => this.saveCurrent() }, 'Save');
    this.saveName.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.saveCurrent(); });

    // Import / export
    this.fileIn = h('input', { type: 'file', multiple: true, hidden: true }); // no `accept`: phones grey out .json files otherwise
    this.fileIn.addEventListener('change', () => { const files = [...this.fileIn.files]; this.fileIn.value = ''; if (files.length) this.importFiles(files); });
    this.storage = h('p.hint.lib-storage');

    this.el = h('section.tab.lib', {},
      h('div.lib-top', {}, this.search, this.chips, h('div.row', {}, this.collSel, this.sortSel,
        h('button.btn.ghost.small', { type: 'button', title: 'Load a random preset from the list', onclick: () => { const v = this.visible(); if (v.length) this.load(v[Math.floor(Math.random() * v.length)]); } }, '🎲'))),
      this.report,
      this.bulk,
      this.list, this.more, this.count,
      h('details.group', { open: true }, h('summary', {}, 'Save current setup'),
        h('div.group-body', {}, this.saveName, h('div.row', {}, this.saveColl, save), this.collList)),
      h('details.group', {}, this.packTitle = h('summary', {}, 'Lesson packs'),
        h('div.group-body', {},
          h('p.hint', {}, 'Step-by-step vertical lessons, one idea per step. They are not in the built-in list: add the packs you want and they appear in your presets, each pack in its own collection.'),
          this.packList = h('div.lib-packs', {}, h('p.hint', {}, 'Loading…')),
          h('button.btn', { type: 'button', onclick: () => this.addPacks(this.packs) }, '＋ Add all lesson packs'))),
      h('details.group', { open: true }, h('summary', {}, 'Import & export'),
        h('div.group-body', {},
          h('button.btn', { type: 'button', onclick: () => this.fileIn.click() }, '⇪ Import preset files…'), this.fileIn,
          h('p.hint', {}, 'Choose one or many .json preset files or a .zip of them, or drop them on this tab. Same-named presets are kept and renamed, never overwritten.'),
          h('div.row', {},
            h('button.btn.ghost', { type: 'button', onclick: () => this.exportCurrent() }, 'Export current setup'),
            h('button.btn.ghost', { type: 'button', onclick: () => this.exportBackup() }, 'Back up all my presets')),
          this.storage)));

    // Drag & drop anywhere on the tab
    this.el.addEventListener('dragover', (e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); this.el.classList.add('drop-hover'); } });
    this.el.addEventListener('dragleave', (e) => { if (e.target === this.el) this.el.classList.remove('drop-hover'); });
    this.el.addEventListener('drop', (e) => {
      e.preventDefault();
      this.el.classList.remove('drop-hover');
      const files = [...(e.dataTransfer?.files || [])];
      if (files.length) this.importFiles(files);
    });
  }

  /* -------------------------------------------------------------- render */

  render() {
    const f = this.filter;
    for (const b of this.chips.querySelectorAll('.lib-chip')) b.setAttribute('aria-pressed', String(f[b.dataset.key] === b.dataset.value));
    const colls = this.collections();
    const shelves = this.shelves();
    if (f.collection !== '*' && !shelves.includes(f.collection) && !colls.includes(f.collection)) f.collection = '*';
    this.collSel.replaceChildren(h('option', { value: '*' }, 'All shelves'),
      colls.length ? h('optgroup', { label: 'My collections' }, colls.map((c) => h('option', { value: c }, c))) : null,
      h('optgroup', { label: 'Built-in' }, shelves.map((c) => h('option', { value: c }, `${c} (${this.builtins.filter((x) => x.collection === c).length})`))));
    this.collSel.value = f.collection;
    this.collList.replaceChildren(...colls.map((c) => h('option', { value: c })));
    this.search.placeholder = `Search ${this.all().length} presets (name, collection, formula)…`;

    const list = this.visible();
    const shown = list.slice(0, this.limit);
    this.list.replaceChildren(...(shown.length ? this.rows(shown, list) : [h('p.hint.lib-empty', {}, this.items.length || f.source !== 'mine'
      ? 'No presets match. Clear the search or filters.'
      : 'You have no saved presets yet. Save the current setup below, or import preset files.')]));
    this.more.hidden = list.length <= this.limit;
    this.more.textContent = `Show ${Math.min(PAGE, list.length - this.limit)} more (${list.length - this.limit} hidden)`;
    this.count.textContent = `${list.length} of ${this.all().length} presets${this.catalogState === 'loading' ? ' · loading the built-in ones…' : this.catalogState === 'failed' ? ' · built-in presets could not be loaded (offline?)' : ''}`;

    // Bulk bar
    for (const id of [...this.selected]) if (!this.byId(id)) this.selected.delete(id);
    this.bulk.hidden = !this.selected.size;
    if (this.selected.size) this.renderBulk(list);

    const n = `${this.items.length} preset${this.items.length === 1 ? '' : 's'}`;
    const q = this.quota;
    this.storage.textContent = this.backend === 'idb'
      ? `Saved in this browser: ${n}${q?.usage != null ? ` · ${fmtKB(q.usage)} used${q.quota ? ` of ${fmtKB(q.quota)} available` : ''}` : ''}`
      : `Saved in this browser: ${n} · ${fmtKB(JSON.stringify(this.items).length * 2)} of about ${fmtKB(STORAGE_BUDGET)}`;
  }

  /** Rows, with a header per shelf when sorted by shelf (click a header to fold it). */
  rows(shown, list) {
    if (this.filter.sort !== 'shelf') return shown.map((x) => this.row(x));
    const out = [];
    let shelf = null;
    for (const x of shown) {
      const s = this.shelfOf(x);
      if (s !== shelf) {
        shelf = s;
        const n = list.filter((y) => this.shelfOf(y) === s).length;
        const folded = this.collapsed.has(s);
        out.push(h('button.lib-shelf', { type: 'button', 'aria-expanded': String(!folded), onclick: () => { folded ? this.collapsed.delete(s) : this.collapsed.add(s); this.render(); } },
          h('span', {}, `${folded ? '▸' : '▾'} ${s}`), h('span.lib-shelf-n', {}, String(n))));
      }
      if (!this.collapsed.has(s)) out.push(this.row(x));
    }
    return out;
  }

  row(x) {
    const d = describe(x.preset);
    const sel = this.selected.has(x.id);
    const menuOpen = this.openMenu === x.id;
    const rule = x.preset.circle?.rule;
    const tags = [d.aspect, d.mode === 'circle' ? `◎ ${CIRCLE_RULES[rule]?.split(/[(:]/)[0].trim() || rule || 'circle'}` : d.mode.toUpperCase(), d.mode === 'circle' ? (d.circleLayers > 1 ? `${d.circleLayers} layers · ${x.preset.circle.combine === 'together' ? 'together' : 'one after another'}` : null) : `${d.layers} layer${d.layers === 1 ? '' : 's'}`,
      d.sequence && 'sequence', d.drums && 'drums', d.animated && 'animated', x.preset.youtube?.title && '▶ YT title', !x.builtin && x.collection].filter(Boolean);

    const check = h('input.lib-check', { type: 'checkbox', 'aria-label': `Select ${x.name}` });
    check.checked = sel;
    check.addEventListener('change', () => { check.checked ? this.selected.add(x.id) : this.selected.delete(x.id); this.render(); });

    let main;
    if (this.editing?.id === x.id) {
      const field = this.editing.field;
      const input = h('input.lib-input', { value: field === 'name' ? x.name : x.collection, dir: 'auto', list: field === 'collection' ? 'lib-collections' : null, 'aria-label': field === 'name' ? 'New name' : 'Collection' });
      const commit = () => {
        const v = input.value.trim();
        if (field === 'name' && v) { x.name = v; x.preset = { ...x.preset, name: v }; }
        if (field === 'collection') x.collection = v;
        this.editing = null;
        this.persist();
        this.render();
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { this.editing = null; this.render(); } });
      input.addEventListener('blur', commit);
      setTimeout(() => { input.focus(); input.select(); });
      main = h('div.lib-main', {}, input);
    } else {
      main = h('button.lib-main', { type: 'button', title: 'Load this preset', onclick: () => this.load(x) },
        h('span.lib-dots', {}, d.colors.map((c) => h('i', { style: `background:${c}` }))),
        h('span.lib-text', {}, h('span.lib-name', { dir: 'auto' }, x.name), h('span.lib-meta', {}, tags.join(' · '))));
    }

    const fav = h('button.icon-btn.lib-fav', { type: 'button', 'aria-pressed': String(this.favs.has(x.id)), title: this.favs.has(x.id) ? 'Remove from favourites' : 'Add to favourites' }, this.favs.has(x.id) ? '★' : '☆');
    fav.addEventListener('click', () => { this.favs.has(x.id) ? this.favs.delete(x.id) : this.favs.add(x.id); writeFavs(this.favs); this.render(); });
    const more = h('button.icon-btn', { type: 'button', title: 'More actions', 'aria-expanded': String(menuOpen) }, '⋯');
    more.addEventListener('click', () => { this.openMenu = menuOpen ? null : x.id; this.confirmDelete = null; this.render(); });

    const rowEl = h('div.lib-row', { role: 'listitem', dataset: { id: x.id } }, check, main, fav, more);
    rowEl.classList.toggle('is-active', this.activeId === x.id);
    rowEl.classList.toggle('is-selected', sel);
    if (!menuOpen) return rowEl;

    const act = (label, fn, cls = '') => h(`button.btn.ghost.small${cls}`, { type: 'button', onclick: fn }, label);
    const menu = h('div.lib-menu', {},
      act('Load', () => this.load(x)),
      act('Render video', () => this.renderItems([x])),
      ...(this.actions.addToDaily ? [act('Add to Daily', () => { this.openMenu = null; this.actions.addToDaily({ name: x.name, preset: clean(x.preset) }); this.render(); })] : []),
      act('Export', () => this.exportItems([x])),
      act('Duplicate', () => this.duplicate(x)),
      ...(x.builtin ? [] : [
        act('Rename', () => { this.editing = { id: x.id, field: 'name' }; this.openMenu = null; this.render(); }),
        act('Collection…', () => { this.editing = { id: x.id, field: 'collection' }; this.openMenu = null; this.render(); }),
        act(this.confirmDelete === x.id ? 'Click again to delete' : 'Delete', () => {
          if (this.confirmDelete !== x.id) { this.confirmDelete = x.id; this.render(); return; }
          this.items = this.items.filter((i) => i.id !== x.id);
          this.selected.delete(x.id);
          this.openMenu = this.confirmDelete = null;
          this.persist();
          this.actions.toast(`Deleted “${x.name}”.`);
          this.render();
        }, '.danger'),
      ]));
    return h('div.lib-item', {}, rowEl, menu);
  }

  renderBulk(list) {
    const sel = this.all().filter((x) => this.selected.has(x.id));
    const mine = sel.filter((x) => !x.builtin);
    const moveIn = h('input.lib-input', { placeholder: 'Move to collection…', list: 'lib-collections', dir: 'auto', 'aria-label': 'Move selected to collection' });
    const move = () => {
      for (const x of mine) x.collection = moveIn.value.trim();
      this.persist();
      this.actions.toast(`Moved ${mine.length} preset${mine.length === 1 ? '' : 's'} to “${moveIn.value.trim() || 'no collection'}”.`);
      this.render();
    };
    moveIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') move(); });
    const armed = this.confirmDelete === 'bulk';
    this.bulk.replaceChildren(
      h('div.row', {},
        h('strong', {}, `${sel.length} selected`),
        h('button.link', { type: 'button', onclick: () => { for (const x of list) this.selected.add(x.id); this.render(); } }, `Select all ${list.length}`),
        h('button.link', { type: 'button', onclick: () => { this.selected.clear(); this.confirmDelete = null; this.render(); } }, 'Clear')),
      h('div.row', {},
        h('button.btn.small.lib-render', { type: 'button', onclick: () => this.renderItems(sel), title: 'Render every selected preset to MP4 (Export tab settings) and download them in one .zip, each with its YouTube title and description' }, `🎬 Render ${sel.length} video${sel.length === 1 ? '' : 's'}`),
        h('button.btn.ghost.small', { type: 'button', onclick: () => this.exportItems(sel) }, `Export ${sel.length} preset${sel.length === 1 ? '' : 's'}`),
        mine.length ? h('button.btn.ghost.small.danger', { type: 'button', onclick: () => {
          if (!armed) { this.confirmDelete = 'bulk'; this.render(); return; }
          const ids = new Set(mine.map((x) => x.id));
          this.items = this.items.filter((x) => !ids.has(x.id));
          this.selected.clear();
          this.confirmDelete = null;
          this.persist();
          this.actions.toast(`Deleted ${ids.size} presets.`);
          this.render();
        } }, armed ? `Click again to delete ${mine.length}` : `Delete ${mine.length}`) : null),
      mine.length ? h('div.row', {}, moveIn, h('button.btn.ghost.small', { type: 'button', onclick: move }, 'Move')) : null,
      sel.length !== mine.length ? h('p.hint', {}, 'Built-in presets can be exported but not deleted or moved.') : null);
  }

  /* ------------------------------------------------------------- actions */

  load(x) {
    this.activeId = x.id;
    this.openMenu = null;
    this.actions.loadPreset(clean(x.preset));
    this.render();
  }

  /** Render presets to videos, in list order, as one zip (see renderBatch in main.js). */
  renderItems(items) {
    this.openMenu = null;
    const order = this.visible().map((x) => x.id);
    const sorted = [...items].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    this.actions.renderVideos?.(sorted.map((x) => ({ name: x.name, preset: clean(x.preset) })));
    this.render();
  }

  duplicate(x) {
    const taken = new Set(this.items.map((i) => i.name));
    const item = makeItem(x.preset, { name: uniqueName(`${x.name} copy`, taken), collection: x.builtin ? '' : x.collection });
    this.items.unshift(item);
    this.openMenu = null;
    if (this.persist()) this.actions.toast(`Saved “${item.name}” to your presets.`);
    this.render();
  }

  /** Save a preset made elsewhere (the Daily tab) into my presets. */
  addPreset(preset, { name, collection = '' }) {
    const taken = new Set(this.items.map((i) => i.name));
    const item = makeItem(normalize(clean(preset)), { name: uniqueName(name || preset.name || 'My preset', taken), collection });
    this.items.unshift(item);
    if (this.persist()) this.actions.toast(`Saved “${item.name}” to your presets${collection ? ` (${collection})` : ''}.`);
    this.render();
  }

  saveCurrent() {
    const snap = this.actions.snapshot();
    const name = this.saveName.value.trim() || snap.name || 'My preset';
    const collection = this.saveColl.value.trim();
    const existing = this.items.find((i) => i.name === name);
    if (existing) {
      // Same name: update it in place (the user typed that name on purpose).
      Object.assign(existing, { preset: { ...clean(snap), name }, collection: collection || existing.collection, savedAt: Date.now() });
    } else {
      this.items.unshift(makeItem(snap, { name, collection }));
    }
    if (this.persist()) this.actions.toast(existing ? `Updated “${name}”.` : `Saved “${name}”.`);
    this.saveName.value = '';
    this.filter.source = this.filter.source === 'builtin' ? 'all' : this.filter.source;
    this.render();
  }

  renderPacks() {
    this.packTitle.textContent = `Lesson packs (${this.packs.length})`;
    this.packList.replaceChildren(...this.packs.map((p) => h('div.lib-pack', {},
      h('div.lib-pack-text', {}, h('strong', {}, p.name), h('span.hint', {}, `${p.about} · ${p.count} lessons`)),
      h('button.btn.ghost.small', { type: 'button', title: 'Load its first lesson to watch it now', onclick: () => this.tryPack(p) }, '▶'),
      h('button.btn.small', { type: 'button', onclick: () => this.addPacks([p]) }, '＋ Add'))));
  }

  /** Copy lesson packs into my presets, each in its own collection (once per preset). */
  async addPacks(packs) {
    if (!packs.length) { this.actions.toast(this.catalogState === 'failed' ? 'The lesson packs could not be loaded (offline?).' : 'The lesson packs are still loading…'); return; }
    let added = [];
    try {
      for (const pack of packs) {
        const coll = pack.collection;
        const have = new Set(this.items.filter((i) => i.collection === coll).map((i) => i.name));
        const list = await pack.load();
        added = added.concat(list.filter((p) => !have.has(p.name)).map((p) => makeItem(normalize(p), { name: p.name, collection: coll })));
      }
    } catch (err) {
      this.actions.toast(`Could not load the lessons (${err.message}).`);
      return;
    }
    if (!added.length) { this.actions.toast(packs.length === 1 ? 'This pack is already in your presets.' : 'All lesson packs are already in your presets.'); return; }
    this.items = [...added, ...this.items];
    this.persist();
    Object.assign(this.filter, { source: 'mine', q: '', collection: packs.length === 1 ? packs[0].collection : '*', sort: 'recent' });
    this.search.value = '';
    this.render();
    this.actions.toast(`Added ${added.length} lesson${added.length === 1 ? '' : 's'}.`);
  }

  /** Watch the first lesson of a pack without adding anything. */
  async tryPack(pack) {
    try { const [first] = await pack.load(); if (first) this.actions.loadPreset(first); } catch (err) { this.actions.toast(`Could not load the lessons (${err.message}).`); }
  }

  async importFiles(files) {
    this.actions.toast(`Reading ${files.length} file${files.length === 1 ? '' : 's'}…`);
    const { found, problems } = await readPresetFiles(files);
    const taken = new Set(this.items.map((i) => i.name));
    let renamed = 0;
    const added = [];
    for (const f of found) {
      const original = f.preset.name || 'Untitled';
      const name = uniqueName(original, taken);
      if (name !== original) renamed++;
      taken.add(name);
      added.push(makeItem(f.preset, { name, collection: f.collection }));
    }
    this.items = [...added, ...this.items];
    const saved = added.length ? this.persist() : true;

    // One preset from one file: load it straight away, as before.
    if (added.length === 1 && files.length === 1) this.load(added[0]);

    this.report.hidden = false;
    this.report.replaceChildren(...[
      h('div.row', {},
        h('strong', {}, added.length ? `Imported ${added.length} preset${added.length === 1 ? '' : 's'}` : 'Nothing imported'),
        h('button.link', { type: 'button', onclick: () => { this.report.hidden = true; } }, 'Close')),
      renamed ? h('p.hint', {}, `${renamed} renamed because a preset with the same name already existed.`) : null,
      !saved ? h('p.hint', {}, 'They are in the list for now but could not be saved in this browser (storage full or blocked).') : null,
      problems.length ? h('ul.lib-problems', {}, problems.slice(0, 20).map((p) => h('li', {}, h('strong', { dir: 'auto' }, p.file), `: ${p.reason}`)),
        problems.length > 20 ? h('li', {}, `…and ${problems.length - 20} more`) : null) : null].filter(Boolean));
    if (added.length && !(added.length === 1 && files.length === 1)) {
      Object.assign(this.filter, { source: 'mine', q: '', collection: '*', sort: 'recent' });
      this.search.value = '';
      this.sortSel.value = 'recent';
    }
    this.limit = PAGE;
    this.render();
  }

  exportCurrent() {
    const snap = this.actions.snapshot();
    this.actions.download(new Blob([singleFile(snap)], { type: 'application/json' }), `${safeName(snap.name)}.mmv.json`);
  }

  exportItems(items) {
    if (items.length === 1) {
      this.actions.download(new Blob([singleFile(items[0].preset)], { type: 'application/json' }), `${safeName(items[0].name)}.mmv.json`);
    } else {
      this.actions.download(new Blob([bundleFile(items.map((x) => ({ ...x.preset, name: x.name, $collection: x.collection || undefined })))], { type: 'application/json' }),
        `${items.length} presets.mmv.json`);
    }
    this.openMenu = null;
    this.render();
  }

  exportBackup() {
    if (!this.items.length) return this.actions.toast('You have no saved presets to back up yet.');
    const day = new Date().toISOString().slice(0, 10);
    this.actions.download(new Blob([bundleFile(this.items.map((x) => ({ ...x.preset, name: x.name, $collection: x.collection || undefined })))], { type: 'application/json' }),
      `Math-Melody presets backup ${day}.mmv.json`);
  }
}
