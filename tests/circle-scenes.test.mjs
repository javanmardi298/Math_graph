import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CircleSim, defaultCircle, eventsUntil, formulaLine, CIRCLE_RULES, ruleGroups } from '../src/circle/sim.js';
import { SCENES, sceneParams } from '../src/circle/scenes.js';
import { speedAt, worldFor, pixelFrame } from '../src/circle/layout.js';
import { LAB_PRESETS } from '../src/circle/presets-lab.js';
import { beats, RPS_NAMES, formulaError, pretty } from '../src/circle/battles.js';
import { circleSchedule, visibleAt, headlineAt } from '../src/circle/stack.js';
import { STACK_PRESETS } from '../src/circle/presets-stack.js';

const cfg = (rule, lab = {}, extra = {}) => ({ ...defaultCircle(), rule, lab: { [rule]: lab }, ...extra });
const env = { duration: 30, bpm: 120, ratio: 9 / 16 };

test('there are 25+ new simulations, all grouped in the picker', () => {
  assert.ok(Object.keys(SCENES).length >= 25);
  const listed = ruleGroups().flatMap(([, items]) => items.map(([id]) => id));
  assert.deepEqual(new Set(listed), new Set(Object.keys(CIRCLE_RULES)));
});

test('every scene runs, makes sound events, has a formula and a counter', () => {
  for (const id of Object.keys(SCENES)) {
    const c = cfg(id);
    const sim = new CircleSim(c, env);
    const ev = [];
    sim.advance(12, (e) => ev.push(e));
    assert.ok(ev.length > 0, `${id} makes events`);
    assert.ok(ev.every((e) => Number.isFinite(e.t) && e.t <= 12 + 1e-9), `${id} event times`);
    assert.equal(typeof formulaLine(c), 'string');
    assert.ok(SCENES[id].stats(sim, sim.P).length > 0, `${id} counter`);
  }
});

test('scenes are deterministic', () => {
  for (const id of ['triple', 'galton', 'paper', 'chaos', 'colorwar', 'coral']) {
    assert.deepEqual(eventsUntil(cfg(id), 6, env), eventsUntil(cfg(id), 6, env), id);
  }
});

test('balls stay inside the world (safe area)', () => {
  for (const id of ['triple', 'boxcore', 'shatter', 'escapeplus', 'beatfill', 'galton', 'hexagon']) {
    const sim = new CircleSim(cfg(id), env);
    sim.advance(15);
    for (const b of sim.balls) {
      assert.ok(Math.abs(b.x) <= sim.W.hw + 0.05 && Math.abs(b.y) <= sim.W.hh + 0.05, `${id}: ball at ${b.x.toFixed(2)}, ${b.y.toFixed(2)}`);
    }
  }
});

test('splitting core multiplies by N up to the cap', () => {
  const sim = new CircleSim(cfg('triple', { coreN: 3, max: 81 }), env);
  sim.advance(30);
  assert.ok(sim.balls.length <= 81 && sim.balls.length >= 60, `${sim.balls.length} balls`);
});

test('paper halves until the piece count', () => {
  const sim = new CircleSim(cfg('paper', { mode: 'half', max: 64 }), env);
  sim.advance(30);
  assert.equal(sim.sc.pieces.length, 64);
});

test('settings per simulation override the defaults', () => {
  const P = sceneParams(cfg('radar', { blips: 9 }));
  assert.equal(P.blips, 9);
  assert.equal(P.sweep, SCENES.radar.defaults.sweep);
});

test('speed curve: from → to, with a beat pulse; the simulation clock follows it', () => {
  const sp = { from: 1, to: 3, curve: 'linear', pulse: 0 };
  assert.equal(speedAt(sp, 0, 10), 1);
  assert.equal(speedAt(sp, 5, 10), 2);
  assert.equal(speedAt(sp, 10, 10), 3);
  assert.ok(speedAt({ from: 1, to: 1, curve: 'linear', pulse: 1 }, 0, 10, 120) > 1.9);
  assert.equal(speedAt({ from: 1, to: 0.2, curve: 'late' }, 5, 10), 1);
  const sim = new CircleSim(cfg('dna', {}, { speed: { from: 2, to: 2, curve: 'linear', pulse: 0 } }), env);
  sim.advance(4);
  assert.ok(Math.abs(sim.st - 8) < 0.02, `sim time ${sim.st}`);
});

test('world = safe area: taller than wide on vertical video', () => {
  const w = worldFor(9 / 16);
  assert.equal(w.hw, 1);
  assert.ok(w.hh > 1.15);
  const F = pixelFrame(1080, 1920);
  assert.ok(F.band.y > 0.15 * 1920 && F.band.y + F.band.h < 0.77 * 1920, 'between the Shorts title and caption zones');
});

test('new presets: known simulations, YouTube-safe texts', () => {
  assert.ok(LAB_PRESETS.length >= 30);
  for (const p of LAB_PRESETS) {
    assert.ok(SCENES[p.circle.rule], `${p.name}: ${p.circle.rule}`);
    assert.ok(p.hook.text && p.youtube.title.length <= 100, p.name);
    assert.ok(!/[<>]/.test(p.youtube.title + p.youtube.description), p.name);
  }
});

test('rock paper scissors (lizard Spock): one formula gives every classic rule', () => {
  const id = Object.fromEntries(RPS_NAMES.map((n, i) => [n, i]));
  const wins = [['paper', 'rock'], ['rock', 'scissors'], ['scissors', 'paper']];
  for (const [a, b] of wins) { assert.ok(beats(id[a], id[b], 3)); assert.ok(!beats(id[b], id[a], 3)); }
  const wins5 = [...wins, ['rock', 'lizard'], ['lizard', 'spock'], ['spock', 'scissors'], ['scissors', 'lizard'], ['lizard', 'paper'], ['paper', 'spock'], ['spock', 'rock']];
  for (const [a, b] of wins5) { assert.ok(beats(id[a], id[b], 5), `${a} beats ${b}`); assert.ok(!beats(id[b], id[a], 5)); }
});

test('battles: someone wins, populations rise and fall, knives level up', () => {
  const r = new CircleSim(cfg('rps', { chase: '0.1 + 0.03*t' }, { seed: 13 }), env);
  r.advance(30);
  assert.ok(SCENES.rps.counts(r).includes(60), 'one team took over');
  const p = new CircleSim(cfg('predator'), env);
  const flowers = [];
  for (let t = 1; t <= 30; t++) { p.advance(t); flowers.push(p.sc.fl.length); }
  assert.ok(Math.max(...flowers) > 100 && Math.min(...flowers.slice(5)) < 20, 'boom and bust');
  const k = new CircleSim(cfg('knives'), env);
  k.advance(30);
  assert.ok(k.sc.n >= 3 && k.sc.hits > 10);
});

test('formulas drive the blade and the spike; bad formulas fall back', () => {
  const pop = new CircleSim(cfg('popper', { x: 'cos(4*t)*cos(t)', y: 'cos(4*t)*sin(t)' }), env);
  pop.advance(20);
  assert.ok(pop.sc.popped > 50 && pop.segments.length > 1000);
  const bad = new CircleSim(cfg('slicer', { ba: 'sin(', bx: 'oops' }), env);
  bad.advance(3);
  assert.ok(bad.sc.b.length >= 1);
  assert.ok(formulaError('sin(', ['t']));
  assert.equal(formulaError('cos(4*t)*sin(t)', ['t']), '');
  assert.equal(pretty('16*sin(t)^3/17'), '16·sin(t)³/17');
});

test('circle layers: one after another (linked steps play together) or all together', () => {
  const c = { ...defaultCircle(), combine: 'sequence', layers: [
    { id: 'b', enabled: true, withPrev: false, cfg: defaultCircle() },
    { id: 'c', enabled: true, withPrev: true, cfg: defaultCircle() },
    { id: 'd', enabled: false, withPrev: false, cfg: defaultCircle() },
  ] };
  const s = circleSchedule(c, 30);
  assert.deepEqual(s.map((x) => [x.layer.id, x.start, x.end]), [['main', 0, 15], ['b', 15, 30], ['c', 15, 30]]);
  assert.deepEqual(visibleAt(s, 5).map((x) => x.layer.id), ['main']);
  const mid = visibleAt(s, 15.2);
  assert.ok(mid.find((x) => x.layer.id === 'main').alpha < 1 && mid.find((x) => x.layer.id === 'b').alpha < 1, 'cross-fade');
  assert.equal(headlineAt(s, 20).layer.id, 'b');
  const together = circleSchedule({ ...c, combine: 'together' }, 30);
  assert.ok(together.every((x) => x.start === 0 && x.end === 30));
});

test('layer presets: every layer is a known simulation, with plain text', () => {
  assert.ok(STACK_PRESETS.length >= 8);
  for (const p of STACK_PRESETS) {
    assert.ok(p.circle.layers.length >= 1, p.name);
    for (const l of [p.circle, ...p.circle.layers.map((x) => x.cfg)]) assert.ok(CIRCLE_RULES[l.rule], `${p.name}: ${l.rule}`);
    assert.ok(!/[=^]/.test(p.hook.text), `${p.name}: plain words, no formula`);
  }
});

test('vibration: sand leaves the moving parts and gathers on the still lines', async () => {
  const { besselZero } = await import('../src/circle/cymatics.js');
  assert.ok(Math.abs(besselZero(0, 1) - 3.8317) < 1e-3 && Math.abs(besselZero(1, 1) - 1.8412) < 1e-3);
  for (const plate of ['square', 'circle']) {
    const sim = new CircleSim(cfg('chladni', { plate, modes: plate === 'circle' ? '2,2' : '2,4', grains: 1500, wait: 0 }), env);
    sim.advance(0.1);
    const mean = () => { let s = 0; const g = sim.sc.g; for (let i = 0; i < g.n; i++) s += g.e[i]; return s / g.n; };
    sim.advance(1);
    const start = mean();
    sim.advance(8);
    assert.ok(mean() < start * 0.5, `${plate}: grains settle on the nodes (${start.toFixed(2)} → ${mean().toFixed(2)})`);
  }
  for (const id of ['tubes', 'ripple', 'filings']) assert.ok(eventsUntil(cfg(id), 10, env).length > 3, id);
});

test('waves: formulas drive the shapes, bad formulas fall back, notes are the real harmonics', async () => {
  const { WAVES } = await import('../src/circle/waves.js');
  for (const id of Object.keys(WAVES)) {
    for (const lab of [{}, { formula: 'oops(', coeff: '1/', y1: '', x: 'sin(' }]) {
      const ev = eventsUntil(cfg(id, lab), 10, env);
      assert.ok(ev.length > 3 && ev.every((e) => Number.isFinite(e.t)), `${id} ${JSON.stringify(lab)}`);
    }
  }
  const str = eventsUntil(cfg('string', { modes: '1 2 4', every: 4 }), 6, env);
  const midis = new Set(str.map((e) => e.midi));
  assert.ok(midis.has(45) && midis.has(57), 'harmonic 2 is an octave up');
  const four = new CircleSim(cfg('fourier', { wave: 'custom', coeff: '1/n^2', terms: 5 }), env);
  four.advance(1);
  assert.deepEqual(four.sc.c.map(([n]) => n), [1, 2, 3, 4, 5]);
});

test('formula options: odd harmonics in a half-open tube, steered beams, wires and own fields', () => {
  const tube = new CircleSim(cfg('tubes', { pipe: 'half', count: 4 }), env);
  assert.deepEqual(tube.sc.rows.map((r) => r.h), [1, 3, 5, 7]);
  const own = new CircleSim(cfg('tubes', { pipe: 'formula', formula: 'x*(1-x)*k', harmonics: '2 9' }), env);
  assert.deepEqual(own.sc.rows.slice(0, 3).map((r) => r.h), [2, 9, 2]);
  for (const phase of ['0', '0.8*j*(k - 1.5)', 'bad(']) {
    const r = new CircleSim(cfg('ripple', { layout: 'line', steps: '4:0.2 4:0.2', phase }), env);
    r.advance(6);
    assert.ok(r.sc.src.every(([, y]) => y < 0), 'sources in a row');
  }
  const w = new CircleSim(cfg('filings', { setups: 'wire', wait: 0 }), env);
  w.advance(0.5);
  const [bx, by] = SCENES.filings.field(w.sc, 0.3, 0);
  assert.ok(Math.abs(bx) < 1e-9 && by > 0, 'the field goes round the wire');
  const f = new CircleSim(cfg('filings', { setups: 'formula', bx: '1', by: '0', wait: 0 }), env);
  f.advance(0.5);
  assert.deepEqual(SCENES.filings.field(f.sc, 0.1, 0.2), [8, 0]);
});

test('lessons pack: every step is a known simulation, plain captions, importable as full states', async () => {
  const { LESSON_PRESETS, lessonPack } = await import('../src/circle/presets-lessons.js');
  const { normalize } = await import('../src/state.js');
  const { isPreset } = await import('../src/library.js');
  assert.ok(LESSON_PRESETS.length >= 6);
  for (const p of LESSON_PRESETS) {
    assert.equal(p.$category, 'Circle · Math lessons');
    assert.ok(!/[=^]/.test(p.hook.text), p.name);
    for (const l of [p.circle, ...p.circle.layers.map((x) => x.cfg)]) assert.ok(CIRCLE_RULES[l.rule] && l.text?.formula, `${p.name}: ${l.rule}`);
  }
  const pack = lessonPack();
  assert.ok(pack.length >= 18 && new Set(pack.map((p) => p.name)).size === pack.length);
  assert.ok(pack.map(normalize).every(isPreset));
});
