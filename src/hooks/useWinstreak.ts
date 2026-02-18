import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WinstreakReward {
  id: string;
  day_number: number;
  reward_type: string;
  reward_config: Record<string, any>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserStreak {
  id: string;
  user_id: string;
  current_streak: number;
  last_streak_date: string | null;
  updated_at: string;
}

export const useUserStreak = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['user-streak', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data as UserStreak | null;
    },
    enabled: !!userId,
  });
};

export const useUpdateStreak = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const today = new Date().toISOString().split('T')[0];

      // Fetch current streak
      const { data: existing } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!existing) {
        // First time ever
        const { error } = await supabase
          .from('user_streaks')
          .insert({ user_id: userId, current_streak: 1, last_streak_date: today });
        if (error) throw error;
        return 1;
      }

      // Already updated today
      if (existing.last_streak_date === today) {
        return existing.current_streak;
      }

      // Check if yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      let newStreak: number;
      if (existing.last_streak_date === yesterdayStr) {
        newStreak = existing.current_streak + 1;
      } else {
        // Streak broken
        newStreak = 1;
      }

      const { error } = await supabase
        .from('user_streaks')
        .update({ current_streak: newStreak, last_streak_date: today })
        .eq('user_id', userId);
      if (error) throw error;
      return newStreak;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-streak'] });
    },
  });
};

export const useWinstreakRewards = () => {
  return useQuery({
    queryKey: ['winstreak-rewards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('winstreak_rewards')
        .select('*')
        .order('day_number', { ascending: true });
      if (error) throw error;
      return data as WinstreakReward[];
    },
  });
};

export const useWinstreakClaims = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['winstreak-claims', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('winstreak_claims')
        .select('*')
        .eq('user_id', userId);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
};

export const useClaimWinstreakReward = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, rewardId, dayNumber }: { userId: string; rewardId: string; dayNumber: number }) => {
      const { data, error } = await supabase.functions.invoke('claim-winstreak-reward', {
        body: { rewardId, dayNumber }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['winstreak-claims'] });
      queryClient.invalidateQueries({ queryKey: ['user-cards'] });
      queryClient.invalidateQueries({ queryKey: ['active-boosts'] });
    },
  });
};

// Admin hooks
export const useCreateWinstreakReward = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reward: { day_number: number; reward_type: string; reward_config: Record<string, any>; created_by?: string }) => {
      const { error } = await supabase
        .from('winstreak_rewards')
        .upsert(reward, { onConflict: 'day_number' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['winstreak-rewards'] });
    },
  });
};

export const useDeleteWinstreakReward = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('winstreak_rewards')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['winstreak-rewards'] });
    },
  });
};
