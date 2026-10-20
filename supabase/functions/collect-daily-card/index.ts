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
    const authResult = await userClient.auth.getUser();
    const user = authResult.data.user;
    const userError = authResult.error;

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Determine today's card
    let requestCardId: string | null = null;
    try {
      const body = await req.json();
      requestCardId = body?.cardId ?? null;
    } catch {}

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const period = Math.floor(now.getTime() / (60 * 1000));

    const { data: cards, error: cardsError } = await adminClient
      .from("cards")
      .select("*")
      .is("booster_id", null)
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

    // Seeded random fallback
    const seed = `${today}-${period}-${userId}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0; // force 32-bit
    }
    const index = Math.abs(hash) % cards.length;
    const fallbackTodayCard = cards[index];

    // Priority: always use the exact card the client displayed (cardId from body).
    // Only fall back to seeded random if no valid cardId was provided.
    const matchingCard = requestCardId ? cards.find((c: any) => c.id === requestCardId) : null;
    const finalCard = matchingCard ?? fallbackTodayCard;

    const oneMinuteAgo = new Date(now.getTime() - 1 * 60 * 1000);

    // 2. Atomically claim the cooldown slot in the database.
    const { data: claimed, error: claimError } = await adminClient.rpc("claim_daily_card_cooldown", {
      _user_id: userId,
      _claimed_at: now.toISOString(),
      _cooldown_cutoff: oneMinuteAgo.toISOString(),
    });

    if (claimError) throw claimError;

    if (!claimed) {
      return new Response(
        JSON.stringify({ success: true, code: 'ALREADY_COLLECTED', card: finalCard }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Insert the card now that we hold the exclusive claim
    const { error: insertError } = await adminClient
      .from("user_cards")
      .insert({ user_id: userId, card_id: finalCard.id });

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true, card: finalCard }),
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
