/**
 * Small vector drawings for Circle Lab scenes (no emoji fonts, so videos look the same
 * everywhere): scissors, rock, paper, lizard, Spock hand, flower, bubble, needle, knife,
 * balloon. Each draws centred on (x, y) with size s (pixels) and rotation a.
 */
const TAU = Math.PI * 2;
const rrect = (g, x, y, w, h, r) => (g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h));

/** Scissors, blades towards +x, `open` = half-angle between the blades. */
export function drawScissors(g, x, y, ang, size, open, color) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  const blade = (s) => {
    g.save();
    g.rotate(s * open);
    const bg = g.createLinearGradient(0, -size * 0.12, 0, size * 0.12);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.5, '#c9d3e3'); bg.addColorStop(1, '#8794ad');
    g.fillStyle = bg;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(size * 0.5, -s * size * 0.14, size * 1.05, -s * size * 0.015);
    g.lineTo(size * 1.05, s * size * 0.01);
    g.quadraticCurveTo(size * 0.5, s * size * 0.02, 0, s * size * 0.05);
    g.closePath(); g.fill();
    g.strokeStyle = color; g.lineWidth = size * 0.09;
    g.beginPath(); g.ellipse(-size * 0.42, s * size * 0.2, size * 0.24, size * 0.15, s * 0.5, 0, TAU); g.stroke();
    g.beginPath(); g.moveTo(-size * 0.06, s * size * 0.03); g.lineTo(-size * 0.22, s * size * 0.14); g.stroke();
    g.restore();
  };
  g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = size * 0.2;
  blade(1); blade(-1);
  g.shadowBlur = 0;
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(0, 0, size * 0.045, 0, TAU); g.fill();
  g.restore();
}

/** A rough rock; `seed` keeps each rock's outline. */
export function drawRock(g, x, y, a, s, color, seed = 1) {
  g.save(); g.translate(x, y); g.rotate(a);
  g.beginPath();
  for (let i = 0; i < 9; i++) {
    const t = (i / 9) * TAU, j = 0.78 + 0.22 * Math.abs(Math.sin(seed * 7.13 + i * 2.7));
    const px = Math.cos(t) * s * 0.5 * j * 1.1, py = Math.sin(t) * s * 0.42 * j;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath();
  const gr = g.createLinearGradient(-s * 0.4, -s * 0.4, s * 0.4, s * 0.4);
  gr.addColorStop(0, '#c9ced6'); gr.addColorStop(1, '#4e555f');
  g.fillStyle = gr; g.fill();
  g.strokeStyle = color; g.lineWidth = s * 0.08; g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath(); g.ellipse(-s * 0.14, -s * 0.12, s * 0.12, s * 0.06, -0.5, 0, TAU); g.fill();
  g.restore();
}

/** A sheet of paper with a folded corner and lines. */
export function drawPaper(g, x, y, a, s, color) {
  g.save(); g.translate(x, y); g.rotate(a);
  const w = s * 0.72, h = s * 0.92, f = s * 0.22;
  g.beginPath();
  g.moveTo(-w / 2, -h / 2); g.lineTo(w / 2 - f, -h / 2); g.lineTo(w / 2, -h / 2 + f); g.lineTo(w / 2, h / 2); g.lineTo(-w / 2, h / 2); g.closePath();
  g.fillStyle = '#f6f3ec'; g.fill();
  g.strokeStyle = color; g.lineWidth = s * 0.07; g.stroke();
  g.fillStyle = '#d9d3c4';
  g.beginPath(); g.moveTo(w / 2 - f, -h / 2); g.lineTo(w / 2 - f, -h / 2 + f); g.lineTo(w / 2, -h / 2 + f); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(80,110,160,0.55)'; g.lineWidth = s * 0.035;
  for (let i = 0; i < 4; i++) { const yy = -h / 2 + f * 1.4 + i * h * 0.16; g.beginPath(); g.moveTo(-w * 0.32, yy); g.lineTo(w * 0.32, yy); g.stroke(); }
  g.restore();
}

/** A lizard seen from above. */
export function drawLizard(g, x, y, a, s, color, time = 0) {
  g.save(); g.translate(x, y); g.rotate(a);
  const wig = Math.sin(time * 9) * 0.25;
  g.strokeStyle = '#3fd36b'; g.lineCap = 'round';
  g.lineWidth = s * 0.08;
  for (const [px, sy] of [[0.12, 1], [0.12, -1], [-0.15, 1], [-0.15, -1]]) { g.beginPath(); g.moveTo(px * s, 0); g.lineTo((px + 0.08) * s, sy * s * (0.28 + wig * sy * 0.2)); g.stroke(); }
  g.lineWidth = s * 0.1;
  g.beginPath(); g.moveTo(-s * 0.25, 0); g.quadraticCurveTo(-s * 0.45, s * wig, -s * 0.62, s * wig * 0.4); g.stroke();
  g.fillStyle = '#4ee87d';
  g.beginPath(); g.ellipse(0, 0, s * 0.3, s * 0.13, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(s * 0.34, 0, s * 0.12, s * 0.1, 0, 0, TAU); g.fill();
  g.strokeStyle = color; g.lineWidth = s * 0.05; g.beginPath(); g.ellipse(0, 0, s * 0.3, s * 0.13, 0, 0, TAU); g.stroke();
  g.fillStyle = '#111'; g.beginPath(); g.arc(s * 0.4, -s * 0.05, s * 0.025, 0, TAU); g.arc(s * 0.4, s * 0.05, s * 0.025, 0, TAU); g.fill();
  g.restore();
}

/** The Vulcan salute hand (Spock). */
export function drawSpock(g, x, y, a, s, color) {
  g.save(); g.translate(x, y); g.rotate(a);
  g.fillStyle = '#c8b6ff'; g.strokeStyle = color; g.lineWidth = s * 0.05;
  const finger = (fx, ang, len) => { g.save(); g.translate(fx, -s * 0.12); g.rotate(ang); g.beginPath(); rrect(g, -s * 0.055, -len, s * 0.11, len, s * 0.05); g.fill(); g.stroke(); g.restore(); };
  finger(-s * 0.2, -0.22, s * 0.36); finger(-s * 0.08, -0.12, s * 0.42); finger(s * 0.08, 0.12, s * 0.42); finger(s * 0.2, 0.22, s * 0.36);
  g.save(); g.translate(-s * 0.26, s * 0.05); g.rotate(-1); g.beginPath(); rrect(g, -s * 0.06, -s * 0.24, s * 0.12, s * 0.24, s * 0.05); g.fill(); g.stroke(); g.restore();
  g.beginPath(); rrect(g, -s * 0.27, -s * 0.15, s * 0.54, s * 0.5, s * 0.12); g.fill(); g.stroke();
  g.restore();
}

/** A flower seen from above: `bloom` 0..1 opens the petals. */
export function drawFlower(g, x, y, a, s, color, bloom = 1, petals = 6) {
  if (bloom <= 0) return;
  g.save(); g.translate(x, y); g.rotate(a); g.scale(bloom, bloom);
  g.fillStyle = color;
  for (let i = 0; i < petals; i++) {
    g.save(); g.rotate((i / petals) * TAU);
    g.beginPath(); g.ellipse(s * 0.28, 0, s * 0.24, s * 0.13, 0, 0, TAU); g.fill();
    g.restore();
  }
  g.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < petals; i++) { g.save(); g.rotate((i / petals) * TAU); g.beginPath(); g.ellipse(s * 0.24, 0, s * 0.12, s * 0.04, 0, 0, TAU); g.fill(); g.restore(); }
  const c = g.createRadialGradient(0, 0, 0, 0, 0, s * 0.16);
  c.addColorStop(0, '#fff6b0'); c.addColorStop(1, '#ffb11f');
  g.fillStyle = c; g.beginPath(); g.arc(0, 0, s * 0.15, 0, TAU); g.fill();
  g.restore();
}

/** A soap bubble. */
export function drawBubble(g, x, y, r, color) {
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.05, x, y, r);
  gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.08)'); gr.addColorStop(1, color);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = Math.max(1, r * 0.06); g.stroke();
}

/** A needle pointing along +x. */
export function drawNeedle(g, x, y, a, s, color) {
  g.save(); g.translate(x, y); g.rotate(a);
  const gr = g.createLinearGradient(0, -s * 0.05, 0, s * 0.05);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#7d8aa3');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(s * 0.55, 0); g.lineTo(-s * 0.4, -s * 0.045); g.lineTo(-s * 0.4, s * 0.045); g.closePath(); g.fill();
  g.strokeStyle = color; g.lineWidth = s * 0.03;
  g.beginPath(); g.ellipse(-s * 0.33, 0, s * 0.05, s * 0.022, 0, 0, TAU); g.stroke();
  g.fillStyle = color; g.beginPath(); g.arc(-s * 0.45, 0, s * 0.06, 0, TAU); g.fill();
  g.restore();
}

/** A knife: blade towards +x (tip at x + s·0.6). */
export function drawKnife(g, x, y, a, s, color) {
  g.save(); g.translate(x, y); g.rotate(a);
  const gr = g.createLinearGradient(0, -s * 0.09, 0, s * 0.09);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#cfd8e6'); gr.addColorStop(1, '#7e8aa0');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(s * 0.6, 0); g.quadraticCurveTo(s * 0.25, -s * 0.11, -s * 0.05, -s * 0.09); g.lineTo(-s * 0.05, s * 0.07); g.lineTo(s * 0.2, s * 0.07); g.closePath(); g.fill();
  g.fillStyle = '#e8e8f0'; g.fillRect(-s * 0.09, -s * 0.13, s * 0.05, s * 0.26);
  g.fillStyle = color;
  g.beginPath(); rrect(g, -s * 0.42, -s * 0.07, s * 0.33, s * 0.14, s * 0.05); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(-s * 0.38, -s * 0.05, s * 0.25, s * 0.025);
  g.restore();
}

/** A party balloon (with knot and a bit of string). */
export function drawBalloon(g, x, y, r, color, wobble = 0) {
  g.save(); g.translate(x, y); g.rotate(wobble);
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = Math.max(1, r * 0.05);
  g.beginPath(); g.moveTo(0, r * 1.08); g.quadraticCurveTo(r * 0.2, r * 1.4, 0, r * 1.7); g.stroke();
  const gr = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, 0, 0, r * 1.1);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, color); gr.addColorStop(1, color);
  g.fillStyle = gr;
  g.beginPath(); g.ellipse(0, 0, r * 0.92, r * 1.05, 0, 0, TAU); g.fill();
  g.fillStyle = color;
  g.beginPath(); g.moveTo(0, r * 1.0); g.lineTo(-r * 0.12, r * 1.16); g.lineTo(r * 0.12, r * 1.16); g.closePath(); g.fill();
  g.restore();
}
