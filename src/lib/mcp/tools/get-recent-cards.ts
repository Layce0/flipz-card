import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_recent_cards",
  title: "Get my recent FLIPZ cards",
  description: "Return the signed-in user's most recently obtained cards, with name and rarity.",
  inputSchema: {
    limit: z.number().int().describe("Maximum number of recent cards to return (1-25). Defaults to 10.").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const safeLimit = Math.min(Math.max(limit ?? 10, 1), 25);
    const { data, error } = await supabaseForUser(ctx)
      .from("user_cards")
      .select("obtained_at, card_id, cards:card_id(name, rarity)")
      .eq("user_id", ctx.getUserId())
      .order("obtained_at", { ascending: false })
      .limit(safeLimit);

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { cards: data ?? [] },
    };
  },
});
