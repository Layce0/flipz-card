import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const ALLOWED_ORIGINS = [
  'https://daily-card-quest.lovable.app',
  'https://id-preview--292d3511-a5af-422b-bf8b-81ad9534130a.lovable.app',
  'https://292d3511-a5af-422b-bf8b-81ad9534130a.lovableproject.com',
  'http://localhost',
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

// Pack configurations (must match frontend)
const PACK_CONFIGS: Record<string, { cardCount: number; type: string; multiplier: number }> = {
  'standard_5': { cardCount: 5, type: 'standard', multiplier: 1 },
  'standard_10': { cardCount: 10, type: 'standard', multiplier: 1 },
  'standard_20': { cardCount: 20, type: 'standard', multiplier: 1 },
  'standard_50': { cardCount: 50, type: 'standard', multiplier: 1 },
  'lucky_5': { cardCount: 5, type: 'lucky', multiplier: 2 },
  'lucky_10': { cardCount: 10, type: 'lucky', multiplier: 2 },
  'lucky_20': { cardCount: 20, type: 'lucky', multiplier: 2 },
  'lucky_50': { cardCount: 50, type: 'lucky', multiplier: 2 },
  'ultra_5': { cardCount: 5, type: 'ultra', multiplier: 5 },
  'ultra_10': { cardCount: 10, type: 'ultra', multiplier: 5 },
  'ultra_20': { cardCount: 20, type: 'ultra', multiplier: 5 },
  'ultra_50': { cardCount: 50, type: 'ultra', multiplier: 5 },
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SIMULATE-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const { packId } = await req.json();
    if (!packId || !PACK_CONFIGS[packId]) {
      throw new Error("Invalid pack ID");
    }

    const packConfig = PACK_CONFIGS[packId];

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Verify user has moderator or admin role
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['moderator', 'admin']);

    if (!roleData || roleData.length === 0) {
      throw new Error("Unauthorized: moderator or admin role required");
    }
    logStep("Role verified", { roles: roleData.map((r: any) => r.role) });

    // Get all available cards
    const { data: cards, error: cardsError } = await supabaseClient
      .from('cards')
      .select('*');

    if (cardsError) throw cardsError;
    if (!cards || cards.length === 0) throw new Error("No cards available");

    // Use same RNG logic as verify-pack-purchase
    const cardCount = packConfig.cardCount;
    const packType = packConfig.type;

    // Fetch probability tables from database
    let dbPackType = 'paid_standard';
    if (packType === 'lucky') dbPackType = 'paid_lucky';
    else if (packType === 'ultra' || packType === 'ultra_lucky') dbPackType = 'paid_ultra';

    const { data: probRows, error: probError } = await supabaseClient
      .from('pack_probability_tables')
      .select('*')
      .eq('pack_type', dbPackType)
      .eq('luck_multiplier', 1);

    if (probError) throw probError;

    const weights: Record<string, number> = probRows && probRows.length > 0
      ? {
          common: Number(probRows[0].common_rate),
          rare: Number(probRows[0].rare_rate),
          epic: Number(probRows[0].epic_rate),
          legendary: Number(probRows[0].legendary_rate),
        }
      : { common: 60, rare: 25, epic: 12, legendary: 3 };

    const weightedCards: any[] = [];
    cards.forEach(card => {
      const weight = Math.round(weights[card.rarity] ?? 1);
      for (let i = 0; i < weight; i++) {
        weightedCards.push(card);
      }
    });

    const selectedCards: any[] = [];
    for (let i = 0; i < cardCount; i++) {
      const randomIndex = Math.floor(Math.random() * weightedCards.length);
      selectedCards.push(weightedCards[randomIndex]);
    }

    logStep("Selected cards", { count: selectedCards.length });

    // Insert cards into user_cards
    const cardsToInsert = selectedCards.map(card => ({
      user_id: user.id,
      card_id: card.id,
    }));

    const { error: insertError } = await supabaseClient
      .from('user_cards')
      .insert(cardsToInsert);

    if (insertError) throw insertError;

    // Record simulated transaction
    const simulatedSessionId = `sim_${user.id}_${Date.now()}`;
    await supabaseClient
      .from('purchase_transactions')
      .insert({
        session_id: simulatedSessionId,
        user_id: user.id,
        card_count: selectedCards.length,
        pack_type: packType,
      });

    logStep("Simulated payment complete", { cardCount: selectedCards.length });

    return new Response(JSON.stringify({
      success: true,
      cards: selectedCards,
      cardCount: selectedCards.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
