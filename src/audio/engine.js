/**
 * Real-time synth built directly on the Web Audio API (no samples, no libraries).
 *
 *   voice per layer:  Oscillator → Amp → StereoPanner ┐
 *                                                     ├→ Bus → Filter → Drive ┬→ Dry ─────────┐
 *                                                     │                       ├→ Delay(+fb) ──┤→ Compressor → Master → Analyser → speakers
 *                                                                             └→ Reverb ──────┘                     └→ MediaStream (video recording)
 *
 * Every frame the app calls update() with each layer's current pitch/volume/pan.
 * Parameters move with setTargetAtTime, which glides smoothly between frames,
 * so the sound has no zipper noise or clicks even at 60 updates per second.
 */
import { midiToFreq } from '../math/music.js';

// Rough loudness compensation so switching waveforms doesn't jump in volume.
const WAVE_GAIN = { sine: 1, triangle: 0.9, square: 0.42, sawtooth: 0.5 };

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.voices = new Map();
    this.settings = null;
    this.reverbDecay = null;
  }

  /** Create the audio graph. Must be called from a user gesture (browser autoplay rules). */
  async ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return this.ctx;
    }
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    this.build(ctx);
    if (ctx.state === 'suspended') await ctx.resume();
    return ctx;
  }

  /** Build the full effects graph on any BaseAudioContext (live or offline). */
  build(ctx) {
    this.ctx = ctx;

    this.bus = ctx.createGain();
    this.filter = ctx.createBiquadFilter();
    this.drive = ctx.createWaveShaper();
    this.drive.oversample = '4x';
    this.dry = ctx.createGain();
    this.delay = ctx.createDelay(2);
    this.delayFb = ctx.createGain();
    this.delayWet = ctx.createGain();
    this.reverb = ctx.createConvolver();
    this.reverbWet = ctx.createGain();
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.78;

    this.bus.connect(this.filter).connect(this.drive);
    this.drive.connect(this.dry).connect(this.comp);
    this.drive.connect(this.delay);
    this.delay.connect(this.delayFb).connect(this.delay);
    this.delay.connect(this.delayWet).connect(this.comp);
    this.drive.connect(this.reverb).connect(this.reverbWet).connect(this.comp);
    this.comp.connect(this.master);
    this.master.connect(this.analyser).connect(ctx.destination);
    if (ctx.createMediaStreamDestination) {
      this.streamDest = ctx.createMediaStreamDestination();
      this.master.connect(this.streamDest);
    }

    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeData = new Uint8Array(this.analyser.fftSize);
    if (this.settings) this.applySettings(this.settings);
  }

  get ready() {
    return !!this.ctx;
  }

  /** The audio track for MediaRecorder. */
  get stream() {
    return this.streamDest?.stream ?? null;
  }

  /** Current audio clock in seconds (falls back to performance clock before audio starts). */
  now() {
    return this.ctx ? this.ctx.currentTime : performance.now() / 1000;
  }

  /** Apply global audio settings (effects, master volume). Safe to call before ensure(). */
  applySettings(a) {
    this.settings = a;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const tc = 0.03;
    this.master.gain.setTargetAtTime(a.master, t, tc);
    this.filter.type = a.filter.type;
    this.filter.frequency.setTargetAtTime(a.filter.cutoff, t, tc);
    this.filter.Q.setTargetAtTime(a.filter.q, t, tc);
    this.drive.curve = a.distortion > 0.001 ? makeDriveCurve(a.distortion) : null;
    this.delay.delayTime.setTargetAtTime(a.delay.time, t, 0.05);
    this.delayFb.gain.setTargetAtTime(Math.min(a.delay.feedback, 0.92), t, tc);
    this.delayWet.gain.setTargetAtTime(a.delay.mix, t, tc);
    this.reverbWet.gain.setTargetAtTime(a.reverb.mix, t, tc);
    this.dry.gain.setTargetAtTime(1 - a.reverb.mix * 0.4, t, tc);
    if (this.reverbDecay !== a.reverb.decay) {
      this.reverbDecay = a.reverb.decay;
      this.reverb.buffer = makeImpulse(this.ctx, a.reverb.decay);
    }
  }

  /** Keep one voice per layer; create/remove voices to match the layer list. */
  syncLayers(layers) {
    if (!this.ctx) return;
    const ids = new Set(layers.map((l) => l.id));
    for (const [id, v] of this.voices) {
      if (!ids.has(id)) {
        v.amp.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
        v.osc.stop(this.ctx.currentTime + 0.2);
        this.voices.delete(id);
      }
    }
    for (const l of layers) {
      let v = this.voices.get(l.id);
      if (!v) {
        const osc = this.ctx.createOscillator();
        const amp = this.ctx.createGain();
        const pan = this.ctx.createStereoPanner();
        amp.gain.value = 0;
        osc.connect(amp).connect(pan).connect(this.bus);
        osc.start();
        v = { osc, amp, pan, lastNote: null, wave: null };
        this.voices.set(l.id, v);
      }
      if (v.wave !== l.wave) { v.osc.type = l.wave; v.wave = l.wave; }
    }
  }

  /**
   * Per-frame update.
   * @param {{id:string, midi:number|null, gain:number, pan:number, wave:string}[]} frames
   * @param {{playing:boolean, glide:number, articulation:string}} opts
   */
  update(frames, opts, at = null) {
    if (!this.ctx) return;
    const t = at ?? this.ctx.currentTime;
    const glide = Math.max(opts.glide, 4) / 1000 / 3; // time constant: ~95% reached after `glide` ms
    for (const f of frames) {
      const v = this.voices.get(f.id);
      if (!v) continue;
      const audible = opts.playing && f.midi != null && f.gain > 0;
      if (f.midi != null) v.osc.frequency.setTargetAtTime(midiToFreq(f.midi), t, glide);
      v.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, f.pan)), t, 0.03);
      const level = audible ? f.gain * (WAVE_GAIN[f.wave] ?? 0.6) : 0;

      if (opts.articulation === 'pluck' && audible) {
        // Retrigger a short percussive envelope every time the (rounded) note changes.
        const note = Math.round(f.midi);
        if (note !== v.lastNote) {
          const g = v.amp.gain;
          if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t);
          else { g.cancelScheduledValues(t); if (at == null) g.setValueAtTime(g.value, t); }
          v.amp.gain.linearRampToValueAtTime(level, t + 0.006);
          v.amp.gain.setTargetAtTime(level * 0.18, t + 0.01, 0.16);
          v.lastNote = note;
        }
      } else {
        v.amp.gain.setTargetAtTime(level, t, audible ? 0.012 : 0.04);
        v.lastNote = null;
      }
      if (!audible) v.lastNote = null;
    }
  }

  /**
   * Render the whole timeline to an AudioBuffer faster than real time.
   * @param {object} opts { settings, layers, duration, frameAt(time) → frames[], glide, articulation }
   */
  static async renderOffline({ settings, layers, duration, frameAt, glide, articulation, sampleRate = 48000 }) {
    const tail = settings.reverb.decay + 0.5;
    const ctx = new OfflineAudioContext(2, Math.ceil((duration + tail) * sampleRate), sampleRate);
    const eng = new AudioEngine();
    eng.settings = settings;
    eng.build(ctx);
    eng.syncLayers(layers);
    const step = 1 / 240;
    for (let time = 0; time < duration; time += step) eng.update(frameAt(time), { playing: true, glide, articulation }, time);
    for (const v of eng.voices.values()) v.amp.gain.setTargetAtTime(0, duration, 0.03);
    return ctx.startRendering();
  }

  /** Mute everything quickly (pause/stop). */
  silence() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const v of this.voices.values()) {
      v.amp.gain.cancelScheduledValues(t);
      v.amp.gain.setTargetAtTime(0, t, 0.03);
      v.lastNote = null;
    }
  }

  spectrum() {
    if (!this.analyser) return null;
    this.analyser.getByteFrequencyData(this.freqData);
    return this.freqData;
  }

  waveform() {
    if (!this.analyser) return null;
    this.analyser.getByteTimeDomainData(this.timeData);
    return this.timeData;
  }
}

/** Soft-clipping curve; amount 0..1. */
function makeDriveCurve(amount) {
  const k = amount * 120;
  const n = 2048;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

/** Synthetic stereo reverb tail: exponentially decaying noise. */
function makeImpulse(ctx, seconds) {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  return buf;
}
