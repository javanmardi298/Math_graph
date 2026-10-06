/**
 * Tiny DOM toolkit for the control panels. Each control is bound to a
 * { get, set } pair and registers a refresh() so it can re-read state after
 * a preset loads.
 */
import { store } from '../state.js';

const refreshers = new Set();
export const refreshAll = () => refreshers.forEach((fn) => fn());

let uid = 0;
const nextId = (p) => `${p}-${++uid}`;

/** Create an element: h('div.cls#id', {attrs}, ...children) */
export function h(tag, attrs = {}, ...children) {
  const [, name = 'div', rest = ''] = /^([a-z0-9]+)?(.*)$/i.exec(tag);
  const el = document.createElement(name);
  for (const m of rest.matchAll(/([.#])([\w-]+)/g)) {
    if (m[1] === '.') el.classList.add(m[2]); else el.id = m[2];
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}

/** Binding to a dotted store path. */
export const bindPath = (path) => ({ get: () => store.get(path), set: (v) => store.set(path, v) });

/** Binding to a key on a plain object, emitting `event` on change. */
export const bindObj = (obj, key, event) => ({ get: () => obj[key], set: (v) => { obj[key] = v; store.emit(event); } });

const track = (el, fn) => {
  refreshers.add(fn);
  el._dispose = () => refreshers.delete(fn);
  return el;
};

/** Remove a subtree and unregister its refreshers. */
export function disposeTree(root) {
  root.querySelectorAll('*').forEach((n) => n._dispose?.());
  root._dispose?.();
}

export function slider(label, b, { min, max, step = 0.01, unit = '', fmt } = {}) {
  const id = nextId('s');
  const show = (v) => (fmt ? fmt(v) : `${+(+v).toFixed(step >= 1 ? 0 : step >= 0.1 ? 1 : 2)}${unit}`);
  const input = h('input', { type: 'range', id, min, max, step });
  const out = h('output.ctl-value', { for: id });
  const set = () => { input.value = b.get(); out.textContent = show(b.get()); fillTrack(); };
  const fillTrack = () => input.style.setProperty('--fill', `${((input.value - min) / (max - min)) * 100}%`);
  input.addEventListener('input', () => { b.set(+input.value); out.textContent = show(+input.value); fillTrack(); });
  set();
  return track(h('div.ctl.ctl-slider', {}, h('label', { for: id }, label), out, input), set);
}

export function color(label, b) {
  const id = nextId('c');
  const input = h('input', { type: 'color', id });
  const set = () => { input.value = b.get(); };
  input.addEventListener('input', () => b.set(input.value));
  set();
  return track(h('div.ctl.ctl-color', {}, h('label', { for: id }, label), input), set);
}

export function select(label, b, options) {
  const id = nextId('o');
  const opts = Array.isArray(options) ? options.map((o) => (Array.isArray(o) ? o : [o, o])) : Object.entries(options);
  const input = h('select', { id }, opts.map(([v, t]) => h('option', { value: v }, t)));
  const set = () => { input.value = String(b.get()); };
  input.addEventListener('change', () => {
    const raw = input.value;
    b.set(typeof b.get() === 'number' ? +raw : raw);
  });
  set();
  return track(h('div.ctl.ctl-select', {}, h('label', { for: id }, label), input), set);
}

export function toggle(label, b) {
  const id = nextId('t');
  const input = h('input', { type: 'checkbox', id, role: 'switch' });
  const set = () => { input.checked = !!b.get(); };
  input.addEventListener('change', () => b.set(input.checked));
  set();
  return track(h('div.ctl.ctl-toggle', {}, h('label', { for: id }, label), input), set);
}

/** Segmented button group (e.g. 2D | 3D). */
export function segmented(b, options, { label, cls = '' } = {}) {
  const wrap = h(`div.seg${cls ? '.' + cls : ''}`, { role: 'radiogroup', 'aria-label': label || '' });
  const btns = options.map(([v, t, title]) => {
    const btn = h('button', { type: 'button', role: 'radio', title: title || t, onclick: () => b.set(v) }, t);
    btn.dataset.value = v;
    return btn;
  });
  wrap.append(...btns);
  const set = () => btns.forEach((btn) => btn.setAttribute('aria-checked', String(btn.dataset.value === String(b.get()))));
  set();
  return track(wrap, set);
}

export function number(label, b, { min, max, step = 1 } = {}) {
  const id = nextId('n');
  const input = h('input', { type: 'number', id, min, max, step });
  const set = () => { input.value = b.get(); };
  input.addEventListener('change', () => {
    let v = +input.value;
    if (!Number.isFinite(v)) return set();
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    b.set(v);
    input.value = v;
  });
  set();
  return track(h('div.ctl.ctl-number', {}, h('label', { for: id }, label), input), set);
}

/** Collapsible group inside a panel. */
export function group(title, children, { open = true, hint } = {}) {
  const d = h('details.group', { open }, h('summary', {}, title), hint ? h('p.hint', {}, hint) : null, h('div.group-body', {}, children));
  return d;
}
