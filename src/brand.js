/**
 * Channel branding, the same on every video whatever the preset: a small watermark and
 * an end card ("Follow for more…") over the last seconds. Kept in this browser (not in
 * presets), so loading or sharing presets never changes it.
 */
const KEY = 'mmv.brand.v1';
export const BRAND_DEFAULTS = { enabled: false, watermark: '', endCard: 'Follow for more math sounds 🔔', endSub: '', endSeconds: 2.5 };

let brand = { ...BRAND_DEFAULTS };
try { brand = { ...BRAND_DEFAULTS, ...JSON.parse(globalThis.localStorage?.getItem(KEY) || '{}') }; } catch { /* private mode */ }

export const getBrand = () => brand;
export function setBrand(patch) {
  brand = { ...brand, ...patch };
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(brand)); } catch { /* storage full or blocked */ }
  return brand;
}

/** Opacity of the end card at timeline time t of a video lasting `duration`. */
export function endCardAlpha(b, t, duration) {
  if (!b.enabled || !b.endCard?.trim() || !(b.endSeconds > 0)) return 0;
  const start = duration - b.endSeconds;
  if (t < start) return 0;
  return Math.min(1, (t - start) / 0.35);
}
