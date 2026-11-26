// Renders the Janken Negotiation sound effects to assets/sounds/janken/. Run: node scripts/make-janken-sfx.cjs
// Replace any file with your own recording under the same name; src/audio/sounds.ts does not change.
// Theme: the Supreme Court in session. A big stone hall: everything has a long echo.
const { SR, buf, biquad, add, burst, tone, drive, save } = require('./lib/synth.cjs');
const D = 'janken';

// The echo of a big stone hall: a few delayed, softer copies of the whole sound.
function hall(o, gain = 1) {
  const dry = Float32Array.from(o);
  for (const [d, g] of [[0.11, 0.38], [0.23, 0.24], [0.41, 0.14], [0.66, 0.07]]) {
    const off = Math.floor(d * SR);
    for (let i = 0; i + off < o.length; i++) o[i + off] += dry[i] * g * gain;
  }
}
// Noise that swells up (a reverse-cymbal "building" feeling).
function swell(o, at, sec, freq, vol) {
  const n = Math.floor(SR * sec), x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = Math.random() * 2 - 1;
  const y = biquad(x, 'bandpass', freq);
  let p = 0;
  for (const v of y) p = Math.max(p, Math.abs(v));
  for (let i = 0; i < n; i++) y[i] = (y[i] / p) * Math.pow(i / n, 2.2);
  add(o, at, y, vol);
}

// count: the 3-2-1 before a round and the last seconds of the final throw (a deep wooden "tock")
let o = buf(0.8);
burst(o, 0, 0.03, 'bandpass', 900, 0.8, 5);
tone(o, 0, 0.12, 'sine', 190, 90, 0.9);
tone(o, 0, 0.06, 'triangle', 520, 300, 0.3);
hall(o, 0.8);
save(D, 'janken-count.wav', o);

// gavel: the judge's hammer (a hard crack on the sound block, a woody knock and a boom that rolls around the hall)
o = buf(2.0);
burst(o, 0, 0.015, 'highpass', 3000, 0.9, 4);
burst(o, 0, 0.04, 'bandpass', 1600, 0.8, 5);
tone(o, 0, 0.09, 'triangle', 520, 300, 0.7);
tone(o, 0, 0.22, 'sine', 120, 55, 1.0);
tone(o, 0, 0.05, 'sine', 1900, 1400, 0.2);
hall(o);
drive(o, 1.3);
save(D, 'janken-gavel.wav', o);

// reveal: the final throws are shown (a quick sucking swell and a huge hit: the throws appear on screen right away,
// so the hit comes 0.2 s after the start)
o = buf(2.6);
swell(o, 0, 0.2, 1500, 0.5);
tone(o, 0.2, 0.9, 'sine', 70, 24, 1.6);
burst(o, 0.2, 0.5, 'lowpass', 1600, 1.0, 4);
burst(o, 0.2, 0.03, 'highpass', 3000, 0.7, 3);
tone(o, 0.2, 1.2, 'sine', 880, 870, 0.18);
tone(o, 0.2, 1.0, 'sine', 1397, 1390, 0.1);
hall(o);
drive(o, 1.5);
save(D, 'janken-reveal.wav', o);

// win: the round is yours (a rising brass fanfare and a bright bell)
o = buf(3.0);
[[0, 392], [0.15, 523], [0.3, 659]].forEach(([t, f]) => {
  tone(o, t, 0.4, 'saw', f, f, 0.22);
  tone(o, t, 0.4, 'triangle', f * 2, f * 2, 0.12);
});
for (const f of [392, 523, 659, 784]) {
  tone(o, 0.45, 1.5, 'saw', f, f * 0.998, 0.16);
  tone(o, 0.45, 1.5, 'triangle', f * 2, f * 2, 0.08);
}
tone(o, 0.45, 1.8, 'sine', 1568, 1560, 0.2);
tone(o, 0.45, 0.4, 'sine', 90, 45, 0.7);
hall(o);
drive(o, 1.4);
save(D, 'janken-win.wav', o);

// lose: the round is lost (a sinking minor phrase on low strings and a dull, final thud)
o = buf(3.0);
[[0, 196, 0.35], [0.35, 155.6, 0.35], [0.7, 130.8, 1.6]].forEach(([t, f, d]) => {
  tone(o, t, d, 'saw', f, f * 0.97, 0.26);
  tone(o, t, d, 'triangle', f / 2, f / 2 * 0.97, 0.3);
});
tone(o, 0.7, 0.8, 'sine', 65, 30, 1.2);
burst(o, 0.7, 0.2, 'lowpass', 400, 0.7, 4);
hall(o);
drive(o, 1.5);
save(D, 'janken-lose.wav', o);
