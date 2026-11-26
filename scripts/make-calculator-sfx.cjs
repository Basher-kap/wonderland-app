// Renders the Human Calculator sound effects to assets/sounds/humanCalculator/.
// Run: node scripts/make-calculator-sfx.cjs
// Replace any file with your own recording under the same name; src/audio/sounds.ts does not change.
// Theme: a quiz-show stage with one big monitor: electronic blips, game-show dings and buzzers.
const { buf, burst, tone, save } = require('./lib/synth.cjs');
const D = 'humanCalculator';

// term: a number or arithmetic symbol flashes on the monitor (a short digital blip)
let o = buf(0.2);
tone(o, 0, 0.12, 'square', 880, 880, 0.16);
tone(o, 0, 0.12, 'sine', 1760, 1760, 0.18);
burst(o, 0, 0.015, 'highpass', 4000, 0.25, 4);
save(D, 'calculator-term.wav', o);

// count: the 3-2-1 "get ready" beep
o = buf(0.3);
tone(o, 0, 0.22, 'sine', 660, 650, 0.5);
tone(o, 0, 0.18, 'triangle', 1320, 1300, 0.12);
save(D, 'calculator-count.wav', o);

// tick: one second of the answer timer running down (a dry clock tick)
o = buf(0.12);
burst(o, 0, 0.02, 'bandpass', 3000, 0.8, 5);
tone(o, 0, 0.04, 'square', 1500, 1100, 0.18);
save(D, 'calculator-tick.wav', o);

// key: a keypad button
o = buf(0.1);
burst(o, 0, 0.025, 'bandpass', 2400, 0.6, 5);
tone(o, 0, 0.05, 'triangle', 600, 380, 0.3);
save(D, 'calculator-key.wav', o);

// send: the answer is locked in (a rising two-note confirm)
o = buf(0.4);
tone(o, 0, 0.12, 'sine', 700, 700, 0.35);
tone(o, 0.09, 0.25, 'sine', 1050, 1050, 0.4);
burst(o, 0, 0.02, 'highpass', 3000, 0.3, 4);
save(D, 'calculator-send.wav', o);

// correct: the quiz-show "ding-dong" (two bright bells)
o = buf(1.1);
tone(o, 0, 0.8, 'sine', 1319, 1310, 0.5);
tone(o, 0, 0.5, 'sine', 2637, 2620, 0.12);
tone(o, 0.18, 0.9, 'sine', 1047, 1040, 0.5);
tone(o, 0.18, 0.5, 'sine', 2093, 2080, 0.12);
save(D, 'calculator-correct.wav', o);

// wrong: the quiz-show buzzer (a harsh low raspy buzz)
o = buf(0.8);
tone(o, 0, 0.6, 'saw', 150, 140, 0.5);
tone(o, 0, 0.6, 'square', 100, 95, 0.3);
tone(o, 0, 0.6, 'saw', 158, 148, 0.3);
burst(o, 0, 0.05, 'lowpass', 900, 0.4, 4);
save(D, 'calculator-wrong.wav', o);

// timeUp: the time limit is over (three falling alarm beeps)
o = buf(1.0);
[[0, 988], [0.25, 784], [0.5, 622]].forEach(([t, f]) => {
  tone(o, t, 0.2, 'square', f, f, 0.2);
  tone(o, t, 0.2, 'sine', f * 2, f * 2, 0.15);
});
tone(o, 0.5, 0.5, 'sine', 130, 90, 0.4);
save(D, 'calculator-timeup.wav', o);
