const assert = require('assert');
const s = require(require('path').resolve(process.argv[2]));
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('same seed gives same set', () => {
  assert.deepStrictEqual(s.levelCells(3, 'm:1:L3'), s.levelCells(3, 'm:1:L3'));
});
t('level sizes and ranges', () => {
  const spec = { 1: [25, 1, 25], 2: [25, 1, 25], 3: [25, 1, 99], 4: [50, 1, 50], 5: [25, 1, 25] };
  for (const [lv, [count, lo, hi]] of Object.entries(spec)) {
    for (let k = 0; k < 50; k++) {
      const c = s.levelCells(+lv, 'x' + k);
      assert.strictEqual(c.length, count);
      assert.strictEqual(new Set(c.map(x => x.value)).size, count, 'distinct values');
      c.forEach(x => assert.ok(x.value >= lo && x.value <= hi));
    }
  }
});
t('levels 1, 2, 4, 5 use every number of their range; level 3 varies', () => {
  const vals = (lv, seed) => s.levelCells(lv, seed).map(c => c.value).sort((a, b) => a - b);
  assert.deepStrictEqual(vals(2, 'q'), Array.from({ length: 25 }, (_, i) => i + 1));
  assert.deepStrictEqual(vals(4, 'q'), Array.from({ length: 50 }, (_, i) => i + 1));
  assert.deepStrictEqual(vals(5, 'q'), Array.from({ length: 25 }, (_, i) => i + 1));
  assert.notDeepStrictEqual(vals(3, 'q1'), vals(3, 'q2'));
});
t('level 2 is tapped descending, the others ascending', () => {
  assert.deepStrictEqual(s.tapOrder(s.levelCells(2, 'z'), 2), Array.from({ length: 25 }, (_, i) => 25 - i));
  for (const lv of [1, 3, 4, 5]) {
    const o = s.tapOrder(s.levelCells(lv, 'z'), lv);
    assert.deepStrictEqual(o, [...o].sort((a, b) => a - b));
  }
});
t('level 5 equations evaluate to their value', () => {
  for (let k = 0; k < 200; k++) {
    s.levelCells(5, 'eq' + k).forEach(c => {
      const m = c.label.match(/^(\d+) ([+\-x]) (\d+)$/);
      assert.ok(m, c.label);
      const a = +m[1], b = +m[3];
      const v = m[2] === '+' ? a + b : m[2] === '-' ? a - b : a * b;
      assert.strictEqual(v, c.value, c.label);
    });
  }
});
t('arrange keeps same cells, changes order by seed', () => {
  const cells = s.levelCells(1, 'a');
  const a = s.arrange(cells, 'a1'), b = s.arrange(cells, 'a2');
  assert.deepStrictEqual([...a].sort((x, y) => x.value - y.value), [...cells].sort((x, y) => x.value - y.value));
  assert.notDeepStrictEqual(a, b);
});
t('tap flow: ascending, wrong, done', () => {
  for (const lv of [1, 2, 3, 4, 5]) {
    const cells = s.levelCells(lv, 'b');
    const order = s.tapOrder(cells, lv);
    assert.strictEqual(s.tap(cells, 0, order[1], lv), 'wrong');
    for (let i = 0; i < order.length - 1; i++) assert.strictEqual(s.tap(cells, i, order[i], lv), 'correct');
    assert.strictEqual(s.tap(cells, order.length - 1, order[order.length - 1], lv), 'levelDone');
  }
});
t('winner: fastest finisher; unfinished lose; tie = null', () => {
  assert.strictEqual(s.pickWinner([{uid:'a',finished:true,totalMs:9000},{uid:'b',finished:true,totalMs:8000},{uid:'c',finished:false,totalMs:1}]), 'b');
  assert.strictEqual(s.pickWinner([{uid:'a',finished:false,totalMs:1}]), null);
  assert.strictEqual(s.pickWinner([{uid:'a',finished:true,totalMs:5},{uid:'b',finished:true,totalMs:5}]), null);
});
console.log(n + ' tests passed');
