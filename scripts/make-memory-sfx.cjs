// Renders the Memory Card sound effects to assets/sounds/memoryCard/. Run: node scripts/make-memory-sfx.cjs
// Replace any file with your own recording under the same name; src/audio/sounds.ts does not change.
// Theme: a séance at night: candle flames, a tolling bell, a heartbeat, whispers and a cold wind.
const { buf, burst, tone, hold, drive, save } = require('./lib/synth.cjs');
const D = 'memoryCard';

// flip: a card turns over (a dry scrape and a faint, breathy whisper; short, because pairs come fast)
let o = buf(0.3);
burst(o, 0, 0.12, 'highpass', 2500, 0.5, 4);
burst(o, 0.02, 0.2, 'bandpass', 1400, 0.3, 3);
tone(o, 0.02, 0.15, 'sine', 330, 250, 0.2);
save(D, 'memory-flip.wav', o);

// heartbeat: one per second of the countdowns (a slow double thump)
o = buf(0.6);
tone(o, 0, 0.18, 'sine', 62, 34, 1.0);
tone(o, 0.17, 0.22, 'sine', 55, 30, 0.8);
burst(o, 0, 0.1, 'lowpass', 200, 0.5, 5);
drive(o, 1.8);
save(D, 'memory-heartbeat.wav', o);

// go: the flip window opens (a violin-like screech stab with a low hit under it)
o = buf(0.9);
hold(o, 0, 0.7, 'saw', 1480, 1560, 0.22, 0.01);
hold(o, 0, 0.7, 'saw', 1397, 1480, 0.2, 0.01); // a clash of neighbouring notes
tone(o, 0, 0.5, 'sine', 80, 40, 1.0);
burst(o, 0, 0.05, 'highpass', 3000, 0.6, 3);
drive(o, 2.2);
save(D, 'memory-go.wav', o);

// match: a pair: a deep tolling bell with an inharmonic shimmer, the spirits agree
o = buf(2.0);
tone(o, 0, 1.9, 'sine', 196, 194, 0.7);
tone(o, 0, 1.6, 'sine', 196 * 2.76, 196 * 2.76, 0.3);
tone(o, 0, 1.2, 'sine', 196 * 5.4, 196 * 5.4, 0.15);
tone(o, 0, 0.6, 'sine', 60, 40, 0.6);
burst(o, 0, 0.03, 'highpass', 3000, 0.7, 3);
drive(o, 1.4);
save(D, 'memory-match.wav', o);

// miss: no match (a low growl dropping away and a cold gust; the spirits are angry)
o = buf(1.0);
hold(o, 0, 0.8, 'saw', 160, 55, 0.3, 0.02);
hold(o, 0, 0.8, 'square', 80, 42, 0.18, 0.02);
burst(o, 0, 0.8, 'bandpass', 700, 0.4, 2);
tone(o, 0, 0.35, 'sine', 70, 35, 0.9);
drive(o, 2.4);
save(D, 'memory-miss.wav', o);

// win: THE VEIL IS LIFTED (a dark choir chord, a great bell, and a shimmering rise)
o = buf(3.2);
for (const f of [130.8, 155.6, 196, 261.6]) hold(o, 0, 2.8, 'triangle', f, f, 0.16, 0.5);
hold(o, 0.3, 2.5, 'sine', 523, 523, 0.1, 0.6);
tone(o, 0.0, 3.0, 'sine', 98, 96, 0.7);
tone(o, 0.0, 2.6, 'sine', 98 * 2.76, 98 * 2.76, 0.25);
tone(o, 0.0, 2.0, 'sine', 98 * 5.4, 98 * 5.4, 0.12);
hold(o, 0.2, 2.4, 'sine', 800, 2400, 0.05, 0.8);
burst(o, 0, 0.04, 'highpass', 3000, 0.6, 3);
drive(o, 1.5);
save(D, 'memory-win.wav', o);

// fail: THE SPIRITS FALL SILENT (the candles gutter: a sinking drone, a long wind, a heavy door shutting)
o = buf(3.2);
hold(o, 0, 2.6, 'saw', 140, 40, 0.25, 0.05);
hold(o, 0, 2.6, 'saw', 147, 44, 0.2, 0.05);
burst(o, 0, 2.2, 'bandpass', 500, 0.35, 1.2);
tone(o, 2.1, 0.7, 'sine', 70, 25, 1.4);
burst(o, 2.1, 0.5, 'lowpass', 400, 1.0, 4);
drive(o, 2.2);
save(D, 'memory-fail.wav', o);
