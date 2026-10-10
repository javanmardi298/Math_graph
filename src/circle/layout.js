/**
 * Where a Circle Lab simulation lives on the frame, and how fast its clock runs.
 *
 * The "band" is the part of the frame no platform UI covers: on vertical Shorts it
 * starts under the on-screen title and ends above the channel name / caption area,
 * and leaves a margin at the sides. Simulations use all of it (tall boxes, towers,
 * full-height scenes); the background decoration still fills the whole frame.
 *
 * World units: the band's shorter half-side is 1, so the unit circle always fits and
 * a tall band is `hh` > 1 units high. Everything is pure, so sim, view and the offline
 * soundtrack agree.
 */

/** Band in fractions of the frame for a width/height ratio. */
export function bandFor(ratio) {
  if (ratio < 0.9) return { x0: 0.06, x1: 0.94, y0: 0.165, y1: 0.76 }; // 9:16, 4:5: Shorts title above, caption below
  if (ratio < 1.2) return { x0: 0.06, x1: 0.94, y0: 0.2, y1: 0.95 };
  return { x0: 0.05, x1: 0.95, y0: 0.2, y1: 0.95 };
}

/** Half width / half height of the world for a frame ratio (rounded: preview and export sizes agree). */
export function worldFor(ratio) {
  const b = bandFor(ratio);
  const bw = (b.x1 - b.x0) * ratio, bh = b.y1 - b.y0; // in units of frame height
  const unit = Math.min(bw, bh) / 2;
  const q = (v) => Math.round(v * 100) / 100;
  return { hw: q(bw / 2 / unit), hh: q(bh / 2 / unit) };
}

/** Pixel mapping of the world on a w × h frame (zoom ≥ 1 crops, < 1 leaves more margin). */
export function pixelFrame(w, h, zoom = 1) {
  const b = bandFor(w / h);
  const bw = (b.x1 - b.x0) * w, bh = (b.y1 - b.y0) * h;
  const R = (Math.min(bw, bh) / 2) * zoom;
  return { w, h, k: Math.min(w, h) / 1000, R, cx: ((b.x0 + b.x1) / 2) * w, cy: ((b.y0 + b.y1) / 2) * h, band: { x: b.x0 * w, y: b.y0 * h, w: bw, h: bh } };
}

/* ------------------------------------------------------------ speed curve */

export const SPEED_CURVES = {
  linear: 'Steady change',
  smooth: 'Smooth (ease in & out)',
  build: 'Slow start, fast finish',
  late: 'Change only near the end',
  early: 'Change at the start',
  wave: 'Wave (back and forth every 8 beats)',
  steps: 'Steps (every 4 beats)',
};

const clamp01 = (x) => Math.min(1, Math.max(0, x));

/**
 * Simulation speed at real time t: from → to along the curve, times an optional beat pulse
 * (a surge on every beat that decays, so motion "breathes" with the music).
 */
export function speedAt(sp, t, duration = 30, bpm = 120) {
  if (!sp) return 1;
  const from = sp.from ?? 1, to = sp.to ?? from;
  const k = clamp01(t / Math.max(0.1, duration));
  const beat = (t * bpm) / 60;
  let m;
  switch (sp.curve) {
    case 'smooth': m = k * k * (3 - 2 * k); break;
    case 'build': m = k * k * k; break;
    case 'late': m = clamp01((k - 0.75) / 0.25) ** 2; break;
    case 'early': m = 1 - (1 - clamp01(k / 0.25)) ** 2; break;
    case 'wave': m = 0.5 - 0.5 * Math.cos((beat / 8) * Math.PI * 2); break;
    case 'steps': m = Math.min(1, Math.floor(beat / 4) / Math.max(1, Math.floor(((duration * bpm) / 60) / 4) - 1)); break;
    default: m = k;
  }
  let v = from + (to - from) * m;
  if (sp.pulse) v *= 1 + sp.pulse * Math.exp(-(beat - Math.floor(beat)) * 7);
  return Math.max(0, v);
}
