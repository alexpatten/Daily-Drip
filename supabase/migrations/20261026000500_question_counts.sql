-- How many questions each exam has so far, for the app's "every question" awards.
-- Daily exams: questions released up to today. Bank exams: the whole bank.
create function public.question_counts()
returns table (exam text, total integer)
language sql
stable
security definer
set search_path = ''
as $$
  select e.slug, count(q.id)::integer
  from public.exams e
  left join public.daily_questions q
    on q.exam = e.slug
    and (e.kind = 'bank' or q.question_date <= public.exam_today(e.slug))
  group by e.slug
$$;
