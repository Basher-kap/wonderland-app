import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  ImageBackground,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import type { ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { SPACE_BG_IMAGE, space } from '../../theme';
import { buildSky, rng } from './skyData';

let instances = 0; // each sky gets its own gradient ids, so several skies can share a screen (web too)
import type { Dot, Hero, Sky } from './skyData';

type Props = {
  children?: React.ReactNode;
  style?: ViewStyle;
  /** Stops the twinkle and the shooting star (a tab that is not on screen). */
  paused?: boolean;
  /**
   * A small patch of sky (a header, a box) instead of the whole screen: give its size, and a density
   * (1 = a full screen of stars). `meteor` turns the shooting star on or off.
   */
  size?: { width: number; height: number };
  density?: number;
  heroes?: number;
  meteor?: boolean;
};

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduce(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

// Scintillation: a star's light does not pulse smoothly, it jumps between levels at uneven intervals.
function useScintillation(enabled: boolean, seed: number, low: number) {
  const v = useRef(new Animated.Value(0.9)).current;
  useEffect(() => {
    if (!enabled) {
      v.setValue(0.9);
      return;
    }
    const r = rng(seed);
    const steps = Array.from({ length: 12 }, () =>
      Animated.timing(v, {
        toValue: low + r() * (1 - low),
        duration: 450 + r() * 1700,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    );
    const loop = Animated.loop(Animated.sequence(steps));
    loop.start();
    return () => loop.stop();
  }, [enabled, seed, low, v]);
  return v;
}

// The Milky Way, a few dust-dim stars and the field. Drawn once, never animated.
const StaticSky = React.memo(function StaticSky({ sky, w, h, pid }: { sky: Sky; w: number; h: number; pid: string }) {
  const b = sky.band;
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id={`${pid}-mw`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#A9BEFF" stopOpacity="0.10" />
          <Stop offset="0.55" stopColor="#8EA6F0" stopOpacity="0.045" />
          <Stop offset="1" stopColor="#8EA6F0" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={`${pid}-bulge`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#F1DEC2" stopOpacity="0.07" />
          <Stop offset="1" stopColor="#F1DEC2" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={`${pid}-lane`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#000000" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#000000" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <G transform={`translate(${b.cx} ${b.cy}) rotate(${b.angleDeg})`}>
        <Ellipse cx={0} cy={0} rx={b.length * 0.42} ry={b.sigma * 2.2} fill={`url(#${pid}-mw)`} />
        <Ellipse cx={b.length * 0.08} cy={0} rx={b.length * 0.2} ry={b.sigma * 1.2} fill={`url(#${pid}-bulge)`} />
        <Ellipse cx={-b.length * 0.05} cy={b.sigma * 0.25} rx={b.length * 0.3} ry={b.sigma * 0.28} fill={`url(#${pid}-lane)`} />
      </G>
      {sky.milky.map((d, i) => (
        <Circle key={`m${i}`} cx={d.x} cy={d.y} r={d.r} fill={d.c} opacity={d.o} />
      ))}
      {sky.field.map((d, i) => (
        <Circle key={`f${i}`} cx={d.x} cy={d.y} r={d.r} fill={d.c} opacity={d.o} />
      ))}
    </Svg>
  );
});

function TwinkleLayer({ dots, w, h, seed, enabled }: { dots: Dot[]; w: number; h: number; seed: number; enabled: boolean }) {
  const opacity = useScintillation(enabled, seed, 0.25);
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
      <Svg width={w} height={h}>
        {dots.map((d, i) => (
          <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.c} opacity={d.o} />
        ))}
      </Svg>
    </Animated.View>
  );
}

// A bright star: a tight glow, a white core and (for the brightest) thin diffraction spikes that fade out.
function HeroStar({ s, enabled, pid }: { s: Hero; enabled: boolean; pid: string }) {
  const v = useScintillation(enabled, s.seed, 0.55);
  const size = s.size * 1.8;
  const id = `${pid}-h${s.seed}`;
  const scale = v.interpolate({ inputRange: [0.55, 1], outputRange: [0.9, 1.1], extrapolate: 'clamp' });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: s.x - size / 2,
        top: s.y - size / 2,
        width: size,
        height: size,
        opacity: v,
        transform: [{ scale }],
      }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={s.color} stopOpacity="0.6" />
            <Stop offset="0.07" stopColor={s.color} stopOpacity="0.32" />
            <Stop offset="0.22" stopColor={s.color} stopOpacity="0.07" />
            <Stop offset="1" stopColor={s.color} stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id={`${id}h`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={s.color} stopOpacity="0" />
            <Stop offset="0.5" stopColor={s.color} stopOpacity="0.7" />
            <Stop offset="1" stopColor={s.color} stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id={`${id}v`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={s.color} stopOpacity="0" />
            <Stop offset="0.5" stopColor={s.color} stopOpacity="0.7" />
            <Stop offset="1" stopColor={s.color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
        {s.spikes && (
          <>
            <Rect x={size * 0.04} y={size / 2 - 0.45} width={size * 0.92} height={0.9} fill={`url(#${id}h)`} />
            <Rect x={size / 2 - 0.45} y={size * 0.04} width={0.9} height={size * 0.92} fill={`url(#${id}v)`} />
          </>
        )}
        <Circle cx={size / 2} cy={size / 2} r={1.6} fill="#FFFFFF" />
      </Svg>
    </Animated.View>
  );
}

// One shooting star every 11 to 25 seconds, somewhere in the upper part of the sky.
function Meteor({ enabled, w, h, pid }: { enabled: boolean; w: number; h: number; pid: string }) {
  const p = useRef(new Animated.Value(0)).current;
  const [m, setM] = useState({ x: 0, y: 0, dx: 0, dy: 0, deg: 0 });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fire = () => {
      if (!alive) return;
      const a = ((18 + Math.random() * 22) * Math.PI) / 180;
      const len = Math.min(w, Math.max(h, 220)) * (0.45 + Math.random() * 0.35);
      setM({
        x: Math.random() * w * 0.55,
        y: Math.random() * h * 0.4,
        dx: Math.cos(a) * len,
        dy: Math.sin(a) * len,
        deg: (a * 180) / Math.PI,
      });
      p.setValue(0);
      Animated.timing(p, {
        toValue: 1,
        duration: 750 + Math.random() * 350,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        if (alive) timer = setTimeout(fire, 11000 + Math.random() * 14000);
      });
    };
    timer = setTimeout(fire, 4000 + Math.random() * 5000);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      p.stopAnimation();
    };
  }, [enabled, w, h, p]);

  if (!enabled) return null;
  const tx = p.interpolate({ inputRange: [0, 1], outputRange: [0, m.dx] });
  const ty = p.interpolate({ inputRange: [0, 1], outputRange: [0, m.dy] });
  const opacity = p.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 0.85, 0] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', left: m.x, top: m.y, opacity, transform: [{ translateX: tx }, { translateY: ty }] }}
    >
      <View style={{ width: 120, height: 6, transform: [{ rotate: `${m.deg}deg` }] }}>
        <Svg width={120} height={6}>
          <Defs>
            <LinearGradient id={`${pid}-meteor`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.95" />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={2.4} width={116} height={1.2} fill={`url(#${pid}-meteor)`} />
          <Circle cx={116} cy={3} r={2} fill="#FFFFFF" />
        </Svg>
      </View>
    </Animated.View>
  );
}

/**
 * The night sky behind Home, Leaderboard, Settings and Lobby: pure black, a faint Milky Way,
 * stars in their real colours, a few bright ones that scintillate, and now and then a shooting star.
 * Motion stops when the phone's "reduce motion" is on. Games do not use this: they have their own look.
 * If SPACE_BG_IMAGE is set in theme/space.ts, that picture is shown instead.
 */
export function SpaceBackground({ children, style, paused, size, density, heroes, meteor = true }: Props) {
  const win = useWindowDimensions();
  const pid = useRef(`sk${instances++}`).current;
  // Never shrink: opening the keyboard must not rebuild (and so move) the stars.
  const tallest = useRef(0);
  if (win.height > tallest.current) tallest.current = win.height;
  const w = size ? Math.max(1, Math.round(size.width)) : win.width;
  const h = size ? Math.max(1, Math.round(size.height)) : tallest.current;

  const reduce = useReduceMotion();
  const enabled = !reduce && !paused;
  const sky = useMemo(() => buildSky(w, h, { density, heroes }), [w, h, density, heroes]);

  if (SPACE_BG_IMAGE) {
    return (
      <ImageBackground source={SPACE_BG_IMAGE} resizeMode="cover" style={[styles.fill, style]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${space.imageDim})` }]} />
        {children}
      </ImageBackground>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: space.void }, style]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <StaticSky sky={sky} w={w} h={h} pid={pid} />
        {sky.twinkle.map((dots, i) => (
          <TwinkleLayer key={i} dots={dots} w={w} h={h} seed={7 + i * 53} enabled={enabled} />
        ))}
        {sky.heroes.map((s) => (
          <HeroStar key={s.seed} s={s} enabled={enabled} pid={pid} />
        ))}
        {meteor && <Meteor enabled={enabled} w={w} h={h} pid={pid} />}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
});

export default SpaceBackground; // kept so a default import still works
