/**
 * Three.js renderer for both 2D (orthographic) and 3D (perspective) modes.
 *
 * Scene layout (math → world):  x → X (time), y → Y (pitch), z → Z (volume/pan)
 * Surfaces draw height on Y so "up" always means "higher note".
 *
 * Sizes (line width, marker, particles, labels) are expressed per 1000 px of the
 * canvas's shorter side, so a 4K or portrait recording looks identical to the on-screen preview.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { cameraMove } from '../camera-moves.js';
import { paintBackdrop } from './backdrops.js';
import { FX_PARTS } from './fx-styles.js';

const TRAIL_MAX = 400;
const tmpColor = new THREE.Color();

/* ------------------------------------------------------------------ helpers */

/** "Nice" grid step (1, 2, 5 × 10^n) giving roughly `target` divisions. */
function niceStep(span, target = 8) {
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * mag;
}

/**
 * Put `array` into geometry attribute `name` without leaking GPU memory.
 * three.js only frees a buffer when its geometry is disposed, so replacing an
 * attribute every frame (animated formulas) used to leak until WebGL died.
 * Same size → update in place; new size → dispose the geometry's buffers first.
 */
function writeAttr(geometry, name, array, itemSize) {
  const old = geometry.getAttribute(name);
  if (old && old.array.length === array.length) {
    old.array.set(array);
    old.needsUpdate = true;
    return;
  }
  if (old) geometry.dispose();
  geometry.setAttribute(name, new THREE.BufferAttribute(array, itemSize));
}

const fmt = (v) => (Math.abs(v) < 1e-9 ? '0' : Number(v.toFixed(2)).toString());

/** Canvas texture of a marker shape (white, tinted by the sprite colour). */
function shapeTexture(shape) {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const m = S / 2;
  // Soft halo behind every shape.
  const halo = g.createRadialGradient(m, m, 0, m, m, m);
  halo.addColorStop(0, 'rgba(255,255,255,0.55)');
  halo.addColorStop(0.35, 'rgba(255,255,255,0.18)');
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, S, S);
  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  g.lineWidth = 7;
  g.beginPath();
  const r = S * 0.2;
  switch (shape) {
    case 'square': g.rect(m - r, m - r, r * 2, r * 2); g.fill(); break;
    case 'diamond': g.moveTo(m, m - r * 1.3); g.lineTo(m + r * 1.3, m); g.lineTo(m, m + r * 1.3); g.lineTo(m - r * 1.3, m); g.closePath(); g.fill(); break;
    case 'ring': g.arc(m, m, r * 1.1, 0, Math.PI * 2); g.stroke(); break;
    case 'star':
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.6 : r * 1.5;
        g.lineTo(m + Math.cos(a) * rr, m + Math.sin(a) * rr);
      }
      g.closePath(); g.fill(); break;
    default: g.arc(m, m, r, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Text label as a sprite; `aspect` is kept so it can be scaled in pixels later. */
function textSprite(text, color) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const font = '500 44px "JetBrains Mono", ui-monospace, monospace';
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 16;
  c.width = w; c.height = 60;
  g.font = font;
  g.fillStyle = color;
  g.textBaseline = 'middle';
  g.fillText(text, 8, 31);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
  const s = new THREE.Sprite(mat);
  s.userData.aspect = w / 60;
  s.userData.label = true;
  return s;
}

/** Fill a Float32Array of RGB colours for each sampled point. */
function curveColors(layer, pts, view, out) {
  const n = pts.length / 3;
  const a = new THREE.Color(layer.color), b = new THREE.Color(layer.color2);
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) : 0;
    switch (layer.colorMode) {
      case 'gradient': tmpColor.copy(a).lerp(b, u); break;
      case 'rainbow': tmpColor.setHSL((u * 0.9) % 1, 1, 0.58); break;
      case 'pitch': {
        const k = Math.min(Math.max((pts[i * 3 + 1] - view.yMin) / (view.yMax - view.yMin || 1), 0), 1);
        tmpColor.copy(a).lerp(b, k);
        break;
      }
      default: tmpColor.copy(a);
    }
    out[i * 3] = tmpColor.r; out[i * 3 + 1] = tmpColor.g; out[i * 3 + 2] = tmpColor.b;
  }
  return out;
}

/* --------------------------------------------------------------- particles */

const trailVertex = /* glsl */ `
  attribute float aBirth;
  attribute vec3 aDir;
  uniform float uTime, uLife, uSize, uSpread, uPixel;
  varying float vAlpha;
  void main() {
    float age = (uTime - aBirth) / uLife;
    vec3 p = position + aDir * age * uSpread;
    vAlpha = age < 0.0 || age > 1.0 ? 0.0 : pow(1.0 - age, 1.6);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = vAlpha > 0.0 ? uSize * uPixel * (0.35 + 0.65 * (1.0 - age)) : 0.0;
  }`;
const trailFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor * a, a);
  }`;

/* --------------------------------------------------------------- fx helpers */

const FX_GLITCH = [0xff2a3d, 0x38ff7a, 0x2ae8ff]; // red, green, cyan: the three lights of the chromatic glitch
const smooth01 = (x) => { const q = Math.min(1, Math.max(0, x)); return q * q * (3 - 2 * q); };
const STRING_MAX = 400, BEAD_MAX = 600;
const FX_PRISM = [0xff3d9a, 0xffe14d, 0x3dd9ff]; // magenta, yellow, cyan: the prism's copies, drawn with normal blending

/** Brightness of vertex i of the lit tail: full at the pen, falling to `floor` over `len` vertices (around the loop when cyclic). */
function tailAt(i, shown, count, len, floor, cyclic) {
  let d = shown - 1 - i;
  if (cyclic) d = ((d % count) + count) % count;
  d /= len;
  return d <= 0 ? 1 : Math.max(floor, Math.max(0, 1 - d) ** 1.7);
}
/** Copy per-vertex colours into a LineGeometry's segment colours (segments 0 … upto−1), in place. */
function writeVerts(geo, vcol, upto) {
  const attr = geo.attributes.instanceColorStart;
  if (!attr) return;
  const arr = attr.data.array;
  for (let i = 0; i < upto; i++) {
    const k = i * 6, j = i * 3;
    arr[k] = vcol[j]; arr[k + 1] = vcol[j + 1]; arr[k + 2] = vcol[j + 2]; arr[k + 3] = vcol[j + 3]; arr[k + 4] = vcol[j + 4]; arr[k + 5] = vcol[j + 5];
  }
  attr.data.needsUpdate = true;
}
/** HSL (h in turns) → RGB into out[o..o+2]. */
function hslInto(out, o, h, s, l) {
  const a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + h * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  out[o] = f(0); out[o + 1] = f(8); out[o + 2] = f(4);
}

/* --------------------------------------------------------------- LayerView */

/** All the Three.js objects for one formula layer. */
class LayerView {
  constructor(viz, layer) {
    this.viz = viz;
    this.layer = layer;
    this.group = new THREE.Group();
    this.pts = null;
    this.drawn = new THREE.Vector3();
    this.hasDrawn = false;

    const dashed = layer.style === 'dashed';
    const lineMat = (opacity) => new LineMaterial({
      vertexColors: true, linewidth: layer.width, transparent: true, opacity,
      dashed, dashSize: 0.18, gapSize: 0.12, worldUnits: false, depthWrite: opacity >= 1,
    });

    // maps are clouds of many small soft points, added together where they pile up
    const cloud = layer.type === 'map';
    this.dotFactor = cloud ? 0.75 : 2.2;
    if (layer.style === 'dots' || cloud) {
      this.dotsGeo = new THREE.BufferGeometry();
      this.dotsMat = new THREE.PointsMaterial({
        size: 1, vertexColors: true, sizeAttenuation: false, map: viz.dotTexture,
        transparent: true, depthWrite: false, alphaTest: cloud ? 0.01 : 0.05,
        ...(cloud ? { blending: THREE.AdditiveBlending, opacity: layer.sim?.alpha ?? 0.35 } : {}),
      });
      this.dots = new THREE.Points(this.dotsGeo, this.dotsMat);
      this.group.add(this.dots);
      this.ghostGeo = new THREE.BufferGeometry();
      this.ghostDots = new THREE.Points(this.ghostGeo, this.dotsMat.clone());
      this.ghostDots.material.opacity = 0.16;
      this.group.add(this.ghostDots);
    } else {
      this.line = new Line2(new LineGeometry(), lineMat(1));
      this.ghost = new Line2(new LineGeometry(), lineMat(0.16));
      this.group.add(this.ghost, this.line);
    }

    // Playhead marker
    this.markerMat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false, fog: false });
    this.marker = new THREE.Sprite(this.markerMat);
    this.marker.renderOrder = 10;
    this.group.add(this.marker);

    // Vertical cursor line (shows the "now" position on the time axis)
    const cg = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 1, 0], 3));
    this.cursor = new THREE.Line(cg, new THREE.LineBasicMaterial({ transparent: true, opacity: 0.35, depthWrite: false }));
    this.group.add(this.cursor);

    // Particle trail (ring buffer)
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_MAX * 3), 3));
    tg.setAttribute('aBirth', new THREE.BufferAttribute(new Float32Array(TRAIL_MAX).fill(-1e6), 1));
    const dirs = new Float32Array(TRAIL_MAX * 3);
    for (let i = 0; i < dirs.length; i++) dirs[i] = (Math.random() * 2 - 1);
    tg.setAttribute('aDir', new THREE.BufferAttribute(dirs, 3));
    this.trailMat = new THREE.ShaderMaterial({
      vertexShader: trailVertex, fragmentShader: trailFragment, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uLife: { value: 1.5 }, uSize: { value: 6 }, uSpread: { value: 0.25 }, uPixel: { value: 1 }, uColor: { value: new THREE.Color() } },
    });
    this.trail = new THREE.Points(tg, this.trailMat);
    this.trail.frustumCulled = false;
    this.trailIndex = 0;
    this.group.add(this.trail);

    // Surface mesh (3D surface layers only)
    if (layer.type === 'surface' || layer.type === 'psurface') {
      this.surfGeo = new THREE.BufferGeometry();
      this.surfSolid = new THREE.Mesh(this.surfGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }));
      this.wireGeo = new THREE.BufferGeometry();
      this.surfWire = new THREE.LineSegments(this.wireGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false }));
      this.scan = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
      this.group.add(this.surfSolid, this.surfWire, this.scan);
    }

    // fx: three chromatic copies of the curve and of the playhead, and the strings (see visual.fx)
    this.fxGeo = new LineGeometry();
    this.fxLines = [...FX_GLITCH, 0xffffff, 0xffffff, 0xffffff].map((c) => {
      const ln = new Line2(this.fxGeo, new LineMaterial({ color: c, vertexColors: true, linewidth: layer.width, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, worldUnits: false }));
      ln.frustumCulled = false; ln.renderOrder = 2; ln.visible = false;
      this.group.add(ln);
      return ln;
    });
    this.fxMarkers = FX_GLITCH.map((c) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ color: c, transparent: true, depthWrite: false, depthTest: false, fog: false, blending: THREE.AdditiveBlending }));
      sp.renderOrder = 11; sp.visible = false;
      this.group.add(sp);
      return sp;
    });
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STRING_MAX * 6), 3));
    sg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(STRING_MAX * 6), 3));
    this.strings = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.strings.frustumCulled = false; this.strings.renderOrder = 1; this.strings.visible = false;
    this.group.add(this.strings);
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BEAD_MAX * 3), 3));
    bg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(BEAD_MAX * 3), 3));
    this.beads = new THREE.Points(bg, new THREE.PointsMaterial({ size: 1, vertexColors: true, sizeAttenuation: false, map: viz.dotTexture, transparent: true, depthWrite: false, alphaTest: 0.05 }));
    this.beads.frustumCulled = false; this.beads.renderOrder = 3; this.beads.visible = false;
    this.group.add(this.beads);
    this.applyStyle();
  }

  /** What the fx setting asks for on this layer. */
  fxMode() {
    const fx = this.viz.state.visual.fx || {};
    if (this.layer.type === 'surface' || this.layer.hidden) return { parts: {}, fx };
    return { parts: FX_PARTS[fx.style] || {}, fx };
  }

  hideFx() {
    for (const o of [...this.fxLines, ...this.fxMarkers, this.strings, this.beads]) o.visible = false;
  }

  /** Strings from the centre to evenly spaced points of the curve (fixed once the curve is sampled). */
  buildStrings(n) {
    if (!this.pts) return;
    const pos = this.strings.geometry.attributes.position, col = this.strings.geometry.attributes.color;
    n = Math.min(STRING_MAX, Math.max(2, Math.round(n)));
    for (let j = 0; j < n; j++) {
      const i = Math.round((j / (n - 1)) * (this.count - 1));
      pos.setXYZ(j * 2, 0, 0, 0); pos.setXYZ(j * 2 + 1, this.pts[i * 3], this.pts[i * 3 + 1], this.pts[i * 3 + 2]);
      col.setXYZ(j * 2, this.baseCols[i * 3] * 0.12, this.baseCols[i * 3 + 1] * 0.12, this.baseCols[i * 3 + 2] * 0.12);
      col.setXYZ(j * 2 + 1, this.baseCols[i * 3], this.baseCols[i * 3 + 1], this.baseCols[i * 3 + 2]);
    }
    pos.needsUpdate = col.needsUpdate = true;
    this.strN = n;
  }

  /** Beads: points at even steps along the curve. */
  buildBeads(n) {
    if (!this.pts) return;
    const pos = this.beads.geometry.attributes.position, col = this.beads.geometry.attributes.color;
    n = Math.min(BEAD_MAX, Math.max(2, Math.round(n)));
    for (let j = 0; j < n; j++) {
      const i = Math.round((j / (n - 1)) * (this.count - 1));
      pos.setXYZ(j, this.pts[i * 3], this.pts[i * 3 + 1], this.pts[i * 3 + 2]);
      col.setXYZ(j, this.baseCols[i * 3], this.baseCols[i * 3 + 1], this.baseCols[i * 3 + 2]);
    }
    pos.needsUpdate = col.needsUpdate = true;
    this.beadN = n;
  }

  /**
   * The fx of this frame: coloured copies of the curve, the laser web from the pen, strings,
   * beads. Returns true when the normal line is replaced.
   */
  frameFx(shown, f, ctx) {
    const { parts, fx } = this.fxMode();
    const v = this.viz.state.visual, wrap = v.loop === 'wrap' && this.layer.type !== 'map';
    let mode = parts.lines;
    if (!mode && wrap) mode = 'tube'; // a seamless loop needs a lit tail that chases itself round the curve
    const I = fx.intensity ?? 1;
    if (!mode && !parts.string && !parts.beads) { this.hideFx(); return false; }
    const holdK = !v.loop || v.loop === 'off' ? (fx.hold > 0 && f.duration ? smooth01(1 - (f.duration - (f.time ?? 0)) / fx.hold) : 0) : 0; // the last shot: the whole curve lights up
    const tail = (fx.tail ?? 0.3) + (6 - (fx.tail ?? 0.3)) * holdK;
    const res = this.viz.resolution, cam = this.viz.camera;
    cam.updateMatrixWorld();
    const right = tmpRight.setFromMatrixColumn(cam.matrixWorld, 0), up = tmpUp.setFromMatrixColumn(cam.matrixWorld, 1);
    const split = mode === 'glitch' || mode === 'prism';
    const spike = mode === 'glitch' ? (Math.max(0, Math.sin(f.now * 5.3) * Math.sin(f.now * 1.7 + 1)) ** 3) * 2.2 + (this.bump || 0) * 1.5 : 0;
    const unit = (fx.offset ?? 3.2) * (mode === 'prism' ? 1.8 : mode === 'sketch' ? 0.35 : 1) * (1 + spike) * f.k * f.worldPerPx;
    const offs = [[-1, 0.35], [0.0, -0.2], [1, -0.35]];
    const w = this.layer.width * f.k;

    this.fxLines.forEach((ln) => { ln.visible = false; ln.position.set(0, 0, 0); ln.rotation.set(0, 0, 0); ln.scale.set(1, 1, 1); });
    const use = (i, { color, opacity, width = w, additive = true, dashed = false }) => {
      const ln = this.fxLines[i], m = ln.material, bl = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
      if (m.blending !== bl) { m.blending = bl; m.needsUpdate = true; }
      if (m.dashed !== dashed) { m.dashed = dashed; m.needsUpdate = true; }
      ln.visible = true; m.resolution.copy(res); m.color.setHex(color); m.linewidth = width; m.opacity = Math.min(1, opacity);
      return ln;
    };
    if (mode) {
      const n = this.count;
      if (this.fxGeo.attributes.instanceStart) {
        const upto = wrap ? n - 1 : Math.min(n - 1, shown);
        this.fxGeo.instanceCount = Math.max(0, upto);
        const floor = { web: 0.02, tube: 0.04, comet: 0, echo: 0.2, kaleido: 0.2, mirror: 0.2, ink: 0.35, sketch: 0.35, ants: 0.5, rainbow: 0.12, pulse: 0.15 }[mode] ?? 0;
        const tl = mode === 'comet' ? Math.min(tail, 0.12) : ['ink', 'echo', 'kaleido', 'mirror', 'sketch', 'ants'].includes(mode) ? Math.max(tail, 0.5) : tail;
        const len = Math.max(2, tl * n), grey = split || mode === 'sketch';
        const vc = (this.vcol && this.vcol.length === n * 3) ? this.vcol : (this.vcol = new Float32Array(n * 3));
        const B = this.baseCols, now = f.now;
        for (let i = 0; i < n; i++) {
          const a = tailAt(i, shown, n, len, floor, wrap), j = i * 3;
          if (mode === 'rainbow') { hslInto(vc, j, (i / n) * 2 - now * 0.12 + 10, 0.9, 0.58); vc[j] *= a; vc[j + 1] *= a; vc[j + 2] *= a; continue; }
          let m = a;
          if (mode === 'pulse') m *= 0.22 + 0.78 * (0.5 + 0.5 * Math.sin((i / n) * Math.PI * 2 * 9 - now * 3.2)) ** 6;
          if (grey) { vc[j] = vc[j + 1] = vc[j + 2] = m; } else { vc[j] = B[j] * m; vc[j + 1] = B[j + 1] * m; vc[j + 2] = B[j + 2] * m; }
        }
        writeVerts(this.fxGeo, vc, upto);
      }
      this.line.visible = false; this.ghost.visible = false;
      if (split) {
        for (let i = 0; i < 3; i++) use(i, mode === 'glitch' ? { color: FX_GLITCH[i], opacity: 0.55 * (1 - 0.5 * holdK) * I } : { color: FX_PRISM[i], opacity: 0.78 * I, additive: false })
          .position.set(0, 0, 0).addScaledVector(right, offs[i][0] * unit).addScaledVector(up, offs[i][1] * unit);
      } else if (mode === 'web' || mode === 'tube' || mode === 'rainbow' || mode === 'pulse') {
        use(0, { color: 0xffffff, opacity: (mode === 'tube' ? 0.26 : 0.2) * I, width: w * 3.2 }); use(1, { color: 0xffffff, opacity: I });
      } else if (mode === 'comet') {
        use(0, { color: 0xffffff, opacity: 0.3 * I, width: w * 2.2 }); use(1, { color: 0xffffff, opacity: I, width: w * 0.8 });
      } else if (mode === 'echo') {
        for (let i = 0; i < 5; i++) { const ln = use(i, { color: 0xffffff, opacity: (0.75 - i * 0.14) * I, width: w * (1 - i * 0.1) }); const sc = 1 - i * 0.07; ln.scale.set(sc, sc, sc); ln.rotation.z = -i * 0.05; }
      } else if (mode === 'kaleido') {
        const k = Math.min(6, Math.max(2, Math.round(fx.copies || 6)));
        for (let i = 0; i < k; i++) use(i, { color: 0xffffff, opacity: (0.95 / Math.sqrt(k)) * I, width: w * 0.9 }).rotation.z = (i * Math.PI * 2) / k;
      } else if (mode === 'mirror') {
        [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sy], i) => use(i, { color: 0xffffff, opacity: 0.6 * I, width: w * 0.9 }).scale.set(sx, sy, 1));
      } else if (mode === 'ink') use(0, { color: 0xffffff, opacity: 0.95 * I, additive: false });
      else if (mode === 'sketch') {
        // a pencil: three thin strokes a hair apart, in the line's own colour
        const col = new THREE.Color(this.layer.color).getHex();
        for (let i = 0; i < 3; i++) use(i, { color: col, opacity: 0.38 * I, width: w * 0.55, additive: false }).position.set(0, 0, 0).addScaledVector(right, offs[i][0] * unit).addScaledVector(up, offs[2 - i][1] * unit * 2);
      } else if (mode === 'ants') {
        // marching ants: a dashed line whose dashes run along the curve
        const ln = use(1, { color: 0xffffff, opacity: I, dashed: true }), L = this.fxLen || 1;
        ln.material.dashSize = L / 90; ln.material.gapSize = L / 110; ln.material.dashOffset = -f.now * (L / 40);
        use(0, { color: 0xffffff, opacity: 0.12 * I, width: w * 0.6 });
      }
    }
    this.marker.visible = !split;

    // the three lights of the playhead
    const px = this.viz.state.visual.marker.size * (1 + (this.bump || 0)) * f.k * f.worldPerPx;
    this.fxMarkers.forEach((sp, i) => {
      sp.visible = split;
      if (!split) return;
      sp.material.map = this.markerMat.map;
      const bl = mode === 'glitch' ? THREE.AdditiveBlending : THREE.NormalBlending;
      if (sp.material.blending !== bl) { sp.material.blending = bl; sp.material.needsUpdate = true; }
      sp.material.color.setHex(mode === 'glitch' ? FX_GLITCH[i] : FX_PRISM[i]);
      sp.material.opacity = 1;
      sp.scale.set(px, px, 1);
      sp.position.copy(this.drawn).addScaledVector(right, offs[i][0] * unit * 1.4).addScaledVector(up, offs[i][1] * unit * 1.4);
    });

    // beads
    if (parts.beads) {
      const n = Math.min(BEAD_MAX, Math.round(fx.strings || 90));
      if (this.beadN !== n) this.buildBeads(n);
      this.line.visible = false; this.ghost.visible = false;
      this.beads.visible = true;
      this.beads.geometry.setDrawRange(0, Math.min(this.beadN, Math.floor(((shown - 1) / (this.count - 1)) * (this.beadN - 1)) + 1));
      this.beads.material.size = this.layer.width * 3.4 * f.k;
      this.beads.material.opacity = Math.min(1, 0.95 * I);
    } else this.beads.visible = false;

    // strings (from the centre) or a laser web (from the pen to the lit tail)
    const st = this.strings, pos = st.geometry.attributes.position, col = st.geometry.attributes.color;
    st.material.opacity = Math.min(1, (fx.stringAlpha ?? 0.16) * I);
    if (parts.string) {
      const n = Math.min(STRING_MAX, Math.round(fx.strings || 90));
      if (this.strN !== n) this.buildStrings(n);
      st.visible = true;
      const stride = (this.count - 1) / (this.strN - 1);
      st.geometry.setDrawRange(0, 2 * Math.min(this.strN, Math.floor((shown - 1) / stride) + 1));
    } else if (parts.web) {
      const n = Math.max(10, Math.min(48, Math.round((fx.strings || 90) / 2)));
      const len = Math.max(2, tail * this.count * 0.9);
      for (let j = 0; j < n; j++) {
        let i = Math.round(shown - 1 - (j / (n - 1)) * len);
        i = wrap ? ((i % this.count) + this.count) % this.count : Math.max(0, i);
        const a = (1 - j / n) ** 1.3;
        pos.setXYZ(j * 2, this.drawn.x, this.drawn.y, this.drawn.z); pos.setXYZ(j * 2 + 1, this.pts[i * 3], this.pts[i * 3 + 1], this.pts[i * 3 + 2]);
        col.setXYZ(j * 2, this.baseCols[i * 3] * a, this.baseCols[i * 3 + 1] * a, this.baseCols[i * 3 + 2] * a);
        col.setXYZ(j * 2 + 1, this.baseCols[i * 3] * a * 0.5, this.baseCols[i * 3 + 1] * a * 0.5, this.baseCols[i * 3 + 2] * a * 0.5);
      }
      pos.needsUpdate = col.needsUpdate = true;
      st.geometry.setDrawRange(0, n * 2);
      st.material.opacity = Math.min(1, (fx.stringAlpha ?? 0.16) * 2.4 * I);
      st.visible = true;
    } else st.visible = false;
    return !!mode || !!parts.beads;
  }

  /** Loop fade (visual.loop = 'fade'): everything this layer draws dims by k (0 … 1) this frame. */
  applyFade(k) {
    if (this.line) { this.line.material.opacity = k; this.ghost.material.opacity *= k; }
    if (this.dots) { if (this.layer.type !== 'map') this.dotsMat.opacity = k; else this.dotsMat.opacity *= k; this.ghostDots.material.opacity *= k; }
    for (const ln of this.fxLines) if (ln.visible) ln.material.opacity *= k;
    for (const sp of this.fxMarkers) if (sp.visible) sp.material.opacity *= k;
    this.strings.material.opacity *= k; this.beads.material.opacity *= k;
    this.markerMat.opacity = k;
    if (this.surfSolid) { this.surfSolid.material.opacity = (this.layer.type === 'psurface' ? this.layer.surf?.solid ?? 0.16 : 0.1) * k; this.surfWire.material.opacity = (this.layer.type === 'psurface' ? this.layer.surf?.wire ?? 0.45 : 0.5) * k; }
    this.trail.visible = this.viz.state.visual.trail.enabled && k > 0.4;
  }

  applyStyle() {
    const l = this.layer, v = this.viz.state.visual;
    const color = new THREE.Color(l.colorMode === 'solid' ? l.color : l.colorMode === 'gradient' ? l.color2 : l.color);
    this.markerMat.color.set(v.marker.shape === 'image' && this.viz.markerImage ? 0xffffff : color);
    this.markerMat.map = v.marker.shape === 'image' && this.viz.markerImage ? this.viz.markerImage : this.viz.shapeTex(v.marker.shape);
    this.markerMat.needsUpdate = true;
    this.cursor.material.color.copy(color);
    this.trailMat.uniforms.uColor.value.copy(color);
    this.trail.visible = v.trail.enabled;
    this.trailMat.blending = this.viz.lightBackground ? THREE.NormalBlending : THREE.AdditiveBlending;
  }

  /** Re-sample the curve and push it to the GPU. */
  rebuild(compiled, ctx) {
    const { layer } = this;
    const is3d = this.viz.state.mode === '3d';
    const pts = compiled.sample(ctx);
    if (!is3d) for (let i = 2; i < pts.length; i += 3) pts[i] = 0; // flatten Z in 2D
    this.pts = pts;
    this.count = pts.length / 3;
    const cols = curveColors(layer, pts, ctx.view, new Float32Array(pts.length));
    this.baseCols = cols;
    this.strN = 0; this.beadN = 0; // the strings and beads are laid out again for the new curve
    if (this.line) {
      this.fxGeo = new LineGeometry();
      this.fxGeo.setPositions(pts);
      this.fxGeo.setColors(new Float32Array(pts.length).fill(1));
      for (const ln of this.fxLines) { ln.geometry.dispose?.(); ln.geometry = this.fxGeo; }
      this.fxLines[0].computeLineDistances(); // for the marching ants
      const dist = this.fxGeo.attributes.instanceDistanceEnd;
      this.fxLen = dist ? dist.data.array[dist.data.array.length - 1] : 1;
    }

    if (this.line) {
      for (const ln of [this.line, this.ghost]) {
        ln.geometry.dispose();
        ln.geometry = new LineGeometry();
        ln.geometry.setPositions(pts);
        ln.geometry.setColors(cols);
        if (layer.style === 'dashed') ln.computeLineDistances();
      }
    } else {
      for (const g of [this.dotsGeo, this.ghostGeo]) {
        writeAttr(g, 'position', pts, 3);
        writeAttr(g, 'color', cols, 3);
        g.computeBoundingSphere();
      }
    }

    if (this.surfGeo) {
      this.surfSolid.visible = this.surfWire.visible = is3d;
      if (is3d) (this.layer.type === 'psurface' ? this.buildPSurface(compiled, ctx) : this.buildSurface(compiled, ctx));
    }
  }

  /** A (u, v) surface: mesh + lattice, coloured from the first to the second colour along v. */
  buildPSurface(compiled, ctx) {
    const S = this.layer.surf || {}, r = this.layer.range;
    const NU = Math.max(8, Math.min(200, S.nu | 0 || 96)), NV = Math.max(4, Math.min(120, S.nv | 0 || 48));
    const pos = new Float32Array((NU + 1) * (NV + 1) * 3), col = new Float32Array(pos.length);
    const a = new THREE.Color(this.layer.color), b = new THREE.Color(this.layer.color2), p = { x: 0, y: 0, z: 0 };
    for (let j = 0; j <= NV; j++) {
      const v = S.vMin + ((S.vMax - S.vMin) * j) / NV;
      for (let i = 0; i <= NU; i++) {
        const u = r.min + ((r.max - r.min) * i) / NU;
        compiled.surfAt(u, v, ctx, p);
        const k = (j * (NU + 1) + i) * 3;
        pos[k] = Number.isFinite(p.x) ? p.x : 0; pos[k + 1] = Number.isFinite(p.y) ? p.y : 0; pos[k + 2] = Number.isFinite(p.z) ? p.z : 0;
        tmpColor.copy(a).lerp(b, j / NV);
        col[k] = tmpColor.r; col[k + 1] = tmpColor.g; col[k + 2] = tmpColor.b;
      }
    }
    const key = `${NU}x${NV}`;
    if (this.surfKey !== key) {
      const idx = [], lines = [], W = NU + 1;
      for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const q = j * W + i; idx.push(q, q + 1, q + W, q + 1, q + W + 1, q + W); }
      const eu = Math.max(1, Math.round(NU / 32)), ev = Math.max(1, Math.round(NV / 16));
      for (let j = 0; j <= NV; j += ev) for (let i = 0; i < NU; i++) lines.push(j * W + i, j * W + i + 1);
      for (let i = 0; i <= NU; i += eu) for (let j = 0; j < NV; j++) lines.push(j * W + i, (j + 1) * W + i);
      this.surfGeo.dispose(); this.wireGeo.dispose();
      this.surfGeo.setIndex(idx); this.wireGeo.setIndex(lines);
      this.surfKey = key; this.surfIndex = null;
    }
    for (const g of [this.surfGeo, this.wireGeo]) { writeAttr(g, 'position', pos, 3); writeAttr(g, 'color', col, 3); g.computeBoundingSphere(); }
    this.surfSolid.material.opacity = S.solid ?? 0.16;
    this.surfWire.material.opacity = S.wire ?? 0.45;
  }

  buildSurface(compiled, ctx) {
    const { view } = ctx;
    const N = Math.max(8, Math.min(160, this.layer.samples | 0));
    const pos = new Float32Array((N + 1) * (N + 1) * 3);
    const col = new Float32Array(pos.length);
    const a = new THREE.Color(this.layer.color), b = new THREE.Color(this.layer.color2);
    for (let j = 0; j <= N; j++) {
      const y = view.yMin + ((view.yMax - view.yMin) * j) / N;
      for (let i = 0; i <= N; i++) {
        const x = view.xMin + ((view.xMax - view.xMin) * i) / N;
        let h = compiled.height(x, y, ctx);
        if (!Number.isFinite(h)) h = 0;
        h = Math.max(view.yMin * 3, Math.min(view.yMax * 3, h));
        const k = (j * (N + 1) + i) * 3;
        pos[k] = x; pos[k + 1] = h; pos[k + 2] = y;
        tmpColor.copy(a).lerp(b, Math.min(Math.max((h - view.yMin) / (view.yMax - view.yMin), 0), 1));
        col[k] = tmpColor.r; col[k + 1] = tmpColor.g; col[k + 2] = tmpColor.b;
      }
    }
    if (!this.surfIndex || this.surfN !== N) {
      const idx = [];
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const p = j * (N + 1) + i;
        idx.push(p, p + 1, p + N + 1, p + 1, p + N + 2, p + N + 1);
      }
      this.surfIndex = idx;
      this.surfN = N;
      this.surfGeo.dispose(); // frees the old index and attribute buffers
      this.wireGeo.dispose();
      this.surfGeo.setIndex(idx);
      // Grid lines: every `every`-th row and column, so the mesh reads as a lattice.
      const every = Math.max(1, Math.round(N / 24));
      const lines = [];
      for (let j = 0; j <= N; j += every) for (let i = 0; i < N; i++) lines.push(j * (N + 1) + i, j * (N + 1) + i + 1);
      for (let i = 0; i <= N; i += every) for (let j = 0; j < N; j++) lines.push(j * (N + 1) + i, (j + 1) * (N + 1) + i);
      this.wireGeo.setIndex(lines);
    }
    for (const g of [this.surfGeo, this.wireGeo]) {
      writeAttr(g, 'position', pos, 3);
      writeAttr(g, 'color', col, 3);
      g.computeBoundingSphere();
    }
  }

  /**
   * Per-frame update.
   * @param {number} u progress 0..1
   * @param {{x,y,z}} target exact point on the curve
   * @param {object} f frame info (dt, now, k, worldPerPx, snap, playing)
   */
  frame(u, target, f, compiled, ctx, phase = 'active') {
    const v = this.viz.state.visual;
    const is3d = this.viz.state.mode === '3d';
    const tz = is3d ? target.z : 0;

    // Sequence mode: layers that haven't started are hidden; finished ones stay as a
    // faint ghost, stay fully drawn, or disappear, so you can see how the curves evolve.
    const past = phase === 'past';
    this.group.visible = phase !== 'future' && !(past && f.pastMode === 'hide') && !this.layer.hidden;
    this.trailMat.uniforms.uTime.value = f.now;
    if (!this.group.visible || past) {
      this.hideFx();
      this.lastEmit = null;
      this.hasDrawn = false;
      if (!this.group.visible) return;
      const keep = f.pastMode === 'keep';
      this.marker.visible = this.cursor.visible = false;
      if (this.scan) this.scan.visible = false;
      if (this.line) {
        this.line.visible = keep;
        this.line.geometry.instanceCount = Math.max(0, this.count - 1);
        this.ghost.visible = !keep;
        this.ghost.material.opacity = 0.22;
        for (const ln of [this.line, this.ghost]) {
          ln.material.linewidth = this.layer.width * f.k;
          ln.material.resolution.copy(this.viz.resolution);
        }
      } else {
        this.dots.visible = keep;
        this.dotsGeo.setDrawRange(0, this.count);
        this.ghostDots.visible = !keep;
        this.ghostDots.material.opacity = 0.22;
        this.dotsMat.size = this.ghostDots.material.size = this.layer.width * this.dotFactor * f.k;
      }
      this.applyFade(f.fade ?? 1);
      return;
    }
    this.marker.visible = this.layer.type !== 'map'; // a cloud has no pen to follow
    if (this.line) { this.line.visible = true; this.ghost.material.opacity = 0.16; }
    else { this.dots.visible = true; this.ghostDots.material.opacity = 0.16; if (this.layer.type === 'map') this.dotsMat.opacity = Math.min(1, (this.layer.sim?.alpha ?? 0.35) * (v.fx?.intensity ?? 1)); }

    // Smoothly chase the exact point so sudden jumps glide instead of teleporting.
    if (!this.hasDrawn || f.snap || v.marker.smoothing <= 0) {
      this.drawn.set(target.x, target.y, tz);
      this.hasDrawn = true;
    } else {
      const alpha = 1 - Math.pow(v.marker.smoothing * 0.92, f.dt * 60);
      this.drawn.lerp(tmpVec.set(target.x, target.y, tz), alpha);
    }

    // How much of the curve is visible.
    const mode = v.drawMode;
    const shown = mode === 'full' ? this.count : Math.max(1, Math.round(u * (this.count - 1)) + 1);
    const res = this.viz.resolution;
    if (this.line) {
      this.line.geometry.instanceCount = Math.max(0, shown - 1);
      this.ghost.visible = mode === 'ghost';
      for (const ln of [this.line, this.ghost]) {
        ln.material.linewidth = this.layer.width * f.k;
        ln.material.resolution.copy(res);
      }
    } else {
      this.dotsGeo.setDrawRange(0, shown);
      this.ghostDots.visible = mode === 'ghost';
      this.dotsMat.size = this.ghostDots.material.size = this.layer.width * this.dotFactor * f.k;
    }

    // fx replaces the plain line and marker (chromatic copies, laser web) or adds strings
    this.bump = (this.bump || 0) * Math.pow(0.004, f.dt); // drum hits make the marker jump, then settle
    if (this.line && this.pts) this.frameFx(shown, f, ctx); else this.hideFx();

    // Marker
    const px = v.marker.size * (1 + this.bump) * f.k * f.worldPerPx;
    this.marker.scale.set(px, px, 1);
    this.marker.position.copy(this.drawn);

    // Cursor line: only meaningful when x is time (function/surface layers in 2D).
    const showCursor = v.marker.cursorLine && (this.layer.type === 'function' || this.layer.type === 'surface');
    this.cursor.visible = showCursor;
    if (showCursor) {
      const { yMin, yMax } = ctx.view;
      const p = this.cursor.geometry.attributes.position;
      p.setXYZ(0, this.drawn.x, yMin, is3d ? this.drawn.z : 0);
      p.setXYZ(1, this.drawn.x, yMax, is3d ? this.drawn.z : 0);
      p.needsUpdate = true;
      this.cursor.geometry.computeBoundingSphere();
    }

    // Particles
    const tu = this.trailMat.uniforms;
    tu.uTime.value = f.now;
    tu.uPixel.value = f.k;
    tu.uSize.value = v.trail.size;
    tu.uLife.value = Math.max(0.2, v.trail.count / 110);
    tu.uSpread.value = 0.35 * (ctx.view.yMax - ctx.view.yMin) / 8;
    if (v.trail.enabled && f.playing && this.layer.type !== 'map') {
      const g = this.trail.geometry;
      const pos = g.attributes.position, birth = g.attributes.aBirth;
      const emit = 3;
      for (let e = 0; e < emit; e++) {
        const i = this.trailIndex;
        // Spread emissions along the path travelled this frame for a continuous ribbon.
        const k = (e + 1) / emit;
        pos.setXYZ(i,
          this.lastEmit ? this.lastEmit.x + (this.drawn.x - this.lastEmit.x) * k : this.drawn.x,
          this.lastEmit ? this.lastEmit.y + (this.drawn.y - this.lastEmit.y) * k : this.drawn.y,
          this.lastEmit ? this.lastEmit.z + (this.drawn.z - this.lastEmit.z) * k : this.drawn.z);
        birth.setX(i, f.now - (1 - k) * f.dt);
        this.trailIndex = (i + 1) % TRAIL_MAX;
      }
      pos.needsUpdate = birth.needsUpdate = true;
      (this.lastEmit ||= new THREE.Vector3()).copy(this.drawn);
    } else {
      this.lastEmit = null;
    }

    // Surface scan line across the depth axis at the current x.
    if (this.scan && is3d && this.layer.type === 'surface') {
      const N = 48;
      const arr = new Float32Array((N + 1) * 3);
      for (let j = 0; j <= N; j++) {
        const y = ctx.view.yMin + ((ctx.view.yMax - ctx.view.yMin) * j) / N;
        const h = compiled.height(target.x, y, ctx);
        arr[j * 3] = target.x; arr[j * 3 + 1] = Number.isFinite(h) ? h : 0; arr[j * 3 + 2] = y;
      }
      writeAttr(this.scan.geometry, 'position', arr, 3);
      this.scan.geometry.computeBoundingSphere();
      this.scan.visible = true;
    } else if (this.scan) this.scan.visible = false;
    this.applyFade(f.fade ?? 1);
  }

  dispose() {
    this.group.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material && o.material !== this.markerMat) o.material.dispose?.();
    });
    this.markerMat.dispose();
  }
}
const tmpVec = new THREE.Vector3();
const tmpRight = new THREE.Vector3(), tmpUp = new THREE.Vector3();

/* -------------------------------------------------------------- Visualizer */

export class Visualizer {
  /**
   * @param {HTMLElement} host element the canvas is placed in
   * @param {object} state app state
   * @param {{safe?:boolean, smaa?:boolean}} [opts] safe = minimal GPU load for drivers that keep crashing;
   *        smaa = false skips only the antialiasing pass (fast CPU-only batch renders keep 16-bit colour)
   */
  constructor(host, state, { safe = false, smaa = true } = {}) {
    this.safe = safe;
    this.host = host;
    this.state = state;
    this.views = new Map();
    this.markerImage = null;
    this.shapeCache = {};
    this.resolution = new THREE.Vector2(1, 1);
    this.lightBackground = false;

    // No canvas MSAA: everything renders through the composer, so a multisampled
    // backbuffer would only waste GPU memory. Antialiasing comes from the SMAA pass.
    const r = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: safe ? 'default' : 'high-performance' });
    r.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(r.domElement);
    // If the GPU drops the context (driver reset, memory pressure), tell the app
    // instead of freezing on a black canvas.
    this.onContextLost = null;
    r.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.onContextLost?.();
    });
    // Hand the context back when the page goes away, so reloads don't pile up contexts.
    window.addEventListener('pagehide', () => {
      r.dispose();
      r.forceContextLoss();
    });
    this.renderer = r;
    this.canvas = r.domElement;

    this.scene = new THREE.Scene();
    this.content = new THREE.Group();
    this.grid = new THREE.Group();
    this.scene.add(this.content);
    this.content.add(this.grid);

    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
    this.ortho.position.set(0, 0, 50);
    this.persp = new THREE.PerspectiveCamera(45, 1, 0.05, 500);

    this.orthoControls = new OrbitControls(this.ortho, r.domElement);
    Object.assign(this.orthoControls, { enableRotate: false, screenSpacePanning: true, enableDamping: true, zoomToCursor: true });
    this.perspControls = new OrbitControls(this.persp, r.domElement);
    Object.assign(this.perspControls, { enableDamping: true, dampingFactor: 0.07 });

    this.dotTexture = shapeTexture('circle');

    // Plain (non-multisampled) targets work on every driver; SMAA smooths the edges.
    // Multisampled half-float targets crashed some GPUs, so they are not used.
    const rt = new THREE.WebGLRenderTarget(2, 2, { type: safe ? THREE.UnsignedByteType : THREE.HalfFloatType });
    this.composer = new EffectComposer(r, rt);
    this.renderPass = new RenderPass(this.scene, this.ortho);
    this.bokeh = new BokehPass(this.scene, this.persp, { focus: 14, aperture: 0.001, maxblur: 0.012 });
    this.afterimage = new AfterimagePass(0.8);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 1, 0.5, 0.05);
    this.output = new OutputPass();
    this.smaa = safe || !smaa ? null : new SMAAPass(2, 2);
    for (const p of [this.renderPass, this.bokeh, this.afterimage, this.bloom, this.smaa, this.output]) if (p) this.composer.addPass(p);

    // Drum pulses: a glow flash on kicks and expanding rings on snares/claps.
    this.bloomKick = 0;
    this.punch = 0;
    this.trackPt = null;
    this.rings = [];
    for (let i = 0; i < 6; i++) {
      const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.shapeTex('ring'), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false }));
      ring.visible = false;
      ring.renderOrder = 9;
      ring.userData.age = 1;
      this.rings.push(ring);
      this.content.add(ring);
    }
    this.ringIndex = 0;

    this.fixedSize = null; // {w,h} while recording at a fixed resolution
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
  }

  get camera() {
    return this.state.mode === '3d' ? this.persp : this.ortho;
  }
  get controls() {
    return this.state.mode === '3d' ? this.perspControls : this.orthoControls;
  }

  shapeTex(shape) {
    return (this.shapeCache[shape] ||= shapeTexture(shape === 'image' ? 'circle' : shape));
  }

  /** Load a user image (data URL) as the playhead marker. */
  setMarkerImage(dataUrl) {
    if (!dataUrl) { this.markerImage = null; this.restyle(); return; }
    new THREE.TextureLoader().load(dataUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      this.markerImage = tex;
      this.restyle();
    });
  }

  /** Lock the drawing buffer to an exact size (video recording), or null to follow the window. */
  setFixedSize(size) {
    this.fixedSize = size;
    this.resize();
  }

  resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    // While recording, the drawing buffer is pinned to the export size (pixel ratio 1);
    // otherwise it follows the element size times the device pixel ratio.
    const ratio = this.fixedSize || this.safe ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const lw = this.fixedSize ? this.fixedSize.w : w;
    const lh = this.fixedSize ? this.fixedSize.h : h;
    const bw = lw * ratio, bh = lh * ratio;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(lw, lh, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(lw, lh);
    this.resolution.set(bw, bh);
    this.bufferHeight = bh;
    this.bufferMin = Math.min(bw, bh); // sizes scale with the shorter side (portrait videos too)
    this.aspect = bw / bh;
    if (this.state) this.applyBackdrop();
    this.persp.aspect = this.aspect;
    this.persp.updateProjectionMatrix();
    this.fitOrtho(false);
  }

  /** Fit the 2D camera to the view bounds (keeps user zoom unless reset). */
  fitOrtho(resetZoom = true) {
    const { xMin, xMax, yMin, yMax } = this.state.view;
    const halfW = (xMax - xMin) / 2, halfH = (yMax - yMin) / 2;
    const hh = Math.max(halfH, halfW / this.aspect) * 1.12;
    const o = this.ortho;
    o.left = -hh * this.aspect; o.right = hh * this.aspect; o.top = hh; o.bottom = -hh;
    if (resetZoom) {
      o.zoom = 1;
      o.position.set(0, 0, 50);
      this.orthoControls.target.set(0, 0, 0);
    }
    o.updateProjectionMatrix();
  }

  /** Visual reaction to a drum hit on the layer `layerId`. */
  pulse(kind, layerId) {
    const view = this.views.get(layerId) || this.views.values().next().value;
    if (kind === 'kick') { this.bloomKick = 1; this.punch = 1; }
    else if (kind === 'snare' || kind === 'clap') this.punch = Math.max(this.punch, 0.55);
    if (view) view.bump = Math.max(view.bump || 0, kind === 'kick' ? 0.6 : kind === 'hat' ? 0.2 : 0.4);
    if ((kind === 'snare' || kind === 'clap' || kind === 'kick') && view?.hasDrawn) {
      const ring = this.rings[this.ringIndex++ % this.rings.length];
      ring.position.copy(view.drawn);
      ring.material.color.copy(view.markerMat.color);
      ring.userData.age = 0;
      ring.userData.big = kind === 'kick' ? 1.6 : 1;
      ring.visible = true;
    }
  }

  /** Current camera placement (for camera keyframes). */
  getPose() {
    const is3d = this.state.mode === '3d';
    const cam = is3d ? this.persp : this.ortho;
    const ctl = is3d ? this.perspControls : this.orthoControls;
    return { mode: this.state.mode, p: cam.position.toArray(), t: ctl.target.toArray(), zoom: is3d ? 1 : cam.zoom };
  }

  setPose(pose) {
    if (!pose || pose.mode !== this.state.mode) return;
    const is3d = pose.mode === '3d';
    const cam = is3d ? this.persp : this.ortho;
    const ctl = is3d ? this.perspControls : this.orthoControls;
    cam.position.fromArray(pose.p);
    ctl.target.fromArray(pose.t);
    if (!is3d) { cam.zoom = pose.zoom ?? 1; cam.updateProjectionMatrix(); }
    cam.lookAt(ctl.target);
  }

  resetCamera() {
    this.fitOrtho(true);
    const { xMin, xMax, yMin, yMax } = this.state.view;
    const span = Math.max(xMax - xMin, yMax - yMin);
    this.persp.position.set(span * 0.75, span * 0.45, span * 1.05);
    this.perspControls.target.set(0, 0, 0);
    this.persp.lookAt(0, 0, 0);
    this.orthoControls.update();
    this.perspControls.update();
  }

  /** Apply visual + camera settings that don't need geometry changes. */
  applySettings() {
    const { visual: v, camera: c, mode } = this.state;
    const bg = new THREE.Color(v.background);
    this.scene.background = bg;
    const hsl = {};
    bg.getHSL(hsl);
    this.lightBackground = hsl.l > 0.5;
    this.scene.fog = v.fog.enabled && mode === '3d' ? new THREE.FogExp2(bg, v.fog.density) : null;

    this.bloom.enabled = v.bloom.enabled;
    this.bloom.strength = v.bloom.strength;
    this.bloom.radius = v.bloom.radius;
    this.bloom.threshold = v.bloom.threshold;
    this.afterimage.enabled = v.motionBlur.enabled && !this.safe;
    this.afterimage.uniforms.damp.value = 0.5 + v.motionBlur.amount * 0.45;
    this.bokeh.enabled = v.dof.enabled && mode === '3d' && !this.safe;
    this.bokeh.uniforms.focus.value = v.dof.focus;
    this.bokeh.uniforms.aperture.value = v.dof.aperture * 0.0025;

    this.applyBackdrop();
    this.renderer.toneMapping = v.tone === 'soft' ? THREE.ACESFilmicToneMapping : (v.exposure ?? 1) !== 1 ? THREE.LinearToneMapping : THREE.NoToneMapping; // soft: bright overlaps roll off instead of clipping to white
    this.renderer.toneMappingExposure = v.exposure ?? 1;
    this.renderPass.camera = this.camera;
    this.orthoControls.enabled = mode === '2d';
    this.perspControls.enabled = mode === '3d';
    this.perspControls.autoRotate = c.autoRotate;
    this.perspControls.autoRotateSpeed = c.rotateSpeed;
    if (this.persp.fov !== c.fov) { this.persp.fov = c.fov; this.persp.updateProjectionMatrix(); }
    this.restyle();
  }

  restyle() {
    for (const v of this.views.values()) v.applyStyle();
  }

  /**
   * Slow movement of the painted backdrop (visual.backdropMotion): drift, spin, breathe, zoom.
   * Periodic over the video's length, so looping videos stay seamless.
   */
  moveBackdrop(t, D) {
    const tex = this.backdropTex, m = this.state.visual.backdropMotion || 'still';
    if (!tex || this.scene.background !== tex) return;
    const P = D > 0 ? D : 30, ph = (t / P) * Math.PI * 2;
    tex.center.set(0.5, 0.5);
    let rep = 1, rot = 0, ox = 0, oy = 0;
    if (m === 'drift') { rep = 0.88; ox = 0.04 * Math.sin(ph); oy = 0.035 * Math.sin(ph * 2 + 1); }
    else if (m === 'spin') { rep = 0.66; rot = ph; }
    else if (m === 'breathe') { rep = 0.86 + 0.07 * Math.sin(ph * 2); }
    else if (m === 'zoom') { rep = 0.96 - 0.3 * (0.5 - 0.5 * Math.cos(ph)); }
    tex.repeat.set(rep, rep); tex.rotation = rot; tex.offset.set(ox, oy);
  }

  /** A painted backdrop (visual.backdrop) as the scene background, sized to the frame. */
  applyBackdrop() {
    const v = this.state.visual;
    if (!v.backdrop || v.backdrop === 'solid' || !this.bufferHeight) { this.backdropKey = null; return; }
    const bw = this.resolution.x, bh = this.resolution.y;
    const key = [v.backdrop, v.background, v.backdropColor, Math.round(bw), Math.round(bh)].join('|');
    if (key !== this.backdropKey) {
      const sc = Math.min(1, 1280 / Math.max(bw, bh));
      const cv = document.createElement('canvas');
      cv.width = Math.max(2, Math.round(bw * sc)); cv.height = Math.max(2, Math.round(bh * sc));
      paintBackdrop(cv.getContext('2d'), v.backdrop, cv.width, cv.height, v.background, v.backdropColor);
      this.backdropTex?.dispose();
      this.backdropTex = new THREE.CanvasTexture(cv);
      this.backdropTex.colorSpace = THREE.SRGBColorSpace;
      this.backdropKey = key;
    }
    this.scene.background = this.backdropTex;
  }

  /** Rebuild grid, axes and labels for the current view and mode. */
  buildGrid() {
    for (const o of [...this.grid.children]) {
      this.grid.remove(o);
      o.geometry?.dispose();
      o.material?.map?.dispose();
      o.material?.dispose();
    }
    const { view, visual: v, mode } = this.state;
    const { xMin, xMax, yMin, yMax } = view;
    const cx = (xMin + xMax) / 2, cy = (yMin + yMax) / 2;
    this.content.position.set(-cx, -cy, 0);
    const is3d = mode === '3d';
    const sx = niceStep(xMax - xMin), sy = niceStep(yMax - yMin);
    const gridPts = [], axisPts = [];

    if (v.showGrid) {
      if (!is3d) {
        for (let x = Math.ceil(xMin / sx) * sx; x <= xMax + 1e-9; x += sx) gridPts.push(x, yMin, 0, x, yMax, 0);
        for (let y = Math.ceil(yMin / sy) * sy; y <= yMax + 1e-9; y += sy) gridPts.push(xMin, y, 0, xMax, y, 0);
      } else {
        // Floor grid on the XZ plane under the graph.
        const zMin = yMin, zMax = yMax, sz = sy;
        for (let x = Math.ceil(xMin / sx) * sx; x <= xMax + 1e-9; x += sx) gridPts.push(x, yMin, zMin, x, yMin, zMax);
        for (let z = Math.ceil(zMin / sz) * sz; z <= zMax + 1e-9; z += sz) gridPts.push(xMin, yMin, z, xMax, yMin, z);
        // Back wall for pitch reference.
        for (let y = Math.ceil(yMin / sy) * sy; y <= yMax + 1e-9; y += sy) gridPts.push(xMin, y, zMin, xMax, y, zMin);
      }
    }
    if (v.showAxes) {
      const ay = Math.min(Math.max(0, yMin), yMax), ax = Math.min(Math.max(0, xMin), xMax);
      axisPts.push(xMin, ay, 0, xMax, ay, 0, ax, yMin, 0, ax, yMax, 0);
      if (is3d) axisPts.push(ax, ay, yMin, ax, ay, yMax);
    }
    const seg = (arr, color, opacity) => {
      if (!arr.length) return;
      const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      this.grid.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false })));
    };
    seg(gridPts, v.gridColor, 0.9);
    seg(axisPts, v.axesColor, 1);

    // Beat grid: x is time, so beats are vertical lines (bars brighter).
    const r = this.state.rhythm;
    const dur = this.state.transport.duration;
    if (r?.enabled && r.showGrid && dur > 0) {
      const beat = 60 / Math.max(1, this.state.transport.bpm);
      const beats = [], bars = [];
      const zb = is3d ? yMin : 0, ze = is3d ? yMax : 0;
      const crowded = dur / beat > 24; // too many beats to read: draw bar lines only
      for (let i = 0, tt = 0; tt <= dur + 1e-9 && i < 4000; i++, tt = i * beat) {
        if (crowded && i % 4) continue;
        const x = xMin + (tt / dur) * (xMax - xMin);
        const y0 = yMin, y1 = is3d ? yMin : yMax;
        (i % 4 === 0 ? bars : beats).push(x, y0, zb, x, y1, ze);
      }
      seg(beats, v.axesColor, 0.22);
      seg(bars, v.accentGrid || v.axesColor, 0.55);
    }

    if (v.showLabels && v.showAxes) {
      const ay = Math.min(Math.max(0, yMin), yMax), ax = Math.min(Math.max(0, xMin), xMax);
      for (let x = Math.ceil(xMin / sx) * sx; x <= xMax + 1e-9; x += sx) {
        const s = textSprite(fmt(x), v.axesColor);
        s.position.set(x, ay, 0);
        s.userData.offset = [0, -1.1];
        this.grid.add(s);
      }
      for (let y = Math.ceil(yMin / sy) * sy; y <= yMax + 1e-9; y += sy) {
        if (Math.abs(y) < 1e-9) continue;
        const s = textSprite(fmt(y), v.axesColor);
        s.position.set(ax, y, 0);
        s.userData.offset = [-0.75, 0];
        this.grid.add(s);
      }
      if (is3d) {
        const names = [['time  x', xMax, ay, 0], ['pitch  y', ax, yMax, 0], ['z', ax, ay, yMax]];
        for (const [txt, x, y, z] of names) {
          const s = textSprite(txt, v.axesColor);
          s.position.set(x, y, z);
          s.userData.offset = [0.7, 0.9];
          this.grid.add(s);
        }
      }
    }
  }

  /** Make sure there is exactly one LayerView per visible layer (rebuilding changed ones). */
  syncLayers(layers) {
    const keep = new Set();
    for (const l of layers) {
      if (!l.enabled) continue;
      keep.add(l.id);
      const sig = JSON.stringify([l.style, l.type]);
      let view = this.views.get(l.id);
      if (view && view.sig !== sig) { this.content.remove(view.group); view.dispose(); view = null; }
      if (!view) {
        view = new LayerView(this, l);
        view.sig = sig;
        this.views.set(l.id, view);
        this.content.add(view.group);
      }
      view.layer = l;
      view.applyStyle();
    }
    for (const [id, view] of this.views) {
      if (!keep.has(id)) { this.content.remove(view.group); view.dispose(); this.views.delete(id); }
    }
  }

  rebuildLayer(id, compiled, ctx) {
    this.views.get(id)?.rebuild(compiled, ctx);
  }

  /** World units per buffer pixel at the focus point (for pixel-sized sprites). */
  worldPerPx() {
    if (this.state.mode === '2d') {
      const o = this.ortho;
      return (o.top - o.bottom) / o.zoom / this.bufferHeight;
    }
    const d = this.persp.position.distanceTo(this.perspControls.target);
    return (2 * d * Math.tan(THREE.MathUtils.degToRad(this.persp.fov / 2))) / this.bufferHeight;
  }

  /**
   * Draw one frame.
   * @param {{id,u,point,compiled}[]} items per-layer playhead info
   * @param {object} ctx evaluation context (t, params, view)
   * @param {{dt:number, now:number, snap:boolean, playing:boolean}} f
   */
  render(items, ctx, f) {
    const k = this.bufferMin / 1000;
    const wpp = this.worldPerPx();
    const v = this.state.visual, T = f.time ?? 0, D = f.duration || 0;
    // loop: 'fade' dims everything in and out so the last frame matches the (empty) first one
    const L = v.loopSecs ?? 2.5;
    const fade = v.loop === 'fade' && D > L * 2 ? Math.min(smooth01(T / (L * 0.35)), smooth01((D - T) / L)) : 1;
    const frame = { ...f, k, worldPerPx: wpp, fade };
    for (const it of items) this.views.get(it.id)?.frame(it.u, it.point, frame, it.compiled, ctx, it.phase);
    this.moveBackdrop(T, D);

    // Labels keep a constant on-screen size.
    for (const s of this.grid.children) {
      if (!s.userData.label) continue;
      const hpx = 22 * k * wpp;
      s.scale.set(hpx * s.userData.aspect, hpx, 1);
      s.center.set(s.userData.offset[0] < 0 ? 1 : 0, 0.5);
      if (!s.userData.base) s.userData.base = s.position.clone();
      s.position.set(s.userData.base.x, s.userData.base.y + s.userData.offset[1] * hpx, s.userData.base.z);
    }

    // Cinematic follow: gently steer the orbit target towards the first playhead.
    if (this.state.mode === '3d' && this.state.camera.follow && items[0]) {
      const p = items[0].point;
      const goal = tmpVec.set(p.x, p.y, p.z).add(this.content.position);
      this.perspControls.target.lerp(goal, 1 - Math.pow(0.94, f.dt * 60));
    }
    if (this.bokeh.enabled && items[0]) {
      // Auto-focus on the playhead when DoF is on.
      const p = items[0].point;
      const world = tmpVec.set(p.x, p.y, p.z).add(this.content.position);
      this.bokeh.uniforms.focus.value = this.persp.position.distanceTo(world) * (this.state.visual.dof.focus / 14);
    }

    // Drum pulses
    this.bloomKick *= Math.pow(0.01, f.dt);
    this.bloom.strength = this.state.visual.bloom.strength * (1 + 0.5 * this.bloomKick);
    for (const ring of this.rings) {
      if (!ring.visible) continue;
      ring.userData.age += f.dt;
      const life = ring.userData.age / 0.55;
      if (life >= 1) { ring.visible = false; continue; }
      const px = (30 + 260 * Math.sqrt(life)) * ring.userData.big * k * wpp;
      ring.scale.set(px, px, 1);
      ring.material.opacity = (1 - life) * 0.9;
    }

    // While playing, camera keyframes (applied by the app) own the camera; damping would fight them.
    this.controls.enableDamping = !f.cameraLocked;
    this.controls.update(f.dt);
    this.renderWithCameraMoves(items, f);
  }

  /**
   * Cinematic camera moves layered on top of the user's camera for this frame only
   * (so they never fight orbit controls or keyframed poses): follow the drawing pen
   * (track), bump in on drum hits (punch) and tilt (roll).
   */
  renderWithCameraMoves(items, f) {
    const c = this.state.camera;
    this.punch *= Math.pow(0.004, f.dt); // ~0.25 s decay
    const lead = items.find((it) => it.phase === 'active') || items[0];
    const track = Math.min(1, Math.max(0, c.track || 0));
    if (lead) {
      const goal = tmpVec.set(lead.point.x, lead.point.y, lead.point.z).add(this.content.position);
      if (!this.trackPt || f.snap) this.trackPt = goal.clone();
      else this.trackPt.lerp(goal, 1 - Math.pow(1 - Math.min(0.9, c.trackSpeed ?? 0.06), f.dt * 60));
    }
    const punch = (c.punch || 0) * this.punch;
    const mv = cameraMove(c, { time: f.time ?? 0, progress: f.progress ?? 0, bpm: f.bpm ?? 120 });
    const roll = THREE.MathUtils.degToRad((c.roll || 0) + mv.roll);
    if (mv.flare) this.bloom.strength *= 1 + 0.8 * mv.flare; // the glow flares at the cut to the final shot
    // fade to black (dim > 0) or white-out (dim < 0) at the very end: exposure, through tone mapping
    const r = this.renderer, base = this.state.visual.exposure ?? 1;
    if (mv.dim) {
      if (r.toneMapping === THREE.NoToneMapping) r.toneMapping = THREE.LinearToneMapping;
      r.toneMappingExposure = base * (mv.dim > 0 ? Math.max(0, 1 - mv.dim) : 1 - mv.dim);
      this.dimmed = true;
    } else if (this.dimmed) {
      this.dimmed = false;
      r.toneMapping = this.state.visual.tone === 'soft' ? THREE.ACESFilmicToneMapping : base !== 1 ? THREE.LinearToneMapping : THREE.NoToneMapping;
      r.toneMappingExposure = base;
    }
    if (!track && punch < 1e-4 && !roll && !mv.active) { this.composer.render(f.dt); return; }

    const is3d = this.state.mode === '3d';
    const cam = this.camera;
    const target = (is3d ? this.perspControls : this.orthoControls).target;
    const saved = { p: cam.position.clone(), q: cam.quaternion.clone(), zoom: cam.zoom, fov: cam.fov };
    const factor = mv.zoom * (1 + 0.14 * punch); // the zoom of this frame, relative to the user's camera
    const off = new THREE.Vector3();
    if (track && this.trackPt) off.copy(this.trackPt).sub(target).multiplyScalar(track);
    if (!is3d) off.z = 0;
    // drift and shake: fractions of the visible frame, along the camera's own right and up
    if (mv.dx || mv.dy) {
      cam.updateMatrixWorld();
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      let halfH, halfW;
      if (is3d) { halfH = cam.position.distanceTo(target) * Math.tan(THREE.MathUtils.degToRad(saved.fov) / 2) / factor; halfW = halfH * cam.aspect; }
      else { halfH = (cam.top - cam.bottom) / 2 / (saved.zoom * factor); halfW = (cam.right - cam.left) / 2 / (saved.zoom * factor); }
      off.addScaledVector(right, mv.dx * 2 * halfW).addScaledVector(up, mv.dy * 2 * halfH);
    }
    cam.position.add(off);
    cam.lookAt(tmpVec.copy(target).add(off));
    if (roll) cam.rotateZ(roll);
    if (factor !== 1) {
      if (is3d) cam.fov = saved.fov / factor;
      else cam.zoom = saved.zoom * factor;
      cam.updateProjectionMatrix();
    }
    this.composer.render(f.dt);
    cam.position.copy(saved.p);
    cam.quaternion.copy(saved.q);
    if (factor !== 1) {
      if (is3d) cam.fov = saved.fov; else cam.zoom = saved.zoom;
      cam.updateProjectionMatrix();
    }
  }

  /** PNG snapshot of the current frame. */
  snapshot() {
    this.composer.render(0);
    return this.canvas.toDataURL('image/png');
  }
}
