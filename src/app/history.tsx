import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { ExamSwitch } from '@/components/ExamSwitch';
import { QuestionCard } from '@/components/QuestionCard';
import { Screen } from '@/components/Screen';
import { formatShort } from '@/lib/dates';
import { examFor, type ExamSlug } from '@/lib/exams';
import { answerFor, totals, useProgress, type AnswerRecord } from '@/lib/progress';
import { getPastQuestions, pastPageDays, slotKey, type DailyQuestion } from '@/lib/questions';
import { useSettings } from '@/lib/settings';
import { colors, fonts, radius, shadow } from '@/theme';

// `key` is the exam and count the questions were fetched for.
type Past = { key: string; questions: DailyQuestion[] | null; hasMore: boolean; error: string | null };

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

// A page of past days' questions before `beforeDate` (default: today), newest first.
async function fetchPast(exam: ExamSlug, perDay: number, beforeDate: string | null): Promise<Past> {
  const key = `${exam}:${perDay}`;
  const days = pastPageDays(perDay);
  try {
    const page = await getPastQuestions(exam, perDay, beforeDate, days);
    const pageDays = new Set(page.map((q) => q.question_date)).size;
    return { key, questions: page, hasMore: pageDays === days, error: null };
  } catch (e) {
    return { key, questions: null, hasMore: false, error: errorMessage(e) };
  }
}

export default function HistoryScreen() {
  const { exam, perDay } = useSettings();
  const key = `${exam}:${perDay}`;
  const [past, setPast] = useState<Past | null>(null);
  const { progress, save } = useProgress();
  const [open, setOpen] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let active = true;
    fetchPast(exam, perDay, null).then((next) => active && setPast(next));
    return () => {
      active = false;
    };
  }, [exam, perDay]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const next = await fetchPast(exam, perDay, null);
    // A failed refresh keeps the questions already on screen.
    setPast((prev) =>
      next.error && prev?.questions && prev.key === next.key ? { ...prev, error: next.error } : next,
    );
    setRefreshing(false);
  }, [exam, perDay]);

  // Until questions for the current settings arrive, show the loading state.
  const current = past?.key === key ? past : null;
  const questions = current?.questions ?? null;

  async function loadMore() {
    const oldest = questions?.[questions.length - 1]?.question_date;
    if (!oldest) return;
    setLoadingMore(true);
    const next = await fetchPast(exam, perDay, oldest);
    setPast((prev) => {
      if (prev?.key !== next.key) return prev;
      if (next.error) return { ...prev, error: next.error };
      return { ...next, questions: [...(prev.questions ?? []), ...(next.questions ?? [])] };
    });
    setLoadingMore(false);
  }

  // Answering a past question is catching up: it's scored, but doesn't build the streak.
  function handleAnswer(question: DailyQuestion, record: AnswerRecord) {
    save(question, { ...record, catchUp: true });
  }

  const { answered, correct } = totals(progress, exam);
  const error = current?.error ?? null;
  const hasMore = current?.hasMore ?? false;

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        accessibilityRole="button"
        accessibilityLabel="Back to today"
        hitSlop={8}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Text style={styles.backText}>←  Today</Text>
      </Pressable>

      <View>
        <Text style={styles.title}>Past brews</Text>
        <Text style={styles.subtitle}>
          {answered === 0
            ? 'Catch up on questions you missed.'
            : `${correct} of ${answered} answered correctly`}
        </Text>
      </View>

      <ExamSwitch />

      {error && <Text style={styles.empty}>{error}</Text>}
      {!questions && !error && <ActivityIndicator color={colors.mocha} />}
      {questions?.length === 0 && (
        <Text style={styles.empty}>No past questions yet. Your first cup is today ♡</Text>
      )}

      {questions?.map((q) => {
        const answer = answerFor(progress, q);
        const slot = slotKey(q);
        const isOpen = open === slot;
        return (
          <View key={slot} style={styles.item}>
            <Pressable
              onPress={() => setOpen(isOpen ? null : slot)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.dateBadge}>
                <Text style={styles.dateText}>{formatShort(q.question_date)}</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowCategory} numberOfLines={1}>
                  {q.category?.name ?? examFor(q.exam).shortName}
                </Text>
                {!isOpen && (
                  <Text style={styles.rowQuestion} numberOfLines={2}>
                    {q.question}
                  </Text>
                )}
              </View>
              <Text style={styles.status}>{answer ? (answer.correct ? '♥' : '♡') : '•'}</Text>
            </Pressable>
            {isOpen && (
              <QuestionCard
                question={q}
                answer={answer}
                onAnswer={(record) => handleAnswer(q, record)}
              />
            )}
          </View>
        );
      })}

      {hasMore && (
        <Button label="Show older brews" variant="secondary" loading={loadingMore} onPress={loadMore} />
      )}
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
  subtitle: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.mocha, marginTop: 2 },
  empty: { fontFamily: fonts.displayItalic, fontSize: 16, color: colors.mocha, textAlign: 'center' },
  item: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 72,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    ...shadow,
  },
  dateBadge: {
    backgroundColor: colors.roseSoft,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 62,
    alignItems: 'center',
  },
  dateText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.espresso },
  rowText: { flex: 1, gap: 2 },
  rowCategory: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.caramel },
  rowQuestion: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.espresso },
  status: { fontSize: 20, color: colors.rose, width: 22, textAlign: 'center' },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
});
