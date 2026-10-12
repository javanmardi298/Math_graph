/**
 * Built-in presets live outside the app, as JSON files in presets/ (made from
 * presets-src/ by scripts/build-presets.mjs). The app ships only the preset it opens
 * with; the catalog and each shelf are fetched the first time they are needed, so new
 * presets never make the app bigger or slower to start.
 *
 *   presets/index.json          shelves (name, section, count, preset names), lesson packs
 *   presets/shelves/<id>.json   one shelf's presets
 *   presets/lessons/<id>.json   one lesson pack
 *   presets/sounds.json         sound presets (Sound tab)
 */

/** The preset the app opens with the very first time (kept here so it starts offline too). */
export const DEFAULT_PRESET = {
  name: 'Bass Drop', mode: '2d', transport: { duration: 16 }, view: { xMin: 0, xMax: 8, yMin: -3, yMax: 3 },
  layers: [{ name: 'Kick decay', type: 'function', exprs: { y: '3 * exp(-12 * mod(x, 0.5)) - 1.5' }, color: '#22e4ff', colorMode: 'pitch', wave: 'sawtooth', width: 5, volume: 0.7 }],
  visual: { drawMode: 'trace', bloom: { strength: 1.3 }, marker: { shape: 'circle' } },
  audio: { noteLow: 28, noteHigh: 64, scale: 'continuous', glide: 8, distortion: 0.35, filter: { type: 'lowpass', cutoff: 2400, q: 4 }, reverb: { mix: 0.15 }, delay: { mix: 0.1 } },
};

const BASE = new URL('../presets/', import.meta.url);
// a new build gets fresh copies (the artifact page sets MMV_BUILD); local runs always fetch
const bust = () => (globalThis.MMV_BUILD ? `?v=${globalThis.MMV_BUILD}` : `?t=${Date.now()}`);
const cache = new Map();

/** Fetch one JSON file of the catalog (once). */
function get(path) {
  if (!cache.has(path)) {
    cache.set(path, fetch(new URL(path, BASE).href + bust()).then((r) => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`);
      return r.json();
    }).catch((err) => { cache.delete(path); throw err; }));
  }
  return cache.get(path);
}

/** { shelves: [{id, name, section, count, file, names}], packs: [{id, name, about, collection, count, file}] } */
export const loadCatalog = () => get('index.json');

/** The presets of one shelf, each tagged with its shelf name ($category). */
export async function loadShelf(id) {
  const cat = await loadCatalog();
  const shelf = cat.shelves.find((s) => s.id === id);
  if (!shelf) return [];
  const data = await get(shelf.file);
  return data.presets.map((p) => ({ ...p, $category: shelf.name, $shelf: shelf.id }));
}

/** Every shelf at once (the library's search and lists): [{shelf, presets}] in catalog order. */
export async function loadAllShelves() {
  const cat = await loadCatalog();
  return Promise.all(cat.shelves.map(async (s) => ({ shelf: s, presets: await loadShelf(s.id) })));
}

/** The lessons of one pack. */
export async function loadPack(id) {
  const cat = await loadCatalog();
  const pack = cat.packs.find((p) => p.id === id);
  return pack ? (await get(pack.file)).presets : [];
}

/** Sound presets: { groups: [name], presets: [{name, group, about, instrument, audio}] }. */
export const loadSounds = () => get('sounds.json');
