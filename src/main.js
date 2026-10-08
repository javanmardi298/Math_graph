/**
 * Math-Melody Visualizer — app entry point.
 *
 * Owns the transport clock and the per-frame loop:
 *   clock → keyframes → each layer's point → (renderer, synth, drums, overlay, recorder)
 * The clock advances on the audio hardware clock while playing, so picture and
 * sound stay locked together.
 *
 * Every "what does it sound like at time T" question goes through voicesAt(T),
 * so live playback, the WAV render, the MIDI export and server renders agree.
 *
 * With ?render=1 in the URL the app runs headless for scripts/render.mjs:
 * no animation loop, and window.__mmv renders exact frames on demand.
 */
import { store } from './state.js';
import { BUILTIN_PRESETS } from './presets.js';
import { CompiledLayer } from './math/layers.js';
import { gridAt, barsToSeconds } from './math/rhythm.js';
import { layerTiming as seqTiming } from './math/sequence.js';
import { AudioEngine } from './audio/engine.js';
import { voiceFrame, hasSolo } from './audio/sonify.js';
import { DrumScanner } from './audio/drum-scanner.js';
import { BufferAnalyser } from './audio/buffer-analyser.js';
import { valuesAt, applyValues, upsertKey, readValue, describe } from './anim/keyframes.js';
import { noteName, midiToFreq } from './math/music.js';
import { Visualizer } from './render/visualizer.js';
import { Panels, PALETTES } from './ui/panels.js';
import { Timeline } from './ui/timeline.js';
import { drawOverlay } from './ui/overlay.js';
import { h, bindPath, segmented, slider, number, toggle, refreshAll } from './ui/controls.js';
import { Recorder, download, pickFormat, setDownloadNotifier } from './export/recorder.js';
import { renderVideo, canRenderVideo } from './export/video-render.js';
import { LayoutEditor } from './ui/layout-editor.js';
import { writeMidi, samplesToNotes } from './export/midi.js';
import { audioBufferToWav } from './export/wav.js';

const $ = (id) => document.getElementById(id);
const SESSION_KEY = 'mmv.session.v1';
const RENDER_MODE = new URLSearchParams(location.search).has('render');
/** Build id of the published Artifact (set by scripts/build-artifact.mjs); "local" on localhost. */
const BUILD = window.MMV_BUILD || 'local';

/* ------------------------------------------------------------------ setup */

const stage = $('stage');
const overlay = $('overlay');
const og = overlay.getContext('2d');

/* ------------------------------------------------- graphics robustness */

// A GPU that keeps dropping the WebGL context must not trap the user in a reload
// loop: count losses shortly after start-up and switch to safe graphics mode.
const GPU_KEY = 'mmv.gpu.v1';
const readGpu = () => { try { return JSON.parse(localStorage.getItem(GPU_KEY)) || {}; } catch { return {}; } };
const writeGpu = (v) => { try { localStorage.setItem(GPU_KEY, JSON.stringify(v)); } catch { /* storage blocked */ } };
const gpu = { early: 0, safe: false, ...readGpu() };
const SAFE_GPU = gpu.safe || new URLSearchParams(location.search).has('safe');
const bootAt = performance.now();
let unloading = false;
window.addEventListener('pagehide', () => { unloading = true; }); // registered before the renderer's own handler

/** Name of the GPU WebGL runs on (for the error screen), using a throwaway context. */
function gpuName() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    if (!gl) return 'WebGL is not available in this browser right now.';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return `GPU: ${name}${/swiftshader|llvmpipe|software|basic render/i.test(name) ? ' (software: hardware acceleration is not active)' : ''}`;
  } catch (e) {
    return `GPU check failed: ${e.message}`;
  }
}

function showFatal(reason) {
  $('fatal').hidden = false;
  $('loading').hidden = true;
  const name = gpuName();
  const blocked = name.startsWith('WebGL is not available');
  $('fatal-reason').textContent = blocked
    ? `${reason} WebGL is switched off for this whole browser: browsers do that after the GPU crashes several times. Restart the browser completely by typing chrome://restart (Edge: edge://restart) in the address bar; just closing the windows is not enough when it keeps running in the background. If it still fails, restart the computer. The video export now uses the CPU encoder, which avoids this crash.`
    : reason;
  $('fatal-gpu').textContent = `${name} · ${SAFE_GPU ? 'safe graphics mode was on' : 'full quality mode'} · build ${BUILD}`;
}
$('fatal-reload').addEventListener('click', () => location.reload());
$('fatal-safe').addEventListener('click', () => { writeGpu({ early: 0, safe: true }); location.reload(); });
$('fatal-reset').addEventListener('click', () => {
  try { localStorage.removeItem('mmv.session.v1'); localStorage.removeItem('mmv.theme'); } catch { /* ignore */ }
  writeGpu({ early: 0, safe: false });
  location.reload();
});

let viz;
try {
  viz = new Visualizer($('gl-host'), store.state, { safe: SAFE_GPU, smaa: !new URLSearchParams(location.search).has('nosmaa') });
} catch (err) {
  showFatal(`WebGL could not start (${err.message}).`);
  throw err;
}
viz.onContextLost = () => {
  if (unloading) return; // our own clean-up on page exit, not a crash
  if (clock.playing) pause();
  saveSessionNow();
  if (exporting.busy) {
    // The GPU died while exporting: stop the export, never use the GPU video encoder
    // again here, and start the next session in safe graphics mode.
    if (exporting.token) exporting.token.cancelled = true;
    if ($('render-dialog').open) $('render-dialog').close();
    gpu.encoderCrash = true;
    gpu.safe = true;
    writeGpu(gpu);
    showFatal('The GPU stopped responding during the video export. The next start uses safe graphics mode and the CPU video encoder. Your work is saved.');
    return;
  }
  if (performance.now() - bootAt < 20000) {
    gpu.early = (gpu.early || 0) + 1;
    if (gpu.early >= 2) gpu.safe = true;
    writeGpu(gpu);
  }
  showFatal(gpu.safe && !SAFE_GPU
    ? 'The GPU dropped the graphics context again right after starting. The next start will use safe graphics mode. Your work is saved.'
    : 'The GPU dropped the graphics context (driver reset or out of memory). Your work is saved.');
};
// If the browser hands the GPU back, just reload: all work is saved.
viz.canvas.addEventListener('webglcontextrestored', () => location.reload());
// Running fine for a while clears the crash counter.
setTimeout(() => { if (gpu.early) { gpu.early = 0; writeGpu(gpu); } }, 20000);
if (SAFE_GPU) {
  $('safe-badge').hidden = false;
  $('safe-badge').addEventListener('click', () => { writeGpu({ early: 0, safe: false }); location.reload(); });
}

const audio = new AudioEngine();
const recorder = new Recorder();
const scanner = new DrumScanner();
/** @type {Map<string, CompiledLayer>} */
const compiled = new Map();

const clock = { pos: 0, prevPos: 0, playing: false, scrubbing: false, lastWall: performance.now() / 1000, lastAudio: 0, snap: true, autoStop: false, keyTime: null };
const notes = new Map(); // layer id → current midi (for HUD/caption)
const exporting = { busy: false }; // the live loop pauses while a video export draws frames

/* --------------------------------------------------------------- toasts */

setDownloadNotifier((msg) => toast(msg, 4500));

let toastTimer;
function toast(msg, ms = 3200) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

/* ---------------------------------------------------- compile & rebuild */

const evalCtx = (t = clock.pos) => ({ t, params: store.state.params, view: store.state.view });
const duration = () => Math.max(0.5, store.state.transport.duration);

/** Where `layer` is at timeline time `time` (see math/sequence.js). */
const layerTiming = (layer, time) =>
  seqTiming(store.state.layers, layer, time, duration(), store.state.sequence.enabled);

/** The layer currently playing in sequence mode (or null in together mode). */
function activeLayerAt(time) {
  if (!store.state.sequence.enabled) return null;
  return store.state.layers.find((l) => l.enabled && layerTiming(l, time).phase === 'active') || null;
}

function compileLayer(layer) {
  const next = new CompiledLayer(layer);
  const prev = compiled.get(layer.id);
  // Keep drawing the last good formula while the user is mid-edit.
  if (!next.ok && prev && prev.layer.type === layer.type) {
    prev.errors = next.errors;
    prev.layer = layer;
    return prev;
  }
  compiled.set(layer.id, next);
  return next;
}

function rebuildLayer(layer) {
  const c = compileLayer(layer);
  if (layer.enabled) viz.rebuildLayer(layer.id, c, evalCtx());
  panels?.showErrors(layer.id, c.errors);
}

function rebuildAll() {
  const layers = store.state.layers;
  for (const id of [...compiled.keys()]) if (!layers.some((l) => l.id === id)) compiled.delete(id);
  viz.syncLayers(layers);
  for (const l of layers) rebuildLayer(l);
  audio.syncLayers(layers);
  updateTimelineCurves();
}

/** Sample every layer's pitch for the timeline mini-map. */
function updateTimelineCurves() {
  if (RENDER_MODE) return;
  const { view } = store.state;
  const ctx = evalCtx();
  const N = 400;
  const curves = [];
  for (const l of store.state.layers) {
    const c = compiled.get(l.id);
    if (!c || !l.enabled) continue;
    const ys = new Float32Array(N);
    const p = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < N; i++) {
      const lt = layerTiming(l, (i / (N - 1)) * duration());
      if (l.mute || lt.phase !== 'active') { ys[i] = NaN; continue; }
      c.at(lt.u, ctx, p);
      ys[i] = Math.min(Math.max((p.y - view.yMin) / (view.yMax - view.yMin), 0), 1);
    }
    curves.push({ color: l.color, ys });
  }
  timeline.setCurves(curves);
}

/* ------------------------------------------------------------- keyframes */

let applyingKeys = false;
const hasTracks = () => Object.keys(store.state.keyframes.tracks).length > 0;
const hasPoseTrack = () => !!store.state.keyframes.tracks['camera.pose']?.length;

/**
 * Write every animated value for `time` into the state.
 * With effects=false only the values change (used inside offline renders, where
 * rebuilding geometry thousands of times would be wasted work).
 */
function applyKeyframesAt(time, effects = true) {
  if (!hasTracks()) return;
  applyingKeys = true;
  const values = valuesAt(store.state.keyframes.tracks, time);
  const changed = applyValues(store.state, values);
  applyingKeys = false;
  if (!effects) return;
  if (changed.has('params')) {
    for (const l of store.state.layers) if (l.enabled && compiled.get(l.id)?.usesParams) viz.rebuildLayer(l.id, compiled.get(l.id), evalCtx(time));
  }
  for (const c of changed) {
    if (!c.startsWith('layer:')) continue;
    const l = store.state.layers[+c.slice(6)];
    if (l?.enabled && compiled.get(l.id)) viz.rebuildLayer(l.id, compiled.get(l.id), evalCtx(time));
  }
  if (changed.has('visual') || changed.has('camera') || [...changed].some((c) => c.startsWith('layer:'))) viz.applySettings();
  if (changed.has('audio')) audio.applySettings(store.state.audio);
  if (changed.has('pose')) viz.setPose(values.get('camera.pose'));
  if (changed.size && !RENDER_MODE) refreshControlsSoon();
}

let refreshTimer = null;
function refreshControlsSoon() {
  if (refreshTimer) return;
  refreshTimer = setTimeout(() => { refreshTimer = null; refreshAll(); }, 200);
}

/** Add (or replace) a key for `path` at the playhead with its current value. */
function addKey(path, ease = 'smooth') {
  const value = path === 'camera.pose' ? viz.getPose() : readValue(store.state, path);
  if (value === undefined) return toast('That property no longer exists.');
  upsertKey(store.state.keyframes.tracks, path, clock.pos, value, ease);
  keyframesChanged();
  toast(`Key added for ${describe(store.state, path)?.label || path} at ${clock.pos.toFixed(2)} s.`);
}

function keyframesChanged() {
  panels.renderKeyframes();
  timeline.draw();
  clock.keyTime = null; // re-apply on the next frame
  saveSession();
}

/** Run `fn` with keyframes evaluated at arbitrary times, then restore the playhead's values. */
function withTimeTravel(fn) {
  try { return fn(); } finally { applyKeyframesAt(clock.pos, true); }
}

/* -------------------------------------------------- sound at any time T */

/**
 * Voice frames (pitch, gain, pan per layer) for timeline time `time`.
 * With the beat grid on, the curve is sampled at the start of the current step
 * and the note is cut after `gate` of the step.
 */
function voicesAt(time) {
  const { layers, transport, rhythm } = store.state;
  const solo = hasSolo(layers);
  const g = rhythm.enabled ? gridAt(time, rhythm, transport.bpm) : null;
  const tq = g ? g.start : time;
  const ctx = evalCtx(tq);
  const p = { x: 0, y: 0, z: 0 };
  const out = [];
  for (const l of layers) {
    const c = compiled.get(l.id);
    if (!c) continue;
    const lt = layerTiming(l, tq);
    c.at(lt.u, ctx, p);
    const f = voiceFrame(l, p, store.state, solo);
    if (lt.phase !== 'active') f.gain = 0; // in sequence mode only the current layer sounds
    if (g) {
      f.step = g.index;
      if (g.phase > rhythm.gate) f.gain = 0;
    }
    out.push(f);
  }
  return out;
}

/** The layer that drives the drums (the playing one in sequence mode). */
function drumSourceLayer(time = clock.pos) {
  const active = activeLayerAt(time);
  if (active) return active;
  const { layers, drums } = store.state;
  const l = layers[drums.source];
  return l?.enabled ? l : layers.find((x) => x.enabled);
}

/** Pitch of the drum source layer at `time` (y in graph units). */
function drumSampler(applyKeys = false) {
  const fixed = drumSourceLayer();
  const p = { x: 0, y: 0, z: 0 };
  return (time) => {
    // In sequence mode the drums follow whichever layer is playing.
    const l = activeLayerAt(time) || fixed;
    const c = l && compiled.get(l.id);
    if (!c) return NaN;
    if (applyKeys) applyKeyframesAt(time, false);
    c.at(layerTiming(l, time).u, evalCtx(time), p);
    return p.y;
  };
}

function drumCtx() {
  const { view, transport, rhythm } = store.state;
  return { mid: (view.yMin + view.yMax) / 2, range: view.yMax - view.yMin, bpm: transport.bpm, rhythm };
}

/** Every drum hit over the whole timeline (offline renders and MIDI). */
function drumEventsFull() {
  if (!store.state.drums.enabled) return [];
  return withTimeTravel(() => new DrumScanner().scan(0, duration(), drumSampler(true), store.state.drums, drumCtx()));
}

/* ------------------------------------------------------- state reactions */

function applyStageAspect() {
  const a = store.state.visual.aspect;
  const wrap = $('stage-wrap');
  if (a === 'fill' || recorder.active || RENDER_MODE) {
    if (!recorder.active) { stage.style.width = ''; stage.style.height = ''; stage.classList.remove('framed'); }
    return;
  }
  const [aw, ah] = a.split(':').map(Number);
  const W = wrap.clientWidth, H = wrap.clientHeight;
  const scale = Math.min(W / aw, H / ah);
  stage.style.width = `${Math.floor(aw * scale)}px`;
  stage.style.height = `${Math.floor(ah * scale)}px`;
  stage.classList.add('framed');
}
new ResizeObserver(applyStageAspect).observe($('stage-wrap'));

function resizeOverlay() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  overlay.width = Math.max(1, stage.clientWidth * dpr);
  overlay.height = Math.max(1, stage.clientHeight * dpr);
}
new ResizeObserver(resizeOverlay).observe(stage);

function applyTheme() {
  document.documentElement.dataset.theme = store.state.theme;
  $('theme-btn').setAttribute('aria-label', store.state.theme === 'dark' ? 'Switch to day mode' : 'Switch to night mode');
  $('theme-btn').textContent = store.state.theme === 'dark' ? '☀' : '☾';
  try { localStorage.setItem('mmv.theme', store.state.theme); } catch { /* ignore */ }
  timeline.draw();
}

function applyDrumVolume() {
  if (audio.ready) audio.setDrumVolume(store.state.drums.enabled ? store.state.drums.volume : 0);
}

function applyAll() {
  viz.state = store.state;
  viz.applySettings();
  viz.buildGrid();
  viz.setMarkerImage(store.state.visual.marker.image);
  audio.applySettings(store.state.audio);
  applyDrumVolume();
  rebuildAll();
  applyTheme();
  applyStageAspect();
  viz.resetCamera();
  clock.keyTime = null;
  $('project-name').value = store.state.name;
}

store.on((path) => {
  if (path === '*') { applyAll(); panels.refresh(); clock.snap = true; saveSession(); return; }
  const [root, second, third] = path.split('.');

  // Auto-key: changing an animatable control while paused records a key at the playhead.
  if (!applyingKeys && store.state.keyframes.autoKey && !clock.playing && describe(store.state, path)) {
    upsertKey(store.state.keyframes.tracks, path, clock.pos, readValue(store.state, path));
    keyframesChanged();
  }

  switch (root) {
    case 'layers': {
      if (!second || ['enabled', 'style', 'type'].includes(third)) {
        // Structural change → rebuild cards + views.
        if (!second) { panels.renderLayers(); panels.renderKeyframes(); panels.renderRhythm?.(); }
        panels.renderSequence();
        rebuildAll();
      } else {
        const layer = store.state.layers.find((l) => l.id === second);
        if (!layer) break;
        if (third === 'exprs' || third === 'look') { rebuildLayer(layer); viz.restyle(); updateTimelineCurves(); }
        if (third === 'wave') audio.syncLayers(store.state.layers);
        if (third === 'mute') updateTimelineCurves();
        if (third === 'name') panels.renderKeyframes();
      }
      break;
    }
    case 'mode':
      viz.applySettings(); viz.buildGrid(); rebuildAll(); viz.resetCamera(); clock.snap = true;
      break;
    case 'view':
      viz.buildGrid(); rebuildAll(); viz.fitOrtho(true);
      break;
    case 'params':
      for (const l of store.state.layers) rebuildLayer(l);
      updateTimelineCurves();
      break;
    case 'visual':
      viz.applySettings();
      if (['background', 'gridColor', 'axesColor', 'showGrid', 'showAxes', 'showLabels'].includes(second)) viz.buildGrid();
      if (second === 'marker' && third === 'image') viz.setMarkerImage(store.state.visual.marker.image);
      if (second === 'aspect') applyStageAspect();
      if (second === 'drawMode') clock.snap = true;
      break;
    case 'camera':
      viz.applySettings();
      break;
    case 'audio':
      audio.applySettings(store.state.audio);
      break;
    case 'transport':
      if (second === 'duration') { updateTimelineCurves(); panels.renderSequence(); }
      if (second === 'duration' || second === 'bpm') { viz.buildGrid(); timeline.draw(); }
      break;
    case 'rhythm':
      viz.buildGrid();
      timeline.draw();
      break;
    case 'drums':
      applyDrumVolume();
      scanner.reset();
      break;
    case 'sequence':
      updateTimelineCurves();
      scanner.reset();
      clock.snap = true;
      panels.renderSequence();
      break;
    case 'keyframes':
      keyframesChanged();
      break;
    case 'overlay':
      if (second === 'texts') panels.renderTexts();
      break;
    case 'theme':
      applyTheme();
      break;
  }
  saveSession();
});

function saveSessionNow() {
  if (RENDER_MODE) return;
  clearTimeout(saveTimer);
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(store.snapshot())); } catch { /* storage blocked or full */ }
}

let saveTimer;
function saveSession() {
  if (RENDER_MODE) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(store.snapshot())); } catch { /* storage blocked or full */ }
  }, 600);
}

/* ------------------------------------------------------------- transport */

async function ensureAudio() {
  try {
    await audio.ensure();
  } catch (err) {
    toast(`Audio could not start: ${err.message}`);
  }
  audio.applySettings(store.state.audio);
  audio.syncLayers(store.state.layers);
  applyDrumVolume();
}

async function play() {
  await ensureAudio();
  if (clock.pos >= duration() - 1e-3) clock.pos = 0;
  clock.playing = true;
  clock.snap = true;
  clock.lastAudio = audio.now();
  clock.lastWall = performance.now() / 1000;
  updateTransportUI();
}

function pause() {
  clock.playing = false;
  audio.silence();
  updateTransportUI();
}

const togglePlay = () => (clock.playing ? pause() : play());

function seek(u) {
  clock.pos = Math.min(Math.max(u, 0), 1) * duration();
  clock.snap = true;
}

function updateTransportUI() {
  const b = $('play-btn');
  b.setAttribute('aria-label', clock.playing ? 'Pause' : 'Play');
  b.classList.toggle('is-playing', clock.playing);
  b.querySelector('.ico').textContent = clock.playing ? '❚❚' : '▶';
}

/* ---------------------------------------------------------- frame loop */

/**
 * Draw the scene at timeline time `time`. Shared by the live loop and server renders.
 * @returns {object[]} voice frames at that time
 */
function renderScene(time, { dt, now, playing, snap }) {
  const { layers } = store.state;
  const ctx = evalCtx(time);

  // Animated formulas (using t) are re-sampled every frame.
  for (const l of layers) {
    const c = compiled.get(l.id);
    if (l.enabled && c?.usesTime) viz.rebuildLayer(l.id, c, ctx);
  }
  const items = [];
  for (const l of layers) {
    const c = compiled.get(l.id);
    if (!c || !l.enabled) continue;
    const { u, phase } = layerTiming(l, time);
    items.push({ id: l.id, u, phase, point: c.at(u, ctx, { x: 0, y: 0, z: 0 }), compiled: c });
  }
  const frames = voicesAt(time);
  for (const f of frames) notes.set(f.id, f.gain > 0 ? f.midi : null);
  viz.render(items, ctx, { dt, now, snap, playing, pastMode: store.state.sequence.past, cameraLocked: hasPoseTrack() && (playing || RENDER_MODE) });
  return frames;
}

function frame() {
  requestAnimationFrame(frame);
  if (exporting.busy) return;
  const wall = performance.now() / 1000;
  let dt = Math.min(Math.max(wall - clock.lastWall, 0), 0.1);
  clock.lastWall = wall;
  const { transport } = store.state;
  const dur = duration();
  let wrapped = false;

  if (clock.playing) {
    // Prefer the audio hardware clock: it never drifts from what you hear.
    const aNow = audio.now();
    const adt = aNow - clock.lastAudio;
    clock.lastAudio = aNow;
    if (audio.ready && audio.ctx.state === 'running' && adt > 0 && adt < 0.25) dt = adt;
    clock.pos += dt * transport.speed;
    if (clock.pos >= dur) {
      if (clock.autoStop && recorder.active) { clock.pos = dur; stopRecording(); pause(); }
      else if (transport.loop) { clock.pos %= dur; wrapped = true; }
      else { clock.pos = dur; pause(); }
    }
  }

  // Keyframes follow the playhead (only when it moved, so paused edits stick).
  if (clock.pos !== clock.keyTime || clock.snap) {
    applyKeyframesAt(clock.pos);
    clock.keyTime = clock.pos;
  }

  // Drums: scan the curve between the last frame and this one.
  if (clock.playing && store.state.drums.enabled) {
    let from = clock.prevPos;
    if (wrapped || clock.snap) { scanner.reset(); from = wrapped ? 0 : clock.pos; }
    const hits = scanner.scan(from, clock.pos, drumSampler(), store.state.drums, drumCtx());
    const src = drumSourceLayer();
    for (const e of hits) {
      audio.drum(e.kind, e.vel);
      if (store.state.drums.pulse) viz.pulse(e.kind, src?.id);
    }
  }
  clock.prevPos = clock.pos;

  const sounding = clock.playing || clock.scrubbing;
  const frames = renderScene(clock.pos, { dt, now: wall, playing: sounding, snap: clock.snap });
  audio.update(frames, { playing: sounding, glide: store.state.audio.glide, articulation: store.state.audio.articulation });
  clock.snap = false;

  og.clearRect(0, 0, overlay.width, overlay.height);
  layoutEditor.update(drawOverlay(og, overlay.width, overlay.height, overlayData()));
  if (recorder.active) {
    recorder.composite();
    $('rec-time').textContent = fmtRec(recorder.elapsed);
  }
  timeline.setProgress(Math.min(clock.pos / dur, 1), clock.pos);
  updateHud(frames);
}

function overlayData(analysis = null, time = clock.pos) {
  const light = isLight(store.state.visual.background);
  const exportingNow = analysis != null;
  return {
    state: store.state,
    layers: store.state.layers,
    time,
    notes: (clock.playing || clock.scrubbing || exportingNow || RENDER_MODE) && store.state.visual.showNotes ? notes : new Map(),
    phases: new Map(store.state.layers.map((l) => [l.id, layerTiming(l, time).phase])),
    spectrum: analysis ? analysis.spectrum : audio.spectrum(),
    waveform: analysis ? analysis.waveform : audio.waveform(),
    ui: { fg: light ? '#1a1c26' : '#eef2ff', accent: '#22e4ff', accent2: light ? '#e0245e' : '#ff3d9a', light },
  };
}

function isLight(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140;
}

let hudKey = '';
function updateHud(frames) {
  $('hud').hidden = !store.state.visual.showNotes;
  const parts = frames
    .map((f) => {
      const l = store.state.layers.find((x) => x.id === f.id);
      if (!l?.enabled) return null;
      const on = (clock.playing || clock.scrubbing) && f.midi != null && f.gain > 0;
      return { color: l.color, text: on ? `${noteName(f.midi)} · ${Math.round(midiToFreq(f.midi))} Hz` : '—' };
    })
    .filter(Boolean);
  const key = parts.map((p) => p.color + p.text).join('|');
  if (key === hudKey) return;
  hudKey = key;
  $('hud').replaceChildren(...parts.map((p) => h('span.hud-note', { style: `--c:${p.color}` }, p.text)));
}

const fmtRec = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* --------------------------------------------------------------- record */

/** Export size for the chosen resolution and frame. `fill` uses the stage's shape (16:9 when unknown). */
function recordSize() {
  const short = { '720p': 720, '1080p': 1080, '1440p': 1440, '2160p': 2160 }[store.state.record.resolution] || 1080;
  const a = store.state.visual.aspect;
  let ratio;
  if (a === 'fill') ratio = stage.clientWidth && stage.clientHeight ? stage.clientWidth / stage.clientHeight : 16 / 9;
  else { const [w, hh] = a.split(':').map(Number); ratio = w / hh; }
  let w, hh;
  if (ratio >= 1) { hh = short; w = short * ratio; } else { w = short; hh = short / ratio; }
  const even = (n) => Math.round(n / 2) * 2;
  return { w: even(Math.min(w, 4096)), h: even(Math.min(hh, 4096)) };
}

async function startRecording() {
  if (!pickFormat()) return toast('This browser cannot record video. Try Chrome, Edge or Firefox.');
  await play();
  const size = recordSize();
  viz.setFixedSize(size);
  const { fromStart, fps } = store.state.record;
  if (fromStart) { seek(0); clock.autoStop = true; } else clock.autoStop = false;
  try {
    recorder.start({
      source: viz.canvas,
      audio: audio.stream,
      fps,
      drawOverlay: (g, w, hh) => drawOverlay(g, w, hh, overlayData()),
    });
  } catch (err) {
    viz.setFixedSize(null);
    return toast(err.message, 6000);
  }
  document.body.classList.add('recording');
  document.querySelectorAll('.record-btn').forEach((b) => { b.lastChild.textContent = 'Stop recording'; });
  toast(`Recording ${size.w}×${size.h} at ${fps} fps${fromStart ? ' · stops after one pass' : ''}. Press R to stop.`);
}

async function stopRecording() {
  if (!recorder.active) return;
  const res = await recorder.stop();
  viz.setFixedSize(null);
  clock.autoStop = false;
  document.body.classList.remove('recording');
  document.querySelectorAll('.record-btn').forEach((b) => { b.lastChild.textContent = 'Start recording'; });
  applyStageAspect();
  if (!res || !res.blob.size) return toast('Recording came out empty. Try a different browser.');
  showResult(res.blob, `${fileBase()}.${res.ext}`, 'video');
}

const toggleRecord = () => (recorder.active ? stopRecording() : startRecording());

/** File name (without extension) for exports: the Export tab's name, else the project name. Any language is fine. */
function fileBase() {
  const raw = (store.state.record.fileName || store.state.name || 'math-melody').trim();
  return raw.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ').slice(0, 80).trim() || 'math-melody';
}

/** Show a finished export with a preview, an editable file name and a download button. */
function showResult(src, filename, kind, sizeBytes, note = '') {
  const dlg = $('result-dialog');
  const isBlob = src instanceof Blob;
  const url = isBlob ? URL.createObjectURL(src) : src;
  const media = kind === 'video' ? h('video', { src: url, controls: true, playsinline: true })
    : kind === 'audio' ? h('audio', { src: url, controls: true })
      : kind === 'image' ? h('img', { src: url, alt: 'Snapshot preview' }) : null;
  $('result-media').replaceChildren(...(media ? [media] : []));
  const bytes = isBlob ? src.size : sizeBytes;
  const dot = filename.lastIndexOf('.');
  const ext = dot > 0 ? filename.slice(dot) : '';
  $('result-name').value = dot > 0 ? filename.slice(0, dot) : filename;
  $('result-ext').textContent = ext;
  $('result-info').textContent = [bytes ? `${(bytes / 1048576).toFixed(2)} MB` : '', note].filter(Boolean).join(' · ');
  $('result-download').onclick = async () => {
    const name = ($('result-name').value.trim().replace(/[\\/:*?"<>|]+/g, '-') || fileBase()) + ext;
    download(isBlob ? src : await (await fetch(url)).blob(), name);
  };
  dlg.onclose = () => { if (isBlob) setTimeout(() => URL.revokeObjectURL(url), 1000); };
  dlg.showModal();
}

/* --------------------------------------------------------------- exports */

/** Render the whole timeline's audio (synth + drums + keyframed effects) offline. */
async function renderWavBuffer() {
  const { layers, audio: a, drums } = store.state;
  const enabled = layers.filter((l) => l.enabled);
  const dur = duration();
  const drumEvents = drumEventsFull();
  const tracks = Object.keys(store.state.keyframes.tracks);
  const audioAnimated = tracks.some((p) => p.startsWith('audio.'));
  try {
    return await AudioEngine.renderOffline({
      settings: structuredClone(a),
      layers: enabled,
      duration: dur,
      glide: a.glide,
      articulation: a.articulation,
      drumEvents,
      drumVolume: drums.enabled ? drums.volume : 0,
      frameAt: (time) => { applyKeyframesAt(time, false); return voicesAt(time); },
      settingsAt: audioAnimated ? (time) => { applyKeyframesAt(time, false); return structuredClone(store.state.audio); } : null,
    });
  } finally {
    applyKeyframesAt(clock.pos, true);
  }
}

async function exportWav() {
  if (!store.state.layers.some((l) => l.enabled)) return toast('Turn on at least one layer to export audio.');
  toast('Rendering audio…', 60000);
  try {
    const buf = await renderWavBuffer();
    toast('Audio ready.');
    showResult(audioBufferToWav(buf), `${fileBase()}.wav`, 'audio');
  } catch (err) {
    toast(`Audio render failed: ${err.message}`, 6000);
  }
}

const GM_DRUMS = { kick: 36, snare: 38, hat: 42, clap: 39 };

function exportMidi() {
  const { layers } = store.state;
  const enabled = layers.filter((l) => l.enabled);
  if (!enabled.length) return toast('Turn on at least one layer to export MIDI.');
  const step = 1 / 100;
  const dur = duration();
  const PROGRAM = { sine: 79, triangle: 73, square: 80, sawtooth: 81 };
  const samples = new Map(enabled.map((l) => [l.id, []]));
  withTimeTravel(() => {
    for (let time = 0; time < dur; time += step) {
      applyKeyframesAt(time, false);
      for (const f of voicesAt(time)) {
        samples.get(f.id)?.push({ time, midi: f.gain > 0 ? f.midi : null, vel: Math.min(127, 40 + f.gain * 100) });
      }
    }
  });
  const tracks = enabled.map((l, i) => ({
    name: l.name,
    channel: i,
    program: PROGRAM[l.wave] ?? 80,
    notes: samplesToNotes(samples.get(l.id), step, 0.03),
  }));
  const hits = drumEventsFull();
  if (hits.length) {
    tracks.push({
      name: 'Drums', channel: 9, program: 0,
      notes: hits.map((e) => ({ start: e.time, dur: 0.1, midi: GM_DRUMS[e.kind], vel: 70 + e.vel * 50 })),
    });
  }
  const bytes = writeMidi(tracks, store.state.transport.bpm || 120);
  download(new Blob([bytes], { type: 'audio/midi' }), `${fileBase()}.mid`);
  toast(`MIDI exported: ${tracks.reduce((n, t) => n + t.notes.length, 0)} notes in ${tracks.length} track${tracks.length > 1 ? 's' : ''}.`);
}

function snapshot() {
  viz.composer.render(0);
  const c = document.createElement('canvas');
  c.width = viz.canvas.width;
  c.height = viz.canvas.height;
  const g = c.getContext('2d');
  g.drawImage(viz.canvas, 0, 0);
  drawOverlay(g, c.width, c.height, overlayData());
  c.toBlob((blob) => blob && showResult(blob, `${fileBase()}.png`, 'image'), 'image/png');
}

function applyPalette(pal) {
  const v = store.state.visual;
  Object.assign(v, { background: pal.background, gridColor: pal.gridColor, axesColor: pal.axesColor });
  v.bloom.threshold = pal.threshold;
  store.state.layers.forEach((l, i) => {
    l.color = pal.layers[i % pal.layers.length];
    l.color2 = pal.layers[(i + 1) % pal.layers.length];
  });
  store.emit('*');
}

function loadPreset(pr) {
  const wasPlaying = clock.playing;
  store.load(pr);
  seek(0);
  if (wasPlaying) { audio.syncLayers(store.state.layers); applyDrumVolume(); }
  toast(`Preset “${store.state.name}” loaded.`);
}

function fitToBars(bars) {
  const secs = barsToSeconds(bars, store.state.transport.bpm);
  if (secs > 600) return toast('That would be longer than 10 minutes. Use fewer bars or a faster tempo.');
  store.set('transport.duration', +secs.toFixed(3));
  refreshAll();
  toast(`Length set to ${bars} bars (${secs.toFixed(2)} s).`);
}

async function auditionDrum(kind) {
  await ensureAudio();
  audio.setDrumVolume(store.state.drums.volume);
  audio.drum(kind, 1);
  viz.pulse(kind, drumSourceLayer()?.id);
  if (!store.state.drums.enabled) setTimeout(applyDrumVolume, 700);
}

/* ------------------------------------------------ frame-perfect video */

/**
 * Draws exact video frames for exports. Time advances by a fixed step, drum
 * pulses come from the precomputed hit list, and with subframes > 1 each frame
 * averages several moments of its exposure (a 180° film shutter): real motion
 * blur that makes fast curves look smooth instead of strobing.
 */
class FrameComposer {
  constructor({ width, height, fps, subframes = 1, analyser, hits }) {
    this.fps = fps;
    this.n = Math.max(1, subframes | 0);
    this.analyser = analyser;
    this.hits = hits;
    this.hitIndex = 0;
    this.last = 0;
    this.out = document.createElement('canvas');
    this.out.width = width;
    this.out.height = height;
    this.g = this.out.getContext('2d');
  }

  frame(i) {
    const { fps, n, g, out } = this;
    const t = i / fps;
    if (i === 0) { this.hitIndex = 0; this.last = 0; } // a retry with another encoder starts over
    const shutter = 0.5 / fps; // 180°
    for (let j = 0; j < n; j++) {
      const time = n === 1 ? t : Math.max(0, t - shutter * (1 - (j + 1) / n));
      const dt = i === 0 && j === 0 ? 1 / fps : Math.max(time - this.last, 1e-4);
      this.last = time;
      clock.pos = time;
      applyKeyframesAt(time);
      if (store.state.drums.pulse) {
        const src = drumSourceLayer(time);
        while (this.hitIndex < this.hits.length && this.hits[this.hitIndex].time <= time + 1e-9) viz.pulse(this.hits[this.hitIndex++].kind, src?.id);
      }
      renderScene(time, { dt, now: time, playing: true, snap: i === 0 && j === 0 });
      // A lost GPU context draws nothing: stop instead of encoding black frames.
      if (viz.renderer.getContext().isContextLost()) throw new Error('graphics context lost');
      g.globalAlpha = 1 / (j + 1); // running average of the sub-frames
      g.drawImage(viz.canvas, 0, 0, out.width, out.height);
    }
    g.globalAlpha = 1;
    drawOverlay(g, out.width, out.height, overlayData(this.analyser?.at(t) ?? { spectrum: null, waveform: null }, t));
    return out;
  }
}

const fmtEta = (s) => (s >= 90 ? `${Math.round(s / 60)} min` : `${Math.max(1, Math.round(s))} s`);

/** Ask the local server (npm start + ffmpeg) to convert a VP9/Opus file to H.264/AAC. */
async function transcodeToH264(blob) {
  const r = await fetch('api/transcode', { method: 'POST', body: blob, headers: { 'Content-Type': 'video/mp4' } });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
  return r.blob();
}

/** Render the whole timeline to a smooth MP4 in this browser (GPU + hardware encoder). */
async function exportVideo() {
  if (exporting.busy) return;
  if (!canRenderVideo()) return toast('This browser cannot encode video. Use Chrome or Edge (or Live capture in the Export tab).', 7000);
  if (recorder.active) await stopRecording();
  const wasPlaying = clock.playing;
  if (wasPlaying) pause();
  const { fps, subframes, quality } = store.state.record;
  const size = recordSize();
  const frames = Math.ceil(duration() * fps);
  const dlg = $('render-dialog'), bar = $('render-bar'), stats = $('render-stats');
  const token = { cancelled: false };
  exporting.token = token;
  const cancel = () => { token.cancelled = true; stats.textContent = 'Cancelling…'; };
  $('render-cancel').onclick = cancel;
  dlg.oncancel = (e) => { e.preventDefault(); cancel(); };
  $('render-title').textContent = `Rendering ${size.w}×${size.h} · ${fps} fps${subframes > 1 ? ` · motion blur ×${subframes}` : ''}`;
  bar.value = 0;
  stats.textContent = 'Rendering the soundtrack…';
  $('render-encoder').textContent = '';
  dlg.showModal();
  exporting.busy = true;
  const savedPos = clock.pos;
  try {
    await document.fonts?.ready;
    await new Promise((r) => setTimeout(r, 30));
    const buf = await renderWavBuffer();
    if (token.cancelled) throw new Error('cancelled');
    viz.setFixedSize(size);
    const comp = new FrameComposer({ width: size.w, height: size.h, fps, subframes, analyser: new BufferAnalyser(buf), hits: drumEventsFull() });
    const res = await renderVideo({
      width: size.w, height: size.h, fps, frames, quality, token, audio: buf,
      drawFrame: (i) => comp.frame(i),
      onStatus: (msg) => { $('render-encoder').textContent = msg; },
      allowGpu: store.state.record.gpuEncoder && !gpu.encoderCrash,
      onProgress: (p) => {
        bar.value = p.frame / p.frames;
        stats.textContent = `Frame ${p.frame} / ${p.frames} · ${p.fps.toFixed(1)} frames/s · about ${fmtEta(p.eta)} left`;
      },
    });
    let blob = res.blob;
    let note = `${size.w}×${size.h} · ${fps} fps · ${res.encoder}${res.audio ? ` + ${res.audio}` : ''}`;
    if (res.video !== 'H.264' || (res.audio && res.audio !== 'AAC')) {
      stats.textContent = 'Converting to H.264 / AAC with ffmpeg for maximum compatibility…';
      try {
        blob = await transcodeToH264(blob);
        note = `${size.w}×${size.h} · ${fps} fps · H.264 + AAC`;
      } catch {
        note += ' · plays in Chrome, VLC and on YouTube (run npm start with ffmpeg installed for an H.264 copy)';
      }
    }
    dlg.close();
    showResult(blob, `${fileBase()}.mp4`, 'video', null, note);
  } catch (err) {
    dlg.close();
    if (err.message === 'graphics context lost') {
      gpu.encoderCrash = true;
      gpu.safe = true;
      writeGpu(gpu);
    }
    if (!$('fatal').hidden) return; // the GPU loss screen already explains what happened
    toast(err.message === 'cancelled' ? 'Export cancelled.' : `Video export failed: ${err.message}`, 8000);
  } finally {
    viz.setFixedSize(null);
    exporting.busy = false;
    clock.pos = savedPos;
    clock.snap = true;
    clock.keyTime = null;
    scanner.reset();
    applyStageAspect();
    if (wasPlaying) play();
  }
}

/* ------------------------------------------------------------- UI wiring */

const timeline = new Timeline({
  onSeek: (u) => seek(u),
  onScrubState: async (on) => {
    clock.scrubbing = on;
    if (on && !audio.ready) await ensureAudio();
    if (!on && !clock.playing) audio.silence();
  },
});

const panels = new Panels({
  toast,
  errorsFor: (id) => compiled.get(id)?.errors || {},
  applyPalette,
  loadPreset,
  resetCamera: () => viz.resetCamera(),
  toggleRecord,
  exportMidi,
  exportWav,
  snapshot,
  videoFormat: pickFormat,
  addKey,
  keyframesChanged,
  seekTo: (time) => { seek(time / duration()); },
  playheadTime: () => clock.pos,
  fitToBars,
  auditionDrum,
  exportVideo,
  canRenderVideo,
  recordSize,
  fileBase,
  setLayoutEditing: (on) => setLayoutEditing(on),
});

// Layout editor on the stage
const layoutEditor = new LayoutEditor(stage, overlay, {
  toast,
  onEditText: (id) => panels.focusText(id),
});
function setLayoutEditing(on) {
  layoutEditor.setEnabled(on);
  $('edit-layout-btn').setAttribute('aria-pressed', String(on));
  panels.syncLayoutToggle?.(on);
}
$('edit-layout-btn').addEventListener('click', () => setLayoutEditing(!layoutEditor.enabled));

// Top bar
$('mode-slot').append(segmented(bindPath('mode'), [['2d', '2D', '2D graph (M)'], ['3d', '3D', '3D space (M)']], { label: 'View mode' }));
$('play-btn').addEventListener('click', togglePlay);
$('rewind-btn').addEventListener('click', () => seek(0));
$('topbar-record').addEventListener('click', exportVideo);
$('theme-btn').addEventListener('click', () => toggleTheme());
$('cinema-btn').addEventListener('click', () => document.body.classList.toggle('cinema'));
$('help-btn').addEventListener('click', () => $('help-dialog').showModal());
$('snapshot-btn').addEventListener('click', snapshot);
$('fullscreen-btn').addEventListener('click', () => {
  const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
  p?.catch?.(() => toast('Full screen is not available here.'));
});
$('project-name').addEventListener('change', (e) => { store.state.name = e.target.value.trim() || 'Untitled'; saveSession(); });
for (const side of ['left', 'right']) {
  $(`collapse-${side}`).addEventListener('click', () => togglePanel(side));
}
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

function togglePanel(side) {
  const app = $('app');
  app.classList.toggle(`${side}-collapsed`);
  const collapsed = app.classList.contains(`${side}-collapsed`);
  $(`collapse-${side}`).setAttribute('aria-expanded', String(!collapsed));
}

function toggleTheme() {
  const next = store.state.theme === 'dark' ? 'light' : 'dark';
  // Swap the canvas palette too, so day mode isn't a white UI around a black hole.
  const pal = PALETTES.find((p) => p.name === (next === 'light' ? 'Paper' : 'Neon Night'));
  const v = store.state.visual;
  Object.assign(v, { background: pal.background, gridColor: pal.gridColor, axesColor: pal.axesColor });
  v.bloom.threshold = pal.threshold;
  store.state.theme = next;
  store.emit('*');
}

// Timeline controls
$('speed-slot').append(slider('Speed', bindPath('transport.speed'), { min: 0.1, max: 5, step: 0.05, fmt: (v) => `${(+v).toFixed(2)}×` }));
$('duration-slot').append(number('Length (s)', bindPath('transport.duration'), { min: 1, max: 600, step: 1 }));
$('loop-slot').append(toggle('Loop', bindPath('transport.loop')));

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const dur = duration();
  switch (e.key) {
    case ' ': e.preventDefault(); togglePlay(); break;
    case 'r': case 'R': toggleRecord(); break;
    case 'k': case 'K': addKey('camera.pose'); break;
    case 'Home': case '0': seek(0); break;
    case 'ArrowLeft': if (e.target === document.body) { seek((clock.pos - 1) / dur); e.preventDefault(); } break;
    case 'ArrowRight': if (e.target === document.body) { seek((clock.pos + 1) / dur); e.preventDefault(); } break;
    case 'm': case 'M': store.set('mode', store.state.mode === '2d' ? '3d' : '2d'); refreshAll(); break;
    case 't': case 'T': toggleTheme(); break;
    case 'h': case 'H': document.body.classList.toggle('cinema'); break;
    case 'f': case 'F': $('fullscreen-btn').click(); break;
    case '[': togglePanel('left'); break;
    case ']': togglePanel('right'); break;
    case '?': $('help-dialog').showModal(); break;
    case 'e': case 'E': exportVideo(); break;
    case 'Escape': document.body.classList.remove('cinema'); if (layoutEditor.enabled) setLayoutEditing(false); break;
  }
});

/* ------------------------------------------------- headless render API */

/**
 * Used by scripts/render.mjs through Playwright. Frames are rendered at exact
 * times with a fixed dt, so the output is identical however slow the machine is.
 */
function installRenderApi() {
  document.body.classList.add('cinema', 'render-mode');
  let comp = null, result = null, prep = null;
  window.__mmv = {
    ready: true,
    async load(preset) {
      store.load(preset);
      seek(0);
      // Give async textures (custom marker image) and web fonts a moment to arrive.
      await Promise.all([new Promise((r) => setTimeout(r, 300)), document.fonts?.ready]);
      return { name: store.state.name, duration: duration() };
    },
    /** Render the soundtrack and set up exact frame drawing. */
    async prepare({ width, height, fps, subframes = 1 }) {
      viz.setFixedSize({ w: width, h: height });
      const buf = await renderWavBuffer();
      comp = new FrameComposer({ width, height, fps, subframes, analyser: new BufferAnalyser(buf), hits: drumEventsFull() });
      prep = { buf, width, height, fps, frames: Math.ceil(duration() * fps) };
      return { frames: prep.frames, duration: duration(), webcodecs: canRenderVideo() };
    },
    /** One frame as a data URL (fallback path when WebCodecs is unavailable). */
    frame(i, format = 'image/jpeg', quality = 0.95) {
      return comp.frame(i).toDataURL(format, quality);
    },
    /** The soundtrack as base64 WAV (fallback path). */
    async wav() {
      const bytes = new Uint8Array(await audioBufferToWav(prep.buf).arrayBuffer());
      return toBase64(bytes);
    },
    /** Encode the whole video in the page (fast path). Progress goes to window.__mmvProgress. */
    async renderVideo({ quality = 'high', gpuEncoder = false } = {}) {
      const r = await renderVideo({
        width: prep.width, height: prep.height, fps: prep.fps, frames: prep.frames, quality, audio: prep.buf,
        drawFrame: (i) => comp.frame(i),
        onProgress: (p) => window.__mmvProgress?.(p),
        onStatus: (m) => window.__mmvStatus?.(m),
        allowGpu: gpuEncoder,
      });
      result = new Uint8Array(await r.blob.arrayBuffer());
      return { bytes: result.length, video: r.video, encoder: r.encoder, audio: r.audio };
    },
    /** Read the encoded file back in base64 slices. */
    chunk(offset, length) {
      return toBase64(result.subarray(offset, offset + length));
    },
  };
}

function toBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/* ------------------------------------------------------------------ boot */

function boot() {
  window.MMV_STARTED = true; // tells the start-up watchdog in index.html that the code loaded
  document.querySelectorAll('.build-id').forEach((el) => { el.textContent = `Build ${BUILD}`; });
  $('loading').hidden = true;
  if (RENDER_MODE) {
    store.load(BUILTIN_PRESETS[0]);
    installRenderApi();
    return;
  }
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { /* ignore */ }
  if (saved?.layers?.length) store.load(saved);
  else store.load(BUILTIN_PRESETS[0]);
  // Small screens start with panels tucked away.
  if (window.innerWidth < 900) { togglePanel('left'); togglePanel('right'); }
  updateTransportUI();
  requestAnimationFrame(frame);
}
boot();
