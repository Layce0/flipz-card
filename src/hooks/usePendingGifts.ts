import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GameCard } from '@/types/card';

export interface PendingGift {
  id: string;
  card: GameCard;
  gifted_by: string | null;
  created_at: string;
}

export const usePendingGifts = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['pending-gifts', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('pending_gifts')
        .select('id, card_id, gifted_by, created_at, cards(*)')
        .eq('user_id', userId)
        .eq('seen', false)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []).map((g: any) => ({
        id: g.id,
        card: g.cards as unknown as GameCard,
        gifted_by: g.gifted_by,
        created_at: g.created_at,
      })) as PendingGift[];
    },
    enabled: !!userId,
    refetchInterval: 30000, // poll every 30s
  });
};

export const useMarkGiftSeen = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (giftIds: string[]) => {
      const { error } = await supabase
        .from('pending_gifts')
        .update({ seen: true })
        .in('id', giftIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-gifts'] });
    },
  });
};
