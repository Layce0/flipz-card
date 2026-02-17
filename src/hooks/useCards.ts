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
      
      const { data, error } = await supabase
        .from('user_cards')
        .select(`
          id,
          obtained_at,
          card_id,
          cards (*)
        `)
        .eq('user_id', userId);
      
      if (error) throw error;
      
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

// Get random cards for pack opening - now uses database drop rates
export const useRandomCards = () => {
  return useMutation({
    mutationFn: async ({ count, userId, rarityMultiplier = 1 }: { count: number; userId?: string; rarityMultiplier?: number }) => {
      // Fetch cards, drop rates, and active boosts in parallel
      const boostQuery = userId
        ? supabase
            .from('code_redemptions')
            .select('id, code_id, boost_expires_at')
            .eq('user_id', userId)
            .gt('boost_expires_at', new Date().toISOString())
        : null;

      const [cardsResult, ratesResult, boostsResult] = await Promise.all([
        supabase.from('cards').select('*'),
        supabase.from('drop_rates').select('*'),
        boostQuery,
      ]);
      
      if (cardsResult.error) throw cardsResult.error;
      if (ratesResult.error) throw ratesResult.error;
      
      const cards = cardsResult.data || [];
      const dropRates = ratesResult.data || [];
      
      if (cards.length === 0) return [];

      // Check for active boosts
      let luckMultiplier = 1;
      let packBonusCards = 0;
      let packMultiplier = 1;

      if (boostsResult?.data && boostsResult.data.length > 0) {
        const codeIds = boostsResult.data.map((r: any) => r.code_id);
        const { data: codes } = await supabase
          .from('reward_codes')
          .select('id, reward_type, reward_config')
          .in('id', codeIds);

        (codes || []).forEach((code: any) => {
          const config = code.reward_config as Record<string, any>;
          if (code.reward_type === 'boost_luck' && config?.multiplier) {
            luckMultiplier = Math.max(luckMultiplier, config.multiplier);
          }
          if (code.reward_type === 'boost_pack') {
            if (config?.bonus) packBonusCards = Math.max(packBonusCards, config.bonus);
            if (config?.multiplier) packMultiplier = Math.max(packMultiplier, config.multiplier);
          }
        });
      }

      // Combine pack rarity multiplier with luck boost
      const totalRarityMultiplier = rarityMultiplier * luckMultiplier;

      // Build base rarity weights from database
      const rarityWeights: Record<string, number> = {};
      dropRates.forEach(dr => {
        rarityWeights[dr.rarity] = dr.rate;
      });
      
      const defaultWeights: Record<string, number> = {
        common: 60, rare: 25, epic: 12, legendary: 3
      };

      // Calculate adjusted weights so total stays at 100%
      const baseCommon = rarityWeights['common'] ?? defaultWeights['common'];
      const baseRare = rarityWeights['rare'] ?? defaultWeights['rare'];
      const baseEpic = rarityWeights['epic'] ?? defaultWeights['epic'];
      const baseLegendary = rarityWeights['legendary'] ?? defaultWeights['legendary'];
      const baseTotal = baseCommon + baseRare + baseEpic + baseLegendary;

      let finalEpic = baseEpic * totalRarityMultiplier;
      let finalLegendary = baseLegendary * totalRarityMultiplier;

      // Cap boosted rarities so they don't exceed total
      const maxBoosted = baseTotal * 0.9; // cap at 90% of total
      if (finalEpic + finalLegendary > maxBoosted) {
        const scale = maxBoosted / (finalEpic + finalLegendary);
        finalEpic *= scale;
        finalLegendary *= scale;
      }

      // Redistribute surplus proportionally from common and rare
      const surplus = (finalEpic + finalLegendary) - (baseEpic + baseLegendary);
      const commonRareTotal = baseCommon + baseRare;
      let finalCommon = baseCommon - surplus * (baseCommon / commonRareTotal);
      let finalRare = baseRare - surplus * (baseRare / commonRareTotal);

      // Ensure minimums
      finalCommon = Math.max(1, Math.round(finalCommon));
      finalRare = Math.max(1, Math.round(finalRare));
      finalEpic = Math.max(1, Math.round(finalEpic));
      finalLegendary = Math.max(1, Math.round(finalLegendary));

      const adjustedWeights: Record<string, number> = {
        common: finalCommon,
        rare: finalRare,
        epic: finalEpic,
        legendary: finalLegendary,
      };

      // Build weighted card pool
      const weightedCards: GameCard[] = [];
      cards.forEach(card => {
        const weight = adjustedWeights[card.rarity] ?? 1;
        for (let i = 0; i < weight; i++) {
          weightedCards.push(card as GameCard);
        }
      });

      // Apply pack bonuses to card count
      const finalCount = (count * packMultiplier) + packBonusCards;
      
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
