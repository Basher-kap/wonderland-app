import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import {
  MAX_PLAYERS,
  MatchState,
  PlayerState,
  RuleError,
  applyRoundResult,
  applyTickets,
  drawNextGame,
  newPlayer,
  settlementFor,
  startMatch,
} from '../game/engine';

// ---------------------------------------------------------------------------
// There is no server in this version (Firebase free Spark plan). The app talks to
// Firestore directly, using transactions, and firestore.rules limits what a
// player is allowed to change. The HOST's phone runs the match rules
// (start, draw next game, resolve round); every player updates only their OWN
// profile (tickets and scores) once a match is finished.
//
//   users/{uid}       username, usernameLower, tickets, wins{}, plays{}, totalWins, lastMatchSettled
//   usernames/{lower} { uid }   keeps usernames unique
//   lobbies/{CODE}    match state, hostId, playerIds[], matchId (per-player tallies live in players{})
// ---------------------------------------------------------------------------

export type LobbyPlayer = PlayerState;

export type LobbyDoc = MatchState & {
  code: string;
  hostId: string;
  playerIds: string[];
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

export function errorMessage(e: unknown): string {
  const code = (e as { code?: string } | null)?.code;
  if (code === 'permission-denied') return 'The game rules blocked that action.';
  if (code === 'unavailable') return 'You seem to be offline. Check your connection.';
  return e instanceof Error && e.message ? e.message : 'Something went wrong. Please try again.';
}

// --------------------------------------------------------------- helpers ----
const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

function database() {
  if (!db) throw new Error('Firebase is not set up yet.');
  return db;
}

function myUid(): string {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error('Please sign in first.');
  return uid;
}

const userRef = (uid: string) => doc(database(), 'users', uid);
const lobbyRef = (code: string) => doc(database(), 'lobbies', code);
const nameRef = (lower: string) => doc(database(), 'usernames', lower);

const randomHex = (n: number) =>
  Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');

const randomCode = () =>
  Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

function normalizeCode(raw: string): string {
  const code = (raw ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) throw new RuleError('The lobby ID must be 6 characters.');
  return code;
}

// --------------------------------------------------------------- profile ----
// Called right after sign-in. Safe to call many times.
export async function ensureProfile(): Promise<void> {
  const uid = myUid();
  for (let attempt = 0; attempt < 10; attempt++) {
    const name = `player_${randomHex(8)}`; // lowercase, 15 chars
    const done = await runTransaction(database(), async (tx) => {
      if ((await tx.get(userRef(uid))).exists()) return true;
      if ((await tx.get(nameRef(name))).exists()) return false; // taken, try another
      tx.set(nameRef(name), { uid });
      tx.set(userRef(uid), {
        username: name,
        usernameLower: name,
        tickets: 5,
        wins: { logic: 0, experience: 0, chance: 0 },
        plays: { logic: 0, experience: 0, chance: 0 },
        totalWins: 0,
        lastMatchSettled: '',
        createdAt: serverTimestamp(),
      });
      return true;
    });
    if (done) return;
  }
  throw new Error('Could not pick a default username.');
}

export async function setUsername(raw: string): Promise<void> {
  const uid = myUid();
  const username = (raw ?? '').trim();
  if (!USERNAME_RE.test(username)) throw new RuleError('Use 3-16 letters, numbers or underscores.');
  const lower = username.toLowerCase();

  await runTransaction(database(), async (tx) => {
    const userSnap = await tx.get(userRef(uid));
    if (!userSnap.exists()) throw new RuleError('Profile not ready yet. Try again in a moment.');
    const taken = await tx.get(nameRef(lower));
    if (taken.exists() && taken.data().uid !== uid) throw new RuleError('That username is taken.');

    const oldLower = userSnap.data().usernameLower as string;
    if (oldLower !== lower) tx.delete(nameRef(oldLower));
    if (!taken.exists()) tx.set(nameRef(lower), { uid });
    tx.update(userRef(uid), { username, usernameLower: lower });
  });
}

// --------------------------------------------------------------- lobbies ----
async function requireTicket(uid: string): Promise<string> {
  const snap = await getDoc(userRef(uid));
  if (!snap.exists()) throw new RuleError('Profile not ready yet. Try again in a moment.');
  if ((snap.data().tickets ?? 0) < 1) throw new RuleError('You have no tickets left.');
  return snap.data().username as string;
}

export async function createLobby(): Promise<string> {
  const uid = myUid();
  const username = await requireTicket(uid);

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode();
    const created = await runTransaction(database(), async (tx) => {
      if ((await tx.get(lobbyRef(code))).exists()) return false; // code already used
      tx.set(lobbyRef(code), {
        code,
        hostId: uid,
        playerIds: [uid],
        status: 'waiting',
        matchId: '',
        leg: 1,
        gameQueue: [],
        players: { [uid]: newPlayer(username) },
        currentRound: null,
        winnerId: null,
        createdAt: serverTimestamp(),
      });
      return true;
    });
    if (created) return code;
  }
  throw new Error('Could not create a lobby ID. Try again.');
}

export async function joinLobby(rawCode: string): Promise<string> {
  const code = normalizeCode(rawCode);
  const uid = myUid();
  const username = await requireTicket(uid);

  await runTransaction(database(), async (tx) => {
    const snap = await tx.get(lobbyRef(code));
    if (!snap.exists()) throw new RuleError('Lobby not found. Check the ID.');
    const lobby = snap.data() as LobbyDoc;
    if (lobby.playerIds.includes(uid)) return; // already in
    if (lobby.status !== 'waiting') throw new RuleError('That game already started.');
    if (lobby.playerIds.length >= MAX_PLAYERS) throw new RuleError('That lobby is full.');

    tx.update(lobbyRef(code), {
      playerIds: arrayUnion(uid),
      [`players.${uid}`]: newPlayer(username),
    });
  });
  return code;
}

export async function leaveLobby(rawCode: string): Promise<void> {
  const code = normalizeCode(rawCode);
  const uid = myUid();

  await runTransaction(database(), async (tx) => {
    const snap = await tx.get(lobbyRef(code));
    if (!snap.exists()) return;
    const lobby = snap.data() as LobbyDoc;
    if (!lobby.playerIds.includes(uid) || lobby.status !== 'waiting') return;

    const others = lobby.playerIds.filter((id) => id !== uid);
    if (others.length === 0) {
      tx.delete(lobbyRef(code));
      return;
    }
    const update: Record<string, unknown> = {
      playerIds: arrayRemove(uid),
      [`players.${uid}`]: deleteField(),
    };
    if (lobby.hostId === uid) {
      // Host left: whoever joined earliest becomes host.
      update.hostId = [...others].sort((a, b) => lobby.players[a].joinedAt - lobby.players[b].joinedAt)[0];
    }
    tx.update(lobbyRef(code), update);
  });
}

// ----------------------------------------------------------- host actions ----
const matchFields = (n: MatchState) => ({
  status: n.status,
  matchId: n.matchId,
  leg: n.leg,
  gameQueue: n.gameQueue,
  players: n.players,
  currentRound: n.currentRound,
  winnerId: n.winnerId,
});

async function hostAction(rawCode: string, step: (lobby: LobbyDoc) => Record<string, unknown>): Promise<void> {
  const code = normalizeCode(rawCode);
  const uid = myUid();
  await runTransaction(database(), async (tx) => {
    const snap = await tx.get(lobbyRef(code));
    if (!snap.exists()) throw new RuleError('Lobby not found.');
    const lobby = snap.data() as LobbyDoc;
    if (lobby.hostId !== uid) throw new RuleError('Only the host can do that.');
    tx.update(lobbyRef(code), step(lobby));
  });
}

export const startLobby = (code: string) =>
  hostAction(code, (lobby) => matchFields(startMatch(lobby, randomHex(12))));

export const nextRound = (code: string) => hostAction(code, (lobby) => matchFields(drawNextGame(lobby)));

// Losers lose 1 life, a null winner is a draw. For now the host picks the winner by
// hand (game boards are not built yet); later each game will report its own result.
export const resolveRound = (code: string, winnerId: string | null) =>
  hostAction(code, (lobby) => matchFields(applyRoundResult(lobby, winnerId).state));

// ------------------------------------------------------ settle a match ----
// Each player calls this for themselves once the lobby is finished: it applies
// the ticket change (-1 if you hit 0 lives, +1 if you won) and adds your round
// wins to your scores. Safe to call repeatedly: a match is only counted once.
export async function settleMatch(rawCode: string): Promise<boolean> {
  const code = normalizeCode(rawCode);
  const uid = myUid();

  return runTransaction(database(), async (tx) => {
    const [lobbySnap, userSnap] = await Promise.all([tx.get(lobbyRef(code)), tx.get(userRef(uid))]);
    if (!lobbySnap.exists() || !userSnap.exists()) return false;
    const lobby = lobbySnap.data() as LobbyDoc;
    const user = userSnap.data();
    if (lobby.status !== 'finished' || !lobby.matchId || !lobby.playerIds.includes(uid)) return false;

    const key = `${code}:${lobby.matchId}`;
    if (user.lastMatchSettled === key) return false; // already counted

    // What this match changes on MY profile (the Firestore rules recompute the same
    // numbers from the lobby, so a different value is rejected).
    const s = settlementFor(lobby, uid);
    const oldWins = user.wins as Record<string, number>;
    const oldPlays = user.plays as Record<string, number>;

    tx.update(userRef(uid), {
      tickets: applyTickets(user.tickets as number, s.ticketDelta),
      wins: {
        logic: oldWins.logic + s.wins.logic,
        experience: oldWins.experience + s.wins.experience,
        chance: oldWins.chance + s.wins.chance,
      },
      plays: {
        logic: oldPlays.logic + s.plays.logic,
        experience: oldPlays.experience + s.plays.experience,
        chance: oldPlays.chance + s.plays.chance,
      },
      totalWins: (user.totalWins as number) + s.totalWins,
      lastMatchSettled: key,
    });
    return true;
  });
}

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
