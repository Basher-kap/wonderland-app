import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';

// Old Maid's talk with Firestore. Same shape as Battleships/Karuta in api.ts (players write MOVES as their
// own documents, the host's phone applies them and saves the shared "state"), plus one thing they do not
// have: the hands are SECRET. The host saves each player's hand in lobbies/{code}/oldmaidHands/{uid}, a
// document only that player (and the host) can read, so nobody can read another player's cards.
// Kept in its own file so api.ts does not change. The rules for both collections are in
// backend/firestore.rules (see wonderland-old-maid.md).

type Round = { matchId: string; roundNo: number };

function database() {
  if (!db) throw new Error('Firebase is not set up yet.');
  return db;
}

function myUid(): string {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error('Please sign in first.');
  return uid;
}

const normalizeCode = (raw: string) => (raw ?? '').trim().toUpperCase();

// ------------------------------------------------------------- moves ----
export type OldMaidMove = {
  uid: string;
  matchId: string;
  roundNo: number;
  rev: number;
  kind: 'draw';
  index: number;
  at: number; // server time in ms (an estimate until the server has confirmed it)
};
export type OldMaidSnapshot = {
  state: { matchId: string; roundNo: number; v: number; data: string } | null;
  moves: OldMaidMove[];
};

export async function sendOldMaidMove(rawCode: string, round: Round, move: { rev: number; index: number }): Promise<void> {
  const code = normalizeCode(rawCode);
  const uid = myUid();
  const id = `${uid}_${Date.now()}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
  await setDoc(doc(database(), 'lobbies', code, 'oldmaid', id), {
    uid,
    matchId: round.matchId,
    roundNo: round.roundNo,
    rev: move.rev,
    kind: 'draw',
    index: move.index,
    at: serverTimestamp(),
  });
}

// HOST only: the shared state (no hands in it).
export async function writeOldMaidState(rawCode: string, round: Round, version: number, data: string): Promise<void> {
  const code = normalizeCode(rawCode);
  await setDoc(doc(database(), 'lobbies', code, 'oldmaid', 'state'), {
    matchId: round.matchId,
    roundNo: round.roundNo,
    v: version,
    data,
  });
}

export function subscribeOldMaid(rawCode: string, onData: (snap: OldMaidSnapshot) => void, onError?: (e: unknown) => void) {
  if (!db) return () => {};
  return onSnapshot(
    collection(db, 'lobbies', normalizeCode(rawCode), 'oldmaid'),
    (snap) => {
      let state: OldMaidSnapshot['state'] = null;
      const moves: OldMaidMove[] = [];
      for (const d of snap.docs) {
        const v = d.data({ serverTimestamps: 'estimate' }) as Record<string, unknown>;
        if (d.id === 'state') {
          state = v as unknown as OldMaidSnapshot['state'];
        } else {
          const at = v.at as { toMillis?: () => number } | undefined;
          moves.push({ ...(v as unknown as OldMaidMove), at: at?.toMillis ? at.toMillis() : Date.now() });
        }
      }
      onData({ state, moves });
    },
    onError
  );
}

// ------------------------------------------------------------- hands ----
export type OldMaidHandDoc = { matchId: string; roundNo: number; v: number; cards: string[] };

// HOST only: save everybody's hand, one document each, in one batch.
export async function writeOldMaidHands(
  rawCode: string,
  round: Round,
  version: number,
  hands: Record<string, string[]>
): Promise<void> {
  const code = normalizeCode(rawCode);
  const batch = writeBatch(database());
  for (const [uid, cards] of Object.entries(hands)) {
    batch.set(doc(database(), 'lobbies', code, 'oldmaidHands', uid), {
      matchId: round.matchId,
      roundNo: round.roundNo,
      v: version,
      cards,
    });
  }
  await batch.commit();
}

// My own hand, live.
export function subscribeMyOldMaidHand(
  rawCode: string,
  uid: string,
  onData: (hand: OldMaidHandDoc | null) => void,
  onError?: (e: unknown) => void
) {
  if (!db) return () => {};
  return onSnapshot(
    doc(db, 'lobbies', normalizeCode(rawCode), 'oldmaidHands', uid),
    (snap) => onData(snap.exists() ? (snap.data() as OldMaidHandDoc) : null),
    onError
  );
}

// HOST only, after a restart of the host's phone: read everybody's hand back.
export async function readOldMaidHands(rawCode: string, uids: string[]): Promise<Record<string, OldMaidHandDoc>> {
  const code = normalizeCode(rawCode);
  const out: Record<string, OldMaidHandDoc> = {};
  await Promise.all(
    uids.map(async (uid) => {
      const snap = await getDoc(doc(database(), 'lobbies', code, 'oldmaidHands', uid));
      if (snap.exists()) out[uid] = snap.data() as OldMaidHandDoc;
    })
  );
  return out;
}
