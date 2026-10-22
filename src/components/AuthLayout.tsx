import type { ReactNode } from 'react';
import { KeyboardAvoidingView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { LatteHearts } from '@/components/LatteHearts';
import { Screen } from '@/components/Screen';
import { colors, fonts, radius, shadow } from '@/theme';

type Props = {
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
  /** Links shown under the card, e.g. "New here? Create an account". */
  footer?: ReactNode;
};

// Shared frame for the sign-in, sign-up and password screens.
export function AuthLayout({ title, subtitle, children, footer }: Props) {
  const { width } = useWindowDimensions();
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <View style={styles.hero}>
          <LatteHearts size={Math.min(width * 0.34, 130)} />
          <Text style={styles.brand}>Daily Drip</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.heading}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {children}
        </View>
        {footer}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center', marginTop: 8 },
  brand: { fontFamily: fonts.display, fontSize: 30, color: colors.espresso },
  card: {
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    padding: 22,
    gap: 16,
    ...shadow,
  },
  heading: { gap: 6 },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.espresso },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.mocha },
});
