/**
 * Chrome's MediaRecorder writes WebM files without a duration (it streams them and
 * never goes back to fill it in), so players show no length and seeking jumps
 * around. This adds the Duration to the file's Segment Info, the same fix the
 * "fix-webm-duration" library applies. Only the first few KB are rewritten.
 */

const ID = { EBML: 0x1a45dfa3, Segment: 0x18538067, SeekHead: 0x114d9b74, Seek: 0x4dbb, SeekPosition: 0x53ac, Info: 0x1549a966, TimecodeScale: 0x2ad7b1, Duration: 0x4489 };
const HEAD = 256 * 1024;

function readVint(b, p, keepMarker) {
  const first = b[p];
  if (!first) return null;
  const len = Math.clz32(first) - 23; // 1..8
  let v = keepMarker ? first : first & (0xff >> len);
  let allOnes = (first & (0xff >> len)) === (0xff >> len);
  for (let i = 1; i < len; i++) { v = v * 256 + b[p + i]; if (b[p + i] !== 0xff) allOnes = false; }
  return { value: v, len, unknown: !keepMarker && allOnes };
}

function readElement(b, p) {
  const id = readVint(b, p, true);
  if (!id) return null;
  const size = readVint(b, p + id.len, false);
  if (!size) return null;
  return { id: id.value, start: p, dataStart: p + id.len + size.len, size: size.value, unknown: size.unknown, sizePos: p + id.len, sizeLen: size.len };
}

const idBytes = (id) => { const out = []; for (let v = id; v > 0; v = Math.floor(v / 256)) out.unshift(v & 0xff); return out; };
const size8 = (n) => { const out = [0x01]; for (let i = 6; i >= 0; i--) out.push(Math.floor(n / 2 ** (8 * i)) & 0xff); return out; };
const uintOf = (b, p, n) => { let v = 0; for (let i = 0; i < n; i++) v = v * 256 + b[p + i]; return v; };

/**
 * @param {Blob} blob a WebM recording
 * @param {number} seconds its length
 * @returns {Promise<Blob>} the same recording with a duration (or the input, if it isn't a WebM it understands)
 */
export async function fixWebmDuration(blob, seconds) {
  try {
    const head = new Uint8Array(await blob.slice(0, HEAD).arrayBuffer());
    const ebml = readElement(head, 0);
    if (!ebml || ebml.id !== ID.EBML) return blob;
    const seg = readElement(head, ebml.dataStart + ebml.size);
    if (!seg || seg.id !== ID.Segment) return blob;
    let p = seg.dataStart, info = null, seekHead = null;
    while (p < head.length - 12) {
      const el = readElement(head, p);
      if (!el || el.unknown) break;
      if (el.id === ID.Info) { info = el; break; }
      if (el.id === ID.SeekHead) seekHead = el;
      p = el.dataStart + el.size;
    }
    if (!info || info.dataStart + info.size > head.length) return blob;

    // Info's children, without any existing Duration
    let scale = 1e6;
    const kept = [];
    for (let q = info.dataStart; q < info.dataStart + info.size;) {
      const el = readElement(head, q);
      if (!el) return blob;
      const end = el.dataStart + el.size;
      if (el.id === ID.TimecodeScale) scale = uintOf(head, el.dataStart, el.size) || 1e6;
      if (el.id !== ID.Duration) kept.push(head.subarray(q, end));
      q = end;
    }
    const dur = new Uint8Array(11);
    dur.set([0x44, 0x89, 0x88]);
    new DataView(dur.buffer).setFloat64(3, (seconds * 1e9) / scale);
    const body = [...kept, dur];
    const bodyLen = body.reduce((n, x) => n + x.length, 0);
    const infoHead = [...idBytes(ID.Info), ...size8(bodyLen)];
    const newInfo = new Uint8Array(infoHead.length + bodyLen);
    newInfo.set(infoHead);
    let o = infoHead.length;
    for (const x of body) { newInfo.set(x, o); o += x.length; }
    const infoEnd = info.dataStart + info.size;
    const delta = newInfo.length - (infoEnd - info.start);

    const before = head.slice(0, info.start);
    // Seek entries point at elements relative to the Segment's data: shift those after Info.
    if (seekHead) {
      const infoRel = info.start - seg.dataStart;
      for (let q = seekHead.dataStart; q < seekHead.dataStart + seekHead.size;) {
        const seek = readElement(before, q);
        if (!seek) break;
        for (let r = seek.dataStart; r < seek.dataStart + seek.size;) {
          const el = readElement(before, r);
          if (!el) break;
          if (el.id === ID.SeekPosition) {
            const pos = uintOf(before, el.dataStart, el.size);
            const moved = pos + delta;
            if (pos > infoRel && moved < 2 ** (8 * el.size)) {
              for (let i = el.size - 1, v = moved; i >= 0; i--, v = Math.floor(v / 256)) before[el.dataStart + i] = v & 0xff;
            }
          }
          r = el.dataStart + el.size;
        }
        q = seek.dataStart + seek.size;
      }
    }
    // A Segment with a known size grows by delta (rewritten in the same number of bytes).
    if (!seg.unknown) {
      const grown = seg.size + delta;
      if (grown >= 2 ** (7 * seg.sizeLen) - 1) return blob;
      for (let i = seg.sizeLen - 1, v = grown; i >= 1; i--, v = Math.floor(v / 256)) before[seg.sizePos + i] = v & 0xff;
      before[seg.sizePos] = (0x80 >> (seg.sizeLen - 1)) | (Math.floor(grown / 2 ** (8 * (seg.sizeLen - 1))) & (0xff >> seg.sizeLen));
    }
    return new Blob([before, newInfo, blob.slice(infoEnd)], { type: blob.type });
  } catch {
    return blob;
  }
}
