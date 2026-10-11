/**
 * Writes packs/math-lessons.mmv.json: the "Math & waves lessons" pack as one importable file
 * (Library → Import preset files). The same pack is one click away in the Library tab.
 *
 *   node scripts/build-pack.mjs
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { normalize } from '../src/state.js';
import { bundleFile } from '../src/library.js';
import { lessonPack, PACK_NAME } from '../src/circle/presets-lessons.js';

const out = lessonPack().map(normalize);
await mkdir(new URL('../packs/', import.meta.url), { recursive: true });
await writeFile(new URL('../packs/math-lessons.mmv.json', import.meta.url), bundleFile(out).replace('"presets":', `"$collection": ${JSON.stringify(PACK_NAME)},\n  "presets":`));
console.log(`${out.length} presets → packs/math-lessons.mmv.json`);
