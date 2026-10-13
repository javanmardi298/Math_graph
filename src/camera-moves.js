/**
 * Cinematic camera moves, shared by the 2D/3D renderer and the Circle Lab. A pure function
 * of the camera settings and the time, so live play, exports and batches look the same.
 *
 *   zoom     a fixed zoom (×0.4 … ×4)
 *   push     a slow push-in (+) or pull-out (−) over the whole video
 *   breathe  a gentle zoom pulse on every beat of the project tempo
 *   drift    a slow floating sway (a lazy figure of eight)
 *   shake    handheld micro-shake (small offsets and a hint of roll)
 *   sway     a slow pendulum tilt, left and right
 *   spin     a steady roll, degrees per second
 *
 * Offsets are fractions of the frame (dx of its width, dy of its height); roll in degrees.
 */
const TAU = Math.PI * 2;

export const CAMERA_MOVE_DEFAULTS = { zoom: 1, push: 0, breathe: 0, drift: 0, shake: 0, sway: 0, spin: 0 };

/** Smooth noise from a few incommensurate sines (never repeats in a video's length). */
const noise = (t, seed) => (Math.sin(t * 2.3 + seed) + 0.6 * Math.sin(t * 5.1 + seed * 1.7) + 0.35 * Math.sin(t * 8.9 + seed * 2.9)) / 1.95;

/**
 * @param {object} c state.camera
 * @param {{time:number, progress:number, bpm:number}} at timeline seconds, 0..1 position, tempo
 * @returns {{zoom:number, dx:number, dy:number, roll:number, active:boolean}}
 */
export function cameraMove(c, { time = 0, progress = 0, bpm = 120 } = {}) {
  const zoomBase = c.zoom ?? 1, push = c.push || 0, breathe = c.breathe || 0, drift = c.drift || 0;
  const shake = c.shake || 0, sway = c.sway || 0, spin = c.spin || 0;
  const active = zoomBase !== 1 || push || breathe || drift || shake || sway || spin;
  if (!active) return { zoom: 1, dx: 0, dy: 0, roll: 0, active: false };
  const p = Math.min(1, Math.max(0, progress));
  const ease = p * p * (3 - 2 * p); // slow in, slow out
  // push > 0: from ×1 to ×(1 + 1.2 push); push < 0: starts zoomed in and pulls out to ×1
  let zoom = zoomBase * (push >= 0 ? 1 + 1.2 * push * ease : 1 + 1.2 * -push * (1 - ease));
  if (breathe) zoom *= 1 + 0.05 * breathe * (0.5 + 0.5 * Math.cos(TAU * time * (bpm / 60)));
  let dx = 0, dy = 0, roll = 0;
  if (drift) { dx += 0.035 * drift * Math.sin(TAU * time / 11); dy += 0.03 * drift * Math.sin(TAU * time / 7 + 1.1); }
  if (shake) { dx += 0.004 * shake * noise(time, 1); dy += 0.004 * shake * noise(time, 7); roll += 0.35 * shake * noise(time, 13); }
  if (sway) roll += 2.5 * sway * Math.sin(TAU * time / 7.5);
  if (spin) roll += spin * time;
  return { zoom, dx, dy, roll, active: true };
}
