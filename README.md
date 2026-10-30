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
- **Shorts hook & ending (Export tab, on by default):** every video opens on the finished picture
  (0.8 s teaser, slow push) with a big hook line (the preset's own, else its YouTube title without
  hashtags), then a white flash and a whoosh-to-boom cut to the drawing from zero, with a punch-in.
  At the end the picture fades to black and the sound fades out (0.6 s) instead of stopping abruptly.
  *Preview start & end* plays both parts with sound without exporting.
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
| Multi-layer | Up to 8 layers, each with its own colour, line style, sound, volume, octave, pan, mute/solo and **its own time window** (starts at / ends at, in the layer card; Circle Lab layers too). Play them **together** or **one after another**; in sequence mode any layer can be **linked (🔗) to the layer above**, so groups of any size play together as one step and the steps follow each other (each step gets an equal slice of the timeline, so one loop or one recording covers them all); finished layers can stay as a ghost, stay fully drawn, or disappear |
| Live parameters | `a b c d` sliders reshape curves while they play; `t` animates formulas over time |
| Circle Lab (◎) | A separate mode for the “satisfying” circle genre, drawn with Canvas 2D (no WebGL): **chord walker** (jump a fixed fraction of a turn: rational steps close into star polygons, irrational ones such as 1/φ² never close), **bouncing balls** (gravity, bounciness, speed-up per bounce), **split on every bounce** (1 → 2 → 4 … up to 512), **grow on every bounce**, **escape the rings** (spinning rings with gaps) and **polyrhythm arcs**. Every hit plays a note: by where it lands on the circle, the next note of a melody (Ode to Joy, Für Elise, Twinkle, Greensleeves, Bach, Pachelbel, Grieg, or your own notes), a rising scale or one note per ball, with any of the 35 sounds and an optional drum per hit. Neon palettes, trails that build into the pattern (or fade), comet tails, sparks, ring pulses, counters and the rule as a formula line. Deterministic (same settings → same video), so live play, WAV, video and batch exports match. 12 presets with hooks and YouTube texts |
| Theory scenes | **Circle of fifths** (walk the keys up in fifths or down in fourths, chord progressions such as I V vi IV, a scale as seven neighbours, major ⇄ relative minor, the Pythagorean comma with real 23.46¢ detuned notes) and **Roots of unity** (the roots of z^n = 1 appear and grow, primitive roots, powers and star polygons, every step size, multiplying by a complex number, the vanishing sum, Euler's e^(iθ)); 20 presets + 2 four-step stories + 4 lessons |
| From audio (♪ tab) | **Upload a sound, get a preset.** (1) Exports from this app (WAV, MP4, WebM, PNG) **carry their preset inside** (“Hide the preset inside the file”, on by default in the Export-ready window): upload the same file again and it opens exactly as it was, nothing guessed; the Presets tab imports such files too. (2) Any other recording is **transcribed**: pitch tracking (YIN), notes with starts, lengths and loudness, tempo and beat grid (snap to 1/8, 1/16 or triplets), **tuning** (432 Hz recordings are followed), **key and scale** from the app's own scale list including quarter-tone maqam and dastgah, the nearest of the app's 35 instruments by timbre fingerprint, room size, and a **match score** from playing the result back through the synth and comparing. Everything stays editable (sensitivity, shortest note, octave, BPM ×2 / ÷2, scale and key, tuning, instrument, reverb, click a note to remove it), with A/B playback of the original and the transcription. The melody becomes one layer whose height is the pitch (a balanced `x < t ? … : …` staircase with gaps for rests), so it plays exactly through the normal sound engine. One clear melody line at a time: chords, drums, the visuals and keyframes cannot be read from sound |
| Harmonograph (〰 tab and top-bar button) | The Victorian drawing machine of **damped pendulums**, as a Circle Lab scene with its own workshop tab. Machines: lateral (2 pendulums), four pendulums, **rotary table**, Lissajous (no damping), **epicycles**, or **your own formula** x(t, s, a, b, c, d). Frequencies are ratios, so a drawing is the shape of an interval or chord (3 : 2 fifth, 4 : 5 : 6 major chord …) and **the pendulums sound at exactly those ratios** (just intonation or piano keys; strum, chord, or a note whenever the pen crosses the middle; quieter as the swing dies). **Tune to a scale**: the degrees of any of the 115 scales (maqam, dastgah, raga, with quarter tones) set the pendulums. Detune makes figures turn into rosettes and notes beat. Looks: 8 papers (velvet, midnight, blueprint, chalkboard, ember, parchment, cream, the lab background), 4 inks (neon, fine liner, brush, pen and ink: ink darkens where lines cross on light paper), colour by time / speed / direction / radius / pen, 1–4 pens, 7 new palettes (sepia, indigo, rose gold …), frames (thin, double, ornate), live pendulum dials, a hint of the final shape, **symmetry** (1–12 copies, mirrored) for mandalas, 🎲 Lucky machine with undo. 40 presets + 2 stories on “Math · Harmonograph”, 6 lessons. **Machine on stage**: draw the apparatus itself (pendulum rods and weights swinging, the pen moving over the paper) as a Victorian 3D frame, a blueprint 2D plan or neon lines; show, fade away after the intro, or hide; above the drawing, in a corner, full frame or placed freely; turn, tilt and slowly spin the 3D view. From the From-audio tab: “Draw as harmonograph” tunes the pendulums to the notes of a recording |
| Spirograph & guilloche (✺ tab and top-bar button) | Gears-and-pen drawings, as Circle Lab scenes with their own tab. A wheel rolls inside (hypotrochoid) or outside (epitrochoid) a ring; the pen sits in a hole at distance d; the figure closes after r/gcd turns with R/gcd petals (the tab shows this). Real gear sets (96/63/…), compound gears, lobed wheels, or **your own formula** r(t, ring, wheel, d, k). Ink styles, colour by time / turn / speed / radius / angle / pen, drawing speed curves, several pens, papers, sound (gear teeth, petals, or the ring : wheel interval). **The toy is an element**: show it, fade it away after the intro (or at the end), or hide it; style (toy, brass, blueprint, neon), colours, holes, shadow; detach it from the drawing and move / scale / rotate it. **Guilloche** (banknote engraving): rosette, dial, ribbon, lathe and formula patterns with line-by-line reveal. 🎲 Lucky with undo. ~44 presets + stories, 6 lessons |
| Cinematic formula shows (2D / 3D, shelf “Formulas · Cinematic”) | Six formulas (tri-fold knot, magnetic coil, supernova, mystic rose, infinity bow, cosmic gear) in three drawing styles, 24 presets with several layers each: **Glitch** (three red / green / cyan glowing copies a little apart, added together: chromatic aberration, jolts, a fading tail), **String art** (very faint strings from the centre to the curve) and **Laser web** (fading tail, chords from the pen). Each show is a film: a close-up on the moving point with a tilted horizon, a pull-back to the whole picture, and a **final shot** (the whole curve lights up, the glow flares, a last camera move, a closing chord from hidden layers). New in the app for every preset: *Light style*, *Backdrop* (stars, nebula, aurora, rings, neon horizon, monitor, pool of light) and *Final shot* (soft pull-back by default, zoom out, push in, slow turn, glow only) in the Look and Camera tabs; layers can be *hidden* (they only play). **Second series (20 curves)**: Lissajous 3:4 and 5:6, nephroid, butterfly curve, rose 5/3, deltoid, spiral galaxy, golden spiral, epitrochoid, limaçon, torus knot, heart, lemniscate, hypotrochoid, superformula, harmonic ribbon, ranunculoid, wave cage, cardioid, spiral rose; each with its own drawing style, backdrop, camera film (follow, dive, spiral, push, handheld, orbit) and final shot. More drawing styles that never wash out to white: **Prism** (magenta / yellow / cyan, normal blending), **Echo** (shrinking turning copies), **Kaleidoscope** (2–6 copies), **Ink** (solid line, for paper and chalk), **Beads**; *Tone: soft* (film-style highlight roll-off) and *Brightness* in the Look tab; 9 more backdrops (paper, dusk, chalkboard, blueprint, contour lines, waves, bokeh, cosmos, embers); 7 more final shots (crash zoom, crane up / down, slide, dutch angle, whirl, held breath) |
| Preset library | Sections → shelves → presets; fold or open everything, select a whole shelf, **hide built-in presets** (restorable from the Hidden filter), favourites, collections, search, bulk export / render / move / delete |
| Camera | Auto-rotate, follow, field of view, **camera moves** (zoom, push-in / pull-out over the video, beat breathing, drift, handheld shake, tilt sway, spin, plus one-click styles; in 2D, 3D and the Circle Lab and in every export), plus **moves with the music**: follow the pen (close-up tracking shots, adjustable smoothness for a slow-motion feel), beat punch zoom on kicks/snares, roll; all keyframable together with camera position/zoom for pull-back reveals |
| Visuals | 2D (orthographic) and 3D (orbit camera); trace, ghost or full drawing; solid, gradient, rainbow or pitch colouring; solid, dashed or dotted lines; neon bloom, particle trails, motion blur, fog, depth of field; playhead shapes or your own image; 6 colour palettes |
| Sound | **Every layer can play a written melody** instead of the curve's height (Ode to Joy, Für Elise, Twinkle, Greensleeves, Bach, Pachelbel, Grieg or your own notes; the drawing is its tempo, so speed keyframes change it) · Web Audio synth with **35 sounds per layer** in a grouped list with preview: basic waves; house & deep house (chord stab, garage chord, deep organ, house piano, deep bass, dub chord); techno & acid (303 squelch, acid square, techno stab, reese, FM bass); psychedelic & trance (rolling psy bass, psychedelic lead, supersaw, wobble, squelchy FM, space arp); pads (warm, glass, choir, drone); keys & bells (e-piano, FM bell, marimba, kalimba, music box, pluck, harp); retro (chiptune, vibrato lead, flute). A safety limiter keeps exports from clipping. **115 scales** in any key, grouped: modes, psychedelic & microtonal (whole tone, octatonic, Messiaen, overtone series, just intonation, quarter tones, 19-EDO, Bohlen–Pierce, Wendy Carlos alpha/beta), Arabic & Turkish maqamat with quarter tones, Persian dastgah, Indian ragas, Japanese, Chinese, gamelan pelog/slendro, Thai, Ethiopian qenet and other African tunings, flamenco, klezmer and European folk; tuning A4 = 440/432/444/415 Hz; glide; legato or pluck; filter with **wah** (LFO), drive, **lo-fi** bit crush, **chorus / flanger / phaser**, **tremolo**, **auto-pan**, **pump** (sidechain duck on the beat), **drone** (tanpura-like root + fifth), delay with **ping-pong**, reverb with brightness and pre-delay; **185 sound presets** in 16 groups with ◀ ▶ stepping, 🎲, Default and Undo, every sound with its **register** (the notes it sounds best in, e.g. C3–C5, always starting on the tonic) and a **paired melody**: a shape framed for a vertical video and fitted so its lowest and highest points play exactly the lowest and highest note of that register (“Also set its melody curve”); a **Sound showcase** shelf of 50 Shorts (a big spectrum, the scale and instrument on screen; `packs/sound-showcase.mmv.json`) and **Shapes in moods**, 46 presets of the hand-tuned butterfly kind (`packs/sound-shapes.mmv.json`) and **Melodic shapes**, 10 formula drawings (bow tie, necktie, infinity knot, figure-eight knot, gift bow, hourglass, pretzel, love knot, fish, guitar pick) each with its own scale, key, instrument and a note range fitted to the drawing; **Layered shows** (6 presets with several layers, a written melody on some layers and keyframes for speed, camera and formula parameters); spectrum or waveform analyzer |
| Beat grid | BPM, note value (1/4 … 1/32, triplets), gate (note length), swing; the pitch is held per step so any curve becomes a rhythmic melody; beat lines on the graph and bars on the timeline; "fit length to N bars" |
| Drums | Synthesized kick, snare, hi-hat and clap (no samples). Each one fires on curve peaks, valleys, crossings of the middle, or on beats, off-beats, steps or bars of a source layer. Hits flash the glow and send out rings |
| Fit the notes to the curve | Sound tab → Pitch mapping: *Measure* shows the lowest and highest note the curve really plays (after the scale snapped them); choose the lowest and highest note you want (only notes of the current scale are listed) and *Fit notes to the curve* sets the note range so the drawing's lowest point plays exactly the first and its highest point the second |
| Keyframes | Almost everything can be keyed: camera (position, zoom, push, drift, shake, spin …), **playback speed**, the sound (scale, key, note range, instrument per layer, filter, drive, modulation, tremolo, pump, drone, delay, reverb …), the look (glow, colours, drawing mode, analyzer, grid …), formula parameters and each layer's colour, volume, pan, octave and mute. **Key mode** (the red button on the timeline): while it is on every change you make is recorded as a key at the playhead, only what you changed; off, changes apply to the whole video. **◆ Keyframe** (Shift+K) stores a full keyframe (choose the lanes: Camera, Speed, Sound, Look, Formula, Layers). The timeline shows one row per lane; drag a diamond to move it, double-click a row to add one, Delete removes it; the Animate tab edits every value of the selected keyframe. Names and switches (scale, instrument) change at the next key, numbers glide with smooth / linear / hold / ease-in / ease-out. A speed track bends time: the picture, the sound and the exported video length follow it (`src/anim/timewarp.js`). `,` `.` jump to the previous / next keyframe |
| Timeline | Scrub with audio, 0.1×–5× **playback speed** (saved with the preset and applied to exports: the video lasts length ÷ speed), loop, length, a mini-map of every layer's pitch |
| Export | **One Export button** (Export tab): pick what to make (video MP4, audio WAV, MIDI, image PNG or live capture) and press it; the “Export ready” window also offers **Export current setup** (the whole preset as a `.mmv.json`). The Shorts hook, teaser and fade-out are **channel settings**, kept in this browser and applied to every preset and every export (on by default). Frame-perfect MP4 (H.264 + AAC, 720p–4K, 24/30/60 fps, optional motion blur, text and captions burned in) rendered with the GPU and hardware encoder; live capture; command-line batch render; WAV (rendered offline, includes drums and animated effects); MIDI (one track per layer plus a GM drum track); PNG snapshot; preset `.json` |
| Text | Formulas on the video **wrap** onto more lines instead of being cut, shrink to stay inside the frame, and each layer's formula text is editable (Enter / Shift+Enter breaks a line; “Automatic” goes back) and can have its own show-from / until times (also for all formulas together). Shorts/Reels **safe-zone guide** in the layout editor on vertical videos (captions default just above the area YouTube covers); movable, resizable title, subtitle, formula list and analyzer; unlimited text boxes (Persian supported) with fonts, glow, background and timed fades; edit directly on the video |
| Presets | 172 built-ins, each with its own length (a Fourier cat ends when its last circle has drawn it; `presets-src/lengths.js`), on 20 shelves (★ Start here, Sound of math, Math, Physics, Stories, Satisfying, Formulas) plus 16 lesson packs (92 step-by-step lessons). They are **data, not code**: JSON files in `presets/`, loaded on demand (see *Presets as data* below). **Preset library**: one searchable list (name, collection, formula), filters (built-in / mine / favourites, 16:9 / 9:16, 2D / 3D), collections, favourites, sort, multi-select export/delete/move. Import any preset file the app exports (`.json` single or bundle, a `.zip` of them); name clashes get “(2)” instead of overwriting; one-click backup. Stored in IndexedDB. Auto-saved session |
| UX | Day/night theme, collapsible panels, cinema mode (hide UI), frame presets 16:9 / 9:16 / 1:1 / 4:5, keyboard shortcuts, phone layout |

### Keyboard

`Space` play/pause · `R` record · `K` camera keyframe · `Home` rewind · `← →` jump 1 s · `M` 2D/3D · `T` day/night · `H` hide UI · `F` full screen · `[` `]` panels · `?` help


## Presets as data

Built-in presets are not part of the app. They live as small JSON files that the app
fetches the first time the library needs them:

```
presets-src/            authoring: preset lists written in JS (helpers, shared settings)
  catalog.js            shelves, “Start here” picks, which file goes where
  lessons/              the lesson packs
  sounds.js             the sound presets of the Sound tab (sound settings, register, paired melody)
  sound-registers.js    where each sound sounds best and which shape plays it
  shapes.js             the shape bank, measured and framed; fits a shape to a note range
  sound-maker.js        makes a preset from a sound and a shape (colour moods, text)
  sound-shapes.js       the 46 shapes-in-moods presets
  circle-theory.js      the 20 circle-of-fifths and roots-of-unity presets (+ 2 stories)
  sound-layers.js       the 6 layered shows (layers, written melodies, keyframes)
  sound-curves.js       the 10 melodic shapes (formula drawings with a scale, key and exact lowest / highest note)
  sound-showcase.js     the 50 showcase presets
presets/                generated, loaded by the app (never edit by hand)
  index.json            shelves, counts, names, lesson packs, sound presets
  shelves/<id>.json     one shelf
  lessons/<id>.json     one lesson pack
  sounds.json           185 sound presets (+ the shape bank)
packs/<id>.mmv.json     the lesson packs as importable files (Library → Import)
```

After changing anything in `presets-src/`, run `node scripts/build-presets.mjs` (the tests fail
when `presets/` is stale). Adding presets therefore never makes the app bigger or slower to start;
the app itself ships only the preset it opens with.

## Daily plan (📅 Daily tab)

A posting plan that fills itself: every day gets 3 Shorts (1–5, your choice), each with
the preset, a title, description, tags, the opening hook, a question to pin as the first
comment and a posting time. No AI model is needed: picks and remixes are deterministic.

- **Weekday themes**: Mon Fourier · Tue Sound · Wed π & calculus · Thu Fractals ·
  Fri Physics · Sat Satisfying · Sun Quiz / A or B. Each day has three slots (a topic,
  a sound one, an easy watch) that pick from the matching shelves.
- **No repeats**: a preset that was planned or uploaded in the last 21 days (setting)
  is not picked again. A preset that was never posted goes out as it is; one that was
  posted before comes back as a **remix**: a new subject (shape, curve, flag, word,
  function, fractal spot, plate …), colours, instrument, and words from templates.
- **Cards**: ▶ Load, 🎬 Render (a whole day in one zip), 🎲 swap, copy each field or
  everything, edit any text, status Planned → Rendered → Uploaded / Skip, 🔥 streak.
- **Queue**: your own presets go out first ("＋ Add current setup", or "Add to Daily" in a
  preset's ⋯ menu in the Presets tab).
- **✨ Ideas**: six new remixes of the catalog (or of what is loaded now), to load,
  queue or save to your presets.
- **Exports**: a day's texts (.txt), the week as CSV for scheduling, a backup of the plan.
- ⤢ opens the tab wide, with the cards side by side.

Code: `src/daily/remix.js` (remix engine and title templates), `src/daily/planner.js`
(themes, picks, repeat checks), `src/daily/store.js` (kept in this browser,
`mmv.daily.v1`), `src/ui/daily-view.js` (the tab). To add a format or a subject, add to
the lists at the top of `remix.js` (e.g. `CURVES`, `WORDS`, `TITLE`, `PINNED`).

## Project structure

```
index.html              app shell (top bar, panels, stage, timeline, dialogs)
src/
  main.js               clock, frame loop, wiring, exports, shortcuts
  state.js              single source of truth + layer model
  presets.js            loads the preset catalog (presets/*.json) on demand
  brand.js              channel watermark + end card (saved in the browser)
  library.js            preset library storage + preset file import/export
  styles.css            glassmorphism UI, dark + light themes, responsive
  math/
    parser.js           tokenizer → AST → closures (safe formula compiler)
    layers.js           turns a layer's formulas into a curve P(u), u ∈ [0, 1]
    music.js            y → MIDI note, scales, note names
    rhythm.js           beat grid: steps, swing, gate
  anim/
    keyframes.js        tracks, easing, colour/pose interpolation, keyframe editing (move, copy, snapshot)
    timewarp.js         speed over time: timeline seconds ↔ video seconds
    selection.js        the selected keyframe (timeline + Animate tab)
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
    library-view.js     Presets tab (catalog shelves, my presets, lesson packs)
    daily-view.js       Daily tab (posting plan, queue, ideas)
    sound-presets-view.js  sound presets picker (Sound tab)
    audio-lab.js        From audio tab (upload → preset: embedded preset or transcription)
    harmonograph-tab.js Harmonograph tab (machine, looks, tune to a scale, ink, paper, sound)
    spirograph-tab.js   Spirograph and guilloche tab (looks, gears, toy show / fade / hide / move, ink, paper, sound)
  daily/
    remix.js            new presets from existing ones + YouTube words from templates
    planner.js          weekday themes, daily picks, repeat checks, CSV
    store.js            the plan in this browser (mmv.daily.v1)
  export/
    video-render.js     frame-perfect MP4 export (WebCodecs + mp4-muxer)
    ffmpeg-render.js    frame-perfect MP4 export through the local server's ffmpeg (+ batch folders)
    youtube.js          YouTube Shorts title/description/tags: suggestions, .txt and .csv
    shorts.js           Shorts hook (teaser, hook line, flash, whoosh/boom) and fade-out ending
    embed.js            hides the preset inside WAV / MP4 / WebM / PNG exports and reads it back
  analysis/             audio → preset (pure functions, tested in Node)
    pitch.js            YIN pitch tracker (three registers: normal, high, bass)
    notes.js            pitch track → notes (hysteresis, octave fixes, re-attacks)
    tempo.js            tempo, beat phase, grid snapping
    key.js              tuning, key and scale in quarter tones (uses the app's scale list)
    timbre.js           timbre fingerprint + nearest instruments
    fingerprints.js     generated: every instrument's fingerprint (scripts/build-fingerprints.mjs)
    similarity.js       match score between two recordings
    to-preset.js        notes → a preset (staircase formula, pitch map y = MIDI number)
    chord.js, to-harmonograph.js  the recording's strongest notes → pendulum frequencies
    index.js            analyzeFile / transcribe / verify
  circle/
    sim.js              Circle Lab simulations (deterministic, fixed step)
    theory.js           circle of fifths + roots of unity scenes
    harmonograph.js     the harmonograph scene (pendulum machines, paper, ink, symmetry, sound, lucky machine)
    harmonograph-machine.js  the machine drawn on stage (3D Victorian / blueprint plan / neon)
    spirograph.js       spirograph and guilloche scenes, the toy (ring, wheels, pen)
    view.js             Circle Lab renderer (Canvas 2D: ink trails, glow, sparks)
    sound.js            hit → note mapping, melodies, note thinning
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
  build-fingerprints.mjs  measures every instrument in headless Chromium → src/analysis/fingerprints.js (rerun when an instrument changes)
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
