const assert = require('assert');
const h = require(require('path').resolve(process.argv[2]));
const words = require(require('path').resolve(process.argv[3])).HANGMAN_WORDS;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const play = (word, letters) => letters.split('').reduce((s, l) => h.guess(s, l), h.newState(word));

t('same seed gives the same word, different seeds vary', () => {
  assert.deepStrictEqual(h.pickEntry('m:1'), h.pickEntry('m:1'));
  const seen = new Set(Array.from({ length: 60 }, (_, i) => h.pickEntry('s' + i).text));
  assert.ok(seen.size > 15);
});
t('word list: letters and spaces only, no duplicates, has every category', () => {
  const seen = new Set();
  for (const w of words) {
    assert.ok(/^[A-Za-z]+( [A-Za-z]+)*$/.test(w.text), w.text);
    assert.ok(!seen.has(w.text.toUpperCase()), 'duplicate ' + w.text);
    seen.add(w.text.toUpperCase());
  }
  assert.strictEqual(new Set(words.map((w) => w.category)).size, 5);
});
t('correct letters are revealed in every position, spaces are free', () => {
  const s = play('Toyota Auto', 'TO');
  assert.deepStrictEqual(h.display(s), ['T', 'O', null, 'O', 'T', null, ' ', null, null, 'T', 'O']);
  assert.strictEqual(h.wrongCount(s), 0);
});
t('wrong letters count once; repeated picks change nothing', () => {
  let s = play('Nike', 'ZZQ');
  assert.strictEqual(h.wrongCount(s), 2);
  assert.strictEqual(h.guess(s, 'Z'), s);
  assert.strictEqual(h.guess(s, '1'), s);
  assert.deepStrictEqual(h.wrongLetters(s), ['Z', 'Q']);
});
t('lowercase picks work', () => {
  assert.strictEqual(h.wrongCount(play('Nike', 'nz')), 1);
  assert.ok(h.isSolved(play('Nike', 'nike')));
});
t('solved when all letters are revealed', () => {
  const s = play('Los Angeles Lakers', 'LOSANGELKR');
  assert.ok(h.isSolved(s) && !h.isHanged(s) && h.isOver(s));
});
t('hanged on the 6th wrong letter, no more input after', () => {
  const s = play('Nike', 'ZQXWVU');
  assert.strictEqual(h.wrongCount(s), h.MAX_WRONG);
  assert.ok(h.isHanged(s) && h.isOver(s));
  assert.strictEqual(h.guess(s, 'N'), s);
});
t('5 wrong is still alive; solving on the 6th pick of a right letter after 5 wrong wins', () => {
  const s = play('Nike', 'ZQXWVNIKE');
  assert.strictEqual(h.wrongCount(s), 5);
  assert.ok(h.isSolved(s) && !h.isHanged(s));
});
t('a solved word cannot be hanged afterwards', () => {
  const s = h.guess(play('Nike', 'NIKE'), 'Z');
  assert.strictEqual(h.wrongCount(s), 0);
});
t('pickWinner: fastest solver; hanged players lose; nobody solved = draw; exact tie = draw', () => {
  assert.strictEqual(h.pickWinner([{ uid: 'a', finished: true, totalMs: 9000 }, { uid: 'b', finished: true, totalMs: 7000 }, { uid: 'c', finished: false, totalMs: 1000 }]), 'b');
  assert.strictEqual(h.pickWinner([{ uid: 'a', finished: false, totalMs: 1 }, { uid: 'b', finished: false, totalMs: 2 }]), null);
  assert.strictEqual(h.pickWinner([{ uid: 'a', finished: true, totalMs: 5000 }, { uid: 'b', finished: true, totalMs: 5000 }]), null);
  assert.strictEqual(h.pickWinner([{ uid: 'a', finished: false, totalMs: 1 }, { uid: 'b', finished: true, totalMs: 99999 }]), 'b');
});
console.log(n + ' tests passed');
