/**
 * Bottom timeline: a mini-map of every layer's pitch over time, a draggable
 * playhead (scrubbing), and the time readout.
 */
import { store } from '../state.js';
import { LANES, laneOf, keyframeTimes, pathsAt, moveKeyframe, deleteKeyframe, evaluate } from '../anim/keyframes.js';
import { selection, select, clearSelection, onSelect } from '../anim/selection.js';

const BASE_H = 56; // CSS px: ruler + pitch curves
const LANE_H = 14; // CSS px per keyframe row
const HIT = 8; // CSS px: how close to a diamond counts as on it

const fmtTime = (s) => {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${String(m).padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}`;
};

export class Timeline {
  /**
   * @param {{onSeek:(u:number, final:boolean)=>void, onScrubState:(on:boolean)=>void,
   *          keysChanged?:(final:boolean)=>void, addKeyframeAt?:(time:number, lane:string)=>void}} cb
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
    this.keyDrag = null;
    this.canvas.addEventListener('pointerdown', (e) => {
      this.canvas.setPointerCapture(e.pointerId);
      const hit = this.keyAt(e);
      if (hit) {
        // grab a keyframe: select it, move the playhead onto it, drag to retime
        this.keyDrag = { ...hit, moved: false };
        select(hit.time, hit.lane);
        cb.onScrubState(true);
        cb.onSeek(Math.min(1, hit.time / this.duration()), false);
        return;
      }
      this.dragging = true;
      cb.onScrubState(true);
      cb.onSeek(pos(e), false);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.keyDrag) {
        const k = this.keyDrag;
        const t = this.snap(pos(e) * this.duration(), e);
        if (Math.abs(t - k.time) < 1e-6) return;
        const keys = store.state.keyframes.tracks;
        k.time = moveKeyframe(keys, k.time, t, k.lane, this.duration());
        k.moved = true;
        select(k.time, k.lane);
        cb.keysChanged?.(false);
        cb.onSeek(Math.min(1, k.time / this.duration()), false);
      } else if (this.dragging) cb.onSeek(pos(e), false);
      else this.hover(e);
    });
    const end = (e) => {
      if (this.keyDrag) {
        const moved = this.keyDrag.moved;
        this.keyDrag = null;
        cb.onSeek(Math.min(1, selection.time / this.duration()), true);
        cb.onScrubState(false);
        if (moved) cb.keysChanged?.(true);
        return;
      }
      if (!this.dragging) return;
      this.dragging = false;
      cb.onSeek(pos(e), true);
      cb.onScrubState(false);
    };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
    // double-click on a keyframe row: add a keyframe there (a full one on the top row, that lane's on the others)
    this.canvas.addEventListener('dblclick', (e) => {
      const lane = this.laneAtY(e);
      if (lane == null || this.keyAt(e)) return;
      const t = this.snap(pos(e) * this.duration(), e);
      cb.addKeyframeAt?.(t, lane);
    });
    this.canvas.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 0.1 : 0.01;
      if (e.key === 'ArrowLeft') { cb.onSeek(Math.max(0, this.u - step), true); e.preventDefault(); }
      if (e.key === 'ArrowRight') { cb.onSeek(Math.min(1, this.u + step), true); e.preventDefault(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection.time != null) {
        deleteKeyframe(store.state.keyframes.tracks, selection.time, selection.lane);
        clearSelection();
        cb.keysChanged?.(true);
        e.preventDefault();
      }
    });
    this.unsub = onSelect(() => this.draw());
    new ResizeObserver(() => this.resize()).observe(this.canvas);
    this.resize();
  }

  duration() { return Math.max(0.001, store.state.transport.duration); }

  /** Rows under the ruler: the merged "All" row, then one per lane that has keys. */
  lanes() {
    const tracks = store.state.keyframes?.tracks || {};
    const used = new Set(Object.keys(tracks).filter((p) => tracks[p]?.length).map(laneOf));
    return ['all', ...LANES.filter((l) => used.has(l))];
  }

  /** Move to the nearest 0.05 s (Alt = free, close to the playhead = the playhead). */
  snap(t, e) {
    const dur = this.duration();
    if (e?.altKey) return Math.min(dur, Math.max(0, t));
    const ph = this.u * dur;
    if (Math.abs(t - ph) < dur * 0.006) return ph;
    return Math.min(dur, Math.max(0, Math.round(t / 0.05) * 0.05));
  }

  /** Which row the pointer is on (null above the rows). */
  laneAtY(e) {
    const r = this.canvas.getBoundingClientRect();
    const y = e.clientY - r.top - BASE_H;
    if (y < 0) return null;
    return this.lanes()[Math.floor(y / LANE_H)] ?? null;
  }

  /** The keyframe diamond under the pointer, { lane, time } or null. */
  keyAt(e) {
    const lane = this.laneAtY(e);
    if (lane == null) return null;
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const tracks = store.state.keyframes?.tracks || {};
    let best = null;
    for (const t of keyframeTimes(tracks, lane)) {
      const d = Math.abs((t / this.duration()) * r.width - x);
      if (d <= HIT && (!best || d < best.d)) best = { lane, time: t, d };
    }
    return best;
  }

  hover(e) {
    const hit = this.keyAt(e);
    this.canvas.style.cursor = hit ? 'grab' : this.laneAtY(e) != null ? 'copy' : '';
    if (!hit) { this.canvas.title = this.laneAtY(e) != null ? 'Double-click: add a keyframe here' : ''; return; }
    const tracks = store.state.keyframes.tracks;
    const names = [...new Set(pathsAt(tracks, hit.time, hit.lane).map(laneOf))];
    this.canvas.title = `Keyframe at ${hit.time.toFixed(2)} s: ${pathsAt(tracks, hit.time, hit.lane).length} values (${names.join(', ')}). Drag to move, Delete to remove`;
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
    const lanes = this.lanes();
    if (lanes.length !== this.rows) { // the rows grew or shrank: the resize observer redraws
      this.rows = lanes.length;
      c.style.height = `${BASE_H + lanes.length * LANE_H}px`;
    }
    const w = c.width, h = c.height;
    if (!w || !h) return;
    const dpr = c.clientHeight ? h / c.clientHeight : 1;
    const bh = BASE_H * dpr, lh = LANE_H * dpr; // ruler + curves zone, one keyframe row
    const css = getComputedStyle(document.documentElement);
    const line = css.getPropertyValue('--line').trim() || '#333';
    const muted = css.getPropertyValue('--muted').trim() || '#888';
    const fg = css.getPropertyValue('--fg').trim() || '#fff';
    const accent2 = css.getPropertyValue('--accent-2').trim() || '#ff3d9a';
    g.clearRect(0, 0, w, h);

    // Ticks: beats (bars bold, numbered) when the beat grid is on, otherwise seconds.
    const dur = store.state.transport.duration;
    const { rhythm, transport } = store.state;
    const useBeats = rhythm?.enabled;
    const unit = useBeats ? 60 / Math.max(1, transport.bpm) : 1;
    const count = Math.min(2000, Math.floor(dur / unit + 1e-9));
    g.fillStyle = line;
    g.font = `${Math.round(bh * 0.16)}px "JetBrains Mono", monospace`;
    for (let i = 0; i <= count; i++) {
      const x = ((i * unit) / dur) * w;
      const major = i % 4 === 0;
      g.globalAlpha = major ? 0.9 : 0.4;
      g.fillRect(x, 0, 1, major ? bh * 0.25 : bh * 0.12);
      if (useBeats && major && (w / count) * 4 > 26) {
        g.globalAlpha = 0.7;
        g.fillStyle = muted;
        g.fillText(String(i / 4 + 1), x + 3, bh * 0.24);
        g.fillStyle = line;
      }
    }
    g.globalAlpha = 1;

    // Pitch curves
    const pad = bh * 0.18;
    for (const { color, ys } of this.curves) {
      g.strokeStyle = color;
      g.lineWidth = Math.max(1.5, bh / 40);
      g.globalAlpha = 0.85;
      g.beginPath();
      let pen = false;
      for (let i = 0; i < ys.length; i++) {
        const v = ys[i];
        if (!Number.isFinite(v)) { pen = false; continue; }
        const x = (i / (ys.length - 1)) * w;
        const y = bh - pad - v * (bh - pad * 2);
        if (pen) g.lineTo(x, y); else g.moveTo(x, y);
        pen = true;
      }
      g.stroke();
    }
    g.globalAlpha = 1;

    // Keyframe rows: one diamond per moment; the top row merges every property.
    const tracks = store.state.keyframes?.tracks || {};
    const ks = Math.max(3, lh * 0.32);
    g.textBaseline = 'middle';
    lanes.forEach((lane, row) => {
      const top = bh + row * lh, cy = top + lh / 2;
      g.fillStyle = line;
      g.globalAlpha = row % 2 ? 0.16 : 0.3;
      g.fillRect(0, top, w, lh);
      g.globalAlpha = 0.75;
      g.fillStyle = muted;
      g.font = `${Math.round(lh * 0.62)}px "JetBrains Mono", monospace`;
      const times = keyframeTimes(tracks, lane);
      if (lane === 'Speed') this.drawSpeed(top, lh, w);
      g.fillText(!times.length && lane === 'all' ? 'Keyframes: double-click here to add one' : lane === 'all' ? 'Keyframes' : lane, 6 * dpr, cy);
      g.globalAlpha = 1;
      for (const t of times) {
        const x = (t / dur) * w;
        const on = selection.time != null && Math.abs(selection.time - t) < 0.03 && (selection.lane === lane || selection.lane === 'all' || lane === 'all');
        const r = on ? ks * 1.3 : ks;
        g.beginPath();
        g.moveTo(x, cy - r); g.lineTo(x + r, cy); g.lineTo(x, cy + r); g.lineTo(x - r, cy);
        g.closePath();
        g.fillStyle = on ? fg : accent2;
        g.fill();
        if (on) { g.strokeStyle = accent2; g.lineWidth = Math.max(1, dpr); g.stroke(); }
      }
    });

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

  /** A faint curve of the playback speed across the Speed row. */
  drawSpeed(top, lh, w) {
    const keys = store.state.keyframes?.tracks?.['transport.speed'];
    if (!keys?.length) return;
    const g = this.g, dur = this.duration();
    g.save();
    g.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#22e4ff';
    g.globalAlpha = 0.8;
    g.lineWidth = Math.max(1, lh / 12);
    g.beginPath();
    const N = Math.min(240, Math.floor(w / 3));
    for (let i = 0; i <= N; i++) {
      const v = evaluate(keys, (i / N) * dur); // 0.1 .. 5 on a log scale
      const y = top + lh - 2 - ((Math.log(Math.min(5, Math.max(0.1, v))) - Math.log(0.1)) / (Math.log(5) - Math.log(0.1))) * (lh - 4);
      if (i) g.lineTo((i / N) * w, y); else g.moveTo(0, y);
    }
    g.stroke();
    g.restore();
  }
}
