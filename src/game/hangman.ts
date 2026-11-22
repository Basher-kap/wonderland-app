// Hangman: pure logic, no React, no Firebase.
// Everybody in the round guesses the SAME hidden word (picked from the seed). Each player plays
// on their own: reveal the whole word before the drawing is completed to win. The fastest
// player who revealed the word wins the round.
import { HANGMAN_WORDS, HangmanEntry } from '../data/hangmanWords';
import { makeRng } from './schulte';

// Parts of the drawing: head, body, left arm, right arm, left leg, right leg. The 6th wrong
// guess completes the drawing and the player is hanged (loses).
export const MAX_WRONG = 6;

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// The list may name the same thing in two categories (e.g. "Thor"): keep the first one only,
// so nothing is drawn twice as often.
export const WORD_POOL: HangmanEntry[] = (() => {
  const seen = new Set<string>();
  return HANGMAN_WORDS.filter((e) => {
    const key = e.text.toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
})();

export function pickEntry(seed: string): HangmanEntry {
  const rnd = makeRng(`${seed}:hangman`);
  return WORD_POOL[Math.floor(rnd() * WORD_POOL.length)];
}

export const isLetter = (ch: string) => ch >= 'A' && ch <= 'Z';

// The word as typed in the list, uppercased ("Los Angeles Lakers" -> "LOS ANGELES LAKERS").
export const normalize = (text: string) => text.toUpperCase();

export type HangmanState = {
  word: string; // uppercase, letters and spaces
  guessed: string[]; // letters picked so far, in order
};

export const newState = (word: string): HangmanState => ({ word: normalize(word), guessed: [] });

export const wrongLetters = (s: HangmanState) => s.guessed.filter((l) => !s.word.includes(l));
export const wrongCount = (s: HangmanState) => wrongLetters(s).length;

// One entry per character: the letter if revealed (or a space), otherwise null (a blank).
export const display = (s: HangmanState): (string | null)[] =>
  s.word.split('').map((ch) => (!isLetter(ch) || s.guessed.includes(ch) ? ch : null));

export const isSolved = (s: HangmanState) => display(s).every((c) => c !== null);
export const isHanged = (s: HangmanState) => !isSolved(s) && wrongCount(s) >= MAX_WRONG;
export const isOver = (s: HangmanState) => isSolved(s) || isHanged(s);

// Picking a letter twice, or after the game is over, changes nothing.
export function guess(s: HangmanState, letter: string): HangmanState {
  const l = letter.toUpperCase();
  if (isOver(s) || !LETTERS.includes(l) || s.guessed.includes(l)) return s;
  return { ...s, guessed: [...s.guessed, l] };
}

// ---- Clues -------------------------------------------------------------------------------
// A clue reveals one letter of the word to EVERY player in the lobby. Each player may ask for
// MAX_CLUES_PER_PLAYER clues, and the lobby as a whole for at most half of the word's different
// letters, so the clues never give the word away.
export const MAX_CLUES_PER_PLAYER = 1; // one clue each (was 2)

export const uniqueLetters = (word: string): string[] =>
  Array.from(new Set(normalize(word).split('').filter(isLetter)));

export const maxCluesTotal = (word: string) => Math.floor(uniqueLetters(word).length / 2);

// Add letters (clue letters) to what the player has already picked. They are letters of the
// word, so they never count as wrong.
export function withClues(s: HangmanState, letters: string[]): HangmanState {
  const extra = letters.filter((l) => !s.guessed.includes(l));
  return extra.length === 0 ? s : { ...s, guessed: [...s.guessed, ...extra] };
}

// The letter a new clue reveals: a random letter of the word the asking player has NOT revealed
// yet (the same seed gives the same letter). null = no clue possible: fewer than 2 letters are
// still hidden for this player (a clue must never solve the word for the one who asks).
export function pickClueLetter(s: HangmanState, seed: string, clueNo: number): string | null {
  const hidden = uniqueLetters(s.word).filter((l) => !s.guessed.includes(l));
  if (hidden.length < 2) return null;
  const rnd = makeRng(`${seed}:clue:${clueNo}`);
  return hidden[Math.floor(rnd() * hidden.length)];
}

// Winner: among the players who revealed the word, the fastest. Players who were hanged (or
// forfeited) lose. Nobody solved it, or an exact tie on time = no winner (a draw).
export type Result = { uid: string; finished: boolean; totalMs: number };

export function pickWinner(results: Result[]): string | null {
  const done = results.filter((r) => r.finished).sort((a, b) => a.totalMs - b.totalMs);
  if (done.length === 0) return null;
  if (done.length > 1 && done[0].totalMs === done[1].totalMs) return null;
  return done[0].uid;
}
