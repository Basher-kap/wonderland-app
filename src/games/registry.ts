import type React from 'react';
import { pickWinner as pickFastestFinisher } from '../game/schulte';
import {
  extraPoints as wordleExtraPoints,
  LEVEL_COUNT,
  LEVEL_NAMES,
  pickAnswer,
  pickWinner as pickMostPoints,
  solvedCount,
} from '../game/wordle';
import { describeScore as describeCalcScore, pickWinner as pickLastStanding } from '../game/humanCalculator';
import { pickEntry as pickHangmanEntry, pickWinner as pickFastestSolver } from '../game/hangman';
import { describeResult as describeInversion, pickWinner as pickLastOneIn } from '../game/inversion';
import { HangmanGame } from './HangmanGame';
import { HumanCalculatorGame } from './HumanCalculatorGame';
import { InversionGame } from './InversionGame';
import { SchulteGame } from './SchulteGame';
import { WordleGame } from './WordleGame';
import type { GameProps } from './types';

// One entry per finished mini-game. GameScreen looks the current game up here; a game with
// no entry still uses the temporary "host picks the winner" buttons.
export type ResultRow = {
  uid: string;
  finished: boolean;
  totalMs: number;
  forfeited?: boolean;
  score?: number;
};

export type GameModule = {
  Component: React.ComponentType<GameProps>;
  // Decide the round winner from everybody's results. null = nobody wins (a draw).
  // `playerIds` = everybody in the lobby, so a game can tell who has not handed in a result yet.
  pickWinner: (results: ResultRow[], playerIds?: string[]) => string | null;
  // How a result is shown in the round summary.
  describe: (result: ResultRow) => string;
  // The game has several levels and stays on screen between them, with the other players'
  // progress passed in as `room` (Wordle). The player's board is NOT closed when they finish.
  multiStage?: boolean;
  // Extra points a player earns from the game on top of the win/loss points (0 if none), whether
  // they win or lose. Not multiplied by the difficulty. Not shown to the players.
  extraPoints?: (result: ResultRow) => number;
  // A line shown to EVERYONE once the round is over (Wordle: the hidden words).
  // `seed` is the same seed the game was given.
  // `iWon` = I finished the game successfully (Hangman: I revealed the word), so the text can
  // speak to me directly.
  summary?: (seed: string, me: { iWon: boolean }) => string | null;
  // The game wants `room` (the lobby: other players, shared docs) even though it is a single
  // board. Hangman uses it to share clues.
  needsRoom?: boolean;
  // The round ends for EVERYBODY as soon as one player finishes successfully (Hangman: the
  // first to reveal the word). The host then picks the winner from the results that are in.
  endsOnFirstFinish?: boolean;
  // The round also ends when all but ONE player have handed in a result without finishing
  // (eliminated or forfeited): the one left wins (Inversion).
  endsWhenOneLeft?: boolean;
};

export const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

export const GAME_MODULES: Record<string, GameModule> = {
  'schulte-table': {
    Component: SchulteGame,
    pickWinner: pickFastestFinisher,
    describe: (r) => (r.finished ? formatSeconds(r.totalMs) : 'did not finish'),
  },
  wordle: {
    Component: WordleGame,
    pickWinner: pickMostPoints,
    describe: (r) => (r.finished ? `guessed ${solvedCount(r.score ?? 0)} of ${LEVEL_COUNT} words` : 'did not finish'),
    multiStage: true,
    extraPoints: wordleExtraPoints,
    summary: (seed) =>
      'The words were:\n' +
      Array.from({ length: LEVEL_COUNT }, (_, i) => `${LEVEL_NAMES[i]}: ${pickAnswer(seed, i + 1).toUpperCase()}`).join('\n'),
  },
  'human-calculator': {
    Component: HumanCalculatorGame,
    pickWinner: pickLastStanding,
    describe: (r) => (r.finished ? describeCalcScore(r.score ?? 0) : 'did not finish'),
    multiStage: true,
  },
  hangman: {
    Component: HangmanGame,
    pickWinner: pickFastestSolver,
    describe: (r) => (r.finished ? `revealed the word in ${formatSeconds(r.totalMs)}` : 'was hanged'),
    needsRoom: true,
    endsOnFirstFinish: true,
    summary: (seed, me) => {
      const word = pickHangmanEntry(seed).text.toUpperCase();
      return me.iWon ? `YOU GOT THE WORD: ${word}` : `The word was: ${word}`;
    },
  },
  inversion: {
    Component: InversionGame,
    pickWinner: pickLastOneIn,
    describe: describeInversion,
    endsOnFirstFinish: true,
    endsWhenOneLeft: true,
  },
};
