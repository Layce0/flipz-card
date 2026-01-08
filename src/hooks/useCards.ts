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

// Get random cards for pack opening
export const useRandomCards = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ count }: { count: number }) => {
      const { data: cards, error } = await supabase
        .from('cards')
        .select('*');
      
      if (error) throw error;
      if (!cards || cards.length === 0) return [];
      
      // Pick random cards with rarity weighting
      const rarityWeights: Record<string, number> = {
        common: 60,
        rare: 25,
        epic: 12,
        legendary: 3,
      };
      
      const weightedCards: GameCard[] = [];
      cards.forEach(card => {
        const weight = rarityWeights[card.rarity] || 1;
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
