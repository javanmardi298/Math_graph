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

test('lesson packs: every circle simulation has a lesson; steps are known, captioned, importable', async () => {
  const { PACKS } = await import('../src/lessons/index.js');
  const { normalize } = await import('../src/state.js');
  const { isPreset } = await import('../src/library.js');
  const { tryCompile } = await import('../src/math/parser.js');
  const taught = new Set(), names = new Set();
  for (const pack of PACKS) {
    const list = await pack.load();
    assert.ok(list.length >= 3, pack.id);
    for (const p of list) {
      assert.ok(!names.has(p.name), `duplicate ${p.name}`); names.add(p.name);
      assert.ok(p.name.startsWith('Lesson · ') && p.visual.aspect === '9:16', p.name);
      assert.ok(p.hook.text && !/[=^]/.test(p.hook.text) && p.youtube.title.length <= 100, p.name);
      assert.ok(isPreset(normalize(p)), p.name);
      if (p.mode === 'circle') {
        const steps = [p.circle, ...p.circle.layers.map((x) => x.cfg)];
        assert.ok(steps.length >= 2, p.name);
        for (const l of steps) { assert.ok(CIRCLE_RULES[l.rule] && l.text?.formula, `${p.name}: ${l.rule}`); taught.add(l.rule); }
      } else {
        assert.equal(p.overlay.texts.length, new Set(p.layers.filter((l) => !l.withPrev).map((l) => l.name)).size, p.name);
        for (const l of p.layers) for (const v of Object.values(l.exprs)) assert.ok(tryCompile(v, ['x', 'y', 's', 'theta', 't', 'a', 'b', 'c', 'd']).ok, `${p.name}: ${v}`);
      }
    }
  }
  const missing = Object.keys(CIRCLE_RULES).filter((r) => !taught.has(r));
  assert.deepEqual(missing, [], 'simulations without a lesson');
});

test('Fourier drawing: the circles retrace the shape; SVG paths and formulas work', async () => {
  const { shapeSamples, epicycles, svgPoints } = await import('../src/circle/fourier-draw.js');
  for (const shape of ['cat', 'pi', 'heart', 'note', 'star', 'butterfly', 'infinity', 'flower']) {
    const s = shapeSamples({ shape }), C = epicycles(s);
    // all circles together put the pen back on the samples
    let err = 0;
    for (const n of [0, 100, 300]) {
      const th = (2 * Math.PI * n) / s.length;
      let x = 0, y = 0;
      for (const [k, r, p] of C) { x += r * Math.cos(k * th + p); y += r * Math.sin(k * th + p); }
      err = Math.max(err, Math.hypot(x - s[n][0], y - s[n][1]));
    }
    assert.ok(err < 0.05, `${shape}: ${err}`);
    assert.ok(C[0][0] === 0 && C[1][1] >= C[2][1], `${shape}: centre first, then biggest`);
  }
  assert.equal(svgPoints('M 0 0 L 10 0 L 10 10 Z').length, 4);
  assert.ok(svgPoints('M10 10 c 5 0 10 5 10 10 s -5 10 -10 10 q -10 0 -10 -10 z').length > 30);
  assert.equal(shapeSamples({ shape: 'formula', x: 'cos(s)', y: 'sin(s)' }).length, 512);
  assert.equal(shapeSamples({ shape: 'svg', svg: 'nonsense' }).length, 512, 'falls back to a heart');
});

test('pi: the digits, the bounds and the estimates are right', async () => {
  const { piDigits } = await import('../src/circle/pi.js');
  assert.equal(piDigits(50), '314159265358979323846264338327950288419716939937510');
  const mc = new CircleSim(cfg('montecarlo', { max: 20000, rate0: 2000, accel: 1.5 }), env);
  mc.advance(10);
  assert.ok(Math.abs((4 * mc.sc.cum[20000]) / 20000 - Math.PI) < 0.05);
  const bf = new CircleSim(cfg('buffon', { max: 6000, rate0: 2000 }), env);
  bf.advance(5);
  assert.ok(Math.abs((2 * 6000) / bf.sc.cumc[6000] - Math.PI) < 0.15);
  const se = new CircleSim(cfg('series', { kind: 'nilakantha', terms: 50 }), env);
  assert.ok(Math.abs(se.sc.vals.at(-1) - Math.PI) < 1e-5);
});

test('calculus and fractals: integral, Taylor, curves, zoom', async () => {
  const { lpoints } = await import('../src/circle/fractals.js');
  assert.equal(lpoints('koch', 2).length, 3 * 16 + 1);
  assert.equal(lpoints('dragon', 10).length, 1025);
  assert.equal(lpoints('hilbert', 3).length, 64);
  const r = new CircleSim(cfg('riemann', { f: 'x^2', a: 0, b: 3 }), env);
  assert.ok(Math.abs(r.sc.exact - 9) < 1e-6);
  assert.ok(Math.abs(SCENES.riemann.sum(r.sc, { a: 0, b: 3, rule: 'mid' }, 512) - 9) < 1e-3);
  const t = new CircleSim(cfg('taylor', { fn: 'sin', terms: 8 }), env);
  assert.ok(Math.abs(SCENES.taylor.poly(t.sc, 2, 7) - Math.sin(2)) < 1e-8);
  const m = new CircleSim(cfg('mandel', { depth: 6, wait: 1 }), env);
  m.advance(29.5);
  assert.ok(SCENES.mandel.zoom(m, m.P) > 1e5);
});

test('formula presets: sound of a graph, guess the shape (hidden first), A or B', async () => {
  const { SOUND_PRESETS } = await import('../src/presets-sound.js');
  const { normalize } = await import('../src/state.js');
  const { tryCompile } = await import('../src/math/parser.js');
  assert.ok(SOUND_PRESETS.length >= 12);
  for (const p of SOUND_PRESETS) {
    const s = normalize(p);
    assert.equal(s.visual.aspect, '9:16', p.name);
    assert.ok(p.youtube.tags && p.youtube.title.length <= 100, p.name);
    for (const l of s.layers) for (const v of Object.values(l.exprs)) assert.ok(tryCompile(v, ['x', 's', 'theta', 't', 'a', 'b', 'c', 'd']).ok, `${p.name}: ${v}`);
    if (/^Guess/.test(p.name)) assert.ok(s.visual.hideUntil > 0 && s.overlay.texts.length >= 2, p.name);
  }
});
