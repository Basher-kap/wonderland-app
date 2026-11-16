import { Domain } from '../theme';

export type Difficulty = 'easy' | 'normal' | 'hard';

// Score multiplier of a game, applied to BOTH the win points and the loss points of that
// one game (not to the whole lobby match). IMPORTANT: nothing in backend/firestore.rules
// repeats these numbers; the rules only check the result is within x5 of the base points.
export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = { easy: 2, normal: 3, hard: 5 };

export type Game = {
  id: string;
  name: string;
  domain: Domain;
  description: string;
  // Shown in the round intro dialogs. Anything missing shows "To be announced.".
  japaneseName?: string;
  rules?: string[];
  clearConditions?: string[];
  prohibitions?: string[]; // optional extra rule: "Prohibition: ..."
  // Not decided for most games yet, so they use DEFAULT_DIFFICULTY until you set one here.
  difficulty?: Difficulty;
};

export const DEFAULT_DIFFICULTY: Difficulty = 'normal';

export const difficultyOf = (game: Game): Difficulty => game.difficulty ?? DEFAULT_DIFFICULTY;

// The game engine (src/game/engine.ts) draws games from this list by id.
// Rules per game are filled in one by one; a game without them shows "To be announced.".
export const GAMES: Game[] = [
  {
    id: 'wordle',
    name: 'Wordle',
    domain: 'logic',
    description: 'Guess a 5-letter word within 5 tries.',
    japaneseName: 'Waadoru',
    difficulty: 'normal',
    rules: [
      'There are 3 levels: an easy word, a moderate word and a hard word.',
      'Each player must guess the same hidden 5-letter word.',
      'After each guess, the letters are color-coded:',
      '🟩 Green: the letter is correct and in the correct position.',
      '🟨 Yellow: the letter is in the hidden word but in the wrong position.',
      '⬜ Gray: the letter is not in the hidden word.',
    ],
    // The points per word (easy +5, moderate +10, hard +20) are applied by the game
    // (game/wordle.ts) but are NOT listed here on purpose: they are not shown to the players.
    clearConditions: [
      'Each player has only 5 attempts for each word.',
      'A level ends when every player has guessed the word or used all 5 attempts. Then the answer is shown and the next level starts once everybody is ready.',
      'The player with the most points after the 3 levels wins.',
    ],
    prohibitions: ['Players are not allowed to guess an invalid or unrecognized word.'],
  },
  { id: 'human-calculator', name: 'Human Calculator', domain: 'logic', description: 'Calculate the numbers shown on screen as fast as possible.' },
  { id: 'magical-banana', name: 'Magical Banana', domain: 'logic', description: 'Rhythm word game: connect the previous word to a new related concept on the beat.' },
  { id: 'fortune', name: 'Fortune', domain: 'logic', description: 'Draw a random fortune-telling paper with a logical question on it.' },

  { id: 'hangman', name: 'Hangman', domain: 'experience', description: 'Guess a proper noun such as a brand, team or celebrity name.' },
  {
    id: 'schulte-table',
    name: 'Schulte Table',
    domain: 'experience',
    description: 'Tap the grid cells in numeric order as quickly as possible.',
    japaneseName: 'Shurute Hyou',
    difficulty: 'easy',
    rules: [
      'Each player gets the same randomly arranged numbered grid for each level.',
      'Tap the numbered cells in the correct ascending order.',
      'Tapping a wrong number does not change the grid: the cell you tapped blinks red as a warning.',
      'The clock keeps running, so every mistake costs you time.',
    ],
    clearConditions: [
      'Complete all 5 levels.',
      'The player who completes all 5 levels in the shortest time wins.',
    ],
  },
  { id: 'inversion', name: 'Inversion', domain: 'experience', description: 'Tap the text button that is NOT correct.' },
  { id: 'janken-negotiation', name: 'Janken Negotiation', domain: 'experience', description: 'Rock-paper-scissors, with negotiating what to pick.' },

  { id: 'battleships', name: 'Battleships', domain: 'chance', description: 'Hit hidden ships on the grid with limited bullets. Do not hit your own ship.' },
  { id: 'maze-hopscotch', name: 'Maze Hopscotch', domain: 'chance', description: 'Step on the correct tile.' },
  { id: 'karuta', name: 'Karuta', domain: 'chance', description: 'Bingo-style card game: whoever recites more from their picked card wins.' },
];

export const getGame = (id: string) => GAMES.find((g) => g.id === id);
