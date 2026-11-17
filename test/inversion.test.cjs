const assert = require('assert');
const v = require(require('path').resolve(process.argv[2]));
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const tasks = (seed) => Array.from({ length: v.TASK_COUNT }, (_, i) => v.makeTask(seed, i));

t('same seed gives the same tasks; different seeds differ', () => {
  assert.deepStrictEqual(tasks('m:1'), tasks('m:1'));
  assert.notDeepStrictEqual(tasks('m:1'), tasks('m:2'));
});
t('buttons are only the pair of the axis; answer is one of them', () => {
  for (let s = 0; s < 100; s++) for (const k of tasks('s' + s)) {
    const pair = v.PAIR[k.axis];
    assert.ok(pair.includes(k.dir) && pair.includes(k.button) && pair.includes(k.target) && pair.includes(k.answer));
  }
});
t('the first tasks are plain: direct instruction, no INVERSED', () => {
  for (let s = 0; s < 100; s++) for (const k of tasks('p' + s).slice(0, 3)) {
    assert.ok(!k.inversed && !k.inverseApproach && !k.negated && k.button === k.target);
    assert.strictEqual(k.answer, k.dir); // "Press RIGHT if moving right" with arrows going right
    if (k.mode === 'pointing') assert.strictEqual(k.moveDir, null); // still arrows in the plain tasks
  }
});
t('plain answers for the user\'s examples', () => {
  // Press LEFT if the arrows are moving to the right, arrows moving right -> LEFT
  assert.strictEqual(v.plainAnswer('right', 'left', false, 'right'), 'left');
  // Press RIGHT if the arrows are moving to the left, arrows moving left -> RIGHT
  assert.strictEqual(v.plainAnswer('left', 'right', false, 'left'), 'right');
  // Press RIGHT if NOT moving to the left, arrows moving right -> RIGHT; moving left -> LEFT
  assert.strictEqual(v.plainAnswer('right', 'right', true, 'left'), 'right');
  assert.strictEqual(v.plainAnswer('left', 'right', true, 'left'), 'left');
  // Press UP if NOT pointing upwards, arrows pointing down -> UP
  assert.strictEqual(v.plainAnswer('down', 'up', true, 'up'), 'up');
  assert.strictEqual(v.plainAnswer('up', 'up', true, 'up'), 'down');
});
t('moving tasks: the arrows slide and point the way they move; pointing tasks: arrows may also slide on the same axis', () => {
  let slidingWhilePointing = 0, stillWhilePointing = 0, opposing = 0;
  for (let s = 0; s < 200; s++) for (const k of tasks('m' + s)) {
    assert.strictEqual(k.pointDir, k.dir);
    if (k.mode === 'moving') assert.strictEqual(k.moveDir, k.dir);
    else if (k.moveDir) {
      assert.ok(v.PAIR[k.axis].includes(k.moveDir));
      slidingWhilePointing++;
      if (k.moveDir !== k.pointDir) opposing++;
    } else stillWhilePointing++;
  }
  assert.ok(slidingWhilePointing > 500 && stillWhilePointing > 500 && opposing > 200);
});
t('the answer depends on where the arrows point, not on how they slide', () => {
  for (let s = 0; s < 100; s++) for (const k of tasks('d' + s)) {
    if (k.mode !== 'pointing') continue;
    const plain = v.plainAnswer(k.pointDir, k.button, k.negated, k.target);
    assert.strictEqual(k.answer, k.inversed ? v.opposite(plain) : plain);
  }
});
t('INVERSED flips the answer to the other button', () => {
  let flipped = 0;
  for (let s = 0; s < 100; s++) for (const k of tasks('i' + s)) {
    const plain = v.plainAnswer(k.dir, k.button, k.negated, k.target);
    assert.strictEqual(k.answer, k.inversed ? v.opposite(plain) : plain);
    if (k.inversed) flipped++;
  }
  assert.ok(flipped > 100); // it does appear
});
t('instruction text', () => {
  assert.strictEqual(v.instructionText('horizontal', 'moving', 'right', true, 'left'), 'Press RIGHT if the arrows are NOT moving to the left');
  assert.strictEqual(v.instructionText('vertical', 'pointing', 'up', false, 'up'), 'Press UP if the arrows are pointing upwards');
  assert.strictEqual(v.instructionText('vertical', 'moving', 'down', false, 'down'), 'Press DOWN if the arrows are going downwards');
});
t('inverse-approach instructions become more frequent later; every combo shows up', () => {
  let early = 0, late = 0; const combos = new Set();
  for (let s = 0; s < 300; s++) {
    const a = tasks('c' + s);
    a.slice(0, 10).forEach((k) => early += k.inverseApproach ? 1 : 0);
    a.slice(20).forEach((k) => late += k.inverseApproach ? 1 : 0);
    a.filter((k) => k.axis === 'horizontal' && k.inverseApproach).forEach((k) => combos.add(`${k.button}|${k.negated}|${k.target}`));
  }
  assert.ok(early / 3000 < 0.1, `early ${early / 3000}`); // very small at first
  assert.ok(late / 3000 > 0.3 && late / 3000 < 0.6, `late ${late / 3000}`); // medium later
  assert.strictEqual(combos.size, 6);
});
t('time limit shrinks', () => {
  assert.strictEqual(v.timeLimitFor(0), 6500);
  assert.strictEqual(v.timeLimitFor(v.TASK_COUNT - 1), 4000);
  for (let i = 1; i < v.TASK_COUNT; i++) assert.ok(v.timeLimitFor(i) <= v.timeLimitFor(i - 1) && v.timeLimitFor(i) >= 4000);
  assert.strictEqual(v.makeTask('x', 5).timeLimitMs, v.timeLimitFor(5));
});
t('winner: first to complete, fastest if several, exact tie = draw', () => {
  const r = (uid, finished, totalMs, score) => ({ uid, finished, totalMs, score });
  assert.strictEqual(v.pickWinner([r('a', true, 9000, 30), r('b', true, 8000, 30), r('c', false, 1000, 2)]), 'b');
  assert.strictEqual(v.pickWinner([r('a', true, 9000, 30), r('b', true, 9000, 30)]), null);
});
t('winner: the last player still in', () => {
  const r = (uid, totalMs, score, forfeited) => ({ uid, finished: false, totalMs, score, forfeited });
  assert.strictEqual(v.pickWinner([r('a', 5000, 4), r('b', 6000, 7)], ['a', 'b', 'c']), 'c');
  assert.strictEqual(v.pickWinner([r('a', 5000, 4), r('b', 0, undefined, true)], ['a', 'b', 'c']), 'c');
  assert.strictEqual(v.pickWinner([r('a', 5000, 4)], ['a', 'b', 'c']), null); // two still playing
  assert.strictEqual(v.pickWinner([r('a', 5000, 4)], ['a', 'b']), 'b'); // 2 players: one is out
});
t('winner: everybody out -> most correct, then lasted longest; forfeiters never win', () => {
  const r = (uid, totalMs, score, forfeited) => ({ uid, finished: false, totalMs, score, forfeited });
  assert.strictEqual(v.pickWinner([r('a', 5000, 4), r('b', 6000, 7)], ['a', 'b']), 'b');
  assert.strictEqual(v.pickWinner([r('a', 9000, 7), r('b', 6000, 7)], ['a', 'b']), 'a');
  assert.strictEqual(v.pickWinner([r('a', 0, undefined, true), r('b', 0, undefined, true)], ['a', 'b']), null);
  assert.strictEqual(v.pickWinner([r('a', 6000, 7), r('b', 6000, 7)], ['a', 'b']), null);
});
console.log(n + ' tests passed');
