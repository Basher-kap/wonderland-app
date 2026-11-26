// Renders the Fortune sound effects to assets/sounds/fortune/. Run: node scripts/make-fortune-sfx.cjs
// Replace any file with your own recording under the same name; src/audio/sounds.ts does not change.
//
// IMPORTANT: fortune-turn-voice.wav made here is only a PLACEHOLDER (two gong strikes). It is meant to be
// replaced with a recording of the announcer saying "Ikkaime, Sutaato" (see the note in KarutaGame/FortuneGame).
// Running this script again would overwrite your recording, so it skips that file if it already exists
// and you pass --keep-voice (node scripts/make-fortune-sfx.cjs --keep-voice).
const fs = require('node:fs');
const path = require('node:path');
const { buf, burst, tone, save } = require('./lib/synth.cjs');
const D = 'fortune';

// temple-choose: wooden ticks at the speed of the highlight (every 130 ms for 2.7 s), then the temple bell
// as it lands on the chosen player (matches CHOOSING_MS = 3500 and the 800 ms stop in FortuneGame)
let o = buf(3.5);
for (let i = 0, t = 0; t < 2.7; i++, t = i * 0.13) {
  const f = i % 2 ? 1500 : 1250;
  burst(o, t, 0.02, 'bandpass', f, 0.35, 4);
  tone(o, t, 0.05, 'sine', f * 0.6, f * 0.4, 0.2);
}
burst(o, 2.7, 0.05, 'lowpass', 900, 0.6, 4);
tone(o, 2.7, 0.8, 'sine', 220, 218, 0.6);
tone(o, 2.7, 0.8, 'sine', 587, 585, 0.3);
tone(o, 2.7, 0.7, 'sine', 1100, 1090, 0.15);
save(D, 'fortune-temple-choose.wav', o);

// turn voice: PLACEHOLDER for "Ikkaime, Sutaato" (two descending gong strikes)
if (!(process.argv.includes('--keep-voice') && fs.existsSync(path.join(__dirname, '..', 'assets', 'sounds', D, 'fortune-turn-voice.wav')))) {
  o = buf(2.2);
  tone(o, 0, 0.9, 'sine', 659, 655, 0.5);
  tone(o, 0, 0.9, 'sine', 1318, 1310, 0.15);
  tone(o, 0.55, 1.4, 'sine', 523, 520, 0.5);
  tone(o, 0.55, 1.4, 'sine', 1046, 1040, 0.15);
  tone(o, 0, 0.3, 'sine', 90, 50, 0.4);
  save(D, 'fortune-turn-voice.wav', o);
}

// correct: three rising bells and a sparkle
o = buf(1.3);
[[0, 1047], [0.11, 1319], [0.22, 1568]].forEach(([t, f]) => {
  tone(o, t, 0.7, 'sine', f, f * 0.998, 0.4);
  tone(o, t, 0.5, 'sine', f * 2, f * 2, 0.1);
});
burst(o, 0.2, 0.5, 'highpass', 6000, 0.15, 4);
save(D, 'fortune-correct.wav', o);

// wrong: a low two-note buzzer ("bu-buu") and a thud
o = buf(1.1);
tone(o, 0, 0.25, 'saw', 220, 200, 0.22);
tone(o, 0.28, 0.5, 'saw', 160, 110, 0.25);
tone(o, 0, 0.2, 'sine', 100, 50, 0.5);
burst(o, 0, 0.3, 'lowpass', 500, 0.3, 4);
save(D, 'fortune-wrong.wav', o);
