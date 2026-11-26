// Renders the Russian Roulette sound effects to assets/sounds/roulette-*.wav, using the same recipe
// as the Web Audio version in src/gameThemes/russianRoulette/sfx.ts. Phones cannot run Web Audio, so
// they play these files with expo-audio. Run: node scripts/make-roulette-sfx.cjs
const fs = require('node:fs');
const path = require('node:path');
const SR = 44100;
const BANG_VOLUME = 0.8;

const buf = (sec) => new Float32Array(Math.ceil(sec * SR));

// RBJ biquad, same family as Web Audio's BiquadFilterNode (Q = 1).
function biquad(x, type, freq) {
  const w0 = (2 * Math.PI * freq) / SR, cos = Math.cos(w0), alpha = Math.sin(w0) / 2;
  let b0, b1, b2;
  if (type === 'lowpass') { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2; }
  else if (type === 'highpass') { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2; }
  else { b0 = alpha; b1 = 0; b2 = -alpha; } // bandpass
  const a0 = 1 + alpha, a1 = (-2 * cos) / a0, a2 = (1 - alpha) / a0;
  b0 /= a0; b1 /= a0; b2 /= a0;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
function add(out, at, src, vol) {
  const o = Math.floor(at * SR);
  for (let i = 0; i < src.length && o + i < out.length; i++) out[o + i] += src[i] * vol;
}
function burst(out, at, sec, type, freq, vol, decay = 6) {
  const n = Math.max(1, Math.floor(SR * sec));
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = (Math.random() * 2 - 1) * Math.exp((-decay * i) / n);
  add(out, at, biquad(x, type, freq), vol);
}
function tone(out, at, sec, type, f0, f1, vol) {
  const n = Math.floor(SR * sec), x = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n, f = f0 * Math.pow(Math.max(1, f1) / f0, t);
    phase += (2 * Math.PI * f) / SR;
    const s = type === 'triangle' ? (2 / Math.PI) * Math.asin(Math.sin(phase)) : Math.sin(phase);
    x[i] = s * vol * Math.pow(0.0001 / vol, t); // exponential fade like exponentialRampToValueAtTime
  }
  add(out, at, x, 1);
}
function save(name, data) {
  let peak = 0;
  for (const v of data) peak = Math.max(peak, Math.abs(v));
  const g = peak > 0.95 ? 0.95 / peak : 1;
  const pcm = Buffer.alloc(44 + data.length * 2);
  pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + data.length * 2, 4); pcm.write('WAVEfmt ', 8);
  pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34);
  pcm.write('data', 36); pcm.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, data[i] * g)) * 32767), 44 + i * 2);
  const file = path.join(__dirname, '..', 'assets', 'sounds', `roulette-${name}.wav`);
  fs.writeFileSync(file, pcm);
  console.log(name, (pcm.length / 1024).toFixed(0) + ' KB', 'gain', g.toFixed(2));
}

let o = buf(0.9);
burst(o, 0, 0.05, 'highpass', 2500, BANG_VOLUME, 3);
burst(o, 0, 0.7, 'lowpass', 1800, BANG_VOLUME, 5);
tone(o, 0, 0.4, 'sine', 90, 28, BANG_VOLUME);
save('bang', o);

o = buf(0.25);
burst(o, 0, 0.015, 'highpass', 2500, 0.5, 4);
burst(o, 0.09, 0.02, 'highpass', 1800, 0.35, 4);
save('click', o);

o = buf(1.4);
burst(o, 0, 0.04, 'lowpass', 900, 0.4, 5);
let t = 0.4;
for (let i = 0; i < 30; i++) { burst(o, t, 0.01, 'bandpass', 3000, 0.22, 4); t += 0.02 + i * 0.0035; }
save('spin', o);

o = buf(0.8);
tone(o, 0, 0.7, 'sine', 380, 1500, 0.12);
tone(o, 0.05, 0.7, 'triangle', 570, 2200, 0.06);
tone(o, 0.35, 0.5, 'sine', 1800, 2600, 0.05);
save('shield', o);

o = buf(0.15);
tone(o, 0, 0.09, 'triangle', 2400, 1800, 0.1);
burst(o, 0, 0.02, 'highpass', 4000, 0.18, 4);
save('load', o);

o = buf(0.15);
burst(o, 0, 0.04, 'lowpass', 900, 0.5, 5);
tone(o, 0, 0.08, 'sine', 200, 120, 0.2);
save('close', o);
