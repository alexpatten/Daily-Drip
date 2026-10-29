import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Link } from 'expo-router';

import { motionAllowed, useCelebrations } from '@/components/Celebration';
import { LatteHearts } from '@/components/LatteHearts';
import { QuestionCard } from '@/components/QuestionCard';
import { Screen } from '@/components/Screen';
import { ShareSheet, type ShareCard } from '@/components/ShareSheet';
import { displayName, signOut, useAuth } from '@/lib/auth';
import { easternDateString, formatPretty } from '@/lib/dates';
import { examFor, type ExamSlug } from '@/lib/exams';
import { answerFor, currentStreak, useProgress, type AnswerRecord } from '@/lib/progress';
import { getTodaysQuestion, slotKey, type DailyQuestion } from '@/lib/questions';
import { useSettings } from '@/lib/settings';
import { shareWithLink } from '@/lib/share';
import { colors, fonts, radius, shadow } from '@/theme';

// `key` is the exam the question was fetched for.
type Brew = { key: string; question: DailyQuestion | null; error: string | null };

async function fetchBrew(exam: ExamSlug): Promise<Brew> {
  try {
    return { key: exam, question: await getTodaysQuestion(exam), error: null };
  } catch (e) {
    return { key: exam, question: null, error: e instanceof Error ? e.message : 'Something went wrong.' };
  }
}

// How often to check whether it's past midnight Eastern while the app stays open.
const TURNOVER_CHECK_MS = 60 * 1000;

// Shares the question (never the answer), inviting friends to try it.
function questionShareMessage(q: DailyQuestion): string {
  return `Today's ${examFor(q.exam).shortName} question on Daily Drip ☕\n\n${q.question}\n\nCan you get it?`;
}

// The day count in the header, which bounces when it goes up. Tap to share it.
function StreakBadge({ streak, onShare }: { streak: number; onShare: () => void }) {
  const [scale] = useState(() => new Animated.Value(1));
  const shown = useRef(streak);

  useEffect(() => {
    const grew = streak > shown.current;
    shown.current = streak;
    if (!grew) return;
    let anim: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    motionAllowed().then((ok) => {
      if (!ok || cancelled) return;
      const useNativeDriver = Platform.OS !== 'web';
      anim = Animated.sequence([
        Animated.timing(scale, { toValue: 1.25, duration: 160, useNativeDriver }),
        Animated.spring(scale, { toValue: 1, friction: 3, tension: 140, useNativeDriver }),
      ]);
      anim.start();
    });
    return () => {
      cancelled = true;
      anim?.stop();
    };
  }, [streak, scale]);

  // Nothing to share before the first day.
  const canShare = streak > 0;
  return (
    <Pressable
      onPress={onShare}
      disabled={!canShare}
      accessibilityRole={canShare ? 'button' : 'text'}
      accessibilityLabel={`${streak} day streak`}
      accessibilityHint={canShare ? 'Shares your streak' : undefined}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Animated.View style={[styles.streak, { transform: [{ scale }] }]}>
        <Text style={styles.streakNumber}>{streak}</Text>
        <Text style={styles.streakLabel}>day streak</Text>
      </Animated.View>
    </Pressable>
  );
}

// A failed refresh keeps the question already on screen.
function merge(prev: Brew | null, next: Brew): Brew {
  return next.error && prev?.question && prev.key === next.key ? prev : next;
}

export default function TodayScreen() {
  const { width } = useWindowDimensions();
  const { session } = useAuth();
  const { exam } = useSettings();
  const [brew, setBrew] = useState<Brew | null>(null);
  const { progress, save, reload, syncAwards } = useProgress();
  const [refreshing, setRefreshing] = useState(false);
  const { celebration, celebrate } = useCelebrations();
  const [shareCard, setShareCard] = useState<ShareCard | null>(null);
  // A word about the last question share, shown for a moment.
  const [shareNote, setShareNote] = useState<string | null>(null);

  useEffect(() => {
    if (!shareNote) return;
    const timer = setTimeout(() => setShareNote(null), 2500);
    return () => clearTimeout(timer);
  }, [shareNote]);

  async function shareQuestion(q: DailyQuestion) {
    const result = await shareWithLink(questionShareMessage(q));
    if (result === 'copied') setShareNote('Copied to share ♡');
    else if (result === 'failed') setShareNote("Couldn't open sharing");
  }

  // Answers from before awards existed still count.
  useEffect(() => {
    syncAwards();
  }, [syncAwards]);

  const load = useCallback(async () => {
    const next = await fetchBrew(exam);
    setBrew((prev) => merge(prev, next));
  }, [exam]);

  useEffect(() => {
    let active = true;
    const refresh = () => fetchBrew(exam).then((next) => active && setBrew((prev) => merge(prev, next)));
    refresh();
    // The question turns over at midnight Eastern: pick up the new one on return to the
    // app, and at midnight if the app is left open.
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      reload();
      refresh();
    });
    let checkedDay = easternDateString();
    const timer = setInterval(() => {
      const day = easternDateString();
      if (day === checkedDay || AppState.currentState !== 'active') return;
      checkedDay = day;
      refresh();
    }, TURNOVER_CHECK_MS);
    return () => {
      active = false;
      sub.remove();
      clearInterval(timer);
    };
  }, [exam, reload]);

  function retry() {
    setBrew(null);
    load();
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Until the question for the current exam arrives, show the loading state.
  const current = brew?.key === exam ? brew : null;
  const question = current?.question ?? null;
  // "Today" is the question's date, which follows Eastern time for everyone.
  const today = question?.question_date ?? null;
  const answer = question ? answerFor(progress, question) : undefined;

  function handleAnswer(q: DailyQuestion, record: AnswerRecord) {
    // Answering today's question counts the day toward the streak.
    const earned = save(q, record, true);
    // From the second day in a row on, it gets its own celebration.
    const grown = !progress.streakDays.includes(q.question_date)
      ? currentStreak({ ...progress, streakDays: [...progress.streakDays, q.question_date] }, q.question_date)
      : 0;
    const streakUp = grown >= 2 ? grown : undefined;
    if (record.correct || earned.length > 0 || streakUp) celebrate(earned, streakUp);
  }

  const streak = today ? currentStreak(progress, today) : null;
  const artSize = Math.min(width * 0.5, 190);
  const { shortName } = examFor(exam);
  const tagline = `one ${shortName} question, freshly brewed every day`;

  return (
    <View style={styles.root}>
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.brand}>Daily Drip</Text>
            {today && <Text style={styles.date}>{formatPretty(today)}</Text>}
          </View>
          {streak !== null && (
            <StreakBadge streak={streak} onShare={() => setShareCard({ kind: 'streak', days: streak })} />
          )}
        </View>

        <View style={styles.hero}>
          <LatteHearts size={artSize} />
          <Text style={styles.tagline}>{tagline}</Text>
        </View>

        {question ? (
          <QuestionCard
            key={slotKey(question)}
            question={question}
            answer={answer}
            onAnswer={(record) => handleAnswer(question, record)}
          />
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
              {"Today's question is on its way. Pull down to check again in a moment."}
            </Text>
          </View>
        ) : (
          <View style={styles.statusCard}>
            <ActivityIndicator color={colors.mocha} />
            <Text style={styles.statusText}>
              {"Pouring today's question…"}
            </Text>
          </View>
        )}

        {question && answer && (
          <View style={styles.after}>
            <Pressable
              onPress={() => shareQuestion(question)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.pillLink, pressed && styles.pressed]}
            >
              <Text style={styles.pillText}>Share today&apos;s question</Text>
            </Pressable>
            {shareNote && <Text style={styles.shareNote}>{shareNote}</Text>}
            <Text style={styles.comeBack}>Come back tomorrow for a fresh cup ♡</Text>
          </View>
        )}

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
      <ShareSheet card={shareCard} onClose={() => setShareCard(null)} />
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
  after: { alignItems: 'center', gap: 10 },
  shareNote: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.caramel, textAlign: 'center' },
  comeBack: { fontFamily: fonts.displayItalic, fontSize: 16, color: colors.mocha, textAlign: 'center' },
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
