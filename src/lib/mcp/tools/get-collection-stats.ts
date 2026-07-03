import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "get_collection_stats",
  title: "Get my FLIPZ collection stats",
  description: "Return the signed-in user's collection stats: total cards owned, unique cards, and rarity breakdown.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await supabaseForUser(ctx)
      .from("user_cards")
      .select("card_id, cards:card_id(rarity)")
      .eq("user_id", ctx.getUserId());

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }

    const totalCards = data?.length ?? 0;
    const uniqueIds = new Set<string>();
    const rarityCount: Record<string, number> = {};
    for (const row of data ?? []) {
      uniqueIds.add(row.card_id);
      const r = (row as any).cards?.rarity ?? "unknown";
      rarityCount[r] = (rarityCount[r] ?? 0) + 1;
    }

    const stats = {
      totalCards,
      uniqueCards: uniqueIds.size,
      duplicates: totalCards - uniqueIds.size,
      rarityCount,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(stats) }],
      structuredContent: stats,
    };
  },
});
