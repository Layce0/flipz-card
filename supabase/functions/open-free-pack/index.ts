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

const LUCK_TABLES: Record<number, Record<string, number>> = {
  1:   { common: 60, rare: 25, epic: 12, legendary: 3 },
  1.5: { common: 30, rare: 47.5, epic: 16.5, legendary: 6 },
  2:   { common: 30, rare: 40, epic: 22, legendary: 8 },
  2.5: { common: 27, rare: 35.5, epic: 27.5, legendary: 10 },
  3:   { common: 25, rare: 30, epic: 33, legendary: 12 },
  3.5: { common: 20, rare: 27.5, epic: 38.5, legendary: 14 },
  4:   { common: 10, rare: 30, epic: 44, legendary: 16 },
};

function generateWeightedCards(cards: any[], weights: Record<string, number>, count: number): any[] {
  const weightedPool: any[] = [];
  cards.forEach(card => {
    const weight = Math.round(weights[card.rarity] ?? 1);
    for (let i = 0; i < weight; i++) {
      weightedPool.push(card);
    }
  });

  const result: any[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * weightedPool.length);
    result.push(weightedPool[idx]);
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

    // Rate limit
    const rl = checkRateLimit(userId);
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: 'Too many requests', retryAfter: rl.retryAfter }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) }
      });
    }

    // Server-side daily cooldown
    const { data: streakRow } = await supabaseAdmin
      .from('user_streaks')
      .select('last_free_pack_at')
      .eq('user_id', userId)
      .single();

    const now = new Date();
    const lastFreePackAt = streakRow?.last_free_pack_at ? new Date(streakRow.last_free_pack_at) : null;
    if (lastFreePackAt) {
      const diffMs = now.getTime() - lastFreePackAt.getTime();
      if (diffMs < 24 * 3600 * 1000) {
        const retryAfterSec = Math.ceil((24 * 3600 * 1000 - diffMs) / 1000);
        return new Response(JSON.stringify({ error: 'Free pack already claimed today', retryAfter: retryAfterSec }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(retryAfterSec) }
        });
      }
    }

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
    const now = new Date().toISOString();

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
      .gt('boost_expires_at', now);

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
      .gt('boost_expires_at', now);

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

    const effectiveLuck = luckMultiplier > 1 ? luckMultiplier : 1;
    const weights = LUCK_TABLES[effectiveLuck] ?? LUCK_TABLES[1];

    const selectedCards = generateWeightedCards(cards, weights, finalCardCount);

    // Insert cards server-side
    const { error: insertError } = await supabaseAdmin
      .from('user_cards')
      .insert(selectedCards.map((c: any) => ({ user_id: userId, card_id: c.id })));

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true, cards: selectedCards }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('open-free-pack error:', error);
    return new Response(JSON.stringify({ error: 'Server error', detail: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
