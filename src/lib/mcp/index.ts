import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getProfile from "./tools/get-profile";
import getWinstreak from "./tools/get-winstreak";
import getCollectionStats from "./tools/get-collection-stats";
import getRecentCards from "./tools/get-recent-cards";

// The OAuth issuer MUST be the direct Supabase host built from the project ref
// (never SUPABASE_URL). Vite inlines VITE_SUPABASE_PROJECT_ID at build time,
// keeping this module import-safe (no runtime env read at top level).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "flipz-mcp",
  title: "FLIPZ",
  version: "0.1.0",
  instructions:
    "Read-only access to the signed-in user's FLIPZ collection. Use get_profile for account info, get_winstreak for daily streak, get_collection_stats for card totals and rarity breakdown, and get_recent_cards to list the last cards obtained.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getProfile, getWinstreak, getCollectionStats, getRecentCards],
});
