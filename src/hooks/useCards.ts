import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
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
    staleTime: 5 * 60 * 1000,
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
          // Keep the most recent obtained_at (string compare is faster than Date parsing)
          if (uc.obtained_at > existing.obtained_at) {
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

      // Fetch probability tables from database
      const { data: probRows, error: probError } = await supabase
        .from('pack_probability_tables')
        .select('*');

      if (probError) throw probError;

      // Build lookup: { pack_type: { luck_multiplier: { rarity: rate } } }
      const allTables: Record<string, Record<number, Record<string, number>>> = {};
      ((probRows || []) as any[]).forEach((row: any) => {
        if (!allTables[row.pack_type]) allTables[row.pack_type] = {};
        allTables[row.pack_type][Number(row.luck_multiplier)] = {
          common: Number(row.common_rate),
          rare: Number(row.rare_rate),
          epic: Number(row.epic_rate),
          legendary: Number(row.legendary_rate),
        };
      });

      // Fallback hardcoded table in case DB is empty
      const FALLBACK: Record<string, number> = { common: 60, rare: 25, epic: 12, legendary: 3 };
      const effectiveLuck = luckMultiplier > 1 ? luckMultiplier : 1;

      // Map packType to database pack_type key
      // Client-side useRandomCards is used for trades, which use "free" rates by default
      let tableKey = 'free';
      if (packType === 'standard') tableKey = 'free';
      else if (packType === 'lucky') tableKey = 'free';
      else if (packType === 'ultra_lucky' || packType === 'ultra') tableKey = 'free';
      // Paid/code/winstreak packs use edge functions, not this client-side code

      const tableSet = allTables[tableKey] || {};
      const adjustedWeights: Record<string, number> = tableSet[effectiveLuck]
        ?? tableSet[1]
        ?? FALLBACK;

      // Generate cards by rarity weights (rarity chance independent from card catalog size)
      const cardsByRarity = cards.reduce((acc, card) => {
        const rarity = card.rarity as string;
        if (!acc[rarity]) acc[rarity] = [];
        acc[rarity].push(card as GameCard);
        return acc;
      }, {} as Record<string, GameCard[]>);

      const rarityOrder = ['common', 'rare', 'epic', 'legendary'];
      const effectiveWeights = rarityOrder.reduce((acc, rarity) => {
        acc[rarity] = cardsByRarity[rarity]?.length ? Math.max(0, Number(adjustedWeights[rarity] ?? 0)) : 0;
        return acc;
      }, {} as Record<string, number>);

      let totalWeight = rarityOrder.reduce((sum, rarity) => sum + effectiveWeights[rarity], 0);
      if (totalWeight <= 0) {
        rarityOrder.forEach((rarity) => {
          if (cardsByRarity[rarity]?.length) effectiveWeights[rarity] = 1;
        });
        totalWeight = rarityOrder.reduce((sum, rarity) => sum + effectiveWeights[rarity], 0);
      }

      const pickRarity = () => {
        let roll = Math.random() * totalWeight;
        for (const rarity of rarityOrder) {
          roll -= effectiveWeights[rarity];
          if (roll <= 0) return rarity;
        }
        return 'common';
      };

      // Apply pack bonuses to card count
      const finalCount = Math.max(1, Math.round(count * packMultiplier) + packBonusCards);

      const result: GameCard[] = [];
      for (let i = 0; i < finalCount; i++) {
        const rarity = pickRarity();
        const pool = cardsByRarity[rarity] ?? cards;
        const randomIndex = Math.floor(Math.random() * pool.length);
        result.push(pool[randomIndex]);
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

// Collect a card (daily card via edge function)
export const useCollectCard = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, cardId }: { userId: string; cardId: string }) => {
      const { data, error } = await invokeEdgeFunction('collect-daily-card', {
        body: {},
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-cards'] });
      queryClient.invalidateQueries({ queryKey: ['has-collected-today'] });
      queryClient.invalidateQueries({ queryKey: ['user-card-stats'] });
    },
  });
};

// Trade cards via secure edge function
export const useTradeCards = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ cardId, rarity }: { cardId: string; rarity: string }) => {
      const { data, error } = await invokeEdgeFunction('trade-cards', {
        body: { cardId, rarity },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { success: boolean; cards: GameCard[]; deletedCount: number; rewardCount: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-cards'] });
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
