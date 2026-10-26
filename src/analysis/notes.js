/**
 * From a pitch track to written notes: which frames are a voiced note, where one note
 * ends and the next begins (a pitch change, a new attack at the same pitch, or a gap), and
 * what each note's pitch, length and loudness are.
 */
import { median, percentile } from './dsp.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Median of x[i-r .. i+r] over the voiced frames only. */
function localMedian(x, voiced, i, r) {
  const v = [];
  for (let k = Math.max(0, i - r); k <= Math.min(x.length - 1, i + r); k++) if (voiced[k]) v.push(x[k]);
  return median(v);
}

/**
 * @param {{hop:number, times:Float32Array, midi:Float32Array, conf:Float32Array, rms:Float32Array}} track
 * @param {{sensitivity?:number, minNote?:number, floorDb?:number, octave?:number}} [o]
 *   sensitivity 0..1 (higher = accepts shakier pitch), minNote seconds, floorDb silence floor below the loudest part
 * @returns {{start:number,end:number,midi:number,cents:number,vel:number,decay:number}[]} midi = float (cents kept)
 */
export function segmentNotes(track, o = {}) {
  const { sensitivity = 0.5, minNote = 0.07, floorDb = 42, octave = 0 } = o;
  const { hop, times, midi, conf, rms } = track;
  const n = midi.length;
  if (!n) return [];
  const loud = percentile(rms, 0.98) || 1e-6;
  const floor = loud * 10 ** (-floorDb / 20);
  const confMin = 0.82 - 0.4 * sensitivity;

  const voiced = new Uint8Array(n);
  for (let i = 0; i < n; i++) voiced[i] = Number.isFinite(midi[i]) && conf[i] >= confMin && rms[i] >= floor ? 1 : 0;

  // smooth, and undo octave jumps (a harmonic or sub-harmonic picked for a few frames)
  const sm = new Float32Array(n);
  for (let i = 0; i < n; i++) sm[i] = voiced[i] ? localMedian(midi, voiced, i, 2) : NaN;
  for (let i = 0; i < n; i++) {
    if (!voiced[i]) continue;
    const ref = localMedian(sm, voiced, i, 6);
    const off = sm[i] - ref;
    if (Math.abs(off) > 10.5) {
      const k = Math.round(off / 12);
      if (k && Math.abs(off - 12 * k) < 1.2) sm[i] -= 12 * k;
    }
  }

  const GAP = 3; // frames of silence bridged inside one note
  const runs = [];
  let cur = null;
  const close = () => { if (cur) { runs.push(cur); cur = null; } };
  for (let i = 0; i < n; i++) {
    if (!voiced[i]) { if (cur && i - cur.last > GAP) close(); continue; }
    if (cur) {
      let split = Math.abs(sm[i] - cur.center) > 0.75;
      if (!split && i - cur.first >= 4) {
        // a new attack at the same pitch: the loudness climbs steeply from a recent low
        // (it must have died away first: a swell or a filter sweep inside one note is not a new note)
        let low = Infinity, before = 0;
        for (let k = Math.max(cur.first, i - 6); k < i; k++) low = Math.min(low, rms[k]);
        for (let k = Math.max(cur.first, i - 14); k < i - 2; k++) before = Math.max(before, rms[k]);
        if (rms[i] > 1.5 * low && rms[i] > 1.06 * rms[i - 1] && rms[i] >= 0.5 * cur.peak && low < 0.88 * before) split = true;
      }
      if (i - cur.last > 1 && !split && Math.abs(sm[i] - cur.center) > 0.4) split = true;
      if (split) close();
    }
    if (!cur) cur = { first: i, last: i, center: sm[i], frames: [], peak: rms[i] };
    cur.last = i;
    cur.frames.push(i);
    cur.center += (sm[i] - cur.center) * 0.12;
    cur.peak = Math.max(cur.peak, rms[i]);
  }
  close();

  const notes = [];
  for (const r of runs) {
    const dur = (r.last - r.first + 1) * hop;
    if (dur < minNote || r.frames.length < 3) continue;
    const mid = r.frames.slice(Math.floor(r.frames.length * 0.15), Math.max(Math.floor(r.frames.length * 0.15) + 1, Math.ceil(r.frames.length * 0.85)));
    const m = median(mid.map((i) => sm[i])) + octave * 12;
    // how quickly it dies away: loudness a little before the end relative to its peak
    const tailIdx = r.frames[Math.max(0, Math.floor(r.frames.length * 0.75) - 1)];
    notes.push({
      start: Math.max(0, times[r.first] - hop / 2),
      end: times[r.last] + hop / 2,
      midi: m,
      cents: (m - Math.round(m)) * 100,
      vel: clamp(Math.pow(r.peak / loud, 0.7), 0.15, 1),
      decay: dur > 0.18 ? clamp(rms[tailIdx] / r.peak, 0, 1) : 1,
    });
  }
  return notes;
}
