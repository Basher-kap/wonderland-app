// Karuta engine tests. Compile, then run:
//   tsc src/game/karuta.ts --ignoreConfig --outDir <dir> --module commonjs --target es2020 --skipLibCheck
//   node test/karuta.test.cjs <dir>/game/karuta.js
const assert = require('node:assert');
const K = require(require('node:path').resolve(process.argv[2]));

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log('ok -', name);
};

const ids = (n) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const total = (s) =>
  Object.values(s.racks).reduce((a, r) => a + r.length, 0) + s.voidCards.length + s.taken.length;
const allCards = (s) => Object.values(s.racks).flat().concat(s.voidCards, s.taken).sort().join('');
const ALPHA = K.LETTERS.join('');

// Move the game to the live phase of target #1 (time = t).
function toLive(s, t = 0) {
  s = K.tick(s, t + K.MEMORIZE_MS); // memorize -> waiting
  assert.strictEqual(s.phase, 'waiting');
  s = K.tick(s, s.endsAt); // waiting -> live
  return s;
}

test('deal: equal racks, remainder is void, every letter exactly once', () => {
  for (let n = 2; n <= 8; n++) {
    const s = K.newGame(ids(n), 'seed' + n, 0);
    const per = Math.floor(26 / n);
    for (const id of s.order) assert.strictEqual(s.racks[id].length, per);
    assert.strictEqual(s.voidCards.length, 26 - per * n);
    assert.strictEqual(allCards(s), ALPHA);
  }
});

test('deal is deterministic for the same seed', () => {
  const a = K.newGame(ids(4), 'x', 0);
  const b = K.newGame(ids(4), 'x', 5);
  assert.deepStrictEqual(a.racks, b.racks);
});

test('memorize lasts 45 s, then waiting lasts at most 15 s', () => {
  let s = K.newGame(ids(3), 's', 1000);
  assert.strictEqual(s.phase, 'memorize');
  assert.strictEqual(K.tick(s, 1000 + 44999), s);
  s = K.tick(s, 1000 + 45000);
  assert.strictEqual(s.phase, 'waiting');
  assert.strictEqual(s.targetNo, 1);
  const w = s.endsAt - (1000 + 45000);
  assert.ok(w >= K.WAIT_MIN_MS && w <= K.WAIT_MAX_MS, 'wait ' + w);
});

test('target is never a void card and is on a rack', () => {
  for (let i = 0; i < 50; i++) {
    let s = K.newGame(ids(7), 'v' + i, 0);
    s = toLive(s);
    assert.ok(!s.voidCards.includes(s.target));
    assert.ok(K.cardsInPlay(s).includes(s.target));
  }
});

test('live: correct grab from another rack -> giving, time paused, then give', () => {
  let s = toLive(K.newGame(ids(3), 'a', 0), 0);
  const target = s.target;
  const owner = s.order.find((id) => s.racks[id].includes(target));
  const taker = s.order.find((id) => id !== owner);
  const before = s.racks[taker].length;
  const ownerBefore = s.racks[owner].length;
  s = K.apply(s, { uid: taker, rev: s.targetNo, kind: 'grab', owner, card: target }, 70000);
  assert.strictEqual(s.phase, 'giving');
  assert.strictEqual(s.giver, taker);
  assert.strictEqual(s.giveTo, owner);
  assert.ok(s.taken.includes(target));
  // the clock is paused: ticking before GIVE_MS ends does nothing
  assert.strictEqual(K.tick(s, 70000 + K.GIVE_MS - 1), s);
  // someone else cannot give for them
  assert.strictEqual(K.apply(s, { uid: owner, rev: s.targetNo, kind: 'give', card: s.racks[owner][0] }, 70001), s);
  // cannot send a card you do not hold
  assert.strictEqual(K.apply(s, { uid: taker, rev: s.targetNo, kind: 'give', card: 'ZZ' }, 70001), s);
  const card = s.racks[taker][0];
  s = K.apply(s, { uid: taker, rev: s.targetNo, kind: 'give', card }, 71000);
  assert.strictEqual(s.phase, 'waiting');
  assert.strictEqual(s.racks[taker].length, before - 1);
  assert.strictEqual(s.racks[owner].length, ownerBefore); // -1 taken, +1 received
  assert.ok(s.racks[owner].includes(card));
  assert.strictEqual(total(s), 26);
});

test('live: correct grab from own rack -> no give, next waiting', () => {
  let s = toLive(K.newGame(ids(3), 'b', 0), 0);
  const target = s.target;
  const owner = s.order.find((id) => s.racks[id].includes(target));
  const n = s.racks[owner].length;
  s = K.apply(s, { uid: owner, rev: s.targetNo, kind: 'grab', owner, card: target }, 70000);
  assert.strictEqual(s.phase, 'waiting');
  assert.strictEqual(s.racks[owner].length, n - 1);
  assert.strictEqual(s.targetNo, 2);
});

test('live: wrong grab -> the grabber receives that card, one grab per target', () => {
  let s = toLive(K.newGame(ids(3), 'c', 0), 0);
  const target = s.target;
  const grabber = s.order[0];
  const other = s.order.find((id) => id !== grabber && !s.racks[id].includes(target));
  const wrong = s.racks[other].find((c) => c !== target);
  const g = s.racks[grabber].length;
  const o = s.racks[other].length;
  s = K.apply(s, { uid: grabber, rev: s.targetNo, kind: 'grab', owner: other, card: wrong }, 70000);
  assert.strictEqual(s.phase, 'live');
  assert.strictEqual(s.racks[grabber].length, g + 1);
  assert.strictEqual(s.racks[other].length, o - 1);
  assert.ok(s.racks[grabber].includes(wrong));
  // a second grab by the same player is ignored
  const again = K.apply(s, { uid: grabber, rev: s.targetNo, kind: 'grab', owner: other, card: s.racks[other][0] }, 70001);
  assert.strictEqual(again, s);
  assert.strictEqual(total(s), 26);
});

test('live: wrong grab of your own card changes nothing but uses your grab', () => {
  let s = toLive(K.newGame(ids(3), 'd', 0), 0);
  const me = s.order.find((id) => !s.racks[id].includes(s.target));
  const card = s.racks[me][0];
  const before = JSON.stringify(s.racks);
  s = K.apply(s, { uid: me, rev: s.targetNo, kind: 'grab', owner: me, card }, 70000);
  assert.strictEqual(JSON.stringify(s.racks), before);
  assert.ok(s.tried.includes(me));
});

test('stale / invalid grabs are ignored', () => {
  let s = toLive(K.newGame(ids(3), 'e', 0), 0);
  const o = s.order[1];
  const card = s.racks[o][0];
  assert.strictEqual(K.apply(s, { uid: s.order[0], rev: s.targetNo - 1, kind: 'grab', owner: o, card }, 1), s);
  assert.strictEqual(K.apply(s, { uid: s.order[0], rev: s.targetNo, kind: 'grab', owner: o, card: 'Q'.repeat(2) }, 1), s);
  assert.strictEqual(K.apply(s, { uid: 'nobody', rev: s.targetNo, kind: 'grab', owner: o, card }, 1), s);
  assert.strictEqual(K.apply(s, { uid: s.order[0], rev: s.targetNo, kind: 'grab', owner: 'ghost', card }, 1), s);
});

test('nobody takes the target: after LIVE_MS the system takes it from its owner, then a new wait starts', () => {
  let s = toLive(K.newGame(ids(3), 'f', 0), 0);
  const no = s.targetNo;
  const target = s.target;
  const owner = s.order.find((id) => s.racks[id].includes(target));
  const n = s.racks[owner].length;
  assert.strictEqual(K.tick(s, s.endsAt - 1), s);
  s = K.tick(s, s.endsAt);
  assert.strictEqual(s.phase, 'waiting');
  assert.strictEqual(s.targetNo, no + 1);
  assert.strictEqual(s.target, null);
  assert.strictEqual(s.racks[owner].length, n - 1);
  assert.ok(!s.racks[owner].includes(target));
  assert.ok(s.taken.includes(target));
  const e = s.events[s.events.length - 1];
  assert.ok(e.kind === 'auto' && e.by === owner && e.card === target);
  assert.strictEqual(total(s), 26);
});

test('auto-take of the owner\'s last card clears the game for the owner', () => {
  let s = toLive(K.newGame(ids(3), 'f2', 0), 0);
  const owner = s.order.find((id) => s.racks[id].includes(s.target));
  s.racks[owner] = [s.target];
  s = K.tick(s, s.endsAt);
  assert.strictEqual(s.phase, 'over');
  assert.strictEqual(s.winner, owner);
});

test('advance grab: secret in public state, only who has grabbed is shown', () => {
  let s = K.tick(K.newGame(ids(3), 'g', 0), K.MEMORIZE_MS);
  const me = s.order[0];
  const o = s.order[1];
  const card = s.racks[o][0];
  s = K.apply(s, { uid: me, rev: s.targetNo, kind: 'grab', owner: o, card, at: 5 }, 50000);
  assert.deepStrictEqual(s.advanced, [me]);
  const pub = K.publicState(s);
  assert.deepStrictEqual(pub.advance, {});
  assert.deepStrictEqual(pub.advanced, [me]);
  // one advance grab per target
  assert.strictEqual(K.apply(s, { uid: me, rev: s.targetNo, kind: 'grab', owner: o, card: s.racks[o][1], at: 6 }, 50001), s);
  // host restart rebuilds it from the moves
  const rebuilt = K.withAdvance(pub, [{ uid: me, rev: s.targetNo, kind: 'grab', owner: o, card, at: 5 }]);
  assert.deepStrictEqual(rebuilt.advance[me], { owner: o, card, at: 5 });
});

test('advance grab judged at reveal: wrong = penalty (receives the card)', () => {
  let s = K.tick(K.newGame(ids(3), 'h', 0), K.MEMORIZE_MS);
  const me = s.order[0];
  // choose a guess that cannot be the target
  const tgt = K.chooseTarget(s);
  const o = s.order[1];
  const card = s.racks[o].find((c) => c !== tgt);
  const mine = s.racks[me].length;
  s = K.apply(s, { uid: me, rev: s.targetNo, kind: 'grab', owner: o, card, at: 1 }, 50000);
  s = K.tick(s, s.endsAt);
  assert.strictEqual(s.phase, 'live');
  assert.strictEqual(s.racks[me].length, mine + 1);
  assert.ok(s.racks[me].includes(card));
  assert.ok(s.tried.includes(me)); // used its grab
  const e = s.events.find((x) => x.kind === 'wrong');
  assert.ok(e && e.advance === true);
});

test('advance grab judged at reveal: lucky guess counts as a correct grab', () => {
  let s = K.tick(K.newGame(ids(3), 'i', 0), K.MEMORIZE_MS);
  const tgt = K.chooseTarget(s);
  const owner = s.order.find((id) => s.racks[id].includes(tgt));
  const me = s.order.find((id) => id !== owner);
  s = K.apply(s, { uid: me, rev: s.targetNo, kind: 'grab', owner, card: tgt, at: 1 }, 50000);
  s = K.tick(s, s.endsAt);
  assert.strictEqual(s.phase, 'giving');
  assert.strictEqual(s.giver, me);
  assert.strictEqual(s.giveTo, owner);
  assert.ok(s.taken.includes(tgt));
});

test('two lucky advance guesses: the earlier one wins, the later is just late', () => {
  let s = K.tick(K.newGame(ids(3), 'j', 0), K.MEMORIZE_MS);
  const tgt = K.chooseTarget(s);
  const owner = s.order.find((id) => s.racks[id].includes(tgt));
  const [a, b] = s.order.filter((id) => id !== owner);
  s = K.apply(s, { uid: b, rev: s.targetNo, kind: 'grab', owner, card: tgt, at: 20 }, 50000);
  s = K.apply(s, { uid: a, rev: s.targetNo, kind: 'grab', owner, card: tgt, at: 10 }, 50001);
  s = K.tick(s, s.endsAt);
  assert.strictEqual(s.giver, a);
  assert.strictEqual(s.racks[b].length, 8); // no penalty for b
});

test('giving timeout: the host sends a random card', () => {
  let s = toLive(K.newGame(ids(3), 'k', 0), 0);
  const target = s.target;
  const owner = s.order.find((id) => s.racks[id].includes(target));
  const taker = s.order.find((id) => id !== owner);
  s = K.apply(s, { uid: taker, rev: s.targetNo, kind: 'grab', owner, card: target }, 70000);
  const n = s.racks[taker].length;
  s = K.tick(s, s.endsAt);
  assert.strictEqual(s.phase, 'waiting');
  assert.strictEqual(s.racks[taker].length, n - 1);
  assert.ok(s.events.some((e) => e.kind === 'gave' && e.auto));
});

test('the first player with an empty rack wins (own correct grab of the last card)', () => {
  let s = toLive(K.newGame(ids(3), 'l', 0), 0);
  const target = s.target;
  const owner = s.order.find((id) => s.racks[id].includes(target));
  s.racks[owner] = [target]; // force: the target is their last card
  s = K.apply(s, { uid: owner, rev: s.targetNo, kind: 'grab', owner, card: target }, 70000);
  assert.strictEqual(s.phase, 'over');
  assert.strictEqual(s.winner, owner);
});

test('taking someone\'s last card does not make them win: they get the sent card', () => {
  let s = toLive(K.newGame(ids(3), 'm', 0), 0);
  const target = s.target;
  const owner = s.order.find((id) => s.racks[id].includes(target));
  const taker = s.order.find((id) => id !== owner);
  s.racks[owner] = [target];
  s = K.apply(s, { uid: taker, rev: s.targetNo, kind: 'grab', owner, card: target }, 70000);
  assert.strictEqual(s.phase, 'giving');
  s = K.apply(s, { uid: taker, rev: s.targetNo, kind: 'give', card: s.racks[taker][0] }, 70500);
  assert.strictEqual(s.phase, 'waiting');
  assert.strictEqual(s.racks[owner].length, 1);
});

test('giving the last card to the owner clears the game for the giver', () => {
  let s = toLive(K.newGame(ids(3), 'n', 0), 0);
  const target = s.target;
  const owner = s.order.find((id) => s.racks[id].includes(target));
  const taker = s.order.find((id) => id !== owner);
  s.racks[taker] = ['#'];
  s = K.apply(s, { uid: taker, rev: s.targetNo, kind: 'grab', owner, card: target }, 70000);
  s = K.apply(s, { uid: taker, rev: s.targetNo, kind: 'give', card: '#' }, 70500);
  assert.strictEqual(s.phase, 'over');
  assert.strictEqual(s.winner, taker);
});

test('a wrong grab that empties the owner\'s rack clears the game for the owner', () => {
  let s = toLive(K.newGame(ids(3), 'o', 0), 0);
  const target = s.target;
  const owner = s.order.find((id) => !s.racks[id].includes(target));
  const grabber = s.order.find((id) => id !== owner);
  const card = s.racks[owner][0];
  s.racks[owner] = [card];
  s = K.apply(s, { uid: grabber, rev: s.targetNo, kind: 'grab', owner, card }, 70000);
  assert.strictEqual(s.phase, 'over');
  assert.strictEqual(s.winner, owner);
});

test('forfeit: cards leave the game; the last player left wins', () => {
  let s = K.tick(K.newGame(ids(2), 'p', 0), K.MEMORIZE_MS);
  s = K.tick(s, 50000, ['p2']);
  assert.strictEqual(s.phase, 'over');
  assert.strictEqual(s.winner, 'p1');
  assert.strictEqual(total(s), 26);
});

test('forfeit while giving cancels the give', () => {
  let s = toLive(K.newGame(ids(3), 'q', 0), 0);
  const target = s.target;
  const owner = s.order.find((id) => s.racks[id].includes(target));
  const taker = s.order.find((id) => id !== owner);
  s = K.apply(s, { uid: taker, rev: s.targetNo, kind: 'grab', owner, card: target }, 70000);
  s = K.tick(s, 70100, [owner]);
  assert.strictEqual(s.phase, 'waiting');
  assert.ok(s.out.includes(owner));
  assert.strictEqual(total(s), 26);
});

test('forfeit of the target\'s owner while live starts the next wait', () => {
  let s = toLive(K.newGame(ids(3), 'r', 0), 0);
  const owner = s.order.find((id) => s.racks[id].includes(s.target));
  s = K.tick(s, s.endsAt - 1000, [owner]);
  assert.strictEqual(s.phase, 'waiting');
});

test('safety cap: the fewest cards wins, a tie is a draw', () => {
  let s = K.newGame(ids(2), 't', 0);
  s.racks.p1.pop();
  const w = K.tick(s, s.deadline);
  assert.strictEqual(w.phase, 'over');
  assert.strictEqual(w.winner, 'p1');
  const d = K.tick(K.newGame(ids(2), 't', 0), K.newGame(ids(2), 't', 0).deadline);
  assert.strictEqual(d.winner, null);
});

test('a state that is applied twice is unchanged (moves are re-applied on every snapshot)', () => {
  let s = toLive(K.newGame(ids(3), 'u', 0), 0);
  const target = s.target;
  const owner = s.order.find((id) => s.racks[id].includes(target));
  const taker = s.order.find((id) => id !== owner);
  const mv = { uid: taker, rev: s.targetNo, kind: 'grab', owner, card: target };
  s = K.apply(s, mv, 1);
  const g = { uid: taker, rev: s.targetNo, kind: 'give', card: s.racks[taker][0] };
  s = K.apply(s, g, 2);
  const after = JSON.stringify(s);
  s = K.apply(s, mv, 3);
  s = K.apply(s, g, 3);
  assert.strictEqual(JSON.stringify(s), after);
});

test('random bots: 300 full games always end, cards are conserved, no crash', () => {
  let rng = 12345;
  const rnd = () => ((rng = (rng * 1664525 + 1013904223) >>> 0) / 4294967296);
  let ended = 0;
  for (let g = 0; g < 300; g++) {
    const n = 2 + Math.floor(rnd() * 7);
    let s = K.newGame(ids(n), 'bot' + g, 0);
    let now = 0;
    let steps = 0;
    while (s.phase !== 'over' && steps++ < 20000) {
      now += 500 + Math.floor(rnd() * 1500);
      // bots: sometimes grab (advance, live) or give
      const p = s.order[Math.floor(rnd() * n)];
      if (s.phase === 'giving') {
        if (rnd() < 0.5) s = K.apply(s, { uid: s.giver, rev: s.targetNo, kind: 'give', card: s.racks[s.giver][0] }, now);
      } else if (s.phase === 'waiting' || s.phase === 'live') {
        if (rnd() < 0.5) {
          const owner = s.order[Math.floor(rnd() * n)];
          const rack = s.racks[owner];
          if (rack.length) {
            const card = s.phase === 'live' && rnd() < 0.5 && s.target && rack.includes(s.target) ? s.target : rack[Math.floor(rnd() * rack.length)];
            s = K.apply(s, { uid: p, rev: s.targetNo, kind: 'grab', owner, card, at: now }, now);
          }
        }
      }
      s = K.tick(s, now, rnd() < 0.001 ? [p] : []);
      assert.strictEqual(total(s), 26, 'cards conserved');
      assert.strictEqual(allCards(s), ALPHA, 'every letter exactly once');
    }
    assert.strictEqual(s.phase, 'over', 'game ' + g + ' ended');
    ended++;
  }
  assert.strictEqual(ended, 300);
});

console.log(`\n${passed} tests passed`);