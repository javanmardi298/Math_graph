/**
 * AnalyserNode look-alike for an AudioBuffer. Server renders have no live audio,
 * so the analyzer overlay is computed from the offline WAV: same FFT size,
 * Blackman window, dB range and smoothing as the browser's AnalyserNode.
 */
const FFT = 2048;
const MIN_DB = -100, MAX_DB = -30, SMOOTH = 0.78;

/** In-place iterative radix-2 FFT. */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}

export class BufferAnalyser {
  /** @param {AudioBuffer} buffer */
  constructor(buffer) {
    this.rate = buffer.sampleRate;
    const L = buffer.getChannelData(0);
    const R = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : L;
    this.mono = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) this.mono[i] = (L[i] + R[i]) / 2;
    this.window = new Float32Array(FFT);
    for (let i = 0; i < FFT; i++) {
      const x = i / FFT;
      this.window[i] = 0.42 - 0.5 * Math.cos(2 * Math.PI * x) + 0.08 * Math.cos(4 * Math.PI * x);
    }
    this.smoothed = new Float32Array(FFT / 2);
    this.spectrum = new Uint8Array(FFT / 2);
    this.waveform = new Uint8Array(FFT);
  }

  /** Update analysis for the audio that ends at `time` seconds. */
  at(time) {
    const end = Math.floor(time * this.rate);
    const re = new Float32Array(FFT), im = new Float32Array(FFT);
    for (let i = 0; i < FFT; i++) {
      const s = this.mono[end - FFT + i] || 0;
      re[i] = s * this.window[i];
      this.waveform[i] = Math.max(0, Math.min(255, Math.round(128 + s * 128)));
    }
    fft(re, im);
    for (let k = 0; k < FFT / 2; k++) {
      const mag = Math.hypot(re[k], im[k]) / FFT;
      this.smoothed[k] = SMOOTH * this.smoothed[k] + (1 - SMOOTH) * mag;
      const db = 20 * Math.log10(this.smoothed[k] || 1e-12);
      this.spectrum[k] = Math.max(0, Math.min(255, Math.round(((db - MIN_DB) / (MAX_DB - MIN_DB)) * 255)));
    }
    return { spectrum: this.spectrum, waveform: this.waveform };
  }
}
