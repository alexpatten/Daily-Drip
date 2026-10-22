import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts, radius } from '@/theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'text';
  loading?: boolean;
  disabled?: boolean;
};

export function Button({ label, onPress, variant = 'primary', loading = false, disabled = false }: Props) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        inactive && styles.inactive,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.cream : colors.mocha} />
      ) : (
        <Text style={[styles.label, variant === 'primary' ? styles.primaryLabel : styles.otherLabel]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.espresso },
  secondary: { borderWidth: 2, borderColor: colors.rose },
  text: { minHeight: 44, paddingHorizontal: 12 },
  inactive: { opacity: 0.6 },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },
  label: { fontFamily: fonts.bodyBold, fontSize: 16, textAlign: 'center' },
  primaryLabel: { color: colors.cream },
  otherLabel: { color: colors.espresso },
});
