/**
 * Circle Lab renderer (Canvas 2D, no WebGL): neon rings, glowing trails that build up
 * into the final pattern, comet tails, impact sparks and ring pulses.
 *
 * It keeps a CircleSim in step with the timeline: playing forward just advances it,
 * jumping back replays it from t = 0 (it's fast: a 30 s clip is ~7,000 steps). Trails are
 * drawn once onto an "ink" canvas, so thousands of chords cost nothing per frame.
 */
import { CircleSim, DT } from './sim.js';

const PALETTES = {
  neon: { ring: '#9ff6ff', glow: '#22e4ff', ball: '#cfe9ff', line: (h) => `hsl(${195 + 50 * frac(h)} 90% 66%)` },
  rainbow: { ring: '#ffffff', glow: '#b48cff', ball: '#ffffff', line: (h) => `hsl(${360 * frac(h)} 95% 62%)` },
  sunset: { ring: '#ffd9a8', glow: '#ff6b8b', ball: '#fff1dc', line: (h) => `hsl(${(330 + 70 * frac(h)) % 360} 95% 64%)` },
  gold: { ring: '#ffe7a3', glow: '#ffb340', ball: '#fff4cf', line: (h) => `hsl(${38 + 14 * frac(h)} 95% ${55 + 15 * frac(h * 3)}%)` },
  mono: { ring: '#ffffff', glow: '#9fb4ff', ball: '#ffffff', line: () => 'rgba(235,240,255,0.95)' },
  aurora: { ring: '#c9ffe8', glow: '#3dffb0', ball: '#e9fff6', line: (h) => `hsl(${140 + 140 * frac(h)} 85% 62%)` },
};
export const CIRCLE_PALETTES = { neon: 'Neon blue', rainbow: 'Rainbow', sunset: 'Sunset', gold: 'Gold', aurora: 'Aurora', mono: 'White ink' };

function frac(x) { return x - Math.floor(x); }

export class CircleView {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'circle-canvas';
    this.g = this.canvas.getContext('2d');
    this.ink = document.createElement('canvas');
    this.ig = this.ink.getContext('2d');
    this.cfg = null;
    this.sim = null;
    this.inked = 0;
    this.recent = []; // events of the last second (sparks, pulses)
    this.tails = new Map();
  }

  /** Settings changed: start over on the next frame. */
  invalidate() { this.sim = null; }

  ensureSize(w, h) {
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
      this.ink.width = w; this.ink.height = h;
      this.inked = 0;
      this.ig.clearRect(0, 0, w, h);
    }
  }

  /** Pixel mapping of the unit circle. */
  frame() {
    const { width: w, height: h } = this.canvas;
    const L = this.cfg.look;
    const k = Math.min(w, h) / 1000;
    // Landscape frames: a bit smaller and lower, leaving room for the text above.
    const wide = w > h * 1.05;
    const R = Math.min(w, h) * (L.size ?? 0.43) * (wide ? 0.8 : 1);
    return { w, h, k, R, cx: w / 2, cy: wide ? h * 0.57 : h * (L.center ?? 0.47) };
  }

  /**
   * Draw the simulation at `time` and return the events that happened since the last
   * call (only when moving forward), for live sound.
   */
  renderAt(time, cfg, { snap = false, width, height } = {}) {
    if (cfg !== this.cfg || !this.sim) { this.cfg = cfg; this.sim = null; }
    this.ensureSize(width, height);
    const fresh = [];
    if (!this.sim || time < this.sim.t - DT * 2 || snap && time < this.sim.t) {
      this.sim = new CircleSim(cfg);
      this.inked = 0;
      this.recent = [];
      this.tails.clear();
      this.ig.clearRect(0, 0, this.ink.width, this.ink.height);
    }
    const jumping = time - this.sim.t > 0.5; // a seek: don't flood sound and sparks
    this.sim.advance(time, (e) => { if (!jumping) fresh.push(e); this.recent.push(e); });
    this.recent = this.recent.filter((e) => e.t > time - 1);
    this.paint(time);
    return fresh;
  }

  inkSegments() {
    const { sim, ig } = this;
    const L = this.cfg.look, pal = PALETTES[L.palette] || PALETTES.neon;
    const { k, R, cx, cy } = this.frame();
    const segs = sim.segments;
    if (L.trail !== 'lines' || this.inked >= segs.length) return;
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

  paint(time) {
    const { g, sim, cfg } = this;
    const L = cfg.look, pal = PALETTES[L.palette] || PALETTES.neon;
    const { w, h, k, R, cx, cy } = this.frame();
    const P = (x, y) => [cx + x * R, cy - y * R];

    // background with a soft glow behind the circle
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = L.background || '#060814';
    g.fillRect(0, 0, w, h);
    const bg = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.6);
    bg.addColorStop(0, hexA(pal.glow, 0.10));
    bg.addColorStop(1, hexA(pal.glow, 0));
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);

    // trails
    if (L.trail === 'lines') {
      this.inkSegments();
      g.drawImage(this.ink, 0, 0);
    } else if (L.trail === 'fade') {
      const segs = sim.segments, from = time - 2.5;
      g.lineCap = 'round';
      for (let i = segs.length - 1; i >= 0 && segs[i].t > from; i--) {
        const s = segs[i], a = 1 - (time - s.t) / 2.5;
        const [x1, y1] = P(s.x1, s.y1), [x2, y2] = P(s.x2, s.y2);
        g.globalAlpha = a * 0.9;
        g.strokeStyle = pal.line(s.hue);
        g.lineWidth = (L.trailWidth ?? 1.6) * k * 1.6;
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      }
      g.globalAlpha = 1;
    }

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
    const lastHit = this.recent.length ? this.recent[this.recent.length - 1].t : -9;
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
      // shards of rings that just broke
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
        const hitAge = time - (this.recent.filter((e) => e.ball === b.i).pop()?.t ?? -9);
        const flash = Math.max(0, 1 - hitAge / 0.4);
        g.globalAlpha = 0.25 + 0.75 * flash;
        stroke(() => g.arc(cx, cy, b.arc * R, Math.PI, Math.PI * 2), pal.line(b.hue), (1.2 + 3 * flash) * k * 1.6, 6 + 18 * flash);
      }
      g.globalAlpha = 1;
    } else {
      stroke(() => g.arc(cx, cy, R, 0, Math.PI * 2), pal.ring, ringW, 22 + 20 * pulse);
    }

    // balls (with comet tails)
    for (const b of sim.balls) {
      const [x, y] = P(b.x, b.y);
      let tail = this.tails.get(b.i);
      if (!tail) this.tails.set(b.i, (tail = []));
      const prev = tail[tail.length - 1];
      if (prev && Math.hypot(prev[0] - x, prev[1] - y) > R * 0.35) tail.length = 0; // a jump (seek), not motion
      tail.push([x, y]);
      if (tail.length > 14) tail.shift();
      const rad = Math.max(cfg.rule === 'polyrhythm' ? 9 * k : 10 * k, (b.r || 0) * R) * (L.ballSize ?? 1);
      if (L.comet && tail.length > 2) {
        for (let i = 1; i < tail.length; i++) {
          const a = i / tail.length;
          g.globalAlpha = a * 0.45;
          g.strokeStyle = pal.ball;
          g.lineWidth = rad * 1.6 * a;
          g.beginPath(); g.moveTo(tail[i - 1][0], tail[i - 1][1]); g.lineTo(tail[i][0], tail[i][1]); g.stroke();
        }
        g.globalAlpha = 1;
      }
      const grad = g.createRadialGradient(x - rad * 0.3, y - rad * 0.3, rad * 0.1, x, y, rad);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, cfg.rule === 'polyrhythm' || cfg.look.palette === 'rainbow' ? pal.line(b.hue) : pal.ball);
      g.fillStyle = grad;
      g.shadowColor = pal.glow;
      g.shadowBlur = 24 * k * (L.glow ?? 1);
      g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0;
    }

    // sparks at impacts
    if (L.sparks) {
      g.globalCompositeOperation = 'lighter';
      for (const e of this.recent) {
        const age = time - e.t;
        if (age < 0 || age > 0.45) continue;
        const [x, y] = P(e.x, e.y);
        const n = e.type === 'escape' || e.type === 'fill' ? 22 : 9;
        for (let i = 0; i < n; i++) {
          const a = (e.angle ?? 0) + Math.PI + (i / n - 0.5) * (e.type === 'escape' ? 6.2 : 2.4) + Math.sin(e.n * 12.9 + i * 7.1) * 0.3;
          const d = age * (180 + 140 * frac(Math.sin(e.n * 3.1 + i) * 99)) * k * (e.type === 'escape' ? 2 : 1);
          g.globalAlpha = (1 - age / 0.45) * 0.9;
          g.fillStyle = pal.line(e.n * 0.03 + i * 0.02);
          g.beginPath(); g.arc(x + Math.cos(a) * d, y - Math.sin(a) * d, 3 * k * (1 - age / 0.45) + 1, 0, Math.PI * 2); g.fill();
        }
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
  }

  /** Text lines for the overlay: counters. */
  stats() {
    const s = this.sim;
    if (!s) return '';
    const balls = s.balls.length;
    if (this.cfg.rule === 'escape') return `rings left: ${s.rings.filter((r) => r.alive).length}`;
    if (this.cfg.rule === 'split') return `balls: ${balls}`;
    if (this.cfg.rule === 'polyrhythm') return `notes: ${s.hits}`;
    return `bounces: ${s.hits}`;
  }
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
