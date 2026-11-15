import type React from 'react';
import { pickWinner as pickFastestFinisher } from '../game/schulte';
import { SchulteGame } from './SchulteGame';
import type { GameProps } from './types';

// One entry per finished mini-game. GameScreen looks the current game up here; a game with
// no entry still uses the temporary "host picks the winner" buttons.
export type ResultRow = { uid: string; finished: boolean; totalMs: number };

export type GameModule = {
  Component: React.ComponentType<GameProps>;
  // Decide the round winner from everybody's results. null = nobody wins (a draw).
  pickWinner: (results: ResultRow[]) => string | null;
  // How a result is shown in the round summary.
  describe: (result: ResultRow) => string;
};

export const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

export const GAME_MODULES: Record<string, GameModule> = {
  'schulte-table': {
    Component: SchulteGame,
    pickWinner: pickFastestFinisher,
    describe: (r) => (r.finished ? formatSeconds(r.totalMs) : 'did not finish'),
  },
};
