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

export function pickEntry(seed: string): HangmanEntry {
  const rnd = makeRng(`${seed}:hangman`);
  return HANGMAN_WORDS[Math.floor(rnd() * HANGMAN_WORDS.length)];
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

// Winner: among the players who revealed the word, the fastest. Players who were hanged (or
// forfeited) lose. Nobody solved it, or an exact tie on time = no winner (a draw).
export type Result = { uid: string; finished: boolean; totalMs: number };

export function pickWinner(results: Result[]): string | null {
  const done = results.filter((r) => r.finished).sort((a, b) => a.totalMs - b.totalMs);
  if (done.length === 0) return null;
  if (done.length > 1 && done[0].totalMs === done[1].totalMs) return null;
  return done[0].uid;
}
