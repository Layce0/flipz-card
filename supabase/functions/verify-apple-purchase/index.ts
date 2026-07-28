import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PACK_CONFIGS: Record<string, { cardCount: number; type: string }> = {
  pack_standard_5:  { cardCount: 5,  type: "standard" },
  pack_standard_10: { cardCount: 10, type: "standard" },
  pack_standard_20: { cardCount: 20, type: "standard" },
  pack_standard_50: { cardCount: 50, type: "standard" },
  Pack_lucky_5:     { cardCount: 5,  type: "lucky" },
  pack_lucky_10:    { cardCount: 10, type: "lucky" },
  pack_lucky_20:    { cardCount: 20, type: "lucky" },
  pack_lucky_50:    { cardCount: 50, type: "lucky" },
  pack_ultra_5:     { cardCount: 5,  type: "ultra" },
  pack_ultra_10:    { cardCount: 10, type: "ultra" },
  pack_ultra_20:    { cardCount: 20, type: "ultra" },
  pack_ultra_50:    { cardCount: 50, type: "ultra" },
};

// In-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;

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
  console.log(`[VERIFY-APPLE-PURCHASE] ${step}${detailsStr}`);
};

// Human-readable descriptions for Apple receipt validation status codes.
// https://developer.apple.com/documentation/appstorereceipts/status
const APPLE_STATUS_DESCRIPTIONS: Record<number, string> = {
  0:     'Valid receipt',
  21000: 'App Store could not read the JSON object',
  21002: 'Receipt data malformed or missing',
  21003: 'Receipt could not be authenticated',
  21004: 'Shared secret does not match — check APPLE_SHARED_SECRET',
  21005: 'Receipt server is not currently available',
  21006: 'Receipt is valid but subscription has expired',
  21007: 'Sandbox receipt sent to production — retrying against sandbox',
  21008: 'Production receipt sent to sandbox',
  21009: 'Internal data access error',
  21010: 'User account not found — account may have been deleted',
};

const verifyAppleReceipt = async (receiptData: string): Promise<any> => {
  const sharedSecret = Deno.env.get("APPLE_SHARED_SECRET");
  if (!sharedSecret) throw new Error("APPLE_SHARED_SECRET non configurÚ");

  const verifyPayload = {
    "receipt-data": receiptData,
    password: sharedSecret,
  };

  let verifyUrl = "https://buy.itunes.apple.com/verifyReceipt";
  let res = await fetch(verifyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(verifyPayload),
  });
  let data = await res.json();

  if (data.status === 21007) {
    logStep('Sandbox receipt detected, retrying against sandbox endpoint');
    verifyUrl = 'https://sandbox.itunes.apple.com/verifyReceipt';
    res = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(verifyPayload),
    });
    data = await res.json();
  }

  if (data.status !== 0) {
    const description = APPLE_STATUS_DESCRIPTIONS[data.status] ?? 'Unknown error';
    logStep('Apple receipt validation failed', { status: data.status, description });
    throw new Error(`Erreur validation Apple: status ${data.status} — ${description}`);
  }

  return data.receipt;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const { packId, receiptData, productId, userId, transactionId } = await req.json();

    if (!packId || !receiptData || !productId || !userId || !transactionId) {
      throw new Error("Param├¿tres manquants");
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData.user || userData.user.id !== userId) {
      throw new Error("Utilisateur non authentifi├®");
    }
    logStep("User authenticated", { userId });

    // Rate limiting
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      logStep("Rate limit exceeded", { userId, retryAfter: rateLimit.retryAfter });
      return new Response(
        JSON.stringify({ error: 'Too many requests.', retryAfter: rateLimit.retryAfter }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rateLimit.retryAfter) } }
      );
    }

    // Idempotency check
    const { data: existing } = await supabase
      .from('purchase_transactions')
      .select('id')
      .eq('session_id', transactionId)
      .single();

    if (existing) {
      logStep("Already processed", { transactionId });
      return new Response(JSON.stringify({ success: true, alreadyProcessed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const packConfig = PACK_CONFIGS[productId];
    if (!packConfig) throw new Error("Produit inconnu");

    // Verify purchase with Google Play Developer API + acknowledge
    const receipt = await verifyAppleReceipt(receiptData);
    logStep("Apple purchase verified");

    const inApp = receipt.in_app || [];
    const matchingPurchase = inApp.find((p: any) => p.transaction_id === transactionId && p.product_id === productId);
    
    if (!matchingPurchase) {
       throw new Error("Transaction non trouvÚe dans le reþu Apple");
    }

    const { cardCount, type: packType } = packConfig;

    // Get all cards
    const { data: cards, error: cardsError } = await supabase.from('cards').select('*');
    if (cardsError || !cards || cards.length === 0) throw new Error("Aucune carte disponible");

    // Aggregate boosts (same logic as verify-pack-purchase)
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
    const { data: activeRedemptions } = await supabase
      .from('code_redemptions')
      .select('code_id')
      .eq('user_id', userId)
      .gt('boost_expires_at', now);

    if (activeRedemptions && activeRedemptions.length > 0) {
      const codeIds = activeRedemptions.map((r: any) => r.code_id);
      const { data: codes } = await supabase
        .from('reward_codes')
        .select('id, reward_type, reward_config')
        .in('id', codeIds);

      (codes || []).forEach((code: any) => {
        applyBoost(code.reward_type, code.reward_config as Record<string, any>);
      });
    }

    // 2. Winstreak boosts
    const { data: wsClaims } = await supabase
      .from('winstreak_claims')
      .select('reward_id, boost_expires_at')
      .eq('user_id', userId)
      .gt('boost_expires_at', now);

    if (wsClaims && wsClaims.length > 0) {
      const rewardIds = wsClaims.map((c: any) => c.reward_id);
      const { data: rewards } = await supabase
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
    else if (packType === 'ultra') dbPackType = 'paid_ultra';

    const { data: probRows, error: probError } = await supabase
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
    const normalizedWeights = dbTable[effectiveLuck] ?? dbTable[1] ?? FALLBACK;

    logStep("Calculated weights", { packType, luckMultiplier, effectiveLuck, finalCardCount, normalizedWeights });

    // Rarity-first card generation (same as verify-pack-purchase)
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

    let totalWeight = rarityOrder.reduce((sum, r) => sum + effectiveWeights[r], 0);
    if (totalWeight <= 0) {
      rarityOrder.forEach((r) => {
        if (cardsByRarity[r]?.length) effectiveWeights[r] = 1;
      });
      totalWeight = rarityOrder.reduce((sum, r) => sum + effectiveWeights[r], 0);
    }

    const pickRarity = () => {
      let roll = Math.random() * totalWeight;
      let selected = 'common';
      for (let ri = 0; ri < rarityOrder.length; ri++) {
        const rarity = rarityOrder[ri];
        roll -= effectiveWeights[rarity];
        if (roll <= 0) { selected = rarity; break; }
      }
      return selected;
    };

    const selectedCards: any[] = [];
    for (let i = 0; i < finalCardCount; i++) {
      const rarity = pickRarity();
      const pool = cardsByRarity[rarity] ?? cards;
      selectedCards.push(pool[Math.floor(Math.random() * pool.length)]);
    }

    logStep("Selected cards", { count: selectedCards.length });

    // Insert cards
    const { error: insertError } = await supabase
      .from('user_cards')
      .insert(selectedCards.map((card: any) => ({ user_id: userId, card_id: card.id })));

    if (insertError) throw insertError;

    // Record transaction
    const { error: txError } = await supabase
      .from('purchase_transactions')
      .insert({
        session_id: transactionId,
        user_id: userId,
        card_count: selectedCards.length,
        pack_type: packType,
      });

    if (txError) {
      logStep("Warning: Failed to record transaction", { error: txError.message });
    }

    logStep("Cards added to user collection");

    return new Response(JSON.stringify({
      success: true,
      cards: selectedCards,
      cardCount: selectedCards.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

