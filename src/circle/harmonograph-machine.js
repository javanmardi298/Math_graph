/**
 * The harmonograph machine as a picture: the frame, the hanging pendulums, the rods that carry the
 * pen, the pen on the paper. Seen from above (a plan) or in perspective (3D), in three looks:
 *
 *   victorian   dark wood, brass rods and weights, an old sheet of paper
 *   blueprint   white outlines on blueprint paper, with dimension marks
 *   neon        glowing lines on black
 *
 * It is drawn over the flat drawing as a panel that can be shown, hidden, faded, moved and resized.
 * The paper of the machine is a copy of the flat drawing's ink, projected onto the table, so the
 * line you see growing under the pen is the line of the drawing. Everything here is a picture of
 * the real motion: the rods follow the pen exactly (the sum of the pendulums); the extra pendulums
 * of a four-pendulum machine are drawn on the far rails and coupled with dashed rods.
 */
import { hexA } from './palettes.js';
import { makeCanvas } from './harmonograph.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const MACHINE_VIEWS = { off: 'Hidden', plan: '2D plan (from above)', '3d': '3D (perspective)' };
export const MACHINE_STYLES = { victorian: 'Victorian (wood and brass)', blueprint: 'Blueprint (technical drawing)', neon: 'Neon (glow)' };
export const MACHINE_LAYOUTS = { top: 'Above the drawing', corner: 'Small, in a corner', full: 'Fills the frame', free: 'Free (position and size below)' };

const H = 3.4; // height of the pivots
const LINK = 0.55; // height where the rods meet the pen
const BOB = 0.14;

/** Camera: world (x right, y away, z up) → pixels. `pitch` π/2 = straight down (a plan). */
function camera({ yaw, pitch, persp }) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), D = 13;
  return (p) => {
    const x1 = p[0] * cy - p[1] * sy, y1 = p[0] * sy + p[1] * cy, z = p[2];
    const up = z * cp + y1 * sp, dep = D + y1 * cp - z * sp, s = persp ? 1 / dep : 1 / D;
    return [x1 * s, -up * s, dep, s];
  };
}

/** The projection that fits the whole machine into a pixel rectangle. */
function fitted(view, P, time, rect) {
  const plan = view === 'plan';
  const spin = ((+P.machineSpin || 0) * time * Math.PI) / 180;
  const cam = camera({ yaw: plan ? 0 : (((+P.machineYaw || 0) * Math.PI) / 180) + spin, pitch: plan ? Math.PI / 2 : ((+P.machinePitch || 34) * Math.PI) / 180, persp: !plan });
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const zs = plan ? [0] : [-0.35, H + 0.3];
  for (const x of [-2.3, 2.3]) for (const y of [-2.3, 2.3]) for (const z of zs) { const q = cam([x, y, z]); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
  const k = 0.92 * Math.min((rect.x1 - rect.x0) / (x1 - x0), (rect.y1 - rect.y0) / (y1 - y0));
  const cx = (rect.x0 + rect.x1) / 2 - ((x0 + x1) / 2) * k, cy = (rect.y0 + rect.y1) / 2 - ((y0 + y1) / 2) * k;
  const P2 = (p) => { const q = cam(p); return [cx + q[0] * k, cy + q[1] * k, q[2], q[3] * k]; };
  P2.k = k;
  return P2;
}

/** The look of each style. */
function look(style) {
  if (style === 'blueprint') return { name: 'blueprint', rod: '#dff0ff', rodW: 2.2, link: '#dff0ff', text: '#dff0ff', outline: '#dff0ff', paper: 'rgba(255,255,255,0.08)', panel: ['#14418a', '#061a3e'], border: 'rgba(223,240,255,0.5)', pen: '#ffffff' };
  if (style === 'neon') return { name: 'neon', rod: '#8fe9ff', rodW: 2.4, link: '#8fe9ff', text: '#cfe9ff', outline: '#8b7bff', paper: 'rgba(120,160,255,0.08)', panel: ['#14173a', '#02030a'], border: 'rgba(139,123,255,0.6)', pen: '#ffffff' };
  return { name: 'victorian', rod: '#c99a3a', rodW: 4.6, link: '#d8b050', text: '#f3e2bd', outline: 'rgba(30,15,5,0.6)', paper: '#e8d8b0', panel: ['#3a2414', '#150b05'], border: 'rgba(200,150,70,0.6)', pen: '#2a1a0a', wood: ['#7a4b25', '#5d3719', '#3f2410'], brass: ['#fff3b8', '#d9a640', '#7b5612'] };
}

function box(g, P, L, x0, x1, y0, y1, z0, z1) {
  const C = (i, j, k) => [i ? x1 : x0, j ? y1 : y0, k ? z1 : z0];
  const F = [[[C(0, 0, 0), C(0, 1, 0), C(0, 1, 1), C(0, 0, 1)], 'L'], [[C(1, 0, 0), C(1, 1, 0), C(1, 1, 1), C(1, 0, 1)], 'R'], [[C(0, 0, 0), C(1, 0, 0), C(1, 0, 1), C(0, 0, 1)], 'F'], [[C(0, 1, 0), C(1, 1, 0), C(1, 1, 1), C(0, 1, 1)], 'B'], [[C(0, 0, 1), C(1, 0, 1), C(1, 1, 1), C(0, 1, 1)], 'T']];
  const polys = F.map(([vs, k]) => {
    const pr = vs.map(P);
    const area = pr.reduce((s, p, i) => { const q = pr[(i + 1) % 4]; return s + (p[0] * q[1] - q[0] * p[1]); }, 0);
    return { pr, k, area, dep: pr.reduce((s, p) => s + p[2], 0) / 4 };
  }).filter((f) => f.area < 0 || P.plan).sort((a, b) => b.dep - a.dep);
  for (const f of polys) {
    g.beginPath(); f.pr.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
    if (L.wood) { g.fillStyle = { T: L.wood[0], F: L.wood[1], B: L.wood[2], L: L.wood[2], R: L.wood[1] }[f.k]; g.fill(); g.strokeStyle = L.outline; g.lineWidth = 1; g.stroke(); }
    else if (L.name === 'blueprint') { g.fillStyle = 'rgba(10,40,90,0.55)'; g.fill(); g.strokeStyle = L.outline; g.lineWidth = 1.2; g.stroke(); }
    else { g.fillStyle = 'rgba(10,14,40,0.7)'; g.fill(); g.shadowColor = '#7b5cff'; g.shadowBlur = 8; g.strokeStyle = '#8b7bff'; g.lineWidth = 1.3; g.stroke(); g.shadowBlur = 0; }
  }
}

function line3(g, P, a, b, w, c, glow = 0, dash = null) {
  const A = P(a), B = P(b);
  g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round';
  if (glow) { g.shadowColor = c; g.shadowBlur = glow; }
  if (dash) g.setLineDash(dash);
  g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
  g.setLineDash([]); g.shadowBlur = 0;
}

function weight(g, P, L, p, r, tag) {
  const c = P(p), R = r * c[3];
  if (L.brass) {
    const gr = g.createRadialGradient(c[0] - R * 0.35, c[1] - R * 0.4, R * 0.1, c[0], c[1], R);
    gr.addColorStop(0, L.brass[0]); gr.addColorStop(0.5, L.brass[1]); gr.addColorStop(1, L.brass[2]);
    g.fillStyle = gr; g.beginPath(); g.arc(c[0], c[1], R, 0, TAU); g.fill(); g.strokeStyle = 'rgba(40,20,0,0.7)'; g.lineWidth = 1; g.stroke();
    g.strokeStyle = 'rgba(255,240,180,0.5)'; g.beginPath(); g.arc(c[0], c[1], R * 0.62, 0, TAU); g.stroke();
  } else if (L.name === 'blueprint') {
    g.strokeStyle = L.outline; g.lineWidth = 1.3; g.fillStyle = 'rgba(10,40,90,0.6)';
    g.beginPath(); g.arc(c[0], c[1], R, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.arc(c[0], c[1], R * 0.6, 0, TAU); g.stroke();
    g.setLineDash([4, 3]); g.beginPath(); g.moveTo(c[0] - R * 1.5, c[1]); g.lineTo(c[0] + R * 1.5, c[1]); g.moveTo(c[0], c[1] - R * 1.5); g.lineTo(c[0], c[1] + R * 1.5); g.stroke(); g.setLineDash([]);
  } else {
    const gr = g.createRadialGradient(c[0], c[1], R * 0.1, c[0], c[1], R * 1.9);
    gr.addColorStop(0, 'rgba(143,233,255,0.95)'); gr.addColorStop(0.35, 'rgba(143,233,255,0.35)'); gr.addColorStop(1, 'rgba(143,233,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(c[0], c[1], R * 1.9, 0, TAU); g.fill();
    g.fillStyle = '#e9fbff'; g.beginPath(); g.arc(c[0], c[1], R * 0.55, 0, TAU); g.fill();
  }
  if (tag) { g.fillStyle = L.text; g.font = `bold ${Math.max(10, Math.round(R * 0.7))}px system-ui`; g.textAlign = 'center'; g.fillText(tag, c[0], c[1] - R - 6); }
}

/** The paper: its own base colour, the ink of the drawing, projected onto the table. */
function paperTexture(tex, L, ink, rot) {
  const g = tex.getContext('2d'), n = tex.width;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, n, n);
  g.fillStyle = L.name === 'victorian' ? '#e8d8b0' : L.name === 'blueprint' ? '#1b4d9a' : '#0a0e26'; g.fillRect(0, 0, n, n);
  if (L.name === 'blueprint') { g.strokeStyle = 'rgba(160,205,255,0.18)'; g.lineWidth = 1; for (let i = 0; i <= 16; i++) { g.beginPath(); g.moveTo((i / 16) * n, 0); g.lineTo((i / 16) * n, n); g.moveTo(0, (i / 16) * n); g.lineTo(n, (i / 16) * n); g.stroke(); } }
  if (!ink) return;
  g.save(); g.translate(n / 2, n / 2); g.rotate(rot); g.drawImage(ink.canvas, ink.sx, ink.sy, ink.sw, ink.sh, -n / 2, -n / 2, n, n); g.restore();
}

/** Draw the paper: flat for a plan, in thin strips (each an affine patch) for perspective. */
function projectPaper(g, P, tex, half, plan, z = 0.002) {
  const n = tex.width;
  if (plan) {
    const tl = P([-half, half, z]), br = P([half, -half, z]);
    g.drawImage(tex, tl[0], tl[1], br[0] - tl[0], br[1] - tl[1]);
    return;
  }
  const N = 56, sh = n / N;
  for (let i = 0; i < N; i++) {
    const yt = half - (i / N) * 2 * half, yb = half - ((i + 1) / N) * 2 * half;
    const TL = P([-half, yt, z]), TR = P([half, yt, z]), BL = P([-half, yb, z]);
    g.save();
    g.transform((TR[0] - TL[0]) / n, (TR[1] - TL[1]) / n, (BL[0] - TL[0]) / sh, (BL[1] - TL[1]) / sh, TL[0], TL[1]);
    g.drawImage(tex, 0, i * sh, n, Math.min(sh + 1, n - i * sh), 0, 0, n, Math.min(sh + 1, n - i * sh));
    g.restore();
  }
}

/**
 * @param {CanvasRenderingContext2D} g
 * @param {object} o
 * @param {object} o.P settings; o.view 'plan'|'3d'; o.alpha 0..1; o.rect pixel rectangle {x0,y0,x1,y1}; o.time seconds
 * @param {{x:number[], y:number[], theta:number, arms:number[][]|null, kind:string}} o.parts the pendulums now (normalized, −1 … 1)
 * @param {{canvas:HTMLCanvasElement, sx:number, sy:number, sw:number, sh:number}|null} o.ink the drawing's ink to copy onto the paper
 */
export function drawMachine(g, o) {
  const { P, view, alpha, rect, time, parts, ink } = o;
  if (alpha <= 0.003) return;
  const L = look(P.machineStyle in MACHINE_STYLES ? P.machineStyle : 'victorian');
  const plan = view === 'plan';
  const PRJ = fitted(view, P, time, rect);
  PRJ.plan = plan;
  const pw = rect.x1 - rect.x0, ph = rect.y1 - rect.y0;
  g.save();
  g.globalAlpha = alpha;
  // panel
  const grad = g.createLinearGradient(0, rect.y0, 0, rect.y1);
  grad.addColorStop(0, L.panel[0]); grad.addColorStop(1, L.panel[1]);
  g.fillStyle = grad;
  const r = Math.min(pw, ph) * 0.03;
  g.beginPath(); g.moveTo(rect.x0 + r, rect.y0); g.arcTo(rect.x1, rect.y0, rect.x1, rect.y1, r); g.arcTo(rect.x1, rect.y1, rect.x0, rect.y1, r); g.arcTo(rect.x0, rect.y1, rect.x0, rect.y0, r); g.arcTo(rect.x0, rect.y0, rect.x1, rect.y0, r); g.closePath();
  g.fill();
  g.save(); g.clip();
  if (L.name === 'blueprint') {
    g.strokeStyle = 'rgba(160,205,255,0.13)'; g.lineWidth = 1;
    const cell = Math.max(18, pw / 18);
    for (let x = rect.x0; x < rect.x1; x += cell) { g.beginPath(); g.moveTo(x, rect.y0); g.lineTo(x, rect.y1); g.stroke(); }
    for (let y = rect.y0; y < rect.y1; y += cell) { g.beginPath(); g.moveTo(rect.x0, y); g.lineTo(rect.x1, y); g.stroke(); }
  } else if (L.name === 'victorian') {
    const v = g.createRadialGradient((rect.x0 + rect.x1) / 2, (rect.y0 + rect.y1) / 2, pw * 0.1, (rect.x0 + rect.x1) / 2, (rect.y0 + rect.y1) / 2, pw * 0.75);
    v.addColorStop(0, 'rgba(255,200,120,0.14)'); v.addColorStop(1, 'rgba(0,0,0,0.5)'); g.fillStyle = v; g.fillRect(rect.x0, rect.y0, pw, ph);
  }

  const u = parts;
  const [nx, ny] = [clamp(u.x[0] + (u.x[1] || 0), -1.3, 1.3), clamp(u.y[0] + (u.y[1] || 0), -1.3, 1.3)];
  const S = 1.05; // the figure fills ±1.05 of the paper
  const penPos = u.kind === 'epicycle' ? [u.arms.reduce((s, a) => s + a[0], 0), u.arms.reduce((s, a) => s + a[1], 0)] : [nx, ny];
  const X = penPos[0] * S, Y = penPos[1] * S;
  const k = PRJ.k;

  // table and paper
  const tex = o.tex || (o.tex = makeCanvas(512, 512));
  box(g, PRJ, L, -2.3, 2.3, -2.3, 2.3, -0.32, -0.02);
  if (u.kind === 'rotary') {
    // the turntable and its marks, turning with the paper
    const ring = (rad, z) => Array.from({ length: 64 }, (_, i) => PRJ([rad * Math.cos((i / 64) * TAU), rad * Math.sin((i / 64) * TAU), z]));
    const top = ring(1.9, 0);
    g.beginPath(); top.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
    g.fillStyle = L.wood ? '#8a5a2b' : 'rgba(10,40,90,0.5)'; g.fill(); g.strokeStyle = L.outline; g.lineWidth = 1; g.stroke();
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * TAU - u.theta, a0 = PRJ([1.78 * Math.cos(a), 1.78 * Math.sin(a), 0.001]), a1 = PRJ([(i % 3 ? 1.85 : 1.9) * Math.cos(a), (i % 3 ? 1.85 : 1.9) * Math.sin(a), 0.001]);
      g.strokeStyle = L.wood ? '#e8c868' : L.outline; g.lineWidth = i % 3 ? 1 : 2; g.beginPath(); g.moveTo(a0[0], a0[1]); g.lineTo(a1[0], a1[1]); g.stroke();
    }
  }
  paperTexture(tex, L, ink, u.kind === 'rotary' ? -u.theta : 0);
  projectPaper(g, PRJ, tex, 1.15, plan);
  g.strokeStyle = L.wood ? 'rgba(90,60,20,0.6)' : L.outline; g.lineWidth = 1.2;
  const pq = [[-1.15, -1.15], [1.15, -1.15], [1.15, 1.15], [-1.15, 1.15]].map(([x, y]) => PRJ([x, y, 0.003]));
  g.beginPath(); pq.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.stroke();

  // the machine, far to near
  const items = [];
  const unit = PRJ([0, 0, 0])[3] / 90; // pixels per world unit, relative to a 90 px reference
  const rodW = Math.max(1.4, L.rodW * unit);
  const sw = (a) => Math.max(1.2, a * unit);
  if (u.kind !== 'epicycle') {
    for (const [x, y] of [[-2, -2], [2, -2], [2, 2], [-2, 2]]) items.push([PRJ([x, y, 1.6])[2], () => box(g, PRJ, L, x - 0.09, x + 0.09, y - 0.09, y + 0.09, 0, H + 0.1)]);
    items.push([PRJ([0, -2, H])[2], () => box(g, PRJ, L, -2.1, 2.1, -2.09, -1.91, H, H + 0.2)]);
    items.push([PRJ([2, 0, H])[2], () => box(g, PRJ, L, 1.91, 2.09, -2.1, 2.1, H, H + 0.2)]);
    items.push([PRJ([0, 2, H])[2], () => box(g, PRJ, L, -2.1, 2.1, 1.91, 2.09, H, H + 0.2)]);
    items.push([PRJ([-2, 0, H])[2], () => box(g, PRJ, L, -2.09, -1.91, -2.1, 2.1, H, H + 0.2)]);
    const rodX = (z, x) => x * (H - z) / (H - LINK), rodY = (z, y) => y * (H - z) / (H - LINK);
    const pX = [0, -2, H], bX = [rodX(BOB, X), -2, BOB], lX = [X, -2, LINK];
    const pY = [2, 0, H], bY = [2, rodY(BOB, Y), BOB], lY = [2, Y, LINK + 0.08];
    const tags = o.tags !== false;
    const glow = L.name === 'neon' ? 10 : 0;
    items.push([PRJ(bX)[2], () => { line3(g, PRJ, pX, bX, rodW, L.rod, glow); weight(g, PRJ, L, bX, 0.27, tags ? 'x' : null); }]);
    items.push([PRJ(bY)[2], () => { line3(g, PRJ, pY, bY, rodW, L.rod, glow); weight(g, PRJ, L, bY, 0.27, tags ? 'y' : null); }]);
    items.push([PRJ(lX)[2], () => line3(g, PRJ, lX, [X, Y, 0.52], rodW * 0.65, L.link, glow * 0.8)]);
    items.push([PRJ(lY)[2], () => line3(g, PRJ, lY, [X, Y, 0.58], rodW * 0.65, L.link, glow * 0.8)]);
    if (u.x[1] !== undefined) {
      // the extra pendulums, on the far rails, coupled with dashed rods
      const cx = u.x[1] * S, dy = u.y[1] * S;
      const pC = [0, 2, H], bC = [rodX(BOB, cx), 2, BOB], lC = [cx, 2, LINK + 0.2], pD = [-2, 0, H], bD = [-2, rodY(BOB, dy), BOB], lD = [-2, dy, LINK + 0.28];
      items.push([PRJ(bC)[2], () => { line3(g, PRJ, pC, bC, rodW * 0.8, L.rod, glow); weight(g, PRJ, L, bC, 0.2, tags ? 'C' : null); line3(g, PRJ, lC, [X, Y, 0.62], rodW * 0.4, L.link, 0, [4, 4]); }]);
      items.push([PRJ(bD)[2], () => { line3(g, PRJ, pD, bD, rodW * 0.8, L.rod, glow); weight(g, PRJ, L, bD, 0.2, tags ? 'D' : null); line3(g, PRJ, lD, [X, Y, 0.66], rodW * 0.4, L.link, 0, [4, 4]); }]);
    }
    items.push([PRJ([X, Y, 0.7])[2] - 0.01, () => penDraw(g, PRJ, L, X, Y, sw)]);
  } else {
    items.push([0, () => {
      // epicycle: arms end to end above the paper
      let px = 0, py = 0;
      const pts = [[0, 0]];
      for (const a of u.arms) { px += a[0] * S; py += a[1] * S; pts.push([px, py]); }
      for (let i = 0; i < pts.length - 1; i++) {
        const a = [pts[i][0], pts[i][1], 0.35 + i * 0.06], b = [pts[i + 1][0], pts[i + 1][1], 0.35 + (i + 1) * 0.06];
        if (L.brass) { line3(g, PRJ, a, b, sw(11), '#7b5612'); line3(g, PRJ, a, b, sw(7), '#e7c25a'); line3(g, PRJ, a, b, sw(2), '#fff3b8'); } else line3(g, PRJ, a, b, rodW, L.rod, L.name === 'neon' ? 10 : 0);
        const c = PRJ(a); g.fillStyle = L.brass ? '#d9a640' : L.rod; g.beginPath(); g.arc(c[0], c[1], sw(8 - i), 0, TAU); g.fill();
      }
      penDraw(g, PRJ, L, px, py, sw);
    }]);
  }
  items.sort((a, b) => b[0] - a[0]).forEach((it) => it[1]());
  if (u.kind !== 'epicycle') for (const p of [[0, -2, H], [2, 0, H]]) { const c = PRJ(p); g.fillStyle = L.brass ? '#e8c868' : L.rod; g.beginPath(); g.arc(c[0], c[1], sw(6), 0, TAU); g.fill(); }
  g.restore(); // clip
  g.strokeStyle = L.border; g.lineWidth = Math.max(1.2, pw / 260);
  g.beginPath(); g.moveTo(rect.x0 + r, rect.y0); g.arcTo(rect.x1, rect.y0, rect.x1, rect.y1, r); g.arcTo(rect.x1, rect.y1, rect.x0, rect.y1, r); g.arcTo(rect.x0, rect.y1, rect.x0, rect.y0, r); g.arcTo(rect.x0, rect.y0, rect.x1, rect.y0, r); g.closePath(); g.stroke();
  g.restore();
}

function penDraw(g, P, L, X, Y, sw) {
  const top = [X, Y, 0.72], tip = [X, Y, 0.02];
  line3(g, P, top, tip, sw(L.name === 'victorian' ? 5 : 3), L.name === 'victorian' ? '#2a1a0a' : L.rod, L.name === 'neon' ? 12 : 0);
  const c = P(tip);
  g.fillStyle = L.pen; if (L.name === 'neon') { g.shadowColor = '#9ff6ff'; g.shadowBlur = 22; }
  g.beginPath(); g.arc(c[0], c[1], sw(5), 0, TAU); g.fill(); g.shadowBlur = 0;
  const kn = P([X, Y, 0.5]);
  g.fillStyle = L.brass ? '#d9a640' : L.name === 'neon' ? '#8fe9ff' : 'rgba(10,40,90,0.8)';
  g.beginPath(); g.arc(kn[0], kn[1], sw(8), 0, TAU); g.fill(); g.strokeStyle = L.outline; g.lineWidth = 1; g.stroke();
  void hexA;
}
