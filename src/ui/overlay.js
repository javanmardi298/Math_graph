/**
 * 2D overlay drawn on top of the graph: title, formula list (with live note names),
 * the audio analyzer and free text boxes. The same function draws the on-screen
 * overlay and the overlay burned into exported videos, so what you see is what you get.
 *
 * Every element can be moved and resized. Positions are stored as fractions of the
 * frame (0..1), sizes as multipliers, so a layout made at 720p lands in the same
 * place in a 4K export. A position of null means "automatic" (the default layout).
 */
import { noteName } from '../math/music.js';

const LABEL = { function: ['y'], parametric: ['x', 'y', 'z'], polar: ['r'], surface: ['f'] };

/** Font stacks. Vazirmatn covers Persian/Arabic text in every style. */
export const FONTS = {
  display: '"Chakra Petch", "Vazirmatn", "Segoe UI", sans-serif',
  body: '"IBM Plex Sans", "Vazirmatn", "Segoe UI", Tahoma, sans-serif',
  mono: '"JetBrains Mono", "Vazirmatn", ui-monospace, monospace',
  persian: '"Vazirmatn", Tahoma, "Segoe UI", sans-serif',
};
export const FONT_LABELS = { display: 'Display', body: 'Clean', mono: 'Mono', persian: 'Persian (Vazirmatn)' };

const isRtl = (s) => /[֐-ࣿיִ-ﻼ]/.test(s);

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Opacity of a text box at time t (fades in/out over 0.25 s at the edges of its window). */
export function textAlpha(tb, t) {
  const start = Math.max(0, tb.start || 0);
  const end = tb.end > start ? tb.end : Infinity;
  if (t < start || t > end) return 0;
  const fade = 0.25;
  return Math.min(1, (t - start) / fade + (start === 0 ? 1 : 0), (end - t) / fade);
}

/**
 * @param {CanvasRenderingContext2D} g
 * @param {number} w @param {number} h  canvas size in pixels
 * @param {object} d { state, layers, notes:Map, phases:Map, spectrum, waveform, ui, time, editing }
 * @returns {{title:object|null, formulas:object|null, analyzer:object|null, texts:{id:string, rect:object, visible:boolean}[]}}
 *          element rectangles in canvas pixels, for the layout editor
 */
export function drawOverlay(g, w, h, d) {
  const { state } = d;
  const k = Math.min(w, h) / 1000; // scale with the shorter side so 9:16 looks like 16:9
  const portrait = h > w * 1.05;
  const v = state.visual;
  const o = state.overlay;
  const ui = d.ui;
  const phases = d.phases || new Map();
  const legacyCaption = v.caption !== false; // old presets: one switch for title + formulas
  const rects = { title: null, formulas: null, name: null, analyzer: null, texts: [] };
  g.save();
  g.textBaseline = 'alphabetic';

  /* ---------------------------------------------------------------- title */
  if (o.title.enabled && legacyCaption) {
    const s = o.title.size;
    const tPx = 30 * k * s, sPx = 17 * k * s;
    const title = o.title.text.trim() || state.name || 'Math Melody';
    const sub = o.title.subtitle
      ? (o.title.subtitleText.trim() || `${state.mode.toUpperCase()} · ${state.audio.scale === 'continuous' ? 'continuous pitch' : state.audio.scale}`)
      : '';
    g.font = `600 ${tPx}px ${FONTS.display}`;
    let bw = g.measureText(title).width;
    g.font = `500 ${sPx}px ${FONTS.mono}`;
    if (sub) bw = Math.max(bw, g.measureText(sub).width);
    const bh = tPx * 1.25 + (sub ? sPx * 1.6 : 0);
    const x = o.title.x == null ? 36 * k : o.title.x * w;
    const y = o.title.y == null ? 26 * k : o.title.y * h;
    g.fillStyle = o.title.color || ui.fg;
    g.globalAlpha = 0.95;
    g.font = `600 ${tPx}px ${FONTS.display}`;
    g.fillText(title, x, y + tPx);
    if (sub) {
      g.globalAlpha = 0.55;
      g.font = `500 ${sPx}px ${FONTS.mono}`;
      g.fillText(sub, x, y + tPx * 1.25 + sPx * 1.15);
    }
    rects.title = { x, y, w: bw, h: bh };
  }

  /* -------------------------------------------------------------- analyzer */
  let ana = null;
  if (v.analyzer !== 'off') {
    const s = o.analyzer.size;
    const aw = 300 * k * s, ah = 90 * k * s;
    const x = o.analyzer.x == null ? w - aw - 36 * k : o.analyzer.x * w;
    const y = o.analyzer.y == null ? (portrait ? 110 * k : h - ah - 30 * k) : o.analyzer.y * h;
    ana = { x, y, w: aw, h: ah };
    rects.analyzer = ana;
  }

  /* -------------------------------------------------------------- formulas */
  if (o.formulas.enabled && legacyCaption && !d.circle) {
    const s = o.formulas.size;
    const fs = 20 * k * s, lineH = 32 * k * s;
    const lines = d.layers.filter((l) => l.enabled && phases.get(l.id) !== 'future');
    const x = o.formulas.x == null ? 36 * k : o.formulas.x * w;
    // Leave room for an automatically placed analyzer in the same (top) corner.
    const sharesCorner = ana && o.analyzer.x == null && o.formulas.x == null && portrait;
    const maxW = Math.max(80 * k, (sharesCorner ? ana.x - 30 * k : w - 24 * k) - x);
    const bh = lines.length * lineH;
    // Automatic place: top left, under an automatically placed title.
    const autoTop = rects.title && o.title.y == null ? rects.title.y + rects.title.h + 14 * k : 26 * k;
    const y = o.formulas.y == null ? autoTop : o.formulas.y * h;
    g.font = `500 ${fs}px ${FONTS.mono}`;
    let bw = 0;
    lines.forEach((l, i) => {
      const keys = l.type === 'function' && l.exprs.z.trim() !== '0' ? ['y', 'z'] : LABEL[l.type];
      const note = d.notes.get(l.id);
      const noteText = note != null ? `  ♪ ${noteName(note)}` : '';
      let text = keys.map((key) => `${key === 'f' ? 'h' : key} = ${l.exprs[key]}`).join('   ');
      const room = maxW - 24 * k * s - g.measureText(noteText).width;
      if (g.measureText(text).width > room) {
        while (text.length > 4 && g.measureText(`${text}…`).width > room) text = text.slice(0, -1);
        text += '…';
      }
      const base = y + (i + 0.72) * lineH;
      const dim = phases.get(l.id) === 'past' ? 0.38 : 1;
      g.globalAlpha = dim;
      g.fillStyle = l.color;
      g.beginPath();
      g.arc(x + 6 * k * s, base - fs * 0.35, 6 * k * s, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = ui.fg;
      g.globalAlpha = 0.9 * dim;
      g.fillText(text, x + 24 * k * s, base);
      const tw = g.measureText(text).width;
      if (note != null && dim === 1) {
        g.fillStyle = l.color;
        g.fillText(noteText, x + 24 * k * s + tw, base);
      }
      bw = Math.max(bw, 24 * k * s + tw + (note != null ? g.measureText(noteText).width : 0));
    });
    rects.formulas = { x, y, w: Math.max(bw, 120 * k * s), h: Math.max(bh, lineH) };
  }

  /* ----------------------------------------------------------- preset name */
  if (o.name?.enabled && state.name) {
    const s = o.name.size;
    const fPx = 30 * k * s; // same size as the title
    g.font = `600 ${fPx}px ${FONTS.display}`;
    g.direction = isRtl(state.name) ? 'rtl' : 'ltr';
    const bw = g.measureText(state.name).width, bh = fPx * 1.25;
    const above = rects.formulas && o.formulas.y == null ? rects.formulas : rects.title && o.title.y == null ? rects.title : null;
    const x = o.name.x == null ? (w - bw) / 2 : o.name.x * w;
    // Circle Lab on vertical videos: start just under the Shorts top bar
    const top0 = d.circle && portrait ? Math.max(26 * k, 0.05 * h) : 26 * k;
    const y = o.name.y == null ? (above ? above.y + above.h : top0) + 12 * k : o.name.y * h;
    g.fillStyle = o.name.color || ui.fg;
    g.globalAlpha = 0.95;
    g.textAlign = 'left';
    g.fillText(state.name, x, y + fPx); // 'left' is the absolute left edge in either direction
    g.direction = 'ltr';
    rects.name = { x, y, w: bw, h: bh };
  }

  /* ---------------------------------------------------- circle lab text */
  // The rule as a formula (e.g. "angle = 1/φ² turn") and a counter, centred under the name.
  if (d.circle && o.formulas.enabled && (d.circle.formula || d.circle.stats)) {
    const s = o.formulas.size;
    let fs = 46 * k * s;
    const ss = 24 * k * s;
    const custom = o.formulas.x != null;
    const top = o.formulas.y != null ? o.formulas.y * h : (rects.name ? rects.name.y + rects.name.h + 16 * k : (portrait ? Math.max(40 * k, 0.06 * h) : 40 * k));
    g.font = `700 ${fs}px ${FONTS.display}`;
    // long formulas shrink to fit the width
    if (d.circle.formula) { const raw = g.measureText(d.circle.formula).width; if (raw > w * 0.92) { fs *= (w * 0.92) / raw; g.font = `700 ${fs}px ${FONTS.display}`; } }
    const fw = d.circle.formula ? g.measureText(d.circle.formula).width : 0;
    g.font = `500 ${ss}px ${FONTS.mono}`;
    const sw = d.circle.stats ? g.measureText(d.circle.stats).width : 0;
    const bw = Math.max(fw, sw);
    const x = custom ? o.formulas.x * w : (w - bw) / 2;
    g.textAlign = 'center';
    const cx = x + bw / 2;
    let y = top;
    if (d.circle.formula) {
      g.font = `700 ${fs}px ${FONTS.display}`;
      g.fillStyle = ui.fg;
      g.globalAlpha = 0.97;
      g.shadowColor = 'rgba(0,0,0,0.6)';
      g.shadowBlur = fs * 0.3;
      g.fillText(d.circle.formula, cx, y + fs);
      g.shadowBlur = 0;
      y += fs * 1.35;
    }
    if (d.circle.stats) {
      g.font = `500 ${ss}px ${FONTS.mono}`;
      g.globalAlpha = 0.65;
      g.fillText(d.circle.stats, cx, y + ss);
      y += ss * 1.4;
    }
    g.globalAlpha = 1;
    g.textAlign = 'left';
    rects.formulas = { x, y: top, w: bw, h: y - top };
  }

  /* ---------------------------------------------------------- draw analyzer */
  if (ana) {
    const { x: x0, y: y0, w: bw, h: bh } = ana;
    const playing = d.layers.find((l) => l.enabled && phases.get(l.id) === 'active');
    const accent = playing?.color || d.layers.find((l) => l.enabled)?.color || ui.accent;
    g.globalAlpha = 1;
    if (v.analyzer === 'spectrum' && d.spectrum) {
      const bars = 48;
      const bwid = bw / bars;
      const grad = g.createLinearGradient(0, y0 + bh, 0, y0);
      grad.addColorStop(0, accent);
      grad.addColorStop(1, ui.accent2);
      g.fillStyle = grad;
      for (let i = 0; i < bars; i++) {
        // Log-spaced bins so bass and treble get equal room.
        const lo = Math.floor(Math.pow(d.spectrum.length, i / bars));
        const hi = Math.max(lo + 1, Math.floor(Math.pow(d.spectrum.length, (i + 1) / bars)));
        let m = 0;
        for (let j = lo; j < hi && j < d.spectrum.length; j++) m = Math.max(m, d.spectrum[j]);
        const bhh = (m / 255) * bh;
        g.globalAlpha = 0.35 + 0.65 * (m / 255);
        g.fillRect(x0 + i * bwid + bwid * 0.15, y0 + bh - bhh, bwid * 0.7, bhh);
      }
    } else if (v.analyzer === 'wave' && d.waveform) {
      g.strokeStyle = accent;
      g.lineWidth = 2.5 * k * o.analyzer.size;
      g.shadowColor = accent;
      g.shadowBlur = 12 * k;
      g.beginPath();
      const n = d.waveform.length;
      for (let i = 0; i < n; i += 4) {
        const px = x0 + (i / n) * bw;
        const py = y0 + bh / 2 + ((d.waveform[i] - 128) / 128) * (bh / 2);
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.stroke();
      g.shadowBlur = 0;
    }
  }

  /* ------------------------------------------------------------- text boxes */
  for (const tb of o.texts) {
    const lines = String(tb.text || ' ').split('\n');
    const fPx = 56 * k * (tb.size || 1);
    const lineH = fPx * 1.22;
    g.font = `${tb.bold ? 700 : 500} ${fPx}px ${FONTS[tb.font] || FONTS.display}`;
    const tw = Math.max(...lines.map((l) => g.measureText(l).width), fPx);
    const pad = tb.box ? fPx * 0.4 : 0;
    const bw = tw + pad * 2, bh = lines.length * lineH + pad * 2 - (lineH - fPx) * 0.5;
    const cx = tb.x * w, cy = tb.y * h;
    const rect = { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh };
    const alpha = textAlpha(tb, d.time ?? 0);
    rects.texts.push({ id: tb.id, rect, visible: alpha > 0 });
    if (alpha <= 0) continue;
    g.globalAlpha = alpha;
    if (tb.box) {
      g.fillStyle = ui.light ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.5)';
      roundRect(g, rect.x, rect.y, bw, bh, fPx * 0.3);
      g.fill();
    }
    g.fillStyle = tb.color || ui.fg;
    if (tb.glow) { g.shadowColor = tb.color || ui.accent; g.shadowBlur = fPx * 0.45; }
    // left/right are absolute edges in canvas (only start/end flip with direction);
    // direction just makes Persian/Arabic runs shape and order correctly.
    const align = tb.align || 'center';
    g.textAlign = align;
    g.direction = lines.some(isRtl) ? 'rtl' : 'ltr';
    const ax = align === 'left' ? rect.x + pad : align === 'right' ? rect.x + bw - pad : cx;
    lines.forEach((line, i) => g.fillText(line, ax, rect.y + pad + i * lineH + fPx * 0.92));
    g.shadowBlur = 0;
    g.textAlign = 'left';
    g.direction = 'ltr';
  }

  g.restore();
  return rects;
}
