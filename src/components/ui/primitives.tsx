import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, Domain, domainInfo, space } from '../../theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: ViewStyle;
  /**
   * 'default' is the look the games already use (Wordle, Human Calculator, Janken, GameScreen): do not change it.
   * 'space' is the look of the main pages on the night sky.
   */
  tone?: 'default' | 'space';
};

export function Button({ label, onPress, variant = 'primary', disabled, style, tone = 'default' }: ButtonProps) {
  const primary = variant === 'primary';
  const sp = tone === 'space';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        sp ? (primary ? styles.spPrimary : styles.spSecondary) : primary ? styles.primary : styles.secondary,
        pressed && (sp && !primary ? { backgroundColor: space.pressedBg } : { opacity: 0.8 }),
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          { color: sp ? (primary ? '#000000' : space.text) : primary ? colors.bg : colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// The icon of a domain: brain = Logic, world = Experience, dice = Chance (set in theme/base.ts).
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

// The tickets of the player, as a small ticket: a stub with a perforation and a notch on each side.
// Main pages only (Home).
export function TicketChip({ tickets }: { tickets: number }) {
  return (
    <View style={styles.chip} accessible accessibilityLabel={`${tickets} tickets`}>
      <MaterialCommunityIcons name="ticket-confirmation-outline" size={17} color={space.amber} />
      <View style={styles.chipPerf}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.chipDot} />
        ))}
      </View>
      <Text style={styles.chipCount}>{tickets}</Text>
      <View style={[styles.chipNotch, { left: -6 }]} />
      <View style={[styles.chipNotch, { right: -6 }]} />
    </View>
  );
}

// A bigger ticket for Settings: the words on the left, a perforated edge, the number on the right.
export function TicketStub({ tickets, title, hint }: { tickets: number; title: string; hint: string }) {
  return (
    <View style={styles.stub} accessible accessibilityLabel={`${title}: ${tickets}. ${hint}`}>
      <View style={styles.stubMain}>
        <Text style={styles.stubTitle}>{title}</Text>
        <Text style={styles.stubHint}>{hint}</Text>
      </View>
      <View style={styles.stubPerf}>
        {Array.from({ length: 9 }, (_, i) => (
          <View key={i} style={styles.stubDash} />
        ))}
      </View>
      <View style={styles.stubCount}>
        <Text style={styles.stubNumber}>{tickets}</Text>
      </View>
      <View style={[styles.stubNotch, { top: -8, right: STUB_COUNT_W - 8 }]} />
      <View style={[styles.stubNotch, { bottom: -8, right: STUB_COUNT_W - 8 }]} />
    </View>
  );
}

const STUB_COUNT_W = 88;

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---- default tone: the look the games already use. Literal values on purpose, so a change to the
  // Space theme can never reach a game.
  primary: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  secondary: {
    backgroundColor: 'rgba(38, 33, 92, 0.84)',
    borderColor: 'rgba(130, 120, 230, 0.5)',
    borderTopColor: 'rgba(210, 200, 255, 0.4)',
    borderWidth: 1,
  },

  // ---- space tone
  spPrimary: {
    backgroundColor: space.amber,
    shadowColor: space.amber,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  spSecondary: {
    backgroundColor: space.fieldBg,
    borderWidth: 1,
    borderColor: space.lineStrong,
    borderTopColor: space.rim,
  },

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

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: space.panelBg,
    borderWidth: 1,
    borderColor: space.amberLine,
  },
  chipPerf: { gap: 2.5 },
  chipDot: { width: 1.5, height: 1.5, borderRadius: 1, backgroundColor: space.amberLine },
  chipCount: { color: space.amber, fontWeight: '700', fontSize: 15 },
  chipNotch: {
    position: 'absolute',
    top: '50%',
    marginTop: -5,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: space.void,
    borderWidth: 1,
    borderColor: space.amberLine,
  },

  stub: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 76,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: space.panelBg,
    borderWidth: 1,
    borderColor: space.amberLine,
  },
  stubMain: { flex: 1, paddingVertical: 14, paddingHorizontal: 16, justifyContent: 'center', gap: 2 },
  stubTitle: { color: space.text, fontSize: 15, fontWeight: '600' },
  stubHint: { color: space.textDim, fontSize: 12, lineHeight: 17 },
  stubPerf: { width: 2, alignItems: 'center', justifyContent: 'space-evenly', paddingVertical: 6 },
  stubDash: { width: 1.5, height: 4, borderRadius: 1, backgroundColor: space.amberLine },
  stubCount: { width: STUB_COUNT_W, alignItems: 'center', justifyContent: 'center', backgroundColor: space.amberWash },
  stubNumber: { color: space.amber, fontSize: 34, fontWeight: '700' },
  stubNotch: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: space.void,
    borderWidth: 1,
    borderColor: space.amberLine,
  },
});