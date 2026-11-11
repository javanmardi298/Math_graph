# Math-Melody Visualizer — Handoff for a New Agent

Read this first. It is the whole project on one page: what it is, everything it can do, how it is
built, the rules of the owner, and where work stopped. The deep reference (every setting, every
Circle Lab scene with its parameter ranges) is `docs/AGENT_GUIDE.md`; the user-facing overview is
`README.md`.

---

## 1. Project at a glance

| | |
| --- | --- |
| What | A browser app that turns maths formulas into animated neon graphs **and music**, and exports them as YouTube Shorts / videos. **x is time, y is pitch, z is volume or pan.** |
| Owner | Writes in **Persian**, publishes Shorts and long videos. Reply to them in Persian. |
| Repo | `javanmardi298/Math_graph`, working branch **`ccr-3480e387-89blux`** (never push elsewhere; no PR unless asked) |
| Published as | claude.ai Artifact **https://claude.ai/artifact/PK3ZcQ5Q2Y5d1yG9GZ25DQ** (version 59). To update it from a new conversation pass this URL as `url` after reading it once. |
| Tech | Vanilla ES modules, **no build step**. three.js r170 (vendored) for 2D/3D, Canvas 2D for the Circle Lab, a private WebGL shader for fractals, Web Audio for sound, WebCodecs/ffmpeg for MP4. Works offline. |
| Run | `npm start` → http://localhost:5173 · `npm test` (204 tests, `node:test`) |
| Size | 574 built-in presets on 42 shelves, 21 lesson packs (122 lessons), 76 Circle Lab scenes, 52 instruments, 160 scales |

### Owner's standing rules (do not break)

1. Reply in **Persian**. **No Persian inside the app's content or presets** (names, captions, hooks, texts are English).
2. **Educational text goes only in the `about` box of the Presets panel, never drawn on the video.** On-video text is short: a hook, a formula, a step title.
3. **Do not render videos unless asked** (single still frames for checking are fine).
4. No pull request unless asked. Commit and push to the branch above.
5. When the owner says "چیزی نساز" (don't build), only propose.
6. No model identifiers in commits, code or the artifact. End commit messages with the attribution lines the session gives you.
7. Report honestly what was verified and what was not (sound is usually **not** listened to; say so).

---

## 2. Everything the app can do

### 2.1 Three engines (`state.mode`)

| Mode | Engine | You author |
| --- | --- | --- |
| `2d` | three.js, orthographic | formula layers, view window, look, camera, sound |
| `3d` | three.js, orbit camera | the same layers with z as depth |
| `circle` | Canvas 2D ("Circle Lab") | one scene (`circle.rule`) + its parameters `circle.lab[rule]`; up to 6 stacked scenes |

A **preset is a JSON snapshot of the whole state** (`src/state.js defaultState()`); missing keys take the defaults. Everything is deterministic: live view, WAV, MIDI and MP4 agree.

### 2.2 Formula layers (2D / 3D) — up to 8

| `type` | Fields | Variables | For |
| --- | --- | --- | --- |
| `function` | `y`, `z` | `x` | waves, envelopes, staircases, melodies |
| `parametric` | `x y z` | `s` | Lissajous, knots, spirals, hearts, epicycles |
| `polar` | `r`, `z` | `theta` | roses, cardioids, superformula |
| `surface` | `f(x,y)`, `path` | `x y` | 3D height field with a pen path |
| `ode` | `dx/ds dy/ds dz/ds` | `x y z s` | attractors, orbits, epidemics (RK4) |
| `map` | next `x y z` | `x y z n` | logistic, Hénon, Clifford, ferns (cloud above 2000 points, else a line) |
| `psurface` | `x y z (u,v)`, `pv` | `u v` | Möbius, Klein, minimal surfaces, orbitals |

Globals in every formula: `t` (seconds), `a b c d` (live sliders, keyframeable), constants `pi e tau phi`.
**Formula language** (`src/math/parser.js`, no eval): `+ - * / % ^`, implicit multiply (`2x`, `3sin(x)`), comparisons, `c ? a : b`, `|x|`; functions `sin cos tan asin acos atan atan2 sinh cosh tanh sec csc cot exp ln log log2 log10 sqrt cbrt pow hypot abs sign floor ceil round trunc fract mod min max clamp lerp step smoothstep if sinc gauss saw tri square pulse noise rand zetare zetaim isprime gcd besselj deg rad`.

**Layer settings**: name, enabled, `hidden` (plays, draws nothing), mute, solo · `exprs`, `range`, `samples` · `sim{x0,y0,z0,dt,skip,scale,cx,cy,cz,up,alpha}` · `surf{vMin,vMax,nu,nv,solid,wire}` · colour mode (solid / gradient / rainbow / pitch), colours, width, style (line / dashed / dots) · **`fill`** (`under` = area to y = 0, `origin` = area swept from the origin) with `fillAlpha`, `fillColor` · **`readout`** (live number: `area`, `value`, `x`, `slope`, `length`) · sound: `wave` (instrument), volume, octave, pan, `zMap`, **`harmony`**, **`detune`**, `pitchFrom` (height or a written melody: ode, elise, twinkle, greensleeves, prelude, canon, morning, custom `notes`) · timing: `start`, `end`, `drawFor`, `withPrev` · text: `caption` (`''` automatic, `'-'` hidden), `captionStart/End`, `legend`.

### 2.3 Time and sequencing

`transport {duration, speed (0.1–5×, keyframeable, bends time), loop, bpm}` · layers **together** or **one after another** (`sequence.enabled`, `past: ghost | keep | hide`, `withPrev` links a layer to the step above) · per-layer time window (`start/end/drawFor`) · `visual.drawMode` trace / ghost / full · `visual.hideUntil` (guess-the-shape) · **loops by shape**: `visual.loop` `wrap` (closed curves, last frame = first) or `fade`, `loopSecs`.

### 2.4 Look

`visual`: aspect (`16:9 9:16 1:1 4:5 fill`), background, grid, axes, labels, bloom, particle trail, marker (shape / own image / `lens` circle), fog, depth of field, motion blur, `tone: soft` (no white-out), `exposure`, `letterbox` (cinema bars), analyzer, note names.
**19 drawing styles** (`visual.fx.style`): off, glitch, prism, string, web, echo, kaleido, ink, beads, tube, comet, rainbow, pulse, ants, mirror, sketch, glitchString, prismString, rainbowString — with `tail, offset, strings, stringAlpha, hold, intensity, copies`.
**23 backdrops**: solid, stars, nebula, aurora, rings, horizon, scanlines, vignette, paper, dusk, chalk, blueprint, topo, waves, bokeh, cosmos, embers, tunnel, rays, hex, gradient, grain, plasma — motion `still | drift | spin | breathe | zoom`.

### 2.5 Text on the video (`overlay`)

Title + subtitle, formulas (position, size, fit, time window; `align: 'center'` + `box` = classroom board; **`math: true` = typeset formulas** with `\frac{a}{b}`, `^`, `_`, `\sqrt{}`, Greek, `\left( \right)`, engine `src/ui/mathtext.js`), preset name, analyzer, unlimited text boxes (font, colour, glow, box, timed fades, `math`), **legend**, **axis names**, **drum ticks**, **live number** placement, hook line (`hook.text`), Shorts safe zone, drag-and-drop layout editor. Persian text renders (font bundled) but built-in content stays English.

### 2.6 Camera and film

`camera`: zoom, push, breathe (beat), drift, shake, sway, spin, roll, fov, auto-rotate, follow, **track** (follow the pen) + trackSpeed, **punch** (zoom on kicks). `camera.pose` keyframes (`{mode,p,t,zoom}`; in 2D relative to the view centre).
**17 final shots** (`camera.ending`, `endingSecs` up to 8): auto, zoomout, pushin, spin, flare, crash, rise, drop, slide, dutch, whirl, breath, reveal, cinema, blackout, whiteout, off.
**Film tool** (`src/anim/film.js filmTracks`): openings (follow, dive, spiral, push, handheld, orbit, blackout, flash, slowmo, bars) · climaxes (speed, surge, shake, zoomhit, switch) · finales (slow, bars, both) · loop. Written as ordinary keyframes.

### 2.7 Keyframes

`keyframes.tracks[path] = [{time, value, ease}]`, eases smooth / linear / hold / in / out. Lanes Camera, Speed, Sound, Look, Formula, Layers. Animatable: all camera numbers and pose, `transport.speed`, `params.a–d`, bloom, exposure, letterbox, fx style / intensity / tail / offset, backdrop, marker, trail, fog, draw mode, colours; audio master, scale, root, note range, tuning, **transpose**, **EQ**, **drum kit**, filter, drive, crush, modulation, tremolo, auto-pan, pump, drone, delay, reverb; per layer colour, volume, width, pan, octave, instrument, mute, **harmony**. Key mode records only what you change; Shift+K stores a full keyframe.

### 2.8 Sound

- **Mapping**: y → note between `audio.noteLow…noteHigh` over the view's y range, snapped to `audio.scale` + `audio.root` (`continuous` = glide). z → volume or pan. "Fit notes to the curve" sets the range exactly.
- **160 scales** (`src/math/music.js`): modes, jazz, **chord tones**, psychedelic / microtonal, Arabic & Turkish maqam, **Persian dastgah** (shur, homayoun, segah, chahargah, esfahan, mahur, dashti, bayatTork, afshari …), ragas, Japanese, Chinese, gamelan, African, European folk, historical tunings, equal divisions (5 … 53). **Custom scale**: `scale: 'custom'` + `customScale: '0 2 3.5 7'` / `'204c 702c'` / `'9/8 3/2 2/1'`.
- **52 instruments** (`src/audio/instruments.js`): basic waves; house; techno & acid; psy & trance; pads; keys & bells; retro; **bass & 808** (`808`, `808-dist`, `sub-bass`, `pluck-bass`); leads & orchestral (lead-saw, theremin, strings, brass, church-organ, vibraphone, steel-drum); **world** (santur, tar, oud, ney, sitar, koto).
- **Per layer**: harmony (octave, fifth, power, thirds, major, minor, sus4, sevenths, stack), detune.
- **Global**: tuning (440 / 432 / …), **transpose**, glide, legato / pluck, filter + wah, drive, lo-fi crush, chorus / flanger / phaser, tremolo, auto-pan, pump (sidechain), drone (tanpura), delay (ping-pong), reverb (tone, pre-delay), **3-band master EQ**, safety limiter. 185 sound presets with register + paired melody.
- **Rhythm**: beat grid (BPM, division, gate, swing). **Drums**: 7 synthesized pieces (kick, snare, hat, clap, openhat, tom, perc), **5 kits** (classic, 808, acoustic, techno, lofi), triggers (peak, valley, zero, rise, fall, beat, offbeat, step, bar, **pattern** = text like `X...x...`, 9 ready beats).
- **From audio**: upload a recording → preset (pitch, notes, tempo, key / scale, nearest instrument); exports carry their preset inside the file.

### 2.9 Circle Lab — 76 scenes (`circle.rule`)

Classic (chord walker, bounce, split, grow, escape, polyrhythm) · multiply & split · fill the screen · bounce & draw · battles & growth · patterns & rhythm (incl. **`dotmatrix`** wall of lights) · drawing machines · games · cymatics & fields · waves & sound · Fourier drawing (`fdraw`: shapes, text, flags, SVG) · calculus & trig (tangent, riemann, taylor, unitcircle, **`shapewave`**, **`derivgraph`**) · π · fractals · music theory (`fifths`) · complex numbers (`roots`) · **harmonograph** (own tab) · **spirograph / guilloche** (own tab) · motion & sync (kuramoto, shepard, threebody, dpendulum, brachisto) · numbers (primes).
Common settings: `look` (18 palettes, trail, glow, zoom/dx/dy …), `sound` (instrument, pitch from angle / melody / rise / ball, drum per hit), `speed` over time, `text`, `seed`, stacked `layers` in sequence or together.

### 2.10 Fractals tab (`src/circle/fractal-lab.js`)

- **`fractal`** explorer: families mandelbrot, multibrot, burningship, tricorn, celtic, buffalo, perpendicular, heart, phoenix, lambda, newton; Mandelbrot or Julia view; journeys zoom (13 named spots or own point, to ×10¹³) / julia morph (circle, cardioid, bulb, line, fixed) / power / pan / still; 18 palettes; colouring smooth / bands / orbit trap / stripes / binary; orbit drawing and orbit sound. GPU shader, exact CPU arithmetic below a width of 3·10⁻⁵.
- **`buddha`** (Buddhabrot / anti), **`lyapunov`** (rhythms like AB, AABAB), **`ifs`** chaos game (16 systems: fern, dragon, maple, carpet, pentaflake …). Older `mandel`, `lsystem`, `chaos`, `tree` remain.
- Gallery of 38 cards (`src/circle/fractal-gallery.js`) = the "Fractals" preset shelf.

### 2.11 Library, daily plan, export

- **Presets tab**: sections → shelves → presets, search, filters, favourites, collections, hide built-ins, About box, bulk export, **batch render** (several presets → one zip, or save each file separately).
- **Daily tab**: self-filling posting plan (weekday themes, remixes, queue, CSV).
- **Export**: MP4 (H.264 + AAC, 720p–4K, 24/30/60 fps, motion-blur sub-frames), WAV, MIDI, PNG, live capture; Shorts hook + teaser + flash + fade-out (channel settings); YouTube title / description / tags saved in the preset; command-line render (`npm run render`).

### 2.12 UI layout

Top bar (mode 2D / 3D / ◎, shortcuts to Harmonograph ✺ Spirograph ❄ Fractals, play, export) · left: layers · centre: stage + timeline · right panel in six areas (`TAB_GROUPS` in `src/ui/panels.js`): **Create** (Circle, Harmonograph, Spirograph, Fractals) · **Look** (Look, FX, Text) · **Sound** (Sound, Rhythm, From audio) · **Motion** (Camera, Animate) · **Library** (Presets, Daily) · **Export**.

---

## 3. Code map

```
index.html, src/styles.css
src/main.js            clock, frame loop, wiring, exports, window.mmv
src/state.js           the single state + layer model + defaults   ← start here
src/math/              parser.js, layers.js, sequence.js, music.js (scales), rhythm.js, readout.js
src/audio/             engine.js, instruments.js, drums.js, drum-scanner.js, sonify.js
src/render/            visualizer.js (three.js), fx-styles.js, backdrops.js
src/anim/              keyframes.js, film.js, timewarp.js
src/camera-moves.js    camera moves and final shots
src/ui/                panels.js, overlay.js, overlay-extras.js, mathtext.js, timeline.js, library-view.js,
                       fractal-tab.js, harmonograph-tab.js, spirograph-tab.js, daily-view.js, audio-lab.js
src/circle/            sim.js, view.js, scenes.js (registry) + scene files (fractal-lab.js, shapes-lab.js,
                       motion.js, calculus.js, harmonograph.js, spirograph.js, …)
src/export/, src/analysis/, src/daily/
presets-src/           preset SOURCES in JS (edit these)   →   presets/ + packs/ are GENERATED
scripts/               serve.mjs, build-presets.mjs, build-artifact.mjs, build-fingerprints.mjs, render.mjs
tests/                 36 test files
docs/                  HANDOFF.md (this), AGENT_GUIDE.md (full reference)
```

## 4. Workflows

- **Add or change presets**: edit `presets-src/*.js` (helpers: `science.js` `film()/L()/ODE()/MAP()/SURF()`, `classroom.js` `lesson()`, `fractals.js`, `lessons/kit.js` `circleLesson()`), register shelves in `presets-src/catalog.js`, then `node scripts/build-presets.mjs` and `npm test`. Names must be unique. Every Circle scene needs at least one lesson (a test checks it).
- **Add an instrument**: add to `INSTRUMENTS`, then `node scripts/build-fingerprints.mjs` (needs headless Chromium).
- **Add a Circle scene**: an object `{label, group, defaults, controls, init, step, draw, stats, formula}` exported into `SCENES`; add a caption in `sim.js CAPTIONS` and a lesson.
- **Check visually**: `node scripts/serve.mjs 5200`, open with Playwright (`createRequire('/usr/lib/node_modules/')('playwright')`, flags `--use-gl=swiftshader --enable-unsafe-swiftshader`), then use **`window.mmv`**: `load(preset)`, `loadByName(name)`, `set(path, value)`, `layer(i, patch)`, `seek(s)`, `frame()` (PNG data URL), `errors()`, `presets()`.
- **Publish the artifact**: `node scripts/build-artifact.mjs` → `dist/artifact.html` + `dist/artifact-publish-N.json`; publish each map in order to the artifact URL (list existing paths in `overwrite_unread`), then commit `scripts/artifact-published.json` + `scripts/artifact-presets.json` as "Record artifact vNN build" and push.

## 5. Known gotchas

- 3D scenes use small units (view about ±4…±8); scale attractors with `sim.scale`, `up: 'z'` for Lorenz.
- Additive styles + bloom on dark backgrounds wash out to white: lower `fx.intensity`, use `tone: 'soft'`.
- `map` layers: `sim.skip: 0` keeps the first points; clouds have no pen (use a hidden melody layer for sound).
- 2D graphs are fitted by **width**, centred vertically: on 9:16 a graph sits in the middle; place formulas and legends with explicit `y`.
- Layer ids change on load: keyframe paths use the index (`layer.0.color`).
- The artifact viewer refuses very large downloads: batch results offer per-file Save.
- Never run `pkill -f` in the sandbox shell (it kills the shell).

## 6. State of the work (last session)

Done and pushed (commit `2d5f8a4`, artifact v59): batch-save fix, sound upgrade, textbook graph features, three new scenes, Fractals tab, grouped tab bar, `window.mmv`, Fractals + Textbook shelves, tests, docs.

**Not verified**: none of the new instruments / kits / patterns were listened to; no full video was rendered; the Textbook presets had overlaps fixed but were not re-photographed after the fix; the batch-zip failure in the artifact was diagnosed by reasoning, not reproduced there.

**Ideas offered, not built**: a framed title card (title + formula + plot in one panel), a real maths font for typeset formulas, click-to-zoom on fractals, more classroom lessons (derivative, integral, vectors, probability), a chalk spirograph preset in the style of the reference image.
