/** Test signals: a monophonic melody rendered with a simple additive voice. */
export const hz = (m, tuning = 440) => tuning * 2 ** ((m - 69) / 12);

/**
 * @param {{t:number, d:number, m:number, v?:number}[]} notes seconds + MIDI
 * @param {{rate?:number, len?:number, harm?:number[], attack?:number, decay?:number, vibrato?:number, tuning?:number}} o
 * @returns AudioBuffer-like
 */
export function synth(notes, o = {}) {
  const { rate = 44100, harm = [1, 0.5, 0.33, 0.2], attack = 0.01, decay = 0, vibrato = 0, tuning = 440 } = o;
  const len = o.len ?? Math.max(...notes.map((n) => n.t + n.d)) + 0.5;
  const x = new Float32Array(Math.ceil(len * rate));
  for (const n of notes) {
    const f = hz(n.m, tuning), i0 = Math.floor(n.t * rate), i1 = Math.min(x.length, Math.floor((n.t + n.d) * rate));
    let ph = 0;
    for (let i = i0; i < i1; i++) {
      const tt = (i - i0) / rate;
      const env = Math.min(1, tt / attack) * Math.exp(-decay * tt) * Math.min(1, (n.d - tt) / 0.015);
      ph += (2 * Math.PI * f * (1 + vibrato * Math.sin(2 * Math.PI * 5.5 * tt))) / rate;
      let s = 0;
      harm.forEach((a, k) => { s += a * Math.sin((k + 1) * ph); });
      x[i] += 0.3 * (n.v ?? 1) * env * s;
    }
  }
  return { numberOfChannels: 1, sampleRate: rate, length: x.length, getChannelData: () => x };
}
