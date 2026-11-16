// What every mini-game screen receives and reports.
export type GameResult = { finished: boolean; totalMs: number; attempts?: number };

export type GameProps = {
  // Same for every player in the round (matchId + round number), so all players get the same
  // first board. In a solo practice run it is random.
  seed: string;
  uid: string;
  // Call once when the player is done. It is saved to the lobby for the host to read.
  onFinish: (result: GameResult) => void;
};
