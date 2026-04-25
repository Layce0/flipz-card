import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://daily-card-quest.lovable.app',
  'https://id-preview--292d3511-a5af-422b-bf8b-81ad9534130a.lovable.app',
  'https://292d3511-a5af-422b-bf8b-81ad9534130a.lovableproject.com',
  'http://localhost',
  'http://localhost:8080',
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

    const { code } = await req.json()
    if (!code || typeof code !== 'string') {
      return new Response(JSON.stringify({ error: 'Code invalide' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const trimmedCode = code.trim()

    // Enforce length limits and character validation
    if (trimmedCode.length === 0 || trimmedCode.length > 50) {
      return new Response(JSON.stringify({ error: 'Code invalide' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!/^[A-Z0-9\-_]+$/i.test(trimmedCode)) {
      return new Response(JSON.stringify({ error: 'Code invalide' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const normalizedCode = trimmedCode.toUpperCase()

    // Find the reward code
    const { data: rewardCode, error: codeError } = await supabaseAdmin
      .from('reward_codes')
      .select('*')
      .eq('code', normalizedCode)
      .eq('is_active', true)
      .single()

    if (codeError || !rewardCode) {
      return new Response(JSON.stringify({ error: 'Code invalide ou expiré' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check expiry
    if (rewardCode.expires_at && new Date(rewardCode.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Ce code a expiré' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check max uses
    if (rewardCode.max_uses) {
      const { count } = await supabaseAdmin
        .from('code_redemptions')
        .select('*', { count: 'exact', head: true })
        .eq('code_id', rewardCode.id)

      if ((count || 0) >= rewardCode.max_uses) {
        return new Response(JSON.stringify({ error: 'Ce code a atteint le nombre maximum d\'utilisations' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // Check if user already redeemed
    const { data: existing } = await supabaseAdmin
      .from('code_redemptions')
      .select('id')
      .eq('code_id', rewardCode.id)
      .eq('user_id', userId)
      .single()

    if (existing) {
      return new Response(JSON.stringify({ error: 'Vous avez déjà utilisé ce code' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const config = rewardCode.reward_config as Record<string, any>
    const rewardType = rewardCode.reward_type
    let boostExpiresAt: string | null = null
    let rewardDetails: Record<string, any> = { type: rewardType }

    // Process reward based on type
    if (rewardType === 'boost_luck' || rewardType === 'boost_pack') {
      // Boosts expire 24h after activation
      const expiry = new Date()
      expiry.setHours(expiry.getHours() + 24)
      boostExpiresAt = expiry.toISOString()
      rewardDetails.boost_expires_at = boostExpiresAt
      rewardDetails.config = config
    } else if (rewardType === 'card') {
      // Give specific card(s) to user
      const cardId = config.card_id
      if (cardId) {
        await supabaseAdmin
          .from('user_cards')
          .insert({ user_id: userId, card_id: cardId })
        rewardDetails.card_id = cardId

        // Fetch full card data for reveal popup
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
      // SERVER-SIDE card generation for pack rewards
      const cardCount = config.card_count || 5

      // Fetch all cards
      const { data: allCards, error: cardsErr } = await supabaseAdmin.from('cards').select('*')
      if (cardsErr || !allCards || allCards.length === 0) {
        return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Determine boosts from active codes + winstreak
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
      let dbPackType = 'code_standard'
      if (rewardType === 'pack_lucky') dbPackType = 'code_lucky'
      else if (rewardType === 'pack_ultra') dbPackType = 'code_ultra'

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

      // Select by rarity weights (independent from catalog size)
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

      // Insert cards server-side
      await supabaseAdmin
        .from('user_cards')
        .insert(selectedCards.map((c: any) => ({ user_id: userId, card_id: c.id })))

      rewardDetails.cards = selectedCards
      rewardDetails.card_count = finalCardCount
      rewardDetails.pack_type = rewardType
    }

    // Record redemption
    await supabaseAdmin
      .from('code_redemptions')
      .insert({
        code_id: rewardCode.id,
        user_id: userId,
        boost_expires_at: boostExpiresAt
      })

    return new Response(JSON.stringify({
      success: true,
      reward: rewardDetails,
      message: rewardType.startsWith('boost')
        ? 'Boost activé pour 24h !'
        : rewardType.startsWith('pack')
        ? 'Pack reçu ! Ouvrez-le pour découvrir vos cartes.'
        : 'Récompense obtenue !'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
