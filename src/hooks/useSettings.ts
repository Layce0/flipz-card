import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type AppSettings = {
  daily_timer_hours: number;
};

const DEFAULT_SETTINGS: AppSettings = {
  daily_timer_hours: 1,
};

const LOCAL_STORAGE_KEY = 'flipz_admin_settings';

export const useSettings = () => {
  return useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!saved) return DEFAULT_SETTINGS;
      try {
        return JSON.parse(saved) as AppSettings;
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    },
  });
};

export const useUpdateSetting = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      let currentSettings = DEFAULT_SETTINGS;
      
      if (saved) {
        try {
          currentSettings = JSON.parse(saved);
        } catch (e) {}
      }
      
      if (key === 'daily_timer_hours') {
        currentSettings.daily_timer_hours = Number(value);
      }
      
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentSettings));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
    },
  });
};
