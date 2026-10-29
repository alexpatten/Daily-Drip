import type { QuestionCounts } from './awards';
import type { ExamSlug } from './exams';
import { supabase } from './supabase';

export type Letter = 'A' | 'B' | 'C' | 'D';
export const LETTERS: Letter[] = ['A', 'B', 'C', 'D'];

export type DailyQuestion = {
  id: number;
  exam: ExamSlug;
  // The day this question is served, and its place in that day's set.
  question_date: string;
  position: number;
  question: string;
  choice_a: string;
  choice_b: string;
  choice_c: string;
  choice_d: string;
  correct_answer: Letter;
  explanation: string;
  category: { name: string; test_name: string } | null;
};

export const QUESTION_SELECT =
  'id, exam, question_date, position, question, choice_a, choice_b, choice_c, choice_d, correct_answer, explanation, ' +
  'category:praxis_categories(name, test_name)';

export function choiceText(q: DailyQuestion, letter: Letter): string {
  return { A: q.choice_a, B: q.choice_b, C: q.choice_c, D: q.choice_d }[letter];
}

// A question comes back when its bank wraps around, so a day's slot is the stable key
// for lists.
export function slotKey(q: DailyQuestion): string {
  return `${q.exam}:${q.question_date}:${q.position}`;
}

// Today's question for an exam, from its fixed bank in rotation: one a day, so a reader
// sees every question before any repeats. The day turns over at midnight Eastern. Null
// if there isn't one.
export async function getTodaysQuestion(exam: ExamSlug): Promise<DailyQuestion | null> {
  const { data, error } = await supabase
    .rpc('todays_questions', { p_exam: exam, p_count: 1 })
    .select(QUESTION_SELECT)
    .returns<DailyQuestion[]>();
  if (error) throw error;
  return data[0] ?? null;
}

// How many past days to load at a time.
export const PAST_PAGE_DAYS = 30;

// The questions from up to PAST_PAGE_DAYS days before `beforeDate` (default: today),
// newest first. Signed-in users only.
export async function getPastQuestions(exam: ExamSlug, beforeDate: string | null): Promise<DailyQuestion[]> {
  const { data, error } = await supabase
    .rpc('past_questions', { p_exam: exam, p_count: 1, p_before: beforeDate, p_days: PAST_PAGE_DAYS })
    .select(QUESTION_SELECT)
    .returns<DailyQuestion[]>();
  if (error) throw error;
  return data;
}

// How many questions each exam has, for the "every question" awards. Banks only change
// with a migration, but the cached counts are still refreshed after an hour.
const COUNTS_MAX_AGE_MS = 60 * 60 * 1000;
let counts: { value: QuestionCounts; at: number } | null = null;

export function cachedQuestionCounts(): QuestionCounts | null {
  return counts?.value ?? null;
}

export async function getQuestionCounts(): Promise<QuestionCounts> {
  if (counts && Date.now() - counts.at < COUNTS_MAX_AGE_MS) return counts.value;
  const { data, error } = await supabase.rpc('question_counts');
  if (error) throw error;
  const rows = (data ?? []) as { exam: ExamSlug; total: number }[];
  const value = Object.fromEntries(rows.map((row) => [row.exam, row.total])) as QuestionCounts;
  counts = { value, at: Date.now() };
  return value;
}
