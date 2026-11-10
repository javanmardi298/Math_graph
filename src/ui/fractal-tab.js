/**
 * The Fractals tab: one workshop for the fractal scenes of the Circle Lab (circle/fractal-lab.js and
 * the older L-system curves). It edits the Circle layer being edited, so presets, sound, exports and
 * the other layers work as everywhere else.
 *
 *   What         Explorer (escape-time families) · Buddhabrot · Lyapunov · Chaos game (IFS) · Curves (L-systems)
 *   Gallery      one-click starting points (GALLERY below: add a row to add a card)
 *   Explorer     family and formula, Mandelbrot / Julia view, journey (zoom, Julia morph, power, pan, still),
 *                palette and colouring, detail, sound
 *   Others       the scene's own settings (built from its `controls` list)
 *
 * Agents: every setting is `circle.lab.<rule>.<key>`; see FRACTAL_TYPES, FRACTAL_SPOTS, JULIA_PATHS,
 * FRACTAL_PALETTES and IFS_SYSTEMS in circle/fractal-lab.js for the allowed values.
 */
import { store } from '../state.js';
import { h, group, slider, select, toggle, text, refreshAll, disposeTree } from './controls.js';
import { SCENES, sceneParams } from '../circle/scenes.js';
import { FRACTAL_TYPES, FRACTAL_SPOTS, FRACTAL_PALETTES, PALETTE_LABELS, IFS_SYSTEMS } from '../circle/fractal-lab.js';
import { INSTRUMENTS, INSTRUMENT_GROUPS } from '../audio/instruments.js';
import { GALLERY } from '../circle/fractal-gallery.js';

export { GALLERY };

export const FRACTAL_RULES = ['fractal', 'buddha', 'lyapunov', 'ifs', 'lsystem', 'mandel'];
const WHAT = [['fractal', 'Explorer'], ['buddha', 'Buddhabrot'], ['lyapunov', 'Lyapunov'], ['ifs', 'Chaos game'], ['lsystem', 'Curves']];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export class FractalTab {
  /** @param {{circleTarget:()=>{base:string,L:object}, toast:(m:string)=>void}} actions */
  constructor(actions) {
    this.actions = actions;
    this.hist = [];
    this.el = h('section.tab.harm-tab.fractal-tab');
    this.render();
  }

  cur() { return this.actions.circleTarget().L; }
  base() { return this.actions.circleTarget().base; }
  get rule() { return this.cur().rule; }
  get on() { return store.state.mode === 'circle' && FRACTAL_RULES.includes(this.rule); }
  P() { return sceneParams(this.cur()) || {}; }

  /** Binding to one setting of the current fractal scene. */
  lab(key) {
    return { get: () => this.P()[key], set: (v) => { const c = this.cur(); store.set(`${this.base()}.lab.${c.rule}`, { ...(c.lab?.[c.rule] || {}), [key]: v }); } };
  }
  patch(obj, rule = this.rule) {
    const c = this.cur();
    store.set(`${this.base()}.lab.${rule}`, { ...(c.lab?.[rule] || {}), ...obj });
  }

  remember() {
    const c = this.cur();
    this.hist.push(structuredClone({ rule: c.rule, lab: c.lab, look: c.look, sound: c.sound }));
    if (this.hist.length > 30) this.hist.shift();
  }
  undo() {
    const s = this.hist.pop();
    if (!s) return;
    for (const k of ['lab', 'look', 'sound', 'rule']) store.set(`${this.base()}.${k}`, s[k]);
    refreshAll();
    this.render();
  }

  start(rule = 'fractal') {
    if (store.state.mode !== 'circle') store.set('mode', 'circle');
    store.set(`${this.base()}.rule`, rule);
    refreshAll();
    this.render();
  }

  /** Apply a gallery card: the scene, its settings (replacing the old ones) and the matching sound and look. */
  apply([name, rule, lab, extra = {}]) {
    this.remember();
    if (store.state.mode !== 'circle') store.set('mode', 'circle');
    const b = this.base(), c = this.cur();
    store.set(`${b}.lab`, { ...(c.lab || {}), [rule]: { ...lab } });
    store.set(`${b}.rule`, rule);
    store.set(`${b}.look`, { ...(this.cur().look || {}), background: '#03040a', ambience: false, counter: false, sparks: false, ...(extra.palette ? { palette: extra.palette } : {}) });
    store.set(`${b}.sound`, { ...(this.cur().sound || {}), pitch: 'angle', instrument: extra.instrument || 'glass-pad', length: 0.6, volume: 0.6 });
    if (extra.duration) store.set('transport.duration', extra.duration);
    this.actions.toast?.(`Fractal: ${name}`);
    refreshAll();
    this.render();
  }

  lucky() {
    const kind0 = ['mandelbrot', 'burningship', 'tricorn', 'celtic', 'buffalo', 'perpendicular', 'heart', 'multibrot'];
    const colors = pick(Object.keys(FRACTAL_PALETTES)), coloring = pick(['smooth', 'smooth', 'smooth', 'trap', 'stripes', 'angle', 'bands']);
    const roll = Math.random();
    let lab;
    if (roll < 0.35) lab = { type: 'mandelbrot', journey: 'zoom', spot: pick(Object.keys(FRACTAL_SPOTS).filter((k) => FRACTAL_SPOTS[k][1] === 'mandelbrot')), depth: 4 + Math.round(Math.random() * 10) / 2 };
    else if (roll < 0.75) { const type = pick(kind0); lab = { type, julia: true, journey: 'julia', jpath: pick(['circle', 'cardioid', 'bulb']), jr: +(0.6 + Math.random() * 0.3).toFixed(3), jspeed: +(0.02 + Math.random() * 0.04).toFixed(3), power: 2 + Math.floor(Math.random() * 4) }; }
    else if (roll < 0.9) lab = { type: 'newton', journey: pick(['still', 'power']), power: 3 + Math.floor(Math.random() * 4), power2: 8, relax: pick([1, 1, 1.4, 1.7]), rotate: 0.008 };
    else lab = { type: pick(kind0), journey: pick(['still', 'pan']), zoom: 1.2, cycle: 0.04 };
    this.apply(['a lucky one', 'fractal', { ...lab, colors, coloring, trap: pick(['point', 'cross', 'circle', 'line']), density: +(0.6 + Math.random() * 1.6).toFixed(2) }, { instrument: pick(['glass-pad', 'bell', 'kalimba', 'e-piano', 'harp', 'vibraphone', 'santur', 'warm-pad']) }]);
  }

  /** One control from a scene's `controls` row. */
  ctl([key, label, kind, a, b, st, unit]) {
    if (kind === 's') return select(label, this.lab(key), a);
    if (kind === 't') return toggle(label, this.lab(key));
    if (kind === 'x' || kind === 'f') return text(label, this.lab(key), { placeholder: a });
    return slider(label, this.lab(key), { min: a, max: b, step: st, unit: unit || '' });
  }
  rows(keys) {
    const all = SCENES[this.rule]?.controls || [];
    return keys.map((k) => all.find((c) => c && c[0] === k)).filter(Boolean).map((c) => this.ctl(c));
  }

  paletteCards() {
    const cur = this.P().colors;
    return h('div.harm-looks.fractal-palettes', {}, Object.entries(FRACTAL_PALETTES).map(([id, stops]) => h('button.harm-look', {
      type: 'button', 'aria-pressed': String(cur === id), title: PALETTE_LABELS[id], style: `background: linear-gradient(90deg, ${stops.join(', ')})`,
      onclick: () => { this.remember(); this.patch({ colors: id }); this.render(); },
    }, h('span.fractal-pal-name', {}, PALETTE_LABELS[id]))));
  }

  soundGroup(extraKeys = []) {
    const b = this.base();
    const sel = h('select', { 'aria-label': 'Instrument' }, INSTRUMENT_GROUPS.map((g) => h('optgroup', { label: g }, Object.entries(INSTRUMENTS).filter(([, i]) => i.group === g).map(([id, i]) => h('option', { value: id }, i.label)))));
    sel.value = this.cur().sound?.instrument || 'glass-pad';
    sel.addEventListener('change', () => store.set(`${b}.sound.instrument`, sel.value));
    const sb = (k) => ({ get: () => store.get(`${b}.sound.${k}`), set: (v) => store.set(`${b}.sound.${k}`, v) });
    return group('Sound', [
      ...this.rows(extraKeys),
      h('div.ctl.ctl-select', {}, h('label', {}, 'Instrument'), sel),
      slider('Note length', sb('length'), { min: 0.05, max: 2, step: 0.01, unit: ' s' }),
      slider('Volume', sb('volume'), { min: 0, max: 1, step: 0.01 }),
    ], { open: false, hint: 'Scale, key and note range come from the Sound tab. Journey: the notes climb with the zoom or turn with c. Orbit: each note is a step of the orbit of a point wandering over the picture: calm inside the set, wild at its edge.' });
  }

  explorerView() {
    const P = this.P(), T = FRACTAL_TYPES[P.type] || FRACTAL_TYPES.mandelbrot;
    const julia = P.julia || T.juliaOnly, newton = T.kind === 3;
    const journeyKeys = { zoom: ['spot', ...(P.spot === 'custom' ? ['cx', 'cy'] : []), 'depth', 'wait'], julia: ['jpath', ...(P.jpath === 'line' ? ['jx', 'jy', 'jx2', 'jy2'] : P.jpath === 'fixed' ? ['jx', 'jy'] : P.jpath === 'bulb' ? [] : ['jr']), 'jspeed'], power: ['power', 'power2'], pan: ['zoom'], still: ['zoom'] }[P.journey] || [];
    const rerender = (ctl) => { ctl.addEventListener('change', () => setTimeout(() => this.render(), 0)); return ctl; };
    return [
      group('Family and formula', [
        rerender(this.rows(['type'])[0]),
        h('p.fractal-formula', {}, T.formula),
        ...(newton || T.juliaOnly ? [] : [rerender(this.rows(['julia'])[0])]),
        ...((P.type === 'multibrot' || newton) && P.journey !== 'power' ? this.rows(['power']) : []),
        ...(newton ? this.rows(['relax']) : []),
        ...(julia && !newton && P.journey !== 'julia' ? this.rows(['jx', 'jy']) : []),
      ], { hint: 'The same rule is repeated for every point. Mandelbrot view: the point is c and z starts at 0; black = the orbit never escapes. Julia view: c stays fixed and the point is where z starts; every c has its own Julia set.' }),
      group('Journey', [rerender(this.rows(['journey'])[0]), ...journeyKeys.map((k) => (k === 'spot' || k === 'jpath' ? rerender(this.rows([k])[0]) : this.rows([k])[0])).filter(Boolean)],
        { hint: 'Zoom: ×10 for every step of depth; beyond about ×100 000 the picture is computed with exact numbers (slower, lower detail). Julia morph: c travels and the set changes shape. Make the video length (timeline) longer for a slower journey.' }),
      group('Colour', [
        this.paletteCards(),
        rerender(this.rows(['coloring'])[0]),
        ...(P.coloring === 'trap' || P.interior === 'glow' ? this.rows(['trap']) : []),
        ...this.rows(['density', 'cycle']),
        ...(newton ? [] : [rerender(this.rows(['interior'])[0])]),
      ]),
      group('Picture', this.rows(['rotate', 'iter', 'res', 'bleed', 'showOrbit']), { open: false, hint: 'More iterations show finer filaments deep in a zoom. Detail is the width of the computed picture in pixels.' }),
      this.soundGroup(['sound', 'nps']),
    ];
  }

  genericView() {
    const scene = SCENES[this.rule];
    const cards = this.rule === 'ifs' ? h('div.chips', {}, Object.entries(IFS_SYSTEMS).map(([id, s]) => h('button.chip', { type: 'button', 'aria-pressed': String(this.P().system === id), onclick: () => { this.remember(); this.patch({ system: id }); store.emit(`${this.base()}.redraw`); this.render(); } }, s.label))) : null;
    const hasPalette = (scene.controls || []).some((c) => c && c[0] === 'colors');
    return [
      group(scene.label, [cards, hasPalette ? this.paletteCards() : null, ...scene.controls.filter((c) => c && c[0] !== 'colors' && !(cards && c[0] === 'system')).map((c) => this.ctl(c)),
        h('button.btn', { type: 'button', onclick: () => { this.remember(); store.set(`${this.base()}.lab.${this.rule}`, {}); refreshAll(); this.render(); } }, 'Reset these to the defaults')].filter(Boolean),
      { hint: { buddha: 'Random points c are tried; when an orbit escapes, every step of it leaves a mark. Long orbits come from points near the edge of the set and draw the fine structure.', lyapunov: 'A population with two growth rates that alternate in a fixed rhythm. Each pixel is a pair (A, B): colours where the population settles, dark where it is chaotic.', ifs: 'A point jumps again and again by one of a few shrinking rules chosen by chance. The dots it leaves always fill the same shape.', lsystem: 'A drawing rule rewritten step by step: every line becomes a small copy of the whole.' }[this.rule] || '' }),
      this.soundGroup(),
    ];
  }

  render() {
    disposeTree(this.el);
    const kids = [];
    kids.push(h('div.circle-intro', {}, h('p.hint', {}, 'Fractals: shapes that repeat inside themselves. Zoom into the Mandelbrot set and its relatives, let Julia sets morph, watch Newton’s method fight over roots, grow ferns and dragons from chance, and hear the orbits.')));
    if (!this.on) {
      kids.push(h('div.harm-start', {},
        h('button.btn.primary', { type: 'button', onclick: () => this.apply(GALLERY[0]) }, '❄ Start with a Mandelbrot zoom'),
        h('button.btn', { type: 'button', onclick: () => this.lucky() }, '🎲 A lucky fractal'),
        h('p.hint', {}, 'Presets are on the “Fractals” shelves of the Presets tab.')));
    } else {
      kids.push(h('div.chips', {}, WHAT.map(([id, label]) => h('button.chip', { type: 'button', 'aria-pressed': String(this.rule === id || (id === 'fractal' && this.rule === 'mandel')), onclick: () => { this.remember(); this.start(id); } }, label))));
      this.undoBtn = h('button.btn.small.ghost', { type: 'button', disabled: !this.hist.length, title: 'Back to before the last change', onclick: () => this.undo() }, '↶ Undo');
      kids.push(h('div.row.harm-top', {},
        h('button.btn.primary', { type: 'button', title: 'A good-looking random fractal', onclick: () => this.lucky() }, '🎲 Lucky'),
        this.undoBtn,
        h('button.btn.small.ghost', { type: 'button', title: 'Start again from the beginning', onclick: () => store.emit(`${this.base()}.redraw`) }, '↻ Restart')));
    }
    kids.push(group('Gallery', [h('div.chips.fractal-gallery', {}, GALLERY.map((gItem) => h('button.chip', { type: 'button', title: `${SCENES[gItem[1]]?.label || gItem[1]}`, onclick: () => this.apply(gItem) }, gItem[0])))], { hint: 'One click sets the fractal, its journey, colours and sound. Everything can be changed below.' }));
    if (this.on) {
      kids.push(...(this.rule === 'fractal' ? this.explorerView() : this.genericView()).filter(Boolean));
      kids.push(h('p.hint.harm-foot', {}, 'Video length, tempo and the camera are in the timeline, Rhythm and Camera tabs; text on the video in the Circle tab. Several fractals in one video: add Circle layers (left panel).'));
    }
    this.el.replaceChildren(...kids);
  }
}
