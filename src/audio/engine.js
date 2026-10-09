/**
 * Real-time synth built directly on the Web Audio API (no samples, no libraries).
 *
 *   voice per layer:  Instrument (oscillators/FM/LFO → filter) → Amp → StereoPanner ┐
 *                                                     ├→ Bus → Filter → Drive ┬→ Dry ─────────┐
 *                                                     │                       ├→ Delay(+fb) ──┤→ Compressor → Master → Analyser → speakers
 *                                                                             └→ Reverb ──────┘                     └→ MediaStream (video recording)
 *   drums:            DrumKit ────────────────────────────────────────────────────┬──────────────→ Compressor
 *                                                                                 └→ Reverb (small send)
 *
 * Every frame the app calls update() with each layer's current pitch/volume/pan.
 * Parameters move with setTargetAtTime, which glides smoothly between frames,
 * so the sound has no zipper noise or clicks even at 60 updates per second.
 */
import { midiToFreq } from '../math/music.js';
import { DrumKit } from './drums.js';
import { Voice } from './instruments.js';

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
    // Drums skip the synth filter/drive so they stay punchy, with a little reverb.
    this.drumBus = ctx.createGain();
    this.drumSend = ctx.createGain();
    this.drumSend.gain.value = 0.25;
    this.drumBus.connect(this.comp);
    this.drumBus.connect(this.drumSend).connect(this.reverb);
    this.drums = new DrumKit(ctx, this.drumBus);
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

  /**
   * Apply global audio settings (effects, master volume). Safe to call before ensure().
   * @param {object} a audio settings
   * @param {number|null} at schedule at this audio time (offline rendering) instead of now
   */
  applySettings(a, at = null) {
    this.settings = a;
    if (!this.ctx) return;
    const t = at ?? this.ctx.currentTime;
    const tc = 0.03;
    this.master.gain.setTargetAtTime(a.master, t, tc);
    this.filter.type = a.filter.type;
    this.filter.frequency.setTargetAtTime(a.filter.cutoff, t, tc);
    this.filter.Q.setTargetAtTime(a.filter.q, t, tc);
    if (this.driveAmount !== a.distortion) {
      this.driveAmount = a.distortion;
      this.drive.curve = a.distortion > 0.001 ? makeDriveCurve(a.distortion) : null;
    }
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

  /** Drum volume (0..1). */
  setDrumVolume(v, at = null) {
    this.drums?.setVolume(v, at ?? this.ctx.currentTime);
  }

  /** Play a drum hit now (live) or at `at` (offline). */
  drum(kind, vel = 1, at = null) {
    this.drums?.trigger(kind, at ?? this.ctx.currentTime, vel);
  }

  /** Keep one voice per layer; create/remove voices to match the layer list and their sounds. */
  syncLayers(layers) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const ids = new Set(layers.map((l) => l.id));
    for (const [id, v] of this.voices) {
      if (!ids.has(id)) { v.stop(t); this.voices.delete(id); }
    }
    for (const l of layers) {
      const v = this.voices.get(l.id);
      if (v && v.id === l.wave) continue;
      if (v) v.stop(t); // the sound changed: build the new instrument
      const nv = new Voice(this.ctx, l.wave, this.bus);
      nv.lastNote = null;
      this.voices.set(l.id, nv);
    }
  }

  /**
   * Per-frame update.
   * @param {{id:string, midi:number|null, gain:number, pan:number, wave:string, step?:number}[]} frames
   *        `step` (beat-grid step index) retriggers plucked notes even when the pitch repeats
   * @param {{playing:boolean, glide:number, articulation:string}} opts
   */
  update(frames, opts, at = null) {
    if (!this.ctx) return;
    const t = at ?? this.ctx.currentTime;
    const live = at == null;
    const glide = Math.max(opts.glide, 4) / 1000 / 3; // time constant: ~95% reached after `glide` ms
    for (const f of frames) {
      const v = this.voices.get(f.id);
      if (!v) continue;
      const audible = opts.playing && f.midi != null && f.gain > 0;
      if (f.midi != null) v.setFreq(midiToFreq(f.midi), t, glide);
      v.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, f.pan)), t, 0.03);
      const level = audible ? f.gain * v.gainScale : 0;
      const mode = v.inst.mode || opts.articulation;
      if (mode === 'pluck' && audible) {
        // Retrigger the instrument's envelopes every time the (rounded) note or beat step changes.
        const note = f.step == null ? Math.round(f.midi) : `${Math.round(f.midi)}@${f.step}`;
        if (note !== v.lastNote) {
          v.trigger(level, t, live);
          v.lastNote = note;
        }
      } else {
        v.level(level, t, audible);
        v.lastNote = null;
      }
      if (!audible) v.lastNote = null;
    }
  }

  /**
   * Render the whole timeline to an AudioBuffer faster than real time.
   * @param {object} o
   * @param {object} o.settings audio settings at time 0
   * @param {object[]} o.layers enabled layers
   * @param {number} o.duration seconds
   * @param {(time:number)=>object[]} o.frameAt voice frames at a time (see update())
   * @param {(time:number)=>object} [o.settingsAt] animated audio settings (keyframes), sampled at 60 Hz
   * @param {{kind:string,time:number,vel:number}[]} [o.drumEvents] drum hits to schedule
   * @param {number} [o.drumVolume]
   */
  static async renderOffline({ settings, layers, duration, frameAt, settingsAt, drumEvents = [], drumVolume = 0.8, glide, articulation, sampleRate = 48000 }) {
    const tail = settings.reverb.decay + 0.5;
    const ctx = new OfflineAudioContext(2, Math.ceil((duration + tail) * sampleRate), sampleRate);
    const eng = new AudioEngine();
    eng.settings = settings;
    eng.build(ctx);
    eng.syncLayers(layers);
    eng.setDrumVolume(drumVolume, 0);
    const step = 1 / 240;
    let nextSettings = 0;
    for (let time = 0; time < duration; time += step) {
      if (settingsAt && time >= nextSettings) {
        eng.applySettings(settingsAt(time), time);
        nextSettings = time + 1 / 60;
      }
      eng.update(frameAt(time), { playing: true, glide, articulation }, time);
    }
    for (const e of drumEvents) if (e.time < duration) eng.drum(e.kind, e.vel, e.time);
    for (const v of eng.voices.values()) { v.amp.gain.cancelScheduledValues(duration); v.amp.gain.setTargetAtTime(0, duration, 0.03); }
    return ctx.startRendering();
  }

  /** Play a short arpeggio with an instrument so it can be heard before choosing it. */
  preview(id, root = 60) {
    if (!this.ctx) return;
    const v = new Voice(this.ctx, id, this.bus);
    const t0 = this.ctx.currentTime + 0.02;
    [0, 3, 7, 12, 7].forEach((semi, i) => {
      const t = t0 + i * 0.22;
      v.setFreq(midiToFreq(root + semi), t, 0.005);
      v.trigger(0.55 * v.gainScale, t, false);
    });
    v.amp.gain.setTargetAtTime(0, t0 + 1.25, 0.08);
    for (const n of v.nodes) n.stop(t0 + 1.8);
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
