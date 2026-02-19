import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://daily-card-quest.lovable.app',
  'https://id-preview--292d3511-a5af-422b-bf8b-81ad9534130a.lovable.app',
  'https://292d3511-a5af-422b-bf8b-81ad9534130a.lovableproject.com',
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

// Simple in-memory rate limiter (per function instance)
// For production, consider using Redis/Upstash for distributed rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // 20 requests per minute per user (higher for verification retries)

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
  console.log(`[VERIFY-PACK-PURCHASE] ${step}${detailsStr}`);
};

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const { sessionId } = await req.json();
    if (!sessionId) {
      throw new Error("Session ID is required");
    }

    // Get authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

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

    // Check if session already processed (idempotency check)
    const { data: existingTransaction } = await supabaseClient
      .from('purchase_transactions')
      .select('id, card_count')
      .eq('session_id', sessionId)
      .single();

    if (existingTransaction) {
      logStep("Session already processed", { sessionId });
      return new Response(JSON.stringify({ 
        success: true, 
        alreadyProcessed: true,
        message: "Payment already processed" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    logStep("Session retrieved", { status: session.payment_status, metadata: session.metadata });

    if (session.payment_status !== "paid") {
      throw new Error("Payment not completed");
    }

    // Verify the userId matches
    if (session.metadata?.userId !== user.id) {
      throw new Error("User mismatch");
    }

    const cardCount = parseInt(session.metadata?.cardCount || "0");
    const packType = session.metadata?.packType || "standard";
    const multiplier = parseInt(session.metadata?.multiplier || "1");

    // Get all available cards
    const { data: cards, error: cardsError } = await supabaseClient
      .from('cards')
      .select('*');

    if (cardsError) throw cardsError;
    if (!cards || cards.length === 0) throw new Error("No cards available");

    // Get drop rates and active boosts from database
    const { data: dropRates, error: ratesError } = await supabaseClient
      .from('drop_rates')
      .select('*');

    if (ratesError) throw ratesError;

    // Check for active luck boosts
    let luckMultiplier = 1;
    const now = new Date().toISOString();
    const { data: activeRedemptions } = await supabaseClient
      .from('code_redemptions')
      .select('code_id, boost_expires_at')
      .eq('user_id', user.id)
      .gt('boost_expires_at', now);

    if (activeRedemptions && activeRedemptions.length > 0) {
      const codeIds = activeRedemptions.map((r: any) => r.code_id);
      const { data: codes } = await supabaseClient
        .from('reward_codes')
        .select('id, reward_type, reward_config')
        .in('id', codeIds);

      (codes || []).forEach((code: any) => {
        const config = code.reward_config as Record<string, any>;
        if (code.reward_type === 'boost_luck' && config?.multiplier) {
          luckMultiplier = Math.max(luckMultiplier, config.multiplier);
        }
      });
    }

    // Fixed probability tables for luck boost multipliers
    const LUCK_TABLES: Record<number, Record<string, number>> = {
      1:   { common: 60, rare: 25, epic: 12, legendary: 3 },
      1.5: { common: 30, rare: 47.5, epic: 16.5, legendary: 6 },
      2:   { common: 30, rare: 40, epic: 22, legendary: 8 },
      2.5: { common: 27, rare: 35.5, epic: 27.5, legendary: 10 },
      3:   { common: 25, rare: 30, epic: 33, legendary: 12 },
      3.5: { common: 20, rare: 27.5, epic: 38.5, legendary: 14 },
      4:   { common: 10, rare: 30, epic: 44, legendary: 16 },
    };

    const LUCKY_PACK_TABLES: Record<number, Record<string, number>> = {
      1:   { common: 30, rare: 40, epic: 22, legendary: 8 },
      1.5: { common: 20, rare: 35, epic: 33, legendary: 12 },
      2:   { common: 15, rare: 25, epic: 44, legendary: 16 },
      2.5: { common: 10, rare: 15, epic: 55, legendary: 20 },
      3:   { common: 2.5, rare: 7.5, epic: 66, legendary: 24 },
      3.5: { common: 2.5, rare: 2.5, epic: 67, legendary: 28 },
      4:   { common: 0.5, rare: 0.5, epic: 67, legendary: 32 },
    };

    const ULTRA_LUCKY_PACK_TABLES: Record<number, Record<string, number>> = {
      1:   { common: 10, rare: 15, epic: 55, legendary: 20 },
      1.5: { common: 2.5, rare: 5, epic: 62.5, legendary: 30 },
      2:   { common: 1, rare: 1, epic: 58, legendary: 40 },
      2.5: { common: 0.5, rare: 0.5, epic: 49, legendary: 50 },
      3:   { common: 0.25, rare: 0.25, epic: 39.5, legendary: 60 },
      3.5: { common: 0.1, rare: 0.1, epic: 29.8, legendary: 70 },
      4:   { common: 0.05, rare: 0.05, epic: 19.9, legendary: 80 },
    };

    // Select the right table based on pack type
    const effectiveLuck = luckMultiplier > 1 ? luckMultiplier : 1;
    let tableSet = LUCK_TABLES;
    if (packType === 'lucky') tableSet = LUCKY_PACK_TABLES;
    else if (packType === 'ultra' || packType === 'ultra_lucky') tableSet = ULTRA_LUCKY_PACK_TABLES;

    const normalizedWeights: Record<string, number> = tableSet[effectiveLuck] 
      ?? tableSet[1];

    logStep("Calculated weights", { packType, multiplier, luckMultiplier, effectiveLuck, normalizedWeights });

    // Generate weighted random cards
    const weightedCards: any[] = [];
    cards.forEach(card => {
      const weight = Math.round(normalizedWeights[card.rarity] ?? 1);
      for (let i = 0; i < weight; i++) {
        weightedCards.push(card);
      }
    });

    const selectedCards: any[] = [];
    for (let i = 0; i < cardCount; i++) {
      const randomIndex = Math.floor(Math.random() * weightedCards.length);
      selectedCards.push(weightedCards[randomIndex]);
    }

    logStep("Selected cards", { count: selectedCards.length });

    // Insert cards into user_cards
    const cardsToInsert = selectedCards.map(card => ({
      user_id: user.id,
      card_id: card.id,
    }));

    const { error: insertError } = await supabaseClient
      .from('user_cards')
      .insert(cardsToInsert);

    if (insertError) throw insertError;

    // Record the transaction for idempotency
    const { error: txError } = await supabaseClient
      .from('purchase_transactions')
      .insert({
        session_id: sessionId,
        user_id: user.id,
        card_count: selectedCards.length,
        pack_type: packType
      });

    if (txError) {
      logStep("Warning: Failed to record transaction", { error: txError.message });
    }

    logStep("Cards added to user collection");

    return new Response(JSON.stringify({ 
      success: true, 
      cards: selectedCards,
      cardCount: selectedCards.length 
    }), {
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
