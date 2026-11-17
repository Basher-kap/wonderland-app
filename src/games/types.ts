// What every mini-game screen receives and reports.
export type GameResult = {
  finished: boolean;
  totalMs: number;
  score?: number; // games that give points for what you did (Wordle): the points earned
};

// What one player did in one level of a game with several levels (Wordle).
export type StageResult = { uid: string; stage: number; solved: boolean; ms: number; answer?: number };

// The lobby, as seen by a game with several levels. It is only given in a lobby (not in a solo
// practice run). It lets the game wait for the other players between levels.
export type GameRoom = {
  playerIds: string[];
  usernames: Record<string, string>;
  // Everybody's finished levels in this round.
  stages: StageResult[];
  // uid -> highest level the player is ready for (1 = ready to start the game).
  readyStage: Record<string, number>;
  // Players who forfeited this game: nobody waits for them.
  out: string[];
  // Tell the others I finished a level / that I am ready for the next one.
  reportStage: (stage: number, result: { solved: boolean; ms: number; answer?: number }) => Promise<void>;
  readyFor: (stage: number) => Promise<void>;
};

export type GameProps = {
  // Same for every player in the round (matchId + round number), so all players get the same
  // first board. In a solo practice run it is random.
  seed: string;
  uid: string;
  // Call once when the player is done with the WHOLE game. It is saved to the lobby for the host
  // to read.
  onFinish: (result: GameResult) => void;
  // Only for games with several levels (registry: multiStage).
  room?: GameRoom;
};
