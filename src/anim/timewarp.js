/**
 * Speed over time. With a speed keyframe track the timeline plays faster and slower
 * along the way, so timeline seconds and video seconds are no longer the same thing:
 *
 *   real(t)     video seconds after which timeline second t is reached  (∫ dt / speed)
 *   timeline(r) the timeline second shown at video second r             (inverse of real)
 *
 * With no speed track the speed is one number and both are plain divisions.
 */
import { evaluate } from './keyframes.js';

export const SPEED_MIN = 0.1, SPEED_MAX = 5;
export const clampSpeed = (v) => Math.min(SPEED_MAX, Math.max(SPEED_MIN, Number.isFinite(v) ? v : 1));

/**
 * @param {number} duration timeline seconds
 * @param {number} speed the Speed slider (used when there is no track)
 * @param {{time:number,value:number,ease?:string}[]} [keys] the speed keyframes
 */
export function makeWarp(duration, speed = 1, keys = null) {
  const animated = !!keys?.length;
  const at = (t) => clampSpeed(animated ? evaluate(keys, t) : speed);
  if (!animated) {
    const sp = clampSpeed(speed);
    return { animated: false, speedAt: () => sp, total: duration / sp, real: (t) => t / sp, timeline: (r) => r * sp };
  }
  const N = Math.max(240, Math.min(20000, Math.ceil(duration * 120)));
  const dt = duration / N;
  const real = new Float64Array(N + 1);
  for (let i = 0; i < N; i++) real[i + 1] = real[i] + dt / ((at(i * dt) + at((i + 1) * dt)) / 2);
  const total = real[N];
  const toReal = (t) => {
    if (t <= 0) return 0;
    if (t >= duration) return total;
    const f = t / dt, i = Math.floor(f);
    return real[i] + (real[i + 1] - real[i]) * (f - i);
  };
  const toTimeline = (r) => {
    if (r <= 0) return 0;
    if (r >= total) return duration;
    let lo = 0, hi = N;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (real[mid] <= r) lo = mid; else hi = mid; }
    const span = real[hi] - real[lo] || 1;
    return (lo + (r - real[lo]) / span) * dt;
  };
  return { animated: true, speedAt: at, total, real: toReal, timeline: toTimeline };
}
