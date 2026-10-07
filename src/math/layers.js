/**
 * Compiles a layer's formulas and samples them.
 *
 * Every layer type is reduced to the same thing: a curve P(u) for u ∈ [0, 1],
 * where u is the timeline progress. Points use "musical" coordinates:
 *   x = horizontal, y = vertical (→ pitch), z = depth (→ volume or pan in 3D).
 */
import { tryCompile } from './parser.js';
import { GLOBAL_VARS, LAYER_TYPES } from '../state.js';

export class CompiledLayer {
  constructor(layer) {
    this.layer = layer;
    this.errors = {};
    this.fns = {};
    this.usesTime = false;
    this.usesParams = false;
    const own = LAYER_TYPES[layer.type].vars;
    const vars = [...own, ...GLOBAL_VARS];
    for (const [key] of LAYER_TYPES[layer.type].fields) {
      // The surface path formula may only depend on x (it chooses y), not on y itself.
      const allowed = key === 'path' ? ['x', ...GLOBAL_VARS] : vars;
      const c = tryCompile(layer.exprs[key], allowed);
      this.fns[key] = c.fn;
      if (!c.ok) this.errors[key] = c.error;
      if (c.deps.has('t')) this.usesTime = true;
      if (['a', 'b', 'c', 'd'].some((v) => c.deps.has(v))) this.usesParams = true;
    }
    this.ok = Object.keys(this.errors).length === 0;
    this.scope = { x: 0, y: 0, s: 0, theta: 0, t: 0, a: 1, b: 1, c: 1, d: 1 };
  }

  /** The independent variable's range for this layer. */
  domain(view) {
    const { type, range } = this.layer;
    if (type === 'function' || type === 'surface') return [view.xMin, view.xMax];
    return [range.min, range.max];
  }

  /**
   * Evaluate the curve at progress u ∈ [0,1].
   * @param {number} u
   * @param {{t:number, params:object, view:object}} ctx
   * @param {{x:number,y:number,z:number}} out reused output object
   */
  at(u, ctx, out = { x: 0, y: 0, z: 0 }) {
    const s = this.scope;
    s.t = ctx.t;
    s.a = ctx.params.a; s.b = ctx.params.b; s.c = ctx.params.c; s.d = ctx.params.d;
    const [lo, hi] = this.domain(ctx.view);
    const v = lo + (hi - lo) * u;
    const f = this.fns;
    switch (this.layer.type) {
      case 'function':
        s.x = v;
        out.x = v; out.y = f.y(s); out.z = f.z(s);
        break;
      case 'parametric':
        s.s = v;
        out.x = f.x(s); out.y = f.y(s); out.z = f.z(s);
        break;
      case 'polar': {
        s.theta = v;
        const r = f.r(s);
        out.x = r * Math.cos(v); out.y = r * Math.sin(v); out.z = f.z(s);
        break;
      }
      case 'surface':
        s.x = v;
        s.y = f.path(s);
        out.x = v; out.z = s.y; out.y = f.f(s);
        break;
    }
    return out;
  }

  /** Height of a surface layer at (x, y). */
  height(x, y, ctx) {
    const s = this.scope;
    s.t = ctx.t; s.x = x; s.y = y;
    s.a = ctx.params.a; s.b = ctx.params.b; s.c = ctx.params.c; s.d = ctx.params.d;
    return this.fns.f(s);
  }

  /**
   * Sample N+1 points along the whole curve into a flat Float32Array [x,y,z,...].
   * Non-finite values (e.g. tan asymptotes) repeat the previous good point, and
   * values are clamped to keep the GPU happy.
   */
  sample(ctx, n = this.layer.samples) {
    const pts = new Float32Array((n + 1) * 3);
    const p = { x: 0, y: 0, z: 0 };
    const lim = 1e4;
    let px = 0, py = 0, pz = 0;
    for (let i = 0; i <= n; i++) {
      this.at(i / n, ctx, p);
      const x = Number.isFinite(p.x) ? Math.max(-lim, Math.min(lim, p.x)) : px;
      const y = Number.isFinite(p.y) ? Math.max(-lim, Math.min(lim, p.y)) : py;
      const z = Number.isFinite(p.z) ? Math.max(-lim, Math.min(lim, p.z)) : pz;
      pts[i * 3] = px = x; pts[i * 3 + 1] = py = y; pts[i * 3 + 2] = pz = z;
    }
    return pts;
  }
}
