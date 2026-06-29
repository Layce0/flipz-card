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
    const authRes = await supabaseAnon.auth.getUser();
    const user = authRes.data.user;
    const userError = authRes.error;
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Non autoris├®' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userId = user.id

    // Check if there is a previous streak to restore
    const prevStreak = user.user_metadata?.previous_streak;
    const restoreExpiresAt = user.user_metadata?.restore_expires_at;

    if (prevStreak == null || !restoreExpiresAt || new Date(restoreExpiresAt) < new Date()) {
       return new Response(JSON.stringify({ error: 'Aucune s├®rie valide ├á restaurer ou d├®lai expir├®.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Restore the streak in the database
    const { error: updateError } = await supabaseAdmin
      .from('user_streaks')
      .update({
        current_streak: prevStreak,
        streak_progress: 0, // Reset progress to avoid aberrant state
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (updateError) throw updateError

    // Clear the metadata so they can't restore again
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { 
        previous_streak: null, 
        restore_expires_at: null 
      }
    });

    return new Response(JSON.stringify({ success: true, restored_streak: prevStreak }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('restore-streak error:', error)
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
