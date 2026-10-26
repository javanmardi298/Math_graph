/**
 * The Harmonograph tab: a workshop for the pendulum drawing machine (circle/harmonograph.js).
 * It edits the scene's settings of the Circle layer being edited (state.circle, or one of the
 * extra layers), so presets, exports, sound and the other layers all work as they do for the
 * rest of the Circle Lab.
 *
 *   Looks      one-click bundles of paper, ink, colour and frame
 *   Machine    the kind, four pendulums (size, frequency, phase), intervals, detune, table, formula
 *   Tune       set the pendulums to the degrees of any scale in the app (maqam, dastgah, raga …)
 *   Ink        pens, ink style, what the colour follows, palette, glow
 *   Paper      paper, frame, dials, pen, proportions, symmetry
 *   Sound      how the pendulums sound, instrument, tuning
 *   🎲 Lucky   a good-looking random machine (undo steps back)
 */
import { store } from '../state.js';
import { h, group, slider, select, toggle, text, refreshAll, disposeTree } from './controls.js';
import { sceneParams } from '../circle/scenes.js';
import { CIRCLE_PALETTES, PALETTES as INKS } from '../circle/palettes.js';
import { INTERVALS, KINDS, PAPERS, INK_STYLES, COLOR_BY, FRAMES, luckyMachine, tuneToScale } from '../circle/harmonograph.js';
import { INSTRUMENTS, INSTRUMENT_GROUPS } from '../audio/instruments.js';
import { SCALE_GROUPS, SCALE_LABELS, NOTE_NAMES } from '../math/music.js';

const RULE = 'harmonograph';
const rnd = () => Math.floor(Math.random() * 1e6) + 1;

/** One-click looks: paper, ink style, palette, colour rule, frame (and the settings that fit them). */
const LOOKS = [
  { name: 'Neon on velvet', lab: { paper: 'velvet', ink: 'neon', frame: 'double', colorBy: 'time', dials: false }, look: { palette: 'rainbow' } },
  { name: 'Ice crystal', lab: { paper: 'midnight', ink: 'fine', frame: 'none', colorBy: 'radius' }, look: { palette: 'ice' } },
  { name: 'Old parchment', lab: { paper: 'parchment', ink: 'ink', frame: 'ornate', colorBy: 'speed' }, look: { palette: 'sepia' } },
  { name: 'Indigo on cream', lab: { paper: 'cream', ink: 'ink', frame: 'line', colorBy: 'time' }, look: { palette: 'indigo' } },
  { name: 'Blueprint', lab: { paper: 'blueprint', ink: 'fine', frame: 'line', dials: true, colorBy: 'time' }, look: { palette: 'mono' } },
  { name: 'Chalk on slate', lab: { paper: 'chalk', ink: 'fine', frame: 'none', colorBy: 'angle' }, look: { palette: 'pastel' } },
  { name: 'Ember brush', lab: { paper: 'ember', ink: 'brush', frame: 'none', colorBy: 'speed' }, look: { palette: 'fire' } },
  { name: 'Rose gold', lab: { paper: 'velvet', ink: 'brush', frame: 'double', colorBy: 'time' }, look: { palette: 'rosegold' } },
  { name: 'Aurora', lab: { paper: 'midnight', ink: 'neon', frame: 'none', colorBy: 'angle' }, look: { palette: 'aurora' } },
  { name: 'Peacock', lab: { paper: 'velvet', ink: 'fine', frame: 'ornate', colorBy: 'pen' }, look: { palette: 'peacock' } },
];

export class HarmonographTab {
  /**
   * @param {{circleTarget:()=>{base:string, L:object}, toast:(m:string)=>void}} actions
   */
  constructor(actions) {
    this.actions = actions;
    this.hist = [];
    this.tune = { scale: 'major', root: 0, degrees: '1 3 5 8' };
    this.el = h('section.tab.harm-tab');
    this.render();
  }

  /* ----------------------------------------------------------------- state access */

  cur() { return this.actions.circleTarget().L; }
  base() { return this.actions.circleTarget().base; }
  get on() { return store.state.mode === 'circle' && this.cur().rule === RULE; }
  params() { return sceneParams({ ...this.cur(), rule: RULE }); }

  /** Binding for one setting of the machine. */
  lab(key) {
    return { get: () => this.params()[key], set: (v) => this.patch({ [key]: v }) };
  }

  patch(p, { remember = false } = {}) {
    if (remember) this.remember();
    const base = this.base();
    store.set(`${base}.lab.${RULE}`, { ...(this.cur().lab?.[RULE] || {}), ...p });
    if ('kind' in p) queueMicrotask(() => this.render()); // the list of pendulums depends on the machine
  }

  look(key) { return { get: () => this.cur().look?.[key], set: (v) => store.set(`${this.base()}.look.${key}`, v) }; }
  sound(key) { return { get: () => this.cur().sound?.[key], set: (v) => store.set(`${this.base()}.sound.${key}`, v) }; }

  remember() {
    const L = this.cur();
    this.hist.push({ lab: structuredClone(L.lab?.[RULE] || {}), look: structuredClone(L.look || {}) });
    if (this.hist.length > 30) this.hist.shift();
    if (this.undoBtn) this.undoBtn.disabled = false;
  }

  undo() {
    const p = this.hist.pop();
    if (!p) return;
    store.set(`${this.base()}.lab.${RULE}`, p.lab);
    store.set(`${this.base()}.look`, p.look);
    this.render();
    refreshAll();
  }

  /** Make the layer a harmonograph (from any other mode or simulation). */
  start() {
    if (store.state.mode !== 'circle') store.set('mode', 'circle');
    store.set(`${this.base()}.rule`, RULE);
    store.set(`${this.base()}.sound.pitch`, 'angle');
    this.render();
  }

  /* ------------------------------------------------------------------- actions */

  setLook(look) {
    this.remember();
    const paper = PAPERS[look.lab.paper];
    this.patch({ dials: false, ...look.lab });
    const L = { ...(this.cur().look || {}), ...look.look, background: paper.bg, bloom: paper.light ? 0 : 1, glow: paper.light ? 0.4 : 1 };
    store.set(`${this.base()}.look`, L);
    this.render();
  }

  lucky(kind = null) {
    this.remember();
    const m = luckyMachine(rnd(), { kind });
    const paper = PAPERS[m.lab.paper];
    this.patch(m.lab);
    store.set(`${this.base()}.look`, { ...(this.cur().look || {}), palette: m.look.palette, background: paper.bg, bloom: paper.light ? 0 : 1, glow: paper.light ? 0.4 : 1 });
    this.render();
    refreshAll();
  }

  interval(target, ratio) {
    this.remember();
    const p = this.params();
    if (target === 'b') this.patch({ fb: +(p.fa * ratio).toFixed(4) });
    else this.patch({ fd: +(p.fc * ratio).toFixed(4) });
    this.render();
  }

  detune(x) {
    const p = this.params();
    this.patch({ fc: +(p.fa * (1 + x)).toFixed(4), fd: +(p.fb * (1 - x)).toFixed(4) });
  }

  applyScale() {
    const { scale, root, degrees } = this.tune;
    const ds = degrees.split(/[\s,]+/).map(Number).filter((n) => n >= 1 && n <= 22).slice(0, 4);
    if (!ds.length) return this.actions.toast('Write up to four scale degrees, for example 1 3 5 8.');
    this.remember();
    this.patch({ ...tuneToScale(scale, ds, 2), kind: ['lateral', 'lissajous'].includes(this.params().kind) && ds.length > 2 ? 'quad' : this.params().kind, base: 36 + root, tuning: 'just' });
    store.set('audio.scale', scale);
    store.set('audio.root', root);
    this.render();
    this.actions.toast(`Pendulums tuned to degrees ${ds.join(' ')} of ${SCALE_LABELS[scale]}.`);
  }

  /* --------------------------------------------------------------------- view */

  chip(label, title, fn) { return h('button.chip', { type: 'button', title, onclick: fn }, label); }

  render() {
    disposeTree(this.el);
    const kids = [];
    kids.push(h('div.circle-intro', {},
      h('p.hint', {}, 'The harmonograph: pendulums that slowly lose their swing move a pen across paper. The ratio between the pendulums is a musical interval, so every drawing is also a chord, and you can hear it as you watch it grow.')));
    if (!this.on) {
      kids.push(h('div.harm-start', {},
        h('button.btn.primary', { type: 'button', onclick: () => this.start() }, '〰 Start a harmonograph'),
        h('p.hint', {}, store.state.mode === 'circle' ? 'This layer is another Circle Lab simulation. Starting turns it into a harmonograph.' : 'Opens the Circle Lab with a harmonograph. Presets are on the “Math · Harmonograph” shelf of the Presets tab.')));
      this.el.replaceChildren(...kids);
      return;
    }
    const P = this.params();
    const L = this.cur();
    this.undoBtn = h('button.btn.small.ghost', { type: 'button', disabled: !this.hist.length, title: 'Back to the machine before the last change', onclick: () => this.undo() }, '↶ Undo');
    kids.push(h('div.row.harm-top', {},
      h('button.btn.primary', { type: 'button', title: 'A machine that draws something worth watching (rolls the dice)', onclick: () => this.lucky() }, '🎲 Lucky machine'),
      this.undoBtn,
      h('button.btn.small.ghost', { type: 'button', title: 'Draw again from the start', onclick: () => store.emit(`${this.base()}.redraw`) }, '↻ Redraw')));

    // looks
    kids.push(group('Looks', [
      h('div.harm-looks', {}, LOOKS.map((l) => {
        const paper = PAPERS[l.lab.paper], pal = INKS[l.look.palette];
        return h('button.harm-look', { type: 'button', title: `${CIRCLE_PALETTES[l.look.palette]} on ${paper.label}`, style: `--bg:${paper.bg};--a:${pal.glow};--b:${pal.glow2}`, onclick: () => this.setLook(l) }, h('span', {}), l.name);
      })),
    ], { hint: 'Paper, ink, colours and frame in one click. You can change each one below.' }));

    // machine
    const pend = (letter, axis, fa, sz, ph) => h('div.harm-pend', {},
      h('strong', {}, `${letter} · ${axis}`),
      slider('Frequency', this.lab(fa), { min: 0.25, max: 12, step: 0.001 }),
      slider('Size', this.lab(sz), { min: 0, max: 1, step: 0.01 }),
      slider('Phase', this.lab(ph), { min: 0, max: 360, step: 1, unit: '°' }));
    const kind = P.kind;
    const two = kind === 'lateral' || kind === 'lissajous';
    const machine = [
      select('Machine', this.lab('kind'), KINDS),
      ...(kind === 'formula' ? [] : [pend('A', kind === 'epicycle' ? 'circle 1' : 'pendulum x', 'fa', 'aa', 'pa'), pend('B', kind === 'epicycle' ? 'circle 2 (turns the other way)' : 'pendulum y', 'fb', 'ab', 'pb')]),
      ...(kind === 'formula' || two ? [] : [pend('C', kind === 'epicycle' ? 'circle 3' : 'second x', 'fc', 'ac', 'pc'), pend('D', kind === 'epicycle' ? 'circle 4 (other way)' : 'second y', 'fd', 'ad', 'pd')]),
    ];
    if (!two && kind !== 'formula') {
      machine.push(slider('Detune: the figure turns slowly', { get: () => +((P.fc / P.fa - 1) * 100).toFixed(2), set: (v) => this.detune(v / 100) }, { min: -3, max: 3, step: 0.01, fmt: (v) => `${v > 0 ? '+' : ''}${v}%` }));
    }
    if (kind !== 'formula') {
      machine.push(h('div.chips-label', {}, 'B against A:'), h('div.chips', {}, INTERVALS.map(([r, n, v]) => this.chip(r, n, () => this.interval('b', v)))));
      if (!two) machine.push(h('div.chips-label', {}, 'D against C:'), h('div.chips', {}, INTERVALS.map(([r, n, v]) => this.chip(r, n, () => this.interval('d', v)))));
    }
    if (kind === 'rotary') machine.push(slider('Table turns', this.lab('table'), { min: -4, max: 4, step: 0.01 }), slider('Table start', this.lab('tp'), { min: 0, max: 360, step: 1, unit: '°' }));
    if (kind === 'formula') {
      for (const [key, label, ph] of [['fx', 'x(t, s, a, b, c, d)', 's*(sin(a*t)+sin(c*t))/2'], ['fy', 'y(t, s, a, b, c, d)', 's*(sin(b*t+1.57)+sin(d*t))/2']]) {
        machine.push(text(label, this.lab(key), { placeholder: ph }));
      }
      machine.push(h('p.hint', {}, 't is the pen time, s the swing (1 → 0 as the pendulums tire), a b c d the four frequencies above. Values are in the range −1 … 1. Try  s*sin(a*t)*cos(b*t)  or  s*(cos(a*t)+0.5*cos(c*t)).'));
      machine.push(slider('Frequency a', this.lab('fa'), { min: 0.25, max: 12, step: 0.001 }), slider('Frequency b', this.lab('fb'), { min: 0.25, max: 12, step: 0.001 }),
        slider('Frequency c', this.lab('fc'), { min: 0.25, max: 12, step: 0.001 }), slider('Frequency d', this.lab('fd'), { min: 0.25, max: 12, step: 0.001 }));
    }
    machine.push(
      slider('Swing lasts', this.lab('life'), { min: 0, max: 180, step: 1, fmt: (v) => (v ? `${v} s` : 'never fades') }),
      slider('Drawing speed', this.lab('rate'), { min: 0.2, max: 8, step: 0.05 }));
    kids.push(group('Machine', machine, { hint: 'Frequencies are ratios: 3 : 2 is a fifth, 2 : 1 an octave. A tiny difference between two pendulums (detune) makes the figure turn into a rosette, and makes the notes beat.' }));

    // tune to a scale
    const scaleSel = h('select', {}, SCALE_GROUPS.filter(([, ks]) => ks.some((k) => k !== 'continuous' && k !== 'chromatic')).map(([g, ks]) => h('optgroup', { label: g }, ks.filter((k) => k !== 'continuous').map((k) => h('option', { value: k }, SCALE_LABELS[k])))));
    scaleSel.value = this.tune.scale;
    scaleSel.addEventListener('change', () => { this.tune.scale = scaleSel.value; });
    const rootSel = h('select', {}, NOTE_NAMES.map((n, i) => h('option', { value: i }, n)));
    rootSel.value = this.tune.root;
    rootSel.addEventListener('change', () => { this.tune.root = +rootSel.value; });
    const degIn = h('input', { type: 'text', value: this.tune.degrees, spellcheck: 'false', 'aria-label': 'Scale degrees' });
    degIn.addEventListener('input', () => { this.tune.degrees = degIn.value; });
    kids.push(group('Tune to a scale', [
      h('div.ctl.ctl-select', {}, h('label', {}, 'Scale'), scaleSel),
      h('div.ctl.ctl-select', {}, h('label', {}, 'Key'), rootSel),
      h('div.ctl.ctl-text', {}, h('label', {}, 'Degrees (up to four)'), degIn),
      h('div.chips', {}, [['1 3 5 8', 'Chord and octave'], ['1 5', 'Root and fifth'], ['1 2 3 5', 'First notes'], ['1 4 5 8', 'Root, fourth, fifth']].map(([d, t]) => this.chip(d, t, () => { this.tune.degrees = d; degIn.value = d; }))),
      h('button.btn', { type: 'button', onclick: () => this.applyScale() }, 'Tune the pendulums'),
    ], { open: false, hint: 'Draw the shape of a scale: Dastgah Shur or Maqam Rast with their quarter tones, a raga, a pentatonic. The pendulums get exactly the frequency ratios of the chosen degrees, and the Sound tab’s scale and key follow.' }));

    // ink
    kids.push(group('Ink', [
      select('Ink', this.lab('ink'), INK_STYLES),
      select('Colour follows', this.lab('colorBy'), COLOR_BY),
      select('Palette', this.look('palette'), CIRCLE_PALETTES),
      slider('Colour offset', this.lab('hue0'), { min: 0, max: 1, step: 0.01 }),
      slider('Colour change along the drawing', this.lab('hueRate'), { min: 0, max: 0.1, step: 0.001 }),
      slider('Line width', this.lab('width'), { min: 0.3, max: 5, step: 0.05 }),
      slider('Pens', this.lab('pens'), { min: 1, max: 4, step: 1 }),
      slider('Gap between pens', this.lab('penGap'), { min: 0.02, max: 3, step: 0.01 }),
      slider('Glow', this.look('glow'), { min: 0, max: 2, step: 0.05 }),
      slider('Bloom', this.look('bloom'), { min: 0, max: 2, step: 0.05 }),
      toggle('Show a hint of the final shape', this.lab('ghost')),
    ], { open: false, hint: 'Several pens run a little apart in time and draw a family of curves. On light paper the ink darkens where lines cross, like real ink.' }));

    // paper
    const paperCard = ([id, p]) => h('button.harm-look.harm-paper', { type: 'button', 'aria-pressed': String(P.paper === id), title: p.label, style: `--bg:${p.bg};--a:${p.light ? '#3b2a14' : '#9ff6ff'};--b:${p.light ? '#7a4a1c' : '#7b5cff'}`, onclick: () => {
      this.remember();
      this.patch({ paper: id });
      store.set(`${this.base()}.look`, { ...(this.cur().look || {}), background: p.bg, bloom: p.light ? 0 : 1, glow: p.light ? 0.4 : 1 });
      this.render();
    } }, h('span', {}), p.label);
    kids.push(group('Paper, frame & symmetry', [
      h('div.harm-looks', {}, Object.entries(PAPERS).map(paperCard)),
      select('Frame', this.lab('frame'), FRAMES),
      toggle('Pendulum dials (swing and phase)', this.lab('dials')),
      select('Pen', this.lab('pen'), { dot: 'Glowing dot', nib: 'Nib', none: 'Hidden' }),
      select('Proportions', this.lab('fit'), { auto: 'Automatic', square: 'True proportions', fill: 'Stretch to the frame' }),
      slider('Symmetry: copies around the centre', this.lab('sym'), { min: 1, max: 12, step: 1 }),
      toggle('Mirror each copy', this.lab('mirror')),
    ], { hint: 'Symmetry turns one drawing into a mandala. Light papers switch the glow off so the ink stays crisp.' }));

    // sound
    const inst = h('select', {}, INSTRUMENT_GROUPS.map((g) => h('optgroup', { label: g }, Object.entries(INSTRUMENTS).filter(([, v]) => v.group === g).map(([id, v]) => h('option', { value: id }, v.label)))));
    inst.value = L.sound?.instrument || 'e-piano';
    inst.addEventListener('change', () => store.set(`${this.base()}.sound.instrument`, inst.value));
    const soundMode = { get: () => this.params().sound, set: (v) => { this.patch({ sound: v }); store.set(`${this.base()}.sound.pitch`, 'angle'); } };
    kids.push(group('Sound', [
      select('How it sounds', soundMode, { strum: 'Strum the pendulums, one by one', chord: 'Play them as a chord', cross: 'A note whenever the pen crosses the middle', off: 'Silent' }),
      select('Strum order', this.lab('arp'), { up: 'Up', down: 'Down', pingpong: 'Up and down' }),
      slider('A note every', this.lab('every'), { min: 0.1, max: 4, step: 0.05, unit: ' s' }),
      slider('Pendulum A plays', this.lab('base'), { min: 24, max: 84, step: 1, fmt: (v) => `${NOTE_NAMES[v % 12]}${Math.floor(v / 12) - 1}` }),
      select('Tuning', this.lab('tuning'), { just: 'Exact ratios (just intonation)', equal: 'Piano keys (equal temperament)' }),
      h('div.ctl.ctl-select', {}, h('label', {}, 'Instrument'), inst),
      slider('Volume', this.sound('volume'), { min: 0, max: 1, step: 0.01 }),
      slider('Reverb', { get: () => store.get('audio.reverb.mix'), set: (v) => store.set('audio.reverb.mix', v) }, { min: 0, max: 0.8, step: 0.01 }),
    ], { hint: 'Each pendulum sounds at the exact ratio of its frequency, and gets quieter as its swing dies away. With “Exact ratios” the fifth is a true 3 : 2, not the piano’s near-fifth.' }));

    kids.push(h('p.hint.harm-foot', {}, 'Speed, tempo and the camera are in the Circle, Rhythm and Camera tabs. Presets: Presets tab → Math · Harmonograph.'));
    this.el.replaceChildren(...kids);
  }
}

