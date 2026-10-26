/**
 * How alike two recordings sound, as one number: notes (a 12-bin pitch-class profile per
 * frame), loudness over time, and spectral balance. Used to check a transcription by
 * playing it back through the app's own synth and comparing with the original.
 * It is a gauge for choosing between candidates, not a measure of musical truth.
 */
import { decimate, spectrum, mixToMono } from './dsp.js';

const N = 2048, HOP = 1024;
const BANDS = [100, 180, 320, 560, 1000, 1800, 3200, 5600, 9000];

function frames(buffer, seconds) {
  let x = mixToMono(buffer);
  if (seconds) x = x.subarray(0, Math.floor(seconds * buffer.sampleRate));
  const f = Math.max(1, Math.round(buffer.sampleRate / 22050));
  x = decimate(x, f);
  const rate = buffer.sampleRate / f, bin = rate / N;
  const out = [];
  for (let s = 0; s + N <= x.length; s += HOP) {
    const mag = spectrum(x, s, N);
    const chroma = new Float32Array(12);
    for (let k = Math.ceil(65 / bin); k < Math.min(mag.length, Math.floor(2200 / bin)); k++) {
      const m = 69 + 12 * Math.log2((k * bin) / 440);
      chroma[((Math.round(m) % 12) + 12) % 12] += Math.log1p(60 * mag[k]);
    }
    const bands = BANDS.slice(0, -1).map((lo, i) => {
      let e = 0;
      for (let k = Math.ceil(lo / bin); k < Math.min(mag.length, Math.ceil(BANDS[i + 1] / bin)); k++) e += mag[k] * mag[k];
      return Math.log10(e + 1e-6);
    });
    let rms = 0;
    for (let i = 0; i < N; i++) rms += x[s + i] * x[s + i];
    out.push({ chroma, bands, db: 10 * Math.log10(rms / N + 1e-10) });
  }
  return out;
}

const cosine = (a, b) => {
  let p = 0, qa = 0, qb = 0;
  for (let i = 0; i < a.length; i++) { p += a[i] * b[i]; qa += a[i] * a[i]; qb += b[i] * b[i]; }
  return qa && qb ? p / Math.sqrt(qa * qb) : 0;
};
const pearson = (a, b) => {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let p = 0, qa = 0, qb = 0;
  for (let i = 0; i < n; i++) { p += (a[i] - ma) * (b[i] - mb); qa += (a[i] - ma) ** 2; qb += (b[i] - mb) ** 2; }
  return qa && qb ? p / Math.sqrt(qa * qb) : 0;
};

/**
 * @param {AudioBuffer-like} a the original
 * @param {AudioBuffer-like} b the rendering of the transcription
 * @param {{seconds?:number}} [o] compare only the first seconds
 * @returns {{score:number, notes:number, loudness:number, tone:number}} each 0..1
 */
export function compareAudio(a, b, o = {}) {
  const fa = frames(a, o.seconds), fb = frames(b, o.seconds);
  const n = Math.min(fa.length, fb.length);
  if (n < 4) return { score: 0, notes: 0, loudness: 0, tone: 0 };
  const top = Math.max(...fa.slice(0, n).map((f) => f.db));
  // only frames where the original is audible count (silence matches silence trivially)
  const idx = [];
  for (let i = 0; i < n; i++) if (fa[i].db > top - 45) idx.push(i);
  if (idx.length < 4) return { score: 0, notes: 0, loudness: 0, tone: 0 };
  let ch = 0;
  for (const i of idx) ch += cosine(fa[i].chroma, fb[i].chroma);
  ch /= idx.length;
  const da = idx.map((i) => Math.max(fa[i].db, top - 50)), dbb = idx.map((i) => Math.max(fb[i].db, top - 50 - 10));
  const loud = Math.max(0, pearson(da, dbb));
  let tone = 0;
  for (const i of idx) {
    const x = fa[i].bands, y = fb[i].bands;
    const mx = x.reduce((s, v) => s + v, 0) / x.length, my = y.reduce((s, v) => s + v, 0) / y.length;
    tone += Math.max(0, cosine(x.map((v) => v - mx), y.map((v) => v - my)));
  }
  tone /= idx.length;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const notes = clamp((ch - 0.55) / 0.45); // pitch-class profiles of unrelated music still correlate ~0.6
  return { score: clamp(0.5 * notes + 0.3 * loud + 0.2 * tone), notes, loudness: loud, tone: clamp(tone) };
}
