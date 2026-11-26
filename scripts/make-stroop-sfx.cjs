// Renders the Stroop Effect sound effects to assets/sounds/stroop/. Run: node scripts/make-stroop-sfx.cjs
// Replace any file with your own recording under the same name; src/audio/sounds.ts does not change.
// Theme: a kid's birthday party that has gone wrong: warped music-box notes, a distorted horn, a candle in a draught.
const { buf, burst, tone, hold, drive, save } = require('./lib/synth.cjs');
const D = 'stroop';

// start: "get ready" (2 s): a warped music box creeping up over a low drone, ending on a hit
let o = buf(2.2);
[[0, 523], [0.35, 622], [0.7, 740], [1.05, 523], [1.4, 740]].forEach(([t, f]) => {
  tone(o, t, 0.5, 'sine', f, f * 0.97, 0.3);
  tone(o, t, 0.3, 'sine', f * 3, f * 3, 0.08);
});
hold(o, 0, 1.9, 'saw', 55, 62, 0.14, 0.4);
tone(o, 1.8, 0.35, 'sine', 70, 32, 1.0);
burst(o, 1.8, 0.04, 'highpass', 3000, 0.6, 3);
drive(o, 1.6);
save(D, 'stroop-start.wav', o);

// correct: a sharp bright stab (kept short: the next word comes in 0.7 s)
o = buf(0.7);
tone(o, 0, 0.35, 'sine', 988, 980, 0.45);
tone(o, 0.07, 0.5, 'sine', 1319, 1310, 0.45);
tone(o, 0, 0.12, 'sine', 90, 45, 0.7);
burst(o, 0, 0.03, 'highpass', 4000, 0.5, 4);
drive(o, 1.5);
save(D, 'stroop-correct.wav', o);

// wrong: a distorted party horn blasting a falling, clashing note (a tritone)
o = buf(0.7);
hold(o, 0, 0.55, 'saw', 220, 150, 0.35, 0.01);
hold(o, 0, 0.55, 'saw', 311, 215, 0.3, 0.01);
hold(o, 0, 0.55, 'square', 110, 75, 0.2, 0.01);
tone(o, 0, 0.2, 'sine', 80, 35, 1.0);
drive(o, 3.0);
save(D, 'stroop-wrong.wav', o);

// timeUp: the candle is blown out (a gust, then a low thud and a falling, hollow tone)
o = buf(1.0);
burst(o, 0, 0.35, 'bandpass', 1800, 0.7, 2);
burst(o, 0.05, 0.3, 'highpass', 4000, 0.3, 3);
tone(o, 0.3, 0.6, 'sine', 90, 30, 1.2);
hold(o, 0.3, 0.6, 'triangle', 233, 110, 0.2, 0.01);
hold(o, 0.3, 0.6, 'triangle', 329, 156, 0.18, 0.01);
drive(o, 2.0);
save(D, 'stroop-timeup.wav', o);

// warn: the candle is nearly out (a fast, panicked double heartbeat)
o = buf(0.4);
tone(o, 0, 0.1, 'sine', 70, 38, 1.0);
tone(o, 0.12, 0.12, 'sine', 62, 34, 0.9);
burst(o, 0, 0.03, 'lowpass', 300, 0.5, 5);
drive(o, 1.8);
save(D, 'stroop-warn.wav', o);

// done: the party is over (a long, distorted horn on a clashing chord, a crash, and a drone that sinks)
o = buf(2.8);
hold(o, 0, 1.6, 'saw', 196, 185, 0.3, 0.02);
hold(o, 0, 1.6, 'saw', 277, 262, 0.26, 0.02);
hold(o, 0, 1.6, 'square', 98, 92, 0.2, 0.02);
burst(o, 0, 0.9, 'highpass', 4500, 0.4, 2);
tone(o, 0, 1.2, 'sine', 70, 28, 1.2);
hold(o, 1.2, 1.6, 'saw', 90, 45, 0.22, 0.05);
drive(o, 2.8);
save(D, 'stroop-done.wav', o);
