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
npm test             # unit tests: parser, pitch mapping, MIDI, sampler, beat grid, keyframes, drums, analyser
npm install && npm run vendor   # only needed if you want to refresh the vendored three.js
node scripts/build-artifact.mjs # builds dist/artifact.html for publishing as a claude.ai Artifact
```

### Studio render (frame-perfect 4K)

Live recording captures whatever your GPU manages in real time. The studio render
instead draws **every frame at its exact time** in a headless browser and encodes
with ffmpeg, so a 4K 60 fps video never drops a frame, however slow the machine.

One-time setup:

```bash
npm install                      # installs Playwright (dev dependency)
npx playwright install chromium  # the headless browser
# and install ffmpeg: https://ffmpeg.org  (or set FFMPEG_PATH)
```

Then either press **Export → Studio render** in the app (served by `npm start`), or use the CLI:

```bash
npm run render -- --builtin "Lissajous 3D" --width 3840 --height 2160 --fps 60 --out lissajous-4k.mp4
npm run render -- --preset my-song.mmv.json --width 1080 --height 1920 --out short.mp4   # 9:16
```

ffmpeg is found on PATH, in `FFMPEG_PATH`, in the usual Windows/macOS install folders, or from the
optional `ffmpeg-static` package that `npm install` tries to fetch. **Export → Studio render** says exactly
what is missing and has a *Check again* button, so you don't need to restart the server after installing.

Options: `--crf 16` (quality, lower is better), `--speed medium` (x264 preset), `--jpeg` (faster frame
transfer), `--software` (force CPU rendering when there is no GPU). Finished videos from the app land in `renders/`.

## Features

| Area | What you get |
| --- | --- |
| Formulas | Safe parser (no `eval`): `sin cos tan exp ln log sqrt abs mod floor ceil round min max clamp lerp step smoothstep sinc gauss`, waveform helpers `saw tri square pulse noise`, implicit multiply (`2x`, `3sin(x)`), `|x|`, `π`, piecewise `x < 2 ? a : b`, live error messages |
| Layer types | `y = f(x)`, parametric `x(s), y(s), z(s)` (Lissajous, astroids, knots), polar `r(θ)`, 3D surfaces `h(x, y)` with a playhead path |
| Multi-layer | Up to 4 layers, each with its own colour, line style, waveform, volume, octave, pan, mute/solo. Play them **together** or **one after another** (each layer gets an equal slice of the timeline, so one loop or one recording covers them all); finished layers can stay as a ghost, stay fully drawn, or disappear |
| Live parameters | `a b c d` sliders reshape curves while they play; `t` animates formulas over time |
| Visuals | 2D (orthographic) and 3D (orbit camera); trace, ghost or full drawing; solid, gradient, rainbow or pitch colouring; solid, dashed or dotted lines; neon bloom, particle trails, motion blur, fog, depth of field; playhead shapes or your own image; 6 colour palettes |
| Sound | Web Audio synth: sine, square, sawtooth, triangle; scale quantising (major, minor, pentatonic, blues, dorian, hirajoshi…) in any key; glide; legato or pluck articulation; filter, distortion, delay, reverb; spectrum or waveform analyzer |
| Beat grid | BPM, note value (1/4 … 1/32, triplets), gate (note length), swing; the pitch is held per step so any curve becomes a rhythmic melody; beat lines on the graph and bars on the timeline; "fit length to N bars" |
| Drums | Synthesized kick, snare, hi-hat and clap (no samples). Each one fires on curve peaks, valleys, crossings of the middle, or on beats, off-beats, steps or bars of a source layer. Hits flash the glow and send out rings |
| Keyframes | Animate parameters a–d, glow, playhead and particle size, motion blur, background colour, camera position/FOV/rotation, master volume, filter, reverb and delay, plus each layer's colours, volume, thickness and pan. Smooth, linear or hold easing; auto-key; keys shown on the timeline; `K` adds a camera key |
| Timeline | Scrub with audio, 0.1×–5× speed, loop, length, a mini-map of every layer's pitch |
| Export | Video (MP4 or WebM, 720p–4K, 30/60 fps, with audio and captions burned in); studio render (frame-perfect MP4 at any resolution via headless Chromium + ffmpeg); WAV (rendered offline, includes drums and animated effects); MIDI (one track per layer plus a GM drum track); PNG snapshot; preset `.json` |
| Presets | 21 built-ins. Landscape: Bass Drop, Twin Harmony, Lissajous 3D, Astroid Wave, Rose Garden, Neon Terrain, Staircase Arp, Helix Ascent, Chaos Bells, Four on the Floor, Morphing Bloom. **Vertical 9:16 for Shorts/Reels**: Heartbeat, Butterfly, Golden Spiral, Infinity Loop, Sine Ladder, Fourier Square, Rose Mandala, Bouncing Ball, Heart, DNA Helix. Save/load your own; auto-saved session |
| UX | Day/night theme, collapsible panels, cinema mode (hide UI), frame presets 16:9 / 9:16 / 1:1 / 4:5, keyboard shortcuts, phone layout |

### Keyboard

`Space` play/pause · `R` record · `K` camera keyframe · `Home` rewind · `← →` jump 1 s · `M` 2D/3D · `T` day/night · `H` hide UI · `F` full screen · `[` `]` panels · `?` help

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
    rhythm.js           beat grid: steps, swing, gate
  anim/
    keyframes.js        tracks, easing, colour/pose interpolation
  audio/
    engine.js           Web Audio synth + effects; offline WAV rendering
    sonify.js           point → pitch / gain / pan (shared by synth, WAV and MIDI)
    drums.js            synthesized drum kit
    drum-scanner.js     finds peaks / valleys / crossings / beats in a curve
    buffer-analyser.js  FFT spectrum of a rendered WAV (analyzer in studio renders)
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
scripts/
  serve.mjs             static server + studio-render API (/api/health, /api/render)
  render.mjs            studio render CLI (Playwright + ffmpeg)
  render-tools.mjs      finds Playwright and ffmpeg
  vendor-three.mjs, build-artifact.mjs
tests/                  node:test unit tests
```

### Sync

While playing, the clock advances on the **audio hardware clock** (`AudioContext.currentTime`), so the picture can't drift from the sound. Every frame each layer's exact point is computed; the synth glides to it with `setTargetAtTime`, and the marker eases towards it, so jumps in the function glide instead of clicking or teleporting.

Everything that decides the sound at a time T (keyframes, the beat grid, the drum scanner) is a pure
function of T. Live playback, the WAV render, the MIDI export and the studio render all call the same code,
so they hit the same notes and drums at the same moments.

## Troubleshooting

**"Can't start the graphics engine / Error creating WebGL context"**
Browsers allow only a limited number of WebGL contexts, and after a GPU crash Chrome blocks WebGL for the
site until it fully restarts. Close other tabs of the app, quit the browser completely and reopen it, and
check that hardware acceleration is on (Chrome: Settings → System). Versions before this fix leaked GPU
memory on animated layers (formulas with `t`, surfaces, dotted lines), which caused exactly this after a
few minutes; that leak is fixed, and a lost context now shows a *Try again* button instead of freezing.

**Studio render says ffmpeg or Playwright is missing**
Open a *new* terminal and check that `ffmpeg -version` works there (terminals opened before the install don't
see the new PATH). Then run `npm install` and `npx playwright install chromium` in the project folder, and press
*Check again*. You can also point to ffmpeg directly: `FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe npm start`.

## Ideas for later

- More instruments: FM bells, pads, a bass synth with its own envelope.
- Audio input: draw the spectrum of a microphone or audio file next to the curve.
- Shareable links that encode the whole preset in the URL.
- Keyframe curve editor with Bézier handles.

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
- تب Rhythm: شبکهٔ ضرب (BPM، ارزش نت، طول نت، سوئینگ) و درام‌هایی که روی قله‌ها، دره‌ها یا ضرب‌های منحنی نواخته می‌شوند.
- تب Animate: کی‌فریم برای پارامترهای a تا d، رنگ‌ها، افکت‌ها و دوربین (کلید K برای کی‌فریم دوربین).
- بالای پنل لایه‌ها: «Together» یعنی همهٔ لایه‌ها همزمان؛ «One after another» یعنی لایه‌ها به ترتیب پخش می‌شوند و یک لوپ یا یک ضبط همه را پوشش می‌دهد. لایه‌های تمام‌شده می‌توانند به‌صورت Ghost (ردّ کم‌رنگ)، Keep (کامل) یا Hide بمانند.
- نمایش نام نت‌ها: Look → Overlay → Show note names.
- ۱۰ پریست عمودی 9:16 برای Shorts/Reels در تب Presets (با برچسب 9:16).
- خطای «Error creating WebGL context»: بخش Troubleshooting بالا را ببینید (نشت حافظهٔ گرافیک رفع شد).
- رندر استودیویی 4K بدون افت فریم: بعد از `npm install`، `npx playwright install chromium` و نصب ffmpeg، از Export → Studio render یا دستور `npm run render` استفاده کنید.
