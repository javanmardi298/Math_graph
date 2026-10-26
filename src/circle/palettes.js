/**
 * Circle Lab colour palettes. `line(h)` maps any number to a colour of the palette
 * (only its fractional part matters), so hue counters can grow forever.
 */
export const frac = (x) => x - Math.floor(x);

export const PALETTES = {
  neon: { ring: '#9ff6ff', glow: '#22e4ff', ball: '#cfe9ff', glow2: '#7b5cff', line: (h) => `hsl(${195 + 50 * frac(h)} 90% 66%)` },
  rainbow: { ring: '#ffffff', glow: '#b48cff', ball: '#ffffff', glow2: '#ff5ca8', line: (h) => `hsl(${360 * frac(h)} 95% 62%)` },
  sunset: { ring: '#ffd9a8', glow: '#ff6b8b', ball: '#fff1dc', glow2: '#ffb340', line: (h) => `hsl(${(330 + 70 * frac(h)) % 360} 95% 64%)` },
  gold: { ring: '#ffe7a3', glow: '#ffb340', ball: '#fff4cf', glow2: '#ff7a2f', line: (h) => `hsl(${38 + 14 * frac(h)} 95% ${55 + 15 * frac(h * 3)}%)` },
  aurora: { ring: '#c9ffe8', glow: '#3dffb0', ball: '#e9fff6', glow2: '#4d7cff', line: (h) => `hsl(${140 + 140 * frac(h)} 85% 62%)` },
  candy: { ring: '#ffe3f6', glow: '#ff6fd8', ball: '#ffffff', glow2: '#6fd6ff', line: (h) => `hsl(${[330, 285, 195, 160, 50][Math.floor(frac(h) * 5)]} 90% ${68 + 8 * frac(h * 5)}%)` },
  ocean: { ring: '#bff3ff', glow: '#1f8fff', ball: '#e8fbff', glow2: '#00e0c6', line: (h) => `hsl(${170 + 60 * frac(h)} 85% ${50 + 20 * frac(h * 2)}%)` },
  fire: { ring: '#ffe0b0', glow: '#ff4d1f', ball: '#fff3d6', glow2: '#ffcc33', line: (h) => `hsl(${5 + 50 * frac(h)} 100% ${52 + 14 * frac(h * 2)}%)` },
  pastel: { ring: '#ffffff', glow: '#c6b5ff', ball: '#ffffff', glow2: '#ffc6e0', line: (h) => `hsl(${360 * frac(h)} 80% 78%)` },
  matrix: { ring: '#b6ffcf', glow: '#20ff70', ball: '#e6ffee', glow2: '#00b35c', line: (h) => `hsl(${120 + 25 * frac(h)} 90% ${45 + 25 * frac(h * 3)}%)` },
  mono: { ring: '#ffffff', glow: '#9fb4ff', ball: '#ffffff', glow2: '#ffffff', line: () => 'rgba(235,240,255,0.95)' },
  // inks for the harmonograph (also good on light paper): sepia, indigo, rose gold, ember, ice, verdigris, peacock
  sepia: { ring: '#6b4a24', glow: '#a8742f', ball: '#3b2410', glow2: '#7a4a1c', line: (h) => `hsl(${22 + 14 * frac(h)} 62% ${16 + 12 * frac(h * 2)}%)` },
  indigo: { ring: '#2a2f78', glow: '#3b44c7', ball: '#14174a', glow2: '#5a2fa8', line: (h) => `hsl(${228 + 56 * frac(h)} 62% ${30 + 16 * frac(h * 2)}%)` },
  rosegold: { ring: '#ffd9cf', glow: '#f2a5a0', ball: '#fff0ea', glow2: '#e8c7a0', line: (h) => `hsl(${8 + 26 * frac(h)} 70% ${70 + 12 * frac(h * 2)}%)` },
  ember: { ring: '#ffd2a0', glow: '#ff7a2f', ball: '#fff0dc', glow2: '#c8203a', line: (h) => `hsl(${(354 + 50 * frac(h)) % 360} 92% ${50 + 14 * frac(h * 3)}%)` },
  ice: { ring: '#e6fbff', glow: '#7fe3ff', ball: '#ffffff', glow2: '#b9a8ff', line: (h) => `hsl(${186 + 74 * frac(h)} 85% ${72 + 12 * frac(h * 2)}%)` },
  verdigris: { ring: '#d6fff1', glow: '#2fd6b0', ball: '#effff9', glow2: '#2f8f7f', line: (h) => `hsl(${150 + 40 * frac(h)} 60% ${52 + 18 * frac(h * 2)}%)` },
  peacock: { ring: '#cfeeff', glow: '#1fb6ff', ball: '#ffffff', glow2: '#16a085', line: (h) => `hsl(${[190, 170, 215, 150, 255][Math.floor(frac(h) * 5)]} 80% ${52 + 10 * frac(h * 5)}%)` },
};

export const CIRCLE_PALETTES = {
  neon: 'Neon blue', rainbow: 'Rainbow', sunset: 'Sunset', gold: 'Gold', aurora: 'Aurora', candy: 'Candy',
  ocean: 'Ocean', fire: 'Fire', pastel: 'Pastel', matrix: 'Radar green', mono: 'White ink',
  sepia: 'Sepia ink', indigo: 'Indigo ink', rosegold: 'Rose gold', ember: 'Ember', ice: 'Ice', verdigris: 'Verdigris', peacock: 'Peacock',
};

export const paletteOf = (name) => PALETTES[name] || PALETTES.neon;

/** "#rrggbb" + alpha → rgba() */
export function hexA(hex, a) {
  const n = parseInt(String(hex).slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
