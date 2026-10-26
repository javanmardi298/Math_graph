/**
 * "From audio" tab: drop in a file and get a preset back.
 *
 *  1. A file this app exported (WAV, MP4, WebM, PNG) carries its preset inside: it opens
 *     exactly as it was (export/embed.js).
 *  2. Any other recording is transcribed (src/analysis): pitch, notes, tempo, key and scale,
 *     tuning, the nearest instrument and room. Every choice stays editable, the result can be
 *     played next to the original, and it is checked by playing it back through the synth.
 */
import { h, group } from './controls.js';
import { AudioEngine } from '../audio/engine.js';
import { INSTRUMENTS, INSTRUMENT_GROUPS } from '../audio/instruments.js';
import { defaultState } from '../state.js';
import { SCALE_GROUPS, SCALE_LABELS, NOTE_NAMES, quantize, noteName } from '../math/music.js';
import { noteRange } from '../analysis/key.js';
import { extractPresetFromFile } from '../export/embed.js';
import { isPreset, clean, singleFile } from '../library.js';
import { analyzeFile, transcribe, instrumentCandidates, guessReverb, verify, buildPreset, shiftOf, REVERBS, MAX_SECONDS } from '../analysis/index.js';

const baseName = (n) => n.replace(/\.(mmv\.json|[^.]+)$/i, '').replace(/[_]+/g, ' ').trim() || 'Audio';

/** One note list through the app's own synth (the same instruments as in a preset). */
export async function renderJob({ notes, instrument, reverb, articulation, tuning, seconds, scale = 'continuous', root = 0, shift = 0 }) {
  const settings = defaultState().audio;
  settings.tuning = tuning;
  settings.reverb = { ...settings.reverb, decay: reverb.decay, mix: reverb.mix };
  settings.delay = { ...settings.delay, mix: 0 };
  settings.articulation = articulation;
  const list = notes.map((n) => ({
    t: n.start, midi: (scale === 'continuous' ? n.pitch : quantize(n.pitch, scale, root)) - shift, vel: 0.45 + 0.4 * n.vel, length: Math.max(0.05, n.end - n.start),
  }));
  const end = Math.min(seconds ?? Infinity, (notes[notes.length - 1]?.end ?? 1) + 0.3);
  return AudioEngine.renderNotesOffline({ settings, duration: Math.max(1, end), notes: list, instrument, length: 0.5, volume: 1, sampleRate: 44100 });
}

const field = (label, control, hint) => h('div.ctl.alab-field', {}, h('label', {}, label), control, hint ? h('span.hint.alab-hint', {}, hint) : null);
const optionList = (pairs) => pairs.map(([v, t]) => h('option', { value: v }, t));

export class AudioLabView {
  /**
   * @param {{loadPreset:(p:object)=>void, toast:(m:string)=>void, download:(b:Blob,n:string)=>void, savePreset:(p:object,o:{name:string})=>void}} actions
   */
  constructor(actions) {
    this.actions = actions;
    this.session = null;
    this.result = null;
    this.opt = { sensitivity: 0.5, minNote: 0.07, octave: 0, division: 'auto', bpm: null, scale: null, root: null, snap: true, tuning: null };
    this.pick = { instrument: 'sine', reverb: 1, articulation: 'auto', aspect: '9:16', name: '', trimStart: true };
    this.removed = [];
    this.busy = false;
    this.el = h('div.tab-inner.alab');
    this.el.addEventListener('dragover', (e) => { e.preventDefault(); this.el.classList.add('is-drop'); });
    this.el.addEventListener('dragleave', () => this.el.classList.remove('is-drop'));
    this.el.addEventListener('drop', (e) => { e.preventDefault(); this.el.classList.remove('is-drop'); if (e.dataTransfer.files[0]) this.open(e.dataTransfer.files[0]); });
    this.render();
  }

  /* ----------------------------------------------------------------- shell */

  render() {
    const input = h('input', { type: 'file', accept: 'audio/*,video/*,image/png,.wav,.mp3,.m4a,.aac,.ogg,.opus,.flac,.mp4,.webm,.mov,.png,.json', hidden: true });
    input.addEventListener('change', () => { if (input.files[0]) this.open(input.files[0]); input.value = ''; });
    this.status = h('p.hint.alab-status', { 'aria-live': 'polite' });
    this.bar = h('progress', { max: 1, value: 0, hidden: true });
    this.out = h('div.alab-out');
    this.el.replaceChildren(
      h('div.alab-head', {}, h('strong', {}, '♪ From audio'),
        h('span.hint', {}, 'Drop in a song, a voice memo, or a file you exported from this app. You get a preset back.')),
      h('div.alab-drop', {}, h('button.btn', { type: 'button', onclick: () => input.click() }, 'Choose a file…'), input,
        h('span.hint', {}, 'or drop it here · WAV, MP3, M4A, OGG, FLAC, MP4, WebM, PNG')),
      this.status, this.bar, this.out,
      group('How this works', [
        h('p.hint', {}, '1. Files exported from this app (with “Hide the preset inside the file” ticked, the default) bring back the exact preset: nothing is guessed.'),
        h('p.hint', {}, '2. Any other sound is transcribed: the melody (one note at a time), tempo, key and scale, tuning, nearest instrument and room. That is a very good starting point, not a copy: chords, drums and the visuals cannot be read from sound.'),
        h('p.hint', {}, 'Works best on one clear melody: a voice, a lead, a flute, a piano line. A mix of many instruments will give the loudest line.'),
      ], { open: false }),
    );
  }

  say(text, busy = false, progress = null) {
    this.status.textContent = text;
    this.bar.hidden = !busy;
    if (progress != null) this.bar.value = progress; else if (busy) this.bar.removeAttribute('value');
  }

  /* ------------------------------------------------------------------ open */

  async open(file) {
    if (this.busy) return;
    this.busy = true;
    this.stop();
    this.out.replaceChildren();
    this.exactEl = null;
    this.removed = [];
    this.session = this.result = null;
    try {
      this.say('Looking inside the file…', true);
      const hidden = await extractPresetFromFile(file).catch(() => null);
      let exact = null;
      if (hidden) { try { const d = JSON.parse(hidden); if (isPreset(d)) exact = clean(d); } catch { /* not ours */ } }
      if (!exact && /\.json$/i.test(file.name)) {
        try { const d = JSON.parse(await file.text()); if (isPreset(d)) exact = clean(d); } catch { /* ignore */ }
        if (!exact) throw new Error('This JSON is not a Math-Melody preset.');
      }
      if (exact) this.showExact(exact, file);
      if (/\.(json)$/i.test(file.name)) { this.say(''); return; }
      this.say('Reading the sound…', true);
      const buffer = await this.decode(file);
      this.name = baseName(file.name);
      this.pick.name = exact?.name ? `${exact.name} (from audio)` : this.name;
      const long = buffer.duration > MAX_SECONDS;
      this.say(`Listening to ${Math.min(buffer.duration, MAX_SECONDS).toFixed(0)} s${long ? ` (the first ${MAX_SECONDS} s of ${buffer.duration.toFixed(0)} s)` : ''}…`, true, 0);
      this.session = await analyzeFile(buffer, { name: this.name }, (p) => this.say(`Finding the notes… ${Math.round(p * 100)}%`, true, p));
      this.opt = { sensitivity: 0.5, minNote: 0.07, octave: 0, division: 'auto', bpm: null, scale: null, root: null, snap: true, tuning: null };
      this.recompute(true);
      this.buildResult();
      this.say('');
      this.check();
    } catch (err) {
      this.say(`⚠ ${err.message || err}`);
    } finally {
      this.busy = false;
      if (!this.checking) this.bar.hidden = true;
    }
  }

  async decode(file) {
    const data = await file.arrayBuffer();
    const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    try {
      return await new Ctx(2, 44100, 44100).decodeAudioData(data);
    } catch {
      throw new Error('This browser could not read the sound in that file. Try a WAV or MP3.');
    }
  }

  showExact(preset, file) {
    this.out.append(this.exactEl = h('div.alab-card.alab-exact', {},
      h('strong', {}, '✓ This file carries its preset'),
      h('p.hint', {}, `“${preset.name || file.name}”: ${preset.layers.length} layer${preset.layers.length === 1 ? '' : 's'}, ${preset.mode?.toUpperCase?.() || '2D'}. It opens exactly as it was exported.`),
      h('div.row', {},
        h('button.btn', { type: 'button', onclick: () => { this.actions.loadPreset(preset); this.actions.toast('Preset opened.'); } }, 'Open the preset'),
        h('button.btn.ghost', { type: 'button', onclick: () => { this.actions.savePreset(preset, { name: preset.name || this.name }); this.actions.toast('Saved to your library.'); } }, 'Save to library'),
        h('button.btn.ghost', { type: 'button', onclick: () => this.actions.download(new Blob([singleFile(preset)], { type: 'application/json' }), `${(preset.name || 'preset').replace(/[\\/:*?"<>|]+/g, '-')}.mmv.json`) }, 'Download .mmv.json'))));
  }

  /* ------------------------------------------------------------- transcribe */

  /** Re-run the quick steps with the current options. */
  recompute(first = false) {
    const r = transcribe(this.session, this.opt);
    if (this.removed.length) {
      r.notes = r.notes.filter((n) => !this.removed.some((x) => n.start < x.t + 0.03 && n.end > x.t - 0.03 && Math.abs(n.pitch - x.pitch) < 1));
      if (r.notes.length) r.range = noteRange(r.notes.map((n) => ({ midi: n.pitch })));
    }
    this.result = r;
    if (first) {
      this.cands = instrumentCandidates(this.session, r, 6);
      this.pick.instrument = this.cands[0]?.id || 'sine';
      this.pick.reverb = guessReverb(this.session, r);
    }
    this.stale();
  }

  stale() { if (this.scoreEl) this.scoreEl.textContent = 'Changed since the last check: press “Check the match”.'; }

  scaleKey() {
    const r = this.result;
    return r.snap && r.scale ? r.scale.scale : 'continuous';
  }

  articulation() {
    return this.pick.articulation === 'auto' ? (this.result.plucky ? 'pluck' : 'legato') : this.pick.articulation;
  }

  makePreset() {
    const r = this.result;
    return buildPreset({
      notes: r.notes, bpm: r.bpm, scale: this.scaleKey(), root: r.scale?.root ?? 0, tuning: r.tuning.hz,
      instrument: this.pick.instrument, articulation: this.articulation(), reverb: REVERBS[this.pick.reverb],
      name: this.pick.name || this.name, aspect: this.pick.aspect, shift: shiftOf(this.pick.instrument), trim: this.trim(),
    });
  }

  /** Seconds of silence cut from the start of the preset (a whole number of beats, so the beat grid stays put). */
  trim() {
    const r = this.result;
    if (!this.pick.trimStart || !r.notes.length) return 0;
    const beat = 60 / r.bpm;
    return Math.max(0, Math.floor((r.notes[0].start - 0.25) / beat)) * beat;
  }

  job(seconds) {
    const r = this.result;
    return { notes: r.notes, instrument: this.pick.instrument, reverb: REVERBS[this.pick.reverb], articulation: this.articulation(), tuning: r.tuning.hz, seconds, scale: this.scaleKey(), root: r.scale?.root ?? 0, shift: shiftOf(this.pick.instrument) };
  }

  async check() {
    if (!this.session || !this.result?.notes.length || this.checking) return;
    this.checking = true;
    this.checkBtn && (this.checkBtn.disabled = true);
    try {
      const cands = this.cands.slice(0, 3).map((c) => c.id);
      if (!cands.includes(this.pick.instrument)) cands.unshift(this.pick.instrument);
      const best = await verify(this.session, this.result, (job) => renderJob({ ...job, scale: this.scaleKey(), root: this.result.scale?.root ?? 0 }),
        { candidates: cands, reverb: this.pick.reverb }, (p) => this.say(`Checking against the original… ${Math.round(p * 100)}%`, true, p));
      this.pick.instrument = best.instrument;
      this.pick.reverb = best.reverb;
      this.lastScore = best.score;
      this.syncPicks();
      this.showScore();
    } catch (err) {
      this.say(`⚠ Could not check the match (${err.message || err}).`);
    } finally {
      this.checking = false;
      this.checkBtn && (this.checkBtn.disabled = false);
      if (!this.busy) this.say('');
    }
  }

  showScore() {
    const s = this.lastScore;
    if (!s) return;
    const pct = Math.round(s.score * 100);
    const word = pct >= 85 ? 'very close' : pct >= 70 ? 'close' : pct >= 55 ? 'recognisable' : 'rough';
    this.scoreEl.textContent = `Match with the original: ${pct}% (${word}). Notes ${Math.round(s.notes * 100)}% · loudness shape ${Math.round(s.loudness * 100)}% · tone ${Math.round(s.tone * 100)}%. A gauge for comparing choices, not a verdict.`;
  }

  /* ----------------------------------------------------------------- result */

  buildResult() {
    const r = this.result;
    this.out.replaceChildren(...(this.exactEl ? [this.exactEl] : []));
    if (!r.notes.length) {
      this.out.append(h('div.alab-card', {}, h('strong', {}, 'No clear melody found'),
        h('p.hint', {}, 'Try raising “Sensitivity”, or a file with one clear voice or instrument. Drums and thick mixes have no single pitch to follow.')), this.controlsOnlySensitivity());
      return;
    }
    this.roll = h('canvas.alab-roll', { width: 600, height: 150, 'aria-label': 'Detected notes', title: 'Click a note to remove it' });
    this.roll.addEventListener('click', (e) => this.rollClick(e));
    this.removedEl = h('p.hint.alab-removed');
    this.summary = h('p.alab-summary');
    this.scoreEl = h('p.hint.alab-score', {}, '');
    this.checkBtn = h('button.btn.small.ghost', { type: 'button', onclick: () => this.check() }, 'Check the match');
    this.playOrig = h('button.btn.small', { type: 'button', onclick: () => this.togglePlay('orig') }, '▶ Original');
    this.playTr = h('button.btn.small', { type: 'button', onclick: () => this.togglePlay('tr') }, '▶ Transcription');
    this.out.append(
      h('div.alab-card', {}, this.summary, this.roll, this.removedEl,
        h('div.row.alab-play', {}, this.playOrig, this.playTr), this.scoreEl),
      this.notesGroup(), this.tempoGroup(), this.keyGroup(), this.soundGroup(),
      h('div.alab-actions', {},
        h('button.btn', { type: 'button', onclick: () => { this.actions.loadPreset(this.makePreset()); this.actions.toast('Preset opened. Press play.'); } }, 'Open as preset'),
        h('button.btn.ghost', { type: 'button', onclick: () => { const p = this.makePreset(); this.actions.savePreset(p, { name: p.name }); this.actions.toast('Saved to your library.'); } }, 'Save to library'),
        h('button.btn.ghost', { type: 'button', onclick: () => { const p = this.makePreset(); this.actions.download(new Blob([singleFile(p)], { type: 'application/json' }), `${p.name.replace(/[\\/:*?"<>|]+/g, '-')}.mmv.json`); } }, 'Download .mmv.json')),
    );
    this.refresh();
  }

  controlsOnlySensitivity() {
    return this.notesGroup();
  }

  /** Redraw everything that depends on the transcription. */
  refresh() {
    const r = this.result;
    if (!this.summary) return;
    const sc = r.scale;
    const exact = sc && sc.coverage >= 0.97;
    this.summary.replaceChildren(
      h('strong', {}, `${r.notes.length} notes · ${r.bpm} BPM`),
      ` · ${sc ? `${NOTE_NAMES[sc.root]} ${SCALE_LABELS[sc.scale] || sc.scale}` : 'no key'}${sc ? ` (${Math.round(sc.coverage * 100)}% of the notes${exact ? '' : ', rest snapped or kept'})` : ''}`,
      ` · ${noteName(r.range.lo)}–${noteName(r.range.hi)} · A = ${r.tuning.hz.toFixed(1)} Hz${r.tuning.microtonal ? ' · quarter tones' : ''}`);
    this.fillScales?.();
    this.drawRoll();
    this.removedEl.replaceChildren(this.removed.length
      ? h('span', {}, `${this.removed.length} note${this.removed.length === 1 ? '' : 's'} removed. `, h('button.btn.small.ghost', { type: 'button', onclick: () => { this.removed = []; this.change({}); } }, 'Restore'))
      : 'Click a note above to remove a wrong one.');
  }

  /** Remove the note under the click. */
  rollClick(e) {
    const r = this.result, cv = this.roll, box = cv.getBoundingClientRect();
    const end = Math.max(r.notes[r.notes.length - 1].end, 1), lo = r.range.lo - 2, hi = r.range.hi + 2;
    const t = ((e.clientX - box.left) / box.width) * end;
    const m = lo + ((box.bottom - e.clientY - 6 * box.height / cv.height) / (box.height - 12 * box.height / cv.height)) * (hi - lo);
    let best = null, bd = Infinity;
    for (const n of r.notes) {
      if (t < n.start - 0.04 || t > n.end + 0.04) continue;
      const d = Math.abs(n.pitch - m);
      if (d < bd) { bd = d; best = n; }
    }
    if (!best || bd > 3) return;
    this.removed.push({ t: (best.start + best.end) / 2, pitch: best.pitch });
    this.change({});
  }

  drawRoll() {
    const cv = this.roll, r = this.result, ctx = cv.getContext('2d');
    const W = cv.width = Math.max(300, Math.round(cv.clientWidth * (devicePixelRatio || 1)) || 600), H = cv.height = 150;
    const css = getComputedStyle(this.el);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(128,140,180,0.10)';
    ctx.fillRect(0, 0, W, H);
    const end = Math.max(r.notes[r.notes.length - 1].end, 1), lo = r.range.lo - 2, hi = r.range.hi + 2;
    const X = (t) => (t / end) * W, Y = (m) => H - 6 - ((m - lo) / (hi - lo)) * (H - 12);
    // loudness of the original
    const { rms, hop } = this.session.track, top = Math.max(...rms) || 1;
    ctx.fillStyle = 'rgba(128,140,180,0.22)';
    for (let i = 0; i < rms.length; i += 2) {
      const t = i * hop;
      if (t > end) break;
      const hgt = Math.min(1, rms[i] / top) * H * 0.9;
      ctx.fillRect(X(t), H - hgt, Math.max(1, X(hop * 2)), hgt);
    }
    // beat lines
    ctx.strokeStyle = 'rgba(128,140,180,0.25)';
    ctx.lineWidth = 1;
    const beat = 60 / r.bpm;
    for (let t = r.offset % beat; t < end; t += beat) { ctx.beginPath(); ctx.moveTo(X(t), 0); ctx.lineTo(X(t), H); ctx.stroke(); }
    const accent = css.getPropertyValue('--accent').trim() || '#22e4ff';
    for (const n of r.notes) {
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.45 + 0.55 * n.vel;
      ctx.fillRect(X(n.start), Y(n.pitch) - 3, Math.max(2, X(n.end) - X(n.start) - 1), 6);
    }
    ctx.globalAlpha = 1;
  }

  /** Option changes: quick re-run, then redraw. */
  change(patch) {
    const had = this.result.notes.length > 0;
    Object.assign(this.opt, patch);
    this.recompute(false);
    if (had !== this.result.notes.length > 0) return this.buildResult();
    this.refresh();
    this.syncPicks();
  }

  slider(label, min, max, step, get, set, fmt) {
    const out = h('output.ctl-value', {}, fmt(get()));
    const input = h('input', { type: 'range', min, max, step });
    input.value = get();
    input.addEventListener('input', () => { out.textContent = fmt(+input.value); });
    input.addEventListener('change', () => set(+input.value));
    return h('div.ctl.ctl-slider', {}, h('label', {}, label), out, input);
  }

  notesGroup() {
    return group('Notes', [
      this.slider('Sensitivity', 0, 1, 0.05, () => this.opt.sensitivity, (v) => { this.opt.sensitivity = v; this.change({}); }, (v) => `${Math.round(v * 100)}%`),
      this.slider('Shortest note', 30, 300, 5, () => this.opt.minNote * 1000, (v) => { this.opt.minNote = v / 1000; this.change({}); }, (v) => `${Math.round(v)} ms`),
      (() => {
        const sel = h('select', {}, optionList([[-2, '2 octaves lower'], [-1, '1 octave lower'], [0, 'As heard'], [1, '1 octave higher'], [2, '2 octaves higher']]));
        sel.value = this.opt.octave;
        sel.addEventListener('change', () => this.change({ octave: +sel.value }));
        return field('Octave', sel);
      })(),
    ], { hint: 'Higher sensitivity accepts shakier pitch (breathy voice, noise). A longer shortest-note drops grace notes and blips.' });
  }

  tempoGroup() {
    const r = this.result;
    this.bpmIn = h('input', { type: 'number', min: 30, max: 300, step: 0.5 });
    this.bpmIn.value = r.bpm;
    this.bpmIn.addEventListener('change', () => { const v = +this.bpmIn.value; if (v >= 30 && v <= 300) this.change({ bpm: v }); });
    const mul = (k) => h('button.btn.small.ghost', { type: 'button', onclick: () => { const v = Math.min(300, Math.max(30, Math.round(this.result.bpm * k * 10) / 10)); this.bpmIn.value = v; this.change({ bpm: v }); } }, k === 2 ? '×2' : '÷2');
    const div = h('select', {}, optionList([['auto', 'Auto'], [0, 'Off (keep the exact timing)'], [2, 'Eighth notes'], [4, 'Sixteenth notes'], [3, 'Eighth-note triplets'], [6, 'Sixteenth triplets']]));
    div.value = String(this.opt.division);
    div.addEventListener('change', () => this.change({ division: div.value === 'auto' ? 'auto' : +div.value }));
    return group('Tempo & rhythm', [
      field('Tempo (BPM)', h('div.row.alab-bpm', {}, this.bpmIn, mul(0.5), mul(2), h('button.btn.small.ghost', { type: 'button', title: 'Back to the detected tempo', onclick: () => { this.opt.bpm = null; this.change({}); this.bpmIn.value = this.result.bpm; } }, 'Auto'))),
      field('Snap notes to', div, `Detected ${r.bpm} BPM, ${Math.round(r.tempoConfidence * 100)}% sure. If it sounds twice too fast or slow, use ×2 or ÷2.`),
    ]);
  }

  keyGroup() {
    const r = this.result;
    this.scaleSel = h('select');
    this.rootSel = h('select', {}, NOTE_NAMES.map((n, i) => h('option', { value: i }, n)));
    const fill = () => {
      const top = [];
      const seen = new Set();
      for (const c of this.result.ranked) { const k = `${c.scale}/${c.root}`; if (!seen.has(k)) { seen.add(k); top.push(c); } if (top.length >= 6) break; }
      this.scaleSel.replaceChildren(
        h('optgroup', { label: 'Best matches' }, top.map((c) => h('option', { value: `${c.scale}/${c.root}` }, `${NOTE_NAMES[c.root]} ${SCALE_LABELS[c.scale]} · ${Math.round(c.coverage * 100)}%`))),
        ...SCALE_GROUPS.filter(([, keys]) => keys.some((k) => k !== 'continuous')).map(([g, keys]) => h('optgroup', { label: g }, keys.filter((k) => k !== 'continuous').map((k) => h('option', { value: `${k}/*` }, SCALE_LABELS[k])))));
      const cur = this.result.scale;
      if (cur) { this.scaleSel.value = `${cur.scale}/${cur.root}`; if (this.scaleSel.value !== `${cur.scale}/${cur.root}`) this.scaleSel.value = `${cur.scale}/*`; this.rootSel.value = cur.root; }
    };
    this.fillScales = fill;
    fill();
    this.scaleSel.addEventListener('change', () => {
      const [scale, root] = this.scaleSel.value.split('/');
      this.change({ scale, root: root === '*' ? +this.rootSel.value : +root });
    });
    this.rootSel.addEventListener('change', () => { this.change({ scale: this.result.scale?.scale || 'major', root: +this.rootSel.value }); });
    const snap = h('input', { type: 'checkbox', role: 'switch' });
    snap.checked = this.opt.snap;
    snap.addEventListener('change', () => this.change({ snap: snap.checked }));
    this.tuneIn = h('input', { type: 'number', min: 380, max: 480, step: 0.1 });
    this.tuneIn.value = r.tuning.hz.toFixed(1);
    this.tuneIn.addEventListener('change', () => { const v = +this.tuneIn.value; if (v >= 380 && v <= 480) this.change({ tuning: v }); });
    return group('Key, scale & tuning', [
      field('Scale', this.scaleSel, 'Ranked by how much of the melody each scale contains. Quarter-tone melodies suggest maqam and dastgah scales.'),
      field('Key (root)', this.rootSel),
      h('div.ctl.ctl-toggle', {}, h('label', {}, 'Snap notes to the scale'), snap),
      field('Tuning, A4 =', h('div.row', {}, this.tuneIn, h('span.hint', {}, 'Hz'), h('button.btn.small.ghost', { type: 'button', onclick: () => { this.opt.tuning = null; this.change({}); this.tuneIn.value = this.result.tuning.hz.toFixed(1); } }, 'Auto')),
        'Recordings in 432 Hz or a slightly off-pitch tape are detected and followed.'),
    ]);
  }

  soundGroup() {
    this.instSel = h('select');
    const top = this.cands.map((c) => h('option', { value: c.id }, `${c.label} · ${Math.max(0, Math.round(100 - c.distance * 60))}% like`));
    this.instSel.append(h('optgroup', { label: 'Nearest in timbre' }, top),
      ...INSTRUMENT_GROUPS.map((g) => h('optgroup', { label: g }, Object.entries(INSTRUMENTS).filter(([, v]) => v.group === g).map(([id, v]) => h('option', { value: `all:${id}` }, v.label)))));
    this.instSel.addEventListener('change', () => { this.pick.instrument = this.instSel.value.replace('all:', ''); this.stale(); });
    this.revSel = h('select', {}, REVERBS.map((v, i) => h('option', { value: i }, `${v.label} (${v.decay}s)`)));
    this.revSel.addEventListener('change', () => { this.pick.reverb = +this.revSel.value; this.stale(); });
    this.artSel = h('select', {}, optionList([['auto', 'Auto'], ['pluck', 'Each note re-struck (plucked)'], ['legato', 'Smooth (held)']]));
    this.artSel.addEventListener('change', () => { this.pick.articulation = this.artSel.value; this.stale(); });
    this.aspSel = h('select', {}, optionList([['9:16', '9:16 · Shorts / Reels'], ['16:9', '16:9 · YouTube'], ['1:1', '1:1 · Square']]));
    this.aspSel.addEventListener('change', () => { this.pick.aspect = this.aspSel.value; });
    this.nameIn = h('input', { type: 'text', spellcheck: 'false', dir: 'auto' });
    this.nameIn.value = this.pick.name;
    this.nameIn.addEventListener('input', () => { this.pick.name = this.nameIn.value; });
    return group('Sound & look', [
      field('Instrument', this.instSel, 'The app’s own instruments, ranked by how their tone (attack, overtones, brightness) compares with the recording.'),
      field('Room (reverb)', this.revSel),
      field('Playing style', this.artSel),
      field('Frame', this.aspSel),
      field('Preset name', this.nameIn),
      (() => { const c = h('input', { type: 'checkbox', role: 'switch' }); c.checked = this.pick.trimStart; c.addEventListener('change', () => { this.pick.trimStart = c.checked; }); return h('div.ctl.ctl-toggle', {}, h('label', { title: 'Cuts the silence before the first note (a whole number of beats) so the preset starts right away' }, 'Cut the silence at the start'), c); })(),
      h('div.row', {}, this.checkBtn, h('span.hint', {}, 'Plays the notes back through the synth with the best instruments and rooms and keeps the closest.')),
    ]);
  }

  syncPicks() {
    if (!this.instSel) return;
    const id = this.pick.instrument;
    this.instSel.value = [...this.instSel.options].some((o) => o.value === id) ? id : `all:${id}`;
    this.revSel.value = this.pick.reverb;
    this.artSel.value = this.pick.articulation;
    this.aspSel.value = this.pick.aspect;
    if (this.bpmIn) this.bpmIn.value = this.result.bpm;
    if (this.tuneIn) this.tuneIn.value = this.result.tuning.hz.toFixed(1);
    if (this.rootSel && this.result.scale) this.rootSel.value = this.result.scale.root;
  }

  /* ---------------------------------------------------------------- playback */

  ctx() {
    this.audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    this.audioCtx.resume?.();
    return this.audioCtx;
  }

  stop() {
    try { this.source?.stop(); } catch { /* already stopped */ }
    this.source = null;
    if (this.playOrig) { this.playOrig.textContent = '▶ Original'; this.playTr.textContent = '▶ Transcription'; }
    this.playing = null;
  }

  async togglePlay(which) {
    const again = this.playing === which;
    this.stop();
    if (again) return;
    try {
      const buf = which === 'orig' ? this.session.buffer : await renderJob(this.job());
      const ctx = this.ctx();
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.onended = () => { if (this.source === src) this.stop(); };
      src.start();
      this.source = src;
      this.playing = which;
      (which === 'orig' ? this.playOrig : this.playTr).textContent = '■ Stop';
    } catch (err) {
      this.actions.toast(`Could not play (${err.message || err}).`);
    }
  }
}
