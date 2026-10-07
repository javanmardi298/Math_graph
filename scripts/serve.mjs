// Zero-dependency static server for localhost, plus the studio-render API.
// Usage: npm start  (or: node scripts/serve.mjs 5173)
//
//   GET  /api/health            → { available, reason }  can this machine render?
//   POST /api/render            → { id }                 body: { preset, width, height, fps }
//   GET  /api/render/:id        → { status, frame, frames, progress, eta, url, file, bytes, error }
//   GET  /renders/<file>.mp4    finished videos
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { checkRenderTools } from './render-tools.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RENDERS = join(ROOT, 'renders');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.wav': 'audio/wav',
};
const MAX_BODY = 25 * 1024 * 1024; // presets can carry a custom marker image

const jobs = new Map();
let busy = null;

const json = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw new Error('Preset is too large.');
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const slug = (s) => (String(s || 'math-melody').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'math-melody').slice(0, 40);

async function startJob(body) {
  const width = Math.round(+body.width), height = Math.round(+body.height), fps = Math.round(+body.fps);
  if (!(width >= 64 && width <= 7680 && height >= 64 && height <= 7680)) throw new Error('Width and height must be between 64 and 7680.');
  if (![24, 25, 30, 50, 60].includes(fps)) throw new Error('Frame rate must be 24, 25, 30, 50 or 60.');
  if (!body.preset || !Array.isArray(body.preset.layers)) throw new Error('Missing preset.');

  const id = randomUUID().slice(0, 8);
  const file = `${slug(body.preset.name)}-${width}x${height}-${id}.mp4`;
  await mkdir(RENDERS, { recursive: true });
  const presetPath = join(tmpdir(), `mmv-preset-${id}.json`);
  await writeFile(presetPath, JSON.stringify(body.preset));

  const job = { id, status: 'starting', frame: 0, frames: 0, progress: 0, file, url: `renders/${file}`, started: Date.now() };
  jobs.set(id, job);
  busy = id;
  const child = spawn(process.execPath, [join(ROOT, 'scripts/render.mjs'),
    '--preset', presetPath, '--out', join(RENDERS, file),
    '--width', String(width), '--height', String(height), '--fps', String(fps), '--json'], { cwd: ROOT });
  let buf = '', errText = '';
  child.stdout.on('data', (d) => {
    buf += d;
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      try { Object.assign(job, JSON.parse(line)); } catch { /* not a progress line */ }
    }
  });
  child.stderr.on('data', (d) => { errText = (errText + d).slice(-2000); });
  child.on('close', async (code) => {
    busy = null;
    if (code === 0) {
      job.status = 'done';
      job.progress = 1;
      job.bytes = (await stat(join(RENDERS, file)).catch(() => ({ size: 0 }))).size;
    } else {
      job.status = 'error';
      job.error = job.error || errText.trim().split('\n').pop() || `Renderer exited with code ${code}.`;
    }
  });
  return job;
}

async function handleApi(req, res, path) {
  if (path === '/api/health' && req.method === 'GET') return json(res, 200, await checkRenderTools());
  if (path === '/api/render' && req.method === 'POST') {
    if (busy) return json(res, 409, { error: 'Another render is still running. Wait for it to finish.' });
    const tools = await checkRenderTools();
    if (!tools.available) return json(res, 503, { error: tools.reason });
    try {
      const job = await startJob(await readBody(req));
      return json(res, 202, { id: job.id });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }
  const m = /^\/api\/render\/([a-f0-9-]{8})$/.exec(path);
  if (m && req.method === 'GET') {
    const job = jobs.get(m[1]);
    return job ? json(res, 200, job) : json(res, 404, { error: 'No such render.' });
  }
  return json(res, 404, { error: 'Unknown API route.' });
}

export function startServer(port = 5173, host = '127.0.0.1') {
  const server = createServer(async (req, res) => {
    try {
      const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (url.startsWith('/api/')) return await handleApi(req, res, url);
      let file = normalize(join(ROOT, url));
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(body);
    } catch {
      if (!res.headersSent) res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, host, () => ok(server));
  });
}

// Run directly: start the app server.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.argv[2] || process.env.PORT || 5173);
  const server = await startServer(port);
  console.log(`Math-Melody Visualizer → http://localhost:${server.address().port}`);
}
