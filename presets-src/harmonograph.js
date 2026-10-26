/**
 * Harmonograph presets (src/circle/harmonograph.js), vertical 9:16: damped pendulums draw, and the
 * ratio between them is the musical interval you hear.
 *
 *   Intervals   the shape of unison, octave, fifth, fourth, thirds, tone
 *   Chords      major, minor, seventh, suspended, power: four pendulums at chord ratios
 *   Scales      the shape of a maqam, a dastgah, a raga and a pentatonic (quarter tones included)
 *   Machines    lateral, four-pendulum, rotary table, epicycles, Lissajous, formulas
 *   Looks       paper, ink, symmetry, several pens
 *   Stories     intervals in four steps; papers and inks
 */
import { Y, S } from './circle-stories.js';
import { PAPERS, tuneToScale } from '../src/circle/harmonograph.js';

const TAGS = 'harmonograph, pendulum, lissajous, music and math, intervals, generative art, satisfying, shorts';

const lookFor = (paper, palette, extra = {}) => {
  const p = PAPERS[paper];
  return { palette, background: p.bg, bloom: p.light ? 0 : 1, glow: p.light ? 0.4 : 1, ...extra };
};

/** One harmonograph preset. `lab` = the machine; `look` = [paper, palette] or an object. */
const H = (name, lab, { paper = 'velvet', palette = 'rainbow', look = {}, sound = {}, duration = 30, bpm = 90, audio = {}, speed, hook, title, desc, text } = {}) => ({
  name, mode: 'circle', transport: { duration, bpm },
  overlay: { layout: 4, name: { enabled: false } },
  visual: { aspect: '9:16' },
  audio: { scale: 'chromatic', root: 0, noteLow: 40, noteHigh: 88, reverb: { decay: 3.6, mix: 0.34 }, delay: { time: 0.375, feedback: 0.22, mix: 0.1 }, ...audio },
  circle: {
    rule: 'harmonograph',
    lab: { harmonograph: { life: Math.round(duration * 0.95), paper, ...lab } },
    look: { trail: 'lines', ...lookFor(paper, palette), ...look },
    sound: { instrument: 'e-piano', pitch: 'angle', volume: 0.8, maxRate: 24, length: 1.6, ...sound },
    ...(speed ? { speed: { from: 1, to: 1, curve: 'linear', pulse: 0, ...speed } } : {}),
    ...(text ? { text } : {}),
  },
  hook: { text: hook },
  youtube: { title: `${title} #shorts`, description: `${desc}\n\nWhich one should I draw next? 👇\n\n#shorts`, tags: TAGS },
});

const IN = (cat, p) => ({ ...p, $category: cat });

/** Two-pendulum interval machine: A against B, with a second, slightly detuned pair so the figure turns. */
const interval = (name, ratio, [n, d], o) => H(name, { kind: 'quad', fa: 2, fb: +(2 * n / d).toFixed(4), fc: 2.006, fd: +((2 * n / d) * 0.997).toFixed(4), pa: 90, pb: 0, pc: 0, pd: 45, aa: 1, ab: 1, ac: 0.55, ad: 0.55, sound: 'strum', every: 0.5, base: 48, ...(o.lab || {}) }, { ...o, hook: o.hook, title: o.title, desc: o.desc });

const RAST = tuneToScale('rast', [1, 3, 5, 8], 2);
const SHUR = tuneToScale('shur', [1, 3, 5, 6], 2);
const BHAIRAV = tuneToScale('bhairav', [1, 2, 5, 8], 2);
const PENTA = tuneToScale('pentatonic', [1, 2, 3, 5], 2);
const HIJAZ = tuneToScale('hijaz', [1, 2, 3, 5], 2);

export const HARMONOGRAPH_PRESETS = [
  /* ---------------------------------------------------------------------- intervals */
  interval('Harmonograph: Unison 1:1', 1, [1, 1], { palette: 'ice', paper: 'midnight', sound: { instrument: 'glass-pad' },
    lab: { kind: 'lateral', fa: 2, fb: 2, pa: 90, pb: 0, sound: 'strum', every: 0.8 },
    hook: 'Two equal pendulums draw a circle', title: 'Unison: two equal pendulums draw a perfect circle ⭕', desc: 'Two pendulums with the same frequency, a quarter swing apart, draw a circle that spirals into the middle as the swing dies. The same note twice: the simplest interval.' }),
  interval('Harmonograph: Octave 2:1', 2, [2, 1], { palette: 'aurora', paper: 'velvet', sound: { instrument: 'harp' }, lab: { pa: 0, pb: 0, pc: 0, pd: 0 },
    hook: 'The octave looks like a figure eight', title: 'An octave (2:1) draws a figure eight ♾️', desc: 'One pendulum swings twice for every swing of the other, and the pen draws a figure eight (a lemniscate-like curve). An octave is the most consonant interval after the unison.' }),
  interval('Harmonograph: Perfect Fifth 3:2', 3, [3, 2], { palette: 'rainbow', paper: 'velvet', frame: 'double', sound: { instrument: 'e-piano' },
    hook: 'What does a perfect fifth look like?', title: 'A perfect fifth (3:2) as a drawing 🎼', desc: 'Three swings against two: the interval behind power chords and the circle of fifths. Two pairs are tuned a hair apart so the figure turns slowly and the notes beat.' }),
  interval('Harmonograph: Perfect Fourth 4:3', 4, [4, 3], { palette: 'sunset', paper: 'ember', sound: { instrument: 'marimba' },
    hook: 'Four swings against three', title: 'A perfect fourth (4:3) drawn by pendulums 🎶', desc: 'The fourth: four swings against three. Slightly detuned partners turn the closed knot into a slowly rotating rosette.' }),
  interval('Harmonograph: Major Third 5:4', 5, [5, 4], { palette: 'gold', paper: 'velvet', frame: 'ornate', sound: { instrument: 'music-box' },
    hook: 'The sweetest interval, drawn', title: 'A major third (5:4): the sweetest shape 🌼', desc: 'Five swings against four: the interval that makes a chord sound major. The more complex the ratio, the more the figure fills the page.' }),
  interval('Harmonograph: Minor Third 6:5', 6, [6, 5], { palette: 'candy', paper: 'midnight', sound: { instrument: 'kalimba' },
    hook: 'Sad chords look like this', title: 'A minor third (6:5) draws a tight net 🕸️', desc: 'Six swings against five: the interval that makes a chord sound minor.' }),
  interval('Harmonograph: Whole Tone 9:8', 9, [9, 8], { palette: 'ocean', paper: 'chalk', duration: 40, sound: { instrument: 'glass-pad' },
    hook: 'Two notes that almost agree', title: 'A whole tone (9:8): the figure that almost closes 🌀', desc: 'Nine swings against eight: so close that the drawing takes a long time to find its way back, and the notes wobble against each other.' }),
  interval('Harmonograph: Tritone 7:5', 7, [7, 5], { palette: 'fire', paper: 'ember', sound: { instrument: 'synth-pluck' },
    hook: 'The devil’s interval, drawn', title: 'The tritone (7:5): the most restless interval 😈', desc: 'Seven swings against five: the tense interval at the middle of the octave. Its figure never settles into a simple shape.' }),

  /* ----------------------------------------------------------------------- chords */
  H('Harmonograph: Major Chord 4:5:6', { kind: 'quad', ...{ fa: 4, fb: 5, fc: 6, fd: 8 }, aa: 1, ab: 1, ac: 0.8, ad: 0.6, pa: 90, pb: 0, pc: 45, pd: 0, sound: 'chord', every: 2.4, base: 48 },
    { palette: 'rosegold', paper: 'velvet', frame: 'double', sound: { instrument: 'harp', length: 2.6 }, hook: 'What does a major chord look like?', title: 'A major chord (4:5:6) drawn by four pendulums 🎹',
      desc: 'The notes of a major chord are in the ratio 4 : 5 : 6 (root, major third, fifth), with the octave on top. Four pendulums at those ratios draw it, and you hear exactly that chord.' }),
  H('Harmonograph: Minor Chord 10:12:15', { kind: 'quad', fa: 5, fb: 6, fc: 7.5, fd: 10, aa: 1, ab: 1, ac: 0.8, ad: 0.6, pa: 90, pb: 0, pc: 45, pd: 0, sound: 'chord', every: 2.4, base: 45 },
    { palette: 'indigo', paper: 'cream', sound: { instrument: 'e-piano', length: 2.6 }, hook: 'And a minor chord?', title: 'A minor chord (10:12:15) as ink on paper 🎻',
      desc: 'Root, minor third and fifth are in the ratio 10 : 12 : 15. The drawing is tighter and darker than the major chord, as the sound is.' }),
  H('Harmonograph: Power Chord 2:3:4', { kind: 'quad', fa: 2, fb: 3, fc: 4, fd: 6, aa: 1, ab: 1, ac: 0.7, ad: 0.5, pa: 90, pb: 0, pc: 0, pd: 90, sound: 'chord', every: 1.6, base: 40 },
    { palette: 'ember', paper: 'ember', ink: 'brush', sound: { instrument: 'deep-organ', length: 1.8 }, hook: 'The chord of rock guitar', title: 'A power chord (2:3:4) drawn by pendulums 🎸',
      desc: 'Root, fifth and octave: 2 : 3 : 4. No third, so it is neither major nor minor, and the drawing is clean and open.' }),
  H('Harmonograph: Dominant Seventh 4:5:6:7', { kind: 'quad', fa: 4, fb: 5, fc: 6, fd: 7, aa: 1, ab: 1, ac: 0.8, ad: 0.8, pa: 90, pb: 0, pc: 45, pd: 20, sound: 'strum', every: 0.45, base: 48 },
    { palette: 'sunset', paper: 'midnight', sound: { instrument: 'harp' }, hook: 'The chord that wants to resolve', title: 'The dominant seventh (4:5:6:7) as a drawing 🌇',
      desc: 'The harmonic seventh (7 : 4) added to a major chord gives the blues-flavoured chord that leans forward. Strummed note by note, so you hear each pendulum.' }),
  H('Harmonograph: Suspended Chord 6:8:9', { kind: 'quad', fa: 6, fb: 8, fc: 9, fd: 12, aa: 1, ab: 1, ac: 0.8, ad: 0.6, pa: 90, pb: 0, pc: 45, pd: 0, sound: 'chord', every: 2.4, base: 43 },
    { palette: 'ice', paper: 'midnight', sound: { instrument: 'glass-pad', length: 3 }, hook: 'A chord that hangs in the air', title: 'A suspended chord (6:8:9) drawn in ice ❄️',
      desc: 'Root, fourth and fifth: 6 : 8 : 9. The fourth takes the place of the third, so the chord is neither happy nor sad, just suspended.' }),
  H('Harmonograph: Chord of Fifths', { kind: 'quad', fa: 2, fb: 3, fc: 4.5, fd: 6.75, aa: 1, ab: 1, ac: 0.8, ad: 0.6, pa: 90, pb: 0, pc: 0, pd: 90, sound: 'strum', arp: 'pingpong', every: 0.4, base: 40 },
    { palette: 'aurora', paper: 'velvet', duration: 36, sound: { instrument: 'marimba' }, hook: 'Fifths stacked on fifths', title: 'Fifths on fifths: 2 · 3 · 4.5 · 6.75 🌌',
      desc: 'Each pendulum is a perfect fifth (3 : 2) above the one before: the stacking behind the circle of fifths. Four of them draw a net that leans like a spiral galaxy.' }),

  /* ------------------------------------------------------------------ scales and maqams */
  H('Harmonograph: The Shape of Maqam Rast', { kind: 'quad', ...RAST, aa: 1, ab: 1, ac: 0.8, ad: 0.6, pa: 90, pb: 0, pc: 45, pd: 0, sound: 'strum', every: 0.5, base: 48, tuning: 'just' },
    { palette: 'gold', paper: 'parchment', ink: 'ink', frame: 'ornate', audio: { scale: 'rast', root: 0 }, sound: { instrument: 'harp' }, hook: 'The shape of a maqam', title: 'Maqam Rast drawn by pendulums: the quarter-tone third ✨',
      desc: 'Pendulums tuned to degrees 1, 3, 5 and 8 of Maqam Rast. Its third sits at 3.5 semitones, a quarter tone between minor and major, and the drawing is neither of the two shapes.' }),
  H('Harmonograph: The Shape of Dastgah Shur', { kind: 'quad', ...SHUR, aa: 1, ab: 1, ac: 0.8, ad: 0.6, pa: 90, pb: 0, pc: 30, pd: 0, sound: 'strum', every: 0.55, base: 45, tuning: 'just' },
    { palette: 'indigo', paper: 'cream', ink: 'ink', frame: 'double', audio: { scale: 'shur', root: 2 }, sound: { instrument: 'kalimba' }, hook: 'A Persian mode, drawn', title: 'Dastgah Shur drawn by pendulums 🌙',
      desc: 'Degrees 1, 3, 5 and 6 of Dastgah Shur with its koron third (a quarter tone flat). The ratio between the pendulums is the ratio between the notes, so the picture is the mode.' }),
  H('Harmonograph: The Shape of Raga Bhairav', { kind: 'quad', ...BHAIRAV, aa: 1, ab: 1, ac: 0.8, ad: 0.6, pa: 90, pb: 0, pc: 45, pd: 20, sound: 'strum', every: 0.6, base: 45, tuning: 'just' },
    { palette: 'sunset', paper: 'ember', audio: { scale: 'bhairav', root: 0 }, sound: { instrument: 'harp' }, hook: 'The raga of the dawn, drawn', title: 'Raga Bhairav as a drawing 🌅',
      desc: 'Degrees 1, 2, 5 and 8 of Raga Bhairav: the flat second gives the dawn raga its yearning, and the drawing a pointed, asymmetric shape.' }),
  H('Harmonograph: Pentatonic Sky', { kind: 'quad', ...PENTA, aa: 1, ab: 1, ac: 0.8, ad: 0.6, pa: 90, pb: 0, pc: 45, pd: 0, sound: 'strum', arp: 'pingpong', every: 0.4, base: 52, tuning: 'just' },
    { palette: 'pastel', paper: 'midnight', sound: { instrument: 'music-box' }, audio: { scale: 'pentatonic', root: 0 }, hook: 'The scale every song shares', title: 'The pentatonic scale drawn in the night sky 🌠',
      desc: 'Degrees 1, 2, 3 and 5 of the major pentatonic scale. Five notes that never clash, so any drawing at those ratios sounds right.' }),
  H('Harmonograph: The Shape of Hijaz', { kind: 'quad', ...HIJAZ, aa: 1, ab: 1, ac: 0.8, ad: 0.6, pa: 90, pb: 0, pc: 45, pd: 0, sound: 'strum', every: 0.5, base: 45, tuning: 'just' },
    { palette: 'ember', paper: 'ember', ink: 'brush', audio: { scale: 'hijaz', root: 2 }, sound: { instrument: 'harp' }, hook: 'The Middle Eastern sound, drawn', title: 'Maqam Hijaz: the augmented second as a shape 🏜️',
      desc: 'Degrees 1, 2, 3 and 5 of Maqam Hijaz. The big jump from the second to the third (an augmented second) stretches the figure into a lopsided star.' }),

  /* ----------------------------------------------------------------------- machines */
  H('Harmonograph: Classic on Velvet', { kind: 'quad', fa: 3, fb: 2, fc: 3.008, fd: 2.004, pa: 90, pb: 0, pc: 0, pd: 45, sound: 'strum', every: 0.5, base: 48 },
    { palette: 'rainbow', paper: 'velvet', frame: 'double', hook: 'Two pendulums, one pen', title: 'A harmonograph draws in neon on velvet 〰️', desc: 'Four swinging pendulums move one pen over the paper. As the swing dies away the line spirals into the middle. Every picture is different.' }),
  H('Harmonograph: Parchment and Ink', { kind: 'quad', fa: 3, fb: 2, fc: 3.01, fd: 2.005, pa: 90, pb: 0, pc: 0, pd: 45, ink: 'ink', colorBy: 'speed', sound: 'strum', every: 0.6, base: 45, width: 1.3 },
    { palette: 'sepia', paper: 'parchment', frame: 'ornate', sound: { instrument: 'harp' }, hook: 'The Victorian drawing machine', title: 'A harmonograph in sepia ink on old parchment 📜', desc: 'In the 1800s, scientists and hobbyists drew these on paper with a pen hung between pendulums. Slow pen strokes are darker, like real ink.' }),
  H('Harmonograph: Indigo on Cream', { kind: 'quad', fa: 2, fb: 3, fc: 2.004, fd: 3.012, pa: 90, pb: 0, pc: 0, pd: 45, ink: 'ink', pens: 3, penGap: 0.22, colorBy: 'pen', sound: 'strum', every: 0.5, base: 48 },
    { palette: 'indigo', paper: 'cream', frame: 'line', sound: { instrument: 'e-piano' }, hook: 'Three pens, one machine', title: 'A harmonograph with three pens 🖋️', desc: 'Three pens follow the same pendulums a moment apart, so the drawing becomes a family of curves. On light paper the ink darkens where lines cross.' }),
  H('Harmonograph: Blueprint', { kind: 'lateral', fa: 5, fb: 4, pa: 0, pb: 0, life: 70, ink: 'fine', dials: true, frame: 'line', sound: 'strum', every: 0.5, base: 50 },
    { palette: 'mono', paper: 'blueprint', duration: 36, sound: { instrument: 'synth-pluck' }, hook: 'Watch the pendulums tire', title: 'A blueprint harmonograph with live dials 📐', desc: 'The dials show each pendulum’s phase and how much swing is left: the ring shrinks as the pendulum tires. 5 swings against 4.' }),
  H('Harmonograph: Rotary Rose', { kind: 'rotary', fa: 3, fb: 2, fc: 3.004, fd: 2.002, table: 0.25, pa: 90, pb: 0, pc: 0, pd: 45, ink: 'neon', sym: 1, sound: 'strum', every: 0.5, base: 48 },
    { palette: 'rosegold', paper: 'velvet', frame: 'double', sound: { instrument: 'harp' }, hook: 'Put the paper on a turntable', title: 'A rotary harmonograph: pendulums on a turning table 🌹', desc: 'The paper turns slowly while the pendulums swing, so the lines wind into a rose.' }),
  H('Harmonograph: Table Spin', { kind: 'rotary', fa: 2, fb: 3, fc: 2.005, fd: 3.01, table: -1, pa: 90, pb: 0, pc: 45, pd: 0, ink: 'fine', sym: 1, sound: 'strum', every: 0.5, base: 48 },
    { palette: 'peacock', paper: 'midnight', sound: { instrument: 'glass-pad' }, hook: 'A turntable makes it a flower', title: 'Spinning the table backwards 🦚', desc: 'The same pendulums, a faster table turning the other way: the loops become petals.' }),
  H('Harmonograph: Epicycle Flower', { kind: 'epicycle', fa: 5, fb: 3, fc: 8, fd: 2, aa: 1, ab: 0.6, ac: 0.4, ad: 0.3, life: 40, pens: 2, penGap: 0.3, ink: 'neon', sound: 'strum', every: 0.6, base: 45 },
    { palette: 'fire', paper: 'ember', hook: 'Circles on circles on circles', title: 'Four turning circles draw a flower 🌺', desc: 'A pen on a wheel on a wheel on a wheel on a wheel. Their speeds are in the ratio 5 : 3 : 8 : 2, and the damping makes the flower close into its centre.' }),
  H('Harmonograph: Epicycle Star', { kind: 'epicycle', fa: 3, fb: 5, fc: 2, fd: 7, aa: 1, ab: 0.7, ac: 0.5, ad: 0.3, life: 50, ink: 'fine', sound: 'strum', every: 0.5, base: 48 },
    { palette: 'ice', paper: 'velvet', frame: 'double', sound: { instrument: 'music-box' }, hook: 'A snowflake from four circles', title: 'Four circles draw a star ❄️', desc: 'Two wheels turn one way, two the other. The speeds 3, 5, 2 and 7 make a star with many points.' }),
  H('Harmonograph: Lissajous 3:2', { kind: 'lissajous', fa: 3, fb: 2, pa: 90, pb: 0, ink: 'neon', sym: 1, sound: 'chord', every: 2, base: 48, duration: 24 },
    { palette: 'aurora', paper: 'chalk', hook: 'A fifth that never fades', title: 'The Lissajous figure of a perfect fifth 🔵', desc: 'No damping, so the pen draws the same closed curve forever: 3 horizontal swings for 2 vertical. The curve is closed because the ratio is a simple fraction.', speed: { from: 1, to: 1 } }),
  H('Harmonograph: Lissajous 5:4 Knot', { kind: 'lissajous', fa: 5, fb: 4, pa: 90, pb: 0, ink: 'fine', width: 1.6, sound: 'chord', every: 2, base: 48, duration: 24 },
    { palette: 'pastel', paper: 'blueprint', frame: 'line', sound: { instrument: 'music-box' }, hook: 'A major third that ties a knot', title: 'Lissajous figure of a major third (5:4) 🪢', desc: 'Five swings against four, no damping: a closed knot with five lobes on one side and four on the other.' }),
  H('Harmonograph: Mandala of Pendulums', { kind: 'rotary', fa: 4, fb: 5, fc: 4.005, fd: 5.01, table: 0.25, ink: 'fine', sym: 6, mirror: true, width: 0.9, sound: 'strum', every: 0.45, base: 48 },
    { palette: 'ice', paper: 'midnight', sound: { instrument: 'glass-pad' }, hook: 'Pendulums draw a mandala', title: 'A mandala drawn by pendulums 🔯', duration: 36, desc: 'One pen, copied six times around the centre and mirrored. The result is a snowflake or a mandala, drawn by nothing but swinging weights.' }),
  H('Harmonograph: Eight-fold Star', { kind: 'quad', fa: 3, fb: 5, fc: 3.01, fd: 4.99, ink: 'neon', sym: 8, mirror: false, width: 1, life: 40, sound: 'strum', every: 0.5, base: 50 },
    { palette: 'gold', paper: 'velvet', frame: 'ornate', sound: { instrument: 'bell', length: 1.2 }, hook: 'Eight copies of one line', title: 'An eight-fold star from one pendulum drawing ⭐', desc: 'Eight copies of the same line around the centre turn a loose scribble into a precise star.' }),
  H('Harmonograph: Rose Gold Brush', { kind: 'quad', fa: 2, fb: 3, fc: 2.006, fd: 3.003, ink: 'brush', width: 1.6, colorBy: 'speed', sound: 'strum', every: 0.55, base: 46 },
    { palette: 'rosegold', paper: 'velvet', frame: 'double', sound: { instrument: 'harp' }, hook: 'Slow strokes are thicker', title: 'A brush harmonograph in rose gold 💗', desc: 'Where the pen moves slowly (at the turns) the brush lays down more ink: the line swells and thins like a calligraphy stroke.' }),
  H('Harmonograph: Aurora Rosette', { kind: 'quad', fa: 4, fb: 3, fc: 4.012, fd: 2.99, ink: 'neon', colorBy: 'angle', sym: 1, sound: 'strum', every: 0.5, base: 48 },
    { palette: 'aurora', paper: 'midnight', hook: 'Colour by direction', title: 'The aurora rosette: colour follows the pen’s direction 🌌', desc: 'The colour of the line depends on which way the pen is moving, so every loop shows the whole spectrum.' }),
  H('Harmonograph: Ember Orbits', { kind: 'quad', fa: 5, fb: 4, fc: 5.007, fd: 4.004, ink: 'brush', colorBy: 'radius', width: 1.2, pens: 2, penGap: 0.5, sound: 'cross', base: 45 },
    { palette: 'fire', paper: 'ember', sound: { instrument: 'marimba' }, hook: 'A note every time the pen crosses', title: 'Ember orbits: a note whenever the pen crosses the middle 🔥', desc: 'Here the sound follows the pen instead of the pendulums: every time it crosses the middle line one of the pendulum tones plays.' }),
  H('Harmonograph: Chalk and Slate', { kind: 'quad', fa: 3, fb: 4, fc: 3.005, fd: 3.995, ink: 'fine', colorBy: 'time', width: 1.4, frame: 'line', sound: 'strum', every: 0.5, base: 48 },
    { palette: 'pastel', paper: 'chalk', sound: { instrument: 'kalimba' }, hook: 'A harmonograph on a blackboard', title: 'Chalk on a blackboard: a harmonograph in pastel ✏️', desc: 'Fine chalk lines build up where the pen passes again and again, like pastel on slate.' }),

  /* ------------------------------------------------------------------------ formulas */
  H('Harmonograph: A Heart Fading Away', { kind: 'formula', fx: 's*sin(a*t)^3', fy: 's*(13*cos(a*t)-5*cos(2*a*t)-2*cos(3*a*t)-cos(4*a*t))/17', fa: 1, fb: 1, fc: 1, fd: 1, rate: 1.1, life: 28, ink: 'neon', pens: 3, penGap: 0.12, sound: 'strum', every: 0.7, base: 48, fit: 'fill' },
    { palette: 'sunset', paper: 'velvet', frame: 'double', sound: { instrument: 'music-box' }, duration: 28, hook: 'A heart drawn by a tiring pen', title: 'A heart that shrinks with every beat 💗', desc: 'The heart curve with the swing dying away: each lap is a little smaller than the one before, so three pens draw a spiral of hearts.' }),
  H('Harmonograph: Damped Rose', { kind: 'formula', fx: 's*cos(a*t)*cos(t)', fy: 's*cos(a*t)*sin(t)', fa: 3.5, fb: 1, fc: 1, fd: 1, rate: 0.9, life: 30, ink: 'neon', pens: 2, penGap: 0.3, sound: 'strum', every: 0.6, base: 50, fit: 'square' },
    { palette: 'rosegold', paper: 'velvet', sound: { instrument: 'harp' }, hook: 'A rose that closes on itself', title: 'A rose curve with damping: petals that shrink 🌹', desc: 'The polar rose r = cos(3.5θ) with the amplitude fading away: every petal is a little shorter than the last.' }),
  H('Harmonograph: Pendulum Spirograph', { kind: 'formula', fx: 's*(cos(a*t)+0.6*cos(b*t)+0.35*sin(c*t))/1.95', fy: 's*(sin(a*t)-0.6*sin(b*t)+0.35*cos(c*t))/1.95', fa: 1, fb: 7, fc: 13, fd: 1, rate: 0.7, life: 36, ink: 'fine', sym: 1, sound: 'strum', every: 0.5, base: 48, fit: 'square' },
    { palette: 'peacock', paper: 'cream', ink: 'ink', frame: 'ornate', hook: 'A spirograph that fades', title: 'A spirograph drawn with a tiring pen 🌀', desc: 'Three turning arms (1, 7 and 13 turns) draw a spirograph, and the damping closes it into its centre.' }),
  H('Harmonograph: Sound of a Square', { kind: 'formula', fx: 's*(sin(a*t)+sin(3*a*t)/3+sin(5*a*t)/5+sin(7*a*t)/7)*0.85', fy: 's*(cos(a*t)+cos(3*a*t)/3+cos(5*a*t)/5+cos(7*a*t)/7)*0.85', fa: 1.5, fb: 1, fc: 1, fd: 1, rate: 1, life: 30, ink: 'neon', pens: 2, penGap: 0.25, sound: 'strum', every: 0.5, base: 43, fit: 'square' },
    { palette: 'ice', paper: 'blueprint', frame: 'line', sound: { instrument: 'flute-synth' }, hook: 'Add odd harmonics, get a square', title: 'Odd harmonics draw a rounded square 🟦', desc: 'Adding the odd harmonics 1, 3, 5 and 7 (with sizes 1, ⅓, ⅕, 1⁄7) turns a circle into a rounded square: the shape of a square wave.' }),

  /* -------------------------------------------------------------------- the machine itself */
  H('Harmonograph: Victorian Machine (3D)', { kind: 'quad', fa: 3, fb: 2, fc: 3.008, fd: 2.004, pa: 90, pb: 0, pc: 0, pd: 45, ink: 'ink', colorBy: 'speed', frame: 'none', size: 0.56, y: -0.5, machine: '3d', machineStyle: 'victorian', machineShow: 'on', sound: 'strum', every: 0.5, base: 48 },
    { palette: 'sepia', paper: 'desk', hook: 'This is how it draws', title: 'A Victorian harmonograph at work: four pendulums, one pen 🕰️', desc: 'The real machine: weights swing on rails, rods carry the motion to a pen, and the line grows on the paper below.' }),
  H('Harmonograph: Blueprint Plan (2D)', { kind: 'quad', fa: 3, fb: 2, fc: 3.008, fd: 2.004, pa: 90, pb: 0, pc: 0, pd: 45, ink: 'fine', frame: 'line', size: 0.56, y: -0.5, machine: 'plan', machineStyle: 'blueprint', machineShow: 'on', sound: 'strum', every: 0.5, base: 48 },
    { palette: 'mono', paper: 'blueprint', sound: { instrument: 'synth-pluck' }, hook: 'The technical drawing', title: 'The harmonograph as a blueprint, seen from above 📐', desc: 'A plan view: two pendulums on each side push the pen, and you can see exactly which one moves it where.' }),
  H('Harmonograph: Neon Machine', { kind: 'quad', fa: 4, fb: 3, fc: 4.01, fd: 2.995, pa: 90, pb: 0, pc: 0, pd: 45, ink: 'neon', size: 0.56, y: -0.5, machine: '3d', machineStyle: 'neon', machineShow: 'on', machineSpin: 6, sound: 'strum', every: 0.5, base: 48 },
    { palette: 'rainbow', paper: 'velvet', hook: 'A machine made of light', title: 'A neon harmonograph that slowly turns 💡', desc: 'The machine in glowing lines, turning slowly while it draws.' }),
  H('Harmonograph: Machine Fades Away', { kind: 'quad', fa: 3, fb: 2, fc: 3.008, fd: 2.004, pa: 90, pb: 0, pc: 0, pd: 45, ink: 'ink', frame: 'ornate', size: 0.56, y: -0.5, machine: '3d', machineStyle: 'victorian', machineShow: 'intro', machineIntro: 8, machineFade: 2.5, machineLayout: 'top', sound: 'strum', every: 0.5, base: 48 },
    { palette: 'sepia', paper: 'parchment', hook: 'Watch it draw, then see only the art', title: 'The machine fades and leaves the drawing ✨', desc: 'For the first seconds you see the machine; then it dissolves and the finished drawing stays.' }),
  H('Harmonograph: Full-frame Turntable', { kind: 'rotary', fa: 4, fb: 5, fc: 4.005, fd: 5.01, table: 0.25, ink: 'ink', machine: '3d', machineStyle: 'victorian', machineLayout: 'full', machineYaw: 20, machinePitch: 46, sound: 'strum', every: 0.45, base: 48 },
    { palette: 'sepia', paper: 'parchment', hook: 'A table that turns while it draws', title: 'A rotary harmonograph: the paper turns under the pen 🎡', desc: 'The turntable and its marks, with the paper turning while the pen is pushed by pendulums.' }),
  H('Harmonograph: Epicycle Arms', { kind: 'epicycle', fa: 5, fb: 3, fc: 8, fd: 2, aa: 1, ab: 0.6, ac: 0.4, ad: 0.3, life: 40, ink: 'fine', size: 0.56, y: -0.5, machine: 'plan', machineStyle: 'blueprint', sound: 'strum', every: 0.6, base: 45 },
    { palette: 'ice', paper: 'blueprint', hook: 'Arms on arms on arms', title: 'The four arms of an epicycle machine, from above 🦾', desc: 'Four arms joined end to end, each turning at its own speed; the last one carries the pen.' }),

  /* ------------------------------------------------------------------------- stories */
  IN('Math · Harmonograph', S('Harmonograph Story: Intervals in 4 Steps',
    Y('harmonograph', { kind: 'lateral', fa: 2, fb: 2, pa: 90, life: 14, paper: 'midnight', sound: 'strum', every: 0.8, base: 48 }, { look: lookFor('midnight', 'ice'), sound: { instrument: 'glass-pad' }, text: 'Unison, 1 : 1: a circle' }),
    [
      Y('harmonograph', { kind: 'quad', fa: 2, fb: 4, fc: 2.006, fd: 3.99, life: 14, paper: 'midnight', sound: 'strum', every: 0.5, base: 48 }, { look: lookFor('midnight', 'aurora'), sound: { instrument: 'harp' }, text: 'Octave, 2 : 1: a figure eight' }),
      Y('harmonograph', { kind: 'quad', fa: 2, fb: 3, fc: 2.006, fd: 2.99, life: 14, paper: 'midnight', sound: 'strum', every: 0.5, base: 48 }, { look: lookFor('midnight', 'rainbow'), sound: { instrument: 'e-piano' }, text: 'Fifth, 3 : 2' }),
      Y('harmonograph', { kind: 'quad', fa: 4, fb: 5, fc: 6, fd: 8, life: 16, paper: 'midnight', sound: 'chord', every: 2, base: 48 }, { look: lookFor('midnight', 'rosegold'), sound: { instrument: 'harp', length: 2.4 }, text: 'All together: a major chord, 4 : 5 : 6' }),
    ],
    { duration: 60, bpm: 90, audio: { scale: 'chromatic', root: 0, reverb: { decay: 3.6, mix: 0.34 } }, hook: 'What does music look like?', title: 'Intervals as drawings: unison, octave, fifth and a chord 🎼', desc: 'Pendulums at musical ratios draw the interval you hear: a circle for the unison, a figure eight for the octave, a net for the fifth and a rosette for a whole chord.' })),
  IN('Math · Harmonograph', S('Harmonograph Story: Papers and Inks',
    Y('harmonograph', { kind: 'quad', fa: 3, fb: 2, fc: 3.008, fd: 2.004, life: 14, paper: 'velvet', frame: 'double', ink: 'neon', sound: 'strum', every: 0.5, base: 48 }, { look: lookFor('velvet', 'rainbow'), sound: { instrument: 'e-piano' }, text: 'Neon on velvet' }),
    [
      Y('harmonograph', { kind: 'quad', fa: 3, fb: 2, fc: 3.008, fd: 2.004, life: 14, paper: 'parchment', frame: 'ornate', ink: 'ink', colorBy: 'speed', sound: 'strum', every: 0.5, base: 48 }, { look: lookFor('parchment', 'sepia'), sound: { instrument: 'harp' }, text: 'Ink on parchment' }),
      Y('harmonograph', { kind: 'quad', fa: 3, fb: 2, fc: 3.008, fd: 2.004, life: 14, paper: 'blueprint', frame: 'line', ink: 'fine', dials: true, sound: 'strum', every: 0.5, base: 48 }, { look: lookFor('blueprint', 'mono'), sound: { instrument: 'synth-pluck' }, text: 'A blueprint with dials' }),
      Y('harmonograph', { kind: 'rotary', fa: 4, fb: 5, fc: 4.005, fd: 5.01, table: 0.25, life: 16, paper: 'midnight', ink: 'fine', sym: 6, mirror: true, width: 0.9, sound: 'strum', every: 0.45, base: 48 }, { look: lookFor('midnight', 'ice'), sound: { instrument: 'glass-pad' }, text: 'Six copies: a mandala' }),
    ],
    { duration: 60, bpm: 90, audio: { scale: 'chromatic', root: 0, reverb: { decay: 3.6, mix: 0.34 } }, hook: 'Same pendulums, four looks', title: 'One harmonograph, four looks: velvet, parchment, blueprint, mandala 🎨', desc: 'The same machine on four kinds of paper with four kinds of ink: neon on velvet, sepia on parchment, fine lines on a blueprint, and a six-fold mandala.' })),
];

