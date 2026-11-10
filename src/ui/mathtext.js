/**
 * A small formula typesetter for Canvas 2D: fractions, powers, indices, roots, Greek letters and
 * tall brackets, in a serif "textbook" look (letters italic, numbers and function names upright).
 *
 * It reads a light TeX dialect and also plain calculator text, so both of these work:
 *
 *   f' = f \frac{c}{c - v_r}          y = \sin x + \frac{\sin 3x}{3} + \cdots
 *   f = 220 \cdot 2^{n/12}            r = 4 \sin\left(\frac{240\theta}{25}\right) + 10
 *   y = sin(2x) + x^2/3               (plain text: * becomes ·, pi becomes π, ^( ) is a power)
 *
 * Supported: \frac{a}{b}  ^  _  \sqrt{}  \left( \right)  \text{}  Greek (\alpha … \omega, \pi, \theta),
 * operators (\cdot \times \pm \int \sum \prod \infty \to \le \ge \ne \approx \partial \cdots \dots)
 * and the function names (\sin \cos \tan \ln \log \exp \lim …). No DOM, no dependencies.
 *
 *   const box = layoutMath(g, text, sizePx);   // { w, asc, desc, draw(x, baseline) }
 *   drawMath(g, text, x, baseline, sizePx, { align: 'center', color: '#111' });
 */

export const MATH_FONT = '"Latin Modern Math", "STIX Two Math", "Cambria Math", "Times New Roman", Times, serif';

const GREEK = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ',
  pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};
const SYMBOLS = {
  cdot: '·', times: '×', div: '÷', pm: '±', mp: '∓', infty: '∞', int: '∫', sum: '∑', prod: '∏', to: '→', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', equiv: '≡', sim: '∼', partial: '∂', nabla: '∇', cdots: '⋯', dots: '…', ldots: '…',
  in: '∈', forall: '∀', exists: '∃', degree: '°', prime: '′', circ: '∘', angle: '∠', perp: '⊥', parallel: '∥', propto: '∝',
};
const FUNCS = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'ln', 'log', 'exp', 'lim', 'max', 'min', 'mod', 'gcd', 'det', 'arg', 'Re', 'Im', 'sgn', 'abs', 'floor', 'ceil']);
const SPACED = new Set(['=', '+', '−', '-', '<', '>', '≤', '≥', '≠', '≈', '→', '±', '×', '·', '≡', '∈', '∝', '⋯']);

/* ------------------------------------------------------------------ parse */

function tokenize(src) {
  const out = [];
  const s = String(src ?? '');
  for (let i = 0; i < s.length;) {
    const ch = s[i];
    if (ch === '\\') {
      const m = /^\\([A-Za-z]+|.)/.exec(s.slice(i));
      out.push({ t: 'cmd', v: m ? m[1] : '' });
      i += m ? m[0].length : 1;
    } else if ('{}^_'.includes(ch)) { out.push({ t: ch }); i++; }
    else if (/[A-Za-z]/.test(ch)) { const m = /^[A-Za-z]+/.exec(s.slice(i))[0]; out.push({ t: 'word', v: m }); i += m.length; }
    else if (/[0-9.]/.test(ch)) { const m = /^[0-9]+(?:\.[0-9]+)?|^\./.exec(s.slice(i))[0]; out.push({ t: 'num', v: m }); i += m.length; }
    else if (ch === ' ') { out.push({ t: 'space' }); i++; }
    else { out.push({ t: 'ch', v: ch }); i++; }
  }
  return out;
}

/** Tokens → a tree of { k: 'row' | 'sym' | 'frac' | 'script' | 'sqrt' | 'delim' | 'space' }. */
function parse(src) {
  const toks = tokenize(src);
  let p = 0;
  const sym = (text, style = 'up', pad = 0) => ({ k: 'sym', text, style, pad });
  const letters = (word) => (FUNCS.has(word) ? [sym(word, 'fn')] : word === 'pi' ? [sym('π', 'it')] : word === 'theta' ? [sym('θ', 'it')] : word === 'sqrt' ? [sym('√')] : [...word].map((c) => sym(c, 'it')));

  /** One group after ^, _ or a command: {…}, (…) for powers written as plain text, or a single item. */
  function arg(plainParens = false) {
    while (toks[p]?.t === 'space') p++;
    const t = toks[p];
    if (!t) return { k: 'row', items: [] };
    if (t.t === '{') { p++; const r = row('}'); p++; return r; }
    if (plainParens && t.t === 'ch' && t.v === '(') { p++; const r = row(')'); p++; return r; }
    const single = atom();
    return { k: 'row', items: single };
  }

  function atom() {
    const t = toks[p++];
    if (!t) return [];
    switch (t.t) {
      case 'num': return [sym(t.v)];
      case 'word': return letters(t.v);
      case 'space': return [{ k: 'space', em: 0.28 }];
      case '{': { const r = row('}'); p++; return [r]; }
      case 'ch': {
        const c = t.v === '*' ? '·' : t.v === '-' ? '−' : t.v;
        return [sym(c, 'up', SPACED.has(c) ? 0.22 : 0)];
      }
      case 'cmd': {
        const c = t.v;
        if (c === 'frac' || c === 'dfrac' || c === 'tfrac') { const num = arg(), den = arg(); return [{ k: 'frac', num, den }]; }
        if (c === 'sqrt') return [{ k: 'sqrt', body: arg() }];
        if (c === 'text' || c === 'mathrm' || c === 'operatorname') { const a = arg(); for (const it of a.items) if (it.k === 'sym') it.style = 'up'; return [a]; }
        if (c === 'left') {
          const open = toks[p++]?.v ?? '(';
          const items = [];
          while (p < toks.length && !(toks[p].t === 'cmd' && toks[p].v === 'right')) items.push(...scripted());
          p++; // \right
          const close = toks[p++]?.v ?? ')';
          return [{ k: 'delim', open, close, body: { k: 'row', items } }];
        }
        if (c === 'right') return [];
        if (c === ',' || c === ';' || c === ':' || c === '!') return [{ k: 'space', em: c === ',' ? 0.17 : c === '!' ? -0.1 : 0.28 }];
        if (c === 'quad') return [{ k: 'space', em: 1 }];
        if (c === 'qquad') return [{ k: 'space', em: 2 }];
        if (GREEK[c]) return [sym(GREEK[c], /^[A-Z]/.test(c) ? 'up' : 'it')];
        if (SYMBOLS[c]) return [sym(SYMBOLS[c], 'up', SPACED.has(SYMBOLS[c]) ? 0.22 : ['∫', '∑', '∏'].includes(SYMBOLS[c]) ? 0.08 : 0)];
        if (FUNCS.has(c)) return [sym(c, 'fn')];
        return [sym(c.length === 1 ? c : `\\${c}`)];
      }
      default: return [];
    }
  }

  /** An atom with any ^ and _ that follow it. */
  function scripted() {
    const t = toks[p];
    let base;
    if (t && (t.t === '^' || t.t === '_')) base = []; else base = atom();
    let sup = null, sub = null;
    while (toks[p] && (toks[p].t === '^' || toks[p].t === '_')) {
      const up = toks[p++].t === '^';
      const a = arg(true);
      if (up) sup = a; else sub = a;
    }
    if (!sup && !sub) return base;
    const last = base.pop() || { k: 'row', items: [] };
    return [...base, { k: 'script', base: last, sup, sub }];
  }

  function row(until) {
    const items = [];
    while (p < toks.length) {
      const t = toks[p];
      if (until === '}' && t.t === '}') break;
      if (until === ')' && t.t === 'ch' && t.v === ')') break;
      if (t.t === '}') { p++; continue; } // stray brace
      items.push(...scripted());
    }
    return { k: 'row', items };
  }
  return row(null);
}

/* ----------------------------------------------------------------- layout */

const fontOf = (style, px) => `${style === 'it' ? 'italic ' : ''}400 ${px}px ${MATH_FONT}`;

function layout(g, node, px) {
  switch (node.k) {
    case 'space': return { w: node.em * px, asc: 0, desc: 0, draw() {} };
    case 'sym': {
      g.font = fontOf(node.style, px);
      const text = node.text, pad = (node.pad || 0) * px + (node.style === 'fn' ? 0.12 * px : 0);
      const w = g.measureText(text).width + pad * 2;
      return { w, asc: px * 0.72, desc: px * 0.22, draw(x, y) { g.font = fontOf(node.style, px); g.fillText(text, x + pad, y); } };
    }
    case 'row': {
      const parts = node.items.map((it) => layout(g, it, px));
      const w = parts.reduce((s, b) => s + b.w, 0);
      return {
        w, asc: Math.max(px * 0.5, ...parts.map((b) => b.asc)), desc: Math.max(0, ...parts.map((b) => b.desc)),
        draw(x, y) { let cx = x; for (const b of parts) { b.draw(cx, y); cx += b.w; } },
      };
    }
    case 'frac': {
      const n = layout(g, node.num, px * 0.86), d = layout(g, node.den, px * 0.86);
      const pad = px * 0.16, w = Math.max(n.w, d.w) + pad * 2, axis = px * 0.27, gap = px * 0.13, rule = Math.max(1, px * 0.05);
      return {
        w, asc: axis + gap + n.desc + n.asc, desc: -axis + gap + d.asc + d.desc,
        draw(x, y) {
          n.draw(x + (w - n.w) / 2, y - axis - gap - n.desc);
          d.draw(x + (w - d.w) / 2, y - axis + gap + d.asc);
          g.fillRect(x + pad * 0.4, y - axis - rule / 2, w - pad * 0.8, rule);
        },
      };
    }
    case 'script': {
      const b = layout(g, node.base, px);
      const sp = px * 0.68;
      const up = node.sup ? layout(g, node.sup, sp) : null, dn = node.sub ? layout(g, node.sub, sp) : null;
      const rise = Math.max(px * 0.38, b.asc - sp * 0.42), drop = Math.max(px * 0.18, b.desc * 0.6);
      const w = b.w + Math.max(up ? up.w : 0, dn ? dn.w : 0) + px * 0.04;
      return {
        w, asc: Math.max(b.asc, up ? rise + up.asc : 0), desc: Math.max(b.desc, dn ? drop + dn.desc : 0),
        draw(x, y) { b.draw(x, y); if (up) up.draw(x + b.w + px * 0.03, y - rise); if (dn) dn.draw(x + b.w + px * 0.02, y + drop); },
      };
    }
    case 'sqrt': {
      const b = layout(g, node.body, px);
      const hook = px * 0.5, top = b.asc + px * 0.14, rule = Math.max(1, px * 0.05);
      return {
        w: b.w + hook + px * 0.1, asc: top + rule, desc: b.desc,
        draw(x, y) {
          g.save(); g.lineWidth = rule; g.strokeStyle = g.fillStyle; g.lineJoin = 'miter';
          g.beginPath(); g.moveTo(x, y - px * 0.25); g.lineTo(x + hook * 0.3, y - px * 0.3); g.lineTo(x + hook * 0.58, y + b.desc); g.lineTo(x + hook * 0.92, y - top); g.lineTo(x + hook + b.w + px * 0.06, y - top); g.stroke(); g.restore();
          b.draw(x + hook, y);
        },
      };
    }
    case 'delim': {
      const b = layout(g, node.body, px);
      const hgt = b.asc + b.desc, sy = Math.max(1, hgt / (px * 0.98));
      g.font = fontOf('up', px);
      const ow = node.open === '.' ? 0 : g.measureText(node.open).width, cw = node.close === '.' ? 0 : g.measureText(node.close).width;
      const glyph = (ch, x, y) => {
        if (ch === '.') return;
        g.save(); g.font = fontOf('up', px);
        // stretch the bracket over the body, about the body's middle line
        const mid = y - (b.asc - b.desc) / 2;
        g.translate(x, mid); g.scale(1, sy); g.fillText(ch, 0, px * 0.26); g.restore();
      };
      return {
        w: ow + b.w + cw, asc: b.asc + px * 0.06, desc: b.desc + px * 0.06,
        draw(x, y) { glyph(node.open, x, y); b.draw(x + ow, y); glyph(node.close, x + ow + b.w, y); },
      };
    }
    default: return { w: 0, asc: 0, desc: 0, draw() {} };
  }
}

const cache = new Map();
/** Lay a formula out at `px`: { w, asc, desc, draw(x, baseline) }. The parse is cached. */
export function layoutMath(g, text, px) {
  let tree = cache.get(text);
  if (!tree) { if (cache.size > 300) cache.clear(); tree = parse(text); cache.set(text, tree); }
  return layout(g, tree, px);
}

/**
 * Draw a formula. (x, y) is the left end (or the centre / right end, see align) of its baseline.
 * @returns {{w:number, asc:number, desc:number}}
 */
export function drawMath(g, text, x, y, px, { align = 'left', color = null } = {}) {
  const box = layoutMath(g, text, px);
  g.save();
  if (color) g.fillStyle = color;
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  box.draw(align === 'center' ? x - box.w / 2 : align === 'right' ? x - box.w : x, y);
  g.restore();
  return box;
}

/** For tests: the parsed tree of a formula. */
export const parseMath = parse;
