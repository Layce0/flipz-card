import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface GlobalGif {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  page: string;
  created_by: string | null;
  created_at: string;
}

export const useGlobalGifs = (adminMode = false) => {
  return useQuery({
    queryKey: ['global-gifs', adminMode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_gifs' as any)
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as GlobalGif[];
    },
  });
};

export const useCreateGif = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gif: { url: string; x?: number; y?: number; width?: number; height?: number; page?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('global_gifs' as any).insert({
        url: gif.url,
        x: gif.x ?? 100,
        y: gif.y ?? 100,
        width: gif.width ?? 150,
        height: gif.height ?? 150,
        created_by: user?.id,
        page: gif.page ?? '/',
      } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['global-gifs'] }),
  });
};

export const useUpdateGif = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gif: { id: string; x?: number; y?: number; width?: number; height?: number; visible?: boolean; page?: string }) => {
      const { id, ...updates } = gif;
      const { error } = await supabase.from('global_gifs' as any).update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['global-gifs'] }),
  });
};

export const useDeleteGif = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('global_gifs' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['global-gifs'] }),
  });
};

export const useUploadGif = () => {
  return useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('global-gifs').upload(fileName, file);
      if (error) throw error;
      const { data } = supabase.storage.from('global-gifs').getPublicUrl(fileName);
      return data.publicUrl;
    },
  });
};
