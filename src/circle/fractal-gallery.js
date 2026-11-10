/**
 * One-click starting points of the Fractals tab, also the source of the "Fractals" preset shelf
 * (presets-src/fractals.js). No DOM here. Add a row to add a card and a preset.
 */

/**
 * Starting points: [name, rule, lab settings, extras]. extras: { palette (Circle palette for dots),
 * instrument, scale, root, duration }. Also the source of the "Fractals" preset shelf (presets-src/fractals.js).
 */
export const GALLERY = [
  ['Seahorse valley', 'fractal', { type: 'mandelbrot', journey: 'zoom', spot: 'seahorse', depth: 8, colors: 'fire' }, { instrument: 'glass-pad' }],
  ['Elephant valley', 'fractal', { type: 'mandelbrot', journey: 'zoom', spot: 'elephant', depth: 6, colors: 'ocean', density: 1.4 }, { instrument: 'e-piano' }],
  ['Double spiral', 'fractal', { type: 'mandelbrot', journey: 'zoom', spot: 'spiral', depth: 9, colors: 'electric' }, { instrument: 'bell' }],
  ['A tiny copy', 'fractal', { type: 'mandelbrot', journey: 'zoom', spot: 'needle', depth: 4.5, colors: 'twilight' }, { instrument: 'kalimba' }],
  ['Period doubling', 'fractal', { type: 'mandelbrot', journey: 'zoom', spot: 'feigenbaum', depth: 5, colors: 'gold', coloring: 'bands' }, { instrument: 'marimba' }],
  ['Julia morph', 'fractal', { type: 'mandelbrot', julia: true, journey: 'julia', jpath: 'circle', jr: 0.7885, jspeed: 0.04, colors: 'twilight' }, { instrument: 'warm-pad' }],
  ['Julia on the cardioid', 'fractal', { type: 'mandelbrot', julia: true, journey: 'julia', jpath: 'cardioid', jr: 0.8, jspeed: 0.03, colors: 'ice', density: 1.6 }, { instrument: 'glass-pad' }],
  ['Dendrite to rabbit', 'fractal', { type: 'mandelbrot', julia: true, journey: 'julia', jpath: 'line', jx: 0, jy: 1, jx2: -0.123, jy2: 0.745, jspeed: 0.05, colors: 'forest' }, { instrument: 'harp' }],
  ['Orbit-trap flowers', 'fractal', { type: 'mandelbrot', julia: true, journey: 'julia', jpath: 'circle', jr: 0.72, jspeed: 0.02, coloring: 'trap', trap: 'cross', colors: 'pastel', density: 1.2 }, { instrument: 'music-box' }],
  ['Striped Julia', 'fractal', { type: 'mandelbrot', julia: true, journey: 'julia', jpath: 'bulb', jspeed: 0.03, coloring: 'stripes', colors: 'candy' }, { instrument: 'vibraphone' }],
  ['Checkered field lines', 'fractal', { type: 'mandelbrot', journey: 'still', coloring: 'angle', colors: 'zebra', density: 2, cycle: 0.03 }, { instrument: 'synth-pluck' }],
  ['Burning Ship', 'fractal', { type: 'burningship', journey: 'zoom', spot: 'ship', depth: 3.2, colors: 'lava' }, { instrument: '808' }],
  ['The armada', 'fractal', { type: 'burningship', journey: 'zoom', spot: 'shipMast', depth: 3.5, colors: 'inferno', density: 1.5 }, { instrument: 'reese' }],
  ['Tricorn', 'fractal', { type: 'tricorn', journey: 'pan', zoom: 1.3, colors: 'neon', cycle: 0.04 }, { instrument: 'psy-lead' }],
  ['Celtic', 'fractal', { type: 'celtic', journey: 'still', colors: 'forest', cycle: 0.03, density: 1.5 }, { instrument: 'harp' }],
  ['Buffalo', 'fractal', { type: 'buffalo', journey: 'still', colors: 'copper', cycle: 0.03 }, { instrument: 'brass' }],
  ['Heart', 'fractal', { type: 'heart', journey: 'still', colors: 'candy', cycle: 0.04 }, { instrument: 'music-box' }],
  ['The power grows', 'fractal', { type: 'multibrot', journey: 'power', power: 2, power2: 7, colors: 'rainbow', density: 0.7 }, { instrument: 'supersaw' }],
  ['Multibrot Julia', 'fractal', { type: 'multibrot', julia: true, journey: 'julia', power: 4, jpath: 'circle', jr: 0.72, jspeed: 0.03, colors: 'aurora' }, { instrument: 'choir' }],
  ['Newton: three roots', 'fractal', { type: 'newton', journey: 'still', power: 3, colors: 'candy', cycle: 0.01, rotate: 0.01 }, { instrument: 'bell' }],
  ['Newton: roots multiply', 'fractal', { type: 'newton', journey: 'power', power: 3, power2: 8, colors: 'rainbow' }, { instrument: 'steel-drum' }],
  ['Newton, overshooting', 'fractal', { type: 'newton', journey: 'still', power: 4, relax: 1.75, colors: 'electric', rotate: 0.008 }, { instrument: 'space-arp' }],
  ['Phoenix', 'fractal', { type: 'phoenix', julia: true, journey: 'julia', jpath: 'line', jx: 0.5667, jy: -0.5, jx2: 0.4, jy2: -0.32, jspeed: 0.03, colors: 'gold' }, { instrument: 'santur' }],
  ['Logistic map in the plane', 'fractal', { type: 'lambda', journey: 'still', colors: 'viridis', cycle: 0.03 }, { instrument: 'e-piano' }],
  ['Orbits you can hear', 'fractal', { type: 'mandelbrot', journey: 'pan', zoom: 1.2, colors: 'mono', showOrbit: true, sound: 'orbit', nps: 4 }, { instrument: 'kalimba' }],
  ['Buddhabrot', 'buddha', { colors: 'twilight' }, { instrument: 'choir', duration: 45 }],
  ['Buddhabrot, deep orbits', 'buddha', { minIter: 60, maxIter: 1200, rate: 1600, colors: 'gold', gain: 1.8 }, { instrument: 'drone', duration: 60 }],
  ['Anti-Buddhabrot', 'buddha', { anti: true, colors: 'ocean', rate: 1500, gain: 1.1 }, { instrument: 'glass-pad', duration: 40 }],
  ['Lyapunov AB (swallow)', 'lyapunov', { seq: 'AB', a0: 2, a1: 4, b0: 2, b1: 4, colors: 'copper' }, { instrument: 'warm-pad' }],
  ['Zircon Zity', 'lyapunov', { seq: 'BBBBBBAAAAAA', a0: 3.4, a1: 4, b0: 2.5, b1: 3.4, colors: 'gold', iters: 240 }, { instrument: 'bell' }],
  ['Lyapunov AABAB', 'lyapunov', { seq: 'AABAB', a0: 2.6, a1: 4, b0: 2.6, b1: 4, colors: 'aurora' }, { instrument: 'glass-pad' }],
  ["Barnsley's fern", 'ifs', { system: 'fern' }, { palette: 'matrix', instrument: 'kalimba' }],
  ['Dragon', 'ifs', { system: 'dragon', colorBy: 'time' }, { palette: 'fire', instrument: 'marimba' }],
  ['Maple leaf', 'ifs', { system: 'maple', colorBy: 'height' }, { palette: 'sunset', instrument: 'harp' }],
  ['Pentaflake', 'ifs', { system: 'pentaflake' }, { palette: 'ice', instrument: 'music-box' }],
  ['Sierpiński carpet', 'ifs', { system: 'carpet' }, { palette: 'candy', instrument: 'synth-pluck' }],
  ['Lévy C curve', 'ifs', { system: 'levy', colorBy: 'time' }, { palette: 'aurora', instrument: 'bell' }],
  ['Spiral', 'ifs', { system: 'spiral', colorBy: 'time' }, { palette: 'rainbow', instrument: 'vibraphone' }],
];

