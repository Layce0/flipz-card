import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://daily-card-quest.lovable.app',
  'https://id-preview--292d3511-a5af-422b-bf8b-81ad9534130a.lovable.app',
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
      // For all pack types, return pack info so the client opens it via the normal pack reveal flow
      const cardCount = config.card_count || 5
      rewardDetails.card_count = cardCount
      rewardDetails.pack_type = rewardType
      // Cards will be generated client-side through the standard RNG pack opening
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
