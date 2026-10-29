import { StyleSheet, Text, View } from 'react-native';

import { ExamSwitch } from '@/components/ExamSwitch';
import { Screen } from '@/components/Screen';
import { examFor } from '@/lib/exams';
import { useSettings } from '@/lib/settings';
import { colors, fonts, radius, shadow } from '@/theme';

export default function SettingsScreen() {
  const { exam } = useSettings();

  return (
    <Screen>
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
});
