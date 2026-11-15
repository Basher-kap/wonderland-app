// Pure game rules: no Firebase, no React. Everything takes a state and returns
// a new state, so it can be tested on its own (see app/test/engine.test.cjs).
// The app runs these rules on the host's phone and saves the result to Firestore.

import { GAMES } from '../data/games';
import type { Domain } from '../theme';

export const START_LIVES = 10;
export const MAX_PLAYERS = 8;

export type DomainCount = Record<Domain, number>;
export const zeroCounts = (): DomainCount => ({ logic: 0, experience: 0, chance: 0 });

export type PlayerState = {
  username: string;
  lives: number;
  joinedAt: number;
  wins: DomainCount; // rounds won in this match, per domain
  plays: DomainCount; // rounds played in this match, per domain
};

export const newPlayer = (username: string, joinedAt: number = Date.now()): PlayerState => ({
  username,
  lives: START_LIVES,
  joinedAt,
  wins: zeroCounts(),
  plays: zeroCounts(),
});

export type RoundState = {
  no: number;
  gameId: string;
  status: 'active' | 'done';
  winnerId: string | null;
};

export type MatchState = {
  status: 'waiting' | 'playing' | 'finished';
  matchId: string; // set when the match starts; makes "settle once" possible
  leg: number;
  gameQueue: string[];
  players: Record<string, PlayerState>;
  currentRound: RoundState | null;
  winnerId: string | null;
};

// An expected, user-facing problem (as opposed to a bug).
export class RuleError extends Error {}

export function shuffle<T>(items: readonly T[], rand: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const allGameIds = () => GAMES.map((g) => g.id);

// Host starts the match: everyone gets 10 lives and a clean tally, the first
// leg is shuffled, and the first game is drawn.
export function startMatch(
  state: MatchState,
  matchId: string,
  rand: () => number = Math.random
): MatchState {
  if (state.status !== 'waiting') throw new RuleError('The game already started.');
  const ids = Object.keys(state.players);
  if (ids.length < 2) throw new RuleError('You need at least 2 players to start.');

  const players: Record<string, PlayerState> = {};
  for (const id of ids) {
    players[id] = { ...state.players[id], lives: START_LIVES, wins: zeroCounts(), plays: zeroCounts() };
  }

  return drawNextGame(
    {
      ...state,
      status: 'playing',
      matchId,
      leg: 1,
      gameQueue: shuffle(allGameIds(), rand),
      players,
      currentRound: null,
      winnerId: null,
    },
    rand
  );
}

// Games are drawn at random without repeats until all of them were played
// (one leg). Then a new shuffled leg begins.
export function drawNextGame(state: MatchState, rand: () => number = Math.random): MatchState {
  if (state.status !== 'playing') throw new RuleError('The lobby is not in play.');
  if (state.currentRound?.status === 'active') throw new RuleError('A round is already active.');

  let leg = state.leg;
  let queue = [...state.gameQueue];
  if (queue.length === 0) {
    leg += 1;
    queue = shuffle(allGameIds(), rand);
  }
  const [gameId, ...rest] = queue;

  return {
    ...state,
    leg,
    gameQueue: rest,
    currentRound: { no: (state.currentRound?.no ?? 0) + 1, gameId, status: 'active', winnerId: null },
  };
}

export type RoundOutcome = {
  state: MatchState;
  finished: boolean;
  eliminated: string[]; // players who reached 0 lives
  matchWinnerId: string | null; // player with the most lives left
};

// Losers of the round lose 1 life, the winner keeps theirs. A null winner is a
// draw: nobody loses a life. Everyone's round tally goes up. When someone
// reaches 0 lives the match ends; the winner is the player with the most lives
// left (ties: whoever joined first).
export function applyRoundResult(state: MatchState, winnerId: string | null): RoundOutcome {
  if (state.status !== 'playing') throw new RuleError('The lobby is not in play.');
  if (!state.currentRound || state.currentRound.status !== 'active') {
    throw new RuleError('There is no active round.');
  }
  if (winnerId !== null && !state.players[winnerId]) {
    throw new RuleError('That player is not in this lobby.');
  }
  const domain = GAMES.find((g) => g.id === state.currentRound?.gameId)?.domain;
  if (!domain) throw new Error('Unknown game in current round.');

  const players: Record<string, PlayerState> = {};
  for (const [id, p] of Object.entries(state.players)) {
    const loses = winnerId !== null && id !== winnerId;
    players[id] = {
      ...p,
      lives: loses ? Math.max(0, p.lives - 1) : p.lives,
      wins: { ...p.wins, [domain]: p.wins[domain] + (id === winnerId ? 1 : 0) },
      plays: { ...p.plays, [domain]: p.plays[domain] + 1 },
    };
  }

  const eliminated = Object.keys(players).filter((id) => players[id].lives === 0);
  const finished = eliminated.length > 0;

  let matchWinnerId: string | null = null;
  if (finished) {
    const alive = Object.entries(players)
      .filter(([, p]) => p.lives > 0)
      .sort(([, a], [, b]) => b.lives - a.lives || a.joinedAt - b.joinedAt);
    matchWinnerId = alive.length ? alive[0][0] : null;
  }

  return {
    state: {
      ...state,
      status: finished ? 'finished' : 'playing',
      winnerId: matchWinnerId,
      players,
      currentRound: { ...state.currentRound, status: 'done', winnerId },
    },
    finished,
    eliminated,
    matchWinnerId,
  };
}

export type Settlement = {
  ticketDelta: number; // -1 eliminated, +1 match winner, 0 otherwise
  wins: DomainCount;
  plays: DomainCount;
  totalWins: number;
};

// What a finished match changes on ONE player's profile. Each phone applies its
// own settlement once (the Firestore rules check it against the lobby).
export function settlementFor(state: MatchState, uid: string): Settlement {
  if (state.status !== 'finished') throw new RuleError('The match is not finished.');
  const me = state.players[uid];
  if (!me) throw new RuleError('You are not in this match.');
  return {
    ticketDelta: me.lives === 0 ? -1 : state.winnerId === uid ? 1 : 0,
    wins: me.wins,
    plays: me.plays,
    totalWins: me.wins.logic + me.wins.experience + me.wins.chance,
  };
}

export const applyTickets = (tickets: number, delta: number) => Math.max(0, tickets + delta);
