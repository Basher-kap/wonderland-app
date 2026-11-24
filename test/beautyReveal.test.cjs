// Run the Beauty Contest reveal timing without Firebase or a phone:
//   npx tsc src/game/beautyReveal.ts --ignoreConfig --outDir .test-build --module commonjs --target es2020 --skipLibCheck
//   node test/beautyReveal.test.cjs .test-build/beautyReveal.js
const assert = require('node:assert/strict');
const path = require('node:path');
const t = require(path.resolve(process.argv[2] || '.test-build/beautyReveal.js'));

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('ok  ' + name);
}

const row = (uid, value, status = 'lost', away = null) => ({ uid, value, away, status, before: 0, after: -1 });
const reveal = (rows, extra = {}) => ({
  round: 1, rows, count: rows.filter((r) => r.value !== null).length, average: 40, target: 32,
  winners: [], reason: 'closest', penalty: 1, out: [], newRules: [], ...extra,
});
const four = () => reveal([row('a', 30, 'won', 2), row('b', 50, 'lost', 18), row('c', 20, 'lost', 12), row('d', 60, 'lost', 28)]);

test('the contestants appear one by one, in order', () => {
  const tl = t.buildTimeline(four());
  assert.equal(tl.playersAt.length, 4);
  for (let i = 1; i < 4; i++) assert.equal(tl.playersAt[i] - tl.playersAt[i - 1], t.PLAYER_STEP);
});

test('the calculation comes after everybody has appeared: sum, average, target', () => {
  const tl = t.buildTimeline(four());
  assert.deepEqual(tl.calc.map((c) => c.kind), ['sum', 'average', 'target']);
  assert.ok(tl.calc[0].at > tl.playersAt[3]);
  assert.ok(tl.calc[1].at > tl.calc[0].at && tl.calc[2].at > tl.calc[1].at);
});

test('the distances, then the winner, then the scores, in that order', () => {
  const tl = t.buildTimeline(four());
  for (const a of tl.awayAt) assert.ok(a > tl.calc[2].at);
  assert.ok(tl.winnerAt > Math.max(...tl.awayAt));
  assert.ok(tl.scoresStart > tl.winnerAt);
  for (const s of tl.scoresAt) assert.ok(s > tl.scoresStart);
  assert.ok(tl.totalMs > tl.scoresAt[3]);
});

test('a player who handed in nothing is never compared', () => {
  const tl = t.buildTimeline(reveal([row('a', 30, 'won', 2), row('b', null, 'none', null)]));
  assert.ok(tl.awayAt[0] > 0);
  assert.equal(tl.awayAt[1], -1);
});

test('invalid numbers get their own line after the distances', () => {
  const tl = t.buildTimeline(reveal([row('a', 30, 'invalid', 2), row('b', 30, 'invalid', 2), row('c', 50, 'won', 18)]));
  assert.ok(tl.calc.some((c) => c.kind === 'invalid'));
  assert.ok(tl.invalidAt > Math.max(...tl.awayAt));
  assert.ok(tl.winnerAt > tl.invalidAt);
});

test('nobody chose: one line, no distances', () => {
  const tl = t.buildTimeline(reveal([row('a', null, 'none'), row('b', null, 'none')], { target: null, average: null, count: 0, reason: 'nobody' }));
  assert.deepEqual(tl.calc.map((c) => c.kind), ['none']);
  assert.ok(tl.awayAt.every((a) => a === -1));
});

test('game over / new rule are announced after the scores, and make the reveal longer', () => {
  const quiet = t.buildTimeline(four());
  const loud = t.buildTimeline({ ...four(), out: ['d'], newRules: ['unique'] });
  assert.equal(quiet.noticeAt, -1);
  assert.ok(loud.noticeAt > loud.scoresAt[3]);
  assert.ok(loud.totalMs > quiet.totalMs);
  assert.ok(loud.totalMs >= loud.noticeAt + t.NOTICE_HOLD);
});

test('a bigger table takes longer, and 8 players still fit in under 25 seconds', () => {
  const rows = (n) => Array.from({ length: n }, (_, i) => row('p' + i, i * 10, i ? 'lost' : 'won', 5 + i));
  const small = t.revealMs(reveal(rows(2)));
  const big = t.revealMs(reveal(rows(8), { out: ['p7'], newRules: ['unique'] }));
  assert.ok(big > small);
  assert.ok(big < 25000, 'too long: ' + big);
  assert.ok(small > 6000, 'too short: ' + small);
});

test('every time is whole and never negative (except the "none" marks)', () => {
  const tl = t.buildTimeline({ ...four(), out: ['d'] });
  const all = [...tl.playersAt, ...tl.scoresAt, tl.winnerAt, tl.scoresStart, tl.totalMs, ...tl.calc.map((c) => c.at)];
  for (const x of all) assert.ok(Number.isInteger(x) && x > 0);
});

console.log(`\n${passed} tests passed`);
