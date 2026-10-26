import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultCircle, eventsUntil, CIRCLE_RULES, ruleGroups, captionLine, formulaLine, CircleSim } from '../src/circle/sim.js';
import { notesForEvents } from '../src/circle/sound.js';
import {
  spiroMachine, closureInfo, toyAlpha, gearPoints, gearsForRatio, luckySpiro, luckyGuilloche, guillocheLines, guillocheLine, GUILLOCHE_DEFAULTS as GD, SPIRO_DEFAULTS as D,
  SPIRO_KINDS, TOY_STYLES, TOY_SHOW, GUILLOCHE_TYPES, PAPERS, INK_STYLES, FRAMES,
} from '../src/circle/spirograph.js';

const TAU = Math.PI * 2;
const cfgOf = (rule, lab = {}) => ({ ...defaultCircle(), rule, lab: { [rule]: lab } });

test('spirograph and guilloche are registered, captioned and share a group', () => {
  assert.ok(CIRCLE_RULES.spirograph && CIRCLE_RULES.guilloche);
  const g = Object.fromEntries(ruleGroups()).Spirograph.map(([id]) => id);
  assert.deepEqual(g.sort(), ['guilloche', 'spirograph']);
  for (const k of Object.keys(SPIRO_KINDS)) assert.ok(captionLine(cfgOf('spirograph', { kind: k })));
  for (const k of Object.keys(GUILLOCHE_TYPES)) { assert.ok(captionLine(cfgOf('guilloche', { type: k }))); assert.ok(formulaLine(cfgOf('guilloche', { type: k }))); }
});

test('96 / 30: 16 petals, closes after 5 turns, and the curve really returns to its start', () => {
  const m = spiroMachine(D);
  assert.equal(m.turns, 5);
  assert.equal(m.petals, 16);
  const a = m.at(0, 21), b = m.at(TAU * 5, 21);
  assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-9);
  assert.ok(Math.hypot(...m.at(TAU * 2.5, 21).map((v, i) => v - a[i])) > 1, 'not closed halfway');
  assert.match(closureInfo(D), /5 turns.*16 petals/);
});

test('the pen on the rim draws the classic curves: astroid, cardioid', () => {
  const m = spiroMachine({ ...D, R: 96, r: 24, d: 24 });
  for (let i = 0; i < 50; i++) { const [x, y] = m.at(i * 0.13, 24); assert.ok(Math.abs(Math.abs(x) ** (2 / 3) + Math.abs(y) ** (2 / 3) - 96 ** (2 / 3)) < 1e-6, 'astroid'); }
  const c = spiroMachine({ ...D, kind: 'epi', R: 40, r: 40, d: 40 });
  for (let i = 0; i < 50; i++) { // a cardioid is r = 80 (1 − cos φ) round its cusp at (40, 0)
    const th = i * 0.13, [x, y] = c.at(th, 40);
    assert.ok(Math.abs(Math.hypot(x - 40, y) - 80 * (1 - Math.cos(th))) < 1e-6);
  }
  assert.equal(c.turns, 1);
});

test('an irrational ratio never closes and says so; the extent covers the drawing', () => {
  const m = spiroMachine({ ...D, R: 100, r: 38.2, maxTurns: 30 });
  assert.equal(m.closes, false);
  assert.match(closureInfo({ ...D, R: 100, r: 38.2, maxTurns: 30 }), /Does not close/);
  for (const kind of Object.keys(SPIRO_KINDS)) {
    const mm = spiroMachine({ ...D, kind });
    for (let i = 0; i < 400; i++) { const [x, y] = mm.at(i * 0.11, 21); assert.ok(Number.isFinite(x) && Number.isFinite(y), kind); assert.ok(Math.hypot(x, y) <= mm.E * 1.001 + 1e-9 || i * 0.11 > TAU * Math.min(12, mm.turns), `${kind} within E`); }
  }
});

test('formulas: a bad formula draws a point instead of failing; d(t) changes the pen distance', () => {
  const bad = spiroMachine({ ...D, kind: 'formula', fx: 'cos(', fy: 'sin(t)' });
  assert.equal(bad.formulaOk, false);
  assert.equal(bad.at(1, 21)[0], 0);
  const f = spiroMachine({ ...D, kind: 'formula', fx: 'ring*cos(t)', fy: 'ring*sin(t)' });
  assert.ok(Math.abs(f.at(0.7, 5)[0] - 96 * Math.cos(0.7)) < 1e-9);
  const dt = spiroMachine({ ...D, dFormula: 'd*0.5' });
  const plain = spiroMachine(D);
  assert.ok(Math.hypot(...dt.at(1, 20).map((v, i) => v - plain.at(1, 10)[i])) < 1e-9, 'd(t) = d/2 equals half the distance');
});

test('compound and lobed machines keep the pen inside the ring', () => {
  const c = spiroMachine({ ...D, kind: 'compound', R: 120, r: 48, d: 20, r2: 19, d2: 9, m: 7 });
  const l = spiroMachine({ ...D, kind: 'lobed', lobes: 3, lobeAmt: 0.2 });
  for (let i = 0; i < 600; i++) { assert.ok(Math.hypot(...c.at(i * 0.07, 20)) <= 121); assert.ok(Math.hypot(...l.at(i * 0.07, 21)) <= 100); }
  const r = c.rig(1.3, 20);
  assert.equal(r.wheels.length, 2);
  assert.ok(Math.abs(r.pen[0] - c.at(1.3, 20)[0]) < 1e-9 && Math.abs(r.pen[1] - c.at(1.3, 20)[1]) < 1e-9, 'the toy’s pen is where the curve is');
  for (const kind of ['hypo', 'epi', 'lobed']) { const m = spiroMachine({ ...D, kind }); const rg = m.rig(2.1, 21); const p = m.at(2.1, 21); assert.ok(Math.hypot(rg.pen[0] - p[0], rg.pen[1] - p[1]) < 1e-6, `${kind} rig matches curve`); }
});

test('the drawing takes its time: paced, finished on schedule, deterministic', () => {
  const run = () => { const sim = new CircleSim(cfgOf('spirograph', { drawTime: 10, ease: 'steady' }), { duration: 20, bpm: 100 }); return sim; };
  const a = run(), b = run();
  a.advance(5); b.advance(5);
  assert.ok(Math.abs(a.sc.th - TAU * 5 * 0.5) < 0.05, `halfway ${a.sc.th}`);
  assert.deepEqual(Array.from(a.sc.pts[0].x.subarray(100, 110)), Array.from(b.sc.pts[0].x.subarray(100, 110)));
  a.advance(12);
  assert.equal(a.sc.tau, 1);
  assert.ok(Math.abs(a.sc.th - TAU * 5) < 1e-6);
  const slow = new CircleSim(cfgOf('spirograph', { drawTime: 10, ease: 'intro' }), { duration: 20 });
  slow.advance(2);
  assert.ok(slow.sc.th < TAU * 5 * 0.2 * 0.5, 'the intro pace starts slowly');
});

test('sound: gear ticks, petals and the ring : wheel interval', () => {
  const gear = eventsUntil(cfgOf('spirograph', { drawTime: 10, every: 6, sound: 'gear' }), 20, { duration: 20 });
  assert.ok(Math.abs(gear.length - (96 * 5) / 6) <= 2, `${gear.length}`);
  const petal = eventsUntil(cfgOf('spirograph', { drawTime: 10, sound: 'petal', ease: 'steady' }), 20, { duration: 20 });
  assert.ok(petal.length >= 14 && petal.length <= 20, `${petal.length}`);
  const ratio = eventsUntil(cfgOf('spirograph', { R: 96, r: 64, d: 40, drawTime: 10, sound: 'ratio', ratioEvery: 2, base: 48 }), 12, { duration: 12 });
  assert.ok(Math.abs(ratio[1].midi - ratio[0].midi - 12 * Math.log2(1.5)) < 1e-9 && ratio[1].together);
  assert.equal(eventsUntil(cfgOf('spirograph', { sound: 'off' }), 10, { duration: 10 }).length, 0);
  const n = notesForEvents(ratio, cfgOf('spirograph'), { scale: 'chromatic', root: 0, noteLow: 40, noteHigh: 90 });
  assert.ok(n.length >= 2);
});

test('the toy as an element: show, hide, fade in and out', () => {
  const sc = { doneT: null };
  assert.equal(toyAlpha({ toyShow: 'on', toyOpacity: 1 }, 5, sc), 1);
  assert.equal(toyAlpha({ toyShow: 'off', toyOpacity: 1 }, 5, sc), 0);
  assert.equal(toyAlpha({ toyShow: 'on', toyOpacity: 0.4 }, 5, sc), 0.4);
  const intro = { toyShow: 'intro', toyOpacity: 1, toyIntro: 8, toyFade: 2 };
  assert.equal(toyAlpha(intro, 7, sc), 1);
  assert.ok(Math.abs(toyAlpha(intro, 9, sc) - 0.5) < 1e-9);
  assert.equal(toyAlpha(intro, 11, sc), 0);
  const outro = { toyShow: 'outro', toyOpacity: 1, toyFade: 2 };
  assert.equal(toyAlpha(outro, 30, sc), 1);
  assert.equal(toyAlpha(outro, 33, { doneT: 30 }), 0);
  const inout = { toyShow: 'inout', toyOpacity: 1, toyFade: 2 };
  assert.equal(toyAlpha(inout, 0, sc), 0);
  assert.equal(toyAlpha(inout, 2, sc), 1);
  assert.equal(toyAlpha(inout, 31, { doneT: 30 }), 0.5);
  for (const k of Object.keys(TOY_SHOW)) assert.ok(typeof toyAlpha({ toyShow: k, toyOpacity: 1, toyIntro: 3, toyFade: 1 }, 1, sc) === 'number');
});

test('gears: a tooth count, teeth point the right way, gear sets and interval ratios', () => {
  const ext = gearPoints(0, 0, 30, 30, 0, false), inn = gearPoints(0, 0, 96, 96, 0, true);
  assert.equal(ext.length, 30 * 4);
  assert.equal(inn.length, 96 * 4);
  const rad = (pts) => pts.map(([x, y]) => Math.hypot(x, y));
  assert.ok(Math.max(...rad(ext)) > 30 && Math.min(...rad(ext)) < 30);
  assert.ok(Math.min(...rad(inn)) < 96 && Math.max(...rad(inn)) > 96);
  assert.deepEqual(gearsForRatio(1.5, 96), { R: 96, r: 64 });
  const lobed = gearPoints(0, 0, 30, 30, 0, false, 3, 0.2);
  assert.ok(Math.max(...rad(lobed)) - Math.min(...rad(lobed)) > 8, 'the lobes show');
});

test('lucky spirographs always close within a few turns; lucky guilloche settings are valid', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const { lab, look } = luckySpiro(seed);
    const m = spiroMachine({ ...D, ...lab });
    assert.ok(Number.isFinite(m.E) && m.E > 5, `seed ${seed}`);
    assert.ok(PAPERS[lab.paper] && look.palette);
    if (lab.kind !== 'compound') assert.ok(m.closes && m.orbits <= 14 && m.petals >= 3, `seed ${seed}: ${m.orbits} turns, ${m.petals} petals`);
    const g = luckyGuilloche(seed);
    assert.ok(GUILLOCHE_TYPES[g.lab.type] && guillocheLines({ ...GD, ...g.lab }) > 10);
  }
  assert.deepEqual(luckySpiro(5), luckySpiro(5));
  assert.notDeepEqual(luckySpiro(5).lab, luckySpiro(6).lab);
});

test('guilloche lines: counts per pattern and finite points', () => {
  const W = { hw: 1, hh: 1.2 };
  for (const type of Object.keys(GUILLOCHE_TYPES)) {
    const P = { ...GD, type };
    const n = guillocheLines(P);
    assert.ok(n >= 20, type);
    for (const k of [0, 1, Math.floor(n / 2), n - 1]) {
      const { pts } = guillocheLine(P, k, W, type === 'formula' ? ((s) => 0.3 + 0.5 * s.u) : null);
      assert.ok(pts.length > 50 && pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)), `${type} line ${k}`);
    }
  }
  assert.equal(guillocheLines({ ...GD, type: 'ribbon', strands: 10, corners: false, centre: false }), 40);
  assert.equal(guillocheLine({ ...GD, type: 'ribbon' }, 0, W).world, true);
  assert.equal(guillocheLine({ ...GD, type: 'rosette' }, 0, W).world, false);
});

test('guilloche reveals one line after another and plays a rising note per line', () => {
  const ev = eventsUntil(cfgOf('guilloche', { type: 'lathe', rings: 60, revealTime: 12, every: 2, ease: 'steady' }), 14, { duration: 14 });
  assert.ok(ev.length >= 28 && ev.length <= 31, `${ev.length}`);
  assert.ok(ev[ev.length - 1].pitch > ev[0].pitch);
  const sim = new CircleSim(cfgOf('guilloche', { type: 'dial', rings: 40, revealTime: 10, ease: 'steady' }), { duration: 20 });
  sim.advance(5);
  assert.ok(Math.abs(sim.sc.pos - 20) < 0.5);
});

test('painting works for every look: toy styles, papers, inks, frames, guilloche patterns', () => {
  const calls = [];
  const mk = () => new Proxy({ canvas: { width: 540, height: 960 } }, { get: (t, k) => (k in t ? t[k] : (...a) => { calls.push(k); return { addColorStop() {} }; }), set: (t, k, v) => { t[k] = v; return true; } });
  globalThis.document = { createElement: () => { const c = { width: 0, height: 0 }; c.getContext = () => { const g = mk(); g.canvas = c; return g; }; return c; } };
  const g = mk();
  const pal = { ring: '#fff', glow: '#0ff', ball: '#fff', line: () => '#fff' };
  const draw = (rule, lab, t = 3) => {
    const sim = new CircleSim(cfgOf(rule, lab), { duration: 14, bpm: 100 });
    sim.advance(t);
    sim.scene.draw(sim, sim.P, { g, X: (x) => 270 + x * 230, Y: (y) => 480 - y * 230, R: 230, k: 0.54, pal, look: {}, time: t, lastHit: 2, energy: 0 });
    assert.ok(typeof sim.scene.stats(sim, sim.P) === 'string');
  };
  for (const kind of Object.keys(SPIRO_KINDS)) for (const toyStyle of Object.keys(TOY_STYLES)) draw('spirograph', { kind, toyStyle, drawTime: 8 });
  for (const paper of Object.keys(PAPERS)) draw('spirograph', { paper, drawTime: 8 });
  for (const ink of Object.keys(INK_STYLES)) for (const colorBy of ['time', 'turn', 'speed', 'radius', 'angle', 'pen']) draw('spirograph', { ink, colorBy, pens: 2, drawTime: 8 });
  for (const frame of Object.keys(FRAMES)) draw('spirograph', { frame, drawTime: 8 });
  for (const toyShow of Object.keys(TOY_SHOW)) draw('spirograph', { toyShow, toyDetach: true, toyDx: 0.3, toyScale: 0.5, toyRot: 20, drawTime: 6 }, 9);
  draw('spirograph', { kind: 'formula', fx: 'bad((', fy: '1', drawTime: 8 });
  for (const type of Object.keys(GUILLOCHE_TYPES)) for (const colors of ['palette', 'bands', 'mono']) draw('guilloche', { type, colors, revealTime: 6, furniture: 'hands', rays: 40 }, 5);
  draw('guilloche', { type: 'dial', revealTime: 4, furniture: 'hands' }, 8);
  assert.ok(calls.length > 2000);
  delete globalThis.document;
});
