/**
 * Classroom: five-minute lessons in 16:9, step by step, for advanced high school. Each step is one
 * idea: a short title at the bottom, a large centred formula at the top, and a drawing that the
 * camera frames. Steps follow each other on the timeline (each layer has its own window and
 * finishes drawing in `drawFor` seconds, then stays until its step ends), so every lesson is an
 * ordinary preset you can edit on the timeline.
 *
 *   Sine Waves from a Circle        the unit circle, amplitude, frequency, phase, beats
 *   Fourier: Any Wave from Sines    square, sawtooth and triangle waves, the Gibbs overshoot, epicycles
 *   Parametric and Polar Curves     Lissajous ratios, phase, roses, the cardioid, spirals
 *   The Number e                    growth, slope = value, compound interest, ln, damping, Euler
 *   Chaos from a Simple Rule        the logistic map: 1, 2, 4 values, chaos, sensitivity, Lorenz
 */
const TAU = Math.PI * 2;
const r3 = (v) => +v.toFixed(4);
const CAT = 'Classroom · Lessons (16:9, 5 min)';
const TAGS = 'math lesson, trigonometry, fourier, calculus, chaos, high school math, education, math animation';

/** Short title at the bottom of the frame. */
const T = (text, start, end, { y = 0.9, size = 0.7 } = {}) => ({ id: `t${Math.round(start * 10)}-${text.length}`, text, x: 0.5, y, size, color: '#ffffff', font: 'display', align: 'center', bold: true, box: true, glow: false, start: r3(start), end: r3(end) });

/* layer makers (formula text shown on video = `say`; context layers are silent and unlabelled) */
const base = { width: 3.2, colorMode: 'solid', wave: 'e-piano', volume: 0.85, samples: 1600 };
const PA = (x, y, min, max, say, o = {}) => ({ ...base, type: 'parametric', exprs: { x, y, z: '0' }, range: { min: r3(min), max: r3(max) }, caption: say ?? '-', ...o });
const PO = (r, min, max, say, o = {}) => ({ ...base, type: 'polar', exprs: { r, z: '0' }, range: { min: r3(min), max: r3(max) }, caption: say ?? '-', ...o });
const FN = (y, say, o = {}) => ({ ...base, type: 'function', exprs: { y, z: '0' }, caption: say ?? '-', ...o });
const MAP = (x, y, say, o = {}) => ({ ...base, type: 'map', exprs: { x, y, z: '0' }, caption: say ?? '-', width: 5, volume: 0, samples: 400, sim: { skip: 0, alpha: 1, ...(o.sim || {}) }, ...o });
const ODE = (x, y, z, sim, say, o = {}) => ({ ...base, type: 'ode', exprs: { x, y, z }, sim: { skip: 0, ...sim }, caption: say ?? '-', samples: 6000, width: 2.4, ...o });
/** A faint, silent reference drawing. */
const ghost = (l) => ({ ...l, caption: '-', volume: 0, width: 1.6, color: '#7f8aa8', color2: '#7f8aa8', colorMode: 'solid' });

const COLORS = ['#5ee0ff', '#ffd166', '#ff7a9a', '#7be0c3', '#c58cff', '#ff9a5a', '#9fe8ff', '#a4ff9e', '#ffb347', '#ff5a8a'];

/**
 * One lesson. steps: [{ title, layers, frame: [cx, cy, halfHeight], dur }]; the first layer of a step
 * is the main one (it sounds and shows its formula), the others are references.
 */
function lesson(name, { view, steps, intro, outro, scale = 'pentatonic', root = 0, bg = '#0b1020', grid = '#1a2340', axes = '#4a5784', hook, title, desc, about, lo = 48, hi = 79 }) {
  const t0 = 4.5, gap = 0.8;
  let t = t0;
  const layers = [], texts = [T(intro, 0.4, t0 + 0.3, { y: 0.5, size: 1.1 })], pose = [];
  const H = (view.yMax - view.yMin) / 2, cx0 = (view.xMin + view.xMax) / 2, cy0 = (view.yMin + view.yMax) / 2;
  // 2D camera poses are relative to the window's centre (the drawing is shifted so the centre is at 0)
  const P = (time, [cx, cy, hh]) => ({ time: r3(time), value: { mode: '2d', p: [r3(cx - cx0), r3(cy - cy0), 50], t: [r3(cx - cx0), r3(cy - cy0), 0], zoom: r3(H / hh) }, frame: [cx, cy, hh], ease: 'smooth' });
  pose.push(P(0, [cx0, cy0, H]));
  steps.forEach((st, i) => {
    const dur = st.dur ?? 32, s = t, e = t + dur;
    const frame = st.frame || [cx0, cy0, H];
    pose.push(P(s, pose.at(-1).frame), P(s + 1.6, frame));
    texts.push(T(`${i + 1}. ${st.title}`, s + 0.3, e - 0.2));
    st.layers.forEach((l, j) => {
      const main = j === 0 || l.main;
      layers.push({
        name: `${i + 1}${'abcdefgh'[j]} ${st.title}`, color: COLORS[i % COLORS.length], color2: COLORS[(i + 3) % COLORS.length], ...l,
        start: r3(s + gap), end: r3(e), drawFor: r3(l.drawFor ?? Math.min(dur * 0.55, 15)),
        captionStart: main && l.caption !== '-' ? r3(s + gap) : 0, captionEnd: main && l.caption !== '-' ? r3(e - 0.3) : 0,
        ...(main ? {} : { caption: '-' }),
      });
    });
    t = e;
  });
  const D = r3(t + 6);
  texts.push(T(outro, t + 0.4, D - 0.2, { y: 0.88, size: 0.75 }));
  pose.push(P(t + 0.2, pose.at(-1).frame), P(t + 2, [cx0, cy0, H]));
  for (const k of pose) delete k.frame;
  return {
    name, $category: CAT, mode: '2d', transport: { duration: D, bpm: 90 }, view,
    sequence: { enabled: false, past: 'hide' },
    layers,
    visual: {
      aspect: '16:9', drawMode: 'trace', background: bg, gridColor: grid, axesColor: axes, showGrid: true, showAxes: true, showLabels: true,
      backdrop: 'vignette', backdropColor: '#3a4cff', tone: 'soft', exposure: 1, loop: 'off', letterbox: 0,
      fx: { style: 'tube', tail: 1, offset: 3, strings: 90, stringAlpha: 0.16, hold: 0, intensity: 0.9, copies: 6 },
      bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.15 }, trail: { enabled: true, count: 80, size: 4 },
      marker: { shape: 'circle', size: 24, smoothing: 0.25, cursorLine: false },
    },
    camera: { ending: 'cinema', endingSecs: 4.5, endingBars: 0, track: 0, zoom: 1, roll: 0 },
    audio: { master: 0.85, scale, root, noteLow: lo, noteHigh: hi, glide: 20, articulation: 'pluck', reverb: { decay: 2.6, mix: 0.25, tone: 0.8, preDelay: 0.01 }, delay: { time: 0.375, feedback: 0.2, mix: 0.08, pingpong: false } },
    rhythm: { enabled: false, showGrid: false },
    overlay: { layout: 4, name: { enabled: false }, title: { enabled: false }, formulas: { enabled: true, align: 'center', box: true, x: 0.5, y: 0.045, size: 2.2, fit: true, start: 0, end: 0 }, texts },
    keyframes: { tracks: { 'camera.pose': pose }, autoKey: false },
    hook: { text: hook },
    youtube: { title: `${title}`, description: `${desc}\n\nA five-minute visual lesson.`, tags: TAGS },
    about,
  };
}

/* Fourier helpers */
const sum = (n, term) => Array.from({ length: n }, (_, i) => term(i + 1)).join('+');
const square = (n, v = 'x') => `(4/pi)*(${sum(n, (k) => `sin(${2 * k - 1}*${v})/${2 * k - 1}`)})`;
const saw = (n, v = 'x') => `(2/pi)*(${sum(n, (k) => `${k % 2 ? '' : '-'}sin(${k}*${v})/${k}`).replace(/\+-/g, '-')})`;
const tri = (n, v = 'x') => `(8/pi^2)*(${sum(n, (k) => `${k % 2 ? '' : '-'}sin(${2 * k - 1}*${v})/${(2 * k - 1) ** 2}`).replace(/\+-/g, '-')})`;

/* ------------------------------------------------------------------- lessons */

const SINE_VIEW = { xMin: -2.6, xMax: 13.4, yMin: -4.5, yMax: 4.5 };
const wave = (y, say, o) => PA('2+s', y, 0, 11, say, o); // the wave starts just right of the circle

const LESSONS = [
  lesson('Lesson: Sine Waves from a Circle', {
    view: SINE_VIEW, intro: 'Sine waves from a circle', outro: 'y = A·sin(ωx + φ): every pure tone', scale: 'major', root: 2,
    steps: [
      { title: 'A point goes round a circle', frame: [0, 0, 2.2], layers: [PA('cos(s)', 'sin(s)', 0, TAU, 'x = cos t,   y = sin t')] },
      { title: 'Its height, drawn over time, is a sine wave', layers: [wave('sin(s)', 'y = sin x'), ghost(PA('cos(s)', 'sin(s)', 0, TAU))] },
      { title: 'Amplitude: how tall', layers: [wave('2.5*sin(s)', 'y = 2.5 · sin x'), ghost(wave('sin(s)'))] },
      { title: 'Frequency: how fast', layers: [wave('sin(2*s)', 'y = sin(2x)'), ghost(wave('sin(s)'))] },
      { title: 'Phase: when it starts', layers: [wave('sin(s+pi/2)', 'y = sin(x + π/2) = cos x'), ghost(wave('sin(s)'))] },
      { title: 'All three together', layers: [wave('2*sin(1.5*s+1)', 'y = A · sin(ωx + φ)\nA = 2,  ω = 1.5,  φ = 1')] },
      { title: 'Two waves add up', layers: [wave('sin(s)+0.6*sin(3*s)', 'y = sin x + 0.6 · sin 3x'), ghost(wave('sin(s)')), ghost(wave('0.6*sin(3*s)'))] },
      { title: 'Almost equal frequencies: beats', layers: [wave('1.6*(sin(6*s)+sin(6.6*s))/2', 'sin 6x + sin 6.6x = 2·cos(0.3x)·sin(6.3x)'), ghost(wave('1.6*cos(0.3*s)')), ghost(wave('-1.6*cos(0.3*s)'))] },
      { title: 'This is what you hear: A = loud, ω = pitch', layers: [wave('2*sin(4*s)*exp(-0.15*s)', 'y = A · e^(−kx) · sin(ωx)')] },
    ],
    hook: 'Where does a sine wave come from?', title: 'Sine waves from a circle: amplitude, frequency, phase, beats (5-minute lesson)',
    desc: 'The unit circle, the sine wave, amplitude, frequency, phase, adding waves and beats, step by step.',
    about: { title: 'Sine waves from a circle', math: 'x = cos t, y = sin t; y = A sin(ωx + φ); sin a + sin b = 2 cos((a − b)/2) sin((a + b)/2).', aha: 'Two nearly equal tones make a slow swelling (beats) at the difference of their frequencies: that is how musicians tune.', why: 'Every pure tone, alternating current, light and radio wave is A sin(ωt + φ).' },
  }),

  lesson('Lesson: Fourier, Any Wave from Sines', {
    view: { xMin: -1, xMax: 13.2, yMin: -4, yMax: 4 }, intro: 'Any wave from sine waves', outro: 'Every repeating wave is a sum of sines', scale: 'minorPentatonic', root: 9,
    steps: [
      { title: 'Start with one sine', layers: [FN('sin(x)', 'y = sin x')] },
      { title: 'Add a third harmonic', layers: [FN(square(2), 'y = (4/π)(sin x + sin 3x / 3)'), ghost(FN('sign(sin(x))'))] },
      { title: 'Keep adding odd harmonics', layers: [FN(square(5), 'y = (4/π) Σ sin((2k−1)x) / (2k−1),   5 terms'), ghost(FN('sign(sin(x))'))] },
      { title: '25 terms: a square wave', layers: [FN(square(25), '25 terms → square wave'), ghost(FN('sign(sin(x))'))], frame: [6.1, 0, 4] },
      { title: 'Gibbs: a 9% overshoot that never goes away', frame: [3.14, 1, 0.55], layers: [FN(square(25), 'peak ≈ 1.18 at any number of terms', { samples: 3000 }), ghost(FN('1'))] },
      { title: 'All harmonics: a sawtooth', layers: [FN(saw(20), 'y = (2/π) Σ (−1)^(k+1) sin(kx) / k')] },
      { title: '1/k²: a soft triangle', layers: [FN(tri(8), 'y = (8/π²) Σ (−1)^(k+1) sin((2k−1)x) / (2k−1)²')] },
      { title: 'Faster decay = smoother wave', layers: [FN(tri(8), 'triangle: 1/k²   (smooth)'), { ...FN(saw(20), '-'), main: false, volume: 0, width: 2, color: '#ff7a9a', colorMode: 'solid' }, { ...FN(square(25), '-'), main: false, volume: 0, width: 2, color: '#7be0c3', colorMode: 'solid' }] },
      { title: 'Circles on circles draw it (epicycles)', frame: [6.1, 0, 3], layers: [PA(`6.1+2.2*(${sum(6, (k) => `cos(${2 * k - 1}*s)/${2 * k - 1}`)})`, `2.2*(${sum(6, (k) => `sin(${2 * k - 1}*s)/${2 * k - 1}`)})`, 0, TAU, 'x = Σ cos((2k−1)t)/(2k−1),   y = Σ sin((2k−1)t)/(2k−1)', { samples: 2400 })] },
    ],
    hook: 'How do you build a square out of sine waves?', title: 'Fourier series: build any wave from sines, with the Gibbs overshoot (5-minute lesson)',
    desc: 'Square, sawtooth and triangle waves from sines, the Gibbs phenomenon, and Fourier epicycles.',
    about: { title: 'Fourier series', math: 'square: (4/π) Σ sin((2k−1)x)/(2k−1); sawtooth: (2/π) Σ (−1)^(k+1) sin(kx)/k; triangle: (8/π²) Σ (−1)^(k+1) sin((2k−1)x)/(2k−1)².', aha: 'Jumps need terms that shrink only like 1/k and leave a 9% overshoot (Gibbs); corners need 1/k²; smooth curves need even faster decay.', why: 'MP3 and JPEG keep only the strongest Fourier terms; the timbre of an instrument is its list of harmonics.' },
  }),

  lesson('Lesson: Parametric and Polar Curves', {
    view: { xMin: -3.56, xMax: 3.56, yMin: -2, yMax: 2 }, intro: 'Curves from two clocks', outro: 'x(t), y(t)  or  r(θ): two ways to draw', scale: 'dorian', root: 2,
    steps: [
      { title: 'Two equal clocks: a line', layers: [PA('1.4*sin(s)', '1.4*sin(s)', 0, TAU, 'x = sin t,   y = sin t')] },
      { title: 'y runs twice as fast: a figure eight', layers: [PA('1.4*sin(s)', '1.4*sin(2*s)', 0, TAU, 'x = sin t,   y = sin 2t')] },
      { title: 'Ratio 3 : 2', layers: [PA('1.4*sin(3*s)', '1.4*sin(2*s)', 0, TAU, 'x = sin 3t,   y = sin 2t')] },
      { title: 'A phase shift changes the shape', layers: [PA('1.4*sin(3*s+pi/2)', '1.4*sin(2*s)', 0, TAU, 'x = sin(3t + π/2),   y = sin 2t'), ghost(PA('1.4*sin(3*s)', '1.4*sin(2*s)', 0, TAU))] },
      { title: 'Polar: distance r at angle θ', layers: [PO('1.4', 0, TAU, 'r = 1.4   (a circle)')] },
      { title: 'Roses: r = cos(kθ)', layers: [PO('1.4*cos(2*theta)', 0, TAU, 'r = cos 2θ   →   4 petals')] },
      { title: 'Odd k: only k petals', layers: [PO('1.4*cos(3*theta)', 0, Math.PI, 'r = cos 3θ   →   3 petals'), ghost(PO('1.4*cos(2*theta)', 0, TAU))] },
      { title: 'The cardioid', layers: [PO('0.7*(1-sin(theta))', 0, TAU, 'r = 1 − sin θ'), ghost(PO('1.4', 0, TAU))] },
      { title: 'A spiral: r grows with θ', layers: [PO('0.05*theta', 0, 30, 'r = 0.05 θ   (Archimedes)', { samples: 2400 })] },
    ],
    hook: 'How do you draw with two clocks?', title: 'Parametric and polar curves: Lissajous, roses, cardioid, spiral (5-minute lesson)',
    desc: 'Lissajous figures from frequency ratios and phase, polar roses and their petal rule, the cardioid, the Archimedean spiral.',
    about: { title: 'Parametric and polar curves', math: 'Parametric: x = sin(at + φ), y = sin(bt). Polar: x = r cos θ, y = r sin θ with r = cos kθ, 1 − sin θ, cθ.', aha: 'A rose r = cos kθ has 2k petals when k is even and k petals when k is odd (the odd one retraces itself after half a turn).', why: 'Oscilloscopes show Lissajous figures to compare two frequencies; cams and gears are cut from polar curves.' },
  }),

  lesson('Lesson: The Number e', {
    view: { xMin: -4, xMax: 12, yMin: -2, yMax: 7 }, intro: 'The number e ≈ 2.718', outro: 'e^(iπ) + 1 = 0', scale: 'lydian', root: 0,
    steps: [
      { title: 'Doubling: 2 to the x', layers: [FN('2^x', 'y = 2^x'), ghost(FN('0'))] },
      { title: 'e^x: its slope equals its height', layers: [FN('exp(x)', 'y = e^x,    slope = e^x'), ghost(FN('x+1')), ghost(FN('2^x'))], frame: [0, 1.5, 2.4] },
      { title: 'Growth and decay', layers: [FN('exp(-x)', 'y = e^(−x)'), ghost(FN('exp(x)'))], frame: [0, 2, 3] },
      { title: 'Interest every instant: (1 + 1/n)^n → e', layers: [PA('s', '(1+1/s)^s', 0.3, 12, 'y = (1 + 1/n)^n   →   e ≈ 2.718', { samples: 2000 }), ghost(FN('2.71828'))], frame: [5, 2.5, 2.2] },
      { title: 'The logarithm undoes it', layers: [PA('s', 'ln(s)', 0.03, 12, 'y = ln x   (mirror of e^x in y = x)', { samples: 2000 }), ghost(FN('exp(x)')), ghost(FN('x'))], frame: [1.5, 1.5, 3.4] },
      { title: 'Damping: a sine that fades', layers: [FN('3*exp(-0.25*x)*sin(3*x)', 'y = 3 · e^(−0.25x) · sin 3x', { samples: 3000 }), ghost(FN('3*exp(-0.25*x)')), ghost(FN('-3*exp(-0.25*x)'))], frame: [4, 0.5, 4] },
      { title: 'e^(iθ) walks round the unit circle', frame: [0, 0, 1.6], layers: [PA('cos(s)', 'sin(s)', 0, TAU, 'e^(iθ) = cos θ + i·sin θ')] },
      { title: 'A spiral that keeps its angle', frame: [0, 0.4, 4.2], layers: [PA('exp(0.12*s)*cos(s)', 'exp(0.12*s)*sin(s)', -12, 11, 'r = e^(0.12θ)   (logarithmic spiral)', { samples: 2400 })] },
      { title: 'Half a turn: e^(iπ) = −1', frame: [0, 0, 1.6], layers: [PA('cos(s)', 'sin(s)', 0, Math.PI, 'e^(iπ) + 1 = 0', { drawFor: 10 }), ghost(PA('cos(s)', 'sin(s)', 0, TAU))] },
    ],
    hook: 'Why is e the most natural number?', title: 'The number e: growth, compound interest, logarithms and Euler’s formula (5-minute lesson)',
    desc: 'Exponential growth, why e^x is its own slope, (1 + 1/n)^n, ln x, damping, e^(iθ) and the logarithmic spiral.',
    about: { title: 'The number e', math: 'd/dx e^x = e^x; e = lim (1 + 1/n)^n; ln is the inverse of e^x; e^(iθ) = cos θ + i sin θ.', aha: 'e is the only base whose curve has slope 1 at x = 0, so growth exactly proportional to size is always e^(kt).', why: 'Interest, populations, radioactive decay, cooling, charging capacitors and every damped vibration.' },
  }),

  lesson('Lesson: Chaos from a Simple Rule', {
    view: { xMin: -0.5, xMax: 15.5, yMin: -2.5, yMax: 6.5 }, intro: 'Chaos from one simple rule', outro: 'Simple rules, unpredictable results', scale: 'phrygian', root: 4, bg: '#0d0b1a',
    steps: [
      { title: 'The rule: next = r · x · (1 − x)', frame: [2, 0.5, 1.2], layers: [MAP('x+0.12', '2.8*y*(1-y)', 'x(n+1) = r · x(n) · (1 − x(n)),   r = 2.8', { sim: { x0: 0, y0: 0.1 }, samples: 34, width: 3.2, volume: 0.8 }), ghost(FN('0.643'))] },
      { title: 'r = 2.8: it settles on one value', frame: [2, 0.5, 1.2], layers: [MAP('x+0.12', '2.8*y*(1-y)', 'r = 2.8  →  x → 1 − 1/r ≈ 0.643', { sim: { x0: 0, y0: 0.1 }, samples: 34, width: 3.2, volume: 0.8 })] },
      { title: 'r = 3.2: it flips between two', frame: [2, 0.5, 1.2], layers: [MAP('x+0.12', '3.2*y*(1-y)', 'r = 3.2  →  two values', { sim: { x0: 0, y0: 0.1 }, samples: 34, width: 3.2, volume: 0.8 })] },
      { title: 'r = 3.5: four values', frame: [2, 0.5, 1.2], layers: [MAP('x+0.12', '3.5*y*(1-y)', 'r = 3.5  →  four values', { sim: { x0: 0, y0: 0.1 }, samples: 34, width: 3.2, volume: 0.8 })] },
      { title: 'r = 3.9: chaos', frame: [2, 0.5, 1.2], layers: [MAP('x+0.12', '3.9*y*(1-y)', 'r = 3.9  →  never repeats', { sim: { x0: 0, y0: 0.1 }, samples: 34, width: 3.2, volume: 0.8 })] },
      { title: 'All r at once: the bifurcation diagram', frame: [7.5, 1.6, 2], layers: [MAP('2.8+1.2*n/60000', 'x*y*(1-y)', 'periods 1 → 2 → 4 → 8 … → chaos at r ≈ 3.57', { sim: { x0: 2.8, y0: 0.5, alpha: 0.25, cx: 1.034, cy: 0, scale: 3.17 }, samples: 60000, width: 1.6, colorMode: 'gradient', color: '#5ee0ff', color2: '#ffd166' })] },
      { title: 'Start 0.0001 apart: they part ways', frame: [2, 0.5, 1.2], layers: [MAP('x+0.12', '3.9*y*(1-y)', 'x₀ = 0.2   vs   x₀ = 0.2001', { sim: { x0: 0, y0: 0.2 }, samples: 34, width: 3.2, color: '#ffd166', volume: 0.8 }), { ...MAP('x+0.12', '3.9*y*(1-y)', '-', { sim: { x0: 0, y0: 0.2001 }, samples: 34, width: 2.4, color: '#5ee0ff' }), main: false }] },
      { title: 'Lorenz’s weather: the same lesson in 3 variables', frame: [7.5, 2, 4.5], layers: [ODE('10*(y-x)', 'x*(28-z)-y', 'x*y-8/3*z', { x0: 1, y0: 1, z0: 1, dt: 0.006, up: 'z', cx: -44, cz: 14, scale: 0.17 }, "x' = 10(y − x),  y' = x(28 − z) − y,  z' = xy − 8z/3", { samples: 7000, colorMode: 'gradient', color: '#ff7a59', color2: '#5ee0ff' })] },
      { title: 'Deterministic, yet unpredictable', frame: [7.5, 2, 4.5], layers: [ODE('10*(y-x)', 'x*(28-z)-y', 'x*y-8/3*z', { x0: 1, y0: 1, z0: 1, dt: 0.006, up: 'z', cx: -44, cz: 14, scale: 0.17 }, 'tiny causes → big effects', { samples: 7000, color: '#ff7a59' }), { ...ODE('10*(y-x)', 'x*(28-z)-y', 'x*y-8/3*z', { x0: 1.0001, y0: 1, z0: 1, dt: 0.006, up: 'z', cx: -44, cz: 14, scale: 0.17 }, '-', { samples: 7000, color: '#5ee0ff' }), main: false, volume: 0.5 }] },
    ],
    hook: 'Can one simple rule be unpredictable?', title: 'Chaos from a simple rule: the logistic map and the butterfly effect (5-minute lesson)',
    desc: 'The logistic map step by step: a fixed point, period 2, period 4, chaos, the bifurcation diagram, sensitivity to the start, and Lorenz’s equations.',
    about: { title: 'Chaos from a simple rule', math: 'xₙ₊₁ = r·xₙ(1 − xₙ): one value for r < 3, two above 3, four above 1 + √6 ≈ 3.449, chaos from r ≈ 3.5699 (each doubling 4.669 times sooner, Feigenbaum).', aha: 'Nothing random is in the rule, yet two starts 0.0001 apart soon disagree completely: sensitive dependence on initial conditions.', why: 'Population models, dripping taps, heart rhythms, weather forecasts.' },
  }),
];

export const CLASSROOM_PRESETS = LESSONS;
