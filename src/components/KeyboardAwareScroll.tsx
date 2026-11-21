import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, StyleSheet } from 'react-native';
import type { ScrollViewProps } from 'react-native';

// A ScrollView that keeps what the player is typing above the keyboard.
//
// When the keyboard opens it measures how much of this scroll view the keyboard really covers and adds
// that much room at the bottom of the content, then scrolls to the end so the last thing on the screen
// (the answer box) sits just above the keyboard. If the phone already shrinks the screen for the
// keyboard, nothing is covered, so nothing is added: it works the same with or without that.
// While the keyboard is open it also follows the content to the end, so a box that appears later
// (the next turn) is brought into view too. Taps on buttons still work with the keyboard open.
export function KeyboardAwareScroll({ children, contentContainerStyle, ...rest }: ScrollViewProps) {
  const ref = useRef<ScrollView>(null);
  const open = useRef(false);
  const [covered, setCovered] = useState(0);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      open.current = true;
      const keyboardTop = e.endCoordinates.screenY;
      ref.current?.measureInWindow((_x, y, _w, h) => {
        setCovered(Math.max(0, Math.ceil(y + h - keyboardTop)));
        setTimeout(() => ref.current?.scrollToEnd({ animated: true }), 80);
      });
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      open.current = false;
      setCovered(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const flat = StyleSheet.flatten(contentContainerStyle) ?? {};
  const base = (flat.paddingBottom as number | undefined) ?? (flat.padding as number | undefined) ?? 0;

  return (
    <ScrollView
      ref={ref}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[flat, { paddingBottom: base + covered }]}
      onContentSizeChange={() => {
        if (open.current) ref.current?.scrollToEnd({ animated: true });
      }}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}
