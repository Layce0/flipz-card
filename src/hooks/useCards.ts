import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GameCard, Rarity } from '@/types/card';

// Fetch all profiles (admin - to give cards)
export const useAllProfiles = () => {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, created_at')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as { id: string; email: string; created_at: string }[];
    },
  });
};

// Give a card to a user (admin)
export const useGiveCard = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, cardId }: { userId: string; cardId: string }) => {
      const { error } = await supabase
        .from('user_cards')
        .insert({ user_id: userId, card_id: cardId });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-cards'] });
    },
  });
};

// Fetch all cards
export const useAllCards = () => {
  return useQuery({
    queryKey: ['cards'],
    staleTime: 10 * 60 * 1000, // cards rarely change
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as GameCard[];
    },
  });
};

// Fetch user's collected cards with stacking (count duplicates)
export const useUserCards = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['user-cards', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      // Fetch all user cards in batches to support up to 10000 cards
      let allData: any[] = [];
      let from = 0;
      const batchSize = 1000;
      
      while (true) {
        const { data: batch, error: batchError } = await supabase
          .from('user_cards')
          .select(`
            id,
            obtained_at,
            card_id,
            cards (*)
          `)
          .eq('user_id', userId)
          .range(from, from + batchSize - 1);
        
        if (batchError) throw batchError;
        if (!batch || batch.length === 0) break;
        
        allData = allData.concat(batch);
        if (batch.length < batchSize) break;
        from += batchSize;
      }
      
      const data = allData;
      
      
      
      // Group cards by card_id and count duplicates
      const cardCountMap = new Map<string, { card: GameCard; count: number; obtained_at: string }>();
      
      data.forEach(uc => {
        const cardId = uc.card_id;
        const existing = cardCountMap.get(cardId);
        if (existing) {
          existing.count += 1;
          // Keep the earliest obtained_at
          if (new Date(uc.obtained_at) < new Date(existing.obtained_at)) {
            existing.obtained_at = uc.obtained_at;
          }
        } else {
          cardCountMap.set(cardId, {
            card: uc.cards as unknown as GameCard,
            count: 1,
            obtained_at: uc.obtained_at,
          });
        }
      });
      
      return Array.from(cardCountMap.values()).map(({ card, count, obtained_at }) => ({
        ...card,
        count,
        obtained_at,
      }));
    },
    enabled: !!userId,
  });
};

export type UserCardWithCount = GameCard & { obtained_at: string; count: number };

// Helper function to check if a card is new (not in user's collection)
export const isCardNew = (
  cardId: string,
  userCards: UserCardWithCount[]
): boolean => {
  const existingCard = userCards.find(uc => uc.id === cardId);
  // Card is new if not found OR if count is 0 (shouldn't happen but safety check)
  return !existingCard || existingCard.count === 0;
};

// Fetch user card stats
export const useUserCardStats = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['user-card-stats', userId],
    queryFn: async () => {
      if (!userId) return { total: 0, common: 0, rare: 0, epic: 0, legendary: 0 };
      
      const { data, error } = await supabase
        .from('user_cards')
        .select('card_id, cards(rarity)')
        .eq('user_id', userId);
      
      if (error) throw error;
      
      const stats = {
        total: data?.length || 0,
        common: 0,
        rare: 0,
        epic: 0,
        legendary: 0,
      };
      
      data?.forEach((item: any) => {
        const rarity = item.cards?.rarity as Rarity | undefined;
        if (rarity && rarity in stats) {
          stats[rarity]++;
        }
      });
      
      return stats;
    },
    enabled: !!userId,
  });
};

// Get today's card - random per user based on date + userId
export const useTodayCard = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['today-card', userId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Get all available cards
      const { data: cards, error } = await supabase
        .from('cards')
        .select('*')
        .lte('release_date', today);
      
      if (error) throw error;
      if (!cards || cards.length === 0) return null;
      
      // Use a seeded random based on date + userId to get consistent card per user per day
      const seed = `${today}-${userId || 'anonymous'}`;
      const hash = seed.split('').reduce((acc, char) => {
        return ((acc << 5) - acc) + char.charCodeAt(0);
      }, 0);
      const index = Math.abs(hash) % cards.length;
      
      return cards[index] as GameCard;
    },
  });
};

// Get random cards for pack opening (trade flow) with unified active boosts
export const useRandomCards = () => {
  return useMutation({
    mutationFn: async ({ count, userId, rarityMultiplier = 1, packType = 'standard' }: { count: number; userId?: string; rarityMultiplier?: number; packType?: string }) => {
      // Fetch cards and active boosts (code + winstreak) in parallel
      const nowIso = new Date().toISOString();
      const codeBoostsPromise = userId
        ? supabase
            .from('code_redemptions')
            .select('code_id, boost_expires_at')
            .eq('user_id', userId)
            .gt('boost_expires_at', nowIso)
        : Promise.resolve({ data: [] as any[], error: null });

      const winstreakBoostsPromise = userId
        ? supabase
            .from('winstreak_claims')
            .select('reward_id, boost_expires_at')
            .eq('user_id', userId)
            .gt('boost_expires_at', nowIso)
        : Promise.resolve({ data: [] as any[], error: null });

      const [cardsResult, codeBoostsResult, winstreakBoostsResult] = await Promise.all([
        supabase.from('cards').select('*'),
        codeBoostsPromise,
        winstreakBoostsPromise,
      ]);

      if (cardsResult.error) throw cardsResult.error;
      if (codeBoostsResult.error) throw codeBoostsResult.error;
      if (winstreakBoostsResult.error) throw winstreakBoostsResult.error;

      const cards = cardsResult.data || [];
      if (cards.length === 0) return [];

      // Check for active boosts
      let luckMultiplier = 1;
      let packBonusCards = 0;
      let packMultiplier = 1;

      const applyBoost = (rewardType: string, config: Record<string, any>) => {
        if (rewardType === 'boost_luck' && config?.multiplier) {
          luckMultiplier = Math.max(luckMultiplier, Number(config.multiplier));
        }
        if (rewardType === 'boost_pack') {
          if (config?.bonus) packBonusCards = Math.max(packBonusCards, Number(config.bonus));
          if (config?.multiplier) packMultiplier = Math.max(packMultiplier, Number(config.multiplier));
        }
      };

      const codeIds = (codeBoostsResult.data || []).map((r: any) => r.code_id);
      const rewardIds = (winstreakBoostsResult.data || []).map((r: any) => r.reward_id);

      const [codesResult, rewardsResult] = await Promise.all([
        codeIds.length > 0
          ? supabase
              .from('reward_codes')
              .select('id, reward_type, reward_config')
              .in('id', codeIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        rewardIds.length > 0
          ? supabase
              .from('winstreak_rewards')
              .select('id, reward_type, reward_config')
              .in('id', rewardIds)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      if (codesResult.error) throw codesResult.error;
      if (rewardsResult.error) throw rewardsResult.error;

      (codesResult.data || []).forEach((code: any) => {
        applyBoost(code.reward_type, (code.reward_config as Record<string, any>) || {});
      });

      (rewardsResult.data || []).forEach((reward: any) => {
        applyBoost(reward.reward_type, (reward.reward_config as Record<string, any>) || {});
      });

      // Fixed probability tables for luck boost multipliers
      const LUCK_TABLES: Record<number, Record<string, number>> = {
        1:   { common: 60, rare: 25, epic: 12, legendary: 3 },
        1.5: { common: 30, rare: 47.5, epic: 16.5, legendary: 6 },
        2:   { common: 30, rare: 40, epic: 22, legendary: 8 },
        2.5: { common: 27, rare: 35.5, epic: 27.5, legendary: 10 },
        3:   { common: 25, rare: 30, epic: 33, legendary: 12 },
        3.5: { common: 20, rare: 27.5, epic: 38.5, legendary: 14 },
        4:   { common: 10, rare: 30, epic: 44, legendary: 16 },
      };

      const LUCKY_PACK_TABLES: Record<number, Record<string, number>> = {
        1:   { common: 30, rare: 40, epic: 22, legendary: 8 },
        1.5: { common: 20, rare: 35, epic: 33, legendary: 12 },
        2:   { common: 15, rare: 25, epic: 44, legendary: 16 },
        2.5: { common: 10, rare: 15, epic: 55, legendary: 20 },
        3:   { common: 2.5, rare: 7.5, epic: 66, legendary: 24 },
        3.5: { common: 2.5, rare: 2.5, epic: 67, legendary: 28 },
        4:   { common: 0.5, rare: 0.5, epic: 67, legendary: 32 },
      };

      const ULTRA_LUCKY_PACK_TABLES: Record<number, Record<string, number>> = {
        1:   { common: 10, rare: 15, epic: 55, legendary: 20 },
        1.5: { common: 2.5, rare: 5, epic: 62.5, legendary: 30 },
        2:   { common: 1, rare: 1, epic: 58, legendary: 40 },
        2.5: { common: 0.5, rare: 0.5, epic: 49, legendary: 50 },
        3:   { common: 0.25, rare: 0.25, epic: 39.5, legendary: 60 },
        3.5: { common: 0.1, rare: 0.1, epic: 29.8, legendary: 70 },
        4:   { common: 0.05, rare: 0.05, epic: 19.9, legendary: 80 },
      };

      // Select the right table based on pack type
      const effectiveLuck = luckMultiplier > 1 ? luckMultiplier : 1;
      let tableSet = LUCK_TABLES;
      if (packType === 'lucky') tableSet = LUCKY_PACK_TABLES;
      else if (packType === 'ultra_lucky' || packType === 'ultra') tableSet = ULTRA_LUCKY_PACK_TABLES;

      const adjustedWeights: Record<string, number> = tableSet[effectiveLuck] 
        ?? tableSet[1];

      // Build weighted card pool
      const weightedCards: GameCard[] = [];
      cards.forEach(card => {
        const weight = adjustedWeights[card.rarity] ?? 1;
        for (let i = 0; i < weight; i++) {
          weightedCards.push(card as GameCard);
        }
      });

      // Apply pack bonuses to card count
      const finalCount = Math.max(1, Math.round(count * packMultiplier) + packBonusCards);
      
      const result: GameCard[] = [];
      for (let i = 0; i < finalCount; i++) {
        const randomIndex = Math.floor(Math.random() * weightedCards.length);
        result.push(weightedCards[randomIndex]);
      }
      
      return result;
    },
  });
};

// Delete user cards (for trading)
export const useDeleteUserCards = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, cardId, count }: { userId: string; cardId: string; count: number }) => {
      // Fetch the user's cards with this card_id
      const { data: userCards, error: fetchError } = await supabase
        .from('user_cards')
        .select('id')
        .eq('user_id', userId)
        .eq('card_id', cardId)
        .limit(count);
      
      if (fetchError) throw fetchError;
      if (!userCards || userCards.length < count) {
        throw new Error('Not enough cards to trade');
      }
      
      // Delete the specified number of cards
      const idsToDelete = userCards.slice(0, count).map(uc => uc.id);
      const { error: deleteError } = await supabase
        .from('user_cards')
        .delete()
        .in('id', idsToDelete);
      
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-cards'] });
      queryClient.invalidateQueries({ queryKey: ['user-card-stats'] });
    },
  });
};

// Check if user has collected today's card (today only)
export const useHasCollectedToday = (userId: string | undefined, cardId: string | undefined) => {
  return useQuery({
    queryKey: ['has-collected-today', userId, cardId],
    queryFn: async () => {
      if (!userId || !cardId) return false;
      
      // Get today's date boundaries
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const { data, error } = await supabase
        .from('user_cards')
        .select('id')
        .eq('user_id', userId)
        .eq('card_id', cardId)
        .gte('obtained_at', today.toISOString())
        .lt('obtained_at', tomorrow.toISOString())
        .limit(1);
      
      if (error) throw error;
      return data && data.length > 0;
    },
    enabled: !!userId && !!cardId,
  });
};

// Collect a card
export const useCollectCard = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, cardId }: { userId: string; cardId: string }) => {
      const { error } = await supabase
        .from('user_cards')
        .insert({ user_id: userId, card_id: cardId });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-cards'] });
      queryClient.invalidateQueries({ queryKey: ['has-collected-today'] });
      queryClient.invalidateQueries({ queryKey: ['user-card-stats'] });
    },
  });
};

// Create a card (admin)
export const useCreateCard = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (card: Omit<GameCard, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('cards')
        .insert(card)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    },
  });
};

// Delete a card (admin)
export const useDeleteCard = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (cardId: string) => {
      const { error } = await supabase
        .from('cards')
        .delete()
        .eq('id', cardId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    },
  });
};

// Upload card image
export const useUploadCardImage = () => {
  return useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('card-images')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('card-images')
        .getPublicUrl(fileName);
      
      return publicUrl;
    },
  });
};
