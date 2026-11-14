import { Domain } from '../theme';

export type Game = {
  id: string;
  name: string;
  domain: Domain;
  description: string;
};

// Keep the ids in sync with GAMES in backend/functions/src/engine.ts: the server
// draws games by id. Rules per game are TBA, so the game screens are placeholders.
export const GAMES: Game[] = [
  { id: 'wordle', name: 'Wordle', domain: 'logic', description: 'Guess a 5-letter word within 5 tries.' },
  { id: 'human-calculator', name: 'Human Calculator', domain: 'logic', description: 'Calculate the numbers shown on screen as fast as possible.' },
  { id: 'magical-banana', name: 'Magical Banana', domain: 'logic', description: 'Rhythm word game: connect the previous word to a new related concept on the beat.' },
  { id: 'fortune', name: 'Fortune', domain: 'logic', description: 'Draw a random fortune-telling paper with a logical question on it.' },

  { id: 'hangman', name: 'Hangman', domain: 'experience', description: 'Guess a proper noun such as a brand, team or celebrity name.' },
  { id: 'schulte-table', name: 'Schulte Table', domain: 'experience', description: 'Tap the grid cells in numeric order as quickly as possible.' },
  { id: 'inversion', name: 'Inversion', domain: 'experience', description: 'Tap the text button that is NOT correct.' },
  { id: 'janken-negotiation', name: 'Janken Negotiation', domain: 'experience', description: 'Rock-paper-scissors, with negotiating what to pick.' },

  { id: 'battleships', name: 'Battleships', domain: 'chance', description: 'Hit hidden ships on the grid with limited bullets. Do not hit your own ship.' },
  { id: 'maze-hopscotch', name: 'Maze Hopscotch', domain: 'chance', description: 'Step on the correct tile.' },
  { id: 'karuta', name: 'Karuta', domain: 'chance', description: 'Bingo-style card game: whoever recites more from their picked card wins.' },
];

export const getGame = (id: string) => GAMES.find((g) => g.id === id);
