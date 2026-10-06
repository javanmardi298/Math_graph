import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile, tryCompile } from '../src/math/parser.js';

const V = ['x', 't', 'a', 'b', 's', 'theta'];
const ev = (src, scope = {}) => compile(src, V).fn({ x: 0, t: 0, a: 1, b: 2, s: 0, theta: 0, ...scope });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

test('precedence and power', () => {
  assert.equal(ev('1 + 2 * 3'), 7);
  assert.equal(ev('2^3^2'), 512);
  assert.equal(ev('-2^2'), -4);
  assert.equal(ev('2^-1'), 0.5);
});
test('example formula from the brief', () => {
  close(ev('3 * exp(-12 * mod(x, 0.5)) - 1.5', { x: 0.75 }), 3 * Math.exp(-3) - 1.5);
});
test('mod is mathematical (always positive)', () => {
  close(ev('mod(-0.25, 1)'), 0.75);
  close(ev('-0.25 % 1'), 0.75);
});
test('implicit multiplication and unicode', () => {
  close(ev('2x', { x: 3 }), 6);
  close(ev('3sin(x)', { x: 1 }), 3 * Math.sin(1));
  close(ev('(x+1)(x-1)', { x: 3 }), 8);
  close(ev('2π'), 2 * Math.PI);
  close(ev('x²', { x: 4 }), 16);
  close(ev('|x - 5|', { x: 2 }), 3);
  close(ev('2|x| + 1', { x: -2 }), 5);
});
test('comparison, ternary and piecewise', () => {
  assert.equal(ev('x < 2 ? 10 : 20', { x: 1 }), 10);
  assert.equal(ev('x < 2 ? 10 : 20', { x: 3 }), 20);
  assert.equal(ev('if(x > 0, 1, -1)', { x: -3 }), -1);
});
test('waveform helpers', () => {
  assert.equal(ev('square(0.25)'), 1);
  assert.equal(ev('square(0.75)'), -1);
  close(ev('saw(0.5)'), 0);
  close(ev('tri(0)'), 0);
  close(ev('tri(0.25)'), 1);
});
test('dependencies are tracked', () => {
  assert.deepEqual([...compile('sin(x + t) * a', V).deps].sort(), ['a', 't', 'x']);
});
test('errors are friendly and safe', () => {
  assert.equal(tryCompile('sin(x', V).ok, false);
  assert.match(tryCompile('foo(x)', V).error, /Unknown name/);
  assert.match(tryCompile('sin x', V).error, /parentheses/);
  assert.match(tryCompile('constructor', V).error, /Unknown name/);
  assert.match(tryCompile('max()', V).error, /argument/);
  assert.equal(tryCompile('', V).ok, false);
});
