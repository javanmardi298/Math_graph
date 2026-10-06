/**
 * 2D overlay drawn on top of the graph: formula captions, live note names and
 * the audio analyzer. The same function draws the on-screen overlay and the
 * overlay burned into recorded videos, so what you see is what you export.
 */
import { noteName } from '../math/music.js';

const LABEL = { function: ['y'], parametric: ['x', 'y', 'z'], polar: ['r'], surface: ['f'] };

/**
 * @param {CanvasRenderingContext2D} g
 * @param {number} w @param {number} h  canvas size in pixels
 * @param {{state, layers, notes:Map, spectrum:Uint8Array|null, waveform:Uint8Array|null, time:number, ui:object}} d
 */
export function drawOverlay(g, w, h, d) {
  const { state } = d;
  const k = h / 1000;
  const v = state.visual;
  const ui = d.ui;
  g.save();
  g.textBaseline = 'alphabetic';

  if (v.caption) {
    // Title
    g.font = `600 ${Math.round(30 * k)}px "Chakra Petch", "JetBrains Mono", sans-serif`;
    g.fillStyle = ui.fg;
    g.globalAlpha = 0.92;
    g.fillText(state.name || 'Math Melody', 36 * k, 60 * k);
    g.globalAlpha = 0.55;
    g.font = `500 ${Math.round(17 * k)}px "JetBrains Mono", ui-monospace, monospace`;
    g.fillText(`${state.mode.toUpperCase()} · ${state.audio.scale === 'continuous' ? 'continuous pitch' : state.audio.scale}`, 36 * k, 88 * k);

    // Formula lines (kept clear of the analyzer in the bottom-right corner)
    const maxW = w - 60 * k - (v.analyzer !== 'off' ? 370 * k : 40 * k);
    let y = h - 40 * k;
    const lines = d.layers.filter((l) => l.enabled).reverse();
    g.font = `500 ${Math.round(20 * k)}px "JetBrains Mono", ui-monospace, monospace`;
    for (const l of lines) {
      const keys = l.type === 'function' && l.exprs.z.trim() !== '0' ? ['y', 'z'] : LABEL[l.type];
      const note = d.notes.get(l.id);
      const noteText = note != null ? `  ♪ ${noteName(note)}` : '';
      let text = keys.map((key) => `${key === 'f' ? 'h' : key} = ${l.exprs[key]}`).join('   ');
      const room = maxW - g.measureText(noteText).width;
      if (g.measureText(text).width > room) {
        while (text.length > 4 && g.measureText(`${text}…`).width > room) text = text.slice(0, -1);
        text += '…';
      }
      g.globalAlpha = 1;
      g.fillStyle = l.color;
      g.beginPath();
      g.arc(42 * k, y - 7 * k, 6 * k, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = ui.fg;
      g.globalAlpha = 0.9;
      g.fillText(text, 60 * k, y);
      if (note != null) {
        const tw = g.measureText(text).width;
        g.fillStyle = l.color;
        g.fillText(noteText, 60 * k + tw, y);
      }
      y -= 32 * k;
    }
  }

  if (v.analyzer !== 'off') {
    const bw = 300 * k, bh = 90 * k;
    const x0 = w - bw - 36 * k, y0 = h - bh - 30 * k;
    const accent = d.layers.find((l) => l.enabled)?.color || ui.accent;
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
      g.lineWidth = 2.5 * k;
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
    }
  }
  g.restore();
}
