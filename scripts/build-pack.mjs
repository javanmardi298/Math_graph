/**
 * Writes every lesson pack as an importable file, packs/<id>.mmv.json, plus
 * packs/all-lessons.mmv.json (Library → Import preset files). The same packs are one
 * click away in the Library tab ("Lesson packs").
 *
 *   node scripts/build-pack.mjs
 */
import { writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { normalize } from '../src/state.js';
import { bundleFile } from '../src/library.js';
import { PACKS, collectionOf } from '../src/lessons/index.js';

const dir = new URL('../packs/', import.meta.url);
await mkdir(dir, { recursive: true });
for (const f of await readdir(dir)) if (f.endsWith('.mmv.json')) await rm(new URL(f, dir));
const all = [];
for (const pack of PACKS) {
  const list = (await pack.load()).map((p) => ({ ...normalize(p), $collection: collectionOf(pack) }));
  all.push(...list);
  await writeFile(new URL(`${pack.id}.mmv.json`, dir), withCollection(bundleFile(list), collectionOf(pack)));
}
// one file with everything: each preset keeps its pack's collection
await writeFile(new URL('all-lessons.mmv.json', dir), JSON.stringify({ $format: 'math-melody-presets', version: 1, presets: all }, null, 1));
console.log(`${PACKS.length} packs, ${all.length} lessons → packs/`);

function withCollection(text, name) { return text.replace('"presets":', `"$collection": ${JSON.stringify(name)},\n  "presets":`); }
