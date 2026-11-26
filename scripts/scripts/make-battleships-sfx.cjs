// Renders the Battleships sound effects to assets/sounds/battleships/. Run: node scripts/make-battleships-sfx.cjs
// Replace any file with your own recording under the same name; src/audio/sounds.ts does not change.
const { buf, burst, tone, save } = require('./lib/synth.cjs');
const D = 'battleships';

// fire: the cannon shot (crack, blast, deep thump, a short rumble tail)
let o = buf(1.3);
burst(o, 0, 0.03, 'highpass', 2500, 1.0, 3);
burst(o, 0, 1.0, 'lowpass', 700, 1.0, 4);
tone(o, 0, 0.6, 'sine', 120, 32, 1.0);
burst(o, 0.12, 1.0, 'lowpass', 300, 0.35, 3);
save(D, 'battleships-fire.wav', o);

// hitEnemy: the shell lands on an enemy ship (explosion + splintering wood + falling debris)
o = buf(1.5);
burst(o, 0, 0.05, 'highpass', 3000, 0.8, 3);
burst(o, 0, 1.1, 'lowpass', 1500, 1.0, 4);
tone(o, 0, 0.7, 'sine', 80, 26, 1.0);
for (const [t, f] of [[0.06, 1700], [0.13, 2300], [0.21, 1400], [0.33, 2000], [0.47, 1600]]) burst(o, t, 0.05, 'bandpass', f, 0.35, 4);
burst(o, 0.5, 0.9, 'highpass', 4500, 0.12, 5);
save(D, 'battleships-hit-enemy.wav', o);

// hitOwn: friendly fire: a duller blast and a sour falling "wrong" tone
o = buf(1.4);
burst(o, 0, 0.9, 'lowpass', 800, 0.9, 4);
tone(o, 0, 0.6, 'sine', 70, 24, 0.9);
burst(o, 0.04, 0.06, 'bandpass', 1200, 0.5, 4);
tone(o, 0.15, 0.7, 'saw', 330, 95, 0.22);
tone(o, 0.15, 0.7, 'saw', 350, 100, 0.18);
save(D, 'battleships-hit-own.wav', o);

// miss: the shell drops into the water (plunk, splash, a few bubbles)
o = buf(1.1);
tone(o, 0, 0.12, 'sine', 240, 70, 0.7);
burst(o, 0, 0.55, 'lowpass', 2600, 0.7, 3);
burst(o, 0.03, 0.45, 'bandpass', 5000, 0.25, 4);
for (const [t, f] of [[0.18, 380], [0.27, 520], [0.38, 450], [0.5, 640], [0.62, 560]]) tone(o, t, 0.07, 'sine', f, f * 2.2, 0.16);
save(D, 'battleships-miss.wav', o);

// aim: your turn: the cannon swings round (ratchet clicks that slow down, a servo hum, a lock-on click)
o = buf(1.1);
tone(o, 0, 0.7, 'triangle', 90, 150, 0.09);
tone(o, 0, 0.7, 'saw', 180, 300, 0.025);
let t = 0.02;
for (let i = 0; i < 12; i++) { burst(o, t, 0.012, 'bandpass', 2200, 0.35, 4); t += 0.035 + i * 0.012; }
burst(o, 0.78, 0.02, 'highpass', 2000, 0.6, 4);
tone(o, 0.78, 0.07, 'square', 1300, 900, 0.12);
tone(o, 0.82, 0.25, 'sine', 70, 50, 0.3);
save(D, 'battleships-aim.wav', o);
