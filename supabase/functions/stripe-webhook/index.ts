import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2023-10-16",
  });

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing signature" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let event: Stripe.Event;
  const body = await req.text();

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    switch (event.type) {
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        await supabaseAdmin
          .from("workspaces")
          .update({
            subscription_status: "trialing",
            plan_type: "trialing",
            stripe_subscription_id: subscription.id,
            stripe_price_id: (subscription as any).items?.data?.[0]?.price?.id || null,
            trial_end: subscription.trial_end
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null,
            blocked_at: null,
          })
          .eq("stripe_customer_id", subscription.customer as string);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const status = subscription.status;
        const updates: Record<string, any> = {
          subscription_status: status,
          stripe_price_id: (subscription as any).items?.data?.[0]?.price?.id || null,
        };

        if (status === "active") {
          updates.plan_type = "active";
          updates.blocked_at = null;
        } else if (status === "past_due") {
          updates.plan_type = "past_due";
        } else if (status === "canceled") {
          updates.plan_type = "canceled";
          updates.blocked_at = new Date().toISOString();
        } else if (status === "trialing") {
          updates.plan_type = "trialing";
          updates.trial_end = subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null;
        }

        await supabaseAdmin
          .from("workspaces")
          .update(updates)
          .eq("stripe_customer_id", subscription.customer as string);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await supabaseAdmin
          .from("workspaces")
          .update({
            subscription_status: "canceled",
            plan_type: "canceled",
            blocked_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", subscription.customer as string);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Check if already past_due for more than 3 days
        const { data: ws } = await supabaseAdmin
          .from("workspaces")
          .select("subscription_status, blocked_at")
          .eq("stripe_customer_id", customerId)
          .single();

        const updates: Record<string, any> = {
          subscription_status: "past_due",
        };

        if (ws?.subscription_status === "past_due" && !ws?.blocked_at) {
          // Already past_due, block now
          updates.blocked_at = new Date().toISOString();
          updates.plan_type = "blocked";
        }

        await supabaseAdmin
          .from("workspaces")
          .update(updates)
          .eq("stripe_customer_id", customerId);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await supabaseAdmin
          .from("workspaces")
          .update({
            subscription_status: "active",
            plan_type: "active",
            blocked_at: null,
          })
          .eq("stripe_customer_id", invoice.customer as string);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({ error: "Webhook processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
