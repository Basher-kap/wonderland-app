// Run the Human Calculator rules without a phone (from the app/ folder):
//   npx tsc src/game/humanCalculator.ts --ignoreConfig --rootDir src --outDir .test-out --module commonjs --target es2020 --skipLibCheck
//   node test/humanCalculator.test.cjs .test-out/game/humanCalculator.js
const assert = require('node:assert/strict');
const path = require('node:path');
const h = require(path.resolve(process.argv[2] || '.test-out/game/humanCalculator.js'));

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('ok  ' + name);
}

test('same seed and question = same question; different seed differs somewhere', () => {
  assert.deepEqual(h.buildQuestion('m:1', 5), h.buildQuestion('m:1', 5));
  let differs = false;
  for (let q = 1; q <= 12; q++) if (JSON.stringify(h.buildQuestion('m:1', q)) !== JSON.stringify(h.buildQuestion('m:2', q))) differs = true;
  assert.ok(differs);
});

test('every question: answer = left-to-right total, always a whole number >= 1, first term is +', () => {
  for (let s = 0; s < 150; s++) {
    for (let q = 1; q <= 20; q++) {
      const x = h.buildQuestion('seed' + s, q);
      assert.equal(x.terms[0].op, '+');
      let total = 0;
      for (const t of x.terms) {
        const next = h.apply(total, t);
        assert.ok(Number.isInteger(next) && next >= 1, `seed${s} q${q}: ${total} ${t.op} ${t.n} = ${next}`);
        total = next;
      }
      assert.equal(x.answer, total);
      assert.ok(Number.isInteger(x.answer) && x.answer >= 1 && x.answer <= 200);
    }
  }
});

test('length: 4 terms at the start, never more than 8, never shorter than before by much', () => {
  for (let s = 0; s < 50; s++) {
    assert.equal(h.buildQuestion('s' + s, 1).terms.length, 4);
    for (let q = 1; q <= 25; q++) {
      const n = h.buildQuestion('s' + s, q).terms.length;
      assert.ok(n >= 4 && n <= 8);
    }
    assert.equal(h.buildQuestion('s' + s, 11).terms.length, 8);
    assert.equal(h.buildQuestion('s' + s, 25).terms.length, 8);
  }
});

test('operators appear in order: + - only, then x, then /', () => {
  let mulSeen = false, divSeen = false;
  for (let s = 0; s < 100; s++) {
    for (let q = 1; q <= 20; q++) {
      const x = h.buildQuestion('o' + s, q);
      const ops = new Set(x.terms.map((t) => t.op));
      if (q <= 3) assert.ok([...ops].every((o) => o === '+' || o === '-'), 'q' + q);
      if (q <= 6) assert.ok(!ops.has('/'), 'no divide before q7');
      if (q >= 4) assert.ok(ops.has('x') || ops.has('/'), 'q' + q + ' should have x or /');
      if (q >= 7) assert.ok(ops.has('/'), 'q' + q + ' should have /');
      if (ops.has('x')) mulSeen = true;
      if (ops.has('/')) divSeen = true;
    }
  }
  assert.ok(mulSeen && divSeen);
});

test('numbers stay small: x and / factors within the stage limits', () => {
  for (let s = 0; s < 100; s++) {
    for (let q = 1; q <= 20; q++) {
      const x = h.buildQuestion('n' + s, q);
      for (const t of x.terms) {
        if (t.op === 'x' || t.op === '/') assert.ok(t.n >= 2 && t.n <= (q >= 10 ? 6 : 4), `q${q} ${t.op}${t.n}`);
        else assert.ok(t.n >= 1 && t.n <= (q >= 10 ? 15 : 9));
      }
    }
  }
});

test('show time gets shorter as the game goes on', () => {
  assert.ok(h.buildQuestion('a', 1).showMs > h.buildQuestion('a', 12).showMs);
  assert.ok(h.buildQuestion('a', 1).showMs >= 800);
});

test('labels use the proper symbols', () => {
  assert.equal(h.labelOf({ op: 'x', n: 2 }), '×2');
  assert.equal(h.labelOf({ op: '/', n: 5 }), '÷5');
  assert.equal(h.labelOf({ op: '-', n: 2 }), '−2');
  assert.equal(h.labelOf({ op: '+', n: 5 }), '+5');
});

const doc = (uid, stage, solved) => ({ uid, stage, solved });

test('standings: nobody answered yet', () => {
  const s = h.standings(['a', 'b'], [], []);
  assert.equal(s.completed, 0);
  assert.equal(s.next, 1);
  assert.equal(s.gameOver, false);
  assert.deepEqual(s.chances, { a: 3, b: 3 });
});

test('standings: a question is complete only when every living player answered', () => {
  const s = h.standings(['a', 'b'], [], [doc('a', 1, false)]);
  assert.equal(s.completed, 0);
  assert.equal(s.chances.a, 3, 'not counted until b answered too');
  const s2 = h.standings(['a', 'b'], [], [doc('a', 1, false), doc('b', 1, true)]);
  assert.equal(s2.completed, 1);
  assert.deepEqual(s2.chances, { a: 2, b: 3 });
});

test('standings: 3 mistakes eliminate, last player standing ends the game', () => {
  const docs = [doc('a', 1, false), doc('b', 1, true), doc('a', 2, false), doc('b', 2, true), doc('a', 3, false), doc('b', 3, true)];
  const s = h.standings(['a', 'b'], [], docs);
  assert.equal(s.gameOver, true);
  assert.deepEqual(s.alive, ['b']);
  assert.equal(s.chances.a, 0);
  assert.equal(s.lastQ.a, 3);
  assert.equal(s.completed, 3);
});

test('standings: eliminated player is no longer waited for', () => {
  const docs = [];
  for (let q = 1; q <= 3; q++) docs.push(doc('a', q, false), doc('b', q, true), doc('c', q, true));
  docs.push(doc('b', 4, true));
  let s = h.standings(['a', 'b', 'c'], [], docs);
  assert.equal(s.completed, 3);
  assert.equal(s.gameOver, false);
  assert.deepEqual(s.alive, ['b', 'c']);
  docs.push(doc('c', 4, true));
  s = h.standings(['a', 'b', 'c'], [], docs);
  assert.equal(s.completed, 4);
});

test('standings: a forfeited player is out from the start and not waited for', () => {
  const s = h.standings(['a', 'b', 'c'], ['c'], [doc('a', 1, true), doc('b', 1, false)]);
  assert.equal(s.completed, 1);
  assert.deepEqual(s.alive, ['a', 'b']);
  const s2 = h.standings(['a', 'b'], ['b'], []);
  assert.equal(s2.gameOver, true);
  assert.deepEqual(s2.alive, ['a']);
});

test('standings: everybody drops out on the same question = game over, nobody alive', () => {
  const docs = [];
  for (let q = 1; q <= 3; q++) docs.push(doc('a', q, false), doc('b', q, false));
  const s = h.standings(['a', 'b'], [], docs);
  assert.equal(s.gameOver, true);
  assert.equal(s.alive.length, 0);
  assert.equal(s.lastQ.a, 3);
});

test('standings: solo run ends when the player is out; extra docs after game over are ignored', () => {
  const docs = [doc('a', 1, false), doc('a', 2, false), doc('a', 3, false), doc('a', 4, true)];
  const s = h.standings(['a'], [], docs);
  assert.equal(s.gameOver, true);
  assert.equal(s.completed, 3);
});

test('standings: the question cap ends the game; most chances win', () => {
  const docs2 = [];
  for (let q = 1; q <= h.MAX_QUESTIONS; q++) docs2.push(doc('a', q, q !== 4), doc('b', q, q !== 4 && q !== 8));
  const s = h.standings(['a', 'b'], [], docs2);
  assert.equal(s.gameOver, true);
  assert.equal(s.completed, h.MAX_QUESTIONS);
  assert.deepEqual(s.chances, { a: 2, b: 1 });
  assert.equal(h.pickWinner([
    { uid: 'a', finished: true, totalMs: 0, score: h.scoreFor(s.chances.a, s.lastQ.a) },
    { uid: 'b', finished: true, totalMs: 0, score: h.scoreFor(s.chances.b, s.lastQ.b) },
  ]), 'a');
});

test('standings: same answers in any order give the same result', () => {
  const docs = [doc('a', 1, false), doc('b', 1, true), doc('a', 2, true), doc('b', 2, false)];
  assert.deepEqual(h.standings(['a', 'b'], [], docs), h.standings(['a', 'b'], [], [...docs].reverse()));
});

test('score: more chances beats lasting longer; later elimination beats earlier', () => {
  assert.ok(h.scoreFor(1, 5) > h.scoreFor(0, 19));
  assert.ok(h.scoreFor(0, 9) > h.scoreFor(0, 4));
  assert.equal(h.chancesOfScore(h.scoreFor(2, 14)), 2);
  assert.equal(h.questionOfScore(h.scoreFor(2, 14)), 14);
});

test('pickWinner: top score wins, tie is a draw, forfeited ignored', () => {
  const r = (uid, score, extra = {}) => ({ uid, finished: true, totalMs: 0, score, ...extra });
  assert.equal(h.pickWinner([r('a', 205), r('b', 7), r('c', 4)]), 'a');
  assert.equal(h.pickWinner([r('a', 7), r('b', 7)]), null);
  assert.equal(h.pickWinner([r('a', 300, { forfeited: true }), r('b', 7), r('c', 4)]), 'b');
  assert.equal(h.pickWinner([r('a', 9, { forfeited: true })]), null);
  assert.equal(h.pickWinner([]), null);
});

test('describeScore', () => {
  assert.equal(h.describeScore(h.scoreFor(2, 9)), '2 chances left');
  assert.equal(h.describeScore(h.scoreFor(1, 9)), '1 chance left');
  assert.equal(h.describeScore(h.scoreFor(0, 6)), 'out at question 6');
});

console.log(`\n${passed} tests passed`);
