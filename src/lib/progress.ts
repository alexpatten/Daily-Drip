import { useCallback, useState } from 'react';

import { useAuth } from './auth';
import { addDays } from './dates';
import type { Letter } from './questions';
import { getItem, setItem } from './storage';

// Answers are kept per account on this device. Signed-out answers (and any saved
// before accounts existed) stay under the original key.
const GUEST_KEY = 'daily-drip:answers:v1';
const keyFor = (userId: string | null) => (userId ? `${GUEST_KEY}:${userId}` : GUEST_KEY);

// catchUp marks a past question answered from history, which doesn't count toward the streak.
export type AnswerRecord = { choice: Letter; correct: boolean; catchUp?: boolean };
export type Answers = Record<string, AnswerRecord>; // keyed by question_date

export function loadAnswers(userId: string | null): Answers {
  const raw = getItem(keyFor(userId));
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Answers;
  } catch {
    return {};
  }
}

export function saveAnswer(userId: string | null, date: string, record: AnswerRecord): Answers {
  const answers = { ...loadAnswers(userId), [date]: record };
  setItem(keyFor(userId), JSON.stringify(answers));
  return answers;
}

/** The signed-in user's answers (or the guest's), switching when the account changes. */
export function useAnswers() {
  const userId = useAuth().session?.user.id ?? null;
  const [state, setState] = useState(() => ({ owner: userId, answers: loadAnswers(userId) }));

  // Signing in, out, or into another account swaps in that account's answers.
  if (state.owner !== userId) setState({ owner: userId, answers: loadAnswers(userId) });

  const save = useCallback(
    (date: string, record: AnswerRecord) =>
      setState({ owner: userId, answers: saveAnswer(userId, date, record) }),
    [userId],
  );
  const reload = useCallback(() => setState({ owner: userId, answers: loadAnswers(userId) }), [userId]);

  // Until the swap above re-renders, never show the previous account's answers.
  const answers = state.owner === userId ? state.answers : {};
  return { answers, save, reload };
}

// Consecutive days answered on the day, ending today (or yesterday if today is still open).
export function currentStreak(answers: Answers, today: string): number {
  const onTime = (day: string) => answers[day] && !answers[day].catchUp;
  let day = onTime(today) ? today : addDays(today, -1);
  let streak = 0;
  while (onTime(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

export function totals(answers: Answers) {
  const all = Object.values(answers);
  return { answered: all.length, correct: all.filter((a) => a.correct).length };
}
