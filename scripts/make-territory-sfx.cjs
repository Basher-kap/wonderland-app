// Renders the Color Territory sound effects to assets/sounds/colorTerritory/.
// Run: node scripts/make-territory-sfx.cjs
// Replace any file with your own recording under the same name; src/audio/sounds.ts does not change.
// Theme: an enchanted glade with glowing orbs and rival kingdoms: crystal chimes, dark drains and a great gong.
const { buf, burst, tone, hold, drive, save } = require('./lib/synth.cjs');
const D = 'colorTerritory';

// claim: you take an orb (a short glassy "bloop" that rises, with a sparkle; played on every tap, so it is short)
let o = buf(0.4);
tone(o, 0, 0.18, 'sine', 520, 1250, 0.55);
tone(o, 0.05, 0.3, 'sine', 1568, 1560, 0.3);
tone(o, 0.05, 0.2, 'triangle', 3136, 3120, 0.1);
burst(o, 0.08, 0.05, 'highpass', 5000, 0.2, 5);
save(D, 'territory-claim.wav', o);

// stolen: a rival takes one of your orbs (a dark draining whoosh that falls away, with a hollow thump)
o = buf(0.9);
tone(o, 0, 0.5, 'sine', 900, 160, 0.5);
hold(o, 0, 0.5, 'saw', 400, 70, 0.14, 0.01);
burst(o, 0, 0.45, 'bandpass', 1400, 0.3, 2.5);
tone(o, 0.12, 0.5, 'sine', 80, 32, 1.0);
drive(o, 1.6);
save(D, 'territory-stolen.wav', o);

// tick: the last 10 seconds, one per second (a dry crystal tick over a low pulse)
o = buf(0.3);
burst(o, 0, 0.015, 'bandpass', 3500, 0.7, 5);
tone(o, 0, 0.1, 'sine', 1760, 1700, 0.3);
tone(o, 0, 0.14, 'sine', 80, 45, 0.8);
drive(o, 1.4);
save(D, 'territory-tick.wav', o);

// timeUp: the time is over (a huge gong: a low bell with inharmonic partials, and a horn swell under it)
o = buf(3.4);
const f = 110;
[[1, 0.7, 3.2], [2.76, 0.35, 2.6], [5.4, 0.2, 1.8], [8.93, 0.1, 1.2], [1.5, 0.3, 2.6]].forEach(([m, v, d]) => tone(o, 0, d, 'sine', f * m, f * m * 0.998, v));
burst(o, 0, 0.05, 'highpass', 2500, 0.7, 3);
burst(o, 0, 1.5, 'bandpass', 3000, 0.15, 1.5);
hold(o, 0, 1.4, 'saw', 110, 110, 0.12, 0.15);
drive(o, 1.5);
save(D, 'territory-timeup.wav', o);

// win: your kingdom rules the glade (a rising harp-like arpeggio and a shining chord)
o = buf(3.2);
[523, 659, 784, 1047, 1319, 1568].forEach((fr, i) => {
  tone(o, i * 0.1, 0.9, 'triangle', fr, fr * 0.997, 0.34);
  tone(o, i * 0.1, 0.5, 'sine', fr * 2, fr * 2, 0.1);
});
for (const fr of [523, 659, 784, 1047]) hold(o, 0.6, 2.4, 'triangle', fr, fr * 0.998, 0.13, 0.15);
tone(o, 0.6, 1.8, 'sine', 2093, 2085, 0.18);
tone(o, 0.6, 0.8, 'sine', 100, 50, 0.7);
burst(o, 0.6, 1.6, 'highpass', 6000, 0.08, 2);
drive(o, 1.3);
save(D, 'territory-win.wav', o);
