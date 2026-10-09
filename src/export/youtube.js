/**
 * YouTube Shorts metadata for a preset: title, description and tags. They travel
 * inside the preset (state.youtube) and next to every exported video as a .txt,
 * never inside the video itself. Presets without them get a suggestion built from
 * their name and formulas.
 */

const TITLE_MAX = 100; // YouTube's limit
const DESC_MAX = 5000;
const BASE_TAGS = ['math', 'mathematics', 'math visualization', 'math music', 'sonification', 'graphs', 'math art', 'shorts'];

const FORMULA_KEYS = { function: ['y'], parametric: ['x', 'y'], polar: ['r'], surface: ['f'] };

/** One readable line per enabled layer, e.g. "y = sin(2x)". */
export function formulaLines(state) {
  return (state.layers || []).filter((l) => l.enabled !== false).map((l) => {
    const keys = FORMULA_KEYS[l.type] || ['y'];
    return keys.map((k) => `${k === 'f' ? 'h' : k} = ${String(l.exprs?.[k] ?? '').trim()}`).join(',  ');
  });
}

export function suggestYoutube(state) {
  const name = (state.name || 'Math Melody').trim();
  const layers = (state.layers || []).filter((l) => l.enabled !== false).length;
  const title = `${name}: math you can hear 🎵 #shorts`.slice(0, TITLE_MAX);
  const description = [
    `${name}: ${layers > 1 ? `${layers} graphs drawn one after another` : 'a graph drawn live'}, and every point of the curve is turned into a musical note.`,
    'Higher on the graph = higher pitch.',
    '',
    'Formulas:',
    ...formulaLines(state).map((f) => `• ${f}`),
    '',
    '#math #mathematics #mathart #shorts',
  ].join('\n');
  return { title, description, tags: BASE_TAGS.join(', ') };
}

/** The preset's own metadata, with suggestions filling any empty field. */
export function youtubeFor(state) {
  const own = state.youtube || {};
  const auto = suggestYoutube(state);
  return {
    title: (own.title || '').trim().slice(0, TITLE_MAX) || auto.title,
    description: (own.description || '').trim().slice(0, DESC_MAX) || auto.description,
    tags: (own.tags || '').trim() || auto.tags,
  };
}

/** Text file that sits next to a video. */
export function youtubeText(meta, videoFile = '') {
  return [
    videoFile ? `VIDEO\n${videoFile}\n` : '',
    `TITLE\n${meta.title}\n`,
    `DESCRIPTION\n${meta.description}\n`,
    `TAGS\n${meta.tags}\n`,
  ].filter(Boolean).join('\n');
}

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/** One row per video: file, title, description, tags (UTF-8 with BOM so Excel shows Persian correctly). */
export function youtubeCsv(rows) {
  const lines = [['file', 'title', 'description', 'tags'].map(csvCell).join(',')];
  for (const r of rows) lines.push([r.file, r.title, r.description, r.tags].map(csvCell).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}

export { TITLE_MAX };
