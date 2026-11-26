// Renders the Wordle sound effects to assets/sounds/wordle/. Run: node scripts/make-wordle-sfx.cjs
// Replace any file with your own recording under the same name; src/audio/sounds.ts does not change.
// Theme: a reading room after hours: wooden keys, paper, a brass bell.
const { buf, burst, tone, save } = require('./lib/synth.cjs');
const D = 'wordle';

// key: a typed letter (short wooden tap, ~60 ms)
let o = buf(0.1);
burst(o, 0, 0.03, 'bandpass', 1800, 0.7, 5);
tone(o, 0, 0.05, 'triangle', 420, 260, 0.35);
save(D, 'wordle-key.wav', o);

// erase: the delete key (a softer, lower tap)
o = buf(0.1);
burst(o, 0, 0.03, 'bandpass', 1100, 0.6, 5);
tone(o, 0, 0.06, 'triangle', 300, 170, 0.35);
save(D, 'wordle-erase.wav', o);

// A tile turning over like a page (a soft paper flick) + a result note. Kept under 0.2 s: the five tiles
// of a guess turn 140 ms apart, and each sound restarts the previous one.
const flick = (out) => burst(out, 0, 0.07, 'highpass', 3500, 0.3, 6);

// tileGreen: correct letter, a bright little bell
o = buf(0.3);
flick(o);
tone(o, 0.02, 0.26, 'sine', 1319, 1300, 0.45);
tone(o, 0.02, 0.2, 'sine', 2637, 2600, 0.12);
save(D, 'wordle-tile-green.wav', o);

// tileYellow: letter is in the word but in the wrong spot, a softer, lower note
o = buf(0.3);
flick(o);
tone(o, 0.02, 0.22, 'triangle', 784, 770, 0.4);
tone(o, 0.02, 0.16, 'sine', 1568, 1550, 0.08);
save(D, 'wordle-tile-yellow.wav', o);

// tileGray: not in the word, a dull page-slap thud
o = buf(0.25);
flick(o);
burst(o, 0.01, 0.1, 'lowpass', 500, 0.6, 6);
tone(o, 0.01, 0.12, 'sine', 180, 110, 0.4);
save(D, 'wordle-tile-gray.wav', o);

// invalid: "not a valid word" / "not enough letters", two low knocks and a short buzz
o = buf(0.5);
for (const t of [0, 0.13]) {
  burst(o, t, 0.06, 'lowpass', 700, 0.7, 5);
  tone(o, t, 0.1, 'sine', 160, 100, 0.6);
}
tone(o, 0.05, 0.3, 'saw', 150, 120, 0.12);
save(D, 'wordle-invalid.wav', o);

// solved: the word is found (rising bell arpeggio and a held, shimmering chord)
o = buf(1.5);
[[0, 523], [0.1, 659], [0.2, 784], [0.3, 1047]].forEach(([t, f]) => {
  tone(o, t, 0.55, 'sine', f, f * 0.995, 0.4);
  tone(o, t, 0.35, 'sine', f * 2, f * 2, 0.08);
});
for (const f of [523, 659, 784, 1047]) tone(o, 0.42, 1.0, 'triangle', f, f * 0.99, 0.16);
burst(o, 0.42, 0.6, 'highpass', 6000, 0.05, 4);
save(D, 'wordle-solved.wav', o);

// failed: out of attempts (a tired, sinking sigh and a low bell)
o = buf(1.4);
burst(o, 0, 0.9, 'bandpass', 700, 0.18, 2.5);
tone(o, 0, 0.9, 'triangle', 440, 220, 0.3);
tone(o, 0.18, 1.0, 'triangle', 330, 165, 0.25);
tone(o, 0.4, 0.9, 'sine', 110, 80, 0.35);
save(D, 'wordle-failed.wav', o);
