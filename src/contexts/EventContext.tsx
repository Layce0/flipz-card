import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameEvent } from '@/types/event';
import { toast } from 'sonner';

interface EventBoosts {
  rarityBoosts: Record<string, number>;
  globalMultiplier: number;
  bonusCards: number;
  effects: { glow: boolean; flash: boolean; confetti: boolean };
  musicUrls: string[];
  soundEffectUrls: string[];
}

interface EventContextType {
  activeEvents: GameEvent[];
  boosts: EventBoosts;
  isEventActive: boolean;
  currentEvent: GameEvent | null;
}

const defaultBoosts: EventBoosts = {
  rarityBoosts: {},
  globalMultiplier: 1,
  bonusCards: 0,
  effects: { glow: false, flash: false, confetti: false },
  musicUrls: [],
  soundEffectUrls: [],
};

const EventContext = createContext<EventContextType>({
  activeEvents: [],
  boosts: defaultBoosts,
  isEventActive: false,
  currentEvent: null,
});

export const useEventContext = () => useContext(EventContext);

export const EventProvider = ({ children }: { children: ReactNode }) => {
  const [activeEvents, setActiveEvents] = useState<GameEvent[]>([]);

  // Fetch active events on mount
  useEffect(() => {
    const fetchActiveEvents = async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('is_active', true)
        .eq('is_draft', false)
        .lte('start_at', now)
        .gte('end_at', now);
      
      if (!error && data) {
        setActiveEvents(data as GameEvent[]);
      }
    };

    fetchActiveEvents();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('events-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
        },
        async (payload) => {
          console.log('Event change:', payload);
          
          // Refetch active events on any change
          const now = new Date().toISOString();
          const { data } = await supabase
            .from('events')
            .select('*')
            .eq('is_active', true)
            .eq('is_draft', false)
            .lte('start_at', now)
            .gte('end_at', now);
          
          if (data) {
            const newEvents = data as GameEvent[];
            const previousIds = activeEvents.map(e => e.id);
            const newIds = newEvents.map(e => e.id);
            
            // Check for newly activated events
            newEvents.forEach(event => {
              if (!previousIds.includes(event.id)) {
                toast.success(`🎉 Événement lancé: ${event.name}`, {
                  description: event.description || 'Un événement spécial vient de commencer!',
                  duration: 5000,
                });
              }
            });
            
            // Check for deactivated events
            activeEvents.forEach(event => {
              if (!newIds.includes(event.id)) {
                toast.info(`Événement terminé: ${event.name}`, {
                  duration: 3000,
                });
              }
            });
            
            setActiveEvents(newEvents);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Calculate combined boosts from all active events
  const boosts = activeEvents.reduce((acc, event) => {
    // Apply rarity boosts
    const rarityBoosts = (event.rarity_boosts || {}) as Record<string, number>;
    Object.entries(rarityBoosts).forEach(([rarity, multiplier]) => {
      acc.rarityBoosts[rarity] = (acc.rarityBoosts[rarity] || 1) * multiplier;
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

  const isEventActive = activeEvents.length > 0;
  const currentEvent = activeEvents.length > 0 ? activeEvents[0] : null;

  return (
    <EventContext.Provider value={{ activeEvents, boosts, isEventActive, currentEvent }}>
      {children}
    </EventContext.Provider>
  );
};
