import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface GlobalStats {
  total_players: number;
  total_cards_in_circulation: number;
  total_unique_owned_cards: number;
  total_cards_in_game: number;
}

/**
 * Fetches aggregated global stats via a SECURITY DEFINER RPC.
 * Restricted server-side to admins and moderators.
 * Returns counts only — no personal data is exposed.
 */
export const useGlobalStats = (enabled = true) => {
  return useQuery({
    queryKey: ['global-stats'],
    enabled,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<GlobalStats | null> => {
      const { data, error } = await supabase.rpc('get_global_stats');
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      return {
        total_players: Number(row.total_players) || 0,
        total_cards_in_circulation: Number(row.total_cards_in_circulation) || 0,
        total_unique_owned_cards: Number(row.total_unique_owned_cards) || 0,
        total_cards_in_game: Number(row.total_cards_in_game) || 0,
      };
    },
  });
};
