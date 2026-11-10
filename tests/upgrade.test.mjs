// The sound upgrade, the formula typesetter, live numbers and the fractal workshop.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SCALES, parseScale, useCustomScale, quantize } from '../src/math/music.js';
import { INSTRUMENTS, instrumentOf, voiceKey, HARMONIES } from '../src/audio/instruments.js';
import { DrumScanner, patternSteps, DRUM_KINDS, DRUM_PATTERNS } from '../src/audio/drum-scanner.js';
import { KITS, DRUM_PIECES } from '../src/audio/drums.js';
import { parseMath } from '../src/ui/mathtext.js';
import { readoutOf } from '../src/math/readout.js';
import { CompiledLayer } from '../src/math/layers.js';
import { createLayer, defaultState } from '../src/state.js';
import { FRACTAL_TYPES, FRACTAL_SPOTS, FRACTAL_PALETTES, IFS_SYSTEMS, orbit, paletteLut, _internals } from '../src/circle/fractal-lab.js';
import { GALLERY } from '../src/circle/fractal-gallery.js';
import { SCENES } from '../src/circle/scenes.js';
import { CircleSim } from '../src/circle/sim.js';
import { defaultCircle } from '../src/circle/sim.js';
import { WAVE_SHAPES } from '../src/circle/shapes-lab.js';

test('scales: at least 150, every one starts at 0 and rises', () => {
  const keys = Object.keys(SCALES);
  assert.ok(keys.length >= 150);
  for (const k of keys) { const s = SCALES[k]; if (!s) continue; assert.equal(s[0], 0, k); for (let i = 1; i < s.length; i++) assert.ok(s[i] > s[i - 1], k); }
});

test('custom scale: semitones, cents and ratios; the last big step is the period', () => {
  assert.deepEqual(parseScale('0 2 3.5 7').steps, [0, 2, 3.5, 7]);
  const just = parseScale('9/8 5/4 4/3 3/2 5/3 15/8 2/1');
  assert.equal(just.steps.length, 7);
  assert.ok(Math.abs(just.steps[4] - 7.02) < 0.01);
  assert.equal(just.period, 12);
  assert.ok(Math.abs(parseScale('0 146c 3/1').period - 19.02) < 0.01);
  useCustomScale('0 3 7 10');
  assert.equal(quantize(64, 'custom', 0), 63);
  assert.equal(quantize(66, 'custom', 0), 67);
});

test('instruments: the new ones exist; harmony and detune derive a patch', () => {
  for (const id of ['808', '808-dist', 'santur', 'tar', 'ney', 'oud', 'strings', 'theremin']) assert.ok(INSTRUMENTS[id], id);
  assert.equal(voiceKey({ wave: 'bell', harmony: 'off', detune: 0 }), 'bell');
  const key = voiceKey({ wave: 'sine', harmony: 'major', detune: 10 });
  const patch = instrumentOf(key);
  assert.equal(patch.osc.length, 4); // two detuned copies + two chord notes
  assert.deepEqual(patch.osc.filter((o) => o.semi).map((o) => o.semi).sort(), [4, 7]);
  assert.ok(patch.gain < INSTRUMENTS.sine.gain);
  for (const h of Object.values(HARMONIES)) assert.ok(Array.isArray(h.semis));
});

test('drums: kits have every piece; patterns fire on sixteenth notes with accents', () => {
  for (const k of Object.values(KITS)) for (const key of ['kick', 'snare', 'hat', 'tom', 'perc']) assert.ok(k[key], key);
  assert.deepEqual(DRUM_KINDS, DRUM_PIECES);
  assert.deepEqual(patternSteps('X.x|o'), [1, 0, 0.8, 0.45]);
  const cfg = { kick: 'pattern', snare: 'off', hat: 'off', clap: 'off', patterns: { kick: 'X...x...' } };
  const hits = new DrumScanner().scan(0, 2, () => 0, cfg, { mid: 0, range: 1, bpm: 120, rhythm: { division: '1/8' } });
  // at 120 bpm a sixteenth is 0.125 s; hits on steps 0, 4, 8, 12, 16 → every 0.5 s
  assert.deepEqual(hits.map((e) => +e.time.toFixed(3)), [0, 0.5, 1, 1.5, 2]);
  assert.equal(hits[0].vel, 1);
  assert.equal(hits[1].vel, 0.8);
  for (const [, rows] of Object.values(DRUM_PATTERNS)) for (const k of DRUM_KINDS) assert.equal(typeof rows[k], 'string');
});

test('state: new sound and overlay settings have defaults', () => {
  const s = defaultState();
  assert.equal(s.audio.transpose, 0);
  assert.equal(s.audio.drumKit, 'classic');
  assert.deepEqual(s.audio.eq, { low: 0, mid: 0, high: 0 });
  assert.equal(s.overlay.legend.enabled, false);
  assert.equal(s.layers[0].fill, 'none');
  assert.equal(s.layers[0].harmony, 'off');
});

test('formula typesetter: fractions, powers, tall brackets, plain text', () => {
  const kinds = (t) => parseMath(t).items.map((n) => n.k);
  assert.ok(kinds("f' = f \\frac{c}{c - v_r}").includes('frac'));
  const pow = parseMath('2^{n/12}').items[0];
  assert.equal(pow.k, 'script');
  assert.ok(pow.sup);
  assert.equal(parseMath('2^(n/12)').items[0].sup.items.length, 3); // n, /, 12: the brackets are dropped
  assert.ok(kinds('4 \\sin\\left(\\frac{240\\theta}{25}\\right) + 10').includes('delim'));
  assert.equal(parseMath('\\pi').items[0].text, 'π');
  assert.equal(parseMath('sin(x)').items[0].style, 'fn');
});

test('live numbers: the area under sin from 0 to π is 2; a circle sweeps π r²', () => {
  const ctx = { t: 0, params: { a: 1, b: 1, c: 1, d: 1 }, view: { xMin: 0, xMax: Math.PI, yMin: -1, yMax: 1 } };
  const sin = createLayer({ type: 'function', exprs: { y: 'sin(x)' }, readout: 'area' });
  assert.ok(Math.abs(readoutOf(sin, new CompiledLayer(sin), ctx, 1) - 2) < 1e-3);
  assert.ok(Math.abs(readoutOf(sin, new CompiledLayer(sin), ctx, 0.5) - 1) < 1e-3);
  const circ = createLayer({ type: 'parametric', range: { min: 0, max: Math.PI * 2 }, exprs: { x: '2cos(s)', y: '2sin(s)' }, readout: 'area', fill: 'origin' });
  assert.ok(Math.abs(readoutOf(circ, new CompiledLayer(circ), ctx, 1) - Math.PI * 4) < 1e-2);
  const len = createLayer({ ...circ, readout: 'length' });
  assert.ok(Math.abs(readoutOf(len, new CompiledLayer(len), ctx, 1) - Math.PI * 4) < 1e-2);
  const slope = createLayer({ type: 'function', exprs: { y: 'x^2' }, readout: 'slope' });
  assert.ok(Math.abs(readoutOf(slope, new CompiledLayer(slope), { ...ctx, view: { xMin: 0, xMax: 2, yMin: 0, yMax: 4 } }, 0.5) - 2) < 1e-2);
});

const F = (type, extra = {}) => ({ T: FRACTAL_TYPES[type], julia: false, power: FRACTAL_TYPES[type].power || 2, c: [0, 0], iter: 300, coloring: 0, trap: 0, interior: 0, relax: 1, density: 1, offset: 0, ...extra });

test('fractals: points known to be inside and outside each set', () => {
  assert.ok(orbit(F('mandelbrot'), 0, 0).inside);
  assert.ok(orbit(F('mandelbrot'), -1, 0).inside);
  assert.ok(!orbit(F('mandelbrot'), 1, 1).inside);
  assert.ok(!orbit(F('mandelbrot'), 0.3, 0).inside); // just right of the cusp at 1/4
  assert.ok(orbit(F('mandelbrot'), 0.25, 0, null).inside);
  assert.ok(orbit(F('burningship'), -1.75, -0.03).n > 20);
  assert.ok(orbit(F('tricorn'), -1, 0).inside);
  // the Julia set of c = 0 is the unit circle
  assert.ok(orbit(F('mandelbrot', { julia: true }), 0.5, 0.5).inside);
  assert.ok(!orbit(F('mandelbrot', { julia: true }), 1.1, 0).inside);
  // multibrot with p = 2 is the Mandelbrot set
  assert.equal(orbit(F('multibrot', { power: 2 }), -0.5, 0.5).inside, orbit(F('mandelbrot'), -0.5, 0.5).inside);
});

test('fractals: Newton converges to a cube root of unity', () => {
  for (const [x, y] of [[2, 0.1], [-1, 1.2], [-1, -1.2], [0.3, 0.7]]) {
    const o = orbit(F('newton', { power: 3 }), x, y);
    assert.ok(Math.abs(Math.hypot(o.zx, o.zy) - 1) < 1e-3);
    const k = (Math.atan2(o.zy, o.zx) / (2 * Math.PI)) * 3;
    assert.ok(Math.abs(k - Math.round(k)) < 1e-3);
  }
  assert.ok(Math.abs(orbit(F('newton', { power: 3 }), 2, 0.1).zx - 1) < 1e-3);
});

test('fractals: spots, palettes, gallery and IFS tables are consistent', () => {
  for (const [, type] of Object.values(FRACTAL_SPOTS)) assert.ok(type === null || FRACTAL_TYPES[type]);
  for (const name of Object.keys(FRACTAL_PALETTES)) assert.equal(paletteLut(name).length, 1024);
  for (const [name, rule, lab] of GALLERY) {
    const sc = SCENES[rule];
    assert.ok(sc, name);
    for (const k of Object.keys(lab)) assert.ok(k in sc.defaults, `${name}: ${k}`);
    if (lab.type) assert.ok(FRACTAL_TYPES[lab.type], name);
    if (lab.colors) assert.ok(FRACTAL_PALETTES[lab.colors], name);
    if (lab.system) assert.ok(IFS_SYSTEMS[lab.system], name);
  }
  // every IFS map shrinks (so the chaos game stays bounded)
  for (const [id, sys] of Object.entries(IFS_SYSTEMS)) for (const [a, b, c, d] of sys.maps) assert.ok(Math.abs(a * d - b * c) < 1, id);
});

test('fractal scenes run: the zoom deepens, the fern stays in its box, the Buddhabrot fills', () => {
  const mk = (rule, lab) => new CircleSim({ ...defaultCircle(), rule, lab: { [rule]: lab } }, { duration: 30, bpm: 120, ratio: 9 / 16 });
  const z = mk('fractal', { depth: 6, wait: 1 });
  z.st = 0; const f0 = _internals.frameOf(z, z.P);
  z.st = 30; const f1 = _internals.frameOf(z, z.P);
  assert.ok(Math.abs(f0.zoom - 1) < 1e-9);
  assert.ok(f1.zoom > 9e5);
  assert.ok(Math.abs(f1.cx - FRACTAL_SPOTS.seahorse[2]) < 1e-5);
  assert.ok(f1.iter > f0.iter);
  const j = mk('fractal', { julia: true, journey: 'julia', jpath: 'circle', jr: 0.7885 });
  j.st = 5; const fj = _internals.frameOf(j, j.P);
  assert.ok(Math.abs(Math.hypot(...fj.c) - 0.7885) < 1e-9);
  assert.equal(typeof SCENES.fractal.formula(z.P), 'string');
  for (const name of Object.keys(WAVE_SHAPES)) for (const u of [0, 0.3, 0.77]) { const p = WAVE_SHAPES[name](u); assert.ok(Math.hypot(p[0], p[1]) <= 1.3, name); }
});
