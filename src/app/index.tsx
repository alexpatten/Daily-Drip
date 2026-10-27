import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Link } from 'expo-router';

import { useCelebrations } from '@/components/Celebration';
import { LatteHearts } from '@/components/LatteHearts';
import { QuestionCard } from '@/components/QuestionCard';
import { Screen } from '@/components/Screen';
import { displayName, signOut, useAuth } from '@/lib/auth';
import { formatPretty } from '@/lib/dates';
import { examFor, type ExamSlug } from '@/lib/exams';
import {
  answerFor,
  currentStreak,
  RETRY_MIN_PER_DAY,
  useProgress,
  type AnswerRecord,
} from '@/lib/progress';
import {
  getRetryQuestions,
  getTodaysQuestions,
  slotKey,
  type DailyQuestion,
} from '@/lib/questions';
import { useSettings } from '@/lib/settings';
import { colors, fonts, radius, shadow } from '@/theme';

// `key` is the exam and count the questions were fetched for.
type Brew = { key: string; questions: DailyQuestion[] | null; error: string | null };

type RetriesFor = (exam: ExamSlug, today: string, limit: number) => number[];

async function fetchBrew(exam: ExamSlug, perDay: number, retriesFor: RetriesFor): Promise<Brew> {
  const key = `${exam}:${perDay}`;
  try {
    const fresh = await getTodaysQuestions(exam, perDay);
    return { key, questions: await withRetries(exam, perDay, fresh, retriesFor), error: null };
  } catch (e) {
    return { key, questions: null, error: e instanceof Error ? e.message : 'Something went wrong.' };
  }
}

// Readers doing RETRY_MIN_PER_DAY or more a day get earlier misses back, in place of new
// questions so the day's count stays the same. They're spread through the set and look
// like any other question.
async function withRetries(
  exam: ExamSlug,
  perDay: number,
  fresh: DailyQuestion[],
  retriesFor: RetriesFor,
): Promise<DailyQuestion[]> {
  const today = fresh[0]?.question_date;
  if (!today || perDay < RETRY_MIN_PER_DAY) return fresh;

  const freshIds = new Set(fresh.map((q) => q.id));
  const ids = retriesFor(exam, today, perDay).filter((id) => !freshIds.has(id));
  let retries: DailyQuestion[];
  try {
    retries = await getRetryQuestions(exam, ids);
  } catch {
    return fresh; // Today's new questions are still worth showing.
  }
  if (retries.length === 0) return fresh;

  // Retries fill empty slots first (a partly brewed day), then replace new questions.
  // Evenly spaced slots for the retries; new questions fill the rest in order.
  const total = Math.min(perDay, fresh.length + retries.length);
  const retrySlots = new Set(retries.map((_, j) => Math.floor(((j + 1) * total) / (retries.length + 1))));
  const newOnes = fresh.slice(0, total - retries.length);
  let r = 0;
  let n = 0;
  return Array.from({ length: total }, (_, i) => {
    const q = retrySlots.has(i) ? { ...retries[r++], retry: true } : newOnes[n++];
    return { ...q, question_date: today, position: i + 1 };
  });
}

// A failed refresh keeps the questions already on screen.
function merge(prev: Brew | null, next: Brew): Brew {
  return next.error && prev?.questions && prev.key === next.key ? prev : next;
}

export default function TodayScreen() {
  const { width } = useWindowDimensions();
  const { session } = useAuth();
  const { exam, perDay } = useSettings();
  const [brew, setBrew] = useState<Brew | null>(null);
  const { progress, save, reload, retriesFor, syncAwards } = useProgress();
  const [refreshing, setRefreshing] = useState(false);
  const { celebration, celebrate } = useCelebrations();

  // Answers from before awards existed still count.
  useEffect(() => {
    syncAwards();
  }, [syncAwards]);

  const load = useCallback(async () => {
    const next = await fetchBrew(exam, perDay, retriesFor);
    setBrew((prev) => merge(prev, next));
  }, [exam, perDay, retriesFor]);

  useEffect(() => {
    let active = true;
    const refresh = () =>
      fetchBrew(exam, perDay, retriesFor).then((next) => active && setBrew((prev) => merge(prev, next)));
    refresh();
    // Questions turn over at midnight Eastern; pick up the new ones on return.
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      reload();
      refresh();
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, [exam, perDay, reload, retriesFor]);

  function retry() {
    setBrew(null);
    load();
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Until questions for the current settings arrive, show the loading state.
  const current = brew?.key === `${exam}:${perDay}` ? brew : null;
  const questions = current?.questions?.length ? current.questions : null;
  // "Today" is the questions' date, which follows Eastern time for everyone.
  const today = questions?.[0].question_date ?? null;
  const answeredCount = questions?.filter((q) => answerFor(progress, q)).length ?? 0;
  const allAnswered = !!questions && answeredCount === questions.length;

  function handleAnswer(question: DailyQuestion, record: AnswerRecord) {
    // Answering the last of today's questions counts the day toward the streak.
    const finishesDay = questions!.every((q) => q.id === question.id || answerFor(progress, q));
    const earned = save(question, record, finishesDay ? questions : null);
    if (record.correct || earned.length > 0) celebrate(earned);
  }

  const streak = today ? currentStreak(progress, today) : null;
  const artSize = Math.min(width * 0.5, 190);
  const { shortName } = examFor(exam);
  const tagline =
    perDay === 1
      ? `one ${shortName} question, freshly brewed every day`
      : `${perDay} ${shortName} questions, freshly brewed every day`;

  return (
    <View style={styles.root}>
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.brand}>Daily Drip</Text>
            {today && <Text style={styles.date}>{formatPretty(today)}</Text>}
          </View>
          {streak !== null && (
            <View style={styles.streak} accessibilityLabel={`${streak} day streak`}>
              <Text style={styles.streakNumber}>{streak}</Text>
              <Text style={styles.streakLabel}>day streak</Text>
            </View>
          )}
        </View>

        <View style={styles.hero}>
          <LatteHearts size={artSize} />
          <Text style={styles.tagline}>{tagline}</Text>
        </View>

        {questions ? (
          <>
            {questions.length > 1 && (
              <Text style={styles.poured} accessibilityRole="header">
                {answeredCount} of {questions.length} poured
              </Text>
            )}
            {questions.map((q, i) => (
              <QuestionCard
                key={slotKey(q)}
                question={q}
                counter={questions.length > 1 ? `${i + 1} of ${questions.length}` : undefined}
                answer={answerFor(progress, q)}
                onAnswer={(record) => handleAnswer(q, record)}
              />
            ))}
          </>
        ) : current?.error ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>The espresso machine sputtered</Text>
            <Text style={styles.statusText}>{current.error}</Text>
            <Pressable
              onPress={retry}
              accessibilityRole="button"
              style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : current ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Still brewing</Text>
            <Text style={styles.statusText}>
              {"Today's questions are on their way. Pull down to check again in a moment."}
            </Text>
          </View>
        ) : (
          <View style={styles.statusCard}>
            <ActivityIndicator color={colors.mocha} />
            <Text style={styles.statusText}>
              {perDay === 1 ? "Pouring today's question…" : "Pouring today's questions…"}
            </Text>
          </View>
        )}

        {allAnswered && <Text style={styles.comeBack}>Come back tomorrow for a fresh cup ♡</Text>}

        <View style={styles.links}>
          <Link href={session ? '/history' : '/sign-in'} asChild>
            <Pressable
              accessibilityRole="link"
              style={({ pressed }) => [styles.pillLink, pressed && styles.pressed]}
            >
              <Text style={styles.pillText}>Past brews  →</Text>
            </Pressable>
          </Link>
          <Link href="/awards" asChild>
            <Pressable
              accessibilityRole="link"
              style={({ pressed }) => [styles.pillLink, pressed && styles.pressed]}
            >
              <Text style={styles.pillText}>Awards  →</Text>
            </Pressable>
          </Link>
          <Link href="/settings" asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Settings, ${perDay} a day`}
              style={({ pressed }) => [styles.pillLink, pressed && styles.pressed]}
            >
              <Text style={styles.pillText}>{perDay} a day  ·  Settings</Text>
            </Pressable>
          </Link>
        </View>

        {session ? (
          <View style={styles.account}>
            <Text style={styles.accountText} numberOfLines={1}>
              Signed in as {displayName(session)}
            </Text>
            <Pressable
              onPress={signOut}
              accessibilityRole="button"
              hitSlop={8}
              style={({ pressed }) => [styles.accountButton, pressed && styles.pressed]}
            >
              <Text style={styles.accountButtonText}>Sign out</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.account}>
            <Text style={styles.accountText}>Sign in to see your past brews.</Text>
            <Link href="/sign-in" asChild>
              <Pressable
                accessibilityRole="link"
                hitSlop={8}
                style={({ pressed }) => [styles.accountButton, pressed && styles.pressed]}
              >
                <Text style={styles.accountButtonText}>Sign in or create an account</Text>
              </Pressable>
            </Link>
          </View>
        )}
      </Screen>
      {celebration}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerText: { flexShrink: 1 },
  brand: { fontFamily: fonts.display, fontSize: 32, color: colors.espresso },
  date: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.mocha, marginTop: 2 },
  streak: {
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    minWidth: 72,
    ...shadow,
  },
  streakNumber: { fontFamily: fonts.display, fontSize: 22, color: colors.caramel },
  streakLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.mocha },
  hero: { alignItems: 'center', gap: 4 },
  tagline: {
    fontFamily: fonts.displayItalic,
    fontSize: 16,
    color: colors.mocha,
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    padding: 24,
    gap: 12,
    alignItems: 'center',
    ...shadow,
  },
  statusTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.espresso, textAlign: 'center' },
  statusText: { fontFamily: fonts.body, fontSize: 15, color: colors.mocha, textAlign: 'center' },
  retry: {
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.espresso,
    justifyContent: 'center',
  },
  retryText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.cream },
  poured: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.mocha, textAlign: 'center' },
  comeBack: { fontFamily: fonts.displayItalic, fontSize: 16, color: colors.mocha, textAlign: 'center' },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  pillLink: {
    minHeight: 48,
    paddingHorizontal: 22,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.rose,
    justifyContent: 'center',
  },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.espresso },
  account: { alignItems: 'center', gap: 2, marginTop: 8 },
  accountText: { fontFamily: fonts.body, fontSize: 13, color: colors.mocha },
  accountButton: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' },
  accountButtonText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.caramel, textDecorationLine: 'underline' },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },
});
