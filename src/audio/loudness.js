/**
 * Measuring a soundtrack without ears: loudness the way broadcasters and YouTube measure it
 * (ITU-R BS.1770 integrated loudness in LUFS, with its two gates), the peak, clipping, silent
 * stretches, the balance of low / middle / high, and a loudness curve over time.
 * Pure: it takes channel data (Float32Array per channel) and a sample rate, so the tests run it
 * on synthetic tones. window.mmv.loudness() and the Audio tab feed it the offline render.
 */

/** A biquad as { b0, b1, b2, a1, a2 } run over a signal (returns a new Float32Array). */
function biquad(x, c) {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = c.b0 * x[i] + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v;
    y[i] = v;
  }
  return y;
}

/** The two K-weighting filters of BS.1770 for any sample rate (a high shelf at ~1.7 kHz, a high-pass at ~38 Hz). */
export function kWeighting(rate) {
  // stage 1: the head's high shelf (+4 dB)
  let f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
  let K = Math.tan((Math.PI * f0) / rate);
  const Vh = 10 ** (G / 20), Vb = Vh ** 0.4996667741545416;
  let a0 = 1 + K / Q + K * K;
  const shelf = { b0: (Vh + (Vb * K) / Q + K * K) / a0, b1: (2 * (K * K - Vh)) / a0, b2: (Vh - (Vb * K) / Q + K * K) / a0, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q + K * K) / a0 };
  // stage 2: the high-pass
  f0 = 38.13547087602444; Q = 0.5003270373238773;
  K = Math.tan((Math.PI * f0) / rate);
  a0 = 1 + K / Q + K * K;
  const high = { b0: 1, b1: -2, b2: 1, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q + K * K) / a0 };
  return [shelf, high];
}

const db = (v) => (v > 0 ? 20 * Math.log10(v) : -Infinity);
const lufs = (meanSquare) => (meanSquare > 0 ? -0.691 + 10 * Math.log10(meanSquare) : -Infinity);
const round1 = (v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : v);

/** A second-order Butterworth low-pass or high-pass (for the three-band balance). */
function butter(rate, hz, highpass = false) {
  const K = Math.tan((Math.PI * Math.min(hz, rate * 0.45)) / rate), Q = Math.SQRT1_2, a0 = 1 + K / Q + K * K;
  const a1 = (2 * (K * K - 1)) / a0, a2 = (1 - K / Q + K * K) / a0;
  return highpass ? { b0: 1 / a0, b1: -2 / a0, b2: 1 / a0, a1, a2 } : { b0: (K * K) / a0, b1: (2 * K * K) / a0, b2: (K * K) / a0, a1, a2 };
}
const energy = (x) => { let e = 0; for (let i = 0; i < x.length; i++) e += x[i] * x[i]; return e; };

/**
 * @param {Float32Array[]} channels one array per channel (1 or 2)
 * @param {number} rate sample rate in Hz
 * @returns {{seconds:number, lufs:number, peakDb:number, rmsDb:number, clipped:number, range:number,
 *   silences:{start:number,end:number}[], silentShare:number, balance:{low:number,mid:number,high:number},
 *   curve:{t:number,lufs:number}[], advice:string[], gainToTarget:number}}
 */
export function measureLoudness(channels, rate, { target = -14 } = {}) {
  const n = channels[0]?.length || 0;
  const seconds = n / rate;
  if (!n) return { seconds: 0, lufs: -Infinity, peakDb: -Infinity, rmsDb: -Infinity, clipped: 0, range: 0, silences: [], silentShare: 1, balance: { low: 0, mid: 0, high: 0 }, curve: [], advice: ['There is no sound at all.'], gainToTarget: 0 };

  // peak, RMS and clipping on the plain signal
  let peak = 0, sum = 0, clipped = 0;
  for (const ch of channels) for (let i = 0; i < n; i++) { const a = Math.abs(ch[i]); if (a > peak) peak = a; if (a >= 0.999) clipped++; sum += ch[i] * ch[i]; }
  const rmsDb = db(Math.sqrt(sum / (n * channels.length)));

  // K-weighted energy in 400 ms blocks, 75 % overlap
  const [shelf, high] = kWeighting(rate);
  const weighted = channels.map((ch) => biquad(biquad(ch, shelf), high));
  const block = Math.round(0.4 * rate), hop = Math.round(0.1 * rate);
  const blocks = [];
  if (n >= block) {
    // running sums per 100 ms slice make the blocks cheap
    const slices = Math.floor(n / hop), e = new Float64Array(slices);
    for (const ch of weighted) for (let s = 0; s < slices; s++) { let q = 0; const o = s * hop; for (let i = 0; i < hop; i++) q += ch[o + i] * ch[o + i]; e[s] += q; }
    for (let s = 0; s + 4 <= slices; s++) blocks.push((e[s] + e[s + 1] + e[s + 2] + e[s + 3]) / (4 * hop));
  } else {
    let q = 0;
    for (const ch of weighted) for (let i = 0; i < n; i++) q += ch[i] * ch[i];
    blocks.push(q / n);
  }
  const mean = (list) => list.reduce((s, v) => s + v, 0) / (list.length || 1);
  // gate 1: drop blocks under −70 LUFS; gate 2: drop blocks more than 10 LU under the rest
  const loud = blocks.filter((b) => lufs(b) > -70);
  const rel = lufs(mean(loud)) - 10;
  const kept = loud.filter((b) => lufs(b) > rel);
  const integrated = kept.length ? lufs(mean(kept)) : -Infinity;

  // loudness range: between the 10th and 95th percentile of 3 s windows (simplified EBU LRA)
  const win = [];
  for (let i = 0; i + 30 <= blocks.length; i += 10) win.push(lufs(mean(blocks.slice(i, i + 30))));
  const live = win.filter((v) => v > -70 && v > integrated - 20).sort((a, b) => a - b);
  const range = live.length > 2 ? live[Math.floor(live.length * 0.95)] - live[Math.floor(live.length * 0.1)] : 0;

  // silent stretches: half a second or more under −60 LUFS
  const silences = [];
  let from = null;
  blocks.forEach((b, i) => {
    const quiet = lufs(b) < -60, t = (i * hop) / rate;
    if (quiet && from == null) from = t;
    if ((!quiet || i === blocks.length - 1) && from != null) { const end = quiet ? seconds : t; if (end - from >= 0.5) silences.push({ start: +from.toFixed(2), end: +end.toFixed(2) }); from = null; }
  });
  const silentShare = silences.reduce((s, x) => s + x.end - x.start, 0) / Math.max(seconds, 1e-9);

  // balance: the share of energy under 200 Hz, between, and over 4 kHz
  const mono = new Float32Array(n);
  for (const ch of channels) for (let i = 0; i < n; i++) mono[i] += ch[i] / channels.length;
  // two filters in a row (24 dB per octave) keep the bands apart; the middle is what is left
  const lowF = butter(rate, 200), highF = butter(rate, 4000, true);
  const eAll = energy(mono), eL = Math.min(eAll, energy(biquad(biquad(mono, lowF), lowF))), eH = Math.min(eAll - eL, energy(biquad(biquad(mono, highF), highF)));
  const eM = Math.max(0, eAll - eL - eH);
  const tot = eAll || 1;
  const balance = { low: +(eL / tot).toFixed(3), mid: +(eM / tot).toFixed(3), high: +(eH / tot).toFixed(3) };

  // loudness over time, one point per second
  const curve = [];
  for (let i = 0; i + 10 <= blocks.length; i += 10) curve.push({ t: Math.round((i * hop) / rate), lufs: round1(lufs(mean(blocks.slice(i, i + 10)))) });

  const peakDb = db(peak), gainToTarget = Number.isFinite(integrated) ? target - integrated : 0;
  const advice = [];
  if (!Number.isFinite(integrated)) advice.push('The soundtrack is silent.');
  else {
    if (integrated < target - 3) advice.push(`Quiet: ${round1(integrated)} LUFS. YouTube plays at about ${target} LUFS and does not turn quiet videos up: raise the master volume by about ${round1(gainToTarget)} dB.`);
    else if (integrated > target + 2) advice.push(`Loud: ${round1(integrated)} LUFS. YouTube will turn it down by about ${round1(-gainToTarget)} dB; lowering the master volume keeps more punch.`);
    else advice.push(`Good level: ${round1(integrated)} LUFS (YouTube plays at about ${target}).`);
    if (clipped > n * channels.length * 0.0005) advice.push(`Clipping: ${clipped} samples at full scale. Lower the master volume or the drive.`);
    if (silentShare > 0.25) advice.push(`${Math.round(silentShare * 100)} % of the video is silent (${silences.length} stretch${silences.length > 1 ? 'es' : ''}).`);
    if (silences.length && silences[0].start < 0.05 && silences[0].end > 1.5) advice.push(`Nothing sounds for the first ${silences[0].end.toFixed(1)} s: Shorts viewers decide in the first second.`);
    if (balance.low > 0.75) advice.push('Bass-heavy: most of the energy is under 200 Hz, phone speakers will play very little of it. Lift the EQ high / mid or use a brighter instrument.');
    if (balance.high > 0.45) advice.push('Bright and thin: a lot of energy over 4 kHz. Lower the EQ high or the filter cutoff.');
    if (range > 15) advice.push(`Wide loudness range (${round1(range)} LU): the quiet parts may vanish on a phone.`);
  }
  return { seconds: +seconds.toFixed(2), lufs: round1(integrated), peakDb: round1(peakDb), rmsDb: round1(rmsDb), clipped, range: round1(range), silences, silentShare: +silentShare.toFixed(3), balance, curve, advice, gainToTarget: round1(gainToTarget) };
}

/**
 * Mastering in one click: a set of master-chain settings (audio.*) for a mood. Applying one only
 * touches these fields; `clean` puts them back to neutral.
 */
export const MASTERING = {
  clean: { label: 'Clean (neutral)', set: { eq: { low: 0, mid: 0, high: 0 }, distortion: 0, crush: 0, 'filter.type': 'lowpass', 'filter.cutoff': 9000, 'filter.q': 0.8, 'reverb.mix': 0.25, 'reverb.decay': 2.6, 'reverb.tone': 1, 'delay.mix': 0.15, 'mod.type': 'off' } },
  warm: { label: 'Warm (soft highs, full lows)', set: { eq: { low: 3, mid: -1, high: -3 }, distortion: 0.08, crush: 0, 'filter.type': 'lowpass', 'filter.cutoff': 6500, 'filter.q': 0.7, 'reverb.mix': 0.28, 'reverb.decay': 2.8, 'reverb.tone': 0.4, 'delay.mix': 0.12 } },
  cinematic: { label: 'Cinematic (wide hall, deep)', set: { eq: { low: 4, mid: -2, high: 1.5 }, distortion: 0.04, crush: 0, 'filter.type': 'lowpass', 'filter.cutoff': 12000, 'filter.q': 0.7, 'reverb.mix': 0.45, 'reverb.decay': 6, 'reverb.tone': 0.55, 'delay.mix': 0.22, 'delay.time': 0.42, 'delay.feedback': 0.4 } },
  lofi: { label: 'Lo-fi (dusty, narrow)', set: { eq: { low: 2, mid: 1, high: -8 }, distortion: 0.18, crush: 0.35, 'filter.type': 'lowpass', 'filter.cutoff': 3400, 'filter.q': 1.1, 'reverb.mix': 0.18, 'reverb.decay': 1.6, 'reverb.tone': 0.2, 'delay.mix': 0.1, 'mod.type': 'chorus', 'mod.rate': 0.4, 'mod.depth': 0.5, 'mod.mix': 0.35 } },
  bright: { label: 'Bright (clear on a phone)', set: { eq: { low: -3, mid: 1.5, high: 4 }, distortion: 0, crush: 0, 'filter.type': 'lowpass', 'filter.cutoff': 14000, 'filter.q': 0.7, 'reverb.mix': 0.2, 'reverb.decay': 2, 'reverb.tone': 1, 'delay.mix': 0.1 } },
  club: { label: 'Club (punchy, pumping)', set: { eq: { low: 5, mid: -2, high: 2.5 }, distortion: 0.12, crush: 0, 'filter.type': 'lowpass', 'filter.cutoff': 13000, 'filter.q': 0.9, 'reverb.mix': 0.14, 'reverb.decay': 1.4, 'reverb.tone': 0.8, 'delay.mix': 0.16, 'pump.amount': 0.45, 'pump.rate': 1 } },
  dream: { label: 'Dream (washed, floating)', set: { eq: { low: 0, mid: -3, high: 2 }, distortion: 0, crush: 0, 'filter.type': 'lowpass', 'filter.cutoff': 8000, 'filter.q': 0.7, 'reverb.mix': 0.6, 'reverb.decay': 8, 'reverb.tone': 0.7, 'delay.mix': 0.3, 'delay.time': 0.5, 'delay.feedback': 0.5, 'mod.type': 'chorus', 'mod.rate': 0.3, 'mod.depth': 0.6, 'mod.mix': 0.4 } },
};

/** Write a mastering preset into an audio settings object (state.audio). */
export function applyMastering(audio, id) {
  const m = MASTERING[id];
  if (!m) return false;
  for (const [path, v] of Object.entries(m.set)) {
    const keys = path.split('.'), last = keys.pop();
    const target = keys.reduce((o, k) => (o[k] ||= {}), audio);
    target[last] = v && typeof v === 'object' ? { ...v } : v;
  }
  return true;
}
