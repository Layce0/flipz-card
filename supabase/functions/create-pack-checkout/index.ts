import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Pack configurations with Stripe price IDs
const PACK_CONFIGS: Record<string, { priceId: string; cardCount: number; type: string; multiplier: number }> = {
  // Standard packs
  'standard_5': { priceId: 'price_1Sx7NRRso6ZwmIeuWMjDhAdL', cardCount: 5, type: 'standard', multiplier: 1 },
  'standard_10': { priceId: 'price_1Sx7NhRso6ZwmIeuxrPl1yJ8', cardCount: 10, type: 'standard', multiplier: 1 },
  'standard_20': { priceId: 'price_1Sx7O0Rso6ZwmIeuoPSLJAOm', cardCount: 20, type: 'standard', multiplier: 1 },
  'standard_50': { priceId: 'price_1Sx7OMRso6ZwmIeuFpbMa8yY', cardCount: 50, type: 'standard', multiplier: 1 },
  // Lucky packs (x2)
  'lucky_5': { priceId: 'price_1Sx7PbRso6ZwmIeuqi8AlaKE', cardCount: 5, type: 'lucky', multiplier: 2 },
  'lucky_10': { priceId: 'price_1Sx7PvRso6ZwmIeu0iHNAaqe', cardCount: 10, type: 'lucky', multiplier: 2 },
  'lucky_20': { priceId: 'price_1Sx7QBRso6ZwmIeuQUUZLrEd', cardCount: 20, type: 'lucky', multiplier: 2 },
  'lucky_50': { priceId: 'price_1Sx7QsRso6ZwmIeuoDtF5g1T', cardCount: 50, type: 'lucky', multiplier: 2 },
  // Ultra lucky packs (x5)
  'ultra_5': { priceId: 'price_1Sx7ZqRso6ZwmIeu02wvzo6c', cardCount: 5, type: 'ultra', multiplier: 5 },
  'ultra_10': { priceId: 'price_1Sx7a9Rso6ZwmIeu3ijE6VNL', cardCount: 10, type: 'ultra', multiplier: 5 },
  'ultra_20': { priceId: 'price_1Sx7aXRso6ZwmIeu3ysEMlNu', cardCount: 20, type: 'ultra', multiplier: 5 },
  'ultra_50': { priceId: 'price_1Sx7b1Rso6ZwmIeu0ljVHJAE', cardCount: 50, type: 'ultra', multiplier: 5 },
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PACK-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const { packId } = await req.json();
    if (!packId || !PACK_CONFIGS[packId]) {
      throw new Error("Invalid pack ID");
    }

    const packConfig = PACK_CONFIGS[packId];
    logStep("Pack selected", { packId, packConfig });

    // Get authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      payment_method_types: ['card'],
      line_items: [
        {
          price: packConfig.priceId,
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/shop?success=true&pack=${packId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/shop?canceled=true`,
      metadata: {
        userId: user.id,
        packId: packId,
        cardCount: packConfig.cardCount.toString(),
        packType: packConfig.type,
        multiplier: packConfig.multiplier.toString(),
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
