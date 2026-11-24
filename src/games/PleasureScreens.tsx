import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CHOICES, DRAW_LANDS_MS, DRAW_MS, MAX_ANSWER, presentOf, QUESTIONS_PER_GAME, uncoveredCount } from '../game/pleasure';
import type { State } from '../game/pleasure';
import { CHOICE_COLORS, CHOICE_LETTERS, FONT_SHOW, show, Telop } from '../gameThemes/pleasure';

// The big on-screen displays of Pleasure, one per phase (PleasureGame.tsx picks the one to show):
//   ask     the bear's question and the answer box      draw    the roulette that picks the Host
//   guess   the question and the 4 choices              reveal  the Host's real answer, the reactions
//   over    the result of the game
export type Names = { uid: string; who: (id: string) => string };


function Frame({ children, tint }: { children: React.ReactNode; tint?: string }) {
  return <View style={[styles.frame, tint ? { borderColor: tint } : null]}>{children}</View>;
}

function Tag({ text, color = show.yellow }: { text: string; color?: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: color }]}>
      <Text style={styles.tagText}>{text}</Text>
    </View>
  );
}

// ------------------------------------------------------------ ask ----
export function AskScreen(props: {
  st: State;
  draft: string;
  onDraft: (t: string) => void;
  sent: boolean;
  onSend: () => void;
  answered: number;
  total: number;
}) {
  const { st, draft, onDraft, sent, onSend, answered, total } = props;
  const clean = draft.trim() !== '';
  return (
    <Frame>
      <Tag text={`QUESTION ${st.qi + 1} / ${QUESTIONS_PER_GAME}`} />
      <View style={styles.questionBox}>
        <Telop size={22} lines={4}>
          {st.questions[st.qi]}
        </Telop>
      </View>
      <TextInput
        value={draft}
        onChangeText={(t) => onDraft(t.toLowerCase().slice(0, MAX_ANSWER))}
        placeholder="type your honest answer…"
        placeholderTextColor="#8E82C9"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={MAX_ANSWER}
        returnKeyType="done"
        onSubmitEditing={() => clean && onSend()}
        style={styles.input}
        accessibilityLabel="Your answer"
      />
      <View style={styles.row}>
        <Text style={styles.small}>
          {sent ? '✔ locked in. Only the bear knows!' : `secret until the quiz · ${draft.length}/${MAX_ANSWER}`}
        </Text>
        <Text style={styles.small}>
          {answered}/{total} answered
        </Text>
      </View>
      <Pressable
        onPress={onSend}
        disabled={!clean}
        accessibilityRole="button"
        style={({ pressed }) => [styles.bigBtn, !clean && { opacity: 0.4 }, pressed && { transform: [{ scale: 0.97 }] }]}
      >
        <Text style={styles.bigBtnText}>{sent ? 'UPDATE ANSWER' : 'LOCK IN!'}</Text>
      </Pressable>
    </Frame>
  );
}

// ------------------------------------------------------------ draw ----
export function DrawScreen({ st, n, left }: { st: State; n: Names; left: number }) {
  const elapsed = Math.max(0, DRAW_MS - left);
  const present = presentOf(st);
  const landed = elapsed >= DRAW_LANDS_MS;
  const spin = Math.floor(Math.pow(Math.min(elapsed, DRAW_LANDS_MS) / DRAW_LANDS_MS, 0.55) * 36);
  const shown = landed ? st.host! : present[spin % Math.max(1, present.length)];
  const me = st.host === n.uid;
  return (
    <Frame tint={landed ? show.yellow : undefined}>
      <Tag text="TODAY'S HOST IS…" color={show.cyan} />
      <View style={styles.center}>
        <Telop size={landed ? 34 : 28} color={landed ? show.yellow : show.white} width={3}>
          {n.who(shown).toUpperCase()}
        </Telop>
        {landed && (
          <Telop size={16} color={show.white}>
            {me ? 'you keep your answers a secret!' : 'can you guess their answers?'}
          </Telop>
        )}
      </View>
    </Frame>
  );
}

// ------------------------------------------------------- choices ----
type CardState = 'idle' | 'picked' | 'dim' | 'right' | 'wrong';

function ChoiceCard(props: { i: number; text: string; state: CardState; onPress?: () => void; note?: string; chips?: string[] }) {
  const { i, text, state, onPress, note, chips } = props;
  const color = CHOICE_COLORS[i];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${CHOICE_LETTERS[i]}: ${text}`}
      style={({ pressed }) => [
        styles.choice,
        { borderColor: color },
        state === 'picked' && { backgroundColor: color },
        state === 'dim' && { opacity: 0.4 },
        state === 'right' && { backgroundColor: show.good, borderColor: show.white },
        state === 'wrong' && { opacity: 0.55 },
        pressed && { transform: [{ scale: 0.97 }] },
      ]}
    >
      <View style={styles.choiceTop}>
        <View style={[styles.letter, { backgroundColor: state === 'right' ? show.white : color }]}>
          <Text style={styles.letterText}>{CHOICE_LETTERS[i]}</Text>
        </View>
        {note ? (
          <Text style={[styles.note, (state === 'picked' || state === 'right') && { color: show.ink }]} numberOfLines={1}>
            {note}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.choiceText, (state === 'picked' || state === 'right') && { color: show.ink }]} numberOfLines={3}>
        {text}
      </Text>
      {chips && chips.length > 0 && (
        <View style={styles.chips}>
          {chips.map((c, k) => (
            <View key={k} style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>
                {c}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

// ----------------------------------------------------------- guess ----
export function GuessScreen(props: { st: State; n: Names; picked: number | null; onPick: (i: number) => void; myAnswer: string; guessed: number; total: number }) {
  const { st, n, picked, onPick, myAnswer, guessed, total } = props;
  const isHost = st.host === n.uid;
  return (
    <Frame>
      <Tag text={`WHAT DID ${n.who(st.host!).toUpperCase()} ANSWER?`} color={show.pink} />
      <View style={styles.questionBox}>
        <Telop size={17} lines={3}>
          {st.questions[st.qi]}
        </Telop>
      </View>
      {isHost ? (
        <View style={styles.hostBox}>
          <Telop size={18} color={show.yellow}>
            YOU ARE THE HOST!
          </Telop>
          <Text style={styles.small}>your answer: {myAnswer || '(none)'}</Text>
          <Text style={styles.small}>
            {guessed}/{total} guessed. Keep a poker face!
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {Array.from({ length: CHOICES }, (_, i) => (
            <View key={i} style={styles.cell}>
              <ChoiceCard
                i={i}
                text={st.choices[i] ?? ''}
                state={picked === null ? 'idle' : picked === i ? 'picked' : 'dim'}
                onPress={picked === null ? () => onPick(i) : undefined}
                note={picked === i ? 'FINAL ANSWER!' : undefined}
              />
            </View>
          ))}
        </View>
      )}
      {!isHost && picked !== null && (
        <Text style={styles.small}>
          {guessed}/{total} guessed
        </Text>
      )}
    </Frame>
  );
}

// ---------------------------------------------------------- reveal ----
export function RevealScreen({ st, n }: { st: State; n: Names }) {
  const r = st.reveal!;
  const hostName = n.who(st.host!);
  if (r.skipped) {
    return (
      <Frame>
        <Tag text={`QUESTION ${r.q + 1} / ${QUESTIONS_PER_GAME}`} />
        <View style={styles.center}>
          <Telop size={22}>{r.question}</Telop>
          <Telop size={18} color={show.yellow}>
            {hostName} stayed silent… skipped!
          </Telop>
        </View>
      </Frame>
    );
  }
  const verdict = r.right.length > 0 ? `${r.right.map(n.who).join(' & ')} got it!` : `Nobody knew ${hostName}!`;
  return (
    <Frame tint={r.right.length > 0 ? show.good : show.bad}>
      <Tag text={`${hostName.toUpperCase()} SAID…`} color={show.yellow} />
      <View style={styles.grid}>
        {r.choices.map((text, i) => {
          const pickers = Object.keys(r.picks).filter((id) => r.picks[id] === i).map(n.who);
          const by = r.authors[i];
          return (
            <View key={i} style={styles.cell}>
              <ChoiceCard
                i={i}
                text={text}
                state={i === r.correct ? 'right' : 'wrong'}
                note={i === r.correct ? "HOST'S ANSWER" : by ? `by ${n.who(by)}` : 'stock answer'}
                chips={pickers}
              />
            </View>
          );
        })}
      </View>
      <Telop size={17} color={r.right.length > 0 ? show.good : show.bad}>
        {verdict}
      </Telop>
    </Frame>
  );
}

// ------------------------------------------------------------ over ----
export function OverScreen({ st, n }: { st: State; n: Names }) {
  const host = st.host ? n.who(st.host) : 'the Host';
  const found = uncoveredCount(st);
  let head = 'NOBODY WINS!';
  let sub = `${host} was uncovered ${found} of ${QUESTIONS_PER_GAME} times.`;
  if (st.outcome === 'host') {
    head = st.winner === n.uid ? 'YOU WIN!' : `${host.toUpperCase()} WINS!`;
    sub = `The players uncovered ${found} of ${QUESTIONS_PER_GAME} answers. What a well-known Host!`;
  } else if (st.outcome === 'player' && st.winner) {
    head = st.winner === n.uid ? 'YOU WIN!' : `${n.who(st.winner).toUpperCase()} WINS!`;
    sub = `${st.winner === n.uid ? 'You guessed' : `${n.who(st.winner)} guessed`} every single answer of ${host}!`;
  } else if (st.lastLeft && st.host === st.lastLeft) {
    sub = 'The Host left the studio.';
  }
  return (
    <Frame tint={show.yellow}>
      <View style={styles.center}>
        <Telop size={34} color={show.yellow} width={3}>
          {head}
        </Telop>
        <Telop size={15}>{sub}</Telop>
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    backgroundColor: show.screen,
    borderColor: show.screenEdge,
    borderWidth: 4,
    borderRadius: 20,
    padding: 10,
    gap: 8,
    justifyContent: 'center',
  },
  tag: { alignSelf: 'center', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 3, borderWidth: 2, borderColor: show.ink },
  tagText: { color: show.ink, fontFamily: FONT_SHOW, fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  questionBox: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, minHeight: 50 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 6 },
  input: {
    backgroundColor: show.white,
    color: show.ink,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: show.cyan,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 17,
    fontFamily: FONT_SHOW,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  small: { color: show.muted, fontFamily: FONT_SHOW, fontSize: 12, textAlign: 'center' },
  bigBtn: { backgroundColor: show.pink, borderColor: show.ink, borderWidth: 3, borderRadius: 14, alignItems: 'center', paddingVertical: 11 },
  bigBtnText: { color: show.white, fontFamily: FONT_SHOW, fontWeight: '900', fontSize: 17, letterSpacing: 1 },
  hostBox: { alignItems: 'center', gap: 6, paddingVertical: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '48.5%' },
  choice: { minHeight: 74, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 3, borderRadius: 14, padding: 7, gap: 3 },
  choiceTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  letter: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  letterText: { color: show.ink, fontFamily: FONT_SHOW, fontWeight: '900', fontSize: 13 },
  note: { flex: 1, color: show.muted, fontFamily: FONT_SHOW, fontSize: 10.5, fontWeight: '900', letterSpacing: 0.5 },
  choiceText: { color: show.white, fontFamily: FONT_SHOW, fontSize: 13.5, lineHeight: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  chip: { backgroundColor: show.ink, borderRadius: 9, paddingHorizontal: 6, paddingVertical: 1 },
  chipText: { color: show.white, fontFamily: FONT_SHOW, fontSize: 10 },
});
