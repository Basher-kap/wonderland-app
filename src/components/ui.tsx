import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, Domain, domainInfo, radius } from '../theme';
import { space } from '../spaceTheme';

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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessible accessibilityLabel={`${tickets} tickets`}>
        <MaterialCommunityIcons name="ticket-confirmation" size={18} color={colors.accent} />
        <Text style={{ color: colors.accent, fontWeight: '600' }}>{tickets}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  secondary: { ...space.glass, borderWidth: 1 },
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
    backgroundColor: space.card,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(239, 159, 39, 0.5)',
    shadowColor: colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
});