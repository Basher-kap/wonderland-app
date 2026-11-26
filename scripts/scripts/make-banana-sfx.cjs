// Renders the Magical Banana sound effects to assets/sounds/magicalBanana/.
// Run: node scripts/make-banana-sfx.cjs
// Replace any file with your own recording under the same name; src/audio/sounds.ts does not change.
// Theme: Food Land, a candy-coloured rhythm game: bongos, marimba pops, a silly siren.
const { buf, burst, tone, save } = require('./lib/synth.cjs');
const D = 'magicalBanana';

// beat: one beat of the rhythm, played every second while a turn is running (a round bongo thump)
let o = buf(0.3);
tone(o, 0, 0.22, 'sine', 220, 90, 0.9);
burst(o, 0, 0.03, 'bandpass', 1500, 0.35, 5);
save(D, 'banana-beat.wav', o);

// count: the 3-2-1 beep before a turn (a marimba-like pluck)
o = buf(0.35);
tone(o, 0, 0.28, 'sine', 784, 780, 0.5);
tone(o, 0, 0.1, 'triangle', 1568, 1560, 0.2);
save(D, 'banana-count.wav', o);

// turn: MY TURN alert (a rising three-note fanfare)
o = buf(0.9);
[[0, 523], [0.11, 659], [0.22, 880]].forEach(([t, f]) => {
  tone(o, t, 0.4, 'triangle', f, f, 0.4);
  tone(o, t, 0.25, 'sine', f * 2, f * 2, 0.12);
});
tone(o, 0.22, 0.6, 'sine', 1319, 1310, 0.25);
save(D, 'banana-turn.wav', o);

// send: my word was sent (a bubble pop)
o = buf(0.25);
tone(o, 0, 0.1, 'sine', 400, 1200, 0.5);
burst(o, 0.07, 0.04, 'highpass', 3500, 0.25, 5);
save(D, 'banana-send.wav', o);

// judge: someone pressed JUDGE (a two-tone siren, three wails)
o = buf(1.3);
for (let i = 0; i < 3; i++) {
  tone(o, i * 0.4, 0.2, 'square', 700, 700, 0.4);
  tone(o, i * 0.4 + 0.2, 0.2, 'square', 520, 520, 0.4);
}
tone(o, 0, 1.2, 'sine', 70, 70, 0.25);
save(D, 'banana-judge.wav', o);

// vote: a vote button was pressed (a small click-pop)
o = buf(0.15);
burst(o, 0, 0.025, 'bandpass', 2000, 0.6, 5);
tone(o, 0, 0.08, 'sine', 500, 800, 0.35);
save(D, 'banana-vote.wav', o);

// ok: the word passes (cheerful rising chime)
o = buf(1.0);
[[0, 659], [0.1, 784], [0.2, 1047]].forEach(([t, f]) => {
  tone(o, t, 0.5, 'sine', f, f, 0.4);
  tone(o, t, 0.3, 'sine', f * 2, f * 2, 0.1);
});
save(D, 'banana-ok.wav', o);

// draw: not accepted, the player must try again (a neutral wobbly "hmm")
o = buf(0.8);
tone(o, 0, 0.3, 'triangle', 440, 400, 0.4);
tone(o, 0.22, 0.45, 'triangle', 415, 370, 0.4);
tone(o, 0, 0.7, 'sine', 880, 780, 0.1);
save(D, 'banana-draw.wav', o);

// no: harsh rejection (a sad trombone, falling and wobbling)
o = buf(1.3);
[[0, 311, 294], [0.28, 294, 277], [0.56, 277, 261], [0.84, 261, 196]].forEach(([t, a, b], i) => {
  const len = i === 3 ? 0.45 : 0.3;
  tone(o, t, len, 'saw', a, b, 0.22);
  tone(o, t, len, 'square', a / 2, b / 2, 0.14);
});
save(D, 'banana-no.wav', o);

// out: a player is disqualified (a cartoon "bonk" and a slide down)
o = buf(1.0);
burst(o, 0, 0.05, 'highpass', 2500, 0.5, 4);
tone(o, 0, 0.18, 'sine', 300, 100, 0.8);
tone(o, 0.12, 0.7, 'triangle', 900, 120, 0.3);
save(D, 'banana-out.wav', o);

// win: the last player standing (a happy marimba run and a final chord)
o = buf(1.8);
[523, 587, 659, 784, 880, 1047].forEach((f, i) => {
  tone(o, i * 0.09, 0.4, 'sine', f, f, 0.38);
  tone(o, i * 0.09, 0.25, 'triangle', f * 2, f * 2, 0.1);
});
for (const f of [523, 659, 784, 1047]) tone(o, 0.6, 1.1, 'triangle', f, f * 0.99, 0.17);
burst(o, 0.6, 0.7, 'highpass', 6000, 0.05, 4);
save(D, 'banana-win.wav', o);
