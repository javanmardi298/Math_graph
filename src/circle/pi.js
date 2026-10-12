/**
 * Pi, five ways:
 *
 *   archimedes  polygons inside and outside a circle: 6, 12, 24, 48, 96 sides squeeze π
 *               between n·sin(π/n) and n·tan(π/n) (how Archimedes got 3.14)
 *   montecarlo  random dots in a square: the share inside the circle is π/4
 *   buffon      needles dropped on lines: π ≈ 2·(needles)/(needles that cross)
 *   series      Leibniz 4(1 − 1/3 + 1/5 − …), Nilakantha, Wallis: partial sums close in on π
 *   pidigits    the digits of π as a walk (each digit a direction), as chords around a
 *               circle, and as music (each digit a note)
 *
 * Same contract as scenes.js; deterministic, no DOM.
 */
import { hexA } from './palettes.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function text(D, s, x, y, { size = 15, color, align = 'center', weight = 600, alpha = 0.95, font = 'ui-sans-serif, system-ui, sans-serif' } = {}) {
  const { g, k } = D;
  g.save(); g.globalAlpha = alpha; g.fillStyle = color || '#ffffff';
  g.font = `${weight} ${size * k}px ${font}`; g.textAlign = align; g.textBaseline = 'middle';
  g.fillText(s, x, y); g.restore();
}
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

/** π to `n` decimals as a string "31415…" (Machin's formula with BigInt). */
export function piDigits(n = 1000) {
  const scale = 10n ** BigInt(n + 10);
  const atanInv = (x) => { // atan(1/x)·scale
    const x2 = BigInt(x) * BigInt(x);
    let term = scale / BigInt(x), sum = term, k = 1n, sign = -1n;
    while (term !== 0n) { term /= x2; const t = term / (2n * k + 1n); sum += sign * t; sign = -sign; k++; }
    return sum;
  };
  const pi = 4n * (4n * atanInv(5) - atanInv(239));
  return pi.toString().slice(0, n + 1);
}

/** How many of the leading digits of v match π. */
const goodDigits = (v) => { const a = v.toFixed(12), b = Math.PI.toFixed(12); let i = 0; while (i < a.length && a[i] === b[i]) i++; return Math.max(0, i - 2); };

/** Count that grows faster and faster: rate0 per second at first, × accel every second. */
const grown = (t, rate0, accel, max) => { if (t <= 0) return 0; const a = Math.max(1.0001, accel); return Math.min(max, Math.floor((rate0 * (a ** t - 1)) / Math.log(a))); };

/* ============================================================== archimedes */

const archimedes = {
  label: 'Archimedes: polygons squeeze π', group: 'Pi',
  defaults: { sides: '6 12 24 48 96', every: 6, wait: 0.5 },
  controls: [['sides', 'Sides, one after another', 'x', '6 12 24 48 96'], ['every', 'Beats per polygon', 'r', 1, 16, 0.5]],
  init(S, P) { const l = String(P.sides || '').split(/[\s,;]+/).map(Number).filter((v) => v >= 3).map(Math.round); S.sc = { list: l.length ? l : [6, 12, 24, 48, 96], k: -1, beat: -1 }; },
  at(S, P) { const len = (60 / S.bpm) * Math.max(0.5, P.every); return S.st < P.wait ? -1 : Math.min(S.sc.list.length - 1, Math.floor((S.st - P.wait) / len)); },
  step(S, P, dt, emit) {
    const sc = S.sc, k = this.at(S, P);
    if (k !== sc.k && k >= 0) { sc.k = k; emit({ type: 'fill', ball: k, x: 0, y: 0, angle: 0, pitch: clamp(0.2 + k * 0.13, 0, 1) }); }
    const b = Math.floor((S.st * S.bpm) / 60);
    if (b !== sc.beat && k >= 0) { sc.beat = b; emit({ type: 'hit', ball: b % 8, x: 0, y: 0, angle: 0, pitch: clamp(0.25 + 0.1 * k + 0.08 * (b % 3), 0, 1) }); }
  },
  draw(S, P, D) {
    const { g, pal, k } = D, sc = S.sc, { hh } = S.W;
    const R = Math.min(S.W.hw * 0.78, hh * 0.5), cy = hh * 0.12;
    const X = (x) => D.X(x * R), Y = (y) => D.Y(y * R + cy);
    const step = this.at(S, P);
    if (step >= 0) {
      const n = sc.list[step];
      const poly = (r, col, fill) => {
        g.beginPath();
        for (let i = 0; i <= n; i++) { const a = Math.PI / 2 + (i * TAU) / n; i ? g.lineTo(X(r * Math.cos(a)), Y(r * Math.sin(a))) : g.moveTo(X(r * Math.cos(a)), Y(r * Math.sin(a))); }
        if (fill) { g.fillStyle = fill; g.fill(); }
        g.strokeStyle = col; g.lineWidth = 2.5 * k; g.stroke();
      };
      poly(1 / Math.cos(Math.PI / n), '#5cd3ff', 'rgba(92,211,255,0.08)');
      poly(1, '#ffd25c', 'rgba(255,210,92,0.10)');
    }
    g.strokeStyle = '#ffffff'; g.lineWidth = 3 * k; g.shadowColor = pal.glow; g.shadowBlur = 14 * k;
    g.beginPath(); g.arc(X(0), Y(0), R * D.R, 0, TAU); g.stroke(); g.shadowBlur = 0;
    if (step >= 0) {
      const n = sc.list[step], lo = n * Math.sin(Math.PI / n), hi = n * Math.tan(Math.PI / n);
      const y = -hh * 0.62;
      text(D, `${n} sides`, D.X(0), D.Y(y + 0.02), { size: 22, color: '#ffffff' });
      text(D, `${lo.toFixed(5)} < π < ${hi.toFixed(5)}`, D.X(0), D.Y(y - 0.13), { size: 21, color: '#ffffff', font: MONO });
      text(D, 'inside', D.X(-0.45), D.Y(y - 0.24), { size: 14, color: '#ffd25c' });
      text(D, 'outside', D.X(0.45), D.Y(y - 0.24), { size: 14, color: '#5cd3ff' });
      // a number line around π: the gap shrinks
      const L = S.W.hw * 0.85, span = 0.5, nx = (v) => D.X(((v - Math.PI) / span) * L), ny = D.Y(y - 0.38);
      g.strokeStyle = hexA(pal.ring, 0.5); g.lineWidth = 1.5 * k; g.beginPath(); g.moveTo(nx(Math.PI - span), ny); g.lineTo(nx(Math.PI + span), ny); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(nx(lo), ny - 7 * k, nx(hi) - nx(lo), 14 * k);
      for (const [v, c] of [[lo, '#ffd25c'], [hi, '#5cd3ff'], [Math.PI, '#ffffff']]) { g.fillStyle = c; g.fillRect(nx(v) - 1.5 * k, ny - 10 * k, 3 * k, 20 * k); }
      text(D, 'π', nx(Math.PI), ny + 20 * k, { size: 16 });
    }
  },
  stats(S, P) { const s = this.at(S, P); if (s < 0) return 'ready…'; const n = S.sc.list[s]; return `${n} sides · gap ${(n * Math.tan(Math.PI / n) - n * Math.sin(Math.PI / n)).toFixed(5)}`; },
  formula: () => 'n·sin(π/n) < π < n·tan(π/n)',
};

/* ============================================================== montecarlo */

const montecarlo = {
  label: 'Monte Carlo: random dots find π', group: 'Pi',
  defaults: { rate0: 6, accel: 1.32, max: 30000, dot: 1.6 },
  controls: [['rate0', 'Dots per second at first', 'r', 1, 100, 1], ['accel', 'Speed-up per second', 'r', 1, 2, 0.01], ['max', 'Most dots', 'r', 100, 60000, 100], ['dot', 'Dot size', 'r', 0.5, 5, 0.1]],
  init(S, P) {
    const n = clamp(P.max | 0, 10, 60000), xs = new Float32Array(n), ys = new Float32Array(n), inn = new Uint8Array(n), cum = new Uint32Array(n + 1);
    for (let i = 0; i < n; i++) { xs[i] = S.rand() * 2 - 1; ys[i] = S.rand() * 2 - 1; inn[i] = xs[i] * xs[i] + ys[i] * ys[i] <= 1 ? 1 : 0; cum[i + 1] = cum[i] + inn[i]; }
    S.sc = { n, xs, ys, inn, cum, shown: 0, beat: -1 };
  },
  count(S, P) { return grown(S.st, P.rate0, P.accel, S.sc.n); },
  step(S, P, dt, emit) {
    const sc = S.sc, m = this.count(S, P);
    for (let i = sc.shown; i < Math.min(m, sc.shown + 3) && m < 60; i++) emit({ type: 'hit', ball: i, x: sc.xs[i] * 0.5, y: sc.ys[i] * 0.5, angle: 0, pitch: sc.inn[i] ? 0.6 : 0.35 });
    sc.shown = m;
    const b = Math.floor((S.st * S.bpm) / 60);
    if (b !== sc.beat && m >= 60) { sc.beat = b; const est = (4 * sc.cum[m]) / m; emit({ type: 'hit', ball: b % 8, x: 0, y: 0, angle: 0, pitch: clamp(0.5 + (est - Math.PI) * 3, 0.05, 0.95) }); }
  },
  draw(S, P, D) {
    const { g, pal, k } = D, sc = S.sc, { hh } = S.W;
    const R = Math.min(S.W.hw * 0.85, hh * 0.55), cy = hh * 0.18;
    const X = (x) => D.X(x * R), Y = (y) => D.Y(y * R + cy);
    g.strokeStyle = hexA(pal.ring, 0.7); g.lineWidth = 2 * k; g.strokeRect(X(-1), Y(1), 2 * R * D.R, 2 * R * D.R);
    const m = this.count(S, P), r = P.dot * k;
    const cin = pal.line(0.15), cout = 'rgba(255,255,255,0.55)';
    for (let pass = 0; pass < 2; pass++) {
      g.fillStyle = pass ? cin : cout;
      for (let i = 0; i < m; i++) if (sc.inn[i] === pass) g.fillRect(X(sc.xs[i]) - r, Y(sc.ys[i]) - r, 2 * r, 2 * r);
    }
    g.strokeStyle = '#ffffff'; g.lineWidth = 2.5 * k; g.beginPath(); g.arc(X(0), Y(0), R * D.R, 0, TAU); g.stroke();
    const y = -hh * 0.6;
    if (m > 0) {
      const est = (4 * sc.cum[m]) / m;
      text(D, `π ≈ 4 × ${sc.cum[m].toLocaleString('en')} / ${m.toLocaleString('en')}`, D.X(0), D.Y(y), { size: 17, alpha: 0.8 });
      text(D, `= ${est.toFixed(5)}`, D.X(0), D.Y(y - 0.17), { size: 30, color: '#ffd25c', font: MONO });
      text(D, `${goodDigits(est)} correct decimal${goodDigits(est) === 1 ? '' : 's'}`, D.X(0), D.Y(y - 0.32), { size: 14, color: '#7fffd4' });
    }
  },
  stats(S, P) { const m = this.count(S, P); return m ? `dots: ${m.toLocaleString('en')} · inside: ${S.sc.cum[m].toLocaleString('en')}` : 'ready…'; },
  formula: () => 'π ≈ 4 · (dots inside) / (all dots)',
};

/* ================================================================== buffon */

const buffon = {
  label: "Buffon's needle: π from dropped needles", group: 'Pi',
  defaults: { rate0: 3, accel: 1.26, max: 2000, lines: 6 },
  controls: [['rate0', 'Needles per second at first', 'r', 1, 50, 1], ['accel', 'Speed-up per second', 'r', 1, 2, 0.01], ['max', 'Most needles', 'r', 50, 8000, 50], ['lines', 'Lines on the floor', 'r', 3, 12, 1]],
  init(S, P) {
    const n = clamp(P.max | 0, 10, 8000), lines = clamp(P.lines | 0, 3, 12);
    const H = 1.6, d = H / lines; // floor height (math units) and line spacing; needle length = d
    const nd = [];
    let cross = 0;
    const cumc = new Uint32Array(n + 1);
    for (let i = 0; i < n; i++) {
      const x = S.rand() * 1.8 - 0.9, y = S.rand() * H, a = S.rand() * Math.PI;
      const y1 = y - (d / 2) * Math.sin(a), y2 = y + (d / 2) * Math.sin(a);
      const c = Math.floor(y1 / d) !== Math.floor(y2 / d) ? 1 : 0;
      cross += c; cumc[i + 1] = cross;
      nd.push([x, y, a, c]);
    }
    S.sc = { n, nd, cumc, d, H, lines, shown: 0, beat: -1 };
  },
  count(S, P) { return grown(S.st, P.rate0, P.accel, S.sc.n); },
  step(S, P, dt, emit) {
    const sc = S.sc, m = this.count(S, P);
    for (let i = sc.shown; i < m && i < 40; i++) emit({ type: 'hit', ball: i, x: 0, y: 0, angle: 0, pitch: sc.nd[i][3] ? 0.65 : 0.35 });
    sc.shown = m;
    const b = Math.floor((S.st * S.bpm) / 60);
    if (b !== sc.beat && m >= 40) { sc.beat = b; emit({ type: 'hit', ball: b % 8, x: 0, y: 0, angle: 0, pitch: 0.4 + 0.05 * (b % 4) }); }
  },
  draw(S, P, D) {
    const { g, pal, k } = D, sc = S.sc, { hh } = S.W;
    const sz = S.W.hw * 0.95, cy = hh * 0.15;
    const X = (x) => D.X(x * sz), Y = (y) => D.Y((y - sc.H / 2) * sz + cy);
    for (let j = 0; j <= sc.lines; j++) { g.strokeStyle = hexA(pal.ring, 0.6); g.lineWidth = 2 * k; g.beginPath(); g.moveTo(X(-1), Y(j * sc.d)); g.lineTo(X(1), Y(j * sc.d)); g.stroke(); }
    const m = this.count(S, P);
    g.lineCap = 'round';
    for (let i = 0; i < m; i++) {
      const [x, y, a, c] = sc.nd[i], dx = (sc.d / 2) * Math.cos(a), dy = (sc.d / 2) * Math.sin(a);
      g.strokeStyle = c ? '#ff5c8a' : 'rgba(220,235,255,0.55)'; g.lineWidth = (m > 1500 ? 1 : 1.8) * k;
      g.beginPath(); g.moveTo(X(x - dx), Y(y - dy)); g.lineTo(X(x + dx), Y(y + dy)); g.stroke();
    }
    const y = -hh * 0.66;
    if (m > 0) {
      const c = sc.cumc[m], est = c ? (2 * m) / c : 0;
      text(D, `${m.toLocaleString('en')} needles, ${c.toLocaleString('en')} cross a line`, D.X(0), D.Y(y), { size: 16, alpha: 0.85 });
      text(D, c ? `π ≈ 2 × ${m} / ${c} = ${est.toFixed(4)}` : 'π ≈ …', D.X(0), D.Y(y - 0.15), { size: 22, color: '#ffd25c', font: MONO });
    }
  },
  stats(S, P) { const m = this.count(S, P); return m ? `needles: ${m} · crossing: ${S.sc.cumc[m]}` : 'ready…'; },
  formula: () => 'P(cross) = 2/π  →  π ≈ 2N / C',
};

/* ================================================================== series */

const SER = {
  leibniz: { name: 'Leibniz', term: (n) => (4 * (n % 2 ? -1 : 1)) / (2 * n + 1), start: 0, text: '4·(1 − 1/3 + 1/5 − 1/7 + …)' },
  nilakantha: { name: 'Nilakantha', term: (n) => (n === 0 ? 3 : ((n % 2 ? 4 : -4) / ((2 * n) * (2 * n + 1) * (2 * n + 2)))), start: 0, text: '3 + 4/(2·3·4) − 4/(4·5·6) + …' },
  wallis: { name: 'Wallis', prod: (n) => (4 * n * n) / (4 * n * n - 1), text: '2·(2/1·2/3)·(4/3·4/5)·…' },
};

const series = {
  label: 'Series for π: sums that close in', group: 'Pi',
  defaults: { kind: 'leibniz', terms: 60, per: 0.5, wait: 0.5 },
  controls: [['kind', 'Series', 's', { leibniz: 'Leibniz (slow)', nilakantha: 'Nilakantha (fast)', wallis: 'Wallis product' }], ['terms', 'Terms', 'r', 5, 400, 1], ['per', 'Beats per term', 'r', 0.05, 2, 0.05]],
  init(S, P) {
    const s = SER[P.kind] || SER.leibniz, vals = [];
    let v = s.prod ? 2 : 0;
    for (let n = 0; n < P.terms; n++) { v = s.prod ? v * s.prod(n + 1) : v + s.term(n); vals.push(v); }
    S.sc = { s, vals, k: -1 };
  },
  at(S, P) { const len = (60 / S.bpm) * Math.max(0.05, P.per); return S.st < P.wait ? -1 : Math.min(S.sc.vals.length - 1, Math.floor((S.st - P.wait) / len)); },
  step(S, P, dt, emit) {
    const sc = S.sc, k = this.at(S, P);
    if (k !== sc.k && k >= 0) {
      for (let i = sc.k + 1; i <= k; i++) emit({ type: 'hit', ball: i, x: 0, y: 0, angle: 0, pitch: clamp(0.5 + (sc.vals[i] - Math.PI) * 0.6, 0.05, 0.95), together: i < k });
      sc.k = k;
    }
  },
  draw(S, P, D) {
    const { g, pal, k } = D, sc = S.sc, { hw, hh } = S.W, n = this.at(S, P);
    const box = { x0: -hw * 0.9, x1: hw * 0.9, y0: -hh * 0.35, y1: hh * 0.6 };
    const span = 1.2, last = Math.max(8, n + 1);
    const X = (i) => D.X(box.x0 + ((box.x1 - box.x0) * i) / last), Y = (v) => D.Y(box.y0 + ((clamp(v, Math.PI - span, Math.PI + span) - (Math.PI - span)) / (2 * span)) * (box.y1 - box.y0));
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2 * k; g.setLineDash([6 * k, 5 * k]);
    g.beginPath(); g.moveTo(D.X(box.x0), Y(Math.PI)); g.lineTo(D.X(box.x1), Y(Math.PI)); g.stroke(); g.setLineDash([]);
    text(D, 'π', D.X(box.x1) + 10 * k, Y(Math.PI), { size: 18, align: 'left' });
    if (n >= 0) {
      g.strokeStyle = hexA(pal.glow, 0.55); g.lineWidth = 1.5 * k; g.beginPath();
      for (let i = 0; i <= n; i++) (i ? g.lineTo(X(i), Y(sc.vals[i])) : g.moveTo(X(i), Y(sc.vals[i])));
      g.stroke();
      for (let i = 0; i <= n; i++) { g.fillStyle = pal.line(i / last); g.beginPath(); g.arc(X(i), Y(sc.vals[i]), (i === n ? 6 : 3) * k, 0, TAU); g.fill(); }
      const v = sc.vals[n], good = goodDigits(v), s = v.toFixed(8);
      const y = -hh * 0.6;
      text(D, sc.s.text, D.X(0), D.Y(y + 0.08), { size: 15, alpha: 0.75 });
      // the digits that are already right glow
      const right = s.slice(0, good + 2), wrong = s.slice(good + 2);
      const { g: gg } = D; gg.save(); gg.font = `600 ${30 * k}px ${MONO}`;
      const w1 = gg.measureText(right).width, w2 = gg.measureText(wrong).width; gg.restore();
      const x0 = D.X(0) - (w1 + w2) / 2;
      text(D, right, x0, D.Y(y - 0.1), { size: 30, color: '#ffd25c', align: 'left', font: MONO });
      text(D, wrong, x0 + w1, D.Y(y - 0.1), { size: 30, color: 'rgba(255,255,255,0.5)', align: 'left', font: MONO });
      text(D, `${n + 1} terms`, D.X(0), D.Y(y - 0.26), { size: 15, color: '#7fffd4' });
    }
  },
  stats(S, P) { const n = this.at(S, P); return n < 0 ? 'ready…' : `${S.sc.s.name}: ${n + 1} terms · ${goodDigits(S.sc.vals[n])} correct decimals`; },
  formula: (P) => `π = ${(SER[P.kind] || SER.leibniz).text}`,
};

/* ================================================================ pidigits */

const pidigits = {
  label: 'Digits of π: a walk, a circle, a song', group: 'Pi',
  defaults: { mode: 'walk', rate0: 4, accel: 1.22, max: 1500, step: 0.03 },
  controls: [
    ['mode', 'Show the digits as', 's', { walk: 'A walk (digit = direction)', chords: 'Chords around a circle', grid: 'A grid of colours' }],
    ['rate0', 'Digits per second at first', 'r', 1, 40, 1], ['accel', 'Speed-up per second', 'r', 1, 1.6, 0.01], ['max', 'Most digits', 'r', 50, 5000, 50], ['step', 'Step length (walk)', 'r', 0.005, 0.1, 0.001],
  ],
  init(S, P) {
    const n = clamp(P.max | 0, 20, 5000), str = piDigits(n), digits = Array.from(str, Number);
    const pts = [[0, 0]];
    let x = 0, y = 0;
    for (const d of digits) { const a = Math.PI / 2 - (d * TAU) / 10; x += Math.cos(a); y += Math.sin(a); pts.push([x, y]); }
    S.sc = { digits, pts, shown: 0 };
  },
  count(S, P) { return grown(S.st, P.rate0, P.accel, S.sc.digits.length); },
  step(S, P, dt, emit) {
    const sc = S.sc, m = this.count(S, P);
    const notes = m - sc.shown, every = Math.max(1, Math.floor(notes / 4));
    for (let i = sc.shown; i < m; i += every) emit({ type: 'hit', ball: sc.digits[i], x: 0, y: 0, angle: 0, pitch: sc.digits[i] / 9, together: i > sc.shown });
    sc.shown = m;
  },
  draw(S, P, D) {
    const { g, pal, k } = D, sc = S.sc, { hw, hh } = S.W, m = this.count(S, P);
    const col = (d) => `hsl(${d * 36} 90% 62%)`;
    if (P.mode === 'chords') {
      const R = Math.min(hw * 0.85, hh * 0.55), cy = hh * 0.12;
      const at = (d, j) => { const a = Math.PI / 2 - ((d + (j % 8) / 9 * 0.8 + 0.1) * TAU) / 10; return [D.X(R * Math.cos(a)), D.Y(R * Math.sin(a) + cy)]; };
      g.globalAlpha = m > 400 ? 0.25 : 0.5; g.lineWidth = 1.2 * k;
      for (let i = 1; i < m; i++) {
        const [x1, y1] = at(sc.digits[i - 1], i), [x2, y2] = at(sc.digits[i], i + 1);
        g.strokeStyle = col(sc.digits[i - 1]); g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(D.X(0), D.Y(cy), x2, y2); g.stroke();
      }
      g.globalAlpha = 1;
      for (let d = 0; d < 10; d++) {
        const a0 = Math.PI / 2 - (d * TAU) / 10, a1 = Math.PI / 2 - ((d + 0.9) * TAU) / 10;
        g.strokeStyle = col(d); g.lineWidth = 6 * k; g.beginPath(); g.arc(D.X(0), D.Y(cy), R * D.R * 1.04, -a0, -a1); g.stroke();
        const am = (a0 + a1) / 2; text(D, String(d), D.X(R * 1.15 * Math.cos(am)), D.Y(R * 1.15 * Math.sin(am) + cy), { size: 16, color: col(d) });
      }
    } else if (P.mode === 'grid') {
      const cols = 25, rows = Math.ceil(sc.digits.length / cols), cw = (2 * hw * 0.9) / cols, top = hh * 0.85;
      for (let i = 0; i < m; i++) { const r = Math.floor(i / cols), c = i % cols; if (top - r * cw < -hh * 0.5) break; g.fillStyle = col(sc.digits[i]); g.fillRect(D.X(-hw * 0.9 + c * cw) + 1, D.Y(top - r * cw), cw * D.R - 2, cw * D.R - 2); }
      void rows;
    } else {
      // the walk: fit what is drawn so far into the frame
      let x0 = 0, x1 = 0, y0 = 0, y1 = 0;
      for (let i = 0; i <= m; i++) { const [x, y] = sc.pts[i]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const s = Math.min((hw * 1.7) / Math.max(8, x1 - x0), (hh * 1.2) / Math.max(8, y1 - y0)), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      const X = (x) => D.X((x - mx) * s), Y = (y) => D.Y((y - my) * s + hh * 0.12);
      g.lineWidth = 2 * k; g.lineCap = 'round';
      for (let i = 1; i <= m; i++) { g.strokeStyle = pal.line(i / sc.digits.length); g.beginPath(); g.moveTo(X(sc.pts[i - 1][0]), Y(sc.pts[i - 1][1])); g.lineTo(X(sc.pts[i][0]), Y(sc.pts[i][1])); g.stroke(); }
      const [ex, ey] = sc.pts[m]; g.fillStyle = '#ffffff'; g.shadowColor = pal.glow; g.shadowBlur = 14 * k; g.beginPath(); g.arc(X(ex), Y(ey), 6 * k, 0, TAU); g.fill(); g.shadowBlur = 0;
    }
    // the latest digits
    const tail = sc.digits.slice(Math.max(0, m - 14), m).join('');
    text(D, m <= 14 ? `3.${sc.digits.slice(1, m).join('')}` : `…${tail}`, D.X(0), D.Y(-hh * 0.72), { size: 26, color: '#ffd25c', font: MONO });
    text(D, `${Math.max(0, m - 1).toLocaleString('en')} digits`, D.X(0), D.Y(-hh * 0.86), { size: 15, color: '#7fffd4' });
  },
  stats(S, P) { return `digits: ${Math.max(0, this.count(S, P) - 1)}`; },
  formula: (P) => (P.mode === 'walk' ? 'digit d → turn to d·36°, one step' : P.mode === 'chords' ? 'each digit → the next: one chord' : 'each digit, one colour'),
};

export const PI_SCENES = { archimedes, montecarlo, buffon, series, pidigits };
