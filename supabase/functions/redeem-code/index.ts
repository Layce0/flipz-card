import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://daily-card-quest.lovable.app',
  'https://id-preview--292d3511-a5af-422b-bf8b-81ad9534130a.lovable.app',
  'https://292d3511-a5af-422b-bf8b-81ad9534130a.lovableproject.com',
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
    if (!authHeader) {
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

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

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
      .eq('user_id', user.id)
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
          .insert({ user_id: user.id, card_id: cardId })
        rewardDetails.card_id = cardId
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

      // Determine luck multiplier from active boosts
      let luckMult = 1
      const { data: boosts } = await supabaseAdmin
        .from('code_redemptions')
        .select('code_id, boost_expires_at')
        .eq('user_id', user.id)
        .gt('boost_expires_at', new Date().toISOString())
      if (boosts && boosts.length > 0) {
        const bCodeIds = boosts.map((b: any) => b.code_id)
        const { data: bCodes } = await supabaseAdmin
          .from('reward_codes')
          .select('id, reward_type, reward_config')
          .in('id', bCodeIds)
        ;(bCodes || []).forEach((c: any) => {
          const cfg = c.reward_config as Record<string, any>
          if (c.reward_type === 'boost_luck' && cfg?.multiplier) {
            luckMult = Math.max(luckMult, cfg.multiplier)
          }
        })
      }

      // Pack type probability tables
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

      // Build weighted pool and select cards
      const pool: any[] = []
      allCards.forEach((card: any) => {
        const w = Math.round(weights[card.rarity] ?? 1)
        for (let i = 0; i < w; i++) pool.push(card)
      })

      const selectedCards: any[] = []
      for (let i = 0; i < cardCount; i++) {
        selectedCards.push(pool[Math.floor(Math.random() * pool.length)])
      }

      // Insert cards server-side
      await supabaseAdmin
        .from('user_cards')
        .insert(selectedCards.map((c: any) => ({ user_id: user.id, card_id: c.id })))

      rewardDetails.cards = selectedCards
      rewardDetails.card_count = cardCount
      rewardDetails.pack_type = rewardType
    }

    // Record redemption
    await supabaseAdmin
      .from('code_redemptions')
      .insert({
        code_id: rewardCode.id,
        user_id: user.id,
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
