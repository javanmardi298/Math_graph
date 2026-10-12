/**
 * How long each preset runs (the "Length (s)" it opens with). Not every preset needs 30 s:
 * a Fourier cat is done when the last circle has drawn it, a paper cut when the paper is
 * gone, a plate pattern shows its last picture and ends. The numbers come from running
 * every simulation headless (the time the last stage or the "done" event happens) plus a
 * few seconds to hold the finished picture; loops without an ending (a bouncing ball, a
 * pendulum wave) get a length that is enough to feel the pattern and short enough for a
 * Short. Stories (several steps in a row) and the lesson packs keep their own timing.
 *
 * Presets that are not listed keep the length they were written with (formula presets,
 * the sound-of-graph series and the stories already have their own).
 */
export const LENGTHS = {
  // Sound · waves
  'Harmonics on a String': 24, 'Higher Note, Shorter Wave': 20, 'Square Wave from Circles': 24, 'Sawtooth from Circles': 24,
  'Beats': 24, 'Music You Can See': 24, 'Sonic Boom': 20,
  // Fourier: the last circle ends at ~20-22 s, then the finished picture stays
  'Fourier Draws a Cat': 26, 'Fourier Draws π': 26, 'Fourier Draws a Heart': 24, 'Fourier Draws a Music Note': 24, 'Fourier Butterfly': 24,
  'Guess What the Circles Draw': 24, 'Fourier Draws Batman': 24, 'Circles Write MathWaves': 24, 'Your Name in Circles': 24, 'I Love Math': 24,
  'Flag of Japan in Circles': 19, 'Flag of Canada in Circles': 24, 'Flag of Switzerland in Circles': 24, 'Flag of Türkiye in Circles': 24, 'Flag of Vietnam in Circles': 24,
  // π
  'How Archimedes Found π': 18, 'Random Dots Find π': 24, "Buffon's Needle": 24, 'π Digits Walk': 25, 'π Digits Circle': 25, 'The Sound of π': 38,
  // Calculus
  'The Sound of a Derivative': 24, 'Area Under a Curve': 18, 'Taylor Series of sin x': 19, 'Taylor Series of eˣ': 18, 'Unit Circle to Sine Wave': 24,
  // Fractals (the Mandelbrot zoom spreads over the length: shorter = faster dive)
  'Mandelbrot Zoom': 24, 'Fractal Zoom: Lightning': 24, 'Julia Set Morph': 20, 'Koch Snowflake': 17, 'Dragon Curve': 19, 'Hilbert Curve': 17,
  // Patterns
  'Radar: Every Ping Adds One': 14, 'Radar Countdown': 28, 'Radar Push': 20, 'Sierpiński From Chaos': 30, 'Golden Pentagon Chaos': 30, 'Never Twice Square': 30,
  'Sunflower': 25, 'One Degree Off': 25, 'Pendulum Wave': 30, 'DNA Zip': 14, 'Polygon Polyrhythm': 24,
  'Sorting: Quicksort': 25, 'Sorting: Merge Sort': 27, 'Sorting: Bubble Sort': 29,
  // Machines
  'Harmonograph': 24, 'Venus Dance': 28, 'Spirograph Star': 24, 'Cardioid to Chaos': 30, 'Fractal Tree': 10,
  // Physics
  'Sand on a Singing Plate': 22, 'Round Plate': 28, 'Rice on a Tall Plate': 22, 'Formula Plate': 18, "Kundt's Tubes": 24, 'Wave Interference': 18,
  'Iron Filings': 20, 'Filings on Paper': 15, 'Open vs Closed Tubes': 24, 'Double Slit': 15, 'Beam Steering': 15, 'Field Around a Wire': 15, 'Draw a Field': 14,
  // Classic circle
  'One Ball Becomes 256': 20,
  // Multiply
  'Every Hit Makes 3': 14, 'Square Core Doubler': 25, 'Grenade': 15, 'Escape & Multiply': 30, 'Escape Hexagon': 36, 'Chain Reaction': 16, 'Mitosis': 20,
  // Fill
  'Galton Board': 34, 'Pyramid Cascade': 23, 'Beat Fill': 30, 'Pachinko Rain': 38, 'Paper Cut ×256': 23, 'Golden Paper': 28, 'Sierpiński Scissors': 26, 'Mondrian Cuts': 17, 'Circle Packing': 26,
  // Bounce
  'Ball in a Spinning Hexagon': 24, 'Closing In': 28, 'Square Billiard': 24,
  // Growth
  'Colour War': 25, 'Grow Until Jammed': 34, 'Coral Reef': 28, 'Snow Crystal': 32,
  // Games
  'Rock Paper Scissors': 28, 'Rock Paper Scissors Lizard Spock': 29, 'RPS Whirlpool': 29, 'RPS Wave Field': 29, 'Scissors vs Flowers': 30, 'Needles vs Bubbles': 30,
  'Katana': 40, 'Lissajous Blade': 22, 'Star Blades': 30, 'Knife Hit': 30, 'Knife Hit: Chaos Spin': 30,
  'Rose Popper': 33, 'Heart Popper': 31, 'Spiral Popper': 45, 'Lissajous Popper': 33,
};

/** A copy of the preset with its own length. */
export const withLength = (p) => (LENGTHS[p.name] ? { ...p, transport: { ...p.transport, duration: LENGTHS[p.name] } } : p);
