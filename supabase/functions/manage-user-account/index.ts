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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin
    const supabaseAuth = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user: caller },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await supabaseAuth
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Accès admin requis" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, targetUserId } = await req.json();

    if (!targetUserId || !action) {
      return new Response(
        JSON.stringify({ error: "Paramètres manquants" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prevent admin from deleting themselves
    if (action === "delete" && targetUserId === caller.id) {
      return new Response(
        JSON.stringify({ error: "Vous ne pouvez pas supprimer votre propre compte" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    if (action === "reset") {
      // Reset: delete all user data but keep the account
      await Promise.all([
        admin.from("user_cards").delete().eq("user_id", targetUserId),
        admin.from("winstreak_claims").delete().eq("user_id", targetUserId),
        admin.from("code_redemptions").delete().eq("user_id", targetUserId),
        admin.from("purchase_transactions").delete().eq("user_id", targetUserId),
      ]);

      // Reset streak
      await admin
        .from("user_streaks")
        .update({
          current_streak: 0,
          last_streak_date: null,
          last_free_pack_at: null,
        })
        .eq("user_id", targetUserId);

      return new Response(
        JSON.stringify({ success: true, message: "Compte réinitialisé" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "delete") {
      // Delete all user data first
      await Promise.all([
        admin.from("user_cards").delete().eq("user_id", targetUserId),
        admin.from("winstreak_claims").delete().eq("user_id", targetUserId),
        admin.from("code_redemptions").delete().eq("user_id", targetUserId),
        admin.from("purchase_transactions").delete().eq("user_id", targetUserId),
        admin.from("user_streaks").delete().eq("user_id", targetUserId),
        admin.from("user_roles").delete().eq("user_id", targetUserId),
        admin.from("profiles").delete().eq("id", targetUserId),
      ]);

      // Delete the auth user
      const { error: deleteError } = await admin.auth.admin.deleteUser(
        targetUserId
      );

      if (deleteError) {
        return new Response(
          JSON.stringify({ error: deleteError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Compte supprimé" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Action inconnue" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
