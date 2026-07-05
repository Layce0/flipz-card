import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@18.5.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabaseAnon.auth.getUser();
    const user = userData.user;
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { session_id } = await req.json();
    if (!session_id) {
      return new Response(JSON.stringify({ error: 'session_id manquant' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (
      session.payment_status !== 'paid' ||
      session.metadata?.user_id !== user.id ||
      session.metadata?.purpose !== 'restore_streak'
    ) {
      return new Response(JSON.stringify({ error: 'Paiement non validé' }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prevStreak = user.user_metadata?.previous_streak;
    const restoreExpiresAt = user.user_metadata?.restore_expires_at;
    if (
      prevStreak == null ||
      !restoreExpiresAt ||
      new Date(restoreExpiresAt) < new Date()
    ) {
      return new Response(
        JSON.stringify({ error: 'Aucune série à restaurer ou délai expiré.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from('user_streaks')
      .update({
        current_streak: prevStreak,
        streak_progress: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);
    if (updateError) throw updateError;

    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: { previous_streak: null, restore_expires_at: null },
    });

    return new Response(
      JSON.stringify({ success: true, restored_streak: prevStreak }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('verify-streak-restore error:', error);
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
