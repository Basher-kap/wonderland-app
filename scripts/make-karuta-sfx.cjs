// Renders the Karuta sound effects to assets/sounds/karuta/. Run: node scripts/make-karuta-sfx.cjs
// Replace any file with your own recording under the same name; src/audio/sounds.ts does not change.
const { buf, burst, tone, save } = require('./lib/synth.cjs');
const D = 'karuta';

// target: the floating card appears: a temple-bell "ting" (three partials) over a soft rising swish
let o = buf(1.5);
burst(o, 0, 0.18, 'bandpass', 2800, 0.25, 2);
tone(o, 0.04, 1.3, 'sine', 1568, 1560, 0.5);
tone(o, 0.04, 1.0, 'sine', 3136, 3120, 0.22);
tone(o, 0.04, 0.7, 'sine', 4230, 4200, 0.1);
tone(o, 0.04, 1.4, 'sine', 784, 780, 0.18);
save(D, 'karuta-target.wav', o);

// grab: a hand slaps a card on the tatami (soft thump + papery slap)
o = buf(0.35);
burst(o, 0, 0.012, 'highpass', 3500, 0.8, 4);
burst(o, 0, 0.09, 'lowpass', 1100, 0.9, 5);
burst(o, 0.004, 0.05, 'bandpass', 2200, 0.4, 5);
tone(o, 0, 0.12, 'sine', 190, 70, 0.8);
save(D, 'karuta-grab.wav', o);

// rack open: a wooden tray slides out and clacks twice, going up
o = buf(0.6);
burst(o, 0, 0.16, 'bandpass', 700, 0.35, 2);
tone(o, 0.14, 0.07, 'sine', 640, 430, 0.55);
burst(o, 0.14, 0.02, 'bandpass', 1600, 0.45, 4);
tone(o, 0.24, 0.08, 'sine', 820, 540, 0.55);
burst(o, 0.24, 0.02, 'bandpass', 2000, 0.45, 4);
save(D, 'karuta-rack-open.wav', o);

// rack close: the tray slides back and shuts with one lower, softer thud
o = buf(0.55);
burst(o, 0, 0.14, 'bandpass', 600, 0.3, 2);
tone(o, 0.13, 0.12, 'sine', 300, 120, 0.75);
burst(o, 0.13, 0.03, 'bandpass', 1100, 0.4, 4);
burst(o, 0.13, 0.08, 'lowpass', 700, 0.4, 5);
save(D, 'karuta-rack-close.wav', o);
