import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Rarity } from '@/types/card';

export interface Booster {
  id: string;
  name: string;
  image_url: string | null;
  card_count: number;
  custom_rarities: string[];
  is_active: boolean;
  created_at: string;
}

export interface BoosterCard {
  id: string;
  booster_id: string;
  card_id: string;
  rarity: Rarity;
  drop_rate: number;
  custom_rarity: string | null;
}

const db = supabase as any;

export const useBoosters = () =>
  useQuery({
    queryKey: ['boosters'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await db.from('boosters').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Booster[];
    },
  });

export const useBoosterCards = () =>
  useQuery({
    queryKey: ['booster-cards'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await db.from('booster_cards').select('id, booster_id, card_id, rarity, drop_rate, custom_rarity');
      if (error) throw error;
      return (data || []) as BoosterCard[];
    },
  });
