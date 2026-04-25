import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate user JWT
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Determine today's card (same seeded logic as client)
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const period = now.getUTCHours() < 12 ? 0 : 1;

    const { data: cards, error: cardsError } = await adminClient
      .from("cards")
      .select("*")
      .lte("release_date", today)
      .order("id");

    if (cardsError) throw cardsError;
    if (!cards || cards.length === 0) {
      return new Response(
        JSON.stringify({ error: "Aucune carte disponible" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Seeded random — must match client logic exactly
    const seed = `${today}-${period}-${userId}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0; // force 32-bit
    }
    const index = Math.abs(hash) % cards.length;
    const todayCard = cards[index];

    // 2. Check if already collected in the current 12h UTC window
    const windowStart = new Date(now);
    windowStart.setUTCHours(period === 0 ? 0 : 12, 0, 0, 0);
    const windowEnd = new Date(windowStart);
    windowEnd.setUTCHours(windowStart.getUTCHours() + 12);

    const { data: existing, error: existError } = await adminClient
      .from("user_cards")
      .select("id")
      .eq("user_id", userId)
      .eq("card_id", todayCard.id)
      .gte("obtained_at", windowStart.toISOString())
      .lt("obtained_at", windowEnd.toISOString())
      .limit(1);

    if (existError) throw existError;

    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({ success: false, code: 'ALREADY_COLLECTED', error: 'ALREADY_COLLECTED', card: todayCard }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Insert the card
    const { error: insertError } = await adminClient
      .from("user_cards")
      .insert({ user_id: userId, card_id: todayCard.id });

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true, card: todayCard }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("collect-daily-card error:", error);
    return new Response(
      JSON.stringify({ error: "Erreur serveur" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
