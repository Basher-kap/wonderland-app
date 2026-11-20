import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import * as api from '../lib/api';
import { isDemoMode } from '../lib/firebase';
import { colors, radius } from '../theme';
import { space } from '../spaceTheme';
import type { RootStackParamList } from '../navigation/types';

type Props = {
  navRef: NavigationContainerRefWithCurrent<RootStackParamList>;
  routeName?: string;
};

const BUBBLE = 56;
const POS_KEY = 'wonderland.chatBubblePos';
const SEEN_KEY = 'wonderland.chatLastSeen';
const COOLDOWN_MS = 2000;
const CODE_RE = /\b[A-HJ-NP-Z2-9]{6}\b/;

// Floating public chat: a draggable bubble on every screen except Game (and Login).
// Tap it to open the room, drag it anywhere, and it remembers where you left it.
export function ChatBubble({ navRef, routeName }: Props) {
  const { signedIn, uid, username } = useAuth();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<api.ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [lastSeen, setLastSeen] = useState(0);
  const lastSent = useRef(0);

  // ---- position (kept inside the screen) ----
  const bounds = useMemo(
    () => ({
      minX: 4,
      maxX: width - BUBBLE - 4,
      minY: insets.top + 4,
      maxY: height - BUBBLE - insets.bottom - 4,
    }),
    [width, height, insets.top, insets.bottom]
  );
  const clamp = (x: number, y: number) => ({
    x: Math.min(Math.max(x, bounds.minX), bounds.maxX),
    y: Math.min(Math.max(y, bounds.minY), bounds.maxY),
  });
  const pos = useRef(new Animated.ValueXY({ x: width - BUBBLE - 12, y: height * 0.6 })).current;
  const start = useRef({ x: 0, y: 0 });
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    AsyncStorage.getItem(POS_KEY)
      .then((v) => {
        if (!v) return;
        const p = JSON.parse(v);
        if (typeof p?.x === 'number' && typeof p?.y === 'number') {
          const c = clamp(p.x, p.y);
          pos.setValue(c);
        }
      })
      .catch(() => {});
    AsyncStorage.getItem(SEEN_KEY)
      .then((v) => v && setLastSeen(Number(v) || 0))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          pos.stopAnimation((v) => {
            start.current = { x: v.x, y: v.y };
          });
        },
        onPanResponderMove: (_, g) => {
          const b = boundsRef.current;
          pos.setValue({
            x: Math.min(Math.max(start.current.x + g.dx, b.minX), b.maxX),
            y: Math.min(Math.max(start.current.y + g.dy, b.minY), b.maxY),
          });
        },
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6) {
            setOpen((o) => !o);
            return;
          }
          pos.stopAnimation((v) => {
            AsyncStorage.setItem(POS_KEY, JSON.stringify({ x: v.x, y: v.y })).catch(() => {});
          });
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ---- messages ----
  const active = signedIn && routeName !== 'Game';
  useEffect(() => {
    if (!signedIn || isDemoMode) return;
    return api.subscribeChat(setMsgs, (e) => console.warn('chat listener failed', e));
  }, [signedIn]);

  // Opening the chat also clears the messages older than a day.
  useEffect(() => {
    if (open && signedIn && !isDemoMode) void api.cleanOldChat();
  }, [open, signedIn]);

  const newest = msgs.length ? msgs[msgs.length - 1].at : 0;
  useEffect(() => {
    if (open && newest > lastSeen) {
      setLastSeen(newest);
      AsyncStorage.setItem(SEEN_KEY, String(newest)).catch(() => {});
    }
  }, [open, newest, lastSeen]);

  const unread = open ? 0 : msgs.filter((m) => m.at > lastSeen && m.uid !== uid).length;

  // The chat closes by itself when you head into a game.
  useEffect(() => {
    if (!active) setOpen(false);
  }, [active]);

  const lobbyCode = (() => {
    if (routeName !== 'Lobby') return null;
    const r = navRef.getCurrentRoute();
    return (r?.params as { code?: string } | undefined)?.code ?? null;
  })();

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    if (Date.now() - lastSent.current < COOLDOWN_MS) return;
    lastSent.current = Date.now();
    setText('');
    if (isDemoMode) {
      setMsgs((m) => [...m, { id: String(Date.now()), uid: uid ?? '', username, text: t, at: Date.now() }]);
      return;
    }
    try {
      await api.sendChat(username, t);
    } catch (e) {
      setText(t);
      Alert.alert('Chat', api.errorMessage(e));
    }
  };

  const joinFrom = async (code: string) => {
    try {
      if (!isDemoMode) await api.joinLobby(code);
      setOpen(false);
      navRef.navigate('Lobby', { code, host: false });
    } catch (e) {
      Alert.alert('Could not join lobby', api.errorMessage(e));
    }
  };

  if (!active) return null;

  const panelTop = insets.top + 8;
  const panelHeight = Math.min(height * 0.52, 420);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {open && (
        <View style={[styles.panel, { top: panelTop, height: panelHeight }]}>
          <View style={styles.panelHead}>
            <Text style={styles.panelTitle}>Public chat</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>
          <Text style={styles.hint}>Find players here, then send them your lobby ID.</Text>

          <FlatList
            data={[...msgs].reverse()}
            inverted
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ paddingVertical: 6 }}
            ListEmptyComponent={<Text style={styles.empty}>No messages yet. Say hi!</Text>}
            renderItem={({ item }) => {
              const mine = item.uid === uid;
              const code = item.text.match(CODE_RE)?.[0];
              return (
                <View style={[styles.msg, mine && styles.msgMine]}>
                  <Text style={styles.msgName}>{mine ? 'You' : item.username}</Text>
                  <Text style={styles.msgText}>{item.text}</Text>
                  {code && !mine && (
                    <Pressable onPress={() => joinFrom(code)} style={styles.joinChip}>
                      <Text style={styles.joinChipText}>Join lobby {code}</Text>
                    </Pressable>
                  )}
                </View>
              );
            }}
          />

          {lobbyCode && (
            <Pressable onPress={() => setText(`Join my lobby: ${lobbyCode}`)} style={styles.shareChip}>
              <Text style={styles.joinChipText}>Share my lobby ID ({lobbyCode})</Text>
            </Pressable>
          )}
          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Message everyone…"
              placeholderTextColor={colors.muted}
              maxLength={api.CHAT_MAX}
              style={styles.input}
              onSubmitEditing={send}
              returnKeyType="send"
            />
            <Pressable onPress={send} style={styles.sendBtn} accessibilityRole="button" accessibilityLabel="Send">
              <Ionicons name="send" size={18} color={colors.bg} />
            </Pressable>
          </View>
        </View>
      )}

      <Animated.View
        {...pan.panHandlers}
        style={[styles.bubble, { transform: pos.getTranslateTransform() }]}
        accessibilityRole="button"
        accessibilityLabel="Public chat"
      >
        <Ionicons name={open ? 'chevron-down' : 'chatbubbles'} size={26} color={colors.bg} />
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: colors.accent,
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  panel: {
    position: 'absolute',
    left: 12,
    right: 12,
    ...space.glass,
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    elevation: 6,
  },
  panelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 12, marginBottom: 4 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 20, transform: [{ scaleY: -1 }] },
  msg: {
    backgroundColor: space.cardAlt,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 3,
    alignSelf: 'flex-start',
    maxWidth: '88%',
  },
  msgMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#4B3FB5',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  msgName: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  msgText: { color: colors.text, fontSize: 14 },
  joinChip: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  shareChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 6,
  },
  joinChipText: { color: colors.bg, fontSize: 12, fontWeight: '700' },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: space.input,
    borderWidth: 1,
    borderColor: space.border,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: colors.text,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});