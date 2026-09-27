import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};


const TRADE_CONFIG: Record<string, { required: number; reward: number; keep: number }> = {
  common:    { required: 6, reward: 2,  keep: 1 },
  rare:      { required: 6, reward: 4,  keep: 1 },
  epic:      { required: 6, reward: 7,  keep: 1 },
  legendary: { required: 4, reward: 15, keep: 1 },
};

const VALID_RARITIES = ['common', 'rare', 'epic', 'legendary'];
const FALLBACK_WEIGHTS: Record<string, number> = { common: 60, rare: 25, epic: 12, legendary: 3 };

function generateWeightedCards(cards: any[], weights: Record<string, number>, count: number): any[] {
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
    let selected = 'common';
    for (let ri = 0; ri < rarityOrder.length; ri++) {
      const rarity = rarityOrder[ri];
      roll -= effectiveWeights[rarity];
      if (roll <= 0) { selected = rarity; break; }
    }
    return selected;
  };

  const result: any[] = [];
  for (let i = 0; i < count; i++) {
    const rarity = pickRarity();
    const pool = cardsByRarity[rarity] ?? cards;
    result.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const tradeAuthResult = await supabaseAnon.auth.getUser();
    const authUser = tradeAuthResult.data.user;
    const userError = tradeAuthResult.error;
    if (userError || !authUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = authUser.id;

    // Parse and validate input
    const body = await req.json();
    const { cardId, rarity } = body;

    if (!cardId || typeof cardId !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid cardId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!rarity || !VALID_RARITIES.includes(rarity)) {
      return new Response(JSON.stringify({ error: 'Missing or invalid rarity' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const config = TRADE_CONFIG[rarity];

    // Verify user owns enough copies of this card
    const { data: ownedCards, error: ownedError } = await supabaseAdmin
      .from('user_cards')
      .select('id')
      .eq('user_id', userId)
      .eq('card_id', cardId);

    if (ownedError) throw ownedError;

    if (!ownedCards || ownedCards.length < config.required) {
      return new Response(JSON.stringify({
        error: 'Not enough cards',
        required: config.required,
        owned: ownedCards?.length ?? 0,
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Delete the required cards (keep some)
    const cardsToDelete = config.required - config.keep;
    const idsToDelete = ownedCards.slice(0, cardsToDelete).map((c: any) => c.id);

    const { error: deleteError } = await supabaseAdmin
      .from('user_cards')
      .delete()
      .in('id', idsToDelete);

    if (deleteError) throw deleteError;

    // Fetch all available cards for random selection
    const { data: allCards, error: cardsError } = await supabaseAdmin.from('cards').select('*');
    if (cardsError) throw cardsError;
    if (!allCards || allCards.length === 0) {
      return new Response(JSON.stringify({ error: 'No cards available' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Active boosts (codes + winstreak)
    let luckMult = 1, bonusCards = 0, cardMult = 1;
    const boostNow = new Date().toISOString();
    const applyBoost = (rt: string, cfg: Record<string, any>) => {
      if (rt === 'boost_luck' && cfg?.multiplier) luckMult = Math.max(luckMult, Number(cfg.multiplier));
      if (rt === 'boost_pack') {
        if (cfg?.bonus) bonusCards = Math.max(bonusCards, Number(cfg.bonus));
        if (cfg?.multiplier) cardMult = Math.max(cardMult, Number(cfg.multiplier));
      }
    };
    const { data: cr } = await supabaseAdmin.from('code_redemptions')
      .select('code_id').eq('user_id', userId).gt('boost_expires_at', boostNow);
    if (cr && cr.length) {
      const { data: codes } = await supabaseAdmin.from('reward_codes')
        .select('reward_type, reward_config').in('id', cr.map((b: any) => b.code_id));
      codes?.forEach((c: any) => applyBoost(c.reward_type, c.reward_config || {}));
    }
    const { data: wc } = await supabaseAdmin.from('winstreak_claims')
      .select('reward_id').eq('user_id', userId).gt('boost_expires_at', boostNow);
    if (wc && wc.length) {
      const { data: rws } = await supabaseAdmin.from('winstreak_rewards')
        .select('reward_type, reward_config').in('id', wc.map((c: any) => c.reward_id));
      rws?.forEach((r: any) => applyBoost(r.reward_type, r.reward_config || {}));
    }

    // Fetch probability tables for "trade" pack type
    const { data: probRows } = await supabaseAdmin
      .from('pack_probability_tables')
      .select('*')
      .eq('pack_type', 'trade');

    let weights = FALLBACK_WEIGHTS;
    if (probRows && probRows.length > 0) {
      const row = probRows.find((r: any) => Number(r.luck_multiplier) === luckMult)
        ?? probRows.find((r: any) => Number(r.luck_multiplier) === 1) ?? probRows[0];
      weights = {
        common: Number(row.common_rate),
        rare: Number(row.rare_rate),
        epic: Number(row.epic_rate),
        legendary: Number(row.legendary_rate),
      };
    }
    if (luckMult > 1 && !probRows?.some((r: any) => Number(r.luck_multiplier) === luckMult)) {
      weights = { ...weights, rare: weights.rare * luckMult, epic: weights.epic * luckMult, legendary: weights.legendary * luckMult };
    }

    const finalReward = Math.round(config.reward * cardMult) + bonusCards;
    const rewardCards = generateWeightedCards(allCards, weights, finalReward);

    // Insert reward cards
    const insertRows = rewardCards.map((card: any) => ({
      user_id: userId,
      card_id: card.id,
    }));

    const { error: insertError } = await supabaseAdmin
      .from('user_cards')
      .insert(insertRows);

    if (insertError) throw insertError;

    return new Response(JSON.stringify({
      success: true,
      cards: rewardCards,
      deletedCount: cardsToDelete,
      rewardCount: finalReward,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Trade error:', error);
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
