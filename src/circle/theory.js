/**
 * Music theory and complex numbers on a circle. Same contract as scenes.js.
 *
 *   fifths   the circle of fifths: the 12 keys round a wheel, the relative minors inside.
 *            walk the keys, play a chord progression (I V vi IV …), see a scale as 7 neighbours,
 *            see that 12 fifths do not close (the Pythagorean comma), major ⇄ relative minor
 *   roots    the n roots of z^n = 1 on the unit circle: they appear one by one (a note each),
 *            powers of one root draw a star polygon, multiplying by a complex number turns
 *            and scales, the roots add up to zero, Euler's e^{iθ}
 *
 * Notes are exact (`midi`), so the real chords sound; deterministic, no DOM.
 */
import { frac } from './palettes.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const pulse = (time, since) => Math.max(0, 1 - (time - since) / 0.45);

function label(D, s, x, y, { size = 22, color = '#ffffff', align = 'center', weight = 700, alpha = 1 } = {}) {
  const { g, k } = D;
  g.save();
  g.globalAlpha = alpha; g.fillStyle = color;
  g.font = `${weight} ${size * k}px ui-sans-serif, system-ui, sans-serif`; g.textAlign = align; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = Math.max(3, size * 0.22) * k; g.strokeStyle = 'rgba(6,9,22,0.85)'; g.strokeText(s, x, y); // a dark halo keeps text readable over lines
  g.fillText(s, x, y);
  g.restore();
}

function dot(g, x, y, r, color, k, blur = 16) {
  g.fillStyle = color; g.shadowColor = color; g.shadowBlur = blur * k;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.shadowBlur = 0;
}

/** A ring sector between radii r0, r1 and angles a0, a1 (world angles, counter-clockwise). */
function sector(D, r0, r1, a0, a1) {
  const { g } = D, n = Math.max(3, Math.ceil(Math.abs(a1 - a0) / 0.08));
  g.beginPath();
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; g[i ? 'lineTo' : 'moveTo'](D.X(Math.cos(a) * r1), D.Y(Math.sin(a) * r1)); }
  for (let i = n; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / n; g.lineTo(D.X(Math.cos(a) * r0), D.Y(Math.sin(a) * r0)); }
  g.closePath();
}

function arrow(D, x1, y1, x2, y2, color, width = 3) {
  const { g, k } = D;
  const X1 = D.X(x1), Y1 = D.Y(y1), X2 = D.X(x2), Y2 = D.Y(y2), a = Math.atan2(Y2 - Y1, X2 - X1), h = 11 * k;
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = width * k; g.lineCap = 'round';
  g.beginPath(); g.moveTo(X1, Y1); g.lineTo(X2, Y2); g.stroke();
  g.beginPath(); g.moveTo(X2, Y2); g.lineTo(X2 - h * Math.cos(a - 0.4), Y2 - h * Math.sin(a - 0.4)); g.lineTo(X2 - h * Math.cos(a + 0.4), Y2 - h * Math.sin(a + 0.4)); g.closePath(); g.fill();
}

/** Beat length in seconds and the index of the step playing now (one step every `every` beats). */
const stepLen = (S, every) => (60 / S.bpm) * Math.max(0.25, every);

/* ============================================================ circle of fifths */

const NAMES = {
  mixed: ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'D♭', 'A♭', 'E♭', 'B♭', 'F'],
  sharps: ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯', 'G♯', 'D♯', 'A♯', 'F'],
  flats: ['C', 'G', 'D', 'A', 'E', 'B', 'G♭', 'D♭', 'A♭', 'E♭', 'B♭', 'F'],
};
const MINORS = {
  mixed: ['Am', 'Em', 'Bm', 'F♯m', 'C♯m', 'G♯m', 'D♯m', 'B♭m', 'Fm', 'Cm', 'Gm', 'Dm'],
  sharps: ['Am', 'Em', 'Bm', 'F♯m', 'C♯m', 'G♯m', 'D♯m', 'A♯m', 'Fm', 'Cm', 'Gm', 'Dm'],
  flats: ['Am', 'Em', 'Bm', 'F♯m', 'C♯m', 'G♯m', 'E♭m', 'B♭m', 'Fm', 'Cm', 'Gm', 'Dm'],
};
const PITCH = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const KEYS = Object.fromEntries(PITCH.map((n, i) => [String(i), n]));
const pcOf = (p) => (((p * 7) % 12) + 12) % 12; // pitch class of a position on the wheel
const posOf = (pc) => (((pc * 7) % 12) + 12) % 12; // 7 × 7 = 49 ≡ 1 (mod 12): the same map goes back
const wrap12 = (p) => ((p % 12) + 12) % 12;
const sig = (p) => (p === 0 ? 'no ♯ or ♭' : p < 6 ? `${p}♯` : p === 6 ? '6♯ or 6♭' : `${12 - p}♭`);
const angleOf = (p) => Math.PI / 2 - (p * TAU) / 12;

const CHORDS = { note: 'Just the root', power: 'Power chord (root + fifth)', triad: 'Triad', seventh: 'Seventh chord' };

/** Notes of a chord: root pitch class, minor or major, kind. Lowest root = `base` (MIDI). */
function chordNotes(pc, minor, kind, base) {
  const r = base + pc;
  if (kind === 'note') return [r];
  if (kind === 'power') return [r, r + 7];
  const tri = [r, r + (minor ? 3 : 4), r + 7];
  return kind === 'seventh' ? [...tri, r + (minor ? 10 : 11)] : tri;
}

/** Roman numeral → { p, minor } (position on the wheel, quality) for the tonic at position t. */
const ROMAN = { I: [0, false], IV: [-1, false], V: [1, false], vi: [0, true], ii: [-1, true], iii: [1, true] };
function parseProg(text) {
  const out = String(text || '').split(/[\s,\-–>]+/).filter((x) => ROMAN[x]);
  return out.length ? out : ['I', 'V', 'vi', 'IV'];
}

function play(emit, notes, ball, x, y, angle) {
  notes.forEach((m, i) => emit({ type: 'hit', ball, x, y, angle, midi: m, pitch: clamp((m - 36) / 60, 0, 1), together: i > 0 }));
}

const fifths = {
  label: 'Circle of fifths (keys, chords, scales)', group: 'Music theory',
  defaults: { mode: 'walk', key: '0', dir: 'up', chord: 'triad', every: 2, steps: 12, prog: 'I V vi IV', minor: true, names: 'mixed', base: 48, labels: true },
  controls: [
    ['mode', 'Show', 's', { walk: 'Walk the keys (one fifth at a time)', family: 'A chord progression (I V vi IV …)', scale: 'A scale = 7 neighbours', relative: 'Major and its relative minor', comma: '12 fifths never close (the comma)' }],
    ['key', 'Start key', 's', KEYS],
    ['dir', 'Direction', 's', { up: 'Up in fifths (clockwise ♯)', down: 'Up in fourths (anticlockwise ♭)' }],
    ['chord', 'Chord', 's', CHORDS],
    ['every', 'Beats per step', 'r', 0.5, 8, 0.5],
    ['steps', 'Keys to visit', 'r', 2, 24, 1],
    ['prog', 'Progression (I IV V ii iii vi)', 'x', 'I V vi IV'],
    ['minor', 'Show the relative minors', 't'],
    ['names', 'Names', 's', { mixed: 'C G D … F♯ D♭ A♭', sharps: 'Sharps (C♯ G♯ D♯ A♯)', flats: 'Flats (G♭ D♭ A♭ E♭ B♭)' }],
    ['base', 'Lowest root (MIDI)', 'r', 24, 60, 1],
    ['labels', 'Show names and key signature', 't'],
  ],
  init(S, P) {
    const t = posOf(+P.key || 0);
    const prog = parseProg(P.prog);
    const plan = [];
    const base = P.base | 0, kind = P.chord;
    const add = (p, minor, ring) => plan.push({ p: wrap12(p), minor, ring });
    switch (P.mode) {
      case 'family': for (const r of prog) { const [d, m] = ROMAN[r]; add(t + d, m, m ? 'in' : 'out'); } break;
      case 'scale': {
        for (let i = 0; i < 7; i++) add(t - 1 + i, false, 'out'); // F C G D A E B for C: seven neighbours, stacked in fifths
        const pcs = [0, 2, 4, 5, 7, 9, 11, 12].map((s) => pcOf(t) + s); // then the same notes in order of pitch
        for (const q of pcs) { const pc = ((q % 12) + 12) % 12; plan.push({ p: posOf(pc), minor: false, ring: 'out', scalePc: q, up: true }); }
        break;
      }
      case 'relative': for (let i = 0; i < (P.steps | 0); i++) { const p = t + (P.dir === 'down' ? -i : i); add(p, false, 'out'); add(p, true, 'in'); } break;
      case 'comma': for (let k = 0; k <= 12; k++) plan.push({ k }); break;
      default: for (let i = 0; i < (P.steps | 0); i++) add(t + (P.dir === 'down' ? -i : i), false, 'out');
    }
    S.sc = { plan, k: -1, since: -9, t, visited: [], base, kind, prog, hold: 0 };
  },
  step(S, P, dt, emit) {
    const sc = S.sc, len = stepLen(S, P.mode === 'relative' ? P.every / 2 : P.every);
    const k = Math.min(sc.plan.length - 1, Math.floor(S.st / len));
    while (sc.k < k) {
      sc.k++;
      sc.since = S.t;
      const s = sc.plan[sc.k];
      if (P.mode === 'comma') {
        const cents = (s.k * 701.955) % 1200;
        const m = sc.base + cents / 100;
        const a = angleOf(0) - (cents / 1200) * TAU;
        emit({ type: 'hit', ball: s.k, x: Math.cos(a) * 0.9, y: Math.sin(a) * 0.9, angle: a, midi: m, pitch: clamp((m - 36) / 60, 0, 1) });
        if (s.k === 12) emit({ type: 'hit', ball: 13, x: 0.9, y: 0, angle: 0, midi: sc.base, pitch: 0.2, together: true });
        continue;
      }
      sc.visited.push(sc.k);
      const pc = s.scalePc != null ? s.scalePc : pcOf(s.p) + (s.minor ? 9 : 0);
      const a = angleOf(s.p), r = s.ring === 'in' ? 0.5 : 0.82;
      const notes = s.scalePc != null ? [sc.base + 12 + s.scalePc] : chordNotes(((pc % 12) + 12) % 12, s.minor, P.mode === 'scale' ? 'note' : sc.kind, sc.base);
      play(emit, notes, s.p, Math.cos(a) * r, Math.sin(a) * r, a);
    }
  },
  draw(S, P, D) {
    const { g, pal, k, time } = D, sc = S.sc;
    const names = NAMES[P.names] || NAMES.mixed, minors = MINORS[P.names] || MINORS.mixed;
    const cur = sc.plan[Math.max(0, sc.k)];
    if (P.mode === 'comma') return drawComma(S, P, D);
    // which sectors are lit: the current one fully, the ones already visited softly
    const lit = new Map();
    const light = (key, v) => lit.set(key, Math.max(lit.get(key) || 0, v));
    sc.plan.forEach((s, i) => {
      if (i > sc.k) return;
      const key = `${s.ring}${s.p}`;
      light(key, i === sc.k ? 1 : P.mode === 'scale' ? 0.7 : 0.35);
    });
    g.lineWidth = 1.5 * k;
    for (let p = 0; p < 12; p++) {
      const a = angleOf(p), a0 = a - Math.PI / 12, a1 = a + Math.PI / 12, col = pal.line(p / 12);
      for (const ring of P.minor ? ['out', 'in'] : ['out']) {
        const [r0, r1] = ring === 'out' ? [0.66, 0.98] : [0.37, 0.64];
        const v = lit.get(`${ring}${p}`) || 0;
        const fl = cur && sc.k >= 0 && cur.p === p && cur.ring === ring ? pulse(time, sc.since) : 0;
        sector(D, r0, r1, a0 + 0.012, a1 - 0.012);
        g.globalAlpha = 0.12 + 0.62 * v + 0.2 * fl; g.fillStyle = col; g.fill();
        g.globalAlpha = 0.5 + 0.5 * v; g.strokeStyle = col; g.stroke();
        g.globalAlpha = 1;
        if (P.labels) {
          const r = (r0 + r1) / 2;
          label(D, ring === 'out' ? names[p] : minors[p], D.X(Math.cos(a) * r), D.Y(Math.sin(a) * r), { size: ring === 'out' ? 31 : 22, alpha: 0.55 + 0.45 * v, color: v > 0.9 ? '#ffffff' : '#dfe8ff' });
        }
      }
    }
    // the readout in the middle
    if (cur && sc.k >= 0) {
      const name = cur.scalePc != null ? PITCH[((cur.scalePc % 12) + 12) % 12] : cur.minor ? minors[cur.p] : names[cur.p];
      label(D, name, D.X(0), D.Y(0.12), { size: 56, color: pal.line(cur.p / 12) });
      if (P.labels) label(D, P.mode === 'scale' ? (sc.k < 7 ? 'stacking fifths' : 'now in pitch order') : sig(cur.minor ? wrap12(cur.p) : cur.p), D.X(0), D.Y(-0.12), { size: 22, alpha: 0.85 });
      if (P.mode === 'family') label(D, sc.prog[Math.min(sc.k, sc.prog.length - 1)], D.X(0), D.Y(-0.27), { size: 24, color: '#ffd27a' });
    }
    // sparks of the step that just played: a line to the middle
    if (cur && sc.k >= 0) {
      const a = angleOf(cur.p), r = cur.ring === 'in' ? 0.5 : 0.82, f = pulse(time, sc.since);
      if (f > 0) dot(g, D.X(Math.cos(a) * r), D.Y(Math.sin(a) * r), (6 + 12 * f) * k, '#ffffff', k, 22);
    }
    // walk mode: the path of fifths so far
    if (P.mode === 'walk' && sc.k > 0) {
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2 * k; g.beginPath();
      for (let i = 0; i <= sc.k; i++) { const a = angleOf(sc.plan[i].p); g[i ? 'lineTo' : 'moveTo'](D.X(Math.cos(a) * 0.82), D.Y(Math.sin(a) * 0.82)); }
      g.stroke();
    }
    // the line under the wheel
    label(D, fifths.line(S, P), D.X(0), D.Y(-1.12), { size: 20, alpha: 0.85, weight: 600 });
  },
  line(S, P) {
    const sc = S.sc, s = sc.plan[Math.max(0, sc.k)];
    if (!s) return '';
    const names = NAMES[P.names] || NAMES.mixed;
    switch (P.mode) {
      case 'walk': return sc.k < 1 ? 'one step = a perfect fifth (3 : 2)' : `${names[sc.plan[sc.k - 1].p]} → ${names[s.p]}: a ${P.dir === 'down' ? 'fourth (4 : 3) up' : 'fifth (3 : 2) up'}`;
      case 'family': return 'the three chords next to the key, and their minors';
      case 'scale': return sc.k < 7 ? `${names[s.p]} joins the family` : 'the same 7 notes, now in pitch order';
      case 'relative': return `${names[s.p]} major and ${(MINORS[P.names] || MINORS.mixed)[s.p]} share the same key signature`;
      default: return '';
    }
  },
  stats(S, P) {
    const sc = S.sc, s = sc.plan[Math.max(0, sc.k)];
    if (!s || s.k != null) return '12 × 3/2 vs 7 × 2';
    return `${(NAMES[P.names] || NAMES.mixed)[s.p]} · ${sig(s.p)}`;
  },
  formula: (P) => (P.mode === 'comma' ? '(3/2)^12 ≠ 2^7' : 'a fifth: ×3/2 (7 semitones)'),
};

/** The Pythagorean comma: 12 perfect fifths overshoot 7 octaves by 23.46 cents. */
function drawComma(S, P, D) {
  const { g, pal, k, time } = D, sc = S.sc;
  const R = 0.88, ang = (cents) => Math.PI / 2 - (cents / 1200) * TAU;
  g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2 * k;
  g.beginPath(); g.arc(D.X(0), D.Y(0), R * D.R, 0, TAU); g.stroke();
  // the 12 equal semitones, and the perfect (closed) star for reference
  for (let i = 0; i < 12; i++) {
    const a = ang(i * 100);
    dot(g, D.X(Math.cos(a) * R), D.Y(Math.sin(a) * R), 4 * k, 'rgba(255,255,255,0.7)', k, 6);
    label(D, PITCH[i], D.X(Math.cos(a) * (R + 0.11)), D.Y(Math.sin(a) * (R + 0.11)), { size: 19, alpha: 0.7 });
  }
  g.setLineDash([6 * k, 8 * k]); g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1.5 * k; g.beginPath();
  for (let i = 0; i <= 12; i++) { const a = ang(((i * 700) % 1200)); g[i ? 'lineTo' : 'moveTo'](D.X(Math.cos(a) * R), D.Y(Math.sin(a) * R)); }
  g.stroke(); g.setLineDash([]);
  // the real fifths (701.955 cents each)
  const n = Math.max(0, sc.k);
  g.lineWidth = 3 * k; g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a0 = ang(i * 701.955), a1 = ang((i + 1) * 701.955);
    g.strokeStyle = pal.line(i / 12);
    g.beginPath(); g.moveTo(D.X(Math.cos(a0) * R), D.Y(Math.sin(a0) * R)); g.lineTo(D.X(Math.cos(a1) * R), D.Y(Math.sin(a1) * R)); g.stroke();
  }
  const a = ang(n * 701.955), f = pulse(time, sc.since);
  dot(g, D.X(Math.cos(a) * R), D.Y(Math.sin(a) * R), (8 + 8 * f) * k, n === 12 ? '#ff4d6d' : '#ffffff', k, 22);
  if (n === 12) {
    // the gap: an arc from the starting C to where the twelfth fifth lands (7° wide, drawn thick)
    const a0 = ang(0), a1 = ang(23.46);
    g.strokeStyle = '#ff4d6d'; g.lineWidth = 7 * k;
    g.beginPath(); g.arc(D.X(0), D.Y(0), (R + 0.045) * D.R, -a0, -a1, false); g.stroke();
    label(D, '23.46 ¢', D.X(0.32), D.Y(R + 0.17), { size: 26, color: '#ff4d6d' });
    label(D, 'the Pythagorean comma', D.X(0), D.Y(0.12), { size: 25, color: '#ff4d6d' });
    label(D, '12 fifths ≠ 7 octaves', D.X(0), D.Y(-0.1), { size: 22, alpha: 0.9 });
  } else {
    label(D, n ? `${n} × 3/2` : 'start on C', D.X(0), D.Y(0), { size: 36, color: pal.line(n / 12) });
  }
  label(D, n === 12 ? 'the twelfth C is a little sharp' : 'stack perfect fifths round the circle', D.X(0), D.Y(-1.12), { size: 20, alpha: 0.85, weight: 600 });
}

/* ================================================================ roots of unity */

const roots = {
  label: 'Roots of unity (complex numbers on the circle)', group: 'Complex numbers',
  defaults: { mode: 'roots', n: 6, n2: 6, m: 2, all: false, every: 1, rho: 1, angle: 90, start: 0, steps: 8, sweep: 8, to: 1, primitive: false, labels: true, axes: true },
  controls: [
    ['mode', 'Show', 's', { roots: 'The roots appear one by one', power: 'Powers of one root (star polygons)', multiply: 'Multiply by a complex number', sum: 'The roots add up to zero', euler: 'Euler: e^(iθ) goes round' }],
    ['n', 'Roots n (z^n = 1)', 'r', 2, 24, 1], ['n2', 'Grow up to n =', 'r', 2, 24, 1],
    ['m', 'Step m (powers of ω^m)', 'r', 1, 23, 1], ['all', 'Try every m in turn', 't'],
    ['every', 'Beats per step', 'r', 0.25, 4, 0.25],
    ['rho', 'Multiply by: size ρ', 'r', 0.7, 1.1, 0.01], ['angle', 'Multiply by: angle (°)', 'r', -180, 180, 1], ['start', 'Start angle (°)', 'r', -180, 180, 1], ['steps', 'Multiplications', 'r', 2, 48, 1],
    ['sweep', 'Euler: seconds to turn', 'r', 2, 30, 0.5], ['to', 'Euler: turn to (× π)', 'r', 0.25, 4, 0.25],
    ['primitive', 'Light up the primitive roots', 't'], ['labels', 'Show numbers and formulas', 't'], ['axes', 'Show the Re / Im axes', 't'],
  ],
  init(S, P) {
    const n0 = Math.max(2, P.n | 0), n1 = Math.max(n0, P.n2 | 0);
    const stages = [];
    if (P.mode === 'power' && P.all) for (let m = 1; m < n0; m++) stages.push({ n: n0, m });
    else if (P.mode === 'power') stages.push({ n: n0, m: clamp(P.m | 0, 1, n0 - 1) });
    else if (P.mode === 'roots' || P.mode === 'sum') for (let n = n0; n <= n1; n++) stages.push({ n });
    else stages.push({ n: n0 });
    // beats of every stage: one step per `every` beats, then two beats of rest
    stages.forEach((s) => {
      s.count = P.mode === 'power' ? s.n / gcd(s.n, s.m) : P.mode === 'multiply' ? Math.max(2, P.steps | 0) : s.n;
      s.beats = s.count * Math.max(0.25, P.every) + 2;
    });
    S.sc = { stages, stage: 0, step: -1, since: -9, flash: -9, t0: 0, ping: -1 };
  },
  locate(S, P) {
    // the stage and step playing at simulation time S.st
    const beat = (S.st * S.bpm) / 60;
    let acc = 0;
    for (let i = 0; i < S.sc.stages.length; i++) {
      const st = S.sc.stages[i];
      if (beat < acc + st.beats || i === S.sc.stages.length - 1) {
        const local = beat - acc;
        return { i, st, step: Math.min(st.count, Math.floor(local / Math.max(0.25, P.every))), local };
      }
      acc += st.beats;
    }
    return null;
  },
  step(S, P, dt, emit) {
    const sc = S.sc;
    if (P.mode === 'euler') {
      const b = Math.floor((S.st * S.bpm) / 60 / Math.max(0.25, P.every));
      if (b !== sc.ping && S.st < P.sweep + 1) {
        sc.ping = b;
        const th = this.theta(S, P);
        emit({ type: 'hit', ball: 0, x: Math.cos(th), y: Math.sin(th), angle: th, pitch: (Math.cos(th) + 1) / 2 });
        emit({ type: 'hit', ball: 1, x: Math.cos(th), y: Math.sin(th), angle: th, pitch: (Math.sin(th) + 1) / 2, together: true });
      }
      return;
    }
    const at = this.locate(S, P);
    if (at.i !== sc.stage) { sc.stage = at.i; sc.step = -1; }
    while (sc.step < at.step && sc.step < at.st.count) {
      sc.step++;
      if (sc.step >= at.st.count && P.mode !== 'power' && P.mode !== 'sum') break;
      sc.since = S.t;
      const j = sc.step, n = at.st.n;
      if (P.mode === 'roots' || P.mode === 'sum') {
        if (j < n) { const a = Math.PI / 2 - (j * TAU) / n; emit({ type: 'hit', ball: j, x: Math.cos(a), y: Math.sin(a), angle: a, pitch: j / n, balls: n }); }
        if (j === n - 1) sc.flash = S.t;
      } else if (P.mode === 'power') {
        const idx = (j * at.st.m) % n, a = Math.PI / 2 - (idx * TAU) / n;
        if (j <= at.st.count) emit({ type: 'hit', ball: j, x: Math.cos(a), y: Math.sin(a), angle: a, pitch: idx / n, balls: n });
        if (j === at.st.count) sc.flash = S.t;
      } else if (P.mode === 'multiply') {
        const z = this.zAt(P, j), a = Math.atan2(z[1], z[0]);
        emit({ type: 'hit', ball: j, x: z[0], y: z[1], angle: a, pitch: frac(a / TAU), balls: j });
        if (Math.abs(((j * P.angle) % 360)) < 1e-6 && j > 0) sc.flash = S.t;
      }
    }
  },
  theta(S, P) { return clamp(S.st / Math.max(1, P.sweep), 0, 1) * P.to * Math.PI; },
  /** z after j multiplications, from 1 at the start angle. */
  zAt(P, j) {
    const a = ((P.start + j * P.angle) * Math.PI) / 180, r = 0.92 * P.rho ** j;
    return [Math.cos(a) * r, Math.sin(a) * r];
  },
  draw(S, P, D) {
    const { g, pal, k, time } = D, sc = S.sc;
    // the unit circle and the axes
    g.strokeStyle = pal.ring; g.globalAlpha = 0.55; g.lineWidth = 3 * k; g.shadowColor = pal.glow; g.shadowBlur = 14 * k;
    g.beginPath(); g.arc(D.X(0), D.Y(0), D.R, 0, TAU); g.stroke(); g.shadowBlur = 0; g.globalAlpha = 1;
    if (P.axes) {
      g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1.5 * k;
      g.beginPath(); g.moveTo(D.X(-1.08), D.Y(0)); g.lineTo(D.X(1.08), D.Y(0)); g.moveTo(D.X(0), D.Y(-1.08)); g.lineTo(D.X(0), D.Y(1.08)); g.stroke();
      if (P.labels) { label(D, 'Re', D.X(1.0), D.Y(-0.07), { size: 17, alpha: 0.6 }); label(D, 'Im', D.X(0.08), D.Y(1.02), { size: 17, alpha: 0.6 }); }
    }
    if (P.mode === 'euler') return drawEuler(S, P, D, this.theta(S, P));
    const at = this.locate(S, P), { st } = at, n = st.n;
    const pt = (j, r = 1) => { const a = Math.PI / 2 - (j * TAU) / n; return [D.X(Math.cos(a) * r), D.Y(Math.sin(a) * r)]; };
    const prim = (j) => gcd(j, n) === 1;
    const done = at.step >= st.count;
    const flash = pulse(time, sc.flash);
    let readout = '', sub = '';

    if (P.mode === 'roots') {
      const placed = Math.min(n, at.step + 1);
      // polygon through the roots placed so far
      g.strokeStyle = pal.line(0.1); g.lineWidth = 3 * k; g.globalAlpha = 0.85; g.beginPath();
      for (let j = 0; j < placed; j++) { const [x, y] = pt(j); g[j ? 'lineTo' : 'moveTo'](x, y); }
      if (placed >= n) g.closePath();
      g.stroke(); g.globalAlpha = 1;
      for (let j = 0; j < n; j++) {
        const [x, y] = pt(j), on = j < placed, hot = j === placed - 1 ? pulse(time, sc.since) : 0;
        const col = P.primitive && prim(j) ? '#ffd23d' : pal.line(j / n);
        dot(g, x, y, (on ? 9 + 8 * hot : 4) * k, on ? col : 'rgba(255,255,255,0.25)', k, on ? 18 : 0);
        if (P.labels && on) { const [lx, ly] = pt(j, 0.84); label(D, String(j), lx, ly, { size: 20, color: col }); }
      }
      readout = `z^${n} = 1`;
      sub = P.primitive ? `${Array.from({ length: n }, (_, j) => j).filter(prim).length} primitive roots (gold)` : `ω = e^(2πi/${n})`;
    } else if (P.mode === 'power') {
      const m = st.m, steps = Math.min(at.step, st.count);
      for (let j = 0; j < n; j++) { const [x, y] = pt(j); dot(g, x, y, 4 * k, 'rgba(255,255,255,0.3)', k, 0); }
      g.strokeStyle = pal.line(m / n); g.lineWidth = 3.5 * k; g.lineJoin = 'round'; g.beginPath();
      for (let j = 0; j <= steps; j++) { const [x, y] = pt((j * m) % n); g[j ? 'lineTo' : 'moveTo'](x, y); }
      g.stroke();
      for (let j = 0; j <= Math.min(steps, st.count - 1); j++) {
        const [x, y] = pt((j * m) % n), hot = j === steps ? pulse(time, sc.since) : 0;
        dot(g, x, y, (8 + 8 * hot) * k, pal.line(j / st.count), k, 16);
        if (P.labels) { const [lx, ly] = pt((j * m) % n, 0.84); label(D, j === 0 ? '1' : j === 1 ? 'ω' : `ω^${j}`, lx, ly, { size: 19, color: pal.line(j / st.count) }); }
      }
      const order = st.count, gens = gcd(n, m) === 1;
      readout = `ω = e^(2πi·${m}/${n}),  order ${order}`;
      sub = done ? (gens ? 'visits every root: it generates them all' : `closes after ${order}: only ${order} of the ${n} roots`) : `{${n}/${m}} star polygon`;
    } else if (P.mode === 'multiply') {
      const w = `${P.rho === 1 ? '' : `${P.rho.toFixed(2)}·`}e^(i·${P.angle}°)`;
      const steps = Math.min(at.step, st.count);
      // trail of the points, then the arrow of the current one (turning smoothly towards the next)
      g.lineWidth = 2.5 * k; g.lineJoin = 'round';
      for (let j = 0; j <= steps; j++) {
        const z = this.zAt(P, j), col = pal.line(j / st.count);
        if (j) { const y0 = this.zAt(P, j - 1); g.strokeStyle = col; g.globalAlpha = 0.55; g.beginPath(); g.moveTo(D.X(y0[0]), D.Y(y0[1])); g.lineTo(D.X(z[0]), D.Y(z[1])); g.stroke(); g.globalAlpha = 1; }
        dot(g, D.X(z[0]), D.Y(z[1]), (j === steps ? 9 : 5) * k, col, k, j === steps ? 18 : 6);
      }
      const z = this.zAt(P, steps);
      arrow(D, 0, 0, z[0] * 0.94, z[1] * 0.94, '#ffffff', 3);
      readout = `z → z · ${w}`;
      sub = `|z| = ${(0.92 * P.rho ** steps).toFixed(2)}   arg z = ${(((P.start + steps * P.angle) % 360) + 360) % 360}°`;
    } else {
      // sum: the roots as spokes, and the same vectors laid head to tail until they close the polygon
      const Rp = 0.8, edge = 2 * Rp * Math.sin(Math.PI / n);
      for (let j = 0; j < n; j++) { const [x, y] = pt(j); g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1.5 * k; g.beginPath(); g.moveTo(D.X(0), D.Y(0)); g.lineTo(x, y); g.stroke(); }
      const V = (j) => { const a = Math.PI / 2 - (j * TAU) / n - Math.PI / n; return [Math.cos(a) * Rp, Math.sin(a) * Rp]; };
      const steps = Math.min(n, at.step + 1);
      for (let j = 0; j < steps; j++) {
        const a = V(j), b = V(j + 1);
        arrow(D, a[0], a[1], b[0] * 0.5 + a[0] * 0.5 + (b[0] - a[0]) * 0.5, b[1] * 0.5 + a[1] * 0.5 + (b[1] - a[1]) * 0.5, pal.line(j / n), 4);
      }
      const head = V(steps);
      dot(g, D.X(head[0]), D.Y(head[1]), 8 * k, '#ffffff', k, 16);
      if (steps >= n) { g.globalAlpha = 0.3 + 0.7 * flash; dot(g, D.X(V(0)[0]), D.Y(V(0)[1]), (10 + 14 * flash) * k, '#ffd23d', k, 28); g.globalAlpha = 1; }
      readout = steps >= n ? `1 + ω + … + ω^${n - 1} = 0` : `${steps} of ${n} vectors`;
      sub = steps >= n ? 'head to tail: back where we started' : `each vector has length ${edge.toFixed(2)} and turns ${(360 / n).toFixed(n % 5 ? 1 : 0)}°`;
    }
    if (P.labels) {
      label(D, readout, D.X(0), D.Y(-1.1), { size: 25, color: flash > 0.05 ? '#ffd23d' : '#ffffff' });
      label(D, sub, D.X(0), D.Y(1.2), { size: 19, alpha: 0.85, weight: 600 });
    }
  },
  stats: (S, P) => {
    const at = roots.locate(S, P);
    return P.mode === 'euler' ? `θ = ${(roots.theta(S, P) / Math.PI).toFixed(2)}π` : P.mode === 'multiply' ? `step ${Math.min(at.step, at.st.count)}` : `n = ${at.st.n}`;
  },
  formula: (P) => ({ roots: `z^${P.n} = 1`, power: `ω^k, ω = e^(2πi·${P.m}/${P.n})`, multiply: 'z → z · ρ·e^(iφ)', sum: '1 + ω + ω² + … = 0', euler: 'e^(iθ) = cos θ + i sin θ' }[P.mode] || ''),
};

function drawEuler(S, P, D, th) {
  const { g, pal, k } = D;
  const c = Math.cos(th), s = Math.sin(th), x = D.X(c), y = D.Y(s);
  // the arc already turned, the radius, and the two projections
  g.strokeStyle = pal.line(0.2); g.lineWidth = 5 * k; g.lineCap = 'round'; g.shadowColor = pal.glow; g.shadowBlur = 14 * k;
  g.beginPath(); g.arc(D.X(0), D.Y(0), D.R, 0, -th, true); g.stroke(); g.shadowBlur = 0;
  g.strokeStyle = '#ffffff'; g.lineWidth = 3 * k; g.beginPath(); g.moveTo(D.X(0), D.Y(0)); g.lineTo(x, y); g.stroke();
  g.setLineDash([7 * k, 7 * k]); g.lineWidth = 2.5 * k;
  g.strokeStyle = '#ffb347'; g.beginPath(); g.moveTo(x, y); g.lineTo(x, D.Y(0)); g.stroke();
  g.strokeStyle = '#5ee0ff'; g.beginPath(); g.moveTo(x, y); g.lineTo(D.X(0), y); g.stroke();
  g.setLineDash([]);
  dot(g, x, D.Y(0), 7 * k, '#ffb347', k, 12);
  dot(g, D.X(0), y, 7 * k, '#5ee0ff', k, 12);
  const arrived = th >= P.to * Math.PI - 1e-6;
  dot(g, x, y, (12 + (arrived ? 8 : 0)) * k, arrived && Math.abs(P.to - 1) < 1e-6 ? '#ff4d6d' : '#ffffff', k, 26);
  for (const [t, px, py] of [['1', 1.06, -0.07], ['i', 0.07, 1.06], ['−1', -1.07, -0.07], ['−i', 0.09, -1.06]]) label(D, t, D.X(px), D.Y(py), { size: 22, alpha: 0.7, weight: 600 });
  if (P.labels) {
    label(D, `e^(iθ) = cos θ + i sin θ`, D.X(0), D.Y(1.2), { size: 21, alpha: 0.9, weight: 600 });
    const deg = (th * 180) / Math.PI;
    label(D, arrived && Math.abs(P.to - 1) < 1e-6 ? 'e^(iπ) + 1 = 0' : `θ = ${deg.toFixed(0)}°   cos = ${c.toFixed(2)}   sin = ${s.toFixed(2)}`, D.X(0), D.Y(-1.2), { size: 25, color: arrived && Math.abs(P.to - 1) < 1e-6 ? '#ff4d6d' : '#ffffff' });
    label(D, `cos θ`, D.X(c / 2), D.Y(-0.08), { size: 17, color: '#ffb347' });
    label(D, `sin θ`, D.X(0.17), D.Y(s / 2), { size: 17, color: '#5ee0ff' });
  }
}

export const THEORY = { fifths, roots };
