import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EXAMS } from '@/lib/exams';
import { updateSettings, useSettings } from '@/lib/settings';
import { colors, fonts, radius } from '@/theme';

// Segmented control for choosing which exam to practice.
export function ExamSwitch() {
  const { exam } = useSettings();
  return (
    <View style={styles.track} accessibilityRole="radiogroup" accessibilityLabel="Exam">
      {EXAMS.map((e) => {
        const selected = e.slug === exam;
        return (
          <Pressable
            key={e.slug}
            onPress={() => updateSettings({ exam: e.slug })}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={e.name}
            style={({ pressed }) => [styles.option, selected && styles.selected, pressed && styles.pressed]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]} numberOfLines={1}>
              {e.shortName}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.blushDeep,
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
  },
  option: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  selected: { backgroundColor: colors.cream },
  pressed: { opacity: 0.8 },
  label: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.mocha },
  selectedLabel: { color: colors.espresso },
});
