import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://daily-card-quest.lovable.app',
  'https://id-preview--292d3511-a5af-422b-bf8b-81ad9534130a.lovable.app',
  'https://292d3511-a5af-422b-bf8b-81ad9534130a.lovableproject.com',
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
];

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.some(allowed => origin === allowed)
    ? origin
    : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  };
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
    for (const rarity of rarityOrder) {
      roll -= effectiveWeights[rarity];
      if (roll <= 0) return rarity;
    }
    return 'common';
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
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

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

    const { data: { user: authUser }, error: userError } = await supabaseAnon.auth.getUser();
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

    // Fetch probability tables for "trade" pack type
    const { data: probRows } = await supabaseAdmin
      .from('pack_probability_tables')
      .select('*')
      .eq('pack_type', 'trade');

    let weights = FALLBACK_WEIGHTS;
    if (probRows && probRows.length > 0) {
      const row = probRows.find((r: any) => r.luck_multiplier === 1) ?? probRows[0];
      weights = {
        common: Number(row.common_rate),
        rare: Number(row.rare_rate),
        epic: Number(row.epic_rate),
        legendary: Number(row.legendary_rate),
      };
    }

    // Generate reward cards
    const rewardCards = generateWeightedCards(allCards, weights, config.reward);

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
      rewardCount: config.reward,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Trade error:', error);
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
      status: 500, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' }
    });
  }
});
