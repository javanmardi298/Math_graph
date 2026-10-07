import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeZip, crc32 } from '../src/export/zip.js';

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});
test('zip has local header, central directory and end record', () => {
  const z = makeZip([{ name: 'song.mid', data: new Uint8Array([1, 2, 3]) }]);
  const v = new DataView(z.buffer);
  assert.equal(v.getUint32(0, true), 0x04034b50);
  assert.equal(v.getUint32(z.length - 22, true), 0x06054b50);
  assert.equal(v.getUint16(z.length - 22 + 10, true), 1);
});
