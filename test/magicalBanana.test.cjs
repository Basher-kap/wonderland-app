const assert = require('assert');
const m = require(require('path').resolve(process.argv[2]));
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

const T0 = 1_000_000;
// A game with players a, b, c in that order, already past the opening countdown.
const started = (ids = ['a', 'b', 'c']) => m.tick(m.newGame(ids, 'Banana', T0), T0 + m.COUNTDOWN_MS);
const word = (s, uid, w, now = T0 + 5000) => m.apply(s, { uid, rev: s.rev, kind: 'word', word: w }, now);
const judge = (s, uid, now = T0 + 6000) => m.apply(s, { uid, rev: s.rev, kind: 'judge' }, now);
const vote = (s, uid, v, now = T0 + 7000) => m.apply(s, { uid, rev: s.rev, kind: 'vote', vote: v }, now);

t('order and start word are the same for the same seed, and the order is a permutation', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  assert.deepStrictEqual(m.shuffleOrder(ids, 's1'), m.shuffleOrder(ids, 's1'));
  assert.deepStrictEqual([...m.shuffleOrder(ids, 's1')].sort(), ids);
  assert.strictEqual(m.pickStartWord('s1'), m.pickStartWord('s1'));
  assert.ok(new Set(Array.from({ length: 40 }, (_, i) => m.pickStartWord('x' + i))).size > 10);
});
t('opening: 3-2-1, then the first player in the circle is on the clock', () => {
  const g = m.newGame(['a', 'b', 'c'], 'Banana', T0);
  assert.strictEqual(g.phase, 'countdown');
  assert.strictEqual(m.tick(g, T0 + 1000), g); // not yet
  const s = m.tick(g, T0 + 3000);
  assert.strictEqual(s.phase, 'turn');
  assert.strictEqual(s.current, 'a');
  assert.strictEqual(s.endsAt, T0 + 3000 + m.TURN_MS);
});
t('a word passes the turn on; only the current player, with the right rev, and a real word', () => {
  const s = started();
  assert.strictEqual(word(s, 'b', 'Yellow'), s); // not b's turn
  assert.strictEqual(m.apply(s, { uid: 'a', rev: s.rev - 1, kind: 'word', word: 'Yellow' }, T0), s); // stale
  assert.strictEqual(word(s, 'a', '   '), s);
  assert.strictEqual(word(s, 'a', '!!!'), s);
  const s2 = word(s, 'a', '  Yellow  ');
  assert.strictEqual(s2.current, 'b');
  assert.strictEqual(s2.words.a, 'Yellow');
  assert.strictEqual(m.lastEntry(s2).word, 'Yellow');
  assert.strictEqual(word(s2, 'a', 'Again'), s2); // the old move is stale now
  assert.strictEqual(m.apply(s2, { uid: 'a', rev: s.rev, kind: 'word', word: 'Yellow' }, T0), s2); // replay is harmless
});
t('a box is erased when it is that player\'s turn again; the circle goes round', () => {
  let s = started();
  s = word(s, 'a', 'Yellow'); s = word(s, 'b', 'Sun'); s = word(s, 'c', 'Hot');
  assert.strictEqual(s.current, 'a');
  assert.strictEqual(s.words.a, ''); // erased
  assert.strictEqual(s.words.b, 'Sun');
});
t('timeout: the player is disqualified and the next one answers the same word', () => {
  let s = started();
  s = word(s, 'a', 'Yellow');
  assert.strictEqual(m.tick(s, s.endsAt - 1), s);
  const out = m.tick(s, s.endsAt);
  assert.deepStrictEqual(out.alive, ['a', 'c']);
  assert.strictEqual(out.current, 'c');
  assert.strictEqual(m.lastEntry(out).word, 'Yellow');
  assert.strictEqual(out.last.kind, 'timeout');
});
t('judging: the author cannot vote, the start word and an already judged word cannot be judged', () => {
  let s = started();
  assert.strictEqual(judge(s, 'b'), s); // only the start word so far
  s = word(s, 'a', 'Yellow');
  const j = judge(s, 'b');
  assert.strictEqual(j.phase, 'judging');
  assert.deepStrictEqual(j.judge.voters, ['b', 'c']);
  assert.strictEqual(j.judge.prev, 'Banana');
  assert.strictEqual(vote(j, 'a', 'ok'), j);
  let k = vote(j, 'b', 'ok'); k = vote(k, 'c', 'ok');
  assert.strictEqual(k.phase, 'countdown');
  assert.strictEqual(k.last.kind, 'ok');
  assert.strictEqual(m.lastEntry(k).judged, true);
  const back = m.tick(k, k.endsAt);
  assert.strictEqual(back.phase, 'turn');
  assert.strictEqual(back.current, 'b'); // b still has to answer
  assert.strictEqual(judge(back, 'c'), back); // already judged
});
t('a vote counts once', () => {
  const j = judge(word(started(), 'a', 'Yellow'), 'b');
  const k = vote(j, 'b', 'no');
  assert.strictEqual(vote(k, 'b', 'ok'), k);
});
t('NO: the author is disqualified, the word is thrown out, the chain goes back one word', () => {
  let s = started();
  s = word(s, 'a', 'Yellow'); s = word(s, 'b', 'Car');
  s = judge(s, 'c'); // c judges b's word "Car"
  assert.deepStrictEqual(s.judge.voters, ['a', 'c']);
  s = vote(s, 'a', 'no'); s = vote(s, 'c', 'no');
  assert.deepStrictEqual(s.alive, ['a', 'c']);
  assert.strictEqual(m.lastEntry(s).word, 'Yellow');
  assert.strictEqual(s.current, 'c');
  assert.strictEqual(s.last.kind, 'no');
  assert.strictEqual(s.phase, 'countdown');
  assert.strictEqual(m.tick(s, s.endsAt).phase, 'turn');
});
t('DRAW: the word is rejected, the author stays and must answer again; a 2nd DRAW disqualifies', () => {
  let s = started();
  s = word(s, 'a', 'Yellow');
  s = judge(s, 'b'); s = vote(s, 'b', 'ok'); s = vote(s, 'c', 'no'); // 1-1
  assert.strictEqual(s.last.kind, 'draw');
  assert.strictEqual(s.strikes.a, 1);
  assert.deepStrictEqual(s.alive, ['a', 'b', 'c']);
  assert.strictEqual(s.current, 'a');
  assert.strictEqual(m.lastEntry(s).word, 'Banana');
  assert.strictEqual(s.words.a, '');
  s = m.tick(s, s.endsAt);
  s = word(s, 'a', 'Peel');
  s = judge(s, 'b'); s = vote(s, 'b', 'no'); s = vote(s, 'c', 'ok'); // 1-1 again
  assert.deepStrictEqual(s.alive, ['b', 'c']);
  assert.strictEqual(s.last.kind, 'strike2');
});
t('with two players the only voter decides: NO ends the game', () => {
  let s = started(['a', 'b']);
  s = word(s, 'a', 'X1'); // voters = only b: no tie possible with 2 players
  s = judge(s, 'b');
  assert.deepStrictEqual(s.judge.voters, ['b']);
  s = vote(s, 'b', 'no');
  assert.strictEqual(s.phase, 'over');
  assert.strictEqual(s.winner, 'b');
});
t('vote timeout: the votes that are in decide, no votes at all passes', () => {
  let s = judge(word(started(), 'a', 'Yellow'), 'b');
  s = vote(s, 'c', 'no'); // only c voted: NO wins 1-0
  const out = m.tick(s, s.endsAt);
  assert.strictEqual(out.last.kind, 'no');
  const none = m.tick(judge(word(started(), 'a', 'Yellow'), 'b'), T0 + 6000 + m.VOTE_MS);
  assert.strictEqual(none.last.kind, 'ok');
});
t('last player in wins', () => {
  let s = started();
  s = word(s, 'a', 'Yellow');
  s = m.tick(s, s.endsAt); // b out
  s = m.tick(s, s.endsAt); // c out
  assert.strictEqual(s.phase, 'over');
  assert.strictEqual(s.winner, 'a');
  assert.strictEqual(m.tick(s, s.endsAt + 99999), s);
});
t('forfeit: the player is out; if it was their turn it passes on; in a vote they stop being a voter', () => {
  let s = started();
  const f = m.tick(s, T0 + 4000, ['a']);
  assert.deepStrictEqual(f.alive, ['b', 'c']);
  assert.strictEqual(f.current, 'b');
  assert.strictEqual(f.last.kind, 'forfeit');
  let j = judge(word(s, 'a', 'Yellow'), 'b');
  j = vote(j, 'b', 'ok');
  const g = m.tick(j, T0 + 8000, ['c']); // c leaves while b has voted: all remaining voted
  assert.deepStrictEqual(g.alive, ['a', 'b']);
  assert.notStrictEqual(g.phase, 'judging');
});
t('a player who is out cannot move or vote', () => {
  let s = started();
  s = word(s, 'a', 'Yellow');
  s = m.tick(s, s.endsAt); // b out, c to answer
  assert.strictEqual(m.apply(s, { uid: 'b', rev: s.rev, kind: 'judge' }, T0), s);
});
t('a disqualified player can still vote; one who left the game cannot', () => {
  let s = word(started(), 'a', 'Yellow');
  s = m.tick(s, s.endsAt); // b ran out of time: disqualified; c has to answer
  assert.deepStrictEqual(s.alive, ['a', 'c']);
  s = judge(s, 'c', s.endsAt - 1000); // c judges a's word
  assert.deepStrictEqual(s.judge.voters, ['b', 'c']); // everybody but the author a, b included
  const v = vote(s, 'b', 'no');
  assert.notStrictEqual(v, s); // the disqualified player's vote is accepted
  assert.strictEqual(v.judge.votes.b, 'no');
  assert.strictEqual(m.apply(s, { uid: 'b', rev: s.rev, kind: 'judge' }, T0), s); // but b still cannot judge
  const left = m.tick(s, s.endsAt - 500, ['b']); // b leaves the game: nobody waits for their vote
  assert.deepStrictEqual(left.judge.voters, ['c']);
  assert.deepStrictEqual(left.gone, ['b']);
});
t('state survives JSON (it is saved as text)', () => {
  const s = judge(word(started(), 'a', 'Yellow'), 'b');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(s)), s);
});
console.log(n + ' tests passed');
