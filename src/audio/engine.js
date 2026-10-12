/**
 * Real-time synth built directly on the Web Audio API (no samples, no libraries).
 *
 *   voice per layer:  Instrument (oscillators/FM/LFO → filter) → Amp → StereoPanner ┐
 *   drone (root + fifth) ────────────────────────────────────────────────────────────┤
 *     Bus → Filter (± LFO wah) → Drive → Lo-fi crush → Modulation (chorus / flanger / phaser)
 *       → Tremolo → Auto-pan → Pump (sidechain duck) ┬→ Dry ──────────────────┐
 *                                                    ├→ Delay(+fb) or ping-pong ┤→ Compressor → Master → Analyser → speakers
 *                                                    └→ Pre-delay → Reverb ───┘                     └→ MediaStream (video recording)
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

    // colour + movement between the drive and the effect sends
    this.crush = ctx.createWaveShaper();
    this.modIn = ctx.createGain();
    this.modDry = ctx.createGain();
    this.trem = ctx.createGain();
    this.autopan = ctx.createStereoPanner();
    this.pump = ctx.createGain();
    this.bus.connect(this.filter).connect(this.drive).connect(this.crush).connect(this.modIn);
    this.modIn.connect(this.modDry).connect(this.trem);
    this.trem.connect(this.autopan).connect(this.pump);
    // chorus / flanger: two short delays swept in opposite directions, spread left and right
    this.chorusWet = ctx.createGain();
    this.chorusWet.gain.value = 0;
    this.chorusDepth = ctx.createGain();
    this.chorusDepthInv = ctx.createGain();
    const lfoC = this.lfo(ctx, 0.6);
    this.chorusLfo = lfoC;
    lfoC.connect(this.chorusDepth);
    lfoC.connect(this.chorusDepthInv);
    this.chorusDelays = [-0.85, 0.85].map((panAt, i) => {
      const d = ctx.createDelay(0.1);
      d.delayTime.value = 0.012;
      (i ? this.chorusDepthInv : this.chorusDepth).connect(d.delayTime);
      const pan = ctx.createStereoPanner();
      pan.pan.value = panAt;
      this.modIn.connect(d);
      d.connect(pan).connect(this.chorusWet);
      d.fb = ctx.createGain(); // each delay feeds back only into itself (flanger)
      d.fb.gain.value = 0;
      d.connect(d.fb).connect(d);
      return d;
    });
    this.chorusWet.connect(this.trem);
    // phaser: four all-pass filters swept together
    this.phaserWet = ctx.createGain();
    this.phaserWet.gain.value = 0;
    this.phaserDepth = ctx.createGain();
    this.phaserLfo = this.lfo(ctx, 0.4);
    this.phaserLfo.connect(this.phaserDepth);
    let node = this.modIn;
    for (let i = 0; i < 4; i++) {
      const ap = ctx.createBiquadFilter();
      ap.type = 'allpass';
      ap.frequency.value = 700;
      ap.Q.value = 0.7;
      this.phaserDepth.connect(ap.frequency);
      node.connect(ap);
      node = ap;
    }
    node.connect(this.phaserWet).connect(this.trem);
    // tremolo, auto-pan, filter wah and the pump are LFOs on a gain / pan / cutoff
    this.tremDepth = ctx.createGain();
    this.tremLfo = this.lfo(ctx, 5);
    this.tremLfo.connect(this.tremDepth).connect(this.trem.gain);
    this.panDepth = ctx.createGain();
    this.panLfo = this.lfo(ctx, 0.25);
    this.panLfo.connect(this.panDepth).connect(this.autopan.pan);
    this.filterDepth = ctx.createGain();
    this.filterLfo = this.lfo(ctx, 0.5);
    this.filterLfo.connect(this.filterDepth).connect(this.filter.frequency);
    this.pumpDepth = ctx.createGain();
    const beat = 60 / (this.settings?.bpm || 120) * (this.settings?.pump?.rate || 1);
    this.pumpLfo = this.lfo(ctx, 1 / beat, 'sawtooth', beat / 2); // starts half a cycle late: ducks on the beat
    this.pumpLfo.connect(this.pumpDepth).connect(this.pump.gain);

    this.pump.connect(this.dry).connect(this.comp);
    this.pump.connect(this.delay);
    this.delay.connect(this.delayFb).connect(this.delay);
    this.delay.connect(this.delayWet).connect(this.comp);
    // ping-pong delay: left, then right, then left …
    this.ppIn = ctx.createGain();
    this.ppIn.gain.value = 0;
    this.ppL = ctx.createDelay(2);
    this.ppR = ctx.createDelay(2);
    this.ppFb = ctx.createGain();
    const merge = ctx.createChannelMerger(2);
    this.pump.connect(this.ppIn).connect(this.ppL);
    this.ppL.connect(merge, 0, 0);
    this.ppL.connect(this.ppR);
    this.ppR.connect(merge, 0, 1);
    this.ppR.connect(this.ppFb).connect(this.ppL);
    merge.connect(this.comp);
    this.preDelay = ctx.createDelay(1);
    this.pump.connect(this.preDelay).connect(this.reverb).connect(this.reverbWet).connect(this.comp);
    // drone: root + fifth (+ an octave below), like a tanpura or a synth pad under the melody
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0;
    this.droneFilter = ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 1400;
    this.droneOsc = [['sawtooth', 0, 0.45], ['sawtooth', 7, 0.3], ['sine', -12, 0.6], ['triangle', 12, 0.12]].map(([type, semi, gain]) => {
      const o = ctx.createOscillator();
      o.type = type;
      const g = ctx.createGain();
      g.gain.value = gain;
      o.connect(g).connect(this.droneFilter);
      o.start();
      return { o, g, semi, base: gain };
    });
    this.droneFilter.connect(this.droneGain).connect(this.bus);
    this.comp.connect(this.master);
    // Drums skip the synth filter/drive so they stay punchy, with a little reverb.
    this.drumBus = ctx.createGain();
    this.drumSend = ctx.createGain();
    this.drumSend.gain.value = 0.25;
    this.drumBus.connect(this.comp);
    this.drumBus.connect(this.drumSend).connect(this.reverb);
    this.drums = new DrumKit(ctx, this.drumBus);
    // Safety limiter: catches the odd peak from stacked layers/drums so exports never clip.
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -2.5;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.12;
    // The Web Audio compressor adds automatic make-up gain; take it back so peaks stay below -1 dB.
    this.post = ctx.createGain();
    this.post.gain.value = 0.8;
    this.master.connect(this.limiter).connect(this.post);
    this.post.connect(this.analyser).connect(ctx.destination);
    if (ctx.createMediaStreamDestination) {
      this.streamDest = ctx.createMediaStreamDestination();
      this.post.connect(this.streamDest);
    }

    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeData = new Uint8Array(this.analyser.fftSize);
    if (this.settings) this.applySettings(this.settings);
  }

  get ready() {
    return !!this.ctx;
  }

  /** A running low-frequency oscillator. */
  lfo(ctx, hz, type = 'sine', delay = 0) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = hz;
    o.start(ctx.currentTime + delay);
    return o;
  }

  /** Frequency of a (fractional) MIDI note with the chosen tuning (A4 = 440 Hz by default). */
  freq(midi) {
    return midiToFreq(midi) * ((this.settings?.tuning || 440) / 440);
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
    this.reverbWet.gain.setTargetAtTime(a.reverb.mix, t, tc);
    this.dry.gain.setTargetAtTime(1 - a.reverb.mix * 0.4, t, tc);
    const tone = a.reverb.tone ?? 1;
    if (this.reverbDecay !== a.reverb.decay || this.reverbTone !== tone) {
      this.reverbDecay = a.reverb.decay;
      this.reverbTone = tone;
      this.reverb.buffer = makeImpulse(this.ctx, a.reverb.decay, tone);
    }
    this.preDelay.delayTime.setTargetAtTime(a.reverb.preDelay ?? 0, t, 0.05);
    // ping-pong replaces the plain delay
    const pp = !!a.delay.pingpong;
    this.delayWet.gain.setTargetAtTime(pp ? 0 : a.delay.mix, t, tc);
    this.ppIn.gain.setTargetAtTime(pp ? a.delay.mix : 0, t, tc);
    this.ppL.delayTime.setTargetAtTime(a.delay.time, t, 0.05);
    this.ppR.delayTime.setTargetAtTime(a.delay.time, t, 0.05);
    this.ppFb.gain.setTargetAtTime(Math.min(a.delay.feedback, 0.9), t, tc);
    // filter wah (LFO on the cutoff)
    const f = a.filter;
    this.filterLfo.frequency.setTargetAtTime(f.lfoRate ?? 0.5, t, tc);
    this.filterDepth.gain.setTargetAtTime((f.lfo ?? 0) * f.cutoff * 0.85, t, tc);
    // lo-fi: fewer bits
    const crush = a.crush ?? 0;
    if (this.crushAmount !== crush) {
      this.crushAmount = crush;
      this.crush.curve = crush > 0.001 ? makeCrushCurve(crush) : null;
    }
    // modulation
    const m = a.mod || {};
    const type = m.type || 'off', mix = m.mix ?? 0.5, depth = m.depth ?? 0.5, rate = m.rate ?? 0.6;
    const chorus = type === 'chorus' || type === 'flanger';
    this.modDry.gain.setTargetAtTime(type === 'off' ? 1 : 1 - mix * 0.5, t, tc);
    this.chorusWet.gain.setTargetAtTime(chorus ? mix : 0, t, tc);
    this.phaserWet.gain.setTargetAtTime(type === 'phaser' ? mix : 0, t, tc);
    this.chorusLfo.frequency.setTargetAtTime(rate, t, tc);
    this.phaserLfo.frequency.setTargetAtTime(rate, t, tc);
    const base = type === 'flanger' ? 0.004 : 0.014;
    const swing = (type === 'flanger' ? 0.0032 : 0.006) * depth;
    for (const d of this.chorusDelays) d.delayTime.setTargetAtTime(base, t, 0.05);
    this.chorusDepth.gain.setTargetAtTime(chorus ? swing : 0, t, tc);
    this.chorusDepthInv.gain.setTargetAtTime(chorus ? -swing : 0, t, tc);
    for (const d of this.chorusDelays) d.fb.gain.setTargetAtTime(type === 'flanger' ? 0.4 * depth + 0.2 : 0, t, tc);
    this.phaserDepth.gain.setTargetAtTime(type === 'phaser' ? 650 * depth : 0, t, tc);
    // tremolo and auto-pan
    const mo = a.motion || {};
    const trem = Math.min(1, mo.tremolo ?? 0);
    this.trem.gain.setTargetAtTime(1 - trem / 2, t, tc);
    this.tremDepth.gain.setTargetAtTime(trem / 2, t, tc);
    this.tremLfo.frequency.setTargetAtTime(mo.tremoloRate ?? 5, t, tc);
    this.panDepth.gain.setTargetAtTime(Math.min(1, mo.autopan ?? 0), t, tc);
    this.panLfo.frequency.setTargetAtTime(mo.panRate ?? 0.25, t, tc);
    // pump: duck on every beat (or every 2 / ½ beats) at the project tempo
    const pu = a.pump || {};
    const amt = Math.min(0.95, pu.amount ?? 0);
    this.pump.gain.setTargetAtTime(1 - amt / 2, t, tc);
    this.pumpDepth.gain.setTargetAtTime(amt / 2, t, tc);
    this.pumpLfo.frequency.setTargetAtTime((a.bpm || 120) / 60 / (pu.rate || 1), t, tc);
    // drone pitch (its level follows play/pause in update())
    const dr = a.drone || {};
    const root = 12 * ((dr.octave ?? 2) + 1) + (a.root || 0);
    for (const d of this.droneOsc) {
      d.o.frequency.setTargetAtTime(this.freq(root + d.semi), t, 0.05);
      d.g.gain.setTargetAtTime(d.semi === 7 && dr.fifth === false ? 0 : d.base, t, tc);
    }
    this.droneFilter.frequency.setTargetAtTime(400 + 2600 * (dr.bright ?? 0.4), t, tc);
    this.droneLevel = Math.min(1, dr.volume ?? 0) * 0.32;
  }

  /** Drone on while playing, off when paused. */
  droneOn(on, t) {
    this.droneGain.gain.setTargetAtTime(on ? this.droneLevel || 0 : 0, t, on ? 0.4 : 0.15);
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
    const fine = this.settings?.scale && this.settings.scale !== 'continuous';
    const droneNow = !!opts.playing && this.droneLevel > 0;
    if (droneNow !== this.droneActive || (droneNow && this.droneSetLevel !== this.droneLevel)) {
      this.droneOn(droneNow, t);
      this.droneActive = droneNow;
      this.droneSetLevel = this.droneLevel;
    }
    for (const f of frames) {
      const v = this.voices.get(f.id);
      if (!v) continue;
      const audible = opts.playing && f.midi != null && f.gain > 0;
      if (f.midi != null) v.setFreq(this.freq(f.midi), t, glide);
      v.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, f.pan)), t, 0.03);
      const level = audible ? f.gain * v.gainScale : 0;
      const mode = v.inst.mode || opts.articulation;
      if (mode === 'pluck' && audible) {
        // Retrigger the instrument's envelopes every time the (rounded) note or beat step changes.
        const n = fine ? Math.round(f.midi * 4) : Math.round(f.midi); // in a scale, a quarter tone is a new note
        const note = f.step == null ? n : `${n}@${f.step}`;
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
    eng.droneOn(false, duration);
    return ctx.startRendering();
  }

  /**
   * One note on a pooled voice of an instrument (Circle Lab: a note per bounce).
   * Up to 12 notes of the same sound ring at once; the oldest is reused.
   */
  playNote(id, midi, vel = 0.8, at = null, length = 0.35) {
    if (!this.ctx) return;
    this.notePools ||= new Map();
    let pool = this.notePools.get(id);
    if (!pool) this.notePools.set(id, (pool = { voices: [], next: 0 }));
    let v = pool.voices[pool.next];
    if (!v) { v = new Voice(this.ctx, id, this.bus); pool.voices[pool.next] = v; }
    pool.next = (pool.next + 1) % 12;
    const t = at ?? this.ctx.currentTime;
    v.setFreq(this.freq(midi), t, 0.001);
    v.trigger(vel * 1.6 * v.gainScale, t, at == null);
    v.amp.gain.setTargetAtTime(0, t + Math.max(0.05, length), 0.08);
  }

  /** Play a short arpeggio with an instrument so it can be heard before choosing it. */
  preview(id, root = 60) {
    if (!this.ctx) return;
    const v = new Voice(this.ctx, id, this.bus);
    const t0 = this.ctx.currentTime + 0.02;
    [0, 3, 7, 12, 7].forEach((semi, i) => {
      const t = t0 + i * 0.22;
      v.setFreq(this.freq(root + semi), t, 0.005);
      v.trigger(0.55 * v.gainScale, t, false);
    });
    v.amp.gain.setTargetAtTime(0, t0 + 1.25, 0.08);
    for (const n of v.nodes) n.stop(t0 + 1.8);
  }

  /**
   * Render a list of notes (+ drums) offline: the Circle Lab soundtrack.
   * @param {{t:number, midi:number, vel:number}[]} o.notes
   */
  static async renderNotesOffline({ settings, duration, notes, instrument, length = 0.35, volume = 0.6, drumEvents = [], drumVolume = 0.8, sampleRate = 48000 }) {
    const tail = settings.reverb.decay + 1;
    const ctx = new OfflineAudioContext(2, Math.ceil((duration + tail) * sampleRate), sampleRate);
    const eng = new AudioEngine();
    eng.settings = settings;
    eng.build(ctx);
    eng.setDrumVolume(drumVolume, 0);
    // a note may carry its own instrument / length / volume (Circle Lab layers)
    for (const n of notes) if (n.t < duration) eng.playNote(n.instrument || instrument, n.midi, n.vel * (n.volume ?? volume), n.t, n.length ?? length);
    for (const e of drumEvents) if (e.time < duration) eng.drum(e.kind, e.vel, e.time);
    if (eng.droneLevel > 0) { eng.droneOn(true, 0); eng.droneOn(false, duration); }
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
    this.droneOn(false, t);
    this.droneActive = false;
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

/** Lo-fi: a staircase curve (fewer bits); amount 0..1 → 12 … 3 bits. */
function makeCrushCurve(amount) {
  const levels = 2 ** Math.round(12 - amount * 9);
  const n = 8192;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.round(x * levels / 2) / (levels / 2);
  }
  return curve;
}

/**
 * Synthetic stereo reverb tail: exponentially decaying noise. tone 0..1: 0 = dark
 * (the tail is low-passed, like a big soft hall), 1 = bright (a metal plate).
 */
function makeImpulse(ctx, seconds, tone = 1) {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const buf = ctx.createBuffer(2, len, rate);
  const c = 0.04 + 0.96 * tone ** 1.5; // one-pole low-pass coefficient
  const norm = Math.min(4, 1 / Math.sqrt(c / (2 - c))); // same loudness, darker or brighter
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let y = 0;
    for (let i = 0; i < len; i++) {
      y += c * ((Math.random() * 2 - 1) - y);
      d[i] = y * norm * Math.pow(1 - i / len, 3.2);
    }
  }
  return buf;
}
