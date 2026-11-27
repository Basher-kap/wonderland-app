import { useCallback, useEffect } from 'react';
import { playSound, preloadSounds, releaseSounds, stopSound } from './player';
import type { PlayOptions } from './player';
import type { SoundGame, SoundName } from './sounds';

// For a game component: loads its sounds when the game opens, frees them when it closes, and gives back a
// `play` that only accepts this game's own sound names.
//
//   const { play } = useGameSounds('russianRoulette');
//   play('bang', { volume: 0.9 });
//   play('music', { loop: true, resume: true }); ... stop('music'); // background music
export function useGameSounds<G extends SoundGame>(game: G) {
  useEffect(() => {
    preloadSounds(game);
    return () => releaseSounds(game);
  }, [game]);

  const play = useCallback((name: SoundName<G>, opts?: PlayOptions) => playSound(game, name, opts), [game]);
  const stop = useCallback((name: SoundName<G>) => stopSound(game, name), [game]);
  return { play, stop };
}
