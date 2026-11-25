import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, Path, Pattern, Polygon, Rect } from 'react-native-svg';
import { party } from './theme';

// ------------------------------------------------------------------ pieces for the background ----
type BalloonProps = { x: number; y: number; r: number; color: string; lean?: number };

// A balloon on a string (drawn inside an <Svg>): body, shine, knot and a wavy string.
export function Balloon({ x, y, r, color, lean = 0 }: BalloonProps) {
  const ry = r * 1.2;
  return (
    <G>
      <Path
        d={`M${x} ${y + ry + 6} q${-8 + lean} 26 ${6 + lean} 52 t${-4 - lean} 60`}
        stroke={party.string}
        strokeWidth={1.4}
        fill="none"
      />
      <Polygon points={`${x - 4},${y + ry + 7} ${x + 4},${y + ry + 7} ${x},${y + ry - 1}`} fill={color} />
      <Path d={`M${x} ${y - ry} C${x + r * 1.15} ${y - ry} ${x + r * 1.15} ${y + ry} ${x} ${y + ry} C${x - r * 1.15} ${y + ry} ${x - r * 1.15} ${y - ry} ${x} ${y - ry} Z`} fill={color} />
      <Path d={`M${x - r * 0.5} ${y - ry * 0.55} q${r * 0.1} ${-ry * 0.3} ${r * 0.45} ${-ry * 0.32}`} stroke="rgba(255,255,255,0.75)" strokeWidth={3} fill="none" strokeLinecap="round" />
    </G>
  );
}

// A garland of pennants along a sagging string.
export function Garland({ x1, x2, y, sag, count, colors }: { x1: number; x2: number; y: number; sag: number; count: number; colors: string[] }) {
  const w = x2 - x1;
  const at = (t: number) => ({ x: x1 + w * t, y: y + sag * 4 * t * (1 - t) });
  return (
    <G>
      <Path d={`M${x1} ${y} Q${x1 + w / 2} ${y + sag * 2} ${x2} ${y}`} stroke={party.string} strokeWidth={1.4} fill="none" />
      {Array.from({ length: count }, (_, i) => {
        const p = at((i + 0.5) / count);
        return <Polygon key={i} points={`${p.x - 11},${p.y} ${p.x + 11},${p.y} ${p.x},${p.y + 26}`} fill={colors[i % colors.length]} />;
      })}
    </G>
  );
}

// ------------------------------------------------------------------ the sign ----
// The chalkboard sign the word hangs on: two strings with a bit of tape each, a pink frame. `state` colours the
// frame for a moment after an answer.
export function Sign({ width, height, state, children }: { width: number; height: number; state?: 'good' | 'bad' | null; children?: React.ReactNode }) {
  const edge = state === 'good' ? party.good : state === 'bad' ? party.bad : party.signEdge;
  return (
    <View style={{ width, height: height + 38, alignItems: 'center' }}>
      <Svg width={width} height={44} viewBox={`0 0 ${width} 44`} style={{ position: 'absolute', top: 0 }}>
        <Line x1={width * 0.28} y1={0} x2={width * 0.28} y2={46} stroke={party.string} strokeWidth={1.6} />
        <Line x1={width * 0.72} y1={0} x2={width * 0.72} y2={46} stroke={party.string} strokeWidth={1.6} />
      </Svg>
      <View style={[s.sign, { width, height, borderColor: edge, marginTop: 38 }]}>
        <View style={[s.tape, { left: width * 0.28 - 18 }]} />
        <View style={[s.tape, { left: width * 0.72 - 18 }]} />
        {children}
      </View>
    </View>
  );
}

// ------------------------------------------------------------------ the candle (the timer) ----
// A striped birthday candle laid like a bar: it burns down from the right as time runs out. `left` is the share of
// time left (0..1); `flicker` (-1..1) moves the flame a little.
export function Candle({ width, left, flicker = 0 }: { width: number; left: number; flicker?: number }) {
  const H = 22;
  const FL = 30;
  const f = Number.isFinite(left) ? Math.max(0, Math.min(1, left)) : 0;
  const w = Math.max(6, (width - 24) * f);
  const tipX = 4 + w;
  const sway = (Number.isFinite(flicker) ? flicker : 0) * 2.5;
  return (
    <Svg width={width} height={H + FL} viewBox={`0 0 ${width} ${H + FL}`}>
      <Defs>
        <Pattern id="st-stripe" width={14} height={14} patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <Rect width={14} height={14} fill={party.wax} />
          <Rect width={7} height={14} fill={party.waxStripe} />
        </Pattern>
      </Defs>
      <Rect x={4} y={FL} width={w} height={H} rx={5} fill="url(#st-stripe)" stroke={party.ink} strokeWidth={2} />
      <Line x1={tipX} y1={FL} x2={tipX + sway * 0.4} y2={FL - 7} stroke={party.wick} strokeWidth={2.4} strokeLinecap="round" />
      <Path
        d={`M${tipX + sway} ${FL - 28} C${tipX + 9} ${FL - 17} ${tipX + 7} ${FL - 7} ${tipX + sway * 0.4} ${FL - 6} C${tipX - 7} ${FL - 7} ${tipX - 9} ${FL - 17} ${tipX + sway} ${FL - 28} Z`}
        fill={party.flame}
      />
      <Circle cx={tipX + sway * 0.5} cy={FL - 12} r={3.4} fill={party.flameCore} />
    </Svg>
  );
}

const s = StyleSheet.create({
  sign: {
    borderRadius: 18,
    borderWidth: 6,
    backgroundColor: party.signBoard,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  tape: { position: 'absolute', top: -14, width: 36, height: 16, backgroundColor: 'rgba(255,255,255,0.85)', transform: [{ rotate: '-6deg' }], borderRadius: 2 },
});
