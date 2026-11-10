/**
 * Live numbers of a curve, for the video ("area = 0.319"): the area so far, the value, the slope,
 * the length. `u` is how far the layer has been drawn (0 … 1).
 *
 *   area    ∫ y dx along the curve; for a layer filled from the origin, the swept area ½∫(x dy − y dx)
 *   value   y at the pen        x   x at the pen
 *   slope   dy/dx at the pen    length   the length of the curve so far
 */
const N = 800;
const tables = new WeakMap(); // compiled layer → { key, area, swept, length }

function table(compiled, ctx) {
  const P = ctx.params;
  const key = `${P.a}|${P.b}|${P.c}|${P.d}|${compiled.usesTime ? ctx.t : ''}|${ctx.view.xMin}|${ctx.view.xMax}`;
  let t = tables.get(compiled);
  if (t && t.key === key) return t;
  const area = new Float64Array(N + 1), swept = new Float64Array(N + 1), length = new Float64Array(N + 1);
  const p = { x: 0, y: 0, z: 0 };
  compiled.at(0, ctx, p);
  let px = p.x, py = p.y;
  for (let i = 1; i <= N; i++) {
    compiled.at(i / N, ctx, p);
    const ok = Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(px) && Number.isFinite(py);
    const dx = ok ? p.x - px : 0, dy = ok ? p.y - py : 0;
    area[i] = area[i - 1] + (ok ? ((p.y + py) / 2) * dx : 0);
    swept[i] = swept[i - 1] + (ok ? (px * p.y - p.x * py) / 2 : 0);
    length[i] = length[i - 1] + Math.hypot(dx, dy);
    px = p.x; py = p.y;
  }
  t = { key, area, swept, length };
  tables.set(compiled, t);
  return t;
}

const lerpAt = (arr, u) => { const k = Math.min(Math.max(u, 0), 1) * N, i = Math.min(N - 1, Math.floor(k)); return arr[i] + (arr[i + 1] - arr[i]) * (k - i); };

export const READOUT_LABELS = { area: 'area', value: 'y', x: 'x', slope: 'slope', length: 'length' };

/** The number a layer shows at progress u (NaN when it has none). */
export function readoutOf(layer, compiled, ctx, u) {
  const kind = layer.readout;
  if (!kind || kind === 'none' || !compiled?.ok) return NaN;
  const p = { x: 0, y: 0, z: 0 };
  switch (kind) {
    case 'area': return lerpAt(layer.fill === 'origin' ? table(compiled, ctx).swept : table(compiled, ctx).area, u);
    case 'length': return lerpAt(table(compiled, ctx).length, u);
    case 'value': return compiled.at(u, ctx, p).y;
    case 'x': return compiled.at(u, ctx, p).x;
    case 'slope': {
      const h = 1e-4, a = compiled.at(Math.max(0, u - h), ctx, { x: 0, y: 0, z: 0 }), b = compiled.at(Math.min(1, u + h), ctx, p);
      return (b.y - a.y) / (b.x - a.x || 1e-12);
    }
    default: return NaN;
  }
}
