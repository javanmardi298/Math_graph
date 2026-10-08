/**
 * Frame-perfect video export in the browser (WebCodecs + MP4 muxer).
 *
 * Unlike live recording, nothing here is real-time: every frame is drawn at its
 * exact time and handed straight to the GPU's video encoder, so the result is a
 * constant 30/60 fps MP4 with no dropped or doubled frames, however heavy the scene.
 *
 * Encoders run on the CPU by default (the GPU encoder is opt-in: it crashed some
 * Windows graphics drivers). Codec preference: H.264 + AAC (plays everywhere), then VP9 / Opus as fallback
 * (Chromium builds without proprietary codecs). The caller can ask the local
 * server to convert a fallback file to H.264/AAC with ffmpeg.
 */
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export const QUALITY = { standard: 0.1, high: 0.16, max: 0.26 }; // bits per pixel per frame

export const canRenderVideo = () => typeof window.VideoEncoder === 'function' && typeof window.VideoFrame === 'function';

/** H.264 (high → baseline), then VP9 and AV1. Each is tried on the GPU first, then in software. */
const VIDEO_CODECS = [
  ['avc1.640034', 'avc'], ['avc1.640033', 'avc'], ['avc1.64002A', 'avc'], ['avc1.640028', 'avc'],
  ['avc1.4D0034', 'avc'], ['avc1.4D002A', 'avc'], ['avc1.42E034', 'avc'], ['avc1.42E02A', 'avc'],
  ['vp09.00.51.08', 'vp9'], ['vp09.00.41.08', 'vp9'], ['av01.0.12M.08', 'av1'], ['av01.0.08M.08', 'av1'],
];
const MUX_LABEL = { avc: 'H.264', vp9: 'VP9', av1: 'AV1' };

/** Wait for `promise`, but give up after `ms` (encoders can hang silently). */
function within(promise, ms, what) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${what} timed out`)), ms); }),
  ]);
}

/**
 * Every encoder the browser says it supports, in order of preference: one H.264
 * profile on hardware, then one in software, then VP9, then AV1.
 */
async function videoCandidates(width, height, fps, bitrate, allowGpu) {
  const out = [];
  const seen = new Set();
  // Software (CPU) encoders only, unless the user opts in to the GPU encoder: on some
  // Windows drivers, running the GPU's video encoder next to WebGL crashes the GPU
  // process, and after a few crashes the browser switches WebGL off entirely.
  const accels = allowGpu ? ['prefer-hardware', 'prefer-software'] : ['prefer-software'];
  for (const mux of ['avc', 'vp9', 'av1']) {
    for (const accel of accels) {
      for (const [codec, m] of VIDEO_CODECS) {
        if (m !== mux || seen.has(`${mux}/${accel}`)) continue;
        const config = {
          codec, width, height, bitrate, framerate: fps, hardwareAcceleration: accel, bitrateMode: 'variable',
          ...(mux === 'avc' ? { avc: { format: 'avc' } } : {}),
        };
        try {
          const r = await VideoEncoder.isConfigSupported(config);
          if (r.supported) {
            out.push({ config: r.config, mux, label: `${MUX_LABEL[mux]} · ${accel === 'prefer-hardware' ? 'GPU' : 'software'}` });
            seen.add(`${mux}/${accel}`);
          }
        } catch { /* invalid combination: try the next */ }
      }
    }
  }
  return out;
}

/**
 * "Supported" doesn't always mean "works": some GPU encoders accept the config and
 * then fail or stall. Encode a few real frames and require output before trusting one.
 */
async function probe(candidate, width, height) {
  let chunks = 0, error = null;
  const enc = new VideoEncoder({ output: () => { chunks++; }, error: (e) => { error = e; } });
  try {
    enc.configure(candidate.config);
    const canvas = new OffscreenCanvas(width, height);
    const g = canvas.getContext('2d');
    for (let i = 0; i < 4; i++) {
      g.fillStyle = `rgb(${i * 60},20,40)`;
      g.fillRect(0, 0, width, height);
      const f = new VideoFrame(canvas, { timestamp: i * 33333, duration: 33333 });
      enc.encode(f, { keyFrame: i === 0 });
      f.close();
    }
    await within(enc.flush(), 6000, 'Encoder test');
    return !error && chunks > 0;
  } catch {
    return false;
  } finally {
    if (enc.state !== 'closed') enc.close();
  }
}

/** Remember which encoder worked, so the next export starts without testing. */
const proven = new Map();

async function pickAudioConfig(sampleRate, numberOfChannels) {
  if (typeof window.AudioEncoder !== 'function') return null;
  for (const [codec, mux, bitrate] of [['mp4a.40.2', 'aac', 320000], ['opus', 'opus', 256000]]) {
    const config = { codec, sampleRate, numberOfChannels, bitrate };
    try {
      const r = await AudioEncoder.isConfigSupported(config);
      if (r.supported) return { config: r.config, mux };
    } catch { /* next */ }
  }
  return null;
}

/**
 * Let the page breathe (progress bar, cancel button). A MessageChannel hop, unlike
 * setTimeout, is not throttled when the tab is in the background, so switching tabs
 * doesn't slow the export to a crawl.
 */
const yieldToUi = () => new Promise((r) => {
  const ch = new MessageChannel();
  ch.port1.onmessage = () => r();
  ch.port2.postMessage(0);
});

/**
 * @param {object} o
 * @param {number} o.width @param {number} o.height  even numbers
 * @param {number} o.fps
 * @param {number} o.frames total frame count
 * @param {(i:number)=>CanvasImageSource} o.drawFrame draws frame i and returns the finished canvas
 * @param {AudioBuffer|null} o.audio rendered soundtrack (trimmed to the video length)
 * @param {keyof QUALITY} [o.quality]
 * @param {(p:{frame:number, frames:number, fps:number, eta:number})=>void} [o.onProgress]
 * @param {{cancelled:boolean}} [o.token] set token.cancelled = true to stop
 * @param {(msg:string)=>void} [o.onStatus] which encoder is being tested / used
 * @param {boolean} [o.allowGpu] also try the GPU's hardware video encoder (off by default)
 * @returns {Promise<{blob:Blob, video:string, encoder:string, audio:string|null}>}
 */
export async function renderVideo(opts) {
  const { width, height, fps, quality = 'high', onStatus, allowGpu = false } = opts;
  if (!canRenderVideo()) throw new Error('This browser cannot encode video (WebCodecs missing). Use Chrome or Edge, or Live capture.');
  const bitrate = Math.round(Math.min(100e6, Math.max(6e6, width * height * fps * (QUALITY[quality] || QUALITY.high))));
  const key = `${width}x${height}@${fps}/${bitrate}/${allowGpu}`;
  const candidates = await videoCandidates(width, height, fps, bitrate, allowGpu);
  if (!candidates.length) throw new Error(`No video encoder for ${width}×${height} at ${fps} fps in this browser. Try a lower resolution.`);
  const known = proven.get(key);
  if (known) candidates.sort((a, b) => (a.label === known ? -1 : b.label === known ? 1 : 0));

  const problems = [];
  for (const c of candidates) {
    if (opts.token?.cancelled) throw new Error('cancelled');
    if (c.label !== known) {
      onStatus?.(`Testing encoder: ${c.label}…`);
      if (!(await probe(c, width, height))) { problems.push(`${c.label}: failed the test`); continue; }
    }
    try {
      onStatus?.(`Encoder: ${c.label}`);
      const result = await encodeWith(c, { ...opts, bitrate });
      proven.set(key, c.label);
      return result;
    } catch (err) {
      if (err.message === 'cancelled') throw err;
      proven.delete(key);
      problems.push(`${c.label}: ${err.message}`);
      onStatus?.(`${c.label} stopped (${err.message}). Trying the next encoder…`);
    }
  }
  throw new Error(`No encoder could finish this video (${problems.join('; ')}). Try a lower resolution or Live capture.`);
}

/** Encode the whole video with one encoder. Throws if it errors or stops responding. */
async function encodeWith(v, { width, height, fps, frames, drawFrame, audio, onProgress, token = {} }) {
  const a = audio ? await pickAudioConfig(audio.sampleRate, Math.min(2, audio.numberOfChannels)) : null;

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: v.mux, width, height, frameRate: fps },
    ...(a ? { audio: { codec: a.mux, sampleRate: audio.sampleRate, numberOfChannels: a.config.numberOfChannels } } : {}),
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });

  let failure = null;
  let outputs = 0;
  const venc = new VideoEncoder({
    output: (chunk, meta) => { outputs++; muxer.addVideoChunk(chunk, meta); },
    error: (e) => { failure = e; },
  });
  venc.configure(v.config);
  const dead = () => failure || venc.state === 'closed';
  // Soundtrack first: it is quick and lets the muxer interleave properly.
  if (a) {
    const aenc = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error: (e) => { failure = e; },
    });
    aenc.configure(a.config);
    const rate = audio.sampleRate;
    const total = Math.min(audio.length, Math.round((frames / fps) * rate));
    const ch = a.config.numberOfChannels;
    const chans = [...Array(ch)].map((_, c) => audio.getChannelData(Math.min(c, audio.numberOfChannels - 1)));
    const fade = Math.min(total, Math.round(rate * 0.03)); // avoid a click where the video ends
    const BLOCK = 4096;
    for (let off = 0; off < total; off += BLOCK) {
      const n = Math.min(BLOCK, total - off);
      const planar = new Float32Array(n * ch);
      for (let c = 0; c < ch; c++) {
        const src = chans[c];
        for (let i = 0; i < n; i++) {
          const idx = off + i;
          const g = idx > total - fade ? (total - idx) / fade : 1;
          planar[c * n + i] = src[idx] * g;
        }
      }
      const data = new AudioData({ format: 'f32-planar', sampleRate: rate, numberOfFrames: n, numberOfChannels: ch, timestamp: Math.round((off / rate) * 1e6), data: planar });
      aenc.encode(data);
      data.close();
    }
    await within(aenc.flush(), 30000, 'Audio encoding');
    aenc.close();
  }

  const t0 = performance.now();
  const frameUs = 1e6 / fps;
  const keyEvery = Math.max(1, Math.round(fps * 2));
  for (let i = 0; i < frames; i++) {
    if (token.cancelled) { venc.close(); throw new Error('cancelled'); }
    if (dead()) throw failure || new Error('the encoder closed');
    const canvas = drawFrame(i);
    const frame = new VideoFrame(canvas, { timestamp: Math.round(i * frameUs), duration: Math.round(frameUs) });
    venc.encode(frame, { keyFrame: i % keyEvery === 0 });
    frame.close();
    // Back-pressure: don't let the encoder queue balloon (memory) on slow machines.
    // Watchdog: an encoder that stops taking frames for 8 s has hung; give up on it.
    const waitStart = performance.now();
    while (venc.encodeQueueSize > 6) {
      if (dead()) throw failure || new Error('the encoder closed');
      if (token.cancelled) { venc.close(); throw new Error('cancelled'); }
      if (performance.now() - waitStart > 8000) { venc.close(); throw new Error('the encoder stopped responding'); }
      await new Promise((r) => {
        const t = setTimeout(r, 50);
        if ('ondequeue' in venc) venc.addEventListener('dequeue', () => { clearTimeout(t); r(); }, { once: true });
      });
    }
    if (i % 2 === 0 || i === frames - 1) {
      const done = i + 1;
      const rate = done / ((performance.now() - t0) / 1000);
      onProgress?.({ frame: done, frames, fps: rate, eta: Math.round((frames - done) / rate) });
      await yieldToUi();
    }
  }
  await within(venc.flush(), 30000, 'Finishing the video');
  if (venc.state !== 'closed') venc.close();
  if (failure) throw failure;
  if (!outputs) throw new Error('the encoder produced no video');
  muxer.finalize();
  return {
    blob: new Blob([target.buffer], { type: 'video/mp4' }),
    video: MUX_LABEL[v.mux],
    encoder: v.label,
    audio: a ? (a.mux === 'aac' ? 'AAC' : 'Opus') : null,
  };
}
