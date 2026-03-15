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

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabaseAnon.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userId = claimsData.claims.sub as string

    const { rewardId, dayNumber } = await req.json()

    // Validate rewardId is a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!rewardId || typeof rewardId !== 'string' || !uuidRegex.test(rewardId)) {
      return new Response(JSON.stringify({ error: 'ID de récompense invalide' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate dayNumber is a positive integer (1-100)
    if (!dayNumber || typeof dayNumber !== 'number' || !Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 100) {
      return new Response(JSON.stringify({ error: 'Numéro de jour invalide (1-100)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verify user streak
    const { data: streak } = await supabaseAdmin
      .from('user_streaks')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!streak || streak.current_streak < dayNumber) {
      return new Response(JSON.stringify({ error: 'Streak insuffisante' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verify today matches streak date
    const today = new Date().toISOString().split('T')[0]
    if (streak.last_streak_date !== today) {
      return new Response(JSON.stringify({ error: 'Streak non mise à jour aujourd\'hui' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verify reward exists
    const { data: reward } = await supabaseAdmin
      .from('winstreak_rewards')
      .select('*')
      .eq('id', rewardId)
      .eq('day_number', dayNumber)
      .single()

    if (!reward) {
      return new Response(JSON.stringify({ error: 'Récompense introuvable' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check not already claimed
    const { data: existingClaim } = await supabaseAdmin
      .from('winstreak_claims')
      .select('id')
      .eq('user_id', userId)
      .eq('day_number', dayNumber)
      .single()

    if (existingClaim) {
      return new Response(JSON.stringify({ error: 'Déjà récupérée' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const config = reward.reward_config as Record<string, any>
    const rewardType = reward.reward_type
    let rewardDetails: Record<string, any> = { type: rewardType }

    // Process reward — same logic as redeem-code
    let boostExpiresAt: string | null = null
    if (rewardType === 'boost_luck' || rewardType === 'boost_pack') {
      const durationHours = config.duration_hours || 24
      boostExpiresAt = new Date(Date.now() + durationHours * 3600000).toISOString()
      rewardDetails.config = config
      rewardDetails.boost_expires_at = boostExpiresAt
      rewardDetails.message = 'Boost activé !'
    } else if (rewardType === 'card') {
      const cardId = config.card_id
      if (cardId) {
        await supabaseAdmin
          .from('user_cards')
          .insert({ user_id: userId, card_id: cardId })
        rewardDetails.card_id = cardId

        // Fetch full card for reveal
        const { data: cardData } = await supabaseAdmin
          .from('cards')
          .select('*')
          .eq('id', cardId)
          .single()
        if (cardData) {
          rewardDetails.cards = [cardData]
        }
      }
    } else if (rewardType === 'pack' || rewardType === 'pack_lucky' || rewardType === 'pack_ultra') {
      const cardCount = config.card_count || 5

      const { data: allCards, error: cardsErr } = await supabaseAdmin.from('cards').select('*')
      if (cardsErr || !allCards || allCards.length === 0) {
        return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Check active boosts (luck + pack) from code_redemptions AND winstreak_claims
      let luckMult = 1
      let bonusCards = 0
      let cardMult = 1
      const boostNow = new Date().toISOString()

      const applyBoost = (rt: string, cfg: Record<string, any>) => {
        if (rt === 'boost_luck' && cfg?.multiplier) luckMult = Math.max(luckMult, cfg.multiplier)
        if (rt === 'boost_pack') {
          if (cfg?.bonus) bonusCards = Math.max(bonusCards, cfg.bonus)
          if (cfg?.multiplier) cardMult = Math.max(cardMult, cfg.multiplier)
        }
      }

      // 1. Code redemption boosts
      const { data: boosts } = await supabaseAdmin
        .from('code_redemptions')
        .select('code_id, boost_expires_at')
        .eq('user_id', userId)
        .gt('boost_expires_at', boostNow)
      if (boosts && boosts.length > 0) {
        const bCodeIds = boosts.map((b: any) => b.code_id)
        const { data: bCodes } = await supabaseAdmin
          .from('reward_codes')
          .select('id, reward_type, reward_config')
          .in('id', bCodeIds)
        ;(bCodes || []).forEach((c: any) => {
          applyBoost(c.reward_type, c.reward_config as Record<string, any>)
        })
      }

      // 2. Winstreak boosts
      const { data: wsBoosts } = await supabaseAdmin
        .from('winstreak_claims')
        .select('reward_id, boost_expires_at')
        .eq('user_id', userId)
        .gt('boost_expires_at', boostNow)
      if (wsBoosts && wsBoosts.length > 0) {
        const rwIds = wsBoosts.map((c: any) => c.reward_id)
        const { data: rwData } = await supabaseAdmin
          .from('winstreak_rewards')
          .select('id, reward_type, reward_config')
          .in('id', rwIds)
        ;(rwData || []).forEach((r: any) => {
          applyBoost(r.reward_type, r.reward_config as Record<string, any>)
        })
      }

      const finalCardCount = Math.round(cardCount * cardMult) + bonusCards

      const LUCK_TABLES: Record<number, Record<string, number>> = {
        1: { common: 60, rare: 25, epic: 12, legendary: 3 },
        1.5: { common: 30, rare: 47.5, epic: 16.5, legendary: 6 },
        2: { common: 30, rare: 40, epic: 22, legendary: 8 },
        2.5: { common: 27, rare: 35.5, epic: 27.5, legendary: 10 },
        3: { common: 25, rare: 30, epic: 33, legendary: 12 },
        3.5: { common: 20, rare: 27.5, epic: 38.5, legendary: 14 },
        4: { common: 10, rare: 30, epic: 44, legendary: 16 },
      }
      const LUCKY_TABLES: Record<number, Record<string, number>> = {
        1: { common: 30, rare: 40, epic: 22, legendary: 8 },
        1.5: { common: 20, rare: 35, epic: 33, legendary: 12 },
        2: { common: 15, rare: 25, epic: 44, legendary: 16 },
        2.5: { common: 10, rare: 15, epic: 55, legendary: 20 },
        3: { common: 2.5, rare: 7.5, epic: 66, legendary: 24 },
        3.5: { common: 2.5, rare: 2.5, epic: 67, legendary: 28 },
        4: { common: 0.5, rare: 0.5, epic: 67, legendary: 32 },
      }
      const ULTRA_TABLES: Record<number, Record<string, number>> = {
        1: { common: 10, rare: 15, epic: 55, legendary: 20 },
        1.5: { common: 2.5, rare: 5, epic: 62.5, legendary: 30 },
        2: { common: 1, rare: 1, epic: 58, legendary: 40 },
        2.5: { common: 0.5, rare: 0.5, epic: 49, legendary: 50 },
        3: { common: 0.25, rare: 0.25, epic: 39.5, legendary: 60 },
        3.5: { common: 0.1, rare: 0.1, epic: 29.8, legendary: 70 },
        4: { common: 0.05, rare: 0.05, epic: 19.9, legendary: 80 },
      }

      const effectiveLuck = luckMult > 1 ? luckMult : 1
      let tableSet = LUCK_TABLES
      if (rewardType === 'pack_lucky') tableSet = LUCKY_TABLES
      else if (rewardType === 'pack_ultra') tableSet = ULTRA_TABLES
      const weights: Record<string, number> = tableSet[effectiveLuck] ?? tableSet[1]

      const pool: any[] = []
      allCards.forEach((card: any) => {
        const w = Math.round(weights[card.rarity] ?? 1)
        for (let i = 0; i < w; i++) pool.push(card)
      })

      const selectedCards: any[] = []
      for (let i = 0; i < finalCardCount; i++) {
        selectedCards.push(pool[Math.floor(Math.random() * pool.length)])
      }

      await supabaseAdmin
        .from('user_cards')
        .insert(selectedCards.map((c: any) => ({ user_id: userId, card_id: c.id })))

      rewardDetails.cards = selectedCards
      rewardDetails.card_count = finalCardCount
      rewardDetails.pack_type = rewardType
    }

    // Record claim
    await supabaseAdmin
      .from('winstreak_claims')
      .insert({
        user_id: userId,
        reward_id: rewardId,
        day_number: dayNumber,
        boost_expires_at: boostExpiresAt
      })

    return new Response(JSON.stringify({
      success: true,
      reward: rewardDetails,
      message: rewardType.startsWith('boost')
        ? 'Boost activé !'
        : rewardType.startsWith('pack') || rewardType === 'card'
        ? 'Récompense reçue !'
        : 'Récompense obtenue !'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('claim-winstreak-reward error:', error)
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})