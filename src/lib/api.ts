import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';

// ---------------------------------------------------------------- types ----
export type LobbyPlayer = { username: string; lives: number; joinedAt: number };

export type LobbyDoc = {
  code: string;
  hostId: string;
  playerIds: string[];
  status: 'waiting' | 'playing' | 'finished';
  leg: number;
  winnerId: string | null;
  players: Record<string, LobbyPlayer>;
  currentRound: { no: number; gameId: string; status: 'active' | 'done'; winnerId: string | null } | null;
};

export type LeaderboardRow = {
  uid: string;
  username: string;
  tickets: number;
  logic: number;
  experience: number;
  chance: number;
  total: number;
};

export const errorMessage = (e: unknown) =>
  e instanceof Error && e.message ? e.message : 'Something went wrong. Please try again.';

// ------------------------------------------------------------ functions ----
// The server decides everything that matters (lives, tickets, scores).
// The app only asks.
async function call<T>(name: string, data?: Record<string, unknown>): Promise<T> {
  if (!functions) throw new Error('Firebase is not set up yet.');
  const result = await httpsCallable<Record<string, unknown> | undefined, T>(functions, name)(data);
  return result.data;
}

export const ensureProfile = () => call<{ created: boolean }>('ensureProfile');
export const setUsername = (username: string) => call<{ ok: true }>('setUsername', { username });
export const createLobby = async () => (await call<{ code: string }>('createLobby')).code;
export const joinLobby = async (code: string) => (await call<{ code: string }>('joinLobby', { code })).code;
export const leaveLobby = (code: string) => call<{ ok: true }>('leaveLobby', { code });
export const startLobby = (code: string) => call<{ ok: true }>('startLobby', { code });
export const nextRound = (code: string) => call<{ ok: true }>('nextRound', { code });

// ------------------------------------------------------- live listeners ----
// Each returns an unsubscribe function, so it can be used straight in useEffect.
export function subscribeLobby(
  code: string,
  onData: (lobby: LobbyDoc | null) => void,
  onError?: (e: unknown) => void
) {
  if (!db) return () => {};
  return onSnapshot(
    doc(db, 'lobbies', code),
    (snap) => onData(snap.exists() ? (snap.data() as LobbyDoc) : null),
    onError
  );
}

export function subscribeLeaderboard(onData: (rows: LeaderboardRow[]) => void, onError?: (e: unknown) => void) {
  if (!db) return () => {};
  return onSnapshot(
    query(collection(db, 'users'), orderBy('totalWins', 'desc'), limit(50)),
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const u = d.data();
          const wins = (u.wins ?? {}) as Record<string, number>;
          return {
            uid: d.id,
            username: u.username as string,
            tickets: (u.tickets ?? 0) as number,
            logic: wins.logic ?? 0,
            experience: wins.experience ?? 0,
            chance: wins.chance ?? 0,
            total: (u.totalWins ?? 0) as number,
          };
        })
      ),
    onError
  );
}

export function subscribeProfile(
  uid: string,
  onData: (profile: { username: string; tickets: number }) => void,
  onError?: (e: unknown) => void
) {
  if (!db) return () => {};
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      const d = snap.data();
      if (d) onData({ username: d.username as string, tickets: (d.tickets ?? 0) as number });
    },
    onError
  );
}
