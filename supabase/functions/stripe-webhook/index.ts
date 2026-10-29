// Copies Stripe subscriptions into public.subscriptions, which unlocks study sessions.
//
// Stripe calls this; the app never does. Requests are verified by their Stripe
// signature (deploy with verify_jwt = false). Each event re-reads the subscription from
// Stripe, so events that arrive late or out of order still leave the latest state.

import Stripe from "npm:stripe@22.6.2";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
// Deno has no Node crypto, so signatures are checked with Web Crypto.
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, secretKey(), {
  auth: { persistSession: false },
});

function secretKey(): string {
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keys) return JSON.parse(keys)["default"];
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

// The subscription an event is about, if any.
function subscriptionId(event: Stripe.Event): string | null {
  switch (event.type) {
    case "checkout.session.completed": {
      const sub = event.data.object.subscription;
      return typeof sub === "string" ? sub : (sub?.id ?? null);
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      return event.data.object.id;
    default:
      return null;
  }
}

// Billing checkout puts the reader's id on the subscription; fall back to the customer
// saved at checkout.
async function userIdFor(sub: Stripe.Subscription): Promise<string | null> {
  if (sub.metadata.user_id) return sub.metadata.user_id;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const { data } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle<{ user_id: string }>();
  return data?.user_id ?? null;
}

async function save(id: string) {
  const sub = await stripe.subscriptions.retrieve(id);
  const userId = await userIdFor(sub);
  if (!userId) {
    console.warn(`No reader for subscription ${sub.id}`);
    return;
  }
  const item = sub.items.data[0];
  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      status: sub.status,
      price_id: item?.price.id ?? null,
      current_period_end: item ? new Date(item.current_period_end * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

Deno.serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await req.text(),
      signature,
      WEBHOOK_SECRET,
      undefined,
      cryptoProvider,
    );
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Bad signature", { status: 400 });
  }

  const id = subscriptionId(event);
  if (!id) return Response.json({ received: true });
  try {
    await save(id);
  } catch (e) {
    console.error(e);
    // Stripe retries failed deliveries.
    return new Response("Couldn't save the subscription", { status: 500 });
  }
  return Response.json({ received: true });
});
