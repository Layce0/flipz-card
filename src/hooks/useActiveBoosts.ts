import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ActiveBoost {
  id: string;
  code_id: string;
  boost_expires_at: string;
  reward_type: string;
  reward_config: Record<string, any>;
}

export const useActiveBoosts = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['active-boosts', userId],
    queryFn: async () => {
      if (!userId) return [];

      const now = new Date().toISOString();

      const { data: redemptions, error } = await supabase
        .from('code_redemptions')
        .select('id, code_id, boost_expires_at')
        .eq('user_id', userId)
        .gt('boost_expires_at', now);

      if (error) throw error;
      if (!redemptions || redemptions.length === 0) return [];

      // Fetch the associated reward codes
      const codeIds = redemptions.map(r => r.code_id);
      const { data: codes, error: codesError } = await supabase
        .from('reward_codes')
        .select('id, reward_type, reward_config')
        .in('id', codeIds);

      if (codesError) throw codesError;

      const codeMap = new Map((codes || []).map(c => [c.id, c]));

      return redemptions
        .map(r => {
          const code = codeMap.get(r.code_id);
          if (!code) return null;
          return {
            id: r.id,
            code_id: r.code_id,
            boost_expires_at: r.boost_expires_at!,
            reward_type: code.reward_type,
            reward_config: code.reward_config as Record<string, any>,
          } as ActiveBoost;
        })
        .filter(Boolean) as ActiveBoost[];
    },
    enabled: !!userId,
    refetchInterval: 60000, // Refresh every minute
  });
};
