// Run the Russian Roulette rules without Firebase or a phone:
//   npx tsc src/game/russianRoulette.ts src/game/schulte.ts --ignoreConfig --outDir .test-build --module commonjs --target es2020 --skipLibCheck
//   node test/russianRoulette.test.cjs .test-build/russianRoulette.js
const assert = require('node:assert/strict');
const path = require('node:path');
const r = require(path.resolve(process.argv[2] || '.test-build/russianRoulette.js'));

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('ok  ' + name);
}

const zero = () => 0; // every spin stops on chamber 0
let clock = 1;
const load = (s, uid, mask) => ({ kind: 'load', uid, rev: s.rev, mask, at: clock++ });
const aim = (s, uid, target) => ({ kind: 'aim', uid, rev: s.rev, target, at: clock++ });
const LIVE = 1; // one bullet in chamber 0: live when the spin stops on 0
const BLANK = 2; // one bullet in chamber 1: blank when the spin stops on 0
const game = (ids = ['a', 'b', 'c']) => r.newGame(ids, 'm:1', 1000, zero);
// n bullets that never sit in chamber 0 (the chamber every spin stops on): always blank
const safeMask = (n) => ((1 << n) - 1) << 1;

// every player loads `masks[uid]` and aims `aims[uid]`, then the round is resolved
function round(s, masks, aims, now = 5000) {
  for (const id of s.alive) {
    s = r.apply(s, load(s, id, masks[id] ?? safeMask(s.bullets)));
    s = r.apply(s, aim(s, id, aims[id] ?? 'self'));
  }
  const out = r.tick(s, now, [], zero);
  assert.equal(out.phase, 'reveal');
  return out;
}

test('1st and 2nd rounds have 1 live bullet, 3rd and 4th 2, ... 11th and 12th 6', () => {
  const want = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6];
  assert.deepEqual(want.map((_, i) => r.bulletsFor(i + 1)), want);
  assert.equal(r.MAX_ROUNDS, 12);
});

test('a new game: every player alive, round 1, 1 live bullet, nothing known yet', () => {
  const s = game();
  assert.deepEqual(s.alive, ['a', 'b', 'c']);
  assert.equal(s.round, 1);
  assert.equal(s.bullets, 1);
  assert.equal(s.phase, 'play');
  assert.deepEqual(Object.keys(s.spins).sort(), ['a', 'b', 'c']);
});

test('loading: the number of bullets must match the round, and a spin cannot be redone', () => {
  let s = game();
  assert.equal(r.apply(s, load(s, 'a', 0)), s); // no bullets
  assert.equal(r.apply(s, load(s, 'a', 3)), s); // 2 bullets in a 1-bullet round
  assert.equal(r.apply(s, load(s, 'a', 64)), s); // outside the 6 chambers
  s = r.apply(s, load(s, 'a', LIVE));
  assert.deepEqual(s.spun, ['a']);
  assert.equal(r.apply(s, load(s, 'a', BLANK)), s);
});

test('aiming needs the spin first, only at somebody else or yourself, and the first aim is final', () => {
  let s = game();
  assert.equal(r.apply(s, aim(s, 'a', 'b')), s); // not spun yet
  s = r.apply(s, load(s, 'a', LIVE));
  assert.equal(r.apply(s, aim(s, 'a', 'a')), s); // yourself is "self"
  assert.equal(r.apply(s, aim(s, 'a', 'zzz')), s); // nobody
  s = r.apply(s, aim(s, 'a', 'b'));
  assert.equal(s.aims.a, 'b');
  assert.deepEqual(s.fired, ['a']);
  assert.equal(r.apply(s, aim(s, 'a', 'c')), s);
});

test('the hidden things are not in the public state', () => {
  let s = game();
  s = r.apply(s, load(s, 'a', LIVE));
  s = r.apply(s, aim(s, 'a', 'b'));
  const p = r.publicState(s);
  assert.deepEqual(p.masks, {});
  assert.deepEqual(p.spins, {});
  assert.deepEqual(p.aims, {});
  assert.deepEqual(p.spun, ['a']);
  assert.deepEqual(p.fired, ['a']);
});

test('a live bullet fired at yourself kills you', () => {
  const s = round(game(), { a: LIVE }, { a: 'self', b: 'self', c: 'self' });
  assert.deepEqual(s.reveal.dead, ['a']);
  assert.deepEqual(s.alive, ['b', 'c']);
  assert.equal(s.reveal.shots.find((x) => x.uid === 'a').outcome, 'suicide');
});

test('a blank fired at yourself protects you', () => {
  const s = round(game(), { c: LIVE, a: BLANK }, { a: 'self', b: 'self', c: 'a' });
  const shots = Object.fromEntries(s.reveal.shots.map((x) => [x.uid, x]));
  assert.equal(shots.a.outcome, 'shielded');
  assert.equal(shots.c.outcome, 'blocked');
  assert.deepEqual(s.reveal.dead, []);
});

test('a live bullet fired at an unprotected player kills them', () => {
  const s = round(game(), { c: LIVE }, { a: 'b', b: 'a', c: 'a' });
  assert.deepEqual(s.reveal.dead, ['a']);
  assert.equal(s.reveal.shots.find((x) => x.uid === 'c').outcome, 'hit');
  assert.equal(s.reveal.shots.find((x) => x.uid === 'a').outcome, 'click');
});

test('a blank fired at another player does nothing', () => {
  const s = round(game(), {}, { a: 'b', b: 'c', c: 'a' });
  assert.deepEqual(s.reveal.dead, []);
  for (const x of s.reveal.shots) assert.equal(x.outcome, 'click');
});

test('protection holds against several shooters, but not a live self-shot', () => {
  const s = round(game(['a', 'b', 'c', 'd']), { b: LIVE, c: LIVE, d: LIVE, a: BLANK }, { a: 'self', b: 'a', c: 'a', d: 'self' });
  assert.deepEqual(s.reveal.dead, ['d']);
  assert.ok(s.alive.includes('a'));
});

test('a player who does not aim fires at themselves; one who did not load gets random chambers', () => {
  let s = game();
  const rand = () => 0.99;
  const out = r.tick(s, 1000 + r.PLAY_MS, [], rand);
  assert.equal(out.phase, 'reveal');
  for (const x of out.reveal.shots) {
    assert.equal(x.aim, 'self');
    assert.equal(x.auto, true);
  }
});

test('auto-loaded masks always hold the right number of bullets', () => {
  for (let n = 1; n <= 6; n++) for (let k = 0; k < 20; k++) assert.equal(r.popcount(r.autoMask(n, Math.random)), n);
});

test('the round ends early when everybody has fired (after the minimum time)', () => {
  let s = game(['a', 'b']);
  for (const id of ['a', 'b']) {
    s = r.apply(s, load(s, id, BLANK));
    s = r.apply(s, aim(s, id, 'self'));
  }
  assert.equal(r.tick(s, 1000 + r.MIN_PLAY_MS - 1, [], zero), s);
  assert.equal(r.tick(s, 1000 + r.MIN_PLAY_MS, [], zero).phase, 'reveal');
});

test('a move for an old round is ignored', () => {
  const s = game(['a', 'b']);
  const old = load(s, 'a', LIVE);
  const next = round(s, {}, {});
  assert.equal(r.apply(next, old), next);
});

test('the reveal lasts longer with more shooters, and the next round starts after it', () => {
  const s = round(game(), {}, {}, 5000);
  assert.equal(s.endsAt - 5000, r.revealMs(s.reveal));
  assert.ok(r.revealMs({ shots: [1, 2, 3, 4] }) > r.revealMs({ shots: [1, 2] }));
  const n = r.tick(s, s.endsAt, [], zero);
  assert.equal(n.phase, 'play');
  assert.equal(n.round, 2);
  assert.equal(n.bullets, 1);
  assert.deepEqual(n.alive, ['a', 'b', 'c']);
  assert.equal(r.tick(n, n.endsAt - 1, [], zero), n); // nothing happens before the time is up
});

test('shot times are in order', () => {
  for (let i = 0; i < 5; i++) assert.ok(r.shotResultAt(i) > r.shotStart(i) && r.shotStart(i + 1) > r.shotResultAt(i));
});

test('the last player alive wins; the game ends after the reveal', () => {
  const s = round(game(['a', 'b']), { a: LIVE }, { a: 'self', b: 'self' });
  assert.deepEqual(s.alive, ['b']);
  const end = r.tick(s, s.endsAt, [], zero);
  assert.equal(end.phase, 'over');
  assert.equal(end.winner, 'b');
});

test('everybody dying in the same round is a draw', () => {
  const s = round(game(['a', 'b']), { a: LIVE, b: LIVE }, { a: 'b', b: 'a' });
  assert.deepEqual(s.alive, []);
  const end = r.tick(s, s.endsAt, [], zero);
  assert.equal(end.phase, 'over');
  assert.equal(end.winner, null);
});

test('round 11 and 12: every chamber is live, so every shot kills (no protection)', () => {
  let s = game(['a', 'b', 'c', 'd']);
  for (let k = 0; k < 10; k++) {
    s = round(s, {}, {}, s.endsAt);
    s = r.tick(s, s.endsAt, [], zero);
  }
  assert.equal(s.round, 11);
  assert.equal(s.bullets, 6);
  const mask = 63;
  const out = round(s, { a: mask, b: mask, c: mask, d: mask }, { a: 'b', b: 'a', c: 'a', d: 'c' }, s.endsAt);
  assert.ok(out.reveal.shots.every((x) => x.live));
  assert.deepEqual(out.reveal.dead.sort(), ['a', 'b', 'c']);
  assert.deepEqual(out.alive, ['d']);
});

test('more than one survivor after all 12 rounds is a draw', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  let s = game(ids);
  for (let k = 0; k < 10; k++) {
    s = round(s, {}, {}, s.endsAt);
    s = r.tick(s, s.endsAt, [], zero);
  }
  assert.equal(s.round, 11);
  const all = Object.fromEntries(ids.map((id) => [id, 63]));
  s = round(s, all, { a: 'b', b: 'a', c: 'a', d: 'a', e: 'a', f: 'a', g: 'a', h: 'a' }, s.endsAt);
  assert.deepEqual(s.alive, ['c', 'd', 'e', 'f', 'g', 'h']);
  s = r.tick(s, s.endsAt, [], zero);
  assert.equal(s.round, 12);
  s = round(s, all, { c: 'd', d: 'c', e: 'c', f: 'c', g: 'c', h: 'c' }, s.endsAt);
  assert.deepEqual(s.alive, ['e', 'f', 'g', 'h']);
  const end = r.tick(s, s.endsAt, [], zero);
  assert.equal(end.phase, 'over');
  assert.equal(end.winner, null);
});

test('a player who forfeits leaves at once; the last one left wins', () => {
  const s = game(['a', 'b']);
  const n = r.tick(s, 2000, ['a'], zero);
  assert.equal(n.phase, 'over');
  assert.equal(n.winner, 'b');
  assert.equal(n.lastLeft, 'a');
  const three = r.tick(game(), 2000, ['a'], zero);
  assert.equal(three.phase, 'play');
  assert.deepEqual(three.alive, ['b', 'c']);
});

test('a target who forfeited counts as yourself', () => {
  let s = game();
  s = r.apply(s, load(s, 'a', LIVE));
  s = r.apply(s, aim(s, 'a', 'b'));
  s = r.tick(s, 2000, ['b'], zero);
  const out = r.tick(s, 1000 + r.PLAY_MS, [], zero);
  assert.equal(out.reveal.shots.find((x) => x.uid === 'a').aim, 'self');
});

test('nothing changes once the game is over', () => {
  const s = r.tick(game(['a', 'b']), 2000, ['a'], zero);
  assert.equal(r.tick(s, 9e12, [], zero), s);
  assert.equal(r.apply(s, load(s, 'b', 1)), s);
});

console.log(`\n${passed} tests passed`);
