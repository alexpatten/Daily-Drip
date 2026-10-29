import { useCallback, useState } from 'react';

import { useAuth } from './auth';
import type { ExamSlug } from './exams';
import type { AnswerRecord } from './progress';
import { QUESTION_SELECT, type DailyQuestion } from './questions';
import { getItem, setItem } from './storage';
import { supabase } from './supabase';

export const STUDY_SESSION_SIZE = 25;

// Today's study session: 25 questions from the exam's whole bank, the reader's own
// shuffle, new each day at midnight Eastern. Subscribers only; anyone else gets an error.
export async function getStudySession(exam: ExamSlug): Promise<DailyQuestion[]> {
  const { data, error } = await supabase
    .rpc('study_session', { p_exam: exam })
    .select(QUESTION_SELECT)
    .returns<DailyQuestion[]>();
  if (error) throw error;
  return data;
}

// Study answers are practice: they're kept apart from daily progress, so they don't
// change the daily question, streaks or awards, and every session starts unanswered.
// Only the current day's are kept, on this device.
const KEY = 'daily-drip:study:v1';
const keyFor = (userId: string | null) => `${KEY}:${userId ?? 'guest'}`;

type StudyAnswers = Record<string, AnswerRecord>; // keyed by question id
type Saved = { day: string; exams: Partial<Record<ExamSlug, StudyAnswers>> };

function load(userId: string | null): Saved | null {
  try {
    return JSON.parse(getItem(keyFor(userId)) ?? 'null') as Saved | null;
  } catch {
    return null;
  }
}

function answersFor(userId: string | null, exam: ExamSlug, day: string): StudyAnswers {
  const saved = load(userId);
  return saved?.day === day ? (saved.exams[exam] ?? {}) : {};
}

/** The signed-in reader's answers in today's study session for an exam. */
export function useStudyAnswers(exam: ExamSlug, day: string | null) {
  const userId = useAuth().session?.user.id ?? null;
  const key = `${userId}:${exam}:${day}`;
  const [state, setState] = useState(() => ({ key, answers: day ? answersFor(userId, exam, day) : {} }));

  if (state.key !== key) setState({ key, answers: day ? answersFor(userId, exam, day) : {} });

  const save = useCallback(
    (question: DailyQuestion, record: AnswerRecord) => {
      const saved = load(userId);
      // A new day starts over.
      const exams = saved?.day === question.question_date ? saved.exams : {};
      const answers = { ...exams[exam], [question.id]: record };
      setItem(keyFor(userId), JSON.stringify({ day: question.question_date, exams: { ...exams, [exam]: answers } }));
      setState({ key, answers });
    },
    [userId, exam, key],
  );

  return { answers: state.key === key ? state.answers : {}, save };
}
