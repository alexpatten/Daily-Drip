import { addDays, localDateString } from './dates';
import { EXAMS, type ExamSlug } from './exams';
import type { AnswerRecord, Progress } from './progress';
import type { DailyQuestion } from './questions';

// Questions each exam has (the whole bank).
export type QuestionCounts = Partial<Record<ExamSlug, number>>;

// What's known about an answer as it's saved, for awards that depend on the moment.
export type AwardEvent = {
  question: DailyQuestion;
  record: AnswerRecord;
  at: Date;
};

type Stats = {
  correct: number;
  longestStreak: number;
  catchUps: number;
  examsTried: number;
  run: number;
  answered: (exam: ExamSlug) => number;
  counts: QuestionCounts | null;
};

export type AwardGroup = 'correct' | 'streak' | 'complete' | 'extra';

export type Award = {
  id: string;
  group: AwardGroup;
  name: string;
  description: string;
  // Awards that build up show how far along they are; null when it isn't known yet.
  progress?: (s: Stats) => { value: number; goal: number } | null;
  // Awards for a single moment, checked as each answer is saved.
  moment?: (e: AwardEvent) => boolean;
};

export const AWARD_GROUPS: { group: AwardGroup; title: string }[] = [
  { group: 'correct', title: 'Right answers' },
  { group: 'streak', title: 'Streaks' },
  { group: 'complete', title: 'Every question' },
  { group: 'extra', title: 'Little extras' },
];

const correctAward = (id: string, name: string, goal: number): Award => ({
  id,
  group: 'correct',
  name,
  description: goal === 1 ? 'Get your first question right.' : `Get ${goal} questions right.`,
  progress: (s) => ({ value: s.correct, goal }),
});

const streakAward = (id: string, name: string, goal: number): Award => ({
  id,
  group: 'streak',
  name,
  description: `Finish ${goal} days in a row.`,
  progress: (s) => ({ value: s.longestStreak, goal }),
});

const hour = (e: AwardEvent) => e.at.getHours();

export const AWARDS: Award[] = [
  correctAward('correct-1', 'First Sip', 1),
  correctAward('correct-10', 'Regular', 10),
  correctAward('correct-100', 'Head Barista', 100),
  correctAward('correct-300', 'Connoisseur', 300),

  streakAward('streak-3', 'Warming Up', 3),
  streakAward('streak-7', 'Full Week', 7),
  streakAward('streak-30', 'Monthly Roast', 30),
  streakAward('streak-100', 'Bottomless Cup', 100),

  ...EXAMS.map(
    (exam): Award => ({
      id: `complete:${exam.slug}`,
      group: 'complete',
      name: `Whole Menu: ${exam.shortName}`,
      description: `Answer every ${exam.shortName} question there is so far.`,
      progress: (s) => {
        const goal = s.counts?.[exam.slug];
        return goal ? { value: s.answered(exam.slug), goal } : null;
      },
    }),
  ),

  {
    id: 'hot-streak',
    group: 'extra',
    name: 'Hot Streak',
    description: 'Get 10 questions right in a row.',
    progress: (s) => ({ value: s.run, goal: 10 }),
  },
  {
    id: 'catching-up',
    group: 'extra',
    name: 'Catching Up',
    description: 'Answer 25 questions from past brews.',
    progress: (s) => ({ value: s.catchUps, goal: 25 }),
  },
  {
    id: 'double-major',
    group: 'extra',
    name: 'Double Major',
    description: `Answer questions for ${EXAMS.length === 2 ? 'both' : 'every'} exam.`,
    progress: (s) => ({ value: s.examsTried, goal: EXAMS.length }),
  },
  {
    id: 'early-bird',
    group: 'extra',
    name: 'Early Bird',
    description: 'Answer a question between 4 and 7 am.',
    moment: (e) => hour(e) >= 4 && hour(e) < 7,
  },
  {
    id: 'night-owl',
    group: 'extra',
    name: 'Night Owl',
    description: 'Answer a question between 10 pm and 4 am.',
    moment: (e) => hour(e) >= 22 || hour(e) < 4,
  },
];

// The most consecutive days ever finished on the day.
function longestStreak(days: string[]): number {
  const set = new Set(days);
  let best = 0;
  for (const day of set) {
    if (set.has(addDays(day, -1))) continue; // Not the start of a run.
    let length = 1;
    while (set.has(addDays(day, length))) length += 1;
    best = Math.max(best, length);
  }
  return best;
}

function statsFor(progress: Progress, counts: QuestionCounts | null): Stats {
  const answers = Object.values(progress.answers);
  return {
    correct: answers.filter((a) => a.correct).length,
    longestStreak: longestStreak(progress.streakDays),
    catchUps: answers.filter((a) => a.catchUp).length,
    examsTried: new Set(answers.map((a) => a.exam)).size,
    run: progress.correctRun ?? 0,
    answered: (exam) => answers.filter((a) => a.exam === exam).length,
    counts,
  };
}

function reached(award: Award, stats: Stats): boolean {
  const p = award.progress?.(stats);
  return !!p && p.goal > 0 && p.value >= p.goal;
}

// Awards earned by this progress (and the answer just saved, if any) that weren't before.
export function newAwards(progress: Progress, counts: QuestionCounts | null, event: AwardEvent | null): Award[] {
  const stats = statsFor(progress, counts);
  return AWARDS.filter(
    (a) => !progress.awards?.[a.id] && (reached(a, stats) || (!!event && !!a.moment?.(event))),
  );
}

export function withAwards(progress: Progress, earned: Award[], at = new Date()): Progress {
  if (earned.length === 0) return progress;
  const day = localDateString(at);
  return {
    ...progress,
    awards: { ...progress.awards, ...Object.fromEntries(earned.map((a) => [a.id, day])) },
  };
}

export type AwardStatus = {
  award: Award;
  earnedOn: string | null;
  progress: { value: number; goal: number } | null;
};

export function awardStatuses(progress: Progress, counts: QuestionCounts | null): AwardStatus[] {
  const stats = statsFor(progress, counts);
  return AWARDS.map((award) => ({
    award,
    earnedOn: progress.awards?.[award.id] ?? null,
    progress: award.progress?.(stats) ?? null,
  }));
}
