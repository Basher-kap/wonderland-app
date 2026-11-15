// Run the game rules without Firebase or a phone:
//   npx tsc src/game/engine.ts --ignoreConfig --outDir .test-build --module commonjs --target es2020 --skipLibCheck
//   node test/engine.test.cjs .test-build/game/engine.js
const assert = require('node:assert/strict');
const e = require(require('node:path').resolve(process.argv[2] || '.test-build/game/engine.js'));

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('ok  ' + name);
}

const lobby = (names) => ({
  status: 'waiting',
  matchId: '',
  leg: 1,
  gameQueue: [],
  players: Object.fromEntries(names.map((n, i) => [n, e.newPlayer(n, 1000 + i)])),
  currentRound: null,
  winnerId: null,
});

const start = (names) => e.startMatch(lobby(names), 'match-1');
const play = (state, winner) => e.applyRoundResult(state, winner);
const sum = (c) => c.logic + c.experience + c.chance;
const ids = ['wordle', 'human-calculator', 'magical-banana', 'fortune', 'hangman', 'schulte-table',
  'inversion', 'janken-negotiation', 'battleships', 'maze-hopscotch', 'karuta'];

test('start needs 2+ players and a waiting lobby', () => {
  assert.throws(() => e.startMatch(lobby(['a']), 'm'), /at least 2/);
  assert.throws(() => e.startMatch(start(['a', 'b']), 'm'), /already started/);
});

test('start gives everyone 10 lives, a clean tally and the first game', () => {
  const s = start(['a', 'b', 'c']);
  assert.equal(s.status, 'playing');
  assert.equal(s.matchId, 'match-1');
  assert.equal(s.leg, 1);
  assert.ok(Object.values(s.players).every((p) => p.lives === 10 && sum(p.wins) === 0 && sum(p.plays) === 0));
  assert.equal(s.currentRound.no, 1);
  assert.equal(s.currentRound.status, 'active');
  assert.equal(s.gameQueue.length, 10);
  assert.ok(ids.includes(s.currentRound.gameId));
});

test('cannot draw a game while a round is active', () => {
  assert.throws(() => e.drawNextGame(start(['a', 'b'])), /already active/);
});

test('losers lose 1 life, the winner keeps theirs; everyone is tallied', () => {
  const { state, finished } = play(start(['a', 'b', 'c']), 'b');
  assert.deepEqual([state.players.a.lives, state.players.b.lives, state.players.c.lives], [9, 10, 9]);
  assert.equal(finished, false);
  assert.equal(state.currentRound.status, 'done');
  assert.equal(state.currentRound.winnerId, 'b');
  assert.equal(sum(state.players.b.wins), 1);
  assert.equal(sum(state.players.a.wins), 0);
  assert.ok(Object.values(state.players).every((p) => sum(p.plays) === 1));
});

test('a draw costs nobody a life and nobody gets a win', () => {
  const { state } = play(start(['a', 'b']), null);
  assert.equal(state.players.a.lives, 10);
  assert.equal(sum(state.players.a.wins) + sum(state.players.b.wins), 0);
  assert.equal(sum(state.players.a.plays), 1);
});

test('winner must be in the lobby; round must be active', () => {
  const s = start(['a', 'b']);
  assert.throws(() => play(s, 'zzz'), /not in this lobby/);
  assert.throws(() => play(play(s, 'a').state, 'a'), /no active round/);
});

test('2 players: a wins every round, match ends after 10 rounds', () => {
  let s = start(['a', 'b']);
  let result;
  let rounds = 0;
  for (;;) {
    result = play(s, 'a');
    rounds++;
    if (result.finished) break;
    s = e.drawNextGame(result.state);
  }
  assert.equal(rounds, 10);
  assert.deepEqual(result.eliminated, ['b']);
  assert.equal(result.matchWinnerId, 'a');
  assert.equal(result.state.status, 'finished');
  assert.equal(result.state.winnerId, 'a');
  assert.equal(result.state.players.b.lives, 0);
  assert.throws(() => e.drawNextGame(result.state), /not in play/);

  // settlement: the winner gains a ticket and 10 wins, the loser loses a ticket
  const a = e.settlementFor(result.state, 'a');
  const b = e.settlementFor(result.state, 'b');
  assert.equal(a.ticketDelta, 1);
  assert.equal(a.totalWins, 10);
  assert.equal(sum(a.plays), 10);
  assert.equal(b.ticketDelta, -1);
  assert.equal(b.totalWins, 0);
  assert.equal(sum(b.plays), 10);
  assert.equal(e.applyTickets(5, a.ticketDelta), 6);
  assert.equal(e.applyTickets(5, b.ticketDelta), 4);
  assert.equal(e.applyTickets(0, b.ticketDelta), 0, 'tickets never go below 0');
});

test('settlement: only for finished matches and real players', () => {
  const s = start(['a', 'b']);
  assert.throws(() => e.settlementFor(s, 'a'), /not finished/);
  const fin = { ...s, status: 'finished', winnerId: 'a' };
  assert.throws(() => e.settlementFor(fin, 'zzz'), /not in this match/);
});

test('bystanders in a 3-player match get ticket change 0', () => {
  let s = start(['a', 'b', 'c']);
  s = { ...s, players: { a: { ...s.players.a, lives: 3 }, b: { ...s.players.b, lives: 5 }, c: { ...s.players.c, lives: 1 } } };
  const r = play(s, 'a'); // b -> 4, c -> 0
  assert.equal(r.finished, true);
  assert.equal(r.matchWinnerId, 'a'.length ? 'b' : null); // b has 4 lives vs a with 3
  assert.equal(e.settlementFor(r.state, 'b').ticketDelta, 1);
  assert.equal(e.settlementFor(r.state, 'a').ticketDelta, 0);
  assert.equal(e.settlementFor(r.state, 'c').ticketDelta, -1);
});

test('leg 1 plays each of the 11 games once, then leg 2 starts', () => {
  let s = start(['a', 'b', 'c']);
  const seen = [s.currentRound.gameId];
  const order = ['a', 'b', 'c'];
  for (let i = 0; i < 10; i++) {
    s = play(s, order[i % 3]).state; // rotating winners so nobody dies early
    s = e.drawNextGame(s);
    seen.push(s.currentRound.gameId);
  }
  assert.equal(new Set(seen).size, 11, 'all 11 games appear in leg 1');
  assert.equal(s.leg, 1);
  assert.equal(s.gameQueue.length, 0);

  s = e.drawNextGame(play(s, 'a').state);
  assert.equal(s.leg, 2);
  assert.equal(s.currentRound.no, 12);
  assert.equal(s.gameQueue.length, 10);
});

test('tie on lives: the earlier joiner wins the match', () => {
  let s = start(['a', 'b', 'c']);
  const withLives = (la, lb, lc, ja = 1000, jb = 1001) => ({
    ...s,
    players: {
      a: { ...s.players.a, lives: la, joinedAt: ja },
      b: { ...s.players.b, lives: lb, joinedAt: jb },
      c: { ...s.players.c, lives: lc },
    },
  });
  // a=2, b=3, c=1; a wins: b -> 2, c -> 0; a and b tie on 2, a joined first
  const r = play(withLives(2, 3, 1), 'a');
  assert.deepEqual(r.eliminated, ['c']);
  assert.equal(r.matchWinnerId, 'a');
  // if b joined first, b takes the tie
  assert.equal(play(withLives(2, 3, 1, 2000, 1000), 'a').matchWinnerId, 'b');
});

test('inputs are not mutated', () => {
  const s = start(['a', 'b']);
  const copy = JSON.parse(JSON.stringify(s));
  play(s, 'a');
  assert.deepEqual(s, copy);
});

test('shuffle keeps every item exactly once', () => {
  assert.deepEqual([...e.shuffle(ids)].sort(), [...ids].sort());
});

console.log('\n' + passed + ' tests passed');
