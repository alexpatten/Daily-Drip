import { useCallback, useState } from 'react';

import { useAuth } from './auth';
import { addDays } from './dates';
import type { ExamSlug } from './exams';
import type { DailyQuestion, Letter } from './questions';
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
type SavedAnswer = AnswerRecord & { exam: ExamSlug };

export type Progress = {
  answers: Record<string, SavedAnswer>; // keyed by question id
  streakDays: string[]; // days whose questions were all answered on the day
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

function saveAnswer(
  userId: string | null,
  question: DailyQuestion,
  record: AnswerRecord,
  streakDay: string | null,
): Progress {
  const progress = loadProgress(userId);
  const next: Progress = {
    answers: { ...progress.answers, [question.id]: { ...record, exam: question.exam } },
    streakDays:
      streakDay && !progress.streakDays.includes(streakDay)
        ? [...progress.streakDays, streakDay]
        : progress.streakDays,
  };
  setItem(keyFor(userId), JSON.stringify(next));
  return next;
}

export function answerFor(progress: Progress, q: DailyQuestion): AnswerRecord | undefined {
  return (
    progress.answers[q.id] ??
    (q.exam === 'praxis-slp' && q.position === 1
      ? progress.answers[legacyAnswerKey(q.question_date)]
      : undefined)
  );
}

/** The signed-in user's progress (or the guest's), switching when the account changes. */
export function useProgress() {
  const userId = useAuth().session?.user.id ?? null;
  const [state, setState] = useState(() => ({ owner: userId, progress: loadProgress(userId) }));

  // Signing in, out, or into another account swaps in that account's progress.
  if (state.owner !== userId) setState({ owner: userId, progress: loadProgress(userId) });

  // streakDay: the day this answer finished, if it completed that day's questions on time.
  const save = useCallback(
    (question: DailyQuestion, record: AnswerRecord, streakDay: string | null = null) =>
      setState({ owner: userId, progress: saveAnswer(userId, question, record, streakDay) }),
    [userId],
  );
  const reload = useCallback(() => setState({ owner: userId, progress: loadProgress(userId) }), [userId]);

  // Until the swap above re-renders, never show the previous account's progress.
  const progress = state.owner === userId ? state.progress : EMPTY;
  return { progress, save, reload };
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
