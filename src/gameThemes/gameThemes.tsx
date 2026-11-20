import React from 'react';
import type { ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { FoodLandBackground } from '../components/FoodLandBackground';
import { LibraryBackground } from '../components/LibraryBackground';
import { QuizStageBackground } from '../components/QuizStageBackground';
import { OrphanageBackground } from '../components/OrphanageBackground';
import { WildWestBackground } from '../components/WildWestBackground';
import { calc as c, FONT_SCREEN } from './humanCalculatorTheme';
import { food as f } from './foodLandTheme';
import { FONT_DISPLAY, west as h } from './hangmanTheme';
import { FONT_DISPLAY as FONT_KIDS, kids as k } from './schulteTheme';
import { FONT_BODY, wordle as w } from './wordleTheme';

// One place that says which games have their own look. A game that is not listed here keeps the
// Space look. GameScreen and RoundIntro ask this file; nothing else has to know the list.

type Wrap = React.ComponentType<{ children?: React.ReactNode }>;

// The background of the whole game screen (GameScreen) and of the rules dialogs (RoundIntro).
export function getGameBackdrop(gameId?: string): Wrap | null {
  if (gameId === 'magical-banana') return FoodLandBackground;
  if (gameId === 'wordle') return LibraryBackground;
  if (gameId === 'human-calculator') return QuizStageBackground;
  if (gameId === 'hangman') return WildWestBackground;
  if (gameId === 'schulte-table') return OrphanageBackground;
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

// Hangman: the rules are a poster nailed to a board, a nail in every corner.
function PosterNails() {
  return (
    <View pointerEvents="none" style={nails.wrap}>
      <View style={[nails.nail, { top: 6, left: 6 }]} />
      <View style={[nails.nail, { top: 6, right: 6 }]} />
      <View style={[nails.nail, { bottom: 6, left: 6 }]} />
      <View style={[nails.nail, { bottom: 6, right: 6 }]} />
    </View>
  );
}

const nails = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject },
  nail: { position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: h.brassDark },
});

const HANGMAN_INTRO: IntroTheme = {
  Backdrop: WildWestBackground,
  accent: h.wanted,
  text: h.paperInk,
  hint: h.cream,
  bullet: h.wanted,
  fontFamily: FONT_DISPLAY,
  dialog: { backgroundColor: h.paper, borderColor: h.woodDark, borderWidth: 4, borderRadius: 4 },
  Decor: PosterNails,
};

// Schulte Table: the rules are a paper note stuck on the wall with a strip of tape.
function TapeDecor() {
  return <View pointerEvents="none" style={tape.strip} />;
}

const tape = StyleSheet.create({
  strip: { position: 'absolute', top: -11, alignSelf: 'center', width: 84, height: 22, backgroundColor: k.tape, transform: [{ rotate: '-3deg' }] },
});

const SCHULTE_INTRO: IntroTheme = {
  Backdrop: OrphanageBackground,
  accent: k.title,
  text: k.ink,
  hint: k.inkSoft,
  bullet: k.title,
  fontFamily: FONT_KIDS,
  dialog: { backgroundColor: k.paper, borderColor: k.paperEdge, borderWidth: 3, borderRadius: 22 },
  Decor: TapeDecor,
};

export function getIntroTheme(gameId?: string): IntroTheme | null {
  if (gameId === 'wordle') return WORDLE_INTRO;
  if (gameId === 'human-calculator') return CALC_INTRO;
  if (gameId === 'magical-banana') return FOOD_INTRO;
  if (gameId === 'hangman') return HANGMAN_INTRO;
  if (gameId === 'schulte-table') return SCHULTE_INTRO;
  return null;
}
