import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
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

    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userId = user.id

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

    // v2: No 24h liveness check here — the streak counter itself enforces validity.
    // If current_streak >= dayNumber, the reward is claimable.

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

      // Fetch probability tables from database
      let dbPackType = 'winstreak_standard'
      if (rewardType === 'pack_lucky') dbPackType = 'winstreak_lucky'
      else if (rewardType === 'pack_ultra') dbPackType = 'winstreak_ultra'

      const { data: probRows, error: probError } = await supabaseAdmin
        .from('pack_probability_tables')
        .select('*')
        .eq('pack_type', dbPackType)

      if (probError) throw probError

      const dbTable: Record<number, Record<string, number>> = {}
      ;(probRows || []).forEach((row: any) => {
        dbTable[Number(row.luck_multiplier)] = {
          common: Number(row.common_rate),
          rare: Number(row.rare_rate),
          epic: Number(row.epic_rate),
          legendary: Number(row.legendary_rate),
        }
      })

      const FALLBACK: Record<string, number> = { common: 60, rare: 25, epic: 12, legendary: 3 }
      const effectiveLuck = luckMult > 1 ? luckMult : 1
      const weights: Record<string, number> = dbTable[effectiveLuck] ?? dbTable[1] ?? FALLBACK

      const rarityOrder = ['common', 'rare', 'epic', 'legendary']
      const cardsByRarity = allCards.reduce((acc: Record<string, any[]>, card: any) => {
        const rarity = card.rarity as string
        if (!acc[rarity]) acc[rarity] = []
        acc[rarity].push(card)
        return acc
      }, {})

      const effectiveWeights: Record<string, number> = {}
      rarityOrder.forEach((rarity) => {
        effectiveWeights[rarity] = cardsByRarity[rarity]?.length ? Math.max(0, Number(weights[rarity] ?? 0)) : 0
      })

      let totalWeight = rarityOrder.reduce((sum, rarity) => sum + effectiveWeights[rarity], 0)
      if (totalWeight <= 0) {
        rarityOrder.forEach((rarity) => {
          if (cardsByRarity[rarity]?.length) effectiveWeights[rarity] = 1
        })
        totalWeight = rarityOrder.reduce((sum, rarity) => sum + effectiveWeights[rarity], 0)
      }

      const pickRarity = () => {
        let roll = Math.random() * totalWeight
        for (const rarity of rarityOrder) {
          roll -= effectiveWeights[rarity]
          if (roll <= 0) return rarity
        }
        return 'common'
      }

      const selectedCards: any[] = []
      for (let i = 0; i < finalCardCount; i++) {
        const rarity = pickRarity()
        const pool = cardsByRarity[rarity] ?? allCards
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