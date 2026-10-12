/**
 * Sound presets picker (top of the Sound tab): 185 ready-made sound settings in groups
 * (lo-fi, ambient, psychedelic, ragas, maqamat, dastgah, gamelan, EDM …). A sound
 * preset replaces the sound settings only (scale, key, tuning, filter, effects, drone),
 * keeps the master volume and the drawing, and can also set the instrument.
 *
 *   ◀ ▶  step through the list (quick auditioning while playing)
 *   🎲   a random one
 *   Default  the app's standard sound
 *   Undo     back to the sound before the last change (several steps)
 */
import { store, defaultState, mergeDeep } from '../state.js';
import { loadSounds } from '../presets.js';
import { h, group, refreshAll } from './controls.js';

const INST_KEY = 'mmv.soundpreset.instrument';
const readFlag = () => { try { return localStorage.getItem(INST_KEY) !== '0'; } catch { return true; } };
const writeFlag = (on) => { try { localStorage.setItem(INST_KEY, on ? '1' : '0'); } catch { /* storage blocked */ } };

export class SoundPresetView {
  /** @param {{toast:(m:string)=>void, loadInstrument:(id:string)=>void}} actions */
  constructor(actions) {
    this.actions = actions;
    this.presets = [];
    this.groups = [];
    this.filter = { q: '', group: '*' };
    this.current = null;
    this.undo = [];
    this.withInstrument = readFlag();
    this.list = h('div.snd-list', { role: 'listbox', 'aria-label': 'Sound presets' });
    this.now = h('span.snd-now', {}, 'Loading…');
    this.groupSel = h('select.snd-group', { 'aria-label': 'Group', onchange: () => { this.filter.group = this.groupSel.value; this.render(); } });
    this.search = h('input.snd-search', { type: 'search', placeholder: 'Search: raga, lo-fi, 432, phaser…', 'aria-label': 'Search sound presets' });
    this.search.addEventListener('input', () => { this.filter.q = this.search.value; this.render(); });
    const inst = h('input', { type: 'checkbox', role: 'switch', id: 'snd-inst' });
    inst.checked = this.withInstrument;
    inst.addEventListener('change', () => { this.withInstrument = inst.checked; writeFlag(inst.checked); });
    const btn = (label, title, fn, cls = '.ghost') => h(`button.btn.small${cls}`, { type: 'button', title, onclick: fn }, label);
    this.undoBtn = btn('↶ Undo', 'Back to the sound before the last change', () => this.back());
    this.el = group('🎛 Sound presets', [
      h('div.snd-top', {}, this.now),
      h('div.snd-tools', {},
        btn('◀', 'Previous preset', () => this.step(-1)),
        btn('▶', 'Next preset', () => this.step(1)),
        btn('🎲', 'A random preset', () => this.random()),
        btn('↺ Default', 'The standard sound (keeps your volume and instruments)', () => this.reset()),
        this.undoBtn),
      h('div.snd-filters', {}, this.search, this.groupSel),
      this.list,
      h('div.ctl.ctl-toggle', {}, h('label', { for: 'snd-inst' }, 'Also change the instrument'), inst),
    ], { hint: 'One click changes the whole sound: scale, key, tuning, filter, drive, modulation, drone, delay and reverb. Press play and step through them with ◀ ▶. Everything stays editable below.' });
    this.el.classList.add('snd-presets');
    this.load();
  }

  async load() {
    try {
      const data = await loadSounds();
      this.presets = data.presets;
      this.groups = data.groups;
      this.groupSel.replaceChildren(h('option', { value: '*' }, `All groups (${this.presets.length})`),
        ...this.groups.map((g) => h('option', { value: g }, `${g} (${this.presets.filter((p) => p.group === g).length})`)));
      this.el.querySelector('summary').textContent = `🎛 Sound presets (${this.presets.length})`;
    } catch {
      this.now.textContent = 'Sound presets could not be loaded (offline?).';
    }
    this.render();
  }

  visible() {
    const q = this.filter.q.trim().toLowerCase();
    return this.presets.filter((p) => (this.filter.group === '*' || p.group === this.filter.group)
      && (!q || q.split(/\s+/).every((w) => `${p.name} ${p.group} ${p.about} ${p.instrument} ${p.audio.scale} ${p.audio.mod.type} ${p.audio.tuning}`.toLowerCase().includes(w))));
  }

  render() {
    const list = this.visible();
    let last = '';
    const rows = [];
    for (const p of list) {
      if (this.filter.group === '*' && p.group !== last) { rows.push(h('div.snd-head', {}, p.group)); last = p.group; }
      const row = h('button.snd-row', { type: 'button', role: 'option', 'aria-selected': String(this.current === p.name), title: p.about, onclick: () => this.apply(p) },
        h('span.snd-name', {}, p.name), h('span.snd-about', {}, p.about));
      rows.push(row);
    }
    if (!rows.length && this.presets.length) rows.push(h('p.hint', {}, 'No sound preset matches.'));
    this.list.replaceChildren(...rows);
    if (this.presets.length) this.now.textContent = this.current ? `Now: ${this.current}` : 'Pick a sound, then press play.';
    this.undoBtn.disabled = !this.undo.length;
  }

  /** Remember the sound as it is now (for Undo). */
  remember() {
    this.undo.push({ audio: structuredClone(store.state.audio), waves: store.state.layers.map((l) => l.wave), circle: store.state.circle.sound.instrument, current: this.current });
    if (this.undo.length > 30) this.undo.shift();
  }

  setAudio(audio) {
    const master = store.state.audio.master;
    store.state.audio = mergeDeep(defaultState().audio, structuredClone(audio));
    store.state.audio.master = master;
    store.emit('audio');
    refreshAll();
  }

  apply(p) {
    this.remember();
    this.setAudio(p.audio);
    if (this.withInstrument && p.instrument) this.actions.loadInstrument(p.instrument);
    this.current = p.name;
    this.render();
    this.list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }

  step(n) {
    const list = this.visible();
    if (!list.length) return;
    const i = list.findIndex((p) => p.name === this.current);
    this.apply(list[(i + n + list.length) % list.length]);
  }

  random() {
    const list = this.visible().filter((p) => p.name !== this.current);
    if (list.length) this.apply(list[Math.floor(Math.random() * list.length)]);
  }

  reset() {
    this.remember();
    this.setAudio(defaultState().audio);
    this.current = null;
    this.render();
    this.actions.toast('Standard sound restored (Undo brings yours back).');
  }

  back() {
    const u = this.undo.pop();
    if (!u) return;
    this.setAudio(u.audio);
    store.state.layers.forEach((l, i) => { if (u.waves[i]) l.wave = u.waves[i]; });
    store.state.circle.sound.instrument = u.circle;
    store.emit('layers');
    store.emit('circle');
    this.current = u.current;
    this.render();
  }

  /** A preset was loaded: the current sound is no longer a sound preset. */
  forget() {
    this.current = null;
    this.render();
  }
}
