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
for (const f of srcFiles) files[f.replace(/^src[\\/]/, `${prefix}/`).replace(/\\/g, '/')] = f.replace(/\\/g, '/');
for (const f of walk('vendor').filter((x) => /\.(m?js)$/.test(x))) files[f.replace(/\\/g, '/')] = f.replace(/\\/g, '/');

mkdirSync('dist', { recursive: true });
writeFileSync('dist/artifact.html', html);
writeFileSync('dist/artifact-files.json', JSON.stringify({ build, prefix, files }, null, 2));
console.log(`Wrote dist/artifact.html · build ${build} · ${Object.keys(files).length} files`);
