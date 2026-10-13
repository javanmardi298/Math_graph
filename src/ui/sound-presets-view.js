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
 *
 * Every sound also knows its register (the notes it sounds best in, e.g. C3–C5) and a
 * melody: a shape whose lowest and highest points play exactly the lowest and highest note
 * of that register. “Also set its melody curve” (2D mode) replaces the first layer's formula,
 * the view, tempo, speed and length with that pairing, so the sound is heard at its best.
 */
import { store, defaultState, mergeDeep } from '../state.js';
import { noteName } from '../math/music.js';
import { loadSounds } from '../presets.js';
import { h, group, refreshAll } from './controls.js';

const INST_KEY = 'mmv.soundpreset.instrument';
const MELODY_KEY = 'mmv.soundpreset.melody';
const readFlag = (key) => { try { return localStorage.getItem(key) !== '0'; } catch { return true; } };
const writeFlag = (key, on) => { try { localStorage.setItem(key, on ? '1' : '0'); } catch { /* storage blocked */ } };
const range = (p) => `${noteName(p.register[0])}–${noteName(p.register[1])}`;

export class SoundPresetView {
  /** @param {{toast:(m:string)=>void, loadInstrument:(id:string)=>void}} actions */
  constructor(actions) {
    this.actions = actions;
    this.presets = [];
    this.groups = [];
    this.filter = { q: '', group: '*' };
    this.current = null;
    this.undo = [];
    this.shapes = {};
    this.withInstrument = readFlag(INST_KEY);
    this.withMelody = readFlag(MELODY_KEY);
    this.list = h('div.snd-list', { role: 'listbox', 'aria-label': 'Sound presets' });
    this.now = h('span.snd-now', {}, 'Loading…');
    this.groupSel = h('select.snd-group', { 'aria-label': 'Group', onchange: () => { this.filter.group = this.groupSel.value; this.render(); } });
    this.search = h('input.snd-search', { type: 'search', placeholder: 'Search: raga, lo-fi, 432, phaser…', 'aria-label': 'Search sound presets' });
    this.search.addEventListener('input', () => { this.filter.q = this.search.value; this.render(); });
    const inst = h('input', { type: 'checkbox', role: 'switch', id: 'snd-inst' });
    inst.checked = this.withInstrument;
    inst.addEventListener('change', () => { this.withInstrument = inst.checked; writeFlag(INST_KEY, inst.checked); });
    const mel = h('input', { type: 'checkbox', role: 'switch', id: 'snd-mel' });
    mel.checked = this.withMelody;
    mel.addEventListener('change', () => { this.withMelody = mel.checked; writeFlag(MELODY_KEY, mel.checked); });
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
      h('div.ctl.ctl-toggle', {}, h('label', { for: 'snd-mel', title: 'In 2D mode: the first layer becomes the sound’s own shape, framed and tuned so it plays the sound’s best register' }, 'Also set its melody curve (2D)'), mel),
    ], { hint: 'One click changes the whole sound: scale, key, tuning, filter, drive, modulation, drone, delay and reverb. Press play and step through them with ◀ ▶. Everything stays editable below.' });
    this.el.classList.add('snd-presets');
    this.load();
  }

  async load() {
    try {
      const data = await loadSounds();
      this.presets = data.presets;
      this.shapes = data.shapes || {};
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
      && (!q || q.split(/\s+/).every((w) => `${p.name} ${p.group} ${p.about} ${p.instrument} ${p.audio.scale} ${p.audio.mod.type} ${p.audio.tuning} ${p.register ? range(p) : ''} ${p.melody?.shape || ''}`.toLowerCase().includes(w))));
  }

  render() {
    const list = this.visible();
    let last = '';
    const rows = [];
    for (const p of list) {
      if (this.filter.group === '*' && p.group !== last) { rows.push(h('div.snd-head', {}, p.group)); last = p.group; }
      const row = h('button.snd-row', { type: 'button', role: 'option', 'aria-selected': String(this.current === p.name), title: p.about, onclick: () => this.apply(p) },
        h('span.snd-name', {}, p.name, p.register ? h('span.snd-range', { title: 'Best register: the notes this sound plays in' }, range(p)) : null), h('span.snd-about', {}, p.about));
      rows.push(row);
    }
    if (!rows.length && this.presets.length) rows.push(h('p.hint', {}, 'No sound preset matches.'));
    this.list.replaceChildren(...rows);
    if (this.presets.length) this.now.textContent = this.current ? `Now: ${this.current}` : 'Pick a sound, then press play.';
    this.undoBtn.disabled = !this.undo.length;
  }

  /** Remember the sound as it is now (for Undo). */
  remember() {
    const st = store.state;
    this.undo.push({
      audio: structuredClone(st.audio), waves: st.layers.map((l) => l.wave), circle: st.circle.sound.instrument, current: this.current,
      layer0: st.layers[0] ? structuredClone(st.layers[0]) : null, view: structuredClone(st.view), rhythm: structuredClone(st.rhythm),
      transport: { bpm: st.transport.bpm, speed: st.transport.speed, duration: st.transport.duration },
    });
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
    if (this.withMelody && p.melody && store.state.mode === '2d') this.applyMelody(p);
    this.current = p.name;
    this.render();
    this.list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }

  /** The sound's own shape as the first layer, framed and fitted to its register (2D). */
  applyMelody(p) {
    const m = p.melody, sh = this.shapes[m.shape], st = store.state, layer = st.layers[0];
    if (!sh || !layer) return;
    layer.type = sh.type;
    layer.exprs = { ...layer.exprs, ...sh.exprs };
    layer.range = { ...sh.range };
    layer.samples = sh.samples;
    layer.caption = '';
    st.view = { ...m.view };
    Object.assign(st.transport, { bpm: m.bpm, speed: m.speed, duration: m.duration });
    Object.assign(st.rhythm, { enabled: false, ...m.rhythm });
    st.audio.noteLow = m.noteLow;
    st.audio.noteHigh = m.noteHigh;
    this.keep = true;
    try { store.emit('*'); } finally { this.keep = false; } // everything changed: rebuild the curve, the grid, the controls
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
    const st = store.state;
    if (u.layer0 && st.layers[0]) {
      Object.assign(st.layers[0], u.layer0, { id: st.layers[0].id });
      st.view = u.view; st.rhythm = u.rhythm; Object.assign(st.transport, u.transport);
      this.keep = true;
      try { store.emit('*'); } finally { this.keep = false; }
    }
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
    if (this.keep) return; // a melody applied by this view refreshes the panels itself
    this.current = null;
    this.render();
  }
}
