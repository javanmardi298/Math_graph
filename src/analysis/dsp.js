/** Small signal helpers shared by the audio analysis (pure functions, no browser APIs). */

/** Average the channels of an AudioBuffer-like object into one Float32Array. */
export function mixToMono(buffer) {
  const n = buffer.numberOfChannels;
  const first = buffer.getChannelData(0);
  if (n === 1) return Float32Array.from(first);
  const out = new Float32Array(first.length);
  for (let c = 0; c < n; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += d[i] / n;
  }
  return out;
}

/** Keep every `factor`-th sample after averaging `factor` neighbours (a cheap low-pass). */
export function decimate(x, factor) {
  if (factor <= 1) return x;
  const out = new Float32Array(Math.floor(x.length / factor));
  for (let i = 0; i < out.length; i++) {
    let s = 0;
    for (let k = 0; k < factor; k++) s += x[i * factor + k];
    out[i] = s / factor;
  }
  return out;
}

/** In-place radix-2 FFT (length must be a power of two). */
export function fft(re, im) {
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

const windows = new Map();
export function hann(n) {
  let w = windows.get(n);
  if (!w) { w = Float32Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))); windows.set(n, w); }
  return w;
}

/** Magnitude spectrum (n/2 bins) of x[start .. start+n), Hann-windowed; samples past the end count as silence. */
export function spectrum(x, start, n) {
  const re = new Float32Array(n), im = new Float32Array(n), w = hann(n);
  for (let i = 0; i < n; i++) { const v = x[start + i]; re[i] = v === undefined ? 0 : v * w[i]; }
  fft(re, im);
  const mag = new Float32Array(n / 2);
  for (let i = 0; i < mag.length; i++) mag[i] = Math.hypot(re[i], im[i]);
  return mag;
}

export const median = (a) => {
  if (!a.length) return NaN;
  const s = Array.from(a).sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const percentile = (a, p) => {
  if (!a.length) return 0;
  const s = Array.from(a).sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))];
};

/** Let the page breathe between slices of a long job. */
export const tick = () => new Promise((r) => setTimeout(r, 0));
