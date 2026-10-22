import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { QuestionCard } from '@/components/QuestionCard';
import { Screen } from '@/components/Screen';
import { formatShort } from '@/lib/dates';
import { totals, useAnswers, type AnswerRecord } from '@/lib/progress';
import {
  getCurrentQuestionDate,
  getPastQuestions,
  PAST_PAGE_SIZE,
  type DailyQuestion,
} from '@/lib/questions';
import { colors, fonts, radius, shadow } from '@/theme';

type Past = { questions: DailyQuestion[] | null; hasMore: boolean; error: string | null };

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

// The newest page of questions before today's.
async function fetchPast(): Promise<Past> {
  try {
    const today = await getCurrentQuestionDate();
    if (!today) return { questions: [], hasMore: false, error: null };
    const page = await getPastQuestions(today);
    return { questions: page, hasMore: page.length === PAST_PAGE_SIZE, error: null };
  } catch (e) {
    return { questions: null, hasMore: false, error: errorMessage(e) };
  }
}

export default function HistoryScreen() {
  const [past, setPast] = useState<Past>({ questions: null, hasMore: false, error: null });
  const { answers, save } = useAnswers();
  const [open, setOpen] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let active = true;
    fetchPast().then((next) => active && setPast(next));
    return () => {
      active = false;
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const next = await fetchPast();
    // A failed refresh keeps the questions already on screen.
    setPast((prev) => (next.error && prev.questions ? { ...prev, error: next.error } : next));
    setRefreshing(false);
  }, []);

  const { questions, hasMore, error } = past;

  async function loadMore() {
    const oldest = questions?.[questions.length - 1]?.question_date;
    if (!oldest) return;
    setLoadingMore(true);
    try {
      const page = await getPastQuestions(oldest);
      setPast((prev) => ({
        questions: [...(prev.questions ?? []), ...page],
        hasMore: page.length === PAST_PAGE_SIZE,
        error: null,
      }));
    } catch (e) {
      setPast((prev) => ({ ...prev, error: errorMessage(e) }));
    } finally {
      setLoadingMore(false);
    }
  }

  // Answering a past question is catching up: it's scored, but doesn't build the streak.
  function handleAnswer(date: string, record: AnswerRecord) {
    save(date, { ...record, catchUp: true });
  }

  const { answered, correct } = totals(answers);

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

      {error && <Text style={styles.empty}>{error}</Text>}
      {!questions && !error && <ActivityIndicator color={colors.mocha} />}
      {questions?.length === 0 && (
        <Text style={styles.empty}>No past questions yet. Your first cup is today ♡</Text>
      )}

      {questions?.map((q) => {
        const answer = answers[q.question_date];
        const isOpen = open === q.question_date;
        return (
          <View key={q.question_date} style={styles.item}>
            <Pressable
              onPress={() => setOpen(isOpen ? null : q.question_date)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.dateBadge}>
                <Text style={styles.dateText}>{formatShort(q.question_date)}</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowCategory} numberOfLines={1}>
                  {q.category?.name ?? 'Praxis SLP'}
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
                onAnswer={(record) => handleAnswer(q.question_date, record)}
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
