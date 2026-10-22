import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/theme';

type Props = { tone: 'error' | 'success' | 'info'; children: ReactNode };

const palette = {
  error: { bg: colors.berrySoft, border: colors.berry },
  success: { bg: colors.sageSoft, border: colors.sage },
  info: { bg: colors.honeySoft, border: colors.honey },
};

// A short status message inside a form, announced to screen readers when it appears.
export function Notice({ tone, children }: Props) {
  const p = palette[tone];
  return (
    <View
      style={[styles.box, { backgroundColor: p.bg, borderColor: p.border }]}
      accessibilityRole={tone === 'error' ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.sm, borderWidth: 1.5, paddingVertical: 12, paddingHorizontal: 14 },
  text: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 20, color: colors.espresso },
});
