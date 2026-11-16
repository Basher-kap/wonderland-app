// Pure game rules: no Firebase, no React. Everything takes a state and returns
// a new state, so it can be tested on its own (see app/test/engine.test.cjs).
// The app runs these rules on the host's phone and saves the result to Firestore.

import { DEFAULT_DIFFICULTY, DIFFICULTY_MULTIPLIER, GAMES, difficultyOf } from '../data/games';
import type { Difficulty } from '../data/games';
import type { Domain } from '../theme';

export const START_LIVES = 10;
export const MAX_PLAYERS = 8;

// Personal ranking points, kept per domain on each player's own profile. They have
// nothing to do with lives or tickets. A round WON adds WIN_POINTS in that game's
// domain, a round LOST takes away LOSS_POINTS (a draw changes nothing). Both are
// multiplied by the difficulty of that one game (x2 easy, x3 normal, x5 hard, see
// DIFFICULTY_MULTIPLIER in data/games.ts). A domain's points never go below 0.
// IMPORTANT: backend/firestore.rules repeats the base numbers (10 and 5) and the largest
// multiplier (5) as a sanity limit, so change them in both places.
export const WIN_POINTS = 10;
export const LOSS_POINTS = 5;
// Some games give the round's winner extra points on top (Wordle: by attempts used). The bonus is
// NOT multiplied by the difficulty. MAX_BONUS is the biggest one allowed; backend/firestore.rules
// repeats it (a won round can be worth at most 10 x 5 + 10 = 60 points).
export const MAX_BONUS = 10;

export type DomainCount = Record<Domain, number>;
export const zeroCounts = (): DomainCount => ({ logic: 0, experience: 0, chance: 0 });

export type PlayerState = {
  username: string;
  lives: number;
  joinedAt: number;
  wins: DomainCount; // rounds won in this match, per domain
  losses: DomainCount; // rounds lost in this match, per domain (a draw is neither)
  plays: DomainCount; // rounds played in this match, per domain
  // Ranking points earned in this match per domain: signed, already multiplied by each round's
  // difficulty. Added to the player's profile points when the match is settled.
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
  // false when the round is drawn; the host sets it to true once EVERY player has finished
  // reading the intro, and that is the moment all the boards start together.
  go?: boolean;
  // Set when the match was ended because this player forfeited it (the round counts for nobody).
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

// Losers of the round lose 1 life, the winner keeps theirs. A null winner is a
// draw: nobody loses a life. Everyone's round tally goes up. When someone
// reaches 0 lives the match ends; the winner is the player with the most lives
// left (ties: whoever joined first).
export function applyRoundResult(state: MatchState, winnerId: string | null, bonus: number = 0): RoundOutcome {
  if (state.status !== 'playing') throw new RuleError('The lobby is not in play.');
  if (!Number.isInteger(bonus) || bonus < 0 || bonus > MAX_BONUS) throw new RuleError('That bonus is not allowed.');
  if (winnerId === null && bonus !== 0) throw new RuleError('A draw has no bonus.');
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
          (id === winnerId ? WIN_POINTS * multiplier + bonus : loses ? -LOSS_POINTS * multiplier : 0),
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

// A player forfeits the WHOLE match: they are out (0 lives), so the match ends for everybody,
// exactly like when someone runs out of lives. The winner is whoever has the most lives left
// (ties: whoever joined first). The unfinished round counts for nobody: no lives, no wins, no
// losses, no points. The quitter's ticket goes down and the winner's goes up when the match is
// settled, like any other match.
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
