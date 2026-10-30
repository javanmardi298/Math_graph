/**
 * Builds the two side panels:
 *   left  — formula layers, live parameters a–d, formula cheatsheet
 *   right — inspector tabs: Circle · Look · FX · Sound · Rhythm · Animate · Text · Camera · Presets · Daily · From audio · Export
 */
import { store, createLayer, LAYER_TYPES } from '../state.js';
import { SCALE_LABELS, SCALE_GROUPS, NOTE_NAMES, noteName, scaleNotesBetween } from '../math/music.js';
import { compile, FUNCTIONS } from '../math/parser.js';
import { LibraryView } from './library-view.js';
import { DailyView } from './daily-view.js';
import { SoundPresetView } from './sound-presets-view.js';
import { AudioLabView } from './audio-lab.js';
import { HarmonographTab } from './harmonograph-tab.js';
import { SpiroTab } from './spirograph-tab.js';
import { getBrand, setBrand } from '../brand.js';
import { saveShorts } from '../shorts-prefs.js';
import { CAMERA_MOVE_DEFAULTS, ENDINGS } from '../camera-moves.js';
import { BACKDROPS } from '../render/backdrops.js';
import { FX_STYLES } from '../render/fx-styles.js';

/** One-click camera styles: [label, settings, tip]. */
const CAMERA_STYLES = [
  ['Still', {}, 'No moves'],
  ['Slow push-in', { push: 0.45 }, 'Creeps closer over the whole video'],
  ['Pull-out reveal', { push: -0.6 }, 'Starts close, ends wide'],
  ['Floating', { drift: 0.6, sway: 0.25 }, 'A lazy, dreamy drift'],
  ['Breathing', { breathe: 0.6, push: 0.15 }, 'A soft zoom pulse on every beat'],
  ['Handheld', { shake: 0.7, drift: 0.2 }, 'Slight camera-in-hand feel'],
  ['Orbit spin', { spin: 4, push: 0.2 }, 'Turns slowly while pushing in'],
  ['Dramatic', { push: 0.8, sway: 0.4, breathe: 0.3 }, 'Big push-in with a tilt and a pulse'],
];

/** Binding for a Shorts hook / fade-out field: saved for the whole channel, not for this preset. */
const shortsBind = (path) => ({ get: () => store.get(path), set: (v) => { store.set(path, v); saveShorts(store.state.record); } });

/** Binding for a channel-branding field (saved in this browser, redraws the frame). */
const brandBind = (key) => ({ get: () => getBrand()[key], set: (v) => { setBrand({ [key]: v }); store.emit('overlay'); } });
import { download } from '../export/recorder.js';
import { suggestYoutube, youtubeFor, youtubeText, youtubeProblems, TITLE_MAX } from '../export/youtube.js';
import { DIVISIONS } from '../math/rhythm.js';
import { layerGroups, hasWindow } from '../math/sequence.js';
import { CIRCLE_RULES, chordStep, ruleGroups } from '../circle/sim.js';
import { SCENES, sceneParams } from '../circle/scenes.js';
import { formulaError } from '../circle/battles.js';
import { SPEED_CURVES } from '../circle/layout.js';
import { newLayer } from '../circle/stack.js';
import { CIRCLE_PALETTES } from '../circle/view.js';
import { MELODIES } from '../circle/sound.js';
import { DRUM_KINDS, DRUM_LABELS, TRIGGERS } from '../audio/drum-scanner.js';
import { animatable, describe, removeKey, EASES, LANES, laneOf, keyframeTimes, pathsAt, moveKeyframe, deleteKeyframe, copyKeyframe, setEaseAt } from '../anim/keyframes.js';
import { selection, select as selectKey, clearSelection, onSelect } from '../anim/selection.js';
import { INSTRUMENTS, INSTRUMENT_GROUPS } from '../audio/instruments.js';
import { h, bindPath, bindObj, slider, color, select, toggle, segmented, number, text, group, disposeTree, refreshAll } from './controls.js';
import { FONT_LABELS, formulaAuto } from './overlay.js';

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
    this.renderCircleLayers();
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
    this.renderFormulaTexts();
  }

  /**
   * The formula text as it appears on the video, one editable box per layer. Long formulas
   * wrap on their own; Enter or Shift+Enter starts a new line. “Automatic” goes back to
   * the layer's own formula.
   */
  renderFormulaTexts() {
    if (!this.formulaTexts) return;
    this.formulaTexts.replaceChildren(...store.state.layers.map((l) => {
      const box = h('textarea.formula-box', { rows: 2, spellcheck: 'false', dir: 'ltr', 'aria-label': `Formula text of ${l.name}`, style: `border-left:3px solid ${l.color}` });
      const sync = () => { if (document.activeElement !== box) box.value = l.caption?.trim() ? l.caption : formulaAuto(l); };
      sync();
      box.addEventListener('input', () => { l.caption = box.value === formulaAuto(l) ? '' : box.value; store.emit('overlay'); });
      const auto = h('button.btn.ghost.small', { type: 'button', title: 'Show the layer’s own formula again', onclick: () => { l.caption = ''; box.value = formulaAuto(l); store.emit('overlay'); } }, 'Automatic');
      const capTime = (key) => ({ get: () => l[key] || 0, set: (v) => { l[key] = Math.max(0, +v || 0); store.emit('overlay'); } });
      const when = h('div.grid2', {}, number('Show from (s)', capTime('captionStart'), { min: 0, max: 600, step: 0.5 }), number('until (s)', capTime('captionEnd'), { min: 0, max: 600, step: 0.5 }));
      return h('div.formula-edit', {}, h('div.formula-edit-top', {}, h('span.hint', {}, l.name), auto), box, when);
    }));
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

    // Time: when this layer plays (each layer can have its own window)
    const timeBind = (key) => ({
      get: () => l[key] || 0,
      set: (v) => { l[key] = Math.max(0, Math.min(store.state.transport.duration, +v || 0)); store.emit('sequence'); },
    });
    card.append(group('Time', [
      h('div.grid2', {}, number('Starts at (s)', timeBind('start'), { min: 0, max: 600, step: 0.5 }), number('Ends at (s)', timeBind('end'), { min: 0, max: 600, step: 0.5 })),
      h('button.btn.ghost.small', { type: 'button', onclick: () => { l.start = 0; l.end = 0; store.emit('sequence'); refreshAll(); } }, 'Whole video'),
    ], { open: !!(l.start || l.end), hint: '0 and 0 = plays for the whole video. A layer with its own times plays between them, whatever the other layers do (it takes no step in “one after another”).' }));

    // Sound
    const vol = slider('Volume', bindObj(l, 'volume', `${ev}.sound`), { min: 0, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` });
    card.append(group('Sound', [
      this.soundPicker(l, ev),
      vol,
      select('Notes from', { get: () => l.pitchFrom, set: (v) => { l.pitchFrom = v; store.emit(`${ev}.sound`); refreshAll(); } }, { height: 'The height of the curve', melody: 'A written melody, note by note' }),
      ...(l.pitchFrom === 'melody' ? [
        select('Melody', { get: () => l.melody, set: (v) => { l.melody = v; store.emit(`${ev}.sound`); refreshAll(); } }, Object.fromEntries(Object.entries(MELODIES).filter(([k]) => k !== 'scale').map(([k, m]) => [k, m.label]))),
        ...(l.melody === 'custom' ? [text('Notes', bindObj(l, 'notes', `${ev}.sound`), { placeholder: 'E4 D#4 E4 D#4 E4 B3 D4 C4 A3' })] : []),
        slider('Times through the drawing', bindObj(l, 'melodyLoops', `${ev}.sound`), { min: 1, max: 8, step: 1, fmt: (v) => `×${v}` }),
      ] : []),
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
    this.seqPast.hidden = !(on || store.state.layers.some(hasWindow)); // layers with their own times also finish
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
      ['harmonograph', '〰 Harmonograph', this.harmTab()],
      ['spiro', '✺ Spirograph', this.spiroTab()],
      ['look', 'Look', this.lookTab()],
      ['fx', 'FX', this.fxTab()],
      ['sound', 'Sound', this.soundTab()],
      ['rhythm', 'Rhythm', this.rhythmTab()],
      ['animate', 'Animate', this.animateTab()],
      ['text', 'Text', this.textTab()],
      ['camera', 'Camera', this.cameraTab()],
      ['presets', 'Presets', this.presetsTab()],
      ['daily', '📅 Daily', this.dailyTab()],
      ['audio', '♪ From audio', this.audioTab()],
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
        slider('Hide the drawing for (guess the shape)', p('visual.hideUntil'), { min: 0, max: 20, step: 0.5, fmt: (v) => (v ? `${v} s` : 'off') }),
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
      group('Light style', [
        select('Curve drawn as', p('visual.fx.style'), FX_STYLES),
        slider('Brightness of the lines', p('visual.fx.intensity'), { min: 0.1, max: 1.5, step: 0.01 }),
        slider('Kaleidoscope copies', p('visual.fx.copies'), { min: 2, max: 6, step: 1 }),
        select('Tone', p('visual.tone'), { off: 'Plain (bright overlaps clip to white)', soft: 'Soft (bright overlaps roll off, no white screen)' }),
        slider('Exposure', p('visual.exposure'), { min: 0.4, max: 1.8, step: 0.01 }),
        slider('Lit tail behind the pen', p('visual.fx.tail'), { min: 0.03, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` }),
        slider('Colour split', p('visual.fx.offset'), { min: 0, max: 12, step: 0.1, unit: ' px' }),
        slider('Number of strings', p('visual.fx.strings'), { min: 10, max: 400, step: 1 }),
        slider('String brightness', p('visual.fx.stringAlpha'), { min: 0.02, max: 0.8, step: 0.01 }),
        slider('Whole curve lights up for the last', p('visual.fx.hold'), { min: 0, max: 6, step: 0.1, fmt: (v) => (v ? `${v} s` : 'never') }),
      ], { hint: 'Glitch draws three glowing copies (red, green, cyan) a little apart and adds them, so overlaps turn white, with a jitter now and then. String art draws very faint strings from the centre to points of the curve as it grows. The laser web keeps a fading tail and links the pen to it. For the last seconds the tail opens and the whole curve lights up.' }),
      group('Backdrop', [
        select('Backdrop', p('visual.backdrop'), BACKDROPS),
        color('Backdrop light', p('visual.backdropColor')),
      ], { hint: 'A painted background behind the drawing; it stays put when the camera zooms. The plain background colour above is its dark base.' }),
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

  /** “Fit the notes to the curve”: pick the lowest and highest note you want the drawing to play. */
  fitNotesBox() {
    const readout = h('p.hint.note-readout', {}, 'Press Measure to see which notes the curve plays.');
    const lo = h('select', { 'aria-label': 'Lowest note of the curve' });
    const hi = h('select', { 'aria-label': 'Highest note of the curve' });
    // only notes of the current scale (any note for a continuous glide), C1 to C7
    const fill = () => {
      const { scale, root } = store.state.audio;
      const notes = scale === 'continuous' ? Array.from({ length: 73 }, (_, i) => 24 + i) : scaleNotesBetween(scale, root, 24, 96);
      for (const [sel, def] of [[lo, +sel0(lo, 48)], [hi, +sel0(hi, 71)]]) {
        sel.replaceChildren(...notes.map((n) => h('option', { value: n }, `${noteName(n)} (${n})`)));
        sel.value = String(notes.reduce((a, b) => (Math.abs(b - def) < Math.abs(a - def) ? b : a), notes[0]));
      }
    };
    const sel0 = (sel, d) => (sel.value !== '' ? sel.value : d);
    const show = (m) => {
      if (!m) { readout.textContent = 'Nothing sounds yet (no active layer, or it is flat).'; return; }
      readout.textContent = `The curve plays ${noteName(m.low)} (lowest) to ${noteName(m.high)} (highest): graph y from ${m.y0.toFixed(2)} to ${m.y1.toFixed(2)}.`;
      lo.value = String(Math.round(m.low)); hi.value = String(Math.round(m.high));
    };
    fill();
    lo.addEventListener('focus', fill); hi.addEventListener('focus', fill);
    return h('div.ctl.fit-notes', {},
      h('span.ctl-label', {}, 'Fit the notes to the curve'),
      readout,
      h('div.row', {}, h('label', {}, 'Lowest ', lo), h('label', {}, 'Highest ', hi)),
      h('div.row', {},
        h('button.btn.small', { type: 'button', title: 'Set the note range so the lowest point of the drawing plays the lowest note and the highest point the highest note', onclick: () => { const m = this.actions.fitNotes(+lo.value, +hi.value); if (m) { show(m); refreshAll(); } } }, 'Fit notes to the curve'),
        h('button.btn.small.ghost', { type: 'button', title: 'Show the lowest and highest note the curve really plays', onclick: () => { fill(); show(this.actions.measureCurve()); } }, 'Measure')));
  }

  soundTab() {
    const p = bindPath;
    const noteFmt = (v) => `${noteName(v)} (${v})`;
    const pct = (v) => (v ? `${Math.round(v * 100)}%` : 'Off');
    const hz = (v) => `${v < 1 ? v.toFixed(2) : v.toFixed(1)} Hz`;
    // 115 scales, in groups (world music, psychedelic, microtonal …)
    const scale = select('Scale', p('audio.scale'), {});
    const sel = scale.querySelector('select');
    sel.classList.add('scale-select');
    sel.replaceChildren(...SCALE_GROUPS.map(([g, keys]) => h('optgroup', { label: g }, keys.map((k) => h('option', { value: k }, SCALE_LABELS[k])))));
    sel.value = store.get('audio.scale');
    this.soundPresets = new SoundPresetView({ toast: this.actions.toast, loadInstrument: (id) => this.applyInstrumentEverywhere(id) });
    return h('section.tab', {},
      this.soundPresets.el,
      group('Output', [
        slider('Master volume', p('audio.master'), { min: 0, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` }),
      ]),
      group('Pitch mapping', [
        slider('Lowest note (y min)', p('audio.noteLow'), { min: 0, max: 100, step: 1, fmt: noteFmt }),
        slider('Highest note (y max)', p('audio.noteHigh'), { min: 12, max: 127, step: 1, fmt: noteFmt }),
        this.fitNotesBox(),
        scale,
        select('Key', p('audio.root'), NOTE_NAMES.map((n, i) => [i, n])),
        select('Tuning (A4)', p('audio.tuning'), [[440, '440 Hz · standard'], [432, '432 Hz · “calm”'], [444, '444 Hz · bright'], [415, '415 Hz · baroque'], [466, '466 Hz · high']]),
        slider('Glide', p('audio.glide'), { min: 0, max: 400, step: 1, unit: ' ms' }),
        h('div.ctl', {}, h('span.ctl-label', {}, 'Articulation'), segmented(p('audio.articulation'), [['legato', 'Legato', 'Continuous tone'], ['pluck', 'Pluck', 'New attack on every note change']], { label: 'Articulation' })),
      ], { hint: 'Pick a scale so any curve stays in key: 115 scales from the modes to Arabic maqamat, Persian dastgah, Indian ragas, Japanese, Chinese, gamelan, Ethiopian and psychedelic/microtonal ones. Continuous = pure glissando.' }),
      group('Drone (tanpura / pad)', [
        slider('Volume', p('audio.drone.volume'), { min: 0, max: 1, step: 0.01, fmt: pct }),
        select('Octave', p('audio.drone.octave'), [[1, 'Low (C2)'], [2, 'Middle (C3)'], [3, 'High (C4)']]),
        toggle('Add the fifth', p('audio.drone.fifth')),
        slider('Brightness', p('audio.drone.bright'), { min: 0, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` }),
      ], { open: false, hint: 'Holds the key note (and its fifth) under the melody while playing, like a tanpura in Indian music or a pad. Great with ragas and maqamat.' }),
      group('Filter', [
        select('Type', p('audio.filter.type'), { lowpass: 'Low-pass', highpass: 'High-pass', bandpass: 'Band-pass', notch: 'Notch' }),
        slider('Cutoff', {
          get: () => Math.log10(store.get('audio.filter.cutoff')),
          set: (v) => store.set('audio.filter.cutoff', Math.round(10 ** v)),
        }, { min: 1.3, max: 4.3, step: 0.001, fmt: (v) => { const f = 10 ** v; return f >= 1000 ? `${(f / 1000).toFixed(1)} kHz` : `${Math.round(f)} Hz`; } }),
        slider('Resonance', p('audio.filter.q'), { min: 0.1, max: 18, step: 0.1 }),
        slider('Wah (filter sweep)', p('audio.filter.lfo'), { min: 0, max: 1, step: 0.01, fmt: pct }),
        slider('Wah speed', p('audio.filter.lfoRate'), { min: 0.05, max: 8, step: 0.05, fmt: hz }),
      ]),
      group('Drive & lo-fi', [
        slider('Drive', p('audio.distortion'), { min: 0, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` }),
        slider('Lo-fi (bit crush)', p('audio.crush'), { min: 0, max: 1, step: 0.01, fmt: pct }),
      ]),
      group('Modulation', [
        h('div.ctl', {}, h('span.ctl-label', {}, 'Effect'), segmented(p('audio.mod.type'), [['off', 'Off'], ['chorus', 'Chorus', 'Wide and shimmering'], ['flanger', 'Flanger', 'Jet-plane sweep'], ['phaser', 'Phaser', 'Swirling, psychedelic']], { label: 'Modulation effect' })),
        slider('Speed', p('audio.mod.rate'), { min: 0.05, max: 6, step: 0.05, fmt: hz }),
        slider('Depth', p('audio.mod.depth'), { min: 0, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` }),
        slider('Mix', p('audio.mod.mix'), { min: 0, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` }),
      ], { open: false }),
      group('Movement', [
        slider('Tremolo', p('audio.motion.tremolo'), { min: 0, max: 1, step: 0.01, fmt: pct }),
        slider('Tremolo speed', p('audio.motion.tremoloRate'), { min: 0.5, max: 16, step: 0.1, fmt: hz }),
        slider('Auto-pan (left ↔ right)', p('audio.motion.autopan'), { min: 0, max: 1, step: 0.01, fmt: pct }),
        slider('Pan speed', p('audio.motion.panRate'), { min: 0.05, max: 4, step: 0.05, fmt: hz }),
        slider('Pump (sidechain)', p('audio.pump.amount'), { min: 0, max: 0.95, step: 0.01, fmt: pct }),
        select('Pump every', p('audio.pump.rate'), [[0.5, '½ beat'], [1, 'Beat'], [2, '2 beats']]),
      ], { open: false, hint: 'Pump ducks the sound on every beat of the project tempo (Rhythm tab), the “breathing” EDM effect. Auto-pan is best on headphones.' }),
      group('Delay', [
        slider('Time', p('audio.delay.time'), { min: 0.02, max: 1.5, step: 0.005, unit: ' s' }),
        slider('Feedback', p('audio.delay.feedback'), { min: 0, max: 0.9, step: 0.01 }),
        slider('Mix', p('audio.delay.mix'), { min: 0, max: 1, step: 0.01 }),
        toggle('Ping-pong (left, right, left …)', p('audio.delay.pingpong')),
      ]),
      group('Reverb', [
        slider('Decay', p('audio.reverb.decay'), { min: 0.3, max: 8, step: 0.1, unit: ' s' }),
        slider('Mix', p('audio.reverb.mix'), { min: 0, max: 1, step: 0.01 }),
        slider('Brightness', p('audio.reverb.tone'), { min: 0, max: 1, step: 0.01, fmt: (v) => (v < 0.3 ? 'Dark hall' : v > 0.8 ? 'Bright plate' : 'Warm room') }),
        slider('Pre-delay', p('audio.reverb.preDelay'), { min: 0, max: 0.25, step: 0.005, fmt: (v) => `${Math.round(v * 1000)} ms` }),
      ]),
    );
  }

  /** Set one instrument on every formula layer and on the Circle Lab (sound presets with an instrument). */
  applyInstrumentEverywhere(id) {
    for (const l of store.state.layers) l.wave = id;
    store.state.circle.sound.instrument = id;
    for (const c of store.state.circle.layers || []) if (c.cfg?.sound) c.cfg.sound.instrument = id;
    store.emit('layers');
    store.emit('circle');
    refreshAll();
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
      group('Final shot', [
        select('The last seconds', p('camera.ending'), ENDINGS),
        slider('Length', p('camera.endingSecs'), { min: 0.5, max: 5, step: 0.1, unit: ' s' }),
      ], { hint: 'A deliberate last shot, so the video clearly ends: the camera pulls back or pushes in and the glow flares. In the Light style panel, the curve also lights up in full for the last seconds.' }),
      group('Camera moves', [
        h('div.chips', {}, CAMERA_STYLES.map(([label, cfg, tip]) => h('button.chip', { type: 'button', title: tip, onclick: () => {
          store.state.camera = { ...store.state.camera, ...CAMERA_MOVE_DEFAULTS, ...cfg };
          store.emit('camera');
          refreshAll();
        } }, label))),
        slider('Zoom', p('camera.zoom'), { min: 0.4, max: 4, step: 0.01, fmt: (v) => `×${(+v).toFixed(2)}` }),
        slider('Push-in / pull-out', p('camera.push'), { min: -1, max: 1, step: 0.01, fmt: (v) => (v > 0.005 ? `push-in ${Math.round(v * 100)}%` : v < -0.005 ? `pull-out ${Math.round(-v * 100)}%` : 'Off') }),
        slider('Beat breathing', p('camera.breathe'), { min: 0, max: 1, step: 0.01, fmt: (v) => (v ? `${Math.round(v * 100)}%` : 'Off') }),
        slider('Drift (floating)', p('camera.drift'), { min: 0, max: 1, step: 0.01, fmt: (v) => (v ? `${Math.round(v * 100)}%` : 'Off') }),
        slider('Handheld shake', p('camera.shake'), { min: 0, max: 1, step: 0.01, fmt: (v) => (v ? `${Math.round(v * 100)}%` : 'Off') }),
        slider('Tilt sway', p('camera.sway'), { min: 0, max: 1, step: 0.01, fmt: (v) => (v ? `${Math.round(v * 100)}%` : 'Off') }),
        slider('Spin', p('camera.spin'), { min: -30, max: 30, step: 0.5, fmt: (v) => (v ? `${v}°/s` : 'Off') }),
      ], { hint: 'Moves that play by themselves on top of your camera, in 2D, 3D and the Circle Lab, and in every export. Pick a style to start, then adjust. Push-in grows slowly over the whole video; breathing pulses with the tempo (Rhythm tab).' }),
    );
  }

  presetsTab() {
    this.library = new LibraryView({
      loadPreset: (p) => this.actions.loadPreset(p),
      toast: this.actions.toast,
      snapshot: () => store.snapshot(),
      download,
      renderVideos: (items) => this.actions.renderBatch(items),
      addToDaily: (x) => this.daily?.enqueue(x.name, x.preset, x.preset.$shelf || ''),
    });
    return this.library.el;
  }

  harmTab() {
    this.harm = new HarmonographTab({ circleTarget: () => this.circleTarget(), toast: this.actions.toast });
    return this.harm.el;
  }

  spiroTab() {
    this.spiro = new SpiroTab({ circleTarget: () => this.circleTarget(), toast: this.actions.toast });
    return this.spiro.el;
  }

  renderSpiro() { this.spiro?.render(); }

  /** Rebuild the Harmonograph tab (the layer or its simulation changed). */
  renderHarmonograph() { this.harm?.render(); }

  audioTab() {
    this.audioLab = new AudioLabView({
      loadPreset: (p) => this.actions.loadPreset(p),
      toast: this.actions.toast,
      download,
      savePreset: (preset, o) => this.library.addPreset(preset, o),
    });
    return h('section.tab', {}, this.audioLab.el);
  }

  dailyTab() {
    this.daily = new DailyView({
      loadPreset: (p) => this.actions.loadPreset(p),
      toast: this.actions.toast,
      snapshot: () => store.snapshot(),
      download,
      renderVideos: (items) => this.actions.renderBatch(items),
      savePreset: (preset, o) => this.library.addPreset(preset, o),
    });
    return this.daily.el;
  }

  /* ------------------------------------------------------------- circle lab */

  circleTab() {
    this.circleBody = h('div.tab-inner');
    const tab = h('section.tab', {}, this.circleBody);
    this.renderCircle();
    return tab;
  }

  /** Rebuild the Circle Lab controls (the visible options depend on the rule). */
  /** Which circle layer the Circle tab edits: 0 = the first (state.circle), n = circle.layers[n − 1]. */
  circleTarget() {
    const c = store.state.circle;
    const idx = Math.max(0, Math.min(this.circleEdit || 0, (c.layers || []).length));
    this.circleEdit = idx;
    return { idx, base: idx ? `circle.layers.${idx - 1}.cfg` : 'circle', L: idx ? c.layers[idx - 1].cfg : c };
  }

  /** Rebuild the Circle Lab controls (the visible options depend on the rule and the layer). */
  renderCircle() {
    if (!this.circleBody) return;
    disposeTree(this.circleBody);
    const p = bindPath;
    const c = store.state.circle;
    const { idx, base, L } = this.circleTarget();
    const P = (k) => bindPath(`${base}.${k}`);
    const on = store.state.mode === 'circle';
    const pct = (v) => `${Math.round(v * 100)}%`;
    const parts = [];
    if (!on) {
      parts.push(h('div.circle-intro', {},
        h('p.hint', {}, 'Circle Lab: balls, blades, battles and drawing machines move inside the frame and every hit plays a note. Trails build up into stars, mandalas and fractals — the “satisfying” Shorts genre.'),
        h('button.btn.export-btn', { type: 'button', onclick: () => { store.set('mode', 'circle'); refreshAll(); } }, '◎ Switch to Circle Lab')));
    }
    if (c.layers?.length) {
      // which layer these controls edit
      parts.push(h('div.chips.circle-edit-chips', {}, ...[c, ...c.layers.map((l) => l.cfg)].map((cfg, i) =>
        h('button.chip', { type: 'button', 'aria-pressed': String(i === idx), onclick: () => { this.circleEdit = i; this.renderCircle(); this.renderCircleLayers(); } }, `${i + 1} · ${CIRCLE_RULES[cfg.rule] || cfg.rule}`))));
    }
    // simulation picker, grouped
    const ruleSel = h('select', { 'aria-label': 'Simulation' }, ruleGroups().map(([g, items]) => h('optgroup', { label: g }, items.map(([id, label]) => h('option', { value: id }, label)))));
    ruleSel.value = L.rule;
    ruleSel.addEventListener('change', () => store.set(`${base}.rule`, ruleSel.value));
    const nRules = Object.keys(CIRCLE_RULES).length;
    parts.push(group(idx ? `Layer ${idx + 1}: simulation` : 'Simulation', [
      h('div.ctl.ctl-select', {}, h('label', {}, `Simulation (${nRules})`), ruleSel),
      h('div.row', {},
        number('Random seed', P('seed'), { min: 1, max: 9999 }),
        h('button.btn.ghost.small', { type: 'button', title: 'Another variation of the same simulation', onclick: () => { store.set(`${base}.seed`, 1 + Math.floor(Math.random() * 9999)); refreshAll(); } }, '🎲 New variation')),
    ], { hint: 'Everything is deterministic: the same settings always give the same video and sound. A new seed gives another variation.' }));
    // when this layer plays (layer 1 is state.circle itself, the others live in circle.layers)
    const timePath = (key) => (idx ? `circle.layers.${idx - 1}.${key}` : `circle.${key}`);
    const timeBind = (key) => ({ get: () => store.get(timePath(key)) || 0, set: (v) => { store.set(timePath(key), Math.max(0, Math.min(store.state.transport.duration, +v || 0))); } });
    parts.push(group(idx ? `Layer ${idx + 1}: time` : 'Time', [
      h('div.grid2', {}, number('Starts at (s)', timeBind('start'), { min: 0, max: 600, step: 0.5 }), number('Ends at (s)', timeBind('end'), { min: 0, max: 600, step: 0.5 })),
    ], { open: !!(store.get(timePath('start')) || store.get(timePath('end'))), hint: '0 and 0 = plays for the whole video. A layer with its own times starts and stops there (it fades in and out) whatever the other layers do.' }));

    const scene = SCENES[L.rule];
    if (scene) {
      const cur = () => this.circleTarget().L;
      const sb = (key) => ({
        get: () => sceneParams(cur())[key],
        set: (v) => { const cc = cur(); store.set(`${base}.lab.${cc.rule}`, { ...(cc.lab?.[cc.rule] || {}), [key]: v }); },
      });
      const ctls = scene.controls.filter(Boolean).map(([key, label, kind, a, b, st, unit]) => {
        if (kind === 's') return select(label, sb(key), a);
        if (kind === 't') return toggle(label, sb(key));
        if (kind === 'x') return text(label, sb(key), { placeholder: a });
        if (kind === 'f') {
          // a formula: show what is wrong as you type, else which variables it can use
          const ctl = text(`${label}`, sb(key), { placeholder: a });
          const err = h('p.hint.formula-error');
          const check = () => { const e = formulaError(sceneParams(cur())[key], b); err.textContent = e ? `⚠ ${e}` : `variables: ${b.join(', ')}`; err.style.color = e ? '#ff6b81' : 'var(--muted, #8a93a6)'; };
          ctl.querySelector('input').addEventListener('input', check);
          check();
          return h('div', {}, ctl, err);
        }
        return slider(label, sb(key), { min: a, max: b, step: st, unit: unit || '' });
      });
      ctls.push(h('button.btn', { type: 'button', onclick: () => { store.set(`${base}.lab.${cur().rule}`, {}); refreshAll(); } }, 'Reset these to the defaults'));
      parts.push(group(scene.label, ctls));
    }

    if (L.rule === 'chord') {
      const stepIn = text('Step per hit (fraction of a turn)', P('chord.step'), { placeholder: '1/phi^2' });
      const info = h('p.hint.circle-step');
      const showStep = () => {
        const v = chordStep(this.circleTarget().L.chord.step);
        const deg = (v * 360) % 360;
        // a rational step p/q closes after q hits; irrational ones never close
        let close = '';
        for (let q = 1; q <= 400; q++) { if (Math.abs(v * q - Math.round(v * q)) < 1e-9) { close = `closes after ${q} hits`; break; } }
        info.textContent = `= ${v.toFixed(6)} turn = ${deg.toFixed(3)}° · ${close || 'never closes (irrational): fills the disc'}`;
      };
      stepIn.querySelector('input').addEventListener('input', showStep);
      showStep();
      const chip = (label, expr) => h('button.chip', { type: 'button', onclick: () => { store.set(`${base}.chord.step`, expr); refreshAll(); showStep(); } }, label);
      parts.push(group('Chord walker', [
        stepIn, info,
        h('div.chips', {}, chip('1/φ² golden', '1/phi^2'), chip('1/φ', '1/phi'), chip('2/5 star', '2/5'), chip('3/7', '3/7'), chip('5/13', '5/13'),
          chip('8/21', '8/21'), chip('√2 − 1', 'sqrt(2) - 1'), chip('π − 3', 'pi - 3'), chip('e − 2', 'e - 2'), chip('11/24', '11/24')),
        slider('Walkers', P('chord.walkers'), { min: 1, max: 12, step: 1 }),
        slider('Speed', P('chord.speed'), { min: 0.2, max: 8, step: 0.05 }),
        slider('Speed-up per hit', P('chord.speedGain'), { min: 1, max: 1.06, step: 0.001, fmt: (v) => `×${v.toFixed(3)}` }),
        slider('Start angle', P('chord.start'), { min: 0, max: 360, step: 1, unit: '°' }),
      ], { hint: 'Write any expression: 1/phi^2, 2/5, sqrt(2)-1, pi-3… Fibonacci ratios (5/13, 8/21, 13/34) look golden for a while, then close.' }));
    }
    if (['bounce', 'split', 'grow', 'escape'].includes(L.rule)) {
      parts.push(group('Balls & physics', [
        slider('Balls', P('physics.balls'), { min: 1, max: 32, step: 1 }),
        slider('Speed', P('physics.speed'), { min: 0.2, max: 5, step: 0.05 }),
        slider('Launch angle', P('physics.angle'), { min: 0, max: 360, step: 1, unit: '°' }),
        slider('Gravity', P('physics.gravity'), { min: 0, max: 8, step: 0.1 }),
        slider('Bounciness', P('physics.restitution'), { min: 0.5, max: 1.1, step: 0.01, fmt: pct }),
        slider('Speed-up per bounce', P('physics.speedGain'), { min: 1, max: 1.08, step: 0.002, fmt: (v) => `×${v.toFixed(3)}` }),
        slider('Top speed', P('physics.maxSpeed'), { min: 1, max: 12, step: 0.1 }),
        slider('Ball size', P('physics.size'), { min: 0.005, max: 0.2, step: 0.005 }),
      ]));
    }
    if (L.rule === 'split') {
      parts.push(group('Split', [
        slider('Split angle', P('split.angle'), { min: 1, max: 60, step: 0.5, unit: '°' }),
        slider('Most balls', P('split.max'), { min: 2, max: 512, step: 1 }),
      ]));
    }
    if (L.rule === 'grow') {
      parts.push(group('Grow', [
        slider('Growth per bounce', P('grow.amount'), { min: 0.001, max: 0.04, step: 0.001 }),
        slider('Stop at', P('grow.until'), { min: 0.3, max: 0.99, step: 0.01, fmt: pct }),
      ]));
    }
    if (L.rule === 'escape') {
      parts.push(group('Rings', [
        slider('Rings', P('escape.rings'), { min: 1, max: 14, step: 1 }),
        slider('Innermost ring', P('escape.inner'), { min: 0.1, max: 0.9, step: 0.01, fmt: pct }),
        slider('Gap', P('escape.gap'), { min: 5, max: 120, step: 1, unit: '°' }),
        slider('Ring spin', P('escape.spin'), { min: 0, max: 5, step: 0.05 }),
      ], { hint: 'The ball bounces inside the innermost ring; hitting its gap breaks it and frees the ball into the next one.' }));
    }
    if (L.rule === 'polyrhythm') {
      parts.push(group('Polyrhythm', [
        slider('Dots', P('poly.dots'), { min: 2, max: 32, step: 1 }),
        slider('Swings of the slowest dot', P('poly.base'), { min: 1, max: 80, step: 1 }),
        slider('Cycle (all line up again)', P('poly.cycle'), { min: 5, max: 300, step: 1, unit: ' s' }),
      ], { hint: 'Dot k swings base + k times per cycle; after one cycle every dot is back at the start together.' }));
    }
    parts.push(group('Speed over time', [
      slider('Speed at the start', P('speed.from'), { min: 0, max: 4, step: 0.01, fmt: (v) => `×${v.toFixed(2)}` }),
      slider('Speed at the end', P('speed.to'), { min: 0, max: 4, step: 0.01, fmt: (v) => `×${v.toFixed(2)}` }),
      select('How it changes', P('speed.curve'), SPEED_CURVES),
      slider('Pulse on every beat', P('speed.pulse'), { min: 0, max: 3, step: 0.05 }),
      h('div.chips', {}, ...[['Steady', 1, 1, 'linear', 0], ['Speed up ×3', 0.7, 2.2, 'build', 0], ['Slow-mo ending', 1.2, 0.25, 'late', 0], ['Fast start', 2.5, 0.8, 'early', 0], ['Breathing', 0.6, 1.6, 'wave', 0], ['Beat pulse', 0.8, 0.8, 'linear', 1.2]]
        .map(([label, from, to, curve, pulse]) => h('button.chip', { type: 'button', onclick: () => { store.set(`${base}.speed`, { from, to, curve, pulse }); refreshAll(); } }, label))),
    ], { hint: 'How fast the motion runs while the video plays (×1 = normal). The notes follow the motion, so the music speeds up and slows down with it.' }));
    parts.push(group('Sound', [
      this.soundPickerFor(P('sound.instrument')),
      select('Notes from', P('sound.pitch'), { angle: 'Where it happens (position, size, value)', melody: 'A melody, note by note', rise: 'Rising scale', ball: 'Each ball / object its own note' }),
      ...(L.sound.pitch === 'melody' ? [select('Melody', P('sound.melody'), Object.fromEntries(Object.entries(MELODIES).map(([k, m]) => [k, m.label])))] : []),
      ...(L.sound.pitch === 'melody' && L.sound.melody === 'custom' ? [text('Notes', P('sound.notes'), { placeholder: 'E4 D#4 E4 D#4 E4 B3 D4 C4 A3' })] : []),
      select('Drum on every hit', P('sound.drum'), { off: 'None', kick: 'Kick', snare: 'Snare', clap: 'Clap', hat: 'Hi-hat' }),
      slider('Note length', P('sound.length'), { min: 0.05, max: 2, step: 0.01, unit: ' s' }),
      slider('Volume', P('sound.volume'), { min: 0, max: 1, step: 0.01, fmt: pct }),
      slider('Most notes per second', P('sound.maxRate'), { min: 4, max: 60, step: 1 }),
    ], { hint: 'Key and note range come from the Sound tab (scale, root, low/high note). Very fast hits are thinned so it stays musical.' }));
    parts.push(group('Look', [
      select('Palette', P('look.palette'), CIRCLE_PALETTES),
      select('Trail', P('look.trail'), { lines: 'Lines stay (pattern builds up)', fade: 'Lines fade', none: 'No trail' }),
      slider('Line width', P('look.trailWidth'), { min: 0.3, max: 6, step: 0.1 }),
      slider('Glow', P('look.glow'), { min: 0, max: 2.5, step: 0.05 }),
      slider('Ring width', P('look.ringWidth'), { min: 0, max: 16, step: 0.5 }),
      slider('Ball size', P('look.ballSize'), { min: 0.3, max: 3, step: 0.05, fmt: (v) => `×${v.toFixed(2)}` }),
      toggle('Sparks on impact', P('look.sparks')),
      toggle('Ring pulses on hits', P('look.ringPulse')),
      toggle('Comet tail', P('look.comet')),
    ]));
    parts.push(group('Size & place', [
      slider('Zoom', P('look.zoom'), { min: 0.3, max: 1.3, step: 0.01, fmt: pct }),
      slider('Move right / left', P('look.dx'), { min: -1, max: 1, step: 0.01 }),
      slider('Move up / down', P('look.dy'), { min: -1.3, max: 1.3, step: 0.01 }),
      h('div.chips', {}, ...[['Full', 1, 0, 0], ['Top half', 0.5, 0, 0.6], ['Bottom half', 0.5, 0, -0.6], ['Left', 0.5, -0.5, 0], ['Right', 0.5, 0.5, 0], ['Small centre', 0.6, 0, 0]]
        .map(([label, z, dx, dy]) => h('button.chip', { type: 'button', onclick: () => { store.set(`${base}.look.zoom`, z); store.set(`${base}.look.dx`, dx); store.set(`${base}.look.dy`, dy); refreshAll(); } }, label))),
    ], { hint: 'Useful with layers that play together: put two simulations one above the other, or side by side.' }));
    parts.push(group('Frame', [
      slider('Bloom', p('circle.look.bloom'), { min: 0, max: 2.5, step: 0.05 }),
      toggle('Living background (light, dust, ripples)', p('circle.look.ambience')),
      color('Background', p('circle.look.background')),
    ], { hint: 'For the whole video (all layers).' }));
    parts.push(group('Text on the video', [
      text(idx ? `Line above layer ${idx + 1}` : 'Line above the simulation', P('text.formula'), { placeholder: idx ? 'Automatic: plain words for this simulation' : 'Automatic: the question below, or plain words' }),
      select('Automatic text', P('text.show'), { caption: 'Plain words / a question', formula: 'The formula' }),
      ...(idx ? [] : [text('Question (also the YouTube hook line)', p('hook.text'), { placeholder: 'e.g. Will this pattern ever close?' })]),
      toggle('Show the line + counter', p('overlay.formulas.enabled')),
      slider('Text size', p('overlay.formulas.size'), { min: 0.4, max: 2.5, step: 0.05, fmt: (v) => `×${v.toFixed(2)}` }),
      toggle('Counter (balls / pieces / bounces)', p('circle.look.counter')),
      text('Counter label', P('text.counter'), { placeholder: 'Automatic, e.g. balls:' }),
      toggle('Show the preset name', p('overlay.name.enabled')),
      text('Name', p('name'), { placeholder: 'Preset name' }),
      slider('Name size', p('overlay.name.size'), { min: 0.5, max: 3, step: 0.05, fmt: (v) => `×${v.toFixed(2)}` }),
      toggle('Opening hook (teaser + flash, exported videos)', p('record.hook.enabled')),
    ], { hint: 'Keep it light: one short line that tells the viewer what to watch for. With layers, each layer can have its own line.' }));
    this.circleBody.replaceChildren(...parts);
  }

  /** Circle layers in the left panel: one after another or together, linked steps, order. */
  renderCircleLayers() {
    const box = document.getElementById('circle-layers');
    if (!box) return;
    disposeTree(box);
    const c = store.state.circle;
    const layers = c.layers || [];
    const all = [{ id: 'main', enabled: true, withPrev: false, cfg: c }, ...layers];
    const { idx } = this.circleTarget();
    const seq = c.combine === 'sequence';
    const steps = seq ? all.filter((l) => l.enabled).reduce((n, l, i) => n + (i === 0 || !l.withPrev ? 1 : 0), 0) : 1;
    const dur = store.state.transport.duration;
    const edit = (i) => { this.circleEdit = i; this.renderCircle(); this.renderCircleLayers(); this.showTab?.('circle'); };
    const change = () => { store.emit('circle.layers'); };
    const cards = all.map((l, i) => {
      const card = h('article.layer.circle-layer', { dataset: { id: l.id } });
      card.classList.toggle('is-editing', i === idx);
      card.classList.toggle('is-hidden', !l.enabled);
      card.classList.toggle('is-linked', seq && !!l.withPrev && i > 0);
      if (i > 0 && seq) {
        const link = h('button.layer-link', { type: 'button', 'aria-pressed': String(!!l.withPrev) },
          l.withPrev ? '🔗 Plays together with the layer above' : '⛓ Starts its own step · click to play with the layer above');
        link.addEventListener('click', () => { l.withPrev = !l.withPrev; change(); });
        card.append(link);
      }
      const vis = h('button.icon-btn', { type: 'button', title: l.enabled ? 'Hide layer' : 'Show layer', disabled: i === 0 }, l.enabled ? '◉' : '○');
      vis.addEventListener('click', () => { l.enabled = !l.enabled; change(); });
      const move = (d) => { const j = i - 1 + d; if (j < 0 || j >= layers.length) return; [layers[i - 1], layers[j]] = [layers[j], layers[i - 1]]; this.circleEdit = j + 1; change(); };
      card.append(h('header.layer-head', {},
        h('span.circle-layer-num', {}, String(i + 1)),
        h('button.circle-layer-name', { type: 'button', title: 'Edit this layer in the Circle tab', onclick: () => edit(i) }, CIRCLE_RULES[l.cfg.rule] || l.cfg.rule),
        vis,
        h('div.layer-menu', {},
          h('button.icon-btn', { type: 'button', title: 'Move up', disabled: i < 2, onclick: () => move(-1) }, '↑'),
          h('button.icon-btn', { type: 'button', title: 'Move down', disabled: i === 0 || i === all.length - 1, onclick: () => move(1) }, '↓'),
          h('button.icon-btn', { type: 'button', title: 'Duplicate', disabled: all.length >= 6, onclick: () => { layers.splice(i, 0, { ...newLayer(l.cfg, l.cfg.rule, `C${Date.now().toString(36)}`), withPrev: false }); this.circleEdit = i + 1; change(); } }, '⧉'),
          h('button.icon-btn.danger', { type: 'button', title: 'Delete layer', disabled: i === 0, onclick: () => { layers.splice(i - 1, 1); this.circleEdit = Math.min(i, layers.length); change(); } }, '✕'))));
      return card;
    });
    const addSel = h('select', { 'aria-label': 'Simulation for the new layer' }, ruleGroups().map(([g, items]) => h('optgroup', { label: g }, items.map(([id, label]) => h('option', { value: id }, label)))));
    addSel.value = 'chaos';
    const add = h('button.btn.small', { type: 'button', disabled: all.length >= 6, onclick: () => {
      layers.push(newLayer(all[idx].cfg, addSel.value, `C${Date.now().toString(36)}`));
      this.circleEdit = layers.length;
      change();
    } }, '+ Add layer');
    box.replaceChildren(
      h('p.hint', {}, '◎ Circle Lab: pick and tune each layer in the Circle tab on the right.'),
      h('div.ctl', {}, h('span.ctl-label', {}, 'Play layers'),
        segmented(bindPath('circle.combine'), [['sequence', 'One after another', 'Each step plays in turn (linked layers play together inside a step)'], ['together', 'Together', 'All layers play at the same time, on top of each other']], { label: 'Layer playback' })),
      h('p.hint', {}, all.length < 2 ? 'Add a layer to tell a story: e.g. a question, then the answer.' : seq ? `${steps} step${steps === 1 ? '' : 's'} × ${(dur / steps).toFixed(1)} s` : `${all.filter((l) => l.enabled).length} layers at once · use “Size & place” to give each its spot`),
      h('div.layer-list', {}, cards),
      h('div.row', {}, addSel, add));
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

  /** The one place to export anything: pick what to make, press the one button. */
  exportTab() {
    const p = bindPath;
    const live = this.actions.videoFormat();
    const smooth = this.actions.canRenderVideo();
    const KINDS = [['video', 'Video · MP4'], ['wav', 'Audio · WAV'], ['midi', 'MIDI · notes'], ['png', 'Image · PNG'], ['live', 'Live capture · real time']];
    let kind = 'video';
    try { kind = localStorage.getItem('mmv.exportAs') || 'video'; } catch { /* storage blocked */ }
    if (!KINDS.some(([k]) => k === kind)) kind = 'video';
    this.exportRecording = false;
    const btn = h('button.btn.export-btn', { type: 'button', onclick: () => this.runExport(kind) });
    const hint = h('p.hint');
    const fromStart = toggle('Capture one full pass from the start', p('record.fromStart'));
    const bpm = number('MIDI tempo (BPM)', p('transport.bpm'), { min: 30, max: 300 });
    const HINTS = {
      video: smooth
        ? 'Renders every frame at its exact time: a smooth, constant-frame-rate MP4 (H.264 + AAC) that plays and seeks everywhere. With “npm start” and ffmpeg installed, ffmpeg does the encoding. The Frame (16:9, 9:16…) comes from the Look tab; size, quality and the Shorts hook are below.'
        : 'This browser has no video encoder (WebCodecs). Use Chrome or Edge, or Live capture.',
      wav: 'Renders the full timeline offline: faster than real time, with no dropped frames, drums and animated effects included.',
      midi: 'One track per layer, notes snapped to your scale (quarter tones are rounded to the nearest semitone). Open it in any DAW.',
      png: 'Saves the picture on the stage right now.',
      live: live ? `Records what plays on screen as ${live.ext.toUpperCase()} (shortcut R). Quality depends on how fast your computer draws; “Video · MP4” gives the best result.` : 'Live capture is not supported in this browser.',
    };
    const refresh = () => {
      btn.textContent = { video: '⬇ Export video (MP4)', wav: '⬇ Export audio (WAV)', midi: '⬇ Export MIDI', png: '⬇ Save image (PNG)', live: this.exportRecording ? '■ Stop recording' : '● Start recording' }[kind];
      btn.classList.toggle('is-recording', kind === 'live' && this.exportRecording);
      hint.textContent = HINTS[kind];
      fromStart.hidden = kind !== 'live';
      bpm.hidden = kind !== 'midi';
    };
    this.refreshExport = refresh;
    refresh();
    return h('section.tab', {},
      group('Export', [
        select('Make', { get: () => kind, set: (v) => { kind = v; try { localStorage.setItem('mmv.exportAs', v); } catch { /* ignore */ } refresh(); } }, KINDS),
        fromStart, bpm, btn, hint,
      ]),
      group('Video settings', [
        text('File name', p('record.fileName'), { placeholder: 'Same as the project name' }),
        select('Resolution', p('record.resolution'), { '720p': '720p', '1080p': '1080p · Full HD', '1440p': '1440p · 2K', '2160p': '2160p · 4K' }),
        select('Frame rate', p('record.fps'), [[24, '24 fps · film'], [30, '30 fps'], [60, '60 fps · smoothest']]),
        select('Quality', p('record.quality'), { standard: 'Standard · smaller file', high: 'High', max: 'Maximum · large file' }),
        select('Motion blur', p('record.subframes'), [[1, 'Off · fastest'], [2, 'Natural · 2 sub-frames'], [4, 'Cinematic · 4 sub-frames']]),
        select('Encoder', p('record.engine'), { auto: 'Automatic · ffmpeg when available', ffmpeg: 'ffmpeg on this computer (npm start)', browser: 'Browser (WebCodecs)' }),
        toggle('Browser encoder: use the GPU (faster, unstable on some drivers)', p('record.gpuEncoder')),
      ], { open: false }),
      group('Shorts: hook & ending', [
        toggle('Hook in the first seconds', shortsBind('record.hook.enabled')),
        text('Hook line', p('hook.text'), { placeholder: 'Empty: the YouTube title (without hashtags)' }),
        slider('Teaser of the finished picture', shortsBind('record.hook.teaser'), { min: 0, max: 2, step: 0.1, fmt: (v) => (v ? `${v.toFixed(1)} s` : 'Off') }),
        toggle('Flash at the cut', shortsBind('record.hook.flash')),
        toggle('Whoosh + boom sound', shortsBind('record.hook.impact')),
        slider('Fade to black at the end', shortsBind('record.outro'), { min: 0, max: 2, step: 0.1, fmt: (v) => (v ? `${v.toFixed(1)} s` : 'Off') }),
        toggle('Seamless loop: the end dissolves into the start (no hook, no fade)', p('record.loop')),
        slider('Loop crossfade', p('record.loopBlend'), { min: 0.2, max: 2, step: 0.1, fmt: (v) => `${v.toFixed(1)} s` }),
        h('button.btn.ghost.small', { type: 'button', onclick: () => this.actions.previewShorts?.() }, '▶ Preview start & end'),
      ], { hint: 'Viewers decide in the first 1–2 seconds. The video opens on the finished picture with a big hook line (readable with the sound off), then a flash and a boom cut to the drawing from zero. At the end the picture and sound fade to black instead of stopping abruptly. These settings are kept for the whole channel (in this browser): every preset you load and every video you export gets them, batches included. Only the hook line itself is saved with the preset.' }),
      this.youtubeGroup(),
      h('p.hint.note', {}, 'Files download to your computer. In the claude.ai viewer you confirm each save, and WAV/MIDI arrive inside a .zip.'),
      h('p.hint.note.build-id'),
    );
  }

  /** The Export button: do what “Make” says. */
  runExport(kind) {
    const a = this.actions;
    ({ video: a.exportVideo, wav: a.exportWav, midi: a.exportMidi, png: a.snapshot, live: a.toggleRecord }[kind])?.();
  }

  /** Live capture started or stopped (main.js): the Export button shows it. */
  setRecording(on) {
    this.exportRecording = on;
    this.refreshExport?.();
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
    this.formulaTexts = h('div.formula-texts');
    this.renderFormulaTexts();
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
        this.formulaTexts,
        h('div.grid2', {}, number('All formulas: from (s)', p('overlay.formulas.start'), { min: 0, max: 600, step: 0.5 }), number('until (s)', p('overlay.formulas.end'), { min: 0, max: 600, step: 0.5 })),
        h('p.hint', {}, 'Times in seconds; 0 = from the start / until the end. Each formula can also have its own times above.'),
        toggle('Shrink to fit the frame', p('overlay.formulas.fit')),
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
      group('Channel branding (every video)', [
        toggle('Show my branding', brandBind('enabled')),
        text('Watermark (e.g. @MathWaves)', brandBind('watermark'), { placeholder: '@MathWaves' }),
        text('End card', brandBind('endCard'), { placeholder: 'Follow for more math sounds 🔔' }),
        text('End card, second line', brandBind('endSub'), { placeholder: 'New video every day' }),
        slider('End card for the last', brandBind('endSeconds'), { min: 0, max: 6, step: 0.5, fmt: (v) => (v ? `${v} s` : 'Off') }),
      ], { open: false, hint: 'Saved in this browser, not in presets: every preset you load or export gets the same watermark and end card.' }),
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
    this.keyInspector = h('div.key-inspector');
    this.keyEase = 'smooth';
    this.keyLanes = new Set(LANES);
    const ease = h('select#key-ease', {}, Object.entries(EASES).map(([v, t]) => h('option', { value: v }, t)));
    ease.addEventListener('change', () => { this.keyEase = ease.value; });
    const laneChips = h('div.lane-chips', {}, LANES.map((lane) => {
      const id = `lane-${lane}`;
      const box = h('input', { type: 'checkbox', id, checked: true });
      box.addEventListener('change', () => { if (box.checked) this.keyLanes.add(lane); else this.keyLanes.delete(lane); });
      return h('label.lane-chip', { for: id }, box, lane);
    }));
    const tab = h('section.tab', {},
      group('Record', [
        toggle('● Key mode', bindPath('keyframes.autoKey')),
        h('p.hint', {}, 'On: while paused, every change you make (a slider, the scale, an instrument, a colour, the speed …) is recorded as a key at the playhead: only what you changed. Off: changes apply to the whole video. The same switch is on the timeline.'),
        h('div.lane-wrap', {}, h('span.ctl-label', {}, 'A full keyframe holds'), laneChips),
        h('div.row', {},
          h('button.btn', { type: 'button', title: 'Shortcut: Shift+K', onclick: () => this.actions.addKeyframeAt(this.actions.playheadTime(), [...this.keyLanes], this.keyEase) }, '◆ Full keyframe at playhead'),
          h('button.btn.ghost', { type: 'button', title: 'Shortcut: K', onclick: () => this.actions.addKey('camera.pose', this.keyEase) }, 'Camera key (K)')),
        h('div.ctl.ctl-select', {}, h('label', { for: 'key-ease' }, 'Ease out of new keys'), ease),
      ], { hint: 'Move the playhead, set the look and sound you want, add a keyframe; go further, change things, add the next. Between keyframes everything glides (names and switches, like the scale or an instrument, change at the next key). Drag a diamond on the timeline to move it; double-click a row to add one; Delete removes it.' }),
      group('Selected keyframe', [this.keyInspector]),
      group('Playback speed over time', [
        h('p.hint', {}, 'Speed is a normal animatable value: add a keyframe in the Speed lane (or move the Speed slider with Key mode on) to slow down for the climax and speed through the rest. Exports follow the same speed curve, picture and sound.'),
        h('div.row', {}, h('button.btn.ghost', { type: 'button', onclick: () => this.actions.addKey('transport.speed', this.keyEase) }, '◆ Speed key at playhead')),
      ], { open: false }),
      group('One property', [
        this.keyPropSlot,
        h('div.row', {}, h('button.btn.ghost', { type: 'button', onclick: () => this.actions.addKey(this.keyPath, this.keyEase) }, '◆ Add key for this property')),
      ], { open: false, hint: 'Pick any single property and key it at the playhead.' }),
      group('Tracks', [this.keyTracks], { open: false }),
    );
    onSelect(() => this.scheduleKeyRender());
    this.renderKeyframes();
    return tab;
  }

  scheduleKeyRender() {
    if (this.keyRender) return;
    this.keyRender = requestAnimationFrame(() => { this.keyRender = 0; this.renderKeyframes(); });
  }

  /** The editor for the selected keyframe: time, ease, every value at that moment. */
  renderInspector() {
    if (!this.keyInspector) return;
    const state = store.state, tracks = state.keyframes.tracks;
    const { time, lane } = selection;
    const kids = [];
    const paths = time == null ? [] : pathsAt(tracks, time, lane);
    const times = keyframeTimes(tracks, 'all');
    const nav = h('div.row', {},
      h('button.btn.small.ghost', { type: 'button', title: 'Previous keyframe (,)', onclick: () => this.actions.jumpKeyframe(-1) }, '◀ Prev'),
      h('button.btn.small.ghost', { type: 'button', title: 'Next keyframe (.)', onclick: () => this.actions.jumpKeyframe(1) }, 'Next ▶'),
      h('span.hint', {}, `${times.length} keyframe${times.length === 1 ? '' : 's'}`));
    kids.push(nav);
    if (time == null || !paths.length) {
      kids.push(h('p.hint', {}, times.length ? 'Click a diamond on the timeline (or use Prev / Next) to edit that keyframe.' : 'No keyframes yet. Turn on Key mode and change something, or add a full keyframe above.'));
      this.keyInspector.replaceChildren(...kids);
      return;
    }
    const dur = state.transport.duration;
    const timeBox = h('input', { type: 'number', min: 0, max: dur, step: 0.05, value: time.toFixed(2), 'aria-label': 'Keyframe time (seconds)' });
    timeBox.addEventListener('change', () => {
      const to = moveKeyframe(tracks, time, Math.min(dur, Math.max(0, +timeBox.value || 0)), lane, dur);
      selectKey(to, lane);
      this.actions.keyframesChanged();
    });
    const easeSel = h('select', { 'aria-label': 'Ease out of this keyframe' }, Object.entries(EASES).map(([v, t]) => h('option', { value: v }, t)));
    easeSel.value = tracks[paths[0]].find((k) => Math.abs(k.time - time) <= 0.03)?.ease || 'smooth';
    easeSel.addEventListener('change', () => { setEaseAt(tracks, time, easeSel.value, lane); this.actions.keyframesChanged(); });
    kids.push(
      h('div.key-head', {}, h('strong', {}, `${lane === 'all' ? 'Keyframe' : lane + ' keyframe'} at`), timeBox, h('span.hint', {}, 's')),
      h('div.ctl.ctl-select', {}, h('label', {}, 'Ease out of it'), easeSel),
      h('div.row', {},
        h('button.btn.small.ghost', { type: 'button', title: 'Move the playhead onto it', onclick: () => this.actions.seekTo(time) }, 'Go to'),
        h('button.btn.small.ghost', { type: 'button', title: 'Copy this keyframe to the playhead', onclick: () => { copyKeyframe(tracks, time, this.actions.playheadTime(), lane); selectKey(+this.actions.playheadTime().toFixed(4), lane); this.actions.keyframesChanged(); } }, 'Duplicate to playhead'),
        h('button.btn.small.ghost', { type: 'button', title: 'Re-capture everything in these lanes from how the project looks and sounds now', onclick: () => this.actions.addKeyframeAt(time, lane === 'all' ? [...this.keyLanes] : [lane], easeSel.value) }, 'Re-capture now'),
        h('button.btn.small.ghost.danger', { type: 'button', onclick: () => { deleteKeyframe(tracks, time, lane); clearSelection(); this.actions.keyframesChanged(); } }, 'Delete')));
    // values, grouped by lane
    const byLane = new Map();
    for (const path of paths) {
      const d = describe(state, path);
      const key = tracks[path].find((k) => Math.abs(k.time - time) <= 0.03);
      if (!d || !key) continue;
      const ln = laneOf(path);
      if (!byLane.has(ln)) byLane.set(ln, []);
      byLane.get(ln).push(this.keyValueRow(d, key, path));
    }
    for (const [ln, rows] of byLane) kids.push(h('div.key-lane', {}, h('div.key-lane-title', {}, ln), ...rows));
    this.keyInspector.replaceChildren(...kids);
  }

  /** One editable value of a keyframe. */
  keyValueRow(d, key, path) {
    const changed = () => { this.actions.keyframesChanged(); };
    let input;
    if (d.kind === 'color') {
      input = h('input', { type: 'color', value: key.value, 'aria-label': d.label });
      input.addEventListener('input', () => { key.value = input.value; changed(); });
    } else if (d.kind === 'choice') {
      const label = (v) => (v === true ? 'On' : v === false ? 'Off' : d.path.endsWith('.wave') ? (INSTRUMENTS[v]?.label || v) : d.path === 'audio.scale' ? (SCALE_LABELS[v] || v) : String(v));
      input = h('select', { 'aria-label': d.label }, d.options.map((o, i) => h('option', { value: i }, label(o))));
      input.value = String(Math.max(0, d.options.indexOf(key.value)));
      input.addEventListener('change', () => { key.value = d.options[+input.value]; changed(); });
    } else if (d.kind === 'pose') {
      input = h('button.btn.small.ghost', { type: 'button', title: 'Store the camera view as it is now', onclick: () => { key.value = structuredClone(this.actions.currentPose()); changed(); } }, 'Set from view');
    } else {
      input = h('input', { type: 'number', min: d.min, max: d.max, step: (d.max - d.min) / 200 >= 1 ? 1 : 0.01, value: +(+key.value).toFixed(3), 'aria-label': d.label });
      input.addEventListener('change', () => { key.value = Math.min(d.max, Math.max(d.min, +input.value || 0)); changed(); });
    }
    return h('div.key-row', {}, h('span.key-label', {}, (d.group.startsWith('Layer') ? d.group.split(' · ')[0] + ' · ' : '') + d.label), input,
      h('button.key-del', { type: 'button', title: 'Remove this value from the keyframe', 'aria-label': 'Remove', onclick: () => { const i = this.keyIndex(path, key); if (i >= 0) removeKey(store.state.keyframes.tracks, path, i); this.actions.keyframesChanged(); } }, '×'));
  }

  keyIndex(path, key) { return (store.state.keyframes.tracks[path] || []).indexOf(key); }

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
    this.renderInspector();

    // Track list
    const tracks = state.keyframes.tracks;
    const paths = Object.keys(tracks);
    if (!paths.length) {
      this.keyTracks.replaceChildren(h('p.hint', {}, 'No animation yet. Example: put the playhead at 0 s, add a full keyframe, move to 8 s, change the scale and the camera zoom with Key mode on.'));
      return;
    }
    const fmtVal = (v) => (typeof v === 'number' ? +v.toFixed(2) : typeof v === 'string' ? v : typeof v === 'boolean' ? (v ? 'on' : 'off') : 'view');
    const nextEase = Object.fromEntries(Object.keys(EASES).map((k, i, all) => [k, all[(i + 1) % all.length]]));
    const easeMark = { smooth: '∿', linear: '／', hold: '⌐', in: '◜', out: '◞' };
    this.keyTracks.replaceChildren(...paths.map((path) => {
      const d = describe(state, path);
      const keys = tracks[path];
      const chips = keys.map((k, i) => h('span.key-chip', {},
        typeof k.value === 'string' && k.value[0] === '#' ? h('i.key-swatch', { style: `background:${k.value}` }) : null,
        h('button.key-time', { type: 'button', title: 'Jump to this key', onclick: () => { selectKey(k.time, laneOf(path)); this.actions.seekTo(k.time); } }, `${k.time.toFixed(2)}s · ${fmtVal(k.value)}`),
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
    // rebuild the Circle tab first: its controls may point at layers that no longer exist
    this.circleEdit = Math.min(this.circleEdit || 0, store.state.circle.layers?.length || 0);
    this.renderCircle();
    this.renderCircleLayers();
    this.renderHarmonograph();
    this.renderSpiro();
    this.soundPresets?.forget();
    refreshAll();
    this.updateYtCount?.();
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
