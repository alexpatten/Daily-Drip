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

import { LatteHearts } from '@/components/LatteHearts';
import { QuestionCard } from '@/components/QuestionCard';
import { Screen } from '@/components/Screen';
import { displayName, signOut, useAuth } from '@/lib/auth';
import { formatPretty } from '@/lib/dates';
import { currentStreak, loadAnswers, saveAnswer, type AnswerRecord, type Answers } from '@/lib/progress';
import { getCurrentQuestion, type DailyQuestion } from '@/lib/questions';
import { colors, fonts, radius, shadow } from '@/theme';

type Brew = { question: DailyQuestion | null; error: string | null };

async function fetchBrew(): Promise<Brew> {
  try {
    return { question: await getCurrentQuestion(), error: null };
  } catch (e) {
    return { question: null, error: e instanceof Error ? e.message : 'Something went wrong.' };
  }
}

// A failed refresh keeps the question already on screen.
function merge(prev: Brew | null, next: Brew): Brew {
  return next.error && prev?.question ? prev : next;
}

export default function TodayScreen() {
  const { width } = useWindowDimensions();
  const { session } = useAuth();
  const [brew, setBrew] = useState<Brew | null>(null);
  const [answers, setAnswers] = useState<Answers>(() => loadAnswers());
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const next = await fetchBrew();
    setBrew((prev) => merge(prev, next));
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = () => fetchBrew().then((next) => active && setBrew((prev) => merge(prev, next)));
    refresh();
    // The question turns over at midnight Eastern; pick up the new one on return.
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setAnswers(loadAnswers());
      refresh();
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  function retry() {
    setBrew(null);
    load();
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const question = brew?.question ?? null;
  // "Today" is the current question's date, which follows Eastern time for everyone.
  const today = question?.question_date ?? null;

  function handleAnswer(record: AnswerRecord) {
    if (today) setAnswers(saveAnswer(today, record));
  }

  const streak = today ? currentStreak(answers, today) : null;
  const artSize = Math.min(width * 0.5, 190);

  return (
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
        <Text style={styles.tagline}>one Praxis SLP question, freshly brewed every day</Text>
      </View>

      {question ? (
        <QuestionCard
          key={question.question_date}
          question={question}
          answer={answers[question.question_date]}
          onAnswer={handleAnswer}
        />
      ) : brew?.error ? (
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>The espresso machine sputtered</Text>
          <Text style={styles.statusText}>{brew.error}</Text>
          <Pressable
            onPress={retry}
            accessibilityRole="button"
            style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : brew ? (
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Still brewing</Text>
          <Text style={styles.statusText}>
            {"The first question is on its way. It's brewed fresh at midnight Eastern."}
          </Text>
        </View>
      ) : (
        <View style={styles.statusCard}>
          <ActivityIndicator color={colors.mocha} />
          <Text style={styles.statusText}>{"Pouring today's question…"}</Text>
        </View>
      )}

      {today && answers[today] && (
        <Text style={styles.comeBack}>Come back tomorrow for a fresh cup ♡</Text>
      )}

      <Link href={session ? '/history' : '/sign-in'} asChild>
        <Pressable
          accessibilityRole="link"
          style={({ pressed }) => [styles.historyLink, pressed && styles.pressed]}
        >
          <Text style={styles.historyText}>Past brews  →</Text>
        </Pressable>
      </Link>

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
  );
}

const styles = StyleSheet.create({
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
  comeBack: { fontFamily: fonts.displayItalic, fontSize: 16, color: colors.mocha, textAlign: 'center' },
  historyLink: {
    alignSelf: 'center',
    minHeight: 48,
    paddingHorizontal: 22,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.rose,
    justifyContent: 'center',
  },
  historyText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.espresso },
  account: { alignItems: 'center', gap: 2, marginTop: 8 },
  accountText: { fontFamily: fonts.body, fontSize: 13, color: colors.mocha },
  accountButton: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' },
  accountButtonText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.caramel, textDecorationLine: 'underline' },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },
});
