-- Signed-in readers' progress lives in the database, so it follows them to every device.
-- The app still keeps a copy on the device (for guests, and to work offline) and sends
-- its changes here through merge_progress(), which merges rather than overwrites so two
-- devices can't undo each other's answers.

create table public.progress (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- Question id (or a legacy 'praxis:<date>' key) → { choice, correct, catchUp?, exam, day? }.
  answers jsonb not null default '{}',
  -- Days whose questions were all answered on the day.
  streak_days date[] not null default '{}',
  -- Award id → the day it was earned.
  awards jsonb not null default '{}',
  -- Questions answered right in a row, as of correct_run_at.
  correct_run integer not null default 0,
  correct_run_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;
grant select, insert, update on public.progress to authenticated;

create policy "Readers see their own progress"
  on public.progress for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Readers add their own progress"
  on public.progress for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Readers update their own progress"
  on public.progress for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Merges a device's changes (the app's Progress shape: answers, streakDays, awards,
-- correctRun, runAt) into the reader's progress. Anything else is ignored. Safe to send
-- the same changes twice.
-- * answers: the latest try (by day) wins; on the same day, the incoming one.
-- * streakDays: every day from either side.
-- * awards: whichever was recorded first is kept.
-- * correctRun: whichever was counted most recently.
create function public.merge_progress(p_changes jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  incoming_answers jsonb := coalesce(p_changes -> 'answers', '{}');
  incoming_days date[] := array(
    select jsonb_array_elements_text(coalesce(p_changes -> 'streakDays', '[]'))::date
  );
  incoming_run_at timestamptz := (p_changes ->> 'runAt')::timestamptz;
begin
  if uid is null then
    raise exception 'Sign in to save progress' using errcode = '42501';
  end if;

  insert into public.progress (user_id) values (uid) on conflict (user_id) do nothing;

  update public.progress p set
    answers = (
      select coalesce(jsonb_object_agg(key, value), '{}')
      from (
        select distinct on (key) key, value
        from (
          select key, value, 0 as incoming from jsonb_each(p.answers)
          union all
          select key, value, 1 from jsonb_each(incoming_answers)
        ) both_sides
        order by key, coalesce(value ->> 'day', '') desc, incoming desc
      ) latest
    ),
    streak_days = array(
      select distinct d from unnest(p.streak_days || incoming_days) d order by d
    ),
    awards = coalesce(p_changes -> 'awards', '{}') || p.awards,
    correct_run = case
      when incoming_run_at is not null
        and (p.correct_run_at is null or incoming_run_at >= p.correct_run_at)
      then greatest(coalesce((p_changes ->> 'correctRun')::integer, 0), 0)
      else p.correct_run
    end,
    correct_run_at = greatest(p.correct_run_at, incoming_run_at),
    updated_at = now()
  where p.user_id = uid;
end
$$;

revoke execute on function public.merge_progress(jsonb) from public, anon;
grant execute on function public.merge_progress(jsonb) to authenticated;
