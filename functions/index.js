// Daily data cleaning for WONDERLAND (runs on Firebase, not on the phones).
//
//   - chat:     the public chat is emptied every day
//   - lobbies:  every lobby that is older than LOBBY_KEEP_HOURS is deleted together with all of
//               its sub-collections (ready, results, the game states, the voice chat signals, ...)
//
// Runs every day at 04:00 Philippine time. Change CHAT_KEEP_HOURS / LOBBY_KEEP_HOURS / the schedule below.
// A lobby is never cleaned while it is younger than LOBBY_KEEP_HOURS, so a match that is being
// played at 04:00 is safe as long as it was created less than that long ago.
const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

initializeApp();

const CHAT_KEEP_HOURS = 0; // 0 = the whole chat is cleared
const LOBBY_KEEP_HOURS = 6;
const PAGE = 400;

const cutoff = (hours) => Timestamp.fromMillis(Date.now() - hours * 3600 * 1000);

async function clearChat(db) {
  let total = 0;
  for (;;) {
    const snap = await db.collection('chat').where('createdAt', '<', cutoff(CHAT_KEEP_HOURS)).limit(PAGE).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
  }
  return total;
}

async function clearLobbies(db) {
  let total = 0;
  for (;;) {
    const snap = await db.collection('lobbies').where('createdAt', '<', cutoff(LOBBY_KEEP_HOURS)).limit(50).get();
    if (snap.empty) break;
    for (const d of snap.docs) {
      await db.recursiveDelete(d.ref); // the lobby and everything under it
      total += 1;
    }
  }
  return total;
}

exports.dailyCleanup = onSchedule(
  { schedule: '0 4 * * *', timeZone: 'Asia/Manila', timeoutSeconds: 540, memory: '256MiB' },
  async () => {
    const db = getFirestore();
    const chats = await clearChat(db);
    const lobbies = await clearLobbies(db);
    logger.info(`dailyCleanup: removed ${chats} chat messages and ${lobbies} lobbies`);
  }
);
