import type { GameLook } from './types';
import { OrphanageBackground, schulteIntro } from './schulte';
import { LibraryBackground, wordleIntro } from './wordle';
import { QuizStageBackground, humanCalculatorIntro } from './humanCalculator';
import { WildWestBackground, hangmanIntro } from './hangman';
import { EsportsArenaBackground, inversionIntro } from './inversion';
import { FoodLandBackground, magicalBananaIntro } from './magicalBanana';
import { FestivalBackground, fortuneIntro } from './fortune';
import { CourtBackground, jankenIntro } from './janken';
import { NaumachiaBackground, battleshipsIntro } from './battleships';
import { TatamiBackground, karutaIntro } from './karuta';
import { CaveBackground, xibalbaIntro } from './xibalba';
import { RuinsBackground, lightBulbIntro } from './lightBulb';
import { SeanceBackground, memoryCardIntro } from './memoryCard';
import { EnchantedBackground, colorTerritoryIntro } from './colorTerritory';
import { CosmosBackground, futureSugorokuIntro } from './futureSugoroku';

// One place that says which games have their own look. A game that is not listed here keeps the
// Space look. To give a new game a look: add a folder next to the others (theme.ts, a background,
// intro.tsx, index.ts) and one line below. Nothing else has to know the list.
export const GAME_LOOKS: Record<string, GameLook> = {
  'schulte-table': { Backdrop: OrphanageBackground, intro: schulteIntro },
  wordle: { Backdrop: LibraryBackground, intro: wordleIntro },
  'human-calculator': { Backdrop: QuizStageBackground, intro: humanCalculatorIntro },
  hangman: { Backdrop: WildWestBackground, intro: hangmanIntro },
  inversion: { Backdrop: EsportsArenaBackground, intro: inversionIntro },
  'magical-banana': { Backdrop: FoodLandBackground, intro: magicalBananaIntro },
  fortune: { Backdrop: FestivalBackground, intro: fortuneIntro },
  'janken-negotiation': { Backdrop: CourtBackground, intro: jankenIntro },
  battleships: { Backdrop: NaumachiaBackground, intro: battleshipsIntro },
  karuta: { Backdrop: TatamiBackground, intro: karutaIntro },
  'traps-of-xibalba': { Backdrop: CaveBackground, intro: xibalbaIntro },
  'light-bulb': { Backdrop: RuinsBackground, intro: lightBulbIntro },
  'color-territory': { Backdrop: EnchantedBackground, intro: colorTerritoryIntro },
  'memory-card': { Backdrop: SeanceBackground, intro: memoryCardIntro },
  'future-sugoroku': { Backdrop: CosmosBackground, intro: futureSugorokuIntro },
};

// The background of the whole game screen (GameScreen) and of the rules dialogs (RoundIntro).
export const getGameBackdrop = (gameId?: string) => (gameId ? GAME_LOOKS[gameId]?.Backdrop ?? null : null);

// The look of the rules dialogs (RoundIntro).
export const getIntroTheme = (gameId?: string) => (gameId ? GAME_LOOKS[gameId]?.intro ?? null : null);
