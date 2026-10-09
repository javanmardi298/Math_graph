import { test } from 'node:test';
import assert from 'node:assert/strict';
import { youtubeFor, youtubeText, youtubeCsv, youtubeSafe } from '../src/export/youtube.js';

test('no angle brackets reach YouTube (it rejects them)', () => {
  assert.equal(youtubeSafe('3.1408 < π < 3.1429, b >= 1, x <= 2'), '3.1408 ‹ π ‹ 3.1429, b ≥ 1, x ≤ 2');
  const meta = youtubeFor({ name: 'n', layers: [{ type: 'function', exprs: { y: 'x > 1 ? 1 : 0' } }], youtube: { title: 'a < b', description: '', tags: 'x>y' } });
  for (const text of [meta.title, meta.description, meta.tags, youtubeText({ title: '<b>', description: '<i>', tags: '' }), youtubeCsv([{ file: 'f', title: '<', description: '>', tags: '' }])]) {
    assert.ok(!/[<>]/.test(text), text);
  }
});

test('tags stay within 500 characters', () => {
  const tags = Array.from({ length: 80 }, (_, i) => `math tag ${i}`).join(', ');
  const out = youtubeFor({ name: 'n', layers: [], youtube: { title: 't', description: 'd', tags } }).tags;
  assert.ok(out.length <= 500 && out.length > 400, String(out.length));
});
