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

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userId = user.id

    const reqBody = await req.json().catch(() => ({}));
    let today = reqBody.localDate;
    if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
      today = new Date().toISOString().split('T')[0];
    }

    // Fetch current streak using service role
    const { data: existing } = await supabaseAdmin
      .from('user_streaks')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    const now = new Date();

    if (!existing) {
      // First time ever
      const { error } = await supabaseAdmin
        .from('user_streaks')
        .insert({ user_id: userId, current_streak: 1, last_streak_date: today })
      if (error) throw error
      return new Response(JSON.stringify({ success: true, current_streak: 1 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const lastUpdate = new Date(existing.updated_at);
    const diffMs = now.getTime() - lastUpdate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    // Pour ne pas augmenter le Winstreak à CHAQUE carte (puisque la carte est dispo toutes les 12h),
    // on impose un délai minimum de 18h avant de pouvoir faire "+1" sur la série.
    // Si le joueur retourne une carte avant 18h, on ne fait rien (il garde sa série mais ça ne l'augmente pas).
    if (diffHours < 18) {
      return new Response(JSON.stringify({ success: true, current_streak: existing.current_streak }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let newStreak: number
    // Le chrono pour PERDRE la Winstreak est de 32 heures
    if (diffHours <= 32) {
      newStreak = existing.current_streak + 1
    } else {
      // Temps écoulé (> 32h), Winstreak brisée
      newStreak = 1
    }

    const { error } = await supabaseAdmin
      .from('user_streaks')
      .update({ current_streak: newStreak, last_streak_date: today })
      .eq('user_id', userId)
    if (error) throw error

    return new Response(JSON.stringify({ success: true, current_streak: newStreak }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('update-streak error:', error)
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
