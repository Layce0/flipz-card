import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};


// In-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;

const checkRateLimit = (userId: string): { allowed: boolean; retryAfter?: number } => {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetTime - now) / 1000) };
  }

  entry.count++;
  return { allowed: true };
};

// Probability tables are now fetched from the database (pack_probability_tables)
// Fallback in case DB is empty
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

    // Rate limit
    const rl = checkRateLimit(userId);
    if (!rl.allowed) {
      return new Response(JSON.stringify({
        success: false,
        code: 'FREE_PACK_RATE_LIMIT',
        error: 'Too many requests',
        retryAfter: rl.retryAfter,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) }
      });
    }

    // Server-side daily cooldown (strict 24h)
    const { data: streakRow, error: streakError } = await supabaseAdmin
      .from('user_streaks')
      .select('last_free_pack_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (streakError) throw streakError;

    // No daily cooldown — free packs are unlimited

    // Fetch cards
    const { data: cards, error: cardsError } = await supabaseAdmin.from('cards').select('*');
    if (cardsError) throw cardsError;
    if (!cards || cards.length === 0) {
      return new Response(JSON.stringify({ error: 'No cards available' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check for active boosts (luck + pack) from codes AND winstreak
    let luckMultiplier = 1;
    let bonusCards = 0;
    let cardMultiplier = 1;
    const nowIso = new Date().toISOString();

    // Helper to process boost entries
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
    const { data: activeRedemptions } = await supabaseAdmin
      .from('code_redemptions')
      .select('code_id, boost_expires_at')
      .eq('user_id', userId)
      .gt('boost_expires_at', nowIso);

    if (activeRedemptions && activeRedemptions.length > 0) {
      const codeIds = activeRedemptions.map((r: any) => r.code_id);
      const { data: codes } = await supabaseAdmin
        .from('reward_codes')
        .select('id, reward_type, reward_config')
        .in('id', codeIds);

      (codes || []).forEach((code: any) => {
        applyBoost(code.reward_type, code.reward_config as Record<string, any>);
      });
    }

    // 2. Winstreak boosts
    const { data: wsClaims } = await supabaseAdmin
      .from('winstreak_claims')
      .select('reward_id, boost_expires_at')
      .eq('user_id', userId)
      .gt('boost_expires_at', nowIso);

    if (wsClaims && wsClaims.length > 0) {
      const rewardIds = wsClaims.map((c: any) => c.reward_id);
      const { data: rewards } = await supabaseAdmin
        .from('winstreak_rewards')
        .select('id, reward_type, reward_config')
        .in('id', rewardIds);

      (rewards || []).forEach((r: any) => {
        applyBoost(r.reward_type, r.reward_config as Record<string, any>);
      });
    }

    // Apply pack boost to card count
    let finalCardCount = 3; // free pack = 3 cards
    finalCardCount = Math.round(finalCardCount * cardMultiplier) + bonusCards;

    // Fetch probability tables from database
    const { data: probRows, error: probError } = await supabaseAdmin
      .from('pack_probability_tables')
      .select('*')
      .eq('pack_type', 'free');

    if (probError) throw probError;

    // Build lookup: { luck_multiplier: { rarity: rate } }
    const dbTable: Record<number, Record<string, number>> = {};
    (probRows || []).forEach((row: any) => {
      dbTable[Number(row.luck_multiplier)] = {
        common: Number(row.common_rate),
        rare: Number(row.rare_rate),
        epic: Number(row.epic_rate),
        legendary: Number(row.legendary_rate),
      };
    });

    const effectiveLuck = luckMultiplier > 1 ? luckMultiplier : 1;
    const weights = dbTable[effectiveLuck] ?? dbTable[1] ?? FALLBACK_WEIGHTS;

    const selectedCards = generateWeightedCards(cards, weights, finalCardCount);

    // Insert cards server-side
    const { error: insertError } = await supabaseAdmin
      .from('user_cards')
      .insert(selectedCards.map((c: any) => ({ user_id: userId, card_id: c.id })));

    if (insertError) throw insertError;

    // Update daily cooldown timestamp (mandatory, fail hard if it can't persist)
    const { error: streakUpdateError } = await supabaseAdmin
      .from('user_streaks')
      .upsert({ user_id: userId, last_free_pack_at: nowIso }, { onConflict: 'user_id' });

    if (streakUpdateError) throw streakUpdateError;

    return new Response(JSON.stringify({ success: true, cards: selectedCards }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('open-free-pack error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
