import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { isDemoMode } from '../lib/firebase';
import { colors } from '../theme';
import { space } from '../spaceTheme';
import { useVoice } from '../voice/useVoice';
import { voice } from '../voice/voice';

// The mic of a lobby: a small floating control, shown in the lobby and in every game.
//   off      -> tap "Join voice" (the phone asks for the microphone)
//   on       -> tap the mic to mute / unmute, the X to leave the voice chat
// It floats in the top-right corner; pass `style` to move it. Nothing shows without a lobby.
// tone: 'default' is the look used inside the games (leave it). 'space' is the look on the night sky (the lobby).
export function VoiceButton({
  code,
  style,
  tone = 'default',
}: {
  code?: string;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'space';
}) {
  const { uid } = useAuth();
  const v = useVoice();
  if (!code || isDemoMode) return null;

  const mine = v.code === code;
  const status = mine ? v.status : 'off';
  const peerList = mine ? Object.values(v.peers) : [];
  const connected = peerList.filter((s) => s === 'connected').length;

  const join = async () => {
    if (!uid) return;
    await voice.join(code, uid);
    const after = voice.getState();
    if (after.status === 'error' && after.error) Alert.alert('Voice chat', after.error);
  };

  if (tone === 'space') {
    return (
      <View pointerEvents="box-none" style={[styles.wrap, style]}>
        {status === 'on' ? (
          <View style={sp.pill}>
            <View style={sp.micSlot}>
              {!v.muted && <Pulse />}
              <Pressable
                onPress={voice.toggleMute}
                style={[sp.round, v.muted ? sp.roundMuted : sp.roundLive]}
                accessibilityRole="button"
                accessibilityLabel={v.muted ? 'Unmute microphone' : 'Mute microphone'}
              >
                <MaterialCommunityIcons
                  name={v.muted ? 'microphone-off' : 'microphone'}
                  size={20}
                  color={v.muted ? space.danger : '#000000'}
                />
              </Pressable>
            </View>
            <Text style={sp.count} accessibilityLabel={`${connected} of ${peerList.length} connected`}>
              {connected}/{peerList.length}
            </Text>
            <Pressable
              onPress={() => voice.leave()}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Leave voice chat"
            >
              <MaterialCommunityIcons name="close" size={18} color={space.textDim} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={join}
            disabled={status === 'starting'}
            style={({ pressed }) => [sp.pill, pressed && { backgroundColor: space.pressedBg }]}
            accessibilityRole="button"
            accessibilityLabel="Join voice chat"
          >
            <MaterialCommunityIcons name="microphone-outline" size={20} color={space.amber} />
            <Text style={sp.label}>{status === 'starting' ? 'Connecting…' : 'Join voice'}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View pointerEvents="box-none" style={[styles.wrap, style]}>
      {status === 'on' ? (
        <View style={styles.pill}>
          <Pressable
            onPress={voice.toggleMute}
            style={[styles.round, { backgroundColor: v.muted ? colors.danger : colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel={v.muted ? 'Unmute microphone' : 'Mute microphone'}
          >
            <MaterialCommunityIcons name={v.muted ? 'microphone-off' : 'microphone'} size={20} color={colors.bg} />
          </Pressable>
          <Text style={styles.count}>
            {connected}/{peerList.length}
          </Text>
          <Pressable onPress={() => voice.leave()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Leave voice chat">
            <MaterialCommunityIcons name="close" size={20} color={colors.muted} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={join}
          disabled={status === 'starting'}
          style={styles.pill}
          accessibilityRole="button"
          accessibilityLabel="Join voice chat"
        >
          <MaterialCommunityIcons name="microphone-outline" size={20} color={colors.accent} />
          <Text style={styles.label}>{status === 'starting' ? 'Connecting…' : 'Join voice'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 8, right: 12, zIndex: 50, alignItems: 'flex-end' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  round: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.text, fontSize: 13, fontWeight: '600' },
  count: { color: colors.text, fontSize: 13, fontWeight: '600' },
});

// A ring that spreads out from the mic while it is live. Stays still when the phone has "reduce motion" on.
function Pulse() {
  const a = useRef(new Animated.Value(0)).current;
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduce)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.timing(a, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [a, reduce]);
  if (reduce) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        sp.pulse,
        {
          opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
          transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
        },
      ]}
    />
  );
}

const sp = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    backgroundColor: 'rgba(3, 4, 9, 0.86)',
    borderColor: space.line,
    borderTopColor: space.rim,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  micSlot: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  round: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  roundLive: { backgroundColor: space.amber },
  roundMuted: { backgroundColor: 'transparent', borderWidth: 1, borderColor: space.danger },
  pulse: { position: 'absolute', width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: space.amber },
  label: { color: space.text, fontSize: 14, fontWeight: '600' },
  count: { color: space.textDim, fontSize: 13, fontWeight: '600' },
});