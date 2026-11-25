import { Platform, Vibration } from 'react-native';

// Sounds of the den. The project has no audio library installed yet, so for now the sounds are played with
// the Web Audio API where it exists (Expo web / browsers). On phones the gunshot is a strong vibration
// (React Native's own Vibration) and everything else is silent: the game shows the same moments with
// light, shake and captions. To get real sound on phones, install expo-audio and play your own files
// from `playSfx` below: it is the only place to change.
//
// THE GUNSHOT is meant to be a jumpscare. Lower BANG_VOLUME (0 to 1) if it is too much.
export const BANG_VOLUME = 0.8;

export type SfxName = 'load' | 'spin' | 'close' | 'click' | 'bang';

let ctx: any = null;

function audio(): any {
  if (Platform.OS !== 'web') return null;
  if (!ctx) {
    const C = (globalThis as any).AudioContext ?? (globalThis as any).webkitAudioContext;
    if (!C) return null;
    try {
      ctx = new C();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume?.();
  return ctx;
}

function noise(c: any, seconds: number, decay: number) {
  const len = Math.max(1, Math.floor(c.sampleRate * seconds));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp((-decay * i) / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}

function burst(c: any, at: number, seconds: number, type: string, freq: number, vol: number, decay = 6) {
  const src = noise(c, seconds, decay);
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f);
  f.connect(g);
  g.connect(c.destination);
  src.start(c.currentTime + at);
}

function tone(c: any, at: number, seconds: number, type: string, f0: number, f1: number, vol: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  const t = c.currentTime + at;
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + seconds);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t);
  osc.stop(t + seconds + 0.02);
}

export function playSfx(name: SfxName) {
  try {
    if (name === 'bang') Vibration.vibrate(Platform.OS === 'android' ? [0, 90, 40, 180] : 400);
    if (name === 'click' && Platform.OS === 'android') Vibration.vibrate(12);
    const c = audio();
    if (!c) return;
    switch (name) {
      case 'bang':
        burst(c, 0, 0.05, 'highpass', 2500, BANG_VOLUME, 3); // the crack
        burst(c, 0, 0.7, 'lowpass', 1800, BANG_VOLUME, 5); // the blast
        tone(c, 0, 0.4, 'sine', 90, 28, BANG_VOLUME); // the thump
        break;
      case 'click':
        burst(c, 0, 0.015, 'highpass', 2500, 0.5, 4);
        burst(c, 0.09, 0.02, 'highpass', 1800, 0.35, 4);
        break;
      case 'spin': {
        let t = 0;
        for (let i = 0; i < 26; i++) {
          burst(c, t, 0.012, 'bandpass', 3000, 0.22, 4);
          t += 0.035 + i * 0.006;
        }
        break;
      }
      case 'load':
        tone(c, 0, 0.09, 'triangle', 2400, 1800, 0.1);
        burst(c, 0, 0.02, 'highpass', 4000, 0.18, 4);
        break;
      case 'close':
        burst(c, 0, 0.04, 'lowpass', 900, 0.5, 5);
        tone(c, 0, 0.08, 'sine', 200, 120, 0.2);
        break;
    }
  } catch {
    // a sound that cannot play is never a problem for the game
  }
}
