// Run the Wordle rules without a phone (from the app/ folder):
//   npx tsc src/game/wordle.ts --ignoreConfig --rootDir src --outDir .test-out --module commonjs --target es2020 --skipLibCheck
//   node test/wordle.test.cjs .test-out/game/wordle.js
const assert = require('node:assert/strict');
const path = require('node:path');
const wordlePath = path.resolve(process.argv[2] || '.test-out/game/wordle.js');
const w = require(wordlePath);
const { EASY_WORDS, MODERATE_WORDS, HARD_WORDS, VALID_WORDS } = require(path.resolve(path.dirname(wordlePath), '../data/wordleWords.js'));

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('ok  ' + name);
}
const score = (g, a) => w.scoreGuess(g, a).map((s) => ({ green: 'G', yellow: 'Y', gray: '-' })[s]).join('');

test('word lists: sizes, 5 lowercase letters, all valid guesses, no word in two levels', () => {
  const lists = [EASY_WORDS, MODERATE_WORDS, HARD_WORDS];
  assert.ok(lists.every((l) => l.length >= 150), lists.map((l) => l.length).join(','));
  assert.ok(VALID_WORDS.size >= 5000, 'valid: ' + VALID_WORDS.size);
  for (const l of lists) {
    assert.ok(l.every((x) => /^[a-z]{5}$/.test(x) && VALID_WORDS.has(x)));
    assert.equal(new Set(l).size, l.length, 'no duplicates inside a list');
  }
  assert.equal(new Set([...EASY_WORDS, ...MODERATE_WORDS, ...HARD_WORDS]).size, EASY_WORDS.length + MODERATE_WORDS.length + HARD_WORDS.length);
  assert.ok([...VALID_WORDS].every((x) => /^[a-z]{5}$/.test(x)));
});

test('each level draws from its own list; same seed and level = same word', () => {
  const lists = [EASY_WORDS, MODERATE_WORDS, HARD_WORDS];
  for (let level = 1; level <= 3; level++) {
    assert.equal(w.pickAnswer('match:1', level), w.pickAnswer('match:1', level));
    const seen = new Set();
    for (let i = 0; i < 200; i++) {
      const word = w.pickAnswer('m:' + i, level);
      assert.ok(lists[level - 1].includes(word), `level ${level}: ${word}`);
      seen.add(word);
    }
    assert.ok(seen.size > 60, `variety at level ${level}: ${seen.size}`);
  }
  assert.throws(() => w.pickAnswer('x', 4), /Unknown Wordle level/);
  assert.throws(() => w.pickAnswer('x', 0), /Unknown Wordle level/);
});

test('scoring: all green, all gray, plain yellows', () => {
  assert.equal(score('crane', 'crane'), 'GGGGG');
  assert.equal(score('which', 'story'), '-----');
  assert.equal(score('slate', 'ocean'), '--Y-Y');
  assert.equal(score('trace', 'crate'), 'YGGYG');
});

test('scoring: repeated letters are not over-counted', () => {
  assert.equal(score('speed', 'abide'), '--Y-Y'); // only one E in abide: the second E is gray
  assert.equal(score('geese', 'those'), '---GG'); // E at the end is green, the other Es stay gray
  assert.equal(score('llama', 'whale'), 'Y-G--'); // one L in whale: only the first L is yellow
  assert.equal(score('hello', 'world'), '---GY'); // L is green at 3, so the L at 2 stays gray
});

test('scoring: greens win over yellows for the same letter', () => {
  assert.equal(score('babes', 'abbey'), 'YYGG-');
  assert.equal(score('floor', 'robot'), '--YGY');
});

test('scoring is case-insensitive', () => {
  assert.equal(score('CRANE', 'crane'), 'GGGGG');
});

test('guess validity: known words are valid, junk and wrong lengths are not', () => {
  for (const ok of ['crane', 'slate', 'CARDS', 'hello', 'tried']) assert.ok(w.isValidWord(ok), ok);
  for (const bad of ['zzzzz', 'qwert', 'abcde', 'hell', 'helloo', '', 'ab c']) assert.ok(!w.isValidWord(bad), bad);
});

test('keyboard colours: green beats yellow beats gray', () => {
  const k = w.keyStates(['crane', 'plate'], 'slate');
  assert.equal(k.a, 'green'); // green in 'plate' (pos 2), gray/yellow elsewhere
  assert.equal(k.l, 'green');
  assert.equal(k.c, 'gray');
  assert.equal(k.e, 'green');
  assert.equal(k.p, 'gray');
  assert.equal(k.r, 'gray');
});

test('points: easy 5, moderate 10, hard 20; the most one player can earn is 35', () => {
  assert.deepEqual(w.LEVEL_POINTS, [5, 10, 20]);
  assert.equal(w.MAX_EXTRA, 35);
  assert.equal(w.LEVEL_POINTS.reduce((a, b) => a + b, 0), w.MAX_EXTRA);
});

test('tally: points by level only (attempts do not matter); time counts only guessed words', () => {
  const o = (solved, ms) => ({ solved, ms });
  assert.deepEqual(w.tally([o(true, 1000), o(true, 2000), o(true, 3000)]), { score: 35, totalMs: 6000 });
  assert.deepEqual(w.tally([o(true, 1000), o(false, 9000), o(true, 3000)]), { score: 25, totalMs: 4000 });
  assert.deepEqual(w.tally([o(false, 5), o(false, 6), o(false, 7)]), { score: 0, totalMs: 0 });
  assert.deepEqual(w.tally([o(false, 5), o(true, 400), o(false, 7)]), { score: 10, totalMs: 400 });
  assert.deepEqual(w.tally([]), { score: 0, totalMs: 0 });
});

test('every combination of solved levels gives a different score, and solvedCount reads it back', () => {
  const seen = new Map();
  for (let mask = 0; mask < 8; mask++) {
    const outcomes = [0, 1, 2].map((i) => ({ solved: !!(mask & (1 << i)), ms: 1 }));
    const { score } = w.tally(outcomes);
    assert.ok(!seen.has(score), 'duplicate score ' + score);
    seen.set(score, mask);
    const bits = [0, 1, 2].filter((i) => mask & (1 << i)).length;
    assert.equal(w.solvedCount(score), bits, 'mask ' + mask);
  }
  assert.equal(seen.size, 8);
});

test('winner: most points; same points = shorter time; nobody scored = draw; forfeit never wins', () => {
  const r = (uid, score, totalMs, forfeited) => ({ uid, finished: true, score, totalMs, forfeited });
  assert.equal(w.pickWinner([r('a', 15, 100), r('b', 20, 999), r('c', 5, 1)]), 'b', 'hard word beats easy+moderate');
  assert.equal(w.pickWinner([r('a', 35, 900), r('b', 35, 800)]), 'b', 'tie on points: faster wins');
  assert.equal(w.pickWinner([r('a', 35, 800), r('b', 35, 800)]), null, 'exact tie = draw');
  assert.equal(w.pickWinner([r('a', 0, 5), r('b', 0, 9)]), null, 'nobody scored = draw');
  assert.equal(w.pickWinner([r('a', 35, 1, true), r('b', 5, 9)]), 'b', 'a forfeiter cannot win');
  assert.equal(w.pickWinner([r('a', 35, 1, true), r('b', 0, 9)]), null);
  assert.equal(w.pickWinner([]), null);
});

test('extra points: everybody keeps what they guessed, a forfeiter gets nothing, always within 0..35', () => {
  assert.equal(w.extraPoints({ uid: 'a', finished: true, totalMs: 1, score: 25 }), 25);
  assert.equal(w.extraPoints({ uid: 'a', finished: true, totalMs: 1 }), 0);
  assert.equal(w.extraPoints({ uid: 'a', finished: true, totalMs: 1, score: 25, forfeited: true }), 0);
  assert.equal(w.extraPoints({ uid: 'a', finished: true, totalMs: 1, score: 9999 }), 35);
  assert.equal(w.extraPoints({ uid: 'a', finished: true, totalMs: 1, score: -4 }), 0);
});

console.log('\n' + passed + ' tests passed');
