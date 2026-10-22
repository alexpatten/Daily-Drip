import { addDays } from './dates';
import type { Letter } from './questions';
import { getItem, setItem } from './storage';

const KEY = 'daily-drip:answers:v1';

// catchUp marks a past question answered from history, which doesn't count toward the streak.
export type AnswerRecord = { choice: Letter; correct: boolean; catchUp?: boolean };
export type Answers = Record<string, AnswerRecord>; // keyed by question_date

export function loadAnswers(): Answers {
  const raw = getItem(KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Answers;
  } catch {
    return {};
  }
}

export function saveAnswer(date: string, record: AnswerRecord): Answers {
  const answers = { ...loadAnswers(), [date]: record };
  setItem(KEY, JSON.stringify(answers));
  return answers;
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
