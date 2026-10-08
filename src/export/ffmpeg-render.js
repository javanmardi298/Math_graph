/**
 * Video export through the local server's ffmpeg (npm start + ffmpeg installed).
 *
 * The browser only draws the frames; each one goes to the server as a JPEG and
 * ffmpeg (x264) builds the MP4. The browser's video encoder is never used, so the
 * graphics driver problems it can trigger don't apply, and the result is a
 * constant-frame-rate H.264 + AAC MP4 that every player can seek in.
 */
import { audioBufferToWav } from './wav.js';

const JPEG_QUALITY = { standard: 0.9, high: 0.95, max: 0.98 };
const BATCH_BYTES = 6 * 1024 * 1024;

let health;

/** { ffmpeg, version } when the page runs on the local server with ffmpeg, else null. */
export function ffmpegServer() {
  if (health) return health;
  if (!/^https?:$/.test(location.protocol) || window.claude) return (health = Promise.resolve(null));
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 2500);
  health = fetch('api/health', { signal: ctl.signal, cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j?.ffmpeg ? j : null))
    .catch(() => null)
    .finally(() => clearTimeout(timer));
  // ffmpeg may be installed while the page is open: don't cache a "no".
  health.then((v) => { if (!v) health = null; });
  return health;
}

async function call(url, opts = {}) {
  const r = await fetch(url, { cache: 'no-store', ...opts });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `server answered ${r.status}`);
  return r;
}

const toJpeg = (canvas, q) => new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('could not read the frame'))), 'image/jpeg', q));

/**
 * @param {object} o
 * @param {number} o.width @param {number} o.height @param {number} o.fps @param {number} o.frames
 * @param {(i:number)=>HTMLCanvasElement} o.drawFrame
 * @param {AudioBuffer|null} o.audio
 * @param {'standard'|'high'|'max'} [o.quality]
 * @param {{cancelled:boolean}} [o.token]
 * @param {(p:{frame:number, frames:number, fps:number, eta:number})=>void} [o.onProgress]
 * @param {(msg:string)=>void} [o.onStatus]
 * @returns {Promise<{blob:Blob, encoder:string}>}
 */
export async function renderWithFfmpeg({ width, height, fps, frames, drawFrame, audio, quality = 'high', token = {}, onProgress, onStatus }) {
  let wav = null;
  if (audio) {
    // Trim the soundtrack to the video so the MP4 ends with the last frame.
    const keep = Math.min(audio.length, Math.round((frames / fps) * audio.sampleRate));
    const trimmed = new AudioBuffer({ length: Math.max(1, keep), numberOfChannels: audio.numberOfChannels, sampleRate: audio.sampleRate });
    for (let c = 0; c < audio.numberOfChannels; c++) trimmed.copyToChannel(audio.getChannelData(c).subarray(0, keep), c);
    wav = audioBufferToWav(trimmed);
  }
  const q = new URLSearchParams({ width, height, fps, quality });
  const { id, ffmpeg } = await (await call(`api/render?${q}`, { method: 'POST', body: wav || new Blob([]) })).json();
  const base = `api/render/${id}`;
  onStatus?.(`Encoder: ffmpeg (x264) on this computer${ffmpeg ? ` · ${ffmpeg.split(' ').slice(0, 3).join(' ')}` : ''}`);
  const jq = JPEG_QUALITY[quality] || JPEG_QUALITY.high;
  let batch = [], batchBytes = 0, inFlight = null;
  const send = async () => {
    if (!batch.length) return;
    const body = new Blob(batch, { type: 'application/octet-stream' });
    batch = []; batchBytes = 0;
    await inFlight; // one upload at a time, while the next frames are drawn
    inFlight = call(`${base}/frames`, { method: 'POST', body });
    inFlight.catch(() => {}); // surfaced by the next await
  };
  try {
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) {
      if (token.cancelled) throw new Error('cancelled');
      const jpeg = await toJpeg(drawFrame(i), jq);
      batch.push(jpeg);
      batchBytes += jpeg.size;
      if (batchBytes >= BATCH_BYTES || batch.length >= 12) await send();
      const done = i + 1;
      const rate = done / ((performance.now() - t0) / 1000);
      onProgress?.({ frame: done, frames, fps: rate, eta: Math.round((frames - done) / rate) });
    }
    await send();
    await inFlight;
    if (token.cancelled) throw new Error('cancelled');
    onStatus?.('ffmpeg is finishing the MP4…');
    await call(`${base}/finish`, { method: 'POST' });
    const blob = await (await call(`${base}/file`)).blob();
    return { blob: new Blob([blob], { type: 'video/mp4' }), encoder: 'H.264 (ffmpeg x264) + AAC' };
  } catch (err) {
    fetch(base, { method: 'DELETE' }).catch(() => {});
    throw err;
  }
}
