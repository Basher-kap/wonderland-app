import React from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Candle } from './CandleArt';
import { SEANCE_BG_IMAGE, seance } from './theme';

type Props = { children?: React.ReactNode };

export const FLOOR_H = 62; // the table edge along the bottom, with its candles: games keep clear of it

// The scene is drawn once in a 400 x 800 box and scaled to fill the screen (`slice`: the edges are
// cropped, never stretched), so it looks the same on a tall phone and a tablet.
const W = 400;
const H = 800;

const DAMASK = Array.from({ length: 10 }, (_, r) => Array.from({ length: 8 }, (_, c) => [c * 56 + (r % 2 ? 28 : 0), r * 84 + 30] as const)).flat();
// Runes worked into the cloth, around the circle: just small marks, no real script.
const RUNES = Array.from({ length: 16 }, (_, i) => {
  const a = (Math.PI * 2 * i) / 16;
  return { x: 200 + Math.cos(a) * 214, y: 470 + Math.sin(a) * 214, a: (a * 180) / Math.PI, k: i % 3 };
});
const TASSELS = [30, 62] as const;

// A séance chamber, for the whole Memory Card screen and its rules dialogs: damask wallpaper gone dark,
// velvet drapes, a moon in a tall window, and a round table under an indigo cloth with a circle of
// runes. Three candles burn on the table edge; they are the only light in the room.
export function SeanceBackground({ children }: Props) {
  if (SEANCE_BG_IMAGE) {
    return (
      <ImageBackground source={SEANCE_BG_IMAGE} resizeMode="cover" style={styles.root}>
        {children}
      </ImageBackground>
    );
  }
  return (
    <View style={styles.root}>
      <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" pointerEvents="none">
        <Defs>
          <RadialGradient id="mc-vignette" cx="50%" cy="52%" r="72%">
            <Stop offset="0.4" stopColor="#000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000" stopOpacity="0.78" />
          </RadialGradient>
          <RadialGradient id="mc-candlelight" cx="50%" cy="100%" r="60%">
            <Stop offset="0" stopColor="#FFB347" stopOpacity="0.20" />
            <Stop offset="1" stopColor="#FFB347" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* the wall */}
        <Rect x={0} y={0} width={W} height={H} fill={seance.wall} />
        {DAMASK.map(([x, y], i) => (
          <G key={i} opacity={0.5}>
            <Polygon points={`${x},${y - 14} ${x + 8},${y} ${x},${y + 14} ${x - 8},${y}`} fill={seance.wallDamask} />
            <Circle cx={x} cy={y + 24} r={3} fill={seance.wallDamask} />
          </G>
        ))}

        {/* the tall window with the moon, behind the clock row */}
        <Path d="M150 190 V70 Q150 20 200 20 Q250 20 250 70 V190 Z" fill="#0B0A14" stroke={seance.goldDim} strokeWidth={4} />
        <Line x1={200} y1={20} x2={200} y2={190} stroke={seance.goldDim} strokeWidth={3} />
        <Line x1={150} y1={100} x2={250} y2={100} stroke={seance.goldDim} strokeWidth={3} />
        <Circle cx={222} cy={64} r={19} fill={seance.moon} />
        <Circle cx={231} cy={58} r={17} fill="#0B0A14" />
        <Circle cx={170} cy={140} r={1.6} fill={seance.moon} opacity={0.8} />
        <Circle cx={236} cy={150} r={1.2} fill={seance.moon} opacity={0.7} />
        <Polygon points="150,190 250,190 330,640 70,640" fill={seance.moonGlow} />

        {/* the velvet drapes, tied back with a tassel */}
        {[0, 1].map((side) => {
          const flip = side === 1;
          const x = (v: number) => (flip ? W - v : v);
          return (
            <G key={side}>
              <Path d={`M${x(0)} 0 H${x(96)} Q${x(70)} 200 ${x(52)} 330 Q${x(66)} 400 ${x(34)} 800 H${x(0)} Z`} fill={seance.velvet} />
              {[18, 38, 58, 78].map((fx, k) => (
                <Path key={k} d={`M${x(fx)} 0 Q${x(fx - 6 + k * 3)} 300 ${x(fx - 14 + k * 2)} 800`} fill="none" stroke={k % 2 ? seance.velvetLight : seance.velvetDark} strokeWidth={9} opacity={0.55} />
              ))}
              <Path d={`M${x(0)} 330 Q${x(30)} 350 ${x(52)} 332`} fill="none" stroke={seance.tassel} strokeWidth={5} />
              {TASSELS.map((ty, k) => (
                <Line key={k} x1={x(40 + k * 6)} y1={338} x2={x(40 + k * 6)} y2={338 + ty} stroke={seance.tassel} strokeWidth={3} />
              ))}
            </G>
          );
        })}
        {/* the valance along the top */}
        <Path d="M0 0 H400 V30 Q370 52 340 30 Q310 52 280 30 Q250 52 220 30 Q190 52 160 30 Q130 52 100 30 Q70 52 40 30 Q20 44 0 30 Z" fill={seance.velvetDark} />
        <Path d="M0 30 Q20 44 40 30 Q70 52 100 30 Q130 52 160 30 Q190 52 220 30 Q250 52 280 30 Q310 52 340 30 Q370 52 400 30" fill="none" stroke={seance.tassel} strokeWidth={2} />

        {/* the floor */}
        <Rect x={0} y={H - 40} width={W} height={40} fill={seance.floor} />

        {/* the round table: indigo cloth, lace edge, and the circle of runes */}
        <Circle cx={200} cy={470} r={262} fill={seance.clothDark} />
        <Circle cx={200} cy={470} r={248} fill={seance.cloth} />
        <Circle cx={200} cy={470} r={262} fill="none" stroke={seance.lace} strokeWidth={4} strokeDasharray="10 6" opacity={0.7} />
        <Circle cx={200} cy={470} r={236} fill="none" stroke={seance.rune} strokeWidth={1.5} opacity={0.8} />
        <Circle cx={200} cy={470} r={192} fill="none" stroke={seance.rune} strokeWidth={1} strokeDasharray="3 5" opacity={0.7} />
        {RUNES.map((r, i) => (
          <G key={i} rotation={r.a + 90} origin={`${r.x}, ${r.y}`} opacity={0.75}>
            {r.k === 0 && <Line x1={r.x} y1={r.y - 6} x2={r.x} y2={r.y + 6} stroke={seance.rune} strokeWidth={1.6} />}
            {r.k === 1 && <Path d={`M${r.x - 5} ${r.y - 6} L${r.x} ${r.y} L${r.x - 5} ${r.y + 6}`} fill="none" stroke={seance.rune} strokeWidth={1.6} />}
            {r.k === 2 && <Circle cx={r.x} cy={r.y} r={4} fill="none" stroke={seance.rune} strokeWidth={1.6} />}
          </G>
        ))}
        <Rect x={0} y={0} width={W} height={H} fill="url(#mc-candlelight)" />

        {/* darken the corners so the eye stays on the table */}
        <Rect x={0} y={0} width={W} height={H} fill="url(#mc-vignette)" />
      </Svg>

      {/* three candles on the table's edge: the only light in the room */}
      <Candle left="18%" bottom={14} height={26} seed={0} />
      <Candle left="50%" bottom={10} height={34} seed={1} />
      <Candle left="82%" bottom={14} height={24} seed={2} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: seance.wall, overflow: 'hidden' },
});
