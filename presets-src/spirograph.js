/**
 * Spirograph and guilloche presets (src/circle/spirograph.js), vertical 9:16.
 *
 *   Classic gear sets   the toy's rings and wheels (96/30, 96/63 …) with the toy on a desk
 *   Outside and cycloids  a wheel round a disk; astroid, deltoid, cardioid, nephroid
 *   The toy as an element  shown, faded away, hidden, moved aside
 *   Looks, special machines  brass, blueprint, neon; compound gears, lobed wheels, golden ratio, formulas
 *   Guilloche           banknote rosette, certificate ribbon, watch dials, rose-engine moiré
 *   Stories             three machines; four guilloche patterns
 */
import { Y, S } from './circle-stories.js';
import { PAPERS } from '../src/circle/harmonograph.js';

const TAGS = 'spirograph, guilloche, satisfying, generative art, geometry, gears, math art, shorts';

const lookFor = (paper, palette, extra = {}) => {
  const p = PAPERS[paper];
  return { palette, background: p.bg, bloom: p.light ? 0 : 1, glow: p.light ? 0.4 : 1, ...extra };
};

const base = (name, rule, lab, { paper = 'desk', palette = 'indigo', look = {}, sound = {}, duration, bpm = 100, audio = {}, hook, title, desc } = {}) => ({
  name, mode: 'circle', transport: { duration, bpm },
  overlay: { layout: 4, name: { enabled: false } },
  visual: { aspect: '9:16' },
  audio: { scale: 'chromatic', root: 0, noteLow: 40, noteHigh: 88, reverb: { decay: 3, mix: 0.3 }, delay: { time: 0.375, feedback: 0.2, mix: 0.1 }, ...audio },
  circle: {
    rule, lab: { [rule]: { paper, ...lab } },
    look: { trail: 'lines', ...lookFor(paper, palette), ...look },
    sound: { instrument: 'kalimba', pitch: 'angle', volume: 0.75, maxRate: 20, length: 0.7, ...sound },
  },
  hook: { text: hook },
  youtube: { title: `${title} #shorts`, description: `${desc}\n\nWhich one should I draw next? 👇\n\n#shorts`, tags: TAGS },
});

/** A spirograph preset; the drawing takes `t` seconds and the video a few more. */
const Sp = (name, lab, o = {}) => base(name, 'spirograph', { drawTime: o.t ?? 22, ...lab }, { ...o, duration: Math.ceil((o.t ?? 22) + 5) });
const Gu = (name, lab, o = {}) => base(name, 'guilloche', { revealTime: o.t ?? 18, ...lab }, { ...o, duration: Math.ceil((o.t ?? 18) + 5) });

const IN = (cat, p) => ({ ...p, $category: cat });

export const SPIRO_PRESETS = [
  /* ------------------------------------------------------------------ classic gear sets */
  Sp('Spirograph: Classic 96 / 30', { kind: 'hypo', R: 96, r: 30, d: 21, ink: 'fine', colorBy: 'time' }, { palette: 'indigo', sound: { instrument: 'kalimba' },
    hook: 'The toy everyone had', title: 'A Spirograph draws: ring 96, wheel 30 🌀', desc: 'A 30-tooth wheel rolls round the inside of a 96-tooth ring and a pen in one of its holes draws. The drawing has 16 petals and closes after 5 turns.' }),
  Sp('Spirograph: 96 / 63 Tight Star', { kind: 'hypo', R: 96, r: 63, d: 44, ink: 'fine', colorBy: 'turn', toyWheel: '#ffe08a', toyRing: '#6b7bff' }, { palette: 'rainbow', sound: { instrument: 'harp' },
    hook: 'A bigger wheel, a tighter star', title: 'Spirograph 96 / 63: a tight star ⭐', desc: 'A 63-tooth wheel in a 96-tooth ring: 32 loops that close after 21 turns of the wheel.', t: 26 }),
  Sp('Spirograph: 105 / 45 Rosette', { kind: 'hypo', R: 105, r: 45, d: 33, ink: 'fine', colorBy: 'time', toyRing: '#ff6b9a', toyWheel: '#8cf0c8' }, { palette: 'peacock', sound: { instrument: 'music-box' },
    hook: 'Seven petals from two gears', title: 'Spirograph 105 / 45: a seven-petal rosette 🌸', desc: '105 and 45 share a factor of 15, so the pattern has 7 petals and closes after 3 turns.' }),
  Sp('Spirograph: 144 / 52 Fine Lace', { kind: 'hypo', R: 144, r: 52, d: 36, ink: 'fine', colorBy: 'radius', width: 0.9 }, { palette: 'ice', sound: { instrument: 'glass-pad' }, t: 30,
    hook: 'Thirteen turns of lace', title: 'Spirograph 144 / 52: fine lace 🕸️', desc: 'Ring 144, wheel 52: 36 petals that only close after 13 turns of the wheel. The more turns, the finer the lace.' }),
  Sp('Spirograph: 84 / 24 Flower', { kind: 'hypo', R: 84, r: 24, d: 18, ink: 'fine', colorBy: 'time', toyRing: '#a98bff', toyWheel: '#ffd27f' }, { palette: 'candy', sound: { instrument: 'marimba' },
    hook: 'Seven loops, two turns', title: 'Spirograph 84 / 24: a seven-petal flower 🌼', desc: 'The gears share 12 teeth, so the flower has 7 petals and closes after 2 turns.' }),
  Sp('Spirograph: Outside Wheel 64 / 22', { kind: 'epi', R: 64, r: 22, d: 16, ink: 'fine', colorBy: 'turn', toyRing: '#a98bff', toyWheel: '#ffd27f', toyPen: '#2060d0' }, { palette: 'rainbow', sound: { instrument: 'harp' },
    hook: 'Now roll the wheel around the outside', title: 'A wheel outside a disk: the epitrochoid 🪐', desc: 'The wheel rolls around the outside of a 64-tooth disk. Loops point outward and the drawing closes after 11 turns.', t: 26 }),

  /* --------------------------------------------------------------------- cycloids */
  Sp('Spirograph: Astroid', { kind: 'hypo', R: 96, r: 24, d: 24, ink: 'neon', colorBy: 'time', toyStyle: 'blueprint', turns: 1, size: 1.1 }, { paper: 'blueprint', palette: 'mono', sound: { instrument: 'glass-pad' }, t: 14,
    hook: 'A star with four points', title: 'The astroid: a wheel one quarter the size 🔆', desc: 'Put the pen on the rim of a wheel a quarter of the ring’s size and the pen draws an astroid: four cusps.' }),
  Sp('Spirograph: Deltoid', { kind: 'hypo', R: 96, r: 32, d: 32, ink: 'neon', colorBy: 'time', toyStyle: 'blueprint', turns: 1, size: 1.1 }, { paper: 'blueprint', palette: 'ice', sound: { instrument: 'glass-pad' }, t: 14,
    hook: 'A triangle with curved sides', title: 'The deltoid: a wheel one third the size 🔺', desc: 'A wheel one third of the ring, pen on the rim: a three-cusped deltoid.' }),
  Sp('Spirograph: Cardioid', { kind: 'epi', R: 40, r: 40, d: 40, ink: 'neon', colorBy: 'time', toyStyle: 'blueprint', turns: 1, size: 0.9 }, { paper: 'blueprint', palette: 'candy', sound: { instrument: 'music-box' }, t: 14,
    hook: 'The heart curve of a rolling circle', title: 'The cardioid: two equal circles, one rolls round the other ❤️', desc: 'A circle rolls round another of the same size and the pen on its rim draws a cardioid, the curve of the heart-shaped microphone.' }),
  Sp('Spirograph: Nephroid', { kind: 'epi', R: 80, r: 40, d: 40, ink: 'neon', colorBy: 'time', toyStyle: 'blueprint', turns: 1, size: 0.85 }, { paper: 'blueprint', palette: 'aurora', sound: { instrument: 'harp' }, t: 14,
    hook: 'The curve of light in a coffee cup', title: 'The nephroid: a wheel half the disk rolls round it ☕', desc: 'The bright curve that sunlight draws inside a coffee cup is a nephroid: a wheel half the size of the disk, rolling round the outside.' }),

  /* ------------------------------------------------------------------ the toy as an element */
  Sp('Spirograph: The Toy Fades Away', { kind: 'hypo', R: 96, r: 42, d: 30, ink: 'fine', colorBy: 'time', toyShow: 'intro', toyIntro: 9, toyFade: 2.5 }, { palette: 'indigo', sound: { instrument: 'kalimba' }, t: 26,
    hook: 'Watch the pen, then only the drawing', title: 'The Spirograph disappears and leaves its drawing ✨', desc: 'The gears fade away after a few seconds and the pen keeps drawing on its own.' }),
  Sp('Spirograph: Only the Pattern', { kind: 'hypo', R: 105, r: 41, d: 30, ink: 'neon', colorBy: 'radius', toyShow: 'off' }, { paper: 'velvet', palette: 'rainbow', sound: { instrument: 'glass-pad' }, t: 30,
    hook: 'No gears, just the line', title: 'A hidden machine: only the pattern 🔮', desc: 'The toy is hidden, so the pen and its glowing line are all you see.' }),
  Sp('Spirograph: Reveal at the End', { kind: 'hypo', R: 96, r: 36, d: 27, ink: 'fine', colorBy: 'turn', toyShow: 'outro', toyFade: 3 }, { palette: 'peacock', sound: { instrument: 'marimba' }, t: 22,
    hook: 'Where did the machine go?', title: 'The gears slip away when the drawing is done 🎞️', desc: 'The machine fades out as the drawing closes, leaving the finished pattern.' }),
  Sp('Spirograph: A Small Machine Aside', { kind: 'hypo', R: 96, r: 30, d: 21, ink: 'fine', colorBy: 'time', size: 0.8, y: 0.15, toyDetach: true, toyScale: 0.42, toyDx: 0, toyDy: -1.0, toyShadow: true }, { palette: 'indigo', sound: { instrument: 'kalimba' },
    hook: 'A toy on its own', title: 'The little machine sits below its drawing 🧸', desc: 'The toy is moved apart and shrunk, like a model of the machine under the picture it draws.' }),

  /* ---------------------------------------------------------------------- looks */
  Sp('Spirograph: Brass on Parchment', { kind: 'hypo', R: 105, r: 45, d: 32, ink: 'ink', colorBy: 'speed', toyStyle: 'brass', frame: 'ornate', width: 1.2 }, { paper: 'parchment', palette: 'sepia', sound: { instrument: 'harp' },
    hook: 'A brass drawing machine', title: 'A brass spirograph on old parchment ⚙️', desc: 'Brass gears, sepia ink and a parchment sheet. Slow strokes are darker, like real ink.' }),
  Sp('Spirograph: Blueprint', { kind: 'hypo', R: 96, r: 28, d: 20, ink: 'fine', colorBy: 'time', toyStyle: 'blueprint', frame: 'line' }, { paper: 'blueprint', palette: 'mono', sound: { instrument: 'synth-pluck' },
    hook: 'The plan of a drawing machine', title: 'A spirograph as a blueprint 📐', desc: 'The gears as outlines on blueprint paper, the pen as a white line.' }),
  Sp('Spirograph: Neon Gears', { kind: 'hypo', R: 120, r: 47, d: 34, ink: 'neon', colorBy: 'time', toyStyle: 'neon', frame: 'double' }, { paper: 'velvet', palette: 'rainbow', sound: { instrument: 'e-piano' },
    hook: 'Gears made of light', title: 'Neon gears draw in rainbow light 🌈', desc: 'Glowing gears on black velvet draw a rainbow line.' }),
  Sp('Spirograph: Ember Brush', { kind: 'hypo', R: 84, r: 37, d: 26, ink: 'brush', colorBy: 'speed', toyStyle: 'brass', width: 1.6 }, { paper: 'ember', palette: 'fire', sound: { instrument: 'marimba' },
    hook: 'Slow strokes are thicker', title: 'A brush spirograph in ember colours 🔥', desc: 'The pen lays down more ink where it moves slowly, at the turns of the curve.' }),
  Sp('Spirograph: Rose Gold', { kind: 'hypo', R: 108, r: 35, d: 25, ink: 'brush', colorBy: 'time', toyStyle: 'brass', frame: 'double', width: 1.4 }, { paper: 'velvet', palette: 'rosegold', sound: { instrument: 'harp' },
    hook: 'Gold on black', title: 'A rose-gold spirograph 💗', desc: 'Brass gears and a rose-gold brush line on black velvet.' }),
  Sp('Spirograph: Chalk on Slate', { kind: 'hypo', R: 96, r: 40, d: 28, ink: 'fine', colorBy: 'angle', toyStyle: 'blueprint', width: 1.3 }, { paper: 'chalk', palette: 'pastel', sound: { instrument: 'kalimba' },
    hook: 'A spirograph on a blackboard', title: 'Chalk spirograph on a blackboard ✏️', desc: 'Pastel lines coloured by the direction of the pen, on a slate.' }),

  /* ----------------------------------------------------------- special machines */
  Sp('Spirograph: Three Pens', { kind: 'hypo', R: 96, r: 40, d: 18, pens: 3, dStep: 8, ink: 'fine', colorBy: 'pen', toyShow: 'on' }, { palette: 'rainbow', sound: { instrument: 'harp' },
    hook: 'Three pens in three holes', title: 'Three pens in one wheel: a family of curves 🖍️', desc: 'The pens sit in three holes at different distances: each draws its own curve and together they weave.' }),
  Sp('Spirograph: Golden Ratio', { kind: 'hypo', R: 100, r: 38.2, d: 27, maxTurns: 70, turns: 70, drawTime: 34, ink: 'neon', colorBy: 'turn', toyShow: 'intro', toyIntro: 6 }, { paper: 'velvet', palette: 'gold', sound: { instrument: 'glass-pad' }, t: 34,
    hook: 'A ratio that never repeats', title: 'The golden ratio never closes: the page just fills ✨', desc: 'Ring and wheel in the golden ratio: the pattern never repeats exactly, so 70 turns fill a whole ring without ever closing.' }),
  Sp('Spirograph: A Gear in a Gear', { kind: 'compound', R: 120, r: 48, d: 20, r2: 19, d2: 9, m: 7, turns: 6, ink: 'fine', colorBy: 'time', toyRing: '#ff6b9a' }, { palette: 'peacock', sound: { instrument: 'kalimba' }, t: 28,
    hook: 'A wheel inside a wheel inside a ring', title: 'Three gears, one pen: shapes the toy cannot draw 🎡', desc: 'A small gear rides inside a bigger gear that rolls inside the ring. The pen is on the smallest one.' }),
  Sp('Spirograph: Compound Rosette', { kind: 'compound', R: 108, r: 40, d: 14, r2: 15, d2: 7, m: -5, turns: 5, ink: 'neon', colorBy: 'radius', toyStyle: 'neon' }, { paper: 'midnight', palette: 'ice', sound: { instrument: 'music-box' }, t: 28,
    hook: 'Spin the small gear the other way', title: 'A compound spirograph with a gear turning backwards 🌌', desc: 'The inner gear orbits the opposite way, and the loops become a rosette of knots.' }),
  Sp('Spirograph: Three-Lobe Wheel', { kind: 'lobed', R: 96, r: 34, d: 22, lobes: 3, lobeAmt: 0.2, ink: 'neon', colorBy: 'time', toyStyle: 'neon' }, { paper: 'velvet', palette: 'aurora', sound: { instrument: 'harp' }, t: 28,
    hook: 'A wheel that is not round', title: 'A three-lobed wheel in a ring: an organic spirograph 🔺', desc: 'A wheel with three lobes rolls in the ring and the pen distance swells and shrinks with it.' }),
  Sp('Spirograph: Breathing Pen', { kind: 'hypo', R: 105, r: 41, d: 33, dFormula: 'd*(0.35 + 0.65*sin(0.075*t)^2)', turns: 41, ink: 'fine', colorBy: 'time', toyShow: 'off' }, { paper: 'midnight', palette: 'ice', sound: { instrument: 'glass-pad' }, t: 34,
    hook: 'A pen that moves in and out', title: 'The pen hole moves while the wheel turns 🫁', desc: 'The pen distance changes over time: d(t) = d·(0.35 + 0.65·sin²(0.075t)).' }),
  Sp('Spirograph: Formula Rings', { kind: 'formula', fx: '(ring-wheel)*cos(t) + d*cos(k*t)*(1 + 0.3*sin(0.5*t))', fy: '(ring-wheel)*sin(t) - d*sin(k*t)*(1 + 0.3*sin(0.5*t))', R: 96, r: 30, d: 22, turns: 10, ink: 'fine', colorBy: 'time' }, { paper: 'cream', palette: 'indigo', sound: { instrument: 'kalimba' }, t: 26,
    hook: 'Edit the formula, change the drawing', title: 'A spirograph written as a formula ✍️', desc: 'The pen follows your own formula x(t), y(t) built from the same numbers: R, r, d and k.' }),
  Sp('Spirograph: Fifth Gears 3 : 2', { kind: 'hypo', R: 96, r: 64, d: 44, sound: 'ratio', ratioEvery: 1.4, base: 48, ink: 'fine', colorBy: 'time', toyRing: '#ff8a3d' }, { palette: 'rainbow', sound: { instrument: 'e-piano', length: 1.4 }, t: 24,
    hook: 'Gears tuned to a perfect fifth', title: 'Gears in the ratio 3 : 2 sound a perfect fifth 🎼', desc: 'Ring 96 and wheel 64 are in the ratio 3 : 2, the frequency ratio of a perfect fifth. The two notes you hear are the ring and the wheel.' }),
  Sp('Spirograph: Petals Play Notes', { kind: 'hypo', R: 96, r: 36, d: 28, sound: 'petal', ink: 'neon', colorBy: 'radius', toyStyle: 'neon' }, { paper: 'velvet', palette: 'aurora', sound: { instrument: 'marimba' }, audio: { scale: 'pentatonic', root: 0, noteLow: 48, noteHigh: 84 }, t: 24,
    hook: 'Every petal is a note', title: 'Each petal plays a note: the shape you can hear 🌺', desc: 'A note on every petal, high at the tips and low where the pen swings in.' }),

  /* ---------------------------------------------------------------------- guilloche */
  Gu('Guilloche: Banknote Rosette', { type: 'rosette', R: 64, r: 24, d: 14, lines: 42, turnStep: 4.5, colors: 'bands', ink1: '#1f5a8a', ink2: '#2a8a6a', ink3: '#8a2a5a', frame: 'none' }, { paper: 'cream', palette: 'indigo', sound: { instrument: 'music-box' },
    hook: 'The pattern that protects banknotes', title: 'A guilloche rosette, one line at a time 💶', desc: 'The fine pattern on a banknote is a hypotrochoid drawn again and again, each turned a little. Blue, green and red inks.' }),
  Gu('Guilloche: Certificate Border', { type: 'ribbon', strands: 26, waves: 8, bandAmp: 0.045, corners: true, centre: true, R: 64, r: 24, d: 14, ink1: '#2a5a3a', ink2: '#7a2a3a', ink3: '#c08a20', frame: 'none' }, { paper: 'parchment', palette: 'sepia', t: 22, sound: { instrument: 'harp' },
    hook: 'The border of an old certificate', title: 'An engraved border: 26 interwoven strands 📜', desc: 'Wave bands run along the edges and rosettes sit in the corners and centre, the layout of a certificate.' }),
  Gu('Guilloche: Silver Dial', { type: 'dial', rings: 90, lobes: 12, amp: 0.012, ampGrow: 0.4, phaseStep: 0.18, rays: 120, furniture: 'hands', colors: 'bands', ink1: '#c9d6e8', ink2: '#9fb4ff', ink3: '#ffffff', width: 0.8 }, { paper: 'velvet', palette: 'mono', sound: { instrument: 'glass-pad' },
    hook: 'How a watch dial is engraved', title: 'An engine-turned watch dial in silver ⌚', desc: 'Ninety rings with twelve waves each, every ring shifted a little: light moves across them as across a real dial.' }),
  Gu('Guilloche: Golden Dial', { type: 'dial', rings: 110, lobes: 16, amp: 0.011, ampGrow: 0.6, phaseStep: 0.12, rays: 160, furniture: 'ticks', colors: 'palette', hue0: 0.1, hueSpan: 0.12, width: 0.8 }, { paper: 'ember', palette: 'gold', sound: { instrument: 'music-box' },
    hook: 'A dial in gold and ember', title: 'A golden engine-turned dial ✨', desc: 'Same technique, warmer light: 110 rings, 16 waves, a sunburst of rays.' }),
  Gu('Guilloche: Rose Engine', { type: 'lathe', rings: 140, lobes: 9, amp: 0.027, ampGrow: 0.6, innerR: 0.07, phaseStep: 0.11, colors: 'palette', hue0: 0.12, hueSpan: 0.15, width: 0.8 }, { paper: 'ember', palette: 'gold', sound: { instrument: 'harp' },
    hook: 'A moiré made of rings', title: 'Rose-engine moiré: 140 rings and 9 lobes 🌀', desc: 'Rings with nine lobes, each shifted a little from the one before, make a spiral moiré that seems to move.' }),
  Gu('Guilloche: Aurora Rosette', { type: 'rosette', R: 84, r: 28, d: 17, lines: 56, turnStep: 3, colors: 'palette', hueSpan: 1, width: 0.8 }, { paper: 'midnight', palette: 'aurora', sound: { instrument: 'glass-pad' },
    hook: 'A rosette in aurora colours', title: 'An aurora rosette: 56 turned lines 🌌', desc: 'The same engraving trick, in light on a night sky.' }),
  Gu('Guilloche: Blueprint Rosette', { type: 'rosette', R: 80, r: 30, d: 17, lines: 48, turnStep: 3.75, colors: 'mono', ink1: '#e8f2ff', width: 0.8, frame: 'line' }, { paper: 'blueprint', palette: 'mono', sound: { instrument: 'synth-pluck' },
    hook: 'The plan of an engraved rosette', title: 'A guilloche rosette on blueprint paper 📐', desc: 'White lines on blueprint paper: each is the same curve turned 3.75 degrees.' }),
  Gu('Guilloche: Formula Rings', { type: 'formula', fR: '0.28 + 0.62*u + 0.05*sin(7*a + k*0.2) + 0.03*sin(13*a - k*0.1)', rings: 110, colors: 'palette', hueSpan: 0.6, hue0: 0.55, width: 0.8 }, { paper: 'velvet', palette: 'ice', sound: { instrument: 'harp' },
    hook: 'Write the rings yourself', title: 'Rings from a formula: you decide the waves ✍️', desc: 'Each ring is r(a, k) = 0.28 + 0.62u + two waves whose phase shifts from ring to ring.' }),
  Gu('Guilloche: Peacock Rosette', { type: 'rosette', R: 90, r: 36, d: 22, lines: 50, turnStep: 3.6, colors: 'bands', ink1: '#1fb6ff', ink2: '#16a085', ink3: '#7b5cff', width: 0.85 }, { paper: 'velvet', palette: 'peacock', sound: { instrument: 'harp' },
    hook: 'Three inks in one rosette', title: 'A peacock-coloured guilloche rosette 🦚', desc: 'Three inks in bands, fifty lines, one rosette.' }),
  Gu('Guilloche: Ribbon on Midnight', { type: 'ribbon', strands: 22, waves: 10, bandAmp: 0.05, corners: true, centre: false, colors: 'palette', hueSpan: 1.2, width: 0.8 }, { paper: 'midnight', palette: 'rainbow', sound: { instrument: 'music-box' },
    hook: 'A ribbon of light', title: 'A guilloche ribbon frame in rainbow colours 🎀', desc: 'Interwoven wave bands frame the screen with corner rosettes.' }),

  /* ----------------------------------------------------------------------- stories */
  IN('Math · Spirograph', S('Spirograph Story: Inside, Outside, Gear in Gear',
    Y('spirograph', { kind: 'hypo', R: 96, r: 30, d: 21, drawTime: 16, ink: 'fine', colorBy: 'time', paper: 'desk' }, { look: lookFor('desk', 'indigo'), sound: { instrument: 'kalimba' }, text: 'A wheel inside a ring' }),
    [
      Y('spirograph', { kind: 'epi', R: 64, r: 22, d: 16, drawTime: 16, ink: 'fine', colorBy: 'turn', paper: 'desk', toyRing: '#a98bff', toyWheel: '#ffd27f' }, { look: lookFor('desk', 'rainbow'), sound: { instrument: 'harp' }, text: '…outside a disk' }),
      Y('spirograph', { kind: 'compound', R: 120, r: 48, d: 20, r2: 19, d2: 9, m: 7, turns: 6, drawTime: 18, ink: 'fine', colorBy: 'time', paper: 'desk', toyRing: '#ff6b9a' }, { look: lookFor('desk', 'peacock'), sound: { instrument: 'marimba' }, text: '…and a gear in a gear' }),
    ],
    { duration: 60, bpm: 100, hook: 'Three ways to roll a wheel', title: 'Three spirographs: inside, outside, and a gear in a gear 🎡', desc: 'A wheel inside a ring, a wheel around a disk, and three gears with the pen on the smallest.' })),
  IN('Math · Spirograph', S('Guilloche Story: Banknote, Dial, Ribbon, Rose Engine',
    Y('guilloche', { type: 'rosette', R: 64, r: 24, d: 14, lines: 42, revealTime: 12, colors: 'bands', ink1: '#1f5a8a', ink2: '#2a8a6a', ink3: '#8a2a5a', paper: 'cream' }, { look: lookFor('cream', 'indigo'), sound: { instrument: 'music-box' }, text: 'A banknote rosette' }),
    [
      Y('guilloche', { type: 'dial', rings: 90, lobes: 12, revealTime: 12, rays: 120, furniture: 'hands', colors: 'bands', ink1: '#c9d6e8', ink2: '#9fb4ff', ink3: '#ffffff', paper: 'velvet', width: 0.8 }, { look: lookFor('velvet', 'mono'), sound: { instrument: 'glass-pad' }, text: 'A watch dial' }),
      Y('guilloche', { type: 'ribbon', strands: 26, waves: 8, revealTime: 14, corners: true, centre: true, R: 64, r: 24, d: 14, ink1: '#2a5a3a', ink2: '#7a2a3a', ink3: '#c08a20', paper: 'parchment' }, { look: lookFor('parchment', 'sepia'), sound: { instrument: 'harp' }, text: 'A certificate border' }),
      Y('guilloche', { type: 'lathe', rings: 140, lobes: 9, amp: 0.027, ampGrow: 0.6, innerR: 0.07, phaseStep: 0.11, revealTime: 12, colors: 'palette', hue0: 0.12, hueSpan: 0.15, paper: 'ember', width: 0.8 }, { look: lookFor('ember', 'gold'), sound: { instrument: 'harp' }, text: 'A rose-engine moiré' }),
    ],
    { duration: 70, bpm: 100, hook: 'Four patterns made of lines', title: 'Guilloche: banknote, watch dial, certificate and rose engine 🔏', desc: 'The engraver’s patterns, line by line: a rosette, an engine-turned dial, an interwoven border and a rose-engine moiré.' })),
];
