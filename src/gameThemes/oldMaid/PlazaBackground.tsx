import React from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Pattern, Polygon, Rect, Stop } from 'react-native-svg';
import { Flower } from './OldMaidArt';
import { PLAZA_BG_IMAGE, plaza } from './theme';

type Props = { children?: React.ReactNode };

// The scene is drawn once in a 400 x 800 box and scaled to fill the screen (`slice`: the edges are
// cropped, never stretched).
const W = 400;
const H = 800;

const ARCHES = [20, 120, 220, 320];
const TREES = [
  { x: 36, y: 330, r: 42 },
  { x: 366, y: 322, r: 46 },
];
const BEDS = [
  { x: 70, c: plaza.petalRed },
  { x: 118, c: plaza.petalPink },
  { x: 166, c: plaza.petalYellow },
  { x: 234, c: plaza.petalPurple },
  { x: 282, c: plaza.petalRed },
  { x: 330, c: plaza.petalPink },
];

// A Spanish plaza on a warm afternoon, for the whole Old Maid screen and its rules dialogs: sky and
// sun, a whitewashed arcade with terracotta roofs, orange trees, a tiled fountain, flower beds, and a
// tiled path where the players sit.
export function PlazaBackground({ children }: Props) {
  if (PLAZA_BG_IMAGE) {
    return (
      <ImageBackground source={PLAZA_BG_IMAGE} resizeMode="cover" style={styles.root}>
        {children}
      </ImageBackground>
    );
  }
  return (
    <View style={styles.root}>
      <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" pointerEvents="none">
        <Defs>
          <LinearGradient id="om-sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={plaza.skyTop} />
            <Stop offset="1" stopColor={plaza.skyBottom} />
          </LinearGradient>
          <Pattern id="om-floor" width={40} height={40} patternUnits="userSpaceOnUse">
            <Rect width={40} height={40} fill={plaza.path} />
            <Polygon points="20,3 37,20 20,37 3,20" fill={plaza.tileWhite} />
            <Polygon points="20,10 30,20 20,30 10,20" fill={plaza.tileBlue} />
            <Circle cx={20} cy={20} r={3.5} fill={plaza.tileYellow} />
            <Circle cx={0} cy={0} r={4} fill={plaza.pathDark} />
            <Circle cx={40} cy={0} r={4} fill={plaza.pathDark} />
            <Circle cx={0} cy={40} r={4} fill={plaza.pathDark} />
            <Circle cx={40} cy={40} r={4} fill={plaza.pathDark} />
          </Pattern>
        </Defs>

        {/* sky and sun */}
        <Rect x={0} y={0} width={W} height={330} fill="url(#om-sky)" />
        <Circle cx={330} cy={70} r={52} fill="rgba(255,210,90,0.28)" />
        <Circle cx={330} cy={70} r={30} fill={plaza.sun} />

        {/* the arcade: whitewashed wall, terracotta roof, a row of arches */}
        <Rect x={0} y={190} width={W} height={150} fill={plaza.wall} />
        <Rect x={0} y={190} width={W} height={10} fill={plaza.wallShade} />
        <Path d={`M-10 192 L0 160 H${W} L${W + 10} 192 Z`} fill={plaza.roof} />
        {Array.from({ length: 20 }, (_, i) => (
          <Path key={i} d={`M${i * 21 - 4} 160 q10 -9 20 0`} stroke={plaza.roofDark} strokeWidth={3} fill="none" />
        ))}
        {ARCHES.map((x) => (
          <G key={x}>
            <Path d={`M${x} 340 V250 Q${x + 30} 205 ${x + 60} 250 V340 Z`} fill={plaza.arch} />
            <Path d={`M${x + 8} 340 V254 Q${x + 30} 220 ${x + 52} 254 V340 Z`} fill={plaza.shadowArch} opacity={0.55} />
          </G>
        ))}
        {/* a little bell tower behind the arcade */}
        <Rect x={172} y={92} width={56} height={70} fill={plaza.wall} />
        <Path d="M164 94 L200 56 L236 94 Z" fill={plaza.roof} />
        <Path d="M188 140 V112 Q200 100 212 112 V140 Z" fill={plaza.shadowArch} />

        {/* orange trees */}
        {TREES.map((t, i) => (
          <G key={i}>
            <Rect x={t.x - 5} y={t.y - 10} width={10} height={50} fill={plaza.trunk} />
            <Circle cx={t.x} cy={t.y - 28} r={t.r} fill={plaza.leaf} />
            <Circle cx={t.x - t.r * 0.45} cy={t.y - 14} r={t.r * 0.62} fill={plaza.leafDark} />
            <Circle cx={t.x + t.r * 0.4} cy={t.y - 40} r={t.r * 0.55} fill={plaza.leafLight} />
            {[[-14, -34], [12, -22], [-2, -50], [20, -44], [-24, -18]].map(([dx, dy], k) => (
              <Circle key={k} cx={t.x + dx} cy={t.y + dy} r={4.5} fill={plaza.orange} />
            ))}
          </G>
        ))}

        {/* the ground: a tiled path */}
        <Rect x={0} y={330} width={W} height={H - 330} fill="url(#om-floor)" />
        <Rect x={0} y={330} width={W} height={8} fill="rgba(0,0,0,0.12)" />

        {/* flower beds along the wall */}
        <Rect x={50} y={338} width={300} height={14} rx={6} fill={plaza.leafDark} />
        {BEDS.map((b, i) => (
          <Flower key={i} x={b.x} y={343} r={5} color={b.c} />
        ))}

        {/* the fountain: a round stone basin at the middle of the table, with water */}
        <G>
          <Circle cx={200} cy={500} r={118} fill={plaza.stoneDark} />
          <Circle cx={200} cy={500} r={108} fill={plaza.stone} />
          <Circle cx={200} cy={500} r={96} fill={plaza.water} />
          <Circle cx={200} cy={500} r={72} fill={plaza.waterDark} opacity={0.35} />
          <Circle cx={200} cy={500} r={48} fill={plaza.water} opacity={0.6} />
          <Rect x={194} y={470} width={12} height={34} fill={plaza.stone} />
          <Circle cx={200} cy={468} r={10} fill={plaza.stoneDark} />
          {[-26, -13, 0, 13, 26].map((dx) => (
            <Path key={dx} d={`M200 462 Q${200 + dx * 1.4} 436 ${200 + dx * 2} 474`} stroke="#E8FAFF" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.85} />
          ))}
        </G>

        {/* soft afternoon light from the top right, and a gentle edge shade */}
        <Polygon points="400,0 400,520 120,800 250,800 400,640" fill="rgba(255,236,170,0.12)" />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: plaza.skyBottom } });
