// Tiny offline synth for the game sound effects (no dependencies). Used by scripts/make-*-sfx.cjs.
// Everything renders to a mono Float32Array at 44.1 kHz and is saved as a 16-bit WAV, normalised to 0.95.
const fs = require('node:fs');
const path = require('node:path');
const SR = 44100;

const buf = (sec) => new Float32Array(Math.ceil(sec * SR));

// RBJ biquad (Q = 1): 'lowpass' | 'highpass' | 'bandpass'
function biquad(x, type, freq) {
  const w0 = (2 * Math.PI * freq) / SR, cos = Math.cos(w0), alpha = Math.sin(w0) / 2;
  let b0, b1, b2;
  if (type === 'lowpass') { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2; }
  else if (type === 'highpass') { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2; }
  else { b0 = alpha; b1 = 0; b2 = -alpha; }
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
// Filtered noise with an exponential decay. `decay` bigger = shorter.
function burst(out, at, sec, type, freq, vol, decay = 6) {
  const n = Math.max(1, Math.floor(SR * sec)), x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = (Math.random() * 2 - 1) * Math.exp((-decay * i) / n);
  add(out, at, biquad(x, type, freq), vol);
}
// Pitch glide f0 -> f1 with an exponential fade. type: sine | triangle | saw | square
function tone(out, at, sec, type, f0, f1, vol) {
  const n = Math.floor(SR * sec), x = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n, f = f0 * Math.pow(Math.max(1, f1) / f0, t);
    phase += (2 * Math.PI * f) / SR;
    const p = phase % (2 * Math.PI);
    const s = type === 'triangle' ? (2 / Math.PI) * Math.asin(Math.sin(phase))
      : type === 'saw' ? p / Math.PI - 1
      : type === 'square' ? (p < Math.PI ? 1 : -1)
      : Math.sin(phase);
    x[i] = s * vol * Math.pow(0.0001 / vol, t);
  }
  add(out, at, x, 1);
}
function save(dir, file, data) {
  let peak = 0;
  for (const v of data) peak = Math.max(peak, Math.abs(v));
  const g = peak > 0.95 ? 0.95 / peak : 1;
  const pcm = Buffer.alloc(44 + data.length * 2);
  pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + data.length * 2, 4); pcm.write('WAVEfmt ', 8);
  pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34);
  pcm.write('data', 36); pcm.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, data[i] * g)) * 32767), 44 + i * 2);
  const full = path.join(__dirname, '..', '..', 'assets', 'sounds', dir, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, pcm);
  console.log(`${dir}/${file}`, (pcm.length / 1024).toFixed(0) + ' KB', (data.length / SR).toFixed(2) + ' s', 'peak', peak.toFixed(2));
}
module.exports = { SR, buf, biquad, add, burst, tone, save };
