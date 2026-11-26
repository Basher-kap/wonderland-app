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
// n bullets that never sit in chamber 0 (the chamber every spin stops on): always blank
const safeMask = (n) => ((1 << n) - 1) << 1;
const game = (ids = ['a', 'b', 'c']) => r.newGame(ids, 'm:1', 1000, zero);

// Everybody loads and spins, the aiming starts.
function loaded(s, masks = {}) {
  for (const id of s.alive) s = r.apply(s, load(s, id, masks[id] ?? safeMask(s.bullets)));
  const out = r.tick(s, s.pickFrom + r.MIN_LOAD_MS, [], zero);
  assert.equal(out.phase, 'aim');
  return out;
}
// A whole round: load, then aim (a player not in `aims` does not decide), then the guns fire.
function round(s, masks, aims, skip = []) {
  s = loaded(s, masks);
  for (const id of s.alive) if (!skip.includes(id)) s = r.apply(s, aim(s, id, aims[id] ?? 'self'));
  const now = skip.length ? s.endsAt : s.pickFrom + r.MIN_AIM_MS;
  const out = r.tick(s, now, [], zero);
  assert.equal(out.phase, 'reveal');
  return out;
}
const next = (s) => r.tick(s, s.endsAt, [], zero);

test('1st and 2nd rounds have 1 live bullet, 3rd and 4th 2, ... 11th and 12th 6', () => {
  const want = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6];
  assert.deepEqual(want.map((_, i) => r.bulletsFor(i + 1)), want);
  assert.equal(r.MAX_ROUNDS, 12);
});

test('10 seconds to load, then 30 seconds to aim', () => {
  assert.equal(r.LOAD_MS, 10000);
  assert.equal(r.AIM_MS, 30000);
  const s = game();
  assert.equal(s.phase, 'load');
  assert.equal(s.endsAt - 1000, 10000);
  const a = loaded(s);
  assert.equal(a.endsAt - a.pickFrom, 30000);
});

test('a new game: every player alive, round 1, 1 live bullet, nothing known yet', () => {
  const s = game();
  assert.deepEqual(s.alive, ['a', 'b', 'c']);
  assert.equal(s.round, 1);
  assert.equal(s.bullets, 1);
  assert.deepEqual(Object.keys(s.spins).sort(), ['a', 'b', 'c']);
});

test('loading: the number of bullets must match the round, and a spin cannot be redone', () => {
  let s = game();
  assert.equal(r.apply(s, load(s, 'a', 0)), s);
  assert.equal(r.apply(s, load(s, 'a', 3)), s);
  assert.equal(r.apply(s, load(s, 'a', 64)), s);
  s = r.apply(s, load(s, 'a', LIVE));
  assert.deepEqual(s.spun, ['a']);
  assert.equal(r.apply(s, load(s, 'a', BLANK)), s);
});

test('nobody can aim during the loading', () => {
  let s = game();
  s = r.apply(s, load(s, 'a', LIVE));
  assert.equal(r.apply(s, aim(s, 'a', 'b')), s);
});

test('loading ends early when everybody has spun, or when the 10 seconds are up', () => {
  let s = game();
  for (const id of s.alive) s = r.apply(s, load(s, id, BLANK));
  assert.equal(r.tick(s, 1000 + r.MIN_LOAD_MS - 1, [], zero), s);
  assert.equal(r.tick(s, 1000 + r.MIN_LOAD_MS, [], zero).phase, 'aim');
  const lazy = game();
  assert.equal(r.tick(lazy, 1000 + r.LOAD_MS - 1, [], zero), lazy);
  assert.equal(r.tick(lazy, 1000 + r.LOAD_MS, [], zero).phase, 'aim');
});

test('a player who did not spin in time gets random chambers and a spin', () => {
  let s = game();
  s = r.apply(s, load(s, 'a', LIVE));
  const a = r.tick(s, 1000 + r.LOAD_MS, [], () => 0.5);
  assert.equal(a.phase, 'aim');
  assert.deepEqual([...a.spun].sort(), ['a', 'b', 'c']);
  for (const id of ['a', 'b', 'c']) assert.equal(r.popcount(a.masks[id]), 1);
  assert.equal(a.masks.a, LIVE); // the one who did spin keeps their chambers
});

test('auto-loaded masks always hold the right number of bullets', () => {
  for (let n = 1; n <= 6; n++) for (let k = 0; k < 20; k++) assert.equal(r.popcount(r.autoMask(n, Math.random)), n);
});

test('aiming: only at somebody else or yourself, and the first aim is final', () => {
  let s = loaded(game());
  assert.equal(r.apply(s, aim(s, 'a', 'a')), s);
  assert.equal(r.apply(s, aim(s, 'a', 'zzz')), s);
  s = r.apply(s, aim(s, 'a', 'b'));
  assert.equal(s.aims.a, 'b');
  assert.deepEqual(s.fired, ['a']);
  assert.equal(r.apply(s, aim(s, 'a', 'c')), s);
});

test('a load move is ignored once the aiming has started', () => {
  const s = loaded(game());
  assert.equal(r.apply(s, { kind: 'load', uid: 'a', rev: s.rev, mask: 1, at: 99 }), s);
});

test('the hidden things are not in the public state', () => {
  let s = loaded(game(), { a: LIVE });
  s = r.apply(s, aim(s, 'a', 'b'));
  const p = r.publicState(s);
  assert.deepEqual(p.masks, {});
  assert.deepEqual(p.spins, {});
  assert.deepEqual(p.aims, {});
  assert.deepEqual(p.fired, ['a']);
  assert.deepEqual([...p.spun].sort(), ['a', 'b', 'c']);
});

test('a live bullet fired at yourself kills you', () => {
  const s = round(game(), { a: LIVE }, {});
  assert.deepEqual(s.reveal.dead, ['a']);
  assert.deepEqual(s.alive, ['b', 'c']);
  assert.equal(s.reveal.shots.find((x) => x.uid === 'a').outcome, 'suicide');
});

test('a blank fired at yourself protects you (the shield force)', () => {
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

test('a player who does not decide in time is defenseless: no shot, no protection', () => {
  // a would have fired a blank at itself (protection), but did not decide; c shoots a with a live bullet
  const s = round(game(), { c: LIVE, a: BLANK }, { b: 'self', c: 'a' }, ['a']);
  const shots = Object.fromEntries(s.reveal.shots.map((x) => [x.uid, x]));
  assert.equal(shots.a.outcome, 'idle');
  assert.equal(shots.a.auto, true);
  assert.equal(shots.a.live, false);
  assert.equal(shots.c.outcome, 'hit');
  assert.deepEqual(s.reveal.dead, ['a']);
});

test('a defenseless player never kills anybody, even with a live chamber', () => {
  const s = round(game(), { a: LIVE, b: LIVE, c: LIVE }, { b: 'self', c: 'self' }, ['a']);
  const a = s.reveal.shots.find((x) => x.uid === 'a');
  assert.equal(a.outcome, 'idle');
  assert.equal(a.live, false);
  assert.deepEqual(s.reveal.dead.sort(), ['b', 'c']); // b and c shot themselves with live bullets
});

test('the aiming ends early when everybody has fired (after the minimum time)', () => {
  let s = loaded(game(['a', 'b']));
  for (const id of ['a', 'b']) s = r.apply(s, aim(s, id, 'self'));
  assert.equal(r.tick(s, s.pickFrom + r.MIN_AIM_MS - 1, [], zero), s);
  assert.equal(r.tick(s, s.pickFrom + r.MIN_AIM_MS, [], zero).phase, 'reveal');
});

test('a move for an old round is ignored', () => {
  const s = game(['a', 'b']);
  const old = load(s, 'a', LIVE);
  const n = round(s, {}, {});
  assert.equal(r.apply(n, old), n);
});

test('the reveal lasts longer with more shooters, and the next round starts with the loading', () => {
  const s = round(game(), {}, {});
  assert.equal(s.endsAt - (s.pickFrom + r.MIN_AIM_MS), r.revealMs(s.reveal));
  assert.ok(r.revealMs({ shots: [1, 2, 3, 4] }) > r.revealMs({ shots: [1, 2] }));
  const n = next(s);
  assert.equal(n.phase, 'load');
  assert.equal(n.round, 2);
  assert.equal(n.bullets, 1);
  assert.deepEqual(n.alive, ['a', 'b', 'c']);
  assert.equal(r.tick(n, n.endsAt - 1, [], zero), n);
});

test('shot times are in order', () => {
  for (let i = 0; i < 5; i++) assert.ok(r.shotResultAt(i) > r.shotStart(i) && r.shotStart(i + 1) > r.shotResultAt(i));
});

test('a player dying alone leaves the other as the winner', () => {
  const s = round(game(['a', 'b']), { a: LIVE, b: BLANK }, { a: 'self', b: 'self' });
  assert.deepEqual(s.alive, ['b']);
  const end = next(s);
  assert.equal(end.phase, 'over');
  assert.equal(end.winner, 'b');
});

test('everybody dying in the same round is a draw', () => {
  const s = round(game(['a', 'b']), { a: LIVE, b: LIVE }, { a: 'b', b: 'a' });
  assert.deepEqual(s.alive, []);
  const end = next(s);
  assert.equal(end.phase, 'over');
  assert.equal(end.winner, null);
});

// plays rounds 1-10 with everybody shooting themselves with blanks, until round 11
function toRound11(ids) {
  let s = game(ids);
  for (let k = 0; k < 10; k++) s = next(round(s, {}, {}));
  assert.equal(s.round, 11);
  assert.equal(s.bullets, 6);
  return s;
}

test('round 11 and 12: every chamber is live, so every shot kills (no protection)', () => {
  const s = toRound11(['a', 'b', 'c', 'd']);
  const all = { a: 63, b: 63, c: 63, d: 63 };
  const out = round(s, all, { a: 'b', b: 'a', c: 'a', d: 'c' });
  assert.ok(out.reveal.shots.every((x) => x.live));
  assert.deepEqual(out.reveal.dead.sort(), ['a', 'b', 'c']);
  assert.deepEqual(out.alive, ['d']);
});

test('more than one survivor after all 12 rounds is a draw', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  let s = toRound11(ids);
  const all = Object.fromEntries(ids.map((id) => [id, 63]));
  s = round(s, all, { a: 'b', b: 'a', c: 'a', d: 'a', e: 'a', f: 'a', g: 'a', h: 'a' });
  assert.deepEqual(s.alive, ['c', 'd', 'e', 'f', 'g', 'h']);
  s = next(s);
  assert.equal(s.round, 12);
  s = round(s, all, { c: 'd', d: 'c', e: 'c', f: 'c', g: 'c', h: 'c' });
  assert.deepEqual(s.alive, ['e', 'f', 'g', 'h']);
  const end = next(s);
  assert.equal(end.phase, 'over');
  assert.equal(end.winner, null);
});

test('a player who forfeits leaves at once; the last one left wins', () => {
  const n = r.tick(game(['a', 'b']), 2000, ['a'], zero);
  assert.equal(n.phase, 'over');
  assert.equal(n.winner, 'b');
  assert.equal(n.lastLeft, 'a');
  const three = r.tick(game(), 2000, ['a'], zero);
  assert.equal(three.phase, 'load');
  assert.deepEqual(three.alive, ['b', 'c']);
});

test('a target who forfeited counts as yourself', () => {
  let s = loaded(game());
  s = r.apply(s, aim(s, 'a', 'b'));
  s = r.tick(s, s.pickFrom + 100, ['b'], zero);
  const out = r.tick(s, s.endsAt, [], zero);
  assert.equal(out.reveal.shots.find((x) => x.uid === 'a').aim, 'self');
});

test('nothing changes once the game is over', () => {
  const s = r.tick(game(['a', 'b']), 2000, ['a'], zero);
  assert.equal(r.tick(s, 9e12, [], zero), s);
  assert.equal(r.apply(s, load(s, 'b', 1)), s);
});

console.log(`\n${passed} tests passed`);
