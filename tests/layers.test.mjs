import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CompiledLayer } from '../src/math/layers.js';
import { createLayer } from '../src/state.js';

const ctx = { t: 0, params: { a: 1, b: 1, c: 1, d: 1 }, view: { xMin: 0, xMax: 8, yMin: -4, yMax: 4 } };

test('function layer maps progress onto the x range', () => {
  const c = new CompiledLayer(createLayer({ exprs: { y: '2x', z: '0' } }));
  const p = c.at(0.5, ctx);
  assert.equal(p.x, 4);
  assert.equal(p.y, 8);
});
test('polar layer converts to cartesian', () => {
  const c = new CompiledLayer(createLayer({ type: 'polar', range: { min: 0, max: Math.PI }, exprs: { r: '2', z: '0' } }));
  const p = c.at(0.5, ctx);
  assert.ok(Math.abs(p.x) < 1e-9 && Math.abs(p.y - 2) < 1e-9);
});
test('errors are reported per field and time dependence detected', () => {
  const bad = new CompiledLayer(createLayer({ exprs: { y: 'sin(', z: '0' } }));
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.y);
  const timed = new CompiledLayer(createLayer({ exprs: { y: 'sin(x+t)', z: '0' } }));
  assert.equal(timed.usesTime, true);
});
test('sampling survives asymptotes', () => {
  const c = new CompiledLayer(createLayer({ exprs: { y: '1/(x-4)', z: '0' } }));
  const pts = c.sample(ctx, 8);
  assert.ok(pts.every(Number.isFinite));
});
