import { DEFAULT_DIFFICULTY, DIFFICULTY_MULTIPLIER, GAMES, difficultyOf } from '../data/games';
import type { Difficulty } from '../data/games';
import type { Domain } from '../theme/base';

export const START_LIVES = 10;
export const MAX_PLAYERS = 8;
export const WIN_POINTS = 10;
export const LOSS_POINTS = 5;
export const MAX_EXTRA = 35;

export type DomainCount = Record<Domain, number>;
export const zeroCounts = (): DomainCount => ({ logic: 0, experience: 0, chance: 0 });

export type PlayerState = {
  username: string;
  lives: number;
  joinedAt: number;
  wins: DomainCount; // rounds won in this match, per domain
  losses: DomainCount; // rounds lost in this match, per domain (a draw is neither)
  plays: DomainCount; // rounds played in this match, per domain
  pts: DomainCount;
};

export const newPlayer = (username: string, joinedAt: number = Date.now()): PlayerState => ({
  username,
  lives: START_LIVES,
  joinedAt,
  wins: zeroCounts(),
  losses: zeroCounts(),
  plays: zeroCounts(),
  pts: zeroCounts(),
});

export type RoundState = {
  no: number;
  gameId: string;
  difficulty?: Difficulty; // missing on rounds saved before difficulty existed
  go?: boolean;
  quitBy?: string;
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

export class RuleError extends Error {}

export function shuffle<T>(items: readonly T[], rand: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const BEAUTY_CONTEST_ID = 'beauty-contest';
export const PLEASURE_ID = 'pleasure';
export const BEAUTY_ONLY_FROM = 5;
const BIG_LOBBY_GAMES = [BEAUTY_CONTEST_ID, PLEASURE_ID];
const gamePool = (players: number) =>
  GAMES.filter((g) => {
    if (BIG_LOBBY_GAMES.includes(g.id) && players < BEAUTY_ONLY_FROM) return false; // only with 5+ players
    return (g.minPlayers ?? 1) <= players; // Old Maid needs 4+
  }).map((g) => g.id);
  
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
    players[id] = {
      ...state.players[id],
      lives: START_LIVES,
      wins: zeroCounts(),
      losses: zeroCounts(),
      plays: zeroCounts(),
      pts: zeroCounts(),
    };
  }

  return drawNextGame(
    {
      ...state,
      status: 'playing',
      matchId,
      leg: 1,
      gameQueue: shuffle(gamePool(Object.keys(state.players).length), rand),
      players,
      currentRound: null,
      winnerId: null,
    },
    rand
  );
}

export function drawNextGame(state: MatchState, rand: () => number = Math.random): MatchState {
  if (state.status !== 'playing') throw new RuleError('The lobby is not in play.');
  if (state.currentRound?.status === 'active') throw new RuleError('A round is already active.');

  let leg = state.leg;
  let queue = [...state.gameQueue];
  if (queue.length === 0) {
    leg += 1;
    queue = shuffle(gamePool(Object.keys(state.players).length), rand);
  }
  const [gameId, ...rest] = queue;
  const game = GAMES.find((g) => g.id === gameId);

  return {
    ...state,
    leg,
    gameQueue: rest,
    currentRound: {
      no: (state.currentRound?.no ?? 0) + 1,
      gameId,
      difficulty: game ? difficultyOf(game) : DEFAULT_DIFFICULTY,
      go: false,
      status: 'active',
      winnerId: null,
    },
  };
}

export type RoundOutcome = {
  state: MatchState;
  finished: boolean;
  eliminated: string[]; // players who reached 0 lives
  matchWinnerId: string | null; // player with the most lives left
};
export function applyRoundResult(
  state: MatchState,
  winnerId: string | null,
  extras: Record<string, number> = {}
): RoundOutcome {
  if (state.status !== 'playing') throw new RuleError('The lobby is not in play.');
  for (const [id, extra] of Object.entries(extras)) {
    if (!state.players[id]) throw new RuleError('That player is not in this lobby.');
    if (!Number.isInteger(extra) || extra < 0 || extra > MAX_EXTRA) throw new RuleError('That bonus is not allowed.');
  }
  if (!state.currentRound || state.currentRound.status !== 'active') {
    throw new RuleError('There is no active round.');
  }
  if (winnerId !== null && !state.players[winnerId]) {
    throw new RuleError('That player is not in this lobby.');
  }
  const game = GAMES.find((g) => g.id === state.currentRound?.gameId);
  if (!game) throw new Error('Unknown game in current round.');
  const domain = game.domain;
  const difficulty = state.currentRound.difficulty ?? difficultyOf(game);
  const multiplier = DIFFICULTY_MULTIPLIER[difficulty];

  const players: Record<string, PlayerState> = {};
  for (const [id, p] of Object.entries(state.players)) {
    const loses = winnerId !== null && id !== winnerId;
    players[id] = {
      ...p,
      lives: loses ? Math.max(0, p.lives - 1) : p.lives,
      wins: { ...p.wins, [domain]: p.wins[domain] + (id === winnerId ? 1 : 0) },
      losses: { ...p.losses, [domain]: p.losses[domain] + (loses ? 1 : 0) },
      plays: { ...p.plays, [domain]: p.plays[domain] + 1 },
      pts: {
        ...zeroCounts(),
        ...p.pts,
        [domain]:
          (p.pts?.[domain] ?? 0) +
          (id === winnerId ? WIN_POINTS * multiplier : loses ? -LOSS_POINTS * multiplier : 0) +
          (extras[id] ?? 0),
      },
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

export function forfeitMatch(state: MatchState, uid: string): MatchState {
  if (state.status !== 'playing') throw new RuleError('The lobby is not in play.');
  if (!state.players[uid]) throw new RuleError('That player is not in this lobby.');

  const players: Record<string, PlayerState> = {
    ...state.players,
    [uid]: { ...state.players[uid], lives: 0 },
  };
  const alive = Object.entries(players)
    .filter(([, p]) => p.lives > 0)
    .sort(([, a], [, b]) => b.lives - a.lives || a.joinedAt - b.joinedAt);

  return {
    ...state,
    status: 'finished',
    winnerId: alive.length ? alive[0][0] : null,
    players,
    currentRound: state.currentRound
      ? { ...state.currentRound, status: 'done', winnerId: null, quitBy: uid }
      : state.currentRound,
  };
}

export type Settlement = {
  ticketDelta: number; // -1 eliminated, +1 match winner, 0 otherwise
  wins: DomainCount;
  plays: DomainCount;
  totalWins: number;
  pointsDelta: DomainCount; // per domain: the match's difficulty-multiplied win/loss points (can be negative)
};

export function settlementFor(state: MatchState, uid: string): Settlement {
  if (state.status !== 'finished') throw new RuleError('The match is not finished.');
  const me = state.players[uid];
  if (!me) throw new RuleError('You are not in this match.');
  return {
    ticketDelta: me.lives === 0 ? -1 : state.winnerId === uid ? 1 : 0,
    wins: me.wins,
    plays: me.plays,
    totalWins: me.wins.logic + me.wins.experience + me.wins.chance,
    pointsDelta: { ...zeroCounts(), ...me.pts },
  };
}

export const applyTickets = (tickets: number, delta: number) => Math.max(0, tickets + delta);

// Adds a match's points to a profile's points. Each domain stops at 0.
export function applyPoints(current: DomainCount, delta: DomainCount): DomainCount {
  return {
    logic: Math.max(0, current.logic + delta.logic),
    experience: Math.max(0, current.experience + delta.experience),
    chance: Math.max(0, current.chance + delta.chance),
  };
}
