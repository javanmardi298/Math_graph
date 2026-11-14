// Batch-render fix (list tags), the video check, scene keyframes, blends and transitions,
// loudness measuring, mastering, loudness formulas and story beats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, defaultState } from '../src/state.js';
import { youtubeFor, youtubeText, youtubeCsv, youtubeProblems, asText } from '../src/export/youtube.js';
import { hookTextFor } from '../src/export/shorts.js';
import { validateState, validationLine, describeScene } from '../src/validate.js';
import { animatable, describe, readValue, writeValue, isStep, valuesAt, applyValues, laneOf, LANES } from '../src/anim/keyframes.js';
import { circleSchedule, visibleAt, transitionSecs, BLENDS, TRANSITIONS } from '../src/circle/stack.js';
import { defaultCircle, eventsUntil } from '../src/circle/sim.js';
import { SCENES, sceneParams } from '../src/circle/scenes.js';
import { measureLoudness, MASTERING, applyMastering } from '../src/audio/loudness.js';
import { FRACTAL_PALETTES, paletteLut } from '../src/circle/fractal-lab.js';
import { INSTRUMENTS } from '../src/audio/instruments.js';

test('batch render: tags, title and description stored as lists become text everywhere', () => {
  const st = normalize({ name: 'Butterfly (2)', layers: [{ exprs: { y: 'sin(x)' } }], youtube: { title: ['Butterfly', 'curve'], description: ['line 1', 'line 2'], tags: ['math', 'butterfly curve', 'shorts'] }, hook: { text: ['Will it', 'close?'] } });
  assert.equal(st.youtube.tags, 'math, butterfly curve, shorts');
  assert.equal(st.youtube.title, 'Butterfly curve');
  assert.equal(st.youtube.description, 'line 1\nline 2');
  assert.equal(hookTextFor(st), 'Will it close?');
  // and the export code itself survives a list that slipped past loading
  const raw = { name: 'X', layers: [], youtube: { title: '', description: null, tags: ['a', 'b<c'] } };
  const meta = youtubeFor(raw);
  assert.equal(meta.tags, 'a, b‹c');
  assert.match(youtubeText({ ...meta, tags: ['x', 'y'] }, 'v.mp4'), /TAGS\nx, y/);
  assert.match(youtubeCsv([{ file: 'v.mp4', title: 't', description: 'd', tags: ['x', 'y'] }]), /"x, y"/);
  assert.deepEqual(youtubeProblems({ title: ['a'], tags: ['b'] }), []);
  assert.equal(asText({ nope: 1 }), '');
});

test('video check: finds broken formulas, late keys and texts, unknown settings; a clean preset passes', () => {
  assert.equal(validateState(defaultState()).problems.length, 0);
  const r = validateState({
    name: 'Bad', transport: { duration: 10 }, visul: {}, layers: [{ exprs: { y: 'sin(' }, volExpr: 'q+1', wave: 'kazoo-9000' }],
    keyframes: { tracks: { 'camera.zoom': [{ time: 0, value: 1 }, { time: 20, value: 2 }], 'nothing.here': [{ time: 1, value: 1 }] } },
    overlay: { texts: [{ text: 'late', start: 14 }] }, markers: [{ time: 30, label: 'Climax' }],
  });
  assert.equal(r.ok, false);
  const has = (re) => assert.ok(r.problems.some((p) => re.test(p.message)), String(re));
  has(/Formula “sin\(”/); has(/Loudness formula/); has(/Unknown instrument/); has(/after the end of the video/); has(/cannot be animated/); has(/Unknown setting/); has(/Story beat “Climax”/);
  assert.match(validationLine(r), /error/);
  // a length left over from another preset
  const left = validateState({ layers: [{}], transport: { duration: 34 }, keyframes: { tracks: { 'camera.zoom': [{ time: 0, value: 1 }, { time: 9, value: 2 }] } } });
  assert.ok(left.problems.some((p) => p.level === 'info' && /left over/.test(p.message)));
  // circle: unknown scene, a setting that does not exist, a wrong choice
  const c = validateState({ mode: 'circle', circle: { rule: 'fractal', blend: 'glow', lab: { fractal: { colours: 'fire', colors: 'mauve' } } } });
  assert.ok(c.problems.some((p) => /not a setting of fractal/.test(p.message)));
  assert.ok(c.problems.some((p) => /“mauve” is not one of/.test(p.message)));
  assert.ok(c.problems.some((p) => /Unknown blend mode/.test(p.message)));
  assert.ok(validateState({ mode: 'circle', circle: { rule: 'nope' } }).problems.some((p) => /Unknown simulation/.test(p.message)));
});

test('describe: every simulation is listed, and a scene gives its settings with ranges and paths', () => {
  const all = describeScene();
  assert.ok(all.length >= 70);
  for (const { rule } of all) assert.ok(describeScene(rule), rule);
  const f = describeScene('fractal');
  const jx = f.settings.find((s) => s.key === 'jx');
  assert.deepEqual([jx.type, jx.min, jx.max, jx.path], ['number', -2, 2, 'circle.lab.fractal.jx']);
  assert.ok(f.settings.find((s) => s.key === 'colors').options.includes('dusk'));
  assert.equal(describeScene('no-such-scene'), null);
});

test('scene keyframes: every setting of the scene on stage can be keyed, read and written', () => {
  const st = normalize({ mode: 'circle', layers: [{}], circle: { rule: 'fractal', layers: [{ id: 'b', cfg: { rule: 'ifs' } }] } });
  assert.ok(LANES.includes('Scene'));
  const list = animatable(st).filter((a) => a.path.startsWith('circle.'));
  for (const key of ['jx', 'jy', 'zexp', 'shift', 'bright', 'contrast', 'colors', 'jphase']) assert.ok(list.some((a) => a.path === `circle.lab.fractal.${key}`), key);
  assert.ok(list.some((a) => a.path === 'circle.layers.0.cfg.lab.ifs.system'));
  assert.ok(list.some((a) => a.path === 'circle.layers.0.opacity') && list.some((a) => a.path === 'circle.opacity'));
  assert.equal(laneOf('circle.lab.fractal.jx'), 'Scene');
  assert.equal(describe(st, 'circle.lab.fractal.colors').kind, 'choice');
  // untouched settings read as their default, and writing creates the place for them
  assert.equal(readValue(st, 'circle.lab.fractal.jx'), SCENES.fractal.defaults.jx);
  assert.equal(readValue(st, 'circle.layers.0.opacity'), 1);
  assert.equal(writeValue(st, 'circle.lab.fractal.jx', 0.3), true);
  assert.equal(sceneParams(st.circle).jx, 0.3);
  assert.equal(writeValue(st, 'circle.layers.5.cfg.lab.ifs.spin', 1), false, 'no such layer');
  assert.equal(isStep('circle.lab.fractal.nps'), true);
  assert.equal(isStep('circle.lab.fractal.jx'), false);
  // tracks drive the settings; in graph mode the scene lane is empty
  const changed = applyValues(st, valuesAt({ 'circle.lab.fractal.jx': [{ time: 0, value: -1 }, { time: 10, value: 1, ease: 'linear' }], 'circle.lab.fractal.colors': [{ time: 0, value: 'dusk' }, { time: 5, value: 'ash' }] }, 5));
  assert.ok(changed.has('circle'));
  assert.ok(Math.abs(st.circle.lab.fractal.jx) < 1e-9);
  assert.equal(st.circle.lab.fractal.colors, 'ash');
  assert.equal(animatable(normalize({ layers: [{}] })).filter((a) => a.path.startsWith('circle.')).length, 0);
});

test('scene keyframes reach the soundtrack: the replay asks for the settings of every moment', () => {
  const cfg = { ...defaultCircle(), rule: 'fractal', lab: { fractal: { sound: 'journey', nps: 2 } } };
  let calls = 0;
  const still = eventsUntil(cfg, 4, { bpm: 120 });
  const live = eventsUntil(cfg, 4, { bpm: 120, live: (t) => { calls++; return t > 2 ? { nps: 0 } : null; } });
  assert.ok(calls > 50);
  assert.ok(live.length < still.length && live.every((e) => e.t <= 2.1));
});

test('circle layers: opacity and blend survive loading; transitions set the hand-over', () => {
  const st = normalize({ mode: 'circle', layers: [{}], circle: { rule: 'tree', transition: 'wipe', transitionSecs: 2, layers: [{ id: 'b', opacity: 0.4, blend: 'screen', cfg: { rule: 'buddha' } }, { id: 'c', cfg: { rule: 'ifs' } }] } });
  assert.deepEqual([st.circle.layers[0].opacity, st.circle.layers[0].blend, st.circle.layers[1].opacity, st.circle.layers[1].blend], [0.4, 'screen', 1, 'normal']);
  assert.equal(transitionSecs(st.circle), 2);
  assert.equal(transitionSecs({ transition: 'cut' }), 0);
  assert.equal(transitionSecs({}), 0.45);
  const sch = circleSchedule(st.circle, 30);
  const mid = visibleAt(sch, 11, 2); // step 2 started at 10 s: half-way through a 2 s hand-over
  assert.deepEqual(mid.map((s) => [s.layer.id, s.edge, +s.alpha.toFixed(2)]), [['main', 'out', 0.5], ['b', 'in', 0.5]]);
  assert.deepEqual(visibleAt(sch, 10.001, 0).map((s) => s.layer.id), ['b'], 'a hard cut shows one step');
  for (const k of ['normal', 'screen', 'add', 'multiply']) assert.ok(k in BLENDS);
  for (const k of ['fade', 'dissolve', 'zoom', 'wipe', 'cut']) assert.ok(k in TRANSITIONS);
});

test('fractal tone: dark palettes exist, brightness and contrast are baked into the colour table', () => {
  for (const k of ['dusk', 'ash']) assert.ok(FRACTAL_PALETTES[k]);
  const lum = (lut) => { let s = 0; for (let i = 0; i < 256; i++) s += lut[i * 4] + lut[i * 4 + 1] + lut[i * 4 + 2]; return s / 768; };
  assert.ok(lum(paletteLut('dusk')) < 70 && lum(paletteLut('ash')) < 70, 'dark');
  assert.ok(lum(paletteLut('fire', { bright: 0.5, contrast: 1, sat: 1 })) < lum(paletteLut('fire')) * 0.6);
  const grey = paletteLut('rainbow', { bright: 1, contrast: 1, sat: 0 });
  for (let i = 0; i < 256; i += 17) assert.ok(Math.abs(grey[i * 4] - grey[i * 4 + 2]) <= 1);
  assert.equal(paletteLut('fire'), paletteLut('fire', { bright: 1, contrast: 1, sat: 1 }), 'untouched tone is the plain table');
});

test('loudness: the −23 LUFS reference tone reads −23, silence and bass are reported', () => {
  const rate = 48000, n = rate * 6;
  const tone = (amp, hz) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = amp * Math.sin((2 * Math.PI * hz * i) / rate); return a; };
  const ref = measureLoudness([tone(10 ** (-23 / 20), 997), tone(10 ** (-23 / 20), 997)], rate);
  assert.ok(Math.abs(ref.lufs + 23) < 0.2, String(ref.lufs));
  assert.ok(Math.abs(ref.gainToTarget - 9) < 0.3);
  assert.match(ref.advice[0], /Quiet/);
  const louder = measureLoudness([tone(10 ** (-13 / 20), 997), tone(10 ** (-13 / 20), 997)], rate);
  assert.ok(Math.abs(louder.lufs - ref.lufs - 10) < 0.2, 'ten decibels more is ten LU more');
  const gap = tone(0.4, 80); gap.fill(0, rate * 1, rate * 4);
  const g = measureLoudness([gap], rate);
  assert.equal(g.silences.length, 1);
  assert.ok(g.silences[0].start > 0.8 && g.silences[0].end < 4.2 && g.silentShare > 0.4);
  assert.ok(g.balance.low > 0.8);
  assert.ok(g.advice.some((a) => /Bass-heavy/.test(a)) && g.advice.some((a) => /silent/.test(a)));
  const clip = new Float32Array(n).fill(1);
  assert.ok(measureLoudness([clip], rate).clipped === n);
  assert.equal(measureLoudness([new Float32Array(n)], rate).lufs, -Infinity);
  assert.equal(measureLoudness([], rate).seconds, 0);
});

test('mastering presets only touch the master chain, and clean undoes them', () => {
  const a = defaultState().audio, before = structuredClone(a);
  for (const id of Object.keys(MASTERING)) assert.equal(applyMastering(a, id), true, id);
  assert.equal(applyMastering(a, 'nope'), false);
  applyMastering(a, 'lofi');
  assert.ok(a.crush > 0 && a.eq.high < 0);
  assert.deepEqual([a.scale, a.master, a.noteLow, a.root], [before.scale, before.master, before.noteLow, before.root]);
  applyMastering(a, 'clean');
  assert.deepEqual([a.eq, a.crush, a.distortion, a.filter.cutoff, a.reverb.mix], [{ low: 0, mid: 0, high: 0 }, 0, 0, before.filter.cutoff, before.reverb.mix]);
});

test('new defaults: story beats are sorted and cleaned, the camera can follow a chosen layer, breath instruments exist', () => {
  const st = normalize({ layers: [{ volExpr: 'u^2' }], camera: { trackLayer: 2 }, markers: [{ time: 8, label: 'Climax' }, { time: 'x' }, { time: 2, label: ['Rise'] }] });
  assert.deepEqual(st.markers, [{ time: 2, label: 'Rise' }, { time: 8, label: 'Climax' }]);
  assert.equal(st.camera.trackLayer, 2);
  assert.equal(st.layers[0].volExpr, 'u^2');
  assert.equal(defaultState().record.batchVideosOnly, false);
  assert.ok(describe(st, 'camera.trackLayer'));
  for (const id of ['ney-breath', 'santur-hammer', 'strings-bowed', 'flute-breath']) assert.ok(INSTRUMENTS[id].noise, id);
});
