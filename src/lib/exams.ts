export type ExamSlug = 'praxis-slp' | 'security-plus';

export type Exam = {
  slug: ExamSlug;
  name: string;
  shortName: string;
  blurb: string;
};

// Matches public.exams in Supabase.
export const EXAMS: Exam[] = [
  {
    slug: 'praxis-slp',
    name: 'Praxis Speech-Language Pathology',
    shortName: 'Praxis SLP',
    blurb: '365 practice questions across every Praxis SLP (5331) content area.',
  },
  {
    slug: 'security-plus',
    name: 'CompTIA Security+',
    shortName: 'Security+',
    blurb: '500+ practice questions across every SY0-701 domain.',
  },
];

export function examFor(slug: ExamSlug): Exam {
  return EXAMS.find((e) => e.slug === slug) ?? EXAMS[0];
}

export const MIN_PER_DAY = 1;
export const MAX_PER_DAY = 25;
