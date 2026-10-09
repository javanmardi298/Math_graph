// Streams files from disk into a .zip without loading them into memory (stored, no
// compression: videos don't compress). Switches to ZIP64 records when the archive or
// an entry passes 4 GB, so batches of hundreds of 1080p videos still open everywhere.
import { open, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import zlib from 'node:zlib';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

async function crcOfFile(path) {
  if (typeof zlib.crc32 === 'function') { // Node 22.2+: native, much faster
    let v = 0;
    for await (const chunk of createReadStream(path, { highWaterMark: 1 << 20 })) v = zlib.crc32(chunk, v);
    return v >>> 0;
  }
  let c = 0xffffffff;
  for await (const chunk of createReadStream(path, { highWaterMark: 1 << 20 })) {
    for (let i = 0; i < chunk.length; i++) c = CRC_TABLE[(c ^ chunk[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const MAX32 = 0xffffffff;

function dosDateTime(d = new Date()) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

/**
 * @param {{name:string, path:string}[]} files  `name` is the path inside the zip (UTF-8)
 * @param {string} out  destination .zip
 * @param {{zip64At?:number}} [opts] size/offset from which ZIP64 records are used (tests lower it)
 * @returns {Promise<number>} size of the zip in bytes
 */
export async function writeZip(files, out, { zip64At = MAX32 } = {}) {
  const fh = await open(out, 'w');
  let offset = 0;
  const write = async (buf) => { await fh.write(buf, 0, buf.length, offset); offset += buf.length; };
  const { time, date } = dosDateTime();
  const central = [];
  try {
    for (const f of files) {
      const name = Buffer.from(f.name, 'utf8');
      const { size } = await stat(f.path);
      const crc = await crcOfFile(f.path);
      const start = offset;
      const big = size >= zip64At;
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(big ? 45 : 20, 4);
      local.writeUInt16LE(0x0800, 6); // UTF-8 names
      local.writeUInt16LE(0, 8); // stored
      local.writeUInt16LE(time, 10);
      local.writeUInt16LE(date, 12);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(big ? MAX32 : size, 18);
      local.writeUInt32LE(big ? MAX32 : size, 22);
      local.writeUInt16LE(name.length, 26);
      const extra = big ? Buffer.alloc(20) : Buffer.alloc(0);
      if (big) { extra.writeUInt16LE(1, 0); extra.writeUInt16LE(16, 2); extra.writeBigUInt64LE(BigInt(size), 4); extra.writeBigUInt64LE(BigInt(size), 12); }
      local.writeUInt16LE(extra.length, 28);
      await write(local); await write(name); await write(extra);
      for await (const chunk of createReadStream(f.path, { highWaterMark: 1 << 20 })) await write(chunk);
      central.push({ name, size, crc, start });
    }
    const cdStart = offset;
    for (const e of central) {
      const needSize = e.size >= zip64At, needOff = e.start >= zip64At;
      const z = [];
      if (needSize) z.push(BigInt(e.size), BigInt(e.size));
      if (needOff) z.push(BigInt(e.start));
      const extra = Buffer.alloc(z.length ? 4 + z.length * 8 : 0);
      if (z.length) { extra.writeUInt16LE(1, 0); extra.writeUInt16LE(z.length * 8, 2); z.forEach((v, i) => extra.writeBigUInt64LE(v, 4 + i * 8)); }
      const c = Buffer.alloc(46);
      c.writeUInt32LE(0x02014b50, 0);
      c.writeUInt16LE(45, 4);
      c.writeUInt16LE(z.length ? 45 : 20, 6);
      c.writeUInt16LE(0x0800, 8);
      c.writeUInt16LE(0, 10);
      c.writeUInt16LE(time, 12);
      c.writeUInt16LE(date, 14);
      c.writeUInt32LE(e.crc, 16);
      c.writeUInt32LE(needSize ? MAX32 : e.size, 20);
      c.writeUInt32LE(needSize ? MAX32 : e.size, 24);
      c.writeUInt16LE(e.name.length, 28);
      c.writeUInt16LE(extra.length, 30);
      c.writeUInt32LE(needOff ? MAX32 : e.start, 42);
      await write(c); await write(e.name); await write(extra);
    }
    const cdSize = offset - cdStart;
    const zip64 = central.length >= 0xffff || cdStart >= zip64At || cdSize >= zip64At || offset >= zip64At;
    if (zip64) {
      const recStart = offset;
      const rec = Buffer.alloc(56);
      rec.writeUInt32LE(0x06064b50, 0);
      rec.writeBigUInt64LE(44n, 4);
      rec.writeUInt16LE(45, 12);
      rec.writeUInt16LE(45, 14);
      rec.writeBigUInt64LE(BigInt(central.length), 24);
      rec.writeBigUInt64LE(BigInt(central.length), 32);
      rec.writeBigUInt64LE(BigInt(cdSize), 40);
      rec.writeBigUInt64LE(BigInt(cdStart), 48);
      const loc = Buffer.alloc(20);
      loc.writeUInt32LE(0x07064b50, 0);
      loc.writeBigUInt64LE(BigInt(recStart), 8);
      loc.writeUInt32LE(1, 16);
      await write(rec); await write(loc);
    }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(Math.min(central.length, 0xffff), 8);
    end.writeUInt16LE(Math.min(central.length, 0xffff), 10);
    end.writeUInt32LE(Math.min(cdSize, MAX32), 12);
    end.writeUInt32LE(zip64 ? MAX32 : cdStart, 16);
    await write(end);
    return offset;
  } finally {
    await fh.close();
  }
}
