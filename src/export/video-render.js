/**
 * Frame-perfect video export in the browser (WebCodecs + MP4 muxer).
 *
 * Unlike live recording, nothing here is real-time: every frame is drawn at its
 * exact time and handed straight to the GPU's video encoder, so the result is a
 * constant 30/60 fps MP4 with no dropped or doubled frames, however heavy the scene.
 *
 * Codec preference: H.264 + AAC (plays everywhere), then VP9 / Opus as fallback
 * (Chromium builds without proprietary codecs). The caller can ask the local
 * server to convert a fallback file to H.264/AAC with ffmpeg.
 */
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export const QUALITY = { standard: 0.1, high: 0.16, max: 0.26 }; // bits per pixel per frame

export const canRenderVideo = () => typeof window.VideoEncoder === 'function' && typeof window.VideoFrame === 'function';

/** H.264 profiles/levels from highest to lowest, then VP9 and AV1. */
const VIDEO_CODECS = [
  ['avc1.640034', 'avc'], ['avc1.640033', 'avc'], ['avc1.64002A', 'avc'], ['avc1.640028', 'avc'],
  ['avc1.4D0034', 'avc'], ['avc1.4D002A', 'avc'], ['avc1.42E034', 'avc'], ['avc1.42E02A', 'avc'],
  ['vp09.00.51.08', 'vp9'], ['vp09.00.41.08', 'vp9'], ['av01.0.12M.08', 'av1'], ['av01.0.08M.08', 'av1'],
];

async function pickVideoConfig(width, height, fps, bitrate) {
  for (const accel of ['prefer-hardware', 'no-preference']) {
    for (const [codec, mux] of VIDEO_CODECS) {
      const config = {
        codec, width, height, bitrate, framerate: fps,
        hardwareAcceleration: accel, bitrateMode: 'variable', latencyMode: 'quality',
        ...(mux === 'avc' ? { avc: { format: 'avc' } } : {}),
      };
      try {
        const r = await VideoEncoder.isConfigSupported(config);
        if (r.supported) return { config: r.config, mux };
      } catch { /* invalid combination: try the next */ }
    }
  }
  return null;
}

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
 * @returns {Promise<{blob:Blob, video:string, audio:string|null}>}
 */
export async function renderVideo({ width, height, fps, frames, drawFrame, audio, quality = 'high', onProgress, token = {} }) {
  if (!canRenderVideo()) throw new Error('This browser cannot encode video (WebCodecs missing). Use Chrome or Edge, or the live recording.');
  const bitrate = Math.round(Math.min(100e6, Math.max(6e6, width * height * fps * (QUALITY[quality] || QUALITY.high))));
  const v = await pickVideoConfig(width, height, fps, bitrate);
  if (!v) throw new Error(`No video encoder for ${width}×${height} at ${fps} fps in this browser. Try a lower resolution.`);
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
  const venc = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { failure = e; },
  });
  venc.configure(v.config);

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
    await aenc.flush();
    aenc.close();
  }

  const t0 = performance.now();
  const frameUs = 1e6 / fps;
  const keyEvery = Math.max(1, Math.round(fps * 2));
  for (let i = 0; i < frames; i++) {
    if (token.cancelled) { venc.close(); throw new Error('cancelled'); }
    if (failure) throw failure;
    const canvas = drawFrame(i);
    const frame = new VideoFrame(canvas, { timestamp: Math.round(i * frameUs), duration: Math.round(frameUs) });
    venc.encode(frame, { keyFrame: i % keyEvery === 0 });
    frame.close();
    // Back-pressure: don't let the encoder queue balloon (memory) on slow machines.
    while (venc.encodeQueueSize > 6) {
      if ('ondequeue' in venc) await new Promise((r) => venc.addEventListener('dequeue', r, { once: true }));
      else await yieldToUi();
    }
    if (i % 2 === 0 || i === frames - 1) {
      const done = i + 1;
      const rate = done / ((performance.now() - t0) / 1000);
      onProgress?.({ frame: done, frames, fps: rate, eta: Math.round((frames - done) / rate) });
      await yieldToUi();
    }
  }
  await venc.flush();
  venc.close();
  if (failure) throw failure;
  muxer.finalize();
  return {
    blob: new Blob([target.buffer], { type: 'video/mp4' }),
    video: v.mux === 'avc' ? 'H.264' : v.mux.toUpperCase(),
    audio: a ? (a.mux === 'aac' ? 'AAC' : 'Opus') : null,
  };
}
