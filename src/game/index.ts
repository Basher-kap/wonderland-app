// Pure rules, no React. engine = the match model; every mini-game's own rules are a namespace
// (their exports share names such as pickWinner), e.g. `import { schulte } from '../game'`.
export * from './engine';
export * as battleships from './battleships';
export * as fortune from './fortune';
export * as hangman from './hangman';
export * as humanCalculator from './humanCalculator';
export * as inversion from './inversion';
export * as janken from './janken';
export * as karuta from './karuta';
export * as magicalBanana from './magicalBanana';
export * as schulte from './schulte';
export * as wordle from './wordle';
export * as xibalba from './xibalba';
