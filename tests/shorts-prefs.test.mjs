import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shortsTiming } from '../src/export/shorts.js';

// a tiny localStorage, installed before the module under test is loaded
const mem = new Map();
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { getShorts, saveShorts, applyShorts, SHORTS_DEFAULTS } = await import('../src/shorts-prefs.js');
const { store, defaultState } = await import('../src/state.js');

test('the hook is on by default, for every preset', () => {
  assert.equal(SHORTS_DEFAULTS.hook.enabled, true);
  assert.equal(defaultState().record.hook.enabled, true);
  const T = shortsTiming(defaultState().record, 20);
  assert.ok(T.on && T.teaser > 0 && T.hookEnd >= 2);
});

test('loading a preset never switches the hook back off', () => {
  const preset = { ...defaultState(), name: 'old preset', record: { ...defaultState().record, hook: { enabled: false, teaser: 0 }, outro: 0 } };
  store.load(preset);
  assert.equal(store.state.record.hook.enabled, true, 'the preset’s own hook setting is ignored');
  assert.equal(store.state.record.outro, 0.6);
});

test('a choice made once is kept for every later preset (and saved in the browser)', () => {
  const rec = defaultState().record;
  rec.hook.enabled = false; rec.hook.teaser = 1.2; rec.outro = 1;
  saveShorts(rec);
  assert.equal(JSON.parse(mem.get('mmv.shorts.v1')).hook.enabled, false);
  store.load({ ...defaultState(), name: 'another' });
  assert.equal(store.state.record.hook.enabled, false);
  assert.equal(store.state.record.hook.teaser, 1.2);
  assert.equal(store.state.record.outro, 1);
  assert.equal(applyShorts({}).hook.teaser, getShorts().hook.teaser);
  saveShorts(defaultState().record); // leave the defaults for other tests
});
