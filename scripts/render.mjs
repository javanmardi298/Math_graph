#!/usr/bin/env node
// Studio render: frame-perfect video from a preset, at any resolution.
//
//   node scripts/render.mjs --preset my.mmv.json --width 3840 --height 2160 --fps 60 --out out.mp4
//   node scripts/render.mjs --builtin "Lissajous 3D" --out lissajous.mp4
//
// A headless Chromium runs the app with ?render=1. Each frame is drawn at an exact
// time with a fixed time step (so it never drops frames, however slow the machine),
// the audio is rendered offline to WAV, and ffmpeg muxes both into an H.264 MP4.
import { spawn } from 'node:child_process';
import { readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { startServer } from './serve.mjs';
import { loadPlaywright, ffmpegPath, checkRenderTools } from './render-tools.mjs';

const { values: a } = parseArgs({
  options: {
    preset: { type: 'string' },
    builtin: { type: 'string' },
    out: { type: 'string', default: 'render.mp4' },
    width: { type: 'string', default: '1920' },
    height: { type: 'string', default: '1080' },
    fps: { type: 'string', default: '60' },
    crf: { type: 'string', default: '16' },
    speed: { type: 'string', default: 'medium' }, // x264 preset
    jpeg: { type: 'boolean', default: false }, // faster frame transfer, tiny quality cost
    software: { type: 'boolean', default: false }, // force SwiftShader (no GPU)
    json: { type: 'boolean', default: false }, // machine-readable progress (used by the server)
    help: { type: 'boolean', short: 'h' },
  },
});

if (a.help) {
  console.log(`Usage: node scripts/render.mjs [--preset file.json | --builtin NAME] [--width 1920 --height 1080 --fps 60]
       [--out render.mp4] [--crf 16] [--speed medium] [--jpeg] [--software]`);
  process.exit(0);
}

const report = (obj) => {
  if (a.json) process.stdout.write(`${JSON.stringify(obj)}\n`);
  else if (obj.status === 'rendering') process.stdout.write(`\r  frame ${obj.frame}/${obj.frames}  ${Math.round(obj.progress * 100)}%  ~${obj.eta}s left   `);
  else if (obj.message) console.log(obj.message);
};
const fail = (msg) => {
  report({ status: 'error', error: msg });
  if (!a.json) console.error(`\n✗ ${msg}`);
  process.exit(1);
};

const width = +a.width, height = +a.height, fps = +a.fps;
if (width % 2 || height % 2) fail('Width and height must be even numbers (H.264 requirement).');

const tools = await checkRenderTools();
if (!tools.available) fail(tools.reason);
const { chromium } = await loadPlaywright();

let preset = null;
if (a.preset) preset = JSON.parse(await readFile(a.preset, 'utf8'));

const server = await startServer(0);
const port = server.address().port;
const gpuArgs = a.software
  ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  : ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args: gpuArgs });
const tmp = join(tmpdir(), `mmv-${process.pid}-${Date.now()}`);
await mkdir(tmp, { recursive: true });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/?render=1`);
  await page.waitForFunction(() => window.__mmv?.ready, null, { timeout: 30000 }).catch(() => fail(`The app did not start: ${pageErrors.join('; ') || 'timeout'}`));

  if (a.builtin) {
    const { BUILTIN_PRESETS } = await import('../src/presets.js');
    preset = BUILTIN_PRESETS.find((p) => p.name.toLowerCase() === a.builtin.toLowerCase());
    if (!preset) fail(`No built-in preset called "${a.builtin}". Try: ${BUILTIN_PRESETS.map((p) => p.name).join(', ')}`);
  }
  const info = await page.evaluate((p) => window.__mmv.load(p), preset || { name: 'Bass Drop' });
  report({ status: 'starting', message: `Rendering “${info.name}” · ${width}×${height} @ ${fps} fps · ${info.duration}s` });

  const prep = await page.evaluate((o) => window.__mmv.prepare(o), { width, height, fps });
  const wavPath = join(tmp, 'audio.wav');
  await writeFile(wavPath, Buffer.from(prep.wav, 'base64'));

  const out = resolve(a.out);
  await mkdir(dirname(out), { recursive: true });
  const ff = spawn(ffmpegPath(), [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', a.jpeg ? 'mjpeg' : 'png', '-i', '-',
    '-i', wavPath,
    '-c:v', 'libx264', '-preset', a.speed, '-crf', a.crf, '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '320k', '-shortest', '-movflags', '+faststart',
    out,
  ], { stdio: ['pipe', 'inherit', 'pipe'] });
  let ffErr = '';
  ff.stderr.on('data', (d) => { ffErr += d; });
  const ffDone = once(ff, 'close');

  const format = a.jpeg ? 'image/jpeg' : 'image/png';
  const t0 = Date.now();
  for (let i = 0; i < prep.frames; i++) {
    const url = await page.evaluate(([n, f]) => window.__mmv.frame(n, f, 0.95), [i, format]);
    if (!ff.stdin.write(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))) await once(ff.stdin, 'drain');
    if (i % 5 === 0 || i === prep.frames - 1) {
      const done = i + 1;
      const rate = done / ((Date.now() - t0) / 1000);
      report({ status: 'rendering', frame: done, frames: prep.frames, progress: done / prep.frames, eta: Math.round((prep.frames - done) / rate) });
    }
  }
  ff.stdin.end();
  report({ status: 'encoding' });
  const [code] = await ffDone;
  if (code !== 0) fail(`ffmpeg failed: ${ffErr.trim().split('\n').pop()}`);
  if (pageErrors.length) console.error(`\nPage warnings: ${pageErrors.join('; ')}`);
  report({ status: 'encoded', message: `\n✓ Saved ${out} (${((Date.now() - t0) / 1000).toFixed(1)} s)` });
} finally {
  await browser.close();
  server.close();
  await rm(tmp, { recursive: true, force: true });
}
