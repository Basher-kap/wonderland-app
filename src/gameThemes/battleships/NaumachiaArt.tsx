import React from 'react';
import { View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { roma } from './theme';

// The pieces of the Naumachia, drawn with plain views so they stay sharp at any size.
// Every piece fits in a square of `size` pixels; all the measurements are fractions of it.

type PartProps = { s: number; x: number; y: number; w: number; h: number; c?: string; r?: number; style?: ViewStyle };
function P({ s, x, y, w, h, c, r = 0, style }: PartProps) {
  return (
    <View
      pointerEvents="none"
      style={[{ position: 'absolute', left: x * s, top: y * s, width: w * s, height: h * s, backgroundColor: c, borderRadius: r * s }, style]}
    />
  );
}
// A solid triangle pointing right, with its tip at (x + w, y + h / 2).
function Tip({ s, x, y, w, h, c }: { s: number; x: number; y: number; w: number; h: number; c: string }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x * s,
        top: y * s,
        width: 0,
        height: 0,
        borderLeftWidth: w * s,
        borderTopWidth: (h / 2) * s,
        borderBottomWidth: (h / 2) * s,
        borderLeftColor: c,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
      }}
    />
  );
}
const Frame = ({ size, children }: { size: number; children: React.ReactNode }) => (
  <View pointerEvents="none" style={{ width: size, height: size }}>
    {children}
  </View>
);

// A trireme: a long wooden hull with a bronze ram, three banks of oars and one square sail.
export function Trireme({ size }: { size: number }) {
  const s = size;
  return (
    <Frame size={s}>
      {/* the oars, under the hull */}
      {[0.2, 0.34, 0.48, 0.62, 0.76].map((x) => (
        <P key={x} s={s} x={x} y={0.6} w={0.025} h={0.26} c={roma.woodDark} r={0.012} style={{ transform: [{ rotate: '28deg' }] }} />
      ))}
      {/* the mast, the yard and the sail with its red stripe */}
      <P s={s} x={0.49} y={0.08} w={0.03} h={0.5} c={roma.woodDark} />
      <P s={s} x={0.27} y={0.12} w={0.47} h={0.03} c={roma.woodDark} r={0.015} />
      <P s={s} x={0.3} y={0.15} w={0.41} h={0.3} c={roma.velaCream} style={{ borderBottomLeftRadius: 0.07 * s, borderBottomRightRadius: 0.07 * s }} />
      <P s={s} x={0.3} y={0.27} w={0.41} h={0.07} c={roma.velaRed} />
      {/* the hull, curling up at the stern, with the ram at the bow */}
      <P
        s={s}
        x={0.05}
        y={0.5}
        w={0.88}
        h={0.2}
        c={roma.wood}
        style={{ borderBottomLeftRadius: 0.2 * s, borderBottomRightRadius: 0.26 * s, borderTopLeftRadius: 0.02 * s }}
      />
      <P s={s} x={0.05} y={0.5} w={0.88} h={0.04} c={roma.woodLight} />
      <P s={s} x={0.02} y={0.34} w={0.07} h={0.22} c={roma.woodDark} r={0.03} style={{ transform: [{ rotate: '-12deg' }] }} />
      <Tip s={s} x={0.9} y={0.6} w={0.1} h={0.1} c={roma.bronze} />
      <P s={s} x={0.78} y={0.545} w={0.045} h={0.045} c={roma.cream} r={0.025} />
      {[0.22, 0.38, 0.54, 0.7].map((x) => (
        <P key={x} s={s} x={x} y={0.6} w={0.03} h={0.03} c={roma.woodDark} r={0.015} />
      ))}
    </Frame>
  );
}

// A ballista, the "gun" of the ancient world: a wooden stock and frame, two bronze torsion
// springs, and a bolt with a bronze head, all tilted up to aim.
export function Ballista({ size }: { size: number }) {
  const s = size;
  return (
    <Frame size={s}>
      {/* the stand */}
      <P s={s} x={0.3} y={0.62} w={0.06} h={0.3} c={roma.woodDark} style={{ transform: [{ rotate: '12deg' }] }} />
      <P s={s} x={0.62} y={0.62} w={0.06} h={0.3} c={roma.woodDark} style={{ transform: [{ rotate: '-12deg' }] }} />
      <P s={s} x={0.2} y={0.58} w={0.6} h={0.08} c={roma.wood} r={0.02} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: s, height: s, transform: [{ rotate: '-16deg' }] }}>
        {/* the stock and the bolt */}
        <P s={s} x={0.06} y={0.46} w={0.82} h={0.08} c={roma.wood} r={0.02} />
        <P s={s} x={0.06} y={0.46} w={0.82} h={0.025} c={roma.woodLight} />
        <P s={s} x={0.3} y={0.42} w={0.56} h={0.025} c={roma.cream} />
        <Tip s={s} x={0.86} y={0.395} w={0.12} h={0.12} c={roma.bronze} />
        <P s={s} x={0.3} y={0.405} w={0.06} h={0.055} c={roma.blood} r={0.01} />
        {/* the frame and the two torsion springs */}
        <P s={s} x={0.58} y={0.24} w={0.06} h={0.5} c={roma.woodDark} r={0.015} />
        <P s={s} x={0.52} y={0.22} w={0.18} h={0.13} c={roma.bronze} r={0.065} />
        <P s={s} x={0.52} y={0.63} w={0.18} h={0.13} c={roma.bronze} r={0.065} />
      </View>
    </Frame>
  );
}

// A lead sling stone, one "bullet". `spent` = used up: only its outline is left.
export function Stone({ size, spent = false }: { size: number; spent?: boolean }) {
  const w = size * 0.55;
  return (
    <View
      pointerEvents="none"
      style={[
        { width: w, height: size, borderRadius: size / 2 },
        spent
          ? { borderWidth: 1.5, borderColor: roma.plaqueEdge }
          : { backgroundColor: roma.lead, borderWidth: 1, borderColor: roma.leadDark },
      ]}
    >
      {!spent && <View style={{ position: 'absolute', left: w * 0.22, top: size * 0.14, width: w * 0.22, height: size * 0.3, borderRadius: size, backgroundColor: 'rgba(255,255,255,0.35)' }} />}
    </View>
  );
}

// A skull above crossed bones: you sank your own ship.
export function Skull({ size }: { size: number }) {
  const s = size;
  return (
    <Frame size={s}>
      <P s={s} x={0.02} y={0.72} w={0.96} h={0.1} c={roma.bone} r={0.05} style={{ transform: [{ rotate: '24deg' }] }} />
      <P s={s} x={0.02} y={0.72} w={0.96} h={0.1} c={roma.bone} r={0.05} style={{ transform: [{ rotate: '-24deg' }] }} />
      <P s={s} x={0.14} y={0.04} w={0.72} h={0.66} c={roma.bone} r={0.36} style={{ borderWidth: 0.02 * s, borderColor: roma.boneShade }} />
      <P s={s} x={0.3} y={0.56} w={0.4} h={0.26} c={roma.bone} r={0.07} style={{ borderWidth: 0.02 * s, borderColor: roma.boneShade }} />
      <P s={s} x={0.26} y={0.3} w={0.18} h={0.18} c={roma.ink} r={0.09} />
      <P s={s} x={0.56} y={0.3} w={0.18} h={0.18} c={roma.ink} r={0.09} />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0.45 * s,
          top: 0.5 * s,
          width: 0,
          height: 0,
          borderLeftWidth: 0.05 * s,
          borderRightWidth: 0.05 * s,
          borderTopWidth: 0.09 * s,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: roma.ink,
        }}
      />
      {[0.4, 0.5, 0.6].map((x) => (
        <P key={x} s={s} x={x - 0.01} y={0.66} w={0.02} h={0.13} c={roma.boneShade} />
      ))}
    </Frame>
  );
}

// A mushroom cloud: you gave up your own ship to sink an enemy's.
export function Mushroom({ size }: { size: number }) {
  const s = size;
  return (
    <Frame size={s}>
      <P s={s} x={0.41} y={0.42} w={0.18} h={0.48} c="#C98C4A" r={0.05} />
      <P s={s} x={0.41} y={0.42} w={0.06} h={0.48} c="#E3A862" r={0.03} />
      <P s={s} x={0.18} y={0.84} w={0.64} h={0.12} c="#6B5A4D" r={0.06} />
      <P s={s} x={0.3} y={0.86} w={0.4} h={0.08} c={roma.fireDark} r={0.04} />
      <P s={s} x={0.06} y={0.2} w={0.38} h={0.34} c="#D9822F" r={0.17} />
      <P s={s} x={0.56} y={0.2} w={0.38} h={0.34} c="#D9822F" r={0.17} />
      <P s={s} x={0.2} y={0.06} w={0.6} h={0.48} c={roma.fire} r={0.3} />
      <P s={s} x={0.32} y={0.1} w={0.3} h={0.2} c={roma.fireLight} r={0.12} />
      <P s={s} x={0.16} y={0.46} w={0.68} h={0.09} c="#8A4A22" r={0.045} />
    </Frame>
  );
}

// A burst of fire: you hit an enemy ship.
export function Blast({ size }: { size: number }) {
  const s = size;
  const star = (inset: number, c: string) => (
    <>
      <P s={s} x={inset} y={inset} w={1 - 2 * inset} h={1 - 2 * inset} c={c} r={0.05} />
      <P s={s} x={inset} y={inset} w={1 - 2 * inset} h={1 - 2 * inset} c={c} r={0.05} style={{ transform: [{ rotate: '45deg' }] }} />
    </>
  );
  return (
    <Frame size={s}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0.03 * s, top: 0.03 * s, width: 0.94 * s, height: 0.94 * s }}>
        <View style={{ width: '100%', height: '100%', transform: [{ scale: 0.82 }] }}>{star(0.06, roma.fireDark)}</View>
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: s, height: s, transform: [{ scale: 0.58 }] }}>
        {star(0.06, roma.fire)}
      </View>
      <P s={s} x={0.36} y={0.36} w={0.28} h={0.28} c="#FFF1C9" r={0.14} />
    </Frame>
  );
}

// Rings on the water: the shot missed.
export function Splash({ size }: { size: number }) {
  const s = size;
  const ring = (d: number, a: number) => (
    <P
      key={d}
      s={s}
      x={(1 - d) / 2}
      y={(1 - d) / 2}
      w={d}
      h={d}
      r={d / 2}
      style={{ borderWidth: Math.max(1.5, 0.045 * s), borderColor: `rgba(232,244,242,${a})` }}
    />
  );
  return (
    <Frame size={s}>
      {ring(0.84, 0.45)}
      {ring(0.56, 0.7)}
      {ring(0.28, 0.95)}
      <P s={s} x={0.455} y={0.455} w={0.09} h={0.09} c={roma.leadDark} r={0.045} />
    </Frame>
  );
}

export type MarkOutcome = 'miss' | 'hit' | 'own' | 'neutral' | 'timeout';
export function Mark({ outcome, size }: { outcome: MarkOutcome; size: number }) {
  switch (outcome) {
    case 'miss':
      return <Splash size={size} />;
    case 'hit':
      return <Blast size={size} />;
    case 'own':
      return <Skull size={size} />;
    case 'neutral':
      return <Mushroom size={size} />;
    default:
      return null;
  }
}
