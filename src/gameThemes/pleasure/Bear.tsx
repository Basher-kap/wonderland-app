import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { show } from './theme';

export type Mood = 'happy' | 'wow' | 'sad' | 'think' | 'cheer';

const FUR = '#A9692F';
const FUR_DARK = '#8B5226';
const MUZZLE = '#F5DDB5';
const DARK = '#2B1A12';

// The cheerful bear host, drawn in code. The mood changes his face; a change of mood makes him jump.
export function Bear({ size = 92, mood, still }: { size?: number; mood: Mood; still: boolean }) {
  const bob = useRef(new Animated.Value(0)).current;
  const jump = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [still, bob]);

  useEffect(() => {
    if (still) return;
    jump.setValue(0.85);
    Animated.spring(jump, { toValue: 1, friction: 3, tension: 220, useNativeDriver: true }).start();
  }, [mood, still, jump]);

  const eyes = (() => {
    switch (mood) {
      case 'wow':
        return (
          <G>
            <Circle cx={45} cy={58} r={8} fill="#FFF" />
            <Circle cx={75} cy={58} r={8} fill="#FFF" />
            <Circle cx={45} cy={59} r={4.5} fill={DARK} />
            <Circle cx={75} cy={59} r={4.5} fill={DARK} />
            <Path d="M35 44 Q45 38 55 44 M65 44 Q75 38 85 44" stroke={FUR_DARK} strokeWidth={3} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'cheer':
        return <Path d="M38 62 Q45 52 52 62 M68 62 Q75 52 82 62" stroke={DARK} strokeWidth={4} fill="none" strokeLinecap="round" />;
      case 'sad':
        return (
          <G>
            <Circle cx={45} cy={60} r={5} fill={DARK} />
            <Circle cx={75} cy={60} r={5} fill={DARK} />
            <Path d="M36 49 L53 54 M84 49 L67 54" stroke={FUR_DARK} strokeWidth={3} strokeLinecap="round" />
            <Ellipse cx={41} cy={72} rx={2.6} ry={4.2} fill={show.cyan} />
          </G>
        );
      case 'think':
        return (
          <G>
            <Circle cx={45} cy={60} r={5} fill={DARK} />
            <Circle cx={75} cy={60} r={5} fill={DARK} />
            <Path d="M36 51 L53 51 M67 47 L84 42" stroke={FUR_DARK} strokeWidth={3} strokeLinecap="round" />
          </G>
        );
      default:
        return (
          <G>
            <Circle cx={45} cy={60} r={5} fill={DARK} />
            <Circle cx={75} cy={60} r={5} fill={DARK} />
            <Circle cx={46.5} cy={58} r={1.8} fill="#FFF" />
            <Circle cx={76.5} cy={58} r={1.8} fill="#FFF" />
          </G>
        );
    }
  })();

  const mouth = (() => {
    switch (mood) {
      case 'wow':
        return <Ellipse cx={60} cy={90} rx={6.5} ry={8} fill="#5A1F1F" />;
      case 'cheer':
        return <Path d="M47 82 Q60 104 73 82 Z" fill="#5A1F1F" stroke={DARK} strokeWidth={2.5} strokeLinejoin="round" />;
      case 'sad':
        return <Path d="M50 92 Q60 83 70 92" stroke={DARK} strokeWidth={3.5} fill="none" strokeLinecap="round" />;
      case 'think':
        return <Path d="M53 89 L68 87" stroke={DARK} strokeWidth={3.5} strokeLinecap="round" />;
      default:
        return <Path d="M49 84 Q60 97 71 84" stroke={DARK} strokeWidth={3.5} fill="none" strokeLinecap="round" />;
    }
  })();

  return (
    <Animated.View
      style={{
        width: size,
        height: size * 1.07,
        transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }, { scale: jump }],
      }}
    >
      <Svg width={size} height={size * 1.07} viewBox="0 0 120 128">
        <Circle cx={27} cy={27} r={17} fill={FUR} />
        <Circle cx={93} cy={27} r={17} fill={FUR} />
        <Circle cx={27} cy={27} r={9} fill="#E2A96B" />
        <Circle cx={93} cy={27} r={9} fill="#E2A96B" />
        <Circle cx={60} cy={64} r={46} fill={FUR} />
        <Ellipse cx={60} cy={82} rx={24} ry={18} fill={MUZZLE} />
        <Ellipse cx={60} cy={72} rx={7.5} ry={5.5} fill={DARK} />
        {eyes}
        {mouth}
        <Circle cx={34} cy={80} r={7} fill="#FF8FA3" opacity={0.65} />
        <Circle cx={86} cy={80} r={7} fill="#FF8FA3" opacity={0.65} />
        <Path d="M60 112 L38 101 L38 124 Z M60 112 L82 101 L82 124 Z" fill={show.red} stroke={DARK} strokeWidth={2.5} strokeLinejoin="round" />
        <Circle cx={60} cy={112} r={6} fill={show.yellow} stroke={DARK} strokeWidth={2.5} />
      </Svg>
    </Animated.View>
  );
}
