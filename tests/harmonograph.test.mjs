import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultCircle, eventsUntil, CIRCLE_RULES, ruleGroups, captionLine, formulaLine, CircleSim } from '../src/circle/sim.js';
import { notesForEvents } from '../src/circle/sound.js';
import { machine, harmonograph, luckyMachine, tuneToScale, toneMidi, INTERVALS, PAPERS, INK_STYLES, FRAMES, KINDS, HARMONOGRAPH_DEFAULTS as D } from '../src/circle/harmonograph.js';

const cfgOf = (lab = {}, extra = {}) => ({ ...defaultCircle(), rule: 'harmonograph', lab: { harmonograph: lab }, ...extra });
const AUDIO = { scale: 'chromatic', root: 0, noteLow: 40, noteHigh: 90 };

test('the harmonograph is registered with its own group, caption and formula line', () => {
  assert.ok(CIRCLE_RULES.harmonograph);
  assert.ok(Object.fromEntries(ruleGroups()).Harmonograph.some(([id]) => id === 'harmonograph'));
  assert.ok(captionLine(cfgOf()) && formulaLine(cfgOf()));
  for (const k of Object.keys(KINDS)) assert.ok(captionLine(cfgOf({ kind: k })));
});

test('two pendulums at 1 : 1 and 90° draw a circle; integer ratios close after one period', () => {
  const m = machine({ ...D, kind: 'lissajous', fa: 1, fb: 1, pa: 90, pb: 0, aa: 1, ab: 1 });
  for (let u = 0; u < 7; u += 0.37) { const [x, y] = m.at(u); assert.ok(Math.abs(Math.hypot(x, y) - 1) < 1e-9); }
  const l = machine({ ...D, kind: 'lissajous', fa: 3, fb: 2, pa: 0, pb: 0 });
  const [x0, y0] = l.at(0.7), [x1, y1] = l.at(0.7 + 2 * Math.PI);
  assert.ok(Math.hypot(x1 - x0, y1 - y0) < 1e-9, '3 : 2 closes after 2π');
});

test('damping: the swing is at 5% after `life` seconds, and life 0 never fades', () => {
  const m = machine({ ...D, kind: 'lateral', life: 20, rate: 2 });
  assert.ok(Math.abs(m.env(20 * 2) - Math.exp(-3)) < 1e-12);
  assert.equal(machine({ ...D, life: 0 }).env(1e6), 1);
  assert.equal(machine({ ...D, kind: 'lissajous', life: 20 }).env(1e6), 1, 'a Lissajous figure is undamped');
});

test('every machine stays inside the frame and gives finite points', () => {
  for (const kind of Object.keys(KINDS)) {
    const m = machine({ ...D, kind });
    for (let u = 0; u < 200; u += 0.173) {
      const [x, y] = m.at(u);
      assert.ok(Number.isFinite(x) && Number.isFinite(y), kind);
      assert.ok(Math.abs(x) <= 1.31 && Math.abs(y) <= 1.31, `${kind} ${x} ${y}`);
    }
  }
});

test('the formula machine follows the formula, and a broken formula draws nothing instead of failing', () => {
  const m = machine({ ...D, kind: 'formula', fx: 'cos(t)', fy: 'sin(2*t)', life: 0 });
  const [x, y] = m.at(1.3);
  assert.ok(Math.abs(x - Math.cos(1.3)) < 1e-12 && Math.abs(y - Math.sin(2.6)) < 1e-12);
  const bad = machine({ ...D, kind: 'formula', fx: 'cos(', fy: 'sin(t)' });
  assert.equal(bad.formulaOk, false);
  assert.equal(bad.at(1)[0], 0, 'the broken axis stays at the middle');
  const withE = machine({ ...D, kind: 'formula', fx: 's', fy: '0', life: 10, rate: 1 });
  assert.ok(withE.at(10)[0] < withE.at(0)[0]);
});

test('the simulation is deterministic and keeps drawing points', () => {
  const run = () => { const sim = new CircleSim(cfgOf({ pens: 2 }), { duration: 20, bpm: 100 }); sim.advance(6); return sim; };
  const a = run(), b = run();
  assert.equal(a.sc.n, b.sc.n);
  assert.ok(a.sc.n > 1000);
  assert.deepEqual(Array.from(a.sc.pts[1].x.subarray(0, 300)), Array.from(b.sc.pts[1].x.subarray(0, 300)));
  assert.notDeepEqual(Array.from(a.sc.pts[0].x.subarray(100, 110)), Array.from(a.sc.pts[1].x.subarray(100, 110)), 'pens are offset in time');
});

test('strumming plays the pendulums at their exact frequency ratios, quieter as the swing dies', () => {
  const cfg = cfgOf({ fa: 2, fb: 3, fc: 4, fd: 5, sound: 'strum', every: 0.5, base: 48, life: 10, rate: 2, kind: 'quad' }, {});
  const ev = eventsUntil(cfg, 20, { duration: 20 });
  assert.ok(ev.length >= 8);
  const first = ev.slice(0, 4).map((e) => e.midi);
  assert.deepEqual(first.map((m) => +(m - 48).toFixed(4)), [0, +(12 * Math.log2(1.5)).toFixed(4), 12, +(12 * Math.log2(2.5)).toFixed(4)]);
  assert.ok(ev[ev.length - 1].vel < ev[0].vel, 'decays');
  const n = notesForEvents(ev, cfg, AUDIO);
  assert.ok(n[0].vel > n[n.length - 1].vel);
  assert.equal(n[1].midi, ev[1].midi, 'the exact (fractional) note reaches the synth');
});

test('equal tuning rounds to piano keys; chord plays all pendulums together; cross follows the middle line', () => {
  assert.equal(toneMidi({ ...D, fa: 2, fb: 3, tuning: 'just', base: 48 }, 1), 48 + 12 * Math.log2(1.5));
  assert.equal(toneMidi({ ...D, fa: 2, fb: 3, tuning: 'equal', base: 48 }, 1), 55);
  const chord = eventsUntil(cfgOf({ sound: 'chord', every: 1 }), 6, { duration: 6 });
  assert.ok(chord.every((e) => e.together));
  assert.equal(chord.length % 4, 0);
  const cross = eventsUntil(cfgOf({ sound: 'cross' }), 10, { duration: 10 });
  assert.ok(cross.length > 10);
  assert.equal(eventsUntil(cfgOf({ sound: 'off' }), 10, { duration: 10 }).length, 0);
});

test('tuning to a scale: degrees 1 3 5 8 of the major scale are the major chord and the octave', () => {
  const f = tuneToScale('major', [1, 3, 5, 8], 2);
  assert.equal(f.fa, 2);
  assert.ok(Math.abs(f.fb - 2 * 2 ** (4 / 12)) < 1e-3);
  assert.ok(Math.abs(f.fc - 2 * 2 ** (7 / 12)) < 1e-3);
  assert.equal(f.fd, 4);
  // a maqam with quarter tones: the third of Rast is 3.5 semitones
  const r = tuneToScale('rast', [1, 3], 2);
  assert.ok(Math.abs(r.fb - 2 * 2 ** (3.5 / 12)) < 1e-3);
  assert.ok(INTERVALS.length >= 10);
});

test('the lucky machine is deterministic per seed, varied across seeds and always drawable', () => {
  const a = luckyMachine(5), b = luckyMachine(5), c = luckyMachine(6);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.lab, c.lab);
  for (let seed = 1; seed <= 40; seed++) {
    const { lab, look } = luckyMachine(seed);
    assert.ok(PAPERS[lab.paper] && INK_STYLES[lab.ink] && look.palette);
    const m = machine({ ...D, ...lab });
    assert.ok(Number.isFinite(m.at(3)[0]));
    for (const f of ['fa', 'fb', 'fc', 'fd']) assert.ok(lab[f] >= 0.25 && lab[f] <= 12, `${f} ${lab[f]}`);
  }
  assert.ok(Object.keys(luckyMachine(3, { kind: 'epicycle' }).lab).length > 10);
});

test('painting works for every paper, ink, frame, symmetry and the extras', () => {
  const calls = [];
  const mk = () => new Proxy({ canvas: { width: 540, height: 960 } }, { get: (t, k) => (k in t ? t[k] : (...a) => { calls.push(k); return { addColorStop() {} }; }), set: (t, k, v) => { t[k] = v; return true; } });
  globalThis.document = { createElement: () => { const c = { width: 0, height: 0 }; c.getContext = () => { const g = mk(); g.canvas = c; return g; }; return c; } };
  const g = mk();
  const pal = { ring: '#fff', glow: '#0ff', ball: '#fff', line: () => '#fff' };
  const draw = (lab) => {
    const sim = new CircleSim(cfgOf(lab), { duration: 12, bpm: 100 });
    sim.advance(3);
    const D2 = { g, X: (x) => 270 + x * 230, Y: (y) => 480 - y * 230, R: 230, k: 0.54, pal, look: {}, time: 3, lastHit: 2, energy: 0 };
    sim.scene.draw(sim, sim.P, D2);
    assert.ok(typeof sim.scene.stats(sim, sim.P) === 'string');
  };
  for (const paper of Object.keys(PAPERS)) draw({ paper });
  for (const ink of Object.keys(INK_STYLES)) draw({ ink, colorBy: 'speed' });
  for (const frame of Object.keys(FRAMES)) draw({ frame });
  for (const colorBy of ['time', 'speed', 'angle', 'radius', 'pen']) draw({ colorBy, pens: 3 });
  draw({ sym: 6, mirror: true, dials: true, ghost: true, pen: 'nib', kind: 'rotary' });
  draw({ kind: 'formula', fx: 'bad((', fy: '1' });
  for (const machine of ['3d', 'plan']) for (const machineStyle of ['victorian', 'blueprint', 'neon']) for (const kind of ['quad', 'lateral', 'rotary', 'epicycle']) draw({ machine, machineStyle, kind, size: 0.55, y: -0.5 });
  for (const machineLayout of ['top', 'corner', 'full', 'free']) for (const machineShow of ['on', 'intro', 'outro', 'inout', 'off']) draw({ machine: '3d', machineLayout, machineShow });
  assert.ok(calls.length > 500);
  delete globalThis.document;
});

test('showAlpha: on, off, intro and outro', async () => {
  const { showAlpha } = await import('../src/circle/harmonograph.js');
  assert.equal(showAlpha('on', 1, 2, 5, 3, 10), 1);
  assert.equal(showAlpha('off', 1, 2, 5, 3, 10), 0);
  assert.equal(showAlpha('intro', 1, 2, 5, 0, 10), 1);
  assert.equal(showAlpha('intro', 1, 2, 5, 30, 10), 0);
  assert.ok(showAlpha('intro', 1, 2, 5, 6, 10) > 0 && showAlpha('intro', 1, 2, 5, 6, 10) < 1);
});
