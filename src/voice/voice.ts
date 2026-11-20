import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { RTC } from './rtc';

// Voice chat for a lobby: every player who turns the mic on talks to every other player directly
// (WebRTC, one audio connection per pair). Firestore is only the "switchboard" used to set the
// connections up; the voice itself never goes through it.
//
//   lobbies/{code}/voice/{uid}                 who is in the voice chat now {uid, session}
//   lobbies/{code}/voiceSignals/{a}_{b}        the offer/answer of one pair (a < b; a makes the offer)
//   lobbies/{code}/voiceSignals/{a}_{b}/ice/*  the network candidates each side found
//
// One session lasts from "Join voice" to "Leave" and survives going from the lobby to a game and
// back, because this manager lives outside the screens.

export type PeerStatus = 'connecting' | 'connected' | 'failed';
export type VoiceState = {
  code: string | null;
  status: 'off' | 'starting' | 'on' | 'error';
  muted: boolean;
  peers: Record<string, PeerStatus>;
  error: string | null;
};

const OFF: VoiceState = { code: null, status: 'off', muted: false, peers: {}, error: null };
const ICE_SERVERS = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

type Peer = { uid: string; session: string; pc: any; closed: boolean; unsubs: (() => void)[] };

const newSession = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

class VoiceManager {
  private state: VoiceState = OFF;
  private listeners = new Set<() => void>();
  private stream: any = null;
  private me = '';
  private session = '';
  private peers = new Map<string, Peer>();
  private unsubPresence: (() => void) | null = null;

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  getState = () => this.state;

  private set(patch: Partial<VoiceState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }
  private setPeer(uid: string, status: PeerStatus | null) {
    const peers = { ...this.state.peers };
    if (status) peers[uid] = status;
    else delete peers[uid];
    this.set({ peers });
  }

  async join(code: string, uid: string): Promise<void> {
    if (!db) {
      this.set({ status: 'error', error: 'Voice chat needs the online mode.' });
      return;
    }
    if (this.state.status === 'starting' || (this.state.status === 'on' && this.state.code === code)) return;
    if (this.state.code && this.state.code !== code) await this.leave();

    this.set({ ...OFF, status: 'starting', code });
    try {
      this.stream = await RTC.getUserMedia();
    } catch {
      this.set({ ...OFF, status: 'error', error: 'The microphone is not available. Allow it in your settings and try again.' });
      return;
    }
    try {
      this.me = uid;
      this.session = newSession();
      await setDoc(doc(db, 'lobbies', code, 'voice', uid), { uid, session: this.session, at: serverTimestamp() });
      this.unsubPresence = onSnapshot(
        collection(db, 'lobbies', code, 'voice'),
        (snap) => this.onPresence(code, snap.docs.map((d) => d.data() as { uid: string; session: string })),
        () => this.fail('Voice chat lost its connection to the lobby.')
      );
      this.set({ status: 'on' });
    } catch {
      await this.leave();
      this.set({ status: 'error', error: 'Could not join the voice chat. Try again.' });
    }
  }

  private fail(message: string) {
    this.leave().then(() => this.set({ status: 'error', error: message }));
  }

  async leave(): Promise<void> {
    const { code } = this.state;
    this.unsubPresence?.();
    this.unsubPresence = null;
    for (const uid of [...this.peers.keys()]) this.closePeer(uid);
    this.stream?.getTracks?.().forEach((t: any) => t.stop());
    this.stream = null;
    if (code && db && this.me) {
      try {
        await deleteDoc(doc(db, 'lobbies', code, 'voice', this.me));
      } catch {
        // the lobby may already be gone
      }
    }
    this.set({ ...OFF });
  }

  // Leave only if the voice chat belongs to this lobby (a screen of another lobby unmounting must not cut it).
  async leaveLobby(code: string) {
    if (this.state.code === code) await this.leave();
  }

  setMuted(muted: boolean) {
    this.stream?.getAudioTracks?.().forEach((t: any) => {
      t.enabled = !muted;
    });
    this.set({ muted });
  }
  toggleMute = () => this.setMuted(!this.state.muted);

  private onPresence(code: string, rows: { uid: string; session: string }[]) {
    const others = rows.filter((r) => r.uid && r.uid !== this.me);
    for (const [uid, p] of [...this.peers]) {
      const row = others.find((r) => r.uid === uid);
      if (!row || row.session !== p.session) this.closePeer(uid); // left, or came back with a new session
    }
    for (const row of others) if (!this.peers.has(row.uid)) this.openPeer(code, row.uid, row.session);
  }

  private closePeer(uid: string) {
    const p = this.peers.get(uid);
    if (!p) return;
    p.closed = true;
    p.unsubs.forEach((u) => u());
    try {
      p.pc.close();
    } catch {
      // already closed
    }
    RTC.stopRemote(uid);
    this.peers.delete(uid);
    this.setPeer(uid, null);
  }

  private openPeer(code: string, other: string, session: string) {
    if (!db || !this.stream) return;
    const database = db;
    const pc = new RTC.PeerConnection({ iceServers: ICE_SERVERS });
    const peer: Peer = { uid: other, session, pc, closed: false, unsubs: [] };
    this.peers.set(other, peer);
    this.setPeer(other, 'connecting');
    for (const t of this.stream.getTracks()) pc.addTrack(t, this.stream);

    const pair = [this.me, other].sort().join('_');
    const pairRef = doc(database, 'lobbies', code, 'voiceSignals', pair);
    const iceCol = collection(pairRef, 'ice');
    const offerer = this.me < other; // the smaller uid makes the offer
    let gen = 0; // id of the offer this connection is built on
    let remoteSet = false;
    let incoming: { gen: number; cand: any; id: string }[] = [];
    const seen = new Set<string>();

    const flush = async () => {
      incoming = incoming.filter((i) => i.gen >= gen);
      if (!remoteSet) return;
      const now = incoming.filter((i) => i.gen === gen);
      incoming = incoming.filter((i) => i.gen > gen);
      for (const i of now) {
        try {
          await pc.addIceCandidate(new RTC.IceCandidate(i.cand));
        } catch {
          // a candidate that arrives late or twice is harmless
        }
      }
    };

    pc.addEventListener('icecandidate', (e: any) => {
      if (!e.candidate || peer.closed || !gen) return;
      const c = typeof e.candidate.toJSON === 'function' ? e.candidate.toJSON() : e.candidate;
      addDoc(iceCol, { from: this.me, gen, candidate: JSON.stringify(c) }).catch(() => {});
    });
    pc.addEventListener('track', (e: any) => {
      const stream = e.streams?.[0];
      if (stream && !peer.closed) RTC.playRemote(other, stream);
    });
    const onState = () => {
      if (peer.closed) return;
      const s = pc.iceConnectionState;
      this.setPeer(other, s === 'connected' || s === 'completed' ? 'connected' : s === 'failed' ? 'failed' : 'connecting');
    };
    pc.addEventListener('iceconnectionstatechange', onState);

    peer.unsubs.push(
      onSnapshot(iceCol, (snap) => {
        snap.docChanges().forEach((ch) => {
          if (ch.type !== 'added' || seen.has(ch.doc.id)) return;
          const v = ch.doc.data() as { from: string; gen: number; candidate: string };
          if (v.from !== other) return;
          seen.add(ch.doc.id);
          try {
            incoming.push({ gen: v.gen, cand: JSON.parse(v.candidate), id: ch.doc.id });
          } catch {
            // ignore a damaged candidate
          }
        });
        void flush();
      })
    );

    // The pair document is handled one change at a time.
    let chain: Promise<void> = Promise.resolve();
    const handle = async (v: Record<string, any>) => {
      if (peer.closed) return;
      if (offerer) {
        if (v.gen === gen && v.answer && !remoteSet && v.answererSession === session) {
          await pc.setRemoteDescription(new RTC.SessionDescription(v.answer));
          remoteSet = true;
          await flush();
        }
      } else if (v.offer && v.offererSession === session && v.answererSession === this.session && v.gen !== gen) {
        gen = v.gen;
        remoteSet = false;
        await pc.setRemoteDescription(new RTC.SessionDescription(v.offer));
        remoteSet = true;
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await updateDoc(pairRef, { answer: { type: answer.type, sdp: answer.sdp } });
        await flush();
      }
    };
    peer.unsubs.push(
      onSnapshot(pairRef, (snap) => {
        const v = snap.data();
        if (!v) return;
        chain = chain.then(() => handle(v)).catch(() => this.setPeer(other, 'failed'));
      })
    );

    if (offerer) {
      (async () => {
        gen = Date.now();
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
        await pc.setLocalDescription(offer);
        await setDoc(pairRef, {
          offerer: this.me,
          answerer: other,
          offererSession: this.session,
          answererSession: session,
          gen,
          offer: { type: offer.type, sdp: offer.sdp },
          answer: null,
        });
      })().catch(() => this.setPeer(other, 'failed'));
    }
  }
}

export const voice = new VoiceManager();
