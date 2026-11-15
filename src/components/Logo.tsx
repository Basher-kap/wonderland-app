import React from 'react';
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme';

type Props = { size?: number; wordmark?: boolean; tagline?: boolean };

// The three domain badges on the ring (position in the 200x200 drawing):
// brain = Logic (top), world = Experience (bottom left), dice = Chance (bottom right).
const BADGES = [
  { cx: 100, cy: 20, icon: 'brain', color: '#26215C' },
  { cx: 31, cy: 140, icon: 'earth', color: '#0F6E56' },
  { cx: 169, cy: 140, icon: 'dice-5', color: '#A32D2D' },
] as const;

// "The Keyhole Emblem": a keyhole (the door into Wonderland) ringed by the three domain badges.
export function Logo({ size = 160, wordmark = false, tagline = false }: Props) {
  const k = size / 200; // scale from the 200x200 drawing to the real size
  const iconSize = 20 * k;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Circle cx={100} cy={100} r={80} fill="#3C3489" />
          <Circle cx={100} cy={100} r={66} fill="none" stroke="#AFA9EC" strokeWidth={1} strokeDasharray="3 5" />
          <Circle cx={100} cy={90} r={18} fill="#FAEEDA" />
          <Path d="M92 104 L108 104 L116 146 L84 146 Z" fill="#FAEEDA" />

          {BADGES.map((b) => (
            <Circle key={b.icon} cx={b.cx} cy={b.cy} r={16} fill="#FAEEDA" stroke="#3C3489" strokeWidth={3} />
          ))}
        </Svg>

        {/* Icons are drawn on top of the badges. Too small to read under 60px, so skipped there. */}
        {size >= 60 &&
          BADGES.map((b) => (
            <View
              key={b.icon}
              style={{ position: 'absolute', left: b.cx * k - iconSize / 2, top: b.cy * k - iconSize / 2 }}
            >
              <MaterialCommunityIcons name={b.icon} size={iconSize} color={b.color} />
            </View>
          ))}
      </View>

      {wordmark && (
        <Text
          style={{
            color: colors.text,
            fontSize: Math.max(22, size * 0.2),
            fontWeight: '600',
            letterSpacing: 1,
            marginTop: 4,
          }}
        >
          Wonderland
        </Text>
      )}
      {tagline && (
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>
          Logic · Experience · Chance
        </Text>
      )}
    </View>
  );
}
