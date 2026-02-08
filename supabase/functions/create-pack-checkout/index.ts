import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// CORS headers - allow all origins
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Pack configurations with Stripe price IDs
const PACK_CONFIGS: Record<string, { priceId: string; cardCount: number; type: string; multiplier: number }> = {
  // Standard packs
  'standard_5': { priceId: 'price_1SybWhDcvxD9sOlhySErbdCF', cardCount: 5, type: 'standard', multiplier: 1 },
  'standard_10': { priceId: 'price_1SybX9DcvxD9sOlhp32Yd5VR', cardCount: 10, type: 'standard', multiplier: 1 },
  'standard_20': { priceId: 'price_1SybXJDcvxD9sOlhz8EuCn8M', cardCount: 20, type: 'standard', multiplier: 1 },
  'standard_50': { priceId: 'price_1SybXUDcvxD9sOlhMqRoYzxI', cardCount: 50, type: 'standard', multiplier: 1 },
  // Lucky packs (x2)
  'lucky_5': { priceId: 'price_1SybXjDcvxD9sOlhVUQh1g6A', cardCount: 5, type: 'lucky', multiplier: 2 },
  'lucky_10': { priceId: 'price_1SybXwDcvxD9sOlhQgmOAldW', cardCount: 10, type: 'lucky', multiplier: 2 },
  'lucky_20': { priceId: 'price_1SybY9DcvxD9sOlhfhwBM9ql', cardCount: 20, type: 'lucky', multiplier: 2 },
  'lucky_50': { priceId: 'price_1SybYNDcvxD9sOlh0zf7FM2z', cardCount: 50, type: 'lucky', multiplier: 2 },
  // Ultra lucky packs (x5)
  'ultra_5': { priceId: 'price_1SybYhDcvxD9sOlhJLrgYHFk', cardCount: 5, type: 'ultra', multiplier: 5 },
  'ultra_10': { priceId: 'price_1SybZFDcvxD9sOlhzgqw2tJz', cardCount: 10, type: 'ultra', multiplier: 5 },
  'ultra_20': { priceId: 'price_1SybZQDcvxD9sOlhQ7VYGr7x', cardCount: 20, type: 'ultra', multiplier: 5 },
  'ultra_50': { priceId: 'price_1SybZaDcvxD9sOlhUf146OOs', cardCount: 50, type: 'ultra', multiplier: 5 },
};

// Simple in-memory rate limiter (per function instance)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per user

const checkRateLimit = (userId: string): { allowed: boolean; remaining: number; retryAfter?: number } => {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }
  
  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }
  
  userLimit.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - userLimit.count };
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PACK-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Rate limiting check
    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      logStep("Rate limit exceeded", { userId: user.id, retryAfter: rateLimit.retryAfter });
      return new Response(
        JSON.stringify({ 
          error: 'Too many requests. Please wait before trying again.',
          retryAfter: rateLimit.retryAfter 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Retry-After": String(rateLimit.retryAfter)
          } 
        }
      );
    }
    logStep("Rate limit check passed", { remaining: rateLimit.remaining });

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    // Get origin for success/cancel URLs
    const origin = req.headers.get("origin") || "https://daily-card-quest.lovable.app";

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
      success_url: `${origin}/shop?success=true&pack=${packId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop?canceled=true`,
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
