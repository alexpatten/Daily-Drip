// Daily Drip Plus billing, called by the signed-in app. Stripe is the source of truth;
// stripe-webhook copies each subscription into public.subscriptions.
//
// POST { action: "plan" }                     -> { amount, currency, interval }
// POST { action: "checkout", returnUrl }      -> { url } of a Stripe Checkout page
// POST { action: "portal", returnUrl }        -> { url } of the Stripe billing portal
//
// returnUrl must be on one of ALLOWED_RETURN_ORIGINS, so this can't be used to send
// readers anywhere else.

import Stripe from "npm:stripe@22.6.2";
import { createClient, type User } from "npm:@supabase/supabase-js@2.118.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const PRICE_ID = Deno.env.get("STRIPE_PRICE_ID")!;
const ALLOWED_RETURN_ORIGINS = (Deno.env.get("ALLOWED_RETURN_ORIGINS") ?? "https://thedailydrip.app")
  .split(",")
  .map((origin) => origin.trim());
// Keep in sync with private.has_study_access().
const ACTIVE_STATUSES = ["active", "trialing"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, secretKey(), {
  auth: { persistSession: false },
});

function secretKey(): string {
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keys) return JSON.parse(keys)["default"];
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function signedInUser(req: Request): Promise<User | null> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  return error ? null : data.user;
}

function allowedReturnUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ALLOWED_RETURN_ORIGINS.includes(url.origin) ? url.toString() : null;
  } catch {
    return null;
  }
}

type SubscriptionRow = { stripe_customer_id: string; status: string };

async function subscriptionFor(user: User): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id, status")
    .eq("user_id", user.id)
    .maybeSingle<SubscriptionRow>();
  if (error) throw error;
  return data;
}

// The reader's Stripe customer, created on their first checkout.
async function customerFor(user: User): Promise<string> {
  const existing = await subscriptionFor(user);
  if (existing) return existing.stripe_customer_id;
  const customer = await stripe.customers.create({
    email: user.email,
    name: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : undefined,
    metadata: { user_id: user.id },
  });
  // Two checkouts at once: keep whichever customer was saved first.
  const { error } = await supabase
    .from("subscriptions")
    .upsert({ user_id: user.id, stripe_customer_id: customer.id }, { onConflict: "user_id", ignoreDuplicates: true });
  if (error) throw error;
  return (await subscriptionFor(user))!.stripe_customer_id;
}

async function plan() {
  const price = await stripe.prices.retrieve(PRICE_ID);
  return json({
    amount: price.unit_amount,
    currency: price.currency,
    interval: price.recurring?.interval ?? null,
  });
}

async function checkout(user: User, returnUrl: string) {
  const existing = await subscriptionFor(user);
  if (existing && ACTIVE_STATUSES.includes(existing.status)) {
    return json({ error: "You're already subscribed." }, 409);
  }
  const success = new URL(returnUrl);
  success.searchParams.set("checkout", "success");
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: await customerFor(user),
    client_reference_id: user.id,
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    subscription_data: { metadata: { user_id: user.id } },
    allow_promotion_codes: true,
    success_url: success.toString(),
    cancel_url: returnUrl,
  });
  return json({ url: session.url });
}

async function portal(user: User, returnUrl: string) {
  const existing = await subscriptionFor(user);
  if (!existing) return json({ error: "There's no subscription to manage yet." }, 404);
  const session = await stripe.billingPortal.sessions.create({
    customer: existing.stripe_customer_id,
    return_url: returnUrl,
  });
  return json({ url: session.url });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await signedInUser(req);
  if (!user) return json({ error: "Sign in to subscribe." }, 401);

  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "plan") return await plan();
    const returnUrl = allowedReturnUrl(body.returnUrl);
    if (!returnUrl) return json({ error: "That return address isn't allowed." }, 400);
    if (body.action === "checkout") return await checkout(user, returnUrl);
    if (body.action === "portal") return await portal(user, returnUrl);
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "Billing is unavailable right now. Please try again." }, 500);
  }
});
