import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { FunctionsHttpError } from '@supabase/supabase-js';

import { useAuth } from './auth';
import { supabase } from './supabase';

// Daily Drip Plus unlocks study sessions. It's sold through Stripe on the web. The app
// stores require their own in-app purchases for subscriptions, so the native apps only
// unlock it for accounts that subscribed on the web.
export const CAN_SUBSCRIBE_HERE = Platform.OS === 'web';

// Keep in sync with private.has_study_access() in Supabase. 'comped' is complimentary
// access, granted by hand without a Stripe subscription.
const ACTIVE_STATUSES = ['active', 'trialing', 'comped'];

export type Subscription = {
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

export type Plan = { amount: number | null; currency: string; interval: string | null };

type SubscriptionState = { owner: string | null; subscription: Subscription | null; loaded: boolean };
type Fetched = { userId: string; ok: boolean; subscription: Subscription | null };

async function fetchSubscription(userId: string): Promise<Fetched> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, current_period_end, cancel_at_period_end')
    .eq('user_id', userId)
    .maybeSingle<Subscription>();
  return { userId, ok: !error, subscription: data };
}

/** The signed-in reader's subscription, refreshed on return to the app. */
export function useSubscription() {
  const userId = useAuth().session?.user.id ?? null;
  const [state, setState] = useState<SubscriptionState>({ owner: userId, subscription: null, loaded: false });

  const apply = useCallback(
    (fetched: Fetched) =>
      setState((prev) =>
        fetched.ok
          ? { owner: fetched.userId, subscription: fetched.subscription, loaded: true }
          : // Offline, keep whatever was known.
            prev.owner === fetched.userId ? { ...prev, loaded: true } : prev,
      ),
    [],
  );

  const refresh = useCallback(async () => {
    if (userId) apply(await fetchSubscription(userId));
  }, [userId, apply]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const run = () => fetchSubscription(userId).then((fetched) => active && apply(fetched));
    run();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
    return () => {
      active = false;
      sub.remove();
    };
  }, [userId, apply]);

  // Until the new account's subscription loads, never show the previous account's.
  const current = state.owner === userId ? state : { owner: userId, subscription: null, loaded: false };
  return {
    subscription: current.subscription,
    active: isActive(current.subscription),
    loaded: current.loaded,
    refresh,
  };
}

export function isActive(subscription: Subscription | null): boolean {
  return !!subscription && ACTIVE_STATUSES.includes(subscription.status);
}

async function billing<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('billing', { body });
  if (error) {
    // The function explains what went wrong in its response.
    const message =
      error instanceof FunctionsHttpError
        ? await error.context.json().then((b: { error?: string }) => b.error).catch(() => null)
        : null;
    throw new Error(message ?? "Couldn't reach billing. Please try again.");
  }
  return data as T;
}

export function getPlan(): Promise<Plan> {
  return billing<Plan>({ action: 'plan' });
}

export function formatPlan(plan: Plan): string | null {
  if (plan.amount === null) return null;
  const price = new Intl.NumberFormat(undefined, { style: 'currency', currency: plan.currency }).format(
    plan.amount / 100,
  );
  return plan.interval ? `${price} / ${plan.interval}` : price;
}

// Where Stripe sends the reader back to: this page, without any old checkout result.
function returnUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete('checkout');
  return url.toString();
}

/** Web only: goes to Stripe Checkout, which comes back with ?checkout=success. */
export async function startCheckout(): Promise<void> {
  const { url } = await billing<{ url: string }>({ action: 'checkout', returnUrl: returnUrl() });
  window.location.assign(url);
}

/** Web only: goes to Stripe's page for changing or cancelling the subscription. */
export async function openBillingPortal(): Promise<void> {
  const { url } = await billing<{ url: string }>({ action: 'portal', returnUrl: returnUrl() });
  window.location.assign(url);
}
