import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GameEvent, EventTimelineSegment, EventLog } from '@/types/event';

// Fetch all events (admin only)
export const useAllEvents = () => {
  return useQuery({
    queryKey: ['events', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as GameEvent[];
    },
  });
};

// Fetch active events (for players)
export const useActiveEvents = () => {
  return useQuery({
    queryKey: ['events', 'active'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('is_active', true)
        .eq('is_draft', false)
        .lte('start_at', now)
        .gte('end_at', now);
      
      if (error) throw error;
      return data as GameEvent[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

// Create event
export const useCreateEvent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (event: Omit<GameEvent, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('events')
        .insert({ ...event, created_by: userData.user?.id })
        .select()
        .single();
      
      if (error) throw error;
      
      // Log the action
      await supabase.from('event_logs').insert({
        event_id: data.id,
        action: 'created',
        admin_id: userData.user?.id,
        details: { event_name: event.name },
      });
      
      return data as GameEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
};

// Update event
export const useUpdateEvent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<GameEvent> & { id: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('events')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Log the action
      await supabase.from('event_logs').insert({
        event_id: id,
        action: 'modified',
        admin_id: userData.user?.id,
        details: { changes: Object.keys(updates) },
      });
      
      return data as GameEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
};

// Delete event
export const useDeleteEvent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: userData } = await supabase.auth.getUser();
      
      // Get event name for logging before deletion
      const { data: event } = await supabase
        .from('events')
        .select('name')
        .eq('id', id)
        .single();
      
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // Log the action
      await supabase.from('event_logs').insert({
        event_id: null,
        action: 'deleted',
        admin_id: userData.user?.id,
        details: { event_name: event?.name, deleted_id: id },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
};

// Toggle event activation
export const useToggleEventActive = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('events')
        .update({ is_active, is_draft: false })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Log the action
      await supabase.from('event_logs').insert({
        event_id: id,
        action: is_active ? 'activated' : 'deactivated',
        admin_id: userData.user?.id,
        details: {},
      });
      
      return data as GameEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
};

// Timeline segments
export const useEventSegments = (eventId: string) => {
  return useQuery({
    queryKey: ['event-segments', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_timeline_segments')
        .select('*')
        .eq('event_id', eventId)
        .order('start_offset_seconds', { ascending: true });
      
      if (error) throw error;
      return data as EventTimelineSegment[];
    },
    enabled: !!eventId,
  });
};

export const useCreateSegment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (segment: Omit<EventTimelineSegment, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('event_timeline_segments')
        .insert(segment)
        .select()
        .single();
      
      if (error) throw error;
      return data as EventTimelineSegment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-segments', variables.event_id] });
    },
  });
};

export const useUpdateSegment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, event_id, ...updates }: Partial<EventTimelineSegment> & { id: string; event_id: string }) => {
      const { data, error } = await supabase
        .from('event_timeline_segments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as EventTimelineSegment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-segments', variables.event_id] });
    },
  });
};

export const useDeleteSegment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, event_id }: { id: string; event_id: string }) => {
      const { error } = await supabase
        .from('event_timeline_segments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-segments', variables.event_id] });
    },
  });
};

// Event logs
export const useEventLogs = (limit = 50) => {
  return useQuery({
    queryKey: ['event-logs', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as EventLog[];
    },
  });
};

// Get current event boosts (combines all active events)
export const useCurrentEventBoosts = () => {
  const { data: activeEvents = [] } = useActiveEvents();
  
  const combinedBoosts = activeEvents.reduce((acc, event) => {
    // Apply rarity boosts
    Object.entries(event.rarity_boosts || {}).forEach(([rarity, multiplier]) => {
      acc.rarityBoosts[rarity] = (acc.rarityBoosts[rarity] || 1) * (multiplier as number);
    });
    
    // Apply global multiplier
    acc.globalMultiplier *= event.global_multiplier || 1;
    
    // Add bonus cards
    acc.bonusCards += event.bonus_cards || 0;
    
    // Track visual effects
    if (event.glow_enabled) acc.effects.glow = true;
    if (event.flash_enabled) acc.effects.flash = true;
    if (event.confetti_enabled) acc.effects.confetti = true;
    
    // Track audio
    if (event.music_url) acc.musicUrls.push(event.music_url);
    if (event.sound_effect_url) acc.soundEffectUrls.push(event.sound_effect_url);
    
    return acc;
  }, {
    rarityBoosts: {} as Record<string, number>,
    globalMultiplier: 1,
    bonusCards: 0,
    effects: { glow: false, flash: false, confetti: false },
    musicUrls: [] as string[],
    soundEffectUrls: [] as string[],
  });
  
  return { boosts: combinedBoosts, activeEvents };
};
