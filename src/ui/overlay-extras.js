/**
 * Things the text overlay draws on top of a 2D / 3D graph beyond titles and formulas:
 *
 *   legend      one row naming the layers ("— car   — 808   || kick/snare/hat"), state.overlay.legend
 *   readout     the live number of each layer that asks for one ("area = 0.319"), layer.readout
 *   axis names  a letter at the end of each axis ("t", "f"), state.overlay.axes
 *   drum ticks  a small tick under the graph for every drum hit, state.overlay.drumTicks
 *   lens        a thin circle round each pen, state.visual.marker.lens
 *
 * Everything is placed in fractions of the frame, so live view and exports match. The caller
 * (main.js overlayData) supplies what needs the scene: pens, screenOf, readouts, drumHits.
 */
import { FONTS } from './overlay.js';
import { drawMath, MATH_FONT } from './mathtext.js';

const DRUM_LANE = { kick: [0, 1], snare: [1, 0.8], clap: [1, 0.8], tom: [1, 0.6], hat: [2, 0.5], openhat: [2, 0.65], perc: [2, 0.4] };

/** Names of the drum pieces that play, for the legend: "kick/snare/hat". */
export function drumNames(drums) {
  if (!drums?.enabled) return '';
  return ['kick', 'snare', 'clap', 'hat', 'openhat', 'tom', 'perc'].filter((k) => drums[k] && drums[k] !== 'off' && (drums[k] !== 'pattern' || /[xXo]/.test(drums.patterns?.[k] || ''))).join('/');
}

/**
 * @param {CanvasRenderingContext2D} g
 * @param {object} d overlay data (see main.js overlayData)
 * @param {{legend:object|null}} rects filled with the places of what was drawn (layout editor)
 */
export function drawExtras(g, w, h, d, rects = {}) {
  const { state, ui } = d;
  if (state.mode === 'circle') return;
  const o = state.overlay, k = Math.min(w, h) / 1000, portrait = h > w * 1.05;
  const layers = (d.layers || []).filter((l) => l.enabled && !l.hidden);

  /* ----------------------------------------------------------------- lens */
  const lens = state.visual.marker?.lens || 0;
  if (lens > 0 && d.pens?.length) {
    g.save();
    g.lineWidth = Math.max(1, 1.6 * k);
    for (const p of d.pens) {
      const l = layers.find((x) => x.id === p.id);
      if (!l || !p.front) continue;
      g.strokeStyle = ui.light ? 'rgba(20,22,30,0.55)' : 'rgba(255,255,255,0.6)';
      g.beginPath(); g.arc(p.x * w, p.y * h, lens * w, 0, Math.PI * 2); g.stroke();
    }
    g.restore();
  }

  /* ----------------------------------------------------------- axis names */
  const ax = o.axes || {};
  if ((ax.x || ax.y) && d.screenOf) {
    const v = state.view, fs = 30 * k;
    g.save();
    g.fillStyle = ui.fg;
    // at the far end of each axis: the x axis is y = 0 (or the bottom edge), the y axis is x = 0 (or the left edge)
    const y0 = Math.min(Math.max(0, v.yMin), v.yMax), x0 = Math.min(Math.max(0, v.xMin), v.xMax);
    if (ax.x) { const p = d.screenOf(v.xMax, y0, 0); if (p) drawMath(g, ax.x, Math.min(w - fs, p.x * w + fs * 0.1), p.y * h + fs * 1.1, fs, { align: 'right' }); }
    if (ax.y) { const p = d.screenOf(x0, v.yMax, 0); if (p) drawMath(g, ax.y, p.x * w + fs * 0.35, Math.max(fs, p.y * h + fs * 0.9), fs); }
    g.restore();
  }

  /* ----------------------------------------------------------- drum ticks */
  if (o.drumTicks && d.drumHits?.length && d.screenOf) {
    const v = state.view, D = state.transport.duration || 1;
    const base = d.screenOf(v.xMin, v.yMin, 0), far = d.screenOf(v.xMax, v.yMin, 0);
    if (base && far) {
      g.save();
      g.strokeStyle = ui.fg;
      g.lineCap = 'butt';
      const unit = 26 * k;
      for (const e of d.drumHits) {
        const [lane, len] = DRUM_LANE[e.kind] || [2, 0.4];
        const x = (base.x + (far.x - base.x) * (e.time / D)) * w;
        const yb = base.y * h - 8 * k - lane * unit * 1.25;
        g.globalAlpha = e.time <= (d.time ?? 0) ? 1 : 0.16;
        g.lineWidth = Math.max(1, (lane === 0 ? 3 : 2) * k);
        g.beginPath(); g.moveTo(x, yb); g.lineTo(x, yb - unit * len); g.stroke();
      }
      g.restore();
    }
  }

  /* -------------------------------------------------------------- readout */
  if (d.readouts?.length) {
    const r = o.readout || {}, fs = 34 * k * (r.size || 1);
    const cx = (r.x ?? 0.5) * w;
    let y = (r.y ?? (portrait ? 0.62 : 0.86)) * h;
    g.save();
    for (const it of d.readouts) {
      drawMath(g, `\\text{${it.label}} = ${it.text}`, cx, y, fs, { align: 'center', color: d.readouts.length > 1 ? it.color : ui.fg });
      y += fs * 1.35;
    }
    g.restore();
  }

  /* --------------------------------------------------------------- legend */
  const lg = o.legend;
  if (lg?.enabled) {
    const fs = 22 * k * (lg.size || 1);
    g.save();
    g.font = `500 ${fs}px ${FONTS.mono}`;
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    const items = layers.filter((l) => l.legend !== '-').map((l) => ({ text: l.legend || l.name, color: l.color, kind: 'line' }));
    const dn = drumNames(state.drums);
    if (dn) items.push({ text: dn, color: ui.fg, kind: 'ticks' });
    const sw = fs * 1.5, gap = fs * 0.45, sep = fs * 1.3;
    const widths = items.map((it) => sw + gap + g.measureText(it.text).width);
    let total = widths.reduce((s, x) => s + x, 0) + sep * Math.max(0, items.length - 1);
    const scale = Math.min(1, (w * 0.94) / Math.max(1, total));
    if (scale < 1) { g.font = `500 ${fs * scale}px ${FONTS.mono}`; total *= scale; }
    const F = fs * scale;
    // automatic place: just under the bottom edge of the graph window (above the Shorts caption area)
    const foot = d.screenOf ? d.screenOf(state.view.xMin, state.view.yMin, 0) : null;
    const autoY = foot ? Math.min(portrait ? 0.74 : 0.955, Math.max(0.3, foot.y + 0.045)) : portrait ? 0.72 : 0.94;
    const cx = (lg.x ?? 0.5) * w, y = (lg.y ?? autoY) * h;
    let x = cx - total / 2;
    items.forEach((it, i) => {
      g.strokeStyle = it.color; g.fillStyle = it.color;
      g.lineWidth = Math.max(2, F * 0.16);
      if (it.kind === 'line') { g.beginPath(); g.moveTo(x, y - F * 0.3); g.lineTo(x + sw * scale, y - F * 0.3); g.stroke(); }
      else { g.fillRect(x + sw * scale * 0.35, y - F * 0.95, F * 0.16, F * 1.05); g.fillRect(x + sw * scale * 0.65, y - F * 0.7, F * 0.16, F * 0.8); }
      g.fillStyle = ui.fg;
      g.fillText(it.text, x + (sw + gap) * scale, y);
      x += widths[i] * scale + sep * scale;
    });
    rects.legend = { x: cx - total / 2, y: y - F, w: total, h: F * 1.4 };
    g.restore();
  }
}

export { MATH_FONT };
