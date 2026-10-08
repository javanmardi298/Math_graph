import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readLibrary, writeLibrary, makeItem, uniqueName, readPresetFiles, singleFile, bundleFile, describe } from '../src/library.js';
import { makeZip } from '../src/export/zip.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const P = (name, extra = {}) => ({ name, mode: '2d', layers: [{ color: '#ff0000', exprs: { y: 'sin(x)' } }], ...extra });
const file = (name, content) => new File([content], name);

test('old library format (bare states) is migrated', () => {
  const s = mem();
  s.setItem('mmv.presets.v1', JSON.stringify([P('Old one')]));
  const lib = readLibrary(s);
  assert.equal(lib.length, 1);
  assert.equal(lib[0].name, 'Old one');
  assert.ok(lib[0].id && lib[0].preset.layers.length === 1);
  assert.ok(writeLibrary(lib, s).ok);
  assert.equal(readLibrary(s)[0].id, lib[0].id);
});
test('unique names never overwrite', () => {
  const taken = new Set(['Wave', 'Wave (2)']);
  assert.equal(uniqueName('Wave', taken), 'Wave (3)');
  assert.equal(uniqueName('New', taken), 'New');
});
test('reads single files, bundles, old exports and zips; explains bad files', async () => {
  const files = [
    file('a.mmv.json', singleFile(P('A'))),
    file('pack.mmv.json', bundleFile([P('B'), P('C')])),
    file('legacy.json', JSON.stringify(P('D'))),
    file('more.zip', makeZip([{ name: 'e.json', data: new TextEncoder().encode(singleFile(P('E'))) }])),
    file('song.mp4', 'xxxx'),
    file('notes.json', '{"hello": 1}'),
    file('broken.json', '{oops'),
  ];
  const { found, problems } = await readPresetFiles(files);
  assert.deepEqual(found.map((f) => f.preset.name), ['A', 'B', 'C', 'D', 'E']);
  assert.equal(found.find((f) => f.preset.name === 'B').collection, 'pack');
  assert.equal(found.find((f) => f.preset.name === 'E').collection, 'more');
  assert.equal(problems.length, 3);
  assert.match(problems.find((p) => p.file === 'song.mp4').reason, /video/);
  assert.ok(!('$format' in found[0].preset));
});
test('describe() summarises a preset for the list', () => {
  const d = describe(P('X', { mode: '3d', visual: { aspect: '9:16' }, sequence: { enabled: true } }));
  assert.equal(d.vertical, true);
  assert.equal(d.mode, '3d');
  assert.equal(d.sequence, true);
  assert.equal(makeItem(P('  ')).name, 'Untitled');
});
