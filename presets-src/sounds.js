/**
 * Sound presets: ready-made sound settings for the Sound tab (scale, key, tuning,
 * instrument, filter, drive, lo-fi, modulation, movement, pump, drone, delay, reverb).
 * A sound preset changes only the sound, never the drawing, so any curve or Circle
 * Lab scene can be tried with any of them. Built into presets/sounds.json.
 *
 * Each entry: S(group, name, about, instrument, options). Options are short names:
 *   scale, root, lo/hi (note range), glide, art ('pluck' | 'legato'), tuning,
 *   filter: F(type, cutoff, q, wah, wahRate), drive, crush, mod: M(type, rate, depth, mix),
 *   motion: V(tremolo, rate, autopan, panRate), pump: [amount, beats], drone: D(volume, octave, fifth, bright),
 *   delay: E(time, feedback, mix, pingpong), reverb: R(decay, mix, tone, preDelay)
 */
const F = (type, cutoff, q = 0.8, lfo = 0, lfoRate = 0.5) => ({ type, cutoff, q, lfo, lfoRate });
const M = (type, rate, depth, mix) => ({ type, rate, depth, mix });
const V = (tremolo, tremoloRate = 5, autopan = 0, panRate = 0.25) => ({ tremolo, tremoloRate, autopan, panRate });
const D = (volume, octave = 2, fifth = true, bright = 0.4) => ({ volume, octave, fifth, bright });
const E = (time, feedback, mix, pingpong = false) => ({ time, feedback, mix, pingpong });
const R = (decay, mix, tone = 1, preDelay = 0) => ({ decay, mix, tone, preDelay });

const LIST = [];
function S(group, name, about, instrument, o = {}) {
  const pluck = (o.art || 'pluck') === 'pluck';
  const audio = {
    scale: o.scale || 'major', root: o.root ?? 0, noteLow: o.lo ?? 48, noteHigh: o.hi ?? 86,
    glide: o.glide ?? (pluck ? 12 : 60), articulation: o.art || 'pluck', tuning: o.tuning || 440,
    filter: o.filter || F('lowpass', 12000), distortion: o.drive || 0, crush: o.crush || 0,
    mod: o.mod || M('off', 0.6, 0.5, 0.5), motion: o.motion || V(0), pump: o.pump ? { amount: o.pump[0], rate: o.pump[1] ?? 1 } : { amount: 0, rate: 1 },
    drone: o.drone || D(0), delay: o.delay || E(0.3, 0.25, 0.1), reverb: o.reverb || R(2, 0.25),
  };
  LIST.push({ name, group, about, instrument, audio });
}

/* ------------------------------------------------------- clean & classic */
const G1 = 'Clean & classic';
S(G1, 'Pure Sine', 'The cleanest tone: hear the curve itself.', 'sine', { art: 'legato', glide: 40, reverb: R(1.6, 0.2) });
S(G1, 'Music Box Dream', 'Tiny tines, soft echo.', 'music-box', { lo: 60, hi: 96, reverb: R(2.5, 0.3, 0.8), delay: E(0.375, 0.25, 0.12) });
S(G1, 'Crystal Bells', 'Shimmering FM bells bouncing left and right.', 'bell', { scale: 'pentatonic', lo: 60, hi: 96, reverb: R(3.5, 0.35, 0.9), delay: E(0.5, 0.3, 0.15, true) });
S(G1, 'Kalimba Garden', 'Thumb piano in a sunny garden.', 'kalimba', { scale: 'pentatonic', reverb: R(2, 0.25), delay: E(0.3, 0.2, 0.12) });
S(G1, 'Wooden Marimba', 'Warm wood, short room.', 'marimba', { reverb: R(1.2, 0.15, 0.6) });
S(G1, 'Concert Harp', 'Lydian harp, the “magic” sound.', 'harp', { scale: 'lydian', reverb: R(3, 0.3, 0.7) });
S(G1, 'Lounge E-Piano', 'Electric piano with a soft chorus.', 'e-piano', { scale: 'dorian', mod: M('chorus', 0.5, 0.5, 0.4), reverb: R(2, 0.25, 0.6) });
S(G1, 'House Piano', 'Bright piano, small room.', 'house-piano', { reverb: R(1.5, 0.2) });
S(G1, 'Soft Flute', 'Breathy flute with a gentle vibrato.', 'flute-synth', { art: 'legato', glide: 80, motion: V(0.15, 5), reverb: R(2.5, 0.3, 0.7) });
S(G1, 'Glass Harmonica', 'Whole-tone glass, dreamy.', 'glass-pad', { scale: 'wholeTone', art: 'legato', glide: 120, reverb: R(4, 0.4, 0.9) });
S(G1, 'Choir of Circles', 'Voices in a big hall.', 'choir', { art: 'legato', reverb: R(5, 0.45, 0.5, 0.03) });
S(G1, 'Chapel Organ', 'Dorian organ in a stone chapel.', 'deep-organ', { scale: 'dorian', art: 'legato', reverb: R(6, 0.5, 0.4, 0.05) });

/* --------------------------------------------------------------- lo-fi */
const G2 = 'Lo-fi & chill';
S(G2, 'Lo-fi Study', 'Dusty keys, wobbly tape, warm room.', 'e-piano', { scale: 'dorian', crush: 0.35, filter: F('lowpass', 2500), mod: M('chorus', 0.4, 0.6, 0.4), motion: V(0.1, 4), reverb: R(1.8, 0.25, 0.3) });
S(G2, 'Cassette Tape', 'Old tape: wow, flutter and hiss-less grit.', 'e-piano', { scale: 'minor', crush: 0.25, filter: F('lowpass', 3000), mod: M('chorus', 0.3, 0.9, 0.5), reverb: R(1.5, 0.2, 0.4) });
S(G2, 'Rainy Window', 'Kalimba drops behind glass.', 'kalimba', { scale: 'minorPentatonic', filter: F('lowpass', 2800), delay: E(0.45, 0.3, 0.2), reverb: R(3, 0.35, 0.3) });
S(G2, 'Late Night Keys', 'Soft piano after midnight.', 'house-piano', { scale: 'dorian', filter: F('lowpass', 3500), reverb: R(2.5, 0.3, 0.4) });
S(G2, 'Vinyl Jazz', 'Bebop notes through an old record.', 'e-piano', { scale: 'bebopDominant', crush: 0.2, filter: F('lowpass', 3200), reverb: R(1.4, 0.2, 0.5) });
S(G2, 'Bedroom Pop', 'Plucks with chorus and ping-pong echo.', 'synth-pluck', { mod: M('chorus', 0.6, 0.5, 0.4), delay: E(0.33, 0.3, 0.2, true), reverb: R(2, 0.25, 0.6) });
S(G2, 'Chillhop Bells', 'Bells, a little crushed.', 'bell', { scale: 'pentatonic', crush: 0.2, filter: F('lowpass', 3000), reverb: R(2, 0.25, 0.5) });
S(G2, 'Sunday Morning', 'Mixolydian harp, warm and lazy.', 'harp', { scale: 'mixolydian', reverb: R(2.2, 0.25, 0.5) });
S(G2, 'Coffee Shop', 'Marimba in a small café.', 'marimba', { filter: F('lowpass', 4000), reverb: R(1, 0.15, 0.5) });
S(G2, 'Dreamy Lo-fi Pad', 'Hazy pad, slow and wide.', 'warm-pad', { scale: 'lydian', art: 'legato', crush: 0.3, mod: M('chorus', 0.25, 0.8, 0.5), reverb: R(4, 0.4, 0.4) });
S(G2, 'Underwater', 'Muffled and swirling, like hearing under water.', 'sine', { scale: 'minorPentatonic', filter: F('lowpass', 700, 4, 0.3, 0.2), mod: M('phaser', 0.15, 0.8, 0.5), reverb: R(4, 0.4, 0.1) });
S(G2, 'Sleepy Synth', 'Soft flute with a slow wobble.', 'flute-synth', { scale: 'pentatonic', motion: V(0.25, 3), filter: F('lowpass', 2500), reverb: R(3, 0.35, 0.4) });

/* ------------------------------------------------------- ambient & space */
const G3 = 'Ambient & space';
S(G3, 'Deep Space', 'Huge dark reverb, echoes and a low drone.', 'warm-pad', { scale: 'lydian', art: 'legato', glide: 200, drone: D(0.3, 1), delay: E(0.9, 0.5, 0.2, true), reverb: R(8, 0.6, 0.3, 0.08) });
S(G3, 'Nebula', 'Glass pad swirling through a phaser.', 'glass-pad', { scale: 'wholeTone', art: 'legato', mod: M('phaser', 0.1, 0.8, 0.6), reverb: R(7, 0.55, 0.6) });
S(G3, 'Starfield', 'High bells echoing across the sky.', 'bell', { scale: 'pentatonic', lo: 64, hi: 100, delay: E(0.6, 0.55, 0.3, true), reverb: R(6, 0.45, 0.9) });
S(G3, 'Aurora', 'Supersaw with a slowly breathing filter.', 'supersaw', { scale: 'lydian', art: 'legato', filter: F('lowpass', 2000, 2, 0.4, 0.1), mod: M('chorus', 0.3, 0.6, 0.4), reverb: R(6, 0.5, 0.5) });
S(G3, 'Ocean Drift', 'Waves moving from ear to ear.', 'warm-pad', { art: 'legato', motion: V(0, 5, 0.6, 0.1), reverb: R(5, 0.45, 0.5) });
S(G3, 'Cathedral of Light', 'A choir with a long, bright tail.', 'choir', { art: 'legato', reverb: R(8, 0.6, 0.6, 0.1) });
S(G3, 'Weightless', 'Overtones floating in slow motion.', 'sine', { scale: 'overtones', art: 'legato', glide: 300, delay: E(0.7, 0.4, 0.2, true), reverb: R(7, 0.5, 0.4) });
S(G3, 'Northern Lights', 'Lydian augmented shimmer.', 'glass-pad', { scale: 'lydianAugmented', art: 'legato', reverb: R(6, 0.5, 0.8), mod: M('chorus', 0.2, 0.5, 0.4) });
S(G3, 'Moon Base', 'Echoing space arpeggio.', 'space-arp', { scale: 'minor', delay: E(0.375, 0.5, 0.3, true), reverb: R(4, 0.4, 0.6) });
S(G3, 'Satellite Signal', 'Crushed beeps bouncing in space.', 'sine', { scale: 'chromatic', crush: 0.4, delay: E(0.25, 0.6, 0.3, true), reverb: R(5, 0.4, 0.7) });
S(G3, 'Ice Cave', 'Hirajoshi kalimba in a frozen cave.', 'kalimba', { scale: 'hirajoshi', delay: E(0.5, 0.4, 0.2), reverb: R(5, 0.5, 1) });
S(G3, 'Calm 432', 'Pentatonic at A = 432 Hz with a soft drone.', 'sine', { scale: 'pentatonic', tuning: 432, art: 'legato', glide: 120, drone: D(0.25), reverb: R(5, 0.4, 0.5) });

/* --------------------------------------------------------- psychedelic */
const G4 = 'Psychedelic & trippy';
S(G4, 'Psychedelic Phaser', 'Phrygian-dominant lead through a deep phaser.', 'psy-lead', { scale: 'phrygianDominant', art: 'legato', glide: 40, mod: M('phaser', 0.3, 0.9, 0.7), delay: E(0.375, 0.4, 0.25, true), reverb: R(3, 0.3, 0.6) });
S(G4, 'Kaleidoscope', 'Whole-tone arps, flanger and auto-pan.', 'space-arp', { scale: 'wholeTone', mod: M('flanger', 0.2, 0.8, 0.6), motion: V(0, 5, 0.5, 0.5), reverb: R(3, 0.35) });
S(G4, 'Acid Trip', 'A squelchy 303 with a swinging filter.', 'acid-303', { scale: 'phrygian', lo: 36, hi: 72, filter: F('lowpass', 900, 12, 0.7, 0.25), drive: 0.4, delay: E(0.375, 0.45, 0.25) });
S(G4, 'Melting Clocks', 'Slow glides through a flanger.', 'sine', { scale: 'continuous', art: 'legato', glide: 300, mod: M('flanger', 0.1, 0.9, 0.7), motion: V(0.3, 2), reverb: R(4, 0.4) });
S(G4, 'Overtone Spiral', 'Nature’s own scale over a drone.', 'sine', { scale: 'overtones', art: 'legato', glide: 80, drone: D(0.3, 1), mod: M('phaser', 0.2, 0.7, 0.5), reverb: R(6, 0.5, 0.6) });
S(G4, 'Alien Radio', 'Bohlen–Pierce notes, crushed and filtered.', 'square', { scale: 'bohlenPierce', crush: 0.4, filter: F('lowpass', 2200, 6, 0.5, 3), delay: E(0.3, 0.5, 0.25, true), reverb: R(3, 0.3) });
S(G4, 'Mind Bend', 'Wendy Carlos alpha scale, no octaves at all.', 'vibrato-lead', { scale: 'carlosAlpha', art: 'legato', glide: 60, mod: M('chorus', 0.4, 1, 0.7), reverb: R(4, 0.4) });
S(G4, 'Quarter-tone Dream', '24 notes per octave, swirling.', 'glass-pad', { scale: 'quarterTones', art: 'legato', glide: 50, mod: M('phaser', 0.25, 0.7, 0.5), reverb: R(5, 0.45) });
S(G4, 'Tie-Dye', 'Bright supersaw spinning around your head.', 'supersaw', { scale: 'lydianDominant', mod: M('phaser', 0.5, 0.8, 0.6), motion: V(0, 5, 0.6, 0.3), reverb: R(3, 0.35) });
S(G4, 'Mushroom Forest', 'Eerie Iwato kalimba with flanged echoes.', 'kalimba', { scale: 'iwato', mod: M('flanger', 0.15, 0.6, 0.4), delay: E(0.33, 0.6, 0.3, true), reverb: R(4, 0.4, 0.5) });
S(G4, 'Psytrance Roller', 'Rolling psy bass pumping on the beat.', 'psy-bass', { scale: 'phrygian', lo: 28, hi: 52, pump: [0.5, 1], filter: F('lowpass', 1800, 3, 0.3, 0.125), delay: E(0.25, 0.3, 0.1) });
S(G4, 'Hypnotic Loop', 'Messiaen’s mode 3 in endless echoes.', 'synth-pluck', { scale: 'messiaen3', delay: E(0.25, 0.6, 0.35, true), reverb: R(3, 0.3) });
S(G4, 'Liquid Mirror', '19 notes per octave, chorused glass.', 'glass-pad', { scale: 'edo19', art: 'legato', mod: M('chorus', 0.5, 0.8, 0.6), reverb: R(5, 0.45) });
S(G4, 'Third Eye', 'Scriabin’s mystic chord over a dark drone.', 'drone', { scale: 'prometheus', art: 'legato', drone: D(0.5, 1, true, 0.2), mod: M('phaser', 0.08, 0.9, 0.6), reverb: R(8, 0.55, 0.2) });

/* ------------------------------------------------------ synthwave & retro */
const G5 = 'Synthwave & retro';
S(G5, 'Synthwave Sunset', 'Wide supersaw, chorus and echo.', 'supersaw', { scale: 'minor', art: 'legato', mod: M('chorus', 0.4, 0.6, 0.5), delay: E(0.375, 0.35, 0.2, true), reverb: R(3, 0.35) });
S(G5, 'Outrun', 'Harmonic-minor lead with ping-pong.', 'vibrato-lead', { scale: 'harmonicMinor', art: 'legato', glide: 40, delay: E(0.375, 0.4, 0.25, true), reverb: R(2.5, 0.3) });
S(G5, 'Arcade 8-bit', 'Classic arcade beeps.', 'chiptune', { crush: 0.5, reverb: R(0.6, 0.05) });
S(G5, 'Game Boy Hero', 'Handheld-console adventure.', 'chiptune', { scale: 'mixolydian', crush: 0.6, delay: E(0.15, 0.2, 0.1) });
S(G5, 'Retro Bass Line', 'FM bass, pumping a little.', 'fm-bass', { scale: 'minorPentatonic', lo: 28, hi: 55, pump: [0.3, 1], reverb: R(1, 0.1) });
S(G5, 'VHS Memories', 'Warbly pad from an old tape.', 'warm-pad', { scale: 'dorian', art: 'legato', crush: 0.3, mod: M('chorus', 0.3, 0.9, 0.6), reverb: R(3, 0.35, 0.4) });
S(G5, 'Neon Drive', 'Plucks pumping through the night.', 'synth-pluck', { scale: 'minor', pump: [0.4, 1], delay: E(0.375, 0.35, 0.2, true), reverb: R(2, 0.25) });
S(G5, '80s Movie Theme', 'Big minor supersaw, big room.', 'supersaw', { scale: 'minor', art: 'legato', reverb: R(4, 0.4, 0.7) });
S(G5, 'Space Invaders', 'Crushed chromatic blips.', 'square', { scale: 'chromatic', crush: 0.7, filter: F('highpass', 300), reverb: R(0.5, 0.05) });
S(G5, 'Vaporwave Mall', 'Slowed (A = 415 Hz), chorused, dreamy.', 'e-piano', { scale: 'lydian', tuning: 415, mod: M('chorus', 0.3, 0.8, 0.5), filter: F('lowpass', 3500), reverb: R(4, 0.4, 0.3) });
S(G5, 'Cyber City', 'Phrygian stabs and a sweeping filter.', 'techno-stab', { scale: 'phrygian', filter: F('lowpass', 2500, 4, 0.5, 0.2), delay: E(0.375, 0.4, 0.2, true), reverb: R(2, 0.25) });
S(G5, 'Chiptune Blues', '8-bit blues.', 'chiptune', { scale: 'blues', crush: 0.45, delay: E(0.2, 0.2, 0.1) });

/* ---------------------------------------------------------------- EDM */
const G6 = 'EDM & dance';
S(G6, 'Deep House Night', 'Organ pumping on every beat.', 'deep-organ', { scale: 'minor', pump: [0.5, 1], filter: F('lowpass', 3000), reverb: R(2, 0.25) });
S(G6, 'House Stab Party', 'Dorian chord stabs, pumping hard.', 'house-stab', { scale: 'dorian', pump: [0.6, 1], reverb: R(1.5, 0.2) });
S(G6, 'Garage Shuffle', 'Garage chords pumping every half beat.', 'garage-chord', { scale: 'minor', pump: [0.4, 0.5], reverb: R(1.8, 0.2) });
S(G6, 'Techno Tunnel', 'Stabs echoing in a dark tunnel.', 'techno-stab', { scale: 'phrygian', delay: E(0.375, 0.5, 0.3), filter: F('lowpass', 3000, 3, 0.5, 0.125), reverb: R(3, 0.3, 0.4) });
S(G6, 'Dub Techno Echo', 'Chords dissolving into dark echoes.', 'dub-chord', { scale: 'minor', delay: E(0.375, 0.7, 0.45, true), filter: F('lowpass', 1500, 2, 0.4, 0.1), reverb: R(4, 0.4, 0.2) });
S(G6, 'Reese Drop', 'Thick detuned bass, driven.', 'reese', { scale: 'minor', lo: 28, hi: 50, drive: 0.4, pump: [0.5, 1] });
S(G6, 'Wobble Bass', 'The wub-wub: a fast filter on a big bass.', 'wobble', { scale: 'minor', lo: 30, hi: 55, filter: F('lowpass', 1200, 8, 0.9, 2), drive: 0.3 });
S(G6, 'Trance Anthem', 'Supersaw, pump and wide echoes.', 'supersaw', { scale: 'minor', art: 'legato', pump: [0.55, 1], delay: E(0.375, 0.35, 0.2, true), reverb: R(3.5, 0.35) });
S(G6, 'Acid House', 'Resonant 303, filter on the move.', 'acid-303', { scale: 'minorPentatonic', lo: 36, hi: 70, filter: F('lowpass', 1100, 10, 0.6, 0.25), drive: 0.2 });
S(G6, 'Future Bass Chords', 'Lush chords that breathe with the beat.', 'garage-chord', { pump: [0.7, 1], mod: M('chorus', 0.5, 0.5, 0.4), reverb: R(2.5, 0.3) });
S(G6, 'Squelch Party', 'Rubber FM squelches.', 'squelch-fm', { scale: 'phrygian', lo: 36, hi: 70, delay: E(0.25, 0.3, 0.15) });
S(G6, 'Big Room Lead', 'Driven lead for the drop.', 'psy-lead', { scale: 'minor', art: 'legato', drive: 0.3, reverb: R(2, 0.3) });

/* ---------------------------------------------------- cinematic & dark */
const G7 = 'Cinematic & dark';
S(G7, 'Horror Music Box', 'A broken music box in an empty house.', 'music-box', { scale: 'locrian', lo: 60, hi: 92, mod: M('flanger', 0.08, 0.3, 0.3), drone: D(0.3, 1, false, 0.2), reverb: R(6, 0.5, 0.2) });
S(G7, 'Haunted Mansion', 'Diminished choir, long dark hall.', 'choir', { scale: 'diminished', art: 'legato', reverb: R(7, 0.55, 0.3) });
S(G7, 'Epic Trailer', 'Huge harmonic-minor saws over a low drone.', 'supersaw', { scale: 'harmonicMinor', art: 'legato', lo: 36, drive: 0.2, drone: D(0.4, 1), reverb: R(5, 0.45, 0.4) });
S(G7, 'Suspense', 'A slow chromatic slide over a rumble.', 'drone', { scale: 'chromatic', art: 'legato', glide: 300, drone: D(0.5, 1, false, 0.2), filter: F('lowpass', 1200, 2, 0.2, 0.1), reverb: R(6, 0.5, 0.3) });
S(G7, 'Tension Strings', 'Enigmatic scale with string tremolo.', 'warm-pad', { scale: 'enigmatic', art: 'legato', motion: V(0.3, 8), reverb: R(4, 0.4, 0.5) });
S(G7, 'Dark Ritual', 'Phrygian organ over a deep drone.', 'deep-organ', { scale: 'phrygianDominant', art: 'legato', drone: D(0.5, 1), reverb: R(6, 0.5, 0.3) });
S(G7, 'Villain Theme', 'Thick harmonic-minor bass.', 'reese', { scale: 'harmonicMinor', lo: 30, hi: 60, drive: 0.3, reverb: R(3, 0.3, 0.4) });
S(G7, 'Space Horror', 'Tritone glass, flanged.', 'glass-pad', { scale: 'tritone', art: 'legato', mod: M('flanger', 0.1, 0.7, 0.5), reverb: R(7, 0.5, 0.3) });
S(G7, 'Detective Noir', 'Smoky bebop keys.', 'e-piano', { scale: 'bebopDominant', crush: 0.15, reverb: R(2.5, 0.3, 0.3) });
S(G7, 'Desert Mirage', 'Hijaz lead in hot wind.', 'psy-lead', { scale: 'hijaz', art: 'legato', glide: 70, drone: D(0.3), delay: E(0.4, 0.4, 0.2, true), reverb: R(3, 0.3) });
S(G7, 'Frozen Kingdom', 'Lydian bells in an ice palace.', 'bell', { scale: 'lydian', lo: 62, hi: 100, reverb: R(6, 0.5, 1) });
S(G7, 'Synth Fanfare', 'Brassy saw for a heroic moment.', 'sawtooth', { art: 'legato', glide: 30, filter: F('lowpass', 2500, 1.5), reverb: R(3, 0.35) });

/* -------------------------------------------------------------- India */
const G8 = 'India (ragas)';
const tanpura = D(0.45, 2, true, 0.55);
S(G8, 'Raga Bhairav at Dawn', 'The morning raga, over a tanpura drone.', 'harp', { scale: 'bhairav', root: 4, glide: 30, drone: tanpura, reverb: R(2.5, 0.3, 0.6) });
S(G8, 'Raga Yaman Evening', 'Bansuri-like flute, gliding between notes.', 'flute-synth', { scale: 'yaman', root: 2, art: 'legato', glide: 120, drone: tanpura, reverb: R(3, 0.35, 0.6) });
S(G8, 'Raga Malkauns Midnight', 'Five deep notes for the night.', 'vibrato-lead', { scale: 'malkauns', root: 1, art: 'legato', glide: 90, drone: tanpura, reverb: R(3.5, 0.35, 0.5) });
S(G8, 'Raga Bhupali', 'Bright pentatonic raga on kalimba.', 'kalimba', { scale: 'bhupali', root: 2, drone: D(0.35), reverb: R(2, 0.25) });
S(G8, 'Raga Kafi Folk', 'Folk raga, plucked.', 'harp', { scale: 'kafi', root: 2, drone: tanpura, reverb: R(2, 0.25, 0.6) });
S(G8, 'Raga Todi', 'Serious morning raga.', 'flute-synth', { scale: 'todi', root: 4, art: 'legato', glide: 110, drone: tanpura, reverb: R(3, 0.35, 0.5) });
S(G8, 'Raga Hindol Spring', 'Swinging spring raga on bells.', 'bell', { scale: 'hindol', root: 2, drone: D(0.35), reverb: R(3, 0.3, 0.8) });
S(G8, 'Raga Megh Rain', 'The monsoon raga, soft and wide.', 'glass-pad', { scale: 'megh', root: 2, art: 'legato', drone: tanpura, reverb: R(5, 0.45, 0.5) });
S(G8, 'Raga Bhairavi', 'The farewell raga, sweet and sad.', 'e-piano', { scale: 'bhairavi', root: 4, drone: tanpura, reverb: R(2.5, 0.3, 0.5) });
S(G8, 'Raga Hamsadhwani', 'Joyful pentatonic plucks.', 'synth-pluck', { scale: 'hamsadhwani', root: 2, drone: D(0.35), reverb: R(2, 0.25) });
S(G8, 'Raga Marwa Dusk', 'Restless sunset raga.', 'flute-synth', { scale: 'marwa', root: 4, art: 'legato', glide: 100, drone: tanpura, reverb: R(3, 0.35, 0.5) });
S(G8, 'Raga Chandrakauns', 'Moonlit pentatonic bells.', 'bell', { scale: 'chandrakauns', root: 1, drone: tanpura, reverb: R(3.5, 0.35, 0.8) });
S(G8, 'Bollywood Strings', 'Kirwani strings with a shimmer.', 'warm-pad', { scale: 'kirwani', root: 2, art: 'legato', motion: V(0.2, 6), drone: D(0.3), reverb: R(3.5, 0.4, 0.6) });
S(G8, 'Raga Charukesi', 'Romantic raga on the harp.', 'harp', { scale: 'charukesi', root: 2, drone: tanpura, reverb: R(2.5, 0.3, 0.6) });

/* --------------------------------------------------------- Arabic & Turkish */
const G9 = 'Arabic & Turkish (maqam)';
S(G9, 'Maqam Rast Oud', 'Quarter tones on a plucked oud-like voice.', 'harp', { scale: 'rast', glide: 20, reverb: R(1.8, 0.25, 0.6) });
S(G9, 'Maqam Bayati Ney', 'Breathy ney flute sliding into the quarter tone.', 'flute-synth', { scale: 'bayati', root: 2, art: 'legato', glide: 100, reverb: R(3, 0.35, 0.5) });
S(G9, 'Maqam Hijaz Desert', 'The famous desert sound.', 'psy-lead', { scale: 'hijaz', root: 2, art: 'legato', glide: 60, delay: E(0.4, 0.3, 0.15), reverb: R(2.5, 0.3) });
S(G9, 'Maqam Saba Lament', 'The saddest maqam, slow vibrato.', 'vibrato-lead', { scale: 'saba', root: 2, art: 'legato', glide: 120, reverb: R(3, 0.35, 0.5) });
S(G9, 'Maqam Sikah', 'Starting on a quarter-flat note.', 'synth-pluck', { scale: 'sikah', root: 4, reverb: R(2, 0.25) });
S(G9, 'Maqam Nahawand', 'Romantic minor maqam on keys.', 'e-piano', { scale: 'nahawand', root: 7, reverb: R(2, 0.25, 0.6) });
S(G9, 'Maqam Kurd', 'Dark and gentle, on harp.', 'harp', { scale: 'kurd', root: 2, reverb: R(2, 0.25, 0.6) });
S(G9, 'Hijaz Kar Bazaar', 'Marimba in a busy market.', 'marimba', { scale: 'hijazKar', delay: E(0.25, 0.3, 0.15, true), reverb: R(1.5, 0.2) });
S(G9, 'Belly Dance Lead', 'Snake-charmer lead with echo.', 'vibrato-lead', { scale: 'hijazKar', root: 2, art: 'legato', glide: 50, delay: E(0.25, 0.3, 0.15), reverb: R(2, 0.25) });
S(G9, 'Suznak Qanun', 'Bright qanun-like plucks.', 'harp', { scale: 'suznak', reverb: R(2, 0.25, 0.8) });
S(G9, 'Huzam Night', 'A rare maqam full of quarter tones.', 'flute-synth', { scale: 'huzam', root: 4, art: 'legato', glide: 90, reverb: R(3.5, 0.35, 0.5) });
S(G9, 'Maqam Nikriz', 'Ukrainian-Dorian colour on kalimba.', 'kalimba', { scale: 'nikriz', reverb: R(2, 0.25) });
S(G9, 'Nawa Athar', 'Gypsy-like plucks.', 'synth-pluck', { scale: 'nawaAthar', reverb: R(2, 0.25) });

/* ------------------------------------------------------------ Persian */
const G10 = 'Persian (dastgah)';
S(G10, 'Dastgah Shur Santur', 'Shimmering santur-like strikes.', 'harp', { scale: 'shur', root: 2, delay: E(0.12, 0.2, 0.1), reverb: R(2.5, 0.3, 0.7) });
S(G10, 'Dastgah Homayoun Ney', 'A ney flute over a soft drone.', 'flute-synth', { scale: 'homayoun', root: 7, art: 'legato', glide: 120, drone: D(0.25), reverb: R(3, 0.35, 0.5) });
S(G10, 'Dastgah Segah', 'Plucked, with the koron third.', 'harp', { scale: 'segah', root: 4, reverb: R(2.5, 0.3, 0.6) });
S(G10, 'Dastgah Chahargah', 'Proud and bright.', 'synth-pluck', { scale: 'chahargah', reverb: R(2, 0.25) });
S(G10, 'Avaz Esfahan', 'Gentle and longing, on keys.', 'e-piano', { scale: 'esfahan', root: 7, reverb: R(2.5, 0.3, 0.5) });
S(G10, 'Dastgah Mahur', 'The happy dastgah, on marimba.', 'marimba', { scale: 'mahur', reverb: R(1.5, 0.2) });
S(G10, 'Avaz Dashti Night', 'A shepherd’s flute under the stars.', 'flute-synth', { scale: 'dashti', root: 2, art: 'legato', glide: 100, reverb: R(5, 0.4, 0.4) });
S(G10, 'Persian Bells', 'The Western “Persian scale” on bells.', 'bell', { scale: 'persian', reverb: R(3, 0.3, 0.8) });
S(G10, 'Tar Lead', 'A plucked tar with a little grit.', 'synth-pluck', { scale: 'shur', root: 2, drive: 0.15, reverb: R(1.8, 0.2) });

/* -------------------------------------------------------------- East Asia */
const G11 = 'East Asia & gamelan';
S(G11, 'Koto Garden', 'Hirajoshi harp, Japanese garden.', 'harp', { scale: 'hirajoshi', root: 4, reverb: R(2, 0.25, 0.6) });
S(G11, 'Shakuhachi Breath', 'Bamboo flute in a temple.', 'flute-synth', { scale: 'insen', root: 2, art: 'legato', glide: 150, motion: V(0.1, 5), reverb: R(4, 0.4, 0.5) });
S(G11, 'Zen Temple Bell', 'In scale on a big bell.', 'bell', { scale: 'in', root: 4, lo: 48, hi: 84, reverb: R(6, 0.5, 0.5) });
S(G11, 'Iwato Ghost', 'Japan’s eeriest scale, on glass.', 'glass-pad', { scale: 'iwato', art: 'legato', reverb: R(5, 0.45, 0.5) });
S(G11, 'Okinawa Sanshin', 'Ryukyu island plucks.', 'synth-pluck', { scale: 'ryukyu', reverb: R(1.8, 0.2) });
S(G11, 'Japanese Folk', 'Yo scale on marimba.', 'marimba', { scale: 'yo', root: 2, reverb: R(1.5, 0.2) });
S(G11, 'Kumoi Rain', 'Raindrops in the kumoi scale.', 'kalimba', { scale: 'kumoi', root: 2, delay: E(0.3, 0.3, 0.15), reverb: R(3, 0.3, 0.6) });
S(G11, 'Guzheng River', 'Flowing Chinese zither.', 'harp', { scale: 'gong', root: 7, glide: 30, reverb: R(2.5, 0.3, 0.7) });
S(G11, 'Chinese Yu Mode', 'A flute in the yu mode.', 'flute-synth', { scale: 'yu', root: 9, art: 'legato', glide: 90, reverb: R(3, 0.3, 0.5) });
S(G11, 'Erhu Lament', 'Two-string fiddle, sliding and sad.', 'vibrato-lead', { scale: 'jue', root: 2, art: 'legato', glide: 140, motion: V(0.1, 6), reverb: R(3, 0.35, 0.5) });
S(G11, 'Gamelan Pelog', 'Bronze bells in pelog, beating like a real gamelan.', 'bell', { scale: 'pelog', root: 2, motion: V(0.3, 6), reverb: R(3, 0.35, 0.6) });
S(G11, 'Gamelan Slendro', 'Five near-equal steps on bronze bars.', 'marimba', { scale: 'slendro', root: 2, motion: V(0.25, 5), reverb: R(2.5, 0.3, 0.6) });
S(G11, 'Thai Ranat', 'Thai xylophone in 7 equal steps.', 'marimba', { scale: 'thai', reverb: R(1.5, 0.2) });

/* -------------------------------------------------------------- Africa */
const G12 = 'Africa';
S(G12, 'Mbira Spirit', 'Zimbabwean mbira with a little buzz.', 'kalimba', { scale: 'mbira', crush: 0.1, delay: E(0.2, 0.2, 0.1), reverb: R(1.5, 0.2) });
S(G12, 'Kora Griot', 'West African harp in the Sauta tuning.', 'harp', { scale: 'kora', root: 5, reverb: R(2, 0.25, 0.7) });
S(G12, 'Tizita Nostalgia', 'Ethiopian minor tizita, the song of memory.', 'e-piano', { scale: 'tizitaMinor', root: 4, reverb: R(2.5, 0.3, 0.5) });
S(G12, 'Tizita Major', 'Bright Ethiopian pentatonic.', 'synth-pluck', { scale: 'tizitaMajor', root: 4, reverb: R(2, 0.25) });
S(G12, 'Ethio-Jazz Ambassel', 'Smoky Addis Ababa jazz lead.', 'vibrato-lead', { scale: 'ambassel', root: 4, art: 'legato', glide: 40, reverb: R(2.5, 0.3, 0.5) });
S(G12, 'Bati Groove', 'Bati major on marimba.', 'marimba', { scale: 'batiMajor', root: 4, reverb: R(1.5, 0.2) });
S(G12, 'Anchihoye Mystery', 'Strange and beautiful Ethiopian mode.', 'glass-pad', { scale: 'anchihoye', root: 4, art: 'legato', reverb: R(4, 0.4, 0.5) });
S(G12, 'Amadinda Xylophone', 'Ugandan xylophone, five equal steps.', 'marimba', { scale: 'equipentatonic', reverb: R(1.2, 0.15) });
S(G12, 'Chopi Timbila', 'Mozambique timbila, seven equal steps.', 'marimba', { scale: 'equiheptatonic', reverb: R(1.5, 0.2) });
S(G12, 'Desert Blues', 'Tuareg-style guitar blues.', 'synth-pluck', { scale: 'blues', root: 4, drive: 0.25, delay: E(0.3, 0.25, 0.15), reverb: R(2, 0.25) });

/* ------------------------------------------------- Europe folk & Jewish */
const G13 = 'Europe folk & Jewish';
S(G13, 'Flamenco Night', 'Phrygian-dominant guitar-like plucks.', 'harp', { scale: 'spanishGypsy', root: 4, reverb: R(1.8, 0.25, 0.6) });
S(G13, 'Spanish 8-tone', 'The full Spanish scale.', 'synth-pluck', { scale: 'spanish8', root: 4, reverb: R(2, 0.25) });
S(G13, 'Klezmer Clarinet', 'Ahava Rabbah, crying and dancing.', 'vibrato-lead', { scale: 'ahavaRabbah', root: 2, art: 'legato', glide: 50, reverb: R(2, 0.25) });
S(G13, 'Gypsy Violin', 'Hungarian minor with violin vibrato.', 'vibrato-lead', { scale: 'hungarianMinor', root: 9, art: 'legato', glide: 60, motion: V(0.1, 6), reverb: R(2.5, 0.3) });
S(G13, 'Celtic Harp', 'Scottish pentatonic harp.', 'harp', { scale: 'celtic', root: 2, reverb: R(3, 0.3, 0.7) });
S(G13, 'Highland Pipes', 'Bagpipe drone under a chanter.', 'flute-synth', { scale: 'mixolydian', root: 9, art: 'legato', glide: 15, drone: D(0.55, 2, true, 0.85), reverb: R(3, 0.3) });
S(G13, 'Byzantine Chant', 'Monks over a single held note.', 'choir', { scale: 'byzantine', root: 2, art: 'legato', drone: D(0.4, 2, false, 0.3), reverb: R(7, 0.55, 0.4) });
S(G13, 'Romanian Doina', 'Free, sad shepherd melody.', 'flute-synth', { scale: 'misheberach', root: 2, art: 'legato', glide: 100, reverb: R(3, 0.35, 0.5) });
S(G13, 'Neapolitan Serenade', 'Old Naples on keys.', 'e-piano', { scale: 'neapolitanMinor', reverb: R(2, 0.25, 0.6) });
S(G13, 'Pharaoh', 'Egyptian pentatonic plucks.', 'synth-pluck', { scale: 'egyptian', root: 2, reverb: R(2, 0.25) });

/* ----------------------------------------------------- math & science */
const G14 = 'Math & science';
S(G14, 'Sound of a Graph', 'Clean glide: you hear exactly the curve.', 'sine', { scale: 'continuous', art: 'legato', lo: 40, hi: 84, glide: 25, reverb: R(1.5, 0.15) });
S(G14, 'Pure Glissando Echo', 'The curve, with echoes left and right.', 'sine', { scale: 'continuous', art: 'legato', lo: 40, hi: 84, glide: 25, delay: E(0.3, 0.4, 0.25, true), reverb: R(2.5, 0.25) });
S(G14, 'Theremin', 'The sci-fi instrument you play without touching.', 'sine', { scale: 'continuous', art: 'legato', lo: 48, hi: 88, glide: 120, motion: V(0.15, 6), reverb: R(2.5, 0.3) });
S(G14, 'Overtone Series', 'Nature’s scale: the harmonics of one string.', 'sine', { scale: 'overtones', reverb: R(3, 0.3) });
S(G14, 'Just Intonation', 'Pure ratios (3:2, 5:4) instead of piano tuning.', 'triangle', { scale: 'justMajor', art: 'legato', glide: 40, reverb: R(2.5, 0.25) });
S(G14, 'Bohlen–Pierce Bells', 'A scale built on 3:1 instead of the octave.', 'bell', { scale: 'bohlenPierce', reverb: R(3, 0.3, 0.8) });
S(G14, 'Carlos Alpha', 'Wendy Carlos’ scale without octaves.', 'glass-pad', { scale: 'carlosAlpha', art: 'legato', glide: 50, reverb: R(4, 0.35) });
S(G14, '19 Notes per Octave', 'An octave cut into 19 equal steps.', 'e-piano', { scale: 'edo19', reverb: R(2, 0.25) });
S(G14, 'Quarter-tone Steps', '24 equal steps: hear the notes between the notes.', 'sine', { scale: 'quarterTones', reverb: R(2, 0.2) });
S(G14, 'Greek Enharmonic', 'The ancient Greek scale with quarter tones.', 'harp', { scale: 'greekEnharmonic', root: 4, reverb: R(2.5, 0.3, 0.6) });
S(G14, 'Whole-tone Circles', 'Dreamy whole tones for spinning circles.', 'glass-pad', { scale: 'wholeTone', reverb: R(4, 0.4, 0.8) });
S(G14, 'Chromatic Staircase', 'Every semitone, one by one.', 'chiptune', { scale: 'chromatic', crush: 0.2, reverb: R(1, 0.1) });
S(G14, '432 Hz Pentatonic', 'Kalimba tuned to A = 432 Hz.', 'kalimba', { scale: 'pentatonic', tuning: 432, reverb: R(2.5, 0.3, 0.6) });
S(G14, 'Lab Oscillator', 'A square wave from the physics lab.', 'square', { scale: 'continuous', art: 'legato', glide: 15, filter: F('lowpass', 2000), crush: 0.2, reverb: R(0.8, 0.08) });

/* ---------------------------------------------------------- kids & cute */
const G15 = 'Kids & cute';
S(G15, 'Toy Piano', 'A tiny bright music box.', 'music-box', { tuning: 444, lo: 62, hi: 96, reverb: R(1.5, 0.2, 0.9) });
S(G15, 'Bubble Pop', 'Bubbly high kalimba.', 'kalimba', { lo: 66, hi: 98, reverb: R(1.2, 0.15) });
S(G15, 'Cartoon Slide', 'Slide-whistle glides.', 'sine', { scale: 'continuous', art: 'legato', glide: 200, motion: V(0.2, 7), reverb: R(1, 0.1) });
S(G15, 'Lullaby', 'Soft music box for bedtime.', 'music-box', { scale: 'pentatonic', lo: 60, hi: 90, reverb: R(3, 0.4, 0.6) });
S(G15, 'Jelly Bounce', 'Wobbly FM boings.', 'squelch-fm', { lo: 50, hi: 80, reverb: R(1, 0.1) });
S(G15, 'Rainbow Arp', 'Happy arpeggio with ping-pong echoes.', 'space-arp', { delay: E(0.25, 0.35, 0.2, true), reverb: R(2, 0.25) });
S(G15, 'Candy Chimes', 'Sweet high chimes.', 'bell', { lo: 66, hi: 100, reverb: R(2.5, 0.3, 1) });
S(G15, 'Happy Ukulele', 'Short bright plucks.', 'harp', { lo: 55, hi: 86, delay: E(0.15, 0.15, 0.08), reverb: R(1.2, 0.15) });

/* ------------------------------------------------- satisfying & ASMR */
const G16 = 'Satisfying & ASMR';
S(G16, 'Soft Taps', 'Muted wooden taps, very close.', 'marimba', { scale: 'pentatonic', filter: F('lowpass', 2500), reverb: R(1, 0.15, 0.3) });
S(G16, 'Water Drops', 'High drops with a little echo.', 'kalimba', { scale: 'pentatonic', lo: 66, hi: 100, filter: F('lowpass', 4000), delay: E(0.18, 0.3, 0.15), reverb: R(2, 0.25, 0.6) });
S(G16, 'Glass Marbles', 'Marbles clicking on glass.', 'bell', { scale: 'wholeTone', lo: 70, hi: 100, reverb: R(1.5, 0.2, 1) });
S(G16, 'Bubble Wrap', 'Tiny crisp pops.', 'sine', { lo: 60, hi: 92, crush: 0.1, reverb: R(0.5, 0.05) });
S(G16, 'Silk Pad', 'A soft pad that never hurts the ears.', 'warm-pad', { art: 'legato', filter: F('lowpass', 1800), reverb: R(5, 0.5, 0.3) });
S(G16, 'Sand Pluck', 'Soft, sandy plucks.', 'synth-pluck', { scale: 'minorPentatonic', filter: F('lowpass', 2200, 2), reverb: R(1.5, 0.2, 0.4) });
S(G16, 'Rain on Leaves', 'Drops falling left and right.', 'kalimba', { scale: 'minorPentatonic', lo: 60, hi: 96, delay: E(0.22, 0.35, 0.2, true), reverb: R(2.5, 0.3, 0.5) });
S(G16, 'Calm Breath', 'Pentatonic tones that slowly breathe.', 'sine', { scale: 'pentatonic', art: 'legato', glide: 90, motion: V(0.35, 0.5), reverb: R(4, 0.4, 0.5) });

export const SOUND_PRESETS = LIST;
export const SOUND_GROUPS = [...new Set(LIST.map((s) => s.group))];
