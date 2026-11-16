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
  pickWinner: (results: ResultRow[]) => string | null;
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
  summary?: (seed: string) => string | null;
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
};
