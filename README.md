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

### Exporting smooth video

Press **Export video** (top bar, or `E`). The app renders every frame at its exact time with your
graphics card and feeds it straight to the browser's hardware video encoder (WebCodecs), so the MP4
has a constant 24/30/60 fps with no dropped or doubled frames, however heavy the scene. A 1080p60
clip usually takes about as long as it plays, or less on a decent GPU. Keep the tab open; switching
to another tab is fine.

- **Output:** MP4, H.264 + AAC (plays everywhere: phones, Windows, macOS, YouTube, Instagram).
- **Encoder (Export tab):** when the app runs from `npm start` on a computer with ffmpeg, the browser
  only draws the frames and **ffmpeg (x264) encodes them** (Encoder: Automatic or ffmpeg). This is the
  most reliable path: the browser's own video encoder, which crashes some graphics drivers, is never
  used. Without ffmpeg (or in the artifact) the browser encodes with WebCodecs; browsers without an
  H.264 encoder produce VP9 + Opus.
- **Settings (Export tab):** file name (any language), resolution 720p–4K, frame rate, quality
  (bitrate), and **motion blur**: each frame averages 2 or 4 sub-frames like a film camera's shutter,
  so fast curves look fluid instead of strobing.
- **Frame:** 16:9, 9:16 (Shorts/Reels), 1:1 or 4:5, chosen in the Look tab.
- **Batch export (Presets tab):** tick presets (or *Select all*) and press **🎬 Render N videos**. Each
  one is rendered with the Export tab's settings and they all arrive in **one .zip**: `01 Name.mp4`,
  `01 Name.txt` (its YouTube title, description and tags), `YouTube titles and descriptions.csv` for the
  whole batch and `presets.mmv.json`. With `npm start` the batch is also kept in `exports/<batch>/`
  next to the app (ZIP64, so batches over 4 GB are fine); a failed video doesn't stop the rest.
- **YouTube Shorts metadata (Export tab):** title (100-character counter), description and tags are
  saved inside the preset and never drawn into the video. Empty fields are suggested from the preset's
  name and formulas. *Copy title*, *Copy description* and *Save .txt*; the export result also offers the .txt.
- **Live capture** (`R`) still exists for quick screen-style recordings, but its smoothness depends on
  how fast your computer draws in real time. With `npm start` + ffmpeg the recording is re-encoded to a
  constant-frame-rate H.264 MP4 (no stutter, correct length, seeking works); without it, WebM recordings
  get their missing duration written in so players show the length and can seek.

Batch rendering from the command line uses the same encoder inside Playwright's Chromium:

```bash
npm install && npx playwright install chromium     # once
npm run render -- --builtin "Lissajous 3D" --width 1920 --height 1080 --fps 60 --out lissajous.mp4
npm run render -- --preset my-song.mmv.json --width 1080 --height 1920 --blur 2 --out short.mp4
```

Options: `--quality standard|high|max`, `--blur 1|2|4`, `--headed` (open a visible window so Chromium
uses your graphics card; headless browsers often fall back to slow software rendering, and the script
tells you when that happens), `--software`. ffmpeg (on PATH, `FFMPEG_PATH`, common install folders or
the optional `ffmpeg-static` package) is used to deliver H.264/AAC.

### Text on the video

The **Text** tab and the **✥ Edit text & layout** button on the video control everything drawn on top:

- **Title** and subtitle: any text (defaults to the project name), colour and size, or hide them.
- **Formulas** (bottom-left by default) and the **audio analyzer**: move, resize or hide.
- **Text boxes**: as many as you like, multi-line, Persian or English (Vazirmatn font), with font, size,
  colour, alignment, bold, glow, a background box, and an optional time window with fades
  (for example a hook text for the first 3 seconds).

In edit mode, drag any element to move it, drag its corner or scroll over it to resize, double-click a
text to edit it, use arrow keys to nudge and Delete to remove a text box. Positions are stored as
fractions of the frame, so the layout is identical at 720p and 4K, and in exports.

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
| Export | Frame-perfect MP4 (H.264 + AAC, 720p–4K, 24/30/60 fps, optional motion blur, text and captions burned in) rendered with the GPU and hardware encoder; live capture; command-line batch render; WAV (rendered offline, includes drums and animated effects); MIDI (one track per layer plus a GM drum track); PNG snapshot; preset `.json` |
| Text | Movable, resizable title, subtitle, formula list and analyzer; unlimited text boxes (Persian supported) with fonts, glow, background and timed fades; edit directly on the video |
| Presets | 21 built-ins. Landscape: Bass Drop, Twin Harmony, Lissajous 3D, Astroid Wave, Rose Garden, Neon Terrain, Staircase Arp, Helix Ascent, Chaos Bells, Four on the Floor, Morphing Bloom. **Vertical 9:16 for Shorts/Reels**: Heartbeat, Butterfly, Golden Spiral, Infinity Loop, Sine Ladder, Fourier Square, Rose Mandala, Bouncing Ball, Heart, DNA Helix. **Preset library** for hundreds of presets: one searchable list (name, collection, formula), filters (built-in / mine / favourites, 16:9 / 9:16, 2D / 3D), collections, favourites, sort, multi-select export/delete/move. Import any preset file the app exports (`.json` single or bundle, a `.zip` of them, or older exports; many files at once or drag & drop); name clashes get “(2)” instead of overwriting; one-click backup of all your presets. Stored in IndexedDB (thousands of presets; older localStorage libraries move over automatically). Auto-saved session |
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
  library.js            preset library storage + preset file import/export
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
    buffer-analyser.js  FFT spectrum of a rendered WAV (analyzer in exported videos)
  render/
    visualizer.js       three.js scene, fat lines, particles, post-processing
  ui/
    controls.js         small bound-control toolkit
    panels.js           layers panel and inspector tabs
    timeline.js         scrubber with pitch mini-map
    overlay.js          title, formulas, analyzer, text boxes (same code on screen and in videos)
    layout-editor.js    drag/resize overlay elements directly on the video
  export/
    video-render.js     frame-perfect MP4 export (WebCodecs + mp4-muxer)
    ffmpeg-render.js    frame-perfect MP4 export through the local server's ffmpeg (+ batch folders)
    youtube.js          YouTube Shorts title/description/tags: suggestions, .txt and .csv
    recorder.js         MediaRecorder live capture
    webm-duration.js    writes the missing duration into Chrome's WebM recordings
    midi.js             Standard MIDI File writer
    wav.js              16-bit WAV encoder
vendor/three/           three.js r170 + the addons used (offline)
vendor/mp4-muxer/       MP4 muxer for video export (MIT, offline)
scripts/
  serve.mjs             static server + /api/render (frames → MP4 with ffmpeg) + /api/batch + /api/transcode
  zip-writer.mjs        streams batch folders into a .zip (ZIP64 for > 4 GB)
  render.mjs            command-line batch export (Playwright + WebCodecs, ffmpeg for H.264)
  render-tools.mjs      finds Playwright and ffmpeg
  vendor-three.mjs, build-artifact.mjs
tests/                  node:test unit tests
```

### Sync

While playing, the clock advances on the **audio hardware clock** (`AudioContext.currentTime`), so the picture can't drift from the sound. Every frame each layer's exact point is computed; the synth glides to it with `setTargetAtTime`, and the marker eases towards it, so jumps in the function glide instead of clicking or teleporting.

Everything that decides the sound at a time T (keyframes, the beat grid, the drum scanner) is a pure
function of T. Live playback, the WAV render, the MIDI export and video exports all call the same code,
so they hit the same notes and drums at the same moments.

## Troubleshooting

**"Can't start the graphics engine / Error creating WebGL context"**
Browsers allow only a limited number of WebGL contexts, and after a GPU crash Chrome blocks WebGL for the
site until it fully restarts. Close other tabs of the app, quit the browser completely and reopen it, and
check that hardware acceleration is on (Chrome: Settings → System). Versions before this fix leaked GPU
memory on animated layers (formulas with `t`, surfaces, dotted lines), which caused exactly this after a
few minutes; that leak is fixed, and a lost context now shows a *Try again* button instead of freezing.

**"WebGL could not start (Error creating WebGL context)" in every browser**
On some Windows graphics drivers, running the GPU's hardware video encoder next to WebGL crashes the GPU;
after a few crashes the browser switches WebGL off entirely. Video export therefore encodes on the CPU by
default (the GPU encoder is an opt-in toggle in the Export tab, and is never used again after a crash during
export). To get WebGL back, restart the browser fully with `chrome://restart` (Edge: `edge://restart`); just
closing windows isn't enough while it keeps running in the background. If that doesn't help, restart the
computer.

**"The graphics context was lost" every time the app starts**
Press **Start in safe graphics mode** on that screen (lighter on the GPU), or **Reset saved settings** if a
setting you changed triggers it. The app also switches to safe mode by itself after two losses right after
start-up, and the screen shows which GPU WebGL is using. If it still happens, restart the computer (a hung
GPU driver can survive a browser restart) and update the graphics driver. A "Safe graphics · exit" button in
the top bar returns to full quality.

**Downloading from the claude.ai Artifact**
The published artifact saves files through the viewer: you confirm each save. MP4, WebM, PNG and preset
JSON save directly; WAV and MIDI (not on the viewer's list of allowed types) arrive inside a .zip. The
ffmpeg conversion to H.264 needs `npm start`, so in the artifact a browser without an H.264 encoder saves VP9.

**"Can't start the graphics engine" / the GPU dropped the graphics context during export**
After a few GPU crashes Chrome switches WebGL off for the whole browser: restart it with `chrome://restart`
(Edge: `edge://restart`), or restart the computer, and update the graphics driver. Then export with
`npm start` and ffmpeg installed (Encoder: Automatic), so the browser's video encoder isn't used at all.
Exports now also wait for the GPU to finish each frame before drawing the next, so the GPU's queue can't pile up.

**Exported or recorded video is choppy or blurry**
Use **Export video**, not live capture: live capture can only record as fast as your computer draws.
For extra smoothness pick 60 fps and motion blur ×2; for sharpness pick Quality: High or Maximum.

**Export stops at "Frame 5" (or any frame) and never finishes**
Some graphics drivers report a hardware H.264 encoder that then fails or freezes. The app now test-encodes
a few frames with each encoder before using it, watches for an encoder that stops responding, and switches
to the next one by itself (GPU H.264 → software H.264 → VP9 → AV1). The progress window shows which encoder
is in use. If every encoder fails, use a lower resolution or Live capture.

**The old "studio render" took hours**
It drew frames in a headless browser that had no access to the GPU (software rendering), then copied
each frame as a PNG. It has been replaced by Export video, which runs in your own browser with the GPU.

**The command-line render says ffmpeg or Playwright is missing**
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
- خروجی ویدیوی روان: دکمهٔ Export video (یا کلید E). هر فریم دقیقاً در زمان خودش با کارت گرافیک ساخته و با انکودر سخت‌افزاری مرورگر به MP4 (H.264 + AAC) تبدیل می‌شود؛ بدون افت فریم. برای روان‌تر شدن: 60fps و Motion blur ×2.
- تب Text و دکمهٔ «✥ Edit text & layout» روی تصویر: عنوان، زیرعنوان، فرمول‌ها و آنالایزر را جابه‌جا و بزرگ/کوچک یا مخفی کنید و هر تعداد متن (فارسی هم) اضافه کنید.
- نام فایل خروجی: در تب Export یا پنجرهٔ دانلود.
