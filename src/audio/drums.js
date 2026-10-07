/**
 * Sample-free drum kit synthesized with Web Audio nodes.
 * Works on live and offline contexts, so WAV renders include the drums.
 */

export class DrumKit {
  /** @param {BaseAudioContext} ctx @param {AudioNode} out */
  constructor(ctx, out) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.connect(out);
    // One second of white noise, shared by snare, hat and clap.
    const n = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, n, n);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }

  setVolume(v, at = this.ctx.currentTime) {
    this.out.gain.setTargetAtTime(v, at, 0.02);
  }

  /** Play `kind` at audio time `t` with velocity 0..1. */
  trigger(kind, t = this.ctx.currentTime, vel = 1) {
    const fn = this[kind];
    if (typeof fn === 'function' && ['kick', 'snare', 'hat', 'clap'].includes(kind)) fn.call(this, Math.max(t, this.ctx.currentTime), vel);
  }

  env(t, peak, decay) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    return g;
  }

  noiseSource(t, dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur);
    return s;
  }

  kick(t, vel) {
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    const g = this.env(t, 1.1 * vel, 0.5);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.55);
    // Click for definition on small speakers.
    const c = this.noiseSource(t, 0.01);
    const cg = this.env(t, 0.25 * vel, 0.01);
    c.connect(cg).connect(this.out);
  }

  snare(t, vel) {
    const s = this.noiseSource(t, 0.25);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200;
    s.connect(hp).connect(this.env(t, 0.55 * vel, 0.2)).connect(this.out);
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    o.connect(this.env(t, 0.45 * vel, 0.12)).connect(this.out);
    o.start(t);
    o.stop(t + 0.15);
  }

  hat(t, vel) {
    const s = this.noiseSource(t, 0.08);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7500;
    s.connect(hp).connect(this.env(t, 0.32 * vel, 0.055)).connect(this.out);
  }

  clap(t, vel) {
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1500;
    bp.Q.value = 0.9;
    bp.connect(this.out);
    // Three quick bursts then a short tail: the classic hand-clap shape.
    for (const [off, peak, dec] of [[0, 0.5, 0.012], [0.011, 0.45, 0.012], [0.023, 0.5, 0.15]]) {
      this.noiseSource(t + off, dec + 0.02).connect(this.env(t + off, peak * vel, dec)).connect(bp);
    }
  }
}
