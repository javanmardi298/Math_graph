/**
 * The Spirograph tab: toothed wheels that draw (spirograph) and engine-turned patterns
 * (guilloche), as one workshop. It edits the Circle layer being edited, so presets, sound, exports
 * and the other layers work as everywhere else in the Circle Lab.
 *
 *   Looks      one-click bundles (paper, ink, palette, toy style)
 *   Machine    wheel inside / outside / gear in a gear / lobed / formula; gear sets; intervals; pen hole
 *   The toy    the gears as an element: shown, hidden, faded; restyled and recoloured; moved apart
 *   Placement  size, position and angle of the whole drawing
 *   Ink, paper, sound
 * The guilloche side has its own patterns (rosette, dial, ribbon, lathe, formula) and inks.
 */
import { store } from '../state.js';
import { h, group, slider, select, toggle, text, color, refreshAll, disposeTree, segmented } from './controls.js';
import { sceneParams } from '../circle/scenes.js';
import { CIRCLE_PALETTES, PALETTES as INKS } from '../circle/palettes.js';
import { INTERVALS } from '../circle/harmonograph.js';
import {
  SPIRO_KINDS, TOY_STYLES, TOY_SHOW, COLOR_BY, EASES, GEAR_SETS, PAPERS, INK_STYLES, FRAMES, closureInfo, gearsForRatio, luckySpiro,
  GUILLOCHE_TYPES, GUILLOCHE_COLORS, luckyGuilloche,
} from '../circle/spirograph.js';
import { INSTRUMENTS, INSTRUMENT_GROUPS } from '../audio/instruments.js';
import { NOTE_NAMES } from '../math/music.js';

const RULES = ['spirograph', 'guilloche'];
const rnd = () => Math.floor(Math.random() * 1e6) + 1;

/** One-click looks of the spirograph: paper, ink, palette and the toy's style and colours. */
const LOOKS = [
  { name: 'Toy on a desk', lab: { paper: 'desk', ink: 'fine', colorBy: 'time', toyStyle: 'toy', toyRing: '#ff8a3d', toyWheel: '#7fd0ff', toyWheel2: '#ffd27f', toyPen: '#d02030' }, look: { palette: 'indigo' } },
  { name: 'Pink and mint', lab: { paper: 'desk', ink: 'fine', colorBy: 'turn', toyStyle: 'toy', toyRing: '#ff6b9a', toyWheel: '#8cf0c8', toyWheel2: '#ffe08a', toyPen: '#6a20c0' }, look: { palette: 'rainbow' } },
  { name: 'Brass on parchment', lab: { paper: 'parchment', ink: 'ink', colorBy: 'speed', toyStyle: 'brass', frame: 'ornate' }, look: { palette: 'sepia' } },
  { name: 'Blueprint', lab: { paper: 'blueprint', ink: 'fine', colorBy: 'time', toyStyle: 'blueprint' }, look: { palette: 'mono' } },
  { name: 'Neon on velvet', lab: { paper: 'velvet', ink: 'neon', colorBy: 'time', toyStyle: 'neon', frame: 'double' }, look: { palette: 'rainbow' } },
  { name: 'Ice on midnight', lab: { paper: 'midnight', ink: 'fine', colorBy: 'radius', toyStyle: 'neon' }, look: { palette: 'ice' } },
  { name: 'Ember brush', lab: { paper: 'ember', ink: 'brush', colorBy: 'speed', toyStyle: 'brass' }, look: { palette: 'fire' } },
  { name: 'Indigo on cream', lab: { paper: 'cream', ink: 'ink', colorBy: 'time', toyStyle: 'toy', toyRing: '#6b7bff', toyWheel: '#ffd27f', frame: 'line' }, look: { palette: 'indigo' } },
  { name: 'Chalk on slate', lab: { paper: 'chalk', ink: 'fine', colorBy: 'angle', toyStyle: 'blueprint' }, look: { palette: 'pastel' } },
  { name: 'Rose gold', lab: { paper: 'velvet', ink: 'brush', colorBy: 'time', toyStyle: 'brass', frame: 'double' }, look: { palette: 'rosegold' } },
];

const GUILLOCHE_LOOKS = [
  { name: 'Banknote blue', lab: { paper: 'cream', colors: 'bands', ink1: '#1f5a8a', ink2: '#2a8a6a', ink3: '#8a2a5a' }, look: { palette: 'indigo' } },
  { name: 'Certificate green', lab: { paper: 'parchment', colors: 'bands', ink1: '#2a5a3a', ink2: '#7a2a3a', ink3: '#c08a20' }, look: { palette: 'sepia' } },
  { name: 'Silver on black', lab: { paper: 'velvet', colors: 'bands', ink1: '#c9d6e8', ink2: '#9fb4ff', ink3: '#ffffff' }, look: { palette: 'mono' } },
  { name: 'Gold on ember', lab: { paper: 'ember', colors: 'palette', hue0: 0.1, hueSpan: 0.15 }, look: { palette: 'gold' } },
  { name: 'Aurora', lab: { paper: 'midnight', colors: 'palette', hueSpan: 1 }, look: { palette: 'aurora' } },
  { name: 'Blueprint', lab: { paper: 'blueprint', colors: 'mono', ink1: '#e8f2ff' }, look: { palette: 'mono' } },
];

export class SpiroTab {
  /** @param {{circleTarget:()=>{base:string, L:object}, toast:(m:string)=>void}} actions */
  constructor(actions) {
    this.actions = actions;
    this.hist = [];
    this.el = h('section.tab.harm-tab.spiro-tab');
    this.render();
  }

  cur() { return this.actions.circleTarget().L; }
  base() { return this.actions.circleTarget().base; }
  get rule() { return this.cur().rule; }
  get on() { return store.state.mode === 'circle' && RULES.includes(this.rule); }
  params() { return sceneParams({ ...this.cur(), rule: this.rule }); }

  lab(key) { return { get: () => this.params()[key], set: (v) => this.patch({ [key]: v }) }; }
  look(key) { return { get: () => this.cur().look?.[key], set: (v) => store.set(`${this.base()}.look.${key}`, v) }; }
  sound(key) { return { get: () => this.cur().sound?.[key], set: (v) => store.set(`${this.base()}.sound.${key}`, v) }; }

  patch(p) {
    const base = this.base(), rule = this.rule;
    store.set(`${base}.lab.${rule}`, { ...(this.cur().lab?.[rule] || {}), ...p });
    if ('kind' in p || 'type' in p || 'toyDetach' in p || 'toyShow' in p || 'colors' in p) queueMicrotask(() => this.render());
    this.updateInfo();
  }

  remember() {
    const L = this.cur();
    this.hist.push({ rule: L.rule, lab: structuredClone(L.lab?.[L.rule] || {}), look: structuredClone(L.look || {}) });
    if (this.hist.length > 30) this.hist.shift();
    if (this.undoBtn) this.undoBtn.disabled = false;
  }

  undo() {
    const p = this.hist.pop();
    if (!p) return;
    store.set(`${this.base()}.rule`, p.rule);
    store.set(`${this.base()}.lab.${p.rule}`, p.lab);
    store.set(`${this.base()}.look`, p.look);
    this.render();
    refreshAll();
  }

  start(rule = 'spirograph') {
    if (store.state.mode !== 'circle') store.set('mode', 'circle');
    store.set(`${this.base()}.rule`, rule);
    store.set(`${this.base()}.sound.pitch`, 'angle');
    this.render();
  }

  setLook(l) {
    this.remember();
    const paper = PAPERS[l.lab.paper];
    this.patch(l.lab);
    store.set(`${this.base()}.look`, { ...(this.cur().look || {}), ...l.look, background: paper.bg, bloom: paper.light ? 0 : 1, glow: paper.light ? 0.4 : 1 });
    this.render();
  }

  lucky() {
    this.remember();
    const m = this.rule === 'guilloche' ? luckyGuilloche(rnd()) : luckySpiro(rnd());
    const paper = PAPERS[m.lab.paper];
    this.patch(m.lab);
    store.set(`${this.base()}.look`, { ...(this.cur().look || {}), palette: m.look.palette, background: paper.bg, bloom: paper.light ? 0 : 1, glow: paper.light ? 0.4 : 1 });
    this.render();
    refreshAll();
  }

  updateInfo() { if (this.info && this.rule === 'spirograph') this.info.textContent = closureInfo(this.params()); }

  chip(label, title, fn) { return h('button.chip', { type: 'button', title, onclick: fn }, label); }

  /* ---------------------------------------------------------------------- view */

  render() {
    disposeTree(this.el);
    const kids = [];
    kids.push(h('div.circle-intro', {}, h('p.hint', {}, 'Spirograph: a toothed wheel rolls inside (or around) a ring and a pen in one of its holes draws. The numbers of teeth decide the shape. Guilloche: the fine engine-turned patterns of banknotes and watch dials.')));
    if (!this.on) {
      kids.push(h('div.harm-start', {},
        h('button.btn.primary', { type: 'button', onclick: () => this.start('spirograph') }, '✺ Start a spirograph'),
        h('button.btn', { type: 'button', onclick: () => this.start('guilloche') }, 'Start a guilloche'),
        h('p.hint', {}, 'Presets are on the “Math · Spirograph & guilloche” shelf of the Presets tab.')));
      this.el.replaceChildren(...kids);
      return;
    }
    kids.push(h('div.row', {}, segmented({ get: () => this.rule, set: (v) => { this.remember(); store.set(`${this.base()}.rule`, v); store.set(`${this.base()}.sound.pitch`, 'angle'); this.render(); } },
      [['spirograph', '✺ Spirograph'], ['guilloche', '〰 Guilloche']], { label: 'What to draw' })));
    this.undoBtn = h('button.btn.small.ghost', { type: 'button', disabled: !this.hist.length, title: 'Back to before the last change', onclick: () => this.undo() }, '↶ Undo');
    kids.push(h('div.row.harm-top', {},
      h('button.btn.primary', { type: 'button', title: 'A good-looking random set', onclick: () => this.lucky() }, '🎲 Lucky'),
      this.undoBtn,
      h('button.btn.small.ghost', { type: 'button', title: 'Draw again from the start', onclick: () => store.emit(`${this.base()}.redraw`) }, '↻ Redraw')));
    kids.push(...(this.rule === 'guilloche' ? this.guillocheView() : this.spiroView()));
    kids.push(h('p.hint.harm-foot', {}, 'Speed, tempo and the camera are in the Circle, Rhythm and Camera tabs. Presets: Presets tab → Math · Spirograph & guilloche.'));
    this.el.replaceChildren(...kids);
  }

  lookCards(list) {
    return h('div.harm-looks', {}, list.map((l) => {
      const paper = PAPERS[l.lab.paper], pal = INKS[l.look.palette];
      return h('button.harm-look', { type: 'button', title: `${CIRCLE_PALETTES[l.look.palette]} on ${paper.label}`, style: `--bg:${paper.bg};--a:${pal.glow};--b:${pal.glow2}`, onclick: () => this.setLook(l) }, h('span', {}), l.name);
    }));
  }

  paperCards(P) {
    return h('div.harm-looks', {}, Object.entries(PAPERS).map(([id, p]) => h('button.harm-look.harm-paper', { type: 'button', 'aria-pressed': String(P.paper === id), title: p.label, style: `--bg:${p.bg};--a:${p.light ? '#3b2a14' : '#9ff6ff'};--b:${p.light ? '#7a4a1c' : '#7b5cff'}`, onclick: () => {
      this.remember();
      this.patch({ paper: id });
      store.set(`${this.base()}.look`, { ...(this.cur().look || {}), background: p.bg, bloom: p.light ? 0 : 1, glow: p.light ? 0.4 : 1 });
      this.render();
    } }, h('span', {}), p.label)));
  }

  placement() {
    return group('Place and size', [
      slider('Size', this.lab('size'), { min: 0.3, max: 1.5, step: 0.01 }),
      slider('Move left / right', this.lab('x'), { min: -1.5, max: 1.5, step: 0.01 }),
      slider('Move up / down', this.lab('y'), { min: -1.5, max: 1.5, step: 0.01 }),
      slider('Rotate', this.lab('rot'), { min: -180, max: 180, step: 1, unit: '°' }),
    ], { open: false, hint: 'The whole drawing moves with its toy. For several spirographs on one screen, add Circle layers (Circle tab) and play them together.' });
  }

  soundGroup(modes, extra) {
    const inst = h('select', {}, INSTRUMENT_GROUPS.map((g) => h('optgroup', { label: g }, Object.entries(INSTRUMENTS).filter(([, v]) => v.group === g).map(([id, v]) => h('option', { value: id }, v.label)))));
    inst.value = this.cur().sound?.instrument || 'kalimba';
    inst.addEventListener('change', () => store.set(`${this.base()}.sound.instrument`, inst.value));
    const mode = { get: () => this.params().sound, set: (v) => { this.patch({ sound: v }); store.set(`${this.base()}.sound.pitch`, 'angle'); } };
    return group('Sound', [
      select('How it sounds', mode, modes), ...extra,
      h('div.ctl.ctl-select', {}, h('label', {}, 'Instrument'), inst),
      slider('Volume', this.sound('volume'), { min: 0, max: 1, step: 0.01 }),
      slider('Reverb', { get: () => store.get('audio.reverb.mix'), set: (v) => store.set('audio.reverb.mix', v) }, { min: 0, max: 0.8, step: 0.01 }),
    ], { open: false });
  }

  spiroView() {
    const P = this.params(), kind = P.kind;
    const out = [];
    out.push(group('Looks', [this.lookCards(LOOKS)], { hint: 'Paper, ink, palette and the toy’s colours in one click. Change each one below.' }));

    // machine
    this.info = h('p.hint.harm-closure', {}, closureInfo(P));
    const pen = [0.35, 0.55, 0.75, 1, 1.25].map((f) => this.chip(`d = ${f}·r`, 'Pen hole at this fraction of the wheel radius', () => { this.remember(); this.patch({ d: +(P.r * f).toFixed(1) }); this.render(); }));
    const machine = [select('Machine', this.lab('kind'), SPIRO_KINDS)];
    if (kind !== 'formula') {
      machine.push(
        h('div.chips-label', {}, 'Toy gear sets (ring / wheel):'),
        h('div.chips', {}, GEAR_SETS.map(([n, R, r]) => this.chip(n, `Ring ${R} teeth, wheel ${r} teeth`, () => { this.remember(); this.patch({ R, r, d: Math.round(r * 0.7) }); this.render(); }))),
        slider('Ring teeth R', this.lab('R'), { min: 20, max: 200, step: 1 }),
        slider('Wheel teeth r', this.lab('r'), { min: 6, max: 160, step: 1 }),
        h('div.chips-label', {}, 'Ring : wheel as an interval:'),
        h('div.chips', {}, INTERVALS.slice(0, 10).map(([r, n, v]) => this.chip(r, n, () => { this.remember(); const g = gearsForRatio(v, P.R); this.patch({ r: g.r, d: Math.round(g.r * 0.7) }); this.render(); }))),
        slider('Pen hole distance d', this.lab('d'), { min: 0, max: 120, step: 0.5 }),
        h('div.chips', {}, pen),
        this.info);
    }
    if (kind === 'compound') machine.push(slider('Second wheel teeth', this.lab('r2'), { min: 5, max: 80, step: 1 }), slider('Second pen distance', this.lab('d2'), { min: 0, max: 60, step: 0.5 }), slider('Second wheel orbit speed', this.lab('m'), { min: -12, max: 12, step: 1 }));
    if (kind === 'lobed') machine.push(slider('Lobes', this.lab('lobes'), { min: 2, max: 8, step: 1 }), slider('Lobe depth', this.lab('lobeAmt'), { min: 0, max: 0.6, step: 0.01 }));
    if (kind === 'formula') {
      machine.push(text('x(t, ring, wheel, d, k)', this.lab('fx'), { placeholder: '(ring-wheel)*cos(t) + d*cos(k*t)' }), text('y(t, ring, wheel, d, k)', this.lab('fy'), { placeholder: '(ring-wheel)*sin(t) - d*sin(k*t)' }),
        h('p.hint', {}, 't is the wheel’s angle, ring and wheel are the teeth numbers below, k = (ring − wheel) ÷ wheel. Try  (ring-wheel)*cos(t)+d*cos(k*t)  or  ring*cos(t)*cos(5*t).'),
        slider('R', this.lab('R'), { min: 20, max: 200, step: 1 }), slider('r', this.lab('r'), { min: 6, max: 160, step: 1 }), slider('d', this.lab('d'), { min: 0, max: 120, step: 0.5 }));
    }
    machine.push(
      text('Pen distance over time  d(t, d, ring, wheel)  (optional)', this.lab('dFormula'), { placeholder: 'd*(0.6 + 0.4*sin(0.1*t))' }),
      slider('Turns of the wheel (0 = until it closes)', this.lab('turns'), { min: 0, max: 200, step: 1, fmt: (v) => (v ? `${v}` : 'until it closes') }),
      slider('Time to draw', this.lab('drawTime'), { min: 4, max: 120, step: 1, unit: ' s' }),
      select('Pace', this.lab('ease'), EASES),
      slider('Pens', this.lab('pens'), { min: 1, max: 3, step: 1 }),
      slider('Distance between pens', this.lab('dStep'), { min: 0.5, max: 20, step: 0.5 }));
    out.push(group('Machine', machine, { hint: 'Teeth decide everything: the drawing has R ÷ gcd(R, r) petals and closes after r ÷ gcd(R, r) turns. An irrational ratio (like the golden ratio) never closes. The pen hole distance d: smaller is smoother, equal to r gives sharp points.' }));

    // the toy
    const show = h('div.row', {}, segmented({ get: () => this.params().toyShow, set: (v) => this.patch({ toyShow: v }) },
      [['on', '👁 Show'], ['intro', '◐ Fade away'], ['off', '⊘ Hide']], { label: 'The toy' }));
    const toy = [show, select('Toy visibility', this.lab('toyShow'), TOY_SHOW), slider('Opacity', this.lab('toyOpacity'), { min: 0, max: 1, step: 0.01 })];
    if (['intro', 'outro', 'inout'].includes(P.toyShow)) toy.push(slider('Fade time', this.lab('toyFade'), { min: 0.2, max: 8, step: 0.1, unit: ' s' }));
    if (P.toyShow === 'intro') toy.push(slider('Visible at the start for', this.lab('toyIntro'), { min: 1, max: 60, step: 0.5, unit: ' s' }));
    toy.push(select('Look', this.lab('toyStyle'), TOY_STYLES), color('Ring colour', this.lab('toyRing')), color('Wheel colour', this.lab('toyWheel')), color('Second wheel colour', this.lab('toyWheel2')), color('Pen colour', this.lab('toyPen')),
      toggle('Pen holes', this.lab('toyHoles')), toggle('Shadow', this.lab('toyShadow')),
      toggle('Move the toy separately from the drawing', this.lab('toyDetach')));
    if (P.toyDetach) toy.push(slider('Toy: left / right', this.lab('toyDx'), { min: -1.5, max: 1.5, step: 0.01 }), slider('Toy: up / down', this.lab('toyDy'), { min: -1.5, max: 1.5, step: 0.01 }), slider('Toy: size', this.lab('toyScale'), { min: 0.2, max: 2, step: 0.01 }), slider('Toy: rotate', this.lab('toyRot'), { min: -180, max: 180, step: 1, unit: '°' }));
    out.push(group('The toy (gears and pen)', toy, { hint: 'The toy is a separate layer over the drawing. Hide it for a clean pattern, let it fade after the first seconds, or fade it out when the drawing is done. Colours and look are yours; moved apart from the drawing it becomes a prop.' }));

    out.push(this.placement());
    out.push(group('Ink', [
      select('Ink', this.lab('ink'), INK_STYLES), select('Colour follows', this.lab('colorBy'), COLOR_BY), select('Palette', this.look('palette'), CIRCLE_PALETTES),
      slider('Colour offset', this.lab('hue0'), { min: 0, max: 1, step: 0.01 }), slider('Colour cycles over the drawing', this.lab('hueRate'), { min: 0, max: 8, step: 0.05 }),
      slider('Line width', this.lab('width'), { min: 0.3, max: 5, step: 0.05 }), slider('Glow', this.look('glow'), { min: 0, max: 2, step: 0.05 }), slider('Bloom', this.look('bloom'), { min: 0, max: 2, step: 0.05 }),
    ], { open: false }));
    out.push(group('Paper & frame', [this.paperCards(P), select('Frame', this.lab('frame'), FRAMES)], { open: false, hint: '“Toy desk” is a wooden desk with a sheet of paper taped on it. Light papers switch the glow off so the ink stays crisp.' }));
    out.push(this.soundGroup({ gear: 'A note every few teeth', petal: 'A note on every petal', ratio: 'The ring and wheel as an interval', off: 'Silent' }, [
      slider('A note every (teeth)', this.lab('every'), { min: 1, max: 48, step: 1 }),
      slider('Interval repeats every', this.lab('ratioEvery'), { min: 0.4, max: 8, step: 0.1, unit: ' s' }),
      slider('Lowest note', this.lab('base'), { min: 24, max: 84, step: 1, fmt: (v) => `${NOTE_NAMES[v % 12]}${Math.floor(v / 12) - 1}` }),
      select('Tuning', this.lab('tuning'), { just: 'Exact ratios', equal: 'Piano keys' }),
    ]));
    return out;
  }

  guillocheView() {
    const P = this.params(), type = P.type;
    const out = [];
    out.push(group('Looks', [this.lookCards(GUILLOCHE_LOOKS)], { hint: 'Paper and inks in one click.' }));
    const pat = [select('Pattern', this.lab('type'), GUILLOCHE_TYPES)];
    if (type === 'rosette') pat.push(slider('Lines', this.lab('lines'), { min: 6, max: 160, step: 1 }), slider('Ring teeth R', this.lab('R'), { min: 20, max: 200, step: 1 }), slider('Wheel teeth r', this.lab('r'), { min: 6, max: 160, step: 1 }),
      slider('Pen distance d', this.lab('d'), { min: 0, max: 100, step: 0.5 }), slider('d grows per line', this.lab('dStep'), { min: -1, max: 1, step: 0.01 }), slider('Each line turned by', this.lab('turnStep'), { min: 0, max: 30, step: 0.1, unit: '°' }));
    if (type === 'dial' || type === 'lathe') pat.push(slider('Rings', this.lab('rings'), { min: 20, max: 220, step: 1 }), slider('Waves around each ring', this.lab('lobes'), { min: 2, max: 40, step: 1 }), slider('Wave size', this.lab('amp'), { min: 0, max: 0.06, step: 0.001 }),
      slider('Waves grow outward', this.lab('ampGrow'), { min: 0, max: 3, step: 0.05 }), slider('Shift per ring', this.lab('phaseStep'), { min: 0, max: 1, step: 0.005 }), slider('Inner radius', this.lab('innerR'), { min: 0, max: 0.4, step: 0.005 }));
    if (type === 'dial') pat.push(slider('Second wave count', this.lab('harmonic'), { min: 2, max: 24, step: 1 }), slider('Second wave size', this.lab('harmonic2'), { min: 0, max: 2, step: 0.05 }), slider('Sunburst rays', this.lab('rays'), { min: 0, max: 240, step: 1 }),
      select('Dial furniture', this.lab('furniture'), { none: 'None', ticks: 'Bezel and hour marks', hands: 'Bezel, marks and hands' }));
    if (type === 'ribbon') pat.push(slider('Strands', this.lab('strands'), { min: 6, max: 50, step: 1 }), slider('Waves', this.lab('waves'), { min: 2, max: 24, step: 1 }), slider('Wave size', this.lab('bandAmp'), { min: 0.005, max: 0.12, step: 0.001 }),
      toggle('Corner rosettes', this.lab('corners')), toggle('Centre rosette', this.lab('centre')), slider('Rosette ring teeth R', this.lab('R'), { min: 20, max: 200, step: 1 }), slider('Rosette wheel teeth r', this.lab('r'), { min: 6, max: 160, step: 1 }));
    if (type === 'formula') pat.push(text('r(a, k, n, u)', this.lab('fR'), { placeholder: '0.3 + 0.6*u + 0.04*sin(8*a + k*0.15)' }), h('p.hint', {}, 'a is the angle round the ring, k the ring number, n how many rings, u = k ÷ n (0 … 1). Values around 0 … 1.'),
      slider('Rings', this.lab('rings'), { min: 20, max: 220, step: 1 }));
    pat.push(slider('Time to draw', this.lab('revealTime'), { min: 3, max: 90, step: 1, unit: ' s' }), select('Pace', this.lab('ease'), EASES));
    out.push(group('Pattern', pat, { hint: 'Every pattern is drawn line by line, like the engraving machine: rosettes are one hypotrochoid turned a little for each line, dials and lathe work are rings with waves that shift from ring to ring.' }));
    const inks = [select('Colours', this.lab('colors'), GUILLOCHE_COLORS)];
    if (P.colors !== 'palette') inks.push(color('Ink 1', this.lab('ink1')));
    if (P.colors === 'bands') inks.push(color('Ink 2', this.lab('ink2')), color('Ink 3', this.lab('ink3')));
    if (P.colors === 'palette') inks.push(select('Palette', this.look('palette'), CIRCLE_PALETTES), slider('Colour offset', this.lab('hue0'), { min: 0, max: 1, step: 0.01 }), slider('Colour range', this.lab('hueSpan'), { min: 0, max: 3, step: 0.05 }));
    inks.push(slider('Line width', this.lab('width'), { min: 0.3, max: 4, step: 0.05 }), slider('Line strength', this.lab('alpha'), { min: 0.1, max: 1, step: 0.01 }), slider('Glow', this.look('glow'), { min: 0, max: 2, step: 0.05 }), slider('Bloom', this.look('bloom'), { min: 0, max: 2, step: 0.05 }));
    out.push(group('Ink', inks, { open: false }));
    out.push(this.placement());
    out.push(group('Paper & frame', [this.paperCards(P), select('Frame', this.lab('frame'), FRAMES)], { open: false }));
    out.push(this.soundGroup({ sweep: 'A note per line (rising)', off: 'Silent' }, [slider('Note every (lines)', this.lab('every'), { min: 1, max: 20, step: 1 }), slider('Lowest note', this.lab('base'), { min: 24, max: 84, step: 1, fmt: (v) => `${NOTE_NAMES[v % 12]}${Math.floor(v / 12) - 1}` })]));
    return out;
  }
}
