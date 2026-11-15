const assert = require('assert');
const s = require(require('path').resolve(process.argv[2]));
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('same seed gives same set', () => {
  assert.deepStrictEqual(s.levelCells(3, 'm:1:L3'), s.levelCells(3, 'm:1:L3'));
});
t('level sizes and ranges', () => {
  const spec = { 1: [25, 1, 25], 2: [25, 1, 50], 3: [25, 100, 999], 4: [50, 100, 999], 5: [30, 1, 30] };
  for (const [lv, [count, lo, hi]] of Object.entries(spec)) {
    for (let k = 0; k < 50; k++) {
      const c = s.levelCells(+lv, 'x' + k);
      assert.strictEqual(c.length, count);
      assert.strictEqual(new Set(c.map(x => x.value)).size, count, 'distinct values');
      c.forEach(x => assert.ok(x.value >= lo && x.value <= hi));
    }
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
  const cells = s.levelCells(2, 'b');
  const sorted = cells.map(c => c.value).sort((x, y) => x - y);
  assert.strictEqual(s.tap(cells, 0, sorted[1]), 'wrong');
  for (let i = 0; i < sorted.length - 1; i++) assert.strictEqual(s.tap(cells, i, sorted[i]), 'correct');
  assert.strictEqual(s.tap(cells, sorted.length - 1, sorted[sorted.length - 1]), 'levelDone');
});
t('winner: fastest finisher; unfinished lose; tie = null', () => {
  assert.strictEqual(s.pickWinner([{uid:'a',finished:true,totalMs:9000},{uid:'b',finished:true,totalMs:8000},{uid:'c',finished:false,totalMs:1}]), 'b');
  assert.strictEqual(s.pickWinner([{uid:'a',finished:false,totalMs:1}]), null);
  assert.strictEqual(s.pickWinner([{uid:'a',finished:true,totalMs:5},{uid:'b',finished:true,totalMs:5}]), null);
});
console.log(n + ' tests passed');
