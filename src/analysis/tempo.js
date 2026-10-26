/**
 * Tempo and beat grid from the notes' attacks and the loudness curve, and snapping the notes
 * onto that grid.
 */
import { percentile } from './dsp.js';

const BPM_MIN = 50, BPM_MAX = 200, PRIOR = 105;

/**
 * @param {{start:number,vel:number}[]} notes
 * @param {{hop:number, rms:Float32Array}} track
 * @returns {{bpm:number, offset:number, confidence:number, alternatives:number[]}}
 *   offset = time of a beat (seconds, 0..one beat)
 */
export function estimateTempo(notes, track) {
  const fps = 1 / track.hop, n = track.rms.length;
  if (notes.length < 4 || n < fps * 2) return { bpm: 120, offset: 0, confidence: 0, alternatives: [60, 120, 240] };

  // onset strength: rising loudness + a pulse for every note start
  const env = new Float32Array(n);
  let prev = -90;
  for (let i = 0; i < n; i++) {
    const db = 20 * Math.log10(track.rms[i] + 1e-6);
    env[i] = Math.max(0, db - prev);
    prev = db;
  }
  const scale = percentile(env, 0.95) || 1;
  for (let i = 0; i < n; i++) env[i] = Math.min(2, env[i] / scale) * 0.5;
  for (const nt of notes) {
    const i = Math.round(nt.start * fps);
    for (let k = -1; k <= 1; k++) if (env[i + k] !== undefined) env[i + k] += (k ? 0.5 : 1) * nt.vel;
  }

  const lagMax = Math.ceil((60 / BPM_MIN) * 4 * fps);
  const ac = new Float32Array(lagMax + 2);
  for (let lag = 1; lag <= lagMax; lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += env[i] * env[i + lag];
    ac[lag] = s / (n - lag);
  }
  const at = (lag) => {
    if (lag >= lagMax) return 0;
    const k = Math.floor(lag), f = lag - k;
    return ac[k] * (1 - f) + ac[k + 1] * f;
  };

  const scores = [];
  for (let bpm = BPM_MIN; bpm <= BPM_MAX; bpm += 0.5) {
    const lag = (60 / bpm) * fps;
    const comb = at(lag) + 0.5 * at(lag * 2) + 0.25 * at(lag * 4) + 0.35 * at(lag / 2);
    const prior = Math.exp(-0.5 * (Math.log2(bpm / PRIOR) / 0.75) ** 2);
    scores.push({ bpm, score: comb * (0.35 + 0.65 * prior) });
  }
  scores.sort((a, b) => b.score - a.score);
  const rough = scores[0].bpm;

  // refine on the note starts: the tempo and phase that put them on an eighth-note grid
  let best = { bpm: rough, phase: 0, fit: -Infinity };
  const starts = notes.map((nt) => ({ t: nt.start, w: 0.4 + nt.vel }));
  for (let bpm = rough * 0.96; bpm <= rough * 1.04; bpm += rough * 0.0005) {
    const P = 60 / bpm / 2;
    for (let ph = 0; ph < 24; ph++) {
      const phase = (ph / 24) * P;
      let fit = 0;
      for (const s of starts) fit += s.w * Math.cos((2 * Math.PI * (s.t - phase)) / P);
      if (fit > best.fit) best = { bpm, phase, fit };
    }
  }
  const total = starts.reduce((a, s) => a + s.w, 0);
  const beat = 60 / best.bpm;
  const bpm = Math.round(best.bpm * 10) / 10;
  const alt = [bpm / 2, bpm * 2].filter((v) => v >= 30 && v <= 300).map((v) => Math.round(v * 10) / 10);
  return { bpm, offset: ((best.phase % beat) + beat) % beat, confidence: Math.max(0, Math.min(1, best.fit / total)), alternatives: alt };
}

/** Choose the finest-looking grid that the notes really sit on: steps per beat 2 (1/8), 3, 4 (1/16) or 6. */
export function autoDivision(notes, bpm, offset) {
  if (notes.length < 4) return 2;
  const beat = 60 / bpm;
  let pick = 4, bestErr = Infinity;
  for (const div of [2, 3, 4, 6]) {
    const g = beat / div;
    let err = 0;
    for (const nt of notes) { const k = (nt.start - offset) / g; err += Math.abs(k - Math.round(k)); }
    err = err / notes.length + div * 0.012; // a finer grid always fits better; make it earn its place
    if (err < bestErr) { bestErr = err; pick = div; }
  }
  return bestErr > 0.3 ? 0 : pick; // notes that sit on no grid are kept as played
}

/**
 * Snap note starts and lengths to a grid of `division` steps per beat (0 = leave free).
 * Notes keep their order; a note never runs into the next one.
 */
export function quantizeNotes(notes, { bpm, offset = 0, division = 0 }) {
  if (!division) return notes.map((nt) => ({ ...nt }));
  const g = 60 / bpm / division;
  const out = [];
  for (const nt of notes) {
    const start = offset + Math.round((nt.start - offset) / g) * g;
    const len = Math.max(g, Math.round((nt.end - nt.start) / g) * g);
    const last = out[out.length - 1];
    if (last && start <= last.start + 1e-6) { // two notes fell on the same step: keep the louder
      if (nt.vel > last.vel) out[out.length - 1] = { ...nt, start: last.start, end: last.start + len };
      continue;
    }
    out.push({ ...nt, start: Math.max(0, start), end: Math.max(0, start) + len });
  }
  for (let i = 0; i < out.length - 1; i++) out[i].end = Math.min(out[i].end, out[i + 1].start);
  return out.filter((nt) => nt.end - nt.start > 0.02);
}
