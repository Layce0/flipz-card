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
  click_target_id: string | null;
  initially_hidden: boolean;
  auto_hide_after_ms: number | null;
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
    mutationFn: async (gif: { url: string; x?: number; y?: number; width?: number; height?: number; page?: string; aspectRatio?: number | null }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const safeWidth = Math.max(8, Math.min(45, Math.round(gif.width ?? 32)));
      const computedHeight = gif.height ?? (gif.aspectRatio && gif.aspectRatio > 0
        ? Math.round(safeWidth / gif.aspectRatio)
        : safeWidth);
      const safeHeight = Math.max(8, Math.min(70, Math.round(computedHeight)));

      const { error } = await supabase.from('global_gifs' as any).insert({
        url: gif.url,
        x: gif.x ?? 10,
        y: gif.y ?? 12,
        width: safeWidth,
        height: safeHeight,
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
    mutationFn: async (gif: { id: string; x?: number; y?: number; width?: number; height?: number; visible?: boolean; page?: string; click_target_id?: string | null; initially_hidden?: boolean; auto_hide_after_ms?: number | null }) => {
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
