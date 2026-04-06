import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const ALLOWED_ORIGINS = [
  'https://daily-card-quest.lovable.app',
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
];

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.some(a => origin === a) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
};

const PACK_CONFIGS: Record<string, { cardCount: number; type: string }> = {
  pack_standard_5:  { cardCount: 5,  type: "standard" },
  pack_standard_10: { cardCount: 10, type: "standard" },
  pack_standard_20: { cardCount: 20, type: "standard" },
  pack_standard_50: { cardCount: 50, type: "standard" },
  pack_lucky_5:     { cardCount: 5,  type: "lucky" },
  pack_lucky_10:    { cardCount: 10, type: "lucky" },
  pack_lucky_20:    { cardCount: 20, type: "lucky" },
  pack_lucky_50:    { cardCount: 50, type: "lucky" },
  pack_ultra_5:     { cardCount: 5,  type: "ultra" },
  pack_ultra_10:    { cardCount: 10, type: "ultra" },
  pack_ultra_20:    { cardCount: 20, type: "ultra" },
  pack_ultra_50:    { cardCount: 50, type: "ultra" },
};

const LUCK_TABLES: Record<number, Record<string, number>> = {
  1: { common: 60, rare: 25, epic: 12, legendary: 3 },
  2: { common: 30, rare: 40, epic: 22, legendary: 8 },
  3: { common: 25, rare: 30, epic: 33, legendary: 12 },
  4: { common: 10, rare: 30, epic: 44, legendary: 16 },
};

const LUCKY_PACK_TABLES: Record<number, Record<string, number>> = {
  1: { common: 30, rare: 40, epic: 22, legendary: 8 },
  2: { common: 15, rare: 25, epic: 44, legendary: 16 },
  3: { common: 2.5, rare: 7.5, epic: 66, legendary: 24 },
  4: { common: 0.5, rare: 0.5, epic: 67, legendary: 32 },
};

const ULTRA_PACK_TABLES: Record<number, Record<string, number>> = {
  1: { common: 10, rare: 15, epic: 55, legendary: 20 },
  2: { common: 1, rare: 1, epic: 58, legendary: 40 },
  3: { common: 0.25, rare: 0.25, epic: 39.5, legendary: 60 },
  4: { common: 0.05, rare: 0.05, epic: 19.9, legendary: 80 },
};

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { packId, purchaseToken, productId, userId } = await req.json();

    if (!packId || !purchaseToken || !productId || !userId) {
      throw new Error("Paramètres manquants");
    }

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData.user || userData.user.id !== userId) {
      throw new Error("Utilisateur non authentifié");
    }

    const { data: existing } = await supabase
      .from('purchase_transactions')
      .select('id')
      .eq('session_id', purchaseToken)
      .single();

    if (existing) {
      return new Response(JSON.stringify({ success: true, alreadyProcessed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const packConfig = PACK_CONFIGS[productId];
    if (!packConfig) throw new Error("Produit inconnu");

    const { cardCount, type: packType } = packConfig;

    const { data: cards, error: cardsError } = await supabase.from('cards').select('*');
    if (cardsError || !cards || cards.length === 0) throw new Error("Aucune carte disponible");

    let luckMultiplier = 1;
    const now = new Date().toISOString();

    const { data: activeRedemptions } = await supabase
      .from('code_redemptions')
      .select('code_id')
      .eq('user_id', userId)
      .gt('boost_expires_at', now);

    if (activeRedemptions && activeRedemptions.length > 0) {
      const codeIds = activeRedemptions.map((r: any) => r.code_id);
      const { data: codes } = await supabase
        .from('reward_codes')
        .select('reward_type, reward_config')
        .in('id', codeIds);

      (codes || []).forEach((code: any) => {
        if (code.reward_type === 'boost_luck' && code.reward_config?.multiplier) {
          luckMultiplier = Math.max(luckMultiplier, code.reward_config.multiplier);
        }
      });
    }

    const effectiveLuck = Math.min(Math.round(luckMultiplier), 4);
    let tableSet = LUCK_TABLES;
    if (packType === 'lucky') tableSet = LUCKY_PACK_TABLES;
    else if (packType === 'ultra') tableSet = ULTRA_PACK_TABLES;

    const weights = tableSet[effectiveLuck] ?? tableSet[1];

    const weightedCards: any[] = [];
    cards.forEach((card: any) => {
      const weight = Math.round(weights[card.rarity] ?? 1);
      for (let i = 0; i < weight; i++) weightedCards.push(card);
    });

    const selectedCards: any[] = [];
    for (let i = 0; i < cardCount; i++) {
      const idx = Math.floor(Math.random() * weightedCards.length);
      selectedCards.push(weightedCards[idx]);
    }

    const { error: insertError } = await supabase
      .from('user_cards')
      .insert(selectedCards.map((card: any) => ({ user_id: userId, card_id: card.id })));

    if (insertError) throw insertError;

    await supabase.from('purchase_transactions').insert({
      session_id: purchaseToken,
      user_id: userId,
      card_count: selectedCards.length,
      pack_type: packType
    });

    return new Response(JSON.stringify({
      success: true,
      cards: selectedCards,
      cardCount: selectedCards.length
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
