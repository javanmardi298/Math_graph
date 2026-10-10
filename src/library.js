/**
 * Preset library: the user's saved presets (stored in this browser), plus reading
 * and writing preset files.
 *
 * File formats (both are plain .json):
 *   single preset  { "$format": "math-melody-preset", "version": 1, ...app state }
 *   bundle         { "$format": "math-melody-presets", "version": 1, "presets": [ ...states ] }
 * Older exports (an app state without "$format") still import. A .zip of such files
 * imports too. Validation is by content, never by file type, so phone file pickers
 * that report odd MIME types still work.
 */
import { readZip } from './export/zip.js';

const KEY = 'mmv.presets.v1';
export const STORAGE_BUDGET = 5 * 1024 * 1024; // typical localStorage quota

const uid = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/* ----------------------------------------------------- IndexedDB storage */
// localStorage holds only ~5 MB (about a thousand presets). The library lives in
// IndexedDB, which can hold hundreds of MB; localStorage is only the fallback (and the
// place older versions kept it, migrated on first load).

const DB_NAME = 'mmv-library';
const DB_STORE = 'kv';

function openDb() {
  return new Promise((ok, fail) => {
    if (!globalThis.indexedDB) return fail(new Error('IndexedDB unavailable'));
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(DB_STORE);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
    r.onblocked = () => fail(new Error('IndexedDB blocked'));
  });
}

function idbCall(db, mode, fn) {
  return new Promise((ok, fail) => {
    const t = db.transaction(DB_STORE, mode);
    const req = fn(t.objectStore(DB_STORE));
    t.oncomplete = () => ok(req?.result);
    t.onerror = () => fail(t.error);
    t.onabort = () => fail(t.error || new Error('aborted'));
  });
}

let dbPromise = null;

/**
 * Load the library. @returns {Promise<{items:object[], backend:'idb'|'local'}>}
 */
export async function loadLibrary(storage = globalThis.localStorage) {
  try {
    const db = await (dbPromise ||= openDb());
    const stored = await idbCall(db, 'readonly', (st) => st.get('items'));
    if (Array.isArray(stored)) return { items: stored, backend: 'idb' };
    const legacy = readLibrary(storage);
    await idbCall(db, 'readwrite', (st) => st.put(legacy, 'items'));
    try { storage.removeItem(KEY); } catch { /* blocked */ }
    globalThis.navigator?.storage?.persist?.().catch(() => {}); // ask the browser not to evict it
    return { items: legacy, backend: 'idb' };
  } catch {
    dbPromise = null;
    return { items: readLibrary(storage), backend: 'local' };
  }
}

let saving = Promise.resolve();

/** Save the library (writes run one after another). @returns {Promise<{ok:boolean, bytes:number, error?:string}>} */
export function saveLibrary(items, backend, storage = globalThis.localStorage) {
  const snapshot = items.slice();
  saving = saving.then(async () => {
    if (backend !== 'idb') return writeLibrary(snapshot, storage);
    try {
      const db = await (dbPromise ||= openDb());
      await idbCall(db, 'readwrite', (st) => st.put(snapshot, 'items'));
      return { ok: true };
    } catch (err) {
      const full = /quota|exceed/i.test(`${err?.name} ${err?.message}`);
      return { ok: false, error: full ? 'full' : 'blocked' };
    }
  });
  return saving;
}

/** Is this object an app state the app can load? */
export const isPreset = (o) => !!o && typeof o === 'object' && !Array.isArray(o) && Array.isArray(o.layers) && o.layers.length > 0;

/** Remove library-only fields before a preset is loaded or exported. */
export function clean(preset) {
  const { $format, version, $collection, ...rest } = preset;
  return rest;
}

/**
 * Library item: { id, name, collection, favorite, savedAt, preset }.
 * Older versions stored a bare array of app states; those are wrapped on read.
 */
export function readLibrary(storage = globalThis.localStorage) {
  let raw;
  try { raw = JSON.parse(storage.getItem(KEY)) || []; } catch { return []; }
  if (!Array.isArray(raw)) return [];
  return raw.filter(Boolean).map((x) => (x.preset && isPreset(x.preset)
    ? { id: x.id || uid(), name: x.name || x.preset.name || 'Untitled', collection: x.collection || '', favorite: !!x.favorite, savedAt: x.savedAt || 0, preset: x.preset }
    : isPreset(x) ? { id: uid(), name: x.name || 'Untitled', collection: '', favorite: false, savedAt: 0, preset: clean(x) } : null)).filter(Boolean);
}

/** @returns {{ok:boolean, bytes:number, error?:string}} */
export function writeLibrary(items, storage = globalThis.localStorage) {
  const json = JSON.stringify(items);
  try {
    storage.setItem(KEY, json);
    return { ok: true, bytes: json.length * 2 };
  } catch (err) {
    const full = /quota|exceed/i.test(`${err?.name} ${err?.message}`);
    return { ok: false, bytes: json.length * 2, error: full ? 'full' : 'blocked' };
  }
}

export function makeItem(preset, { name, collection = '', favorite = false } = {}) {
  const p = clean(preset);
  const n = (name || p.name || 'Untitled').trim() || 'Untitled';
  return { id: uid(), name: n, collection, favorite, savedAt: Date.now(), preset: { ...p, name: n } };
}

/** "Name", "Name (2)", "Name (3)"… so imports never overwrite. */
export function uniqueName(name, taken) {
  if (!taken.has(name)) return name;
  const base = name.replace(/\s\(\d+\)$/, '');
  let i = 2;
  while (taken.has(`${base} (${i})`)) i++;
  return `${base} (${i})`;
}

/** Facts shown in the list and used by the filters. */
export function describe(preset) {
  const aspect = preset.visual?.aspect || '16:9';
  return {
    aspect,
    vertical: aspect === '9:16' || aspect === '4:5',
    mode: preset.mode === '3d' ? '3d' : preset.mode === 'circle' ? 'circle' : '2d',
    layers: (preset.layers || []).length,
    colors: (preset.layers || []).slice(0, 4).map((l) => l.color || '#22e4ff'),
    sequence: !!preset.sequence?.enabled,
    rhythm: !!preset.rhythm?.enabled,
    drums: !!preset.drums?.enabled,
    animated: Object.keys(preset.keyframes?.tracks || {}).length > 0,
  };
}

export const singleFile = (preset) => JSON.stringify({ $format: 'math-melody-preset', version: 1, ...clean(preset) }, null, 2);
export const bundleFile = (presets) => JSON.stringify({ $format: 'math-melody-presets', version: 1, presets: presets.map(clean) }, null, 2);

const KIND_BY_EXT = {
  mp4: 'a video', webm: 'a video', mov: 'a video', wav: 'an audio file', mp3: 'an audio file',
  mid: 'a MIDI file', midi: 'a MIDI file', png: 'an image', jpg: 'an image', jpeg: 'an image',
};

/**
 * Presets found in parsed JSON: a single state, a bundle, or an array of states.
 * `single` / `bundle` are the collection names to use for each case.
 */
function presetsIn(data, single, bundle) {
  if (isPreset(data)) return [{ preset: clean(data), collection: data.$collection || single }];
  const list = Array.isArray(data) ? data : Array.isArray(data?.presets) ? data.presets : null;
  if (!list) return [];
  return list.filter(isPreset).map((p) => ({ preset: clean(p), collection: p.$collection || bundle }));
}

/**
 * Read preset files (.json, or .zip containing .json files).
 * @param {File[]} files
 * @returns {Promise<{found:{preset:object, collection:string, source:string}[], problems:{file:string, reason:string}[]}>}
 */
export async function readPresetFiles(files) {
  const found = [], problems = [];
  const fromText = (text, source, single, bundle) => {
    let data;
    try { data = JSON.parse(text.replace(/^﻿/, '')); } catch { problems.push({ file: source, reason: 'not valid JSON' }); return; }
    const got = presetsIn(data, single, bundle);
    if (!got.length) problems.push({ file: source, reason: 'JSON, but not a Math-Melody preset' });
    for (const g of got) found.push({ ...g, source });
  };
  for (const f of files) {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    const head = new Uint8Array(await f.slice(0, 4).arrayBuffer());
    const isZip = head[0] === 0x50 && head[1] === 0x4b;
    if (isZip) {
      try {
        const entries = await readZip(await f.arrayBuffer());
        const jsons = entries.filter((e) => e.name.toLowerCase().endsWith('.json'));
        if (!jsons.length) problems.push({ file: f.name, reason: 'zip without preset (.json) files' });
        const coll = f.name.replace(/\.zip$/i, '');
        for (const e of jsons) fromText(new TextDecoder().decode(e.data), `${f.name} › ${e.name}`, coll, coll);
      } catch (err) {
        problems.push({ file: f.name, reason: `could not open the zip (${err.message})` });
      }
    } else if (KIND_BY_EXT[ext]) {
      problems.push({ file: f.name, reason: `this is ${KIND_BY_EXT[ext]}, not a preset. Import takes the .json files from “Export”` });
    } else {
      // A lone preset file joins no collection; a bundle file becomes one.
      fromText(await f.text(), f.name, '', f.name.replace(/(\.mmv)?\.json$/i, ''));
    }
  }
  return { found, problems };
}
