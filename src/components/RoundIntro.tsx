import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DomainIcon } from './ui';
import type { Difficulty, Game } from '../data/games';
import { colors, domainInfo, radius } from '../theme';

// The dialogs shown, one after another, when a game is drawn:
//   1. "Game of <Domain>" + "Difficulty: <level>"
//   2. the game's name in Japanese
//   3. "Rule: ..."
//   4. (only if the game has one) "Prohibition: ..."
//   5. (only if the game has one) "Additional Rule: ..." (or the game's own heading, e.g. "Extended Rule")
//   6. (only if the game has examples) "Example: ..."
//   7. "Clear Condition: ..."
// Steps 1 and 2 move on by themselves (tap to skip); the rule dialogs wait for a tap so
// everybody can read them. After the last one, onDone() starts the game.

type Step = { key: string; kind: 'title' | 'name' | 'lines'; heading?: string; lines?: string[] };

const AUTO_MS = 2200;

const LABEL: Record<Difficulty, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };

export function buildSteps(game: Game, difficulty: Difficulty): Step[] {
  return [
    {
      key: 'title',
      kind: 'title',
      lines: [`Game of ${domainInfo[game.domain].label}`, `Difficulty: ${LABEL[difficulty]}`],
    },
    { key: 'name', kind: 'name', lines: [game.japaneseName ?? game.name] },
    { key: 'rule', kind: 'lines', heading: 'Rule', lines: game.rules?.length ? game.rules : ['To be announced.'] },
    ...(game.prohibitions?.length
      ? [{ key: 'prohibition', kind: 'lines' as const, heading: 'Prohibition', lines: game.prohibitions }]
      : []),
    ...(game.additionalRules?.length
      ? [
          {
            key: 'additional',
            kind: 'lines' as const,
            heading: game.additionalRulesHeading ?? 'Additional Rule',
            lines: game.additionalRules,
          },
        ]
      : []),
    ...(game.example?.length
      ? [{ key: 'example', kind: 'lines' as const, heading: 'Example', lines: game.example }]
      : []),
    {
      key: 'clear',
      kind: 'lines',
      heading: 'Clear Condition',
      lines: game.clearConditions?.length ? game.clearConditions : ['To be announced.'],
    },
  ];
}

export function RoundIntro({
  game,
  difficulty,
  onDone,
}: {
  game: Game;
  difficulty: Difficulty;
  onDone: () => void;
}) {
  const steps = React.useMemo(() => buildSteps(game, difficulty), [game, difficulty]);
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  const step = steps[index];
  const last = index === steps.length - 1;
  const color = domainInfo[game.domain].color;

  const next = React.useCallback(() => {
    if (index >= steps.length - 1) onDone();
    else setIndex(index + 1);
  }, [index, steps.length, onDone]);

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    if (step.kind === 'lines') return;
    const t = setTimeout(next, AUTO_MS);
    return () => clearTimeout(t);
  }, [index, step.kind, next, fade]);

  return (
    <SafeAreaView style={styles.root}>
      <Pressable style={styles.tap} onPress={next} accessibilityRole="button">
        <Animated.View style={[styles.dialog, { borderColor: color, opacity: fade }]}>
          {step.kind === 'title' && (
            <View style={{ alignItems: 'center', gap: 10 }}>
              <DomainIcon domain={game.domain} size={44} />
              <Text style={[styles.big, { color }]}>{step.lines![0]}</Text>
              <Text style={styles.medium}>{step.lines![1]}</Text>
            </View>
          )}
          {step.kind === 'name' && <Text style={[styles.huge, { color }]}>{step.lines![0]}</Text>}
          {step.kind === 'lines' && (
            <View style={{ gap: 10 }}>
              <Text style={[styles.heading, { color }]}>{step.heading}:</Text>
              {step.lines!.map((line, i) => (
                <Text key={i} style={styles.line}>
                  {step.lines!.length > 1 ? `•  ${line}` : line}
                </Text>
              ))}
            </View>
          )}
        </Animated.View>
        <Text style={styles.hint}>
          {step.kind === 'lines' ? (last ? 'Tap to start' : 'Tap to continue') : 'Tap to skip'}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  tap: { flex: 1, padding: 24, justifyContent: 'center', gap: 18 },
  dialog: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 2,
    padding: 26,
    minHeight: 180,
    justifyContent: 'center',
  },
  big: { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  medium: { color: colors.text, fontSize: 20, fontWeight: '600', textAlign: 'center' },
  huge: { fontSize: 38, fontWeight: '800', textAlign: 'center' },
  heading: { fontSize: 22, fontWeight: '800' },
  line: { color: colors.text, fontSize: 17, lineHeight: 24 },
  hint: { color: colors.muted, textAlign: 'center', fontSize: 14 },
});
