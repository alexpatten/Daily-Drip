import { supabase } from './supabase';

export type Letter = 'A' | 'B' | 'C' | 'D';
export const LETTERS: Letter[] = ['A', 'B', 'C', 'D'];

export type DailyQuestion = {
  id: number;
  question_date: string;
  question: string;
  choice_a: string;
  choice_b: string;
  choice_c: string;
  choice_d: string;
  correct_answer: Letter;
  explanation: string;
  category: { name: string; test_name: string } | null;
};

const SELECT =
  'id, question_date, question, choice_a, choice_b, choice_c, choice_d, correct_answer, explanation, ' +
  'category:praxis_categories(name, test_name)';

export function choiceText(q: DailyQuestion, letter: Letter): string {
  return { A: q.choice_a, B: q.choice_b, C: q.choice_c, D: q.choice_d }[letter];
}

// The newest released question. A new one is brewed at midnight Eastern by a scheduled
// job, and Row Level Security shows signed-out users only this one.
export async function getCurrentQuestion(): Promise<DailyQuestion | null> {
  const { data, error } = await supabase
    .from('daily_questions')
    .select(SELECT)
    .order('question_date', { ascending: false })
    .limit(1)
    .maybeSingle<DailyQuestion>();
  if (error) throw error;
  return data;
}

// The date of the current question, the same rule Row Level Security uses.
export async function getCurrentQuestionDate(): Promise<string | null> {
  const { data, error } = await supabase.rpc('current_question_date');
  if (error) throw error;
  return (data as string | null) ?? null;
}

export const PAST_PAGE_SIZE = 30;

// Questions before `beforeDate`, newest first. Signed-in users only (Row Level Security).
export async function getPastQuestions(beforeDate: string): Promise<DailyQuestion[]> {
  const { data, error } = await supabase
    .from('daily_questions')
    .select(SELECT)
    .lt('question_date', beforeDate)
    .order('question_date', { ascending: false })
    .limit(PAST_PAGE_SIZE)
    .returns<DailyQuestion[]>();
  if (error) throw error;
  return data;
}
