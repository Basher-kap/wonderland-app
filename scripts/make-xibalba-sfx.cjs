// Renders the Traps of Xibalba sound effects to assets/sounds/xibalba/. Run: node scripts/make-xibalba-sfx.cjs
// Replace any file with your own recording under the same name; src/audio/sounds.ts does not change.
const { buf, burst, tone, swell, noiseEnv, save } = require('./lib/synth.cjs');
const D = 'xibalba';
const taiko = (o, at, vol = 1) => {
  burst(o, at, 0.35, 'lowpass', 300, vol, 4);
  tone(o, at, 0.4, 'sine', 95, 38, vol);
};

// step: a footstep on stone (thud, grit)
let o = buf(0.3);
burst(o, 0, 0.09, 'lowpass', 700, 0.8, 5);
tone(o, 0, 0.1, 'sine', 150, 60, 0.7);
burst(o, 0.01, 0.04, 'bandpass', 2600, 0.25, 5);
save(D, 'xibalba-step.wav', o);

// danger: every turn. A deep taiko, a low drone, and a shakuhachi-like flute (breath + vibrato) rising a tone, tense and slow
o = buf(3.4);
taiko(o, 0, 0.9);
swell(o, 0, 3.4, 110, 110, 0.22, 0.8);
swell(o, 0, 3.4, 165, 165, 0.1, 1.0);
swell(o, 0.2, 1.4, 440, 440, 0.2, 0.35, 5.2, 0.006);
noiseEnv(o, 0.2, 1.4, 'bandpass', 2400, 0.05, (t) => Math.sin(Math.PI * t));
swell(o, 1.45, 1.7, 440, 523, 0.2, 0.4, 5.2, 0.007);
noiseEnv(o, 1.45, 1.7, 'bandpass', 2400, 0.05, (t) => Math.sin(Math.PI * t));
taiko(o, 2.6, 0.6);
save(D, 'xibalba-danger.wav', o);

// drumroll: the end of the pick time. Quick taiko hits getting faster and louder, then one huge hit and a cymbal wash
o = buf(3.0);
for (let t = 0; t < 2.4; ) {
  const k = t / 2.4;
  const v = 0.12 + 0.7 * k * k;
  burst(o, t, 0.07, 'lowpass', 450, v, 5);
  tone(o, t, 0.06, 'sine', 110, 70, v * 0.6);
  t += 0.09 - 0.055 * k;
}
taiko(o, 2.4, 1.0);
burst(o, 2.4, 0.6, 'highpass', 5000, 0.3, 4);
save(D, 'xibalba-drumroll.wav', o);

// safe: the slab holds: a dull click and a soft bright ting
o = buf(0.8);
burst(o, 0, 0.04, 'lowpass', 900, 0.6, 5);
tone(o, 0, 0.07, 'sine', 180, 100, 0.4);
tone(o, 0.05, 0.7, 'sine', 988, 985, 0.22);
tone(o, 0.05, 0.5, 'sine', 1480, 1475, 0.1);
save(D, 'xibalba-safe.wav', o, 2.4);

// trapSpikes: a metal "shing" as spikes shoot up, and the stabs
o = buf(0.9);
burst(o, 0, 0.35, 'highpass', 4000, 0.45, 3);
tone(o, 0, 0.14, 'saw', 700, 2600, 0.14);
for (const t of [0.02, 0.05, 0.08, 0.11]) { burst(o, t, 0.02, 'bandpass', 3200, 0.4, 4); tone(o, t, 0.05, 'sine', 220, 90, 0.3); }
tone(o, 0.15, 0.5, 'sine', 2200, 2190, 0.08);
save(D, 'xibalba-trap-spikes.wav', o);

// trapCrumble: the tile cracks, breaks and falls away
o = buf(1.7);
for (const t of [0, 0.05, 0.1, 0.17]) burst(o, t, 0.03, 'bandpass', 1800 + t * 3000, 0.5, 4);
noiseEnv(o, 0.1, 1.0, 'lowpass', 600, 0.7, (t) => Math.exp(-3 * t) * Math.min(1, t * 8));
for (let i = 0; i < 22; i++) burst(o, 0.2 + Math.random() * 0.9, 0.02, 'bandpass', 800 + Math.random() * 2500, 0.2, 4);
tone(o, 1.2, 0.45, 'sine', 70, 30, 0.45);
burst(o, 1.2, 0.2, 'lowpass', 400, 0.3, 5);
save(D, 'xibalba-trap-crumble.wav', o, 2.2);

// trapFire: a gas whoomp ignites, then the flames roar and crackle
o = buf(1.8);
noiseEnv(o, 0, 0.35, 'lowpass', 900, 0.7, (t) => Math.min(1, t * 12) * Math.exp(-2.5 * t));
tone(o, 0, 0.25, 'sine', 90, 45, 0.5);
noiseEnv(o, 0.1, 1.6, 'bandpass', 1400, 0.3, (t) => Math.min(1, t * 6) * Math.exp(-1.6 * t));
for (let i = 0; i < 34; i++) burst(o, 0.1 + Math.random() * 1.5, 0.012, 'bandpass', 2500 + Math.random() * 2500, 0.3 * (1 - i / 50), 4);
save(D, 'xibalba-trap-fire.wav', o, 2.0);

// trapExplode: a crack, a huge blast, a thump and falling debris
o = buf(2.0);
burst(o, 0, 0.04, 'highpass', 3000, 0.9, 3);
burst(o, 0, 1.4, 'lowpass', 1300, 1.0, 3.5);
tone(o, 0, 0.9, 'sine', 75, 22, 1.0);
for (let i = 0; i < 18; i++) burst(o, 0.25 + Math.random() * 1.2, 0.025, 'bandpass', 700 + Math.random() * 2000, 0.25, 4);
save(D, 'xibalba-trap-explode.wav', o);

// trapBoulder: a growing rumble from above, a gigantic impact, rolling stones
o = buf(2.4);
noiseEnv(o, 0, 1.1, 'lowpass', 320, 0.6, (t) => t * t);
tone(o, 0.2, 0.9, 'sine', 40, 70, 0.15);
tone(o, 1.1, 0.8, 'sine', 55, 22, 1.0);
burst(o, 1.1, 0.6, 'lowpass', 600, 0.9, 4);
burst(o, 1.1, 0.05, 'bandpass', 1500, 0.7, 4);
noiseEnv(o, 1.2, 1.1, 'lowpass', 400, 0.35, (t) => Math.exp(-3 * t));
for (let i = 0; i < 10; i++) burst(o, 1.3 + Math.random() * 0.9, 0.02, 'bandpass', 600 + Math.random() * 1200, 0.18, 4);
save(D, 'xibalba-trap-boulder.wav', o);

// fall: the player drops: a falling whistle of wind, then a far-away thud
o = buf(1.8);
tone(o, 0, 1.0, 'sine', 1300, 180, 0.25);
noiseEnv(o, 0, 1.1, 'bandpass', 1800, 0.18, (t) => Math.sin(Math.PI * Math.min(1, t * 1.1)));
tone(o, 1.1, 0.5, 'sine', 80, 30, 0.7);
burst(o, 1.1, 0.25, 'lowpass', 500, 0.5, 5);
save(D, 'xibalba-fall.wav', o);

// survivor: the last one standing: two taiko hits, a rising bell chord, shimmer
o = buf(3.0);
taiko(o, 0, 1.0);
taiko(o, 0.35, 0.8);
[[0.7, 523], [0.85, 659], [1.0, 784], [1.15, 1047]].forEach(([t, f]) => {
  tone(o, t, 1.6, 'sine', f, f * 0.998, 0.28);
  tone(o, t, 1.0, 'sine', f * 2, f * 2, 0.07);
});
burst(o, 1.1, 1.4, 'highpass', 6000, 0.12, 3);
save(D, 'xibalba-survivor.wav', o);