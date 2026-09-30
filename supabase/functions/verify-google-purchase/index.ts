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
  console.log(`[VERIFY-GOOGLE-PURCHASE] ${step}${detailsStr}`);
};

const ANDROID_PACKAGE_NAME = "com.wintak.flipz";

// Convert PEM private key string -> CryptoKey for RS256 signing
const pemToCryptoKey = async (pem: string): Promise<CryptoKey> => {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = Uint8Array.from(atob(cleaned), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "pkcs8",
    binary.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
};

const b64url = (data: Uint8Array | string): string => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let str = "";
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
};

const getGoogleAccessToken = async (): Promise<string> => {
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
  const sa = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = await pemToCryptoKey(sa.private_key);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${b64url(new Uint8Array(sig))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`OAuth token request failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token as string;
};

const verifyAndAcknowledgeGooglePurchase = async (
  productId: string,
  purchaseToken: string
): Promise<void> => {
  const accessToken = await getGoogleAccessToken();
  const baseUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${ANDROID_PACKAGE_NAME}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;

  const verifyRes = await fetch(baseUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!verifyRes.ok) {
    throw new Error(`Google verify failed: ${verifyRes.status} ${await verifyRes.text()}`);
  }
  const purchase = await verifyRes.json();
  logStep("Google purchase fetched", { purchaseState: purchase.purchaseState, acknowledgementState: purchase.acknowledgementState });

  // purchaseState: 0 = purchased, 1 = canceled, 2 = pending
  if (purchase.purchaseState !== 0) {
    throw new Error(`Achat invalide (state=${purchase.purchaseState})`);
  }

  // Acknowledge if needed (0 = not acknowledged, 1 = acknowledged)
  if (purchase.acknowledgementState === 0) {
    const ackRes = await fetch(`${baseUrl}:acknowledge`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    if (!ackRes.ok && ackRes.status !== 204) {
      logStep("Acknowledge warning", { status: ackRes.status, body: await ackRes.text() });
    } else {
      logStep("Purchase acknowledged");
    }
  }
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

    const { packId, purchaseToken, productId, userId } = await req.json();

    if (!packId || !purchaseToken || !productId || !userId) {
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
      .eq('session_id', purchaseToken)
      .single();

    if (existing) {
      logStep("Already processed", { purchaseToken });
      return new Response(JSON.stringify({ success: true, alreadyProcessed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const packConfig = PACK_CONFIGS[productId];
    if (!packConfig) throw new Error("Produit inconnu");

    // Verify purchase with Google Play Developer API + acknowledge
    await verifyAndAcknowledgeGooglePurchase(productId, purchaseToken);
    logStep("Google purchase verified and acknowledged");

    const { cardCount, type: packType } = packConfig;

    // Get all cards
    const { data: cards, error: cardsError } = await supabase.from('cards').select('*').is('booster_id', null);
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
        session_id: purchaseToken,
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
