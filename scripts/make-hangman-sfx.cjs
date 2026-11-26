// Renders the Hangman sound effects to assets/sounds/hangman/. Run: node scripts/make-hangman-sfx.cjs
// Replace any file with your own recording under the same name; src/audio/sounds.ts does not change.
// Theme: a Wild West frontier town at dusk: wooden keys, revolvers, a gallows, a rope. Meant to be tense and dark.
const { SR, buf, biquad, add, burst, tone, hold, drive, save } = require('./lib/synth.cjs');
const D = 'hangman';

const normalise = (x) => {
  let p = 0;
  for (const v of x) p = Math.max(p, Math.abs(v));
  if (p > 0) for (let i = 0; i < x.length; i++) x[i] /= p;
  return x;
};

// A strained human-like grunt: a rough saw "voice" (jittery pitch, a shaky vibrato) squeezed through two narrow formant
// filters so it sounds like a throat that cannot open, plus some breath. f0 -> f1 is the pitch, vol the loudness.
function voice(out, at, sec, f0, f1, vol) {
  const n = Math.floor(SR * sec), x = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const f = (f0 + (f1 - f0) * t) * (1 + 0.04 * Math.sin(2 * Math.PI * 7.5 * (i / SR)) + 0.02 * (Math.random() - 0.5));
    phase += (2 * Math.PI * f) / SR;
    const p = phase % (2 * Math.PI);
    const env = Math.min(1, t / 0.12) * Math.min(1, (1 - t) / 0.35);
    x[i] = (p / Math.PI - 1 + 0.25 * (Math.random() * 2 - 1)) * env;
  }
  const a = biquad(x, 'bandpass', 650), b = biquad(x, 'bandpass', 1150);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = a[i] + 0.7 * b[i];
  add(out, at, normalise(y), vol);
}

// A creaking rope or board: a saw chopped into rapid, uneven pulses (the "stick-slip" of a rope under strain) and filtered.
function creak(out, at, sec, f0, f1, vol, rate = 38) {
  const n = Math.floor(SR * sec), x = new Float32Array(n);
  let phase = 0, pulse = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n, f = f0 + (f1 - f0) * t;
    phase += (2 * Math.PI * f) / SR;
    pulse += (rate * (1 + 0.5 * (Math.random() - 0.5)) + 14 * Math.sin(2 * Math.PI * 3 * t)) / SR;
    const gate = Math.max(0, 1 - 6 * (pulse % 1)); // a sharp slip, then a gap
    const env = Math.min(1, t / 0.05) * Math.min(1, (1 - t) / 0.25);
    x[i] = ((phase % (2 * Math.PI)) / Math.PI - 1) * gate * env;
  }
  const y = new Float32Array(n), a = biquad(x, 'bandpass', 1300), b = biquad(x, 'bandpass', 2600);
  for (let i = 0; i < n; i++) y[i] = a[i] + 0.5 * b[i];
  add(out, at, normalise(y), vol);
}

// Grit: dry, tiny crunches and the odd deeper pop, like gravel or something grinding in the throat. `density` = per second.
function grit(out, at, sec, density, vol) {
  const count = Math.floor(sec * density);
  for (let i = 0; i < count; i++) {
    const t = at + Math.pow(Math.random(), 1.4) * sec; // more of them at the start
    burst(out, t, 0.008 + Math.random() * 0.012, 'highpass', 2000 + Math.random() * 4000, vol * (0.3 + Math.random() * 0.7), 4);
    if (Math.random() < 0.18) burst(out, t, 0.03, 'bandpass', 700 + Math.random() * 500, vol * 0.8, 5);
  }
}

// tap: a key on the plank wall (a short wooden knock)
let o = buf(0.12);
burst(o, 0, 0.03, 'bandpass', 1600, 0.8, 5);
tone(o, 0, 0.06, 'triangle', 520, 300, 0.35);
save(D, 'hangman-tap.wav', o);

// correct: the letter is in the name (a revolver cylinder click-click and a lonesome guitar twang)
o = buf(1.0);
for (const t of [0, 0.075]) {
  burst(o, t, 0.012, 'highpass', 3500, 0.7, 4);
  tone(o, t, 0.03, 'square', 2300, 1700, 0.12);
}
tone(o, 0.16, 0.8, 'triangle', 329.6, 326, 0.5);
tone(o, 0.16, 0.6, 'sine', 659, 652, 0.2);
tone(o, 0.16, 0.4, 'sine', 989, 980, 0.1);
burst(o, 0.16, 0.02, 'highpass', 3000, 0.4, 4);
save(D, 'hangman-correct.wav', o);

// wrong: a bullet is spent (a gunshot, a ricochet whining off and a rolling echo)
o = buf(1.4);
burst(o, 0, 0.03, 'highpass', 2500, 1.2, 3);
burst(o, 0, 0.4, 'lowpass', 1800, 1.0, 5);
tone(o, 0, 0.25, 'sine', 150, 38, 1.2);
tone(o, 0.12, 0.35, 'sine', 3200, 900, 0.18);
tone(o, 0.12, 0.5, 'sine', 1900, 1500, 0.07);
burst(o, 0.22, 0.8, 'lowpass', 600, 0.3, 3);
drive(o, 2.0);
save(D, 'hangman-wrong.wav', o);

// clue: a star badge and a ghostly whistle on the wind (two slightly detuned notes that beat against each other)
o = buf(1.5);
tone(o, 0, 0.7, 'sine', 2093, 2085, 0.35);
tone(o, 0, 0.5, 'sine', 3136, 3120, 0.12);
hold(o, 0.15, 1.2, 'sine', 659, 700, 0.18, 0.2);
hold(o, 0.15, 1.2, 'sine', 665, 706, 0.18, 0.2);
burst(o, 0.1, 1.0, 'bandpass', 1100, 0.12, 1.5);
save(D, 'hangman-clue.wav', o);

// solved: the name is revealed (a church bell tolling, a rising twang run, a long dusty breath of relief)
o = buf(2.6);
tone(o, 0, 2.5, 'sine', 196, 194, 0.6);
tone(o, 0, 2.0, 'sine', 196 * 2.76, 196 * 2.76, 0.25);
tone(o, 0, 1.4, 'sine', 196 * 5.4, 196 * 5.4, 0.12);
[[0.25, 329.6], [0.4, 392], [0.55, 494], [0.7, 659]].forEach(([t, f]) => {
  tone(o, t, 0.9, 'triangle', f, f * 0.995, 0.35);
  tone(o, t, 0.5, 'sine', f * 2, f * 2, 0.1);
});
burst(o, 0.8, 1.6, 'bandpass', 900, 0.1, 1.5);
drive(o, 1.4);
save(D, 'hangman-solved.wav', o);

// trapdoor: the lever is thrown and the floor drops (lever clack, boards slam open, a fall, the rope snaps taut)
o = buf(1.8);
burst(o, 0, 0.05, 'bandpass', 1200, 0.9, 4);
tone(o, 0, 0.15, 'sine', 110, 50, 0.8);
burst(o, 0.1, 0.5, 'lowpass', 700, 1.6, 3);           // the boards slam open
tone(o, 0.1, 0.7, 'sine', 85, 26, 2.0);
burst(o, 0.1, 0.15, 'bandpass', 400, 1.2, 4);
burst(o, 0.12, 0.4, 'lowpass', 1400, 0.3, 2);         // the whoosh of the fall
for (const [t, v] of [[0.62, 0.7], [0.8, 0.5], [0.95, 0.35], [1.08, 0.2]]) burst(o, t, 0.06, 'bandpass', 500, v, 4); // the boards rattle on their hinges
burst(o, 0.45, 0.04, 'highpass', 2500, 1.0, 3);       // the rope snaps taut
creak(o, 0.45, 0.8, 320, 200, 0.7, 30);
tone(o, 0.45, 0.6, 'sine', 55, 28, 1.6);
tone(o, 0.45, 0.4, 'saw', 140, 118, 0.2);
drive(o, 1.8);
save(D, 'hangman-trapdoor.wav', o);

// struggle: after the drop. A rope straining under a weight, a strangled throat, grit and crunching in the neck,
// boots kicking at the boards, all of it weakening, until only the slow creak of the rope swinging is left.
o = buf(4.4);
hold(o, 0.2, 3.8, 'saw', 48, 38, 0.1, 0.6);                              // a low, dark drone underneath
creak(o, 0.0, 0.7, 260, 340, 0.55);                                       // the rope straining
creak(o, 0.8, 0.6, 240, 300, 0.45);
creak(o, 1.5, 0.5, 250, 310, 0.35);
creak(o, 2.1, 0.4, 230, 280, 0.25);
[[0.15, 0.45, 95, 150, 0.9], [0.75, 0.4, 90, 140, 0.8], [1.25, 0.35, 85, 130, 0.65], [1.7, 0.3, 80, 110, 0.5], [2.05, 0.25, 75, 95, 0.3]].forEach(([t, d, a, b, v]) => {
  voice(o, t, d, a, b, v);                                                // strangled, weakening gasps
  burst(o, t, d, 'bandpass', 1100, v * 0.12, 3);                          // ...with a rasp of breath
});
grit(o, 0.1, 2.3, 70, 0.5);                                               // grit grinding in the neck
for (const [t, v] of [[0.3, 0.9], [0.52, 0.8], [0.74, 0.75], [0.93, 0.7], [1.2, 0.6], [1.35, 0.5], [1.62, 0.4], [1.9, 0.3], [2.2, 0.2]]) {
  tone(o, t, 0.12, 'sine', 70, 35, v);                                    // boots kicking at the boards
  burst(o, t, 0.06, 'bandpass', 450, v * 0.8, 4);
}
creak(o, 2.9, 0.9, 120, 95, 0.25, 22);                                    // ...and then only the swinging rope
creak(o, 3.7, 0.5, 115, 90, 0.12, 22);
drive(o, 1.6);
save(D, 'hangman-struggle.wav', o);
