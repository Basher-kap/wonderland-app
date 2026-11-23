import type React from 'react';
import { pickWinner as pickFastestFinisher } from '../game/schulte';
import {
  extraPoints as wordleExtraPoints,
  LEVEL_COUNT,
  LEVEL_NAMES,
  MAX_EXTRA as WORDLE_MAX_POINTS,
  pickAnswer,
  pickWinner as pickMostPoints,
  solvedCount,
} from '../game/wordle';
import { describeScore as describeCalcScore, pickWinner as pickLastStanding } from '../game/humanCalculator';
import { pickEntry as pickHangmanEntry, pickWinner as pickFastestSolver } from '../game/hangman';
import { describeResult as describeInversion, pickWinner as pickLastOneIn } from '../game/inversion';
import { describeScore as describeJankenScore, pickWinner as pickMostJankenPoints } from '../game/janken';
import { FortuneGame } from './FortuneGame';
import { HangmanGame } from './HangmanGame';
import { MagicalBananaGame } from './MagicalBananaGame';
import { HumanCalculatorGame } from './HumanCalculatorGame';
import { InversionGame } from './InversionGame';
import { JankenNegotiationGame } from './JankenNegotiationGame';
import { SchulteGame } from './SchulteGame';
import { WordleGame } from './WordleGame';
import { XibalbaGame } from './XibalbaGame';
import { BattleshipsGame } from './BattleshipsGame';
import { KarutaGame } from './KarutaGame';
import { LightBulbGame } from './LightBulbGame';
import { ColorTerritoryGame } from './ColorTerritoryGame';
import { MemoryCardGame } from './MemoryCardGame';
import { BeautyContestGame } from './BeautyContestGame';
import { pickWinner as pickSugorokuWinner } from '../game/futureSugoroku';
import { FutureSugorokuGame } from './FutureSugorokuGame';

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
  // Like endsOnFirstFinish, but the round ends as soon as ONE submitted result satisfies this test
  // (Wordle: a player who guessed ALL the words; just finishing the last level is not enough).
  endsOnResult?: (result: ResultRow) => boolean;
  // The game takes the whole screen (no title, no round box around it): Karuta pins the player's own
  // rack to the bottom of the screen. GameScreen then renders it outside the ScrollView.
  fullScreen?: boolean;
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
    // The round ends for everybody as soon as one player has cleared all 5 levels.
    endsOnFirstFinish: true,
    fullScreen: true, // the whole screen, no scrolling: the tray must always fit in the frame
  },
  wordle: {
    Component: WordleGame,
    pickWinner: pickMostPoints,
    describe: (r) => (r.finished ? `guessed ${solvedCount(r.score ?? 0)} of ${LEVEL_COUNT} words` : 'did not finish'),
    multiStage: true,
    // The game ends as soon as the first player guesses ALL the words (every level solved = the
    // maximum points).
    endsOnResult: (r) => r.finished && (r.score ?? 0) >= WORDLE_MAX_POINTS,
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
    fullScreen: true, // the whole screen, no scrolling: the keys must never leave the frame
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
    fullScreen: true, // the whole screen, no scrolling: the controller buttons must stay in the frame
  },
  'magical-banana': {
    Component: MagicalBananaGame,
    // Only the last player standing reports finished: true.
    pickWinner: pickFastestFinisher,
    describe: (r) => (r.finished ? 'last player standing' : 'out'),
    // multiStage: the board stays for players who are out, so they can watch the game go on.
    multiStage: true,
    needsRoom: true,
    endsOnFirstFinish: true,
  },
  fortune: {
    Component: FortuneGame,
    // Only the last player alive reports finished: true (nobody alive = nobody finished = a draw).
    pickWinner: pickFastestFinisher,
    describe: (r) => (r.finished ? 'last player alive' : 'out'),
    // Like Magical Banana: the board stays for players who are out, so they can watch the game go on.
    multiStage: true,
    needsRoom: true,
    endsOnFirstFinish: true,
  },
  'janken-negotiation': {
    Component: JankenNegotiationGame,
    // Everybody plays until their pair agrees to end the match (or the 10-round cap), so there is
    // no early end. Every player reports finished: true with a score of 500 + net points; the most
    // points wins and a tie for the top is a draw.
    pickWinner: pickMostJankenPoints,
    describe: (r) => (r.finished ? describeJankenScore(r.score ?? 0) : 'did not finish'),
    // multiStage: gives the game the lobby (`room`) for the shared negotiation notes, and keeps the
    // board on screen after a player's last round so they can watch the others finish.
    multiStage: true,
  },
    battleships: {
    Component: BattleshipsGame,
    // Only the winner (the last player with a battleship, or the best when the bullets run out)
    // reports finished: true; a draw = nobody finished.
    pickWinner: pickFastestFinisher,
    describe: (r) => (r.finished ? 'last battleships standing' : 'did not win'),
    // Like Fortune: the board stays for players who are out, so they can watch the game go on.
    multiStage: true,
    needsRoom: true,
    endsOnFirstFinish: true,
    fullScreen: true, // the whole screen, no scrolling: the sea and the buttons must stay in the frame
  },
  'traps-of-xibalba': {
    Component: XibalbaGame,
    // Only the last player left reports finished: true (nobody left = nobody finished = a draw).
    pickWinner: pickFastestFinisher,
    describe: (r) => (r.finished ? 'last player standing' : 'fell'),
    // Like Fortune: the board stays for players who have fallen, so they can watch the game go on.
    multiStage: true,
    needsRoom: true,
    endsOnFirstFinish: true,
  },
  karuta: {
    Component: KarutaGame,
    // Only the first player to empty their rack reports finished: true (a draw at the safety cap = nobody).
    pickWinner: pickFastestFinisher,
    describe: (r) => (r.finished ? 'emptied their rack first' : 'did not clear'),
    // Like Battleships: the board stays for players who are out, so they can watch the game go on.
    multiStage: true,
    needsRoom: true,
    endsOnFirstFinish: true,
    fullScreen: true,
  },
  'light-bulb': {
    Component: LightBulbGame,
    // Only a player who switched the light on reports finished: true; the fastest one wins.
    pickWinner: pickFastestFinisher,
    describe: (r) => (r.finished ? `switched on the light in ${formatSeconds(r.totalMs)}` : 'was blown up'),
    endsOnFirstFinish: true,
    fullScreen: true, // the whole screen, no scrolling: the fuse box and the terminals must stay in the frame
  },
    'memory-card': {
    Component: MemoryCardGame,
    // Only a player who turned over every pair reports finished: true; the fastest one wins.
    pickWinner: pickFastestFinisher,
    describe: (r) => (r.finished ? `matched every pair in ${formatSeconds(r.totalMs)}` : 'did not clear'),
    endsOnFirstFinish: true,
    fullScreen: true, // the whole screen, no scrolling: the cards must stay in the frame
  },
  'color-territory': {
    Component: ColorTerritoryGame,
    // Only the player who owns the most circles when the time is up reports finished: true (a tie
    // for the top = nobody finished = a draw).
    pickWinner: pickFastestFinisher,
    describe: (r) => (r.finished ? 'owned the most circles' : 'did not win'),
    // Like Xibalba: the board stays on screen until the host's clock ends the game for everybody.
    multiStage: true,
    needsRoom: true,
    endsOnFirstFinish: true,
    fullScreen: true, // the whole screen, no scrolling: the glade must stay in the frame
  },
    'beauty-contest': {
    Component: BeautyContestGame,
    // Only the last player left reports finished: true (nobody left, or a tie for the most points at the round cap = a draw).
    pickWinner: pickFastestFinisher,
    describe: (r) => (r.finished ? 'last player standing' : 'game over'),
    // Like Fortune: the board stays for players who are out, so they can watch the game go on.
    multiStage: true,
    needsRoom: true,
    endsOnFirstFinish: true,
  },
  'future-sugoroku': {
    Component: FutureSugorokuGame,
    // Only players who escaped report finished: true. One escapee wins; a shared victory or nobody = a draw.
    pickWinner: pickSugorokuWinner,
    describe: (r) => (r.finished ? 'escaped through the portal' : 'did not escape'),
    // Like Fortune: the board stays for players who are out, so they can watch the game go on.
    // No endsOnFirstFinish on purpose: the round ends once everybody has reported, so players who
    // escape in the same turn are all counted before the winner is picked.
    multiStage: true,
    needsRoom: true,
  },
};