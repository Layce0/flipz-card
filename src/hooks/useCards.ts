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
    mutationFn: async ({ count }: { count: number }) => {
      // Fetch cards and drop rates in parallel
      const [cardsResult, ratesResult] = await Promise.all([
        supabase.from('cards').select('*'),
        supabase.from('drop_rates').select('*')
      ]);
      
      if (cardsResult.error) throw cardsResult.error;
      if (ratesResult.error) throw ratesResult.error;
      
      const cards = cardsResult.data || [];
      const dropRates = ratesResult.data || [];
      
      if (cards.length === 0) return [];
      
      // Build rarity weights from database
      const rarityWeights: Record<string, number> = {};
      dropRates.forEach(dr => {
        rarityWeights[dr.rarity] = dr.rate;
      });
      
      // Fallback weights if not in database
      const defaultWeights: Record<string, number> = {
        common: 60, rare: 25, epic: 12, legendary: 3
      };
      
      const weightedCards: GameCard[] = [];
      cards.forEach(card => {
        const weight = rarityWeights[card.rarity] ?? defaultWeights[card.rarity] ?? 1;
        for (let i = 0; i < weight; i++) {
          weightedCards.push(card as GameCard);
        }
      });
      
      const result: GameCard[] = [];
      for (let i = 0; i < count; i++) {
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

// Check if user has collected today's card
export const useHasCollectedToday = (userId: string | undefined, cardId: string | undefined) => {
  return useQuery({
    queryKey: ['has-collected', userId, cardId],
    queryFn: async () => {
      if (!userId || !cardId) return false;
      
      const { data, error } = await supabase
        .from('user_cards')
        .select('id')
        .eq('user_id', userId)
        .eq('card_id', cardId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return !!data;
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
      queryClient.invalidateQueries({ queryKey: ['has-collected'] });
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
