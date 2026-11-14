# Math-Melody Visualizer — Complete Capability Guide for an Agent

Audience: an AI agent (or developer) that must **design presets, formulas and films** for this app and use
**every** capability it has. Read sections 0–3 first; the rest is reference. The appendix (A) lists every
Circle Lab scene with all its parameters (generated from the code).

Repository: `javanmardi298/Math_graph` · app: vanilla ES modules, no build step · three.js (WebGL) for 2D/3D,
Canvas 2D for Circle Lab, Web Audio for sound · everything runs offline in the browser.

---

## 0. One-paragraph summary

**x is time, y is pitch, z is volume or stereo pan.** A preset is a JSON snapshot of the whole app state
(`src/state.js` → `defaultState()`); missing keys fall back to defaults. There are two engines:

| Mode | `mode` | Engine | What you author |
| --- | --- | --- | --- |
| 2D graph | `'2d'` | three.js, orthographic | `layers[]` of formulas (7 types), view window, look, camera, sound |
| 3D graph | `'3d'` | three.js, orbit camera | the same layers, with z used as depth |
| Circle Lab | `'circle'` | Canvas 2D | one **scene** (e.g. `kuramoto`, `fdraw`, `threebody`) + `circle.lab[scene]` params; up to 6 stacked scenes |

Every preset also carries: transport (duration, speed, loop, bpm), audio (scale, key, effects), camera,
overlay (text on video), keyframes, rhythm/drums, export/record settings, YouTube metadata, an optional
`about` box (panel-only educational text) and a `hook` line.

Everything is **deterministic**: the same preset gives the same picture and sound live, in WAV, MIDI and MP4.

### Standing house rules of this project (follow them)

1. **No Persian (or other non-English) text inside app content or presets** (titles, captions, hooks, texts). The user chats in Persian; presets are English. (The Text tab *can* render Persian — the font is bundled — but built-in content stays English.)
2. **Educational explanation goes in `about` (panel only), never drawn on the video.** On-video text is short: a hook line, a formula, short step titles.
3. Do not render videos unless asked (still frames for verification are fine). No pull request unless asked.
4. Presets are **data**: edit `presets-src/*.js`, then `node scripts/build-presets.mjs`; run `npm test` (193+ tests). Preset names must be unique.
5. No model identifiers in commits/artifacts. Commits end with the attribution lines required by the session.

---

## 1. The user interface (what exists and where)

Top bar: project name, play/pause, 2D/3D/◎ mode switch, theme (day/night), Export video, record, help, fullscreen.
Left panel: **Layers** (formula layers or Circle layers), global parameters `a b c d`, "Together / One after another".
Centre: stage (the video frame, aspect from Look tab) + **timeline** (scrub, keyframe lanes, speed, loop, length, pitch mini-map).
Right panel tabs (`src/ui/panels.js buildRight`):

| Tab | Contents |
| --- | --- |
| ◎ Circle | Circle Lab: pick a scene, its parameters, speed over time, sound, look (palette/trail/glow), size & place, frame bloom, text line/counter, seed, layers stack |
| 〰 Harmonograph | pendulum machines, tune to scales, paper/ink/frames, symmetry, machine-on-stage, 🎲 lucky |
| ✺ Spirograph | gears, guilloche, toy element (show/fade/hide/detach), inks, papers, sound |
| Look | frame aspect, drawing mode, colours, grid/axes/labels, bloom, particle trail, marker (shape/image), fog, depth of field, motion blur, **Light style (fx)**, **Backdrop + motion**, tone/exposure, **Loop by shape**, caption, note names, analyzer, hide-until |
| FX | fx style settings (tail, colour split, strings, intensity, copies, hold), post effects |
| Sound | instrument per layer (35), scale (116) + key, note range + Fit-to-curve, tuning, glide, articulation, filter+wah, drive, lo-fi, chorus/flanger/phaser, tremolo, auto-pan, pump, drone, delay (ping-pong), reverb (tone, pre-delay), 185 sound presets with register + paired melody |
| Rhythm | beat grid (BPM, division, gate, swing), drums (kick/snare/hat/clap with triggers) |
| Animate | keyframes: Key mode, ◆ Keyframe (Shift+K), per-property keying, ease, selected-key editor |
| Text | title/subtitle, formulas (position/size/fit/align/box/time window), preset name, analyzer, unlimited text boxes, layout editor ✥ |
| Camera | auto-rotate, follow, fov, zoom, camera moves (push, breathe, drift, shake, sway, spin) + one-click styles, follow-the-pen, beat punch, roll, **Final shot** (ending), **Film: opening/climax/finale** |
| Presets | library: shelves/sections, search, filters, collections, favourites, hide built-ins, bulk export/render/move, **About box** of the selected preset, batch render to ZIP |
| 📅 Daily | self-filling posting plan: weekday themes, remixes, queue, ideas, CSV |
| ♪ From audio | upload a sound → preset (embedded preset, or transcription: pitch, notes, tempo, key/scale, instrument match) |
| Export | one Export button (MP4 / WAV / MIDI / PNG / live capture), resolution 720p–4K, fps 24/30/60, quality, motion blur sub-frames, encoder, Shorts hook/teaser/outro, file name, YouTube title/description/tags |

Keyboard: `Space` play · `R` record · `E` export · `K` camera key · `Shift+K` full keyframe · `Home` rewind · `← →` ±1 s · `, .` prev/next key · `M` 2D/3D · `T` theme · `H` hide UI · `F` fullscreen · `[ ]` panels · `?` help.

---

## 2. Formula layers (2D / 3D)

### 2.1 Layer types (`LAYER_TYPES` in `src/state.js`)

| `type` | Fields (in `exprs`) | Variables | Range | Use for |
| --- | --- | --- | --- | --- |
| `function` | `y`, `z` | `x` (+ globals) | view `xMin…xMax` | y = f(x): waves, envelopes, sound curves, piecewise melodies |
| `parametric` | `x`, `y`, `z` | `s` | `range.min…max` | Lissajous, Fourier epicycle sums, knots, spirals, hypotrochoids, any closed/open curve |
| `polar` | `r`, `z` | `theta` | `range` | roses, cardioids, limaçons, spirals, superformula |
| `surface` | `f` = height(x,y), `path` = y(x) | `x`,`y` | view x | a 3D height field with a pen walking along `path` (pen height = pitch) |
| `ode` | `x`,`y`,`z` = dx/ds, dy/ds, dz/ds | `x y z s` | `samples` steps | strange attractors, orbits, Euler spiral, epidemics, predator–prey, oscillators; **RK4 from start point**; `sim.dt` is the step |
| `map` | `x`,`y`,`z` = next point | `x y z n` | `samples` points | logistic map, Hénon, Ikeda, Clifford, de Jong, chaos-game, Theodorus; **cloud** of dots when `samples > 2000`, otherwise a line with a pen |
| `psurface` | `x`,`y`,`z` of (u,v), `pv` = pen path v(u) | `u v` | `range` = u range, `surf.vMin/vMax` = v | Möbius, Klein bottle, minimal surfaces, orbitals, tori, shells; pen rides v(u) |

Global variables in every formula: **`t`** (time in seconds → animated formulas), **`a b c d`** (live parameters, sliders, keyframeable).
Constants: `pi e tau phi`. Symbols `π θ τ × ÷ − ² ³ √` are accepted. `**` = power.

### 2.2 Formula language (`src/math/parser.js`, safe: no eval)

Numbers, `+ - * / % ^`, unary minus, **implicit multiply** (`2x`, `3sin(x)`, `(x+1)(x-1)`), comparisons (`< <= > >= == !=` → 1/0), ternary `c ? a : b`, abs bars `|x-1|`.

Functions (name → args):
- trig: `sin cos tan asin acos atan atan2(2) sec csc cot` · hyperbolic: `sinh cosh tanh asinh acosh atanh`
- exp/log: `exp ln log(x[,base]) log2 log10 sqrt cbrt pow(2) hypot(1-8)`
- rounding/sign: `abs sign floor ceil round trunc fract mod(2)` · `min max (1-8 args)` · `clamp(x[,lo,hi])`
- shaping: `lerp(a,b,k) step(edge,x) smoothstep(a,b,x) if(c,a,b) sinc gauss(x[,sigma])`
- periodic (period 1, range −1…1): `saw tri square pulse(x[,duty])` · noise: `noise(x)` (smooth), `rand(n)` (hash)
- special: `zetare(t)`, `zetaim(t)` (ζ(½+it); with 2 args ζ(σ+it)), `isprime(n)`, `gcd(a,b)`, `besselj(n,x)`
- angles: `deg rad`

Compile errors show live under the field. A non-finite value repeats the previous good point (tan asymptotes are safe). Values are clamped to ±1e4.

### 2.3 What can be drawn (potential — mathematical idea bank)

- **Waves & signals** (function): sine/cos with amplitude–frequency–phase, damped oscillation `exp(-a x) sin(…)`, beats (sum of close frequencies), AM/FM, square/saw/triangle via `square saw tri` or Fourier partial sums `Σ sin((2k+1)x)/(2k+1)`, Gibbs overshoot (1,3,9,40 terms in sequence), sinc, Gaussian, Bessel modes, step/ADSR envelopes with `smoothstep`, rhythmic melodies from `floor`/`mod`/ternary staircases.
- **Planar curves** (parametric/polar): Lissajous (any ratio + phase), roses `r=cos(kθ)` (petal rule), cardioid/limaçon/nephroid/deltoid/astroid/ranunculoid, hypo/epitrochoids, butterfly curve, spirals (Archimedes, logarithmic, golden, Fermat, Euler/Cornu, Theodorus), lemniscate, heart, superformula, harmonic ribbons, epicycles (Fourier drawing as a sum of rotating terms), times-table envelopes, string-art.
- **3D curves**: torus knots, Lissajous-toric knots, trefoil/figure-eight knot, helices, Villarceau/Hopf circles, spherical spirals (loxodrome), Viviani, space-filling-style orbits.
- **Surfaces** (`psurface`/`surface`): Möbius, Klein bottle, torus, catenoid↔helicoid, Dini, Enneper, shells, spherical-harmonic orbitals (morph with `a`), wave/ripple height fields, saddle `x²−y²`, `sin(x)cos(y)`.
- **Dynamical systems** (`ode`): Lorenz, Rössler, Aizawa, Thomas, Chen, Sprott, Halvorsen, Lotka–Volterra (3 closed loops), SIR epidemic (R₀ 3 vs 1.5), van der Pol (μ morph), driven Duffing, double-well, harmonic/pendulum phase portraits, Euler spiral, gravitational orbits.
- **Iterated maps** (`map`): logistic map time series and **bifurcation diagram** (use `n` as the parameter sweep), Hénon, Ikeda, Clifford, de Jong (as breathing clouds with `a b c d` + `t`), Barnsley fern / chaos game (use `rand(n)`), Sierpiński via IFS, Theodorus spiral, Collatz-like orbits, cobweb diagrams.
- **Number theory**: ζ(½+it) path and zeros (`zetare/zetaim` over t∈[0,60]), prime spirals (Sacks/Ulam with `isprime`), gcd patterns (`gcd`), Euler's n²+n+41, golden angle (Vogel) sunflower, Fibonacci ratios, modular times tables.
- **Calculus & analysis**: derivative as slope (tangent), integral as area (Riemann sums in Circle Lab `riemann`), Taylor polynomials (`taylor`), e and `(1+1/n)^n`, ln as inverse, growth/decay, limits, complex exponentials e^{iθ} (parametric `cos`,`sin`), Euler's identity, roots of unity.
- **Physics**: standing waves, travelling waves, beats, Doppler, Chladni plates `cos(nπx)cos(mπy) ± …`, drum modes (Bessel), pendulum waves, brachistochrone/cycloid (`x=s−sin s, y=1−cos s`), orbits, Kuramoto sync.
- **Music-maths**: circle of fifths, Pythagorean comma, just-intonation ratios (Lissajous = interval shape; harmonograph frequencies as chord ratios), scale/arpeggio staircases, overtone series, quarter-tone scales.
- **Meta/educational**: step-by-step lessons (sequence mode + per-layer time windows + camera poses), A-or-B and guess-the-shape quizzes (`visual.hideUntil`), comparisons (layers drawn together).

### 2.4 Layer properties (all of `createLayer()`)

| Group | Fields |
| --- | --- |
| Identity | `name`, `enabled`, `hidden` (plays but draws nothing: closing chord, bass line, melody for point clouds), `mute`, `solo` |
| Formula | `type`, `exprs{y,z,x,r,f,path,pv}`, `range{min,max}`, `samples` (detail; 900 default; maps up to ~90 000) |
| Simulation (`ode`/`map`) | `sim{x0,y0,z0,dt,skip,scale,cx,cy,cz,up:'y'|'z',alpha}` — start point, step, warm-up skip (default 20; **use 0 to keep the first points**, e.g. Theodorus), placement (scale, centre, which axis is up: `up:'z'` for Lorenz), cloud alpha |
| Surface (`psurface`) | `surf{vMin,vMax,nu,nv,solid,wire}` mesh detail, solid fill opacity, wireframe opacity |
| Colour/style | `colorMode` solid\|gradient\|rainbow\|pitch, `color`, `color2`, `width`, `style` line\|dashed\|dots |
| Sound | `wave` (35 instruments), `volume`, `octave`, `pan`, `zMap` volume\|pan\|none, `pitchFrom` height\|melody, `melody` (ode, elise, twinkle, greensleeves, prelude, canon, morning, scale, custom), `notes` ("E4 D#4 C5 …"), `melodyLoops` |
| Timing | `start`, `end` (seconds, 0 = whole video), `drawFor` (finish drawing after N s then stay), `withPrev` (🔗 plays with the layer above in sequence mode) |
| Text | `caption` (formula text on video; `''` automatic, `'-'` hides, Shift+Enter breaks a line), `captionStart`, `captionEnd` |

Up to **8 layers**. `normalize()` regenerates layer ids on load, so keyframe paths use the layer **index** (`layer.0.color`).

### 2.5 Time, speed, loop, sequencing

- `transport.duration` (s), `transport.speed` (0.1–5×, keyframeable; **bends time**: picture, sound and exported length follow, `src/anim/timewarp.js`), `transport.loop`, `transport.bpm`.
- **Together** (`sequence.enabled:false`): every layer spans the whole timeline (or its own `start/end` window).
- **One after another** (`sequence.enabled:true`): enabled layers without a window form steps; each step gets an equal slice; `withPrev` merges layers into one step; `sequence.past` = `ghost` (faint trace) \| `keep` (fully drawn) \| `hide`.
- **Per-layer window**: `start/end` (+ `drawFor`) — a layer with a window ignores the sequence. This is how lessons place content in time.
- `visual.drawMode`: `trace` (drawn as the pen moves) \| `ghost` (faint full curve + bright trace) \| `full`. `visual.hideUntil` hides curves (not sound) until N seconds.
- **Loops** (`visual.loop`): `off` \| `wrap` (a lit tail chases itself around a **closed** curve; last frame = first) \| `fade` (fade in/out, for open curves); `loopSecs`. With any loop set `camera.ending:'off'` and `fx.hold:0`. Camera/keyframes in a loop film return to their start values (`filmTracks({loop:true})`). Loop by **shape**: closed curve → `wrap`; open curve/cloud → `fade`; Circle Lab and 3D auto-rotate loops use `rotateSpeed = 60/duration`.
- `record.loop` / `loopBlend`: cross-blend the exported clip's end into its start.
- `record.fps/resolution/quality/subframes`, `record.hook{enabled,teaser,flash,impact}`, `record.outro` (fade to black seconds) — hook/outro are **channel-wide** settings applied by `shorts-prefs.js`, not per-preset.

---

## 3. Look, FX, camera, film — the cinematic toolkit

### 3.1 `visual` object (selected)

`aspect` (`fill|16:9|9:16|1:1|4:5`), `background`, `gridColor`, `axesColor`, `showGrid/showAxes/showLabels`, `drawMode`,
`bloom{enabled,strength,radius,threshold}`, `trail{enabled,count,size}` (particles behind the pen), `marker{shape circle|ring|star|diamond,size,image,cursorLine,smoothing}`,
`fog{enabled,density}` (3D), `dof{enabled,focus,aperture}`, `motionBlur{enabled,amount}`, `caption`, `showNotes`, `analyzer` (`off|spectrum|wave`),
`tone` (`off|soft` = ACES roll-off, so bright overlaps don't clip to white), `exposure` (0 = black, keyframeable), `letterbox` (cinema bars 0…1, keyframeable),
`backdrop`, `backdropColor`, `backdropMotion`, `loop`, `loopSecs`, `fx{…}`.

### 3.2 Drawing styles — `visual.fx.style` (`src/render/fx-styles.js`)

`off`, `glitch` (red/green/cyan copies, chromatic aberration, jitter), `prism` (magenta/yellow/cyan, normal blending), `string` (faint strings from centre/pen to the curve), `web` (laser web: fading tail + chords from the pen), `echo` (shrinking turning copies), `kaleido` (2–6 copies), `ink` (solid line for paper/chalk), `beads`, `tube` (neon tube), `comet`, `rainbow` (rainbow flow), `pulse`, `ants` (marching ants), `mirror`, `sketch` (pencil), and combos `glitchString`, `prismString`, `rainbowString`.
Parameters: `tail` (lit fraction behind the pen), `offset` (colour split px), `strings` (count), `stringAlpha`, `hold` (seconds at the end where the **whole curve lights up** — the "final plan"), `intensity` (brightness; lower to avoid white-out), `copies`.
Keyframeable: `fx.style` (switch at the climax), `fx.intensity`, `fx.tail`, `fx.offset`, `fx.stringAlpha`.
Guidance: neon/additive styles on dark backgrounds; `ink/sketch/prism` and `tone:'soft'` for light paper; avoid stacking high bloom with additive copies (white-out).

### 3.3 Backdrops — `visual.backdrop` (+ `backdropColor`, `backdropMotion`)

`solid, stars, nebula, aurora, rings, horizon (neon horizon), scanlines (monitor), vignette (pool of light), paper, dusk, chalk (chalkboard), blueprint, topo (contour lines), waves, bokeh, cosmos, embers, tunnel, rays, hex, gradient, grain, plasma`.
Motion (`backdropMotion`): `still, drift, spin, breathe, zoom` — periodic over the video so loops stay seamless. Backdrop stays put when the camera zooms. Keyframeable (`visual.backdrop`).

### 3.4 Camera (`state.camera`)

`zoom, push (+in/−out over the video), breathe (beat pulse), drift, shake (handheld), sway (tilt), spin (roll °/s), roll, fov, autoRotate+rotateSpeed (3D), follow, track (0–1: follow the pen, close-ups) + trackSpeed (smoothness), punch (beat-punch zoom on kicks/snares).`
All numeric ones are keyframeable. **`camera.pose`** keyframe = `{mode:'2d'|'3d', p:[x,y,z], t:[x,y,z], zoom}`; **in 2D the pose is relative to the view centre** (content is shifted by −view centre). Orbit/pan/zoom with the mouse; `K` stores a pose key.

**Final shot** (`camera.ending`, `endingSecs` ≤ 8, `endingBars`): the camera moves for the first two-thirds, then holds; glow flares at the cut.
`auto` soft pull-back · `zoomout` · `pushin` · `spin` slow turn · `flare` glow only · `crash` crash zoom · `rise` crane up · `drop` crane down · `slide` · `dutch` · `whirl` · `breath` held breath · `reveal` grand reveal (far pull-back + flare + bars) · `cinema` bars slide in + slow push · `blackout` fade to black · `whiteout` white flash · `off`.
Videos shorter than 2.5× `endingSecs` skip it. Pair with `fx.hold` and hidden-layer closing chords.

### 3.5 Film tools (`src/anim/film.js`, Camera tab "Film: opening, climax, finale")

`filmTracks({D, open, climax, finale, loop, is3d, endingSecs, bloom, intensity, climaxAt, styleFrom, styleTo})` returns keyframe tracks:
- **Openings**: `follow` (close-up on the pen → pull back), `dive`, `spiral`, `push`, `handheld`, `orbit` (3D), `blackout` (rise out of black), `flash` (white flash in), `slowmo`, `bars` (cinema bars open).
- **Climaxes**: `speed` (rush), `surge` (glow+intensity), `shake`, `zoomhit`, `switch` (change drawing style).
- **Finales**: `slow` (slow-down), `bars` (cinema bars close), `both`.
A film = **start (opening) → climax (~68% of duration) → ending (final shot)**; this is the template of every "cinematic and dramatic" preset. Because it is only keyframes, everything stays editable.

### 3.6 Keyframes (`state.keyframes = { tracks: { [path]: [{time,value,ease}] }, autoKey }`)

Eases: `smooth, linear, hold, in, out` (the ease belongs to the segment **leaving** the key). Kinds: *number* (glides), *step* (jumps: root, noteLow/High, reverb decay/tone, octave), *colour*, *choice* (scale, instrument, filter type, mod type, drawMode, analyzer, fx.style, backdrop, marker shape, mute, grid — change at the next key), *pose*.
Animatable paths (lanes **Camera, Speed, Sound, Look, Formula, Layers**):
- Camera: `camera.pose, fov, rotateSpeed, track, trackSpeed, punch, roll, zoom, push, breathe, drift, shake, sway, spin`
- Speed: `transport.speed`
- Formula: `params.a/b/c/d` (−5…5)
- Look: `visual.bloom.strength/radius/threshold, exposure, letterbox, fx.style/intensity/tail/offset/stringAlpha, backdrop, marker.size/shape, trail.size/count, motionBlur.amount, fog.density, drawMode, analyzer, showGrid, background/gridColor/axesColor`
- Sound: `audio.master, scale, root, noteLow, noteHigh, tuning, filter.type/cutoff/q/lfo/lfoRate, distortion, crush, mod.type/rate/depth/mix, motion.tremolo/autopan, pump.amount, drone.volume, delay.time/feedback/mix, reverb.decay/mix/tone`
- Layers: `layer.<index>.color/color2/volume/width/pan/octave/wave/mute`
Timeline: one row per lane, drag diamonds, double-click to add, Delete to remove; Animate tab edits all values of the selected key. **Key mode** records only what you change at the playhead.
Preset authoring: write tracks directly, e.g. `keyframes:{tracks:{'camera.zoom':[{time:0,value:3.8,ease:'smooth'},{time:9,value:1}]}}`.

### 3.7 Text on the video (`state.overlay`)

`layout: 4` (current). `title{enabled,text,subtitle,subtitleText,x,y,size,color}`, `formulas{enabled,x,y,size,fit,start,end,align:'center'|…,box}` (fractions of the frame; `align:'center'`+`box:true` = **classroom board**: large centred formula on a soft box; text wraps and shrinks to fit), `name{…}`, `analyzer{…}`, `texts[]` (id, text, x, y, size, color, font `display|body|mono|persian`, bold, glow, box, align, start/end window with 0.25 s fades). Vertical videos have a Shorts safe-zone (captions above y≈0.74). The **hook** (`hook.text`) is the big line over the first ~2 s teaser.
The ✥ layout editor drags/resizes everything directly on the video.

---

## 4. Sound

### 4.1 How a point becomes a note (`src/audio/sonify.js`, `src/math/music.js`)

`y → MIDI` linearly between `view.yMin…yMax` ↔ `audio.noteLow…noteHigh`, then **snapped to the scale** (`audio.scale`, `audio.root`) unless `continuous` (pure glissando). `z → volume` (×0.05–1.6) or `pan` per layer (`zMap`). Each layer = one voice (`wave`, `volume`, `octave`, `pan`). `pitchFrom:'melody'` plays a written melody instead (the drawing is its tempo).
**Fit notes to curve** (Sound tab): *Measure* the curve's real lowest/highest scale note, then set the range so the drawing's extremes play exactly the chosen notes. In presets use the `notes(view,[ya,na],[yb,nb])` helper pattern (see `presets-src/science.js`).

### 4.2 Instruments (35) — `layer.wave`

Basic: `sine triangle square sawtooth` · House/deep: `deep-organ house-stab garage-chord house-piano deep-bass dub-chord` · Techno/acid: `acid-303 acid-square techno-stab reese fm-bass` · Psy/trance: `psy-bass psy-lead supersaw wobble squelch-fm space-arp` · Pads: `warm-pad glass-pad choir drone` · Keys/bells: `e-piano bell marimba kalimba music-box synth-pluck harp` · Retro: `chiptune vibrato-lead flute-synth`.

### 4.3 Scales (116 incl. `continuous`) — `audio.scale`

Basic: `continuous chromatic major minor pentatonic minorPentatonic blues majorBlues harmonicMinor melodicMinor` · Modes: `dorian phrygian lydian mixolydian locrian lydianDominant phrygianDominant harmonicMajor lydianAugmented altered bebopDominant bebopMajor` · Symmetric/psychedelic/microtonal: `wholeTone diminished diminishedWH augmented prometheus tritone enigmatic messiaen3 messiaen4 messiaen6 overtones justMajor quarterTones edo19 greekEnharmonic bohlenPierce carlosAlpha carlosBeta` · Arabic/Turkish maqam (quarter tones): `rast bayati saba hijaz hijazKar sikah nahawand kurd ajam suznak nawaAthar nikriz huzam` · Persian dastgah: `shur homayoun segah chahargah esfahan mahur dashti persian` · Indian raga: `bhairav yaman kafi bhairavi todi purvi marwa ahirBhairav charukesi kirwani malkauns bhupali durga hindol megh shivranjani chandrakauns hamsadhwani` · Japanese `hirajoshi in insen iwato kumoi yo ryukyu` · Chinese `gong shang jue zhi yu` · Gamelan/Thai `pelog pelogBem slendro thai` · Ethiopian/African `tizitaMajor tizitaMinor batiMajor batiMinor ambassel anchihoye equiheptatonic equipentatonic mbira kora` · European/other `spanishGypsy spanish8 ahavaRabbah misheberach hungarianMinor hungarianMajor byzantine neapolitanMinor neapolitanMajor celtic egyptian`.
`audio.root` 0–11 (C…B), `tuning` A4 Hz (440/432/444/415), `glide` (ms), `articulation` `legato|pluck`, `noteLow/noteHigh`.

### 4.4 Effects chain (`state.audio`)

`master`, `filter{type lowpass|highpass|bandpass|notch, cutoff, q, lfo (wah depth), lfoRate}`, `distortion` (drive), `crush` (lo-fi), `mod{type off|chorus|flanger|phaser, rate, depth, mix}`, `motion{tremolo,tremoloRate,autopan,panRate}`, `pump{amount,rate}` (sidechain duck every `rate` beats at project bpm), `drone{volume,octave,fifth,bright}` (tanpura-like root+fifth), `delay{time,feedback,mix,pingpong}`, `reverb{decay,mix,tone,preDelay}`. A safety limiter prevents clipping in exports.
185 **sound presets** (Sound tab, 16 groups): each has a *register* (best notes, starting on the tonic) and a *paired melody curve* fitted to that register.

### 4.5 Rhythm and drums

- `rhythm{enabled, division '1/4'|'1/8'|'1/8T'|'1/16'|'1/16T'|'1/32', gate, swing, showGrid}` — samples the pitch once per step so any curve becomes a rhythmic melody (use with `articulation:'pluck'`). "Fit length to N bars" available.
- `drums{enabled, source (layer index), volume, kick, snare, hat, clap, sensitivity, pulse}` with triggers: `off, peak, valley, zero, rise, fall, beat, offbeat, step, bar`. Hits flash the glow and send rings; with `pulse` they drive `camera.punch`.
- Drums are synthesized (no samples). All sound decisions are pure functions of time T, so WAV/MIDI/MP4 exports match live play. MIDI export: one track per layer + GM drums.

### 4.6 Audio in → preset (♪ From audio)

Exports embed their preset (WAV/MP4/WebM/PNG "Hide preset inside file") → re-upload restores it exactly. Other audio is transcribed (YIN pitch, notes, tempo/beat grid, 432/440 tuning, key/scale from the app's list incl. maqam/dastgah, nearest instrument, A/B playback, match score); the melody becomes one staircase layer. "Draw as harmonograph" tunes pendulums to the recording's strongest notes.

---

## 5. Circle Lab (`mode:'circle'`)

State: `state.circle = { rule, seed, lab:{[scene]:{…params}}, look, sound, speed, text, layers[], combine, start, end }`.
`rule` is a scene id (Appendix A lists all 76 scenes and their `lab` keys) or a classic rule: `chord` (chord walker with `chord.step` expression, e.g. `1/phi^2`), `bounce`, `split`, `grow`, `escape`, `polyrhythm` (settings in `chord/physics/split/grow/escape/poly`).

- **`look`**: `palette` (neon, rainbow, sunset, gold, aurora, candy, ocean, fire, pastel, matrix, mono, sepia, indigo, rosegold, ember, ice, verdigris, peacock), `trail` lines|fade|none, `trailWidth`, `glow`, `ringWidth`, `ballSize`, `sparks`, `ringPulse`, `comet`, `counter`, `background`, `zoom`, `dx`, `dy`, `bloom`, `ambience`.
- **`sound`**: `instrument`, `pitch` angle\|melody\|rise\|ball (where the hit lands / next melody note / rising scale / each ball its own note), `melody`, `notes`, `drum` off\|kick\|snare\|clap\|hat on every hit, `length`, `volume`, `maxRate` (note thinning). Scale/key/range come from the global Sound tab.
- **`speed`** `{from,to,curve linear|smooth|build|late|early|wave|steps, pulse}` — simulation clock over time (soundtrack follows).
- **`text`** `{formula, counter, show 'caption'|'formula'}`; `hook.text` is the question line.
- **Stacking**: `circle.layers[]` = up to 6 more scenes (`{id,enabled,withPrev,start,end,cfg}`), `combine:'sequence'` (one after another, 🔗 to group) or `'together'` (use `look.zoom/dx/dy` to tile). 15 "Stories" presets do this.
- Deterministic fixed-step sim (`DT=1/240`); same seed = same video. Aspect from `visual.aspect` (worldFor ratio).
- Camera moves, film tools, endings, text overlay, keyframes (camera/speed/sound) and exports all work in Circle Lab too.

Scene families: *Multiply & split, Fill the screen, Bounce & draw, Battles & growth, Patterns & rhythm, Drawing machines, Battles & formulas (games), Vibration & waves (cymatics), Waves & sound, Fourier & curves, Calculus & trig, Pi, Fractals, Music theory, Complex numbers, Harmonograph, Spirograph, Motion & sync, Numbers* — see Appendix A.

Special scenes worth knowing:
- `fdraw` Fourier drawing: a shape/text/flag/SVG path/own formula drawn by epicycles (`rounds` "3 8 25 80 250", `arms`, `text` A–Z0–9, `flag`, `svg` path d).
- `harmonograph` (pendulum machines, frequency ratios = chords, 115-scale tuning, symmetry, machine on stage 3D/blueprint/neon), `spirograph`/`guilloche` (gear sets, toy element, banknote engraving).
- `fifths` circle of fifths (keys, progressions, Pythagorean comma), `roots` roots of unity (z^n=1, Euler).
- `mandel` Mandelbrot/Julia zoom; `lsystem` Koch/dragon/Hilbert; `archimedes montecarlo buffon series pidigits` (π); `tangent riemann taylor unitcircle` (calculus & trig); `string travel fourier beats scope doppler` (waves); `chladni tubes ripple filings` (cymatics/fields).
- Motion & numbers (`src/circle/motion.js`): `kuramoto` (sync), `shepard` (`look` spiral|pole), `threebody` (`eight|burrau`, ghost copy, leapfrog), `dpendulum` (RK4, energy-checked), `primes` (`sacks|ulam`), `brachisto` (`race|tautochrone`).
- `sorting` (9 algorithms with sound), `chaos` (chaos game), `phyllo` (golden-angle sunflower), `times` (times-table circle), `popper`/`knives`/`slicer`/`rps`/`predator`/`colorwar` (games and battles), `galton`/`pachinko`/`packing`/`paper` (fill the screen).

---

## 6. Presets, library, authoring workflow

### 6.1 Where things live

```
presets-src/            JS authoring sources (helpers + lists)  ← edit these
  catalog.js            SHELVES [id,name,section], START_HERE, CATEGORY_SHELF ($category→shelf), GROUP_SHELF
  science.js            film(), L(), ODE(), MAP(), SURF(), melody(), notes(), circleFilm() helpers; chaos/shapes/numbers/motion
  science2.js           second science series (Hénon, Ikeda, Duffing, fern, SIR, van der Pol, Viviani, loxodrome, Theodorus, Gibbs …)
  cinematic.js / cinematic2.js   44 formula films (glitch, string art, laser web, prism, echo, kaleido …)
  moods.js              psychedelic / satisfying / ASMR / minimal packs + showcase films
  classroom.js          5 five-minute 16:9 lessons (lesson() helper)
  lessons/*.js          step-by-step lesson packs (circleLesson kit)
  sounds.js, sound-*.js sound presets, shapes, showcase
presets/                GENERATED JSON (never edit by hand); shelves/*.json, lessons/*.json, index.json, sounds.json
packs/*.mmv.json        importable bundles
```

After editing: `node scripts/build-presets.mjs` (tests fail if `presets/` is stale) → `npm test`.
Preset object = partial state + extras: `name` (unique), `$category` (shelf mapping), `mode`, `transport{duration,bpm}`, `view`, `params`, `layers`, `visual`, `camera`, `audio`, `overlay`, `keyframes`, `sequence`, `rhythm`, `drums`, `circle`, `hook{text}`, `youtube{title,description,tags}`, `about{title,math,surprise,where,sources[{label,url}]}`. Durations are also tuned in `presets-src/lengths.js`.
Built-in shelves (42, 574 presets): Start here · Sound (graph, curves, layers, quiz, waves, shapes 46, showcase 50) · Music theory · Math (Fourier, π, calculus, fractals, complex, harmonograph 47, spirograph 41, patterns, machines) · Physics · Stories · Satisfying (classic, multiply, fill, bounce, growth, games) · Formulas (2D, 3D, **cinematic 44**) · Showcase films · **Classroom 5** · Moods (psychedelic, satisfying, ASMR, minimal) · Science (chaos, shapes, numbers, motion, life). 21 lesson packs with 122 lessons.

### 6.2 Library features

Sections→shelves→presets; search (name/collection/formula); filters (built-in/mine/favourites, 16:9/9:16, 2D/3D); collections; favourites; hide built-ins; bulk export/render/move/delete; import `.json`/bundle/`.zip` (name clashes → "(2)"); IndexedDB storage; auto-saved session; batch render (tick presets → one `.zip` with MP4s, `.txt` metadata, CSV, `presets.mmv.json`); Daily plan (weekday themes Mon Fourier·Tue Sound·Wed π&calculus·Thu Fractals·Fri Physics·Sat Satisfying·Sun Quiz; 3 Shorts/day; remix engine `src/daily/remix.js`).

### 6.3 Export pipeline

One Export button: MP4 (H.264+AAC; WebCodecs in browser, or ffmpeg x264 via `npm start` server), WAV (offline render incl. drums/effects), MIDI, PNG, live capture. 720p–4K, 24/30/60 fps, quality, motion-blur sub-frames, GPU encoder opt-in. Shorts hook + teaser + flash + boom + fade-out are channel settings. Command line: `npm run render -- --builtin "Name" --width 1920 --height 1080 --fps 60 --out file.mp4` (Playwright + ffmpeg).
YouTube metadata (`youtube{title,description,tags}`) is saved in the preset, written to `.txt`, never drawn.

---

## 7. Recipes (how to build good presets)

**A. Cinematic formula film (vertical or 16:9)** — 3–6 layers: main curve (e.g. gradient, width 2.4, 3000 samples) + a second layer with a phase/ratio offset + hidden chord layers for the ending; `fx.style` (glitch/string/web/prism/…), `backdrop` + `backdropMotion`, `tone:'soft'`, `bloom` 0.5–0.8; `filmTracks({open:'follow', climax:'surge', finale:'both'})` merged with extra keys; `camera.ending:'reveal'`, `endingSecs 4`, `fx.hold ~3.5`; scale + notes via `notes()`; hook line + YouTube text; `about` for the maths.
**B. Seamless loop** — closed curve, `visual.loop:'wrap'`, `fx.hold:0`, `camera.ending:'off'`, 3D `rotateSpeed=60/duration`, `filmTracks({loop:true})`; open curves use `loop:'fade'`.
**C. Strange attractor / cloud** — `ode` (samples 12 000, `sim.dt`, `up:'z'`, `scale`, centre `cx cy cz`) or `map` (samples 60–90 000, `sim.alpha` 0.2, `volume:0`) + a hidden `melody()` layer for sound; breathe parameters with `a b c d` + keyframes; 3D with slow orbit.
**D. Classroom lesson (16:9, ~5 min)** — `classroom.js lesson()`: one layer per step with `start/end` windows and `drawFor`, `caption` only on the main layer (one at a time), `overlay.formulas{align:'center',box:true,x:.5,y:.045,size:2.2}`, short step titles (≤60 chars, size 0.7), `camera.pose` keys per step (relative to view centre), grid+axes on, vignette backdrop, `fx tube`, `ending:'cinema'`; ≤ 1 idea per step; `about` explains.
**E. Educational Circle-Lab lesson** — `presets-src/lessons/kit.js circleLesson(name, scene, steps[{lab, say}], opts)`: each step changes `lab` params + a one-line `say`.
**F. Quiz / hook formats** — `visual.hideUntil` (guess the shape), A-or-B (two layers), `hook.text` as a question.
**G. Mood packs** — Psychedelic (kaleido/rainbow/tunnel/plasma), Satisfying (perfect loops, ants, beads), ASMR (slow, soft, long reverb, `tone:'soft'`, low intensity), Minimal (grain/gradient backdrop, one shape).
**H. Sound-first presets** — pick a scale/instrument pair that fits the culture of the shape (maqam/dastgah/raga/pentatonic/whole-tone/quarter-tones), fit the note range to the curve, add `drone`, `pump`, `rhythm` grid + `drums`, key scale/root changes at the climax.

### Gotchas learned (read before building)

- 3D scenes use small units: keep the view extent about ±4…±8 and scale attractors with `sim.scale` (far plane limits very large scenes). Use `up:'z'` for Lorenz-type systems.
- `map` clouds (> 2000 samples) draw as dots; short maps draw as a line with a pen. Set `sim.skip:0` to keep the first points (spiral of Theodorus); remember `o.sim` must not silently override `skip` in helpers.
- Additive styles + bloom + dark background can white-out: lower `fx.intensity`, use `tone:'soft'`, or use normal-blend styles (`prism/ink/sketch`); on light paper use normal blending.
- `camera.pose` keys in 2D are relative to the view centre. Frame = `[cx, cy, halfHeight]` in lesson helpers.
- Never let a fade expression go negative (`Math.max(0, 1-d)`); NaN → black frames.
- Layer ids change on load — key by index.
- Dozens of audio steps per frame: heavy `map` layers must not be recomputed for sound (the engine uses the last drawn path).
- Duplicate preset names break the build; check shelf mapping (`$category`) when adding a new category.
- Test everything numeric (energy conservation, closure, ranges): see `tests/science-presets.test.mjs`, `classroom.test.mjs`, `cinematic.test.mjs`.
- Verify visually with headless Playwright still frames (640×360 for 16:9): `node scripts/serve.mjs 5200`, then load a preset and screenshot at several times; do not render full videos unless asked.

### Publishing as a claude.ai Artifact

`node scripts/build-artifact.mjs` → `dist/artifact.html` + `dist/artifact-publish-N.json` file maps → publish with the Artifact tool in order (include `overwrite_unread` for changed files and nulls for old build paths), then record the build (`scripts/artifact-published.json`, `scripts/artifact-presets.json`) in a commit.

---

## 8. Ideas still open (potential)

More classroom lessons (derivative & tangent, integral as area, vectors & rotation, probability/normal distribution, complex plane, matrices as transformations, trigonometric identities, sequences & series, conic sections, polar↔Cartesian), more 3D surfaces (spherical harmonics gallery, Calabi–Yau-style slices), more maps (Newton fractals via `map`, Collatz), cymatics gallery, music-theory scenes (intervals as Lissajous, Tonnetz), ASMR/Minimal packs with new backdrops, per-preset loops for Circle Lab, Bézier keyframe curves, shareable URL presets.

---

---

## 9. What was added in the big upgrade (read this if you knew the app before)

### 9.1 Driving the app from outside: `window.mmv`

Always available in the page (browser automation, the console):

```js
mmv.state()                      // a copy of the whole state (a preset)
mmv.load(preset)                 // load a whole or partial preset
mmv.get('visual.fx.style')       // read one setting
mmv.set('audio.scale', 'shur')   // change one setting (panels refresh)
mmv.layer(0, { exprs: { y: 'sin(3x)' }, fill: 'under', readout: 'area' })   // patch a layer and rebuild it
await mmv.presets()              // [{ shelf, name }] of every built-in preset
await mmv.loadByName('Fractal · Seahorse valley')
mmv.seek(12); mmv.play(); mmv.pause();
mmv.frame()                      // the current frame (drawing + text) as a PNG data URL
mmv.errors()                     // formula errors per layer, {} when everything compiles
```

### 9.2 Right panel: areas, then tabs (`TAB_GROUPS` in `src/ui/panels.js`)

| Area | Tabs |
| --- | --- |
| Create | ◎ Circle · 〰 Harmonograph · ✺ Spirograph · ❄ Fractals |
| Look | Look · FX · Text |
| Sound | Sound · Rhythm · ♪ From audio |
| Motion | Camera · Animate |
| Library | Presets · 📅 Daily |
| Export | Export |

### 9.3 Sound

- **160 scales** (`src/math/music.js`): new groups *Jazz & modern*, *Chord tones* (`chordMajor`, `chordMin7`, `fifths`, `octaves` … snap any curve to a chord), more maqam / dastgah (`bayatTork`, `afshari`, `jiharkah`, `atharKurd`, `huseyni`, `ussak`), *Tunings & temperaments* (`pythagorean`, `justMinor`, `meantone`, `harmonics8`, `undertones`, `shruti22`, `edo5/10/15/17/22/31/53`).
- **Custom scale**: `audio.scale: 'custom'` + `audio.customScale: '0 2 3.5 7'` (semitones), `'204c 386c 702c'` (cents) or `'9/8 5/4 3/2 2/1'` (ratios); a last step ≥ an octave is the period (`parseScale`).
- **`audio.transpose`** (semitones, keyframeable: key changes), **`audio.eq {low, mid, high}`** in dB (keyframeable), **`audio.drumKit`**: `classic | 808 | acoustic | techno | lofi`.
- **52 instruments**: new `808`, `808-dist`, `sub-bass`, `pluck-bass`, `lead-saw`, `theremin`, `strings`, `brass`, `church-organ`, `vibraphone`, `steel-drum`, `santur`, `tar`, `oud`, `ney`, `sitar`, `koto`. Patch field `drop {semi, time}` = pitch fall at the start of a note.
- **Per layer**: `harmony` (`off | octave | octaveDown | fifth | power | third | minorThird | major | minor | sus4 | seventh | minor7 | stack`) and `detune` (cents between two copies). Keyframeable `layer.N.harmony`.
- **Drums**: 7 pieces (`kick snare hat clap openhat tom perc`); trigger `pattern` reads `drums.patterns.<piece>`: one character per sixteenth note, `x` hit, `X` accent, `o` soft, `.` rest (`DRUM_PATTERNS` has ready beats: four, trap, boom, rock, dnb, reggaeton, techno, six8, half).

### 9.4 Graph look ("textbook" videos)

| Setting | What it does |
| --- | --- |
| `overlay.formulas.math: true` | captions are **typeset** (serif, fractions, powers, Greek). Write TeX-like text: `f' = f \frac{c}{c - v_r}`, `y = \sin x + \frac{\sin 3x}{3} + \cdots`, `f = 220 \cdot 2^{n/12}`, `r = 4 \sin\left(\frac{240\theta}{25}\right) + 10`, `\int_0^{\pi} \sin x \, dx = 2`. Plain text (`2^(n/12)`, `pi`, `*`) works too. In a sequence only the active layer's formula shows. Text boxes: `math: true`. Engine: `src/ui/mathtext.js` |
| `overlay.legend {enabled, x, y, size}` | a row naming the layers and the drums ("— car — 808 ‖ kick/snare/hat"); a layer's `legend` overrides its name, `'-'` hides it |
| `overlay.axes {x, y}` | letters at the ends of the axes (`t`, `f`, `n`) |
| `overlay.drumTicks` | a tick under the graph for every drum hit (kick long, snare medium, hats short; future hits faint) |
| `visual.marker.lens` | a thin circle round the pen (fraction of the frame width) |
| `layer.fill` | `under` (area between the curve and y = 0) or `origin` (area swept from the origin: hearts, roses); `fillAlpha`, `fillColor`; grows with the pen |
| `layer.readout` | a live number: `area` (∫ y dx, or the swept area with `fill: 'origin'`), `value`, `x`, `slope`, `length`; `overlay.readout {x, y, size, digits}`, `layer.readoutLabel` |

Paper style = `visual.background '#ffffff'`, black layers, `fx.style 'ink'`, `drawMode 'ghost'` (future notes grey), bloom off. See `presets-src/fractals.js` → `TEXTBOOK_PRESETS` (Doppler, square wave from curves, octave staircase, π digits beat, integral with a filling area, heart, rose, polar ring, Euler helix).

### 9.5 New Circle Lab scenes (`src/circle/shapes-lab.js`)

- **`shapewave`** — a point runs round shapes and its height is unrolled into a wave: `rows: 'circle rose square star'` (also ellipse, rose3, rose5, triangle, pentagon, hexagon, star6, heart, cardioid, lemniscate, astroid, spiro, `formula` with `formula: 'cos(3*theta)'`), `speed`, `cycles`, `part: y|x|r`, `title`.
- **`derivgraph`** — f over f′ (and f″ with `second`), a dashed link through the moving point: `f`, `xmin`, `xmax`, `period`, `tangent`, `title`, `textF`, `textD`.
- **`dotmatrix`** — a wall of lights: `mode: number|plot|region`, `value` (formula of t), `unit`, `f` (curve), `region` (lit where f(x, y) < 0), `cols`, `block`, `style: led|plate|pixels`, `color: gradient|magenta|amber|green|white`, `scan` (a scan line plays the lit cells), `scanSpeed`.

### 9.6 Fractals (`src/circle/fractal-lab.js`, tab `src/ui/fractal-tab.js`, cards `src/circle/fractal-gallery.js`)

**`fractal`** (escape-time explorer). `circle.lab.fractal`:

| Key | Values |
| --- | --- |
| `type` | `mandelbrot` z²+c · `multibrot` z^p+c · `burningship` (\|Re z\|+i\|Im z\|)²+c · `tricorn` conj(z)²+c · `celtic` · `buffalo` · `perpendicular` · `heart` · `phoenix` · `lambda` c·z(1−z) · `newton` (basins of z^p − 1) |
| `julia` | false = Mandelbrot view (c = the pixel), true = Julia view (c fixed, `jx`, `jy`) |
| `journey` | `zoom` (into `spot` or `cx, cy`; ×10^`depth`) · `julia` (c travels: `jpath` circle\|cardioid\|bulb\|line\|fixed, `jr`, `jspeed`, `jx2`, `jy2`) · `power` (`power` → `power2`) · `pan` · `still` |
| `spot` | seahorse, spiral, elephant, lightning, needle, tendrils, starfish, feigenbaum, ship, shipMast, tricornArm, celticEye, custom |
| `colors` | fire, ocean, neon, gold, rainbow, mono, twilight, electric, ice, forest, candy, lava, inferno, viridis, zebra, pastel, copper, aurora |
| `coloring` | `smooth` · `bands` · `trap` (+ `trap`: point\|cross\|circle\|line) · `stripes` · `angle` (binary decomposition); `density`, `cycle`, `interior: black\|glow` |
| other | `rotate`, `iter` (0 = automatic), `res`, `bleed` (fill the whole frame), `relax` (Newton step), `sound: journey\|orbit\|off`, `nps`, `showOrbit` |

Rendering: a fragment shader on a private WebGL canvas; below a view width of 3·10⁻⁵ (zoom ≈ ×10⁵) it switches to exact 64-bit arithmetic on the CPU (slower, lower detail), so zooms to ×10¹³ work.
**`buddha`** (Buddhabrot / anti-Buddhabrot: `rate`, `minIter`, `maxIter`, `anti`, `colors`, `gain`), **`lyapunov`** (`seq` such as `AB`, `AABAB`, `BBBBBBAAAAAA`; ranges `a0 a1 b0 b1`; `iters`, `reveal`, `cycle`), **`ifs`** (chaos game: `system` = fern, fern2, sierpinski, carpet, vicsek, dragon, twindragon, levy, koch, maple, tree, spiral, crystal, pentaflake, hexaflake, pythagoras; `rate0`, `accel`, `max`, `colorBy`). The older `mandel`, `lsystem`, `chaos`, `tree` scenes remain.
To add a family: one row in `FRACTAL_TYPES` (flags = fold x, fold y, conjugate, fold Re after, fold Im after) is enough for the abs/conj family; other rules need a branch in both `orbit()` and the shader. To add a gallery card and a preset: one row in `GALLERY`.

### 9.7 Other

- Batch export in the browser: the result window lists every file with its own **Save** button (a zip of many videos can be too large for the artifact viewer to save in one piece).
- New shelves: **Fractals** (38 presets) and **Textbook** (16); lesson pack *Fractal workshop & graph scenes* (8 lessons).
- Tests: `tests/upgrade.test.mjs`.

---

## 10. The control upgrade: exact previews, checks, keyable scenes, mixing, loudness

Everything here is additive: existing presets load and look as before.

### 10.1 `window.mmv` — the full list

| Call | What it does |
|---|---|
| `state()` · `load(preset)` · `get(path)` · `set(path, value)` · `layer(i, patch)` | read and change the state |
| `presets()` · `loadByName(name)` | built-in presets |
| `seek(s)` · `play()` · `pause()` | the playhead |
| `frame()` | the current frame **as the export draws it** (camera moves and endings, keyframes, bars, text) |
| `renderStill(t, { width, height, video, lead })` | the frame at `t` seconds through the export pipeline. `width`/`height` = an export size (e.g. 1080 × 1920). `video: true` = `t` is video time (teaser, hook line, fade-out). `lead` (1.5 s) is played first so the following camera, trails and drum pulses are where they would be |
| `validate(preset?)` | `{ ok, errors, warnings, problems: [{ level, path, message }], summary }` (see 10.2) |
| `describe()` · `describe('fractal')` | every simulation · one simulation's settings with type, range, default and path |
| `animatable()` | everything that can be keyframed right now |
| `key(path, time, value?, ease?)` | add a key (value omitted = the current value) |
| `marker(time, label)` · `markers()` | story beats |
| `save(name)` · `export()` | save into the library · the preset as `.mmv.json` text |
| `renderVideos([{ name, preset }])` | batch render to one zip |
| `loudness()` · `normalize()` · `master(id)` | measure the soundtrack · set the level to −14 LUFS · a mastering preset |
| `errors()` | formula errors of the layers |

### 10.2 The check (`src/validate.js`)

`validateState(state)` is pure (the tests run it). Levels: **error** (a formula that does not compile, an unknown scene / instrument / scale / blend / choice, no layer switched on), **warning** (keys, texts, layers or story beats after the end of the video; a key for a property that cannot be animated; a setting that does not exist), **info** (a value beyond its slider range; everything timed ends before half of the video — a length left over from another preset; plain text over a fractal that fills the frame). Loading a preset shows a toast only for errors and for things after the end. People run it in **Export → Check this video**.

### 10.3 Keyframes for Circle Lab and fractals (lane **Scene**)

Every setting of the scene on stage is animatable: `circle.lab.<rule>.<key>` (first stage) and `circle.layers.<i>.cfg.lab.<rule>.<key>` (others); plus `circle.opacity`, `circle.layers.<i>.opacity`, and per stage `look.zoom`, `look.dx`, `look.dy`, `look.glow`, `look.bloom`, `sound.volume`. Sliders glide, whole-number sliders step, lists and switches hold until the next key. Key mode records them like any other control. The soundtrack replay reads the same keys.

Scenes that are a function of time (the fractals) follow keys exactly. Scenes with a memory (balls, growth) take the new value from that moment on; settings used only when the scene starts (counts, seeds) do not restart it.

**Fractal timing recipes**
- *c arrives at an exact moment*: `julia: true`, `journey: 'still'`, `jpath: 'fixed'`, then key `jx` and `jy`. Or keep a path and key `jphase` (rounds along the path) with `jspeed: 0`.
- *A dive of your own*: `journey: 'still'`, `spot: 'custom'`, key `cx`, `cy` and `zexp` (extra zoom as a power of ten: 0 → 6 is ×1 → ×1 000 000 at a steady pace).
- *Colour*: key `shift` (rounds of the palette) for an exact cycle, `colors` to change the palette at a moment.
- *Readable text*: `bright`, `contrast`, `sat` (1 = unchanged), or the dark palettes `dusk` and `ash`.
- *c as a live number*: `circle.look.counter: true` shows `c = …` (or the zoom, or the power).

### 10.4 Mixing scenes

- Per layer: `opacity` (0 … 1) and `blend`: `normal`, `screen` (black becomes see-through: a Buddhabrot over a tree), `add`, `multiply`, `overlay`, `difference`. The first layer keeps them in `circle.opacity` / `circle.blend`, the others in `circle.layers[i].opacity` / `.blend`. Controls sit on each layer card.
- Between steps of “one after another”: `circle.transition` = `fade` (default) | `dissolve` | `zoom` | `wipe` | `cut`, and `circle.transitionSecs` (0.1 … 3).

### 10.5 Camera

`camera.trackLayer`: whose pen the camera follows with `camera.track` (0 = the layer drawing now, n = layer n). Keyframeable. No invisible guide layer is needed any more.

### 10.6 Sound

- **Loudness** (`src/audio/loudness.js`, `mmv.loudness()`, Sound tab → Output): integrated LUFS (ITU-R BS.1770, checked against the −23 LUFS reference tone), peak, clipped samples, loudness range, silent stretches, low / middle / high balance, a curve per second and plain advice. `mmv.normalize()` sets the master volume for −14 LUFS. It measures; it cannot judge whether the music is good.
- **Loudness formula per layer**: `layer.volExpr`, 0 … 1.5 multiplied into the layer's volume; variables `x y z` (the pen), `u` (0 … 1 along the layer), `t` (seconds). `'u^2'` swells, `'abs(cos(3x))'` pulses.
- **Mastering presets**: `clean`, `warm`, `cinematic`, `lofi`, `bright`, `club`, `dream` set EQ, drive, crush, filter, reverb, delay (and modulation / pump for some); nothing else.
- **Four instruments with noise**: `ney-breath`, `santur-hammer`, `strings-bowed`, `flute-breath`. Patch field `noise { gain, key, q, burst, decay }` = band-passed noise through the amp: steady breath (`gain`) and the strike at the start of a note (`burst`). Still synthesis, no samples.

### 10.7 Story beats

`state.markers = [{ time, label }]`: yellow flags on the timeline (Animate tab → Story beats; “Five-beat sheet” spreads hook, rise, turn, climax, ending). A keyframe dragged near a beat snaps onto it. Nothing of them is drawn on the video.

### 10.8 Batch render

- `youtube.title / description / tags` and `hook.text` stored as lists are turned into text on load, and the export code accepts lists too (this was the “`.trim is not a function`” stop).
- One broken preset no longer stops the batch: it is listed in `FAILED.txt` and the rest render.
- `record.batchVideosOnly` (Export tab): the zip holds only the MP4s.

---

# Appendix A — Circle Lab scenes and their `lab` parameters (generated)

Use as `circle: { rule: '<id>', lab: { '<id>': { …keys… } } }`. Ranges are the slider limits; `∈ {…}` are the allowed choices; "(formula)" fields take a math expression; unspecified keys keep their defaults (see `SCENES[id].defaults` in `src/circle/scenes.js`).

#### Multiply & split

**`triple`** — Core splits every ball into 3  
lab keys: `arena` ∈ {circle|box|square|stadium|poly|tri}; `core` 0…0.6; `coreShape` ∈ {circle|square|tri|hex}; `coreSpin` -4…4; `coreAction` ∈ {split|clone|bounce|recolor|grow|shrink|remove}; `coreN` 2…8; `spread` 2…180°; `childScale` 0.4…1; `max` 2…1500; `wall` ∈ {bounce|split|clone|grow|shrink|recolor|speed}; `speed` 0.1…5; `size` 0.005…0.2; `gravity` 0…8; `bounce` 0.2…1.1

**`boxcore`** — Square core in a tall box  
lab keys: `arena` ∈ {circle|box|square|stadium|poly|tri}; `core` 0…0.6; `coreShape` ∈ {circle|square|tri|hex}; `coreSpin` -4…4; `coreAction` ∈ {split|clone|bounce|recolor|grow|shrink|remove}; `coreN` 2…8; `spread` 2…180°; `childScale` 0.4…1; `max` 2…1500; `wall` ∈ {bounce|split|clone|grow|shrink|recolor|speed}; `speed` 0.1…5; `size` 0.005…0.2; `gravity` 0…8; `bounce` 0.2…1.1

**`shatter`** — Grenade: every hit shatters into 3  
lab keys: `arena` ∈ {circle|box|square|stadium|poly|tri}; `wallN` 2…8; `spread` 2…180°; `childScale` 0.4…1; `max` 2…1500; `collide` (on/off); `ballStyle` ∈ {glow|cell|gem}; `speed` 0.1…5; `size` 0.005…0.2; `gravity` 0…8; `bounce` 0.2…1.1

**`escapeplus`** — Escape & multiply (fill the screen)  
lab keys: `arenaSize` 0.3…1; `gap` 0…140°; `gapSpin` -3…3; `escapeN` 0…6; `outGravity` 0…8; `max` 2…1500; `speed` 0.1…5; `size` 0.005…0.2; `gravity` 0…8; `bounce` 0.2…1.1

**`chain`** — Chain reaction: every touch makes a ball  
lab keys: `arena` ∈ {circle|box|square|stadium|poly|tri}; `balls` 0…120; `max` 2…1500; `speed` 0.1…5; `size` 0.005…0.2; `gravity` 0…8; `bounce` 0.2…1.1

**`mitosis`** — Cells divide on the beat  
lab keys: `arena` ∈ {circle|box|square|stadium|poly|tri}; `divide` 0.25…8; `childScale` 0.4…1; `max` 2…1500; `drag` 0…3; `ballStyle` ∈ {glow|cell|gem}

#### Fill the screen

**`galton`** — Galton board (bell curve)  
lab keys: `rows` 3…18; `pegSize` 0.006…0.05; `emit` 0…10; `emitEvery` 0.0625…4; `emitMax` 1…1500; `colorEvery` 1…200; `size` 0.005…0.2; `gravity` 0…8

**`pyramid`** — Pyramid cascade  
lab keys: `rows` 3…18; `emit` 0…10; `emitEvery` 0.0625…4; `emitMax` 1…1500; `colorEvery` 1…200; `emitRamp` 0…64; `size` 0.005…0.2; `gravity` 0…8

**`beatfill`** — Beat fill: drops on the beat, new colour every bar  
lab keys: `arena` ∈ {circle|box|square|stadium|poly|tri}; `emit` 0…10; `emitEvery` 0.0625…4; `emitRamp` 0…64; `emitMax` 1…1500; `colorEvery` 1…200; `size` 0.005…0.2; `gravity` 0…8

**`pachinko`** — Pachinko rain  
lab keys: `rows` 3…18; `pegSize` 0.006…0.05; `emit` 0…10; `emitEvery` 0.0625…4; `emitMax` 1…1500; `colorEvery` 1…200; `size` 0.005…0.2; `gravity` 0…8

**`paper`** — Paper cut: halve, halve, halve…  
lab keys: `mode` ∈ {half|quad|golden|tri}; `cut0` 0.1…2 s; `decay` 0.8…1; `minCut` 0.01…0.3 s; `max` 8…1024; `gapSize` 0…0.05; `scissors` (on/off)

**`packing`** — Circle packing (grow until they touch)  
lab keys: `shape` ∈ {box|circle}; `rate0` 0.5…20; `accel` 1…1.5; `growth` 0.05…1.5; `maxR` 0.05…0.8; `gap` 0…0.03; `max` 20…1500

#### Bounce & draw

**`hexagon`** — Ball in a spinning hexagon  
lab keys: `sides` 3…12; `spin` -3…3; `gap` 0…140°; `gapSpin` -3…3; `balls` 0…120; `wall` ∈ {bounce|split|clone|grow|shrink|recolor|speed}; `ink` (on/off); `speed` 0.1…5; `size` 0.005…0.2; `gravity` 0…8; `bounce` 0.2…1.1

**`shrink`** — Shrinking arena  
lab keys: `arena` ∈ {circle|box|square|stadium|poly|tri}; `shrink` 0…0.02; `balls` 0…120; `speedGain` 1…1.08; `ink` (on/off); `speed` 0.1…5; `size` 0.005…0.2; `gravity` 0…8; `bounce` 0.2…1.1

**`billiard`** — Billiard in a square (lines fill it)  
lab keys: `arena` ∈ {circle|box|square|stadium|poly|tri}; `angle` 0…360°; `balls` 0…120; `ink` (on/off); `speed` 0.1…5; `size` 0.005…0.2; `gravity` 0…8; `bounce` 0.2…1.1

#### Battles & growth

**`colorwar`** — Colour war: who takes over?  
lab keys: `teams` 2…6; `balls` 0…120; `arena` ∈ {circle|box|square|stadium|poly|tri}; `speed` 0.1…5; `size` 0.005…0.2; `gravity` 0…8; `bounce` 0.2…1.1

**`growpack`** — Grow until jammed  
lab keys: `arena` ∈ {circle|box|square|stadium|poly|tri}; `balls` 0…120; `grow` 0.001…0.05; `speed` 0.1…5; `size` 0.005…0.2; `gravity` 0…8; `bounce` 0.2…1.1

**`coral`** — Coral (balls stick and grow a reef)  
lab keys: `walkers` 1…80; `size` 0.005…0.2; `speed` 0.1…5; `jitter` 0…10; `max` 2…1500

**`snowflake`** — Crystal from the centre  
lab keys: `walkers` 1…80; `size` 0.005…0.2; `speed` 0.1…5; `jitter` 0…10; `max` 2…1500

#### Patterns & rhythm

**`radar`** — Radar sweep: every ping adds a target  
lab keys: `action` ∈ {add|grow|turn|remove}; `blips` 1…300; `sweep` 0.05…2; `max` 10…600; `turn` -90…90°; `rings` 0…10

**`chaos`** — Chaos game (Sierpiński from random jumps)  
lab keys: `corners` 3…8; `ratio` 0.3…0.75; `rule` ∈ {none|norepeat|noneighbor}; `rate0` 0.5…20; `accel` 1…1.8; `dot` 0.4…3

**`phyllo`** — Sunflower (golden-angle seeds)  
lab keys: `angle` 130…145°; `spread` 0.015…0.08; `size` 0.008…0.06; `rate0` 0.5…20; `accel` 1…1.6; `max` 50…3000; `color` ∈ {spiral|spiral34|radius|golden}; `spin` -0.5…0.5

**`pendulum`** — Pendulum wave  
lab keys: `count` 3…32; `base` 4…60; `cycle` 5…120 s; `swing` 5…40°

**`dna`** — DNA helix zipping up  
lab keys: `pairs` 8…120; `turns` 0.5…8; `spin` -2…2; `zip` 0.125…4; `radius` 0.2…0.95; `colors` ∈ {bases|palette}

**`sorting`** — Sorting algorithm with sound  
lab keys: `algo` ∈ {bubble|cocktail|insertion|selection|quick|merge|heap|shell|radix}; `bars` 8…256; `time` 3…120 s; `finale` (on/off)

**`polygons`** — Polygon polyrhythm (a note on every corner)  
lab keys: `from` 2…12; `to` 3…16; `lap` 1…32; `mode` ∈ {same|beat}

**`dotmatrix`** — LED matrix: block digits, curves and shapes from lights  
lab keys: `mode` ∈ {number|plot|region}; `value` (formula of t); `unit` (text); `f` (formula of x,t); `region` (formula of x,y,t); `cols` 8…72; `block` 1…6; `style` ∈ {led|plate|pixels}; `color` ∈ {gradient|magenta|amber|green|white}; `scan` (on/off); `scanSpeed` 0.5…16

#### Drawing machines

**`harmono`** — Harmonograph (decaying pendulums draw)  
lab keys: `f1` 1…8; `f3` 1…8; `f2` 1…8; `f4` 1…8; `p` 0…3.1416; `decay` 0…0.08; `rate` 0.2…5

**`orbits`** — Planet dance (lines between two orbits)  
lab keys: `inner` 1…40; `outer` 1…40; `cycle` 4…120 s; `every` 0.02…0.5 s; `r1` 0.2…0.95

**`tree`** — Fractal tree growing on the beat  
lab keys: `depth` 3…13; `angle` 5…70°; `ratio` 0.5…0.85; `beats` 0.25…4; `curl` -20…20°; `sway` 0…3; `leaves` (on/off)

**`times`** — Times-table circle (cardioid, nephroid …)  
lab keys: `points` 20…500; `from` 1…20; `to` 1…60; `build` 0.5…20 s; `morph` 1…120 s

**`spiro`** — Spirograph (a wheel rolling inside a wheel)  
lab keys: `r` 0.05…0.95; `d` 0…1.5; `rate` 0.2…8

#### Battles & formulas

**`rps`** — Rock, paper, scissors battle  
lab keys: `kinds` ∈ {3|5}; `each` 2…60; `speed` 0.1…1.5; `chase` (formula of t); `flee` 0…3; `size` 0.03…0.16; `arena` ∈ {circle|square}; `flowX` (formula of x,y,t); `flowY` (formula of x,y,t); `flow` 0…2

**`predator`** — Scissors vs flowers (predator & prey)  
lab keys: `theme` ∈ {garden|bubbles}; `flowers` 1…150; `hunters` 1…20; `alpha` 0…2; `cap` 20…500; `gamma` 0…1; `delta` 0.05…1; `speed` 0.1…2; `size` 0.03…0.16

**`slicer`** — Blade slices every ball in half  
lab keys: `ba` (formula of t); `bx` (formula of t); `by` (formula of t); `len` 0.3…2.4; `blades` 1…6; `balls` 1…40; `size` 0.04…0.4; `speed` 0…2; `minR` 0.005…0.1; `max` 10…1500; `arena` ∈ {circle|square}

**`knives`** — Knife hit: throw on the beat into a spinning target  
lab keys: `spin` (formula of t,n); `more` (formula of n); `every` 0.25…4; `gap` 2…40°; `size` 0.2…0.7

**`popper`** — Spike draws a formula through balloons  
lab keys: `x` (formula of t); `y` (formula of t); `rate` 0.02…2; `count` 20…800; `spike` 0.02…0.25; `points` 3…12; `refill` 0…20; `arena` ∈ {box|circle}

#### Vibration & waves

**`chladni`** — Chladni plate: sound shapes the sand  
lab keys: `plate` ∈ {square|tall|circle|formula}; `modes` (text); `every` 1…16; `formula` (formula of x,y,n,m,t); `grains` 500…20000; `grain` ∈ {sand|rice|glow}; `shake` 0.05…2; `drift` 0…0.6; `sign` ∈ {+|-|alt}; `wait` 0…5 s; `showWave` (on/off)

**`tubes`** — Kundt's tubes: dust piles at the nodes  
lab keys: `count` 2…12; `pipe` ∈ {fixed|open|half|formula}; `harmonics` (text); `formula` (formula of x,k); `grains` 100…3000; `every` 0.5…8; `shake` 0.05…2; `grain` ∈ {sand|rice|glow}

**`ripple`** — Wave interference: where waves cancel, sand stays  
lab keys: `steps` (text); `every` 1…16; `spread` 0.05…0.9; `layout` ∈ {ring|line}; `phase` (formula of j,n,k); `grains` 500…20000; `grain` ∈ {sand|rice|glow}; `shake` 0.05…2

**`filings`** — Iron filings show the magnetic field  
lab keys: `setups` (text); `every` 1…16; `bx` (formula of x,y); `by` (formula of x,y); `grains` 500…12000; `tap` 0.05…2; `paper` ∈ {dark|light}

#### Waves & sound

**`string`** — Standing waves on a string (harmonics)  
lab keys: `modes` (text); `every` 1…16; `formula` (formula of x,n,t); `amp` 0.1…1; `base` 24…72; `labels` (on/off)

**`travel`** — Travelling wave: wavelength, frequency, speed  
lab keys: `lambdas` (text); `every` 1…16; `speed` 0.1…2; `formula` (formula of x,t,w,p); `amp` 0.05…0.4; `show` ∈ {both|rope|sound}; `base` 24…72

**`fourier`** — Fourier: circles add up to any wave  
lab keys: `wave` ∈ {square|saw|triangle|custom}; `coeff` (formula of n); `terms` 1…40; `every` 0.5…8; `spin` 0.05…1; `base` 24…72

**`beats`** — Beats: two close notes swell and fade  
lab keys: `gaps` (text); `every` 1…16; `f1` 1…20; `y1` (formula of t,a,b); `y2` (formula of t,a,b); `window` 1…8; `base` 36…84

**`scope`** — Oscilloscope: musical intervals as shapes  
lab keys: `intervals` (text); `every` 1…16; `drift` 0…2; `x` (formula of s,a,b,d); `y` (formula of s,a,b,d); `base` 36…72

**`doppler`** — Doppler effect and the Mach cone  
lab keys: `machs` (text); `every` 2…16; `gap` 0.05…0.5; `c` 0.2…1.5; `path` ∈ {line|circle}; `base` 36…84

#### Fourier & curves

**`fdraw`** — Fourier drawing: circles draw any shape  
lab keys: `shape` ∈ {cat|pi|heart|note|star|butterfly|infinity|flower|batman|leaf|crescentstar|crescent|cross|circle|text|formula|svg}; `text` (text); `flag` ∈ {none|japan|canada|switzerland|turkey|vietnam}; `fill` (text); `rounds` (text); `period` 2…20; `size` 0.3…1.2; `arms` 5…200; `ghost` (on/off); `notes` 0…8; `x` (formula of s); `y` (formula of s); `svg` (text)

#### Calculus & trig

**`tangent`** — Derivative: a tangent line slides along a curve  
lab keys: `f` (formula of x,t); `sweep` 3…30; `deriv` (on/off); `xmin` -20…0; `xmax` 0…20; `ymin` -20…0; `ymax` 0…20; `notes` 0…8

**`riemann`** — Integral: rectangles fill the area under a curve  
lab keys: `f` (formula of x,t); `a` -20…20; `b` -20…20; `steps` (text); `every` 1…16; `rule` ∈ {left|mid|right}; `xmin` -20…0; `xmax` 0…20; `ymin` -20…0; `ymax` 0…20

**`taylor`** — Taylor series: a polynomial learns a curve  
lab keys: `fn` ∈ {sin|cos|exp|ln|geo|atan}; `terms` 1…20; `every` 0.5…8

**`unitcircle`** — Unit circle: sine and cosine from a turning point  
lab keys: `speed` 0.05…1; `show` ∈ {both|sin|cos}; `tan` (on/off); `notes` 0…8

**`shapewave`** — Geometry of waves: a shape unrolled into a wave  
lab keys: `rows` (text); `formula` (formula of theta,t); `speed` 0.05…1.5; `cycles` 1…6; `part` ∈ {y|x|r}; `notes` 0…8; `title` (text)

**`derivgraph`** — Function and derivative: two graphs, one moving point  
lab keys: `f` (formula of x,t); `xmin` -20…0; `xmax` 0…20; `period` 2…40; `second` (on/off); `tangent` (on/off); `title` (text); `textF` (text); `textD` (text); `notes` 0…8

#### Pi

**`archimedes`** — Archimedes: polygons squeeze π  
lab keys: `sides` (text); `every` 1…16

**`montecarlo`** — Monte Carlo: random dots find π  
lab keys: `rate0` 1…100; `accel` 1…2; `max` 100…60000; `dot` 0.5…5

**`buffon`** — Buffon's needle: π from dropped needles  
lab keys: `rate0` 1…50; `accel` 1…2; `max` 50…8000; `lines` 3…12

**`series`** — Series for π: sums that close in  
lab keys: `kind` ∈ {leibniz|nilakantha|wallis}; `terms` 5…400; `per` 0.05…2

**`pidigits`** — Digits of π: a walk, a circle, a song  
lab keys: `mode` ∈ {walk|chords|grid}; `rate0` 1…40; `accel` 1…1.6; `max` 50…5000; `step` 0.005…0.1

#### Fractals

**`mandel`** — Mandelbrot zoom and Julia sets  
lab keys: `set` ∈ {mandelbrot|julia}; `spot` ∈ {seahorse|spiral|lightning|needle|custom}; `cx` -2…1; `cy` -1.5…1.5; `depth` 1…12; `colors` ∈ {fire|ocean|neon|gold|rainbow|mono}; `juliaR` 0.3…1; `juliaSpeed` 0.005…0.3; `res` 120…600; `notes` 0…8

**`lsystem`** — Fractal curves: Koch, dragon, Hilbert …  
lab keys: `curve` ∈ {koch|dragon|hilbert|arrowhead|gosper|levy}; `steps` (text); `every` 1…16; `draw` 0.1…1; `notes` 0…8

**`fractal`** — Fractal explorer (Mandelbrot, Julia, Burning Ship, Newton …)  
lab keys: `type` ∈ {mandelbrot|multibrot|burningship|tricorn|celtic|buffalo|perpendicular|heart|phoenix|lambda|newton}; `julia` (on/off); `journey` ∈ {zoom|julia|power|pan|still}; `spot` ∈ {seahorse|spiral|elephant|lightning|needle|tendrils|starfish|feigenbaum|ship|shipMast|tricornArm|celticEye|custom}; `cx` -2.5…2.5; `cy` -2.5…2.5; `depth` 0.5…13; `zoom` 0.3…200; `wait` 0…6; `jpath` ∈ {circle|cardioid|bulb|line|fixed}; `jr` 0.1…1.2; `jspeed` 0.002…0.3; `jx` -2…2; `jy` -2…2; `jx2` -2…2; `jy2` -2…2; `power` 2…9; `power2` 2…9; `relax` 0.3…1.9; `colors` ∈ {fire|ocean|neon|gold|rainbow|mono|twilight|electric|ice|forest|candy|lava|inferno|viridis|zebra|pastel|copper|aurora}; `coloring` ∈ {smooth|bands|trap|stripes|angle}; `trap` ∈ {point|cross|circle|line}; `density` 0.1…6; `cycle` -0.5…0.5; `interior` ∈ {black|glow}; `rotate` -0.2…0.2; `iter` 0…1800; `res` 160…1080; `sound` ∈ {journey|orbit|off}; `nps` 0…8; `showOrbit` (on/off); `bleed` (on/off)

**`buddha`** — Buddhabrot (the paths of escaping points)  
lab keys: `rate` 100…8000; `minIter` 1…200; `maxIter` 20…2000; `anti` (on/off); `colors` ∈ {fire|ocean|neon|gold|rainbow|mono|twilight|electric|ice|forest|candy|lava|inferno|viridis|zebra|pastel|copper|aurora}; `gain` 0.3…4; `res` 120…500; `nps` 0…8

**`lyapunov`** — Lyapunov fractal (order and chaos of a population)  
lab keys: `seq` (text); `a0` 0…4; `a1` 0…4; `b0` 0…4; `b1` 0…4; `colors` ∈ {fire|ocean|neon|gold|rainbow|mono|twilight|electric|ice|forest|candy|lava|inferno|viridis|zebra|pastel|copper|aurora}; `iters` 40…600; `res` 100…420; `cycle` -0.3…0.3; `reveal` 0…30; `nps` 0…8

**`ifs`** — Chaos game and IFS (fern, dragon, snowflakes …)  
lab keys: `system` ∈ {fern|fern2|sierpinski|carpet|vicsek|dragon|twindragon|levy|koch|maple|tree|spiral|crystal|pentaflake|hexaflake|pythagoras}; `rate0` 1…400; `accel` 1…2; `max` 5000…190000; `dot` 0.4…3; `colorBy` ∈ {map|height|time}; `nps` 0…8

#### Music theory

**`fifths`** — Circle of fifths (keys, chords, scales)  
lab keys: `mode` ∈ {walk|family|scale|relative|comma}; `key` ∈ {0|1|2|3|4|5|6|7|8|9|10|11}; `dir` ∈ {up|down}; `chord` ∈ {note|power|triad|seventh}; `every` 0.5…8; `steps` 2…24; `prog` (text); `minor` (on/off); `names` ∈ {mixed|sharps|flats}; `base` 24…60; `labels` (on/off)

#### Complex numbers

**`roots`** — Roots of unity (complex numbers on the circle)  
lab keys: `mode` ∈ {roots|power|multiply|sum|euler}; `n` 2…24; `n2` 2…24; `m` 1…23; `all` (on/off); `every` 0.25…4; `rho` 0.7…1.1; `angle` -180…180; `start` -180…180; `steps` 2…48; `sweep` 2…30; `to` 0.25…4; `primitive` (on/off); `labels` (on/off); `axes` (on/off)

#### Harmonograph

**`harmonograph`** — Harmonograph (the drawing machine of pendulums)  
lab keys: `kind` ∈ {lateral|quad|rotary|lissajous|epicycle|formula}; `fa` 0.25…12; `fb` 0.25…12; `fc` 0.25…12; `fd` 0.25…12; `pa` 0…360°; `pb` 0…360°; `pc` 0…360°; `pd` 0…360°; `aa` 0…1; `ab` 0…1; `ac` 0…1; `ad` 0…1; `table` -4…4; `tp` 0…360°; `life` 0…180; `rate` 0.2…8; `fx` (formula of t,s,a,b,c,d); `fy` (formula of t,s,a,b,c,d); `fit` ∈ {auto|square|fill}; `pens` 1…4; `penGap` 0.02…3; `ink` ∈ {neon|fine|brush|ink}; `colorBy` ∈ {time|speed|angle|radius|pen}; `hue0` 0…1; `hueRate` 0…0.1; `width` 0.3…5; `ghost` (on/off); `paper` ∈ {default|velvet|midnight|blueprint|chalk|ember|desk|parchment|cream}; `frame` ∈ {none|line|double|ornate}; `dials` (on/off); `pen` ∈ {dot|nib|none}; `sym` 1…12; `mirror` (on/off); `size` 0.3…1.5; `x` -1.5…1.5; `y` -1.5…1.5; `machine` ∈ {off|plan|3d}; `machineStyle` ∈ {victorian|blueprint|neon}; `machineShow` ∈ {on|off|intro|outro|inout}; `machineOpacity` 0…1; `machineFade` 0.2…8; `machineIntro` 1…60; `machineLayout` ∈ {top|corner|full|free}; `machineX` -1.5…1.5; `machineY` -1.5…1.5; `machineScale` 0.3…1.5; `machineYaw` -180…180°; `machinePitch` 10…80°; `machineSpin` -20…20; `sound` ∈ {strum|chord|cross|off}; `arp` ∈ {up|down|pingpong}; `every` 0.1…4 s; `base` 24…84; `tuning` ∈ {just|equal}

#### Spirograph

**`spirograph`** — Spirograph (toothed wheels draw)  
lab keys: `kind` ∈ {hypo|epi|compound|lobed|formula}; `R` 20…200; `r` 6…160; `d` 0…120; `r2` 5…80; `d2` 0…60; `m` -12…12; `lobes` 2…8; `lobeAmt` 0…0.6; `fx` (formula of t,ring,wheel,d,k); `fy` (formula of t,ring,wheel,d,k); `dFormula` (formula of t,d,ring,wheel); `turns` 0…200; `drawTime` 4…120; `ease` ∈ {steady|intro|smooth}; `pens` 1…3; `dStep` 0.5…20; `ink` ∈ {neon|fine|brush|ink}; `colorBy` ∈ {time|turn|speed|radius|angle|pen}; `hue0` 0…1; `hueRate` 0…8; `width` 0.3…5; `paper` ∈ {default|velvet|midnight|blueprint|chalk|ember|desk|parchment|cream}; `frame` ∈ {none|line|double|ornate}; `size` 0.3…1.5; `x` -1.5…1.5; `y` -1.5…1.5; `rot` -180…180°; `toyShow` ∈ {on|off|intro|outro|inout}; `toyOpacity` 0…1; `toyFade` 0.2…8; `toyIntro` 1…60; `toyStyle` ∈ {toy|brass|blueprint|neon}; `toyHoles` (on/off); `toyShadow` (on/off); `toyDetach` (on/off); `toyDx` -1.5…1.5; `toyDy` -1.5…1.5; `toyScale` 0.2…2; `toyRot` -180…180°; `sound` ∈ {gear|petal|ratio|off}; `every` 1…48; `ratioEvery` 0.4…8; `base` 24…84; `tuning` ∈ {just|equal}

**`guilloche`** — Guilloche (engine-turned patterns)  
lab keys: `type` ∈ {rosette|dial|ribbon|lathe|formula}; `lines` 6…160; `revealTime` 3…90; `ease` ∈ {steady|intro|smooth}; `R` 20…200; `r` 6…160; `d` 0…100; `dStep` -1…1; `turnStep` 0…30°; `rings` 20…220; `lobes` 2…40; `amp` 0…0.06; `ampGrow` 0…3; `phaseStep` 0…1; `innerR` 0…0.4; `harmonic` 2…24; `harmonic2` 0…2; `rays` 0…240; `strands` 6…50; `waves` 2…24; `bandAmp` 0.005…0.12; `corners` (on/off); `centre` (on/off); `fR` (formula of a,k,n,u); `colors` ∈ {palette|bands|mono}; `ink1` (text); `ink2` (text); `ink3` (text); `hue0` 0…1; `hueSpan` 0…3; `width` 0.3…4; `alpha` 0.1…1; `paper` ∈ {default|velvet|midnight|blueprint|chalk|ember|desk|parchment|cream}; `frame` ∈ {none|line|double|ornate}; `size` 0.3…1.5; `x` -1.5…1.5; `y` -1.5…1.5; `rot` -180…180°; `furniture` ∈ {none|ticks|hands}; `sound` ∈ {sweep|off}; `base` 24…84; `every` 1…20

#### Motion & sync

**`kuramoto`** — Fireflies falling into step (Kuramoto)  
lab keys: `count` 4…120; `freq` 0.2…2; `spread` 0…0.6; `k0` 0…4; `k1` 0…6; `rise` 1…60 s; `layout` ∈ {swarm|ring}; `notes` ∈ {pent|one}

**`shepard`** — Shepard scale: rising forever  
lab keys: `step` 0.12…2 s; `octaves` 3…8; `centre` 40…90; `width` 4…30; `dir` ∈ {up|down}; `look` ∈ {spiral|pole}

**`threebody`** — Three bodies (figure-eight, Burrau 3-4-5)  
lab keys: `kind` ∈ {eight|burrau}; `speed` 0.2…6; `ghost` 0…0.05; `ghostShow` (on/off); `trail` 0.2…8 s; `zoom` 0.2…3

**`dpendulum`** — Double pendulums falling apart (chaos)  
lab keys: `count` 1…30; `angle` 30…179°; `diff` 0…0.02 rad; `speed` 0.2…3; `trail` 0…10 s; `rods` (on/off)

**`brachisto`** — Fastest slide: the brachistochrone race  
lab keys: `kind` ∈ {race|tautochrone}; `slow` 0.05…1.5; `beads` 2…9; `size` 0.5…1.4

#### Numbers

**`primes`** — Prime spirals (Sacks, Ulam)  
lab keys: `kind` ∈ {sacks|ulam}; `max` 100…40000; `rate0` 1…200; `accel` 1…1.6; `all` 0…0.6; `euler` (on/off); `size` 0.3…3

