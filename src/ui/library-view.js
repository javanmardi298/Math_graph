/**
 * Presets tab: one searchable list of built-in and saved presets, built to stay
 * usable with hundreds of entries: search, filters, collections, favourites,
 * sorting, multi-select with bulk export/move/delete, and import of many files
 * at once (.json single presets or bundles, .zip, drag & drop).
 *
 * No prompt()/confirm(): they don't work inside the claude.ai viewer, so renames,
 * moves and deletions are done inline (deletions need a second click).
 */
import { BUILTIN_PRESETS } from '../presets.js';
import {
  readLibrary, loadLibrary, saveLibrary, makeItem, uniqueName, describe, readPresetFiles,
  singleFile, bundleFile, clean, STORAGE_BUDGET,
} from '../library.js';
import { h } from './controls.js';

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
    this.builtins = BUILTIN_PRESETS.map((p) => ({ id: `b:${p.name}`, name: p.name, collection: 'Built-in', builtin: true, savedAt: 0, preset: p }));
    this.filter = { q: '', source: 'all', aspect: 'any', mode: 'any', collection: '*', sort: 'name' };
    this.selected = new Set();
    this.limit = PAGE;
    this.openMenu = null; // id of the row whose action menu is open
    this.editing = null; // { id, field: 'name' | 'collection' }
    this.confirmDelete = null; // id or 'bulk' armed for a second click
    this.activeId = null;
    this.build();
    this.render();
    loadLibrary().then(({ items, backend }) => {
      this.items = items;
      this.backend = backend;
      this.render();
      this.updateQuota();
    });
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
        const hay = `${x.name} ${x.collection} ${x.preset.youtube?.title || ''} ${(x.preset.layers || []).map((l) => Object.values(l.exprs || {}).join(' ')).join(' ')}`.toLowerCase();
        if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    if (f.sort === 'recent') list = list.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    else list = list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
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
      chip('aspect', '16:9', '16:9'), chip('aspect', '9:16', '9:16'), chip('mode', '2d', '2D'), chip('mode', '3d', '3D'));

    this.collSel = h('select.lib-select', { 'aria-label': 'Collection' });
    this.collSel.addEventListener('change', () => { f.collection = this.collSel.value; this.limit = PAGE; this.render(); });
    this.sortSel = h('select.lib-select', { 'aria-label': 'Sort' }, h('option', { value: 'name' }, 'Sort: A–Z'), h('option', { value: 'recent' }, 'Sort: newest'));
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
      h('div.lib-top', {}, this.search, this.chips, h('div.row', {}, this.collSel, this.sortSel)),
      this.report,
      this.bulk,
      this.list, this.more, this.count,
      h('details.group', { open: true }, h('summary', {}, 'Save current setup'),
        h('div.group-body', {}, this.saveName, h('div.row', {}, this.saveColl, save), this.collList)),
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
    if (f.collection !== '*' && f.collection !== 'Built-in' && !colls.includes(f.collection)) f.collection = '*';
    this.collSel.replaceChildren(h('option', { value: '*' }, 'All collections'), h('option', { value: 'Built-in' }, 'Built-in'),
      ...colls.map((c) => h('option', { value: c }, c)));
    this.collSel.value = f.collection;
    this.collList.replaceChildren(...colls.map((c) => h('option', { value: c })));
    this.search.placeholder = `Search ${this.all().length} presets (name, collection, formula)…`;

    const list = this.visible();
    const shown = list.slice(0, this.limit);
    this.list.replaceChildren(...(shown.length ? shown.map((x) => this.row(x)) : [h('p.hint.lib-empty', {}, this.items.length || f.source !== 'mine'
      ? 'No presets match. Clear the search or filters.'
      : 'You have no saved presets yet. Save the current setup below, or import preset files.')]));
    this.more.hidden = list.length <= this.limit;
    this.more.textContent = `Show ${Math.min(PAGE, list.length - this.limit)} more (${list.length - this.limit} hidden)`;
    this.count.textContent = `${list.length} of ${this.all().length} presets`;

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

  row(x) {
    const d = describe(x.preset);
    const sel = this.selected.has(x.id);
    const menuOpen = this.openMenu === x.id;
    const tags = [d.aspect, d.mode.toUpperCase(), `${d.layers} layer${d.layers === 1 ? '' : 's'}`,
      d.sequence && 'sequence', d.drums && 'drums', d.animated && 'animated', x.preset.youtube?.title && '▶ YT title', x.collection].filter(Boolean);

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
