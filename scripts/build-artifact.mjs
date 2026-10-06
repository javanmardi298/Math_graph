// Builds dist/artifact.html: the same app as index.html, with the CSS inlined and
// the document wrapper removed, for publishing as a claude.ai Artifact.
// The JS modules and vendored three.js are published alongside it unchanged.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

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
  .replace('<div class="app" id="app">', '<script>document.documentElement.dataset.theme = "dark";</script>\n<div class="app" id="app">');
mkdirSync('dist', { recursive: true });
writeFileSync('dist/artifact.html', html);
console.log('Wrote dist/artifact.html');
