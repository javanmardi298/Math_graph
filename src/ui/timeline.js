/**
 * Bottom timeline: a mini-map of every layer's pitch over time, a draggable
 * playhead (scrubbing), and the time readout.
 */
import { store } from '../state.js';

const fmtTime = (s) => {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${String(m).padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}`;
};

export class Timeline {
  /**
   * @param {{onSeek:(u:number, final:boolean)=>void, onScrubState:(on:boolean)=>void}} cb
   */
  constructor(cb) {
    this.cb = cb;
    this.canvas = document.getElementById('timeline-canvas');
    this.g = this.canvas.getContext('2d');
    this.readout = document.getElementById('time-readout');
    this.curves = []; // [{color, ys: Float32Array (normalised 0..1)}]
    this.u = 0;
    this.dragging = false;

    const pos = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.canvas.setPointerCapture(e.pointerId);
      cb.onScrubState(true);
      cb.onSeek(pos(e), false);
    });
    this.canvas.addEventListener('pointermove', (e) => { if (this.dragging) cb.onSeek(pos(e), false); });
    const end = (e) => {
      if (!this.dragging) return;
      this.dragging = false;
      cb.onSeek(pos(e), true);
      cb.onScrubState(false);
    };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
    this.canvas.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 0.1 : 0.01;
      if (e.key === 'ArrowLeft') { cb.onSeek(Math.max(0, this.u - step), true); e.preventDefault(); }
      if (e.key === 'ArrowRight') { cb.onSeek(Math.min(1, this.u + step), true); e.preventDefault(); }
    });
    new ResizeObserver(() => this.resize()).observe(this.canvas);
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, this.canvas.clientWidth * dpr);
    this.canvas.height = Math.max(1, this.canvas.clientHeight * dpr);
    this.draw();
  }

  /** @param {{color:string, ys:Float32Array}[]} curves pitch per column, normalised to 0..1 (NaN = silent) */
  setCurves(curves) {
    this.curves = curves;
    this.draw();
  }

  setProgress(u, seconds) {
    this.u = u;
    const dur = store.state.transport.duration;
    this.readout.textContent = `${fmtTime(seconds)} / ${fmtTime(dur)}`;
    this.canvas.setAttribute('aria-valuenow', String(Math.round(u * 100)));
    this.draw();
  }

  draw() {
    const { g, canvas: c } = this;
    const w = c.width, h = c.height;
    if (!w || !h) return;
    const css = getComputedStyle(document.documentElement);
    const line = css.getPropertyValue('--line').trim() || '#333';
    const muted = css.getPropertyValue('--muted').trim() || '#888';
    const fg = css.getPropertyValue('--fg').trim() || '#fff';
    g.clearRect(0, 0, w, h);

    // Ticks: beats (bars bold, numbered) when the beat grid is on, otherwise seconds.
    const dur = store.state.transport.duration;
    const { rhythm, transport } = store.state;
    const useBeats = rhythm?.enabled;
    const unit = useBeats ? 60 / Math.max(1, transport.bpm) : 1;
    const count = Math.min(2000, Math.floor(dur / unit + 1e-9));
    g.fillStyle = line;
    g.font = `${Math.round(h * 0.16)}px "JetBrains Mono", monospace`;
    for (let i = 0; i <= count; i++) {
      const x = ((i * unit) / dur) * w;
      const major = i % 4 === 0;
      g.globalAlpha = major ? 0.9 : 0.4;
      g.fillRect(x, 0, 1, major ? h * 0.25 : h * 0.12);
      if (useBeats && major && (w / count) * 4 > 26) {
        g.globalAlpha = 0.7;
        g.fillStyle = muted;
        g.fillText(String(i / 4 + 1), x + 3, h * 0.24);
        g.fillStyle = line;
      }
    }
    g.globalAlpha = 1;

    // Pitch curves
    const pad = h * 0.18;
    for (const { color, ys } of this.curves) {
      g.strokeStyle = color;
      g.lineWidth = Math.max(1.5, h / 40);
      g.globalAlpha = 0.85;
      g.beginPath();
      let pen = false;
      for (let i = 0; i < ys.length; i++) {
        const v = ys[i];
        if (!Number.isFinite(v)) { pen = false; continue; }
        const x = (i / (ys.length - 1)) * w;
        const y = h - pad - v * (h - pad * 2);
        if (pen) g.lineTo(x, y); else g.moveTo(x, y);
        pen = true;
      }
      g.stroke();
    }
    g.globalAlpha = 1;

    // Keyframes: a diamond per key along the bottom edge.
    const tracks = store.state.keyframes?.tracks || {};
    const accent2 = css.getPropertyValue('--accent-2').trim() || '#ff3d9a';
    g.fillStyle = accent2;
    const ky = h - h * 0.12, ks = Math.max(3, h * 0.07);
    for (const keys of Object.values(tracks)) {
      for (const k of keys) {
        const x = (k.time / dur) * w;
        g.beginPath();
        g.moveTo(x, ky - ks); g.lineTo(x + ks, ky); g.lineTo(x, ky + ks); g.lineTo(x - ks, ky);
        g.fill();
      }
    }

    // Played region + playhead
    const px = this.u * w;
    g.fillStyle = fg;
    g.globalAlpha = 0.06;
    g.fillRect(0, 0, px, h);
    g.globalAlpha = 1;
    g.fillStyle = fg;
    g.fillRect(px - 1, 0, 2, h);
    g.beginPath();
    g.moveTo(px - 6, 0); g.lineTo(px + 6, 0); g.lineTo(px, 8);
    g.fill();
    g.fillStyle = muted;
  }
}
