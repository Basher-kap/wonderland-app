export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  Lobby: { code: string; host: boolean };
  Game: { gameId: string };
};

export type TabParamList = {
  Home: undefined;
  Leaderboard: undefined;
  Settings: undefined;
};
