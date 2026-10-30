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
    this.scope = { x: 0, y: 0, z: 0, s: 0, n: 0, u: 0, v: 0, theta: 0, t: 0, a: 1, b: 1, c: 1, d: 1 };
    this.cache = null; // flows and maps: the whole path, worked out once per set of parameters
  }

  /** Flows and maps are computed as a whole (each point needs the one before). */
  get stepped() { return this.layer.type === 'ode' || this.layer.type === 'map'; }

  /**
   * The path of a flow (Runge–Kutta 4 from the start point) or a map (iterated), placed by the
   * layer's sim settings. Cached until the parameters change (or every call if it uses time).
   */
  path(ctx, refresh = true) {
    const P = ctx.params, n = Math.max(2, this.layer.samples | 0);
    const key = `${P.a}|${P.b}|${P.c}|${P.d}|${n}|${this.usesTime ? ctx.t : ''}`;
    // the sound (and the pen) may use the last drawn path: recomputing tens of thousands of points
    // for every audio step of a morphing cloud would stall an export; drawing refreshes it
    if (this.cache && (this.cache.key === key || !refresh)) return this.cache.pts;
    const S = this.layer.sim || {}, f = this.fns, sc = this.scope;
    sc.t = ctx.t; sc.a = P.a; sc.b = P.b; sc.c = P.c; sc.d = P.d;
    const pts = new Float32Array((n + 1) * 3);
    const scale = S.scale ?? 1, cx = S.cx || 0, cy = S.cy || 0, cz = S.cz || 0, zUp = S.up === 'z';
    const put = (i, x, y, z) => {
      const X = (x - cx) * scale, Y = (y - cy) * scale, Z = (z - cz) * scale;
      // `up: 'z'` turns a system whose third coordinate is height (Lorenz) upright on screen
      pts[i * 3] = X; pts[i * 3 + 1] = zUp ? Z : Y; pts[i * 3 + 2] = zUp ? -Y : Z;
    };
    let x = S.x0 ?? 0.1, y = S.y0 ?? 0, z = S.z0 ?? 0;
    const ok = (v) => Number.isFinite(v) && Math.abs(v) < 1e6;
    if (this.layer.type === 'ode') {
      const h = S.dt || 0.01;
      const F = (X, Y, Z, T, o) => { sc.x = X; sc.y = Y; sc.z = Z; sc.s = T; o[0] = f.x(sc); o[1] = f.y(sc); o[2] = f.z(sc); };
      const k1 = [0, 0, 0], k2 = [0, 0, 0], k3 = [0, 0, 0], k4 = [0, 0, 0];
      let T = 0;
      const step = () => {
        F(x, y, z, T, k1);
        F(x + (h / 2) * k1[0], y + (h / 2) * k1[1], z + (h / 2) * k1[2], T + h / 2, k2);
        F(x + (h / 2) * k2[0], y + (h / 2) * k2[1], z + (h / 2) * k2[2], T + h / 2, k3);
        F(x + h * k3[0], y + h * k3[1], z + h * k3[2], T + h, k4);
        const nx = x + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
        const ny = y + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
        const nz = z + (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
        T += h;
        if (ok(nx) && ok(ny) && ok(nz)) { x = nx; y = ny; z = nz; }
      };
      for (let i = 0; i < (S.skip | 0); i++) step();
      for (let i = 0; i <= n; i++) { put(i, x, y, z); step(); }
    } else {
      const next = () => {
        sc.x = x; sc.y = y; sc.z = z;
        const nx = f.x(sc), ny = f.y(sc), nz = f.z(sc);
        sc.n++;
        if (ok(nx) && ok(ny) && ok(nz)) { x = nx; y = ny; z = nz; } else { x = S.x0 ?? 0.1; y = S.y0 ?? 0; z = S.z0 ?? 0; }
      };
      sc.n = 0;
      for (let i = 0; i < Math.max(20, S.skip | 0); i++) next();
      for (let i = 0; i <= n; i++) { put(i, x, y, z); next(); }
    }
    this.cache = { key, pts };
    return pts;
  }

  /** A point of a (u, v) surface. */
  surfAt(u, v, ctx, out = { x: 0, y: 0, z: 0 }) {
    const s = this.scope, f = this.fns;
    s.t = ctx.t; s.a = ctx.params.a; s.b = ctx.params.b; s.c = ctx.params.c; s.d = ctx.params.d;
    s.u = u; s.v = v;
    out.x = f.x(s); out.y = f.y(s); out.z = f.z(s);
    return out;
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
    if (this.stepped) {
      const pts = this.path(ctx, false), n = pts.length / 3 - 1, k = Math.min(n, Math.max(0, u * n));
      const i = Math.min(n - 1, Math.floor(k)), w = this.layer.type === 'map' ? 0 : k - i;
      out.x = pts[i * 3] + (pts[i * 3 + 3] - pts[i * 3]) * w;
      out.y = pts[i * 3 + 1] + (pts[i * 3 + 4] - pts[i * 3 + 1]) * w;
      out.z = pts[i * 3 + 2] + (pts[i * 3 + 5] - pts[i * 3 + 2]) * w;
      return out;
    }
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
      case 'psurface':
        s.u = v;
        s.v = f.pv(s);
        out.x = f.x(s); out.y = f.y(s); out.z = f.z(s);
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
    if (this.stepped && n === (this.layer.samples | 0)) return this.path(ctx).slice();
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
