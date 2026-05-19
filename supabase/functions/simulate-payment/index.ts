import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Pack configurations (must match frontend)
const PACK_CONFIGS: Record<string, { cardCount: number; type: string; multiplier: number }> = {
  'standard_5': { cardCount: 5, type: 'standard', multiplier: 1 },
  'standard_10': { cardCount: 10, type: 'standard', multiplier: 1 },
  'standard_20': { cardCount: 20, type: 'standard', multiplier: 1 },
  'standard_50': { cardCount: 50, type: 'standard', multiplier: 1 },
  'lucky_5': { cardCount: 5, type: 'lucky', multiplier: 2 },
  'lucky_10': { cardCount: 10, type: 'lucky', multiplier: 2 },
  'lucky_20': { cardCount: 20, type: 'lucky', multiplier: 2 },
  'lucky_50': { cardCount: 50, type: 'lucky', multiplier: 2 },
  'ultra_5': { cardCount: 5, type: 'ultra', multiplier: 5 },
  'ultra_10': { cardCount: 10, type: 'ultra', multiplier: 5 },
  'ultra_20': { cardCount: 20, type: 'ultra', multiplier: 5 },
  'ultra_50': { cardCount: 50, type: 'ultra', multiplier: 5 },
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SIMULATE-PAYMENT] ${step}${detailsStr}`);
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

    const { packId } = await req.json();
    if (!packId || !PACK_CONFIGS[packId]) {
      throw new Error("Invalid pack ID");
    }

    const packConfig = PACK_CONFIGS[packId];

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Verify user has moderator or admin role
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['moderator', 'admin']);

    if (!roleData || roleData.length === 0) {
      throw new Error("Unauthorized: moderator or admin role required");
    }
    logStep("Role verified", { roles: roleData.map((r: any) => r.role) });

    // Get all available cards
    const { data: cards, error: cardsError } = await supabaseClient
      .from('cards')
      .select('*');

    if (cardsError) throw cardsError;
    if (!cards || cards.length === 0) throw new Error("No cards available");

    // Use same RNG logic as verify-pack-purchase
    const cardCount = packConfig.cardCount;
    const packType = packConfig.type;

    // Check for active boosts (luck + pack) from codes AND winstreak
    let luckMultiplier = 1;
    let bonusCards = 0;
    let cardMultiplier = 1;
    const now = new Date().toISOString();

    const applyBoost = (rewardType: string, config: Record<string, any>) => {
      if (rewardType === 'boost_luck' && config?.multiplier) {
        luckMultiplier = Math.max(luckMultiplier, Number(config.multiplier));
      }
      if (rewardType === 'boost_pack') {
        if (config?.bonus) bonusCards = Math.max(bonusCards, Number(config.bonus));
        if (config?.multiplier) cardMultiplier = Math.max(cardMultiplier, Number(config.multiplier));
      }
    };

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
    const weights = dbTable[effectiveLuck] ?? dbTable[1] ?? FALLBACK;

    const rarityOrder = ['common', 'rare', 'epic', 'legendary'];
    const cardsByRarity = cards.reduce((acc: Record<string, any[]>, card: any) => {
      const rarity = card.rarity as string;
      if (!acc[rarity]) acc[rarity] = [];
      acc[rarity].push(card);
      return acc;
    }, {});

    const effectiveWeights: Record<string, number> = {};
    rarityOrder.forEach((rarity) => {
      effectiveWeights[rarity] = cardsByRarity[rarity]?.length ? Math.max(0, Number(weights[rarity] ?? 0)) : 0;
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

    logStep("Selected cards", { count: selectedCards.length, packType: dbPackType, effectiveLuck });

    // Insert cards into user_cards
    const cardsToInsert = selectedCards.map(card => ({
      user_id: user.id,
      card_id: card.id,
    }));

    const { error: insertError } = await supabaseClient
      .from('user_cards')
      .insert(cardsToInsert);

    if (insertError) throw insertError;

    // Record simulated transaction
    const simulatedSessionId = `sim_${user.id}_${Date.now()}`;
    await supabaseClient
      .from('purchase_transactions')
      .insert({
        session_id: simulatedSessionId,
        user_id: user.id,
        card_count: selectedCards.length,
        pack_type: packType,
      });

    logStep("Simulated payment complete", { cardCount: selectedCards.length });

    return new Response(JSON.stringify({
      success: true,
      cards: selectedCards,
      cardCount: selectedCards.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
