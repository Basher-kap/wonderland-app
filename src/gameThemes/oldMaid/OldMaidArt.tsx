import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, Path, Pattern, Polygon, Rect } from 'react-native-svg';
import { plaza as p } from './theme';

// ------------------------------------------------------------------ playing cards ----
export const CARD_RATIO = 1.4; // height / width

const GLYPH: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

type CardProps = { card: string; width: number; selected?: boolean; dim?: boolean };

// A face-up card. Big index in the corner and a big suit in the middle, so a card reads from across the
// table. The Joker is a jester on a gold ground.
export function PlayingCard({ card, width, selected, dim }: CardProps) {
  const h = width * CARD_RATIO;
  const joker = card === 'JK';
  const suit = joker ? '' : card.slice(-1);
  const rank = joker ? '' : card.slice(0, -1);
  const red = suit === 'H' || suit === 'D';
  const color = red ? p.cardRed : p.cardInk;
  const f = width / 60;
  return (
    <View
      style={[
        s.card,
        { width, height: h, borderRadius: 7 * f + 1, backgroundColor: joker ? '#FFF1C4' : p.cardFace },
        selected && s.cardPick,
        dim && { opacity: 0.45 },
      ]}
    >
      {joker ? (
        <View style={s.center}>
          <Svg width={width * 0.8} height={h * 0.72} viewBox="0 0 60 80">
            <Path d="M8 34 L14 8 L24 24 L30 4 L36 24 L46 8 L52 34 Z" fill={p.cardRed} stroke={p.cardInk} strokeWidth={1.4} strokeLinejoin="round" />
            <Circle cx={14} cy={8} r={3} fill={p.tileYellow} />
            <Circle cx={30} cy={4} r={3} fill={p.tileYellow} />
            <Circle cx={46} cy={8} r={3} fill={p.tileYellow} />
            <Circle cx={30} cy={48} r={17} fill="#FFE2B5" stroke={p.cardInk} strokeWidth={1.4} />
            <Circle cx={24} cy={45} r={2.2} fill={p.cardInk} />
            <Circle cx={36} cy={45} r={2.2} fill={p.cardInk} />
            <Path d="M22 54 Q30 62 38 54" stroke={p.cardRed} strokeWidth={2.2} fill="none" strokeLinecap="round" />
            <Rect x={8} y={32} width={44} height={4} rx={2} fill={p.tileBlue} />
          </Svg>
          <Text style={[s.jokerWord, { fontSize: Math.max(8, 11 * f) }]}>JOKER</Text>
        </View>
      ) : (
        <>
          <View style={[s.corner, { left: 4 * f, top: 3 * f }]}>
            <Text style={[s.rank, { color, fontSize: 19 * f }]}>{rank}</Text>
            <Text style={[s.pip, { color, fontSize: 15 * f, marginTop: -3 * f }]}>{GLYPH[suit]}</Text>
          </View>
          <View style={[s.corner, s.cornerBR, { right: 4 * f, bottom: 3 * f }]}>
            <Text style={[s.rank, { color, fontSize: 19 * f }]}>{rank}</Text>
            <Text style={[s.pip, { color, fontSize: 15 * f, marginTop: -3 * f }]}>{GLYPH[suit]}</Text>
          </View>
          <View style={s.center} pointerEvents="none">
            <Text style={{ color, fontSize: 34 * f, lineHeight: 40 * f }}>{GLYPH[suit]}</Text>
          </View>
        </>
      )}
    </View>
  );
}

// A face-down card: blue and white azulejo tiles with a gold frame.
export function CardBack({ width, selected, dim }: { width: number; selected?: boolean; dim?: boolean }) {
  const h = width * CARD_RATIO;
  const f = width / 60;
  return (
    <View style={[s.card, { width, height: h, borderRadius: 7 * f + 1, backgroundColor: p.backBase }, selected && s.cardPick, dim && { opacity: 0.45 }]}>
      <Svg width={width} height={h} viewBox="0 0 60 84" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="om-tile" width={12} height={12} patternUnits="userSpaceOnUse">
            <Rect width={12} height={12} fill={p.backBase} />
            <Polygon points="6,1 11,6 6,11 1,6" fill={p.backAlt} />
            <Circle cx={6} cy={6} r={2} fill={p.backGold} />
          </Pattern>
        </Defs>
        <Rect x={4} y={4} width={52} height={76} rx={4} fill="url(#om-tile)" stroke={p.backGold} strokeWidth={1.6} />
      </Svg>
    </View>
  );
}

// ------------------------------------------------------------------ scenery bits ----
// A strip of bunting (little flags on a sagging string), for the top of the screen.
export function Bunting({ width, height = 34 }: { width: number; height?: number }) {
  const flags = Math.max(6, Math.round(width / 34));
  const colors = [p.petalRed, p.petalYellow, p.tileBlue, p.leaf, p.petalPink];
  const step = width / flags;
  const sag = (x: number) => 4 + Math.sin((Math.PI * x) / width) * (height * 0.28);
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} pointerEvents="none">
      <Path d={`M0 ${sag(0)} Q${width / 2} ${sag(width / 2) * 2 - 4} ${width} ${sag(width)}`} stroke={p.iron} strokeWidth={1.2} fill="none" />
      {Array.from({ length: flags }, (_, i) => {
        const x = step * (i + 0.5);
        const y = sag(x) - 1;
        return <Polygon key={i} points={`${x - 9},${y} ${x + 9},${y} ${x},${y + 18}`} fill={colors[i % colors.length]} />;
      })}
    </Svg>
  );
}

// The chair wire: a lightning bolt, drawn over a player who is being electrocuted.
export function ZapBolt({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" pointerEvents="none">
      <Circle cx={50} cy={50} r={46} fill={p.zapGlow} />
      <Path d="M58 4 L24 56 H46 L38 96 L78 38 H54 Z" fill={p.zap} stroke={p.wire} strokeWidth={4} strokeLinejoin="round" />
    </Svg>
  );
}

// A little park bench, seen from the front, under a seat. `lit` shows the chair wire as a hot spark.
export function Bench({ width, lit }: { width: number; lit?: boolean }) {
  const h = width * 0.42;
  return (
    <Svg width={width} height={h} viewBox="0 0 100 42" pointerEvents="none">
      <Rect x={6} y={6} width={88} height={7} rx={3} fill={p.bench} />
      <Rect x={6} y={15} width={88} height={7} rx={3} fill={p.bench} />
      <Rect x={4} y={25} width={92} height={7} rx={3} fill={p.benchDark} />
      <Rect x={10} y={32} width={5} height={9} fill={p.iron} />
      <Rect x={85} y={32} width={5} height={9} fill={p.iron} />
      {lit ? <Path d="M50 30 L44 38 H52 L48 42" stroke={p.zap} strokeWidth={2.4} fill="none" strokeLinejoin="round" /> : <Line x1={50} y1={32} x2={50} y2={41} stroke={p.wire} strokeWidth={1.4} />}
    </Svg>
  );
}

// A flower: five petals around a centre.
export function Flower({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  return (
    <G>
      {[0, 72, 144, 216, 288].map((a) => (
        <Circle key={a} cx={x + Math.cos((a * Math.PI) / 180) * r} cy={y + Math.sin((a * Math.PI) / 180) * r} r={r * 0.8} fill={color} />
      ))}
      <Circle cx={x} cy={y} r={r * 0.6} fill={p.tileYellow} />
    </G>
  );
}

const s = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderColor: p.cardEdge,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardPick: { borderColor: p.pick, borderWidth: 3, shadowColor: p.pick, shadowOpacity: 0.9, shadowRadius: 8, elevation: 8 },
  corner: { position: 'absolute', alignItems: 'center' },
  cornerBR: { transform: [{ rotate: '180deg' }] },
  rank: { fontWeight: '900', lineHeight: undefined },
  pip: { fontWeight: '700' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  jokerWord: { color: p.cardRed, fontWeight: '900', letterSpacing: 1, position: 'absolute', bottom: 3 },
});
