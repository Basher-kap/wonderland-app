const assert = require('assert');
const m = require(require('path').resolve(process.argv[2]));
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

const T0 = 1_000_000;
const ids = ['a', 'b', 'c'];
const place = (s, uid, cells, now = T0 + 1000) => m.apply(s, { uid, rev: s.rev, kind: 'place', cells }, now);
const shoot = (s, uid, cell, now = T0 + 20000) => m.apply(s, { uid, rev: s.rev, kind: 'shoot', cell }, now);
// Ships: a = 0..6, b = 7..13, c = 14..20 (cells 21-24 are empty), then the battle starts.
const SHIPS = { a: [0, 1, 2, 3, 4, 5, 6], b: [7, 8, 9, 10, 11, 12, 13], c: [14, 15, 16, 17, 18, 19, 20] };
const battle = (players = ids, ships = SHIPS) => {
  let s = m.newGame(players, 'Seed', T0);
  for (const id of players) s = place(s, id, ships[id]);
  s = m.tick(s, T0 + 2000); // everybody placed: countdown starts at once
  s = m.tick(s, T0 + 2000 + m.COUNTDOWN_MS); // first turn
  return s;
};
const T = (s) => s.endsAt; // a time at which the running timer is over
const afterResult = (s) => m.tick(s, s.endsAt);

t('cell names', () => {
  assert.strictEqual(m.cellName(0), 'A1');
  assert.strictEqual(m.cellName(4), 'A5');
  assert.strictEqual(m.cellName(24), 'E5');
  assert.strictEqual(m.cellName(7), 'B3');
});
t('a placement is cleaned: valid distinct cells, max 7, topped up deterministically', () => {
  assert.deepStrictEqual(m.sanitizePlacement([0, 1, 2, 3, 4, 5, 6], 's', 'a'), [0, 1, 2, 3, 4, 5, 6]);
  const p = m.sanitizePlacement([3, 3, -1, 99, 'x', 1.5, 4], 's', 'a');
  assert.strictEqual(p.length, m.SHIP_COUNT);
  assert.strictEqual(new Set(p).size, m.SHIP_COUNT);
  assert.ok(p.includes(3) && p.includes(4));
  assert.ok(p.every((c) => c >= 0 && c < 25));
  assert.deepStrictEqual(p, m.sanitizePlacement([3, 3, -1, 99, 'x', 1.5, 4], 's', 'a'));
  assert.strictEqual(m.sanitizePlacement([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 's', 'a').length, 7);
  assert.strictEqual(m.sanitizePlacement(undefined, 's', 'a').length, 7);
  assert.notDeepStrictEqual(m.sanitizePlacement([], 's', 'a'), m.sanitizePlacement([], 's', 'b'));
});
t('new game: placing, 7 ships, 5 bullets each, 15 s', () => {
  const g = m.newGame(ids, 'Seed', T0);
  assert.strictEqual(g.phase, 'placing');
  assert.strictEqual(g.endsAt, T0 + 15000);
  for (const id of ids) {
    assert.strictEqual(g.shipsLeft[id], 7);
    assert.strictEqual(g.bullets[id], 5);
  }
  assert.deepStrictEqual([...g.turnOrder].sort(), ids);
});
t('placing: only the first placement of a player counts; the battle starts when all placed', () => {
  let g = m.newGame(ids, 'Seed', T0);
  g = place(g, 'a', SHIPS.a);
  assert.deepStrictEqual(g.ships.a, SHIPS.a);
  assert.strictEqual(place(g, 'a', [20, 21, 22, 23, 24, 0, 1]), g); // second one ignored
  assert.strictEqual(m.tick(g, T0 + 5000), g); // b and c still to place
  g = place(g, 'b', SHIPS.b);
  g = place(g, 'c', SHIPS.c);
  const s = m.tick(g, T0 + 5000);
  assert.strictEqual(s.phase, 'countdown');
  assert.strictEqual(s.endsAt, T0 + 5000 + m.COUNTDOWN_MS);
  assert.strictEqual(m.apply(m.newGame(ids, 'Seed', T0), { uid: 'zz', rev: 0, kind: 'place', cells: [0] }, T0).placed.length, 0);
});
t('time is up: the host waits the grace, then fills in the missing placements', () => {
  let g = m.newGame(ids, 'Seed', T0);
  g = place(g, 'a', SHIPS.a);
  assert.strictEqual(m.tick(g, T0 + m.PLACE_MS + m.PLACE_GRACE_MS - 1), g);
  const s = m.tick(g, T0 + m.PLACE_MS + m.PLACE_GRACE_MS);
  assert.strictEqual(s.phase, 'countdown');
  assert.deepStrictEqual(s.ships.a, SHIPS.a);
  assert.strictEqual(s.ships.b.length, 7);
  assert.strictEqual(s.ships.c.length, 7);
  assert.ok(!s.placed.includes('b'));
  // a late placement does not change the filled-in one
  assert.strictEqual(place(s, 'b', SHIPS.b), s);
});
t('a partial placement is topped up to 7', () => {
  let g = m.newGame(ids, 'Seed', T0);
  g = place(g, 'a', [0, 1, 2]);
  assert.strictEqual(g.ships.a.length, 7);
  assert.ok([0, 1, 2].every((c) => g.ships.a.includes(c)));
});
t('after the countdown the first player in the random order is on the clock', () => {
  const s = battle();
  assert.strictEqual(s.phase, 'aiming');
  assert.strictEqual(s.current, s.turnOrder[0]);
  assert.strictEqual(s.endsAt, T0 + 2000 + m.COUNTDOWN_MS + m.TURN_MS);
});
t('a miss loses a bullet and marks the cell', () => {
  const s = battle();
  const me = s.current;
  const s2 = shoot(s, me, 23);
  const sh = s2.shots[0];
  assert.strictEqual(sh.outcome, 'miss');
  assert.strictEqual(sh.cell, 23);
  assert.strictEqual(s2.bullets[me], 4);
  assert.strictEqual(s2.phase, 'result');
  for (const id of ids) assert.strictEqual(s2.shipsLeft[id], 7);
});
t('a hit on an enemy ship keeps the bullet and sinks the ship', () => {
  const s = battle();
  const me = s.current;
  const target = ids.find((id) => id !== me);
  const s2 = shoot(s, me, SHIPS[target][0]);
  assert.strictEqual(s2.shots[0].outcome, 'hit');
  assert.deepStrictEqual(s2.shots[0].victims, [target]);
  assert.strictEqual(s2.bullets[me], 5);
  assert.strictEqual(s2.shipsLeft[target], 6);
  assert.deepStrictEqual(s2.destroyed[target], [SHIPS[target][0]]);
  assert.ok(!s2.ships[target].includes(SHIPS[target][0]));
});
t('hitting your own ship loses a bullet and sinks it', () => {
  const s = battle();
  const me = s.current;
  const s2 = shoot(s, me, SHIPS[me][0]);
  assert.strictEqual(s2.shots[0].outcome, 'own');
  assert.strictEqual(s2.bullets[me], 4);
  assert.strictEqual(s2.shipsLeft[me], 6);
  assert.deepStrictEqual(s2.shots[0].victims, []);
});
t('own ship and an enemy ship on the same cell: neutral, no bullet lost, both sunk', () => {
  const ships = { ...SHIPS, a: [0, 1, 2, 3, 4, 5, 7], b: [7, 8, 9, 10, 11, 12, 13] }; // a and b share cell 7
  let s = battle(ids, ships);
  while (s.current !== 'a') {
    s = afterResult(shoot(s, s.current, 24)); // others miss (-1 bullet each) until it is a's turn
  }
  const s2 = shoot(s, 'a', 7);
  assert.strictEqual(s2.shots[s2.shots.length - 1].outcome, 'neutral');
  assert.deepStrictEqual(s2.shots[s2.shots.length - 1].victims, ['b']);
  assert.strictEqual(s2.bullets.a, s.bullets.a);
  assert.strictEqual(s2.shipsLeft.a, 6);
  assert.strictEqual(s2.shipsLeft.b, 6);
});
t('one ship cell holding two enemies sinks both', () => {
  const ships = { a: [0, 1, 2, 3, 4, 5, 6], b: [7, 8, 9, 10, 11, 12, 13], c: [7, 15, 16, 17, 18, 19, 20] };
  let s = battle(ids, ships);
  while (s.current !== 'a') s = afterResult(shoot(s, s.current, 24));
  const s2 = shoot(s, 'a', 7);
  assert.deepStrictEqual([...s2.shots[s2.shots.length - 1].victims].sort(), ['b', 'c']);
  assert.strictEqual(s2.shipsLeft.b, 6);
  assert.strictEqual(s2.shipsLeft.c, 6);
});
t('moves: only the player on the clock, a free cell, the right rev', () => {
  const s = battle();
  const other = ids.find((id) => id !== s.current);
  assert.strictEqual(shoot(s, other, 23), s);
  assert.strictEqual(shoot(s, s.current, 25), s);
  assert.strictEqual(shoot(s, s.current, -1), s);
  assert.strictEqual(shoot(s, s.current, 1.5), s);
  assert.strictEqual(m.apply(s, { uid: s.current, rev: s.rev - 1, kind: 'shoot', cell: 23 }, T0), s);
  const s2 = shoot(s, s.current, 23);
  assert.strictEqual(shoot(s2, s.current, 22), s2); // in the result phase nobody can shoot
  const s3 = afterResult(s2);
  assert.strictEqual(shoot(s3, s3.current, 23), s3); // the cell is taken
});
t('the result stays 2.5 s, then the next player in the order is on the clock', () => {
  const s = battle();
  const first = s.current;
  const s2 = shoot(s, first, 23, s.endsAt - 1000);
  assert.strictEqual(m.tick(s2, s2.endsAt - 1), s2);
  const s3 = afterResult(s2);
  assert.strictEqual(s3.phase, 'aiming');
  assert.strictEqual(s3.current, s3.turnOrder[(s3.turnOrder.indexOf(first) + 1) % 3]);
});
t('too slow: the turn is lost with a bullet, no cell is marked', () => {
  const s = battle();
  const me = s.current;
  assert.strictEqual(m.tick(s, s.endsAt - 1), s);
  const s2 = m.tick(s, s.endsAt);
  assert.strictEqual(s2.shots[0].outcome, 'timeout');
  assert.strictEqual(s2.shots[0].cell, null);
  assert.strictEqual(s2.bullets[me], 4);
  assert.deepStrictEqual(m.shotCells(s2), []);
});
t('a player with no bullets is skipped but keeps their ships', () => {
  let s = battle();
  // a, b, c all miss until somebody has 0 bullets
  const free = [21, 22, 23, 24];
  let i = 0;
  const target = s.turnOrder[0];
  // The first player misses with timeouts; the others shoot a free cell if any, otherwise time out.
  for (let k = 0; k < 30 && s.phase !== 'over'; k++) {
    if (s.phase === 'aiming') {
      if (s.current === target) s = m.tick(s, s.endsAt);
      else s = m.tick(s, s.endsAt);
    } else {
      s = m.tick(s, s.endsAt);
    }
    if (s.bullets[target] === 0) break;
  }
  assert.strictEqual(s.bullets[target], 0);
  assert.strictEqual(s.shipsLeft[target], 7);
  s = m.tick(s, s.endsAt);
  if (s.phase === 'aiming') assert.notStrictEqual(s.current, target);
});
t('everybody out of bullets: the most ships win, then bullets; a tie is a draw', () => {
  // Everybody times out 5 times: all keep 7 ships and 0 bullets => draw.
  let s = battle();
  for (let k = 0; k < 100 && s.phase !== 'over'; k++) s = m.tick(s, s.endsAt);
  assert.strictEqual(s.phase, 'over');
  assert.strictEqual(s.winner, null);
  for (const id of ids) assert.strictEqual(s.bullets[id], 0);
});
t('a leader on ships wins when the bullets run out', () => {
  let s = battle();
  // The first player in the order sinks one ship of the next player; everyone else times out.
  const first = s.turnOrder[0];
  const victim = s.turnOrder[1];
  s = shoot(s, first, SHIPS[victim][0]);
  s = afterResult(s);
  for (let k = 0; k < 100 && s.phase !== 'over'; k++) s = m.tick(s, s.endsAt);
  assert.strictEqual(s.phase, 'over');
  // victim has 6 ships; the other two have 7: if those two are tied on bullets it is a draw, otherwise the one with more bullets wins
  assert.ok(s.winner === null || s.winner !== victim);
  assert.strictEqual(s.shipsLeft[victim], 6);
});
t('last player with a battleship wins at once (after the result)', () => {
  // b and c have a single ship each, next to a's.
  const ships = { a: [0, 1, 2, 3, 4, 5, 6], b: [7, 0, 0, 0, 0, 0, 0], c: [8, 9, 10, 11, 12, 13, 14] };
  const g = battle(['a', 'b'], { a: ships.a, b: [7, 8, 9, 10, 11, 12, 13] });
  let s = g;
  // sink all of b's ships with whoever shoots; the other player times out when it is not a's turn
  for (let k = 0; k < 200 && s.phase !== 'over'; k++) {
    if (s.phase === 'aiming' && s.current === 'a') {
      const cell = [7, 8, 9, 10, 11, 12, 13].find((c) => !m.shotCells(s).includes(c));
      s = shoot(s, 'a', cell, s.endsAt - 1);
    } else s = m.tick(s, s.endsAt);
  }
  assert.strictEqual(s.phase, 'over');
  assert.strictEqual(s.winner, 'a');
  assert.strictEqual(s.shipsLeft.b, 0);
  assert.strictEqual(s.bullets.a, 5);
});
t('a player with no ships is out and does not shoot any more', () => {
  const g = battle(['a', 'b', 'c'], { a: [0, 1, 2, 3, 4, 5, 6], b: [7, 8, 9, 10, 11, 12, 13], c: [14, 15, 16, 17, 18, 19, 20] });
  let s = g;
  for (let k = 0; k < 400 && s.phase !== 'over'; k++) {
    if (s.phase === 'aiming' && s.current !== 'b') {
      // everyone but b shoots b's ships first
      const cell = [7, 8, 9, 10, 11, 12, 13].find((c) => !m.shotCells(s).includes(c));
      if (cell !== undefined) s = shoot(s, s.current, cell, s.endsAt - 1);
      else s = m.tick(s, s.endsAt);
    } else s = m.tick(s, s.endsAt);
    if (s.shipsLeft.b === 0) break;
  }
  assert.strictEqual(s.shipsLeft.b, 0);
  assert.ok(s.shots.some((x) => x.out.includes('b')));
  for (let k = 0; k < 60 && s.phase !== 'over'; k++) {
    s = m.tick(s, s.endsAt);
    if (s.phase === 'aiming') assert.notStrictEqual(s.current, 'b');
  }
});
t('forfeit: the player leaves with their ships; the turn passes; last one left wins', () => {
  let s = battle();
  const quitter = s.current;
  s = m.tick(s, s.endsAt - 1000, [quitter]);
  assert.strictEqual(s.shipsLeft[quitter], 0);
  assert.notStrictEqual(s.current, quitter);
  assert.strictEqual(s.phase, 'aiming');
  const second = ids.find((id) => id !== quitter && id !== s.current);
  s = m.tick(s, s.endsAt - 500, [second]);
  assert.strictEqual(s.phase, 'over');
  assert.strictEqual(s.winner, s.order.find((id) => id !== quitter && id !== second));
});
t('forfeit while placing; everybody leaving is a draw', () => {
  let g = m.newGame(ids, 'Seed', T0);
  g = m.tick(g, T0 + 100, ['c']);
  assert.strictEqual(g.phase, 'placing');
  g = place(g, 'a', SHIPS.a);
  g = place(g, 'b', SHIPS.b);
  g = m.tick(g, T0 + 200); // c is out, so nobody is waited for
  assert.strictEqual(g.phase, 'countdown');
  assert.deepStrictEqual(g.ships.c, []);
  let h = m.newGame(ids, 'Seed', T0);
  h = m.tick(h, T0 + 100, ['a']);
  h = m.tick(h, T0 + 101, ['b']);
  assert.strictEqual(h.phase, 'over');
  assert.strictEqual(h.winner, 'c');
});
t('ship positions are not in the public state, and can be rebuilt from the placement moves', () => {
  let s = battle();
  const target = ids.find((id) => id !== s.current);
  s = shoot(s, s.current, SHIPS[target][0]);
  const pub = m.publicState(s);
  assert.deepStrictEqual(pub.ships, {});
  assert.ok(!JSON.stringify(pub).includes('"ships":{"a"'));
  const moves = ids.map((id, i) => ({ uid: id, kind: 'place', cells: SHIPS[id], at: i }));
  const back = m.withShips(JSON.parse(JSON.stringify(pub)), moves);
  assert.deepStrictEqual(back.ships[target], SHIPS[target].slice(1));
  for (const id of ids) if (id !== target) assert.deepStrictEqual(back.ships[id], SHIPS[id]);
});
t('rebuilding the ships for a filled-in player gives the same fill', () => {
  let g = m.newGame(ids, 'Seed', T0);
  g = place(g, 'a', SHIPS.a);
  g = m.tick(g, T0 + m.PLACE_MS + m.PLACE_GRACE_MS);
  const back = m.withShips(JSON.parse(JSON.stringify(m.publicState(g))), [
    { uid: 'a', kind: 'place', cells: SHIPS.a, at: 1 },
    { uid: 'b', kind: 'place', cells: SHIPS.b, at: 99 }, // arrived too late: not accepted
  ]);
  assert.deepStrictEqual(back.ships.a, g.ships.a);
  assert.deepStrictEqual(back.ships.b, g.ships.b);
  assert.deepStrictEqual(back.ships.c, g.ships.c);
});
t('state survives JSON (it is saved as text)', () => {
  const s = shoot(battle(), battle().current, 23);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(s)), s);
});
t('random play always ends, with consistent counts (2-8 players, 300 games)', () => {
  let seedN = 1;
  const rnd = () => ((seedN = (seedN * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let g = 0; g < 300; g++) {
    const k = 2 + Math.floor(rnd() * 7);
    const players = Array.from({ length: k }, (_, i) => 'p' + i);
    let s = m.newGame(players, 'R' + g, T0);
    for (const p of players) if (rnd() < 0.7) s = place(s, p, shuffledCells(rnd));
    s = m.tick(s, T0 + m.PLACE_MS + m.PLACE_GRACE_MS);
    let steps = 0;
    while (s.phase !== 'over' && steps++ < 1000) {
      if (s.phase === 'aiming' && rnd() < 0.8) {
        const free = Array.from({ length: 25 }, (_, i) => i).filter((c) => !m.shotCells(s).includes(c));
        s = shoot(s, s.current, free[Math.floor(rnd() * free.length)], s.endsAt - 1);
      } else s = m.tick(s, s.endsAt);
    }
    assert.strictEqual(s.phase, 'over', 'game ' + g + ' did not end');
    for (const p of players) {
      assert.ok(s.bullets[p] >= 0 && s.bullets[p] <= 5);
      assert.strictEqual(s.shipsLeft[p], s.ships[p].length);
      assert.strictEqual(s.shipsLeft[p] + s.destroyed[p].length, 7);
    }
    if (s.winner) assert.ok(s.shipsLeft[s.winner] > 0);
    assert.strictEqual(new Set(m.shotCells(s)).size, m.shotCells(s).length);
  }
});
function shuffledCells(rnd) {
  const a = Array.from({ length: 25 }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, 7);
}
console.log(n + ' tests passed');
