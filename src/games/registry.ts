import type React from 'react';
import { pickWinner as pickFastestFinisher } from '../game/schulte';
import {
  bonusFor as wordleBonus,
  pickAnswer,
  pickWinner as pickFirstSolver,
  roundIsOver as wordleRoundIsOver,
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
  attempts?: number;
};

export type GameModule = {
  Component: React.ComponentType<GameProps>;
  // Decide the round winner from everybody's results. null = nobody wins (a draw).
  pickWinner: (results: ResultRow[]) => string | null;
  // How a result is shown in the round summary.
  describe: (result: ResultRow) => string;
  // When is the round over? Default: when every player has handed in a result. Games where the
  // first solver ends the round for everybody (Wordle) say so here; the host then ends the round
  // with the results it has, and the other players' boards close.
  roundOver?: (results: ResultRow[], playerCount: number) => boolean;
  // Extra points for the winner on top of the normal win points (not multiplied by difficulty).
  // Not shown to the players.
  bonusFor?: (winner: ResultRow) => number;
  // A line shown in the round summary once the round is over (Wordle: the hidden word).
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
    pickWinner: pickFirstSolver,
    describe: (r) =>
      r.finished
        ? `solved in ${r.attempts ?? '?'} ${r.attempts === 1 ? 'attempt' : 'attempts'}`
        : 'did not solve it',
    roundOver: wordleRoundIsOver,
    bonusFor: (r) => (r.finished ? wordleBonus(r.attempts ?? 0) : 0),
    summary: (seed) => `The word was ${pickAnswer(seed).toUpperCase()}.`,
  },
};
