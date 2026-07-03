import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "get_winstreak",
  title: "Get my FLIPZ winstreak",
  description: "Return the signed-in user's current daily winstreak, progression, and last streak date.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await supabaseForUser(ctx)
      .from("user_streaks")
      .select("current_streak, streak_progress, last_streak_date, last_free_pack_at, updated_at")
      .eq("user_id", ctx.getUserId())
      .maybeSingle();

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? { current_streak: 0 }) }],
      structuredContent: { streak: data ?? null },
    };
  },
});
