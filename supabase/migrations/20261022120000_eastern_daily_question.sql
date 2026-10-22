-- The question of the day turns over at midnight Eastern time, brewed only by the
-- scheduled job. Everyone sees the current question; past questions are for
-- signed-in users.

-- Today's date in Eastern time (America/New_York, so it follows daylight saving).
create or replace function public.eastern_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/New_York')::date
$$;

-- The newest released question's date. If a brew fails, this stays on the previous
-- question rather than leaving the app empty. Security definer because the policy
-- below needs it to see every row, and a policy can't query its own table.
create or replace function public.current_question_date()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select max(question_date) from public.daily_questions
  where question_date <= public.eastern_today()
$$;

drop policy "Released questions are public" on public.daily_questions;

create policy "The current question is public"
  on public.daily_questions for select
  to anon, authenticated
  using (question_date = (select public.current_question_date()));

-- Only confirmed users can sign in (email confirmations are on).
create policy "Signed-in users can read past questions"
  on public.daily_questions for select
  to authenticated
  using (question_date <= (select public.eastern_today()));

-- pg_cron runs in UTC. Midnight Eastern is 04:00 UTC during daylight saving time and
-- 05:00 UTC otherwise, so run at both: the function brews the Eastern date's question
-- once, and whichever run isn't at midnight finds it already there. The 06:00 run
-- retries if the midnight brew failed.
select cron.schedule(
  'daily-praxis-question',
  '0 4,5,6 * * *',
  $$
  select net.http_post(
    url := 'https://jluewvjtvxubevkkszxf.supabase.co/functions/v1/daily-question',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
