import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    // Check for active boosts (luck + pack) from codes AND winstreak
    let luckMultiplier = 1;
    let bonusCards = 0;
    let cardMultiplier = 1;
    const now = new Date().toISOString();

    const applyBoost = (rewardType: string, config: Record<string, any>) => {
      if (rewardType === 'boost_luck' && config?.multiplier) {
        luckMultiplier = Math.max(luckMultiplier, config.multiplier);
      }
      if (rewardType === 'boost_pack') {
        if (config?.bonus) bonusCards = Math.max(bonusCards, config.bonus);
        if (config?.multiplier) cardMultiplier = Math.max(cardMultiplier, config.multiplier);
      }
    };

    // 1. Code redemption boosts
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
        applyBoost(code.reward_type, code.reward_config as Record<string, any>);
      });
    }

    // 2. Winstreak boosts
    const { data: wsClaims } = await supabaseClient
      .from('winstreak_claims')
      .select('reward_id, boost_expires_at')
      .eq('user_id', user.id)
      .gt('boost_expires_at', now);

    if (wsClaims && wsClaims.length > 0) {
      const rewardIds = wsClaims.map((c: any) => c.reward_id);
      const { data: rewards } = await supabaseClient
        .from('winstreak_rewards')
        .select('id, reward_type, reward_config')
        .in('id', rewardIds);

      (rewards || []).forEach((r: any) => {
        applyBoost(r.reward_type, r.reward_config as Record<string, any>);
      });
    }

    // Apply pack boost to card count
    const finalCardCount = Math.round(cardCount * cardMultiplier) + bonusCards;

    // Fetch probability tables from database
    let dbPackType = 'paid_standard';
    if (packType === 'lucky') dbPackType = 'paid_lucky';
    else if (packType === 'ultra' || packType === 'ultra_lucky') dbPackType = 'paid_ultra';

    const { data: probRows, error: probError } = await supabaseClient
      .from('pack_probability_tables')
      .select('*')
      .eq('pack_type', dbPackType);

    if (probError) throw probError;

    const dbTable: Record<number, Record<string, number>> = {};
    (probRows || []).forEach((row: any) => {
      dbTable[Number(row.luck_multiplier)] = {
        common: Number(row.common_rate),
        rare: Number(row.rare_rate),
        epic: Number(row.epic_rate),
        legendary: Number(row.legendary_rate),
      };
    });

    const FALLBACK: Record<string, number> = { common: 60, rare: 25, epic: 12, legendary: 3 };
    const effectiveLuck = luckMultiplier > 1 ? luckMultiplier : 1;
    const normalizedWeights: Record<string, number> = dbTable[effectiveLuck]
      ?? dbTable[1]
      ?? FALLBACK;

    logStep("Calculated weights", { packType, multiplier, luckMultiplier, effectiveLuck, finalCardCount, normalizedWeights });

    // Generate random cards by rarity weights (rarity chance independent from card catalog size)
    const rarityOrder = ['common', 'rare', 'epic', 'legendary'];
    const cardsByRarity = cards.reduce((acc: Record<string, any[]>, card: any) => {
      const rarity = card.rarity as string;
      if (!acc[rarity]) acc[rarity] = [];
      acc[rarity].push(card);
      return acc;
    }, {});

    const effectiveWeights: Record<string, number> = {};
    rarityOrder.forEach((rarity) => {
      effectiveWeights[rarity] = cardsByRarity[rarity]?.length ? Math.max(0, Number(normalizedWeights[rarity] ?? 0)) : 0;
    });

    let totalWeight = rarityOrder.reduce((sum, rarity) => sum + effectiveWeights[rarity], 0);
    if (totalWeight <= 0) {
      rarityOrder.forEach((rarity) => {
        if (cardsByRarity[rarity]?.length) effectiveWeights[rarity] = 1;
      });
      totalWeight = rarityOrder.reduce((sum, rarity) => sum + effectiveWeights[rarity], 0);
    }

    const pickRarity = () => {
      let roll = Math.random() * totalWeight;
      for (const rarity of rarityOrder) {
        roll -= effectiveWeights[rarity];
        if (roll <= 0) return rarity;
      }
      return 'common';
    };

    const selectedCards: any[] = [];
    for (let i = 0; i < finalCardCount; i++) {
      const rarity = pickRarity();
      const pool = cardsByRarity[rarity] ?? cards;
      selectedCards.push(pool[Math.floor(Math.random() * pool.length)]);
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
