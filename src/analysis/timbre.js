/**
 * Timbre fingerprint of a played note: how fast it starts and dies away, how strong its
 * overtones are, how bright and how noisy it is. The same numbers are measured on the
 * uploaded recording and on each instrument of the app (precomputed in fingerprints.json by
 * scripts/build-fingerprints.mjs), and the nearest instruments are the candidates.
 */
import { spectrum, median, mixToMono } from './dsp.js';

export const FEATURES = ['attack', 'decay', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'oddEven', 'bright', 'noise'];
/** Typical spread of each feature, so that no single one dominates the distance. */
const SPREAD = [0.55, 14, 9, 9, 9, 9, 9, 9, 7, 0.9, 0.22];

const db = (v) => 20 * Math.log10(v + 1e-9);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Loudness (RMS, 5 ms windows) of x between two times. */
function envelope(x, rate, t0, t1) {
  const w = Math.max(16, Math.round(rate * 0.005));
  const out = [];
  for (let i = Math.max(0, Math.floor(t0 * rate)); i + w <= Math.min(x.length, Math.floor(t1 * rate)); i += w) {
    let s = 0;
    for (let k = 0; k < w; k++) s += x[i + k] * x[i + k];
    out.push(Math.sqrt(s / w));
  }
  return out;
}

/** The feature vector of one note, or null when it is too short to say anything. */
export function noteFeatures(x, rate, note) {
  const dur = note.end - note.start;
  if (dur < 0.08) return null;
  const f0 = 440 * 2 ** ((note.midi - 69) / 12);
  const env = envelope(x, rate, note.start - 0.01, note.end);
  if (env.length < 4) return null;
  const peak = Math.max(...env), pi = env.indexOf(peak);
  if (peak < 1e-5) return null;
  // attack: time to reach 90% of the peak
  let ai = 0;
  while (ai < env.length && env[ai] < 0.9 * peak) ai++;
  const attack = Math.log10(ai * 0.005 + 0.002);
  // decay: dB lost per second between the peak and the end of the note (at most 0.6 s)
  const endI = Math.min(env.length - 1, pi + Math.round(0.6 / 0.005), Math.max(pi + 1, env.length - 4));
  const span = Math.max(0.05, (endI - pi) * 0.005);
  const decay = clamp((db(env[endI]) - db(peak)) / span, -60, 0);

  // spectrum from the middle of the note
  const N = 4096;
  const mid = Math.min(note.start + Math.max(0.04, dur * 0.35), note.end - 0.03);
  const mag = spectrum(x, Math.max(0, Math.round(mid * rate) - N / 2), N);
  const bin = rate / N;
  const peakNear = (f) => {
    const lo = Math.max(1, Math.floor((f * 0.97) / bin)), hi = Math.min(mag.length - 1, Math.ceil((f * 1.03) / bin));
    let m = 0;
    for (let k = lo; k <= hi; k++) m = Math.max(m, mag[k]);
    return m;
  };
  const h = [];
  for (let k = 1; k <= 8; k++) h.push(f0 * k < rate / 2 - 500 ? peakNear(f0 * k) : 0);
  if (h[0] <= 0) return null;
  const rel = (k) => clamp(db(h[k - 1]) - db(h[0]), -45, 12);
  const odd = (h[2] + h[4] + h[6]) / 3, even = (h[1] + h[3] + h[5]) / 3;
  const oddEven = clamp(db(odd) - db(even), -20, 20);
  // brightness: spectral centroid in units of f0; noise: energy not near a harmonic
  let num = 0, den = 0, harmE = 0, totE = 0;
  const top = Math.min(mag.length, Math.floor(6000 / bin));
  for (let k = 1; k < top; k++) {
    const e = mag[k] * mag[k], f = k * bin;
    num += f * mag[k]; den += mag[k]; totE += e;
    const near = Math.round(f / f0);
    if (near >= 1 && Math.abs(f - near * f0) < f0 * 0.04) harmE += e;
  }
  const bright = Math.log2(Math.max(1, num / (den || 1) / f0));
  const noise = clamp(1 - harmE / (totE || 1), 0, 1);
  return [attack, decay, rel(2), rel(3), rel(4), rel(5), rel(6), rel(7), oddEven, bright, noise];
}

/**
 * The typical fingerprint of a recording: the median over its clearest notes.
 * @param {Float32Array} x mono signal
 * @param {{start:number,end:number,midi:number}[]} notes
 * @returns {number[]|null}
 */
export function describeTimbre(x, rate, notes) {
  const pool = notes.filter((n) => n.end - n.start >= 0.12).sort((a, b) => (b.end - b.start) * (b.vel ?? 1) - (a.end - a.start) * (a.vel ?? 1)).slice(0, 14);
  const vecs = pool.map((n) => noteFeatures(x, rate, n)).filter(Boolean);
  if (!vecs.length) return null;
  return FEATURES.map((_, i) => median(vecs.map((v) => v[i])));
}

/** Distance between two fingerprints (smaller = more alike). */
export function timbreDistance(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += ((a[i] - b[i]) / SPREAD[i]) ** 2;
  return Math.sqrt(s / a.length);
}

/**
 * Closest instruments.
 * @param {number[]} vec fingerprint of the recording
 * @param {{id:string, vec:number[], chord?:boolean}[]} bank
 * @returns {{id:string, distance:number}[]} nearest first
 */
export function nearestInstruments(vec, bank, count = 6) {
  return bank.filter((b) => !b.chord).map((b) => ({ id: b.id, distance: timbreDistance(vec, b.vec) }))
    .sort((p, q) => p.distance - q.distance).slice(0, count);
}

export { mixToMono };
