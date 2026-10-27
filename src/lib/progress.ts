import { useCallback, useState } from 'react';

import { useAuth } from './auth';
import { newAwards, withAwards, type Award, type QuestionCounts } from './awards';
import { addDays } from './dates';
import type { ExamSlug } from './exams';
import { cachedQuestionCounts, getQuestionCounts, type DailyQuestion, type Letter } from './questions';
import { getItem, setItem } from './storage';

// Progress is kept per account on this device. Signed-out progress stays under the
// guest key.
const GUEST_KEY = 'daily-drip:progress:v2';
const keyFor = (userId: string | null) => (userId ? `${GUEST_KEY}:${userId}` : GUEST_KEY);

// Before there were several exams and question counts, answers were keyed by date, one
// Praxis question per date.
const LEGACY_KEY = 'daily-drip:answers:v1';
const legacyKeyFor = (userId: string | null) => (userId ? `${LEGACY_KEY}:${userId}` : LEGACY_KEY);
const legacyAnswerKey = (date: string) => `praxis:${date}`;

// catchUp marks a past question answered from history, which doesn't count toward the streak.
export type AnswerRecord = { choice: Letter; correct: boolean; catchUp?: boolean };
// day: the day the question was served when it was answered (the latest try).
type SavedAnswer = AnswerRecord & { exam: ExamSlug; day?: string };

export type Progress = {
  answers: Record<string, SavedAnswer>; // keyed by question id
  streakDays: string[]; // days whose questions were all answered on the day
  // Missed questions picked to come back on a day, keyed by `${exam}:${day}`. Kept so the
  // day's set doesn't change once they're answered.
  retries?: Record<string, number[]>;
  correctRun?: number; // questions answered right in a row, anywhere
  awards?: Record<string, string>; // award id → the day it was earned
};

const EMPTY: Progress = { answers: {}, streakDays: [] };

// Missed questions come back the next day only for readers doing at least this many a day.
export const RETRY_MIN_PER_DAY = 5;

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

// finishedDay: the day's set, when this answer finished it on the day (counts toward the
// streak). Returns the awards this answer earned.
function saveAnswer(
  userId: string | null,
  question: DailyQuestion,
  record: AnswerRecord,
  finishedDay: DailyQuestion[] | null,
): { progress: Progress; earned: Award[] } {
  const progress = loadProgress(userId);
  const streakDay = finishedDay ? question.question_date : null;
  const answered: Progress = {
    ...progress,
    answers: {
      ...progress.answers,
      [question.id]: { ...record, exam: question.exam, day: question.question_date },
    },
    streakDays:
      streakDay && !progress.streakDays.includes(streakDay)
        ? [...progress.streakDays, streakDay]
        : progress.streakDays,
    correctRun: record.correct ? (progress.correctRun ?? 0) + 1 : 0,
  };
  const at = new Date();
  const day = finishedDay && {
    size: finishedDay.length,
    allCorrect: finishedDay.every((q) => answerFor(answered, q)?.correct),
  };
  const earned = newAwards(answered, cachedQuestionCounts(), { question, record, day, at });
  const next = withAwards(answered, earned, at);
  setItem(keyFor(userId), JSON.stringify(next));
  return { progress: next, earned };
}

// Awards already earned by saved progress, such as answers from before awards existed,
// or every question once the counts arrive. Returns null when there are none.
function catchUpAwards(userId: string | null, counts: QuestionCounts | null): Progress | null {
  const progress = loadProgress(userId);
  const earned = newAwards(progress, counts, null);
  if (earned.length === 0) return null;
  const next = withAwards(progress, earned);
  setItem(keyFor(userId), JSON.stringify(next));
  return next;
}

export function answerFor(progress: Progress, q: DailyQuestion): AnswerRecord | undefined {
  // A retry starts fresh: only today's try counts.
  if (q.retry) {
    const saved = progress.answers[q.id];
    return saved?.day === q.question_date ? saved : undefined;
  }
  return (
    progress.answers[q.id] ??
    (q.exam === 'praxis-slp' && q.position === 1
      ? progress.answers[legacyAnswerKey(q.question_date)]
      : undefined)
  );
}

// The ids of missed questions to serve again on `today`, at most `limit`, oldest first.
// Picked once per day and saved, so answering them doesn't change the day's set.
function retryPlan(userId: string | null, exam: ExamSlug, today: string, limit: number): number[] {
  const progress = loadProgress(userId);
  const key = `${exam}:${today}`;
  const saved = progress.retries?.[key];
  if (saved) return saved.slice(0, limit);

  const missed = Object.entries(progress.answers)
    .filter(([, a]) => a.exam === exam && !a.correct && !a.catchUp && a.day && a.day < today)
    .sort(([idA, a], [idB, b]) => (a.day! < b.day! ? -1 : a.day! > b.day! ? 1 : Number(idA) - Number(idB)))
    .map(([id]) => Number(id))
    .filter((id) => Number.isInteger(id));
  const plan = missed.slice(0, limit);
  // Only today's plan matters; older ones are dropped.
  setItem(keyFor(userId), JSON.stringify({ ...progress, retries: { [key]: plan } }));
  return plan;
}

/** The signed-in user's progress (or the guest's), switching when the account changes. */
export function useProgress() {
  const userId = useAuth().session?.user.id ?? null;
  const [state, setState] = useState(() => ({ owner: userId, progress: loadProgress(userId) }));

  // Signing in, out, or into another account swaps in that account's progress.
  if (state.owner !== userId) setState({ owner: userId, progress: loadProgress(userId) });

  // finishedDay: the day's set, if this answer completed it on the day. Returns the
  // awards it earned.
  const save = useCallback(
    (question: DailyQuestion, record: AnswerRecord, finishedDay: DailyQuestion[] | null = null) => {
      const { progress, earned } = saveAnswer(userId, question, record, finishedDay);
      setState({ owner: userId, progress });
      return earned;
    },
    [userId],
  );
  // Quietly records awards already earned, without a celebration.
  const syncAwards = useCallback(async () => {
    const counts = await getQuestionCounts().catch(() => cachedQuestionCounts());
    const next = catchUpAwards(userId, counts);
    if (next) setState({ owner: userId, progress: next });
  }, [userId]);
  const reload = useCallback(() => setState({ owner: userId, progress: loadProgress(userId) }), [userId]);
  const retriesFor = useCallback(
    (exam: ExamSlug, today: string, limit: number) => retryPlan(userId, exam, today, limit),
    [userId],
  );

  // Until the swap above re-renders, never show the previous account's progress.
  const progress = state.owner === userId ? state.progress : EMPTY;
  return { progress, save, reload, retriesFor, syncAwards };
}

// Consecutive days finished on the day, ending today (or yesterday if today is still open).
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
