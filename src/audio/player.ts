import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import { SOUNDS } from './sounds';
import type { SoundGame, SoundName } from './sounds';

// The one place that talks to expo-audio. Games never create players themselves: they call
// `playSound` (or the `useGameSounds` hook). A player is made once per sound, kept while the game is open
// and released when it closes. Nothing here may ever throw into a game: a sound that fails is just silent.

export type PlayOptions = {
  volume?: number; // 0 to 1, default 1
  restart?: boolean; // default true: a sound that is still playing starts again from 0
  loop?: boolean; // repeat until stopSound() (background music). Default false
  resume?: boolean; // carry on from where stopSound() left it instead of starting from 0 (music)
};

const players = new Map<string, AudioPlayer>();
let modeSet = false;
let enabled = true;

const keyOf = (game: SoundGame, name: string) => `${game}/${name}`;

function ensureMode() {
  if (modeSet) return;
  modeSet = true;
  // playsInSilentMode: still audible when an iPhone's ring switch is on silent.
  setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
}

function playerFor<G extends SoundGame>(game: G, name: SoundName<G>): AudioPlayer | null {
  const key = keyOf(game, name);
  let p = players.get(key);
  if (p) return p;
  const source = (SOUNDS[game] as Record<string, number>)[name];
  if (source === undefined) return null;
  ensureMode();
  p = createAudioPlayer(source);
  players.set(key, p);
  return p;
}

// Global switch (for a future "Sound" toggle in Settings). Turning it off also stops what is playing.
export function setSoundsEnabled(on: boolean) {
  enabled = on;
  if (!on) players.forEach((p) => safe(() => p.pause()));
}
export const soundsEnabled = () => enabled;

export function playSound<G extends SoundGame>(game: G, name: SoundName<G>, opts: PlayOptions = {}) {
  if (!enabled) return;
  try {
    const p = playerFor(game, name);
    if (!p) return;
    p.volume = Math.max(0, Math.min(1, opts.volume ?? 1));
    p.loop = opts.loop === true;
    if (!opts.resume && (opts.restart !== false || !p.playing)) p.seekTo(0);
    p.play();
  } catch {
    // a sound that cannot play is never a problem for the game
  }
}

// Stop a sound that is playing (a loop, or a long sound). It stays where it was, so play(..., { resume: true })
// carries on from there.
export function stopSound<G extends SoundGame>(game: G, name: SoundName<G>) {
  const p = players.get(keyOf(game, name));
  if (p) safe(() => p.pause());
}

// Load every sound of a game before it is needed, so the first play (a gunshot!) has no delay.
export function preloadSounds(game: SoundGame) {
  for (const name of Object.keys(SOUNDS[game])) safe(() => playerFor(game, name as never));
}

// Free the players of a game when its screen closes.
export function releaseSounds(game: SoundGame) {
  for (const key of [...players.keys()]) {
    if (!key.startsWith(`${game}/`)) continue;
    safe(() => players.get(key)?.release());
    players.delete(key);
  }
}

function safe(fn: () => void) {
  try {
    fn();
  } catch {
    // already gone
  }
}
