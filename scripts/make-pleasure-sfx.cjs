// Renders the Pleasure sound effects to assets/sounds/pleasure/. Run: node scripts/make-pleasure-sfx.cjs
// Replace any file with your own recording under the same name; src/audio/sounds.ts does not change.
// Theme: a Japanese TV variety-show quiz. The names match the on-screen captions (POP!, PIKON!, DORURURU..., DON!!,
// PIN-PON!, BUBU-!, JAJAAN!), so they work the same on the phone as on web.
const { buf, burst, tone, hold, drive, save } = require('./lib/synth.cjs');
const D = 'pleasure';

// pop: a comic bubble pop (a question appears)
let o = buf(0.3);
tone(o, 0, 0.1, 'sine', 300, 1300, 0.6);
burst(o, 0.07, 0.04, 'highpass', 3000, 0.4, 5);
tone(o, 0.07, 0.1, 'triangle', 1500, 900, 0.25);
save(D, 'pleasure-pop.wav', o);

// quiz: "PIKON!" (two quick, bright blips, the answer box opens)
o = buf(0.7);
tone(o, 0, 0.18, 'sine', 1568, 1560, 0.5);
tone(o, 0, 0.12, 'triangle', 3136, 3120, 0.12);
tone(o, 0.1, 0.5, 'sine', 2093, 2085, 0.5);
tone(o, 0.1, 0.3, 'triangle', 4186, 4170, 0.1);
save(D, 'pleasure-quiz.wav', o);

// drum: "DORURURU..." the drum roll of the roulette. 4.3 s, the exact time the roulette takes to land (DRAW_LANDS_MS),
// a snare roll that gets faster and louder with a tom pulse underneath and a cymbal swell, then a sharp rim shot.
o = buf(4.3);
for (let t = 0; t < 4.15; ) {
  const k = t / 4.15, vol = 0.12 + 0.75 * Math.pow(k, 1.4);
  burst(o, t, 0.035, 'bandpass', 2200, vol, 5);
  burst(o, t, 0.02, 'highpass', 5000, vol * 0.35, 5);
  t += 0.095 - 0.062 * k + Math.random() * 0.006; // faster and faster
}
for (let t = 0; t < 4.1; t += 0.5) tone(o, t, 0.35, 'sine', 120, 62, 0.15 + 0.6 * (t / 4.1)); // the toms
for (let t = 3.0; t < 4.1; t += 0.12) burst(o, t, 0.15, 'highpass', 6500, 0.05 + 0.25 * ((t - 3.0) / 1.1), 3); // cymbal swell
burst(o, 4.2, 0.03, 'bandpass', 1800, 0.9, 4);
tone(o, 4.2, 0.1, 'triangle', 900, 400, 0.4);
save(D, 'pleasure-drum.wav', o);

// fanfare: "DON!!" the roulette stops (a big brass hit with a timpani thump and a cymbal crash)
o = buf(2.2);
for (const f of [130.8, 261.6, 329.6, 392, 523]) {
  tone(o, 0, 1.4, 'saw', f, f * 0.998, 0.2);
  tone(o, 0, 1.2, 'triangle', f * 2, f * 2, 0.08);
}
tone(o, 0, 0.5, 'sine', 90, 40, 1.0);
burst(o, 0, 0.03, 'highpass', 3000, 0.7, 3);
burst(o, 0, 1.6, 'highpass', 5000, 0.5, 2.5);
drive(o, 1.5);
save(D, 'pleasure-fanfare.wav', o);

// pinpon: "PIN-PON!" the right answer (the classic two-bell ding-dong)
o = buf(1.5);
for (const [t, f] of [[0, 1319], [0.22, 1047]]) {
  tone(o, t, 1.1, 'sine', f, f * 0.998, 0.5);
  tone(o, t, 0.8, 'sine', f * 2.76, f * 2.76, 0.12);
  tone(o, t, 0.4, 'sine', f * 5.4, f * 5.4, 0.06);
  burst(o, t, 0.012, 'highpass', 4000, 0.3, 4);
}
save(D, 'pleasure-pinpon.wav', o);

// bubu: "BUBU-!" the wrong answer (three low, raspy buzzer honks, the last one long)
o = buf(1.3);
[[0, 0.2], [0.26, 0.2], [0.52, 0.6]].forEach(([t, d]) => {
  hold(o, t, d, 'saw', 118, 110, 0.4, 0.005);
  hold(o, t, d, 'square', 59, 55, 0.25, 0.005);
  hold(o, t, d, 'saw', 124, 114, 0.25, 0.005);
});
drive(o, 2.2);
save(D, 'pleasure-bubu.wav', o);

// win: "JAJAAN!" the winner (ja-ja-JAAAN: three rising brass notes, the last one a long chord, cymbals and sparkles)
o = buf(3.2);
[[0, 523, 0.17], [0.19, 659, 0.17]].forEach(([t, f, d]) => {
  tone(o, t, d + 0.15, 'saw', f, f, 0.24);
  tone(o, t, d + 0.15, 'triangle', f * 2, f * 2, 0.1);
});
for (const f of [392, 523, 659, 784, 1047]) {
  tone(o, 0.4, 2.2, 'saw', f, f * 0.998, 0.17);
  tone(o, 0.4, 2.0, 'triangle', f * 2, f * 2, 0.08);
}
tone(o, 0.4, 0.6, 'sine', 100, 45, 0.9);
burst(o, 0.4, 2.0, 'highpass', 5500, 0.4, 1.6);
[0.6, 0.72, 0.84, 0.97, 1.1, 1.25, 1.4].forEach((t, i) => tone(o, t, 0.5, 'sine', 2093 * (1 + i * 0.12), 2093 * (1 + i * 0.12), 0.1));
drive(o, 1.5);
save(D, 'pleasure-win.wav', o);
