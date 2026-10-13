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
import { DEFAULT_PRESET } from './presets.js';
import { CompiledLayer } from './math/layers.js';
import { gridAt, barsToSeconds } from './math/rhythm.js';
import { layerTiming as seqTiming } from './math/sequence.js';
import { AudioEngine } from './audio/engine.js';
import { instrumentOf } from './audio/instruments.js';
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
import { renderWithFfmpeg, ffmpegServer, createBatch, addBatchFile, zipBatch } from './export/ffmpeg-render.js';
import { youtubeFor, youtubeText, youtubeCsv } from './export/youtube.js';
import { makeZip } from './export/zip.js';
import { bundleFile, singleFile } from './library.js';
import { fixWebmDuration } from './export/webm-duration.js';
import { shortsTiming, mapVideoTime, frameEffects, drawHook, hookTextFor, shortsAudio } from './export/shorts.js';
import { FONTS } from './ui/overlay.js';
import { CircleView } from './circle/view.js';
import { eventsUntil, captionLine, CIRCLE_RULES } from './circle/sim.js';
import { circleSchedule } from './circle/stack.js';
import { notesForEvents } from './circle/sound.js';
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
// Circle Lab draws on its own 2D canvas under the overlay (no WebGL needed).
const circle = new CircleView();
stage.insertBefore(circle.canvas, overlay);
let circleRuns = new Map(); // per circle layer: note thinning state for live play
const isCircle = () => store.state.mode === 'circle';
/** The picture of the current mode (what exports and snapshots copy). */
const sceneCanvas = () => (isCircle() ? circle.canvas : viz.canvas);
/** What a Circle Lab simulation depends on besides its settings: length, tempo, frame shape. */
function circleEnv() {
  const a = store.state.visual.aspect;
  let ratio;
  if (a && a !== 'fill') { const [w, h] = a.split(':').map(Number); ratio = w / h; }
  else ratio = viz.canvas.width && viz.canvas.height ? viz.canvas.width / viz.canvas.height : 16 / 9;
  return { duration: duration(), bpm: store.state.transport.bpm || 120, ratio };
}

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
audio.onRecover = () => audio.syncLayers(store.state.layers); // after a rebuild the layers need new voices
if (new URLSearchParams(location.search).has('debug')) window.__audio = audio;
/** The audio settings plus the tempo (the pump effect ducks on the beat). */
const audioSettings = () => ({ ...structuredClone(store.state.audio), bpm: store.state.transport.bpm });
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
/** Playback speed (the Speed slider; saved with the preset): exports play the timeline at this speed too. */
const playbackSpeed = () => Math.min(5, Math.max(0.1, store.state.transport.speed || 1));

/** Where `layer` is at timeline time `time` (see math/sequence.js). */
/** Guess-the-shape: drawing (and formulas) hidden before visual.hideUntil seconds. */
const hiddenAt = (time) => store.state.mode !== 'circle' && time < (store.state.visual.hideUntil || 0);
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
  if (changed.has('audio') || changed.has('transport')) audio.applySettings(audioSettings());
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
  audio.applySettings(audioSettings());
  applyDrumVolume();
  rebuildAll();
  applyTheme();
  applyStageAspect();
  viz.resetCamera();
  clock.keyTime = null;
  $('project-name').value = store.state.name;
  applyCircleMode();
  circle.invalidate();
  circleRuns = new Map();
}

function applyCircleMode() {
  const on = isCircle();
  document.body.classList.toggle('mode-circle', on);
  circle.canvas.hidden = !on;
  $('gl-host').style.visibility = on ? 'hidden' : '';
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
        if (third === 'exprs' || third === 'look') { rebuildLayer(layer); viz.restyle(); updateTimelineCurves(); if (third === 'exprs') panels.renderFormulaTexts?.(); }
        if (third === 'wave') audio.syncLayers(store.state.layers);
        if (third === 'mute') updateTimelineCurves();
        if (third === 'name') panels.renderKeyframes();
      }
      break;
    }
    case 'mode':
      viz.applySettings(); viz.buildGrid(); rebuildAll(); viz.resetCamera(); clock.snap = true;
      applyCircleMode();
      panels.renderCircle?.();
      if (isCircle()) panels.showTab?.('circle');
      break;
    case 'circle':
      circle.invalidate();
      circleRuns = new Map();
      clock.snap = true;
      {
        // rebuild the Circle tab when the visible controls change (rule, pitch mode, the layer list)
        const tail = path.split('.').slice(-2).join('.');
        if (!second || second === 'combine' || path === 'circle.layers' || /(^|\.)rule$/.test(path) || tail === 'sound.pitch' || tail === 'sound.melody') panels.renderCircle?.();
        if (!second || second === 'layers' || second === 'combine') panels.renderCircleLayers?.();
      }
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
      audio.applySettings(audioSettings());
      break;
    case 'transport':
      if (second === 'duration') { updateTimelineCurves(); panels.renderSequence(); }
      if (second === 'duration' || second === 'bpm') { viz.buildGrid(); timeline.draw(); }
      if (second === 'bpm') audio.applySettings(audioSettings()); // the pump follows the tempo
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
  audio.applySettings(audioSettings());
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
  if (isCircle()) return renderCircle(time, { playing, snap });
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
    // "Guess the shape": the curves stay hidden (the sound plays) until the reveal time
    items.push({ id: l.id, u, phase: hiddenAt(time) ? 'future' : phase, point: c.at(u, ctx, { x: 0, y: 0, z: 0 }), compiled: c });
  }
  const frames = voicesAt(time);
  for (const f of frames) notes.set(f.id, f.gain > 0 ? f.midi : null);
  viz.render(items, ctx, { dt, now, snap, playing, time, progress: time / duration(), bpm: store.state.transport.bpm, pastMode: store.state.sequence.past, cameraLocked: hasPoseTrack() && (playing || RENDER_MODE) });
  return frames;
}

/** The line above the simulation and the counter: from the layer playing now. */
function circleText() {
  const c = store.state.circle;
  const hd = circle.headline();
  const cfg = hd?.cfg || c;
  // the preset's question (hook line) belongs to the first layer; other layers say their own words
  const question = cfg === c ? (store.state.hook?.text || '').trim() : '';
  return { formula: captionLine(cfg, question), stats: c.look.counter ? circle.stats() : '' };
}

/** Circle Lab frame: draw the simulation; while playing live, every hit plays its note. */
function renderCircle(time, { playing, snap }) {
  const groups = circle.renderAt(time, store.state.circle, { snap, width: viz.canvas.width, height: viz.canvas.height, env: circleEnv(), camera: store.state.camera, progress: time / duration(), bpm: store.state.transport.bpm });
  if (snap) circleRuns = new Map();
  if (playing && groups.length && !exporting.busy && !RENDER_MODE && audio.ready) {
    for (const { id, cfg, events } of groups) {
      if (!circleRuns.has(id)) circleRuns.set(id, { last: -1, k: 0, burst: 0 });
      const s = cfg.sound;
      for (const n of notesForEvents(events, cfg, store.state.audio, circleRuns.get(id))) {
        audio.playNote(s.instrument, n.midi, n.vel * s.volume, null, s.length);
        if (s.drum && s.drum !== 'off') audio.drum(s.drum, n.vel * 0.45);
      }
    }
  }
  return [];
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
  // Live look at the Shorts hook: while playing the first seconds, show the hook line on the
  // stage too (the export adds the teaser, flash and boom around it).
  if (clock.playing && store.state.record.hook?.enabled !== false && clock.pos < 2) {
    drawHook(og, overlay.width, overlay.height, hookTextFor(store.state), clock.pos, 2, FONTS.display);
  }
  if (recorder.active) {
    recorder.composite();
    $('rec-time').textContent = fmtRec(recorder.elapsed);
  }
  timeline.setProgress(Math.min(clock.pos / dur, 1), clock.pos);
  updateHud(frames);
}

function overlayData(analysis = null, time = clock.pos) {
  const light = isLight(isCircle() ? store.state.circle.look.background || '#000000' : store.state.visual.background);
  const exportingNow = analysis != null;
  return {
    state: store.state,
    layers: store.state.layers,
    time,
    notes: (clock.playing || clock.scrubbing || exportingNow || RENDER_MODE) && store.state.visual.showNotes ? notes : new Map(),
    phases: new Map(store.state.layers.map((l) => [l.id, hiddenAt(time) ? 'future' : layerTiming(l, time).phase])),
    spectrum: analysis ? analysis.spectrum : audio.spectrum(),
    waveform: analysis ? analysis.waveform : audio.waveform(),
    ui: { fg: light ? '#1a1c26' : '#eef2ff', accent: '#22e4ff', accent2: light ? '#e0245e' : '#ff3d9a', light },
    circle: isCircle() ? circleText() : null,
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
  panels.setRecording(true);
  toast(`Recording ${size.w}×${size.h} at ${fps} fps${fromStart ? ' · stops after one pass' : ''}. Press R to stop.`);
}

async function stopRecording() {
  if (!recorder.active) return;
  const seconds = recorder.elapsed;
  const res = await recorder.stop();
  viz.setFixedSize(null);
  clock.autoStop = false;
  document.body.classList.remove('recording');
  panels.setRecording(false);
  applyStageAspect();
  if (!res || !res.blob.size) return toast('Recording came out empty. Try a different browser.');
  // Live recordings come out with uneven frame timing and (in Chrome) no duration, so
  // players can't show the length or seek. With the local ffmpeg: re-encode to a
  // constant-frame-rate H.264 MP4. Without it: at least write the duration into WebM.
  const { fps } = store.state.record;
  if (await ffmpegServer()) {
    toast('Finishing the recording with ffmpeg (constant frame rate, H.264)…', 120000);
    try {
      const r = await fetch(`api/transcode?fps=${fps}`, { method: 'POST', body: res.blob });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      const blob = await r.blob();
      toast('Recording ready.');
      return showResult(blob, `${fileBase()}.mp4`, 'video', null, `${fps} fps constant · H.264 + AAC (ffmpeg)`);
    } catch (err) {
      toast(`ffmpeg could not convert the recording (${err.message}); keeping the original.`, 6000);
    }
  }
  const blob = res.ext === 'webm' ? await fixWebmDuration(res.blob, seconds) : res.blob;
  showResult(blob, `${fileBase()}.${res.ext}`, 'video');
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
    if (isBlob) return download(src, name);
    if (kind === 'zip') {
      // A batch zip on the local server can be gigabytes: let the browser stream it to disk.
      const a = h('a', { href: url, download: name });
      document.body.append(a);
      a.click();
      a.remove();
      return;
    }
    download(await (await fetch(url)).blob(), name);
  };
  // A single video gets its YouTube title/description as a .txt with the same name.
  const yt = $('result-youtube');
  yt.hidden = kind !== 'video';
  yt.onclick = () => {
    const base = $('result-name').value.trim().replace(/[\\/:*?"<>|]+/g, '-') || fileBase();
    download(new Blob([youtubeText(youtubeFor(store.state), base + ext)], { type: 'text/plain' }), `${base}.txt`);
  };
  // The whole preset behind this export (what the Presets tab calls “Export current setup”).
  const pre = $('result-preset');
  pre.hidden = kind === 'zip'; // a batch zip already contains presets.mmv.json
  pre.onclick = () => {
    const snap = store.snapshot();
    const base = (snap.name || 'preset').replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 80) || 'preset';
    download(new Blob([singleFile(snap)], { type: 'application/json' }), `${base}.mmv.json`);
  };
  dlg.onclose = () => { if (isBlob) setTimeout(() => URL.revokeObjectURL(url), 1000); };
  dlg.showModal();
}

/* --------------------------------------------------------------- exports */

/** Render the whole timeline's audio (synth + drums + keyframed effects) offline. */
async function renderWavBuffer() {
  if (isCircle()) return renderCircleWav();
  const { layers, audio: a, drums } = store.state;
  const enabled = layers.filter((l) => l.enabled);
  const dur = duration();
  const drumEvents = drumEventsFull();
  const tracks = Object.keys(store.state.keyframes.tracks);
  const audioAnimated = tracks.some((p) => p.startsWith('audio.'));
  try {
    return await AudioEngine.renderOffline({
      settings: { ...structuredClone(a), bpm: store.state.transport.bpm },
      layers: enabled,
      duration: dur,
      speed: playbackSpeed(),
      glide: a.glide,
      articulation: a.articulation,
      drumEvents,
      drumVolume: drums.enabled ? drums.volume : 0,
      frameAt: (time) => { applyKeyframesAt(time, false); return voicesAt(time); },
      settingsAt: audioAnimated ? (time) => { applyKeyframesAt(time, false); return audioSettings(); } : null,
    });
  } finally {
    applyKeyframesAt(clock.pos, true);
  }
}

/**
 * Every note of the Circle Lab soundtrack, per layer: each layer replays on its own clock
 * (its step of the timeline) with its own sound. Times are timeline seconds.
 */
function circleNoteTracks() {
  const { circle: c, audio: a } = store.state;
  const env = circleEnv();
  return circleSchedule(c, duration()).map((s) => {
    const cfg = s.layer.cfg, len = s.end - s.start;
    const notes = notesForEvents(eventsUntil(cfg, len, { ...env, duration: len }), cfg, a).map((n) => ({ ...n, t: n.t + s.start }));
    return { layer: s.layer, cfg, notes };
  });
}

/** Circle Lab soundtrack: replay the simulation, one note per (thinned) hit, plus drums. */
async function renderCircleWav() {
  const { circle: c, audio: a, drums } = store.state;
  const sp = playbackSpeed();
  const dur = duration() / sp; // video seconds
  const notes = [];
  const drumEvents = drumEventsFull().map((e) => ({ ...e, time: e.time / sp }));
  let hitDrums = false;
  for (const { cfg, notes: ns } of circleNoteTracks()) {
    const snd = cfg.sound;
    for (const n of ns) {
      notes.push({ ...n, t: n.t / sp, instrument: snd.instrument, length: Math.max(0.05, snd.length / sp), volume: snd.volume });
      if (snd.drum && snd.drum !== 'off') { hitDrums = true; drumEvents.push({ kind: snd.drum, time: n.t / sp, vel: n.vel * 0.45 }); }
    }
  }
  notes.sort((x, y) => x.t - y.t);
  return AudioEngine.renderNotesOffline({
    settings: { ...structuredClone(a), bpm: store.state.transport.bpm }, duration: dur, notes, instrument: c.sound.instrument, length: Math.max(0.05, c.sound.length / sp), volume: c.sound.volume,
    drumEvents, drumVolume: drums.enabled || hitDrums ? drums.volume : 0,
  });
}

async function exportWav() {
  if (!isCircle() && !store.state.layers.some((l) => l.enabled)) return toast('Turn on at least one layer to export audio.');
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

/** Circle Lab as MIDI: one track per layer (its instrument), plus the hit drums. */
function exportCircleMidi() {
  const tracks = circleNoteTracks().map(({ cfg, notes }, i) => ({
    name: `${i + 1} ${CIRCLE_RULES[cfg.rule] || cfg.rule}`.slice(0, 60),
    channel: i >= 9 ? i + 1 : i,
    program: instrumentOf(cfg.sound.instrument).program ?? 0,
    notes: notes.map((n) => ({ start: n.t, dur: Math.max(0.05, cfg.sound.length), midi: n.midi, vel: Math.max(20, Math.min(127, Math.round(n.vel * 127 * (cfg.sound.volume ?? 0.7) * 1.4))) })),
  })).filter((t) => t.notes.length);
  const drumHits = circleNoteTracks().flatMap(({ cfg, notes }) => (cfg.sound.drum && cfg.sound.drum !== 'off' ? notes.map((n) => ({ start: n.t, dur: 0.1, midi: GM_DRUMS[cfg.sound.drum], vel: 60 + n.vel * 40 })) : []));
  if (drumHits.length) tracks.push({ name: 'Drums', channel: 9, program: 0, notes: drumHits });
  if (!tracks.length) return toast('No notes yet: this simulation makes no sound with these settings.');
  const bytes = writeMidi(tracks, store.state.transport.bpm || 120);
  download(new Blob([bytes], { type: 'audio/midi' }), `${fileBase()}.mid`);
  toast(`MIDI exported: ${tracks.reduce((n, t) => n + t.notes.length, 0)} notes in ${tracks.length} track${tracks.length > 1 ? 's' : ''}.`);
}

function exportMidi() {
  if (isCircle()) return exportCircleMidi();
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
    program: instrumentOf(l.wave).program ?? PROGRAM[l.wave] ?? 80,
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
  if (!isCircle()) viz.composer.render(0);
  const src = sceneCanvas();
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
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
  /**
   * @param {object} o
   * @param {object} [o.timing] shortsTiming(): teaser, outro and hook (video time ≠ timeline time)
   */
  constructor({ width, height, fps, subframes = 1, analyser, hits, timing = null, hookText = '' }) {
    this.fps = fps;
    this.n = Math.max(1, subframes | 0);
    this.analyser = analyser;
    this.hits = hits;
    this.timing = timing || { on: false, teaser: 0, outro: 0, duration: duration(), total: duration(), hookEnd: 0 };
    this.hookText = hookText;
    this.hitIndex = 0;
    this.last = 0;
    this.lastPhase = null;
    this.out = document.createElement('canvas');
    this.out.width = width;
    this.out.height = height;
    this.g = this.out.getContext('2d');
    this.px = new Uint8Array(4);
  }

  frame(i) {
    const { fps, n, g, out, timing: T } = this;
    const vt = i / fps;
    if (i === 0) { this.hitIndex = 0; this.last = 0; this.lastPhase = null; } // a retry with another encoder starts over
    const shutter = 0.5 / fps; // 180°
    const fx = frameEffects(T, vt);
    let m = null;
    for (let j = 0; j < n; j++) {
      const svt = n === 1 ? vt : Math.max(0, vt - shutter * (1 - (j + 1) / n));
      m = mapVideoTime(T, svt);
      const time = m.time;
      // The cut from the teaser to the start: a fresh start (trails, camera follow, drum hits).
      const snap = m.phase !== this.lastPhase && m.phase !== 'outro';
      if (snap && m.phase === 'main') this.hitIndex = 0;
      this.lastPhase = m.phase;
      const dt = snap ? 1 / fps : Math.max(time - this.last, 1e-4);
      this.last = time;
      clock.pos = time;
      applyKeyframesAt(time);
      if (store.state.drums.pulse && m.phase === 'main') {
        const src = drumSourceLayer(time);
        while (this.hitIndex < this.hits.length && this.hits[this.hitIndex].time <= time + 1e-9) viz.pulse(this.hits[this.hitIndex++].kind, src?.id);
      }
      renderScene(time, { dt, now: time, playing: m.phase === 'main', snap });
      // A lost GPU context draws nothing: stop instead of encoding black frames.
      const gl = viz.renderer.getContext();
      if (gl.isContextLost()) throw new Error('graphics context lost');
      // Wait for the GPU to finish this frame before queueing the next one. Exports draw
      // frames back to back with no screen refresh in between; without this the GPU's
      // queue grows until some drivers reset ("context lost").
      if (!isCircle()) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.px);
      g.globalAlpha = 1 / (j + 1); // running average of the sub-frames
      if (fx.scale !== 1) {
        const sw = out.width * fx.scale, sh = out.height * fx.scale;
        g.drawImage(sceneCanvas(), (out.width - sw) / 2, (out.height - sh) / 2, sw, sh);
      } else g.drawImage(sceneCanvas(), 0, 0, out.width, out.height);
    }
    g.globalAlpha = 1;
    // Text: formulas/captions with the timeline, except during the teaser (only the hook line).
    if (m.phase !== 'teaser') drawOverlay(g, out.width, out.height, overlayData(this.analyser?.at(vt) ?? { spectrum: null, waveform: null }, m.time));
    if (T.on) drawHook(g, out.width, out.height, this.hookText, vt, T.hookEnd, FONTS.display);
    // Seamless loop: keep the first frame, and dissolve into it at the end
    if (T.loop) {
      if (i === 0) { this.first ||= document.createElement('canvas'); this.first.width = out.width; this.first.height = out.height; this.first.getContext('2d').drawImage(out, 0, 0); }
      else if (fx.loopMix > 0 && this.first) { g.globalAlpha = fx.loopMix; g.drawImage(this.first, 0, 0); g.globalAlpha = 1; }
    }
    if (fx.flash > 0) { g.fillStyle = `rgba(255,255,255,${fx.flash})`; g.fillRect(0, 0, out.width, out.height); }
    if (fx.black > 0) { g.fillStyle = `rgba(0,0,0,${fx.black})`; g.fillRect(0, 0, out.width, out.height); }
    return out;
  }
}

/**
 * Soundtrack + frame composer for the loaded project at an export size: the timeline
 * audio wrapped with the Shorts teaser/boom/fade, and frames drawn in video time.
 */
async function prepareComposition({ width, height, fps, subframes }) {
  // Escape: the finished picture is an empty screen, so the teaser shows the start instead.
  const teaserAt = isCircle() && store.state.circle.rule === 'escape' && !store.state.circle.layers?.length ? 0.05 : undefined;
  const T = shortsTiming(store.state.record, duration(), { teaserAt, speed: playbackSpeed() });
  const main = await renderWavBuffer();
  const buf = T.on || T.outro || T.loop ? shortsAudio(main, T) : main;
  const comp = new FrameComposer({
    width, height, fps, subframes, timing: T, hookText: hookTextFor(store.state),
    analyser: new BufferAnalyser(buf), hits: drumEventsFull(),
  });
  return { comp, buf, frames: Math.ceil(T.total * fps), timing: T };
}

const fmtEta = (s) => (s >= 90 ? `${Math.round(s / 60)} min` : `${Math.max(1, Math.round(s))} s`);

/** Ask the local server (npm start + ffmpeg) to convert a VP9/Opus file to H.264/AAC. */
async function transcodeToH264(blob) {
  const r = await fetch('api/transcode', { method: 'POST', body: blob, headers: { 'Content-Type': 'video/mp4' } });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
  return r.blob();
}

/** Which encoder to use: the local server's ffmpeg (when available and allowed) or the browser's. */
async function pickEncoder() {
  const engine = store.state.record.engine;
  const server = engine === 'browser' ? null : await ffmpegServer();
  if (engine === 'ffmpeg' && !server) { toast('ffmpeg export needs the local server with ffmpeg: run “npm start” on a computer with ffmpeg installed and open http://localhost:5173.', 9000); return false; }
  if (!server && !canRenderVideo()) { toast('This browser cannot encode video. Use Chrome or Edge (or Live capture in the Export tab).', 7000); return false; }
  return { server };
}

/**
 * Render the loaded project's whole timeline to an MP4 (soundtrack, frames, encoding).
 * With `keep`, the server leaves the file in a batch folder and no blob comes back.
 * @returns {Promise<{blob:Blob|null, size:number, note:string}>}
 */
async function renderTimeline({ server, token, keep, onProgress, onStatus, onPhase }) {
  const { fps, subframes, quality } = store.state.record;
  const size = recordSize();
  onPhase?.('Rendering the soundtrack…');
  const { comp, buf, frames } = await prepareComposition({ width: size.w, height: size.h, fps, subframes });
  if (token.cancelled) throw new Error('cancelled');
  viz.setFixedSize(size);
  try {
    const common = { width: size.w, height: size.h, fps, frames, quality, token, audio: buf, drawFrame: (i) => comp.frame(i), onStatus, onProgress };
    const base = `${size.w}×${size.h} · ${fps} fps`;
    if (server) {
      const r = await renderWithFfmpeg({ ...common, keep });
      return { blob: r.blob, size: r.size, note: `${base} · ${r.encoder}` };
    }
    const res = await renderVideo({ ...common, allowGpu: store.state.record.gpuEncoder && !gpu.encoderCrash });
    let blob = res.blob;
    let note = `${base} · ${res.encoder}${res.audio ? ` + ${res.audio}` : ''}`;
    if (res.video !== 'H.264' || (res.audio && res.audio !== 'AAC')) {
      onPhase?.('Converting to H.264 / AAC with ffmpeg for maximum compatibility…');
      try {
        blob = await transcodeToH264(blob);
        note = `${base} · H.264 + AAC`;
      } catch {
        note += ' · plays in Chrome, VLC and on YouTube (run npm start with ffmpeg installed for an H.264 copy)';
      }
    }
    return { blob, size: blob.size, note };
  } finally {
    viz.setFixedSize(null);
  }
}

/** Progress dialog shared by single and batch exports. */
function openRenderDialog(title) {
  const dlg = $('render-dialog'), bar = $('render-bar'), stats = $('render-stats');
  const token = { cancelled: false };
  exporting.token = token;
  const cancel = () => { token.cancelled = true; stats.textContent = 'Cancelling…'; };
  $('render-cancel').onclick = cancel;
  dlg.oncancel = (e) => { e.preventDefault(); cancel(); };
  $('render-title').textContent = title;
  bar.value = 0;
  stats.textContent = 'Preparing…';
  $('render-encoder').textContent = '';
  dlg.showModal();
  return {
    token,
    close: () => dlg.close(),
    phase: (msg) => { stats.textContent = msg; },
    title: (msg) => { $('render-title').textContent = msg; },
    status: (msg) => { $('render-encoder').textContent = msg; },
    progress: (p, prefix = '', overall = null) => {
      bar.value = overall ?? p.frame / p.frames;
      stats.textContent = `${prefix}Frame ${p.frame} / ${p.frames} · ${p.fps.toFixed(1)} frames/s · about ${fmtEta(p.eta)} left`;
    },
  };
}

function exportFailed(err) {
  if (err.message === 'graphics context lost') {
    gpu.encoderCrash = true;
    gpu.safe = true;
    writeGpu(gpu);
  }
}

/** Common setup/teardown around an export: pause playback, restore the playhead after. */
async function withExport(fn) {
  if (exporting.busy) return;
  if (recorder.active) await stopRecording();
  const wasPlaying = clock.playing;
  if (wasPlaying) pause();
  exporting.busy = true;
  const savedPos = clock.pos;
  try {
    await document.fonts?.ready;
    await new Promise((r) => setTimeout(r, 30));
    await fn();
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

/** Render the whole timeline to a smooth MP4. */
async function exportVideo() {
  if (exporting.busy) return;
  const enc = await pickEncoder();
  if (!enc) return;
  const { fps, subframes } = store.state.record;
  const size = recordSize();
  await withExport(async () => {
    const ui = openRenderDialog(`Rendering ${size.w}×${size.h} · ${fps} fps${subframes > 1 ? ` · motion blur ×${subframes}` : ''}`);
    try {
      const r = await renderTimeline({ server: enc.server, token: ui.token, onPhase: ui.phase, onStatus: ui.status, onProgress: (p) => ui.progress(p) });
      ui.close();
      showResult(r.blob, `${fileBase()}.mp4`, 'video', null, r.note);
    } catch (err) {
      ui.close();
      exportFailed(err);
      if (!$('fatal').hidden) return; // the GPU loss screen already explains what happened
      toast(err.message === 'cancelled' ? 'Export cancelled.' : `Video export failed: ${err.message}`, 8000);
    }
  });
}

/**
 * Real-time preview of the Shorts opening and ending (small size, with sound): what a
 * viewer sees in the first seconds and the last ones, without exporting the whole video.
 */
async function previewShorts() {
  if (exporting.busy) return;
  const full = recordSize();
  const sc = Math.min(1, 640 / Math.max(full.w, full.h));
  const size = { w: Math.round((full.w * sc) / 2) * 2, h: Math.round((full.h * sc) / 2) * 2 };
  let dlg = document.getElementById('shorts-preview');
  if (!dlg) {
    dlg = h('dialog#shorts-preview.dialog.glass', {},
      h('h2', {}, 'Start & end preview'),
      h('canvas.shorts-canvas'),
      h('p.hint.shorts-phase'),
      h('div.row', {}, h('button.btn.ghost', { type: 'button', onclick: () => dlg.close() }, 'Close')));
    document.body.append(dlg);
  }
  const cv = dlg.querySelector('canvas'), phase = dlg.querySelector('.shorts-phase');
  cv.width = size.w; cv.height = size.h;
  const g2 = cv.getContext('2d');
  dlg.showModal();
  phase.textContent = 'Preparing…';
  await ensureAudio();
  await withExport(async () => {
    viz.setFixedSize(size);
    const { comp, buf, timing: T } = await prepareComposition({ width: size.w, height: size.h, fps: 30, subframes: 1 });
    const segments = [['Start', 0, Math.min(T.total, Math.max(T.hookEnd, T.teaser) + 1.5)], ['End', Math.max(0, T.total - 2.5), T.total]];
    for (const [label, a, b] of segments) {
      if (!dlg.open) break;
      phase.textContent = `${label} · ${a.toFixed(1)}–${b.toFixed(1)} s of ${T.total.toFixed(1)} s`;
      comp.lastPhase = null;
      const src = audio.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(audio.ctx.destination);
      src.start(audio.ctx.currentTime + 0.05, a, b - a);
      const t0 = audio.ctx.currentTime + 0.05;
      while (dlg.open) {
        const vt = a + Math.max(0, audio.ctx.currentTime - t0);
        if (vt >= b) break;
        g2.drawImage(comp.frame(Math.max(1, Math.round(vt * 30))), 0, 0);
        await new Promise((r) => requestAnimationFrame(r));
      }
      src.stop();
      await new Promise((r) => setTimeout(r, 350));
    }
    phase.textContent = dlg.open ? 'Done. Change the settings and preview again, or close.' : '';
  });
}

const fileSafe = (s) => (String(s || 'video').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'video');

/**
 * Render many presets to MP4 in one go, with the Export tab's settings. Each video gets a
 * .txt with its YouTube title/description/tags; the batch also gets a CSV of all of them and
 * a bundle of the presets. Everything ends up in one .zip (and, with the local server, in a
 * folder under exports/ too, so nothing is lost if the browser closes).
 * @param {{name:string, preset:object}[]} entries
 */
/** Render presets to videos as one zip; returns the names of the videos that were made. */
async function renderBatch(entries) {
  const rendered = [];
  if (exporting.busy || !entries.length) return rendered;
  const enc = await pickEncoder();
  if (!enc) return rendered;
  const { server } = enc;
  const original = store.snapshot();
  const record = structuredClone(original.record); // the Export tab's settings apply to every video
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '-');
  const batchName = `Math-Melody videos ${stamp}`;
  const pad = String(entries.length).length;
  await withExport(async () => {
    const ui = openRenderDialog(`Rendering ${entries.length} videos`);
    const done = [], failed = [], files = [];
    const textEnc = new TextEncoder();
    let batch = null;
    try {
      if (server) batch = await createBatch(batchName);
      for (let i = 0; i < entries.length && !ui.token.cancelled; i++) {
        const e = entries[i];
        store.load({ ...e.preset, name: e.name || e.preset.name });
        store.state.record = structuredClone(record);
        const base = `${String(i + 1).padStart(Math.max(2, pad), '0')} ${fileSafe(store.state.name)}`;
        const meta = youtubeFor(store.state);
        const prefix = `Video ${i + 1} / ${entries.length} · `;
        ui.title(`${prefix}${store.state.name}`);
        try {
          const r = await renderTimeline({
            server, token: ui.token, keep: batch ? { batch: batch.id, file: `${base}.mp4` } : null,
            onPhase: (m) => ui.phase(prefix + m), onStatus: ui.status,
            onProgress: (p) => ui.progress(p, prefix, (i + p.frame / p.frames) / entries.length),
          });
          const txt = youtubeText(meta, `${base}.mp4`);
          if (batch) await addBatchFile(batch.id, `${base}.txt`, txt);
          else files.push({ name: `${base}.mp4`, data: new Uint8Array(await r.blob.arrayBuffer()) }, { name: `${base}.txt`, data: textEnc.encode(txt) });
          done.push({ file: `${base}.mp4`, ...meta, preset: store.snapshot() });
          rendered.push(e.name || e.preset.name);
        } catch (err) {
          if (err.message === 'cancelled') break;
          if (err.message === 'graphics context lost') throw err;
          failed.push({ name: store.state.name, error: err.message });
        }
      }
      if (!done.length) {
        ui.close();
        toast(ui.token.cancelled ? 'Export cancelled.' : `No video could be rendered: ${failed.map((f) => `${f.name}: ${f.error}`).join('; ')}`, 9000);
        return;
      }
      // Batch extras: every title/description in one CSV, and the presets themselves.
      const csv = youtubeCsv(done);
      const bundle = bundleFile(done.map((d) => d.preset));
      const extras = [['YouTube titles and descriptions.csv', csv], ['presets.mmv.json', bundle]];
      if (failed.length) extras.push(['FAILED.txt', failed.map((f) => `${f.name}: ${f.error}`).join('\n')]);
      ui.phase('Packing the zip…');
      ui.status('');
      const summary = `${done.length} video${done.length === 1 ? '' : 's'}${failed.length ? ` · ${failed.length} failed` : ''}${ui.token.cancelled ? ' · cancelled early' : ''}`;
      if (batch) {
        for (const [name, text] of extras) await addBatchFile(batch.id, name, text);
        const z = await zipBatch(batch.id);
        ui.close();
        showResult(z.url, `${batchName}.zip`, 'zip', z.size, `${summary} · also saved in ${z.dir}`);
      } else {
        for (const [name, text] of extras) files.push({ name, data: textEnc.encode(text) });
        const zip = new Blob([makeZip(files.map((f) => ({ ...f, name: `${batchName}/${f.name}` })))], { type: 'application/zip' });
        ui.close();
        showResult(zip, `${batchName}.zip`, 'zip', null, summary);
      }
    } catch (err) {
      ui.close();
      exportFailed(err);
      if (!$('fatal').hidden) return;
      toast(`Batch export stopped: ${err.message}${batch ? ` (finished videos are in ${batch.dir})` : ''}`, 10000);
      if (!batch) rendered.length = 0; // the zip never reached the user
    } finally {
      store.load(original);
      seek(0);
    }
  });
  return rendered;
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
  renderBatch,
  previewSound: async (id) => { await ensureAudio(); audio.preview(id); },
  previewShorts,
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
$('mode-slot').append(segmented(bindPath('mode'), [['2d', '2D', '2D graph (M)'], ['3d', '3D', '3D space (M)'], ['circle', '◎', 'Circle Lab: bouncing balls, chords and polyrhythms with a note on every hit']], { label: 'View mode' }));
$('play-btn').addEventListener('click', togglePlay);
$('rewind-btn').addEventListener('click', () => seek(0));
$('theme-btn').addEventListener('click', () => toggleTheme());
$('cinema-btn').addEventListener('click', () => document.body.classList.toggle('cinema'));
$('help-btn').addEventListener('click', () => $('help-dialog').showModal());
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
    case 'm': case 'M': store.set('mode', { '2d': '3d', '3d': 'circle', circle: '2d' }[store.state.mode] || '2d'); refreshAll(); break;
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
      const c = await prepareComposition({ width, height, fps, subframes });
      comp = c.comp;
      prep = { buf: c.buf, width, height, fps, frames: c.frames };
      return { frames: prep.frames, duration: c.timing.total, webcodecs: canRenderVideo() };
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
    store.load(DEFAULT_PRESET);
    installRenderApi();
    return;
  }
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { /* ignore */ }
  if (saved?.layers?.length) store.load(saved);
  else store.load(DEFAULT_PRESET);
  // Small screens start with panels tucked away.
  if (window.innerWidth < 900) { togglePanel('left'); togglePanel('right'); }
  updateTransportUI();
  requestAnimationFrame(frame);
}
boot();
