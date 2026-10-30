/**
 * Safe math expression compiler.
 *
 * Formulas are tokenized and parsed into an AST, then turned into a tree of
 * closures. Nothing is ever passed to eval/new Function, so a formula can only
 * reach the whitelisted functions and variables below.
 *
 * Supported syntax
 *   numbers      3, 0.5, 1e-3, .25
 *   operators    + - * / % ^ (power, right-assoc), unary -, implicit multiply (2x, 3sin(x), (x+1)(x-1))
 *   comparison   < <= > >= == !=  (return 1 or 0)
 *   ternary      cond ? a : b
 *   abs bars     |x - 1|
 *   unicode      π θ τ × ÷ − ² ³ √
 */

const CONSTANTS = { pi: Math.PI, e: Math.E, tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2 };

const mod = (a, b) => ((a % b) + b) % b;
const fract = (x) => x - Math.floor(x);
const clamp = (x, lo = 0, hi = 1) => Math.min(Math.max(x, lo), hi);

// Cheap deterministic 1D hash + value noise so `noise(x)` is smooth and repeatable.
const hash = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453123);
const noise = (x) => {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return (hash(i) * (1 - u) + hash(i + 1) * u) * 2 - 1;
};

/**
 * Riemann zeta ζ(σ + it) through the alternating (Dirichlet eta) series with Borwein's
 * acceleration: η(s) = −1/d_n Σ (−1)^k (d_k − d_n) / (k+1)^s, ζ = η / (1 − 2^(1−s)).
 * With n = 64 terms it is accurate to many digits for |t| up to about 60, which is where the
 * videos look (the first zeros on the critical line are at t ≈ 14.13, 21.02, 25.01, 30.42 …).
 */
const ZETA_N = 64;
const ZETA_W = (() => {
  // d_k = n Σ_{i≤k} (n+i−1)! 4^i / ((n−i)! (2i)!), built from term ratios to stay in range
  const n = ZETA_N, d = [];
  let term = 1 / n, sum = 0; // i = 0: n·(n−1)!/(n!·0!) = 1, scaled by 1/n below and back
  for (let i = 0; i <= n; i++) {
    if (i > 0) term *= ((n + i - 1) * 4 * (n - i + 1)) / ((2 * i - 1) * (2 * i));
    sum += term;
    d.push(sum);
  }
  return d.map((dk) => (dk - d[n]) / d[n]); // weights in [−1, 0]
})();
let zetaMemo = { s: NaN, t: NaN, re: 0, im: 0 };
function zeta(sigma, t) {
  if (sigma === zetaMemo.s && t === zetaMemo.t) return zetaMemo;
  let re = 0, im = 0;
  for (let k = 0; k < ZETA_N; k++) {
    const l = Math.log(k + 1), m = Math.exp(-sigma * l), sg = k % 2 ? -1 : 1;
    re += sg * ZETA_W[k] * m * Math.cos(t * l);
    im -= sg * ZETA_W[k] * m * Math.sin(t * l);
  }
  re = -re; im = -im;
  // divide by 1 − 2^(1−s)
  const m2 = Math.pow(2, 1 - sigma), a2 = -t * Math.LN2;
  const dr = 1 - m2 * Math.cos(a2), di = -m2 * Math.sin(a2), dd = dr * dr + di * di;
  zetaMemo = { s: sigma, t, re: (re * dr + im * di) / dd, im: (im * dr - re * di) / dd };
  return zetaMemo;
}
const isPrime = (n) => {
  n = Math.round(n);
  if (n < 2) return 0;
  if (n % 2 === 0) return n === 2 ? 1 : 0;
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return 0;
  return 1;
};

/** name → [implementation, minArgs, maxArgs] */
export const FUNCTIONS = {
  sin: [Math.sin, 1, 1], cos: [Math.cos, 1, 1], tan: [Math.tan, 1, 1],
  asin: [Math.asin, 1, 1], acos: [Math.acos, 1, 1], atan: [Math.atan, 1, 1], atan2: [Math.atan2, 2, 2],
  sinh: [Math.sinh, 1, 1], cosh: [Math.cosh, 1, 1], tanh: [Math.tanh, 1, 1],
  asinh: [Math.asinh, 1, 1], acosh: [Math.acosh, 1, 1], atanh: [Math.atanh, 1, 1],
  sec: [(x) => 1 / Math.cos(x), 1, 1], csc: [(x) => 1 / Math.sin(x), 1, 1], cot: [(x) => 1 / Math.tan(x), 1, 1],
  exp: [Math.exp, 1, 1], ln: [Math.log, 1, 1],
  log: [(x, b) => (b === undefined ? Math.log10(x) : Math.log(x) / Math.log(b)), 1, 2],
  log2: [Math.log2, 1, 1], log10: [Math.log10, 1, 1],
  sqrt: [Math.sqrt, 1, 1], cbrt: [Math.cbrt, 1, 1], pow: [Math.pow, 2, 2], hypot: [Math.hypot, 1, 8],
  abs: [Math.abs, 1, 1], sign: [Math.sign, 1, 1], floor: [Math.floor, 1, 1], ceil: [Math.ceil, 1, 1],
  round: [Math.round, 1, 1], trunc: [Math.trunc, 1, 1], fract: [fract, 1, 1],
  mod: [mod, 2, 2], min: [Math.min, 1, 8], max: [Math.max, 1, 8], clamp: [clamp, 1, 3],
  lerp: [(a, b, k) => a + (b - a) * k, 3, 3],
  step: [(edge, x) => (x < edge ? 0 : 1), 2, 2],
  smoothstep: [(a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); }, 3, 3],
  if: [(c, a, b) => (c ? a : b), 3, 3],
  sinc: [(x) => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)), 1, 1],
  gauss: [(x, s = 1) => Math.exp(-(x * x) / (2 * s * s)), 1, 2],
  // Periodic waveforms with period 1 and range [-1, 1] — handy for rhythmic melodies.
  saw: [(x) => 2 * fract(x) - 1, 1, 1],
  tri: [(x) => 1 - 4 * Math.abs(fract(x + 0.25) - 0.5), 1, 1],
  square: [(x) => (fract(x) < 0.5 ? 1 : -1), 1, 1],
  pulse: [(x, duty = 0.5) => (fract(x) < duty ? 1 : -1), 1, 2],
  noise: [noise, 1, 1], rand: [hash, 1, 1],
  // ζ(1/2 + it) on the critical line (or ζ(σ + it) with two arguments): real and imaginary parts
  zetare: [(a, b) => (b === undefined ? zeta(0.5, a) : zeta(a, b)).re, 1, 2],
  zetaim: [(a, b) => (b === undefined ? zeta(0.5, a) : zeta(a, b)).im, 1, 2],
  isprime: [isPrime, 1, 1],
  gcd: [(a, b) => { a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b)); while (b) [a, b] = [b, a % b]; return a; }, 2, 2],
  deg: [(x) => (x * 180) / Math.PI, 1, 1], rad: [(x) => (x * Math.PI) / 180, 1, 1],
};

export class ParseError extends Error {
  constructor(message, pos) {
    super(message);
    this.pos = pos;
  }
}

function normalize(src) {
  return src
    .replace(/\*\*/g, '^')
    .replace(/[−–]/g, '-')
    .replace(/×|·/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, ' pi ')
    .replace(/τ/g, ' tau ')
    .replace(/θ/g, ' theta ')
    .replace(/√/g, ' sqrt')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3');
}

function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    const numMatch = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i));
    if (numMatch) {
      tokens.push({ type: 'num', value: parseFloat(numMatch[0]), pos: i });
      i += numMatch[0].length;
      continue;
    }
    const idMatch = /^[a-z_][a-z0-9_]*/i.exec(src.slice(i));
    if (idMatch) {
      tokens.push({ type: 'id', value: idMatch[0], pos: i });
      i += idMatch[0].length;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (['<=', '>=', '==', '!=', '&&', '||'].includes(two)) {
      tokens.push({ type: 'op', value: two, pos: i });
      i += 2;
      continue;
    }
    if ('+-*/%^(),<>?:|'.includes(ch)) {
      tokens.push({ type: 'op', value: ch, pos: i });
      i++;
      continue;
    }
    throw new ParseError(`Unexpected character "${ch}"`, i);
  }
  tokens.push({ type: 'end', pos: src.length });
  return tokens;
}

/** Recursive-descent parser producing a small AST. */
function parse(tokens, allowedVars) {
  let p = 0;
  let absDepth = 0;
  const peek = () => tokens[p];
  const isOp = (v) => peek().type === 'op' && peek().value === v;
  const expect = (v) => {
    if (!isOp(v)) throw new ParseError(`Expected "${v}"`, peek().pos);
    p++;
  };

  const ternary = () => {
    const cond = logical();
    if (isOp('?')) {
      p++;
      const a = ternary();
      expect(':');
      const b = ternary();
      return { k: 'tern', cond, a, b };
    }
    return cond;
  };
  const logical = () => {
    let left = comparison();
    while (isOp('&&') || isOp('||')) {
      const op = tokens[p++].value;
      left = { k: 'bin', op, left, right: comparison() };
    }
    return left;
  };
  const comparison = () => {
    let left = additive();
    while (['<', '>', '<=', '>=', '==', '!='].some(isOp)) {
      const op = tokens[p++].value;
      left = { k: 'bin', op, left, right: additive() };
    }
    return left;
  };
  const additive = () => {
    let left = multiplicative();
    while (isOp('+') || isOp('-')) {
      const op = tokens[p++].value;
      left = { k: 'bin', op, left, right: multiplicative() };
    }
    return left;
  };
  // A token that can begin an implicit multiplication operand: 2x, 2(x), x sin(x).
  // "|" only starts a new operand when we're not inside an open |...| pair.
  const startsOperand = () => {
    const t = peek();
    return t.type === 'num' || t.type === 'id' || (t.type === 'op' && (t.value === '(' || (t.value === '|' && absDepth === 0)));
  };
  const multiplicative = () => {
    let left = unary();
    for (;;) {
      if (isOp('*') || isOp('/') || isOp('%')) {
        const op = tokens[p++].value;
        left = { k: 'bin', op, left, right: unary() };
      } else if (startsOperand()) {
        left = { k: 'bin', op: '*', left, right: power() };
      } else break;
    }
    return left;
  };
  const unary = () => {
    if (isOp('-')) { p++; return { k: 'neg', arg: unary() }; }
    if (isOp('+')) { p++; return unary(); }
    return power();
  };
  const power = () => {
    const base = primary();
    if (isOp('^')) {
      p++;
      return { k: 'bin', op: '^', left: base, right: unary() };
    }
    return base;
  };
  const primary = () => {
    const t = peek();
    if (t.type === 'num') { p++; return { k: 'num', v: t.value }; }
    if (t.type === 'op' && t.value === '(') {
      p++;
      const e = ternary();
      expect(')');
      return e;
    }
    if (t.type === 'op' && t.value === '|') {
      p++;
      absDepth++;
      const e = ternary();
      absDepth--;
      expect('|');
      return { k: 'call', name: 'abs', fn: Math.abs, args: [e] };
    }
    if (t.type === 'id') {
      p++;
      const name = t.value.toLowerCase();
      if (Object.hasOwn(FUNCTIONS, name)) {
        if (!isOp('(')) throw new ParseError(`"${name}" needs parentheses, e.g. ${name}(x)`, t.pos);
        p++;
        const args = [];
        if (!isOp(')')) {
          args.push(ternary());
          while (isOp(',')) { p++; args.push(ternary()); }
        }
        expect(')');
        const [fn, min, max] = FUNCTIONS[name];
        if (args.length < min || args.length > max) {
          throw new ParseError(`${name}() takes ${min === max ? min : `${min}–${max}`} argument${max > 1 ? 's' : ''}`, t.pos);
        }
        return { k: 'call', name, fn, args };
      }
      if (Object.hasOwn(CONSTANTS, name)) return { k: 'num', v: CONSTANTS[name] };
      if (allowedVars.includes(name)) return { k: 'var', name };
      throw new ParseError(`Unknown name "${t.value}". Variables here: ${allowedVars.join(', ')}`, t.pos);
    }
    if (t.type === 'end') throw new ParseError('Formula ends too early', t.pos);
    throw new ParseError(`Unexpected "${t.value}"`, t.pos);
  };

  const ast = ternary();
  if (peek().type !== 'end') throw new ParseError(`Unexpected "${peek().value}"`, peek().pos);
  return ast;
}

const BIN = {
  '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => a / b,
  '%': mod, '^': Math.pow,
  '<': (a, b) => +(a < b), '>': (a, b) => +(a > b), '<=': (a, b) => +(a <= b), '>=': (a, b) => +(a >= b),
  '==': (a, b) => +(a === b), '!=': (a, b) => +(a !== b),
  '&&': (a, b) => +(a && b), '||': (a, b) => +(a || b),
};

/** Turns an AST into a closure `(scope) => number`, folding constant sub-trees. */
function build(node, deps) {
  switch (node.k) {
    case 'num': { const v = node.v; return () => v; }
    case 'var': { deps.add(node.name); const n = node.name; return (s) => s[n]; }
    case 'neg': { const a = build(node.arg, deps); return (s) => -a(s); }
    case 'tern': {
      const c = build(node.cond, deps), a = build(node.a, deps), b = build(node.b, deps);
      return (s) => (c(s) ? a(s) : b(s));
    }
    case 'bin': {
      const f = BIN[node.op], l = build(node.left, deps), r = build(node.right, deps);
      return (s) => f(l(s), r(s));
    }
    case 'call': {
      const fn = node.fn;
      const args = node.args.map((a) => build(a, deps));
      if (args.length === 1) { const a0 = args[0]; return (s) => fn(a0(s)); }
      if (args.length === 2) { const [a0, a1] = args; return (s) => fn(a0(s), a1(s)); }
      return (s) => fn(...args.map((a) => a(s)));
    }
    default: throw new Error('bad node');
  }
}

/**
 * Compile a formula.
 * @param {string} src                 e.g. "3*exp(-12*mod(x,0.5)) - 1.5"
 * @param {string[]} vars              names the formula may use, e.g. ['x','t','a','b']
 * @returns {{ fn: (scope:object)=>number, deps: Set<string>, src: string }}
 * @throws {ParseError} with `.pos` pointing at the offending character
 */
export function compile(src, vars) {
  const text = normalize(String(src ?? ''));
  if (!text.trim()) throw new ParseError('Formula is empty', 0);
  const ast = parse(tokenize(text), vars);
  const deps = new Set();
  const fn = build(ast, deps);
  return { fn, deps, src };
}

/** Like compile() but never throws: returns { ok, fn, deps, error }. */
export function tryCompile(src, vars, fallback = () => 0) {
  try {
    const c = compile(src, vars);
    return { ok: true, ...c, error: null };
  } catch (err) {
    return { ok: false, fn: fallback, deps: new Set(), src, error: err.message };
  }
}
