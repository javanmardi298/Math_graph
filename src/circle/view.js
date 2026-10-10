/**
 * Circle Lab renderer (Canvas 2D, no WebGL).
 *
 * The whole frame is used: a living background (nebula light, drifting dust that
 * sparkles with the hits, big ripples on milestones, a vignette) fills everything,
 * the simulation fills the safe area between the Shorts title and caption zones
 * (layout.js), and a soft bloom pass makes every bright thing glow.
 *
 * It keeps a CircleSim in step with the timeline: playing forward just advances it,
 * jumping back replays it from t = 0. Permanent trails and dots are drawn once onto an
 * "ink" canvas, so hundreds of thousands of them cost nothing per frame.
 */
import { CircleSim, DT } from './sim.js';
import { pixelFrame } from './layout.js';
import { PALETTES, CIRCLE_PALETTES, frac, hexA, paletteOf } from './palettes.js';

export { CIRCLE_PALETTES, PALETTES };

const TAU = Math.PI * 2;
const NO_SPARKS = new Set(['rps', 'predator', 'knives', 'popper', 'pendulum', 'sorting', 'tree', 'dna', 'times', 'chaos', 'phyllo', 'harmono', 'orbits', 'spiro', 'packing', 'paper', 'mitosis', 'coral', 'snowflake', 'galton', 'pyramid', 'pachinko', 'beatfill']);

export class CircleView {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'circle-canvas';
    this.g = this.canvas.getContext('2d');
    this.ink = document.createElement('canvas');
    this.ig = this.ink.getContext('2d');
    this.glow = document.createElement('canvas');
    this.gg = this.glow.getContext('2d');
    this.canFilter = 'filter' in this.gg;
    this.cfg = null;
    this.sim = null;
    this.inked = 0;
    this.inkedDots = 0;
    this.recent = []; // events of the last second (sparks, pulses, ripples)
    this.tails = new Map();
  }

  /** Settings changed: start over on the next frame. */
  invalidate() { this.sim = null; }

  ensureSize(w, h) {
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
      this.ink.width = w; this.ink.height = h;
      this.inked = 0; this.inkedDots = 0;
      this.ig.clearRect(0, 0, w, h);
    }
  }

  /** Pixel mapping of the world (the unit circle spans the safe area's width on vertical videos). */
  frame() {
    const { width: w, height: h } = this.canvas;
    return pixelFrame(w, h, this.cfg.look.zoom ?? 1);
  }

  /**
   * Draw the simulation at `time` and return the events that happened since the last
   * call (only when moving forward), for live sound.
   * @param {{snap?:boolean, width:number, height:number, env?:{duration:number,bpm:number,ratio:number}}} o
   */
  renderAt(time, cfg, { snap = false, width, height, env = {} } = {}) {
    const envKey = `${env.duration}|${env.bpm}|${env.ratio}`;
    if (cfg !== this.cfg || !this.sim || envKey !== this.envKey) { this.cfg = cfg; this.sim = null; this.envKey = envKey; }
    this.ensureSize(width, height);
    const fresh = [];
    if (!this.sim || time < this.sim.t - DT * 2 || (snap && time < this.sim.t)) {
      this.sim = new CircleSim(cfg, env);
      this.inked = 0; this.inkedDots = 0;
      this.recent = [];
      this.tails.clear();
      this.ig.clearRect(0, 0, this.ink.width, this.ink.height);
    }
    const jumping = time - this.sim.t > 0.5; // a seek: don't flood sound and sparks
    this.sim.advance(time, (e) => { if (!jumping) fresh.push(e); this.recent.push(e); });
    const cut = time - 1.3;
    if (this.recent.length && this.recent[0].t < cut) this.recent = this.recent.filter((e) => e.t > cut);
    if (this.recent.length > 600) this.recent = this.recent.slice(-600);
    this.paint(time);
    return fresh;
  }

  inkSegments() {
    const { sim, ig } = this;
    const L = this.cfg.look, pal = paletteOf(L.palette);
    const { k, R, cx, cy } = this.frame();
    const segs = sim.segments;
    if (L.trail === 'lines' && this.inked < segs.length) {
      const lw = (L.trailWidth ?? 1.6) * k * 1.6;
      ig.lineCap = 'round';
      for (let i = this.inked; i < segs.length; i++) {
        const s = segs[i];
        const x1 = cx + s.x1 * R, y1 = cy - s.y1 * R, x2 = cx + s.x2 * R, y2 = cy - s.y2 * R;
        ig.strokeStyle = pal.line(s.hue);
        ig.globalAlpha = 0.14 * (L.glow ?? 1);
        ig.lineWidth = lw * 4;
        ig.beginPath(); ig.moveTo(x1, y1); ig.lineTo(x2, y2); ig.stroke();
        ig.globalAlpha = 0.85;
        ig.lineWidth = lw;
        ig.beginPath(); ig.moveTo(x1, y1); ig.lineTo(x2, y2); ig.stroke();
      }
      ig.globalAlpha = 1;
      this.inked = segs.length;
    }
    const dots = sim.dots;
    if (this.inkedDots < dots.length) {
      for (let i = this.inkedDots; i < dots.length; i++) {
        const d = dots[i], r = d.s * k;
        ig.globalAlpha = d.a;
        ig.fillStyle = pal.line(d.hue);
        if (r < 1.2) ig.fillRect(cx + d.x * R - r, cy - d.y * R - r, r * 2, r * 2);
        else { ig.beginPath(); ig.arc(cx + d.x * R, cy - d.y * R, r, 0, TAU); ig.fill(); }
      }
      ig.globalAlpha = 1;
      this.inkedDots = dots.length;
    }
  }

  /** Recent activity, 0..1 (drives the background sparkle). */
  energy(time) {
    let n = 0;
    for (let i = this.recent.length - 1; i >= 0 && this.recent[i].t > time - 0.5; i--) n++;
    return Math.min(1, n / 6);
  }

  background(time, F, pal, L, energy) {
    const { g } = this;
    const { w, h, k, R, cx, cy } = F;
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.fillStyle = L.background || '#060814';
    g.fillRect(0, 0, w, h);
    if (L.ambience === false) return;
    // nebula light: slow drifting clouds that reach the top and the bottom of the frame
    const blob = (x, y, r, color, a) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, hexA(color, a)); gr.addColorStop(1, hexA(color, 0));
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    };
    blob(w * (0.25 + 0.08 * Math.sin(time * 0.11)), h * 0.12, Math.max(w, h) * 0.55, pal.glow2 || pal.glow, 0.13 + 0.05 * energy);
    blob(w * (0.78 + 0.06 * Math.cos(time * 0.09)), h * 0.9, Math.max(w, h) * 0.6, pal.glow, 0.12 + 0.05 * energy);
    blob(cx, cy, R * 1.6, pal.glow, 0.1 + 0.08 * energy);
    // dust: drifting up, sparkling with the music
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 80; i++) {
      const a = frac(Math.sin(i * 12.9898) * 43758.5453), b = frac(Math.sin(i * 78.233) * 12345.678), c = frac(Math.sin(i * 39.425) * 24634.6345);
      const x = frac(a + time * 0.004 * (c - 0.5)) * w;
      const y = h - frac(b + time * (0.006 + 0.012 * c)) * h;
      const tw = 0.5 + 0.5 * Math.sin(time * (1 + 2 * c) + i);
      g.globalAlpha = (0.1 + 0.25 * tw) * (0.6 + 0.8 * energy);
      g.fillStyle = pal.line(i * 0.13);
      g.beginPath(); g.arc(x, y, (0.8 + 2.2 * c) * k * (1 + 0.6 * energy), 0, TAU); g.fill();
    }
    // ripples across the whole frame on big moments
    for (const e of this.recent) {
      if (e.type !== 'fill' && !(e.type === 'escape' && !this.sim.scene)) continue;
      const age = time - e.t;
      if (age < 0 || age > 1.3) continue;
      g.globalAlpha = 0.35 * (1 - age / 1.3);
      g.strokeStyle = pal.ring; g.lineWidth = Math.max(1, (6 - 4 * age) * k);
      g.beginPath(); g.arc(cx + (e.x ?? 0) * R, cy - (e.y ?? 0) * R, age * 1100 * k, 0, TAU); g.stroke();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  vignette(F) {
    const { g } = this;
    const { w, h } = F;
    const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
  }

  /** Soft bloom: a blurred, quarter-size copy of the frame added on top. */
  bloom(F, L) {
    const amount = 0.5 * (L.glow ?? 1) * (L.bloom ?? 1);
    if (!this.canFilter || amount <= 0) return;
    const { w, h, k } = F;
    const gw = Math.max(1, Math.round(w / 4)), gh = Math.max(1, Math.round(h / 4));
    if (this.glow.width !== gw || this.glow.height !== gh) { this.glow.width = gw; this.glow.height = gh; }
    const { gg, g } = this;
    gg.globalCompositeOperation = 'copy';
    gg.filter = `blur(${Math.max(1.5, 4 * k)}px)`;
    gg.drawImage(this.canvas, 0, 0, gw, gh);
    gg.filter = 'none';
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = amount;
    g.drawImage(this.glow, 0, 0, w, h);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  paint(time) {
    const { g, sim, cfg } = this;
    const L = cfg.look, pal = paletteOf(L.palette);
    const F = this.frame();
    const energy = this.energy(time);
    this.background(time, F, pal, L, energy);

    // permanent ink (trails, dots)
    this.inkSegments();
    if (L.trail === 'lines' || sim.dots.length) g.drawImage(this.ink, 0, 0);
    if (L.trail === 'fade') this.fadeTrails(time, F, pal, L);

    const lastHit = this.recent.length ? this.recent[this.recent.length - 1].t : -9;
    if (sim.scene) {
      const D = {
        g, X: (x) => F.cx + x * F.R, Y: (y) => F.cy - y * F.R, R: F.R, k: F.k, pal, look: L, time, lastHit, energy,
        underBalls: () => { if (L.comet && sim.balls.length <= 40) this.comets(F, pal, L); },
      };
      g.save();
      sim.scene.draw(sim, sim.P, D);
      g.restore();
    } else {
      this.paintClassic(time, F, pal, L, lastHit);
    }

    if (L.sparks && !NO_SPARKS.has(cfg.rule)) this.sparks(time, F, pal);
    this.vignette(F);
    this.bloom(F, L);
  }

  fadeTrails(time, F, pal, L) {
    const { g, sim } = this;
    const segs = sim.segments, from = time - 2.5;
    g.lineCap = 'round';
    for (let i = segs.length - 1; i >= 0 && segs[i].t > from; i--) {
      const s = segs[i], a = 1 - (time - s.t) / 2.5;
      g.globalAlpha = a * 0.9;
      g.strokeStyle = pal.line(s.hue);
      g.lineWidth = (L.trailWidth ?? 1.6) * F.k * 1.6;
      g.beginPath(); g.moveTo(F.cx + s.x1 * F.R, F.cy - s.y1 * F.R); g.lineTo(F.cx + s.x2 * F.R, F.cy - s.y2 * F.R); g.stroke();
    }
    g.globalAlpha = 1;
  }

  comets(F, pal, L) {
    const { g, sim } = this;
    for (const b of sim.balls) {
      const x = F.cx + b.x * F.R, y = F.cy - b.y * F.R;
      let tail = this.tails.get(b.i);
      if (!tail) this.tails.set(b.i, (tail = []));
      const prev = tail[tail.length - 1];
      if (prev && Math.hypot(prev[0] - x, prev[1] - y) > F.R * 0.35) tail.length = 0; // a jump (seek), not motion
      tail.push([x, y]);
      if (tail.length > 14) tail.shift();
      const rad = Math.max(10 * F.k, (b.r || 0) * F.R) * (L.ballSize ?? 1);
      if (tail.length > 2) {
        g.lineCap = 'round';
        for (let i = 1; i < tail.length; i++) {
          const a = i / tail.length;
          g.globalAlpha = a * 0.45;
          g.strokeStyle = sim.scene ? pal.line(b.hue) : pal.ball;
          g.lineWidth = rad * 1.6 * a;
          g.beginPath(); g.moveTo(tail[i - 1][0], tail[i - 1][1]); g.lineTo(tail[i][0], tail[i][1]); g.stroke();
        }
        g.globalAlpha = 1;
      }
    }
  }

  sparks(time, F, pal) {
    const { g } = this;
    const { k, R, cx, cy } = F;
    g.globalCompositeOperation = 'lighter';
    let drawn = 0;
    for (let j = this.recent.length - 1; j >= 0 && drawn < 40; j--) {
      const e = this.recent[j];
      const age = time - e.t;
      if (age < 0 || age > 0.45 || e.x == null) continue;
      drawn++;
      const x = cx + e.x * R, y = cy - e.y * R;
      const big = e.type === 'escape' || e.type === 'fill';
      const n = big ? 22 : 9;
      for (let i = 0; i < n; i++) {
        const a = (e.angle ?? 0) + Math.PI + (i / n - 0.5) * (big ? 6.2 : 2.4) + Math.sin(e.n * 12.9 + i * 7.1) * 0.3;
        const d = age * (180 + 140 * frac(Math.sin(e.n * 3.1 + i) * 99)) * k * (big ? 2 : 1);
        g.globalAlpha = (1 - age / 0.45) * 0.9;
        g.fillStyle = pal.line(e.n * 0.03 + i * 0.02);
        g.beginPath(); g.arc(x + Math.cos(a) * d, y - Math.sin(a) * d, 3 * k * (1 - age / 0.45) + 1, 0, TAU); g.fill();
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  /** The six original circle rules. */
  paintClassic(time, F, pal, L, lastHit) {
    const { g, sim, cfg } = this;
    const { k, R, cx, cy } = F;
    const P = (x, y) => [cx + x * R, cy - y * R];

    // the segment being drawn right now (pen → ball)
    if (L.trail !== 'none' && cfg.rule !== 'polyrhythm') {
      g.lineWidth = (L.trailWidth ?? 1.6) * k * 2;
      for (const b of sim.balls) {
        const fx = cfg.rule === 'chord' ? b.from.x : b.lx, fy = cfg.rule === 'chord' ? b.from.y : b.ly;
        if (fx == null) continue;
        const [x1, y1] = P(fx, fy), [x2, y2] = P(b.x, b.y);
        g.strokeStyle = pal.line((b.hue ?? 0) + sim.hits * 0.01);
        g.globalAlpha = 0.95;
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      }
      g.globalAlpha = 1;
    }

    // rings
    const pulse = L.ringPulse ? Math.max(0, 1 - (time - lastHit) / 0.25) : 0;
    const ringW = (L.ringWidth ?? 5) * k * (1 + 0.6 * pulse);
    g.lineCap = 'round';
    const stroke = (fn, color, width, glow) => {
      g.strokeStyle = color;
      g.lineWidth = width;
      g.shadowColor = pal.glow;
      g.shadowBlur = glow * k * (L.glow ?? 1);
      g.beginPath(); fn(); g.stroke();
      g.shadowBlur = 0;
    };
    if (cfg.rule === 'escape') {
      const gap = (cfg.escape.gap * Math.PI) / 180;
      for (const r of sim.rings) {
        if (!r.alive) continue;
        const a = sim.ringAngle(r);
        // canvas angles run clockwise (y down): mirror the world angle
        stroke(() => g.arc(cx, cy, r.r * R, -(a - gap / 2), -(a + gap / 2) + Math.PI * 2, false), pal.ring, ringW * 0.9, 18);
      }
      for (const r of sim.rings) {
        if (r.alive || r.broke == null || time - r.broke > 1.2) continue;
        const age = time - r.broke;
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          const rr = r.r * R + age * 260 * k;
          g.globalAlpha = Math.max(0, 1 - age / 1.2);
          stroke(() => g.arc(cx, cy, rr, a, a + 0.18), pal.ring, ringW * 0.7, 10);
        }
        g.globalAlpha = 1;
      }
    } else if (cfg.rule === 'polyrhythm') {
      g.globalAlpha = 0.9;
      stroke(() => { g.moveTo(cx - R * 1.02, cy); g.lineTo(cx + R * 1.02, cy); }, pal.ring, ringW * 0.6, 12);
      for (const b of sim.balls) {
        let last = -9;
        for (let j = this.recent.length - 1; j >= 0; j--) if (this.recent[j].ball === b.i) { last = this.recent[j].t; break; }
        const flash = Math.max(0, 1 - (time - last) / 0.4);
        g.globalAlpha = 0.25 + 0.75 * flash;
        stroke(() => g.arc(cx, cy, b.arc * R, Math.PI, Math.PI * 2), pal.line(b.hue), (1.2 + 3 * flash) * k * 1.6, 6 + 18 * flash);
      }
      g.globalAlpha = 1;
    } else {
      stroke(() => g.arc(cx, cy, R, 0, Math.PI * 2), pal.ring, ringW, 22 + 20 * pulse);
    }

    // balls (with comet tails)
    if (L.comet) this.comets(F, pal, L);
    for (const b of sim.balls) {
      const [x, y] = P(b.x, b.y);
      const rad = Math.max(cfg.rule === 'polyrhythm' ? 9 * k : 10 * k, (b.r || 0) * R) * (L.ballSize ?? 1);
      const grad = g.createRadialGradient(x - rad * 0.3, y - rad * 0.3, rad * 0.1, x, y, rad);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, cfg.rule === 'polyrhythm' || L.palette === 'rainbow' ? pal.line(b.hue) : pal.ball);
      g.fillStyle = grad;
      g.shadowColor = pal.glow;
      g.shadowBlur = 24 * k * (L.glow ?? 1);
      g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0;
    }
  }

  /** Counter text for the overlay. */
  stats() {
    const s = this.sim;
    if (!s) return '';
    const label = (this.cfg.text?.counter || '').trim();
    let text;
    if (s.scene) text = s.scene.stats(s, s.P);
    else if (this.cfg.rule === 'escape') text = `rings left: ${s.rings.filter((r) => r.alive).length}`;
    else if (this.cfg.rule === 'split') text = `balls: ${s.balls.length}`;
    else if (this.cfg.rule === 'polyrhythm') text = `notes: ${s.hits}`;
    else text = `bounces: ${s.hits}`;
    // a custom label replaces the automatic one ("balls: 12" → "my label 12")
    if (label) text = `${label} ${text.replace(/^[^:]*:\s*/, '')}`;
    return text;
  }
}
