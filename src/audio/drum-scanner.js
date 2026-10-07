/**
 * Finds drum hits in a curve. It walks the source layer's pitch (y) in small
 * time steps and reports events such as peaks, valleys and zero crossings,
 * plus clock events (beats, off-beats, grid steps).
 * Pure and deterministic: the live synth, the WAV render and the MIDI export
 * all use it, so they hit on exactly the same moments.
 */
import { beatSeconds, stepSeconds } from '../math/rhythm.js';

export const DRUM_KINDS = ['kick', 'snare', 'hat', 'clap'];
export const DRUM_LABELS = { kick: 'Kick', snare: 'Snare', hat: 'Hi-hat', clap: 'Clap' };
export const TRIGGERS = {
  off: 'Off',
  peak: 'Curve peaks',
  valley: 'Curve valleys',
  zero: 'Crossing the middle',
  rise: 'Rising through middle',
  fall: 'Falling through middle',
  beat: 'Every beat',
  offbeat: 'Off-beats',
  step: 'Every grid step',
  bar: 'Every bar',
};

const SAMPLE = 1 / 400; // seconds between curve samples
const COOLDOWN = 0.06; // minimum gap between two hits of the same drum

export class DrumScanner {
  constructor() { this.reset(); }

  /** Forget history (call after seeking or looping). */
  reset() {
    this.lastT = null;
    this.lastY = null;
    this.slope = 0;
    this.extreme = null; // y of the last turning point
    this.lastHit = {};
  }

  /**
   * Scan (t0, t1] and return hits.
   * @param {number} t0 @param {number} t1 seconds
   * @param {(t:number)=>number} sampleY source pitch at time t
   * @param {object} cfg drums settings (kick/snare/hat/clap triggers, sensitivity)
   * @param {{mid:number, range:number, bpm:number, rhythm:object}} ctx
   * @returns {{kind:string, time:number, vel:number}[]}
   */
  scan(t0, t1, sampleY, cfg, ctx) {
    const events = [];
    const wants = {};
    for (const k of DRUM_KINDS) if (cfg[k] && cfg[k] !== 'off') (wants[cfg[k]] ||= []).push(k);
    if (!Object.keys(wants).length || t1 < t0) { this.lastT = t1; return events; }

    const fresh = this.lastT === null;
    const fire = (trigger, time, vel = 1) => {
      for (const kind of wants[trigger] || []) {
        if (time - (this.lastHit[kind] ?? -1) < COOLDOWN) continue;
        this.lastHit[kind] = time;
        events.push({ kind, time, vel });
      }
    };

    // Clock triggers: boundaries in (t0, t1], plus t0 itself right after a reset.
    const beat = beatSeconds(ctx.bpm);
    const clocks = {
      beat: [beat, 0], offbeat: [beat, beat / 2],
      step: [stepSeconds(ctx.rhythm, ctx.bpm), 0], bar: [beat * 4, 0],
    };
    for (const [trigger, [period, offset]] of Object.entries(clocks)) {
      if (!wants[trigger]) continue;
      let n = Math.ceil((t0 - offset) / period - 1e-9);
      if (!fresh && Math.abs(n * period + offset - t0) < 1e-9) n++;
      for (let time = n * period + offset; time <= t1 + 1e-9; time = ++n * period + offset) {
        fire(trigger, time, trigger === 'offbeat' || trigger === 'step' ? 0.7 : 1);
      }
    }

    // Curve triggers
    const curve = wants.peak || wants.valley || wants.zero || wants.rise || wants.fall;
    if (curve) {
      const minSwing = (cfg.sensitivity ?? 0.08) * ctx.range;
      let t = fresh ? t0 : this.lastT;
      if (fresh) { this.lastY = sampleY(t0); this.extreme = this.lastY; }
      while (t < t1 - 1e-12) {
        t = Math.min(t + SAMPLE, t1);
        const y = sampleY(t);
        if (!Number.isFinite(y) || !Number.isFinite(this.lastY)) { this.lastY = y; continue; }
        const dy = y - this.lastY;
        const dir = dy > 1e-12 ? 1 : dy < -1e-12 ? -1 : 0;
        if (dir !== 0) {
          if (this.slope > 0 && dir < 0 && this.lastY - this.extreme >= minSwing) { fire('peak', t); this.extreme = this.lastY; }
          else if (this.slope < 0 && dir > 0 && this.extreme - this.lastY >= minSwing) { fire('valley', t); this.extreme = this.lastY; }
          else if (this.slope === 0) this.extreme = this.lastY;
          this.slope = dir;
        }
        const a = this.lastY - ctx.mid, b = y - ctx.mid;
        if (a < 0 && b >= 0) { fire('zero', t); fire('rise', t); }
        else if (a >= 0 && b < 0) { fire('zero', t); fire('fall', t); }
        this.lastY = y;
      }
    }
    this.lastT = t1;
    events.sort((a, b) => a.time - b.time);
    return events;
  }
}
