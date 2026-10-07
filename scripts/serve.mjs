// Zero-dependency static server for localhost, plus one helper for video exports.
// Usage: npm start  (or: node scripts/serve.mjs 5173)
//
//   GET  /api/health      → { ffmpeg: bool, version }   can this machine convert videos?
//   POST /api/transcode   body: an MP4 (any codecs) → the same video as H.264 + AAC
//
// Videos are rendered in the browser (GPU + hardware encoder). Browsers without an
// H.264/AAC encoder fall back to VP9/Opus; the app then asks this server to convert
// the file with ffmpeg so it plays in every player.
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
export function transcode(input, output) {
  return new Promise((ok, fail) => {
    const ff = findFfmpeg();
    if (!ff) return fail(new Error('ffmpeg was not found.'));
    const p = spawn(ff.path, [
      '-y', '-loglevel', 'error', '-i', input,
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
    await transcode(input, output);
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

export function startServer(port = 5173, host = '127.0.0.1') {
  const server = createServer(async (req, res) => {
    try {
      const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (url === '/api/health') {
        const ff = findFfmpeg();
        return json(res, 200, { ffmpeg: !!ff, version: ff?.version || null });
      }
      if (url === '/api/transcode' && req.method === 'POST') return await handleTranscode(req, res);
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
  console.log(ff ? `ffmpeg: ${ff.version}` : 'ffmpeg: not found (only needed to convert VP9 exports to H.264)');
}
