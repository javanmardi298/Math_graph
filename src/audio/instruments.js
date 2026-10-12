/**
 * Instrument library: every layer's "Sound". Each instrument is a small synth patch
 * built from Web Audio nodes (no samples), so it works offline, in the WAV render
 * and in the video export alike.
 *
 * Patch fields (all optional except osc):
 *   osc     [{ type | wave, semi, cents, gain }]  oscillators (semi: chord/octave offsets)
 *   sub     gain of a sine one octave below
 *   fm      { ratio, index, env, decay }           sine modulator on every oscillator's pitch
 *   filter  { type, freq | key, q, env, decay }    per-voice filter; key = multiple of the note
 *                                                  frequency; env = how far it opens per note
 *   amp     { attack, decay, sustain }             envelope used when notes retrigger
 *   mode    'pluck' | 'legato'                     overrides the global articulation
 *   lfo     { target: 'filter' | 'pitch', rate, depth }
 *   gain    loudness compensation
 *   program General MIDI program for the MIDI export
 *
 * Recipes follow the classic patches: detuned saws + zero-sustain amp/filter envelopes for
 * house stabs, resonant low-pass with a short filter decay for acid/psy basslines.
 */

const A = (attack, decay, sustain) => ({ attack, decay, sustain });

export const INSTRUMENTS = {
  // ---------------------------------------------------------------- basic waves
  sine: { label: 'Sine ∿', group: 'Basic waves', osc: [{ type: 'sine' }], gain: 1, program: 80 },
  triangle: { label: 'Triangle ⋀', group: 'Basic waves', osc: [{ type: 'triangle' }], gain: 0.9, program: 80 },
  square: { label: 'Square ⊓', group: 'Basic waves', osc: [{ type: 'square' }], gain: 0.42, program: 80 },
  sawtooth: { label: 'Sawtooth ⩘', group: 'Basic waves', osc: [{ type: 'sawtooth' }], gain: 0.5, program: 81 },

  // ------------------------------------------------------------ house & deep house
  'deep-organ': { label: 'Deep house organ', group: 'House & deep house', osc: [{ wave: 'organ' }], filter: { type: 'lowpass', freq: 3200, q: 0.7 },
    amp: A(0.004, 0.22, 0.25), mode: 'pluck', gain: 1.57, program: 17 },
  'house-stab': { label: 'Chord stab (minor 7th)', group: 'House & deep house',
    osc: [0, 3, 7, 10].map((semi) => ({ type: 'sawtooth', semi, gain: 0.3 })).concat([{ type: 'square', semi: 12, gain: 0.12 }]),
    filter: { type: 'lowpass', freq: 900, q: 2, env: 3.2, decay: 0.1 }, amp: A(0.002, 0.16, 0), mode: 'pluck', gain: 2.23, program: 81 },
  'garage-chord': { label: 'Garage chord (major 9th)', group: 'House & deep house',
    osc: [0, 4, 7, 11, 14].map((semi) => ({ type: 'sawtooth', semi, cents: semi % 2 ? 6 : -6, gain: 0.24 })),
    filter: { type: 'lowpass', freq: 1300, q: 1.2, env: 2, decay: 0.18 }, amp: A(0.003, 0.3, 0.12), mode: 'pluck', gain: 2.19, program: 89 },
  'house-piano': { label: 'House piano', group: 'House & deep house', osc: [{ type: 'triangle' }, { type: 'sine', semi: 12, gain: 0.35 }],
    fm: { ratio: 1, index: 1.4, env: 2.5, decay: 0.35 }, amp: A(0.002, 0.7, 0.15), mode: 'pluck', gain: 0.88, program: 0 },
  'deep-bass': { label: 'Deep house bass', group: 'House & deep house', osc: [{ type: 'sine' }, { type: 'square', gain: 0.12 }],
    filter: { type: 'lowpass', freq: 700, q: 1.5, env: 1.5, decay: 0.12 }, amp: A(0.004, 0.25, 0.55), mode: 'pluck', gain: 0.75, program: 38 },
  'dub-chord': { label: 'Dub techno chord', group: 'House & deep house', osc: [0, 3, 7].map((semi) => ({ type: 'sawtooth', semi, gain: 0.33 })),
    filter: { type: 'bandpass', freq: 750, q: 1.4, env: 1.2, decay: 0.2 }, amp: A(0.003, 0.35, 0.05), mode: 'pluck', gain: 4.73, program: 90 },

  // ---------------------------------------------------------------- techno & acid
  'acid-303': { label: 'Acid 303 squelch', group: 'Techno & acid', osc: [{ type: 'sawtooth' }],
    filter: { type: 'lowpass', freq: 320, q: 15, env: 7, decay: 0.16 }, amp: A(0.002, 0.3, 0.55), mode: 'pluck', gain: 0.7, program: 38 },
  'acid-square': { label: 'Acid square', group: 'Techno & acid', osc: [{ type: 'square' }],
    filter: { type: 'lowpass', freq: 300, q: 13, env: 6, decay: 0.12 }, amp: A(0.002, 0.25, 0.5), mode: 'pluck', gain: 0.48, program: 38 },
  'techno-stab': { label: 'Techno stab', group: 'Techno & acid', osc: [0, 7, 12].map((semi) => ({ type: 'sawtooth', semi, cents: semi ? 8 : 0, gain: 0.35 })),
    filter: { type: 'lowpass', freq: 600, q: 6, env: 5, decay: 0.07 }, amp: A(0.001, 0.12, 0), mode: 'pluck', gain: 2.24, program: 81 },
  reese: { label: 'Reese bass', group: 'Techno & acid', osc: [{ type: 'sawtooth', cents: -14, gain: 0.5 }, { type: 'sawtooth', cents: 14, gain: 0.5 }], sub: 0.5,
    filter: { type: 'lowpass', freq: 650, q: 2 }, lfo: { target: 'filter', rate: 0.35, depth: 0.5 }, gain: 1.0, program: 38 },
  'fm-bass': { label: 'FM bass', group: 'Techno & acid', osc: [{ type: 'sine' }], sub: 0.3, fm: { ratio: 1, index: 2.2, env: 3, decay: 0.12 },
    amp: A(0.002, 0.22, 0.4), mode: 'pluck', gain: 0.96, program: 39 },

  // ----------------------------------------------------------- psychedelic & trance
  'psy-bass': { label: 'Psytrance rolling bass', group: 'Psychedelic & trance', osc: [{ type: 'sawtooth' }], sub: 0.35,
    filter: { type: 'lowpass', freq: 220, q: 6, env: 8, decay: 0.06 }, amp: A(0.001, 0.1, 0), mode: 'pluck', gain: 2.1, program: 38 },
  'psy-lead': { label: 'Psychedelic lead', group: 'Psychedelic & trance', osc: [{ type: 'sawtooth', cents: -9 }, { type: 'square', cents: 9, gain: 0.5 }],
    filter: { type: 'lowpass', freq: 1100, q: 9, env: 2, decay: 0.2 }, lfo: { target: 'filter', rate: 6.5, depth: 0.7 }, amp: A(0.004, 0.4, 0.6), gain: 0.61, program: 84 },
  supersaw: { label: 'Trance supersaw', group: 'Psychedelic & trance', osc: [-21, -12, -5, 0, 5, 12, 21].map((cents) => ({ type: 'sawtooth', cents, gain: 0.2 })),
    filter: { type: 'lowpass', freq: 5200, q: 0.8 }, amp: A(0.01, 0.4, 0.7), gain: 1.73, program: 81 },
  wobble: { label: 'Wobble bass', group: 'Psychedelic & trance', osc: [{ type: 'sawtooth' }, { type: 'square', semi: -12, gain: 0.5 }],
    filter: { type: 'lowpass', freq: 380, q: 8 }, lfo: { target: 'filter', rate: 4, depth: 3.2 }, gain: 0.77, program: 38 },
  'squelch-fm': { label: 'Squelchy FM', group: 'Psychedelic & trance', osc: [{ type: 'sine' }], fm: { ratio: 0.5, index: 4, env: 4, decay: 0.09 },
    filter: { type: 'lowpass', freq: 900, q: 10, env: 3, decay: 0.1 }, amp: A(0.002, 0.2, 0.3), mode: 'pluck', gain: 0.67, program: 84 },
  'space-arp': { label: 'Space arp (echo pluck)', group: 'Psychedelic & trance', osc: [{ type: 'sawtooth', cents: -6 }, { type: 'sawtooth', cents: 6 }],
    filter: { type: 'lowpass', freq: 1400, q: 5, env: 4, decay: 0.09 }, lfo: { target: 'pitch', rate: 0.3, depth: 8 }, amp: A(0.001, 0.18, 0), mode: 'pluck', gain: 1.25, program: 81 },

  // ---------------------------------------------------------------- pads & ambient
  'warm-pad': { label: 'Warm pad', group: 'Pads & ambient', osc: [-10, -4, 4, 10].map((cents) => ({ type: 'sawtooth', cents, gain: 0.25 })),
    filter: { type: 'lowpass', freq: 1300, q: 0.7 }, lfo: { target: 'pitch', rate: 0.25, depth: 6 }, amp: A(0.35, 1, 0.9), mode: 'legato', gain: 2.16, program: 89 },
  'glass-pad': { label: 'Glass pad', group: 'Pads & ambient', osc: [{ type: 'triangle' }, { type: 'sine', semi: 12, gain: 0.4 }], fm: { ratio: 3, index: 0.6 },
    lfo: { target: 'pitch', rate: 0.4, depth: 5 }, amp: A(0.5, 1, 0.9), mode: 'legato', gain: 0.79, program: 92 },
  choir: { label: 'Choir “aah”', group: 'Pads & ambient', osc: [{ wave: 'vox', cents: -5 }, { wave: 'vox', cents: 5 }],
    lfo: { target: 'pitch', rate: 5, depth: 9 }, amp: A(0.25, 1, 0.9), mode: 'legato', gain: 0.72, program: 52 },
  drone: { label: 'Dark drone', group: 'Pads & ambient', osc: [{ type: 'sawtooth', semi: -12, gain: 0.4 }, { type: 'sawtooth', semi: -5, cents: 4, gain: 0.3 }, { type: 'sawtooth', cents: -4, gain: 0.3 }],
    filter: { type: 'lowpass', freq: 500, q: 3 }, lfo: { target: 'filter', rate: 0.15, depth: 0.8 }, amp: A(0.8, 1, 1), mode: 'legato', gain: 1.71, program: 95 },

  // ---------------------------------------------------------------- keys & bells
  'e-piano': { label: 'Electric piano', group: 'Keys & bells', osc: [{ type: 'sine' }], fm: { ratio: 1, index: 1.1, env: 2, decay: 0.25 },
    amp: A(0.002, 1, 0.2), mode: 'pluck', gain: 0.95, program: 4 },
  bell: { label: 'FM bell', group: 'Keys & bells', osc: [{ type: 'sine' }], fm: { ratio: 3.5, index: 2.5, env: 1.5, decay: 0.6 },
    amp: A(0.001, 1.4, 0), mode: 'pluck', gain: 0.74, program: 14 },
  marimba: { label: 'Marimba', group: 'Keys & bells', osc: [{ type: 'sine' }, { type: 'sine', semi: 24, gain: 0.12 }], fm: { ratio: 4, index: 1.8, env: 1, decay: 0.03 },
    amp: A(0.001, 0.32, 0), mode: 'pluck', gain: 0.92, program: 12 },
  kalimba: { label: 'Kalimba', group: 'Keys & bells', osc: [{ type: 'sine' }], fm: { ratio: 5.4, index: 1.2, env: 2, decay: 0.05 },
    amp: A(0.001, 0.55, 0), mode: 'pluck', gain: 1.07, program: 108 },
  'music-box': { label: 'Music box', group: 'Keys & bells', osc: [{ wave: 'musicbox', semi: 12 }], amp: A(0.001, 0.9, 0), mode: 'pluck', gain: 0.78, program: 10 },
  'synth-pluck': { label: 'Synth pluck', group: 'Keys & bells', osc: [{ type: 'sawtooth', cents: -5 }, { type: 'sawtooth', cents: 5 }],
    filter: { type: 'lowpass', freq: 700, q: 3, env: 6, decay: 0.08 }, amp: A(0.001, 0.35, 0), mode: 'pluck', gain: 1.22, program: 81 },
  harp: { label: 'Harp', group: 'Keys & bells', osc: [{ type: 'triangle' }, { type: 'sine', semi: 12, gain: 0.2 }],
    filter: { type: 'lowpass', freq: 2400, q: 1, env: 1.5, decay: 0.2 }, amp: A(0.001, 0.9, 0), mode: 'pluck', gain: 1.0, program: 46 },

  // ------------------------------------------------------------- retro & leads
  chiptune: { label: 'Chiptune (8-bit)', group: 'Retro & leads', osc: [{ wave: 'pulse25' }], amp: A(0.001, 0.2, 0.6), mode: 'pluck', gain: 1.8, program: 80 },
  'vibrato-lead': { label: 'Vibrato lead', group: 'Retro & leads', osc: [{ type: 'square', gain: 0.6 }, { type: 'sawtooth', cents: 7, gain: 0.4 }],
    filter: { type: 'lowpass', freq: 3000, q: 1 }, lfo: { target: 'pitch', rate: 5.5, depth: 18 }, gain: 0.88, program: 80 },
  'flute-synth': { label: 'Synth flute', group: 'Retro & leads', osc: [{ type: 'sine' }, { type: 'triangle', semi: 12, gain: 0.15 }],
    lfo: { target: 'pitch', rate: 4.8, depth: 7 }, amp: A(0.06, 0.5, 0.8), mode: 'legato', gain: 0.76, program: 73 },
};

export const INSTRUMENT_GROUPS = [...new Set(Object.values(INSTRUMENTS).map((i) => i.group))];

export const instrumentOf = (id) => INSTRUMENTS[id] || INSTRUMENTS.sine;

/* ------------------------------------------------------------ custom waves */

/** Harmonic recipes for setPeriodicWave (sine-term amplitudes, index = harmonic number). */
const WAVES = {
  // Drawbar organ: 16' 8' 5⅓' 4' … (the classic deep house organ)
  organ: [0, 1, 0.75, 0.6, 0.45, 0, 0.3, 0, 0.25],
  // Formant-ish "aah": strong low harmonics plus a bump around the 7th-9th
  vox: [0, 1, 0.6, 0.35, 0.22, 0.15, 0.2, 0.32, 0.3, 0.18, 0.08, 0.04],
  musicbox: [0, 1, 0, 0.35, 0, 0.12, 0, 0, 0.05],
  // 25 % pulse: a_n = 2 sin(π n d) / (π n)
  pulse25: [0, ...Array.from({ length: 32 }, (_, i) => (2 * Math.sin(Math.PI * (i + 1) * 0.25)) / (Math.PI * (i + 1)))],
};

const waveCache = new WeakMap();

export function periodicWave(ctx, name) {
  let m = waveCache.get(ctx);
  if (!m) waveCache.set(ctx, (m = new Map()));
  if (!m.has(name)) {
    const coefs = WAVES[name] || [0, 1];
    const real = new Float32Array(coefs.length), imag = new Float32Array(coefs);
    m.set(name, ctx.createPeriodicWave(real, imag));
  }
  return m.get(name);
}

/* ---------------------------------------------------------------- voice */

const ratio = (semi = 0) => Math.pow(2, semi / 12);

/**
 * One layer's synth voice: oscillators (+ sub, FM, LFO) → filter → amp → pan → out.
 */
export class Voice {
  constructor(ctx, id, out) {
    this.ctx = ctx;
    this.id = id;
    this.inst = instrumentOf(id);
    const p = this.inst;
    this.amp = ctx.createGain();
    this.amp.gain.value = 0;
    this.pan = ctx.createStereoPanner();
    this.amp.connect(this.pan).connect(out);
    let head = this.amp;
    if (p.filter) {
      this.filter = ctx.createBiquadFilter();
      this.filter.type = p.filter.type || 'lowpass';
      this.filter.Q.value = p.filter.q ?? 1;
      this.filter.frequency.value = p.filter.freq ?? 2000;
      this.filter.connect(this.amp);
      head = this.filter;
    }
    this.nodes = [];
    this.oscs = p.osc.map((o) => {
      const osc = ctx.createOscillator();
      if (o.wave) osc.setPeriodicWave(periodicWave(ctx, o.wave));
      else osc.type = o.type || 'sine';
      osc.detune.value = o.cents || 0;
      const g = ctx.createGain();
      g.gain.value = o.gain ?? 1;
      osc.connect(g).connect(head);
      this.nodes.push(osc);
      return { osc, mult: ratio(o.semi) };
    });
    if (p.sub) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = p.sub;
      osc.connect(g).connect(head);
      this.nodes.push(osc);
      this.oscs.push({ osc, mult: 0.5 });
    }
    if (p.fm) {
      this.mod = ctx.createOscillator();
      this.modGain = ctx.createGain();
      this.modGain.gain.value = 0;
      this.mod.connect(this.modGain);
      for (const o of this.oscs) this.modGain.connect(o.osc.frequency);
      this.nodes.push(this.mod);
    }
    if (p.lfo) {
      this.lfo = ctx.createOscillator();
      this.lfo.frequency.value = p.lfo.rate;
      this.lfoGain = ctx.createGain();
      this.lfo.connect(this.lfoGain);
      if (p.lfo.target === 'pitch') {
        this.lfoGain.gain.value = p.lfo.depth; // cents
        for (const o of this.oscs) this.lfoGain.connect(o.osc.detune);
      } else if (this.filter) {
        this.lfoGain.gain.value = 0; // set with the note (depth is relative to the cutoff)
        this.lfoGain.connect(this.filter.frequency);
      }
      this.nodes.push(this.lfo);
    }
    for (const n of this.nodes) n.start();
    this.freq = 220;
  }

  get gainScale() { return this.inst.gain ?? 1; }

  /** Cutoff for the current note (fixed or key-tracked). */
  baseCutoff() {
    const f = this.inst.filter;
    return f.key ? Math.min(18000, this.freq * f.key) : f.freq;
  }

  setFreq(freq, t, tc) {
    this.freq = freq;
    for (const o of this.oscs) o.osc.frequency.setTargetAtTime(freq * o.mult, t, tc);
    const fm = this.inst.fm;
    if (fm) {
      this.mod.frequency.setTargetAtTime(freq * fm.ratio, t, tc);
      if (!fm.env) this.modGain.gain.setTargetAtTime(freq * fm.index, t, tc);
    }
    if (this.inst.filter?.key) this.filter.frequency.setTargetAtTime(this.baseCutoff(), t, 0.02);
    if (this.inst.lfo?.target === 'filter' && this.filter) this.lfoGain.gain.setTargetAtTime(this.baseCutoff() * this.inst.lfo.depth * 0.5, t, 0.05);
  }

  /** Start a new note: amp, filter and FM envelopes. */
  trigger(level, t, live) {
    const env = this.inst.amp || A(0.006, 0.16, 0.18);
    const g = this.amp.gain;
    // A voice's first note scheduled ahead of time (offline renders): anchor the envelopes
    // at the note, or the ramps would start at t = 0 and sound before it.
    if (this.fresh !== false && !live) {
      g.setValueAtTime(0, t);
      if (this.filter && this.inst.filter?.env) this.filter.frequency.setValueAtTime(this.baseCutoff(), t);
      if (this.inst.fm?.env) this.modGain.gain.setValueAtTime(this.freq * this.inst.fm.index, t);
    }
    this.fresh = false;
    hold(g, t, live);
    g.linearRampToValueAtTime(level, t + env.attack);
    g.setTargetAtTime(level * env.sustain, t + env.attack, Math.max(0.01, env.decay / 3));
    const f = this.inst.filter;
    if (f?.env) {
      const base = this.baseCutoff();
      const fq = this.filter.frequency;
      hold(fq, t, live);
      fq.linearRampToValueAtTime(Math.min(18000, base * (1 + f.env)), t + 0.003);
      fq.setTargetAtTime(base, t + 0.004, Math.max(0.01, (f.decay ?? 0.15) / 3));
    }
    const fm = this.inst.fm;
    if (fm?.env) {
      const mg = this.modGain.gain;
      hold(mg, t, live);
      mg.linearRampToValueAtTime(this.freq * fm.index * (1 + fm.env), t + 0.002);
      mg.setTargetAtTime(this.freq * fm.index, t + 0.003, Math.max(0.01, (fm.decay ?? 0.2) / 3));
    }
  }

  /** Held note: follow the level smoothly (legato). */
  level(level, t, audible) {
    const attack = this.inst.amp?.attack ?? 0.012;
    this.amp.gain.setTargetAtTime(level, t, audible ? Math.max(0.012, attack / 3) : 0.04);
    if (this.inst.fm?.env && audible) this.modGain.gain.setTargetAtTime(this.freq * this.inst.fm.index, t, 0.05);
  }

  stop(t) {
    this.amp.gain.cancelScheduledValues(t);
    this.amp.gain.setTargetAtTime(0, t, 0.02);
    for (const n of this.nodes) n.stop(t + 0.25);
  }

  /** Cut the voice out of the audio graph once it has faded (so it can be collected). */
  dispose() {
    setTimeout(() => { try { this.amp.disconnect(); this.pan.disconnect(); this.filter?.disconnect(); } catch { /* already gone */ } }, 400);
  }
}

/** Freeze a parameter at its current value before scheduling a new envelope. */
function hold(param, t, live) {
  if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t);
  else { param.cancelScheduledValues(t); if (live) param.setValueAtTime(param.value, t); }
}
