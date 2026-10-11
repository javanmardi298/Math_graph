/**
 * Waves & sound, the teaching set. Every scene runs on a formula you can edit, shows the
 * numbers that matter (λ, f, v = f·λ …) and plays the real notes (harmonics, intervals).
 *
 *   string   standing waves on a string: harmonic n has n loops, λ = 2L/n, f = n·f₁
 *   travel   a travelling wave, transverse (rope) and longitudinal (sound): the beads only
 *            move up/down or back/forth, the wave moves on; shorter λ → higher pitch
 *   fourier  rotating circles add sin(nx) terms one by one and draw a square (or saw,
 *            triangle, your own) wave; you hear every harmonic arrive
 *   beats    two close notes add up to a sound that swells and fades |f₁ − f₂| times a second
 *   scope    an oscilloscope draws two notes against each other: simple ratios
 *            (2:1 octave, 3:2 fifth, 4:3 fourth …) give still figures and sound sweet
 *   doppler  a moving source squeezes its waves in front: higher pitch ahead, a Mach cone
 *            when it outruns its own sound
 *
 * Same contract as scenes.js; deterministic, no DOM.
 */
import { tryCompile } from '../math/parser.js';
import { hexA } from './palettes.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const midiOf = (base, ratio) => Math.round(base + 12 * Math.log2(ratio));

function formula(src, vars, fallback = 0) {
  const c = tryCompile(String(src ?? ''), vars);
  if (!c.ok) return () => fallback;
  return (scope) => { const v = c.fn(scope); return Number.isFinite(v) ? v : fallback; };
}

/** "1 2 3" or "1:1 3:2" → numbers or pairs. */
const nums = (text, fb) => { const v = String(text || '').split(/[\s,;]+/).map(Number).filter(Number.isFinite); return v.length ? v : fb; };
const pairs = (text, fb) => { const v = String(text || '').split(/[\s,;]+/).map((p) => p.split(':').map(Number)).filter((p) => p.length === 2 && p.every((x) => x > 0)); return v.length ? v : fb; };

/** Which step of a list is playing (one step every `every` beats, after `wait` s). */
function stepOf(S, every, count, wait = 0) {
  const len = (60 / S.bpm) * Math.max(0.25, every);
  if (S.st < wait) return { k: 0, since: S.st, len };
  const k = Math.min(count - 1, Math.floor((S.st - wait) / len));
  return { k, since: S.st - wait - k * len, len };
}

function text(D, s, x, y, { size = 15, color, align = 'center', weight = 600, alpha = 0.9 } = {}) {
  const { g, k } = D;
  g.save();
  g.globalAlpha = alpha; g.fillStyle = color || '#ffffff';
  g.font = `${weight} ${size * k}px ui-sans-serif, system-ui, sans-serif`; g.textAlign = align; g.textBaseline = 'middle';
  g.fillText(s, x, y);
  g.restore();
}

/** A measuring bracket |←— label —→| between two x positions at height y (world units). */
function bracket(D, x1, x2, y, label, color) {
  const { g, k } = D;
  const X1 = D.X(x1), X2 = D.X(x2), Y = D.Y(y), t = 6 * k;
  g.strokeStyle = color; g.lineWidth = 2 * k;
  g.beginPath(); g.moveTo(X1, Y - t); g.lineTo(X1, Y + t); g.moveTo(X2, Y - t); g.lineTo(X2, Y + t); g.moveTo(X1, Y); g.lineTo(X2, Y); g.stroke();
  text(D, label, (X1 + X2) / 2, Y - 14 * k, { size: 15, color });
}

/** Note events on a step change and on every beat (`notes` → [midi, …], played together). */
function beatNotes(S, sc, emit, notes, onStep) {
  const b = Math.floor((S.st * S.bpm) / 60);
  if (b !== sc.beat || onStep) {
    sc.beat = b;
    notes.forEach((m, i) => emit({ type: 'hit', ball: i, x: 0, y: 0, angle: 0, midi: m, pitch: clamp((m - 36) / 60, 0, 1), together: i > 0 }));
  }
}

/* ================================================================= string */

const string = {
  label: 'Standing waves on a string (harmonics)', group: 'Waves & sound',
  defaults: { modes: '1 2 3 4 5 6', every: 4, formula: 'sin(n*pi*x)*cos(2.5*n*t)', amp: 0.5, base: 45, labels: true },
  controls: [
    ['modes', 'Harmonics, one after another', 'x', '1 2 3 4 5 6'], ['every', 'Beats per harmonic', 'r', 1, 16, 0.5],
    ['formula', 'String shape y(x, n, t)  (x from 0 to 1)', 'f', 'sin(n*pi*x)*cos(2.5*n*t)', ['x', 'n', 't']],
    ['amp', 'How far it swings', 'r', 0.1, 1, 0.01], ['base', 'Lowest note (MIDI)', 'r', 24, 72, 1], ['labels', 'Show nodes, λ and f', 't'],
  ],
  init(S, P) { S.sc = { list: nums(P.modes, [1, 2, 3]), f: formula(P.formula, ['x', 'n', 't']), k: -1, beat: -1 }; },
  step(S, P, dt, emit) {
    const sc = S.sc, { k } = stepOf(S, P.every, sc.list.length);
    const changed = k !== sc.k;
    if (changed) { sc.k = k; sc.since = S.t; }
    beatNotes(S, sc, emit, [midiOf(P.base, sc.list[k])], changed);
  },
  draw(S, P, D) {
    const { g, pal, k } = D, sc = S.sc, { hw, hh } = S.W;
    const L = hw * 0.92, rows = sc.list.length;
    const rowH = (2 * hh * 0.86) / rows;
    sc.list.forEach((n, i) => {
      const on = i === sc.k, past = i < sc.k;
      const cy = hh * 0.8 - rowH * (i + 0.5);
      const A = Math.min(rowH * 0.42, P.amp * 0.5) * (on ? 1 : 0.8);
      const col = pal.line(i / rows);
      g.globalAlpha = on ? 1 : past ? 0.4 : 0.15;
      // the envelope (where the string can reach)
      g.strokeStyle = hexA(pal.ring, 0.25); g.lineWidth = 1 * k; g.setLineDash([4 * k, 5 * k]);
      for (const sgn of [1, -1]) { g.beginPath(); for (let j = 0; j <= 120; j++) { const u = j / 120; const y = cy + sgn * A * Math.abs(Math.sin(n * Math.PI * u)); j ? g.lineTo(D.X(-L + 2 * L * u), D.Y(y)) : g.moveTo(D.X(-L + 2 * L * u), D.Y(y)); } g.stroke(); }
      g.setLineDash([]);
      // the string
      g.strokeStyle = col; g.lineWidth = (on ? 4 : 2) * k; g.shadowColor = col; g.shadowBlur = on ? 16 * k : 0;
      g.beginPath();
      for (let j = 0; j <= 160; j++) { const u = j / 160; const y = cy + A * clamp(sc.f({ x: u, n, t: S.st }), -1.5, 1.5); j ? g.lineTo(D.X(-L + 2 * L * u), D.Y(y)) : g.moveTo(D.X(-L + 2 * L * u), D.Y(y)); }
      g.stroke(); g.shadowBlur = 0;
      // the two ends are held
      g.fillStyle = '#ffffff';
      for (const x of [-L, L]) { g.beginPath(); g.arc(D.X(x), D.Y(cy), 4 * k, 0, TAU); g.fill(); }
      if (P.labels && (on || past)) {
        for (let j = 1; j < n; j++) { g.fillStyle = '#ff5c7a'; g.beginPath(); g.arc(D.X(-L + (2 * L * j) / n), D.Y(cy), 4 * k, 0, TAU); g.fill(); }
        text(D, `n = ${n}`, D.X(-L) - 4 * k, D.Y(cy + A + 0.04), { size: 13, align: 'left', alpha: 0.8 });
        if (on) {
          bracket(D, -L, -L + (2 * 2 * L) / n > L ? L : -L + (2 * 2 * L) / n, cy - A - 0.07, n === 1 ? 'λ/2 = L' : 'λ = 2L/' + n, '#ffd25c');
          text(D, `f = ${n === 1 ? 'f₁' : n + '·f₁'}`, D.X(L), D.Y(cy + A + 0.04), { size: 14, align: 'right', color: '#7fffd4' });
        }
      }
      g.globalAlpha = 1;
    });
  },
  stats(S) { const n = S.sc.list[S.sc.k] ?? 1; return `harmonic ${n} · ${n + 1} still points · λ = 2L/${n}`; },
  formula: () => 'y = sin(nπx)·cos(ωt),  λ = 2L/n',
};

/* ================================================================= travel */

const travel = {
  label: 'Travelling wave: wavelength, frequency, speed', group: 'Waves & sound',
  defaults: { lambdas: '0.9 0.6 0.4 0.3', every: 6, speed: 0.45, formula: 'sin(2*pi*(x/w - t/p))', amp: 0.18, show: 'both', base: 48 },
  controls: [
    ['lambdas', 'Wavelengths λ, one after another', 'x', '0.9 0.6 0.4'], ['every', 'Beats per wavelength', 'r', 1, 16, 0.5],
    ['speed', 'Wave speed v', 'r', 0.1, 2, 0.01], ['formula', 'Wave y(x, t, w = wavelength λ, p = period)', 'f', 'sin(2*pi*(x/w - t/p))', ['x', 't', 'w', 'p']],
    ['amp', 'Amplitude', 'r', 0.05, 0.4, 0.01], ['show', 'Show', 's', { both: 'Rope and sound', rope: 'Rope (transverse)', sound: 'Sound (longitudinal)' }], ['base', 'Note of the longest wave (MIDI)', 'r', 24, 72, 1],
  ],
  init(S, P) { S.sc = { list: nums(P.lambdas, [0.6]), f: formula(P.formula, ['x', 't', 'w', 'p']), k: -1, beat: -1 }; },
  step(S, P, dt, emit) {
    const sc = S.sc, { k } = stepOf(S, P.every, sc.list.length);
    const changed = k !== sc.k;
    if (changed) sc.k = k;
    beatNotes(S, sc, emit, [midiOf(P.base, sc.list[0] / sc.list[k])], changed);
  },
  draw(S, P, D) {
    const { g, pal, k } = D, sc = S.sc, { hw, hh } = S.W;
    const lam = sc.list[sc.k] ?? 0.6, T = lam / P.speed, X0 = -hw * 0.94, X1 = hw * 0.94;
    const y = (x) => sc.f({ x: x - X0, t: S.st, w: lam, p: T });
    const both = P.show === 'both';
    const ropeY = both ? hh * 0.45 : 0, soundY = both ? -hh * 0.45 : 0;
    if (P.show !== 'sound') {
      text(D, 'rope: beads move up and down', D.X(0), D.Y(ropeY + 0.42), { size: 13, alpha: 0.6 });
      g.strokeStyle = pal.line(0.2); g.lineWidth = 3 * k; g.beginPath();
      for (let j = 0; j <= 200; j++) { const x = X0 + ((X1 - X0) * j) / 200; const yy = ropeY + P.amp * y(x); j ? g.lineTo(D.X(x), D.Y(yy)) : g.moveTo(D.X(x), D.Y(yy)); }
      g.stroke();
      for (let j = 0; j <= 30; j++) {
        const x = X0 + ((X1 - X0) * j) / 30, yy = ropeY + P.amp * y(x), red = j === 15;
        g.fillStyle = red ? '#ff4d6d' : '#ffffff'; g.beginPath(); g.arc(D.X(x), D.Y(yy), (red ? 8 : 4) * k, 0, TAU); g.fill();
      }
      // wavelength bracket between two crests
      let crest = X0;
      for (let x = X0; x < X1 - lam; x += 0.002) if (y(x) > 0.995) { crest = x; break; }
      if (crest + lam < X1) bracket(D, crest, crest + lam, ropeY + P.amp + 0.1, `λ = ${lam}`, '#ffd25c');
    }
    if (P.show !== 'rope') {
      text(D, 'sound: air moves back and forth', D.X(0), D.Y(soundY + 0.42), { size: 13, alpha: 0.6 });
      const H = 0.32;
      for (let j = 0; j <= 70; j++) {
        const x0 = X0 + ((X1 - X0) * j) / 70, x = x0 + P.amp * 0.4 * y(x0), red = j === 35;
        g.strokeStyle = red ? '#ff4d6d' : pal.line(0.5 + 0.2 * y(x0)); g.lineWidth = (red ? 4 : 2.5) * k;
        g.beginPath(); g.moveTo(D.X(x), D.Y(soundY - H)); g.lineTo(D.X(x), D.Y(soundY + H)); g.stroke();
      }
    }
    text(D, `f = v / λ = ${(P.speed / lam).toFixed(2)} waves per second`, D.X(0), D.Y(-hh * 0.95), { size: 15, color: '#7fffd4' });
  },
  stats(S, P) { const l = S.sc.list[S.sc.k] ?? 0.6; return `λ = ${l} · f = ${(P.speed / l).toFixed(2)} · v = f·λ = ${P.speed}`; },
  formula: () => 'v = f · λ',
};

/* ================================================================ fourier */

const COEFF = {
  square: (n) => (n % 2 ? 4 / (Math.PI * n) : 0),
  saw: (n) => (2 * (n % 2 ? 1 : -1)) / (Math.PI * n),
  triangle: (n) => (n % 2 ? (8 / (Math.PI * Math.PI * n * n)) * ((n - 1) / 2 % 2 ? -1 : 1) : 0),
};

const fourier = {
  label: 'Fourier: circles add up to any wave', group: 'Waves & sound',
  defaults: { wave: 'square', terms: 12, every: 2, spin: 0.22, coeff: '4/(pi*n)*mod(n,2)', base: 45 },
  controls: [
    ['wave', 'Target wave', 's', { square: 'Square', saw: 'Sawtooth', triangle: 'Triangle', custom: 'My coefficients b(n)' }],
    ['coeff', 'b(n): size of sin(n·x) (for “My coefficients”)', 'f', '4/(pi*n)*mod(n,2)', ['n']],
    ['terms', 'Most terms', 'r', 1, 40, 1], ['every', 'Beats per new term', 'r', 0.5, 8, 0.5], ['spin', 'Turns per second', 'r', 0.05, 1, 0.01], ['base', 'Note of sin(x) (MIDI)', 'r', 24, 72, 1],
  ],
  coeffs(P) {
    const f = P.wave === 'custom' ? formula(P.coeff, ['n']) : (s) => COEFF[P.wave](s.n);
    const out = [];
    for (let n = 1; out.length < P.terms && n < 400; n++) { const b = f({ n }); if (Math.abs(b) > 1e-9) out.push([n, b]); }
    return out.length ? out : [[1, 1]];
  },
  init(S, P) { S.sc = { c: this.coeffs(P), k: -1, beat: -1 }; },
  step(S, P, dt, emit) {
    const sc = S.sc, { k } = stepOf(S, P.every, sc.c.length, 0.5);
    const changed = k !== sc.k;
    if (changed) sc.k = k;
    if (changed) emit({ type: 'hit', ball: k, x: 0, y: 0, angle: 0, midi: midiOf(P.base, sc.c[k][0]), pitch: 0.5 });
    const b = Math.floor((S.st * S.bpm) / 60);
    if (b !== sc.beat) { sc.beat = b; emit({ type: 'hit', ball: 0, x: 0, y: 0, angle: 0, midi: midiOf(P.base, sc.c[b % (k + 1)][0]), pitch: 0.5 }); }
  },
  draw(S, P, D) {
    const { g, pal, k } = D, sc = S.sc, { hw, hh } = S.W;
    const used = sc.c.slice(0, sc.k + 1);
    const R = 0.24, cx = -hw * 0.52, cy = hh * 0.45;
    const tip = (t) => {
      let x = cx, y = cy; const th = TAU * P.spin * t, pts = [[x, y]];
      for (const [n, b] of used) { x += R * b * Math.cos(n * th); y += R * b * Math.sin(n * th); pts.push([x, y]); }
      return pts;
    };
    const pts = tip(S.st);
    // epicycles
    used.forEach(([, b], i) => {
      const [x, y] = pts[i], [nx, ny] = pts[i + 1];
      g.strokeStyle = hexA(pal.ring, 0.3); g.lineWidth = 1.2 * k; g.beginPath(); g.arc(D.X(x), D.Y(y), Math.abs(R * b) * D.R, 0, TAU); g.stroke();
      g.strokeStyle = pal.line(i / Math.max(1, sc.c.length)); g.lineWidth = 2 * k; g.beginPath(); g.moveTo(D.X(x), D.Y(y)); g.lineTo(D.X(nx), D.Y(ny)); g.stroke();
    });
    const [x, y] = pts[pts.length - 1];
    // the trace: the tip's height over the last turn, pushed out to the right
    const x0 = cx + R * 1.45, span = hw * 0.95 - x0, back = 1 / P.spin;
    g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1 * k; g.beginPath(); g.moveTo(D.X(x), D.Y(y)); g.lineTo(D.X(x0), D.Y(y)); g.stroke();
    g.strokeStyle = pal.line(0.1); g.lineWidth = 2.5 * k; g.beginPath();
    for (let i = 0; i <= 240; i++) { const tt = S.st - (back * i) / 240; const yy = tt < 0 ? cy : tip(tt).at(-1)[1]; const xx = x0 + (span * i) / 240; i ? g.lineTo(D.X(xx), D.Y(yy)) : g.moveTo(D.X(xx), D.Y(yy)); }
    g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(D.X(x), D.Y(y), 5 * k, 0, TAU); g.fill();
    // bottom: the sum over one period against the target
    const by = -hh * 0.42, W = hw * 0.9, A = 0.32;
    const target = (u) => { if (P.wave === 'square') return Math.sign(Math.sin(u)) || 0; if (P.wave === 'saw') return ((u / Math.PI + 1) % 2) - 1; if (P.wave === 'triangle') return (2 / Math.PI) * Math.asin(Math.sin(u)); return null; };
    if (target(1) != null) {
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.setLineDash([5 * k, 5 * k]); g.lineWidth = 1.5 * k; g.beginPath();
      for (let j = 0; j <= 200; j++) { const u = -Math.PI + (TAU * j) / 200; const yy = by + A * target(u); j ? g.lineTo(D.X(-W + (2 * W * j) / 200), D.Y(yy)) : g.moveTo(D.X(-W), D.Y(yy)); }
      g.stroke(); g.setLineDash([]);
    }
    g.strokeStyle = pal.line(0.6); g.lineWidth = 3 * k; g.shadowColor = pal.glow; g.shadowBlur = 12 * k; g.beginPath();
    for (let j = 0; j <= 300; j++) { const u = -Math.PI + (TAU * j) / 300; let s = 0; for (const [n, b] of used) s += b * Math.sin(n * u); const yy = by + A * s; j ? g.lineTo(D.X(-W + (2 * W * j) / 300), D.Y(yy)) : g.moveTo(D.X(-W), D.Y(yy)); }
    g.stroke(); g.shadowBlur = 0;
    const terms = used.map(([n]) => (n === 1 ? 'sin x' : `sin ${n}x`)).slice(0, 5).join(' + ') + (used.length > 5 ? ' + …' : '');
    text(D, terms, D.X(0), D.Y(by - A - 0.12), { size: 14, alpha: 0.75 });
  },
  stats(S) { return `terms: ${S.sc.k + 1}`; },
  formula: (P) => ({ square: 'square = Σ sin(nx)/n, n odd', saw: 'saw = Σ ±sin(nx)/n', triangle: 'triangle = Σ ±sin(nx)/n², n odd', custom: 'Σ b(n)·sin(nx)' }[P.wave]),
};

/* ================================================================== beats */

const beats = {
  label: 'Beats: two close notes swell and fade', group: 'Waves & sound',
  defaults: { f1: 6, gaps: '2 1 0.5 0.25 0', every: 6, y1: 'sin(2*pi*a*t)', y2: 'sin(2*pi*b*t)', window: 3, base: 57 },
  controls: [
    ['gaps', 'f₂ − f₁, one after another', 'x', '2 1 0.5 0'], ['every', 'Beats per step', 'r', 1, 16, 0.5], ['f1', 'f₁ (waves per second, drawn)', 'r', 1, 20, 0.5],
    ['y1', 'Wave 1 y₁(t, a = f₁)', 'f', 'sin(2*pi*a*t)', ['t', 'a', 'b']], ['y2', 'Wave 2 y₂(t, b = f₂)', 'f', 'sin(2*pi*b*t)', ['t', 'a', 'b']],
    ['window', 'Seconds shown', 'r', 1, 8, 0.5], ['base', 'Note (MIDI)', 'r', 36, 84, 1],
  ],
  init(S, P) { S.sc = { list: nums(P.gaps, [1]), y1: formula(P.y1, ['t', 'a', 'b']), y2: formula(P.y2, ['t', 'a', 'b']), k: -1, beat: -1, swell: -1 }; },
  step(S, P, dt, emit) {
    const sc = S.sc, { k } = stepOf(S, P.every, sc.list.length);
    if (k !== sc.k) { sc.k = k; sc.swell = -1; }
    const df = sc.list[k];
    // one note on every swell (|f₁ − f₂| per second), or a steady pulse when they match
    const rate = df > 0 ? df : S.bpm / 60;
    const n = Math.floor(S.st * rate);
    if (n !== sc.swell) { sc.swell = n; emit({ type: 'hit', ball: 0, x: 0, y: 0, angle: 0, midi: P.base, pitch: 0.5 }); emit({ type: 'hit', ball: 1, x: 0, y: 0, angle: 0, midi: P.base + (df > 0 ? 1 : 0), pitch: 0.5, together: true }); }
  },
  draw(S, P, D) {
    const { g, pal, k } = D, sc = S.sc, { hw, hh } = S.W;
    const a = P.f1, b = P.f1 + (sc.list[sc.k] ?? 0), W = hw * 0.94, win = P.window;
    const row = (cy, fn, col, A, lw) => {
      g.strokeStyle = col; g.lineWidth = lw * k; g.beginPath();
      for (let j = 0; j <= 400; j++) { const t = S.st - win + (win * j) / 400; const yy = cy + A * fn(t); j ? g.lineTo(D.X(-W + (2 * W * j) / 400), D.Y(yy)) : g.moveTo(D.X(-W), D.Y(yy)); }
      g.stroke();
    };
    const y1 = (t) => sc.y1({ t, a, b }), y2 = (t) => sc.y2({ t, a, b });
    text(D, `f₁ = ${a}`, D.X(-W), D.Y(hh * 0.82), { size: 13, align: 'left', alpha: 0.7 });
    row(hh * 0.62, y1, pal.line(0.1), 0.14, 2);
    text(D, `f₂ = ${b}`, D.X(-W), D.Y(hh * 0.38), { size: 13, align: 'left', alpha: 0.7 });
    row(hh * 0.18, y2, pal.line(0.5), 0.14, 2);
    text(D, 'together', D.X(-W), D.Y(-hh * 0.08), { size: 13, align: 'left', alpha: 0.7 });
    const cy = -hh * 0.5;
    // the envelope 2·cos(π(f₂ − f₁)t): the swell you hear
    g.setLineDash([5 * k, 5 * k]);
    row(cy, (t) => Math.abs(2 * Math.cos(Math.PI * (b - a) * t)), 'rgba(255,210,92,0.7)', 0.16, 1.5);
    row(cy, (t) => -Math.abs(2 * Math.cos(Math.PI * (b - a) * t)), 'rgba(255,210,92,0.7)', 0.16, 1.5);
    g.setLineDash([]);
    g.shadowColor = pal.glow; g.shadowBlur = 12 * k;
    row(cy, (t) => y1(t) + y2(t), '#ffffff', 0.16, 2.5);
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1 * k; g.beginPath(); g.moveTo(D.X(W), D.Y(hh * 0.9)); g.lineTo(D.X(W), D.Y(-hh * 0.9)); g.stroke();
  },
  stats(S, P) { const d = S.sc.list[S.sc.k] ?? 0; return d > 0 ? `${d} beat${d === 1 ? '' : 's'} per second = |f₂ − f₁|` : 'same note: no beats'; },
  formula: () => 'y₁ + y₂ = 2·cos(π(f₂−f₁)t)·sin(π(f₁+f₂)t)',
};

/* ================================================================== scope */

const INTERVALS = { '1:1': 'unison', '2:1': 'octave', '3:2': 'perfect fifth', '4:3': 'perfect fourth', '5:4': 'major third', '6:5': 'minor third', '5:3': 'major sixth', '8:5': 'minor sixth', '9:8': 'whole tone', '16:15': 'semitone', '45:32': 'tritone', '15:8': 'major seventh' };

const scope = {
  label: 'Oscilloscope: musical intervals as shapes', group: 'Waves & sound',
  defaults: { intervals: '1:1 2:1 3:2 4:3 5:4 6:5 5:3 45:32', every: 4, drift: 0.35, x: 'sin(a*s)', y: 'sin(b*s + d)', base: 57 },
  controls: [
    ['intervals', 'Ratios b:a, one after another', 'x', '2:1 3:2 4:3 5:4'], ['every', 'Beats per interval', 'r', 1, 16, 0.5], ['drift', 'Phase drift', 'r', 0, 2, 0.01],
    ['x', 'Beam x(s, a, b, d)', 'f', 'sin(a*s)', ['s', 'a', 'b', 'd']], ['y', 'Beam y(s, a, b, d)', 'f', 'sin(b*s + d)', ['s', 'a', 'b', 'd']], ['base', 'Lower note (MIDI)', 'r', 36, 72, 1],
  ],
  init(S, P) { S.sc = { list: pairs(P.intervals, [[3, 2]]), fx: formula(P.x, ['s', 'a', 'b', 'd']), fy: formula(P.y, ['s', 'a', 'b', 'd']), k: -1, beat: -1 }; },
  step(S, P, dt, emit) {
    const sc = S.sc, { k } = stepOf(S, P.every, sc.list.length);
    const changed = k !== sc.k;
    if (changed) sc.k = k;
    const [hi, lo] = sc.list[k];
    beatNotes(S, sc, emit, [P.base, midiOf(P.base, hi / lo)], changed);
  },
  draw(S, P, D) {
    const { g, pal, k } = D, sc = S.sc, { hw } = S.W;
    const [hi, lo] = sc.list[sc.k] ?? [3, 2];
    const R = Math.min(hw, 1) * 0.9;
    // screen and grid
    g.fillStyle = 'rgba(0,30,20,0.55)'; g.fillRect(D.X(-R), D.Y(R), 2 * R * D.R, 2 * R * D.R);
    g.strokeStyle = hexA(pal.ring, 0.18); g.lineWidth = 1 * k;
    for (let i = -4; i <= 4; i++) { g.beginPath(); g.moveTo(D.X((R * i) / 4), D.Y(R)); g.lineTo(D.X((R * i) / 4), D.Y(-R)); g.moveTo(D.X(-R), D.Y((R * i) / 4)); g.lineTo(D.X(R), D.Y((R * i) / 4)); g.stroke(); }
    g.strokeStyle = pal.ring; g.lineWidth = 3 * k; g.strokeRect(D.X(-R), D.Y(R), 2 * R * D.R, 2 * R * D.R);
    const d = P.drift * S.st;
    g.strokeStyle = pal.line(0.15); g.lineWidth = 3 * k; g.shadowColor = pal.glow; g.shadowBlur = 16 * k; g.beginPath();
    const N = 900;
    for (let j = 0; j <= N; j++) {
      const s = (TAU * j) / N, x = R * 0.85 * clamp(sc.fx({ s, a: lo, b: hi, d }), -1.2, 1.2), y = R * 0.85 * clamp(sc.fy({ s, a: lo, b: hi, d }), -1.2, 1.2);
      j ? g.lineTo(D.X(x), D.Y(y)) : g.moveTo(D.X(x), D.Y(y));
    }
    g.stroke(); g.shadowBlur = 0;
    const name = INTERVALS[`${hi}:${lo}`] || '';
    text(D, `${hi} : ${lo}${name ? '  ·  ' + name : ''}`, D.X(0), D.Y(-R - 0.14), { size: 22, color: '#7fffd4' });
  },
  stats(S) { const [hi, lo] = S.sc.list[S.sc.k] ?? [3, 2]; return `frequency ratio ${hi}:${lo}`; },
  formula: () => 'x = sin(a·s),  y = sin(b·s + d)',
};

/* ================================================================ doppler */

const doppler = {
  label: 'Doppler effect and the Mach cone', group: 'Waves & sound',
  defaults: { machs: '0 0.5 0.9 1 1.5', every: 6, gap: 0.16, c: 0.55, path: 'line', base: 60 },
  controls: [
    ['machs', 'Speed of the source (× speed of sound), one after another', 'x', '0 0.5 0.9 1.5'], ['every', 'Beats per speed', 'r', 2, 16, 0.5],
    ['gap', 'Seconds between wave crests', 'r', 0.05, 0.5, 0.01], ['c', 'Speed of sound (drawn)', 'r', 0.2, 1.5, 0.01], ['path', 'Path', 's', { line: 'Left to right', circle: 'In a circle' }], ['base', 'Note when still (MIDI)', 'r', 36, 84, 1],
  ],
  init(S, P) { S.sc = { list: nums(P.machs, [0.5]), k: -1, fronts: [], next: 0, x: 0, y: 0, start: 0, ang: 0 }; },
  pos(S, P, M) {
    const sc = S.sc, { hw } = S.W, u = (S.st - sc.start) * M * P.c;
    if (P.path === 'circle') { const r = 0.6; sc.ang = u / r; return [Math.cos(sc.ang) * r, Math.sin(sc.ang) * r]; }
    if (M <= 0) return [0, 0]; // standing still: in the middle
    const L = 2 * hw * 0.9;
    return [-hw * 0.9 + (((u % L) + L) % L), 0];
  },
  step(S, P, dt, emit) {
    const sc = S.sc, { k } = stepOf(S, P.every, sc.list.length);
    if (k !== sc.k) { sc.k = k; sc.start = S.st; sc.fronts = []; }
    const M = sc.list[k];
    const [x, y] = this.pos(S, P, M);
    sc.x = x; sc.y = y;
    while (S.st >= sc.next) {
      sc.next += P.gap;
      sc.fronts.push([x, y, S.st]);
      // what the listener in front hears: f′ = f / (1 − M), capped
      const ratio = M < 0.95 ? 1 / (1 - M) : 4;
      emit({ type: 'hit', ball: 0, x, y, angle: 0, midi: midiOf(P.base, Math.min(4, ratio)), pitch: 0.5 });
    }
    sc.fronts = sc.fronts.filter((f) => (S.st - f[2]) * P.c < 3);
  },
  draw(S, P, D) {
    const { g, pal, k } = D, sc = S.sc;
    for (const [x, y, t0] of sc.fronts) {
      const r = (S.st - t0) * P.c;
      g.globalAlpha = Math.max(0, 1 - r / 3) * 0.8; g.strokeStyle = pal.line(r * 0.3); g.lineWidth = 2 * k;
      g.beginPath(); g.arc(D.X(x), D.Y(y), r * D.R, 0, TAU); g.stroke();
    }
    g.globalAlpha = 1;
    g.fillStyle = '#ffffff'; g.shadowColor = pal.glow; g.shadowBlur = 20 * k;
    g.beginPath(); g.arc(D.X(sc.x), D.Y(sc.y), 9 * k, 0, TAU); g.fill(); g.shadowBlur = 0;
    const M = sc.list[sc.k] ?? 0;
    if (M > 1 && P.path === 'line') {
      // the Mach cone: sin θ = 1/M
      const th = Math.asin(1 / M), L = 1.6;
      g.strokeStyle = '#ffd25c'; g.lineWidth = 2.5 * k; g.beginPath();
      g.moveTo(D.X(sc.x - L * Math.cos(th)), D.Y(sc.y + L * Math.sin(th))); g.lineTo(D.X(sc.x), D.Y(sc.y)); g.lineTo(D.X(sc.x - L * Math.cos(th)), D.Y(sc.y - L * Math.sin(th))); g.stroke();
    }
    text(D, M === 0 ? 'standing still' : M < 1 ? `${M} × the speed of sound` : M === 1 ? 'the sound barrier' : `${M} × the speed of sound: a sonic boom`, D.X(0), D.Y(-S.W.hh * 0.92), { size: 16, color: '#7fffd4' });
  },
  stats(S) { const M = S.sc.list[S.sc.k] ?? 0; return M <= 0 ? 'standing still: same pitch all around' : M < 1 ? `ahead: ${(1 / (1 - M)).toFixed(2)} × higher pitch` : 'faster than its own sound'; },
  formula: () => 'f′ = f / (1 − v/c)',
};

export const WAVES = { string, travel, fourier, beats, scope, doppler };
