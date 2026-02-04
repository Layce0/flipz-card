export type EventType = 'short' | 'long';

export interface GameEvent {
  id: string;
  name: string;
  description: string | null;
  type: EventType;
  start_at: string;
  end_at: string;
  duration_minutes: number | null;
  is_active: boolean;
  is_draft: boolean;
  // Visual effects
  glow_enabled: boolean;
  flash_enabled: boolean;
  confetti_enabled: boolean;
  special_animation: string | null;
  // Audio effects
  music_url: string | null;
  sound_effect_url: string | null;
  // Affected packs
  affects_free_pack: boolean;
  affects_standard_pack: boolean;
  affects_lucky_pack: boolean;
  affects_ultra_pack: boolean;
  // Boost configuration
  rarity_boosts: Record<string, number>;
  global_multiplier: number;
  bonus_cards: number;
  max_stack: number;
  // Metadata
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventTimelineSegment {
  id: string;
  event_id: string;
  segment_type: 'music' | 'visual' | 'free_pack';
  start_offset_seconds: number;
  duration_seconds: number;
  config: Record<string, any>;
  created_at: string;
}

export interface EventLog {
  id: string;
  event_id: string | null;
  action: 'created' | 'activated' | 'deactivated' | 'modified' | 'deleted';
  admin_id: string;
  details: Record<string, any>;
  created_at: string;
}

export const DEFAULT_RARITY_BOOSTS: Record<string, number> = {
  common: 1,
  rare: 1,
  epic: 1,
  legendary: 1,
};

export const SEGMENT_TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  music: { label: 'Musique', color: 'hsl(280, 70%, 55%)', icon: '🎵' },
  visual: { label: 'Effets visuels', color: 'hsl(45, 90%, 55%)', icon: '✨' },
  free_pack: { label: 'Packs gratuits', color: 'hsl(140, 60%, 50%)', icon: '🎁' },
};
