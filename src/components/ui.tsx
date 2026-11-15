import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, Domain, domainInfo, radius } from '../theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ label, onPress, variant = 'primary', disabled, style }: ButtonProps) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.primary : styles.secondary,
        pressed && { opacity: 0.8 },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <Text style={[styles.buttonText, { color: primary ? colors.bg : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

// The icon of a domain: brain = Logic, world = Experience, dice = Chance (set in theme.ts).
export function DomainIcon({ domain, size = 18, color }: { domain: Domain; size?: number; color?: string }) {
  const d = domainInfo[domain];
  return <MaterialCommunityIcons name={d.icon} size={size} color={color ?? d.color} />;
}

// A domain icon followed by a value, e.g. the points earned in that domain.
export function DomainStat({
  domain,
  value,
  size = 14,
  color,
}: {
  domain: Domain;
  value: string | number;
  size?: number;
  color?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <DomainIcon domain={domain} size={size + 3} color={color} />
      <Text style={{ color: color ?? colors.muted, fontSize: size }}>{value}</Text>
    </View>
  );
}

export function DomainBadge({ domain }: { domain: Domain }) {
  const d = domainInfo[domain];
  return (
    <View style={[styles.badge, { borderColor: d.color }]}>
      <DomainIcon domain={domain} size={16} />
      <Text style={{ color: d.color, fontSize: 13, fontWeight: '600' }}>{d.label}</Text>
    </View>
  );
}

export function TicketChip({ tickets }: { tickets: number }) {
  return (
    <View style={styles.ticket}>
      <Text style={{ color: colors.accent, fontWeight: '600' }}>🎟 {tickets}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  buttonText: { fontSize: 16, fontWeight: '600' },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ticket: {
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
