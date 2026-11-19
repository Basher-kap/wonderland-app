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
  additionalRules?: string[]; // optional extra dialog, shown after the Rule (and the Prohibition)
  additionalRulesHeading?: string; // heading of that dialog; defaults to "Additional Rule"
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
      'Each player must guess the same hidden word displayed on the screen.',
      'After each guess attempt, the letters will be color-coded:',
      '🟩 Green: the letter is correct and in the correct position.',
      '🟨 Yellow: the letter is included in the hidden word but is in the wrong position.',
      '⬜ Gray: the letter is not included in the hidden word.',
    ],
    // The points (game/wordle.ts) are NOT listed here on purpose: they are not shown to the players.
    clearConditions: [
      'Each player has only 5 attempts to guess the hidden word.',
      'The game ends as soon as the first player correctly guesses the word.',
    ],
  },
  {
    id: 'human-calculator',
    name: 'Human Calculator',
    domain: 'logic',
    description: 'Calculate the numbers shown on screen, then type the answer in time.',
    difficulty: 'easy',
    rules: [
      'A number with an arithmetic symbol will briefly appear on the screen before disappearing.',
      'This sequence will continue until the complete mathematical equation has been displayed.',
      'Players must calculate the answer and enter it within the given time limit.',
      'Players who fail to submit an answer within the time limit receive no points and lose a chance.',
    ],
    // The way the questions grow longer and harder is a hidden note (game/humanCalculator.ts):
    // it is NOT listed here on purpose.
    clearConditions: [
      'Each player has only 3 chances to make a mistake.',
      'The last remaining player wins the game.',
    ],
  },
  {
    id: 'magical-banana',
    name: 'Magical Banana',
    domain: 'logic',
    description: 'Rhythm word game: connect the previous word to a new related concept on the beat.',
    difficulty: 'normal',
    rules: [
      'The first player must say a word related to the given starting word.',
      'The next player must immediately say another word related to the previous player’s answer before the rhythm ends.',
      'The game continues in the same order, with each player providing a related word.',
      'Example: if the previous player says “Banana”, the next player may respond with “Yellow” or “Fruit”.',
      'If the next player says “Yellow”, the following player may respond with “Sun” or “Gold”.',
    ],
    prohibitions: [
      'Players who provide invalid or unrelated words are disqualified from the game.',
      'Players who fail to provide an answer within the rhythm are automatically disqualified.',
    ],
    additionalRules: [
      'There is a JUDGE button to judge if that player’s provided word is invalid or unrelated to the previous word.',
      'Players have to vote whether it should pass or fail.',
      'OK results: continuation for the next player to provide a word.',
      'DRAW results: the player remains; however, receiving another DRAW is automatically disqualifying.',
      'NO results mean that the player is disqualified.',
      'Disqualified players can still also partake in voting.',
    ],
    // The screen layout (players in a circle, the starting box with the JUDGE button in the
    // center) is a hidden note: NOT listed here on purpose.
    clearConditions: ['The last remaining player wins the game.'],
  },
  {
    id: 'fortune',
    name: 'Fortune',
    domain: 'logic',
    description: 'Draw a random fortune-telling paper with a logical question on it.',
    difficulty: 'hard',
    rules: [
      'Each player starts the game with 250 lives.',
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
      'A player can get a clue; however, all other players will also receive it.',
    ],
    // The kinds of words (brands, NBA teams, celebrities, events, proper nouns) are a hidden
    // note (data/hangmanWords.ts): NOT listed here on purpose.
    clearConditions: [
      'Players must correctly guess the hidden word before the Hangman drawing is completed.',
      'The first player to correctly guess the hidden word clears the game.',
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
      'Tap the correct following numbers; make sure to read the instructions in case.',
    ],
    clearConditions: ['The fastest player who completes all levels clears the game.'],
  },
  {
    id: 'inversion',
    name: 'Inversion',
    domain: 'experience',
    description: 'Follow the instruction about the arrows, but do the opposite when INVERSED blinks.',
    difficulty: 'normal',
    rules: [
      'Follow the instructions given unless there’s an INVERSION sign.',
      'Make sure to click the correct button.',
    ],
    // How the screen looks and how the instructions get trickier is a hidden note
    // (game/inversion.ts): NOT listed here on purpose.
    clearConditions: [
      'Survive all the tasks given until you remain the last player.',
      'You have 5 chances to make a mistake.',
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
      'All players must compete against their opponents in a series of Rock-Paper-Scissors rounds.',
      'Before each throw, players are given time to negotiate with their opponents through persuasion, consequences, or bluffs.',
      'Once the negotiation period ends, both players will have their final selection to reveal their chosen throws.',
    ],
    additionalRulesHeading: 'Negotiation Choices',
    additionalRules: [
      'LONG PRESS the ROCK, PAPER or SCISSORS to show the simple pre-negotiation choices.',
      'Choices include:',
      'I WILL PICK ROCK, so IF I DID PICK IT, I am DISABLED FROM PICKING ROCK in the next round.',
    ],
    clearConditions: ['Players must win as many rounds as possible in a limited number of rounds.'],
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
      'Each player will have to step one line at a time, simultaneously. You are not allowed to skip two or more lines ahead, but you can pick any tile on the next line.',
      'Be careful not to step on the wrong tile. The further you go, the higher the chance you will fall.',
      'Players can step on the same tile.',
    ],
    additionalRulesHeading: 'Extended Rule',
    additionalRules: [
      'If two or more players were able to reach the end, they will have to go back once more until there is only one player left.',
    ],
    // The 6 x 6 floor, the 10-second picks, how many tiles are false on each line, the picks being
    // secret until the time is up, and the way back being over the same tiles (with a new floor once
    // everybody is back) are hidden notes (game/xibalba.ts): NOT listed here on purpose.
    clearConditions: ['Only the last player to survive clears the game.'],
  },
  { id: 'karuta', name: 'Karuta', domain: 'chance', description: 'Bingo-style card game: whoever recites more from their picked card wins.' },
];

export const getGame = (id: string) => GAMES.find((g) => g.id === id);
