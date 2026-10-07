#!/usr/bin/env node
// Batch / command-line video export (the app's "Export video" button does the same in your browser).
//
//   node scripts/render.mjs --builtin "Lissajous 3D" --out lissajous.mp4
//   node scripts/render.mjs --preset my.mmv.json --width 1080 --height 1920 --fps 60 --out short.mp4
//
// Chromium (via Playwright) runs the app with ?render=1 and encodes the video in the page
// with WebCodecs: every frame is drawn at its exact time, so nothing is ever dropped.
// If the result isn't H.264/AAC (open-source Chromium has no H.264 encoder) and ffmpeg is
// installed, it is converted to H.264/AAC so it plays everywhere.
//
// Speed depends on the GPU. Headless browsers sometimes fall back to software rendering;
// the script tells you when that happens; then try --headed (opens a visible window that
// uses your graphics card).
import { writeFile, readFile, rm, mkdir, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { startServer, transcode } from './serve.mjs';
import { loadPlaywright, findFfmpeg } from './render-tools.mjs';

const { values: a } = parseArgs({
  options: {
    preset: { type: 'string' },
    builtin: { type: 'string' },
    out: { type: 'string', default: 'render.mp4' },
    width: { type: 'string', default: '1920' },
    height: { type: 'string', default: '1080' },
    fps: { type: 'string', default: '60' },
    quality: { type: 'string', default: 'high' }, // standard | high | max
    blur: { type: 'string', default: '1' }, // motion-blur sub-frames: 1, 2 or 4
    headed: { type: 'boolean', default: false },
    software: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
  },
});

if (a.help) {
  console.log(`Usage: node scripts/render.mjs [--preset file.json | --builtin NAME] [--width 1920 --height 1080 --fps 60]
       [--out render.mp4] [--quality standard|high|max] [--blur 1|2|4] [--headed] [--software]`);
  process.exit(0);
}
const fail = (msg) => { console.error(`\n✗ ${msg}`); process.exit(1); };

const width = +a.width, height = +a.height, fps = +a.fps;
if (width % 2 || height % 2) fail('Width and height must be even numbers.');
const pw = await loadPlaywright();
if (!pw) fail('Playwright is missing. Run: npm install && npx playwright install chromium');

let preset = null;
if (a.preset) preset = JSON.parse(await readFile(a.preset, 'utf8'));
if (a.builtin) {
  const { BUILTIN_PRESETS } = await import('../src/presets.js');
  preset = BUILTIN_PRESETS.find((p) => p.name.toLowerCase() === a.builtin.toLowerCase());
  if (!preset) fail(`No built-in preset called "${a.builtin}". Try: ${BUILTIN_PRESETS.map((p) => p.name).join(', ')}`);
}

const server = await startServer(0);
const port = server.address().port;
const args = a.software
  ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  : ['--ignore-gpu-blocklist', '--enable-gpu', '--enable-gpu-rasterization', '--enable-unsafe-swiftshader'];
const browser = await pw.chromium.launch({ headless: !a.headed, channel: a.headed ? undefined : 'chromium', args })
  .catch(() => pw.chromium.launch({ headless: !a.headed, args }));
const tmp = join(tmpdir(), `mmv-${process.pid}-${Date.now()}`);
await mkdir(tmp, { recursive: true });

try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/?render=1`);
  await page.waitForFunction(() => window.__mmv?.ready, null, { timeout: 30000 }).catch(() => fail(`The app did not start: ${errors.join('; ') || 'timeout'}`));

  const gpu = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  const software = /swiftshader|llvmpipe|software|basic render/i.test(gpu);
  console.log(`GPU: ${gpu}`);
  if (software && !a.software) console.log('  ⚠ Software rendering (no GPU in this browser): slow. Try --headed to use your graphics card.');

  const info = await page.evaluate((p) => window.__mmv.load(p), preset || { name: 'Bass Drop' });
  console.log(`Rendering “${info.name}” · ${width}×${height} @ ${fps} fps · ${info.duration}s`);
  const prep = await page.evaluate((o) => window.__mmv.prepare(o), { width, height, fps, subframes: +a.blur });
  if (!prep.webcodecs) fail('This Chromium has no WebCodecs video encoder. Update Playwright (npm install) and try again.');

  const t0 = Date.now();
  await page.exposeFunction('__mmvProgress', (p) => {
    process.stdout.write(`\r  frame ${p.frame}/${p.frames}  ${Math.round((p.frame / p.frames) * 100)}%  ${p.fps.toFixed(1)} fps  ~${p.eta}s left   `);
  });
  const res = await page.evaluate((q) => window.__mmv.renderVideo({ quality: q }), a.quality);
  const parts = [];
  for (let off = 0; off < res.bytes; off += 8 * 1024 * 1024) {
    parts.push(Buffer.from(await page.evaluate(([o, l]) => window.__mmv.chunk(o, l), [off, 8 * 1024 * 1024]), 'base64'));
  }
  const out = resolve(a.out);
  await mkdir(dirname(out), { recursive: true });
  const raw = join(tmp, 'raw.mp4');
  await writeFile(raw, Buffer.concat(parts));
  console.log(`\n  encoded ${res.video}${res.audio ? ` + ${res.audio}` : ''} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

  if ((res.video !== 'H.264' || (res.audio && res.audio !== 'AAC')) && findFfmpeg()) {
    console.log('  converting to H.264 + AAC with ffmpeg…');
    await transcode(raw, out);
  } else {
    await rename(raw, out).catch(async () => writeFile(out, await readFile(raw)));
    if (res.video !== 'H.264') console.log('  (install ffmpeg to get an H.264 copy that plays in every player)');
  }
  if (errors.length) console.error(`Page warnings: ${errors.join('; ')}`);
  console.log(`✓ Saved ${out}`);
} finally {
  await browser.close();
  server.close();
  await rm(tmp, { recursive: true, force: true });
}
