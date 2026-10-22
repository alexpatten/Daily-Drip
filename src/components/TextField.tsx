import { useState, type Ref } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
  type TextInputProps,
} from 'react-native';

import { colors, fonts, radius } from '@/theme';

type Props = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  /** Hides the text and adds a Show/Hide toggle. */
  password?: boolean;
  ref?: Ref<TextInputInstance>;
};

export function TextField({ label, error, hint, password = false, onFocus, onBlur, ref, ...input }: Props) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, focused && styles.boxFocused, !!error && styles.boxError]}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={colors.latte}
          selectionColor={colors.caramel}
          autoCapitalize={password ? 'none' : input.autoCapitalize}
          autoCorrect={password ? false : input.autoCorrect}
          {...input}
          secureTextEntry={password ? hidden : input.secureTextEntry}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={styles.input}
        />
        {password && (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            hitSlop={8}
            style={styles.toggle}
          >
            <Text style={styles.toggleText}>{hidden ? 'Show' : 'Hide'}</Text>
          </Pressable>
        )}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.espresso },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.blushDeep,
    backgroundColor: colors.foam,
  },
  boxFocused: { borderColor: colors.rose },
  boxError: { borderColor: colors.berry },
  input: {
    flex: 1,
    alignSelf: 'stretch',
    paddingHorizontal: 14,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.espresso,
  },
  toggle: { paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  toggleText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.caramel },
  error: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.berry },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.mocha },
});
