import {
  arrayRemove,
  addDoc,
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
  setDoc,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type { JankenDoc } from '../game/janken';
import {
  DomainCount,
  MAX_PLAYERS,
  MatchState,
  PlayerState,
  RuleError,
  applyPoints,
  applyRoundResult,
  applyTickets,
  drawNextGame,
  forfeitMatch as forfeitMatchRule,
  newPlayer,
  settlementFor,
  startMatch,
  zeroCounts,
} from '../game/engine';
import { difficultyOf, getGame } from '../data/games';

// ---------------------------------------------------------------------------
// There is no server in this version (Firebase free Spark plan). The app talks to
// Firestore directly, using transactions, and firestore.rules limits what a
// player is allowed to change. The HOST's phone runs the match rules
// (start, draw next game, resolve round); every player updates only their OWN
// profile (tickets and scores) once a match is finished.
//
//   users/{uid}       username, usernameLower, tickets, wins{}, plays{}, points{} (ranking points per domain),
//                     totalWins, lastMatchSettled
//   usernames/{lower} { uid }   keeps usernames unique
//   lobbies/{CODE}    match state, hostId, playerIds[], matchId (per-player tallies live in players{})
//   lobbies/{CODE}/results/{uid}  each player's own result for the current round (the host reads them all)
//   lobbies/{CODE}/ready/{uid}    "I finished reading this round's intro" (the host starts the boards when all are in);
//                                 for games with several levels also "I am ready for level N"
//   lobbies/{CODE}/stages/{uid_N} what a player did in level N of a multi-level game (Wordle)
//   lobbies/{CODE}/janken/{uid_K} Janken Negotiation: a player's notes, offers and (after the reveal) throw in round K
//   lobbies/{CODE}/quits/{uid}    "I forfeit the whole match" (the host's phone ends the match)
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
  logic: number; // ranking POINTS in each domain
  experience: number;
  chance: number;
  total: number; // total points
  wins: number; // rounds won overall (tie-breaker)
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
        points: { logic: 0, experience: 0, chance: 0 },
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

// TESTING ONLY: force the game(s) the host's rounds use instead of a random draw.
//  - In .env: EXPO_PUBLIC_TEST_GAME=magical-banana (several ids separated by commas play in that
//    order). Expo reads .env only when it starts: restart with `npx expo start --web -c`.
//  - On the web, no restart needed: open the app with ?testGame=magical-banana at the end of the
//    address (it wins over .env). An empty value (?testGame=) turns it off.
// Leave both empty for the normal random draw. The browser console / Metro log shows what was
// loaded ("TEST MODE ...") so you can check it.
const cleanGameId = (raw: string) =>
  raw
    .trim()
    .replace(/^["']|["']$/g, '')
    .toLowerCase()
    .replace(/[\s_]+/g, '-');

function readTestGames(): string[] {
  let raw: string = process.env.EXPO_PUBLIC_TEST_GAME ?? '';
  const search = (globalThis as { location?: { search?: string } }).location?.search ?? '';
  const fromUrl = search ? new URLSearchParams(search).get('testGame') : null;
  if (fromUrl !== null) raw = fromUrl;
  const ids: string[] = raw
    .split(',')
    .map((id: string) => cleanGameId(id))
    .filter((id: string) => id.length > 0);
  const known = ids.filter((id: string) => !!getGame(id));
  const unknown = ids.filter((id: string) => !getGame(id));
  if (unknown.length > 0) console.warn(`TEST MODE: unknown game id(s) ignored: ${unknown.join(', ')}`);
  if (known.length > 0) console.warn(`TEST MODE: the host's rounds will use: ${known.join(', ')}`);
  return known;
}

const TEST_GAMES = readTestGames();

function withTestGame(state: MatchState): MatchState {
  if (TEST_GAMES.length === 0 || !state.currentRound) return state;
  const id = TEST_GAMES[(state.currentRound.no - 1) % TEST_GAMES.length];
  const game = getGame(id)!;
  return { ...state, currentRound: { ...state.currentRound, gameId: id, difficulty: difficultyOf(game) } };
}

export const startLobby = (code: string) =>
  hostAction(code, (lobby) => matchFields(withTestGame(startMatch(lobby, randomHex(12)))));

export const nextRound = (code: string) =>
  hostAction(code, (lobby) => matchFields(withTestGame(drawNextGame(lobby))));

// Losers lose 1 life, a null winner is a draw. Games that are built decide the winner from
// the players' results; games that are not built yet use the temporary host buttons.
// `extras` = extra points per player (uid -> points) that some games give for what each player did
// (Wordle: for every word guessed), on top of the normal win/loss points.
export const resolveRound = (code: string, winnerId: string | null, extras: Record<string, number> = {}) =>
  hostAction(code, (lobby) => matchFields(applyRoundResult(lobby, winnerId, extras).state));

// ------------------------------------------------------------ round start ----
// Fair start: every player says "ready" once they have read the intro. When all are ready the
// host's phone sets currentRound.go = true and every phone starts its 3-2-1 countdown.
export type ReadyMark = { uid: string; matchId: string; roundNo: number; level?: number };

// level = 1 (or left out): ready to START the round. level = N > 1: ready for level N of a game
// with several levels (it is rewritten with a bigger level each time).
export async function markReady(
  rawCode: string,
  round: { matchId: string; roundNo: number },
  level?: number
): Promise<void> {
  const code = normalizeCode(rawCode);
  const uid = myUid();
  await setDoc(doc(database(), 'lobbies', code, 'ready', uid), {
    uid,
    matchId: round.matchId,
    roundNo: round.roundNo,
    ...(level !== undefined ? { level } : {}),
  });
}

export function subscribeReady(
  rawCode: string,
  onData: (marks: ReadyMark[]) => void,
  onError?: (e: unknown) => void
) {
  if (!db) return () => {};
  return onSnapshot(
    collection(db, 'lobbies', rawCode, 'ready'),
    (snap) => onData(snap.docs.map((d) => d.data() as ReadyMark)),
    onError
  );
}

// HOST: everybody is ready (or the host does not want to wait any longer): start the boards.
export const startRound = (code: string) =>
  hostAction(code, (lobby) => {
    if (lobby.status !== 'playing' || lobby.currentRound?.status !== 'active') {
      throw new RuleError('There is no active round.');
    }
    return { currentRound: { ...lobby.currentRound, go: true } };
  });

// ----------------------------------------------------------- forfeit match ----
// Quit the WHOLE match: you are out (0 lives), so the match ends for everybody. Only the host's
// phone can write the lobby, so a player asks by writing a "quit" mark and the host's phone
// applies it (see GameScreen). The host applies their own quit directly.
export type QuitMark = { uid: string; matchId: string };

export async function forfeitMatch(rawCode: string, matchId: string): Promise<void> {
  const code = normalizeCode(rawCode);
  const uid = myUid();
  const lobby = await getDoc(lobbyRef(code));
  if (lobby.exists() && (lobby.data() as LobbyDoc).hostId === uid) {
    await hostAction(code, (l) => matchFields(forfeitMatchRule(l, uid)));
    return;
  }
  await setDoc(doc(database(), 'lobbies', code, 'quits', uid), { uid, matchId });
}

// HOST: apply somebody else's quit mark.
export const applyQuit = (code: string, quitterId: string) =>
  hostAction(code, (lobby) => matchFields(forfeitMatchRule(lobby, quitterId)));

export function subscribeQuits(
  rawCode: string,
  onData: (marks: QuitMark[]) => void,
  onError?: (e: unknown) => void
) {
  if (!db) return () => {};
  return onSnapshot(
    collection(db, 'lobbies', rawCode, 'quits'),
    (snap) => onData(snap.docs.map((d) => d.data() as QuitMark)),
    onError
  );
}

// ------------------------------------------------------------ level results ----
// Games with several levels (Wordle) report every level as soon as the player finishes it, so
// all phones can show the answer when EVERYBODY is done with the level.
export type StageDoc = { uid: string; matchId: string; roundNo: number; stage: number; solved: boolean; ms: number; answer?: number };

export async function submitStage(
  rawCode: string,
  round: { matchId: string; roundNo: number },
  stage: number,
  result: { solved: boolean; ms: number; answer?: number }
): Promise<void> {
  const code = normalizeCode(rawCode);
  const uid = myUid();
  await setDoc(doc(database(), 'lobbies', code, 'stages', `${uid}_${stage}`), {
    uid,
    matchId: round.matchId,
    roundNo: round.roundNo,
    stage,
    solved: result.solved,
    ms: Math.max(0, Math.round(result.ms)),
    // Human Calculator: what the player typed (left out when they ran out of time).
    ...(typeof result.answer === 'number' ? { answer: Math.round(result.answer) } : {}),
  });
}

export function subscribeStages(
  rawCode: string,
  onData: (stages: StageDoc[]) => void,
  onError?: (e: unknown) => void
) {
  if (!db) return () => {};
  return onSnapshot(
    collection(db, 'lobbies', rawCode, 'stages'),
    (snap) => onData(snap.docs.map((d) => d.data() as StageDoc)),
    onError
  );
}

// ------------------------------------------------------- Janken Negotiation ----
// One document per player per round (id "<uid>_<k>"). It is rewritten while players negotiate
// (public initial throw, offers and answers). `throw` is '' until the reveal and cannot change
// after it, so nobody can read a final throw before its owner publishes it at the end of the timer.
export type JankenSaved = JankenDoc & { matchId: string; roundNo: number };

export async function saveJanken(
  rawCode: string,
  round: { matchId: string; roundNo: number },
  k: number,
  data: Omit<JankenDoc, 'uid' | 'k'>
): Promise<void> {
  const code = normalizeCode(rawCode);
  const uid = myUid();
  await setDoc(doc(database(), 'lobbies', code, 'janken', `${uid}_${k}`), {
    uid,
    matchId: round.matchId,
    roundNo: round.roundNo,
    k,
    initial: data.initial,
    offers: data.offers,
    acc: data.acc,
    rej: data.rej,
    throw: data.throw,
  });
}

export function subscribeJanken(
  rawCode: string,
  onData: (docs: JankenSaved[]) => void,
  onError?: (e: unknown) => void
) {
  if (!db) return () => {};
  return onSnapshot(
    collection(db, 'lobbies', rawCode, 'janken'),
    (snap) => onData(snap.docs.map((d) => d.data() as JankenSaved)),
    onError
  );
}

// ---------------------------------------------------------- round results ----
// Every player saves THEIR OWN result for the round that is being played; the host's phone
// reads all of them, asks the game who won (games/registry.ts) and calls resolveRound.
export type RoundResult = {
  uid: string;
  matchId: string;
  roundNo: number;
  finished: boolean;
  totalMs: number;
  forfeited?: boolean; // the player gave up this game: it counts as a loss
  score?: number; // games that give points for what you did (Wordle): the points earned
};

export async function submitResult(
  rawCode: string,
  round: { matchId: string; roundNo: number },
  result: { finished: boolean; totalMs: number; score?: number }
): Promise<void> {
  const code = normalizeCode(rawCode);
  const uid = myUid();
  await setDoc(doc(database(), 'lobbies', code, 'results', uid), {
    uid,
    matchId: round.matchId,
    roundNo: round.roundNo,
    finished: result.finished,
    totalMs: Math.max(0, Math.round(result.totalMs)),
    ...(result.score !== undefined ? { score: Math.round(result.score) } : {}),
  });
}

// Give up THIS game only: it counts as a loss for this round, and everybody sees "forfeited".
export async function forfeitGame(rawCode: string, round: { matchId: string; roundNo: number }): Promise<void> {
  const code = normalizeCode(rawCode);
  const uid = myUid();
  // So the others do not keep waiting for a "ready" from somebody who gave up (ignore if already there).
  try {
    await markReady(code, round);
  } catch {
    /* already marked ready for this round */
  }
  await setDoc(doc(database(), 'lobbies', code, 'results', uid), {
    uid,
    matchId: round.matchId,
    roundNo: round.roundNo,
    finished: false,
    totalMs: 0,
    forfeited: true,
  });
}

export function subscribeResults(
  rawCode: string,
  onData: (results: RoundResult[]) => void,
  onError?: (e: unknown) => void
) {
  if (!db) return () => {};
  return onSnapshot(
    collection(db, 'lobbies', rawCode, 'results'),
    (snap) => onData(snap.docs.map((d) => d.data() as RoundResult)),
    onError
  );
}

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
    // Profiles made before points existed have no `points` yet: they start from 0.
    const oldPoints = (user.points ?? zeroCounts()) as DomainCount;

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
      points: applyPoints(oldPoints, s.pointsDelta),
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
    // Sorted here (not in the query) so profiles without `points` yet still show up.
    // Fine for a friends game; a big player base would need a stored total to query on.
    query(collection(db, 'users'), limit(200)),
    (snap) => {
      const rows: LeaderboardRow[] = snap.docs.map((d) => {
        const u = d.data();
        const pts = (u.points ?? {}) as Record<string, number>;
        const logic = pts.logic ?? 0;
        const experience = pts.experience ?? 0;
        const chance = pts.chance ?? 0;
        return {
          uid: d.id,
          username: u.username as string,
          tickets: (u.tickets ?? 0) as number,
          logic,
          experience,
          chance,
          total: logic + experience + chance,
          wins: (u.totalWins ?? 0) as number,
        };
      });
      rows.sort((a, b) => b.total - a.total || b.wins - a.wins || a.username.localeCompare(b.username));
      onData(rows.slice(0, 50));
    },
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

// ------------------------------------------------------------ public chat ----
export type ChatMessage = { id: string; uid: string; username: string; text: string; at: number };

export const CHAT_MAX = 200;

export async function sendChat(username: string, rawText: string): Promise<void> {
  const text = rawText.trim().slice(0, CHAT_MAX);
  if (!text) return;
  if (!db || !auth?.currentUser) throw new Error('Not signed in.');
  await addDoc(collection(db, 'chat'), {
    uid: auth.currentUser.uid,
    username,
    text,
    createdAt: serverTimestamp(),
  });
}

// Newest 50 messages, delivered oldest first. Older ones simply scroll out of view.
export function subscribeChat(onData: (msgs: ChatMessage[]) => void, onError?: (e: unknown) => void) {
  if (!db) return () => {};
  const q = query(collection(db, 'chat'), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs
          .map((d) => {
            const v = d.data({ serverTimestamps: 'estimate' });
            return { id: d.id, uid: v.uid, username: v.username, text: v.text, at: v.createdAt?.toMillis?.() ?? 0 };
          })
          .reverse()
      ),
    onError
  );
}

// ------------------------------------------------------------ Magical Banana ----
// A turn-based game needs live shared state. Players write MOVES (a word, a judge request, a
// vote) as their own documents; the HOST's phone applies them with game/magicalBanana.ts and saves
// the resulting state as the document "state" (JSON text), which every phone shows.
export type MagicMove = {
  uid: string;
  matchId: string;
  roundNo: number;
  rev: number;
  kind: 'word' | 'judge' | 'vote';
  word?: string;
  vote?: 'ok' | 'no';
  at: number; // server time in ms (an estimate until the server has confirmed it)
};
export type MagicSnapshot = { state: { matchId: string; roundNo: number; v: number; data: string } | null; moves: MagicMove[] };

export async function sendMagicMove(
  rawCode: string,
  round: { matchId: string; roundNo: number },
  move: { rev: number; kind: 'word' | 'judge' | 'vote'; word?: string; vote?: 'ok' | 'no' }
): Promise<void> {
  const code = normalizeCode(rawCode);
  const uid = myUid();
  // The id must be "<uid>_<digits>": the time plus 3 random digits keeps it unique.
  const id = `${uid}_${Date.now()}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
  await setDoc(doc(database(), 'lobbies', code, 'magic', id), {
    uid,
    matchId: round.matchId,
    roundNo: round.roundNo,
    rev: move.rev,
    kind: move.kind,
    ...(move.word !== undefined ? { word: move.word } : {}),
    ...(move.vote !== undefined ? { vote: move.vote } : {}),
    at: serverTimestamp(),
  });
}

// HOST only.
export async function writeMagicState(
  rawCode: string,
  round: { matchId: string; roundNo: number },
  version: number,
  data: string
): Promise<void> {
  const code = normalizeCode(rawCode);
  await setDoc(doc(database(), 'lobbies', code, 'magic', 'state'), {
    matchId: round.matchId,
    roundNo: round.roundNo,
    v: version,
    data,
  });
}

export function subscribeMagic(
  rawCode: string,
  onData: (snap: MagicSnapshot) => void,
  onError?: (e: unknown) => void
) {
  if (!db) return () => {};
  return onSnapshot(
    collection(db, 'lobbies', rawCode, 'magic'),
    (snap) => {
      let state: MagicSnapshot['state'] = null;
      const moves: MagicMove[] = [];
      for (const d of snap.docs) {
        const v = d.data({ serverTimestamps: 'estimate' }) as Record<string, unknown>;
        if (d.id === 'state') {
          state = v as unknown as MagicSnapshot['state'];
        } else {
          const at = v.at as { toMillis?: () => number } | undefined;
          moves.push({ ...(v as unknown as MagicMove), at: at?.toMillis ? at.toMillis() : Date.now() });
        }
      }
      onData({ state, moves });
    },
    onError
  );
}

// ------------------------------------------------------------ Fortune ----
// Same idea as Magical Banana: players write MOVES (open the temple, pick a slip, answer) as their
// own documents; the HOST's phone applies them with game/fortune.ts and saves the resulting state
// as the document "state" (JSON text), which every phone shows.
export type FortuneMove = {
  uid: string;
  matchId: string;
  roundNo: number;
  rev: number;
  kind: 'open' | 'pick' | 'answer';
  slip?: number;
  guess?: number;
  at: number; // server time in ms (an estimate until the server has confirmed it)
};
export type FortuneSnapshot = {
  state: { matchId: string; roundNo: number; v: number; data: string } | null;
  moves: FortuneMove[];
};

export async function sendFortuneMove(
  rawCode: string,
  round: { matchId: string; roundNo: number },
  move: { rev: number; kind: 'open' | 'pick' | 'answer'; slip?: number; guess?: number }
): Promise<void> {
  const code = normalizeCode(rawCode);
  const uid = myUid();
  // The id must be "<uid>_<digits>": the time plus 3 random digits keeps it unique.
  const id = `${uid}_${Date.now()}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
  await setDoc(doc(database(), 'lobbies', code, 'fortune', id), {
    uid,
    matchId: round.matchId,
    roundNo: round.roundNo,
    rev: move.rev,
    kind: move.kind,
    ...(move.slip !== undefined ? { slip: move.slip } : {}),
    ...(move.guess !== undefined ? { guess: move.guess } : {}),
    at: serverTimestamp(),
  });
}

// HOST only.
export async function writeFortuneState(
  rawCode: string,
  round: { matchId: string; roundNo: number },
  version: number,
  data: string
): Promise<void> {
  const code = normalizeCode(rawCode);
  await setDoc(doc(database(), 'lobbies', code, 'fortune', 'state'), {
    matchId: round.matchId,
    roundNo: round.roundNo,
    v: version,
    data,
  });
}

export function subscribeFortune(
  rawCode: string,
  onData: (snap: FortuneSnapshot) => void,
  onError?: (e: unknown) => void
) {
  if (!db) return () => {};
  return onSnapshot(
    collection(db, 'lobbies', rawCode, 'fortune'),
    (snap) => {
      let state: FortuneSnapshot['state'] = null;
      const moves: FortuneMove[] = [];
      for (const d of snap.docs) {
        const v = d.data({ serverTimestamps: 'estimate' }) as Record<string, unknown>;
        if (d.id === 'state') {
          state = v as unknown as FortuneSnapshot['state'];
        } else {
          const at = v.at as { toMillis?: () => number } | undefined;
          moves.push({ ...(v as unknown as FortuneMove), at: at?.toMillis ? at.toMillis() : Date.now() });
        }
      }
      onData({ state, moves });
    },
    onError
  );
}


// ------------------------------------------------------ Traps of Xibalba ----
export type XibalbaMove = {
  uid: string;
  matchId: string;
  roundNo: number;
  rev: number;
  col: number;
  at: number; // server time in ms (an estimate until the server has confirmed it)
};
export type XibalbaSnapshot = {
  state: { matchId: string; roundNo: number; v: number; data: string } | null;
  moves: XibalbaMove[];
};

export async function sendXibalbaMove(
  rawCode: string,
  round: { matchId: string; roundNo: number },
  move: { rev: number; col: number }
): Promise<void> {
  const code = normalizeCode(rawCode);
  const uid = myUid();
  // The id must be "<uid>_<digits>": the time plus 3 random digits keeps it unique.
  const id = `${uid}_${Date.now()}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
  await setDoc(doc(database(), 'lobbies', code, 'xibalba', id), {
    uid,
    matchId: round.matchId,
    roundNo: round.roundNo,
    rev: move.rev,
    col: move.col,
    at: serverTimestamp(),
  });
}

// HOST only.
export async function writeXibalbaState(
  rawCode: string,
  round: { matchId: string; roundNo: number },
  version: number,
  data: string
): Promise<void> {
  const code = normalizeCode(rawCode);
  await setDoc(doc(database(), 'lobbies', code, 'xibalba', 'state'), {
    matchId: round.matchId,
    roundNo: round.roundNo,
    v: version,
    data,
  });
}

export function subscribeXibalba(
  rawCode: string,
  onData: (snap: XibalbaSnapshot) => void,
  onError?: (e: unknown) => void
) {
  if (!db) return () => {};
  return onSnapshot(
    collection(db, 'lobbies', rawCode, 'xibalba'),
    (snap) => {
      let state: XibalbaSnapshot['state'] = null;
      const moves: XibalbaMove[] = [];
      for (const d of snap.docs) {
        const v = d.data({ serverTimestamps: 'estimate' }) as Record<string, unknown>;
        if (d.id === 'state') {
          state = v as unknown as XibalbaSnapshot['state'];
        } else {
          const at = v.at as { toMillis?: () => number } | undefined;
          moves.push({ ...(v as unknown as XibalbaMove), at: at?.toMillis ? at.toMillis() : Date.now() });
        }
      }
      onData({ state, moves });
    },
    onError
  );
}

// -------------------------------------------------------- Battleships ----
export type BattleshipsMove = {
  uid: string;
  matchId: string;
  roundNo: number;
  rev: number;
  kind: 'place' | 'shoot';
  cells?: number[];
  cell?: number;
  at: number; // server time in ms (an estimate until the server has confirmed it)
};
export type BattleshipsSnapshot = {
  state: { matchId: string; roundNo: number; v: number; data: string } | null;
  moves: BattleshipsMove[];
};

export async function sendBattleshipsMove(
  rawCode: string,
  round: { matchId: string; roundNo: number },
  move: { rev: number; kind: 'place' | 'shoot'; cells?: number[]; cell?: number }
): Promise<void> {
  const code = normalizeCode(rawCode);
  const uid = myUid();
  const id = `${uid}_${Date.now()}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
  await setDoc(doc(database(), 'lobbies', code, 'battleships', id), {
    uid,
    matchId: round.matchId,
    roundNo: round.roundNo,
    rev: move.rev,
    kind: move.kind,
    ...(move.cells !== undefined ? { cells: move.cells } : {}),
    ...(move.cell !== undefined ? { cell: move.cell } : {}),
    at: serverTimestamp(),
  });
}

// HOST only.
export async function writeBattleshipsState(
  rawCode: string,
  round: { matchId: string; roundNo: number },
  version: number,
  data: string
): Promise<void> {
  const code = normalizeCode(rawCode);
  await setDoc(doc(database(), 'lobbies', code, 'battleships', 'state'), {
    matchId: round.matchId,
    roundNo: round.roundNo,
    v: version,
    data,
  });
}

export function subscribeBattleships(
  rawCode: string,
  onData: (snap: BattleshipsSnapshot) => void,
  onError?: (e: unknown) => void
) {
  if (!db) return () => {};
  return onSnapshot(
    collection(db, 'lobbies', rawCode, 'battleships'),
    (snap) => {
      let state: BattleshipsSnapshot['state'] = null;
      const moves: BattleshipsMove[] = [];
      for (const d of snap.docs) {
        const v = d.data({ serverTimestamps: 'estimate' }) as Record<string, unknown>;
        if (d.id === 'state') {
          state = v as unknown as BattleshipsSnapshot['state'];
        } else {
          const at = v.at as { toMillis?: () => number } | undefined;
          moves.push({ ...(v as unknown as BattleshipsMove), at: at?.toMillis ? at.toMillis() : Date.now() });
        }
      }
      onData({ state, moves });
    },
    onError
  );
}
