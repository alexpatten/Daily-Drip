import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Button } from '@/components/Button';
import { useCelebrations } from '@/components/Celebration';
import { Notice } from '@/components/Notice';
import { QuestionCard } from '@/components/QuestionCard';
import { Screen } from '@/components/Screen';
import {
  CAN_SUBSCRIBE_HERE,
  formatPlan,
  getPlan,
  openBillingPortal,
  startCheckout,
  useSubscription,
  type Subscription,
} from '@/lib/billing';
import { easternDateString, formatPretty } from '@/lib/dates';
import { examFor, type ExamSlug } from '@/lib/exams';
import type { AnswerRecord } from '@/lib/progress';
import type { DailyQuestion } from '@/lib/questions';
import { useSettings } from '@/lib/settings';
import { getStudySession, STUDY_SESSION_SIZE, useStudyAnswers } from '@/lib/study';
import { colors, fonts, radius, shadow } from '@/theme';

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

// After Stripe Checkout, the subscription arrives by webhook a moment later.
const CONFIRM_POLL_MS = 2000;
const CONFIRM_TIMEOUT_MS = 30 * 1000;

export default function StudyScreen() {
  const { exam } = useSettings();
  const { subscription, active, loaded, refresh } = useSubscription();
  const { checkout } = useLocalSearchParams<{ checkout?: string }>();
  const [awaitingCheckout, setAwaitingCheckout] = useState(checkout === 'success');
  const confirming = awaitingCheckout && !active;

  useEffect(() => {
    if (!confirming) return;
    const timer = setInterval(refresh, CONFIRM_POLL_MS);
    const giveUp = setTimeout(() => setAwaitingCheckout(false), CONFIRM_TIMEOUT_MS);
    return () => {
      clearInterval(timer);
      clearTimeout(giveUp);
    };
  }, [confirming, active, refresh]);

  return (
    <View style={styles.root}>
      {!loaded || confirming ? (
        <Screen>
          <Text style={styles.title}>Study session</Text>
          <View style={styles.statusCard}>
            <ActivityIndicator color={colors.mocha} />
            <Text style={styles.statusText}>
              {confirming ? 'Confirming your subscription…' : 'Warming up…'}
            </Text>
          </View>
        </Screen>
      ) : active ? (
        <StudySession exam={exam} subscription={subscription!} />
      ) : (
        <Paywall exam={exam} subscription={subscription} />
      )}
    </View>
  );
}

// Why a reader who has subscribed before is seeing the paywall.
function lapsedNotice(subscription: Subscription | null): string | null {
  switch (subscription?.status) {
    case 'past_due':
    case 'unpaid':
      return "Your last payment didn't go through. Update your card to keep studying.";
    case 'canceled':
    case 'incomplete_expired':
      return 'Your subscription has ended. Subscribe again to keep studying.';
    case 'incomplete':
      return "Your payment hasn't gone through yet. Try subscribing again.";
    default:
      return null;
  }
}

function Paywall({ exam, subscription }: { exam: ExamSlug; subscription: Subscription | null }) {
  const { shortName } = examFor(exam);
  const lapsed = lapsedNotice(subscription);
  const fixPayment = subscription?.status === 'past_due' || subscription?.status === 'unpaid';
  const [price, setPrice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getPlan()
      .then((plan) => active && setPrice(formatPlan(plan)))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      await (fixPayment ? openBillingPortal() : startCheckout());
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View>
        <Text style={styles.title}>Study session</Text>
        <Text style={styles.subtitle}>Part of Daily Drip Plus</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>A full pot, not just a cup</Text>
        <View style={styles.perks}>
          <Text style={styles.perk}>♡  {STUDY_SESSION_SIZE} {shortName} questions every day</Text>
          <Text style={styles.perk}>♡  Drawn from the whole question bank, past brews included</Text>
          <Text style={styles.perk}>♡  Every question starts fresh, even ones you&apos;ve answered</Text>
          <Text style={styles.perk}>♡  A new set at midnight Eastern</Text>
        </View>
        {price && <Text style={styles.price}>{price}</Text>}
        {lapsed && <Notice tone="info">{lapsed}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        {CAN_SUBSCRIBE_HERE ? (
          <Button label={fixPayment ? 'Update payment' : 'Subscribe'} loading={busy} onPress={subscribe} />
        ) : (
          <Text style={styles.hint}>
            Subscribe to Daily Drip Plus on the Daily Drip website, then study sessions unlock here
            for this account too.
          </Text>
        )}
        <Text style={styles.hint}>Cancel anytime. Your daily question stays free.</Text>
      </View>
    </Screen>
  );
}

// `key` is the exam the session was fetched for.
type Session = { key: ExamSlug; questions: DailyQuestion[] | null; error: string | null };

async function fetchSession(exam: ExamSlug): Promise<Session> {
  try {
    return { key: exam, questions: await getStudySession(exam), error: null };
  } catch (e) {
    return { key: exam, questions: null, error: errorMessage(e) };
  }
}

function StudySession({ exam, subscription }: { exam: ExamSlug; subscription: Subscription }) {
  const [session, setSession] = useState<Session | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [index, setIndex] = useState<number | null>(null);
  const [manageError, setManageError] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const { celebration, celebrate } = useCelebrations();

  const current = session?.key === exam ? session : null;
  const questions = current?.questions ?? null;
  const day = questions?.[0]?.question_date ?? null;
  const { answers, save } = useStudyAnswers(exam, day);

  const apply = useCallback((next: Session) => {
    // A failed refresh keeps the questions already on screen.
    setSession((prev) => (next.error && prev?.questions && prev.key === next.key ? prev : next));
    if (!next.error) setIndex(null);
  }, []);

  const load = useCallback(() => fetchSession(exam).then(apply), [exam, apply]);

  useEffect(() => {
    let active = true;
    fetchSession(exam).then((next) => active && apply(next));
    return () => {
      active = false;
    };
  }, [exam, apply]);

  // A new set at midnight Eastern: pick it up on return to the app.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && day && easternDateString() !== day) load();
    });
    return () => sub.remove();
  }, [day, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  function retry() {
    setSession(null);
    load();
  }

  async function manage() {
    setManaging(true);
    setManageError(null);
    try {
      await openBillingPortal();
    } catch (e) {
      setManageError(errorMessage(e));
      setManaging(false);
    }
  }

  function handleAnswer(question: DailyQuestion, record: AnswerRecord) {
    save(question, record);
    if (record.correct) celebrate();
  }

  const total = questions?.length ?? 0;
  const answered = questions?.filter((q) => answers[q.id]).length ?? 0;
  const correct = questions?.filter((q) => answers[q.id]?.correct).length ?? 0;
  const finished = total > 0 && answered === total;
  // Start at the first question not answered yet.
  const firstOpen = questions ? Math.max(questions.findIndex((q) => !answers[q.id]), 0) : 0;
  const at = index ?? firstOpen;
  const question = questions?.[at] ?? null;
  const answer = question ? answers[question.id] : undefined;
  const { shortName } = examFor(exam);

  return (
    <>
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
          <View>
          <Text style={styles.title}>Study session</Text>
          <Text style={styles.subtitle}>
            {`${shortName}  ·  `}
            {day ? formatPretty(day) : `${STUDY_SESSION_SIZE} questions a day`}
          </Text>
        </View>

        {questions && total > 0 && (
          <View style={styles.progress} accessibilityLabel={`${answered} of ${total} answered, ${correct} right`}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(answered / total) * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {answered} of {total} answered  ·  {correct} right
            </Text>
          </View>
        )}

        {finished && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pot finished ♡</Text>
            <Text style={styles.hint}>
              {`You got ${correct} of ${total} right today. A fresh set is brewing for tomorrow.`}
            </Text>
          </View>
        )}

        {current?.error && !questions ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>The espresso machine sputtered</Text>
            <Text style={styles.statusText}>{current.error}</Text>
            <Button label="Try again" onPress={retry} />
          </View>
        ) : !questions ? (
          <View style={styles.statusCard}>
            <ActivityIndicator color={colors.mocha} />
            <Text style={styles.statusText}>Pouring today&apos;s session…</Text>
          </View>
        ) : !question ? (
          <Text style={styles.empty}>No questions to study yet for {shortName}.</Text>
        ) : (
          <>
            <QuestionCard
              key={`${question.question_date}:${question.id}`}
              question={question}
              counter={`${at + 1} of ${total}`}
              answer={answer}
              onAnswer={(record) => handleAnswer(question, record)}
            />
            <View style={styles.nav}>
              <View style={styles.navSlot}>
                {at > 0 && <Button label="←  Previous" variant="secondary" onPress={() => setIndex(at - 1)} />}
              </View>
              <View style={styles.navSlot}>
                {at < total - 1 && (
                  <Button
                    label="Next  →"
                    variant={answer ? 'primary' : 'secondary'}
                    onPress={() => setIndex(at + 1)}
                  />
                )}
              </View>
            </View>
          </>
        )}

        <View style={styles.footer}>
          {subscription.cancel_at_period_end && subscription.current_period_end && (
            <Text style={styles.hint}>
              {`Daily Drip Plus ends on ${new Date(subscription.current_period_end).toLocaleDateString()}.`}
            </Text>
          )}
          {subscription.status === 'comped' ? (
            <Text style={styles.hint}>You have complimentary Daily Drip Plus ♡</Text>
          ) : (
            CAN_SUBSCRIBE_HERE && (
              <Button label="Manage subscription" variant="text" loading={managing} onPress={manage} />
            )
          )}
          {manageError && <Notice tone="error">{manageError}</Notice>}
        </View>
      </Screen>
      {celebration}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.espresso },
  subtitle: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.mocha, marginTop: 2 },
  card: {
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    padding: 20,
    gap: 14,
    ...shadow,
  },
  cardTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.espresso },
  perks: { gap: 8 },
  perk: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 21, color: colors.espresso },
  price: { fontFamily: fonts.display, fontSize: 24, color: colors.caramel },
  hint: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.mocha },
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
  empty: { fontFamily: fonts.displayItalic, fontSize: 16, color: colors.mocha, textAlign: 'center' },
  progress: { gap: 6 },
  progressTrack: { height: 8, borderRadius: radius.pill, backgroundColor: colors.roseSoft, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.caramel },
  progressText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.mocha },
  nav: { flexDirection: 'row', gap: 10 },
  navSlot: { flex: 1 },
  footer: { alignItems: 'center', gap: 6 },
});
