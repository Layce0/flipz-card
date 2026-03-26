import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PackProbabilityRow {
  id: string;
  pack_type: string;
  luck_multiplier: number;
  common_rate: number;
  rare_rate: number;
  epic_rate: number;
  legendary_rate: number;
  created_at: string;
  updated_at: string;
}

export const PACK_TYPE_GROUPS = [
  {
    label: '🎁 Pack Gratuit',
    types: [
      { value: 'free', label: 'Gratuit' },
    ],
  },
  {
    label: '💰 Packs Payants',
    types: [
      { value: 'paid_standard', label: 'Standard' },
      { value: 'paid_lucky', label: 'Chanceux' },
      { value: 'paid_ultra', label: 'Ultra Légendaire' },
    ],
  },
  {
    label: '🎟️ Packs Code Promo',
    types: [
      { value: 'code_standard', label: 'Standard' },
      { value: 'code_lucky', label: 'Chanceux' },
      { value: 'code_ultra', label: 'Ultra Légendaire' },
    ],
  },
  {
    label: '🔥 Packs Winstreak',
    types: [
      { value: 'winstreak_standard', label: 'Standard' },
      { value: 'winstreak_lucky', label: 'Chanceux' },
      { value: 'winstreak_ultra', label: 'Ultra Légendaire' },
    ],
  },
] as const;

// Flat list for backward compat
export const PACK_TYPES = PACK_TYPE_GROUPS.flatMap(g => [...g.types]) as { value: string; label: string }[];

export const LUCK_MULTIPLIERS = [1, 1.5, 2, 2.5, 3, 3.5, 4] as const;

export const usePackProbabilities = () => {
  return useQuery({
    queryKey: ['pack-probabilities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pack_probability_tables' as any)
        .select('*')
        .order('pack_type')
        .order('luck_multiplier');

      if (error) throw error;
      return (data || []) as unknown as PackProbabilityRow[];
    },
  });
};

export const useUpdatePackProbability = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      common_rate,
      rare_rate,
      epic_rate,
      legendary_rate,
    }: {
      id: string;
      common_rate: number;
      rare_rate: number;
      epic_rate: number;
      legendary_rate: number;
    }) => {
      const { error } = await supabase
        .from('pack_probability_tables' as any)
        .update({
          common_rate,
          rare_rate,
          epic_rate,
          legendary_rate,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pack-probabilities'] });
    },
  });
};

// Build lookup tables from DB rows (for client-side card generation)
export const buildProbabilityTables = (rows: PackProbabilityRow[]) => {
  const tables: Record<string, Record<number, Record<string, number>>> = {};

  rows.forEach((row) => {
    if (!tables[row.pack_type]) tables[row.pack_type] = {};
    tables[row.pack_type][row.luck_multiplier] = {
      common: row.common_rate,
      rare: row.rare_rate,
      epic: row.epic_rate,
      legendary: row.legendary_rate,
    };
  });

  return tables;
};
