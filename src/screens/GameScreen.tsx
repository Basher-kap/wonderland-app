import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Button, DomainBadge, DomainStat } from '../components/ui';
import { RoundIntro } from '../components/RoundIntro';
import { useAuth } from '../context/AuthContext';
import { DIFFICULTY_MULTIPLIER, difficultyOf, getGame } from '../data/games';
import { DomainCount, settlementFor } from '../game/engine';
import { GAME_MODULES } from '../games/registry';
import type { ResultRow } from '../games/registry';
import type { GameResult } from '../games/types';
import * as api from '../lib/api';
import { isDemoMode } from '../lib/firebase';
import { colors, DOMAIN_ORDER, radius } from '../theme';
import type { RootStackParamList } from '../navigation/types';

// One round, as every player sees it:
//   1. the intro dialogs (RoundIntro): domain + difficulty, Japanese name, rule, clear condition
//   2. "waiting for the others": everybody has to finish reading; when ALL are ready the host's
//      phone sets round.go and every phone counts 3-2-1, so the timers start together
//   3. the game itself (games/registry.ts), which reports this player's result when done
//   4. waiting for the others; the HOST's phone then asks the game who won and ends the round
// While a round is being played there is no way out (no Back button, swipe or Android back).
// Games that are not built yet (no entry in the registry) still use the temporary host buttons.
// Without a lobby (opened from the Home list) the game is a solo practice run.
export function GameScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Game'>>();
  const { uid } = useAuth();
  const [lobby, setLobby] = useState<api.LobbyDoc | null>(null);
  const [results, setResults] = useState<api.RoundResult[]>([]);
  const [ready, setReady] = useState<api.ReadyMark[]>([]);
  const [quits, setQuits] = useState<api.QuitMark[]>([]);
  const [quitSent, setQuitSent] = useState(false); // I forfeited the match, waiting for the host's phone
  const [startedKey, setStartedKey] = useState<string | null>(null); // round whose countdown has ended
  const [count, setCount] = useState<number | null>(null); // 3, 2, 1 before the board starts
  const [busy, setBusy] = useState(false);
  const [introDoneFor, setIntroDoneFor] = useState<string | null>(null);
  // This player's own result for the round, kept here so the screen reacts at once
  // (the copy in Firestore arrives a moment later).
  const [local, setLocal] = useState<{ key: string; result: GameResult; sent: boolean } | null>(null);
  const resolving = useRef<string | null>(null);
  const readySent = useRef<string | null>(null);
  const starting = useRef<string | null>(null);
  const quitting = useRef<string | null>(null);
  const practiceSeed = useMemo(() => Math.random().toString(36).slice(2), []);
  const code = params.code;

  useEffect(() => {
    if (isDemoMode || !code) return;
    return api.subscribeLobby(code, setLobby, (e) => console.warn('lobby listener failed', e));
  }, [code]);

  useEffect(() => {
    if (isDemoMode || !code) return;
    return api.subscribeResults(code, setResults, (e) => console.warn('results listener failed', e));
  }, [code]);

  useEffect(() => {
    if (isDemoMode || !code) return;
    return api.subscribeReady(code, setReady, (e) => console.warn('ready listener failed', e));
  }, [code]);

  useEffect(() => {
    if (isDemoMode || !code) return;
    return api.subscribeQuits(code, setQuits, (e) => console.warn('quits listener failed', e));
  }, [code]);

  const round = lobby?.currentRound ?? null;
  const game = getGame(round?.gameId ?? params.gameId);
  const gameModule = game ? GAME_MODULES[game.id] : undefined;
  const isHost = !!lobby && lobby.hostId === uid;
  const finished = lobby?.status === 'finished';
  const roundActive = !finished && round?.status === 'active';
  const roundDone = !finished && round?.status === 'done';
  const players = lobby ? Object.entries<api.LobbyPlayer>(lobby.players) : [];
  const winnerName = lobby?.winnerId ? lobby.players[lobby.winnerId]?.username : undefined;
  const roundWinnerName = round?.winnerId ? lobby?.players[round.winnerId]?.username : undefined;

  // "<matchId>:<round number>" is the same for everybody, so it is also the game's seed
  // (everyone gets the same first board). A practice run has its own random seed.
  const roundKey = lobby && round ? `${lobby.matchId}:${round.no}` : `practice:${practiceSeed}`;
  const difficulty = round?.difficulty ?? (game ? difficultyOf(game) : 'normal');
  const multiplier = DIFFICULTY_MULTIPLIER[difficulty];
  const introDone = introDoneFor === roundKey;

  // No way out while a round is being played: no Back button, no swipe, no Android back.
  const locked = !!lobby && roundActive;
  useEffect(() => {
    navigation.setOptions({ headerBackVisible: !locked, gestureEnabled: !locked });
    if (!locked) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [navigation, locked]);

  // Fair start. Games with a board wait until everybody has read the intro.
  const needsStart = !!lobby && !!gameModule && roundActive;
  const go = round?.go === true;
  const readyNow = lobby && round
    ? ready.filter((r) => r.matchId === lobby.matchId && r.roundNo === round.no && !!lobby.players[r.uid])
    : [];
  const allReady = !!lobby && lobby.playerIds.every((id) => readyNow.some((r) => r.uid === id));
  const started = lobby ? startedKey === roundKey : true; // a practice run starts straight away

  // Only this round's results (older rounds' results stay in the lobby until overwritten).
  const roundResults = useMemo(
    () =>
      lobby && round
        ? results.filter(
            (r) => r.matchId === lobby.matchId && r.roundNo === round.no && !!lobby.players[r.uid]
          )
        : [],
    [results, lobby, round]
  );
  const myResult = roundResults.find((r) => r.uid === uid);
  const everyoneIn = !!lobby && lobby.playerIds.every((id) => roundResults.some((r) => r.uid === id));
  const mine = local?.key === roundKey ? local : null;

  // 1. I finished reading the intro: tell the lobby.
  useEffect(() => {
    if (!needsStart || !introDone || !lobby || !round || !code) return;
    if (readySent.current === roundKey) return;
    readySent.current = roundKey;
    api.markReady(code, { matchId: lobby.matchId, roundNo: round.no }).catch((e) => {
      readySent.current = null;
      console.warn('ready failed', e);
    });
  }, [needsStart, introDone, lobby, round, code, roundKey]);

  // 2. HOST: everybody is ready, so start the boards.
  useEffect(() => {
    if (!isHost || !needsStart || go || !allReady || !code) return;
    if (starting.current === roundKey) return;
    starting.current = roundKey;
    api.startRound(code).catch((e) => {
      starting.current = null;
      console.warn('start failed', e);
    });
  }, [isHost, needsStart, go, allReady, code, roundKey]);

  // HOST: somebody forfeited the whole match, so end it (the quitter is out, which ends it for all).
  useEffect(() => {
    if (!isHost || !lobby || lobby.status !== 'playing' || !code) return;
    const q = quits.find((x) => x.matchId === lobby.matchId && !!lobby.players[x.uid]);
    if (!q || quitting.current === q.uid) return;
    quitting.current = q.uid;
    api.applyQuit(code, q.uid).catch((e) => {
      quitting.current = null;
      console.warn('apply quit failed', e);
    });
  }, [isHost, lobby, quits, code]);

  // 3. Everybody: once the host says go, count 3-2-1 and then show the board.
  useEffect(() => {
    if (!needsStart || !introDone || !go || startedKey === roundKey) return;
    setCount(3);
    const timers = [
      setTimeout(() => setCount(2), 1000),
      setTimeout(() => setCount(1), 2000),
      setTimeout(() => {
        setCount(null);
        setStartedKey(roundKey);
      }, 3000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [needsStart, introDone, go, startedKey, roundKey]);

  // HOST: as soon as everybody has handed in a result, the game decides the winner.
  useEffect(() => {
    if (!isHost || !roundActive || !gameModule || !code || !everyoneIn) return;
    if (resolving.current === roundKey) return;
    resolving.current = roundKey;
    api.resolveRound(code, gameModule.pickWinner(roundResults)).catch((e) => {
      resolving.current = null; // allow another try (the other phone may also have raced us)
      console.warn('resolve failed', e);
    });
  }, [isHost, roundActive, gameModule, code, everyoneIn, roundKey, roundResults]);

  // What this finished match did to MY ranking points (saved to my profile automatically).
  const fmt = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `-${Math.abs(n)}` : '0');
  let pointsDelta: DomainCount | null = null;
  if (finished && lobby && uid && lobby.players[uid]?.pts) {
    pointsDelta = settlementFor(lobby, uid).pointsDelta;
  }

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } catch (e) {
      Alert.alert('Game', api.errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const sendResult = async (key: string, result: GameResult) => {
    if (!lobby || !round || !code) return; // practice run: nothing to send
    try {
      await api.submitResult(code, { matchId: lobby.matchId, roundNo: round.no }, result);
      setLocal({ key, result, sent: true });
    } catch (e) {
      setLocal({ key, result, sent: false });
      Alert.alert('Game', api.errorMessage(e));
    }
  };

  const onFinish = (result: GameResult) => {
    setLocal({ key: roundKey, result, sent: !lobby });
    void sendResult(roundKey, result);
  };

  // Leaving options. Giving up this game counts as a loss for this round; giving up the match
  // ends the whole match for everybody (the quitter loses it).
  const confirmForfeitGame = () =>
    Alert.alert('Forfeit this game?', 'You lose this round (and a life), and everyone will see that you forfeited.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Forfeit game',
        style: 'destructive',
        onPress: () =>
          void run(async () => {
            if (!lobby || !round || !code) return;
            await api.forfeitGame(code, { matchId: lobby.matchId, roundNo: round.no });
            setLocal({ key: roundKey, result: { finished: false, totalMs: 0 }, sent: true });
          }),
      },
    ]);

  const confirmForfeitMatch = () =>
    Alert.alert(
      'Forfeit the match?',
      'You lose the match and a ticket, and the match ends for everyone in this lobby.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forfeit match',
          style: 'destructive',
          onPress: () =>
            void run(async () => {
              if (!lobby || !code) return;
              await api.forfeitMatch(code, lobby.matchId);
              setQuitSent(true);
            }),
        },
      ]
    );

  if (!game) {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.title}>Game not found</Text>
      </SafeAreaView>
    );
  }

  // 1. Intro dialogs, full screen, for an active round (or a practice run).
  const inRound = lobby ? roundActive : !code; // a lobby that is still loading is not a practice run
  if (inRound && !introDone) {
    return <RoundIntro key={roundKey} game={game} difficulty={difficulty} onDone={() => setIntroDoneFor(roundKey)} />;
  }

  const waitingToStart = !!lobby && !!gameModule && roundActive && !started && !mine;
  const playing = inRound && !!gameModule && !mine && started;
  const describe = (r: ResultRow) => (r.forfeited ? 'forfeited' : gameModule ? gameModule.describe(r) : '');
  const forfeiters = roundResults.filter((r) => r.forfeited);

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.body}>
        <DomainBadge domain={game.domain} />
        <Text style={styles.title}>{game.name}</Text>
        {!playing && <Text style={styles.desc}>{game.description}</Text>}
        {inRound && (
          <Text style={styles.desc}>
            Difficulty: {difficulty[0].toUpperCase() + difficulty.slice(1)} · points x{multiplier}
          </Text>
        )}

        {/* 2. Waiting until everybody has read the intro, then the countdown */}
        {waitingToStart && (
          <View style={styles.box}>
            {count !== null ? (
              <Text style={styles.countdown}>{count}</Text>
            ) : (
              <>
                <Text style={styles.boxTitle}>Waiting for the other players…</Text>
                <Text style={styles.boxText}>
                  {readyNow.length}/{lobby!.playerIds.length} ready. The game starts for everyone at the same time.
                </Text>
                {isHost && !go && !allReady && (
                  <Button
                    label="Start now (don't wait)"
                    variant="secondary"
                    disabled={busy}
                    onPress={() => run(() => api.startRound(code!))}
                    style={{ marginTop: 10 }}
                  />
                )}
              </>
            )}
          </View>
        )}

        {/* 3. The game board */}
        {playing && gameModule && (
          <gameModule.Component key={roundKey} seed={roundKey} uid={uid ?? 'practice'} onFinish={onFinish} />
        )}

        {/* Practice run: show the result and let the player leave */}
        {!lobby && mine && gameModule && (
          <View style={styles.box}>
            <Text style={styles.boxTitle}>Practice result</Text>
            <Text style={styles.boxText}>{describe({ uid: uid ?? 'practice', ...mine.result })}</Text>
          </View>
        )}
        {!lobby && !gameModule && (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>This game board is not built yet</Text>
          </View>
        )}

        {lobby && (
          <View style={styles.box}>
            <Text style={styles.boxTitle}>
              Round {round?.no ?? '-'} · Leg {lobby.leg}
            </Text>
            {players.map(([id, p]) => {
              const r = roundResults.find((x) => x.uid === id);
              return (
                <Text key={id} style={styles.boxText}>
                  {p.username}   ♥ {p.lives}
                  {gameModule && (roundActive || roundDone) && r ? `   ${describe(r)}` : ''}
                  {gameModule && roundActive && !r ? '   playing…' : ''}
                </Text>
              );
            })}

            {finished && (
              <Text style={[styles.boxText, { marginTop: 8, color: colors.accent }]}>
                Match over.{winnerName ? ` Winner: ${winnerName}` : ''} Tickets update automatically.
              </Text>
            )}
            {finished && round?.quitBy && (
              <Text style={[styles.boxText, { color: colors.accent }]}>
                {`${lobby.players[round.quitBy]?.username ?? 'A player'} forfeited the match.`}
              </Text>
            )}
            {finished && pointsDelta && (
              <View style={{ gap: 6, marginTop: 4 }}>
                <Text style={[styles.boxText, { color: colors.text }]}>Your points this match:</Text>
                <View style={{ flexDirection: 'row', gap: 18 }}>
                  {DOMAIN_ORDER.map((d) => (
                    <DomainStat key={d} domain={d} value={fmt(pointsDelta![d])} size={16} color={colors.text} />
                  ))}
                </View>
              </View>
            )}

            {/* 3. Waiting for the others / ending the round */}
            {roundActive && gameModule && mine && !myResult && !mine.sent && (
              <View style={{ gap: 8, marginTop: 8 }}>
                <Text style={styles.boxText}>Your result was not sent yet.</Text>
                <Button label="Send my result again" disabled={busy} onPress={() => void sendResult(roundKey, mine.result)} />
              </View>
            )}
            {roundActive && gameModule && mine && (myResult || mine.sent) && (
              <Text style={[styles.boxText, { marginTop: 8 }]}>
                Result sent. Waiting for the other players… ({roundResults.length}/{lobby.playerIds.length} finished)
              </Text>
            )}

            {/* Games that are not built yet: temporary host buttons */}
            {roundActive && !gameModule && isHost && (
              <View style={{ gap: 8, marginTop: 10 }}>
                <Text style={styles.boxText}>
                  Temporary host controls (this game board is not built yet): who won this round?
                </Text>
                {players.map(([id, p]) => (
                  <Button
                    key={id}
                    label={p.username}
                    variant="secondary"
                    disabled={busy}
                    onPress={() => run(() => api.resolveRound(code!, id))}
                  />
                ))}
                <Button
                  label="Draw (nobody loses a life)"
                  variant="secondary"
                  disabled={busy}
                  onPress={() => run(() => api.resolveRound(code!, null))}
                />
              </View>
            )}
            {roundActive && !gameModule && !isHost && (
              <Text style={[styles.boxText, { marginTop: 8 }]}>Round in progress…</Text>
            )}

            {roundDone && (
              <Text style={[styles.boxText, { marginTop: 8, color: colors.accent }]}>
                {round?.winnerId
                  ? `${roundWinnerName ?? 'A player'} won the round. Everyone else lost a life.`
                  : 'Draw: nobody loses a life.'}
              </Text>
            )}
            {(roundDone || finished) &&
              forfeiters.map((r) => (
                <Text key={r.uid} style={[styles.boxText, { color: colors.accent }]}>
                  {`${lobby.players[r.uid]?.username ?? 'A player'} forfeited this game.`}
                </Text>
              ))}
            {roundDone && isHost && (
              <Button
                label="Draw next game"
                disabled={busy}
                onPress={() => run(() => api.nextRound(code!))}
                style={{ marginTop: 10 }}
              />
            )}
            {roundDone && !isHost && (
              <Text style={[styles.boxText, { marginTop: 8 }]}>
                Round finished. Waiting for the host to draw the next game…
              </Text>
            )}
          </View>
        )}

        {/* The only ways out while a round is being played */}
        {lobby && roundActive && !quitSent && (
          <View style={styles.leave}>
            {gameModule && !mine && !myResult && (
              <Button label="Forfeit game" variant="secondary" disabled={busy} onPress={confirmForfeitGame} />
            )}
            <Button label="Forfeit match" variant="secondary" disabled={busy} onPress={confirmForfeitMatch} />
          </View>
        )}
        {lobby && roundActive && quitSent && (
          <Text style={styles.boxText}>You forfeited the match. Ending it now…</Text>
        )}
      </ScrollView>
      {!locked && (
        <View style={styles.footer}>
          <Button label="Back" variant="secondary" onPress={() => navigation.goBack()} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 20, gap: 12 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  desc: { color: colors.muted, fontSize: 15 },
  box: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  boxTitle: { color: colors.text, fontWeight: '600', marginBottom: 4 },
  boxText: { color: colors.muted },
  placeholder: {
    height: 200,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { color: colors.muted },
  leave: { gap: 8, marginTop: 8 },
  countdown: { color: colors.text, fontSize: 72, fontWeight: '800', textAlign: 'center', paddingVertical: 24 },
  footer: { padding: 20 },
});
