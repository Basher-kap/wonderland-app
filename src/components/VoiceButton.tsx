import React from 'react';
import { Alert, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { isDemoMode } from '../lib/firebase';
import { colors } from '../theme';
import { useVoice } from '../voice/useVoice';
import { voice } from '../voice/voice';

// The mic of a lobby: a small floating control, shown in the lobby and in every game.
//   off      -> tap "Join voice" (the phone asks for the microphone)
//   on       -> tap the mic to mute / unmute, the X to leave the voice chat
// It floats in the top-right corner; pass `style` to move it. Nothing shows without a lobby.
export function VoiceButton({ code, style }: { code?: string; style?: StyleProp<ViewStyle> }) {
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
