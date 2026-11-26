// Renders the Schulte Table sound effects to assets/sounds/schulte/. Run: node scripts/make-schulte-sfx.cjs
// Replace any file with your own recording under the same name; src/audio/sounds.ts does not change.
// Theme: wooden toy blocks in a tray: dry clacks, dull thuds, clattering piles.
const { buf, burst, tone, save } = require('./lib/synth.cjs');
const D = 'schulte';

// One block hitting another: a sharp "tock" (a click, a woody ring that drops fast, and a bit of body).
const clack = (o, at, pitch = 1, vol = 1) => {
  burst(o, at, 0.02, 'highpass', 2500, 0.8 * vol, 4);
  burst(o, at, 0.05, 'bandpass', 1900 * pitch, 0.7 * vol, 5);
  tone(o, at, 0.06, 'triangle', 820 * pitch, 520 * pitch, 0.4 * vol);
  tone(o, at, 0.04, 'sine', 1950 * pitch, 1500 * pitch, 0.15 * vol);
  tone(o, at, 0.05, 'sine', 210 * pitch, 140 * pitch, 0.35 * vol);
};
// A block landing flat: a dull "thud".
const thud = (o, at, vol = 1) => {
  burst(o, at, 0.08, 'lowpass', 600, 0.8 * vol, 5);
  tone(o, at, 0.18, 'sine', 150, 62, 1.0 * vol);
  burst(o, at, 0.015, 'bandpass', 1200, 0.3 * vol, 4);
};

// clack1-3: a correct tap (three different blocks, so a run of taps does not sound like a machine)
[[1, 'clack1', 1.0], [2, 'clack2', 0.9], [3, 'clack3', 1.12]].forEach(([n, name, pitch]) => {
  const o = buf(0.16);
  clack(o, 0, pitch, 1);
  save(D, `schulte-${name}.wav`, o);
});

// thud: a wrong tap (a heavy dull block dropped on the tray)
let o = buf(0.4);
thud(o, 0, 1);
tone(o, 0.02, 0.2, 'sine', 95, 50, 0.4);
save(D, 'schulte-thud.wav', o);

// levelClear: the level is done (a quick run of five clacks climbing in pitch, then one solid block set down)
o = buf(1.0);
[1.0, 1.08, 1.17, 1.27, 1.38].forEach((p, i) => clack(o, i * 0.07, p, 0.8));
thud(o, 0.4, 1.0);
clack(o, 0.4, 0.8, 0.9);
save(D, 'schulte-levelclear.wav', o);

// shuffle: level 4, the blocks are mixed up (a rattle of blocks sliding and knocking, thickest in the middle)
o = buf(1.1);
for (let i = 0; i < 22; i++) {
  const t = 0.05 + Math.random() * 0.85, mid = 1 - Math.abs(t - 0.5) * 1.6;
  clack(o, t, 0.8 + Math.random() * 0.6, 0.25 + 0.5 * mid * Math.random());
}
burst(o, 0, 1.0, 'bandpass', 1400, 0.15, 1.5);
save(D, 'schulte-shuffle.wav', o);

// finish: all five levels cleared (a tumble of blocks pouring across the tray, and a last heavy thud and clack)
o = buf(2.0);
for (let i = 0; i < 30; i++) {
  const t = Math.pow(Math.random(), 1.3) * 1.2;
  clack(o, t, 0.75 + Math.random() * 0.7, 0.3 + 0.5 * Math.random());
  if (Math.random() < 0.25) thud(o, t, 0.4);
}
thud(o, 1.3, 1.3);
clack(o, 1.3, 0.85, 1.0);
clack(o, 1.45, 1.2, 0.7);
save(D, 'schulte-finish.wav', o);
