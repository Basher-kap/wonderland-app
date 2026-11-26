import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { den, shieldColors } from './theme';

// A mysterious gambler, only a silhouette against the lamp light. Five shapes (hat, bald, hood, cap, slicked
// hair); a player keeps theirs for the whole game. `dead` crosses them out; `aimed` puts a red ring on them.
export function Silhouette({ size = 44, variant, dead, aimed, shield }: { size?: number; variant: number; dead?: boolean; aimed?: boolean; shield?: boolean }) {
  const rim = dead ? den.blood : den.goldDim;
  const fill = dead ? '#1A0A0B' : '#0A0605';
  const head = (() => {
    switch (variant % 5) {
      case 0: // fedora
        return (
          <G>
            <Circle cx={30} cy={28} r={12} fill={fill} stroke={rim} strokeWidth={1.5} />
            <Ellipse cx={30} cy={20} rx={19} ry={4.5} fill={fill} stroke={rim} strokeWidth={1.5} />
            <Path d="M19 20 Q20 6 30 6 Q40 6 41 20 Z" fill={fill} stroke={rim} strokeWidth={1.5} />
          </G>
        );
      case 1: // bald
        return <Circle cx={30} cy={25} r={13} fill={fill} stroke={rim} strokeWidth={1.5} />;
      case 2: // hood
        return <Path d="M14 44 Q12 8 30 8 Q48 8 46 44 Q38 34 30 34 Q22 34 14 44 Z" fill={fill} stroke={rim} strokeWidth={1.5} />;
      case 3: // flat cap
        return (
          <G>
            <Circle cx={30} cy={28} r={12} fill={fill} stroke={rim} strokeWidth={1.5} />
            <Path d="M17 22 Q30 8 43 22 L48 24 Q30 20 17 24 Z" fill={fill} stroke={rim} strokeWidth={1.5} />
          </G>
        );
      default: // slicked hair and glasses
        return (
          <G>
            <Circle cx={30} cy={26} r={12.5} fill={fill} stroke={rim} strokeWidth={1.5} />
            <Path d="M18 22 Q30 8 42 22 Q30 16 18 22 Z" fill={rim} opacity={0.5} />
            <Rect x={21} y={25} width={7} height={4} rx={1.5} fill="none" stroke={rim} strokeWidth={1} />
            <Rect x={32} y={25} width={7} height={4} rx={1.5} fill="none" stroke={rim} strokeWidth={1} />
          </G>
        );
    }
  })();
  return (
    <Svg width={size} height={size * 1.15} viewBox="0 0 60 69" opacity={dead ? 0.55 : 1}>
      <Path d="M4 69 Q6 46 30 44 Q54 46 56 69 Z" fill={fill} stroke={rim} strokeWidth={1.5} />
      {head}
      {dead && <Path d="M16 18 L44 52 M44 18 L16 52" stroke={den.bloodBright} strokeWidth={3.5} strokeLinecap="round" />}
      {aimed && <Circle cx={30} cy={34} r={28} fill="none" stroke={den.bloodBright} strokeWidth={2.5} strokeDasharray="6 4" />}
      {shield && (
        <G>
          <Circle cx={30} cy={36} r={31} fill={shieldColors.glow} />
          <Circle cx={30} cy={36} r={30} fill="none" stroke={shieldColors.teal} strokeWidth={2.5} />
          <Circle cx={30} cy={36} r={25} fill="none" stroke={shieldColors.blue} strokeWidth={1} strokeDasharray="3 3" />
        </G>
      )}
    </Svg>
  );
}
