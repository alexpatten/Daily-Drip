-- Study sessions: 25 questions a day from the whole bank of the reader's exam, for
-- subscribers only (Daily Drip Plus, billed through Stripe).
--
-- * subscriptions: one row per account, written only by the billing edge functions
--   (secret key). Readers can see their own row.
-- * study_session(exam): the day's 25 questions. Each reader gets their own shuffle of
--   the bank, the same all day and new at midnight Eastern, so it can include today's
--   question or ones already answered. Non-subscribers get an error, so the paywall
--   holds even if the app is bypassed.
-- * retry_questions() is narrowed to the questions already served, so it can't be used
--   to read the bank without subscribing.

create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text not null unique,
  -- The reader's latest subscription; null until their first checkout completes.
  stripe_subscription_id text unique,
  -- Stripe's subscription status: active, trialing, past_due, canceled, …
  status text not null default 'none',
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
grant select on public.subscriptions to authenticated;

create policy "Readers see their own subscription"
  on public.subscriptions for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Statuses that unlock study sessions. Keep in sync with ACTIVE_STATUSES in
-- src/lib/billing.ts.
create function private.has_study_access(p_user uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = p_user and s.status in ('active', 'trialing')
  )
$$;

-- Today's study session for an exam: question_date is today and position is the
-- question's place in the session (1-25).
create function public.study_session(p_exam text)
returns setof public.daily_questions
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date := public.eastern_today();
begin
  if uid is null or not private.has_study_access(uid) then
    raise exception 'Study sessions are part of Daily Drip Plus' using errcode = '42501';
  end if;

  return query
  with picked as (
    select q.*, md5(uid::text || ':' || today::text || ':' || q.id::text) as shuffle
    from public.daily_questions q
    where q.exam = p_exam
    order by shuffle
    limit 25
  )
  select p.id, today, p.category_id, p.question, p.choice_a, p.choice_b, p.choice_c,
    p.choice_d, p.correct_answer, p.explanation, p.model, p.created_at, p.exam,
    (row_number() over (order by p.shuffle))::smallint, p.seq
  from picked p
  order by p.shuffle;
end
$$;

revoke execute on function public.study_session(text) from public, anon;
grant execute on function public.study_session(text) to authenticated;

-- Bank exams: only questions served before today, at one a day.
create or replace function public.retry_questions(p_exam text, p_ids bigint[])
returns setof public.daily_questions
language sql
stable
security definer
set search_path = ''
as $$
  select q.*
  from public.daily_questions q
  join public.exams e on e.slug = q.exam
  where q.exam = p_exam
    and q.id = any (p_ids[1:25])
    and case e.kind
      when 'daily' then q.question_date < public.exam_today(p_exam)
      else q.seq <= public.eastern_today() - e.starts_on
    end
  order by q.id
$$;
