import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ActiveBoost {
  id: string;
  source: 'code' | 'winstreak';
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
      const boosts: ActiveBoost[] = [];

      // 1. Code redemption boosts
      const { data: redemptions, error } = await supabase
        .from('code_redemptions')
        .select('id, code_id, boost_expires_at')
        .eq('user_id', userId)
        .gt('boost_expires_at', now);

      if (error) throw error;

      if (redemptions && redemptions.length > 0) {
        const codeIds = redemptions.map(r => r.code_id);
        const { data: codes, error: codesError } = await supabase
          .from('reward_codes')
          .select('id, reward_type, reward_config')
          .in('id', codeIds);

        if (codesError) throw codesError;

        const codeMap = new Map((codes || []).map(c => [c.id, c]));

        for (const r of redemptions) {
          const code = codeMap.get(r.code_id);
          if (!code) continue;
          boosts.push({
            id: r.id,
            source: 'code',
            boost_expires_at: r.boost_expires_at!,
            reward_type: code.reward_type,
            reward_config: code.reward_config as Record<string, any>,
          });
        }
      }

      // 2. Winstreak boosts
      const { data: wsClaims, error: wsError } = await supabase
        .from('winstreak_claims')
        .select('id, reward_id, boost_expires_at')
        .eq('user_id', userId)
        .gt('boost_expires_at', now);

      if (wsError) throw wsError;

      if (wsClaims && wsClaims.length > 0) {
        const rewardIds = wsClaims.map(c => c.reward_id);
        const { data: rewards, error: rwError } = await supabase
          .from('winstreak_rewards')
          .select('id, reward_type, reward_config')
          .in('id', rewardIds);

        if (rwError) throw rwError;

        const rewardMap = new Map((rewards || []).map(r => [r.id, r]));

        for (const c of wsClaims) {
          const reward = rewardMap.get(c.reward_id);
          if (!reward) continue;
          boosts.push({
            id: c.id,
            source: 'winstreak',
            boost_expires_at: c.boost_expires_at!,
            reward_type: reward.reward_type,
            reward_config: reward.reward_config as Record<string, any>,
          });
        }
      }

      return boosts;
    },
    enabled: !!userId,
    refetchInterval: 60000,
  });
};
