/**
 * Films: an opening, a climax and a finale for any 2D / 3D preset, written as keyframes, so a
 * plain drawing becomes a little film in one click (and every key can still be edited on the
 * timeline). A film can also loop: every animated value comes back to where it started, so the
 * last frame flows into the first.
 *
 *   opening   follow (close-up on the pen, then pull back), dive, spiral, push, handheld, orbit (3D),
 *             blackout (rises out of black), flash (white flash in), slowmo (slow start), bars (bars open)
 *   climax    speed (a rush), surge (glow and lines flare), shake, zoomhit, switch (the drawing style changes)
 *   finale    slow (slows into the final shot), bars (cinema bars close in), both
 */
export const OPENINGS = {
  none: 'None', follow: 'Close-up on the pen, then pull back', dive: 'Wide, dive into a close-up, back out', spiral: 'Unwinding spiral close-up',
  push: 'Wide shot pushing in', handheld: 'Handheld close-up that settles', orbit: 'Fast orbit that slows (3D)', blackout: 'Rise out of black',
  flash: 'White flash in', slowmo: 'Slow motion start', bars: 'Cinema bars open',
};
export const CLIMAXES = { none: 'None', speed: 'Rush: speed up', surge: 'Glow surge', shake: 'Shake', zoomhit: 'Zoom hit', switch: 'Switch drawing style' };
export const FINALES = { none: 'Only the final shot', slow: 'Slow down into the final shot', bars: 'Cinema bars close in', both: 'Slow down and bars' };

const round = (v) => (typeof v === 'number' ? +v.toFixed(3) : v);

/**
 * Keyframe tracks of a film.
 * @param {object} o
 * @param {number} o.D duration (s)
 * @param {string} [o.open] @param {string} [o.climax] @param {string} [o.finale]
 * @param {boolean} [o.loop] every track returns to its first value at the end
 * @param {boolean} [o.is3d] @param {number} [o.endingSecs] length of the final shot
 * @param {number} [o.climaxAt] 0..1 @param {number} [o.bloom] glow strength of the look @param {number} [o.intensity]
 * @param {string} [o.styleTo] drawing style after the climax (switch) @param {string} [o.styleFrom]
 * @returns {Record<string, {time:number, value:any, ease:string}[]>}
 */
export function filmTracks(o) {
  const D = o.D, E = D - (o.loop ? 0 : (o.endingSecs ?? 1.8)), z3 = o.is3d ? 0.7 : 1;
  const zz = (v) => round(1 + (v - 1) * z3);
  const T = {};
  const add = (path, list) => { (T[path] ||= []).push(...list.map(([time, value, ease = 'smooth']) => ({ time: round(Math.max(0, Math.min(D, time))), value: round(value), ease }))); };
  const back = Math.min(0.9 * D, E - 0.3); // the camera is back on the whole picture by here
  switch (o.open) {
    case 'follow': add('camera.zoom', [[0, zz(3.8)], [0.3 * D, zz(3)], [0.55 * D, 1]]); add('camera.track', [[0, 1], [0.3 * D, 1], [0.55 * D, 0]]); add('camera.roll', [[0, 9], [0.3 * D, 5], [0.55 * D, 0]]); break;
    case 'dive': add('camera.zoom', [[0, 1], [0.25 * D, 1], [0.45 * D, zz(3.3)], [0.62 * D, zz(3)], [back, 1]]); add('camera.track', [[0, 0], [0.25 * D, 0], [0.45 * D, 1], [0.62 * D, 1], [back, 0]]); add('camera.roll', [[0, 0], [0.45 * D, -7], [back, 0]]); break;
    case 'spiral': add('camera.zoom', [[0, zz(4.2)], [0.45 * D, zz(1.7)], [0.62 * D, 1]]); add('camera.track', [[0, 1], [0.45 * D, 0.7], [0.62 * D, 0]]); add('camera.roll', [[0, 42], [0.62 * D, 0]]); break;
    case 'push': add('camera.zoom', [[0, 0.85], [0.4 * D, zz(2.5)], [0.6 * D, zz(2.5)], [back, 1]]); add('camera.track', [[0, 0], [0.4 * D, 1], [0.6 * D, 1], [back, 0]]); add('camera.roll', [[0, -4], [0.4 * D, 6], [back, 0]]); break;
    case 'handheld': add('camera.zoom', [[0, zz(3.2)], [0.35 * D, zz(2.4)], [0.58 * D, 1]]); add('camera.track', [[0, 1], [0.35 * D, 1], [0.58 * D, 0]]); add('camera.shake', [[0, 0.85], [0.58 * D, 0.1]]); add('camera.drift', [[0, 0], [0.58 * D, 0.5]]); break;
    case 'orbit': add('camera.zoom', [[0, 2.4], [0.3 * D, 2], [0.55 * D, 1]]); add('camera.track', [[0, 1], [0.3 * D, 1], [0.55 * D, 0]]); add('camera.rotateSpeed', [[0, 5], [0.55 * D, 0.9]]); break;
    case 'blackout': add('visual.exposure', [[0, 0], [2.4, 1, 'in']]); add('camera.zoom', [[0, 1.35], [0.4 * D, 1]]); break;
    case 'flash': add('visual.exposure', [[0, 3.2], [0.9, 1, 'out']]); add('camera.zoom', [[0, 1.25], [1.6, 1, 'out']]); break;
    case 'slowmo': add('transport.speed', [[0, 0.35], [0.25 * D, 1]]); add('camera.zoom', [[0, zz(2.6)], [0.3 * D, 1]]); add('camera.track', [[0, 1], [0.3 * D, 0]]); break;
    case 'bars': add('visual.letterbox', [[0, 1], [3, 0]]); add('camera.zoom', [[0, 1.2], [0.35 * D, 1]]); break;
    default: break;
  }
  const c = (o.climaxAt ?? 0.68) * D, bloom = o.bloom ?? 1, I = o.intensity ?? 1;
  switch (o.climax) {
    case 'speed': add('transport.speed', [[c - 2, 1], [c, 1.9], [c + 2.5, 1]]); break;
    case 'surge': add('visual.bloom.strength', [[c - 1.5, bloom], [c, bloom * 2.1], [c + 2.2, bloom]]); add('visual.fx.intensity', [[c - 1.5, I], [c, Math.min(2, I * 1.6)], [c + 2.2, I]]); break;
    case 'shake': add('camera.shake', [[c - 1, 0], [c, 0.9], [c + 1.6, 0]]); break;
    case 'zoomhit': add('camera.zoom', [[c - 0.6, 1], [c, 1.35, 'out'], [c + 1.4, 1]]); break;
    case 'switch': if (o.styleTo) add('visual.fx.style', [[0, o.styleFrom || 'off', 'hold'], [c, o.styleTo, 'hold']]); add('visual.bloom.strength', [[c - 0.4, bloom], [c, bloom * 1.8], [c + 1.2, bloom]]); break;
    default: break;
  }
  if (!o.loop) {
    if (o.finale === 'slow' || o.finale === 'both') add('transport.speed', [[E - 1, 1], [E, 0.55], [D, 0.45]]);
    if (o.finale === 'bars' || o.finale === 'both') add('visual.letterbox', [[E - 0.4, 0], [E + 1.2, 1], [D, 1]]);
  }
  // tidy: sorted, one key per time; looping films end where they began
  for (const [path, keys] of Object.entries(T)) {
    keys.sort((a, b) => a.time - b.time);
    const out = [];
    for (const k of keys) { if (out.length && Math.abs(out.at(-1).time - k.time) < 0.02) out[out.length - 1] = k; else out.push(k); }
    if (o.loop && out.at(-1).time < D) out.push({ time: D, value: out[0].value, ease: 'smooth' });
    T[path] = out;
  }
  return T;
}
