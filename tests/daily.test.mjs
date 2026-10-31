import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { remix, formatOf, CURVES, rng } from '../src/daily/remix.js';
import { planDay, swapItem, ideas, planCsv, streak, slotsOf, addDays, keyOf, THEMES, DEFAULT_SETTINGS } from '../src/daily/planner.js';
import { readDaily, writeDaily, DAILY_KEY } from '../src/daily/store.js';
import { normalize } from '../src/state.js';
import { compile } from '../src/math/parser.js';

const root = new URL('../presets/', import.meta.url);
const json = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const idx = json('index.json');
const catalog = { shelves: idx.shelves.map((s) => ({ shelf: s, presets: json(s.file).presets })), packs: idx.packs.map((p) => ({ id: p.id, presets: json(p.file).presets })) };
const all = catalog.shelves.filter((s) => s.shelf.id !== 'start').flatMap(({ shelf, presets }) => presets.map((p) => ({ p, shelf: shelf.id })));
const VARS = ['x', 'y', 'z', 'r', 't', 'a', 'b', 'c', 'd', 's', 'theta', 'u', 'v', 'n'];

test('remix: same seed, same preset; another seed, another one', () => {
  const { p, shelf } = all.find((x) => x.p.circle?.rule === 'fdraw');
  assert.deepEqual(remix(p, 7, { shelf }), remix(p, 7, { shelf }));
  const names = new Set([1, 2, 3, 4, 5, 6].map((s) => remix(p, s, { shelf }).preset.name));
  assert.ok(names.size > 2);
  assert.notEqual(remix(p, 1, { shelf }).preset, p);
  assert.equal(p.name, all.find((x) => x.p.circle?.rule === 'fdraw').p.name, 'the source is not changed');
});

test('remix: every catalog preset gives a loadable preset with YouTube words', () => {
  for (const { p, shelf } of all) {
    for (const seed of [1, 2]) {
      const { preset, format } = remix(p, `${p.name}:${seed}`, { shelf });
      assert.ok(preset.name && preset.youtube.title.endsWith('#shorts'), p.name);
      assert.ok(preset.youtube.title.length <= 100, preset.youtube.title);
      assert.ok(/#shorts/.test(preset.youtube.description), p.name);
      assert.ok(preset.youtube.tags.length <= 500);
      assert.equal(format, formatOf(p, shelf));
      const n = normalize(preset);
      assert.ok(n.layers.length > 0, p.name);
      for (const l of n.layers) for (const e of Object.values(l.exprs || {})) compile(e, VARS);
    }
  }
});

test('remix: the curve bank compiles and quizzes hide the shape', () => {
  for (const c of CURVES) for (const e of Object.values(c.exprs)) compile(e, VARS);
  const quiz = all.find((x) => formatOf(x.p, x.shelf) === 'quiz');
  const r = remix(quiz.p, 3, { shelf: quiz.shelf }).preset;
  assert.ok(r.visual.hideUntil > 0);
  assert.ok(r.name.startsWith('Guess the Shape'));
});

test('rng is deterministic and in range', () => {
  const a = rng('x'), b = rng('x');
  for (let i = 0; i < 50; i++) { const v = a(); assert.equal(v, b()); assert.ok(v >= 0 && v < 1); }
});

test('planner: three themed cards a day, deterministic, no repeats in a day', () => {
  assert.equal(THEMES.length, 7);
  const d = '2026-10-12';
  const p1 = planDay(d, { catalog }), p2 = planDay(d, { catalog });
  assert.equal(p1.items.length, 3);
  assert.deepEqual(p1.items.map((x) => x.title), p2.items.map((x) => x.title));
  assert.equal(new Set(p1.items.map((x) => x.source)).size, 3);
  for (const x of p1.items) {
    assert.ok(x.title && x.description && x.pinned && x.time);
    assert.equal(x.status, 'planned');
  }
  assert.equal(slotsOf(d, { ...DEFAULT_SETTINGS, perDay: 5 }).length, 5);
  assert.equal(planDay(d, { catalog, settings: { ...DEFAULT_SETTINGS, perDay: 1 } }).items.length, 1);
});

test('planner: nothing repeats within the avoid window over two months', () => {
  const history = [];
  let d = '2026-10-12';
  for (let i = 0; i < 60; i++, d = addDays(d, 1)) {
    const { items } = planDay(d, { catalog, history });
    for (const x of items) {
      const clash = history.find((hh) => hh.key === keyOf(x) && i - hh.i < DEFAULT_SETTINGS.avoidDays);
      assert.ok(!clash, `${d}: ${keyOf(x)} again after ${clash && i - clash.i} days`);
      history.push({ date: d, source: x.source, key: keyOf(x), i });
    }
  }
});

test('planner: the queue goes first, swaps change the card, ideas are remixes', () => {
  const queue = [{ id: 'q1', name: 'My own', preset: all[0].p }];
  const { items, usedQueue } = planDay('2026-10-13', { catalog, queue });
  assert.deepEqual(usedQueue, ['q1']);
  assert.equal(items[0].from, 'queue');
  assert.equal(items[0].source, 'My own');
  const s = swapItem(items[1], { catalog, others: items, salt: 4 });
  assert.equal(s.slot, items[1].slot);
  assert.notEqual(s.title, items[1].title);
  const list = ideas({ catalog, n: 6, salt: 2, date: 'x' });
  assert.equal(list.length, 6);
  assert.ok(list.every((x) => x.remixed));
});

test('planner: CSV and streak', () => {
  const { items } = planDay('2026-10-12', { catalog });
  const csv = planCsv(items);
  assert.equal(csv.split('\r\n')[0].split(',')[0], '"Date"');
  const days = { '2026-10-11': { items: [{ status: 'uploaded' }, { status: 'skipped' }] }, '2026-10-12': { items: [{ status: 'planned' }] } };
  assert.equal(streak(days, '2026-10-12'), 1);
  days['2026-10-12'].items[0].status = 'uploaded';
  assert.equal(streak(days, '2026-10-12'), 2);
});

test('store: survives broken or blocked storage and drops old days', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  mem.set(DAILY_KEY, '{broken');
  const d = readDaily(storage);
  assert.equal(d.settings.perDay, 3);
  d.days['2026-01-01'] = { items: [] };
  d.days['2026-10-12'] = { items: [] };
  assert.ok(writeDaily(d, storage, '2026-10-12'));
  assert.deepEqual(Object.keys(readDaily(storage).days), ['2026-10-12']);
  assert.equal(writeDaily(d, { setItem() { throw new Error('full'); } }, '2026-10-12'), false);
  assert.equal(readDaily({ getItem() { throw new Error('blocked'); } }).queue.length, 0);
});
