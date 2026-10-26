/**
 * Hide the preset inside an exported file, and find it again.
 *
 * The preset (a few KB to a few hundred KB of JSON, deflate-compressed) is appended to the
 * file in a form each format ignores, so the file still plays everywhere:
 *   WAV   an extra RIFF chunk "mmvP" after the audio
 *   PNG   a private ancillary chunk "mmVp" before IEND
 *   MP4   a top-level `uuid` box at the end
 *   WebM  an EBML Void element at the end
 * Whatever the wrapper, the payload starts with the same marker, so reading is one scan of the
 * file's tail and never depends on the container (and works on files other tools re-wrapped).
 *
 * Re-encoding (an MP3 or AAC copy, a platform's own transcode, a screen recording) drops it:
 * then the audio analysis (src/analysis) is the way back to a preset.
 */

const MARK = [0x4d, 0x4d, 0x56, 0x50, 0x52, 0x45, 0x53, 0x45, 0x54, 0x01]; // "MMVPRESET\x01"
const MAX_TAIL = 24 * 1048576; // how much of the end of a file is searched
const UUID = [0x4d, 0x4d, 0x56, 0x2d, 0x50, 0x52, 0x45, 0x53, 0x45, 0x54, 0x2d, 0x76, 0x31, 0x00, 0x00, 0x01];

const enc = new TextEncoder(), dec = new TextDecoder();

async function pipe(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** marker + length + flag + data. flag 1 = deflate-raw, 0 = stored (no CompressionStream). */
async function pack(text) {
  const raw = enc.encode(text);
  let flag = 0, body = raw;
  if (typeof CompressionStream !== 'undefined') { body = await pipe(raw, new CompressionStream('deflate-raw')); flag = 1; }
  const out = new Uint8Array(MARK.length + 5 + body.length);
  out.set(MARK, 0);
  new DataView(out.buffer).setUint32(MARK.length, body.length);
  out[MARK.length + 4] = flag;
  out.set(body, MARK.length + 5);
  return out;
}

const u32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const ascii = (s) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)));
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

let crcTable;
function crc32(bytes) {
  if (!crcTable) crcTable = Uint32Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** The file type from its first bytes: 'wav' | 'png' | 'mp4' | 'webm' | null. */
export function sniff(b) {
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x41) return 'wav';
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length > 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'mp4';
  if (b.length > 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'webm';
  return null;
}

/** The bytes to append for a file type (PNG: they go before the closing IEND instead). */
function wrapper(kind, payload) {
  if (kind === 'wav') {
    const n = payload.length;
    return concat(ascii('mmvP'), new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]), payload, new Uint8Array(n & 1));
  }
  if (kind === 'png') {
    const type = ascii('mmVp');
    return concat(u32(payload.length), type, payload, u32(crc32(concat(type, payload))));
  }
  if (kind === 'mp4') return concat(u32(8 + 16 + payload.length), ascii('uuid'), Uint8Array.from(UUID), payload);
  // webm: EBML Void (id EC) with an 8-byte size
  const size = new Uint8Array(8);
  size[0] = 0x01;
  for (let i = 0; i < 7; i++) size[7 - i] = Math.floor(payload.length / 2 ** (8 * i)) & 255;
  return concat(Uint8Array.of(0xec), size, payload);
}

/**
 * Add the preset to a file. Unknown formats come back unchanged.
 * @param {Uint8Array} bytes the finished file
 * @param {string} json preset text
 * @returns {Promise<Uint8Array>}
 */
export async function embedPreset(bytes, json) {
  const kind = sniff(bytes);
  if (!kind) return bytes;
  const extra = wrapper(kind, await pack(json));
  if (kind === 'png') return concat(bytes.subarray(0, bytes.length - 12), extra, bytes.subarray(bytes.length - 12));
  const out = concat(bytes, extra);
  if (kind === 'wav') new DataView(out.buffer).setUint32(4, out.length - 8, true); // RIFF size
  return out;
}

function lastIndexOfMark(b) {
  outer: for (let i = b.length - MARK.length; i >= 0; i--) {
    for (let k = 0; k < MARK.length; k++) if (b[i + k] !== MARK[k]) continue outer;
    return i;
  }
  return -1;
}

/**
 * The preset text hidden in a file, or null.
 * @param {Uint8Array} bytes the whole file or its tail
 */
export async function extractPreset(bytes) {
  const at = lastIndexOfMark(bytes);
  if (at < 0 || at + MARK.length + 5 > bytes.length) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const len = view.getUint32(at + MARK.length);
  const flag = bytes[at + MARK.length + 4];
  const start = at + MARK.length + 5;
  if (start + len > bytes.length) return null;
  let body = bytes.subarray(start, start + len);
  try {
    if (flag === 1) body = await pipe(body, new DecompressionStream('deflate-raw'));
    return dec.decode(body);
  } catch {
    return null;
  }
}

/** Same, for a File / Blob: reads only the end of big files. */
export async function extractPresetFromFile(file) {
  const tail = file.size > MAX_TAIL ? file.slice(file.size - MAX_TAIL) : file;
  return extractPreset(new Uint8Array(await tail.arrayBuffer()));
}

/** Blob in, Blob out (same type), without copying a big video; a file this cannot recognise is returned unchanged. */
export async function embedInBlob(blob, json) {
  const kind = sniff(new Uint8Array(await blob.slice(0, 16).arrayBuffer()));
  if (!kind) return blob;
  const extra = wrapper(kind, await pack(json));
  if (kind === 'png') return new Blob([blob.slice(0, blob.size - 12), extra, blob.slice(blob.size - 12)], { type: blob.type });
  if (kind === 'wav') {
    const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    new DataView(head.buffer).setUint32(4, blob.size + extra.length - 8, true);
    return new Blob([head, blob.slice(12), extra], { type: blob.type });
  }
  return new Blob([blob, extra], { type: blob.type });
}
