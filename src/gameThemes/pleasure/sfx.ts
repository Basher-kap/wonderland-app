import { playSound } from '../../audio';
import type { SfxName } from './theme';

// The show's sound effects. The files are in assets/sounds/pleasure (made by scripts/make-pleasure-sfx.cjs; swap
// any of them for your own recording under the same name). They play on phones and on the web alike, and the
// game loads and frees them with useGameSounds('pleasure') (see PleasureGame).
//   pop = a question appears        quiz = PIKON, the answers open   drum = the roulette's drum roll (4.3 s)
//   fanfare = DON, the roulette stops   pinpon = ding-dong, right    bubu = the buzzer, wrong      win = JAJAAN
export function playSfx(name: SfxName) {
  try {
    playSound('pleasure', name);
  } catch {
    /* a sound that cannot play must never break the game */
  }
}
