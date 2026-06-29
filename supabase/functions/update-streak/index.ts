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
      return new Response(JSON.stringify({ error: 'Non autoris├®' }), {
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
    const authResponse = await supabaseAnon.auth.getUser();
    const user = authResponse.data.user;
    const userError = authResponse.error;
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Non autoris├®' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userId = user.id

    let reqBody: any = {};
    const bodyText = await req.text();
    if (bodyText) {
      try { reqBody = JSON.parse(bodyText); } catch (_e) { /* ignore */ }
    }
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
    const TIMER_HOURS = 48; // Changed from 24 to 48h
    const CARDS_PER_STREAK = 2;

    if (!existing) {
      // First card ever: streak goes directly to 1
      const { error } = await supabaseAdmin
        .from('user_streaks')
        .insert({ user_id: userId, current_streak: 1, streak_progress: 0, last_streak_date: today })
      if (error) throw error
      return new Response(JSON.stringify({ success: true, current_streak: 1, streak_progress: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const lastUpdate = new Date(existing.updated_at);
    const diffHours = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

    let newStreak: number = existing.current_streak ?? 0;
    let newProgress: number = existing.streak_progress ?? 0;
    let streakReset = false;

    if (diffHours > TIMER_HOURS) {
      // Timer expired -> reset everything; this flip counts as progress 1
      // Save previous streak to allow restoration
      const prevStreakForRestore = existing.current_streak ?? 0;
      newStreak = 0;
      newProgress = 1;
      streakReset = true;
      
      // Store in Auth user_metadata to allow restore (avoiding schema changes)
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { 
          previous_streak: prevStreakForRestore, 
          restore_expires_at: new Date(now.getTime() + 48*60*60*1000).toISOString() 
        }
      });
    } else {
      newProgress = newProgress + 1;
      if (newProgress >= CARDS_PER_STREAK) {
        newStreak = newStreak + 1;
        newProgress = 0;
      }
    }

    const { error } = await supabaseAdmin
      .from('user_streaks')
      .update({
        current_streak: newStreak,
        streak_progress: newProgress,
        last_streak_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
    if (error) throw error

    // When the streak breaks, clear past winstreak_claims so the user can
    // re-earn the rewards on the new cycle.
    if (streakReset) {
      await supabaseAdmin
        .from('winstreak_claims')
        .delete()
        .eq('user_id', userId)
    }

    return new Response(JSON.stringify({ 
      success: true, 
      current_streak: newStreak, 
      streak_progress: newProgress,
      streak_reset: streakReset 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('update-streak error:', error)
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
