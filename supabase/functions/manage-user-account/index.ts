import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Non autorisé" }, 401);

    const supabaseAuth = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !caller) return json({ error: "Non autorisé" }, 401);

    const { action, targetUserId, streakValue } = await req.json();
    if (!action) return json({ error: "Paramètres manquants" }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // ---------- Self-service: any authenticated user can delete their own account ----------
    // Required by Apple App Store Review Guideline 5.1.1(v). Must run BEFORE role checks.
    if (action === "delete_self") {
      await Promise.all([
        admin.from("user_cards").delete().eq("user_id", caller.id),
        admin.from("winstreak_claims").delete().eq("user_id", caller.id),
        admin.from("code_redemptions").delete().eq("user_id", caller.id),
        admin.from("purchase_transactions").delete().eq("user_id", caller.id),
        admin.from("user_streaks").delete().eq("user_id", caller.id),
        admin.from("user_roles").delete().eq("user_id", caller.id),
        admin.from("profiles").delete().eq("id", caller.id),
      ]);
      const { error: deleteError } = await admin.auth.admin.deleteUser(caller.id);
      if (deleteError) return json({ error: deleteError.message }, 500);
      return json({ success: true, message: "Compte supprimé" });
    }

    // Role check: admin OR moderator (for all other actions)
    const { data: roles } = await supabaseAuth
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const isAdmin = roleSet.has("admin");
    const isModerator = isAdmin || roleSet.has("moderator");
    if (!isModerator) return json({ error: "Accès modérateur requis" }, 403);

    // ---------- Moderator-only tools ----------
    if (action === "skip_my_daily_timer") {
      const { error } = await admin
        .from("profiles")
        .update({ last_daily_card_at: null })
        .eq("id", caller.id);
      if (error) throw error;
      return json({ success: true, message: "Ton timer quotidien est reset" });
    }

    if (action === "skip_all_daily_timers") {
      if (!isAdmin) return json({ error: "Action admin uniquement" }, 403);
      const { error } = await admin
        .from("profiles")
        .update({ last_daily_card_at: null })
        .not("id", "is", null);
      if (error) throw error;
      return json({ success: true, message: "Timers quotidiens reset pour tous les utilisateurs" });
    }

    if (action === "increment_my_streak") {
      const { data: existing } = await admin
        .from("user_streaks")
        .select("current_streak")
        .eq("user_id", caller.id)
        .maybeSingle();

      const newVal = (existing?.current_streak ?? 0) + 1;
      const today = new Date().toISOString().split("T")[0];

      if (!existing) {
        const { error } = await admin
          .from("user_streaks")
          .insert({ user_id: caller.id, current_streak: newVal, streak_progress: 0, last_streak_date: today });
        if (error) throw error;
      } else {
        const { error } = await admin
          .from("user_streaks")
          .update({
            current_streak: newVal,
            streak_progress: 0,
            last_streak_date: today,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", caller.id);
        if (error) throw error;
      }
      return json({ success: true, message: `Winstreak: ${newVal}`, current_streak: newVal });
    }

    if (action === "set_my_streak") {
      const value = Math.max(0, Math.min(1000, Number(streakValue) || 0));
      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await admin
        .from("user_streaks")
        .select("user_id")
        .eq("user_id", caller.id)
        .maybeSingle();
      if (!existing) {
        const { error } = await admin
          .from("user_streaks")
          .insert({ user_id: caller.id, current_streak: value, streak_progress: 0, last_streak_date: today });
        if (error) throw error;
      } else {
        const { error } = await admin
          .from("user_streaks")
          .update({
            current_streak: value,
            streak_progress: 0,
            last_streak_date: today,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", caller.id);
        if (error) throw error;
      }
      return json({ success: true, message: `Winstreak réglée à ${value}` });
    }

    if (action === "reset_my_streak") {
      await admin
        .from("user_streaks")
        .update({ current_streak: 0, streak_progress: 0, last_streak_date: null, updated_at: new Date().toISOString() })
        .eq("user_id", caller.id);
      await admin.from("winstreak_claims").delete().eq("user_id", caller.id);
      return json({ success: true, message: "Ta winstreak est remise à 0" });
    }

    if (action === "delete_self") {
      // Allow a user to delete their own account
      await Promise.all([
        admin.from("user_cards").delete().eq("user_id", caller.id),
        admin.from("winstreak_claims").delete().eq("user_id", caller.id),
        admin.from("code_redemptions").delete().eq("user_id", caller.id),
        admin.from("purchase_transactions").delete().eq("user_id", caller.id),
        admin.from("user_streaks").delete().eq("user_id", caller.id),
        admin.from("user_roles").delete().eq("user_id", caller.id),
        admin.from("profiles").delete().eq("id", caller.id),
      ]);
      const { error: deleteError } = await admin.auth.admin.deleteUser(caller.id);
      if (deleteError) return json({ error: deleteError.message }, 500);
      return json({ success: true, message: "Compte supprimé" });
    }

    // ---------- Admin-only tools (existing) ----------
    if (!isAdmin) return json({ error: "Accès admin requis" }, 403);
    if (!targetUserId) return json({ error: "Paramètres manquants" }, 400);

    if (action === "delete" && targetUserId === caller.id) {
      return json({ error: "Vous ne pouvez pas supprimer votre propre compte" }, 400);
    }

    if (action === "reset") {
      await Promise.all([
        admin.from("user_cards").delete().eq("user_id", targetUserId),
        admin.from("winstreak_claims").delete().eq("user_id", targetUserId),
        admin.from("code_redemptions").delete().eq("user_id", targetUserId),
        admin.from("purchase_transactions").delete().eq("user_id", targetUserId),
      ]);
      await admin
        .from("user_streaks")
        .update({ current_streak: 0, last_streak_date: null, last_free_pack_at: null })
        .eq("user_id", targetUserId);
      return json({ success: true, message: "Compte réinitialisé" });
    }

    if (action === "delete") {
      await Promise.all([
        admin.from("user_cards").delete().eq("user_id", targetUserId),
        admin.from("winstreak_claims").delete().eq("user_id", targetUserId),
        admin.from("code_redemptions").delete().eq("user_id", targetUserId),
        admin.from("purchase_transactions").delete().eq("user_id", targetUserId),
        admin.from("user_streaks").delete().eq("user_id", targetUserId),
        admin.from("user_roles").delete().eq("user_id", targetUserId),
        admin.from("profiles").delete().eq("id", targetUserId),
      ]);
      const { error: deleteError } = await admin.auth.admin.deleteUser(targetUserId);
      if (deleteError) return json({ error: deleteError.message }, 500);
      return json({ success: true, message: "Compte supprimé" });
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (err) {
    console.error("manage-user-account error:", err);
    return json({ error: "Erreur serveur" }, 500);
  }
});
