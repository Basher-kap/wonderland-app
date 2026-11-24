import { Platform } from 'react-native';
import type { SfxName } from './theme';

// Funny sound effects. The project has no audio library installed yet, so for now the sounds are
// played with the Web Audio API where it exists (Expo web / browsers); on phones this does nothing and
// the game shows the same effects as pop-up captions (PIN-PON!, BUBU-!...). To get sound on phones,
// install expo-audio and play your own files from `playSfx` below: it is the only place to change.
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

type Note = { f: number; at: number; d: number; type?: string; vol?: number };

const SOUNDS: Record<SfxName, Note[]> = {
  pop: [{ f: 620, at: 0, d: 0.08, type: 'sine', vol: 0.12 }],
  quiz: [
    { f: 988, at: 0, d: 0.09 },
    { f: 1319, at: 0.1, d: 0.14 },
  ],
  drum: Array.from({ length: 14 }, (_, i) => ({ f: 90 + (i % 2) * 25, at: i * 0.09, d: 0.07, type: 'triangle', vol: 0.18 })),
  fanfare: [
    { f: 523, at: 0, d: 0.12 },
    { f: 659, at: 0.12, d: 0.12 },
    { f: 784, at: 0.24, d: 0.12 },
    { f: 1047, at: 0.36, d: 0.4 },
  ],
  pinpon: [
    { f: 880, at: 0, d: 0.16, type: 'sine', vol: 0.14 },
    { f: 1319, at: 0.17, d: 0.3, type: 'sine', vol: 0.14 },
  ],
  bubu: [
    { f: 170, at: 0, d: 0.22, type: 'sawtooth', vol: 0.1 },
    { f: 120, at: 0.25, d: 0.34, type: 'sawtooth', vol: 0.1 },
  ],
  win: [
    { f: 523, at: 0, d: 0.1 },
    { f: 659, at: 0.1, d: 0.1 },
    { f: 784, at: 0.2, d: 0.1 },
    { f: 1047, at: 0.3, d: 0.1 },
    { f: 784, at: 0.42, d: 0.1 },
    { f: 1047, at: 0.52, d: 0.5 },
  ],
};

export function playSfx(name: SfxName) {
  try {
    const c = audio();
    if (!c) return;
    for (const n of SOUNDS[name]) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      const t = c.currentTime + n.at;
      osc.type = n.type ?? 'square';
      osc.frequency.value = n.f;
      gain.gain.setValueAtTime(n.vol ?? 0.07, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + n.d);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t);
      osc.stop(t + n.d + 0.02);
    }
  } catch {
    // a sound that cannot play is never a problem for the game
  }
}
