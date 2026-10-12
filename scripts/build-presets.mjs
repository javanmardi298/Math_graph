/**
 * Builds the preset catalog the app loads at run time (nothing about presets is
 * compiled into the app):
 *
 *   presets/index.json            shelves (name, section, count), lesson packs, sound presets
 *   presets/sounds.json           sound presets for the Sound tab (sound settings only)
 *   presets/shelves/<id>.json     the presets of one shelf (partial states)
 *   presets/lessons/<id>.json     the lessons of one pack
 *   packs/<id>.mmv.json           the same lesson packs as importable files (full states)
 *
 * Sources: presets-src/ (catalog.js lists shelves, picks and preset files).
 *
 *   node scripts/build-presets.mjs           write the files
 *   node scripts/build-presets.mjs --check   fail if presets/ is out of date
 */
import { SOUND_PRESETS, SOUND_GROUPS } from '../presets-src/sounds.js';
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { SHELVES, START_HERE, ALL_PRESETS, DEFAULT_NAME, shelfOf } from '../presets-src/catalog.js';
import { PACKS, collectionOf } from '../presets-src/lessons/index.js';
import { normalize } from '../src/state.js';
import { bundleFile } from '../src/library.js';

const check = process.argv.includes('--check');
const root = new URL('../', import.meta.url);
const json = (x) => `${JSON.stringify(x)}\n`; // compact: phones download these
const out = new Map(); // path → text

// names must be unique: the library, favourites and the command line find presets by name
const seen = new Set();
for (const p of ALL_PRESETS) { if (seen.has(p.name)) throw new Error(`Two presets are called "${p.name}"`); seen.add(p.name); }
if (!seen.has(DEFAULT_NAME)) throw new Error(`Default preset "${DEFAULT_NAME}" is missing`);

const byShelf = new Map(SHELVES.map(([id]) => [id, []]));
for (const p of ALL_PRESETS) {
  const id = shelfOf(p);
  if (!byShelf.has(id)) throw new Error(`Unknown shelf "${id}" for "${p.name}"`);
  const { $category, ...rest } = p;
  byShelf.get(id).push(rest);
}
const byName = new Map(ALL_PRESETS.map((p) => [p.name, p]));
for (const n of START_HERE) if (!byName.has(n)) throw new Error(`"Start here" lists a missing preset: ${n}`);
byShelf.set('start', START_HERE.map((n) => { const { $category, ...rest } = byName.get(n); return rest; }));

const shelves = [];
for (const [id, name, section] of SHELVES) {
  const list = byShelf.get(id);
  if (!list.length) continue;
  out.set(`presets/shelves/${id}.json`, json({ id, name, presets: list }));
  shelves.push({ id, name, section, count: list.length, file: `shelves/${id}.json`, names: list.map((p) => p.name) });
}
const packs = [];
for (const pack of PACKS) {
  const list = await pack.load();
  out.set(`presets/lessons/${pack.id}.json`, json({ id: pack.id, name: pack.name, about: pack.about, collection: collectionOf(pack), presets: list }));
  packs.push({ id: pack.id, name: pack.name, about: pack.about, collection: collectionOf(pack), count: list.length, file: `lessons/${pack.id}.json` });
  // importable bundle (full states), one per pack and one with everything
  out.set(`packs/${pack.id}.mmv.json`, bundleFile(list.map(normalize)).replace('"presets":', `"$collection": ${JSON.stringify(collectionOf(pack))},\n  "presets":`));
}
const allLessons = [];
for (const pack of PACKS) for (const p of await pack.load()) allLessons.push({ ...normalize(p), $collection: collectionOf(pack) });
out.set('packs/all-lessons.mmv.json', JSON.stringify({ $format: 'math-melody-presets', version: 1, presets: allLessons }, null, 1));
// sound presets (Sound tab): sound settings only, no drawing
out.set('presets/sounds.json', json({ $format: 'math-melody-sounds', version: 1, groups: SOUND_GROUPS, presets: SOUND_PRESETS }));
const sounds = { file: 'sounds.json', count: SOUND_PRESETS.length };
out.set('presets/index.json', json({ $format: 'math-melody-catalog', version: 1, default: DEFAULT_NAME, presets: ALL_PRESETS.length, shelves, packs, sounds }));

if (check) {
  const stale = [];
  // the import bundles (packs/) carry fresh layer ids every build: compare the catalog only
  for (const [path, text] of out) { if (!path.startsWith('presets/')) continue; let now = ''; try { now = await readFile(new URL(path, root), 'utf8'); } catch { /* missing */ } if (now !== text) stale.push(path); }
  if (stale.length) { console.error(`presets/ is out of date (${stale.slice(0, 5).join(', ')}…). Run: node scripts/build-presets.mjs`); process.exit(1); }
  console.log('presets/ is up to date');
} else {
  for (const dir of ['presets/shelves/', 'presets/lessons/', 'packs/']) {
    await mkdir(new URL(dir, root), { recursive: true });
    for (const f of await readdir(new URL(dir, root))) if (f.endsWith('.json') && !out.has(dir + f)) await rm(new URL(dir + f, root));
  }
  for (const [path, text] of out) await writeFile(new URL(path, root), text);
  console.log(`${ALL_PRESETS.length} presets on ${shelves.length} shelves, ${packs.length} lesson packs (${allLessons.length} lessons) → presets/, packs/`);
}
