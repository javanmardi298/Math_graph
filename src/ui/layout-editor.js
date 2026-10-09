/**
 * Direct manipulation of the overlay on the video: drag an element to move it,
 * drag its corner (or scroll over it) to resize it, double-click a text box to
 * edit its words, Delete removes a selected text box, arrow keys nudge.
 *
 * The overlay is drawn on a canvas, so this layer puts invisible DOM boxes over
 * each element's rectangle (reported by drawOverlay) and writes changes back to
 * state.overlay as fractions of the frame.
 */
import { store } from '../state.js';
import { h } from './controls.js';

const LABELS = { title: 'Title', formulas: 'Formulas', name: 'Name', analyzer: 'Analyzer' };
const MIN_SIZE = 0.3, MAX_SIZE = 5;

export class LayoutEditor {
  /**
   * @param {HTMLElement} stage element the overlay canvas sits in
   * @param {HTMLCanvasElement} canvas overlay canvas (its pixel size maps to the rects)
   * @param {{onEditText:(id:string)=>void, toast:(msg:string)=>void}} actions
   */
  constructor(stage, canvas, actions) {
    this.stage = stage;
    this.canvas = canvas;
    this.actions = actions;
    this.layer = h('div.layout-layer', { hidden: true, 'aria-label': 'Overlay layout editor' });
    this.hint = h('div.layout-hint', {}, 'Drag to move · drag the corner or scroll to resize · double-click text to edit · Esc to finish');
    // Where YouTube Shorts / Reels / TikTok draw their own buttons and captions over a
    // vertical video. Only a guide while editing; never part of the video.
    this.safe = h('div.safe-zone', { 'aria-hidden': 'true' },
      h('div.safe-top'), h('div.safe-bottom', {}, h('span', {}, 'Shorts: channel name & caption')), h('div.safe-right', {}, h('span', {}, 'buttons')));
    this.layer.append(this.safe, this.hint);
    stage.append(this.layer);
    this.boxes = new Map();
    this.selected = null;
    this.drag = null;
    this.enabled = false;

    window.addEventListener('keydown', (e) => {
      if (!this.enabled || !this.selected) return;
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const step = e.shiftKey ? 0.02 : 0.004;
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[e.key]) {
        e.preventDefault();
        e.stopPropagation();
        const el = this.element(this.selected);
        const r = this.lastRects?.get(this.selected);
        if (!el || !r) return;
        const pos = this.normalized(this.selected, r);
        el.x = clamp01(pos.x + moves[e.key][0]);
        el.y = clamp01(pos.y + moves[e.key][1]);
        store.emit('overlay');
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected.startsWith('text:')) {
        e.preventDefault();
        const id = this.selected.slice(5);
        store.state.overlay.texts = store.state.overlay.texts.filter((t) => t.id !== id);
        this.selected = null;
        store.emit('overlay.texts');
      }
    }, true);
  }

  setEnabled(on) {
    this.enabled = on;
    this.layer.hidden = !on;
    this.stage.classList.toggle('editing-layout', on);
    if (!on) this.selected = null;
  }

  /** The state object behind a key ('title' | 'formulas' | 'analyzer' | 'text:<id>'). */
  element(key) {
    const o = store.state.overlay;
    if (key.startsWith('text:')) return o.texts.find((t) => t.id === key.slice(5));
    return o[key];
  }

  /** Current position of an element as stored (top-left, or centre for text boxes), in 0..1. */
  normalized(key, r) {
    const W = this.canvas.width, H = this.canvas.height;
    return key.startsWith('text:')
      ? { x: (r.x + r.w / 2) / W, y: (r.y + r.h / 2) / H }
      : { x: r.x / W, y: r.y / H };
  }

  /** Called after each overlay draw with the element rectangles in canvas pixels. */
  update(rects) {
    if (!this.enabled) return;
    this.safe.hidden = !['9:16', '4:5'].includes(store.state.visual.aspect);
    const sx = this.canvas.clientWidth / this.canvas.width;
    const sy = this.canvas.clientHeight / this.canvas.height;
    const list = new Map();
    for (const key of ['title', 'formulas', 'name', 'analyzer']) if (rects[key]) list.set(key, rects[key]);
    for (const t of rects.texts) list.set(`text:${t.id}`, t.rect);
    this.lastRects = list;
    for (const [key, box] of this.boxes) if (!list.has(key)) { box.remove(); this.boxes.delete(key); }
    for (const [key, r] of list) {
      let box = this.boxes.get(key);
      if (!box) { box = this.makeBox(key); this.boxes.set(key, box); this.layer.append(box); }
      const pad = 6;
      Object.assign(box.style, {
        left: `${r.x * sx - pad}px`, top: `${r.y * sy - pad}px`,
        width: `${r.w * sx + pad * 2}px`, height: `${r.h * sy + pad * 2}px`,
      });
      box.classList.toggle('is-selected', key === this.selected);
      box.classList.toggle('tag-below', r.y * sy < 24); // keep the label inside the frame
      const tb = key.startsWith('text:') ? rects.texts.find((t) => `text:${t.id}` === key) : null;
      box.classList.toggle('is-offstage', !!tb && !tb.visible);
    }
  }

  makeBox(key) {
    const label = key.startsWith('text:') ? 'Text' : LABELS[key];
    const handle = h('span.layout-resize', { title: 'Drag to resize' });
    const box = h('div.layout-box', { tabindex: 0, role: 'button', 'aria-label': `${label}: drag to move` }, h('span.layout-tag', {}, label), handle);
    const startDrag = (e, mode) => {
      e.preventDefault();
      e.stopPropagation();
      this.selected = key;
      const el = this.element(key);
      const r = this.lastRects.get(key);
      if (!el || !r) return;
      box.setPointerCapture(e.pointerId);
      this.drag = { mode, x0: e.clientX, y0: e.clientY, pos: this.normalized(key, r), size: el.size || 1, w: r.w * (this.canvas.clientWidth / this.canvas.width) };
    };
    box.addEventListener('pointerdown', (e) => startDrag(e, e.target === handle ? 'resize' : 'move'));
    box.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      const el = this.element(key);
      if (!el) return;
      const dx = e.clientX - this.drag.x0, dy = e.clientY - this.drag.y0;
      if (this.drag.mode === 'move') {
        el.x = clamp01(this.drag.pos.x + dx / this.canvas.clientWidth);
        el.y = clamp01(this.drag.pos.y + dy / this.canvas.clientHeight);
      } else {
        el.size = clampSize(this.drag.size * Math.max(0.05, (this.drag.w + dx) / this.drag.w));
        // Keep the top-left corner fixed while resizing automatic elements.
        if (!key.startsWith('text:') && el.x == null) { el.x = this.drag.pos.x; el.y = this.drag.pos.y; }
      }
      store.emit('overlay');
    });
    const end = () => { if (this.drag) { this.drag = null; store.emit('overlay.done'); } };
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
    box.addEventListener('wheel', (e) => {
      e.preventDefault();
      const el = this.element(key);
      if (!el) return;
      el.size = clampSize((el.size || 1) * (e.deltaY < 0 ? 1.06 : 1 / 1.06));
      store.emit('overlay');
    }, { passive: false });
    box.addEventListener('dblclick', () => {
      if (key.startsWith('text:')) this.actions.onEditText(key.slice(5));
      else if (key === 'title') this.actions.onEditText('title');
    });
    box.addEventListener('focus', () => { this.selected = key; });
    return box;
  }

}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const clampSize = (v) => Math.min(MAX_SIZE, Math.max(MIN_SIZE, v));
