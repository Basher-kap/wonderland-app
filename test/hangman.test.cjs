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
t('word list: only letters, digits, apostrophes and spaces, at least one letter, has every category', () => {
  for (const w of words) assert.ok(/^[A-Za-z0-9' ]+$/.test(w.text) && /[A-Za-z]/.test(w.text), w.text);
  assert.ok(new Set(words.map((w) => w.category)).size >= 14);
});
t('pool has no duplicate words, and every pick comes from it', () => {
  const keys = h.WORD_POOL.map((w) => w.text.toUpperCase());
  assert.strictEqual(new Set(keys).size, keys.length);
  assert.ok(h.WORD_POOL.length > 400);
  for (let i = 0; i < 200; i++) assert.ok(h.WORD_POOL.includes(h.pickEntry('p' + i)));
});
t('digits and apostrophes are shown for free and are never needed as a guess', () => {
  let s = h.newState("Grey's K2");
  assert.deepStrictEqual(h.display(s).filter((c) => c !== null && c !== ' ').join(''), "'2");
  s = play("Grey's K2", 'GREYSK');
  assert.ok(h.isSolved(s));
});
t('clues: letter is in the word, hidden for the asker, deterministic', () => {
  const s = h.newState('Los Angeles Lakers');
  for (let n = 0; n < 20; n++) {
    const l = h.pickClueLetter(s, 'seed' + n, n);
    assert.ok(l && s.word.includes(l));
    assert.strictEqual(l, h.pickClueLetter(s, 'seed' + n, n));
  }
  const p = play('Los Angeles Lakers', 'LOSANG');
  const l = h.pickClueLetter(p, 'x', 0);
  assert.ok(!p.guessed.includes(l));
});
t('a clue is refused when it would solve the word for the asker', () => {
  assert.strictEqual(h.pickClueLetter(h.newState('K2'), 's', 0), null); // 1 letter
  assert.ok(h.pickClueLetter(play('Nike', 'NI'), 's', 0)); // K and E hidden: allowed
  assert.strictEqual(h.pickClueLetter(play('Nike', 'NIK'), 's', 0), null); // only E hidden
});
t('clue limits: half of the different letters, 2 per player', () => {
  assert.strictEqual(h.maxCluesTotal('Nike'), 2);
  assert.strictEqual(h.maxCluesTotal('K2'), 0);
  assert.strictEqual(h.MAX_CLUES_PER_PLAYER, 2);
});
t('clue letters count as revealed and never as wrong', () => {
  const s = h.withClues(play('Nike', 'Z'), ['N', 'K']);
  assert.strictEqual(h.wrongCount(s), 1);
  assert.deepStrictEqual(h.display(s), ['N', null, 'K', null]);
  assert.ok(h.isSolved(h.withClues(s, ['I', 'E'])));
  assert.strictEqual(h.withClues(s, ['N']), s);
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
