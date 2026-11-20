import React from 'react';
import type { ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import { FoodLandBackground } from '../components/FoodLandBackground';
import { CaveBackground } from '../components/CaveBackground';
import { FestivalBackground } from '../components/FestivalBackground';
import { MayaGlyph } from '../components/MayaGlyph';
import { LibraryBackground } from '../components/LibraryBackground';
import { QuizStageBackground } from '../components/QuizStageBackground';
import { calc as c, FONT_SCREEN } from './humanCalculatorTheme';
import { FONT_FORTUNE, fortune as fo } from './fortuneTheme';
import { cave as cv, FONT_XIBALBA } from './xibalbaTheme';
import { food as f } from './foodLandTheme';
import { FONT_BODY, wordle as w } from './wordleTheme';

// One place that says which games have their own look. A game that is not listed here keeps the
// Space look. GameScreen and RoundIntro ask this file; nothing else has to know the list.

type Wrap = React.ComponentType<{ children?: React.ReactNode }>;

// The background of the whole game screen (GameScreen) and of the rules dialogs (RoundIntro).
export function getGameBackdrop(gameId?: string): Wrap | null {
  if (gameId === 'magical-banana') return FoodLandBackground;
  if (gameId === 'wordle') return LibraryBackground;
  if (gameId === 'human-calculator') return QuizStageBackground;
  if (gameId === 'fortune') return FestivalBackground;
  if (gameId === 'traps-of-xibalba') return CaveBackground;
  return null;
}

// The look of the rules dialogs (RoundIntro). `accent` colours the title, the name and the headings.
export type IntroTheme = {
  Backdrop: Wrap;
  accent: string;
  text: string;
  hint: string;
  bullet: string;
  fontFamily?: string;
  dialog: ViewStyle;
  Awning?: React.ComponentType; // sits above the dialog, in the flow (the stall awning)
  Decor?: React.ComponentType; // drawn inside the dialog, absolutely positioned (the bookmark, the marquee)
};

// A food-stall awning: stripes with scalloped edges, hanging over the rules card.
function StallAwning() {
  return (
    <View style={awning.row} pointerEvents="none">
      {Array.from({ length: 9 }, (_, i) => (
        <View key={i} style={[awning.stripe, { backgroundColor: i % 2 ? f.cream : f.berry }]} />
      ))}
    </View>
  );
}

const awning = StyleSheet.create({
  row: { flexDirection: 'row', height: 28, zIndex: 2 },
  stripe: { flex: 1, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
});

const FOOD_INTRO: IntroTheme = {
  Backdrop: FoodLandBackground,
  accent: f.berry,
  text: f.ink,
  hint: f.textSoft,
  bullet: f.berry,
  dialog: { backgroundColor: f.cream, borderColor: f.creamEdge, borderWidth: 2, borderRadius: 18, marginTop: -14, paddingTop: 36 },
  Awning: StallAwning,
};

// Wordle: the rules are a page of a book, with a bookmark hanging off the top edge.
function BookmarkDecor() {
  return (
    <View pointerEvents="none" style={bookmark.tab}>
      <View style={bookmark.notch} />
    </View>
  );
}

const bookmark = StyleSheet.create({
  tab: { position: 'absolute', top: -6, right: 24, width: 20, height: 58, backgroundColor: w.ribbon },
  notch: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: w.page,
  },
});

const WORDLE_INTRO: IntroTheme = {
  Backdrop: LibraryBackground,
  accent: w.oxblood,
  text: w.ink,
  hint: w.paperMuted,
  bullet: w.oxblood,
  fontFamily: FONT_BODY,
  dialog: { backgroundColor: w.page, borderColor: w.brass, borderWidth: 2, borderRadius: 8 },
  Decor: BookmarkDecor,
};

// Human Calculator: the rules appear on the big monitor, under a row of marquee bulbs.
function MarqueeDecor() {
  return (
    <View pointerEvents="none" style={marquee.row}>
      {Array.from({ length: 12 }, (_, i) => (
        <View key={i} style={marquee.bulb} />
      ))}
    </View>
  );
}

const marquee = StyleSheet.create({
  row: { position: 'absolute', top: 10, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  bulb: { width: 7, height: 7, borderRadius: 7, backgroundColor: c.gold },
});

const CALC_INTRO: IntroTheme = {
  Backdrop: QuizStageBackground,
  accent: c.screenText,
  text: c.keyText,
  hint: c.boardMuted,
  bullet: c.gold,
  fontFamily: FONT_SCREEN,
  dialog: { backgroundColor: c.screen, borderColor: c.bezelEdge, borderWidth: 6, borderRadius: 16, paddingTop: 38 },
  Decor: MarqueeDecor,
};

// Fortune: the rules are an omikuji slip, with a red hanko seal ("fortune") in the corner.
function HankoDecor() {
  return (
    <View pointerEvents="none" style={hanko.seal}>
      <Text style={hanko.mark}>福</Text>
    </View>
  );
}

const hanko = StyleSheet.create({
  seal: { position: 'absolute', top: 12, right: 14, width: 38, height: 38, borderRadius: 6, backgroundColor: fo.vermilion, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] },
  mark: { color: fo.paper, fontSize: 24, fontWeight: '800' },
});

const FORTUNE_INTRO: IntroTheme = {
  Backdrop: FestivalBackground,
  accent: fo.vermilionDark,
  text: fo.ink,
  hint: fo.textSoft,
  bullet: fo.vermilionDark,
  fontFamily: FONT_FORTUNE,
  dialog: { backgroundColor: fo.paper, borderColor: fo.vermilionDark, borderWidth: 3, borderRadius: 6 },
  Decor: HankoDecor,
};

// Traps of Xibalba: the rules are a stone tablet, with a carved glyph in each top corner.
function GlyphDecor() {
  return (
    <>
      <View pointerEvents="none" style={glyphs.left}>
        <MayaGlyph kind="face" size={24} color={cv.jadeDim} />
      </View>
      <View pointerEvents="none" style={glyphs.right}>
        <MayaGlyph kind="sun" size={24} color={cv.jadeDim} />
      </View>
    </>
  );
}

const glyphs = StyleSheet.create({
  left: { position: 'absolute', top: 10, left: 12 },
  right: { position: 'absolute', top: 10, right: 12 },
});

const XIBALBA_INTRO: IntroTheme = {
  Backdrop: CaveBackground,
  accent: cv.jade,
  text: cv.bone,
  hint: cv.boneMuted,
  bullet: cv.torch,
  fontFamily: FONT_XIBALBA,
  dialog: { backgroundColor: cv.tablet, borderColor: cv.stoneEdge, borderWidth: 4, borderRadius: 6, paddingTop: 40 },
  Decor: GlyphDecor,
};

export function getIntroTheme(gameId?: string): IntroTheme | null {
  if (gameId === 'traps-of-xibalba') return XIBALBA_INTRO;
  if (gameId === 'fortune') return FORTUNE_INTRO;
  if (gameId === 'wordle') return WORDLE_INTRO;
  if (gameId === 'human-calculator') return CALC_INTRO;
  if (gameId === 'magical-banana') return FOOD_INTRO;
  return null;
}
