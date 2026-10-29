-- Complimentary Daily Drip Plus: study sessions for a reader without a Stripe
-- subscription, granted by hand:
--
--   insert into public.subscriptions (user_id, status) values ('<user id>', 'comped')
--   on conflict (user_id) do update set status = 'comped', updated_at = now();
--
-- To take it back, set the status to 'canceled'. Stripe never writes these rows unless
-- the reader later subscribes, which the app doesn't offer while they're comped.

alter table public.subscriptions alter column stripe_customer_id drop not null;

-- Keep in sync with ACTIVE_STATUSES in src/lib/billing.ts and the billing function.
create or replace function private.has_study_access(p_user uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = p_user and s.status in ('active', 'trialing', 'comped')
  )
$$;
