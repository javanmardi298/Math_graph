/**
 * Video recorder: composites the WebGL frame + overlay (captions, analyzer)
 * onto a 2D canvas, captures it with the synth's audio, and encodes with MediaRecorder.
 */

const CANDIDATES = [
  ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'mp4'],
  ['video/mp4', 'mp4'],
  ['video/webm;codecs=vp9,opus', 'webm'],
  ['video/webm;codecs=vp8,opus', 'webm'],
  ['video/webm', 'webm'],
];

export function pickFormat() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const [mime, ext] of CANDIDATES) if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  return null;
}

export class Recorder {
  constructor() {
    this.active = false;
  }

  /**
   * @param {{source:HTMLCanvasElement, audio:MediaStream|null, fps:number, drawOverlay:(ctx,w,h)=>void}} o
   */
  start({ source, audio, fps, drawOverlay }) {
    const format = pickFormat();
    if (!format) throw new Error('This browser cannot record video (MediaRecorder unavailable). Try Chrome, Edge or Firefox.');
    this.format = format;
    this.source = source;
    this.drawOverlay = drawOverlay;
    this.canvas = document.createElement('canvas');
    this.canvas.width = source.width;
    this.canvas.height = source.height;
    this.ctx = this.canvas.getContext('2d');
    this.composite();

    const stream = this.canvas.captureStream(fps);
    for (const tr of audio?.getAudioTracks() ?? []) stream.addTrack(tr);
    const pixels = source.width * source.height;
    this.chunks = [];
    this.mr = new MediaRecorder(stream, {
      mimeType: format.mime,
      videoBitsPerSecond: Math.round(Math.min(60e6, Math.max(8e6, pixels * fps * 0.12))),
      audioBitsPerSecond: 256000,
    });
    this.mr.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.mr.start(250);
    this.startedAt = performance.now();
    this.active = true;
  }

  /** Call once per rendered frame, right after the WebGL render. */
  composite() {
    if (!this.ctx) return;
    const { width: w, height: h } = this.canvas;
    this.ctx.drawImage(this.source, 0, 0, w, h);
    this.drawOverlay?.(this.ctx, w, h);
  }

  get elapsed() {
    return this.active ? (performance.now() - this.startedAt) / 1000 : 0;
  }

  /** @returns {Promise<{blob:Blob, ext:string}>} */
  stop() {
    return new Promise((resolve) => {
      if (!this.mr) return resolve(null);
      this.mr.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.format.mime.split(';')[0] });
        this.active = false;
        this.ctx = null;
        resolve({ blob, ext: this.format.ext });
      };
      this.mr.stop();
    });
  }
}

/* ----------------------------------------------------------------- saving */

// Inside the claude.ai Artifact viewer, plain <a download> links are blocked; the
// page hands files over through the viewer's `downloads` capability instead (the
// viewer confirms each save). That only accepts some extensions, so other files
// (WAV, MIDI) travel inside a .zip. Everywhere else (localhost) a normal download.
const VIEWER_TYPES = new Set(['gif', 'png', 'jpg', 'jpeg', 'webp', 'mp4', 'webm', 'txt', 'json', 'md', 'csv', 'html', 'svg', 'pdf', 'zip']);
let viewerDownloads;
const notify = { fn: () => {} };

/** Where to report outcomes ("Saved", "Download cancelled"…). */
export function setDownloadNotifier(fn) { notify.fn = fn; }

function viewerSaver() {
  if (viewerDownloads === undefined) {
    viewerDownloads = window.claude?.use ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null);
  }
  return viewerDownloads;
}

function browserDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Save a Blob as a file (works on localhost and inside the Artifact viewer). */
export async function download(blob, filename) {
  const saver = await viewerSaver();
  if (!saver) return browserDownload(blob, filename);
  let name = filename;
  let data = blob;
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (!VIEWER_TYPES.has(ext)) {
    const { makeZip } = await import('./zip.js');
    data = new Blob([makeZip([{ name: filename, data: new Uint8Array(await blob.arrayBuffer()) }])]);
    name = `${filename.replace(/\.[^.]+$/, '')}.zip`;
  }
  try {
    await saver.save({ filename: name, data });
    notify.fn(name === filename ? `Saved ${name}.` : `Saved ${name} (contains ${filename}).`);
  } catch (err) {
    const code = err?.code;
    if (code === 'declined') notify.fn('Download cancelled.');
    else if (code === 'rate_limited') notify.fn('A save prompt is already open. Finish it, then try again.');
    else if (code === 'too_large') notify.fn('This file is too large to save here. Try a lower resolution.');
    else notify.fn(`This view can't save files (${code || 'unavailable'}). Run the app on localhost to download.`);
  }
}
