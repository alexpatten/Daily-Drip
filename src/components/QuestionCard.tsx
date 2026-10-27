import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import type { AnswerRecord } from '@/lib/progress';
import { choiceText, LETTERS, type DailyQuestion, type Letter } from '@/lib/questions';
import { colors, fonts, radius, shadow } from '@/theme';
import { ChoiceButton, type ChoiceState } from './ChoiceButton';

type Props = {
  question: DailyQuestion;
  // e.g. "2 of 5" when the day has several questions.
  counter?: string;
  answer?: AnswerRecord;
  onAnswer: (record: AnswerRecord) => void;
};

function haptic(correct: boolean) {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(
    correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
  ).catch(() => {});
}

export function QuestionCard({ question, counter, answer, onAnswer }: Props) {
  const [selected, setSelected] = useState<Letter | null>(null);
  const revealed = Boolean(answer);

  function stateFor(letter: Letter): ChoiceState {
    if (!answer) return selected === letter ? 'selected' : 'idle';
    if (letter === question.correct_answer) return 'correct';
    if (letter === answer.choice) return 'wrong';
    return 'dimmed';
  }

  function submit() {
    if (!selected) return;
    const correct = selected === question.correct_answer;
    haptic(correct);
    onAnswer({ choice: selected, correct });
  }

  return (
    <View style={styles.card}>
      {question.category && (
        <View style={styles.chipRow}>
          <View style={styles.chipLine}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{question.category.name}</Text>
            </View>
            {counter && <Text style={styles.counter}>{counter}</Text>}
          </View>
          <Text style={styles.testName} numberOfLines={2}>
            {question.category.test_name}
          </Text>
        </View>
      )}

      <Text style={styles.question}>{question.question}</Text>

      <View style={styles.choices} accessibilityRole="radiogroup">
        {LETTERS.map((letter) => (
          <ChoiceButton
            key={letter}
            letter={letter}
            text={choiceText(question, letter)}
            state={stateFor(letter)}
            disabled={revealed}
            onPress={() => setSelected(letter)}
          />
        ))}
      </View>

      {!revealed && (
        <Pressable
          onPress={submit}
          disabled={!selected}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.submit,
            !selected && styles.submitDisabled,
            pressed && selected && styles.pressed,
          ]}
        >
          <Text style={styles.submitText}>{selected ? 'Pour my answer ☕' : 'Pick an answer'}</Text>
        </Pressable>
      )}

      {answer && (
        <View style={[styles.result, answer.correct ? styles.resultRight : styles.resultWrong]}>
          <Text style={styles.resultTitle}>
            {answer.correct
              ? 'Perfect pour! ♡'
              : `Not quite. The answer is ${question.correct_answer}.`}
          </Text>
          <Text style={styles.explanation}>{question.explanation}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    padding: 20,
    gap: 16,
    ...shadow,
  },
  chipRow: { gap: 6, alignItems: 'flex-start' },
  chipLine: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: 8 },
  counter: { marginLeft: 'auto', fontFamily: fonts.bodyBold, fontSize: 12, color: colors.mocha },
  chip: {
    flexShrink: 1,
    backgroundColor: colors.honeySoft,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.caramel },
  testName: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.mocha, letterSpacing: 0.3 },
  question: {
    fontFamily: fonts.bodySemi,
    fontSize: 18,
    lineHeight: 26,
    color: colors.espresso,
  },
  choices: { gap: 10 },
  submit: {
    minHeight: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.espresso,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  submitDisabled: { backgroundColor: colors.latte, opacity: 0.55 },
  pressed: { transform: [{ scale: 0.98 }] },
  submitText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.cream },
  result: { borderRadius: radius.md, padding: 16, gap: 8 },
  resultRight: { backgroundColor: colors.sageSoft },
  resultWrong: { backgroundColor: colors.roseSoft },
  resultTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.espresso },
  explanation: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.espresso },
});
