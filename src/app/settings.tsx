import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { ExamSwitch } from '@/components/ExamSwitch';
import { Screen } from '@/components/Screen';
import { examFor, MAX_PER_DAY, MIN_PER_DAY } from '@/lib/exams';
import { updateSettings, useSettings } from '@/lib/settings';
import { colors, fonts, radius, shadow } from '@/theme';

const QUICK_PICKS = [1, 5, 10, 15, 20, 25];

export default function SettingsScreen() {
  const { exam, perDay } = useSettings();
  const setPerDay = (n: number) => updateSettings({ perDay: n });

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

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Questions per day</Text>
        <View style={styles.stepper}>
          <StepButton
            label="−"
            accessibilityLabel="Fewer questions"
            disabled={perDay <= MIN_PER_DAY}
            onPress={() => setPerDay(perDay - 1)}
          />
          <View
            style={styles.value}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Questions per day"
            accessibilityValue={{ min: MIN_PER_DAY, max: MAX_PER_DAY, now: perDay }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) =>
              setPerDay(perDay + (e.nativeEvent.actionName === 'increment' ? 1 : -1))
            }
          >
            <Text style={styles.valueNumber}>{perDay}</Text>
            <Text style={styles.valueLabel}>{perDay === 1 ? 'question a day' : 'questions a day'}</Text>
          </View>
          <StepButton
            label="+"
            accessibilityLabel="More questions"
            disabled={perDay >= MAX_PER_DAY}
            onPress={() => setPerDay(perDay + 1)}
          />
        </View>

        <View style={styles.picks}>
          {QUICK_PICKS.map((n) => {
            const selected = n === perDay;
            return (
              <Pressable
                key={n}
                onPress={() => setPerDay(n)}
                accessibilityRole="button"
                accessibilityLabel={`${n} a day`}
                accessibilityState={{ selected }}
                style={({ pressed }) => [styles.pick, selected && styles.pickSelected, pressed && styles.pressed]}
              >
                <Text style={[styles.pickText, selected && styles.pickTextSelected]}>{n}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.hint}>Your streak grows on days you answer them all.</Text>
      </View>
    </Screen>
  );
}

type StepProps = {
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
};

function StepButton({ label, accessibilityLabel, disabled, onPress }: StepProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={6}
      style={({ pressed }) => [styles.step, disabled && styles.stepDisabled, pressed && styles.pressed]}
    >
      <Text style={styles.stepText}>{label}</Text>
    </Pressable>
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
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  step: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.espresso,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisabled: { backgroundColor: colors.latte, opacity: 0.45 },
  stepText: { fontFamily: fonts.bodyBold, fontSize: 26, lineHeight: 30, color: colors.cream },
  value: { flex: 1, alignItems: 'center' },
  valueNumber: { fontFamily: fonts.display, fontSize: 40, color: colors.caramel },
  valueLabel: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.mocha },
  picks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  pick: {
    minWidth: 48,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.blushDeep,
    backgroundColor: colors.foam,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickSelected: { backgroundColor: colors.roseSoft, borderColor: colors.rose },
  pickText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.mocha },
  pickTextSelected: { color: colors.espresso },
  pressed: { transform: [{ scale: 0.96 }], opacity: 0.85 },
});
