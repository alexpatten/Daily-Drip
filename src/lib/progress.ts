import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from './auth';
import { newAwards, withAwards, type Award, type QuestionCounts } from './awards';
import { addDays } from './dates';
import type { ExamSlug } from './exams';
import { cachedQuestionCounts, getQuestionCounts, type DailyQuestion, type Letter } from './questions';
import { getItem, setItem } from './storage';
import { supabase } from './supabase';

// Progress is kept per account on this device. Signed-out progress stays under the
// guest key.
const GUEST_KEY = 'daily-drip:progress:v2';
const keyFor = (userId: string | null) => (userId ? `${GUEST_KEY}:${userId}` : GUEST_KEY);

// Signed-in progress is also kept in the database (public.progress), so it follows the
// reader to every device. Changes not sent yet wait here; '{}' means everything is sent,
// and no entry means this device has never sent anything, so all of it goes.
const PENDING_KEY = 'daily-drip:progress-pending:v1';
const pendingKeyFor = (userId: string) => `${PENDING_KEY}:${userId}`;
const NOTHING_PENDING = '{}';

// Before there were several exams and question counts, answers were keyed by date, one
// Praxis question per date.
const LEGACY_KEY = 'daily-drip:answers:v1';
const legacyKeyFor = (userId: string | null) => (userId ? `${LEGACY_KEY}:${userId}` : LEGACY_KEY);
const legacyAnswerKey = (date: string) => `praxis:${date}`;

// catchUp marks a past question answered from history, which doesn't count toward the streak.
export type AnswerRecord = { choice: Letter; correct: boolean; catchUp?: boolean };
// day: the day the question was served when it was answered (the latest try). Older
// answers may not have one.
type SavedAnswer = AnswerRecord & { exam: ExamSlug; day?: string };

export type Progress = {
  answers: Record<string, SavedAnswer>; // keyed by question id
  streakDays: string[]; // days whose question was answered on the day
  correctRun?: number; // questions answered right in a row, anywhere
  runAt?: string; // when correctRun last changed, so the newest count wins across devices
  awards?: Record<string, string>; // award id → the day it was earned
};

const EMPTY: Progress = { answers: {}, streakDays: [] };

function loadLegacy(userId: string | null): Progress {
  try {
    const old = JSON.parse(getItem(legacyKeyFor(userId)) ?? '{}') as Record<string, AnswerRecord>;
    const answers: Progress['answers'] = {};
    for (const [date, record] of Object.entries(old)) {
      answers[legacyAnswerKey(date)] = { ...record, exam: 'praxis-slp' };
    }
    const streakDays = Object.keys(old).filter((date) => !old[date].catchUp);
    return { answers, streakDays };
  } catch {
    return EMPTY;
  }
}

export function loadProgress(userId: string | null): Progress {
  const raw = getItem(keyFor(userId));
  if (!raw) return loadLegacy(userId);
  try {
    return { ...EMPTY, ...(JSON.parse(raw) as Progress) };
  } catch {
    return EMPTY;
  }
}

// Changes to merge into progress that's already saved, in the shape merge_progress takes.
type Changes = Partial<Progress>;

// Folds later changes into earlier ones that haven't been sent yet.
function combine(a: Changes, b: Changes): Changes {
  return {
    ...a,
    ...b,
    answers: { ...a.answers, ...b.answers },
    streakDays: [...new Set([...(a.streakDays ?? []), ...(b.streakDays ?? [])])],
    awards: { ...b.awards, ...a.awards },
  };
}

const listeners = new Set<(userId: string | null) => void>();

// Saves progress on this device and, when signed in, queues the changes for the database.
function write(userId: string | null, next: Progress, changes: Changes) {
  setItem(keyFor(userId), JSON.stringify(next));
  if (userId) {
    const raw = getItem(pendingKeyFor(userId));
    const pending = raw === null ? next : combine(parsePending(raw), changes);
    setItem(pendingKeyFor(userId), JSON.stringify(pending));
    flush(userId);
  }
  listeners.forEach((l) => l(userId));
}

function parsePending(raw: string): Changes {
  try {
    return JSON.parse(raw) as Changes;
  } catch {
    return {};
  }
}

// One send at a time, so changes arrive in order and none are sent twice at once.
let sending: Promise<unknown> = Promise.resolve();

// Sends this device's unsent changes. Resolves true once the database has everything.
function flush(userId: string): Promise<boolean> {
  const run = sending.then(async () => {
    const key = pendingKeyFor(userId);
    const raw = getItem(key);
    if (raw === NOTHING_PENDING) return true;
    // merge_progress saves to whoever is signed in, so never send one account's changes
    // while another is.
    const { data } = await supabase.auth.getSession();
    if (data.session?.user.id !== userId) return false;
    const changes = raw === null ? loadProgress(userId) : parsePending(raw);
    const { error } = await supabase.rpc('merge_progress', { p_changes: changes });
    if (error) return false;
    // Anything saved while this was on its way goes next time (merging twice is harmless).
    if (getItem(key) === raw) setItem(key, NOTHING_PENDING);
    return getItem(key) === NOTHING_PENDING;
  });
  sending = run.catch(() => {});
  return run.catch(() => false);
}

type ProgressRow = {
  answers: Progress['answers'];
  streak_days: string[];
  awards: Record<string, string>;
  correct_run: number;
  correct_run_at: string | null;
};

async function fetchSaved(userId: string): Promise<Progress | null> {
  const { data, error } = await supabase
    .from('progress')
    .select('answers, streak_days, awards, correct_run, correct_run_at')
    .eq('user_id', userId)
    .maybeSingle<ProgressRow>();
  if (error) throw error;
  if (!data) return null;
  return {
    answers: data.answers,
    streakDays: data.streak_days,
    awards: data.awards,
    correctRun: data.correct_run,
    runAt: data.correct_run_at ?? undefined,
  };
}

const syncing = new Map<string, Promise<void>>();

// Sends this device's changes, then takes the account's progress from every device.
// Fails quietly: offline, the device's own copy carries on and goes up next time.
function syncProgress(userId: string): Promise<void> {
  const inFlight = syncing.get(userId);
  if (inFlight) return inFlight;
  const run = (async () => {
    if (!(await flush(userId))) return;
    const saved = await fetchSaved(userId).catch(() => null);
    // Something saved meanwhile hasn't gone up yet; the next sync picks it all up.
    if (!saved || getItem(pendingKeyFor(userId)) !== NOTHING_PENDING) return;
    setItem(keyFor(userId), JSON.stringify(saved));
    listeners.forEach((l) => l(userId));
  })().finally(() => syncing.delete(userId));
  syncing.set(userId, run);
  return run;
}

// The first sync since the app started, for things that should wait for the account's
// progress.
const firstSyncs = new Map<string, Promise<void>>();
function firstSync(userId: string): Promise<void> {
  let first = firstSyncs.get(userId);
  if (!first) {
    first = syncProgress(userId);
    firstSyncs.set(userId, first);
  }
  return first;
}

// onTheDay: the question was answered on the day it was served, which counts toward the
// streak. Returns the awards this answer earned.
function saveAnswer(userId: string | null, question: DailyQuestion, record: AnswerRecord, onTheDay: boolean): Award[] {
  const progress = loadProgress(userId);
  const streakDay = onTheDay ? question.question_date : null;
  const at = new Date();
  const saved: SavedAnswer = { ...record, exam: question.exam, day: question.question_date };
  const correctRun = record.correct ? (progress.correctRun ?? 0) + 1 : 0;
  const answered: Progress = {
    ...progress,
    answers: { ...progress.answers, [question.id]: saved },
    streakDays:
      streakDay && !progress.streakDays.includes(streakDay)
        ? [...progress.streakDays, streakDay]
        : progress.streakDays,
    correctRun,
    runAt: at.toISOString(),
  };
  const earned = newAwards(answered, cachedQuestionCounts(), { question, record, at });
  const next = withAwards(answered, earned, at);
  write(userId, next, {
    answers: { [question.id]: saved },
    streakDays: streakDay ? [streakDay] : [],
    awards: earnedIn(next, earned),
    correctRun,
    runAt: answered.runAt,
  });
  return earned;
}

const earnedIn = (progress: Progress, earned: Award[]) =>
  Object.fromEntries(earned.map((a) => [a.id, progress.awards![a.id]]));

// Awards already earned by saved progress, such as answers from before awards existed,
// or every question once the counts arrive.
function catchUpAwards(userId: string | null, counts: QuestionCounts | null) {
  const progress = loadProgress(userId);
  const earned = newAwards(progress, counts, null);
  if (earned.length === 0) return;
  const next = withAwards(progress, earned);
  write(userId, next, { awards: earnedIn(next, earned) });
}

// An answer counts for the day it was given. A question served again on another day (its
// bank wrapped around, or it was answered early back when readers could do several a
// day) starts fresh.
export function answerFor(progress: Progress, q: DailyQuestion): AnswerRecord | undefined {
  const saved = progress.answers[q.id];
  if (saved && (!saved.day || saved.day === q.question_date)) return saved;
  return q.exam === 'praxis-slp' && q.position === 1
    ? progress.answers[legacyAnswerKey(q.question_date)]
    : undefined;
}

/** The signed-in user's progress (or the guest's), switching when the account changes. */
export function useProgress() {
  const userId = useAuth().session?.user.id ?? null;
  const [state, setState] = useState(() => ({ owner: userId, progress: loadProgress(userId) }));

  // Signing in, out, or into another account swaps in that account's progress.
  if (state.owner !== userId) setState({ owner: userId, progress: loadProgress(userId) });

  const reload = useCallback(() => setState({ owner: userId, progress: loadProgress(userId) }), [userId]);

  // Stay current with saves from other screens and with what syncing brings in.
  useEffect(() => {
    const listener = (changed: string | null) => changed === userId && reload();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [userId, reload]);

  // Signed in, pick up answers from other devices on arrival and on return to the app.
  useEffect(() => {
    if (!userId) return;
    firstSync(userId);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && syncProgress(userId));
    return () => sub.remove();
  }, [userId]);

  // onTheDay: answered on the day it was served, so it counts toward the streak. Returns
  // the awards it earned.
  const save = useCallback(
    (question: DailyQuestion, record: AnswerRecord, onTheDay = false) =>
      saveAnswer(userId, question, record, onTheDay),
    [userId],
  );
  // Quietly records awards already earned, without a celebration.
  const syncAwards = useCallback(async () => {
    if (userId) await firstSync(userId);
    const counts = await getQuestionCounts().catch(() => cachedQuestionCounts());
    catchUpAwards(userId, counts);
  }, [userId]);

  // Until the swap above re-renders, never show the previous account's progress.
  const progress = state.owner === userId ? state.progress : EMPTY;
  return { progress, save, reload, syncAwards };
}

// Consecutive days answered on the day, ending today (or yesterday if today is still open).
export function currentStreak(progress: Progress, today: string): number {
  const days = new Set(progress.streakDays);
  let day = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

export function totals(progress: Progress, exam: ExamSlug) {
  const all = Object.values(progress.answers).filter((a) => a.exam === exam);
  return { answered: all.length, correct: all.filter((a) => a.correct).length };
}
