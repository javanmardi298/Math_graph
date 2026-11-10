/**
 * Sample-free drum kit synthesized with Web Audio nodes.
 * Works on live and offline contexts, so WAV renders include the drums.
 *
 * Seven pieces (kick, snare, hat, clap, openhat, tom, perc) in five kits. A kit is a small
 * table of numbers per piece, so adding a kit is adding a row to KITS.
 */

/** Kits: how each piece is tuned. kick: [start Hz, end Hz, sweep s, decay s, level, click]. */
export const KITS = {
  classic: { label: 'Classic (house)', kick: [160, 42, 0.13, 0.5, 1.1, 0.25], snare: [1200, 220, 0.2, 0.55], hat: [7500, 0.055, 0.32], open: 0.32, tom: [180, 90, 0.3], perc: [540, 800, 0.12], tone: 0 },
  808: { label: '808 (trap, hip-hop)', kick: [130, 36, 0.09, 1.0, 1.25, 0.12], snare: [1800, 190, 0.16, 0.5], hat: [9000, 0.035, 0.28], open: 0.45, tom: [150, 70, 0.45], perc: [540, 800, 0.2], tone: 0 },
  acoustic: { label: 'Acoustic', kick: [120, 55, 0.07, 0.28, 1.0, 0.4], snare: [900, 200, 0.24, 0.6], hat: [6000, 0.09, 0.26], open: 0.4, tom: [200, 110, 0.35], perc: [1700, 2300, 0.05], tone: 0 },
  techno: { label: 'Techno (hard)', kick: [210, 46, 0.1, 0.36, 1.25, 0.5], snare: [2200, 240, 0.13, 0.5], hat: [9500, 0.03, 0.3], open: 0.22, tom: [160, 80, 0.25], perc: [660, 990, 0.08], tone: 0 },
  lofi: { label: 'Lo-fi (soft, dusty)', kick: [140, 48, 0.12, 0.42, 0.95, 0.08], snare: [800, 180, 0.22, 0.45], hat: [5200, 0.06, 0.2], open: 0.28, tom: [170, 95, 0.3], perc: [480, 720, 0.14], tone: 3200 },
};

export const DRUM_PIECES = ['kick', 'snare', 'hat', 'clap', 'openhat', 'tom', 'perc'];

export class DrumKit {
  /** @param {BaseAudioContext} ctx @param {AudioNode} out */
  constructor(ctx, out) {
    this.ctx = ctx;
    this.kit = 'classic';
    this.out = ctx.createGain();
    this.out.connect(out);
    // lo-fi kits pass through a low-pass (built on first use)
    this.dull = null;
    // One second of white noise, shared by snare, hats and clap.
    const n = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, n, n);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }

  setVolume(v, at = this.ctx.currentTime) {
    this.out.gain.setTargetAtTime(v, at, 0.02);
  }

  get K() { return KITS[this.kit] || KITS.classic; }

  /** Where the pieces of the current kit go (through a low-pass for dull kits). */
  get dest() {
    const tone = this.K.tone;
    if (!tone) return this.out;
    if (!this.dull) { this.dull = this.ctx.createBiquadFilter(); this.dull.type = 'lowpass'; this.dull.connect(this.out); }
    this.dull.frequency.value = tone;
    return this.dull;
  }

  /** Play `kind` at audio time `t` with velocity 0..1. */
  trigger(kind, t = this.ctx.currentTime, vel = 1) {
    const fn = this[kind];
    if (typeof fn === 'function' && DRUM_PIECES.includes(kind)) fn.call(this, Math.max(t, this.ctx.currentTime), vel);
  }

  env(t, peak, decay) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.002);
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

  tone(t, type, f0, f1, sweep, peak, decay) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + sweep);
    o.connect(this.env(t, peak, decay)).connect(this.dest);
    o.start(t);
    o.stop(t + decay + 0.05);
  }

  kick(t, vel) {
    const [f0, f1, sweep, decay, level, click] = this.K.kick;
    this.tone(t, 'sine', f0, f1, sweep, level * vel, decay);
    // Click for definition on small speakers.
    this.noiseSource(t, 0.01).connect(this.env(t, click * vel, 0.01)).connect(this.dest);
  }

  snare(t, vel) {
    const [hpHz, body, decay, level] = this.K.snare;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = hpHz;
    this.noiseSource(t, decay + 0.05).connect(hp).connect(this.env(t, level * vel, decay)).connect(this.dest);
    this.tone(t, 'triangle', body, body * 0.73, 0.08, 0.45 * vel, 0.12);
  }

  hat(t, vel, long = 0) {
    const [hpHz, decay, level] = this.K.hat;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = hpHz;
    const d = long || decay;
    this.noiseSource(t, d + 0.03).connect(hp).connect(this.env(t, level * vel, d)).connect(this.dest);
  }

  openhat(t, vel) { this.hat(t, vel * 0.9, this.K.open); }

  clap(t, vel) {
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1500;
    bp.Q.value = 0.9;
    bp.connect(this.dest);
    // Three quick bursts then a short tail: the classic hand-clap shape.
    for (const [off, peak, dec] of [[0, 0.5, 0.012], [0.011, 0.45, 0.012], [0.023, 0.5, 0.15]]) {
      this.noiseSource(t + off, dec + 0.02).connect(this.env(t + off, peak * vel, dec)).connect(bp);
    }
  }

  tom(t, vel) {
    const [f0, f1, decay] = this.K.tom;
    this.tone(t, 'sine', f0, f1, decay * 0.5, 0.8 * vel, decay);
  }

  /** Cowbell / rim / woodblock, depending on the kit: two detuned squares through a band-pass. */
  perc(t, vel) {
    const [fa, fb, decay] = this.K.perc;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = (fa + fb) / 2;
    bp.Q.value = 1.2;
    bp.connect(this.dest);
    for (const f of [fa, fb]) {
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      o.connect(this.env(t, 0.28 * vel, decay)).connect(bp);
      o.start(t);
      o.stop(t + decay + 0.05);
    }
  }
}
