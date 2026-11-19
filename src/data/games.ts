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
  additionalRules?: string[]; // optional "Additional Rule" dialog, shown after the Rule
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
  {
    id: 'human-calculator',
    name: 'Human Calculator',
    domain: 'logic',
    description: 'Calculate the numbers shown on screen, then type the answer in time.',
    difficulty: 'normal',
    rules: [
      'A number with an arithmetic symbol will briefly appear on the screen before disappearing.',
      'This sequence will continue until the complete mathematical equation has been displayed.',
      'Calculate from left to right, starting from 0.',
      'Players must calculate the answer and enter it within the given time limit.',
      'Players who fail to submit an answer within the time limit receive no points and lose a chance.',
    ],
    // The way the questions grow longer and harder is a hidden note (game/humanCalculator.ts):
    // it is NOT listed here on purpose.
    clearConditions: [
      'Each player has only 3 chances to make a mistake.',
      'The last remaining player wins.',
    ],
  },
  {
    id: 'magical-banana',
    name: 'Magical Banana',
    domain: 'logic',
    description: 'Rhythm word game: connect the previous word to a new related concept on the beat.',
    difficulty: 'easy',
    rules: [
      'The first player must say a word related to the given starting word.',
      'The next player must immediately say another word related to the previous player’s answer before the 5-second rhythm/countdown ends.',
      'The game continues in the same order, with each player providing a related word within the given time limit.',
      'Example: if the previous player says “Banana”, the next player may respond with “Yellow” or “Fruit”.',
      'If the next player says “Yellow”, the following player may respond with “Sun” or “Gold”.',
    ],
    additionalRules: [
      'There is a JUDGE button to judge if that player’s provided word is invalid or unrelated from the previous word.',
      'Players have to vote whether it should pass or fail.',
      'OK results continuation for that next player to provide a word. DRAW results unacceptable word but the player still remains, however if he receives another DRAW he will be disqualified. NO results means that player is disqualified.',
    ],
    // The screen layout (players in a circle, the starting box with the JUDGE button in the
    // center) is a hidden note: NOT listed here on purpose.
    clearConditions: ['The last remaining player wins the game.'],
    prohibitions: [
      'Players who provide invalid or unrelated words are disqualified from the game.',
      'Players who fail to provide an answer within the 7-second time limit are also disqualified.',
    ],
  },
  {
    id: 'fortune',
    name: 'Fortune',
    domain: 'logic',
    description: 'Draw a random fortune-telling paper with a logical question on it.',
    difficulty: 'hard',
    rules: [
      'Each player starts the game with 100 lives.',
      'Players must draw a fortune-telling paper out of 100 available slips.',
      'Each slip contains a question and the player must answer the question drawn.',
    ],
    // Your "Hidden Rules" block. Shown as the "Additional Rule" dialog (like Magical Banana); if
    // they should not be shown at all, delete this list.
    additionalRules: [
      'The lives deducted from you and from the other players for an incorrect answer depend on the margin of error and on the luck drawn.',
      'Answering correctly will recover a bit of lives.',
    ],
    // The temple, the luck tiers, the numbers (how much life each tier costs, heals and splashes)
    // and the slip counts are hidden notes (game/fortune.ts, data/fortune/): NOT listed here on purpose.
    clearConditions: ['The player must survive at the end of the game.'],
  },

  {
    id: 'hangman',
    name: 'Hangman',
    domain: 'experience',
    description: 'Guess a proper noun such as a brand, team or celebrity name.',
    difficulty: 'normal',
    rules: [
      'A hidden word or name will be displayed as a series of blank spaces, with each blank representing one letter.',
      'Players must guess the hidden word by selecting one letter at a time.',
      'Correctly guessed letters will be revealed in their corresponding positions.',
      'Incorrect guesses will add a part to the Hangman drawing.',
    ],
    // The kinds of words (brands, NBA teams, celebrities, events, proper nouns) are a hidden
    // note (data/hangmanWords.ts): NOT listed here on purpose.
    clearConditions: [
      'Players must correctly guess the hidden word before the Hangman drawing is completed.',
      'Players who successfully reveal the entire word win the round.',
      'Players who fail to guess the word before running out of attempts lose the round.',
    ],
  },
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
  {
    id: 'inversion',
    name: 'Inversion',
    domain: 'experience',
    description: 'Follow the instruction about the arrows, but do the opposite when INVERSED blinks.',
    difficulty: 'normal',
    rules: [
      'Follow the instructions given unless there’s an INVERSION sign.',
      'Make sure to click a correct button.',
    ],
    // How the screen looks and how the instructions get trickier is a hidden note
    // (game/inversion.ts): NOT listed here on purpose.
    clearConditions: [
      'Survive all the tasks given until you remain the last player.',
      'You have 3 chances to make a mistake.',
    ],
  },
  {
    id: 'janken-negotiation',
    name: 'Janken Negotiation',
    domain: 'experience',
    description: 'Rock-paper-scissors, with negotiating what to pick.',
    japaneseName: 'Janken Kōshō',
    difficulty: 'hard',
    rules: [
      'You play a series of Rock-Paper-Scissors rounds against your opponents.',
      'Before each throw, you commit an initial throw. Everyone can see it, and you may change it during the 30-second negotiation.',
      'Negotiate with your opponent through promises, persuasion or bluffing. Long-press ROCK, PAPER or SCISSORS to open its negotiation menu: promise to pick it, promise not to pick it, dare your opponent, double or nothing, or sacrifice.',
      'An offer only counts when your opponent accepts it. An accepted offer is binding; anything only said out loud is not, so you can still betray it.',
      'Negotiations may also include betting on whether to extend or end the match.',
      'In the last 5 seconds, you pick your FINAL throw in private. It can differ from your initial throw, and you may change it until the time is up.',
      'When the time is up, all final throws are revealed at the same time.',
      'Double or Nothing: if both players agree, the winner gets double points and the loser loses double.',
      'Forced Rotation: you cannot throw the same thing in two rounds in a row.',
      'Betrayal: promises are not enforced. Only accepted offers (Double or Nothing, ending the match) are binding.',
    ],
    clearConditions: [
      'Win as many rounds as possible before you and your opponent agree to end the match.',
      'The player with the most points wins.',
    ],
  },

  {
      id: 'battleships',
      name: 'Battleships',
      domain: 'chance',
      description: 'Hit hidden ships on the grid with limited bullets. Do not hit your own ship.',
      difficulty: 'easy',
      rules: [
        'At the start of the game, each player has to place 7 battleships on a field.',
        'Each player has 5 bullets to shoot the enemy’s battleships.',
        'Missing a target loses a bullet.',
        'Be careful not to hit your own battleship.',
      ],
      // The screen layout (5x5 grid, 15 seconds to place, the empty grid, random turn order, marks seen
      // by everybody) and the own-ship exception (an enemy ship on the same cell cancels the loss) are
      // hidden notes (game/battleships.ts): NOT listed here on purpose.
      clearConditions: ['Players remaining with their battleship clear the game.'],
    },
    {
    id: 'traps-of-xibalba', // was 'maze-hopscotch'
    name: 'Traps of Xibalba',
    domain: 'chance',
    description: 'Cross the trapped floor one line at a time. One wrong tile and you fall.',
    difficulty: 'normal',
    rules: [
      'All players must cross to the end of the side.',
      'Everybody steps one line at a time, simultaneously. You cannot skip two or more lines ahead, but you can pick any tile on the next line.',
      'Be careful not to step on the wrong tile. The further you go, the higher the chance you will fall.',
      'Players can step on the same tile.',
    ],
    additionalRules: [
      'If two or more players reach the end, they have to go back once more, until only one player is left.',
    ],
    // The 6 x 6 floor, the 10-second picks, how many tiles are false on each line, the picks being
    // secret until the time is up, and the way back being over the same tiles (with a new floor once
    // everybody is back) are hidden notes (game/xibalba.ts): NOT listed here on purpose.
    clearConditions: ['Only the last player to survive clears the game.'],
  },
  { id: 'karuta', name: 'Karuta', domain: 'chance', description: 'Bingo-style card game: whoever recites more from their picked card wins.' },
];

export const getGame = (id: string) => GAMES.find((g) => g.id === id);
