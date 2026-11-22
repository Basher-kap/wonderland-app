import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DomainIcon } from '../ui';
import { VoiceButton } from '../social';
import type { Difficulty, Game } from '../../data';
import { getIntroTheme } from '../../gameThemes';
import { colors, domainInfo, radius } from '../../theme';

// The dialogs shown, one after another, when a game is drawn:
//   1. "Game of <Domain>" + "Difficulty: <level>"
//   2. the game's name in Japanese
//   3. "Rule: ..."
//   4. (only if the game has one) "Example: ..."
//   5. (only if the game has one) "Prohibition: ..."
//   6. (only if the game has one) "Additional Rule: ..."
//   7. "Clear Condition: ..."
// Steps 1 and 2 move on by themselves (tap to skip); the rule dialogs wait for a tap so
// everybody can read them. After the last one, onDone() starts the game.

type Step = { key: string; kind: 'title' | 'name' | 'lines'; heading?: string; lines?: string[] };

const AUTO_MS = 2200;

const LABEL: Record<Difficulty, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };

export function buildSteps(game: Game, difficulty: Difficulty): Step[] {
  const steps: Step[] = [
    {
      key: 'title',
      kind: 'title',
      lines: [`Game of ${domainInfo[game.domain].label}`, `Difficulty: ${LABEL[difficulty]}`],
    },
    { key: 'name', kind: 'name', lines: [game.japaneseName ?? game.name] },
    { key: 'rule', kind: 'lines', heading: 'Rule', lines: game.rules?.length ? game.rules : ['To be announced.'] },
    ...(game.example?.length
      ? [{ key: 'example', kind: 'lines' as const, heading: 'Example', lines: game.example }]
      : []),
    ...(game.prohibitions?.length
      ? [{ key: 'prohibition', kind: 'lines' as const, heading: 'Prohibition', lines: game.prohibitions }]
      : []),
    ...(game.additionalRules?.length
      ? [{ key: 'additional', kind: 'lines' as const, heading: 'Additional Rule', lines: game.additionalRules }]
      : []),
    {
      key: 'clear',
      kind: 'lines',
      heading: 'Clear Condition',
      lines: game.clearConditions?.length ? game.clearConditions : ['To be announced.'],
    },
  ];
  return steps;
}

export function RoundIntro({
  game,
  difficulty,
  code,
  onDone,
}: {
  game: Game;
  difficulty: Difficulty;
  code?: string; // the lobby, so the mic stays within reach while the rules are read
  onDone: () => void;
}) {
  const steps = React.useMemo(() => buildSteps(game, difficulty), [game, difficulty]);
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  const step = steps[index];
  const last = index === steps.length - 1;
  const look = getIntroTheme(game.id); // a game with its own look (Magical Banana: Food Land)
  const color = look ? look.accent : domainInfo[game.domain].color;
  const textColor = look ? look.text : colors.text;
  const Backdrop = look?.Backdrop;
  const Awning = look?.Awning;
  const Decor = look?.Decor;

  // The parent passes a new onDone on every render; keep the latest one in a ref so a lobby update
  // during the intro does not recreate `advance` and restart the fade and the auto-advance timer.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const advance = React.useCallback(() => {
    if (index >= steps.length - 1) onDoneRef.current();
    else setIndex(index + 1);
  }, [index, steps.length]);

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    if (step.kind === 'lines') return;
    const t = setTimeout(advance, AUTO_MS);
    return () => clearTimeout(t);
  }, [index, step.kind, advance, fade]);

  // Tapping only moves the rule dialogs on: the title and the name cannot be skipped.
  const next = React.useCallback(() => {
    if (step.kind === 'lines') advance();
  }, [step.kind, advance]);

  const content = (
    <>
      {step.kind === 'title' && (
        <View style={{ alignItems: 'center', gap: 10 }}>
          <DomainIcon domain={game.domain} size={44} color={look ? color : undefined} />
          <Text style={[styles.big, { color, fontFamily: look?.fontFamily }]}>{step.lines![0]}</Text>
          <Text style={[styles.medium, { color: textColor, fontFamily: look?.fontFamily }]}>{step.lines![1]}</Text>
        </View>
      )}
      {step.kind === 'name' && <Text style={[styles.huge, { color, fontFamily: look?.fontFamily }]}>{step.lines![0]}</Text>}
      {step.kind === 'lines' && (
        <View style={{ gap: 10 }}>
          <Text style={[styles.heading, { color, fontFamily: look?.fontFamily }]}>{step.heading}:</Text>
          {step.lines!.map((line, i) => (
            <Text key={i} style={[styles.line, { color: textColor, fontFamily: look?.fontFamily }]}>
              {step.lines!.length > 1 ? (
                <>
                  <Text style={{ color: look ? look.bullet : textColor }}>•</Text>
                  {`  ${line}`}
                </>
              ) : (
                line
              )}
            </Text>
          ))}
        </View>
      )}
    </>
  );

  const screen = (
    <SafeAreaView style={[styles.root, look && { backgroundColor: 'transparent' }]}>
      <VoiceButton code={code} />
      <Pressable style={styles.tap} onPress={next} accessibilityRole="button">
        {Awning ? (
          <Animated.View style={{ opacity: fade }}>
            <Awning />
            <View style={[styles.dialog, { borderColor: color }, look?.dialog]}>
              {content}
              {Decor && <Decor />}
            </View>
          </Animated.View>
        ) : (
          <Animated.View style={[styles.dialog, { borderColor: color, opacity: fade }, look?.dialog]}>
            {content}
            {Decor && <Decor />}
          </Animated.View>
        )}
        <Text style={[styles.hint, look && { color: look.hint }]}>
          {step.kind === 'lines' ? (last ? 'Tap to start' : 'Tap to continue') : ' '}
        </Text>
      </Pressable>
    </SafeAreaView>
  );

  return Backdrop ? <Backdrop>{screen}</Backdrop> : screen;
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