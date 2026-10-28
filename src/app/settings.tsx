import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { ExamSwitch } from '@/components/ExamSwitch';
import { Screen } from '@/components/Screen';
import { examFor } from '@/lib/exams';
import { useSettings } from '@/lib/settings';
import { colors, fonts, radius, shadow } from '@/theme';

export default function SettingsScreen() {
  const { exam } = useSettings();

  return (
    <Screen>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        accessibilityRole="button"
        accessibilityLabel="Back to today"
        hitSlop={8}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Text style={styles.backText}>←  Today</Text>
      </Pressable>

      <Text style={styles.title}>Settings</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Exam</Text>
        <ExamSwitch />
        <Text style={styles.hint}>{examFor(exam).blurb}</Text>
      </View>

    </Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  backText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.mocha },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.espresso },
  card: {
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    padding: 20,
    gap: 14,
    ...shadow,
  },
  cardTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.espresso },
  hint: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.mocha },
  pressed: { transform: [{ scale: 0.96 }], opacity: 0.85 },
});
