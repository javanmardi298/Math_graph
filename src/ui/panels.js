/**
 * Builds the two side panels:
 *   left  — formula layers, live parameters a–d, formula cheatsheet
 *   right — inspector tabs: Look · FX · Sound · Camera · Presets · Export
 */
import { store, createLayer, LAYER_TYPES } from '../state.js';
import { SCALE_LABELS, NOTE_NAMES, noteName } from '../math/music.js';
import { compile, FUNCTIONS } from '../math/parser.js';
import { BUILTIN_PRESETS } from '../presets.js';
import { h, bindPath, bindObj, slider, color, select, toggle, segmented, number, group, disposeTree, refreshAll } from './controls.js';

const MAX_LAYERS = 4;
const USER_PRESETS_KEY = 'mmv.presets.v1';

const WAVES = [['sine', '∿', 'Sine'], ['triangle', '⋀', 'Triangle'], ['square', '⊓', 'Square'], ['sawtooth', '⩘', 'Sawtooth']];

const SNIPPETS = ['sin()', 'cos()', 'exp()', 'mod(x, 1)', 'abs()', 'floor()', 'sqrt()', 'saw()', 'tri()', 'square()', 'noise()', 'pi', 't', 'a'];

/* ---------------------------------------------------------- user presets */

function readUserPresets() {
  try { return JSON.parse(localStorage.getItem(USER_PRESETS_KEY)) || []; } catch { return []; }
}
function writeUserPresets(list) {
  try { localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(list)); return true; } catch { return false; }
}

/* ------------------------------------------------------------ the panels */

export class Panels {
  /**
   * @param {object} actions callbacks provided by main.js
   */
  constructor(actions) {
    this.actions = actions;
    this.layerList = document.getElementById('layer-list');
    this.errorEls = new Map();
    this.lastFormulaInput = null;
    this.buildLeft();
    this.buildRight();
  }

  /* -------------------------------------------------------------- left */

  buildLeft() {
    document.getElementById('add-layer').addEventListener('click', () => {
      const layers = store.state.layers;
      if (layers.length >= MAX_LAYERS) return this.actions.toast(`Up to ${MAX_LAYERS} layers keep the mix clean.`);
      layers.push(createLayer({ exprs: { y: `${(layers.length % 2 ? -1 : 1) * 2} cos(${layers.length + 1}x)` }, octave: 0 }));
      store.emit('layers');
    });

    const params = document.getElementById('params');
    for (const p of ['a', 'b', 'c', 'd']) {
      params.append(slider(p, bindPath(`params.${p}`), { min: -5, max: 5, step: 0.01 }));
    }

    const chips = document.getElementById('snippets');
    for (const s of SNIPPETS) {
      chips.append(h('button.chip', {
        type: 'button',
        onmousedown: (e) => e.preventDefault(), // keep focus in the formula field
        onclick: () => this.insertSnippet(s),
      }, s));
    }
    const fnList = document.getElementById('fn-list');
    fnList.textContent = Object.keys(FUNCTIONS).join('  ');
    this.renderLayers();
  }

  insertSnippet(text) {
    const input = this.lastFormulaInput;
    if (!input || !document.body.contains(input)) return this.actions.toast('Click into a formula first, then pick a snippet.');
    const { selectionStart: a, selectionEnd: b, value } = input;
    const sel = value.slice(a, b);
    const paren = text.indexOf('()');
    const insert = paren >= 0 ? text.slice(0, paren + 1) + (sel || '') + ')' : text;
    input.value = value.slice(0, a) + insert + value.slice(b);
    const caret = paren >= 0 && !sel ? a + paren + 1 : a + insert.length;
    input.focus();
    input.setSelectionRange(caret, caret);
    input.dispatchEvent(new Event('input'));
  }

  /** Rebuild all layer cards (on add/remove/type change/preset load). */
  renderLayers() {
    disposeTree(this.layerList);
    this.layerList.replaceChildren();
    this.errorEls.clear();
    const layers = store.state.layers;
    layers.forEach((l, i) => this.layerList.append(this.layerCard(l, i, layers.length)));
    document.getElementById('add-layer').disabled = layers.length >= MAX_LAYERS;
  }

  layerCard(l, index, total) {
    const ev = `layers.${l.id}`;
    const card = h('article.layer', { style: `--layer:${l.color}`, dataset: { id: l.id } });
    const emitLook = () => store.emit(`${ev}.look`);

    // Header: colour, name, visibility, mute/solo, menu
    const colorIn = h('input.swatch', { type: 'color', value: l.color, 'aria-label': 'Layer colour' });
    colorIn.addEventListener('input', () => { l.color = colorIn.value; card.style.setProperty('--layer', l.color); emitLook(); });
    const nameIn = h('input.layer-name', { value: l.name, 'aria-label': 'Layer name', spellcheck: 'false' });
    nameIn.addEventListener('change', () => { l.name = nameIn.value || `Layer ${index + 1}`; store.emit(`${ev}.name`); });
    const pill = (txt, key, title) => {
      const b = h('button.pill', { type: 'button', title, 'aria-pressed': String(!!l[key]) }, txt);
      b.addEventListener('click', () => { l[key] = !l[key]; b.setAttribute('aria-pressed', String(l[key])); store.emit(`${ev}.${key}`); });
      return b;
    };
    const vis = h('button.icon-btn', { type: 'button', title: l.enabled ? 'Hide layer' : 'Show layer', 'aria-pressed': String(l.enabled) }, l.enabled ? '◉' : '○');
    vis.addEventListener('click', () => { l.enabled = !l.enabled; store.emit('layers'); });
    const menu = h('div.layer-menu', {},
      h('button.icon-btn', { type: 'button', title: 'Move up', disabled: index === 0, onclick: () => this.moveLayer(index, -1) }, '↑'),
      h('button.icon-btn', { type: 'button', title: 'Move down', disabled: index === total - 1, onclick: () => this.moveLayer(index, 1) }, '↓'),
      h('button.icon-btn', { type: 'button', title: 'Duplicate', disabled: total >= MAX_LAYERS, onclick: () => this.duplicateLayer(index) }, '⧉'),
      h('button.icon-btn.danger', { type: 'button', title: 'Delete layer', disabled: total <= 1, onclick: () => this.removeLayer(index) }, '✕'),
    );
    card.append(h('header.layer-head', {}, colorIn, nameIn, pill('M', 'mute', 'Mute'), pill('S', 'solo', 'Solo'), vis, menu));
    if (!l.enabled) card.classList.add('is-hidden');

    // Type
    card.append(select('Type', {
      get: () => l.type,
      set: (v) => { l.type = v; store.emit('layers'); },
    }, Object.fromEntries(Object.entries(LAYER_TYPES).map(([k, t]) => [k, t.label]))));

    // Formulas
    for (const [key, label] of LAYER_TYPES[l.type].fields) {
      const id = `f-${l.id}-${key}`;
      const input = h('input.formula', { id, value: l.exprs[key], spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off' });
      const err = h('p.formula-error', { role: 'status' });
      let timer;
      input.addEventListener('focus', () => { this.lastFormulaInput = input; });
      input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => { l.exprs[key] = input.value; store.emit(`${ev}.exprs`); }, 120);
      });
      this.errorEls.set(`${l.id}.${key}`, { input, err });
      card.append(h('div.formula-row', {}, h('label.formula-label', { for: id }, label), input), err);
    }
    if (l.type === 'parametric' || l.type === 'polar') {
      const v = l.type === 'polar' ? 'θ' : 's';
      card.append(h('div.range-row', {},
        this.rangeInput(`${v} from`, l, 'min'),
        this.rangeInput('to', l, 'max')));
    }
    if (l.type === 'surface') card.append(h('p.hint', {}, 'Surfaces render in 3D. The playhead rides the path y(x) across the surface; its height is the pitch.'));

    // Look
    card.append(group('Look', [
      select('Colour mode', bindObj(l, 'colorMode', `${ev}.look`), { solid: 'Solid', gradient: 'Gradient', rainbow: 'Rainbow', pitch: 'By pitch' }),
      color('Second colour', bindObj(l, 'color2', `${ev}.look`)),
      select('Line style', { get: () => l.style, set: (v) => { l.style = v; store.emit(`${ev}.style`); } }, { line: 'Solid line', dashed: 'Dashed', dots: 'Dots' }),
      slider('Thickness', { get: () => l.width, set: (v) => { l.width = v; store.emit(`${ev}.width`); } }, { min: 1, max: 14, step: 0.5, unit: 'px' }),
      slider('Detail', bindObj(l, 'samples', `${ev}.exprs`), l.type === 'surface' ? { min: 16, max: 128, step: 1, fmt: (v) => `${v}²` } : { min: 100, max: 3000, step: 50, fmt: (v) => `${v} pts` }),
    ], { open: false }));

    // Sound
    const vol = slider('Volume', bindObj(l, 'volume', `${ev}.sound`), { min: 0, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` });
    card.append(group('Sound', [
      h('div.ctl', {}, h('span.ctl-label', {}, 'Wave'), segmented(bindObj(l, 'wave', `${ev}.wave`), WAVES, { label: 'Waveform', cls: 'seg-wave' })),
      vol,
      slider('Octave', bindObj(l, 'octave', `${ev}.sound`), { min: -3, max: 3, step: 1, fmt: (v) => (v > 0 ? `+${v}` : `${v}`) }),
      slider('Pan', bindObj(l, 'pan', `${ev}.sound`), { min: -1, max: 1, step: 0.01, fmt: (v) => (Math.abs(v) < 0.01 ? 'C' : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`) }),
      select('Z controls', bindObj(l, 'zMap', `${ev}.sound`), { volume: 'Volume', pan: 'Stereo pan', none: 'Nothing' }),
    ], { open: false }));

    this.showErrors(l.id, this.actions.errorsFor(l.id));
    return card;
  }

  rangeInput(label, layer, key) {
    const id = `r-${layer.id}-${key}`;
    const fmtVal = (v) => {
      const k = v / Math.PI;
      return Math.abs(k - Math.round(k * 4) / 4) < 1e-9 && v !== 0 ? `${+(Math.round(k * 4) / 4).toFixed(2)}pi` : `${+v.toFixed(3)}`;
    };
    const input = h('input.formula.range', { id, value: fmtVal(layer.range[key]), spellcheck: 'false' });
    input.addEventListener('change', () => {
      try {
        const v = compile(input.value, []).fn({});
        if (!Number.isFinite(v)) throw new Error();
        layer.range[key] = v;
        input.classList.remove('invalid');
        store.emit(`layers.${layer.id}.exprs`);
      } catch {
        input.classList.add('invalid');
      }
    });
    return h('label.range-field', { for: id }, h('span', {}, label), input);
  }

  showErrors(id, errors = {}) {
    for (const [k, { input, err }] of this.errorEls) {
      if (!k.startsWith(`${id}.`)) continue;
      const key = k.slice(id.length + 1);
      const msg = errors[key];
      input.classList.toggle('invalid', !!msg);
      input.setAttribute('aria-invalid', String(!!msg));
      err.textContent = msg ? `⚠ ${msg}` : '';
    }
  }

  moveLayer(i, dir) {
    const L = store.state.layers;
    [L[i], L[i + dir]] = [L[i + dir], L[i]];
    store.emit('layers');
  }
  duplicateLayer(i) {
    const L = store.state.layers;
    const src = structuredClone(L[i]);
    L.splice(i + 1, 0, createLayer({ ...src, id: undefined, name: `${src.name} copy`, exprs: { ...src.exprs } }));
    store.emit('layers');
  }
  removeLayer(i) {
    store.state.layers.splice(i, 1);
    store.emit('layers');
  }

  /* ------------------------------------------------------------- right */

  buildRight() {
    const tabs = [
      ['look', 'Look', this.lookTab()],
      ['fx', 'FX', this.fxTab()],
      ['sound', 'Sound', this.soundTab()],
      ['camera', 'Camera', this.cameraTab()],
      ['presets', 'Presets', this.presetsTab()],
      ['export', 'Export', this.exportTab()],
    ];
    const bar = document.getElementById('tabbar');
    const body = document.getElementById('tabbody');
    let saved = 'look';
    try { saved = localStorage.getItem('mmv.tab') || 'look'; } catch { /* storage blocked */ }
    const show = (key) => {
      for (const [k, , el] of tabs) el.hidden = k !== key;
      bar.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === key)));
      try { localStorage.setItem('mmv.tab', key); } catch { /* ignore */ }
    };
    for (const [key, label, el] of tabs) {
      bar.append(h('button', { type: 'button', role: 'tab', dataset: { tab: key }, onclick: () => show(key) }, label));
      el.setAttribute('role', 'tabpanel');
      body.append(el);
    }
    this.showTab = show;
    show(tabs.some(([k]) => k === saved) ? saved : 'look');
  }

  lookTab() {
    const p = (x) => bindPath(x);
    const shapes = [['circle', '●', 'Circle'], ['square', '■', 'Square'], ['diamond', '◆', 'Diamond'], ['star', '★', 'Star'], ['ring', '◯', 'Ring'], ['image', 'Img', 'Custom image']];
    const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
    file.addEventListener('change', () => {
      const f = file.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => { store.set('visual.marker.image', r.result); store.set('visual.marker.shape', 'image'); };
      r.readAsDataURL(f);
      file.value = '';
    });
    return h('section.tab', {},
      group('Graph window', [
        h('div.grid2', {},
          number('x min', p('view.xMin'), { step: 0.5 }), number('x max', p('view.xMax'), { step: 0.5 }),
          number('y min', p('view.yMin'), { step: 0.5 }), number('y max', p('view.yMax'), { step: 0.5 })),
        h('div.ctl', {}, h('span.ctl-label', {}, 'Drawing'), segmented(p('visual.drawMode'), [['trace', 'Trace', 'Draw the curve as the playhead moves'], ['ghost', 'Ghost', 'Faint full curve, bright trace'], ['full', 'Full', 'Whole curve always visible']], { label: 'Drawing mode' })),
        select('Frame', p('visual.aspect'), { fill: 'Fill window', '16:9': '16:9 · YouTube', '9:16': '9:16 · Shorts / Reels', '1:1': '1:1 · Square', '4:5': '4:5 · Portrait post' }),
      ], { hint: 'x is time, y is pitch. In 3D, z sets volume or stereo pan.' }),
      group('Colours', [
        h('div.palettes', {}, PALETTES.map((pal) => h('button.palette', {
          type: 'button', title: pal.name, style: `--a:${pal.background};--b:${pal.layers[0]};--c:${pal.layers[1]}`,
          onclick: () => this.actions.applyPalette(pal),
        }, h('span', {}), pal.name))),
        color('Background', p('visual.background')),
        color('Grid', p('visual.gridColor')),
        color('Axes & labels', p('visual.axesColor')),
        toggle('Show grid', p('visual.showGrid')),
        toggle('Show axes', p('visual.showAxes')),
        toggle('Tick labels', p('visual.showLabels')),
      ]),
      group('Playhead', [
        h('div.ctl', {}, h('span.ctl-label', {}, 'Shape'), segmented({
          get: () => store.get('visual.marker.shape'),
          set: (v) => (v === 'image' && !store.get('visual.marker.image') ? file.click() : store.set('visual.marker.shape', v)),
        }, shapes, { label: 'Marker shape', cls: 'seg-shapes' })),
        h('button.btn.small', { type: 'button', onclick: () => file.click() }, 'Upload marker image…'), file,
        slider('Size', p('visual.marker.size'), { min: 8, max: 90, step: 1, unit: 'px' }),
        slider('Smoothing', p('visual.marker.smoothing'), { min: 0, max: 0.9, step: 0.01, fmt: (v) => (v === 0 ? 'Off' : `${Math.round(v * 100)}%`) }),
        toggle('Time cursor line', p('visual.marker.cursorLine')),
      ]),
      group('Overlay', [
        toggle('Title & formula caption', p('visual.caption')),
        select('Audio analyzer', p('visual.analyzer'), { spectrum: 'Spectrum bars', wave: 'Waveform', off: 'Hidden' }),
      ], { hint: 'The overlay is burned into recorded videos too.' }),
    );
  }

  fxTab() {
    const p = bindPath;
    return h('section.tab', {},
      group('Neon glow (bloom)', [
        toggle('Enabled', p('visual.bloom.enabled')),
        slider('Strength', p('visual.bloom.strength'), { min: 0, max: 3, step: 0.01 }),
        slider('Radius', p('visual.bloom.radius'), { min: 0, max: 1.2, step: 0.01 }),
        slider('Threshold', p('visual.bloom.threshold'), { min: 0, max: 1, step: 0.01 }),
      ]),
      group('Particle trail', [
        toggle('Enabled', p('visual.trail.enabled')),
        slider('Length', p('visual.trail.count'), { min: 20, max: 400, step: 1 }),
        slider('Particle size', p('visual.trail.size'), { min: 1, max: 20, step: 0.5, unit: 'px' }),
      ]),
      group('Motion blur', [
        toggle('Enabled', p('visual.motionBlur.enabled')),
        slider('Amount', p('visual.motionBlur.amount'), { min: 0, max: 1, step: 0.01 }),
      ]),
      group('Fog · 3D', [
        toggle('Enabled', p('visual.fog.enabled')),
        slider('Density', p('visual.fog.density'), { min: 0.005, max: 0.12, step: 0.001 }),
      ]),
      group('Depth of field · 3D', [
        toggle('Enabled', p('visual.dof.enabled')),
        slider('Focus offset', p('visual.dof.focus'), { min: 4, max: 28, step: 0.1 }),
        slider('Blur', p('visual.dof.aperture'), { min: 0, max: 2, step: 0.01 }),
      ], { hint: 'Auto-focuses on the playhead.' }),
    );
  }

  soundTab() {
    const p = bindPath;
    const noteFmt = (v) => `${noteName(v)} (${v})`;
    return h('section.tab', {},
      group('Output', [
        slider('Master volume', p('audio.master'), { min: 0, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` }),
      ]),
      group('Pitch mapping', [
        slider('Lowest note (y min)', p('audio.noteLow'), { min: 21, max: 96, step: 1, fmt: noteFmt }),
        slider('Highest note (y max)', p('audio.noteHigh'), { min: 24, max: 108, step: 1, fmt: noteFmt }),
        select('Scale', p('audio.scale'), SCALE_LABELS),
        select('Key', p('audio.root'), NOTE_NAMES.map((n, i) => [i, n])),
        slider('Glide', p('audio.glide'), { min: 0, max: 400, step: 1, unit: ' ms' }),
        h('div.ctl', {}, h('span.ctl-label', {}, 'Articulation'), segmented(p('audio.articulation'), [['legato', 'Legato', 'Continuous tone'], ['pluck', 'Pluck', 'New attack on every note change']], { label: 'Articulation' })),
      ], { hint: 'Pick a scale so any curve stays in key. Continuous = pure glissando.' }),
      group('Filter', [
        select('Type', p('audio.filter.type'), { lowpass: 'Low-pass', highpass: 'High-pass', bandpass: 'Band-pass', notch: 'Notch' }),
        slider('Cutoff', {
          get: () => Math.log10(store.get('audio.filter.cutoff')),
          set: (v) => store.set('audio.filter.cutoff', Math.round(10 ** v)),
        }, { min: 1.3, max: 4.3, step: 0.001, fmt: (v) => { const hz = 10 ** v; return hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${Math.round(hz)} Hz`; } }),
        slider('Resonance', p('audio.filter.q'), { min: 0.1, max: 18, step: 0.1 }),
      ]),
      group('Distortion', [slider('Drive', p('audio.distortion'), { min: 0, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` })]),
      group('Delay', [
        slider('Time', p('audio.delay.time'), { min: 0.02, max: 1.5, step: 0.005, unit: ' s' }),
        slider('Feedback', p('audio.delay.feedback'), { min: 0, max: 0.9, step: 0.01 }),
        slider('Mix', p('audio.delay.mix'), { min: 0, max: 1, step: 0.01 }),
      ]),
      group('Reverb', [
        slider('Decay', p('audio.reverb.decay'), { min: 0.3, max: 8, step: 0.1, unit: ' s' }),
        slider('Mix', p('audio.reverb.mix'), { min: 0, max: 1, step: 0.01 }),
      ]),
    );
  }

  cameraTab() {
    const p = bindPath;
    return h('section.tab', {},
      group('Cinematic camera', [
        toggle('Auto-rotate', p('camera.autoRotate')),
        slider('Rotation speed', p('camera.rotateSpeed'), { min: -6, max: 6, step: 0.05 }),
        toggle('Follow the playhead', p('camera.follow')),
        slider('Field of view', p('camera.fov'), { min: 20, max: 100, step: 1, unit: '°' }),
        h('button.btn.small', { type: 'button', onclick: () => this.actions.resetCamera() }, 'Reset camera'),
      ], { hint: 'Drag to orbit · right-drag or two fingers to pan · scroll to zoom. In 2D, drag pans and scroll zooms.' }),
    );
  }

  presetsTab() {
    const list = h('div.preset-grid');
    for (const pr of BUILTIN_PRESETS) {
      list.append(h('button.preset', { type: 'button', onclick: () => this.actions.loadPreset(pr) },
        h('span.preset-dots', {}, (pr.layers || []).map((l) => h('i', { style: `background:${l.color || '#22e4ff'}` }))),
        h('strong', {}, pr.name),
        h('span.badge', {}, (pr.mode || '2d').toUpperCase())));
    }
    const mine = h('div.my-presets');
    const nameIn = h('input#preset-name', { placeholder: 'Preset name', 'aria-label': 'Preset name' });
    const renderMine = () => {
      const items = readUserPresets();
      mine.replaceChildren(...(items.length ? items.map((pr, i) => h('div.my-preset', {},
        h('button.link', { type: 'button', onclick: () => this.actions.loadPreset(pr) }, pr.name),
        h('button.icon-btn.danger', { type: 'button', title: `Delete ${pr.name}`, onclick: () => { const all = readUserPresets(); all.splice(i, 1); writeUserPresets(all); renderMine(); } }, '✕')))
        : [h('p.hint', {}, 'Nothing saved yet. Name your current setup and press Save.')]));
    };
    renderMine();
    const importIn = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    importIn.addEventListener('change', async () => {
      const f = importIn.files[0];
      importIn.value = '';
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        this.actions.loadPreset(data);
        this.actions.toast(`Loaded “${data.name || f.name}”.`);
      } catch {
        this.actions.toast('That file is not a Math-Melody preset (invalid JSON).');
      }
    });
    return h('section.tab', {},
      group('Built-in', [list]),
      group('My presets', [
        h('div.row', {}, nameIn, h('button.btn', {
          type: 'button',
          onclick: () => {
            const name = nameIn.value.trim() || store.state.name || 'My preset';
            const snap = { ...store.snapshot(), name };
            const all = readUserPresets().filter((p) => p.name !== name);
            all.unshift(snap);
            if (!writeUserPresets(all)) this.actions.toast('Browser storage is blocked here. Use “Export file” instead.');
            else this.actions.toast(`Saved “${name}”.`);
            store.state.name = name;
            nameIn.value = '';
            renderMine();
          },
        }, 'Save')),
        mine,
        h('div.row', {},
          h('button.btn.ghost', { type: 'button', onclick: () => this.actions.exportPresetFile() }, 'Export file'),
          h('button.btn.ghost', { type: 'button', onclick: () => importIn.click() }, 'Import file'), importIn),
      ], { hint: 'Saved in this browser. Export a .json file to share or back up.' }),
    );
  }

  exportTab() {
    const p = bindPath;
    const fmt = this.actions.videoFormat();
    return h('section.tab', {},
      group('Video', [
        select('Resolution', p('record.resolution'), { '720p': '720p', '1080p': '1080p · Full HD', '1440p': '1440p · 2K', '2160p': '2160p · 4K' }),
        select('Frame rate', p('record.fps'), [[30, '30 fps'], [60, '60 fps']]),
        toggle('Record one full pass from the start', p('record.fromStart')),
        h('button.btn.record-btn', { type: 'button', onclick: () => this.actions.toggleRecord() }, h('span.rec-dot'), 'Start recording'),
        h('p.hint', {}, fmt ? `Saves ${fmt.ext.toUpperCase()} with the synth audio. Tip: pick a Frame in the Look tab (16:9, 9:16…) first.` : 'Video recording is not supported in this browser.'),
      ]),
      group('Audio & MIDI', [
        h('button.btn', { type: 'button', onclick: () => this.actions.exportWav() }, 'Export WAV (studio render)'),
        h('p.hint', {}, 'Renders the full timeline offline: faster than real time, with no dropped frames.'),
        number('MIDI tempo (BPM)', p('transport.bpm'), { min: 30, max: 300 }),
        h('button.btn', { type: 'button', onclick: () => this.actions.exportMidi() }, 'Export MIDI'),
        h('p.hint', {}, 'One track per layer, notes snapped to your scale. Open it in any DAW.'),
      ]),
      group('Image', [
        h('button.btn', { type: 'button', onclick: () => this.actions.snapshot() }, 'Save PNG snapshot'),
      ]),
      h('p.hint.note', {}, 'Files download to your computer. If nothing downloads, you are viewing an embedded preview: run the app on localhost (npm start) to save files.'),
    );
  }

  /** Re-sync every control with state after a preset load. */
  refresh() {
    refreshAll();
    this.renderLayers();
  }
}

/** One-click colour schemes for canvas + layers. */
export const PALETTES = [
  { name: 'Neon Night', background: '#04050a', gridColor: '#1d2440', axesColor: '#4a5784', layers: ['#22e4ff', '#ff3d9a', '#ffd23d', '#8cff5a'], threshold: 0.05 },
  { name: 'Synthwave', background: '#120320', gridColor: '#3a1350', axesColor: '#a14fd1', layers: ['#ff5ec4', '#45f0ff', '#ffb547', '#b56bff'], threshold: 0.05 },
  { name: 'Matrix', background: '#010702', gridColor: '#0d2a12', axesColor: '#2f7a3b', layers: ['#3dff6e', '#c4ff3d', '#3dffd8', '#7aff3d'], threshold: 0.05 },
  { name: 'Ember', background: '#0b0503', gridColor: '#2b140c', axesColor: '#8a4a2c', layers: ['#ff7a2f', '#ffd23d', '#ff3d5e', '#ffe9b0'], threshold: 0.05 },
  { name: 'Blueprint', background: '#0a2a5c', gridColor: '#1d4682', axesColor: '#9cc1ff', layers: ['#ffffff', '#ffd23d', '#7cf0ff', '#ff9ccf'], threshold: 0.6 },
  { name: 'Paper', background: '#f3f1ec', gridColor: '#dcd8ce', axesColor: '#7d7868', layers: ['#1745d6', '#e0245e', '#0e9f6e', '#c77700'], threshold: 0.9 },
];
