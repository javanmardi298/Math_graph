/**
 * Sound showcase: 50 ready-to-play presets that show off the Sound tab's sound presets.
 * Each one pairs a sound preset (its scale, instrument, effects, drone …) with a short
 * melody drawn as a curve, a large spectrum analyzer that lights up with the notes, and
 * the sound's name on screen. Vertical 9:16, 24 s, with a hook and YouTube texts.
 *
 * The melody is a curve that wanders through the scale: the beat grid turns it into
 * notes, the scale keeps every note beautiful. Contours rotate so neighbours differ;
 * smooth contours for pads and legato sounds, stepping ones for plucked sounds.
 */
import { SOUND_PRESETS } from './sounds.js';
import { SCALE_LABELS } from '../src/math/music.js';
import { INSTRUMENTS } from '../src/audio/instruments.js';

/** [sound preset name, tags] in showcase order (a mix of every group). */
const PICKS = [
  ['Music Box Dream', 'music box, lullaby'], ['Crystal Bells', 'bells, ambient'], ['Kalimba Garden', 'kalimba, relaxing'], ['Concert Harp', 'harp, lydian'],
  ['Lo-fi Study', 'lofi, study music'], ['Rainy Window', 'lofi, rain'], ['Underwater', 'underwater, chill'],
  ['Deep Space', 'space ambient, drone'], ['Aurora', 'ambient, aurora'], ['Weightless', 'overtone, ambient'],
  ['Psychedelic Phaser', 'psychedelic, phaser'], ['Kaleidoscope', 'psychedelic, whole tone'], ['Overtone Spiral', 'overtones, psychedelic'],
  ['Mind Bend', 'microtonal, wendy carlos'], ['Quarter-tone Dream', 'microtonal, quarter tones'], ['Third Eye', 'mystic, drone'],
  ['Synthwave Sunset', 'synthwave, retro'], ['Outrun', 'synthwave, outrun'],
  ['Dub Techno Echo', 'dub techno, echo'], ['Acid House', 'acid house, 303'], ['Trance Anthem', 'trance, supersaw'],
  ['Horror Music Box', 'horror, music box'], ['Desert Mirage', 'desert, hijaz'],
  ['Raga Bhairav at Dawn', 'raga, indian classical'], ['Raga Yaman Evening', 'raga, bansuri'], ['Raga Malkauns Midnight', 'raga, indian classical'],
  ['Raga Hindol Spring', 'raga, indian classical'], ['Raga Megh Rain', 'raga, monsoon'], ['Bollywood Strings', 'bollywood, strings'],
  ['Maqam Hijaz Desert', 'maqam, arabic music'], ['Maqam Bayati Ney', 'maqam, ney'], ['Maqam Saba Lament', 'maqam, arabic music'], ['Maqam Rast Oud', 'maqam, oud'],
  ['Dastgah Shur Santur', 'persian music, santur'], ['Dastgah Homayoun Ney', 'persian music, ney'], ['Avaz Dashti Night', 'persian music, dashti'],
  ['Koto Garden', 'koto, japanese music'], ['Shakuhachi Breath', 'shakuhachi, japanese music'], ['Gamelan Pelog', 'gamelan, pelog'], ['Gamelan Slendro', 'gamelan, slendro'], ['Guzheng River', 'guzheng, chinese music'],
  ['Mbira Spirit', 'mbira, african music'], ['Kora Griot', 'kora, african music'], ['Tizita Nostalgia', 'ethiopian music, tizita'],
  ['Flamenco Night', 'flamenco, spanish guitar'], ['Klezmer Clarinet', 'klezmer, jewish music'], ['Celtic Harp', 'celtic, harp'],
  ['Overtone Series', 'overtones, physics of sound'], ['Bohlen–Pierce Bells', 'bohlen pierce, microtonal'], ['Calm 432', '432 hz, relaxing'],
];

/** Melody contours, each about ±2.2 tall; x runs 0 … 16 over the 24 seconds. */
const SMOOTH = [
  '1.5 * sin(x * 0.7) + 0.7 * sin(x * 1.9 + 0.8)',
  '1.0 * sin(x * 0.4) + 1.2 * sin(x * 1.7 + 1) * cos(x * 0.23)',
  '2.2 * sin(x * 0.5) * cos(x * 1.5)',
  '(0.3 + 0.16 * mod(x, 12)) * sin(x * 1.4)',
  '1.6 * sin(x * 0.8) + 0.6 * sin(x * 2.4)',
];
const STEPPED = [
  '2.2 * sin(floor(x * 2) * 0.9)',
  '-2.2 + 4.4 * mod(x / 3.2, 1)',
  '1.5 * sin(x * 1.1) * cos(x * 0.35) + 0.7 * sin(x * 3.1)',
  'abs(sin(x * 0.6)) * 3.2 - 1.6 + 0.6 * sin(x * 2.2)',
  '1.8 * sin(x * 1.6) * sin(x * 0.5) + 0.4 * cos(x * 5)',
  '2.2 - 4.4 * mod(x / 4, 1)',
];
const COLORS = ['#22e4ff', '#ff3d9a', '#ffd23d', '#8cff5a', '#b18cff', '#ff9d3d', '#3dffd0', '#ff5d5d'];

const WORLD_TAGS = /Raga|Maqam|Dastgah|Avaz|Koto|Shakuhachi|Gamelan|Guzheng|Mbira|Kora|Tizita|Flamenco|Klezmer|Celtic|Bollywood|Desert/;

function make(i, [soundName, tags]) {
  const s = SOUND_PRESETS.find((x) => x.name === soundName);
  if (!s) throw new Error(`sound-showcase: no sound preset called "${soundName}"`);
  const a = s.audio;
  const legato = a.articulation === 'legato';
  const y = (legato ? SMOOTH : STEPPED)[i % (legato ? SMOOTH : STEPPED).length];
  // the melody sits in the middle of the sound's own range; the top third of the frame is
  // left free for the spectrum, so the view is lopsided and the note range is stretched to match
  const centre = Math.round((a.noteLow + a.noteHigh) / 2), span = 75;
  const noteLow = Math.round((centre - 0.458 * span) * 10) / 10;
  const bpm = a.pump?.amount ? 120 : legato ? 84 : 100;
  const label = SCALE_LABELS[a.scale] || a.scale;
  const inst = INSTRUMENTS[s.instrument]?.label || s.instrument;
  const world = WORLD_TAGS.test(soundName);
  const name = `Showcase · ${soundName}`;
  return {
    name, $category: 'Sound · Showcase', mode: '2d',
    transport: { duration: 24, bpm },
    view: { xMin: 0, xMax: 16, yMin: -6.3, yMax: 7.4 },
    layers: [{ name: soundName, type: 'function', exprs: { y }, color: COLORS[i % COLORS.length], colorMode: 'pitch', wave: s.instrument, width: 6, volume: 0.85 }],
    visual: { aspect: '9:16', drawMode: 'trace', analyzer: 'spectrum', bloom: { strength: 1.5 }, marker: { shape: 'circle', size: 30 }, trail: { count: 260 } },
    audio: { ...a, noteLow, noteHigh: Math.round((noteLow + span) * 10) / 10, master: 0.8 },
    rhythm: { enabled: true, division: legato ? '1/4' : '1/8', gate: legato ? 0.95 : 0.8, swing: 0, showGrid: false },
    overlay: {
      layout: 4, name: { enabled: false }, formulas: { enabled: false }, texts: [],
      title: { enabled: true, text: soundName, subtitle: true, subtitleText: `${label} · ${inst}`, x: 0.06, y: 0.045, size: 1.45 },
      analyzer: { x: 0.04, y: 0.17, size: 3 },
    },
    hook: { text: `Listen to ${soundName}` },
    youtube: {
      title: `${soundName} 🎧 listen to this scale #shorts`,
      description: `${soundName}: ${label}, played on ${inst.toLowerCase()}. The curve wanders through the scale and every note you hear lights up the spectrum.\n\nWhich sound should I show next? 👇\n\n#music #scales #sound${world ? ' #worldmusic' : ''} #shorts`,
      tags: `${tags}, music scales, sound design, synth, ${label.toLowerCase()}, spectrum, relaxing music`.slice(0, 480),
    },
  };
}

export const SHOWCASE_PRESETS = PICKS.map((p, i) => make(i, p));
