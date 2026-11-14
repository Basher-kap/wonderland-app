import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';

type Props = { size?: number; wordmark?: boolean; tagline?: boolean };

// "The Keyhole Emblem": a keyhole (the door into Wonderland) ringed by three
// card-suit badges, one per domain: spade = Logic, club = Experience, heart = Chance.
export function Logo({ size = 160, wordmark = false, tagline = false }: Props) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Circle cx={100} cy={100} r={80} fill="#3C3489" />
        <Circle cx={100} cy={100} r={66} fill="none" stroke="#AFA9EC" strokeWidth={1} strokeDasharray="3 5" />
        <Circle cx={100} cy={90} r={18} fill="#FAEEDA" />
        <Path d="M92 104 L108 104 L116 146 L84 146 Z" fill="#FAEEDA" />

        <Circle cx={100} cy={20} r={16} fill="#FAEEDA" stroke="#3C3489" strokeWidth={3} />
        <Circle cx={31} cy={140} r={16} fill="#FAEEDA" stroke="#3C3489" strokeWidth={3} />
        <Circle cx={169} cy={140} r={16} fill="#FAEEDA" stroke="#3C3489" strokeWidth={3} />

        <SvgText x={100} y={28} fontSize={22} textAnchor="middle" fill="#26215C">♠</SvgText>
        <SvgText x={31} y={148} fontSize={22} textAnchor="middle" fill="#0F6E56">♣</SvgText>
        <SvgText x={169} y={148} fontSize={22} textAnchor="middle" fill="#A32D2D">♥</SvgText>
      </Svg>

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
