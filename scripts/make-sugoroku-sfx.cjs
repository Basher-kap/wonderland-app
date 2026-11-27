// Renders the Future Sugoroku sound effects to assets/sounds/futureSugoroku/.
// Run: node scripts/make-sugoroku-sfx.cjs
// Replace any file with your own recording under the same name; src/audio/sounds.ts does not change.
// Theme: a labyrinth outside of time. While you choose a room, a slow nostalgic loop of time rewinding plays.
const { SR, buf, biquad, add, burst, tone, hold, drive, save } = require('./lib/synth.cjs');
const D = 'futureSugoroku';

const normaliseTo = (o, target) => {
  let p = 0;
  for (const v of o) p = Math.max(p, Math.abs(v));
  if (p > 0) for (let i = 0; i < o.length; i++) o[i] *= target / p;
};

// rewind: the background loop for choosing a room. 16 seconds that repeat without a seam: four chords (Am, F, C, G)
// of 4 s each, a warm slow pad, a sparse music box, notes played BACKWARDS (they swell up into the beat, like a tape
// running in reverse), two tape-rewind whirrs, a soft ticking clock and old record crackle. Everything starts and
// ends at silence, so the end joins the start with no click.
const LEN = 16;
let o = buf(LEN);
const chords = [
  [110, 164.8, 220, 261.6], // Am
  [87.3, 130.8, 174.6, 220], // F
  [130.8, 196, 261.6, 329.6], // C
  [98, 146.8, 196, 246.9], // G
];
chords.forEach((ch, c) => {
  const start = c * 4, sec = c === 3 ? 4 : 4.7;
  for (const f of ch) {
    hold(o, start, sec, 'triangle', f, f, 0.07, 1.0);
    hold(o, start, sec, 'sine', f * 2.003, f * 2.003, 0.025, 1.2); // a slightly detuned copy: the pad "breathes"
  }
});
// The music box: a gentle arpeggio, with rests.
const pluck = (t, f, vol) => {
  const d = Math.min(1.0, LEN - 0.03 - t);
  if (d < 0.15) return;
  tone(o, t, d, 'sine', f, f, vol);
  tone(o, t, Math.min(0.25, d), 'sine', f * 4.01, f * 4.01, vol * 0.25);
};
chords.forEach((ch, c) => {
  [[0, 1], [1, 2], [2.5, 3], [3, 2], [3.5, 1]].forEach(([beat, idx]) => pluck(c * 4 + beat, ch[idx] * 4, 0.2));
});
// Notes played backwards: a pluck is rendered, flipped in time, and placed so that it ends exactly on a bar line.
[4, 8, 12].forEach((bar, i) => {
  const f = chords[i][3] * 4, d = 1.1, tmp = buf(d);
  tone(tmp, 0, d, 'sine', f, f, 0.5);
  tone(tmp, 0, d * 0.6, 'sine', f * 4.01, f * 4.01, 0.12);
  tmp.reverse();
  add(o, bar - d, tmp, 1);
});
// Two "tape rewinding" whirrs (a high whine that falls away).
for (const t of [6.4, 14.2]) {
  hold(o, t, 1.4, 'saw', 2200, 220, 0.025, 0.25);
  burst(o, t, 1.3, 'bandpass', 2500, 0.03, 1.2);
}
// A clock, ticking and tocking every second.
for (let s = 0; s < LEN; s++) {
  burst(o, s + 0.02, 0.012, 'bandpass', s % 2 ? 2300 : 3100, 0.12, 5);
  tone(o, s + 0.02, 0.03, 'sine', s % 2 ? 700 : 950, s % 2 ? 560 : 780, 0.05);
}
// Old record crackle.
for (let i = 0; i < 90; i++) burst(o, 0.1 + Math.random() * (LEN - 0.3), 0.006, 'highpass', 3000 + Math.random() * 4000, 0.03 + Math.random() * 0.05, 4);
normaliseTo(o, 0.7);
save(D, 'sugoroku-rewind.wav', o);

// blink: a room that is not dangerous (a plain, calm "blink": a soft rising blip and a tiny sparkle)
o = buf(0.4);
tone(o, 0, 0.14, 'sine', 600, 1200, 0.4);
tone(o, 0.06, 0.25, 'sine', 1760, 1750, 0.25);
tone(o, 0.06, 0.15, 'triangle', 3520, 3500, 0.07);
burst(o, 0.06, 0.03, 'highpass', 5000, 0.15, 5);
save(D, 'sugoroku-blink.wav', o);

// danger: you entered a BAD room. A hit, a siren sweeping up and down, a wail (a crying voice, falling and shaking)
// and an angry growl under it all, clipped hard so it is loud and ugly.
function wail(out, at, sec, f0, f1, vol) {
  const n = Math.floor(SR * sec), x = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const f = (f0 + (f1 - f0) * t) * (1 + 0.06 * Math.sin(2 * Math.PI * 6.5 * (i / SR)));
    phase += (2 * Math.PI * f) / SR;
    x[i] = ((phase % (2 * Math.PI)) / Math.PI - 1) * Math.min(1, t / 0.08) * Math.min(1, (1 - t) / 0.3);
  }
  const a = biquad(x, 'bandpass', 800), b = biquad(x, 'bandpass', 1500), y = new Float32Array(n);
  let p = 0;
  for (let i = 0; i < n; i++) { y[i] = a[i] + 0.6 * b[i]; p = Math.max(p, Math.abs(y[i])); }
  for (let i = 0; i < n; i++) y[i] /= p;
  add(out, at, y, vol);
}
o = buf(3.0);
burst(o, 0, 0.05, 'highpass', 2500, 0.9, 3);
tone(o, 0, 0.5, 'sine', 100, 28, 1.2);
// the siren: 3 up-and-down sweeps
for (let i = 0; i < 3; i++) {
  hold(o, i * 0.8, 0.4, 'square', 520, 940, 0.22, 0.02);
  hold(o, i * 0.8 + 0.4, 0.4, 'square', 940, 520, 0.22, 0.02);
}
wail(o, 0.2, 1.6, 420, 230, 0.5);    // the wail
wail(o, 1.3, 1.5, 380, 170, 0.45);   // and another, lower and longer
// the angry growl: a low saw chopped by a fast, rough pulse
{
  const n = Math.floor(SR * 2.6), g = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    ph += (2 * Math.PI * (75 - 20 * t)) / SR;
    const chop = 0.55 + 0.45 * Math.sign(Math.sin(2 * Math.PI * 28 * (i / SR)));
    g[i] = ((ph % (2 * Math.PI)) / Math.PI - 1) * chop * Math.min(1, t / 0.05) * Math.min(1, (1 - t) / 0.25);
  }
  add(o, 0.1, g, 0.5);
}
burst(o, 0.1, 2.5, 'bandpass', 900, 0.1, 1.2);
drive(o, 2.6);
save(D, 'sugoroku-danger.wav', o);

// exit: you found the way out (a bright, rising fanfare, warm and relieved)
o = buf(2.4);
[[0, 523], [0.12, 659], [0.24, 784], [0.36, 1047]].forEach(([t, f]) => {
  tone(o, t, 0.9, 'triangle', f, f * 0.998, 0.35);
  tone(o, t, 0.5, 'sine', f * 2, f * 2, 0.1);
});
for (const f of [523, 659, 784, 1047]) hold(o, 0.5, 1.8, 'triangle', f, f * 0.998, 0.12, 0.1);
tone(o, 0.5, 1.4, 'sine', 2093, 2085, 0.15);
tone(o, 0.5, 0.6, 'sine', 100, 50, 0.6);
drive(o, 1.3);
save(D, 'sugoroku-exit.wav', o);
