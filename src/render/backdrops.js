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
export const BACKDROPS = { solid: 'Plain colour', stars: 'Stars', nebula: 'Nebula', aurora: 'Aurora', rings: 'Rings', horizon: 'Neon horizon', scanlines: 'Monitor', vignette: 'Pool of light',
  paper: 'Paper (light, for ink)', dusk: 'Dusk', chalk: 'Chalkboard', blueprint: 'Blueprint grid', topo: 'Contour lines', waves: 'Ocean waves', bokeh: 'Bokeh', cosmos: 'Cosmos and a planet', embers: 'Embers' };

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
  } else if (kind === 'paper') {
    for (let i = 0; i < 5; i++) glow(R() * w, R() * h, m * (0.4 + R() * 0.5), A, 0.05 + R() * 0.05);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(90,60,30,${0.02 + R() * 0.05})`; g.fillRect(R() * w, R() * h, 1 + R() * 1.5, 1 + R() * 1.5); }
    g.lineWidth = 1;
    for (let i = 0; i < 40; i++) { const x = R() * w, y = R() * h, a = R() * 6.28, l = m * (0.02 + R() * 0.05); g.strokeStyle = 'rgba(110,80,50,0.05)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  } else if (kind === 'dusk') {
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, css(B)); sky.addColorStop(0.55, css(mix(B, A2, 0.4))); sky.addColorStop(0.78, css(mix(B, A, 0.55))); sky.addColorStop(1, css(mix(B, [0, 0, 0], 0.5)));
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    glow(w / 2, h * 0.74, m * 0.95, A, 0.26);
    for (let i = 0; i < 90; i++) { g.fillStyle = css([255, 255, 255], R() * 0.6 * (1 - Math.min(1, (R() * h) / (h * 0.5)))); g.fillRect(R() * w, R() * h * 0.5, 1.2, 1.2); }
  } else if (kind === 'chalk') {
    for (let i = 0; i < 14; i++) glow(R() * w, R() * h, m * (0.2 + R() * 0.5), [255, 255, 255], 0.025 + R() * 0.03);
    for (let i = 0; i < 700; i++) { g.fillStyle = css([255, 255, 255], R() * 0.06); g.fillRect(R() * w, R() * h, 1 + R() * 3, 1); }
  } else if (kind === 'blueprint') {
    const step = m / 24;
    for (let x = 0; x <= w; x += step) { const major = Math.round(x / step) % 6 === 0; g.strokeStyle = css(A, major ? 0.22 : 0.08); g.lineWidth = major ? 1.6 : 1; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += step) { const major = Math.round(y / step) % 6 === 0; g.strokeStyle = css(A, major ? 0.22 : 0.08); g.lineWidth = major ? 1.6 : 1; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  } else if (kind === 'topo') {
    const cx = [w * 0.3, w * 0.75, w * 0.5], cy = [h * 0.3, h * 0.55, h * 0.85];
    g.lineWidth = Math.max(1, m / 700);
    for (let c = 0; c < 3; c++) for (let i = 1; i < 16; i++) {
      g.strokeStyle = css(A, 0.13 + (i % 5 === 0 ? 0.12 : 0)); g.beginPath();
      for (let a = 0; a <= 64; a++) { const t = (a / 64) * 6.2832, r = i * m * 0.05 * (1 + 0.12 * Math.sin(3 * t + c) + 0.07 * Math.sin(5 * t + i * 0.2)); const x = cx[c] + Math.cos(t) * r, y = cy[c] + Math.sin(t) * r; a ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
  } else if (kind === 'waves') {
    for (let i = 0; i < 9; i++) {
      const y0 = h * (0.45 + i * 0.06), col = mix(B, A, i / 9);
      g.fillStyle = css(col, 0.1 + i * 0.03); g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 6) g.lineTo(x, y0 + Math.sin(x / (m * 0.12) + i * 1.3) * m * 0.018 * (1 + i * 0.2));
      g.lineTo(w, h); g.closePath(); g.fill();
    }
    glow(w / 2, h * 0.38, m * 0.7, A, 0.12);
  } else if (kind === 'bokeh') {
    for (let i = 0; i < 26; i++) { const x = R() * w, y = R() * h, r = m * (0.04 + R() * 0.12), col = i % 3 ? A : A2; g.fillStyle = css(col, 0.04 + R() * 0.07); g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); g.strokeStyle = css(col, 0.1); g.lineWidth = 1.5; g.stroke(); }
  } else if (kind === 'cosmos') {
    for (let i = 0; i < 360; i++) { const s = R() ** 3; g.fillStyle = css([255, 255, 255], 0.2 + s * 0.8); g.beginPath(); g.arc(R() * w, R() * h, (0.4 + s * 1.3) * (m / 760), 0, 6.2832); g.fill(); }
    const px = w * 0.78, py = h * 0.9, pr = m * 0.55;
    const pl = g.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr); pl.addColorStop(0, css(mix(A, B, 0.45), 0.95)); pl.addColorStop(0.6, css(mix(A, B, 0.8), 0.95)); pl.addColorStop(1, css(B, 1));
    g.fillStyle = pl; g.beginPath(); g.arc(px, py, pr, 0, 6.2832); g.fill();
    glow(px, py, pr * 1.4, A2, 0.07);
  } else if (kind === 'embers') {
    glow(w / 2, h, m * 1.1, A, 0.3);
    for (let i = 0; i < 160; i++) { const x = R() * w, y = h - R() ** 1.6 * h, s = R(); g.fillStyle = css(mix(A, [255, 220, 120], s), 0.15 + s * 0.6); g.beginPath(); g.arc(x, y, (0.5 + s * 2) * (m / 700), 0, 6.2832); g.fill(); }
  }
  // every backdrop falls off to the edges, so the drawing reads in the middle (light ones get a warm shade, not black)
  const light = (B[0] + B[1] + B[2]) / 3 > 140;
  const v = g.createRadialGradient(w / 2, h / 2, m * 0.35, w / 2, h / 2, Math.hypot(w, h) / 2);
  v.addColorStop(0, light ? 'rgba(80,50,20,0)' : 'rgba(0,0,0,0)'); v.addColorStop(1, light ? 'rgba(80,50,20,0.28)' : 'rgba(0,0,0,0.5)');
  g.fillStyle = v; g.fillRect(0, 0, w, h);
}
