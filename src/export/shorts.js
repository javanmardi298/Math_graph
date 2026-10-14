/**
 * Shorts packaging for exported videos: a hook for the first ~2 seconds and a clean
 * ending, the two places short-form viewers decide to stay or swipe.
 *
 *   [teaser] the finished picture, slowly zooming, with a big hook line (a question or
 *            claim, readable with the sound off) and a rising whoosh
 *   [cut]    white flash + boom, then the drawing starts from zero (pattern interrupt)
 *   [main]   the timeline as usual; the hook line stays up to ~2 s in total
 *   [outro]  the last frame fades to black and the sound fades out, so the video
 *            doesn't stop abruptly (and a replay starts from a calm frame)
 *
 * Or a seamless loop (record.loop): no teaser and no fade. The video starts B seconds in
 * and its last B seconds dissolve into its own first frame while the sound crossfades
 * into the timeline's first B seconds, so when Shorts replays it there is no visible or
 * audible seam: more rewatches.
 *
 * Everything here is pure (no DOM besides the canvas passed in), so the same timing
 * drives the browser export, the ffmpeg export, batches and the command-line render.
 */

/**
 * Seconds of each part for a timeline of `timeline` seconds played at `speed` (the video's
 * main part lasts timeline / speed; `duration` below is that length in video seconds, and
 * `tlDuration` the timeline length that `mapVideoTime` maps it to).
 */
export function shortsTiming(record, timeline, { teaserAt, speed = 1, warp = null } = {}) {
  const sp = Math.min(5, Math.max(0.1, speed || 1));
  const duration = warp ? warp.total : timeline / sp; // a speed track makes the main part longer or shorter
  if (record.loop) {
    const B = Math.max(0.2, Math.min(3, record.loopBlend ?? 0.8, duration / 3));
    return { on: false, teaser: 0, outro: 0, duration, tlDuration: timeline, speed: sp, warp, loop: B, teaserAt: 0, total: Math.round((duration - B) * 1e6) / 1e6, hookEnd: 0, flash: false, impact: false };
  }
  const hook = record.hook || {};
  const on = hook.enabled !== false;
  const teaser = on ? Math.max(0, Math.min(3, hook.teaser ?? 0.8)) : 0;
  const outro = Math.max(0, Math.min(3, record.outro ?? 0.6));
  return {
    on, teaser, outro, duration, tlDuration: timeline, speed: sp, warp,
    teaserAt: teaserAt ?? Math.max(0, timeline - 1e-3), // which timeline moment the teaser shows (default: the finished picture)
    total: Math.round((teaser + duration + outro) * 1e6) / 1e6,
    hookEnd: on ? Math.max(2, teaser + 1.4) : 0, // the hook line stays this long (video time)
    flash: on && hook.flash !== false,
    impact: on && hook.impact !== false,
  };
}

/**
 * Where video time `vt` falls. `time` is the timeline time to draw.
 * @returns {{phase:'teaser'|'main'|'outro', time:number, k:number}} k = progress inside the phase (0..1)
 */
export function mapVideoTime(T, vt) {
  const sp = T.speed || 1, tl = T.tlDuration ?? T.duration;
  const tlOf = (r) => (T.warp ? T.warp.timeline(r) : r * sp);
  if (T.loop) return { phase: 'main', time: Math.min(tl, tlOf(vt + T.loop)), k: vt / T.total };
  if (vt < T.teaser) return { phase: 'teaser', time: T.teaserAt ?? Math.max(0, tl - 1e-3), k: vt / T.teaser };
  const t = vt - T.teaser;
  if (t < T.duration) return { phase: 'main', time: tlOf(t), k: t / T.duration };
  return { phase: 'outro', time: tl, k: T.outro ? Math.min(1, (t - T.duration) / T.outro) : 1 };
}

/** The hook line: the preset's own, else its YouTube title without hashtags, else its name. */
export function hookTextFor(state) {
  const own = (state.hook?.text || '').trim();
  if (own) return own;
  const title = (state.youtube?.title || '').replace(/#[\p{L}\p{N}_]+/gu, '').replace(/\s+/g, ' ').trim();
  return title || state.name || '';
}

const easeOutBack = (x) => { const c = 1.6; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** Split text into lines that fit `maxW` with the current font. */
function wrap(g, text, maxW) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width > maxW && line) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Draw the hook line: big, bold, high-contrast, popping in and fading out.
 * @param {number} vt video time, @param {number} end when it is gone
 */
export function drawHook(g, w, h, text, vt, end, font) {
  if (!text || vt >= end) return;
  const k = Math.min(w, h) / 1000;
  const pop = easeOutBack(clamp01(vt / 0.28));
  const alpha = clamp01(vt / 0.12) * clamp01((end - vt) / 0.3);
  if (alpha <= 0) return;
  const size = 74 * k;
  g.save();
  g.font = `800 ${size}px ${font}`;
  const rtl = /[֐-ࣿיִ-ﻼ]/.test(text);
  g.direction = rtl ? 'rtl' : 'ltr';
  const lines = wrap(g, text, w * 0.8).slice(0, 4);
  const lh = size * 1.12;
  const cx = w / 2, cy = h * 0.4;
  g.translate(cx, cy);
  g.scale(pop, pop);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.globalAlpha = alpha;
  g.lineJoin = 'round';
  lines.forEach((ln, i) => {
    const y = (i - (lines.length - 1) / 2) * lh;
    g.lineWidth = size * 0.16;
    g.strokeStyle = 'rgba(0,0,0,0.85)';
    g.strokeText(ln, 0, y);
    g.shadowColor = 'rgba(255,255,255,0.35)';
    g.shadowBlur = size * 0.35;
    g.fillStyle = '#ffffff';
    g.fillText(ln, 0, y);
    g.shadowBlur = 0;
  });
  g.restore();
}

/** Whole-frame effects: teaser zoom, cut flash, start punch-in, outro fade. */
export function frameEffects(T, vt) {
  const m = mapVideoTime(T, vt);
  let scale = 1, flash = 0, black = 0;
  // loop: how much of the first frame shows (0 → 1 over the last B seconds)
  const loopMix = T.loop ? clamp01((vt - (T.total - T.loop)) / T.loop) : 0;
  if (T.loop) return { scale, flash, black, loopMix };
  if (m.phase === 'teaser') scale = 1.16 - 0.12 * (1 - (1 - m.k) ** 2); // slow push-out
  if (T.on && m.phase === 'main') {
    const since = vt - T.teaser;
    if (T.flash && since < 0.22) flash = 0.85 * (1 - since / 0.22) ** 2;
    if (since < 0.5) scale = 1 + 0.1 * (1 - since / 0.5) ** 3; // punch-in at the cut
  }
  if (m.phase === 'outro') black = clamp01(m.k / 0.55);
  return { scale, flash, black, loopMix: 0 };
}

/* ------------------------------------------------------------------ sound */

/** Deterministic noise, so every export of the same preset sounds the same. */
function noiseGen(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2147483648 - 1; };
}

/**
 * The final soundtrack: [teaser whoosh] + boom at the cut + the timeline audio, then a
 * fade-out over the outro. `main` is the rendered timeline (it may carry a reverb tail).
 * @param {AudioBuffer} main
 * @returns {AudioBuffer}
 */
export function shortsAudio(main, T) {
  if (T.loop) return loopAudio(main, T);
  const sr = main.sampleRate;
  const total = Math.ceil(T.total * sr);
  const out = new AudioBuffer({ length: Math.max(1, total), numberOfChannels: 2, sampleRate: sr });
  const off = Math.round(T.teaser * sr);
  const end = Math.round((T.teaser + T.duration) * sr);
  for (let c = 0; c < 2; c++) {
    const src = main.getChannelData(Math.min(c, main.numberOfChannels - 1));
    const dst = out.getChannelData(c);
    const n = Math.min(src.length, total - off);
    dst.set(src.subarray(0, n), off);
    // Outro: smooth fade to silence
    for (let i = end; i < total; i++) {
      const k = (i - end) / Math.max(1, total - end);
      dst[i] *= Math.cos(k * Math.PI / 2) ** 2;
    }
  }
  if (T.impact) {
    const L = out.getChannelData(0), R = out.getChannelData(1);
    const rnd = noiseGen(7);
    // Whoosh: filtered noise that rises into the cut
    if (off > 0) {
      let lp = 0;
      for (let i = 0; i < off; i++) {
        const k = i / off;
        const cutoff = 0.01 + 0.25 * k * k; // one-pole coefficient: opens up as it rises
        lp += cutoff * (rnd() - lp);
        const v = lp * 0.9 * k ** 2.2;
        L[i] += v; R[i] += v * 0.92;
      }
    }
    // Boom: a deep pitch-dropping sine with a click on top
    const len = Math.min(total - off, Math.round(1.2 * sr));
    let phase = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const f = 38 + 90 * Math.exp(-t * 9);
      phase += (2 * Math.PI * f) / sr;
      const v = Math.sin(phase) * Math.exp(-t * 3.2) * 0.75 + (i < sr * 0.004 ? rnd() * 0.5 * (1 - i / (sr * 0.004)) : 0);
      L[off + i] += v; R[off + i] += v;
    }
    // Keep the sum below full scale
    for (const d of [L, R]) for (let i = 0; i < Math.min(total, off + len); i++) d[i] = Math.tanh(d[i] * 1.1) / 1.1;
  }
  return out;
}

/**
 * Seamless loop: timeline audio from B seconds on; over the last B seconds it crossfades
 * (equal power) into the timeline's first B seconds, which lead straight into the
 * video's first sample. Replayed, the sound never jumps.
 */
export function loopAudio(main, T) {
  const sr = main.sampleRate, B = Math.round(T.loop * sr), total = Math.max(1, Math.round(T.total * sr));
  const out = new AudioBuffer({ length: total, numberOfChannels: 2, sampleRate: sr });
  for (let c = 0; c < 2; c++) {
    const src = main.getChannelData(Math.min(c, main.numberOfChannels - 1)), dst = out.getChannelData(c);
    const at = (i) => (i >= 0 && i < src.length ? src[i] : 0);
    for (let i = 0; i < total; i++) {
      const t = i + B; // timeline sample
      const j = i - (total - B); // position in the crossfade
      if (j < 0) { dst[i] = at(t); continue; }
      const w = j / B;
      dst[i] = at(t) * Math.cos((w * Math.PI) / 2) + at(j) * Math.sin((w * Math.PI) / 2);
    }
  }
  return out;
}
