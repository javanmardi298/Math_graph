import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BufferAnalyser } from '../src/audio/buffer-analyser.js';

test('offline analyser finds the frequency of a sine', () => {
  const rate = 48000, f = 1000;
  const data = new Float32Array(rate);
  for (let i = 0; i < rate; i++) data[i] = 0.5 * Math.sin((2 * Math.PI * f * i) / rate);
  const a = new BufferAnalyser({ sampleRate: rate, numberOfChannels: 1, getChannelData: () => data });
  let spec;
  for (let k = 0; k < 20; k++) spec = a.at(0.5 + k / 60).spectrum; // let smoothing settle
  const peak = spec.indexOf(Math.max(...spec));
  assert.ok(Math.abs(peak - f / (rate / 2048)) <= 1, `peak bin ${peak}`);
  assert.ok(spec[400] < spec[peak] / 2);
});
