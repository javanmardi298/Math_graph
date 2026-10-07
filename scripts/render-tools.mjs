// Locates the optional external tools: ffmpeg (converts VP9 exports to H.264) and
// Playwright (command-line batch rendering). Neither is needed to use the app.
//
// ffmpeg detection runs again on every call until it succeeds, so installing it
// while `npm start` is running works without restarting the server.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);

/** Places ffmpeg is commonly installed but which may be missing from PATH. */
function ffmpegCandidates() {
  const list = [process.env.FFMPEG_PATH, 'ffmpeg'];
  try { list.push(require('ffmpeg-static')); } catch { /* optional package */ }
  if (process.platform === 'win32') {
    const { LOCALAPPDATA = '', ProgramFiles = 'C:\\Program Files', USERPROFILE = '' } = process.env;
    list.push(
      'C:\\ffmpeg\\bin\\ffmpeg.exe',
      join(ProgramFiles, 'ffmpeg', 'bin', 'ffmpeg.exe'),
      join(USERPROFILE, 'scoop', 'shims', 'ffmpeg.exe'),
      'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe',
      join(LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe'),
    );
  } else {
    list.push('/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg', '/snap/bin/ffmpeg');
  }
  return [...new Set(list.filter(Boolean))];
}

let ffmpegFound = null;

/** Path of a working ffmpeg, or null. */
export function findFfmpeg() {
  if (ffmpegFound) return ffmpegFound;
  for (const c of ffmpegCandidates()) {
    if (c !== 'ffmpeg' && !existsSync(c)) continue;
    const r = spawnSync(c, ['-version'], { encoding: 'utf8', windowsHide: true });
    if (!r.error && r.status === 0) {
      ffmpegFound = { path: c, version: r.stdout.split('\n')[0] };
      return ffmpegFound;
    }
  }
  return null;
}

export const ffmpegPath = () => findFfmpeg()?.path || 'ffmpeg';

/** Import Playwright from the project, or from PLAYWRIGHT_MODULE if set. */
export async function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_MODULE, 'playwright', 'playwright-core'].filter(Boolean);
  for (const c of candidates) {
    try {
      const mod = await import(c.startsWith('/') || /^[A-Z]:\\/i.test(c) ? `file://${c}` : c);
      return mod.chromium ? mod : mod.default;
    } catch { /* try the next one */ }
  }
  return null;
}
