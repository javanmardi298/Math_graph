/**
 * How a curve can be drawn (visual.fx.style). The additive ones (glitch, web, kaleido, echo)
 * glow and add up where lines cross; the normal-blend ones (prism, ink, beads) keep their colour
 * and never wash out to white, so they suit bright and dense curves and light backdrops.
 */
export const FX_STYLES = {
  off: 'Plain line',
  glitch: 'Glitch: red · green · cyan (additive)',
  prism: 'Prism: magenta · yellow · cyan (keeps its colour, no white-out)',
  string: 'String art: strings from the centre',
  web: 'Laser web: tail and chords from the pen',
  echo: 'Echo: shrinking, turning copies (a vortex)',
  kaleido: 'Kaleidoscope: 2–6 turned copies',
  ink: 'Ink: solid line, no glow',
  beads: 'Beads: a string of pearls',
  tube: 'Neon tube: soft halo, fading tail',
  comet: 'Comet: a short bright tail',
  rainbow: 'Rainbow flow: colours run along the curve (psychedelic)',
  pulse: 'Pulse: beads of light travel along the curve',
  ants: 'Marching ants: dashes that run along the curve',
  mirror: 'Mirror: four reflected copies',
  sketch: 'Pencil sketch: three fine strokes',
  glitchString: 'Glitch + string art',
  prismString: 'Prism + string art',
  rainbowString: 'Rainbow flow + string art',
};

/** What each style draws: coloured copies (`lines`), strings from the centre or the pen, beads. */
export const FX_PARTS = {
  off: {}, glitch: { lines: 'glitch' }, prism: { lines: 'prism' }, string: { string: true }, web: { lines: 'web', web: true },
  echo: { lines: 'echo' }, kaleido: { lines: 'kaleido' }, ink: { lines: 'ink' }, beads: { beads: true },
  tube: { lines: 'tube' }, comet: { lines: 'comet' }, rainbow: { lines: 'rainbow' }, pulse: { lines: 'pulse' }, ants: { lines: 'ants' },
  mirror: { lines: 'mirror' }, sketch: { lines: 'sketch' },
  glitchString: { lines: 'glitch', string: true }, prismString: { lines: 'prism', string: true }, rainbowString: { lines: 'rainbow', string: true },
};
