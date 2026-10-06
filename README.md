# Math-Melody Visualizer

Turn math formulas into neon graphs and live music, then record the result as a YouTube-ready video.
**x is time, y is pitch, z is volume or stereo pan.** Everything runs in the browser and works offline.

## Run it on localhost

You need [Node.js](https://nodejs.org) 18 or newer. There is nothing to install: three.js is already vendored in `vendor/`.

```bash
npm start            # → http://localhost:5173
```

Any static server works too, for example `python3 -m http.server 5173`. The page uses ES modules, so opening `index.html` straight from disk (`file://`) won't work.

```bash
npm test             # unit tests: formula parser, pitch mapping, MIDI writer, layer sampler
npm install && npm run vendor   # only needed if you want to refresh the vendored three.js
node scripts/build-artifact.mjs # builds dist/artifact.html for publishing as a claude.ai Artifact
```

## Features

| Area | What you get |
| --- | --- |
| Formulas | Safe parser (no `eval`): `sin cos tan exp ln log sqrt abs mod floor ceil round min max clamp lerp step smoothstep sinc gauss`, waveform helpers `saw tri square pulse noise`, implicit multiply (`2x`, `3sin(x)`), `|x|`, `π`, piecewise `x < 2 ? a : b`, live error messages |
| Layer types | `y = f(x)`, parametric `x(s), y(s), z(s)` (Lissajous, astroids, knots), polar `r(θ)`, 3D surfaces `h(x, y)` with a playhead path |
| Multi-layer | Up to 4 layers, each with its own colour, line style, waveform, volume, octave, pan, mute/solo |
| Live parameters | `a b c d` sliders reshape curves while they play; `t` animates formulas over time |
| Visuals | 2D (orthographic) and 3D (orbit camera); trace, ghost or full drawing; solid, gradient, rainbow or pitch colouring; solid, dashed or dotted lines; neon bloom, particle trails, motion blur, fog, depth of field; playhead shapes or your own image; 6 colour palettes |
| Sound | Web Audio synth: sine, square, sawtooth, triangle; scale quantising (major, minor, pentatonic, blues, dorian, hirajoshi…) in any key; glide; legato or pluck articulation; filter, distortion, delay, reverb; spectrum or waveform analyzer |
| Timeline | Scrub with audio, 0.1×–5× speed, loop, length, a mini-map of every layer's pitch |
| Export | Video (MP4 or WebM, 720p–4K, 30/60 fps, with audio and captions burned in); WAV (rendered offline, faster than real time); MIDI (one track per layer); PNG snapshot; preset `.json` |
| Presets | 9 built-ins (Bass Drop, Twin Harmony, Lissajous 3D, Astroid Wave, Rose Garden, Neon Terrain, Staircase Arp, Helix Ascent, Chaos Bells), save/load your own, auto-saved session |
| UX | Day/night theme, collapsible panels, cinema mode (hide UI), frame presets 16:9 / 9:16 / 1:1 / 4:5, keyboard shortcuts, phone layout |

### Keyboard

`Space` play/pause · `R` record · `Home` rewind · `← →` jump 1 s · `M` 2D/3D · `T` day/night · `H` hide UI · `F` full screen · `[` `]` panels · `?` help

## Project structure

```
index.html              app shell (top bar, panels, stage, timeline, dialogs)
src/
  main.js               clock, frame loop, wiring, exports, shortcuts
  state.js              single source of truth + layer model
  presets.js            built-in presets
  styles.css            glassmorphism UI, dark + light themes, responsive
  math/
    parser.js           tokenizer → AST → closures (safe formula compiler)
    layers.js           turns a layer's formulas into a curve P(u), u ∈ [0, 1]
    music.js            y → MIDI note, scales, note names
  audio/
    engine.js           Web Audio synth + effects; offline WAV rendering
    sonify.js           point → pitch / gain / pan (shared by synth, WAV and MIDI)
  render/
    visualizer.js       three.js scene, fat lines, particles, post-processing
  ui/
    controls.js         small bound-control toolkit
    panels.js           layers panel and inspector tabs
    timeline.js         scrubber with pitch mini-map
    overlay.js          captions + analyzer (same code on screen and in videos)
  export/
    recorder.js         MediaRecorder video capture
    midi.js             Standard MIDI File writer
    wav.js              16-bit WAV encoder
vendor/three/           three.js r170 + the addons used (offline)
scripts/                serve.mjs, vendor-three.mjs, build-artifact.mjs
tests/                  node:test unit tests
```

### Sync

While playing, the clock advances on the **audio hardware clock** (`AudioContext.currentTime`), so the picture can't drift from the sound. Every frame each layer's exact point is computed; the synth glides to it with `setTargetAtTime`, and the marker eases towards it, so jumps in the function glide instead of clicking or teleporting.

## Ideas for later

- Beat grid: snap x to BPM bars and quantise note lengths to 1/8 or 1/16.
- More instruments: FM bells, a sample-free drum layer triggered by zero crossings or peaks.
- Audio input: draw the spectrum of a microphone or audio file next to the curve.
- Keyframes: animate `a`–`d`, camera and colours along the timeline.
- Shareable links that encode the whole preset in the URL.
- Server-side rendering (Node + headless Chrome, or Python/FastAPI + ffmpeg) for frame-perfect 4K exports.

---

## راهنمای فارسی

**Math-Melody Visualizer** فرمول‌های ریاضی را به گراف نئونی و موسیقی زنده تبدیل می‌کند و خروجی ویدیو، WAV و MIDI می‌دهد. محور x زمان، محور y زیر و بمی نت، و محور z حجم صدا یا پنینگ است.

اجرا روی localhost (بدون اینترنت):

```bash
npm start   # سپس http://localhost:5173 را باز کنید
```

- فرمول را در پنل چپ بنویسید؛ خطا همان لحظه زیر فیلد نمایش داده می‌شود.
- Space برای پخش، R برای ضبط ویدیو، M برای جابه‌جایی 2D و 3D، T برای حالت روز و شب.
- از تب Sound یک گام موسیقی (مثلاً پنتاتونیک) انتخاب کنید تا هر منحنی خوش‌صدا شود.
- از تب Export ویدیو (MP4/WebM)، صدا (WAV) و MIDI بگیرید.
