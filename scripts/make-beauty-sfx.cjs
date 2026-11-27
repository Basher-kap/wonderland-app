// Renders the Beauty Contest sound effects to assets/sounds/beautyContest/. Run: node scripts/make-beauty-sfx.cjs
// Replace any file with your own recording under the same name; src/audio/sounds.ts does not change.
// Theme: a royal court judging. One sound for each step of the reveal, in the order they happen:
// number (a contestant's number appears) > sum > average > target (x 0.8) > away (the distance of each number)
// > invalid > result (the winner is announced) > winner (the closest player blinks "correct") > point (points lost)
// > notice (a player is out / a new rule).
const { buf, burst, tone, hold, drive, save } = require('./lib/synth.cjs');
const D = 'beautyContest';

// number: a contestant's number is placed on the table (a soft stone tap with a small bell)
let o = buf(0.4);
burst(o, 0, 0.02, 'bandpass', 1500, 0.6, 5);
tone(o, 0, 0.1, 'sine', 330, 190, 0.6);
tone(o, 0.02, 0.3, 'sine', 1319, 1310, 0.18);
save(D, 'beauty-number.wav', o);

// sum: adding up (four quick coin ticks climbing in pitch, then a small "total" chime)
o = buf(0.9);
[880, 988, 1109, 1245].forEach((f, i) => {
  tone(o, i * 0.08, 0.1, 'sine', f, f, 0.35);
  burst(o, i * 0.08, 0.012, 'highpass', 4000, 0.3, 5);
});
tone(o, 0.38, 0.5, 'sine', 1661, 1655, 0.4);
tone(o, 0.38, 0.4, 'sine', 3322, 3310, 0.08);
save(D, 'beauty-sum.wav', o);

// average: dividing (a quick swirl that slides down and settles into one calm chime)
o = buf(0.9);
hold(o, 0, 0.35, 'triangle', 1400, 500, 0.2, 0.02);
hold(o, 0, 0.35, 'sine', 700, 250, 0.2, 0.02);
tone(o, 0.32, 0.55, 'sine', 740, 735, 0.45);
tone(o, 0.32, 0.4, 'sine', 1480, 1470, 0.12);
save(D, 'beauty-average.wav', o);

// target: the average x 0.8 (a crosshair locking on: two rising blips, then a low confirming thump)
o = buf(0.8);
tone(o, 0, 0.08, 'square', 900, 900, 0.18);
tone(o, 0.1, 0.08, 'square', 1200, 1200, 0.18);
tone(o, 0.2, 0.35, 'sine', 1800, 1790, 0.35);
tone(o, 0.2, 0.3, 'sine', 90, 45, 0.9);
burst(o, 0.2, 0.03, 'highpass', 3500, 0.4, 4);
save(D, 'beauty-target.wav', o);

// away: how far each number is from the target (a tiny tick; played once per player, so very short and quiet)
o = buf(0.15);
burst(o, 0, 0.012, 'bandpass', 2600, 0.5, 5);
tone(o, 0, 0.05, 'sine', 1100, 900, 0.22);
save(D, 'beauty-away.wav', o);

// invalid: a number that does not count (a low dry buzz)
o = buf(0.5);
hold(o, 0, 0.35, 'saw', 130, 110, 0.35, 0.01);
hold(o, 0, 0.35, 'square', 65, 55, 0.2, 0.01);
tone(o, 0, 0.12, 'sine', 90, 45, 0.6);
drive(o, 1.8);
save(D, 'beauty-invalid.wav', o);

// result: the winner of the round is announced (a short drum roll into a big hit, a brass stab and a shimmer)
o = buf(1.9);
for (let t = 0; t < 0.45; t += 0.05) burst(o, t, 0.03, 'bandpass', 2200, 0.15 + t, 5);
tone(o, 0.45, 0.8, 'sine', 80, 30, 1.2);
burst(o, 0.45, 0.03, 'highpass', 3000, 0.7, 3);
for (const f of [196, 247, 294, 392]) {
  tone(o, 0.45, 1.2, 'saw', f, f * 0.998, 0.2);
  tone(o, 0.45, 1.0, 'triangle', f * 2, f * 2, 0.08);
}
burst(o, 0.45, 1.2, 'highpass', 6000, 0.12, 2);
drive(o, 1.5);
save(D, 'beauty-result.wav', o);

// winner: for the player(s) who got the closest number (a "correct" ping that BLINKS: three quick, bright, rising pings,
// the last one ringing out, with a sparkle)
o = buf(1.4);
[[0, 1319], [0.13, 1760], [0.26, 2349]].forEach(([t, f], i) => {
  const ring = i === 2 ? 1.0 : 0.16;
  tone(o, t, ring, 'sine', f, f * 0.998, 0.5);
  tone(o, t, ring * 0.6, 'sine', f * 2, f * 2, 0.12);
  burst(o, t, 0.015, 'highpass', 5000, 0.3, 5);
});
tone(o, 0.26, 0.9, 'sine', 3136, 3130, 0.12);
save(D, 'beauty-winner.wav', o);

// point: a contestant loses a point (a dull, heavy "tonk")
o = buf(0.5);
burst(o, 0, 0.06, 'lowpass', 700, 0.7, 5);
tone(o, 0, 0.25, 'sine', 140, 60, 0.9);
tone(o, 0, 0.15, 'triangle', 280, 140, 0.2);
save(D, 'beauty-point.wav', o);

// notice: a player is out, or a new rule begins (a low brass call and a gong)
o = buf(2.2);
for (const f of [98, 147, 196]) {
  hold(o, 0, 1.4, 'saw', f, f * 0.99, 0.18, 0.08);
  hold(o, 0, 1.4, 'triangle', f * 2, f * 2, 0.08, 0.08);
}
tone(o, 0, 2.0, 'sine', 110, 108, 0.4);
tone(o, 0, 1.6, 'sine', 110 * 2.76, 110 * 2.76, 0.18);
tone(o, 0, 0.5, 'sine', 60, 35, 0.9);
burst(o, 0, 0.04, 'highpass', 2500, 0.5, 3);
drive(o, 1.5);
save(D, 'beauty-notice.wav', o);
