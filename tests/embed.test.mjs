import test from 'node:test';
import assert from 'node:assert/strict';
import { embedPreset, embedInBlob, extractPreset, extractPresetFromFile, sniff } from '../src/export/embed.js';

const json = JSON.stringify({ name: 'Round trip', layers: [{ id: 'L1' }], text: 'x'.repeat(5000) + 'é✓' });

function fakeWav() {
  const n = 200, b = new Uint8Array(44 + n);
  const v = new DataView(b.buffer);
  b.set([0x52, 0x49, 0x46, 0x46], 0); v.setUint32(4, 36 + n, true); b.set([0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20], 8);
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  b.set([0x64, 0x61, 0x74, 0x61], 36); v.setUint32(40, n, true);
  return b;
}
const fakePng = () => Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
const fakeMp4 = () => Uint8Array.from([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0, 0, 0, 0, 8, 0x66, 0x72, 0x65, 0x65]);
const fakeWebm = () => Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0x80, 0x18, 0x53, 0x80, 0x67, 0x80]);

for (const [name, make, kind] of [['wav', fakeWav, 'wav'], ['png', fakePng, 'png'], ['mp4', fakeMp4, 'mp4'], ['webm', fakeWebm, 'webm']]) {
  test(`preset round trip in ${name}`, async () => {
    const src = make();
    assert.equal(sniff(src), kind);
    const out = await embedPreset(src, json);
    assert.ok(out.length > src.length);
    assert.equal(await extractPreset(out), json);
    assert.equal(await extractPreset(src), null);
    const viaBlob = new Uint8Array(await (await embedInBlob(new Blob([src]), json)).arrayBuffer());
    assert.deepEqual(viaBlob, out);
    assert.equal(await extractPresetFromFile(new Blob([viaBlob])), json);
  });
}

test('wav stays a valid RIFF and png keeps IEND last', async () => {
  const w = await embedPreset(fakeWav(), json);
  assert.equal(new DataView(w.buffer).getUint32(4, true), w.length - 8);
  const p = await embedPreset(fakePng(), json);
  assert.deepEqual([...p.subarray(p.length - 8, p.length - 4)], [0x49, 0x45, 0x4e, 0x44]);
});

test('unknown files are returned unchanged', async () => {
  const x = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  assert.equal(await embedPreset(x, json), x);
});
