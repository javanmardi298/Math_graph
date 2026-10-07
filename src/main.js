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
import { Recorder, download, pickFormat } from './export/recorder.js';
import { writeMidi, samplesToNotes } from './export/midi.js';
import { audioBufferToWav } from './export/wav.js';

const $ = (id) => document.getElementById(id);
const SESSION_KEY = 'mmv.session.v1';
const RENDER_MODE = new URLSearchParams(location.search).has('render');

/* ------------------------------------------------------------------ setup */

const stage = $('stage');
const overlay = $('overlay');
const og = overlay.getContext('2d');

function showFatal(reason) {
  $('fatal').hidden = false;
  $('loading').hidden = true;
  $('fatal-reason').textContent = reason;
}
$('fatal-reload').addEventListener('click', () => location.reload());

let viz;
try {
  viz = new Visualizer($('gl-host'), store.state);
} catch (err) {
  showFatal(`WebGL could not start (${err.message}).`);
  throw err;
}
viz.onContextLost = () => {
  if (clock.playing) pause();
  showFatal('The graphics context was lost (the GPU reset or ran out of memory). Your work is saved: press Try again.');
};
const audio = new AudioEngine();
const recorder = new Recorder();
const scanner = new DrumScanner();
/** @type {Map<string, CompiledLayer>} */
const compiled = new Map();

const clock = { pos: 0, prevPos: 0, playing: false, scrubbing: false, lastWall: performance.now() / 1000, lastAudio: 0, snap: true, autoStop: false, keyTime: null };
const notes = new Map(); // layer id → current midi (for HUD/caption)

/* --------------------------------------------------------------- toasts */

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
    case 'theme':
      applyTheme();
      break;
  }
  saveSession();
});

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
  drawOverlay(og, overlay.width, overlay.height, overlayData());
  if (recorder.active) {
    recorder.composite();
    $('rec-time').textContent = fmtRec(recorder.elapsed);
  }
  timeline.setProgress(Math.min(clock.pos / dur, 1), clock.pos);
  updateHud(frames);
}

function overlayData(analysis = null) {
  const light = isLight(store.state.visual.background);
  return {
    state: store.state,
    layers: store.state.layers,
    notes: (clock.playing || clock.scrubbing || RENDER_MODE) && store.state.visual.showNotes ? notes : new Map(),
    phases: new Map(store.state.layers.map((l) => [l.id, layerTiming(l, clock.pos).phase])),
    spectrum: analysis ? analysis.spectrum : audio.spectrum(),
    waveform: analysis ? analysis.waveform : audio.waveform(),
    ui: { fg: light ? '#1a1c26' : '#eef2ff', accent: '#22e4ff', accent2: light ? '#e0245e' : '#ff3d9a' },
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
  showResult(res.blob, `${slug()}.${res.ext}`, 'video');
}

const toggleRecord = () => (recorder.active ? stopRecording() : startRecording());

function slug() {
  return (store.state.name || 'math-melody').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'math-melody';
}

/** Show a finished export with a preview and a download button. `src` is a Blob or a same-origin URL. */
function showResult(src, filename, kind, sizeBytes) {
  const dlg = $('result-dialog');
  const isBlob = src instanceof Blob;
  const url = isBlob ? URL.createObjectURL(src) : src;
  const media = kind === 'video' ? h('video', { src: url, controls: true, playsinline: true })
    : kind === 'audio' ? h('audio', { src: url, controls: true })
      : kind === 'image' ? h('img', { src: url, alt: 'Snapshot preview' }) : null;
  $('result-media').replaceChildren(...(media ? [media] : []));
  const bytes = isBlob ? src.size : sizeBytes;
  $('result-info').textContent = bytes ? `${filename} · ${(bytes / 1048576).toFixed(2)} MB` : filename;
  $('result-download').onclick = async () => download(isBlob ? src : await (await fetch(url)).blob(), filename);
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
    showResult(audioBufferToWav(buf), `${slug()}.wav`, 'audio');
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
  download(new Blob([bytes], { type: 'audio/midi' }), `${slug()}.mid`);
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
  c.toBlob((blob) => blob && showResult(blob, `${slug()}.png`, 'image'), 'image/png');
}

function exportPresetFile() {
  const blob = new Blob([JSON.stringify(store.snapshot(), null, 2)], { type: 'application/json' });
  download(blob, `${slug()}.mmv.json`);
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

/* ------------------------------------------------- server (studio) render */

let serverJob = null;

/** Ask the local server whether it can render (Playwright + ffmpeg installed). */
async function serverStatus() {
  try {
    const r = await fetch('api/health', { cache: 'no-store' });
    if (!r.ok) return { available: false, reason: 'offline' };
    return await r.json();
  } catch {
    return { available: false, reason: 'offline' };
  }
}

async function serverRender(onProgress) {
  if (serverJob) return toast('A studio render is already running.');
  const size = recordSize();
  const body = { preset: store.snapshot(), width: size.w, height: size.h, fps: store.state.record.fps };
  let res;
  try {
    res = await fetch('api/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    return toast('Studio render needs the local server: run `npm start` and open http://localhost:5173.', 6000);
  }
  const info = await res.json().catch(() => ({}));
  if (!res.ok) return toast(info.error || `Render could not start (HTTP ${res.status}).`, 7000);
  serverJob = info.id;
  toast(`Studio render started: ${size.w}×${size.h} at ${body.fps} fps.`);
  const poll = async () => {
    let st;
    try { st = await (await fetch(`api/render/${serverJob}`, { cache: 'no-store' })).json(); } catch { st = { status: 'error', error: 'Lost contact with the server.' }; }
    onProgress?.(st);
    if (st.status === 'done') {
      serverJob = null;
      showResult(st.url, st.file, 'video', st.bytes);
    } else if (st.status === 'error') {
      serverJob = null;
      toast(`Studio render failed: ${st.error}`, 8000);
    } else setTimeout(poll, 1000);
  };
  poll();
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
  exportPresetFile,
  videoFormat: pickFormat,
  addKey,
  keyframesChanged,
  seekTo: (time) => { seek(time / duration()); },
  playheadTime: () => clock.pos,
  fitToBars,
  auditionDrum,
  serverStatus,
  serverRender,
  recordSize,
});

// Top bar
$('mode-slot').append(segmented(bindPath('mode'), [['2d', '2D', '2D graph (M)'], ['3d', '3D', '3D space (M)']], { label: 'View mode' }));
$('play-btn').addEventListener('click', togglePlay);
$('rewind-btn').addEventListener('click', () => seek(0));
$('topbar-record').addEventListener('click', toggleRecord);
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
    case 'Escape': document.body.classList.remove('cinema'); break;
  }
});

/* ------------------------------------------------- headless render API */

/**
 * Used by scripts/render.mjs through Playwright. Frames are rendered at exact
 * times with a fixed dt, so the output is identical however slow the machine is.
 */
function installRenderApi() {
  document.body.classList.add('cinema', 'render-mode');
  let fps = 60, analyser = null, hits = [], hitIndex = 0, out = null;
  window.__mmv = {
    ready: true,
    async load(preset) {
      store.load(preset);
      seek(0);
      // Give async textures (custom marker image) a moment to arrive.
      await new Promise((r) => setTimeout(r, 300));
      return { name: store.state.name, duration: duration() };
    },
    async prepare({ width, height, fps: f }) {
      fps = f;
      viz.setFixedSize({ w: width, h: height });
      out = document.createElement('canvas');
      out.width = width;
      out.height = height;
      const buf = await renderWavBuffer();
      analyser = new BufferAnalyser(buf);
      hits = drumEventsFull();
      hitIndex = 0;
      clock.pos = 0;
      clock.snap = true;
      const wav = new Uint8Array(await audioBufferToWav(buf).arrayBuffer());
      let bin = '';
      for (let i = 0; i < wav.length; i += 0x8000) bin += String.fromCharCode(...wav.subarray(i, i + 0x8000));
      return { frames: Math.ceil(duration() * fps), duration: duration(), wav: btoa(bin) };
    },
    /** Render frame `i` and return it as a data URL (PNG by default). */
    frame(i, format = 'image/png', quality = 0.95) {
      const time = i / fps;
      const dt = 1 / fps;
      clock.pos = time;
      applyKeyframesAt(time);
      if (store.state.drums.pulse) {
        const src = drumSourceLayer();
        while (hitIndex < hits.length && hits[hitIndex].time <= time + 1e-9) viz.pulse(hits[hitIndex++].kind, src?.id);
      }
      renderScene(time, { dt, now: time, playing: true, snap: i === 0 });
      const g = out.getContext('2d');
      g.drawImage(viz.canvas, 0, 0, out.width, out.height);
      drawOverlay(g, out.width, out.height, overlayData(analyser.at(time)));
      return out.toDataURL(format, quality);
    },
  };
}

/* ------------------------------------------------------------------ boot */

function boot() {
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
