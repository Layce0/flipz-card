import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DropRate {
  id: string;
  rarity: string;
  rate: number;
  created_at: string;
  updated_at: string;
}

// Fetch all drop rates
export const useDropRates = () => {
  return useQuery({
    queryKey: ['drop-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drop_rates')
        .select('*');
      
      if (error) throw error;
      return data as DropRate[];
    },
  });
};

// Update a drop rate (admin only)
export const useUpdateDropRate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ rarity, rate }: { rarity: string; rate: number }) => {
      const { error } = await supabase
        .from('drop_rates')
        .update({ rate })
        .eq('rarity', rarity);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drop-rates'] });
    },
  });
};

// Get drop rates as a map for easy access
export const useDropRatesMap = () => {
  const { data: dropRates = [], isLoading } = useDropRates();
  
  const ratesMap = dropRates.reduce((acc, dr) => {
    acc[dr.rarity] = dr.rate;
    return acc;
  }, {} as Record<string, number>);
  
  return { ratesMap, isLoading };
};
