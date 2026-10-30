/**
 * Painted backgrounds for the 2D / 3D renderer: a canvas the size of the frame, used as the
 * scene background (so it stays put behind a zooming camera, like a studio backdrop).
 * Seeded, so every frame, export and reload paints the same sky.
 *
 *   stars     a deep sky with soft stars
 *   nebula    clouds of colour in the dark
 *   aurora    curtains of light from the top
 *   rings     faint concentric rings, like a radar or a ripple
 *   horizon   a neon floor in perspective, a low sun
 *   scanlines a monitor: scanlines and a vignette
 *   vignette  a plain colour with a pool of light in the middle
 */
export const BACKDROPS = { solid: 'Plain colour', stars: 'Stars', nebula: 'Nebula', aurora: 'Aurora', rings: 'Rings', horizon: 'Neon horizon', scanlines: 'Monitor', vignette: 'Pool of light' };

const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

function rgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const n = m ? parseInt(m[1], 16) : 0x4f6bff;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const css = ([r, g, b], a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const shift = ([r, g, b]) => [b * 0.6 + 40, r * 0.7 + 30, g * 0.8 + 60]; // a neighbouring hue for the second colour

/** Paint a backdrop onto a 2D context of size w × h. `base` = background colour, `accent` = its light. */
export function paintBackdrop(g, kind, w, h, base, accent) {
  const B = rgb(base), A = rgb(accent), A2 = shift(A), R = rng(7919);
  g.fillStyle = css(B); g.fillRect(0, 0, w, h);
  const m = Math.min(w, h);
  const glow = (x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, css(col, a)); gr.addColorStop(1, css(col, 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
  if (kind === 'stars') {
    glow(w * 0.5, h * 0.45, m * 0.9, A, 0.1);
    for (let i = 0; i < 520; i++) {
      const x = R() * w, y = R() * h, s = R() ** 3, r = (0.4 + s * 1.7) * (m / 700);
      g.fillStyle = css(mix([255, 255, 255], A, R() * 0.5), 0.25 + s * 0.75); g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
      if (s > 0.8) glow(x, y, r * 7, A, 0.25);
    }
  } else if (kind === 'nebula') {
    for (let i = 0; i < 9; i++) glow(R() * w, R() * h, m * (0.35 + R() * 0.55), i % 2 ? A : A2, 0.11 + R() * 0.1);
    for (let i = 0; i < 260; i++) { const s = R() ** 3; g.fillStyle = css([255, 255, 255], 0.15 + s * 0.6); g.beginPath(); g.arc(R() * w, R() * h, (0.4 + s) * (m / 800), 0, 6.2832); g.fill(); }
  } else if (kind === 'aurora') {
    for (let band = 0; band < 5; band++) {
      const col = band % 2 ? A : A2, x0 = R() * w, ph = R() * 6;
      for (let y = 0; y < h * 0.8; y += 3) {
        const x = x0 + Math.sin(y / (m * 0.25) + ph) * m * 0.22 + Math.sin(y / (m * 0.07) + ph * 2) * m * 0.03, fade = (1 - y / (h * 0.8)) ** 1.4;
        const gr = g.createLinearGradient(x - m * 0.12, 0, x + m * 0.12, 0); gr.addColorStop(0, css(col, 0)); gr.addColorStop(0.5, css(col, 0.07 * fade)); gr.addColorStop(1, css(col, 0));
        g.fillStyle = gr; g.fillRect(x - m * 0.12, y, m * 0.24, 3);
      }
    }
  } else if (kind === 'rings') {
    glow(w / 2, h / 2, m * 0.7, A, 0.12);
    g.lineWidth = Math.max(1, m / 600);
    for (let i = 1; i < 14; i++) { g.strokeStyle = css(A, 0.2 / (1 + i * 0.25)); g.beginPath(); g.arc(w / 2, h / 2, i * m * 0.075, 0, 6.2832); g.stroke(); }
    g.strokeStyle = css(A, 0.07); g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
  } else if (kind === 'horizon') {
    const hy = h * 0.62;
    const sky = g.createLinearGradient(0, 0, 0, hy); sky.addColorStop(0, css(B)); sky.addColorStop(1, css(mix(B, A2, 0.35))); g.fillStyle = sky; g.fillRect(0, 0, w, hy);
    glow(w / 2, hy, m * 0.8, A2, 0.35);
    g.fillStyle = css(mix(B, [0, 0, 0], 0.4)); g.fillRect(0, hy, w, h - hy);
    g.strokeStyle = css(A, 0.4); g.lineWidth = Math.max(1, m / 500);
    for (let i = -14; i <= 14; i++) { g.beginPath(); g.moveTo(w / 2 + i * m * 0.02, hy); g.lineTo(w / 2 + i * m * 0.34, h); g.stroke(); }
    for (let i = 1; i < 14; i++) { const y = hy + (h - hy) * (i / 14) ** 2; g.strokeStyle = css(A, 0.08 + 0.3 * (i / 14)); g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  } else if (kind === 'scanlines') {
    glow(w / 2, h / 2, m, A, 0.1);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1.5);
  } else if (kind === 'vignette') {
    glow(w / 2, h / 2, m * 0.85, A, 0.2);
  }
  // every backdrop falls off to the edges, so the drawing reads in the middle
  const v = g.createRadialGradient(w / 2, h / 2, m * 0.35, w / 2, h / 2, Math.hypot(w, h) / 2);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
  g.fillStyle = v; g.fillRect(0, 0, w, h);
}
