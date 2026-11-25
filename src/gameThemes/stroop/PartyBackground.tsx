import React from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, Pattern, Rect } from 'react-native-svg';
import { Balloon, Garland } from './StroopArt';
import { PARTY_BG_IMAGE, party } from './theme';

type Props = { children?: React.ReactNode };

// The scene is drawn once in a 400 x 800 box and scaled to fill the screen (`slice`: the edges are
// cropped, never stretched).
const W = 400;
const H = 800;

// Confetti on the floor and in the air: hand-placed so it does not change from frame to frame.
const CONFETTI: [number, number, number, number][] = [
  // x, y, rotation, kind (0 round, 1 strip, 2 squiggle)
  [46, 150, 20, 1], [120, 118, 70, 0], [212, 170, 10, 2], [300, 132, 50, 1], [356, 214, 30, 0],
  [30, 300, 80, 2], [372, 340, 15, 1], [58, 420, 40, 0], [344, 470, 65, 2], [24, 560, 25, 1],
  [380, 600, 55, 0], [90, 640, 5, 2], [330, 660, 35, 1], [150, 700, 75, 0], [250, 690, 45, 2],
];
const CONFETTI_COLORS = [party.streamerPink, party.streamerMint, party.lavender, '#FFFFFF'];
const DOTS = Array.from({ length: 11 }, (_, r) => Array.from({ length: 9 }, (_, c) => [c * 48 + (r % 2 ? 24 : 0), r * 78 + 20] as const)).flat();

// A kid's birthday party, for the whole Stroop Effect screen and its rules dialogs: polka-dot lilac wall, paper
// streamers and a garland across the top, balloons on the edges, confetti, and a gingham tablecloth along the
// bottom. No red, blue, green, yellow, purple or orange here: those are the colors the players read.
export function PartyBackground({ children }: Props) {
  if (PARTY_BG_IMAGE) {
    return (
      <ImageBackground source={PARTY_BG_IMAGE} resizeMode="cover" style={styles.root}>
        {children}
      </ImageBackground>
    );
  }
  return (
    <View style={styles.root}>
      <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" pointerEvents="none">
        <Defs>
          <Pattern id="st-gingham" width={32} height={32} patternUnits="userSpaceOnUse">
            <Rect width={32} height={32} fill={party.clothLight} />
            <Rect width={16} height={32} fill={party.cloth} opacity={0.55} />
            <Rect width={32} height={16} fill={party.cloth} opacity={0.55} />
          </Pattern>
        </Defs>

        <Rect x={0} y={0} width={W} height={H} fill={party.wall} />
        {DOTS.map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={6} fill={party.wallDot} />
        ))}

        {/* paper streamers hanging in swoops from the top corners */}
        <Path d="M-10 0 Q120 90 210 18 T410 0" stroke={party.streamerPink} strokeWidth={9} fill="none" strokeLinecap="round" opacity={0.9} />
        <Path d="M-10 0 Q140 60 230 10 T410 0" stroke={party.streamerWhite} strokeWidth={5} fill="none" strokeLinecap="round" />
        <Path d="M-10 14 Q110 120 200 34 T410 16" stroke={party.streamerMint} strokeWidth={7} fill="none" strokeLinecap="round" opacity={0.9} />

        {/* the garland */}
        <Garland x1={-6} x2={W + 6} y={46} sag={16} count={13} colors={[party.streamerPink, party.streamerMint, '#FFFFFF', party.lavender]} />

        {/* balloons tied to the edges: half of them are cut off by the screen on purpose */}
        <Balloon x={14} y={250} r={26} color={party.balloonPink} lean={3} />
        <Balloon x={44} y={300} r={21} color={party.balloonMint} lean={-3} />
        <Balloon x={-6} y={330} r={22} color={party.balloonLilac} lean={2} />
        <Balloon x={386} y={170} r={26} color={party.balloonMint} lean={-3} />
        <Balloon x={358} y={218} r={21} color={party.balloonLilac} lean={3} />
        <Balloon x={408} y={250} r={22} color={party.balloonPink} lean={-2} />

        {/* the tablecloth */}
        <Rect x={0} y={640} width={W} height={160} fill="url(#st-gingham)" />
        <Path d={`M0 640 H${W} V652 Q${W * 0.875} 664 ${W * 0.75} 652 T${W * 0.5} 652 T${W * 0.25} 652 T0 652 Z`} fill={party.cloth} opacity={0.8} />

        {/* confetti */}
        {CONFETTI.map(([x, y, rot, kind], i) => {
          const c = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
          return (
            <G key={i} transform={`translate(${x} ${y}) rotate(${rot})`}>
              {kind === 0 ? <Circle r={4.5} fill={c} /> : kind === 1 ? <Rect x={-8} y={-3} width={16} height={6} rx={2} fill={c} /> : <Path d="M-9 0 q4.5 -8 9 0 t9 0" stroke={c} strokeWidth={3} fill="none" strokeLinecap="round" />}
            </G>
          );
        })}
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: party.wall } });
