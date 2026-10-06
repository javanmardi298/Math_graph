/**
 * Minimal Standard MIDI File (format 1) writer — no dependencies.
 * Each formula layer becomes its own track so it can be edited separately in a DAW.
 */

const PPQ = 480; // ticks per quarter note

function varLen(n) {
  const bytes = [n & 0x7f];
  while ((n >>= 7)) bytes.unshift((n & 0x7f) | 0x80);
  return bytes;
}
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = (n) => [(n >>> 8) & 255, n & 255];
const ascii = (s) => [...s].map((c) => c.charCodeAt(0) & 0x7f);

function chunk(id, data) {
  return [...ascii(id), ...u32(data.length), ...data];
}

/**
 * @param {{ name:string, channel:number, program:number, notes:{start:number,dur:number,midi:number,vel:number}[] }[]} tracks
 *        note start/dur are in seconds
 * @param {number} bpm
 * @returns {Uint8Array}
 */
export function writeMidi(tracks, bpm = 120) {
  const secToTick = (s) => Math.round((s * bpm * PPQ) / 60);
  const usPerQuarter = Math.round(60_000_000 / bpm);

  const tempoTrack = [
    0, 0xff, 0x51, 3, (usPerQuarter >> 16) & 255, (usPerQuarter >> 8) & 255, usPerQuarter & 255,
    0, 0xff, 0x58, 4, 4, 2, 24, 8, // 4/4
    0, 0xff, 0x2f, 0,
  ];
  const chunks = [chunk('MTrk', tempoTrack)];

  for (const tr of tracks) {
    const ch = tr.channel & 0x0f;
    const events = [];
    for (const n of tr.notes) {
      const midi = Math.max(0, Math.min(127, Math.round(n.midi)));
      const vel = Math.max(1, Math.min(127, Math.round(n.vel)));
      const on = secToTick(n.start);
      const off = Math.max(on + 1, secToTick(n.start + n.dur));
      events.push({ tick: on, order: 1, bytes: [0x90 | ch, midi, vel] });
      events.push({ tick: off, order: 0, bytes: [0x80 | ch, midi, 0] });
    }
    events.sort((a, b) => a.tick - b.tick || a.order - b.order);
    const name = ascii(tr.name || 'Layer');
    const data = [0, 0xff, 0x03, ...varLen(name.length), ...name, 0, 0xc0 | ch, tr.program & 0x7f];
    let last = 0;
    for (const e of events) {
      data.push(...varLen(e.tick - last), ...e.bytes);
      last = e.tick;
    }
    data.push(0, 0xff, 0x2f, 0);
    chunks.push(chunk('MTrk', data));
  }

  const header = chunk('MThd', [...u16(1), ...u16(chunks.length), ...u16(PPQ)]);
  return new Uint8Array([...header, ...chunks.flat()]);
}

/**
 * Turn a sampled pitch stream into discrete notes: consecutive samples that round to
 * the same MIDI note are merged; silent (null) samples end the current note.
 * @param {{time:number, midi:number|null, vel:number}[]} samples evenly spaced
 * @param {number} step seconds between samples
 * @param {number} minDur drop notes shorter than this (seconds)
 */
export function samplesToNotes(samples, step, minDur = 0.03) {
  const notes = [];
  let cur = null;
  for (const s of samples) {
    const m = s.midi == null ? null : Math.round(s.midi);
    if (cur && m === cur.midi) { cur.dur += step; continue; }
    if (cur && cur.dur >= minDur) notes.push(cur);
    cur = m == null ? null : { start: s.time, dur: step, midi: m, vel: s.vel };
  }
  if (cur && cur.dur >= minDur) notes.push(cur);
  return notes;
}
