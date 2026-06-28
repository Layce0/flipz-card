import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    // Read body for milestone key (used to track which milestone was claimed)
    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      // ignore
    }
    const milestoneKey: string = body?.milestoneKey ?? 'starter_pack';

    // Server-side idempotency: check user_metadata to avoid double-claiming
    const claimedMilestones: string[] = authUser.user_metadata?.claimed_milestones ?? [];
    if (claimedMilestones.includes(milestoneKey)) {
      return new Response(JSON.stringify({ error: `Milestone '${milestoneKey}' already claimed.` }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 5 cards for milestone reward
    const finalCardCount = 5;

    // Fetch cards
    const { data: cards, error: cardsError } = await supabaseAdmin.from('cards').select('*');
    if (cardsError) throw cardsError;
    if (!cards || cards.length === 0) {
      return new Response(JSON.stringify({ error: 'No card catalog available' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch standard weights
    const { data: probRows, error: probError } = await supabaseAdmin
      .from('pack_probability_tables')
      .select('*')
      .eq('pack_type', 'standard');

    if (probError) throw probError;

    let weights = FALLBACK_WEIGHTS;
    if (probRows && probRows.length > 0) {
      const row = probRows[0];
      weights = {
        common: Number(row.common_rate),
        rare: Number(row.rare_rate),
        epic: Number(row.epic_rate),
        legendary: Number(row.legendary_rate),
      };
    }

    const selectedCards = generateWeightedCards(cards, weights, finalCardCount);

    // Insert cards server-side
    const { error: insertError } = await supabaseAdmin
      .from('user_cards')
      .insert(selectedCards.map((c: any) => ({ user_id: userId, card_id: c.id })));

    if (insertError) throw insertError;

    // Mark this milestone as claimed in user_metadata (server-side idempotency)
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { claimed_milestones: [...claimedMilestones, milestoneKey] }
    });

    return new Response(JSON.stringify({ success: true, cards: selectedCards }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('claim-milestone error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
