/**
 * Builds the two side panels:
 *   left  — formula layers, live parameters a–d, formula cheatsheet
 *   right — inspector tabs: Look · FX · Sound · Rhythm · Animate · Camera · Presets · Export
 */
import { store, createLayer, LAYER_TYPES } from '../state.js';
import { SCALE_LABELS, NOTE_NAMES, noteName } from '../math/music.js';
import { compile, FUNCTIONS } from '../math/parser.js';
import { LibraryView } from './library-view.js';
import { download } from '../export/recorder.js';
import { suggestYoutube, youtubeFor, youtubeText, youtubeProblems, TITLE_MAX } from '../export/youtube.js';
import { DIVISIONS } from '../math/rhythm.js';
import { layerGroups } from '../math/sequence.js';
import { CIRCLE_RULES, chordStep } from '../circle/sim.js';
import { CIRCLE_PALETTES } from '../circle/view.js';
import { MELODIES } from '../circle/sound.js';
import { DRUM_KINDS, DRUM_LABELS, TRIGGERS } from '../audio/drum-scanner.js';
import { animatable, describe, removeKey, EASES } from '../anim/keyframes.js';
import { INSTRUMENTS, INSTRUMENT_GROUPS } from '../audio/instruments.js';
import { h, bindPath, bindObj, slider, color, select, toggle, segmented, number, text, group, disposeTree, refreshAll } from './controls.js';
import { FONT_LABELS } from './overlay.js';

const MAX_LAYERS = 8;


const SNIPPETS = ['sin()', 'cos()', 'exp()', 'mod(x, 1)', 'abs()', 'floor()', 'sqrt()', 'saw()', 'tri()', 'square()', 'noise()', 'pi', 't', 'a'];

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

    // Layer playback: together or one after another.
    const seq = document.getElementById('seq-slot');
    this.seqPast = h('div.ctl', {}, h('span.ctl-label', {}, 'Finished layers'),
      segmented(bindPath('sequence.past'), [['ghost', 'Ghost', 'Keep a faint trace of finished layers'], ['keep', 'Keep', 'Leave finished layers fully drawn'], ['hide', 'Hide', 'Remove finished layers']], { label: 'Finished layers' }));
    this.seqInfo = h('p.hint');
    seq.append(
      h('div.ctl', {}, h('span.ctl-label', {}, 'Play layers'),
        segmented(bindPath('sequence.enabled'), [[false, 'Together', 'All layers play at the same time'], [true, 'One after another', 'Each layer plays in turn; one loop or recording covers them all']], { label: 'Layer playback' })),
      this.seqPast, this.seqInfo);
    this.renderSequence();

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
    // Sequence link: this layer joins the step of the layer above (any number can chain).
    if (index > 0) {
      const link = h('button.layer-link', { type: 'button', 'aria-pressed': String(!!l.withPrev) });
      const label = () => {
        link.setAttribute('aria-pressed', String(!!l.withPrev));
        link.textContent = l.withPrev ? '🔗 Plays together with the layer above' : '⛓ Starts its own step · click to play with the layer above';
        card.classList.toggle('is-linked', !!l.withPrev);
      };
      link.addEventListener('click', () => { l.withPrev = !l.withPrev; label(); store.emit('sequence'); });
      label();
      card.append(link);
    }
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
      this.soundPicker(l, ev),
      vol,
      slider('Octave', bindObj(l, 'octave', `${ev}.sound`), { min: -3, max: 3, step: 1, fmt: (v) => (v > 0 ? `+${v}` : `${v}`) }),
      slider('Pan', bindObj(l, 'pan', `${ev}.sound`), { min: -1, max: 1, step: 0.01, fmt: (v) => (Math.abs(v) < 0.01 ? 'C' : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`) }),
      select('Z controls', bindObj(l, 'zMap', `${ev}.sound`), { volume: 'Volume', pan: 'Stereo pan', none: 'Nothing' }),
    ], { open: false }));

    this.showErrors(l.id, this.actions.errorsFor(l.id));
    return card;
  }

  /** Show the sequence options and how long each layer plays. */
  renderSequence() {
    if (!this.seqInfo) return;
    const on = store.state.sequence.enabled;
    this.seqPast.hidden = !on;
    this.seqInfo.hidden = !on;
    this.layerList?.classList.toggle('seq-on', on);
    if (on) {
      const groups = layerGroups(store.state.layers);
      const each = store.state.transport.duration / Math.max(1, groups.length);
      const steps = groups.map((g, i) => `${i + 1}: ${g.map((l) => l.name).join(' + ')}`).join(' → ');
      this.seqInfo.textContent = groups.length > 1
        ? `${groups.length} steps, ${each.toFixed(1)} s each (Length ÷ ${groups.length}). ${steps}. Link layers (🔗 on a layer) to play them together inside one step.`
        : 'Add more layers (or unlink them): steps play one after another.';
    }
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
      ['circle', '◎ Circle', this.circleTab()],
      ['look', 'Look', this.lookTab()],
      ['fx', 'FX', this.fxTab()],
      ['sound', 'Sound', this.soundTab()],
      ['rhythm', 'Rhythm', this.rhythmTab()],
      ['animate', 'Animate', this.animateTab()],
      ['text', 'Text', this.textTab()],
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
      group('Moves with the music', [
        slider('Follow the pen', p('camera.track'), { min: 0, max: 1, step: 0.01, fmt: (v) => (v ? `${Math.round(v * 100)}%` : 'Off') }),
        slider('Follow smoothness', p('camera.trackSpeed'), { min: 0.01, max: 0.3, step: 0.01, fmt: (v) => (v < 0.05 ? 'Slow-motion' : v < 0.12 ? 'Smooth' : 'Tight') }),
        slider('Beat punch zoom', p('camera.punch'), { min: 0, max: 1, step: 0.01, fmt: (v) => (v ? `${Math.round(v * 100)}%` : 'Off') }),
        slider('Roll', p('camera.roll'), { min: -45, max: 45, step: 0.5, unit: '°' }),
      ], { hint: 'Follow the pen + a zoomed-in camera (scroll, or a camera keyframe with K) gives tracking shots; punch zooms in on kicks and snares (Rhythm tab drums with “pulse” on). All of these can be keyframed in the Animate tab for dramatic reveals.' }),
    );
  }

  presetsTab() {
    this.library = new LibraryView({
      loadPreset: (p) => this.actions.loadPreset(p),
      toast: this.actions.toast,
      snapshot: () => store.snapshot(),
      download,
      renderVideos: (items) => this.actions.renderBatch(items),
    });
    return this.library.el;
  }

  /* ------------------------------------------------------------- circle lab */

  circleTab() {
    this.circleBody = h('div.tab-inner');
    const tab = h('section.tab', {}, this.circleBody);
    this.renderCircle();
    return tab;
  }

  /** Rebuild the Circle Lab controls (the visible options depend on the rule). */
  renderCircle() {
    if (!this.circleBody) return;
    disposeTree(this.circleBody);
    const p = bindPath;
    const c = store.state.circle;
    const on = store.state.mode === 'circle';
    const pct = (v) => `${Math.round(v * 100)}%`;
    const parts = [];
    if (!on) {
      parts.push(h('div.circle-intro', {},
        h('p.hint', {}, 'Circle Lab: a ball, a chord walker or a polyrhythm moves inside a circle and every hit plays a note. Trails build up into star polygons, mandalas and chaos — the “satisfying” Shorts genre.'),
        h('button.btn.export-btn', { type: 'button', onclick: () => { store.set('mode', 'circle'); refreshAll(); } }, '◎ Switch to Circle Lab')));
    }
    parts.push(group('Rule', [
      select('Simulation', p('circle.rule'), CIRCLE_RULES),
      number('Random seed', p('circle.seed'), { min: 1, max: 9999 }),
    ], { hint: 'Everything is deterministic: the same settings always give the same video and sound. Change the seed for a different variation.' }));

    if (c.rule === 'chord') {
      const stepIn = text('Step per hit (fraction of a turn)', p('circle.chord.step'), { placeholder: '1/phi^2' });
      const info = h('p.hint.circle-step');
      const showStep = () => {
        const v = chordStep(c.chord.step);
        const deg = (v * 360) % 360;
        // a rational step p/q closes after q hits; irrational ones never close
        let close = '';
        for (let q = 1; q <= 400; q++) { if (Math.abs(v * q - Math.round(v * q)) < 1e-9) { close = `closes after ${q} hits`; break; } }
        info.textContent = `= ${v.toFixed(6)} turn = ${deg.toFixed(3)}° · ${close || 'never closes (irrational): fills the disc'}`;
      };
      stepIn.querySelector('input').addEventListener('input', showStep);
      showStep();
      const chip = (label, expr) => h('button.chip', { type: 'button', onclick: () => { store.set('circle.chord.step', expr); refreshAll(); showStep(); } }, label);
      parts.push(group('Chord walker', [
        stepIn, info,
        h('div.chips', {}, chip('1/φ² golden', '1/phi^2'), chip('1/φ', '1/phi'), chip('2/5 star', '2/5'), chip('3/7', '3/7'), chip('5/13', '5/13'),
          chip('8/21', '8/21'), chip('√2 − 1', 'sqrt(2) - 1'), chip('π − 3', 'pi - 3'), chip('e − 2', 'e - 2'), chip('11/24', '11/24')),
        slider('Walkers', p('circle.chord.walkers'), { min: 1, max: 12, step: 1 }),
        slider('Speed', p('circle.chord.speed'), { min: 0.2, max: 8, step: 0.05 }),
        slider('Speed-up per hit', p('circle.chord.speedGain'), { min: 1, max: 1.06, step: 0.001, fmt: (v) => `×${v.toFixed(3)}` }),
        slider('Start angle', p('circle.chord.start'), { min: 0, max: 360, step: 1, unit: '°' }),
      ], { hint: 'Write any expression: 1/phi^2, 2/5, sqrt(2)-1, pi-3… Fibonacci ratios (5/13, 8/21, 13/34) look golden for a while, then close.' }));
    }
    if (['bounce', 'split', 'grow', 'escape'].includes(c.rule)) {
      parts.push(group('Balls & physics', [
        slider('Balls', p('circle.physics.balls'), { min: 1, max: 32, step: 1 }),
        slider('Speed', p('circle.physics.speed'), { min: 0.2, max: 5, step: 0.05 }),
        slider('Launch angle', p('circle.physics.angle'), { min: 0, max: 360, step: 1, unit: '°' }),
        slider('Gravity', p('circle.physics.gravity'), { min: 0, max: 8, step: 0.1 }),
        slider('Bounciness', p('circle.physics.restitution'), { min: 0.5, max: 1.1, step: 0.01, fmt: pct }),
        slider('Speed-up per bounce', p('circle.physics.speedGain'), { min: 1, max: 1.08, step: 0.002, fmt: (v) => `×${v.toFixed(3)}` }),
        slider('Top speed', p('circle.physics.maxSpeed'), { min: 1, max: 12, step: 0.1 }),
        slider('Ball size', p('circle.physics.size'), { min: 0.005, max: 0.2, step: 0.005 }),
      ]));
    }
    if (c.rule === 'split') {
      parts.push(group('Split', [
        slider('Split angle', p('circle.split.angle'), { min: 1, max: 60, step: 0.5, unit: '°' }),
        slider('Most balls', p('circle.split.max'), { min: 2, max: 512, step: 1 }),
      ]));
    }
    if (c.rule === 'grow') {
      parts.push(group('Grow', [
        slider('Growth per bounce', p('circle.grow.amount'), { min: 0.001, max: 0.04, step: 0.001 }),
        slider('Stop at', p('circle.grow.until'), { min: 0.3, max: 0.99, step: 0.01, fmt: pct }),
      ]));
    }
    if (c.rule === 'escape') {
      parts.push(group('Rings', [
        slider('Rings', p('circle.escape.rings'), { min: 1, max: 14, step: 1 }),
        slider('Innermost ring', p('circle.escape.inner'), { min: 0.1, max: 0.9, step: 0.01, fmt: pct }),
        slider('Gap', p('circle.escape.gap'), { min: 5, max: 120, step: 1, unit: '°' }),
        slider('Ring spin', p('circle.escape.spin'), { min: 0, max: 5, step: 0.05 }),
      ], { hint: 'The ball bounces inside the innermost ring; hitting its gap breaks it and frees the ball into the next one.' }));
    }
    if (c.rule === 'polyrhythm') {
      parts.push(group('Polyrhythm', [
        slider('Dots', p('circle.poly.dots'), { min: 2, max: 32, step: 1 }),
        slider('Swings of the slowest dot', p('circle.poly.base'), { min: 1, max: 80, step: 1 }),
        slider('Cycle (all line up again)', p('circle.poly.cycle'), { min: 5, max: 300, step: 1, unit: ' s' }),
      ], { hint: 'Dot k swings base + k times per cycle; after one cycle every dot is back at the start together.' }));
    }
    parts.push(group('Sound', [
      this.soundPickerFor(p('circle.sound.instrument')),
      select('Notes from', p('circle.sound.pitch'), { angle: 'Where it hits the circle', melody: 'A melody, note by note', rise: 'Rising scale', ball: 'Each ball its own note' }),
      ...(c.sound.pitch === 'melody' ? [select('Melody', p('circle.sound.melody'), Object.fromEntries(Object.entries(MELODIES).map(([k, m]) => [k, m.label])))] : []),
      ...(c.sound.pitch === 'melody' && c.sound.melody === 'custom' ? [text('Notes', p('circle.sound.notes'), { placeholder: 'E4 D#4 E4 D#4 E4 B3 D4 C4 A3' })] : []),
      select('Drum on every hit', p('circle.sound.drum'), { off: 'None', kick: 'Kick', snare: 'Snare', clap: 'Clap', hat: 'Hi-hat' }),
      slider('Note length', p('circle.sound.length'), { min: 0.05, max: 2, step: 0.01, unit: ' s' }),
      slider('Volume', p('circle.sound.volume'), { min: 0, max: 1, step: 0.01, fmt: pct }),
      slider('Most notes per second', p('circle.sound.maxRate'), { min: 4, max: 60, step: 1 }),
    ], { hint: 'Key and note range come from the Sound tab (scale, root, low/high note). Very fast hits are thinned so it stays musical.' }));
    parts.push(group('Look', [
      select('Palette', p('circle.look.palette'), CIRCLE_PALETTES),
      select('Trail', p('circle.look.trail'), { lines: 'Lines stay (pattern builds up)', fade: 'Lines fade', none: 'No trail' }),
      slider('Line width', p('circle.look.trailWidth'), { min: 0.3, max: 6, step: 0.1 }),
      slider('Glow', p('circle.look.glow'), { min: 0, max: 2.5, step: 0.05 }),
      slider('Ring width', p('circle.look.ringWidth'), { min: 0, max: 16, step: 0.5 }),
      slider('Ball size', p('circle.look.ballSize'), { min: 0.3, max: 3, step: 0.05, fmt: (v) => `×${v.toFixed(2)}` }),
      slider('Circle size', p('circle.look.size'), { min: 0.2, max: 0.5, step: 0.005, fmt: pct }),
      slider('Circle height', p('circle.look.center'), { min: 0.3, max: 0.7, step: 0.005, fmt: pct }),
      color('Background', p('circle.look.background')),
      toggle('Sparks on impact', p('circle.look.sparks')),
      toggle('Ring pulses on hits', p('circle.look.ringPulse')),
      toggle('Comet tail', p('circle.look.comet')),
      toggle('Counter (bounces / balls)', p('circle.look.counter')),
    ]));
    parts.push(group('Text', [
      text('Formula line', p('circle.text.formula'), { placeholder: 'Automatic, e.g. angle = 1/φ² turn' }),
    ], { hint: 'Shown under the name. The hook question (Export tab) and YouTube title make it a Short: “Will this pattern ever close?”' }));
    this.circleBody.replaceChildren(...parts);
  }

  /** Instrument list bound to any path (Circle Lab). */
  soundPickerFor(b) {
    const ids = Object.keys(INSTRUMENTS);
    const sel = h('select', { 'aria-label': 'Sound' }, INSTRUMENT_GROUPS.map((g) => h('optgroup', { label: g },
      ids.filter((id) => INSTRUMENTS[id].group === g).map((id) => h('option', { value: id }, INSTRUMENTS[id].label)))));
    sel.value = INSTRUMENTS[b.get()] ? b.get() : 'kalimba';
    const set = (id) => { sel.value = id; b.set(id); };
    sel.addEventListener('change', () => set(sel.value));
    const step = (d) => set(ids[(ids.indexOf(sel.value) + d + ids.length) % ids.length]);
    return h('div.ctl.ctl-sound', {},
      h('span.ctl-label', {}, 'Sound'),
      h('div.sound-row', {},
        h('button.icon-btn', { type: 'button', title: 'Previous sound', onclick: () => step(-1) }, '‹'),
        sel,
        h('button.icon-btn', { type: 'button', title: 'Next sound', onclick: () => step(1) }, '›'),
        h('button.icon-btn', { type: 'button', title: 'Preview this sound', onclick: () => this.actions.previewSound?.(sel.value) }, '▶')));
  }

  /** Grouped instrument list with previous/next and a preview button. */
  soundPicker(l, ev) {
    const ids = Object.keys(INSTRUMENTS);
    const sel = h('select', { 'aria-label': 'Sound' }, INSTRUMENT_GROUPS.map((g) => h('optgroup', { label: g },
      ids.filter((id) => INSTRUMENTS[id].group === g).map((id) => h('option', { value: id }, INSTRUMENTS[id].label)))));
    const set = (id) => { l.wave = id; sel.value = id; store.emit(`${ev}.wave`); };
    sel.value = INSTRUMENTS[l.wave] ? l.wave : 'sine';
    sel.addEventListener('change', () => set(sel.value));
    const step = (d) => set(ids[(ids.indexOf(sel.value) + d + ids.length) % ids.length]);
    return h('div.ctl.ctl-sound', {},
      h('span.ctl-label', {}, 'Sound'),
      h('div.sound-row', {},
        h('button.icon-btn', { type: 'button', title: 'Previous sound', onclick: () => step(-1) }, '‹'),
        sel,
        h('button.icon-btn', { type: 'button', title: 'Next sound', onclick: () => step(1) }, '›'),
        h('button.icon-btn', { type: 'button', title: 'Preview this sound', onclick: () => this.actions.previewSound?.(sel.value) }, '▶')));
  }

  /** Title, description and tags for YouTube Shorts: saved in the preset, written next to videos. */
  youtubeGroup() {
    const p = bindPath;
    const yt = () => store.state.youtube;
    const counter = h('span.hint.yt-count');
    const warn = h('p.hint.yt-warn', { hidden: true });
    const updateCount = () => {
      const n = (yt().title || '').length;
      counter.textContent = n ? `${n} / ${TITLE_MAX}` : 'Empty: a title is suggested automatically';
      counter.classList.toggle('over', n > TITLE_MAX);
      const problems = youtubeProblems(yt());
      warn.hidden = !problems.length;
      warn.textContent = problems.join(' ');
    };
    const title = text('Title', p('youtube.title'), { placeholder: 'e.g. Fourier builds a square wave 🎵 #shorts' });
    title.querySelector('input').addEventListener('input', updateCount);
    const descCtl = text('Description', p('youtube.description'), { multiline: true, placeholder: 'Empty: suggested from the name and formulas' });
    const tagsCtl = text('Tags (comma separated)', p('youtube.tags'), { placeholder: 'math, music, fourier, shorts' });
    descCtl.querySelector('textarea').addEventListener('input', updateCount);
    tagsCtl.querySelector('input').addEventListener('input', updateCount);
    updateCount();
    this.updateYtCount = updateCount;
    const copy = async (what, value) => {
      try { await navigator.clipboard.writeText(value); } catch {
        const ta = h('textarea', { style: 'position:fixed;opacity:0' }, value);
        document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
      }
      this.actions.toast(`${what} copied.`);
    };
    return group('YouTube Shorts · title & description', [
      title, counter,
      descCtl,
      tagsCtl,
      warn,
      h('div.row', {},
        h('button.btn.ghost.small', { type: 'button', onclick: () => {
          const s = suggestYoutube(store.state);
          Object.assign(yt(), s);
          store.emit('youtube');
          refreshAll();
          updateCount();
        } }, 'Suggest'),
        h('button.btn.ghost.small', { type: 'button', onclick: () => copy('Title', youtubeFor(store.state).title) }, 'Copy title'),
        h('button.btn.ghost.small', { type: 'button', onclick: () => copy('Description', `${youtubeFor(store.state).description}`) }, 'Copy description'),
        h('button.btn.ghost.small', { type: 'button', onclick: () => {
          download(new Blob([youtubeText(youtubeFor(store.state))], { type: 'text/plain' }), `${this.actions.fileBase()}.txt`);
        } }, 'Save .txt')),
    ], { open: false, hint: 'Saved with the preset; never drawn into the video. Every exported video (and every video in a batch) gets a .txt with these, and batches also get one CSV of all of them.' });
  }

  exportTab() {
    const p = bindPath;
    const live = this.actions.videoFormat();
    const smooth = this.actions.canRenderVideo();
    return h('section.tab', {},
      group('Video', [
        text('File name', p('record.fileName'), { placeholder: 'Same as the project name' }),
        select('Resolution', p('record.resolution'), { '720p': '720p', '1080p': '1080p · Full HD', '1440p': '1440p · 2K', '2160p': '2160p · 4K' }),
        select('Frame rate', p('record.fps'), [[24, '24 fps · film'], [30, '30 fps'], [60, '60 fps · smoothest']]),
        select('Quality', p('record.quality'), { standard: 'Standard · smaller file', high: 'High', max: 'Maximum · large file' }),
        select('Motion blur', p('record.subframes'), [[1, 'Off · fastest'], [2, 'Natural · 2 sub-frames'], [4, 'Cinematic · 4 sub-frames']]),
        select('Encoder', p('record.engine'), { auto: 'Automatic · ffmpeg when available', ffmpeg: 'ffmpeg on this computer (npm start)', browser: 'Browser (WebCodecs)' }),
        toggle('Browser encoder: use the GPU (faster, unstable on some drivers)', p('record.gpuEncoder')),
        h('button.btn.export-btn', { type: 'button', onclick: () => this.actions.exportVideo() }, '⬇ Export video (MP4)'),
        h('p.hint', {}, smooth
          ? 'Renders every frame at its exact time: a smooth, constant-frame-rate MP4 (H.264 + AAC) that plays and seeks everywhere. With “npm start” and ffmpeg installed, ffmpeg does the encoding (most reliable: the browser’s encoder is not used). The Frame (16:9, 9:16…) comes from the Look tab.'
          : 'This browser has no video encoder (WebCodecs). Use Chrome or Edge, or Live capture below.'),
      ]),
      group('Shorts: hook & ending', [
        toggle('Hook in the first seconds', p('record.hook.enabled')),
        text('Hook line', p('hook.text'), { placeholder: 'Empty: the YouTube title (without hashtags)' }),
        slider('Teaser of the finished picture', p('record.hook.teaser'), { min: 0, max: 2, step: 0.1, fmt: (v) => (v ? `${v.toFixed(1)} s` : 'Off') }),
        toggle('Flash at the cut', p('record.hook.flash')),
        toggle('Whoosh + boom sound', p('record.hook.impact')),
        slider('Fade to black at the end', p('record.outro'), { min: 0, max: 2, step: 0.1, fmt: (v) => (v ? `${v.toFixed(1)} s` : 'Off') }),
        h('button.btn.ghost.small', { type: 'button', onclick: () => this.actions.previewShorts?.() }, '▶ Preview start & end'),
      ], { hint: 'Viewers decide in the first 1–2 seconds. The video opens on the finished picture with a big hook line (readable with the sound off), then a flash and a boom cut to the drawing from zero. At the end the picture and sound fade to black instead of stopping abruptly. Applies to every exported video, batches included; the hook line is saved with the preset.' }),
      this.youtubeGroup(),
      group('Live capture · real time', [
        toggle('Capture one full pass from the start', p('record.fromStart')),
        h('button.btn.record-btn', { type: 'button', onclick: () => this.actions.toggleRecord() }, h('span.rec-dot'), 'Start recording'),
        h('p.hint', {}, live ? `Records what plays on screen as ${live.ext.toUpperCase()} (shortcut R). Quality depends on how fast your computer draws; use Export video for the best result.` : 'Live capture is not supported in this browser.'),
      ], { open: false }),
      group('Audio & MIDI', [
        h('button.btn', { type: 'button', onclick: () => this.actions.exportWav() }, 'Export WAV'),
        h('p.hint', {}, 'Renders the full timeline offline: faster than real time, with no dropped frames.'),
        number('MIDI tempo (BPM)', p('transport.bpm'), { min: 30, max: 300 }),
        h('button.btn', { type: 'button', onclick: () => this.actions.exportMidi() }, 'Export MIDI'),
        h('p.hint', {}, 'One track per layer, notes snapped to your scale. Open it in any DAW.'),
      ]),
      group('Image', [
        h('button.btn', { type: 'button', onclick: () => this.actions.snapshot() }, 'Save PNG snapshot'),
      ]),
      h('p.hint.note', {}, 'Files download to your computer. In the claude.ai viewer you confirm each save, and WAV/MIDI arrive inside a .zip.'),
      h('p.hint.note.build-id'),
    );
  }

  /* -------------------------------------------------------------- text */

  textTab() {
    const p = bindPath;
    const o = () => store.state.overlay;
    const reset = (key) => h('button.btn.ghost.small', { type: 'button', onclick: () => {
      Object.assign(o()[key], { x: null, y: null, size: 1 });
      store.emit('overlay');
      refreshAll();
    } }, 'Reset position & size');
    this.layoutBtn = h('button.btn', { type: 'button', 'aria-pressed': 'false', onclick: () => this.actions.setLayoutEditing(this.layoutBtn.getAttribute('aria-pressed') !== 'true') }, '✥ Edit on the video');
    this.textList = h('div.text-list');
    this.titleSlot = null;
    const titleText = text('Title text', p('overlay.title.text'), { placeholder: 'Same as the project name' });
    this.titleInput = titleText.querySelector('input');
    const tab = h('section.tab', {},
      h('div.row', {}, this.layoutBtn),
      h('p.hint', {}, 'Turn on editing, then drag anything on the video to move it; drag its corner or scroll over it to resize. Double-click a text to edit it.'),
      group('Title', [
        toggle('Show title', p('overlay.title.enabled')),
        titleText,
        toggle('Show subtitle line', p('overlay.title.subtitle')),
        text('Subtitle text', p('overlay.title.subtitleText'), { placeholder: 'Automatic (mode · scale)' }),
        color('Colour', { get: () => o().title.color || '#eef2ff', set: (v) => { o().title.color = v; store.emit('overlay'); } }),
        slider('Size', p('overlay.title.size'), { min: 0.3, max: 5, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` }),
        reset('title'),
      ]),
      group('Formulas', [
        toggle('Show formulas', p('overlay.formulas.enabled')),
        toggle('Show note names', p('visual.showNotes')),
        slider('Size', p('overlay.formulas.size'), { min: 0.3, max: 5, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` }),
        reset('formulas'),
      ]),
      group('Preset name', [
        toggle('Show preset name', p('overlay.name.enabled')),
        color('Colour', { get: () => o().name.color || '#eef2ff', set: (v) => { o().name.color = v; store.emit('overlay'); } }),
        slider('Size', p('overlay.name.size'), { min: 0.3, max: 5, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` }),
        reset('name'),
      ], { hint: 'The project / preset name, centred under the formulas.' }),
      group('Audio analyzer', [
        select('Style', p('visual.analyzer'), { spectrum: 'Spectrum bars', wave: 'Waveform', off: 'Hidden' }),
        slider('Size', p('overlay.analyzer.size'), { min: 0.3, max: 5, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` }),
        reset('analyzer'),
      ]),
      group('Text boxes', [
        h('button.btn', { type: 'button', onclick: () => this.addText() }, '+ Add text'),
        this.textList,
      ], { hint: 'Hooks, captions, credits. Persian works too. Set a time window to show a text only for part of the video (it fades in and out).' }),
    );
    this.renderTexts();
    return tab;
  }

  addText() {
    const t = {
      // Vertical videos: just above the area Shorts/Reels cover with their own captions.
      id: `t${Date.now().toString(36)}`, text: 'Your text', x: 0.5, y: ['9:16', '4:5'].includes(store.state.visual.aspect) ? 0.7 : 0.2, size: 1, color: '#ffffff',
      font: 'display', align: 'center', bold: true, box: false, glow: true, start: 0, end: 0,
    };
    store.state.overlay.texts.push(t);
    store.emit('overlay.texts');
    this.focusText(t.id);
  }

  renderTexts() {
    if (!this.textList) return;
    disposeTree(this.textList);
    const list = store.state.overlay.texts;
    if (!list.length) {
      this.textList.replaceChildren(h('p.hint', {}, 'No text boxes yet.'));
      return;
    }
    this.textList.replaceChildren(...list.map((t, i) => {
      const ev = 'overlay';
      const area = h('textarea', { dir: 'auto', spellcheck: 'false', 'aria-label': `Text ${i + 1}` });
      area.value = t.text;
      area.addEventListener('input', () => { t.text = area.value; store.emit(ev); });
      return h('div.text-card', { dataset: { id: t.id } },
        h('div.track-head', {}, h('strong', {}, `Text ${i + 1}`),
          h('button.link.danger-link', { type: 'button', onclick: () => { list.splice(i, 1); store.emit('overlay.texts'); } }, 'Delete')),
        area,
        select('Font', bindObj(t, 'font', ev), FONT_LABELS),
        slider('Size', bindObj(t, 'size', ev), { min: 0.2, max: 5, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` }),
        color('Colour', bindObj(t, 'color', ev)),
        h('div.ctl', {}, h('span.ctl-label', {}, 'Align'), segmented(bindObj(t, 'align', ev), [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']], { label: 'Text alignment' })),
        toggle('Bold', bindObj(t, 'bold', ev)),
        toggle('Glow', bindObj(t, 'glow', ev)),
        toggle('Background box', bindObj(t, 'box', ev)),
        h('div.time-row', {},
          number('Show from (s)', bindObj(t, 'start', ev), { min: 0, step: 0.1 }),
          number('Until (s, 0 = end)', bindObj(t, 'end', ev), { min: 0, step: 0.1 })),
        h('button.btn.ghost.small', { type: 'button', onclick: () => { t.x = 0.5; t.y = 0.5; store.emit(ev); } }, 'Centre on the video'));
    }));
  }

  /** Jump to a text box's card (double-click on the video), or the title field. */
  focusText(id) {
    this.showTab('text');
    if (id === 'title') { this.titleInput?.focus(); return; }
    const card = this.textList.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (!card) return;
    card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const area = card.querySelector('textarea');
    area.focus();
    area.select();
    card.classList.remove('flash');
    void card.offsetWidth;
    card.classList.add('flash');
  }

  syncLayoutToggle(on) {
    if (!this.layoutBtn) return;
    this.layoutBtn.setAttribute('aria-pressed', String(on));
    this.layoutBtn.textContent = on ? '✓ Done editing' : '✥ Edit on the video';
  }

  /* ------------------------------------------------------------ rhythm */

  rhythmTab() {
    const p = bindPath;
    const bars = h('input#fit-bars', { type: 'number', min: 1, max: 256, value: 8, 'aria-label': 'Number of bars' });
    this.drumSourceSlot = h('div');
    const drumRows = DRUM_KINDS.map((kind) => h('div.drum-row', {},
      select(DRUM_LABELS[kind], p(`drums.${kind}`), TRIGGERS),
      h('button.icon-btn', { type: 'button', title: `Play the ${DRUM_LABELS[kind].toLowerCase()}`, 'aria-label': `Play the ${DRUM_LABELS[kind].toLowerCase()}`, onclick: () => this.actions.auditionDrum(kind) }, '▶')));
    const tab = h('section.tab', {},
      group('Beat grid', [
        toggle('Snap notes to the beat', p('rhythm.enabled')),
        number('Tempo (BPM)', p('transport.bpm'), { min: 30, max: 300 }),
        h('div.ctl', {}, h('span.ctl-label', {}, 'Note value'), segmented(p('rhythm.division'), Object.keys(DIVISIONS).map((d) => [d, d, `${d} notes`]), { label: 'Grid division', cls: 'seg-div' })),
        slider('Note length (gate)', p('rhythm.gate'), { min: 0.05, max: 1, step: 0.01, fmt: (v) => (v >= 1 ? 'Tied' : `${Math.round(v * 100)}%`) }),
        slider('Swing', p('rhythm.swing'), { min: 0, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` }),
        toggle('Show beat lines', p('rhythm.showGrid')),
        h('div.row', {}, h('label.ctl-label', { for: 'fit-bars' }, 'Length in bars'), bars,
          h('button.btn.small', { type: 'button', onclick: () => this.actions.fitToBars(Math.max(1, Math.round(+bars.value || 1))) }, 'Fit length')),
      ], { hint: 'The pitch is held for each step, so any curve becomes a rhythmic melody. Pair it with Pluck articulation (Sound tab) for crisp notes.' }),
      group('Drums', [
        toggle('Enabled', p('drums.enabled')),
        this.drumSourceSlot,
        ...drumRows,
        slider('Sensitivity', p('drums.sensitivity'), { min: 0.01, max: 0.5, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` }),
        slider('Drum volume', p('drums.volume'), { min: 0, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` }),
        toggle('Flash and rings on hits', p('drums.pulse')),
      ], { hint: 'Hits come from the source layer: its peaks, valleys and crossings of the middle line, or from the clock. Sensitivity is how big a turn must be to count as a peak.' }),
    );
    this.renderRhythm();
    return tab;
  }

  /** Rebuild the parts of the Rhythm tab that list layers. */
  renderRhythm() {
    if (!this.drumSourceSlot) return;
    disposeTree(this.drumSourceSlot);
    const opts = store.state.layers.map((l, i) => [i, `${i + 1} · ${l.name}`]);
    this.drumSourceSlot.replaceChildren(select('Source layer', bindPath('drums.source'), opts));
  }

  /* ----------------------------------------------------------- animate */

  animateTab() {
    this.keyPropSlot = h('div.ctl.ctl-select');
    this.keyTracks = h('div.tracks');
    this.keyEase = 'smooth';
    const ease = h('select#key-ease', {}, Object.entries(EASES).map(([v, t]) => h('option', { value: v }, t)));
    ease.addEventListener('change', () => { this.keyEase = ease.value; });
    const tab = h('section.tab', {},
      group('Add keyframe', [
        this.keyPropSlot,
        h('div.ctl.ctl-select', {}, h('label', { for: 'key-ease' }, 'Ease out of key'), ease),
        h('div.row', {},
          h('button.btn', { type: 'button', onclick: () => this.actions.addKey(this.keyPath, this.keyEase) }, '◆ Add key at playhead'),
          h('button.btn.ghost', { type: 'button', title: 'Shortcut: K', onclick: () => this.actions.addKey('camera.pose', this.keyEase) }, 'Camera key (K)')),
        toggle('Auto-key while paused', bindPath('keyframes.autoKey')),
      ], { hint: 'Move the playhead, set a value, add a key. Between keys the value glides. With auto-key on, moving an animatable slider while paused records a key by itself.' }),
      group('Tracks', [this.keyTracks]),
    );
    this.renderKeyframes();
    return tab;
  }

  renderKeyframes() {
    if (!this.keyTracks) return;
    const state = store.state;
    const props = animatable(state);
    if (!this.keyPath || !props.some((a) => a.path === this.keyPath)) this.keyPath = 'params.a';
    // Property picker, grouped.
    const sel = h('select#key-prop');
    const groups = new Map();
    for (const a of props) {
      if (!groups.has(a.group)) groups.set(a.group, h('optgroup', { label: a.group }));
      groups.get(a.group).append(h('option', { value: a.path }, a.label));
    }
    sel.append(...groups.values());
    sel.value = this.keyPath;
    sel.addEventListener('change', () => { this.keyPath = sel.value; });
    this.keyPropSlot.replaceChildren(h('label', { for: 'key-prop' }, 'Property'), sel);

    // Track list
    const tracks = state.keyframes.tracks;
    const paths = Object.keys(tracks);
    if (!paths.length) {
      this.keyTracks.replaceChildren(h('p.hint', {}, 'No animation yet. Example: put the playhead at 0 s, add a key for Parameter a, move to 8 s, change a, add another key.'));
      return;
    }
    const fmtVal = (v) => (typeof v === 'number' ? +v.toFixed(2) : typeof v === 'string' ? v : 'view');
    const nextEase = { smooth: 'linear', linear: 'hold', hold: 'smooth' };
    const easeMark = { smooth: '∿', linear: '／', hold: '⌐' };
    this.keyTracks.replaceChildren(...paths.map((path) => {
      const d = describe(state, path);
      const keys = tracks[path];
      const chips = keys.map((k, i) => h('span.key-chip', {},
        typeof k.value === 'string' ? h('i.key-swatch', { style: `background:${k.value}` }) : null,
        h('button.key-time', { type: 'button', title: 'Jump to this key', onclick: () => this.actions.seekTo(k.time) }, `${k.time.toFixed(2)}s · ${fmtVal(k.value)}`),
        h('button.key-ease', { type: 'button', title: `Ease: ${EASES[k.ease || 'smooth']} (click to change)`, onclick: () => { k.ease = nextEase[k.ease || 'smooth']; this.actions.keyframesChanged(); } }, easeMark[k.ease || 'smooth']),
        h('button.key-del', { type: 'button', title: 'Delete key', 'aria-label': 'Delete key', onclick: () => { removeKey(tracks, path, i); this.actions.keyframesChanged(); } }, '×')));
      return h('div.track', {},
        h('div.track-head', {},
          h('strong', {}, d ? `${d.group.startsWith('Layer') ? d.group.split(' · ')[0] + ' · ' : ''}${d.label}` : path),
          h('button.link.danger-link', { type: 'button', onclick: () => { delete tracks[path]; this.actions.keyframesChanged(); } }, 'Clear')),
        h('div.key-chips', {}, chips));
    }));
  }

  /** Re-sync every control with state after a preset load. */
  refresh() {
    refreshAll();
    this.updateYtCount?.();
    this.renderCircle();
    this.renderLayers();
    this.renderSequence();
    this.renderRhythm();
    this.renderKeyframes();
    this.renderTexts();
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
