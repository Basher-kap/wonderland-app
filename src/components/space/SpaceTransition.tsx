import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SpaceBackground } from './SpaceBackground';
import { useReduceMotion } from '../ui';
import { rng } from './skyData';
import { space as sp } from '../../theme';

/**
 * The jump between a game's world and open space, for the frame around the games (GameScreen).
 *   - when a round or match ends, the game's own background pulls away (it zooms and fades) while
 *     the stars streak past, and the night sky opens up behind the results;
 *   - when the next random game appears (its rules screen), it comes back the other way: out of the sky, into the new world.
 * `t` is 0 in the game and 1 in space. The games themselves are not touched: only their background layer moves.
 */
export function useSpaceTransition(showSpace: boolean, arriveKey: string | null) {
  const reduce = useReduceMotion();
  const t = useRef(new Animated.Value(showSpace ? 1 : 0)).current;
  const warp = useRef(new Animated.Value(0)).current;
  const prevShow = useRef(showSpace);
  const prevKey = useRef<string | null>(null);
  const [skyOn, setSkyOn] = useState(showSpace);

  useEffect(() => {
    const run = (to: 0 | 1, ms: number, delay = 0) => {
      if (reduce) {
        t.setValue(to);
        setSkyOn(to === 1);
        return;
      }
      setSkyOn(true);
      warp.setValue(0);
      Animated.parallel([
        Animated.timing(t, { toValue: to, duration: ms, delay, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(warp, { toValue: 1, duration: ms + 150, delay, easing: Easing.linear, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished && to === 0) setSkyOn(false);
      });
    };

    // A new board is on screen: arrive from space into the game's world.
    if (arriveKey && arriveKey !== prevKey.current && !showSpace) {
      prevKey.current = arriveKey;
      prevShow.current = false;
      t.setValue(1);
      setSkyOn(true);
      run(0, 1300, 120);
      return;
    }
    // The round or the match ended (or the next round began): go to space, or leave it.
    if (showSpace !== prevShow.current) {
      prevShow.current = showSpace;
      run(showSpace ? 1 : 0, 1100);
    }
  }, [showSpace, arriveKey, reduce, t, warp]);

  return { t, warp, skyOn };
}

type Transition = ReturnType<typeof useSpaceTransition>;

/** Under the page: the game's background layer (moving away as `t` rises) and the night sky (opening up). */
export function TransitionBackdrop({
  Backdrop,
  tr,
  overlay,
}: {
  Backdrop: React.ComponentType<{ children?: React.ReactNode }> | null;
  tr: Transition;
  /** On top of another screen (the round intro): see-through once the sky has faded away. */
  overlay?: boolean;
}) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, !overlay && { backgroundColor: sp.void }]}>
      {tr.skyOn && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { opacity: overlay ? tr.t : tr.t.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0.2, 1] }) },
          ]}
        >
          <SpaceBackground />
        </Animated.View>
      )}
      {Backdrop && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: tr.t.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 0.15, 0] }),
              transform: [{ scale: tr.t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) }],
            },
          ]}
        >
          <View style={StyleSheet.absoluteFill}>
            <Backdrop />
          </View>
        </Animated.View>
      )}
    </View>
  );
}

/** Over the page: stars stretch into streaks that fly out from the middle, and are gone again. */
export function WarpStreaks({ tr }: { tr: Transition }) {
  const { width, height } = useWindowDimensions();
  const reduce = useReduceMotion();
  const streaks = useMemo(() => {
    const r = rng(777);
    return Array.from({ length: 34 }, () => ({
      angle: r() * 360,
      from: 12 + r() * 50,
      len: 50 + r() * 110,
      w: 1 + r() * 1.4,
      c: r() > 0.7 ? '#FFE9C2' : r() > 0.4 ? '#CFE0FF' : '#FFFFFF',
    }));
  }, []);
  if (reduce) return null;
  const reach = Math.hypot(width, height) * 0.6;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { opacity: tr.warp.interpolate({ inputRange: [0, 0.12, 0.7, 1], outputRange: [0, 1, 0.8, 0] }) },
      ]}
    >
      <View style={{ position: 'absolute', left: width / 2, top: height / 2 }}>
        {streaks.map((s, i) => (
          <View key={i} style={{ position: 'absolute', transform: [{ rotate: `${s.angle}deg` }] }}>
            <Animated.View
              style={{
                width: s.len,
                height: s.w,
                borderRadius: s.w,
                backgroundColor: s.c,
                transform: [
                  { translateX: tr.warp.interpolate({ inputRange: [0, 1], outputRange: [s.from, reach] }) },
                  { scaleX: tr.warp.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.08, 1, 0.25] }) },
                ],
              }}
            />
          </View>
        ))}
      </View>
    </Animated.View>
  );
}
