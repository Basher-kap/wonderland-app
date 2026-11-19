// Run the Traps of Xibalba rules without Firebase or a phone:
//   npx tsc src/game/xibalba.ts --ignoreConfig --outDir .test-build --module commonjs --target es2020 --skipLibCheck
//   node test/xibalba.test.cjs .test-build/game/xibalba.js
const assert = require('node:assert/strict');
const path = require('node:path');
const x = require(path.resolve(process.argv[2] || '.test-build/game/xibalba.js'));

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('ok  ' + name);
}

const SEED = 'match-1:1';
const A = 'a';
const B = 'b';
const C = 'c';
let clock = 1;
const mv = (s, uid, col) => ({ uid, rev: s.rev, col, at: clock++ });

// The tiles of the current step: all safe columns / all false columns.
const safeCols = (s) => x.mapFor(s.seed, s.setNo)[s.row].map((ok, c) => (ok ? c : -1)).filter((c) => c >= 0);
const trapCols = (s) => x.mapFor(s.seed, s.setNo)[s.row].map((ok, c) => (ok ? -1 : c)).filter((c) => c >= 0);

// Everybody picks `col(uid)`, the time is up, then the reveal ends.
function step(s, picks, t = 0) {
  for (const [uid, col] of Object.entries(picks)) s = x.apply(s, mv(s, uid, col));
  s = x.tick(s, s.endsAt + t); // reveal
  assert.equal(s.phase, 'reveal');
  return s;
}
const next = (s) => x.tick(s, s.endsAt);

test('every layout has the right number of false tiles on each line', () => {
  for (let set = 0; set < 20; set++) {
    const m = x.buildMap('seed-' + set, set);
    assert.equal(m.length, x.ROWS);
    m.forEach((row, r) => {
      assert.equal(row.length, x.COLS);
      assert.equal(row.filter((ok) => !ok).length, x.FALSE_PER_ROW[r]);
    });
  }
  assert.deepEqual(x.FALSE_PER_ROW, [1, 2, 2, 3, 3, 4]);
  assert.equal(x.COLS, 6);
  assert.equal(x.ROWS, 6);
});

test('the layout is the same for the same seed and different for a new set', () => {
  assert.deepEqual(x.buildMap(SEED, 0), x.buildMap(SEED, 0));
  const sets = new Set(Array.from({ length: 10 }, (_, n) => JSON.stringify(x.buildMap(SEED, n))));
  assert.ok(sets.size > 1);
});

test('a new game starts picking on the first line with everybody alive', () => {
  const s = x.newGame([A, B], SEED, 1000);
  assert.equal(s.phase, 'pick');
  assert.equal(s.row, 0);
  assert.equal(s.leg, 'forward');
  assert.deepEqual(s.alive, [A, B]);
  assert.equal(s.endsAt, 1000 + x.PICK_MS);
});

test('a pick is hidden: the saved state has no picks, only who locked in', () => {
  let s = x.newGame([A, B], SEED, 0);
  s = x.apply(s, mv(s, A, 2));
  assert.deepEqual(s.locked, [A]);
  const pub = x.publicState(s);
  assert.deepEqual(pub.picks, {});
  assert.deepEqual(pub.pickAt, {});
  assert.deepEqual(pub.locked, [A]);
  assert.ok(!JSON.stringify(pub).includes('"a":2'));
});

test('a pick can be changed until the time is up; the last one counts', () => {
  let s = x.newGame([A, B], SEED, 0);
  const good = safeCols(s)[0];
  const bad = trapCols(s)[0];
  s = x.apply(s, mv(s, A, bad));
  s = x.apply(s, mv(s, A, good));
  s = x.apply(s, mv(s, B, good));
  s = x.tick(s, s.endsAt);
  assert.deepEqual(s.alive, [A, B]);
});

test('replaying the same moves does nothing (the host replays them on every update)', () => {
  let s = x.newGame([A, B], SEED, 0);
  const m1 = mv(s, A, 1);
  const m2 = mv(s, A, 3);
  s = x.apply(s, m1);
  s = x.apply(s, m2);
  for (let i = 0; i < 3; i++) {
    for (const m of [m1, m2]) assert.equal(x.apply(s, m), s);
  }
  assert.equal(s.picks[A], 3);
});

test('moves for an old step, from a dead player or off the board are ignored', () => {
  let s = x.newGame([A, B], SEED, 0);
  assert.equal(x.apply(s, { uid: A, rev: s.rev - 1, col: 1, at: 5 }), s);
  assert.equal(x.apply(s, mv(s, A, 6)), s);
  assert.equal(x.apply(s, mv(s, A, -1)), s);
  assert.equal(x.apply(s, mv(s, A, 1.5)), s);
  assert.equal(x.apply(s, mv(s, 'zed', 1)), s);
  assert.equal(x.tick(s, s.endsAt - 1), s); // nothing happens before the time is up
});

test('picking a false tile, or nothing, makes a player fall; the reveal shows what was stepped', () => {
  let s = x.newGame([A, B, C], SEED, 0);
  const good = safeCols(s)[0];
  const bad = trapCols(s)[0];
  s = step(s, { [A]: good, [B]: bad }); // C picks nothing
  assert.deepEqual(s.alive, [A]);
  assert.deepEqual(s.reveal.fell.sort(), [B, C]);
  const byUid = Object.fromEntries(s.reveal.steps.map((r) => [r.uid, r]));
  assert.deepEqual(byUid[A], { uid: A, col: good, safe: true });
  assert.deepEqual(byUid[B], { uid: B, col: bad, safe: false });
  assert.deepEqual(byUid[C], { uid: C, col: null, safe: false });
  // Only the stepped tiles are revealed: nothing else about the line is in the state.
  assert.ok(!('safe' in s.reveal) && !('map' in s));
});

test('players can step on the same tile', () => {
  let s = x.newGame([A, B], SEED, 0);
  const good = safeCols(s)[0];
  s = step(s, { [A]: good, [B]: good });
  assert.deepEqual(s.alive, [A, B]);
});

test('the last player left wins as soon as the others fall', () => {
  let s = x.newGame([A, B], SEED, 0);
  s = step(s, { [A]: safeCols(s)[0], [B]: trapCols(s)[0] });
  assert.equal(s.phase, 'reveal');
  s = next(s);
  assert.equal(s.phase, 'over');
  assert.equal(s.winner, A);
});

test('if everybody left falls on the same step, nobody wins (a draw)', () => {
  let s = x.newGame([A, B], SEED, 0);
  s = step(s, { [A]: trapCols(s)[0], [B]: trapCols(s)[1] });
  assert.deepEqual(s.alive, []);
  s = next(s);
  assert.equal(s.phase, 'over');
  assert.equal(s.winner, null);
});

test('survivors move up one line at a time, then back down the same tiles, then a new layout', () => {
  let s = x.newGame([A, B], SEED, 0);
  const seen = [];
  const set0 = x.mapFor(s.seed, 0);
  for (let guard = 0; guard < 40 && s.setNo === 0; guard++) {
    seen.push(`${s.leg}:${s.row}`);
    const col = safeCols(s)[0];
    s = step(s, { [A]: col, [B]: col });
    if (s.reveal.event) assert.equal(s.reveal.event, s.reveal.leg === 'forward' ? 'crossed' : 'home');
    s = next(s);
  }
  assert.deepEqual(seen, [
    'forward:0', 'forward:1', 'forward:2', 'forward:3', 'forward:4', 'forward:5',
    'back:5', 'back:4', 'back:3', 'back:2', 'back:1', 'back:0',
  ]);
  assert.equal(s.setNo, 1);
  assert.equal(s.leg, 'forward');
  assert.equal(s.row, 0);
  assert.equal(s.phase, 'pick');
  // The first layout never changed on the way, and the next one is a different object.
  assert.deepEqual(x.mapFor(s.seed, 0), set0);
});

test('events fire only on the last step of a leg', () => {
  let s = x.newGame([A, B], SEED, 0);
  const events = [];
  for (let i = 0; i < 12; i++) {
    const col = safeCols(s)[0];
    s = step(s, { [A]: col, [B]: col });
    events.push(s.reveal.event);
    s = next(s);
  }
  assert.deepEqual(events, [null, null, null, null, null, 'crossed', null, null, null, null, null, 'home']);
});

test('a player who forfeits is out at once; the last one left wins', () => {
  let s = x.newGame([A, B], SEED, 0);
  s = x.tick(s, 10, [B]);
  assert.equal(s.phase, 'over');
  assert.equal(s.winner, A);
  assert.equal(s.lastLeft, B);

  let t = x.newGame([A, B, C], SEED, 0);
  t = x.apply(t, mv(t, B, 1));
  t = x.tick(t, 10, [B]);
  assert.deepEqual(t.alive, [A, C]);
  assert.equal(t.phase, 'pick');
  assert.deepEqual(t.locked, []);
  assert.equal(t.picks[B], undefined);
});

test('a forfeit during the reveal does not skip the reveal', () => {
  let s = x.newGame([A, B, C], SEED, 0);
  const good = safeCols(s)[0];
  s = step(s, { [A]: good, [B]: good, [C]: good });
  s = x.tick(s, s.endsAt - 10, [B]);
  s = x.tick(s, s.endsAt - 10, [C]);
  assert.equal(s.phase, 'reveal');
  s = next(s);
  assert.equal(s.phase, 'over');
  assert.equal(s.winner, A);
});

test('the game is over for good: nothing changes it', () => {
  let s = x.newGame([A, B], SEED, 0);
  s = x.tick(s, 10, [B]);
  assert.equal(x.tick(s, 1e12, [A]), s);
  assert.equal(x.apply(s, mv(s, A, 1)), s);
});

test('timers: a step lasts PICK_MS, a reveal REVEAL_MS', () => {
  let s = x.newGame([A, B], SEED, 5000);
  const good = safeCols(s)[0];
  s = x.apply(s, mv(s, A, good));
  s = x.apply(s, mv(s, B, good));
  assert.equal(s.endsAt, 5000 + x.PICK_MS);
  s = x.tick(s, 5000 + x.PICK_MS);
  assert.equal(s.endsAt, 5000 + x.PICK_MS + x.REVEAL_MS);
  assert.equal(x.remainingNow({ remainingMs: 4000 }, 1000, 2500), 2500);
  assert.equal(x.remainingNow({ remainingMs: 4000 }, 1000, 9000), 0);
});

test('random play always ends, and a lone survivor really is the winner', () => {
  for (let g = 0; g < 200; g++) {
    let s = x.newGame(['p1', 'p2', 'p3', 'p4'], 'sim-' + g, 0);
    let t = 0;
    for (let guard = 0; guard < 2000 && s.phase !== 'over'; guard++) {
      for (const uid of s.alive) {
        s = x.apply(s, { uid, rev: s.rev, col: Math.floor(Math.random() * x.COLS), at: clock++ });
      }
      t = s.endsAt;
      s = x.tick(s, t);
      if (s.phase === 'reveal') s = x.tick(s, s.endsAt);
    }
    assert.equal(s.phase, 'over');
    assert.ok(s.winner === null ? s.alive.length === 0 : s.alive.length === 1 && s.alive[0] === s.winner);
  }
});

console.log(`\n${passed} tests passed`);
