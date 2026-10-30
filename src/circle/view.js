/**
 * Circle Lab renderer (Canvas 2D, no WebGL).
 *
 * The whole frame is used: a living background (nebula light, drifting dust that
 * sparkles with the hits, big ripples on milestones, a vignette) fills everything,
 * the simulations fill the safe area between the Shorts title and caption zones
 * (layout.js), and a soft bloom pass makes every bright thing glow.
 *
 * Several layers can play one after another or together (stack.js). Each layer keeps
 * its own CircleSim in step with its own clock: playing forward just advances it,
 * jumping back replays it from its start. Permanent trails and dots are drawn once onto
 * the layer's "ink" canvas, so hundreds of thousands of them cost nothing per frame.
 */
import { cameraMove } from '../camera-moves.js';
import { CircleSim, DT } from './sim.js';
import { pixelFrame } from './layout.js';
import { PALETTES, CIRCLE_PALETTES, frac, hexA, paletteOf } from './palettes.js';
import { circleSchedule, visibleAt, headlineAt } from './stack.js';

export { CIRCLE_PALETTES, PALETTES };

const TAU = Math.PI * 2;
const NO_SPARKS = new Set(['rps', 'predator', 'knives', 'popper', 'pendulum', 'sorting', 'tree', 'dna', 'times', 'chaos', 'phyllo', 'harmono', 'orbits', 'spiro', 'packing', 'paper', 'mitosis', 'coral', 'snowflake', 'galton', 'pyramid', 'pachinko', 'beatfill',
  // vibration & waves: their notes are not hits at a place
  'chladni', 'tubes', 'ripple', 'filings', 'string', 'travel', 'fourier', 'beats', 'scope', 'doppler',
  'fdraw', 'tangent', 'riemann', 'taylor', 'unitcircle', 'archimedes', 'montecarlo', 'buffon', 'series', 'pidigits', 'mandel', 'lsystem', 'harmonograph', 'spirograph', 'guilloche']);

/** One layer's simulation and its permanent ink. */
class LayerView {
  constructor() {
    this.ink = document.createElement('canvas');
    this.ig = this.ink.getContext('2d');
    this.sim = null;
    this.cfg = null;
    this.recent = [];
    this.tails = new Map();
    this.inked = 0;
    this.inkedDots = 0;
  }

  reset(cfg, env) {
    this.cfg = cfg;
    this.sim = new CircleSim(cfg, env);
    this.inked = 0; this.inkedDots = 0;
    this.recent = [];
    this.tails.clear();
    this.ig.clearRect(0, 0, this.ink.width, this.ink.height);
  }

  size(w, h) {
    if (this.ink.width !== w || this.ink.height !== h) { this.ink.width = w; this.ink.height = h; this.sim = null; }
  }
}

export class CircleView {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'circle-canvas';
    this.g = this.canvas.getContext('2d');
    this.glow = document.createElement('canvas');
    this.gg = this.glow.getContext('2d');
    this.scratch = document.createElement('canvas');
    this.canFilter = 'filter' in this.gg;
    this.layers = new Map(); // layer id → LayerView
    this.c = null;
    this.dirty = true;
    this.schedule = [];
    this.time = 0;
  }

  /** Settings changed: start over on the next frame. */
  invalidate() { this.dirty = true; }

  ensureSize(w, h) {
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }

  /** Pixel mapping of a layer (zoom and position are per layer). */
  frameOf(cfg) {
    const { width: w, height: h } = this.canvas;
    const L = cfg.look || {};
    const F = pixelFrame(w, h, L.zoom ?? 1);
    const base = F.R / (L.zoom ?? 1);
    F.cx += (L.dx || 0) * base; F.cy -= (L.dy || 0) * base;
    return F;
  }

  /**
   * Draw every layer at `time` and return the events that happened since the last call
   * (only when moving forward), per layer, for live sound: [{ id, cfg, events }].
   * @param {{snap?:boolean, width:number, height:number, env?:{duration:number,bpm:number,ratio:number}}} o
   */
  renderAt(time, c, { snap = false, width, height, env = {}, camera = null, progress = 0, duration = 0, bpm = 120 } = {}) {
    this.ensureSize(width, height);
    const envKey = `${env.duration}|${env.bpm}|${env.ratio}`;
    if (c !== this.c || envKey !== this.envKey) { this.c = c; this.envKey = envKey; this.dirty = true; }
    const schedule = circleSchedule(c, env.duration ?? 30);
    if (this.dirty) {
      this.dirty = false;
      for (const lv of this.layers.values()) lv.sim = null;
      const ids = new Set(schedule.map((s) => s.layer.id));
      for (const id of [...this.layers.keys()]) if (!ids.has(id)) this.layers.delete(id);
    }
    this.schedule = schedule;
    this.time = time;
    const out = [];
    const shown = visibleAt(schedule, time);
    for (const s of shown) {
      let lv = this.layers.get(s.layer.id);
      if (!lv) this.layers.set(s.layer.id, (lv = new LayerView()));
      lv.size(width, height);
      const cfg = s.layer.cfg;
      const lenv = { ...env, duration: s.end - s.start };
      if (!lv.sim || lv.cfg !== cfg || s.local < lv.sim.t - DT * 2 || (snap && s.local < lv.sim.t)) lv.reset(cfg, lenv);
      const jumping = s.local - lv.sim.t > 0.5; // a seek: don't flood sound and sparks
      const fresh = [];
      lv.sim.advance(s.local, (e) => { if (!jumping && s.alpha > 0.5) fresh.push({ ...e, t: e.t + s.start }); lv.recent.push(e); });
      const cut = s.local - 1.3;
      if (lv.recent.length && lv.recent[0].t < cut) lv.recent = lv.recent.filter((e) => e.t > cut);
      if (lv.recent.length > 600) lv.recent = lv.recent.slice(-600);
      if (fresh.length) out.push({ id: s.layer.id, cfg, events: fresh });
    }
    this.paint(time, c, shown);
    if (camera) this.cameraMove(camera, { time, progress, bpm, duration });
    return out;
  }

  /* --------------------------------------------------------------- paint */

  inkLayer(lv, F) {
    const { sim, ig } = lv;
    const L = lv.cfg.look, pal = paletteOf(L.palette);
    const { k, R, cx, cy } = F;
    const segs = sim.segments;
    if (L.trail === 'lines' && lv.inked < segs.length) {
      const lw = (L.trailWidth ?? 1.6) * k * 1.6;
      ig.lineCap = 'round';
      for (let i = lv.inked; i < segs.length; i++) {
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
      lv.inked = segs.length;
    }
    const dots = sim.dots;
    if (lv.inkedDots < dots.length) {
      for (let i = lv.inkedDots; i < dots.length; i++) {
        const d = dots[i], r = d.s * k;
        ig.globalAlpha = d.a;
        ig.fillStyle = pal.line(d.hue);
        if (r < 1.2) ig.fillRect(cx + d.x * R - r, cy - d.y * R - r, r * 2, r * 2);
        else { ig.beginPath(); ig.arc(cx + d.x * R, cy - d.y * R, r, 0, TAU); ig.fill(); }
      }
      ig.globalAlpha = 1;
      lv.inkedDots = dots.length;
    }
  }

  /** Recent activity of the visible layers, 0..1 (drives the background sparkle). */
  energy(shown) {
    let n = 0;
    for (const s of shown) {
      const lv = this.layers.get(s.layer.id);
      if (!lv) continue;
      for (let i = lv.recent.length - 1; i >= 0 && lv.recent[i].t > s.local - 0.5; i--) n++;
    }
    return Math.min(1, n / 6);
  }

  background(time, F, pal, L, energy, shown) {
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
    // ripples across the whole frame on big moments, and when a new step starts
    for (const s of shown) {
      const lv = this.layers.get(s.layer.id);
      if (!lv?.sim) continue;
      const LF = this.frameOf(s.layer.cfg);
      const rings = lv.recent.filter((e) => e.type === 'fill' || (e.type === 'escape' && !lv.sim.scene)).map((e) => [e.t, e.x ?? 0, e.y ?? 0]);
      if (s.start > 0) rings.push([0, 0, 0]);
      for (const [t, x, y] of rings) {
        const age = s.local - t;
        if (age < 0 || age > 1.3) continue;
        g.globalAlpha = 0.35 * (1 - age / 1.3);
        g.strokeStyle = pal.ring; g.lineWidth = Math.max(1, (6 - 4 * age) * k);
        g.beginPath(); g.arc(LF.cx + x * LF.R, LF.cy - y * LF.R, age * 1100 * k, 0, TAU); g.stroke();
      }
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

  /** Camera moves (zoom, push, drift, shake, sway, spin): the finished frame is redrawn moved. */
  cameraMove(cam, at) {
    const mv = cameraMove(cam, at);
    const roll = ((cam.roll || 0) + mv.roll) * Math.PI / 180;
    if (!mv.active && !roll) return;
    const { canvas: cv, g } = this, { width: w, height: h } = cv;
    const sc = this.moved || (this.moved = document.createElement('canvas'));
    if (sc.width !== w || sc.height !== h) { sc.width = w; sc.height = h; }
    const sg = sc.getContext('2d');
    sg.globalCompositeOperation = 'copy';
    sg.drawImage(cv, 0, 0);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.fillStyle = this.c?.look?.background || '#000';
    g.fillRect(0, 0, w, h);
    g.translate(w / 2 + mv.dx * w, h / 2 + mv.dy * h);
    g.rotate(roll);
    g.scale(mv.zoom, mv.zoom);
    g.drawImage(sc, -w / 2, -h / 2);
    g.restore();
  }

  paint(time, c, shown) {
    const { g } = this;
    const L0 = c.look, pal0 = paletteOf(L0.palette);
    const F0 = this.frameOf(c);
    this.background(time, F0, pal0, L0, this.energy(shown), shown);
    for (const s of shown) {
      const lv = this.layers.get(s.layer.id);
      if (!lv?.sim) continue;
      if (s.alpha >= 0.999) { this.paintLayer(g, lv, s.local); continue; }
      // fading: draw the layer on its own, then blend it in with a slight zoom
      const sc = this.scratch;
      if (sc.width !== this.canvas.width || sc.height !== this.canvas.height) { sc.width = this.canvas.width; sc.height = this.canvas.height; }
      const sg = sc.getContext('2d');
      sg.setTransform(1, 0, 0, 1, 0, 0);
      sg.globalAlpha = 1; sg.globalCompositeOperation = 'source-over';
      sg.clearRect(0, 0, sc.width, sc.height);
      this.paintLayer(sg, lv, s.local);
      g.globalAlpha = s.alpha;
      const z = 0.94 + 0.06 * s.alpha;
      g.drawImage(sc, (sc.width * (1 - z)) / 2, (sc.height * (1 - z)) / 2, sc.width * z, sc.height * z);
      g.globalAlpha = 1;
    }
    this.vignette(F0);
    this.bloom(F0, L0);
  }

  /** One layer: ink, the simulation, sparks. */
  paintLayer(g, lv, time) {
    const { sim } = lv;
    const cfg = lv.cfg, L = cfg.look, pal = paletteOf(L.palette);
    const F = this.frameOf(cfg);
    this.inkLayer(lv, F);
    if (L.trail === 'lines' || sim.dots.length) g.drawImage(lv.ink, 0, 0);
    if (L.trail === 'fade') this.fadeTrails(g, lv, time, F, pal, L);
    const lastHit = lv.recent.length ? lv.recent[lv.recent.length - 1].t : -9;
    if (sim.scene) {
      const D = {
        g, X: (x) => F.cx + x * F.R, Y: (y) => F.cy - y * F.R, R: F.R, k: F.k, pal, look: L, time, lastHit, energy: 0,
        underBalls: () => { if (L.comet && sim.balls.length <= 40) this.comets(g, lv, F, pal, L); },
      };
      g.save();
      sim.scene.draw(sim, sim.P, D);
      g.restore();
    } else {
      this.paintClassic(g, lv, time, F, pal, L, lastHit);
    }
    if (L.sparks && !NO_SPARKS.has(cfg.rule)) this.sparks(g, lv, time, F, pal);
  }

  fadeTrails(g, lv, time, F, pal, L) {
    const segs = lv.sim.segments, from = time - 2.5;
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

  comets(g, lv, F, pal, L) {
    const { sim } = lv;
    for (const b of sim.balls) {
      const x = F.cx + b.x * F.R, y = F.cy - b.y * F.R;
      let tail = lv.tails.get(b.i);
      if (!tail) lv.tails.set(b.i, (tail = []));
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

  sparks(g, lv, time, F, pal) {
    const { k, R, cx, cy } = F;
    g.globalCompositeOperation = 'lighter';
    let drawn = 0;
    for (let j = lv.recent.length - 1; j >= 0 && drawn < 40; j--) {
      const e = lv.recent[j];
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
  paintClassic(g, lv, time, F, pal, L, lastHit) {
    const { sim, cfg } = lv;
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
        for (let j = lv.recent.length - 1; j >= 0; j--) if (lv.recent[j].ball === b.i) { last = lv.recent[j].t; break; }
        const flash = Math.max(0, 1 - (time - last) / 0.4);
        g.globalAlpha = 0.25 + 0.75 * flash;
        stroke(() => g.arc(cx, cy, b.arc * R, Math.PI, Math.PI * 2), pal.line(b.hue), (1.2 + 3 * flash) * k * 1.6, 6 + 18 * flash);
      }
      g.globalAlpha = 1;
    } else {
      stroke(() => g.arc(cx, cy, R, 0, Math.PI * 2), pal.ring, ringW, 22 + 20 * pulse);
    }

    // balls (with comet tails)
    if (L.comet) this.comets(g, lv, F, pal, L);
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

  /** The layer whose text and counter are on screen now. */
  headline() {
    if (!this.schedule.length) return null;
    const s = headlineAt(this.schedule, this.time);
    return s ? { cfg: s.layer.cfg, lv: this.layers.get(s.layer.id) } : null;
  }

  /** Counter text for the overlay. */
  stats() {
    const hd = this.headline();
    const s = hd?.lv?.sim;
    if (!s) return '';
    const cfg = hd.cfg;
    const label = (cfg.text?.counter || this.c?.text?.counter || '').trim();
    let text;
    if (s.scene) text = s.scene.stats(s, s.P);
    else if (cfg.rule === 'escape') text = `rings left: ${s.rings.filter((r) => r.alive).length}`;
    else if (cfg.rule === 'split') text = `balls: ${s.balls.length}`;
    else if (cfg.rule === 'polyrhythm') text = `notes: ${s.hits}`;
    else text = `bounces: ${s.hits}`;
    // a custom label replaces the automatic one ("balls: 12" → "my label 12")
    if (label) text = `${label} ${text.replace(/^[^:]*:\s*/, '')}`;
    return text;
  }
}
