import React from 'react';
import { Circle, G, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { FONT_DISPLAY, ruins } from './theme';

// The pieces of the board, drawn with SVG shapes. Every piece is drawn around a centre point (cx, cy)
// and is meant to be placed INSIDE the board's <Svg> (the game screen), so they are plain <G> groups.

type Pos = { cx: number; cy: number };

// A switch in the old fuse box: a metal plate with two screws and a lever. `armed` = picked, waiting for
// the confirm button (lever up, amber). `thrown` = the final choice has been made (lever all the way up).
export function SwitchArt({ cx, cy, w, label, armed, thrown }: Pos & { w: number; label: string; armed?: boolean; thrown?: boolean }) {
  const h = w * 1.18;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const pivotY = cy + h * 0.16;
  const up = armed || thrown;
  // The lever swings from "down-left" (off) to "up" (on).
  const tipX = up ? cx : cx - w * 0.2;
  const tipY = up ? cy - h * 0.32 : cy + h * 0.38;
  const colour = up ? ruins.leverArmed : ruins.lever;
  return (
    <G>
      <Rect x={x} y={y} width={w} height={h} rx={3} fill={up ? ruins.switchPlateLit : ruins.switchPlate} stroke={up ? ruins.leverArmed : ruins.panelEdge} strokeWidth={up ? 2 : 1.5} />
      <Circle cx={x + 5} cy={y + 5} r={1.8} fill={ruins.rivet} />
      <Circle cx={x + w - 5} cy={y + 5} r={1.8} fill={ruins.rivet} />
      <Rect x={cx - w * 0.2} y={pivotY - 4} width={w * 0.4} height={8} rx={4} fill={ruins.soot} />
      <Line x1={cx} y1={pivotY} x2={tipX} y2={tipY} stroke={colour} strokeWidth={Math.max(3, w * 0.12)} strokeLinecap="round" />
      <Circle cx={tipX} cy={tipY} r={Math.max(3.5, w * 0.12)} fill={colour} />
      <SvgText x={cx} y={y + h - 4} fontSize={Math.max(8, w * 0.22)} fontFamily={FONT_DISPLAY} fontWeight="700" fill={ruins.textDim} textAnchor="middle">
        {label}
      </SvgText>
    </G>
  );
}

// The bulb at the end of its wire: a socket on top, a glass bulb below it. When `lit` it glows warm.
export function BulbArt({ cx, cy, r, lit }: Pos & { r: number; lit?: boolean }) {
  const top = cy - r * 1.7;
  return (
    <G>
      {lit && (
        <>
          <Circle cx={cx} cy={cy} r={r * 3.2} fill={ruins.bulbGlow} opacity={0.12} />
          <Circle cx={cx} cy={cy} r={r * 2.2} fill={ruins.bulbGlow} opacity={0.22} />
          <Circle cx={cx} cy={cy} r={r * 1.5} fill={ruins.bulbGlow} opacity={0.35} />
        </>
      )}
      <Rect x={cx - r * 0.55} y={top} width={r * 1.1} height={r * 0.9} rx={2} fill={ruins.panelEdge} />
      <Line x1={cx - r * 0.55} y1={top + r * 0.3} x2={cx + r * 0.55} y2={top + r * 0.3} stroke={ruins.soot} strokeWidth={1} />
      <Line x1={cx - r * 0.55} y1={top + r * 0.6} x2={cx + r * 0.55} y2={top + r * 0.6} stroke={ruins.soot} strokeWidth={1} />
      <Path
        d={`M${cx - r * 0.5} ${top + r * 0.9} Q${cx - r * 1.1} ${cy - r * 0.3} ${cx - r * 0.95} ${cy + r * 0.2} Q${cx - r * 0.7} ${cy + r * 0.95} ${cx} ${cy + r * 0.95} Q${cx + r * 0.7} ${cy + r * 0.95} ${cx + r * 0.95} ${cy + r * 0.2} Q${cx + r * 1.1} ${cy - r * 0.3} ${cx + r * 0.5} ${top + r * 0.9} Z`}
        fill={lit ? ruins.bulbGlowCore : ruins.bulbGlass}
        stroke={lit ? ruins.bulbGlow : ruins.bulbGlassEdge}
        strokeWidth={1.5}
      />
      {/* the filament */}
      <Path
        d={`M${cx - r * 0.3} ${top + r * 0.95} L${cx - r * 0.3} ${cy - r * 0.1} L${cx - r * 0.12} ${cy - r * 0.35} L${cx + r * 0.12} ${cy - r * 0.05} L${cx + r * 0.3} ${cy - r * 0.35} L${cx + r * 0.3} ${top + r * 0.95}`}
        fill="none"
        stroke={lit ? ruins.blast : ruins.ink}
        strokeWidth={1.4}
        opacity={lit ? 1 : 0.8}
      />
      {/* a crack in the glass, because nothing in this house is whole */}
      {!lit && <Path d={`M${cx + r * 0.55} ${cy - r * 0.2} L${cx + r * 0.3} ${cy + r * 0.1} L${cx + r * 0.42} ${cy + r * 0.4}`} fill="none" stroke={ruins.ash} strokeWidth={1} opacity={0.6} />}
    </G>
  );
}

// A bundle of three dynamite sticks tied with a tan band, a short fuse on top.
export function TntArt({ cx, cy, w }: Pos & { w: number }) {
  const sw = w * 0.3; // stick width
  const h = w * 1.25;
  const top = cy - h / 2;
  return (
    <G>
      {[-1, 0, 1].map((k) => (
        <Rect key={k} x={cx + k * sw * 1.02 - sw / 2} y={top + (k === 0 ? 0 : h * 0.06)} width={sw} height={h * (k === 0 ? 1 : 0.94)} rx={2} fill={ruins.tnt} stroke={ruins.tntDark} strokeWidth={1.2} />
      ))}
      <Rect x={cx - sw * 1.6} y={cy - h * 0.12} width={sw * 3.2} height={h * 0.26} fill={ruins.tntBand} opacity={0.92} />
      <SvgText x={cx} y={cy + h * 0.07} fontSize={Math.max(6, w * 0.2)} fontFamily={FONT_DISPLAY} fontWeight="700" fill={ruins.ink} textAnchor="middle">
        TNT
      </SvgText>
      <Path d={`M${cx} ${top} Q${cx + sw * 0.5} ${top - h * 0.18} ${cx + sw * 0.15} ${top - h * 0.3}`} fill="none" stroke={ruins.tntFuse} strokeWidth={1.6} />
    </G>
  );
}

// The explosion: a jagged starburst with a hot core.
export function BlastArt({ cx, cy, r }: Pos & { r: number }) {
  const spikes = 14;
  const pts = Array.from({ length: spikes * 2 }, (_, i) => {
    const a = (Math.PI * i) / spikes;
    const rad = i % 2 === 0 ? r : r * 0.55;
    return `${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad).toFixed(1)}`;
  }).join(' ');
  return (
    <G>
      <Polygon points={pts} fill={ruins.blast} stroke={ruins.tnt} strokeWidth={2} />
      <Circle cx={cx} cy={cy} r={r * 0.42} fill={ruins.blastCore} />
    </G>
  );
}
