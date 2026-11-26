// Renders the Light Bulb sound effects to assets/sounds/lightBulb/. Run: node scripts/make-lightbulb-sfx.cjs
// Replace any file with your own recording under the same name; src/audio/sounds.ts does not change.
// Theme: the ruins of an old house after a war, a tangle of wires and 7 TNT. Everything is meant to be tense.
const { buf, burst, tone, hold, drive, save } = require('./lib/synth.cjs');
const D = 'lightBulb';

// fuse: the fuse is lit when the board appears (a hissing, spitting crackle that climbs)
let o = buf(1.6);
burst(o, 0, 1.5, 'highpass', 3500, 0.35, 1.2);
for (let i = 0; i < 40; i++) burst(o, Math.random() * 1.4, 0.012, 'bandpass', 2500 + Math.random() * 4000, 0.5, 4);
hold(o, 0, 1.5, 'saw', 70, 95, 0.12);
drive(o, 1.5);
save(D, 'lightbulb-fuse.wav', o);

// arm: a lever is lifted (heavy iron clunk and a rusty creak)
o = buf(0.5);
burst(o, 0, 0.04, 'bandpass', 1500, 0.8, 4);
tone(o, 0, 0.15, 'sine', 140, 60, 0.8);
hold(o, 0.03, 0.3, 'saw', 220, 520, 0.1);
burst(o, 0.05, 0.25, 'bandpass', 900, 0.15, 2);
drive(o, 1.6);
save(D, 'lightbulb-arm.wav', o);

// disarm: the lever drops back (a duller, lower clunk)
o = buf(0.4);
burst(o, 0, 0.05, 'lowpass', 900, 0.8, 4);
tone(o, 0, 0.18, 'sine', 100, 45, 0.9);
hold(o, 0, 0.22, 'saw', 300, 140, 0.08);
drive(o, 1.6);
save(D, 'lightbulb-disarm.wav', o);

// tick: the last 10 seconds, one per second (a metal tick over a low heartbeat thud)
o = buf(0.5);
burst(o, 0, 0.02, 'bandpass', 3200, 0.9, 5);
tone(o, 0, 0.08, 'square', 1800, 900, 0.15);
tone(o, 0.01, 0.2, 'sine', 70, 38, 1.0);
tone(o, 0.16, 0.18, 'sine', 62, 34, 0.7);
drive(o, 1.8);
save(D, 'lightbulb-tick.wav', o);

// lit: the right switch. Clack, a surge of electricity, the bulb stutters on with a hum, then a cold high ping
o = buf(2.4);
burst(o, 0, 0.03, 'bandpass', 1800, 0.9, 4);
tone(o, 0, 0.12, 'sine', 120, 50, 0.8);
hold(o, 0.05, 0.5, 'saw', 100, 900, 0.15);
for (const t of [0.35, 0.45, 0.52, 0.62]) burst(o, t, 0.05, 'highpass', 3000, 0.6, 3);
hold(o, 0.7, 1.7, 'sine', 120, 120, 0.3);
hold(o, 0.7, 1.7, 'sine', 240, 240, 0.12);
hold(o, 0.7, 1.7, 'saw', 60, 60, 0.05);
tone(o, 0.75, 1.5, 'sine', 2093, 2080, 0.4);
tone(o, 0.75, 1.2, 'sine', 3136, 3120, 0.15);
drive(o, 1.4);
save(D, 'lightbulb-lit.wav', o);

// boom: THE TNT. Built to be LOUD: crack, a wall of noise, a huge sub thump, a second blast, debris, a ringing ear.
// Everything is pushed through heavy clipping, so after normalising the whole file is as loud as it can be.
o = buf(3.6);
burst(o, 0, 0.06, 'highpass', 1500, 1.6, 2);             // the crack
burst(o, 0, 1.6, 'lowpass', 2200, 2.0, 2.5);              // the wall of noise
burst(o, 0, 2.6, 'lowpass', 400, 1.8, 1.6);               // the low body of the blast
tone(o, 0, 1.4, 'sine', 90, 18, 3.0);                     // sub thump
tone(o, 0, 0.5, 'saw', 150, 30, 0.8);
burst(o, 0.22, 1.2, 'lowpass', 900, 1.2, 2.5);            // second, delayed blast
tone(o, 0.22, 1.0, 'sine', 60, 20, 1.6);
for (let i = 0; i < 45; i++) burst(o, 0.3 + Math.random() * 2.4, 0.04, 'bandpass', 800 + Math.random() * 3500, 0.35 * Math.exp(-i / 25), 4); // falling debris
burst(o, 0.5, 3.0, 'highpass', 5000, 0.12, 2);            // dust and hiss
hold(o, 0.12, 2.6, 'sine', 4200, 4200, 0.07);             // the ringing in your ears
drive(o, 3.2);
save(D, 'lightbulb-boom.wav', o);
