import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Letter } from '@/lib/questions';
import { colors, fonts, radius } from '@/theme';

export type ChoiceState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed';

const palette: Record<ChoiceState, { bg: string; border: string; bubble: string; bubbleText: string }> = {
  idle: { bg: colors.foam, border: colors.blushDeep, bubble: colors.roseSoft, bubbleText: colors.espresso },
  selected: { bg: colors.roseSoft, border: colors.rose, bubble: colors.rose, bubbleText: colors.white },
  correct: { bg: colors.sageSoft, border: colors.sage, bubble: colors.sage, bubbleText: colors.white },
  wrong: { bg: colors.berrySoft, border: colors.berry, bubble: colors.berry, bubbleText: colors.white },
  dimmed: { bg: colors.foam, border: colors.blush, bubble: colors.blush, bubbleText: colors.mocha },
};

const badge: Partial<Record<ChoiceState, string>> = { correct: '✓', wrong: '✕' };

type Props = {
  letter: Letter;
  text: string;
  state: ChoiceState;
  disabled?: boolean;
  onPress?: () => void;
};

export function ChoiceButton({ letter, text, state, disabled, onPress }: Props) {
  const p = palette[state];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected: state === 'selected', disabled }}
      accessibilityLabel={`Choice ${letter}: ${text}`}
      style={({ pressed }) => [
        styles.choice,
        { backgroundColor: p.bg, borderColor: p.border },
        state === 'dimmed' && styles.dimmed,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={[styles.bubble, { backgroundColor: p.bubble }]}>
        <Text style={[styles.letter, { color: p.bubbleText }]}>{badge[state] ?? letter}</Text>
      </View>
      <Text style={styles.text}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 2,
  },
  pressed: { transform: [{ scale: 0.98 }] },
  dimmed: { opacity: 0.6 },
  bubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { fontFamily: fonts.bodyBold, fontSize: 15 },
  text: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 22,
    color: colors.espresso,
  },
});
