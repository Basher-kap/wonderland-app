import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { IntroTheme } from '../types';
import { FONT_BODY, wordle as w } from './theme';
import { LibraryBackground } from './LibraryBackground';

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

export const intro: IntroTheme = {
  Backdrop: LibraryBackground,
  accent: w.oxblood,
  text: w.ink,
  hint: w.paperMuted,
  bullet: w.oxblood,
  fontFamily: FONT_BODY,
  dialog: { backgroundColor: w.page, borderColor: w.brass, borderWidth: 2, borderRadius: 8 },
  Decor: BookmarkDecor,
};
