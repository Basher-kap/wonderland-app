import { useEffect, useState } from 'react';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, isDemoMode } from './firebase';

/**
 * Profile pictures.
 *
 * A picture is a tiny square JPEG (96x96) stored as base64 text in its own document, avatars/{uid}.
 * It is NOT kept on the profile, the lobby or the chat messages, so lists (leaderboard, lobby, chat) stay
 * light: each picture is read once, on demand, and kept in memory for a few minutes.
 */

/** Longest base64 text the rules accept. Keep in sync with firestore.rules (match /avatars/{uid}). */
export const AVATAR_MAX_CHARS = 12000;
const AVATAR_SIZE = 96;
const FRESH_MS = 5 * 60 * 1000; // after this a picture is checked again the next time it is shown

type Entry = { data: string | null; at: number };

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<void>>();
const listeners = new Map<string, Set<() => void>>();

function notify(uid: string) {
  listeners.get(uid)?.forEach((fn) => fn());
}

function fetchAvatar(uid: string): Promise<void> {
  const running = inflight.get(uid);
  if (running) return running;
  const p = (async () => {
    try {
      if (!db) return;
      const snap = await getDoc(doc(db, 'avatars', uid));
      const d = snap.exists() ? (snap.data().data as unknown) : null;
      cache.set(uid, { data: typeof d === 'string' ? d : null, at: Date.now() });
      notify(uid);
    } catch (e) {
      // Keep whatever we had; try again later.
      if (!cache.has(uid)) cache.set(uid, { data: null, at: Date.now() - FRESH_MS + 30_000 });
      console.warn('avatar read failed', e);
    } finally {
      inflight.delete(uid);
    }
  })();
  inflight.set(uid, p);
  return p;
}

/** The picture of a player as an image uri, or null when they have none. Reads once, then uses the cache. */
export function useAvatar(uid: string | null | undefined): string | null {
  const [, force] = useState(0);
  useEffect(() => {
    if (!uid) return;
    const set = listeners.get(uid) ?? new Set<() => void>();
    const fn = () => force((n) => n + 1);
    set.add(fn);
    listeners.set(uid, set);
    if (!isDemoMode) {
      const e = cache.get(uid);
      if (!e || Date.now() - e.at > FRESH_MS) void fetchAvatar(uid);
    }
    return () => {
      set.delete(fn);
    };
  }, [uid]);
  const data = uid ? cache.get(uid)?.data : null;
  return data ? `data:image/jpeg;base64,${data}` : null;
}

/** The key the signed-in player's own picture is stored under (demo mode has no uid). */
export function myAvatarKey(uid: string | null): string | null {
  return uid ?? (isDemoMode ? 'demo' : null);
}

async function save(key: string, data: string) {
  if (!isDemoMode) {
    if (!db || !auth?.currentUser) throw new Error('Not signed in.');
    await setDoc(doc(db, 'avatars', auth.currentUser.uid), { data, updatedAt: serverTimestamp() });
  }
  cache.set(key, { data, at: Date.now() });
  notify(key);
}

/**
 * Lets the player choose a photo, crops it to a square and shrinks it. Returns false when they cancel.
 * Throws a readable Error when the picture cannot be used.
 */
export async function pickAndSetMyAvatar(uid: string | null): Promise<boolean> {
  const key = myAvatarKey(uid);
  if (!key) throw new Error('Not signed in.');
  const ImagePicker = await import('expo-image-picker');
  const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true, // lets the player crop to a square
    aspect: [1, 1],
    quality: 1,
  });
  if (picked.canceled || !picked.assets?.[0]) return false;

  const ctx = ImageManipulator.manipulate(picked.assets[0].uri).resize({ width: AVATAR_SIZE, height: AVATAR_SIZE });
  const image = await ctx.renderAsync();
  let data = '';
  for (const quality of [0.7, 0.55, 0.4, 0.3]) {
    const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: quality, base64: true });
    data = out.base64 ?? '';
    if (data && data.length <= AVATAR_MAX_CHARS) break;
  }
  if (!data || data.length > AVATAR_MAX_CHARS) throw new Error('That picture could not be made small enough. Try another one.');
  await save(key, data);
  return true;
}

export async function removeMyAvatar(uid: string | null): Promise<void> {
  const key = myAvatarKey(uid);
  if (!key) return;
  if (!isDemoMode) {
    if (!db || !auth?.currentUser) throw new Error('Not signed in.');
    await deleteDoc(doc(db, 'avatars', auth.currentUser.uid));
  }
  cache.set(key, { data: null, at: Date.now() });
  notify(key);
}
