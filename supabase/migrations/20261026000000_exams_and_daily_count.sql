-- Daily Drip now covers two exams, and readers choose how many questions a day (1-25).
--
-- * Praxis SLP ('daily'): Claude writes a batch of 25 questions for each date
--   (question_date, position 1-25). Readers who want N a day see positions 1..N.
-- * CompTIA Security+ ('bank'): a fixed bank of questions (seq 1..size) served in
--   rotation. Day d of the rotation serves seq d*N+1 .. d*N+N, wrapping around, so a
--   one-a-day reader goes through the whole bank before anything repeats.
--
-- The app reads through todays_questions() and past_questions(). The original table
-- policies stay, narrowed to Praxis position 1, so app builds from before this change
-- keep seeing exactly what they did. The tables keep their original names for the
-- same reason.

create table public.exams (
  slug text primary key,
  name text not null,
  short_name text not null,
  sort_order smallint not null unique,
  kind text not null check (kind in ('daily', 'bank')),
  -- Bank exams: the first day of the rotation.
  starts_on date,
  check (kind = 'daily' or starts_on is not null)
);

alter table public.exams enable row level security;
grant select on public.exams to anon, authenticated;

create policy "Exams are public"
  on public.exams for select
  to anon, authenticated
  using (true);

insert into public.exams (slug, name, short_name, sort_order, kind, starts_on) values
  ('praxis-slp',    'Praxis Speech-Language Pathology', 'Praxis SLP', 1, 'daily', null),
  ('security-plus', 'CompTIA Security+',                'Security+',  2, 'bank',  '2026-10-26');

-- Categories belong to an exam.
alter table public.praxis_categories
  add column exam text not null default 'praxis-slp' references public.exams (slug);
alter table public.praxis_categories alter column exam drop default;
alter table public.praxis_categories
  drop constraint praxis_categories_sort_order_key,
  add constraint praxis_categories_exam_sort_order_key unique (exam, sort_order);

-- Daily questions have a date and a position in that day's batch; bank questions
-- have a place (seq) in the rotation instead.
alter table public.daily_questions
  add column exam text not null default 'praxis-slp' references public.exams (slug),
  add column position smallint check (position between 1 and 25),
  add column seq integer check (seq > 0),
  alter column question_date drop not null;

update public.daily_questions set position = 1;

alter table public.daily_questions alter column exam drop default;
alter table public.daily_questions
  drop constraint daily_questions_question_date_key,
  add constraint daily_questions_exam_date_position_key unique (exam, question_date, position),
  add constraint daily_questions_exam_seq_key unique (exam, seq),
  add constraint daily_questions_placement_check check (
    (question_date is not null and position is not null and seq is null)
    or (question_date is null and position is null and seq is not null)
  );

-- The current day for an exam. Daily exams: the newest released batch, so a failed
-- brew leaves the previous day's questions up rather than an empty app. Bank exams:
-- today, Eastern time.
create function public.exam_today(p_exam text)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select case e.kind
    when 'bank' then public.eastern_today()
    else (
      select max(q.question_date) from public.daily_questions q
      where q.exam = e.slug and q.question_date <= public.eastern_today()
    )
  end
  from public.exams e
  where e.slug = p_exam
$$;

-- Older app builds use this for Praxis.
create or replace function public.current_question_date()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select public.exam_today('praxis-slp')
$$;

drop policy "The current question is public" on public.daily_questions;
drop policy "Signed-in users can read past questions" on public.daily_questions;

create policy "The current question is public"
  on public.daily_questions for select
  to anon, authenticated
  using (
    exam = 'praxis-slp' and position = 1
    and question_date = (select public.current_question_date())
  );

create policy "Signed-in users can read past questions"
  on public.daily_questions for select
  to authenticated
  using (
    exam = 'praxis-slp' and position = 1
    and question_date <= (select public.eastern_today())
  );

-- Helpers the API can't reach: the private schema isn't exposed.
create schema if not exists private;

-- Days on which an exam has questions, up to today.
create function private.released_days(p_exam text)
returns setof date
language sql
stable
set search_path = ''
as $$
  select distinct q.question_date
  from public.daily_questions q
  join public.exams e on e.slug = q.exam and e.kind = 'daily'
  where q.exam = p_exam and q.question_date <= public.eastern_today()
  union
  select d::date
  from public.exams e,
    generate_series(e.starts_on::timestamp, public.eastern_today()::timestamp, interval '1 day') d
  where e.slug = p_exam and e.kind = 'bank'
$$;

-- The questions served on each of p_days, p_count per day. Bank rows come back with
-- question_date and position set to the day and slot they're served in.
create function private.question_sets(p_exam text, p_count integer, p_days date[])
returns setof public.daily_questions
language sql
stable
set search_path = ''
as $$
  with params as (
    select least(greatest(p_count, 1), 25) as n
  )
  select q.*
  from public.daily_questions q
  join public.exams e on e.slug = q.exam and e.kind = 'daily'
  cross join params
  where q.exam = p_exam and q.question_date = any (p_days) and q.position <= params.n
  union all
  select q.id, d.day, q.category_id, q.question, q.choice_a, q.choice_b, q.choice_c, q.choice_d,
    q.correct_answer, q.explanation, q.model, q.created_at, q.exam, (i + 1)::smallint, q.seq
  from public.exams e
  cross join params
  cross join (
    select count(*)::integer as size from public.daily_questions where exam = p_exam
  ) bank
  cross join unnest(p_days) as d (day)
  cross join generate_series(0, params.n - 1) as i
  join public.daily_questions q
    on q.exam = e.slug
    and q.seq = (((d.day - e.starts_on) * params.n + i) % bank.size + bank.size) % bank.size + 1
  where e.slug = p_exam and e.kind = 'bank' and bank.size > 0
$$;

-- Today's questions for an exam, in order. Open to everyone.
create function public.todays_questions(p_exam text, p_count integer)
returns setof public.daily_questions
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.question_sets(p_exam, p_count, array[public.exam_today(p_exam)])
  order by position
$$;

-- Questions from up to p_days earlier days before p_before (default: today), newest
-- first. Signed-in users only.
create function public.past_questions(p_exam text, p_count integer, p_before date, p_days integer)
returns setof public.daily_questions
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.question_sets(p_exam, p_count, array(
    select d from private.released_days(p_exam) d
    where d < least(p_before, public.exam_today(p_exam))
    order by d desc
    limit least(greatest(p_days, 1), 60)
  ))
  where (select auth.uid()) is not null
  order by question_date desc, position
$$;
