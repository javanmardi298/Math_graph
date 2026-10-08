// Zero-dependency static server for localhost, plus one helper for video exports.
// Usage: npm start  (or: node scripts/serve.mjs 5173)
//
//   GET  /api/health      → { ffmpeg: bool, version }   can this machine convert videos?
//   POST /api/transcode   body: any video → the same video as H.264 + AAC
//                         (?fps=60 also makes the frame rate constant: fixes live captures)
//
//   Video export with ffmpeg (the browser draws the frames, ffmpeg encodes them, so the
//   browser's own video encoder is never used):
//   POST   /api/render?width=&height=&fps=&quality=   body: the soundtrack (WAV, may be empty) → { id }
//   POST   /api/render/<id>/frames                     body: JPEG frames back to back
//   POST   /api/render/<id>/finish                     → { size } once the MP4 is written
//   GET    /api/render/<id>/file                       → the MP4 (then the job is removed)
//   DELETE /api/render/<id>                            cancel
import { createServer } from 'node:http';
import { readFile, stat, writeFile, rm, mkdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { findFfmpeg } from './render-tools.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.wav': 'audio/wav',
};
const MAX_UPLOAD = 4 * 1024 ** 3; // 4 GB

const json = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

/** Re-encode to H.264 (high quality) + AAC. Video quality is kept by a low CRF. */
export function transcode(input, output, { fps = 0 } = {}) {
  return new Promise((ok, fail) => {
    const ff = findFfmpeg();
    if (!ff) return fail(new Error('ffmpeg was not found.'));
    const p = spawn(ff.path, [
      '-y', '-loglevel', 'error', '-i', input,
      // Constant frame rate: live captures have uneven frame timing, which players show as stutter.
      ...(fps > 0 ? ['-vsync', 'cfr', '-r', String(fps)] : []),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
      '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', output,
    ], { windowsHide: true });
    let err = '';
    p.stderr.on('data', (d) => { err = (err + d).slice(-1500); });
    p.on('error', fail);
    p.on('close', (code) => (code === 0 ? ok() : fail(new Error(err.trim().split('\n').pop() || `ffmpeg exited with ${code}`))));
  });
}

async function handleTranscode(req, res) {
  if (!findFfmpeg()) return json(res, 503, { error: 'ffmpeg was not found on this computer.' });
  const dir = join(tmpdir(), `mmv-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  const input = join(dir, 'in.mp4'), output = join(dir, 'out.mp4');
  try {
    const chunks = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > MAX_UPLOAD) throw new Error('Video is too large.');
      chunks.push(c);
    }
    await writeFile(input, Buffer.concat(chunks));
    const fps = Math.min(120, Math.max(0, Number(new URL(req.url, 'http://x').searchParams.get('fps')) || 0));
    await transcode(input, output, { fps });
    const { size: outSize } = await stat(output);
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': outSize, 'Cache-Control': 'no-store' });
    await new Promise((ok, fail) => createReadStream(output).on('error', fail).on('end', ok).pipe(res));
  } catch (err) {
    if (!res.headersSent) json(res, 500, { error: err.message });
    else res.end();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/* ------------------------------------------------------------ ffmpeg render */

const CRF = { standard: 20, high: 16, max: 12 };
const jobs = new Map(); // id → { dir, ff, out, error, closed:Promise, touched }

async function readBody(req, limit = MAX_UPLOAD) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new Error('Upload is too large.');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

async function removeJob(id) {
  const job = jobs.get(id);
  if (!job) return;
  jobs.delete(id);
  if (job.ff.exitCode === null) job.ff.kill('SIGKILL');
  await rm(job.dir, { recursive: true, force: true }).catch(() => {});
}

// Forget jobs the page abandoned (tab closed mid-export).
setInterval(() => {
  for (const [id, job] of jobs) if (Date.now() - job.touched > 10 * 60_000) removeJob(id);
}, 60_000).unref();

async function handleRender(req, res, url) {
  const ff = findFfmpeg();
  const parts = url.split('/').filter(Boolean); // api, render, id?, action?
  const [, , id, action] = parts;
  if (!id && req.method === 'POST') {
    if (!ff) return json(res, 503, { error: 'ffmpeg was not found on this computer.' });
    const q = new URL(req.url, 'http://x').searchParams;
    const even = (n) => Math.max(2, Math.round(Number(n) / 2) * 2);
    const width = even(q.get('width')), height = even(q.get('height'));
    const fps = Math.min(120, Math.max(1, Number(q.get('fps')) || 30));
    const crf = CRF[q.get('quality')] ?? CRF.high;
    const jobId = randomUUID();
    const dir = join(tmpdir(), `mmv-render-${jobId}`);
    await mkdir(dir, { recursive: true });
    const wav = await readBody(req);
    const audio = join(dir, 'audio.wav'), out = join(dir, 'video.mp4');
    if (wav.length > 44) await writeFile(audio, wav);
    const args = [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', 'pipe:0',
      ...(wav.length > 44 ? ['-i', audio] : []),
      '-map', '0:v:0', ...(wav.length > 44 ? ['-map', '1:a:0'] : []),
      '-vf', `scale=${width}:${height}:flags=lanczos,format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-profile:v', 'high',
      '-g', String(fps * 2), '-r', String(fps),
      ...(wav.length > 44 ? ['-c:a', 'aac', '-b:a', '320k', '-shortest'] : []),
      '-movflags', '+faststart', out,
    ];
    const proc = spawn(ff.path, args, { windowsHide: true });
    const job = { dir, ff: proc, out, error: null, touched: Date.now(), frames: 0 };
    let err = '';
    proc.stderr.on('data', (d) => { err = (err + d).slice(-1500); });
    proc.stdin.on('error', () => {}); // reported through `closed`
    job.closed = new Promise((ok) => {
      proc.on('error', (e) => { job.error = e.message; ok(); });
      proc.on('close', (code) => { if (code !== 0 && !job.error) job.error = err.trim().split('\n').pop() || `ffmpeg exited with ${code}`; ok(); });
    });
    jobs.set(jobId, job);
    return json(res, 200, { id: jobId, ffmpeg: ff.version });
  }
  const job = jobs.get(id);
  if (!job) return json(res, 404, { error: 'This render job is gone (the server restarted?). Start the export again.' });
  job.touched = Date.now();
  if (req.method === 'DELETE') { await removeJob(id); return json(res, 200, { ok: true }); }
  if (action === 'frames' && req.method === 'POST') {
    const body = await readBody(req, 512 * 1024 ** 2);
    if (job.error || job.ff.exitCode !== null) return json(res, 500, { error: job.error || 'ffmpeg stopped early' });
    if (!job.ff.stdin.write(body)) await new Promise((ok) => { job.ff.stdin.once('drain', ok); job.ff.once('close', ok); });
    return json(res, 200, { ok: true });
  }
  if (action === 'finish' && req.method === 'POST') {
    job.ff.stdin.end();
    await job.closed;
    if (job.error) { const e = job.error; await removeJob(id); return json(res, 500, { error: e }); }
    const { size } = await stat(job.out);
    return json(res, 200, { size });
  }
  if (action === 'file' && req.method === 'GET') {
    const { size } = await stat(job.out);
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': size, 'Cache-Control': 'no-store' });
    await new Promise((ok, fail) => createReadStream(job.out).on('error', fail).on('end', ok).pipe(res));
    await removeJob(id);
    return;
  }
  return json(res, 404, { error: 'Unknown render action.' });
}

export function startServer(port = 5173, host = '127.0.0.1') {
  const server = createServer(async (req, res) => {
    try {
      const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (url === '/api/health') {
        const ff = findFfmpeg();
        return json(res, 200, { ffmpeg: !!ff, version: ff?.version || null });
      }
      if (url === '/api/transcode' && req.method === 'POST') return await handleTranscode(req, res);
      if (url === '/api/render' || url.startsWith('/api/render/')) {
        try { return await handleRender(req, res, url); } catch (err) { if (!res.headersSent) return json(res, 500, { error: err.message }); return res.end(); }
      }
      if (url.startsWith('/api/')) return json(res, 404, { error: 'Unknown API route.' });
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
  server.requestTimeout = 0; // long uploads/conversions
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
  const ff = findFfmpeg();
  console.log(ff ? `ffmpeg: ${ff.version}` : 'ffmpeg: not found (install it for the most reliable video export)');
}
