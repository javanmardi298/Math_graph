/**
 * Math-Melody Visualizer — app entry point.
 *
 * Owns the transport clock and the per-frame loop:
 *   clock → progress u → each layer's point → (renderer, synth, overlay, recorder)
 * The clock advances on the audio hardware clock while playing, so picture and
 * sound stay locked together.
 */
import { store } from './state.js';
import { BUILTIN_PRESETS } from './presets.js';
import { CompiledLayer } from './math/layers.js';
import { AudioEngine } from './audio/engine.js';
import { voiceFrame, hasSolo } from './audio/sonify.js';
import { noteName, midiToFreq } from './math/music.js';
import { Visualizer } from './render/visualizer.js';
import { Panels, PALETTES } from './ui/panels.js';
import { Timeline } from './ui/timeline.js';
import { drawOverlay } from './ui/overlay.js';
import { h, bindPath, segmented, slider, number, toggle } from './ui/controls.js';
import { Recorder, download, pickFormat } from './export/recorder.js';
import { writeMidi, samplesToNotes } from './export/midi.js';
import { audioBufferToWav } from './export/wav.js';

const $ = (id) => document.getElementById(id);
const SESSION_KEY = 'mmv.session.v1';

/* ------------------------------------------------------------------ setup */

const stage = $('stage');
const overlay = $('overlay');
const og = overlay.getContext('2d');

let viz;
try {
  viz = new Visualizer($('gl-host'), store.state);
} catch (err) {
  $('fatal').hidden = false;
  $('fatal').querySelector('p').textContent = `WebGL could not start (${err.message}). Enable hardware acceleration or try another browser.`;
  throw err;
}
const audio = new AudioEngine();
const recorder = new Recorder();
/** @type {Map<string, CompiledLayer>} */
const compiled = new Map();

const clock = { pos: 0, playing: false, scrubbing: false, lastWall: performance.now() / 1000, lastAudio: 0, snap: true, autoStop: false };
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

const evalCtx = () => ({ t: clock.pos, params: store.state.params, view: store.state.view });

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
      c.at(i / (N - 1), ctx, p);
      ys[i] = l.mute ? NaN : Math.min(Math.max((p.y - view.yMin) / (view.yMax - view.yMin), 0), 1);
    }
    curves.push({ color: l.color, ys });
  }
  timeline.setCurves(curves);
}

/* ------------------------------------------------------- state reactions */

function applyStageAspect() {
  const a = store.state.visual.aspect;
  const wrap = $('stage-wrap');
  if (a === 'fill' || recorder.active) {
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

function applyAll() {
  viz.state = store.state;
  viz.applySettings();
  viz.buildGrid();
  viz.setMarkerImage(store.state.visual.marker.image);
  audio.applySettings(store.state.audio);
  rebuildAll();
  applyTheme();
  applyStageAspect();
  viz.resetCamera();
  $('project-name').value = store.state.name;
}

store.on((path) => {
  if (path === '*') { applyAll(); panels.refresh(); clock.snap = true; saveSession(); return; }
  const [root, second, third] = path.split('.');
  switch (root) {
    case 'layers': {
      if (!second || ['enabled', 'style', 'width', 'type'].includes(third)) {
        // Structural change → rebuild cards + views.
        if (!second) panels.renderLayers();
        rebuildAll();
      } else {
        const layer = store.state.layers.find((l) => l.id === second);
        if (!layer) break;
        if (third === 'exprs' || third === 'look') { rebuildLayer(layer); viz.restyle(); updateTimelineCurves(); }
        if (third === 'wave') audio.syncLayers(store.state.layers);
        if (third === 'mute') updateTimelineCurves();
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
      if (second === 'duration') updateTimelineCurves();
      break;
    case 'theme':
      applyTheme();
      break;
  }
  saveSession();
});

let saveTimer;
function saveSession() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(store.snapshot())); } catch { /* storage blocked or full */ }
  }, 600);
}

/* ------------------------------------------------------------- transport */

async function play() {
  try {
    await audio.ensure();
  } catch (err) {
    toast(`Audio could not start: ${err.message}`);
  }
  audio.applySettings(store.state.audio);
  audio.syncLayers(store.state.layers);
  if (clock.pos >= store.state.transport.duration - 1e-3) clock.pos = 0;
  clock.playing = true;
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
  clock.pos = Math.min(Math.max(u, 0), 1) * store.state.transport.duration;
  clock.snap = true;
}

function updateTransportUI() {
  const b = $('play-btn');
  b.setAttribute('aria-label', clock.playing ? 'Pause' : 'Play');
  b.classList.toggle('is-playing', clock.playing);
  b.querySelector('.ico').textContent = clock.playing ? '❚❚' : '▶';
}

/* ---------------------------------------------------------- frame loop */

const point = { x: 0, y: 0, z: 0 };

function frame() {
  requestAnimationFrame(frame);
  const wall = performance.now() / 1000;
  let dt = Math.min(Math.max(wall - clock.lastWall, 0), 0.1);
  clock.lastWall = wall;
  const { transport, layers } = store.state;
  const dur = Math.max(0.5, transport.duration);

  if (clock.playing) {
    // Prefer the audio hardware clock: it never drifts from what you hear.
    const aNow = audio.now();
    const adt = aNow - clock.lastAudio;
    clock.lastAudio = aNow;
    if (audio.ready && audio.ctx.state === 'running' && adt > 0 && adt < 0.25) dt = adt;
    clock.pos += dt * transport.speed;
    if (clock.pos >= dur) {
      if (clock.autoStop && recorder.active) { clock.pos = dur; stopRecording(); pause(); }
      else if (transport.loop) clock.pos %= dur;
      else { clock.pos = dur; pause(); }
    }
  }
  const u = clock.pos / dur;
  const ctx = evalCtx();

  // Animated formulas (using t) are re-sampled every frame.
  for (const l of layers) {
    const c = compiled.get(l.id);
    if (l.enabled && c?.usesTime) viz.rebuildLayer(l.id, c, ctx);
  }

  const items = [];
  const frames = [];
  const solo = hasSolo(layers);
  for (const l of layers) {
    const c = compiled.get(l.id);
    if (!c) continue;
    const p = c.at(Math.min(u, 1), ctx, { ...point });
    const vf = voiceFrame(l, p, store.state, solo);
    frames.push(vf);
    notes.set(l.id, vf.midi);
    if (l.enabled) items.push({ id: l.id, u, point: p, compiled: c });
  }
  const sounding = clock.playing || clock.scrubbing;
  audio.update(frames, { playing: sounding, glide: store.state.audio.glide, articulation: store.state.audio.articulation });

  viz.render(items, ctx, { dt, now: wall, snap: clock.snap, playing: sounding });
  clock.snap = false;

  og.clearRect(0, 0, overlay.width, overlay.height);
  drawOverlay(og, overlay.width, overlay.height, overlayData());
  if (recorder.active) {
    recorder.composite();
    $('rec-time').textContent = fmtRec(recorder.elapsed);
  }
  timeline.setProgress(Math.min(u, 1), clock.pos);
  updateHud(frames);
}

function overlayData() {
  const light = isLight(store.state.visual.background);
  return {
    state: store.state,
    layers: store.state.layers,
    notes: clock.playing || clock.scrubbing ? notes : new Map(),
    spectrum: audio.spectrum(),
    waveform: audio.waveform(),
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

function recordSize() {
  const short = { '720p': 720, '1080p': 1080, '1440p': 1440, '2160p': 2160 }[store.state.record.resolution] || 1080;
  const a = store.state.visual.aspect;
  let ratio;
  if (a === 'fill') ratio = stage.clientWidth / stage.clientHeight;
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

/** Show a finished export with a preview and a download button. */
function showResult(blob, filename, kind) {
  const dlg = $('result-dialog');
  const url = URL.createObjectURL(blob);
  const media = kind === 'video' ? h('video', { src: url, controls: true, playsinline: true })
    : kind === 'audio' ? h('audio', { src: url, controls: true })
      : kind === 'image' ? h('img', { src: url, alt: 'Snapshot preview' }) : null;
  $('result-media').replaceChildren(...(media ? [media] : []));
  $('result-info').textContent = `${filename} · ${(blob.size / 1048576).toFixed(2)} MB`;
  $('result-download').onclick = () => download(blob, filename);
  dlg.onclose = () => setTimeout(() => URL.revokeObjectURL(url), 1000);
  dlg.showModal();
}

/* --------------------------------------------------------------- exports */

function sampleVoices(step) {
  const { layers, transport } = store.state;
  const solo = hasSolo(layers);
  const dur = transport.duration;
  const out = layers.filter((l) => l.enabled).map((l) => ({ layer: l, samples: [] }));
  const p = { x: 0, y: 0, z: 0 };
  for (let time = 0; time < dur; time += step) {
    const ctx = { t: time, params: store.state.params, view: store.state.view };
    for (const o of out) {
      compiled.get(o.layer.id).at(time / dur, ctx, p);
      const f = voiceFrame(o.layer, p, store.state, solo);
      o.samples.push({ time, midi: f.midi, vel: Math.min(127, 40 + f.gain * 100) });
    }
  }
  return out;
}

function exportMidi() {
  const step = 1 / 50;
  const PROGRAM = { sine: 79, triangle: 73, square: 80, sawtooth: 81 };
  const tracks = sampleVoices(step).map((o, i) => ({
    name: o.layer.name,
    channel: i,
    program: PROGRAM[o.layer.wave] ?? 80,
    notes: samplesToNotes(o.samples, step, 0.05),
  }));
  if (!tracks.length) return toast('Turn on at least one layer to export MIDI.');
  const bytes = writeMidi(tracks, store.state.transport.bpm || 120);
  download(new Blob([bytes], { type: 'audio/midi' }), `${slug()}.mid`);
  toast(`MIDI exported: ${tracks.reduce((n, t) => n + t.notes.length, 0)} notes in ${tracks.length} track${tracks.length > 1 ? 's' : ''}.`);
}

async function exportWav() {
  const { layers, transport, audio: a } = store.state;
  const enabled = layers.filter((l) => l.enabled);
  if (!enabled.length) return toast('Turn on at least one layer to export audio.');
  toast('Rendering audio…', 60000);
  const solo = hasSolo(layers);
  const p = { x: 0, y: 0, z: 0 };
  try {
    const buf = await AudioEngine.renderOffline({
      settings: structuredClone(a),
      layers: enabled,
      duration: transport.duration,
      glide: a.glide,
      articulation: a.articulation,
      frameAt: (time) => enabled.map((l) => {
        compiled.get(l.id).at(time / transport.duration, { t: time, params: store.state.params, view: store.state.view }, p);
        return voiceFrame(l, p, store.state, solo);
      }),
    });
    toast('Audio ready.');
    showResult(audioBufferToWav(buf), `${slug()}.wav`, 'audio');
  } catch (err) {
    toast(`Audio render failed: ${err.message}`, 6000);
  }
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
  if (wasPlaying) audio.syncLayers(store.state.layers);
  toast(`Preset “${store.state.name}” loaded.`);
}

/* ------------------------------------------------------------- UI wiring */

const timeline = new Timeline({
  onSeek: (u) => seek(u),
  onScrubState: async (on) => {
    clock.scrubbing = on;
    if (on && !audio.ready) { try { await audio.ensure(); audio.applySettings(store.state.audio); audio.syncLayers(store.state.layers); } catch { /* ignore */ } }
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
  const dur = store.state.transport.duration;
  switch (e.key) {
    case ' ': e.preventDefault(); togglePlay(); break;
    case 'r': case 'R': toggleRecord(); break;
    case 'Home': case '0': seek(0); break;
    case 'ArrowLeft': if (e.target === document.body) { seek((clock.pos - 1) / dur); e.preventDefault(); } break;
    case 'ArrowRight': if (e.target === document.body) { seek((clock.pos + 1) / dur); e.preventDefault(); } break;
    case 'm': case 'M': store.set('mode', store.state.mode === '2d' ? '3d' : '2d'); break;
    case 't': case 'T': toggleTheme(); break;
    case 'h': case 'H': document.body.classList.toggle('cinema'); break;
    case 'f': case 'F': $('fullscreen-btn').click(); break;
    case '[': togglePanel('left'); break;
    case ']': togglePanel('right'); break;
    case '?': $('help-dialog').showModal(); break;
    case 'Escape': document.body.classList.remove('cinema'); break;
  }
});

/* ------------------------------------------------------------------ boot */

function boot() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { /* ignore */ }
  if (saved?.layers?.length) store.load(saved);
  else store.load(BUILTIN_PRESETS[0]);
  // Small screens start with panels tucked away.
  if (window.innerWidth < 900) { togglePanel('left'); togglePanel('right'); }
  updateTransportUI();
  $('loading').hidden = true;
  requestAnimationFrame(frame);
}
boot();
