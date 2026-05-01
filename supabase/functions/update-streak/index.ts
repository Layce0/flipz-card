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

    // Already updated today
    if (existing.last_streak_date === today) {
      return new Response(JSON.stringify({ success: true, current_streak: existing.current_streak }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if yesterday
    const [y, m, d] = today.split('-').map(Number);
    const yesterdayDate = new Date(y, m - 1, d - 1);
    const yesterdayStr = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;

    let newStreak: number
    if (existing.last_streak_date === yesterdayStr) {
      newStreak = existing.current_streak + 1
    } else {
      // Streak broken
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
