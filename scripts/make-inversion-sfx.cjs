// Renders the Inversion sound effects to assets/sounds/inversion/. Run: node scripts/make-inversion-sfx.cjs
// Replace any file with your own recording under the same name; src/audio/sounds.ts does not change.
// Theme: the finals of an esports tournament. Clean, game-like UI sounds: deliberately NOT too noisy,
// because they play on every one of the 30 tasks.
const { buf, burst, tone, hold, save } = require('./lib/synth.cjs');
const D = 'inversion';

// press: a controller button (a crisp, soft click)
let o = buf(0.12);
burst(o, 0, 0.012, 'bandpass', 3000, 0.5, 5);
tone(o, 0, 0.05, 'square', 900, 600, 0.2);
tone(o, 0, 0.05, 'sine', 1800, 1200, 0.2);
save(D, 'inversion-press.wav', o);

// arrow: the arrows appear and drift across the monitor (a quiet, airy swish; kept very soft)
o = buf(0.3);
burst(o, 0, 0.25, 'bandpass', 1800, 0.18, 2.5);
tone(o, 0, 0.22, 'sine', 500, 900, 0.07);
save(D, 'inversion-arrow.wav', o);

// inversed: the INVERSED sign starts blinking (a two-tone warning chirp, twice; clear but not shrill)
o = buf(0.8);
for (const t of [0, 0.3]) {
  tone(o, t, 0.12, 'square', 880, 880, 0.26);
  tone(o, t + 0.12, 0.14, 'square', 660, 660, 0.26);
  tone(o, t, 0.26, 'sine', 1320, 1320, 0.16);
}
save(D, 'inversion-inversed.wav', o);

// correct: a short rising two-note blip
o = buf(0.35);
tone(o, 0, 0.12, 'sine', 880, 880, 0.4);
tone(o, 0.08, 0.25, 'sine', 1320, 1320, 0.4);
tone(o, 0.08, 0.15, 'triangle', 2640, 2640, 0.08);
save(D, 'inversion-correct.wav', o);

// wrong: a chance is lost (a low buzz with a dull hit)
o = buf(0.5);
hold(o, 0, 0.35, 'saw', 180, 140, 0.3, 0.005);
hold(o, 0, 0.35, 'square', 90, 70, 0.15, 0.005);
tone(o, 0, 0.15, 'sine', 100, 45, 0.7);
save(D, 'inversion-wrong.wav', o);

// warn: the time bar is running out (a single short, urgent pulse)
o = buf(0.3);
tone(o, 0, 0.1, 'square', 1046, 1046, 0.3);
tone(o, 0.13, 0.1, 'square', 1046, 1046, 0.3);
save(D, 'inversion-warn.wav', o);

// out: knocked out, no chances left (the power goes: a falling sweep, a glitchy stutter and a final KO thud)
o = buf(1.5);
hold(o, 0, 0.9, 'saw', 700, 60, 0.25, 0.01);
hold(o, 0, 0.9, 'square', 350, 40, 0.15, 0.01);
for (const t of [0.15, 0.22, 0.38, 0.45, 0.62]) burst(o, t, 0.03, 'highpass', 3000, 0.4, 4);
tone(o, 0.8, 0.6, 'sine', 80, 25, 1.2);
burst(o, 0.8, 0.2, 'lowpass', 500, 0.7, 4);
save(D, 'inversion-out.wav', o);
