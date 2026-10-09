import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { writeZip } from '../scripts/zip-writer.mjs';
import { readZip } from '../src/export/zip.js';
import { readFile } from 'node:fs/promises';

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'mmv-zip-'));
  const files = [
    { name: 'batch/01 Video.mp4', data: Buffer.alloc(3000, 7) },
    { name: 'batch/02 ویدیو.txt', data: Buffer.from('TITLE\nسلام 🎵\n') },
    { name: 'batch/list.csv', data: Buffer.from('"a","b"\r\n') },
  ];
  for (const [i, f] of files.entries()) { f.path = join(dir, `f${i}`); await writeFile(f.path, f.data); }
  return { dir, files };
}

const python = (() => { try { execFileSync('python3', ['-c', 'import zipfile']); return true; } catch { return false; } })();

for (const [label, opts] of [['normal', {}], ['ZIP64 records', { zip64At: 1000 }]]) {
  test(`writes a valid zip (${label})`, async () => {
    const { dir, files } = await fixture();
    try {
      const out = join(dir, 'out.zip');
      const size = await writeZip(files, out, opts);
      const bytes = await readFile(out);
      assert.equal(size, bytes.length);
      if (!opts.zip64At) {
        const back = await readZip(bytes);
        assert.deepEqual(back.map((e) => e.name), files.map((f) => f.name));
        back.forEach((e, i) => assert.deepEqual(Buffer.from(e.data), files[i].data));
      }
      if (python) {
        // An independent reader that checks CRCs and understands ZIP64.
        const report = execFileSync('python3', ['-c', `import zipfile,sys,json
z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None
print(json.dumps([[i.filename,i.file_size] for i in z.infolist()]))`, out], { encoding: 'utf8' });
        assert.deepEqual(JSON.parse(report), files.map((f) => [f.name, f.data.length]));
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
}
