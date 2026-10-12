import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_PRESETS } from '../presets-src/catalog.js';
import { LENGTHS } from '../presets-src/lengths.js';

test('presets have their own lengths, not 30 s for everything', () => {
  const lens = ALL_PRESETS.map((p) => p.transport.duration);
  const at30 = lens.filter((d) => d === 30).length;
  assert.ok(at30 / lens.length < 0.3, `${at30} of ${lens.length} presets still run exactly 30 s`);
  assert.ok(new Set(lens).size >= 20, 'many different lengths');
});

test('every length is sensible for a Short and every named preset exists', () => {
  const names = new Set(ALL_PRESETS.map((p) => p.name));
  for (const [n, d] of Object.entries(LENGTHS)) {
    assert.ok(names.has(n), n);
    assert.ok(d >= 10 && d <= 45, `${n}: ${d}`);
  }
  for (const p of ALL_PRESETS) assert.equal(p.transport.duration, LENGTHS[p.name] ?? p.transport.duration, p.name);
});
