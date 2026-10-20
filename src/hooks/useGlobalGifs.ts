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
  // Extended custom properties for text, titles, badges, stats & custom styling
  element_type?: 'media' | 'title' | 'text' | 'badge' | 'stat' | 'button' | 'background' | 'dom_transform';
  content_text?: string;
  font_color?: string;
  bg_color?: string;
  font_size?: number;
  percentage_val?: number;
  z_index?: number;
  action_url?: string | null;
  hide_selector?: string | null;
}

export const useGlobalGifs = (adminMode = false) => {
  return useQuery({
    queryKey: ['global-gifs', adminMode],
    staleTime: adminMode ? 0 : 10 * 60 * 1000,
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
    mutationFn: async (gif: {
      url?: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      page?: string;
      aspectRatio?: number | null;
      element_type?: 'media' | 'title' | 'text' | 'badge' | 'stat' | 'button' | 'background' | 'dom_transform';
      content_text?: string;
      font_color?: string;
      bg_color?: string;
      font_size?: number;
      percentage_val?: number;
      z_index?: number;
      action_url?: string | null;
      hide_selector?: string | null;
      click_target_id?: string | null;
      initially_hidden?: boolean;
      auto_hide_after_ms?: number | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const safeWidth = Math.max(30, Math.round(gif.width ?? 140));
      const computedHeight = gif.height ?? (gif.aspectRatio && gif.aspectRatio > 0
        ? Math.round(safeWidth / gif.aspectRatio)
        : safeWidth);
      const safeHeight = Math.max(30, Math.round(computedHeight));

      const insertData = {
        url: gif.url || '',
        x: gif.x ?? 40,
        y: gif.y ?? 100,
        width: safeWidth,
        height: safeHeight,
        created_by: user?.id,
        page: gif.page ?? '/',
        element_type: gif.element_type || 'media',
        content_text: gif.content_text || '',
        font_color: gif.font_color || '#ffffff',
        bg_color: gif.bg_color || 'transparent',
        font_size: gif.font_size || 16,
        percentage_val: gif.percentage_val || 0,
        z_index: gif.z_index ?? 30,
        action_url: gif.action_url ?? null,
        hide_selector: gif.hide_selector ?? null,
        click_target_id: gif.click_target_id ?? null,
        initially_hidden: gif.initially_hidden ?? false,
        auto_hide_after_ms: gif.auto_hide_after_ms ?? null,
      };

      const { data, error } = await supabase.from('global_gifs' as any).insert(insertData as any).select();
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['global-gifs'] }),
  });
};

export const useUpdateGif = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gif: {
      id: string;
      url?: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      visible?: boolean;
      page?: string;
      click_target_id?: string | null;
      initially_hidden?: boolean;
      auto_hide_after_ms?: number | null;
      element_type?: string;
      content_text?: string;
      font_color?: string;
      bg_color?: string;
      font_size?: number;
      percentage_val?: number;
      z_index?: number;
      action_url?: string | null;
      hide_selector?: string | null;
    }) => {
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
