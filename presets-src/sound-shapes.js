/**
 * Sound of a shape, in a mood: 46 presets of the kind of the hand-tuned butterfly. Each draws
 * one shape and plays it in one sound preset's scale, instrument and effects, inside that
 * sound's best register, in colours that match its mood (see sound-maker.js). Vertical 9:16,
 * about 22 s, the formula on screen (long ones wrap), a hook and YouTube texts.
 *
 * [shape, sound preset] pairs: the shape's character meets a scale it suits.
 */
import { makeSoundPreset } from './sound-maker.js';

const PAIRS = [
  ['heart', 'Raga Yaman Evening'], ['heart', 'Dastgah Homayoun Ney'], ['heart', 'Concert Harp'], ['heart', 'Pure Sine'],
  ['butterfly', 'Koto Garden'], ['butterfly', 'Psychedelic Phaser'], ['butterfly', 'Gamelan Pelog'],
  ['infinity', 'Maqam Bayati Ney'], ['infinity', 'Deep Space'], ['infinity', 'Raga Bhupali'],
  ['star', 'Gamelan Slendro'], ['star', 'Synthwave Sunset'], ['star', 'Acid House'],
  ['spiral', 'Raga Malkauns Midnight'], ['spiral', 'Overtone Spiral'], ['spiral', 'Suspense'],
  ['golden', 'Bohlen–Pierce Bells'], ['golden', 'Weightless'], ['golden', 'Shakuhachi Breath'],
  ['flower', 'Kalimba Garden'], ['flower', 'Raga Hindol Spring'], ['flower', 'Mbira Spirit'],
  ['clover', 'Celtic Harp'], ['clover', 'Raga Megh Rain'],
  ['rose52', 'Maqam Saba Lament'], ['rose52', 'Flamenco Night'],
  ['cardioid', 'Maqam Hijaz Desert'], ['cardioid', 'Klezmer Clarinet'],
  ['figure8', 'Lo-fi Study'], ['figure8', 'Tizita Nostalgia'],
  ['pretzel', 'Kora Griot'], ['pretzel', 'Mind Bend'],
  ['gear', 'Arcade 8-bit'], ['gear', 'Trance Anthem'],
  ['crown', 'Epic Trailer'], ['crown', 'Dark Ritual'],
  ['trefoil', 'Third Eye'], ['trefoil', 'Quarter-tone Dream'],
  ['spiro', 'Kaleidoscope'], ['spiro', 'Avaz Dashti Night'],
  ['nephroid', 'Aurora'], ['nephroid', 'Dastgah Shur Santur'],
  ['limacon', 'Rainy Window'], ['limacon', 'Maqam Rast Oud'],
  ['lissajous', 'Dub Techno Echo'], ['lissajous', 'Alien Radio'],
];

export const SOUND_SHAPE_PRESETS = PAIRS.map(([shape, sound]) => makeSoundPreset(sound, shape, { kind: 'series', category: 'Sound · Shapes in moods' }));
