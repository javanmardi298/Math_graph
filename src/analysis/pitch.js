/**
 * Pitch tracking (YIN, de Cheveigné & Kawahara 2002): for every 10 ms, the fundamental
 * frequency of a single melody line, how sure it is, and the loudness. Works on a copy of the
 * audio reduced to about 11 kHz, which is plenty for notes up to ~1.4 kHz and keeps the
 * search quick.
 */
import { decimate, mixToMono, tick } from './dsp.js';

/** Work rate for a highest pitch of fmax: about eight samples per period of the highest note. */
const workRate = (fmax) => Math.min(24000, Math.max(4000, fmax * 8));

/**
 * @param {{numberOfChannels:number, getChannelData:(c:number)=>Float32Array, sampleRate:number}} buffer
 * @param {{fmin?:number, fmax?:number, hop?:number, seconds?:number, threshold?:number}} [o]
 * @param {(p:number)=>void} [onProgress] 0..1
 * @returns {Promise<{hop:number, times:Float32Array, midi:Float32Array, conf:Float32Array, rms:Float32Array, rate:number}>}
 */
export async function trackPitch(buffer, o = {}, onProgress) {
  const { fmin = 55, fmax = 1400, hop: hopSec = 0.01, threshold = 0.16 } = o;
  let mono = mixToMono(buffer);
  if (o.seconds) mono = mono.subarray(0, Math.floor(o.seconds * buffer.sampleRate));
  const factor = Math.max(1, Math.round(buffer.sampleRate / workRate(fmax)));
  const x = decimate(mono, factor);
  const rate = buffer.sampleRate / factor;
  const tauMax = Math.ceil(rate / fmin), tauMin = Math.max(2, Math.floor(rate / fmax));
  const W = Math.max(400, tauMax * 2); // integration window
  const hop = Math.max(1, Math.round(hopSec * rate));
  const frames = Math.max(0, Math.floor((x.length - W - tauMax) / hop));
  const times = new Float32Array(frames), midi = new Float32Array(frames).fill(NaN), conf = new Float32Array(frames), rms = new Float32Array(frames);
  const d = new Float32Array(tauMax + 2);
  const cm = new Float32Array(tauMax + 2);

  for (let f = 0; f < frames; f++) {
    const s = f * hop;
    times[f] = (s + W / 2) / rate;
    let e = 0;
    for (let i = 0; i < W; i++) e += x[s + i] * x[s + i];
    rms[f] = Math.sqrt(e / W);
    if (rms[f] > 1e-4) {
      // difference function
      for (let tau = 1; tau <= tauMax; tau++) {
        let sum = 0;
        for (let j = 0; j < W; j++) { const diff = x[s + j] - x[s + j + tau]; sum += diff * diff; }
        d[tau] = sum;
      }
      // cumulative mean normalised difference
      cm[0] = 1;
      let run = 0;
      for (let tau = 1; tau <= tauMax; tau++) { run += d[tau]; cm[tau] = run > 0 ? (d[tau] * tau) / run : 1; }
      // first dip below the threshold, else the deepest one
      let pick = -1;
      for (let tau = tauMin; tau < tauMax; tau++) {
        if (cm[tau] < threshold) { while (tau + 1 < tauMax && cm[tau + 1] < cm[tau]) tau++; pick = tau; break; }
      }
      if (pick < 0) {
        let best = Infinity;
        for (let tau = tauMin; tau < tauMax; tau++) if (cm[tau] < best) { best = cm[tau]; pick = tau; }
        if (best > 0.45) pick = -1;
      }
      if (pick > 0) {
        // parabolic interpolation around the dip
        const a = cm[pick - 1], b = cm[pick], c = cm[pick + 1];
        const den = a - 2 * b + c;
        const tau = den !== 0 ? pick + (a - c) / (2 * den) : pick;
        midi[f] = 69 + 12 * Math.log2(rate / tau / 440);
        conf[f] = Math.max(0, 1 - cm[pick]);
      }
    }
    if ((f & 255) === 255) { onProgress?.(f / frames); await tick(); }
  }
  onProgress?.(1);
  return { hop: hop / rate, times, midi, conf, rms, rate };
}
