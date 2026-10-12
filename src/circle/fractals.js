/**
 * Fractals:
 *
 *   mandel   a Mandelbrot zoom into a famous spot (seahorse valley, a spiral, lightning,
 *            or your own point), ×10 every few seconds; or a Julia set whose c turns round
 *   lsystem  curves grown by a rewrite rule, one step at a time: Koch snowflake, dragon,
 *            Hilbert, Sierpiński arrowhead, Gosper, Lévy C
 *
 * Same contract as scenes.js; deterministic (the picture is a pure function of time).
 */
import { hexA } from './palettes.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ============================================================== mandelbrot */

export const SPOTS = {
  seahorse: [-0.743643887037151, 0.13182590420533],
  spiral: [-0.761574, -0.0847596],
  lightning: [-0.170337, -1.06506],
  needle: [-1.7548776662466927, 0], // centre of the biggest copy of the set on the real axis
  custom: null,
};

const GRADIENTS = {
  fire: ['#000000', '#3a0610', '#a11d0e', '#ff7a1a', '#ffd76a', '#ffffff', '#ffd76a', '#ff7a1a', '#a11d0e', '#3a0610'],
  ocean: ['#000510', '#002a5c', '#0a6fb5', '#3ed1e8', '#e8fbff', '#3ed1e8', '#0a6fb5', '#002a5c'],
  neon: ['#07021a', '#3d1a8a', '#22e4ff', '#ffffff', '#ff3d9a', '#3d1a8a'],
  gold: ['#0a0600', '#4a2a00', '#c87f0a', '#ffe08a', '#fffbe8', '#ffe08a', '#c87f0a', '#4a2a00'],
  rainbow: ['#ff004c', '#ff8a00', '#ffe600', '#4dff6a', '#00d4ff', '#5b4dff', '#d24dff', '#ff004c'],
  mono: ['#000000', '#3a3f55', '#a9b4dd', '#ffffff', '#a9b4dd', '#3a3f55'],
};
function lut(name) {
  const stops = (GRADIENTS[name] || GRADIENTS.fire).map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  const out = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const u = (i / 256) * stops.length, a = Math.floor(u) % stops.length, b = (a + 1) % stops.length, f = u - Math.floor(u);
    for (let c = 0; c < 3; c++) out[i * 3 + c] = stops[a][c] + (stops[b][c] - stops[a][c]) * f;
  }
  return out;
}

const mandel = {
  label: 'Mandelbrot zoom and Julia sets', group: 'Fractals',
  defaults: { set: 'mandelbrot', spot: 'seahorse', cx: -0.743643887037151, cy: 0.13182590420533, depth: 6, wait: 1, colors: 'fire', res: 300, juliaR: 0.7885, juliaSpeed: 0.05, notes: 2 },
  controls: [
    ['set', 'Fractal', 's', { mandelbrot: 'Mandelbrot zoom', julia: 'Julia set (c turns round)' }],
    ['spot', 'Zoom into', 's', { seahorse: 'Seahorse valley', spiral: 'A spiral', lightning: 'Lightning', needle: 'A tiny copy of the whole set', custom: 'My point' }],
    ['cx', 'My point: real part', 'r', -2, 1, 0.000001], ['cy', 'My point: imaginary part', 'r', -1.5, 1.5, 0.000001],
    ['depth', 'Zoom by 10^…', 'r', 1, 12, 0.5], ['colors', 'Colours', 's', { fire: 'Fire', ocean: 'Ocean', neon: 'Neon', gold: 'Gold', rainbow: 'Rainbow', mono: 'Silver' }],
    ['juliaR', 'Julia: size of c', 'r', 0.3, 1, 0.0001], ['juliaSpeed', 'Julia: turns of c per second', 'r', 0.005, 0.3, 0.001],
    ['res', 'Detail (pixels across)', 'r', 120, 600, 10], ['notes', 'Notes per beat', 'r', 0, 8, 1],
  ],
  init(S, P) { S.sc = { lut: lut(P.colors), tick: -1, beat: -1 }; },
  zoom(S, P) {
    const dur = Math.max(4, (S.duration || 30) - P.wait - 1);
    const u = clamp((S.st - P.wait) / dur, 0, 1);
    return 10 ** (P.depth * u);
  },
  centre(P) { return SPOTS[P.spot] || [P.cx, P.cy]; },
  step(S, P, dt, emit) {
    const sc = S.sc;
    if (P.notes <= 0) return;
    const q = Math.floor((S.st * S.bpm * P.notes) / 60);
    if (q === sc.tick) return;
    sc.tick = q;
    // a slow climb with the zoom (or round with c), a little arpeggio on top
    const base = P.set === 'julia' ? 0.5 + 0.3 * Math.sin(TAU * P.juliaSpeed * S.st) : Math.log10(this.zoom(S, P)) / Math.max(1, P.depth);
    emit({ type: 'hit', ball: q % 8, x: 0, y: 0, angle: 0, pitch: clamp(0.15 + 0.6 * base + [0, 0.1, 0.2, 0.1][q % 4], 0, 1) });
  },
  draw(S, P, D) {
    const sc = S.sc, { hw, hh } = S.W;
    const W = clamp(P.res | 0, 60, 800), H = Math.round((W * hh) / hw);
    const c = (mandel.canvas ||= document.createElement('canvas'));
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const cg = c.getContext('2d'), img = cg.createImageData(W, H), px = img.data, L = sc.lut;
    const julia = P.set === 'julia';
    let x0, y0, scale, maxIt, jr = 0, ji = 0;
    if (julia) {
      const a = TAU * P.juliaSpeed * S.st;
      jr = P.juliaR * Math.cos(a); ji = P.juliaR * Math.sin(a);
      scale = 3.2 / W; x0 = -1.6; y0 = (H / 2) * scale; maxIt = 160;
    } else {
      const z = this.zoom(S, P), [cx, cy] = this.centre(P);
      scale = 3.2 / z / W; x0 = cx - (W / 2) * scale; y0 = cy + (H / 2) * scale;
      maxIt = Math.round(clamp(90 + 70 * Math.log10(z), 90, 1200));
    }
    const LOG2 = Math.log(2);
    for (let j = 0; j < H; j++) {
      const ci = y0 - j * scale;
      for (let i = 0; i < W; i++) {
        const cr = x0 + i * scale;
        let zr = julia ? cr : 0, zi = julia ? ci : 0, n = 0, r2 = 0;
        const ar = julia ? jr : cr, ai = julia ? ji : ci;
        if (!julia) { // skip the main cardioid and the big bulb: always inside
          const q = (cr - 0.25) ** 2 + ci * ci;
          if (q * (q + (cr - 0.25)) <= 0.25 * ci * ci || (cr + 1) ** 2 + ci * ci <= 0.0625) n = maxIt;
        }
        while (n < maxIt) { const t = zr * zr - zi * zi + ar; zi = 2 * zr * zi + ai; zr = t; r2 = zr * zr + zi * zi; if (r2 > 256) break; n++; }
        const o = (j * W + i) * 4;
        if (n >= maxIt) { px[o] = px[o + 1] = px[o + 2] = 0; }
        else {
          const mu = n + 1 - Math.log(Math.log(r2) / 2 / LOG2) / LOG2; // smooth colouring
          const idx = (Math.floor(mu * 6) & 255) * 3;
          px[o] = L[idx]; px[o + 1] = L[idx + 1]; px[o + 2] = L[idx + 2];
        }
        px[o + 3] = 255;
      }
    }
    cg.putImageData(img, 0, 0);
    const { g } = D;
    g.imageSmoothingEnabled = true;
    g.drawImage(c, D.X(-hw), D.Y(hh), 2 * hw * D.R, 2 * hh * D.R);
  },
  stats(S, P) {
    if (P.set === 'julia') { const a = TAU * P.juliaSpeed * S.st; return `c = ${(P.juliaR * Math.cos(a)).toFixed(3)} ${Math.sin(a) < 0 ? '−' : '+'} ${Math.abs(P.juliaR * Math.sin(a)).toFixed(3)}i`; }
    const z = this.zoom(S, P);
    return `zoom × ${z < 1e4 ? Math.round(z).toLocaleString('en') : z.toExponential(1).replace('e+', ' × 10^')}`;
  },
  formula: (P) => (P.set === 'julia' ? 'z → z² + c, c turning' : 'z → z² + c, start z = 0'),
};

/* ================================================================ lsystem */

export const CURVES = {
  koch: { axiom: 'F--F--F', rules: { F: 'F+F--F+F' }, angle: 60, draw: 'F', name: 'Koch snowflake', max: 6 },
  dragon: { axiom: 'FX', rules: { X: 'X+YF+', Y: '-FX-Y' }, angle: 90, draw: 'F', name: 'Dragon curve', max: 14 },
  hilbert: { axiom: 'A', rules: { A: '+BF-AFA-FB+', B: '-AF+BFB+FA-' }, angle: 90, draw: 'F', name: 'Hilbert curve', max: 7 },
  arrowhead: { axiom: 'A', rules: { A: 'B-A-B', B: 'A+B+A' }, angle: 60, draw: 'AB', name: 'Sierpiński arrowhead', max: 8 },
  gosper: { axiom: 'A', rules: { A: 'A-B--B+A++AA+B-', B: '+A-BB--B-A++A+B' }, angle: 60, draw: 'AB', name: 'Gosper curve', max: 5 },
  levy: { axiom: 'F', rules: { F: '+F--F+' }, angle: 45, draw: 'F', name: 'Lévy C curve', max: 14 },
};

/** The points of curve `name` after `n` rewrites, fitted into [-1, 1]². */
export function lpoints(name, n) {
  const C = CURVES[name] || CURVES.koch;
  let s = C.axiom;
  for (let i = 0; i < Math.min(n, C.max); i++) { let t = ''; for (const ch of s) t += C.rules[ch] ?? ch; s = t; if (s.length > 400000) break; }
  const a = (C.angle * Math.PI) / 180;
  let x = 0, y = 0, h = 0;
  const pts = [[0, 0]];
  for (const ch of s) {
    if (C.draw.includes(ch)) { x += Math.cos(h); y += Math.sin(h); pts.push([x, y]); }
    else if (ch === '+') h += a; else if (ch === '-') h -= a;
  }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const mx = (Math.max(...xs) + Math.min(...xs)) / 2, my = (Math.max(...ys) + Math.min(...ys)) / 2;
  const sz = 2 / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-9);
  return pts.map(([u, v]) => [(u - mx) * sz, (v - my) * sz]);
}

const lsystem = {
  label: 'Fractal curves: Koch, dragon, Hilbert …', group: 'Fractals',
  defaults: { curve: 'koch', steps: '0 1 2 3 4 5', every: 4, wait: 0.5, draw: 0.7, notes: 4 },
  controls: [
    ['curve', 'Curve', 's', Object.fromEntries(Object.entries(CURVES).map(([k, v]) => [k, v.name]))],
    ['steps', 'Rewrites, one after another', 'x', '0 1 2 3 4 5'], ['every', 'Beats per step', 'r', 1, 16, 0.5],
    ['draw', 'Part of each step spent drawing', 'r', 0.1, 1, 0.05], ['notes', 'Notes per beat (pen height = pitch)', 'r', 0, 8, 1],
  ],
  init(S, P) {
    const steps = String(P.steps || '').split(/[\s,;]+/).map(Number).filter((v) => v >= 0).map(Math.round);
    const list = steps.length ? steps : [0, 1, 2, 3, 4];
    S.sc = { list, pts: list.map((n) => lpoints(P.curve, n)), k: -1, tick: -1 };
  },
  at(S, P) {
    const len = (60 / S.bpm) * Math.max(0.5, P.every);
    if (S.st < P.wait) return { k: -1, u: 0 };
    const k = Math.min(S.sc.list.length - 1, Math.floor((S.st - P.wait) / len));
    return { k, u: clamp((S.st - P.wait - k * len) / (len * Math.max(0.05, P.draw)), 0, 1) };
  },
  step(S, P, dt, emit) {
    const sc = S.sc, { k, u } = this.at(S, P);
    if (k < 0) return;
    if (k !== sc.k) { sc.k = k; emit({ type: 'fill', ball: k, x: 0, y: 0, angle: 0, pitch: clamp(0.2 + 0.12 * k, 0, 1) }); }
    if (P.notes > 0 && u < 1) {
      const q = Math.floor((S.st * S.bpm * P.notes) / 60);
      if (q !== sc.tick) {
        sc.tick = q;
        const pts = sc.pts[k], p = pts[Math.min(pts.length - 1, Math.floor(u * (pts.length - 1)))];
        emit({ type: 'hit', ball: q % 12, x: p[0] * 0.5, y: p[1] * 0.5, angle: 0, pitch: clamp((p[1] + 1) / 2, 0, 1) });
      }
    }
  },
  draw(S, P, D) {
    const { g, pal, k: kk } = D, sc = S.sc, { hw, hh } = S.W, { k, u } = this.at(S, P);
    const sz = Math.min(hw, hh) * 0.9, oy = 0.05;
    const X = (x) => D.X(x * sz), Y = (y) => D.Y(y * sz + oy);
    if (k < 0) return;
    if (k > 0) {
      const prev = sc.pts[k - 1];
      g.strokeStyle = hexA(pal.ring, 0.18); g.lineWidth = 2 * kk; g.beginPath();
      prev.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.stroke();
    }
    const pts = sc.pts[k], m = Math.max(1, Math.floor(u * (pts.length - 1)));
    const w = clamp(6 / Math.sqrt(pts.length / 50), 1.4, 4);
    g.lineWidth = w * kk; g.lineJoin = 'round'; g.lineCap = 'round';
    const chunks = Math.min(60, m);
    for (let c = 0; c < chunks; c++) {
      const a = Math.floor((c * m) / chunks), b = Math.floor(((c + 1) * m) / chunks);
      g.strokeStyle = pal.line(c / 60); g.beginPath();
      for (let i = a; i <= b; i++) (i === a ? g.moveTo(X(pts[i][0]), Y(pts[i][1])) : g.lineTo(X(pts[i][0]), Y(pts[i][1])));
      g.stroke();
    }
    if (u < 1) { const p = pts[m]; g.fillStyle = '#ffffff'; g.shadowColor = pal.glow; g.shadowBlur = 14 * kk; g.beginPath(); g.arc(X(p[0]), Y(p[1]), 5 * kk, 0, TAU); g.fill(); g.shadowBlur = 0; }
  },
  stats(S, P) { const { k } = this.at(S, P); return k < 0 ? 'ready…' : `step ${S.sc.list[k]} · ${(S.sc.pts[k].length - 1).toLocaleString('en')} lines`; },
  formula: (P) => { const C = CURVES[P.curve] || CURVES.koch; return `${C.axiom} → ${Object.entries(C.rules).map(([a, b]) => `${a} → ${b}`).join(', ')}`; },
};

export const FRACTALS = { mandel, lsystem };
