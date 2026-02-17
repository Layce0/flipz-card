import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://daily-card-quest.lovable.app',
  'https://id-preview--292d3511-a5af-422b-bf8b-81ad9534130a.lovable.app',
];

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.some(allowed => origin === allowed)
    ? origin 
    : ALLOWED_ORIGINS[0];
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
};

// Pack configurations with Stripe price IDs
const PACK_CONFIGS: Record<string, { priceId: string; cardCount: number; type: string; multiplier: number }> = {
  // Standard packs
  'standard_5': { priceId: 'price_1Sz28ZDcvxD9sOlh00izyONy', cardCount: 5, type: 'standard', multiplier: 1 },
  'standard_10': { priceId: 'price_1Sz28xDcvxD9sOlhQ0sMekyO', cardCount: 10, type: 'standard', multiplier: 1 },
  'standard_20': { priceId: 'price_1Sz293DcvxD9sOlhYsE7maT9', cardCount: 20, type: 'standard', multiplier: 1 },
  'standard_50': { priceId: 'price_1Sz294DcvxD9sOlhfhz1Fbkl', cardCount: 50, type: 'standard', multiplier: 1 },
  // Lucky packs (x2)
  'lucky_5': { priceId: 'price_1Sz295DcvxD9sOlhVwHJJZnH', cardCount: 5, type: 'lucky', multiplier: 2 },
  'lucky_10': { priceId: 'price_1Sz296DcvxD9sOlhOJfyfK4g', cardCount: 10, type: 'lucky', multiplier: 2 },
  'lucky_20': { priceId: 'price_1Sz297DcvxD9sOlhHY7phoLC', cardCount: 20, type: 'lucky', multiplier: 2 },
  'lucky_50': { priceId: 'price_1Sz297DcvxD9sOlhDJb7ffI4', cardCount: 50, type: 'lucky', multiplier: 2 },
  // Ultra lucky packs (x5)
  'ultra_5': { priceId: 'price_1Sz298DcvxD9sOlhctghXuW6', cardCount: 5, type: 'ultra', multiplier: 5 },
  'ultra_10': { priceId: 'price_1Sz299DcvxD9sOlh8Ldb9wv4', cardCount: 10, type: 'ultra', multiplier: 5 },
  'ultra_20': { priceId: 'price_1Sz29ADcvxD9sOlhl3duA3wD', cardCount: 20, type: 'ultra', multiplier: 5 },
  'ultra_50': { priceId: 'price_1Sz29BDcvxD9sOlhMpuQUioR', cardCount: 50, type: 'ultra', multiplier: 5 },
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
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

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
