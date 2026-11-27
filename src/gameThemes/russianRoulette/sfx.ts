import { Platform, Vibration } from 'react-native';
import { playSound } from '../../audio';

// Sounds of the den.
//  - Browsers (Expo web): synthesized live with the Web Audio API (below).
//  - Phones: React Native has no Web Audio, so the sounds are the files in assets/sounds/russianRoulette/,
//    registered in src/audio/sounds.ts and played through src/audio (expo-audio). They were rendered by
//    scripts/make-roulette-sfx.cjs; replace them with your own recordings under the same names.
//    The gunshot also vibrates the phone. The game loads them in advance with useGameSounds('russianRoulette').
//
// THE GUNSHOT is meant to be a jumpscare. Lower BANG_VOLUME (0 to 1) if it is too much.
export const BANG_VOLUME = 0.8;

export type SfxName = 'load' | 'spin' | 'close' | 'click' | 'bang' | 'shield' | 'trigger';

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
    if (name === 'trigger') Vibration.vibrate(40);
    if (Platform.OS !== 'web') {
      if (name !== 'trigger') playSound('russianRoulette', name, { volume: name === 'bang' ? Math.min(1, BANG_VOLUME + 0.2) : 1 });
      return;
    }
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
        // the plate closes, then a fast ratchet while the cylinder spins and slows down
        burst(c, 0, 0.04, 'lowpass', 900, 0.4, 5);
        let t = 0.4;
        for (let i = 0; i < 30; i++) {
          burst(c, t, 0.01, 'bandpass', 3000, 0.22, 4);
          t += 0.02 + i * 0.0035;
        }
        break;
      }
      case 'trigger': // every hammer falls at the same moment
        for (let i = 0; i < 4; i++) burst(c, i * 0.012, 0.02, 'highpass', 2000 + i * 400, 0.5, 4);
        tone(c, 0, 0.12, 'sine', 140, 60, 0.35);
        break;
      case 'shield': // the shield force: a shimmering rising hum
        tone(c, 0, 0.7, 'sine', 380, 1500, 0.12);
        tone(c, 0.05, 0.7, 'triangle', 570, 2200, 0.06);
        tone(c, 0.35, 0.5, 'sine', 1800, 2600, 0.05);
        break;
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