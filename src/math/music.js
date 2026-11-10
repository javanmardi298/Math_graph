/**
 * Pitch mapping: turns a function value Y into a musical pitch.
 * Y is mapped linearly from the view range [yMin, yMax] onto a MIDI note range,
 * then optionally snapped to a scale so any curve sounds "in key".
 */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Scales, as steps above the root in semitones. Steps may be fractional (quarter tones
 * of Arabic and Persian music, gamelan and overtone tunings); a few scales repeat at
 * an interval other than the octave (`period`, in semitones). `null` = continuous.
 *
 * Sources for the world scales: the standard Western renderings of Arabic maqamat
 * (24-tone, a quarter tone = 0.5), Persian dastgah (koron ≈ a quarter tone low),
 * Hindustani thaats and ragas, Japanese and Chinese pentatonics, Ethiopian qenet,
 * Javanese pelog/slendro (average measured cents), and equal divisions used in
 * Thai, Ugandan and Chopi music. Traditional players tune by ear; these are good
 * approximations that sound right on a synth.
 */
const t = (cents) => cents.map((c) => +(c / 100).toFixed(3)); // cents → semitones
const edo = (n, period = 12) => Array.from({ length: n }, (_, i) => +((i * period) / n).toFixed(3));

/** [key, label, group, steps, period?] */
const TABLE = [
  ['continuous', 'Continuous (glide)', 'Basic', null],
  ['chromatic', 'Chromatic', 'Basic', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]],
  ['major', 'Major', 'Basic', [0, 2, 4, 5, 7, 9, 11]],
  ['minor', 'Natural minor', 'Basic', [0, 2, 3, 5, 7, 8, 10]],
  ['pentatonic', 'Major pentatonic', 'Basic', [0, 2, 4, 7, 9]],
  ['minorPentatonic', 'Minor pentatonic', 'Basic', [0, 3, 5, 7, 10]],
  ['blues', 'Blues', 'Basic', [0, 3, 5, 6, 7, 10]],
  ['majorBlues', 'Major blues', 'Basic', [0, 2, 3, 4, 7, 9]],
  ['harmonicMinor', 'Harmonic minor', 'Basic', [0, 2, 3, 5, 7, 8, 11]],
  ['melodicMinor', 'Melodic minor', 'Basic', [0, 2, 3, 5, 7, 9, 11]],

  ['dorian', 'Dorian', 'Modes', [0, 2, 3, 5, 7, 9, 10]],
  ['phrygian', 'Phrygian (dark, Spanish)', 'Modes', [0, 1, 3, 5, 7, 8, 10]],
  ['lydian', 'Lydian (dreamy, film)', 'Modes', [0, 2, 4, 6, 7, 9, 11]],
  ['mixolydian', 'Mixolydian (rock, folk)', 'Modes', [0, 2, 4, 5, 7, 9, 10]],
  ['locrian', 'Locrian (unstable)', 'Modes', [0, 1, 3, 5, 6, 8, 10]],
  ['lydianDominant', 'Lydian dominant (acoustic)', 'Modes', [0, 2, 4, 6, 7, 9, 10]],
  ['phrygianDominant', 'Phrygian dominant (Middle-Eastern)', 'Modes', [0, 1, 4, 5, 7, 8, 10]],
  ['harmonicMajor', 'Harmonic major', 'Modes', [0, 2, 4, 5, 7, 8, 11]],
  ['lydianAugmented', 'Lydian augmented', 'Modes', [0, 2, 4, 6, 8, 9, 11]],
  ['altered', 'Altered (super-Locrian, jazz)', 'Modes', [0, 1, 3, 4, 6, 8, 10]],
  ['bebopDominant', 'Bebop dominant', 'Modes', [0, 2, 4, 5, 7, 9, 10, 11]],
  ['bebopMajor', 'Bebop major', 'Modes', [0, 2, 4, 5, 7, 8, 9, 11]],

  ['wholeTone', 'Whole tone (dream sequence)', 'Psychedelic & strange', [0, 2, 4, 6, 8, 10]],
  ['diminished', 'Diminished half–whole (octatonic)', 'Psychedelic & strange', [0, 1, 3, 4, 6, 7, 9, 10]],
  ['diminishedWH', 'Diminished whole–half', 'Psychedelic & strange', [0, 2, 3, 5, 6, 8, 9, 11]],
  ['augmented', 'Augmented (hexatonic)', 'Psychedelic & strange', [0, 3, 4, 7, 8, 11]],
  ['prometheus', 'Prometheus (Scriabin mystic chord)', 'Psychedelic & strange', [0, 2, 4, 6, 9, 10]],
  ['tritone', 'Tritone scale', 'Psychedelic & strange', [0, 1, 4, 6, 7, 10]],
  ['enigmatic', 'Enigmatic (Verdi)', 'Psychedelic & strange', [0, 1, 4, 6, 8, 10, 11]],
  ['messiaen3', 'Messiaen mode 3', 'Psychedelic & strange', [0, 2, 3, 4, 6, 7, 8, 10, 11]],
  ['messiaen4', 'Messiaen mode 4', 'Psychedelic & strange', [0, 1, 2, 5, 6, 7, 8, 11]],
  ['messiaen6', 'Messiaen mode 6', 'Psychedelic & strange', [0, 2, 4, 5, 6, 8, 10, 11]],
  ['overtones', 'Harmonic series (overtones 8–15)', 'Psychedelic & strange', t([0, 204, 386, 551, 702, 841, 969, 1088])],
  ['justMajor', 'Just-intonation major (pure)', 'Psychedelic & strange', t([0, 204, 386, 498, 702, 884, 1088])],
  ['quarterTones', 'Quarter-tone chromatic (24 per octave)', 'Psychedelic & strange', edo(24)],
  ['edo19', '19 equal steps per octave', 'Psychedelic & strange', edo(19)],
  ['greekEnharmonic', 'Ancient Greek enharmonic', 'Psychedelic & strange', [0, 0.5, 1, 5, 7, 7.5, 8]],
  ['bohlenPierce', 'Bohlen–Pierce (no octaves)', 'Psychedelic & strange', [0, 1, 3, 4, 6, 7, 9, 10, 12].map((k) => +(k * 1.463).toFixed(3)), 19.02],
  ['carlosAlpha', 'Wendy Carlos alpha (no octaves)', 'Psychedelic & strange', edo(9, 7.02), 7.02],
  ['carlosBeta', 'Wendy Carlos beta (no octaves)', 'Psychedelic & strange', edo(11, 7.02), 7.02],

  ['rast', 'Maqam Rast', 'Arabic & Turkish', [0, 2, 3.5, 5, 7, 9, 10.5]],
  ['bayati', 'Maqam Bayati', 'Arabic & Turkish', [0, 1.5, 3, 5, 7, 8, 10]],
  ['saba', 'Maqam Saba', 'Arabic & Turkish', [0, 1.5, 3, 4, 7, 8, 10]],
  ['hijaz', 'Maqam Hijaz', 'Arabic & Turkish', [0, 1, 4, 5, 7, 8, 10]],
  ['hijazKar', 'Maqam Hijaz Kar (double harmonic)', 'Arabic & Turkish', [0, 1, 4, 5, 7, 8, 11]],
  ['sikah', 'Maqam Sikah', 'Arabic & Turkish', [0, 1.5, 3.5, 5.5, 7, 8.5, 10.5]],
  ['nahawand', 'Maqam Nahawand', 'Arabic & Turkish', [0, 2, 3, 5, 7, 8, 11]],
  ['kurd', 'Maqam Kurd', 'Arabic & Turkish', [0, 1, 3, 5, 7, 8, 10]],
  ['ajam', 'Maqam Ajam', 'Arabic & Turkish', [0, 2, 4, 5, 7, 9, 11]],
  ['suznak', 'Maqam Suznak', 'Arabic & Turkish', [0, 2, 3.5, 5, 7, 8, 11]],
  ['nawaAthar', 'Maqam Nawa Athar', 'Arabic & Turkish', [0, 2, 3, 6, 7, 8, 11]],
  ['nikriz', 'Maqam Nikriz', 'Arabic & Turkish', [0, 2, 3, 6, 7, 9, 10]],
  ['huzam', 'Maqam Huzam', 'Arabic & Turkish', [0, 1.5, 3.5, 4.5, 7.5, 8.5, 10.5]],

  ['shur', 'Dastgah Shur', 'Persian', [0, 1.5, 3, 5, 7, 8, 10]],
  ['homayoun', 'Dastgah Homayoun', 'Persian', [0, 1.5, 4, 5, 7, 8, 10]],
  ['segah', 'Dastgah Segah', 'Persian', [0, 1.5, 3.5, 5, 7, 8.5, 10]],
  ['chahargah', 'Dastgah Chahargah', 'Persian', [0, 1.5, 4, 5, 7, 8.5, 11]],
  ['esfahan', 'Avaz Esfahan', 'Persian', [0, 2, 3, 5, 7, 8.5, 11]],
  ['mahur', 'Dastgah Mahur', 'Persian', [0, 2, 4, 5, 7, 9, 10]],
  ['dashti', 'Avaz Dashti', 'Persian', [0, 1.5, 3, 5, 6.5, 8, 10]],
  ['persian', 'Persian scale (Western)', 'Persian', [0, 1, 4, 5, 6, 8, 11]],

  ['bhairav', 'Raga Bhairav (dawn)', 'Indian', [0, 1, 4, 5, 7, 8, 11]],
  ['yaman', 'Raga Yaman (Kalyan thaat)', 'Indian', [0, 2, 4, 6, 7, 9, 11]],
  ['kafi', 'Raga Kafi', 'Indian', [0, 2, 3, 5, 7, 9, 10]],
  ['bhairavi', 'Raga Bhairavi', 'Indian', [0, 1, 3, 5, 7, 8, 10]],
  ['todi', 'Raga Todi', 'Indian', [0, 1, 3, 6, 7, 8, 11]],
  ['purvi', 'Raga Purvi', 'Indian', [0, 1, 4, 6, 7, 8, 11]],
  ['marwa', 'Raga Marwa (dusk)', 'Indian', [0, 1, 4, 6, 7, 9, 11]],
  ['ahirBhairav', 'Raga Ahir Bhairav', 'Indian', [0, 1, 4, 5, 7, 9, 10]],
  ['charukesi', 'Raga Charukesi', 'Indian', [0, 2, 4, 5, 7, 8, 10]],
  ['kirwani', 'Raga Kirwani', 'Indian', [0, 2, 3, 5, 7, 8, 11]],
  ['malkauns', 'Raga Malkauns (midnight)', 'Indian', [0, 3, 5, 8, 10]],
  ['bhupali', 'Raga Bhupali', 'Indian', [0, 2, 4, 7, 9]],
  ['durga', 'Raga Durga', 'Indian', [0, 2, 5, 7, 9]],
  ['hindol', 'Raga Hindol (spring)', 'Indian', [0, 4, 6, 9, 11]],
  ['megh', 'Raga Megh (rain)', 'Indian', [0, 2, 5, 7, 10]],
  ['shivranjani', 'Raga Shivranjani', 'Indian', [0, 2, 3, 7, 9]],
  ['chandrakauns', 'Raga Chandrakauns', 'Indian', [0, 3, 5, 8, 11]],
  ['hamsadhwani', 'Raga Hamsadhwani', 'Indian', [0, 2, 4, 7, 11]],

  ['hirajoshi', 'Hirajoshi', 'East Asian', [0, 2, 3, 7, 8]],
  ['in', 'In (Miyako-bushi)', 'East Asian', [0, 1, 5, 7, 8]],
  ['insen', 'Insen (shakuhachi)', 'East Asian', [0, 1, 5, 7, 10]],
  ['iwato', 'Iwato (eerie)', 'East Asian', [0, 1, 5, 6, 10]],
  ['kumoi', 'Kumoi', 'East Asian', [0, 2, 3, 7, 9]],
  ['yo', 'Yo (Japanese folk)', 'East Asian', [0, 2, 5, 7, 9]],
  ['ryukyu', 'Ryukyu (Okinawa)', 'East Asian', [0, 4, 5, 7, 11]],
  ['gong', 'Chinese Gong mode', 'East Asian', [0, 2, 4, 7, 9]],
  ['shang', 'Chinese Shang mode', 'East Asian', [0, 2, 5, 7, 10]],
  ['jue', 'Chinese Jue mode', 'East Asian', [0, 3, 5, 8, 10]],
  ['zhi', 'Chinese Zhi mode', 'East Asian', [0, 2, 5, 7, 9]],
  ['yu', 'Chinese Yu mode', 'East Asian', [0, 3, 5, 7, 10]],
  ['pelog', 'Pelog (Javanese gamelan)', 'East Asian', t([0, 120, 270, 540, 670, 785, 950])],
  ['pelogBem', 'Pelog bem (5 tones)', 'East Asian', t([0, 120, 270, 670, 785])],
  ['slendro', 'Slendro (Javanese gamelan)', 'East Asian', t([0, 240, 480, 720, 960])],
  ['thai', 'Thai (7 equal steps)', 'East Asian', edo(7)],

  ['tizitaMajor', 'Tizita major (Ethiopia)', 'African', [0, 2, 4, 7, 9]],
  ['tizitaMinor', 'Tizita minor (Ethiopia)', 'African', [0, 2, 3, 7, 8]],
  ['batiMajor', 'Bati major (Ethiopia)', 'African', [0, 4, 5, 7, 11]],
  ['batiMinor', 'Bati minor (Ethiopia)', 'African', [0, 3, 5, 7, 10]],
  ['ambassel', 'Ambassel (Ethiopia)', 'African', [0, 1, 5, 7, 8]],
  ['anchihoye', 'Anchihoye (Ethiopia)', 'African', [0, 1, 5, 6, 9]],
  ['equiheptatonic', 'Equiheptatonic (Uganda, Chopi timbila)', 'African', edo(7)],
  ['equipentatonic', 'Equipentatonic (Ugandan amadinda)', 'African', edo(5)],
  ['mbira', 'Mbira Nyamaropa (Zimbabwe)', 'African', [0, 2, 4, 5, 7, 9, 10]],
  ['kora', 'Kora Sauta (Mande, West Africa)', 'African', [0, 2, 4, 6, 7, 9, 11]],

  ['spanishGypsy', 'Spanish gypsy / flamenco (Phrygian dominant)', 'European folk & Jewish', [0, 1, 4, 5, 7, 8, 10]],
  ['spanish8', 'Spanish 8-tone', 'European folk & Jewish', [0, 1, 3, 4, 5, 6, 8, 10]],
  ['ahavaRabbah', 'Ahava Rabbah (klezmer)', 'European folk & Jewish', [0, 1, 4, 5, 7, 8, 10]],
  ['misheberach', 'Mi Sheberach (Ukrainian Dorian)', 'European folk & Jewish', [0, 2, 3, 6, 7, 9, 10]],
  ['hungarianMinor', 'Hungarian minor (gypsy)', 'European folk & Jewish', [0, 2, 3, 6, 7, 8, 11]],
  ['hungarianMajor', 'Hungarian major', 'European folk & Jewish', [0, 3, 4, 6, 7, 9, 10]],
  ['byzantine', 'Byzantine (double harmonic)', 'European folk & Jewish', [0, 1, 4, 5, 7, 8, 11]],
  ['neapolitanMinor', 'Neapolitan minor', 'European folk & Jewish', [0, 1, 3, 5, 7, 8, 11]],
  ['neapolitanMajor', 'Neapolitan major', 'European folk & Jewish', [0, 1, 3, 5, 7, 9, 11]],
  ['celtic', 'Celtic / Scottish pentatonic', 'European folk & Jewish', [0, 2, 5, 7, 9]],
  ['egyptian', 'Egyptian (suspended pentatonic)', 'European folk & Jewish', [0, 2, 5, 7, 10]],
  // --- added in the sound upgrade: jazz colours, chord tones, more maqam / dastgah, historical and equal tunings
  ['dorianB2', 'Dorian ♭2 (Phrygian ♮6)', 'Jazz & modern', [0, 1, 3, 5, 7, 9, 10]],
  ['mixolydianB6', 'Mixolydian ♭6 (Hindu)', 'Jazz & modern', [0, 2, 4, 5, 7, 8, 10]],
  ['locrianNat2', 'Locrian ♮2 (half-diminished)', 'Jazz & modern', [0, 2, 3, 5, 6, 8, 10]],
  ['majorLocrian', 'Major Locrian', 'Jazz & modern', [0, 2, 4, 5, 6, 8, 10]],
  ['leadingWholeTone', 'Leading whole tone', 'Jazz & modern', [0, 2, 4, 6, 8, 10, 11]],
  ['sixToneSymmetric', 'Six-tone symmetric', 'Jazz & modern', [0, 1, 4, 5, 8, 9]],
  ['bluesNine', 'Nine-note blues', 'Jazz & modern', [0, 2, 3, 4, 5, 7, 9, 10, 11]],
  ['minor6Pent', 'Minor 6 pentatonic', 'Jazz & modern', [0, 3, 5, 7, 9]],
  ['dominantPent', 'Dominant pentatonic', 'Jazz & modern', [0, 2, 4, 7, 10]],
  ['scriabin', 'Scriabin', 'Jazz & modern', [0, 1, 4, 7, 9]],
  ['istrian', 'Istrian', 'Jazz & modern', [0, 1, 3, 4, 6, 7]],
  ['ukrainianDorian', 'Ukrainian Dorian', 'European folk & Jewish', [0, 2, 3, 6, 7, 9, 10]],
  ['chordMajor', 'Major triad (1 3 5)', 'Chord tones', [0, 4, 7]],
  ['chordMinor', 'Minor triad (1 ♭3 5)', 'Chord tones', [0, 3, 7]],
  ['chordMaj7', 'Major 7th chord', 'Chord tones', [0, 4, 7, 11]],
  ['chordMin7', 'Minor 7th chord', 'Chord tones', [0, 3, 7, 10]],
  ['chordDom7', 'Dominant 7th chord', 'Chord tones', [0, 4, 7, 10]],
  ['chordDim7', 'Diminished 7th chord', 'Chord tones', [0, 3, 6, 9]],
  ['chordSus4', 'Sus4 chord', 'Chord tones', [0, 5, 7]],
  ['chordMaj9', 'Major 9th chord', 'Chord tones', [0, 2, 4, 7, 11]],
  ['chordMin9', 'Minor 9th chord', 'Chord tones', [0, 2, 3, 7, 10]],
  ['chordAdd6', 'Major 6th chord', 'Chord tones', [0, 4, 7, 9]],
  ['fifths', 'Root and fifth (power)', 'Chord tones', [0, 7]],
  ['octaves', 'Octaves only', 'Chord tones', [0]],
  ['bayatTork', 'Bayat-e Tork (approx.)', 'Persian dastgah', [0, 2, 3.5, 5, 7, 9, 10]],
  ['afshari', 'Afshari (approx.)', 'Persian dastgah', [0, 2, 3.5, 5, 7, 8.5, 10]],
  ['jiharkah', 'Jiharkah (approx.)', 'Arabic & Turkish maqam', [0, 2, 4, 5, 7, 9, 10.5]],
  ['atharKurd', 'Athar Kurd', 'Arabic & Turkish maqam', [0, 1, 3, 6, 7, 8, 11]],
  ['huseyni', 'Hüseyni (Turkish, approx.)', 'Arabic & Turkish maqam', [0, 1.6, 3, 5, 7, 8.6, 10]],
  ['ussak', 'Uşşak (Turkish, approx.)', 'Arabic & Turkish maqam', [0, 1.4, 3, 5, 7, 8, 10]],
  ['pythagorean', 'Pythagorean major (pure fifths)', 'Tunings & temperaments', t([0, 203.9, 407.8, 498, 702, 905.9, 1109.8])],
  ['justMinor', 'Just minor (5-limit)', 'Tunings & temperaments', t([0, 203.9, 315.6, 498, 702, 813.7, 1017.6])],
  ['meantone', 'Quarter-comma meantone major', 'Tunings & temperaments', t([0, 193.2, 386.3, 503.4, 696.6, 889.7, 1082.9])],
  ['harmonics8', 'Harmonics 8–16', 'Tunings & temperaments', t([0, 203.9, 386.3, 551.3, 702, 840.5, 968.8, 1088.3])],
  ['undertones', 'Undertone series', 'Tunings & temperaments', t([0, 111.7, 231.2, 359.5, 498, 648.7, 813.7, 996.1])],
  ['shruti22', '22 shruti (Indian just)', 'Tunings & temperaments', t([0, 90, 112, 182, 204, 294, 316, 386, 408, 498, 520, 590, 612, 702, 792, 814, 884, 906, 996, 1018, 1088, 1110])],
  ['edo5', '5 equal steps', 'Tunings & temperaments', edo(5)],
  ['edo10', '10 equal steps', 'Tunings & temperaments', edo(10)],
  ['edo15', '15 equal steps', 'Tunings & temperaments', edo(15)],
  ['edo17', '17 equal steps', 'Tunings & temperaments', edo(17)],
  ['edo22', '22 equal steps', 'Tunings & temperaments', edo(22)],
  ['edo31', '31 equal steps', 'Tunings & temperaments', edo(31)],
  ['edo53', '53 equal steps (commas)', 'Tunings & temperaments', edo(53)],
  ['custom', 'Custom (your own steps, Sound tab)', 'Custom', [0, 2, 4, 5, 7, 9, 11]],
];

export const SCALES = Object.fromEntries(TABLE.map(([k, , , steps]) => [k, steps]));
export const SCALE_LABELS = Object.fromEntries(TABLE.map(([k, label]) => [k, label]));
/** Interval at which a scale repeats, in semitones (12 = the octave). */
export const SCALE_PERIOD = Object.fromEntries(TABLE.map(([k, , , , period = 12]) => [k, period]));
/** [[group, [key …]] …] in menu order. */
export const SCALE_GROUPS = [...new Set(TABLE.map((r) => r[2]))].map((g) => [g, TABLE.filter((r) => r[2] === g).map((r) => r[0])]);

/** Notes (fractional MIDI) of a scale between lo and hi. */
export function scaleNotesBetween(scale, root, lo, hi) {
  const steps = SCALES[scale];
  if (!steps) return [];
  const period = SCALE_PERIOD[scale] || 12;
  const out = [];
  for (let k = Math.floor((lo - root) / period) - 1; root + k * period <= hi; k++) {
    for (const s of steps) { const m = +(root + k * period + s).toFixed(3); if (m >= lo && m <= hi) out.push(m); }
  }
  return out;
}

export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const freqToMidi = (f) => 69 + 12 * Math.log2(f / 440);
export const noteName = (m) => `${NOTE_NAMES[((Math.round(m) % 12) + 12) % 12]}${Math.floor(Math.round(m) / 12) - 1}`;

/** Snap a (fractional) MIDI note to the nearest note of a scale rooted at `root` (0 = C). */
export function quantize(midi, scale, root = 0) {
  const steps = SCALES[scale];
  if (!steps) return midi;
  const period = SCALE_PERIOD[scale] || 12;
  const rel = midi - root;
  const octave = Math.floor(rel / period);
  const within = rel - octave * period;
  let best = steps[0], bestDist = Infinity;
  for (const s of [...steps, steps[0] + period]) {
    const d = Math.abs(within - s);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return +(root + octave * period + best).toFixed(3);
}

/**
 * Y value → MIDI note (fractional when continuous).
 * @param {number} y
 * @param {{yMin:number,yMax:number,noteLow:number,noteHigh:number,scale:string,root:number}} map
 * @param {number} [octaveShift] per-layer transpose in octaves
 */
export function yToMidi(y, map, octaveShift = 0) {
  if (!Number.isFinite(y)) return null;
  const k = (y - map.yMin) / (map.yMax - map.yMin || 1);
  const clamped = Math.min(Math.max(k, 0), 1);
  const raw = map.noteLow + clamped * (map.noteHigh - map.noteLow) + octaveShift * 12;
  return quantize(raw, map.scale, map.root);
}

/**
 * A custom scale from text: steps above the root separated by spaces or commas. A plain number is
 * semitones (3.5 = a quarter tone above 3), `702c` is cents, `3/2` a frequency ratio. A last step of
 * one octave or more (12, 1200c, 2/1, 3/1 …) is the interval at which the scale repeats.
 * @returns {{steps:number[], period:number}}
 */
export function parseScale(text) {
  const vals = String(text || '').split(/[\s,;]+/).map((tok) => {
    let m;
    if ((m = /^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(tok))) return 12 * Math.log2(+m[1] / +m[2]);
    if ((m = /^(-?\d+(?:\.\d+)?)c$/i.exec(tok))) return +m[1] / 100;
    return tok === '' ? NaN : +tok;
  }).filter((v) => Number.isFinite(v) && v >= 0 && v <= 48);
  const big = vals.filter((v) => v >= 11.999);
  const period = big.length ? Math.max(...big) : 12;
  const steps = [...new Set([0, ...vals.filter((v) => v < period - 1e-6)].map((v) => +v.toFixed(3)))].sort((a, b) => a - b);
  return { steps, period: +period.toFixed(3) };
}

let customText = null;
/** Make `custom` the scale written in `text` (cheap to call often: it only re-parses a new text). */
export function useCustomScale(text) {
  if (text === customText) return;
  customText = text;
  const { steps, period } = parseScale(text || '0 2 4 5 7 9 11');
  SCALES.custom = steps.length ? steps : [0];
  SCALE_PERIOD.custom = period;
}
