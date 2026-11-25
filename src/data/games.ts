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
  example?: string[]; // optional "Example" dialog, shown right after the Rule
  additionalRulesHeading?: string; // heading of that dialog; defaults to "Additional Rule"
  // Not decided for most games yet, so they use DEFAULT_DIFFICULTY until you set one here.
  difficulty?: Difficulty;
  minPlayers?: number; // the game is only drawn when the lobby has at least this many players
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
      'The first player correctly guesses all the words clears the game.',
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
    ],
    example: [
      'If the previous player says “Banana”, the next player may respond with “Yellow” or “Fruit”.',
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
    clearConditions: ['The last remaining player wins the game.'],
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
    additionalRules: [
      'The lives deducted from you and from the other players for an incorrect answer depend on the margin of error and on the luck drawn.',
      'Answering correctly will recover a bit of lives.',
    ],
    clearConditions: ['The player must survive at the end of the game.'],
  },

  {
    id: 'light-bulb',
    name: 'Light Bulb',
    domain: 'logic',
    description: 'Trace the tangled wires to find the one switch that turns on the light.',
    difficulty: 'easy',
    rules: ['Which switch turns on the light?', 'You have only one attempt to switch the light.'],
    clearConditions: ['The fastest player to switch on the light clears the game.'],
  },
    {
    id: 'memory-card',
    name: 'Memory Card',
    domain: 'logic',
    description: 'Flip two cards at the same time as everyone else and match the identical icons.',
    difficulty: 'easy',
    rules: [
      'Each player will flip 2 cards at the same time to match its identical icons.',
      'All of the players are only allowed to flip 2 cards within 3 seconds.',
    ],
    clearConditions: ['The player who completed all the matching identical cards clears the game.'],
  },
    {
    id: 'beauty-contest',
    name: 'Beauty Contest',
    domain: 'logic',
    description: 'Pick a number from 0 to 100. The closest to the average × 0.8 wins; everyone else loses a point.',
    difficulty: 'hard',
    rules: [
      'All players must choose a number between 0 and 100.',
      'Then the average of the numbers everyone selected is multiplied by 0.8.',
      'The person whose number is the closest to that result is the winner. The remaining players each lose a point.',
      'A new rule is introduced for every player eliminated when 4 remaining players are left.',
      'It is GAME OVER for the player who reaches -10 points.',
    ],
    clearConditions: ['A remaining player wins the game.'],
  },
      {
    id: 'future-sugoroku',
    name: 'Future Sugoroku',
    domain: 'logic',
    description: 'Choose your next room from clues about the future and find the hidden exit before your Survival Points run out.',
    difficulty: 'hard',
    rules: [
      'All players begin in the center of the table, and the exit lies somewhere around the outer edge.',
      'Each player starts with 15 Survival Points, and the game has a maximum of 15 turns.',
      'When a player chooses a room to move to, they cannot go back to their previous room.',
      'Players can occupy the same room without any occupancy restrictions.',
    ],
    additionalRules: [
      'Every player who chooses a next room loses 1 point. You lose more points when your chosen room is aligned horizontally, vertically or diagonally with other players’ chosen rooms, depending on how many players are aligned.',
      'The room you are about to choose shows a glimpse of the future that waits in the rooms after it.',
    ],
    clearConditions: ['The player who finds the exit of the maze clears the game.'],
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
    id: 'pleasure',
    name: 'Pleasure',
    domain: 'experience',
    description: 'Answer the bear’s personal questions, then guess the Host’s answers.',
    difficulty: 'easy',
    rules: [
      'All players must answer the following question given honestly by a bear.',
      'At the end of the series of questions, all of the players will have the chance to guess the host’s answer.',
    ],
    clearConditions: [
      'Correctly guessed 4 answers of a host by the players, the host wins the game.',
      'However, a player who guessed all the host’s answers wins the game.',
    ],
  },
  {
    id: 'color-territory',
    name: 'Color Territory',
    domain: 'experience',
    description: 'Tap the white circles to claim them in your color. Own the most when time runs out.',
    difficulty: 'easy',
    rules: ['Players must click or tap the white circles to claim them by changing their colors to their assigned colors.'],
    clearConditions: ['The player who owns the most circles when the time limit expires wins the game.'],
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
      clearConditions: ['Players remaining with their battleship clear the game.'],
    },
    {
    id: 'traps-of-xibalba',
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
    clearConditions: ['Only the last player to survive clears the game.'],
  },
    {
    id: 'karuta',
    name: 'Karuta',
    domain: 'chance',
    description: 'Grab the called card from any rack before your opponents do. Empty your rack to win.',
    difficulty: 'hard',
    rules: [
      'Each player receives an equal number of cards, placed on their own card rack. All players’ cards remain visible to everyone.',
      'A floating target card appears on the screen. Players must quickly identify and get that card from any rack before their opponents do.',
      'Once a card on your rack is taken away, the player who took it sends one of their own cards to your rack as a penalty to you.',
    ],
    additionalRules: [
      'However, if you take the wrong card, you are penalized by receiving that card.',
      'Players may take a card in advance, before the floating target card appears.',
      'Everyone is given 45 seconds to memorize the cards on the other players’ racks.',
    ],
    clearConditions: ['Players who have emptied their cards clear the game.'],
  },
   {
    id: 'old-maid',
    name: 'Old Maid',
    domain: 'chance',
    difficulty: 'normal',
    minPlayers: 4,
    description: 'Draw cards from the player on your right and be the one who ends up holding the Joker.',
    rules: [
      'Each player starts with seven cards and discards matching number pairs.',
      'Players draw one card at a time from the player on their right (moving counterclockwise).',
    ],
    clearConditions: ['Finish the game holding the Joker card.'],
    additionalRulesHeading: 'Game Over',
    additionalRules: [
      'Players are eliminated, and electrocuted via a wire connected to their chair, if:',
      'the Joker card is drawn from them,',
      'they run out of cards, or',
      'they leave their seat.',
    ],
  },
  {
    id: 'piano-tiles',
    name: 'Piano Tiles',
    domain: 'experience',
    description: 'Play back the piano’s melody note for note. It gets longer every round.',
    difficulty: 'normal',
    rules: [
      'A piano will play in a series of rounds.',
      'Each player will have to play exactly the notes that the piano played, in order.',
      'As the match goes on, the tune gets longer and longer.',
    ],
    clearConditions: ['The remaining players who survive the rounds clear the game.'],
  },
];

export const getGame = (id: string) => GAMES.find((g) => g.id === id);