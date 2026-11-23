import React from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Line, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import { RUINS_BG_IMAGE, ruins } from './theme';

type Props = { children?: React.ReactNode };

export const FLOOR_H = 34; // the rubble along the bottom edge: games keep clear of it

// The scene is drawn once in a 400 x 800 box and scaled to fill the screen (`slice`: the edges are
// cropped, never stretched), so it looks the same on a tall phone and a tablet.
const W = 400;
const H = 800;

const STRIPES = Array.from({ length: 15 }, (_, i) => i);
// The flowers of the faded wallpaper: only some are left.
const FLOWERS = [
  [26, 110], [82, 250], [138, 60], [194, 330], [250, 170], [306, 420], [362, 90],
  [26, 520], [138, 600], [250, 540], [362, 640], [82, 700], [306, 300], [194, 470],
] as const;
// Bullet holes: a dark dot with a few hairline cracks.
const HOLES = [
  { x: 64, y: 190, s: 1 }, { x: 78, y: 207, s: 0.8 }, { x: 334, y: 380, s: 1.1 },
  { x: 318, y: 402, s: 0.8 }, { x: 352, y: 410, s: 0.7 }, { x: 40, y: 560, s: 0.9 },
] as const;
const ASH = [
  [30, 140], [120, 90], [210, 200], [290, 120], [350, 260], [70, 330], [180, 410], [330, 520],
  [110, 590], [240, 650], [60, 710], [300, 730], [200, 60], [380, 40], [150, 480],
] as const;
// Rubble on the floor: [x, width, height, colour index]
const RUBBLE = [
  [0, 46, 26, 0], [38, 30, 18, 1], [64, 54, 30, 2], [112, 34, 20, 3], [140, 60, 24, 0],
  [196, 36, 16, 2], [226, 52, 28, 1], [272, 40, 20, 3], [306, 58, 32, 0], [358, 42, 22, 2],
] as const;

// The ruins of an old house after a war, for the whole Light Bulb screen and its rules dialogs: faded
// striped wallpaper, a wall with the plaster blown off, a broken window throwing a pale light, bullet
// holes, an empty crooked picture frame, ash in the air and rubble on the floor.
export function RuinsBackground({ children }: Props) {
  if (RUINS_BG_IMAGE) {
    return (
      <ImageBackground source={RUINS_BG_IMAGE} resizeMode="cover" style={styles.root}>
        {children}
      </ImageBackground>
    );
  }
  return (
    <View style={styles.root}>
      <Svg
        style={StyleSheet.absoluteFill}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        pointerEvents="none"
      >
        <Defs>
          <RadialGradient id="lb-vignette" cx="50%" cy="46%" r="75%">
            <Stop offset="0.45" stopColor="#000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000" stopOpacity="0.72" />
          </RadialGradient>
          {/* where the plaster has fallen off the right-hand wall */}
          <ClipPath id="lb-hole">
            <Polygon points="400,250 352,262 338,300 360,330 330,372 352,408 322,452 348,500 400,520" />
          </ClipPath>
        </Defs>

        {/* the wall and the faded wallpaper */}
        <Rect x={0} y={0} width={W} height={H} fill={ruins.wall} />
        {STRIPES.map((i) => (
          <Rect key={i} x={i * 28} y={0} width={14} height={H} fill={ruins.wallStripe} />
        ))}
        {FLOWERS.map(([x, y], i) => (
          <G key={i} opacity={0.55}>
            <Circle cx={x} cy={y} r={5} fill={ruins.wallpaperFlower} />
            <Circle cx={x - 6} cy={y + 5} r={3} fill={ruins.wallpaperFlower} />
            <Circle cx={x + 6} cy={y + 5} r={3} fill={ruins.wallpaperFlower} />
          </G>
        ))}
        {/* smoke stains creeping down from the ceiling */}
        <Path d="M0 0 H400 V70 Q340 130 280 84 Q220 150 150 96 Q80 150 0 88 Z" fill={ruins.soot} opacity={0.55} />
        <Path d="M120 0 V210 Q128 240 140 210 V0 Z" fill={ruins.soot} opacity={0.2} />
        <Path d="M290 0 V260 Q300 300 312 250 V0 Z" fill={ruins.soot} opacity={0.18} />

        {/* torn plaster: brick showing through on the right, bare lath at the left edge */}
        <Polygon points="400,250 352,262 338,300 360,330 330,372 352,408 322,452 348,500 400,520" fill={ruins.plaster} />
        <G clipPath="url(#lb-hole)">
          {Array.from({ length: 14 }, (_, row) =>
            Array.from({ length: 6 }, (_, col) => (
              <Rect
                key={`${row}-${col}`}
                x={316 + col * 24 + (row % 2 ? -12 : 0)}
                y={248 + row * 20}
                width={22}
                height={18}
                fill={(row + col) % 3 === 0 ? ruins.brickDark : ruins.brick}
              />
            ))
          )}
        </G>
        <Polygon
          points="400,250 352,262 338,300 360,330 330,372 352,408 322,452 348,500 400,520"
          fill="none"
          stroke={ruins.plasterDark}
          strokeWidth={4}
        />
        {Array.from({ length: 7 }, (_, i) => (
          <Rect key={i} x={0} y={470 + i * 11} width={34 - (i % 3) * 8} height={5} fill={ruins.lath} />
        ))}

        {/* bullet holes */}
        {HOLES.map((h, i) => (
          <G key={i}>
            <Line x1={h.x} y1={h.y} x2={h.x + 14 * h.s} y2={h.y - 9 * h.s} stroke={ruins.soot} strokeWidth={1} opacity={0.7} />
            <Line x1={h.x} y1={h.y} x2={h.x - 12 * h.s} y2={h.y - 6 * h.s} stroke={ruins.soot} strokeWidth={1} opacity={0.7} />
            <Line x1={h.x} y1={h.y} x2={h.x + 4 * h.s} y2={h.y + 13 * h.s} stroke={ruins.soot} strokeWidth={1} opacity={0.7} />
            <Circle cx={h.x} cy={h.y} r={4 * h.s} fill={ruins.plasterDark} />
            <Circle cx={h.x} cy={h.y} r={2.6 * h.s} fill={ruins.soot} />
          </G>
        ))}

        {/* the broken window, top-left, and the pale light that falls from it */}
        <Polygon points="30,0 150,0 370,708 210,708" fill={ruins.light} />
        <Rect x={22} y={26} width={92} height={118} fill={ruins.soot} />
        <Rect x={22} y={26} width={92} height={118} fill="none" stroke={ruins.plasterDark} strokeWidth={6} />
        <Line x1={68} y1={26} x2={68} y2={144} stroke={ruins.plasterDark} strokeWidth={5} />
        <Line x1={22} y1={85} x2={114} y2={85} stroke={ruins.plasterDark} strokeWidth={5} />
        <Polygon points="25,29 66,29 25,70" fill="#8C939A" opacity={0.35} />
        <Polygon points="71,88 111,88 111,141 92,128" fill="#8C939A" opacity={0.28} />
        <Polygon points="71,29 111,29 96,58 82,44" fill="#8C939A" opacity={0.3} />
        {/* a curtain, torn to ribbons */}
        <Path d="M8 14 V120 L18 104 L22 150 L30 96 L36 130 L40 14 Z" fill="#4D3B34" opacity={0.9} />

        {/* an empty picture frame, hanging crooked, the glass cracked */}
        <G rotation={-9} originX={262} originY={110} origin="262, 110">
          <Rect x={226} y={70} width={72} height={86} fill={ruins.wallpaperFlower} stroke="#6A5436" strokeWidth={5} />
          <Rect x={236} y={80} width={52} height={66} fill={ruins.plasterDark} />
          <Line x1={236} y1={80} x2={288} y2={146} stroke={ruins.ash} strokeWidth={1} opacity={0.6} />
          <Line x1={262} y1={80} x2={248} y2={118} stroke={ruins.ash} strokeWidth={1} opacity={0.5} />
          <Line x1={288} y1={92} x2={254} y2={120} stroke={ruins.ash} strokeWidth={1} opacity={0.5} />
        </G>

        {/* the floor: dark boards, rubble, bricks */}
        <Rect x={0} y={H - 90} width={W} height={90} fill={ruins.floor} />
        <Rect x={0} y={H - 92} width={W} height={4} fill={ruins.plasterDark} />
        {RUBBLE.map(([x, w, h, c], i) => (
          <Polygon
            key={i}
            points={`${x},${H} ${x + w * 0.18},${H - h} ${x + w * 0.62},${H - h * 0.8} ${x + w},${H}`}
            fill={ruins.rubble[c]}
          />
        ))}
        <Rect x={84} y={H - 44} width={26} height={9} fill={ruins.brick} rotation={-12} origin="97, 756" />
        <Rect x={330} y={H - 38} width={30} height={9} fill={ruins.brickDark} rotation={9} origin="345, 762" />

        {/* ash in the air */}
        {ASH.map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.8 : 1.1} fill={ruins.ash} opacity={0.35} />
        ))}

        {/* darken the corners so the eye stays on the middle */}
        <Rect x={0} y={0} width={W} height={H} fill="url(#lb-vignette)" />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ruins.wall, overflow: 'hidden' },
});
