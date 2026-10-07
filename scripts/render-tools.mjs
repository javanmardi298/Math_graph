// Locates the two external tools the studio render needs: Playwright (a headless
// Chromium to draw frames) and ffmpeg (to encode them). Both are optional for the app.
import { spawnSync } from 'node:child_process';

export const ffmpegPath = () => process.env.FFMPEG_PATH || 'ffmpeg';

/** Import Playwright from the project, or from PLAYWRIGHT_MODULE if set. */
export async function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_MODULE, 'playwright', 'playwright-core'].filter(Boolean);
  for (const c of candidates) {
    try {
      const mod = await import(c.startsWith('/') ? `file://${c}` : c);
      return mod.chromium ? mod : mod.default;
    } catch { /* try the next one */ }
  }
  return null;
}

let cached = null;
export async function checkRenderTools() {
  if (cached) return cached;
  const ff = spawnSync(ffmpegPath(), ['-version'], { encoding: 'utf8' });
  if (ff.error || ff.status !== 0) {
    return (cached = { available: false, reason: 'ffmpeg was not found. Install it (https://ffmpeg.org) or set FFMPEG_PATH.' });
  }
  if (!(await loadPlaywright())) {
    return (cached = { available: false, reason: 'Playwright is missing. Run: npm install && npx playwright install chromium' });
  }
  return (cached = { available: true, reason: '', ffmpeg: ff.stdout.split('\n')[0] });
}
