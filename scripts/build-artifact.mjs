// Builds dist/artifact.html: the same app as index.html, with the CSS inlined and
// the document wrapper removed, for publishing as a claude.ai Artifact.
//
// Cache busting: browsers cache ES modules by URL, so republishing src/main.js at the
// same path left viewers running old code. The app's own modules are therefore
// published under a content-hashed folder (src-<hash>/…); every change gets new URLs.
// Vendored libraries never change at a given path, so they keep stable URLs.
//
// Also writes dist/artifact-files.json: { "<published path>": "<local file>" } for the
// Artifact publish call.
//
// File limit: an Artifact version holds at most ~510 files, and every build adds a new
// src-<hash>/ folder. scripts/artifact-published.json remembers which build folders are
// online (and their files); dist/artifact-publish-<n>.json are the maps to publish (≤ 250 entries each): the new
// files plus `null` for every older build folder except the previous one (kept so a
// viewer who loaded the page a moment ago keeps working). So the count stays at about
// 3 × the number of modules, however many times the app is republished.
import { mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

const srcFiles = walk('src').filter((f) => f.endsWith('.js')).sort();
const hash = createHash('sha256');
for (const f of srcFiles) hash.update(f).update(readFileSync(f));
hash.update(readFileSync('index.html')).update(readFileSync('src/styles.css'));
const build = hash.digest('hex').slice(0, 10);
const prefix = `src-${build}`;

let html = readFileSync('index.html', 'utf8');
const css = readFileSync('src/styles.css', 'utf8');
html = html
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<html[^>]*>\s*/i, '')
  .replace(/<\/?head>\s*/gi, '')
  .replace(/<\/?body>\s*/gi, '')
  .replace(/<\/html>\s*/i, '')
  .replace(/<meta charset[^>]*>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '')
  .replace('<link rel="stylesheet" href="src/styles.css">', `<style>\n${css}</style>`)
  .replace('<script type="module" src="src/main.js"></script>', `<script type="module" src="${prefix}/main.js"></script>`)
  .replace('<div class="app" id="app">', `<script>document.documentElement.dataset.theme = "dark"; window.MMV_BUILD = "${build}";</script>\n<div class="app" id="app">`);
if (!html.includes(`${prefix}/main.js`)) throw new Error('index.html no longer loads src/main.js the expected way');

const files = {};
for (const f of srcFiles) {
  const local = f.replace(/\\/g, '/');
  files[local.replace(/^src\//, `${prefix}/`)] = local;
  // Also at the plain src/ path: a viewer still holding an older page (which loads
  // src/main.js) then starts too, instead of failing on missing files.
  files[local] = local;
}
for (const f of walk('vendor').filter((x) => /\.(m?js)$/.test(x))) files[f.replace(/\\/g, '/')] = f.replace(/\\/g, '/');

mkdirSync('dist', { recursive: true });
writeFileSync('dist/artifact.html', html);
writeFileSync('dist/artifact-files.json', JSON.stringify({ build, prefix, files }, null, 2));

// Prune old build folders (see the note at the top).
const RECORD = 'scripts/artifact-published.json';
let record = [];
try { record = JSON.parse(readFileSync(RECORD, 'utf8')); } catch { /* first build */ }
const own = Object.keys(files).filter((k) => k.startsWith(`${prefix}/`)).map((k) => k.slice(prefix.length + 1));
record = record.filter((r) => r.build !== build);
const keep = record.slice(-1), drop = record.slice(0, -1);
const publish = Object.fromEntries(Object.entries(files).filter(([k]) => !k.startsWith('vendor/')));
for (const r of drop) for (const f of r.files) publish[`src-${r.build}/${f}`] = null;
// One publish call takes at most 255 entries: new files first, removals in later parts.
const entries = Object.entries(publish).sort(([, a], [, b]) => (a === null) - (b === null));
const parts = [];
for (let i = 0; i < entries.length; i += 250) parts.push(Object.fromEntries(entries.slice(i, i + 250)));
parts.forEach((part, i) => writeFileSync(`dist/artifact-publish-${i + 1}.json`, JSON.stringify(part)));
writeFileSync(RECORD, `${JSON.stringify([...keep, { build, files: own }], null, 1)}\n`);
const online = keep.reduce((n, r) => n + r.files.length, 0) + own.length * 2 + Object.keys(files).filter((k) => k.startsWith('vendor/')).length + 1;
console.log(`Publish maps: dist/artifact-publish-1…${parts.length}.json (publish them in order) · removes ${drop.length} old build folder(s) · about ${online} files online after publishing`);
console.log(`Wrote dist/artifact.html · build ${build} · ${Object.keys(files).length} files`);
