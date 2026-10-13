/**
 * Sound showcase: 50 ready-to-play presets that show off the Sound tab's sound presets.
 * Each one pairs a sound preset (its scale, instrument, effects, drone …) with a short
 * melody drawn as a curve, a large spectrum analyzer that lights up with the notes, and
 * the sound's name on screen. Vertical 9:16, 24 s, with a hook and YouTube texts.
 *
 * The melody is the sound's own paired shape (sound-registers.js): it is framed for a vertical
 * video and fitted so that its lowest and highest points are the lowest and highest note of
 * the sound's register; the speed and tempo are the ones that suit the sound.
 */
import { SOUND_PRESETS } from './sounds.js';
import { makeSoundPreset } from './sound-maker.js';

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

const BY_NAME = new Map(SOUND_PRESETS.map((x) => [x.name, x]));
function make(i, [soundName]) {
  const sound = BY_NAME.get(soundName);
  if (!sound) throw new Error(`sound-showcase: no sound preset called "${soundName}"`);
  // the sound's own paired shape: framed and fitted to its register (sound-registers.js)
  return makeSoundPreset(soundName, sound.melody.shape, { kind: 'showcase', category: 'Sound · Showcase' });
}

export const SHOWCASE_PRESETS = PICKS.map((p, i) => make(i, p));
