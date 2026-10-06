// Copies the parts of three.js the app uses into ./vendor so the app runs fully offline.
// Usage: npm install && npm run vendor
import { cpSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const SRC = resolve('node_modules/three');
const OUT = resolve('vendor/three');
const ENTRIES = [
  'controls/OrbitControls.js',
  'lines/Line2.js', 'lines/LineGeometry.js', 'lines/LineMaterial.js',
  'postprocessing/EffectComposer.js', 'postprocessing/RenderPass.js',
  'postprocessing/UnrealBloomPass.js', 'postprocessing/OutputPass.js',
  'postprocessing/BokehPass.js', 'postprocessing/AfterimagePass.js',
];

if (!existsSync(SRC)) { console.error('Run `npm install` first.'); process.exit(1); }
mkdirSync(join(OUT, 'build'), { recursive: true });
cpSync(join(SRC, 'build/three.module.min.js'), join(OUT, 'build/three.module.min.js'));

// Walk relative imports so every dependency of the addons is copied too.
const seen = new Set();
const queue = ENTRIES.map((e) => join('examples/jsm', e));
while (queue.length) {
  const rel = queue.pop();
  if (seen.has(rel)) continue;
  seen.add(rel);
  const code = readFileSync(join(SRC, rel), 'utf8');
  mkdirSync(dirname(join(OUT, rel)), { recursive: true });
  cpSync(join(SRC, rel), join(OUT, rel));
  for (const m of code.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) queue.push(join(dirname(rel), m[1]));
}
console.log(`Vendored three.js + ${seen.size} addon files into vendor/three`);
