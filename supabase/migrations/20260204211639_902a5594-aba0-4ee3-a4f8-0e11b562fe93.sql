-- Create event type enum
CREATE TYPE public.event_type AS ENUM ('short', 'long');

-- Create events table
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  type event_type NOT NULL DEFAULT 'short',
  -- Timing
  start_at timestamp with time zone NOT NULL,
  end_at timestamp with time zone NOT NULL,
  duration_minutes integer, -- For short events
  -- Status
  is_active boolean NOT NULL DEFAULT false,
  is_draft boolean NOT NULL DEFAULT true,
  -- Visual effects
  glow_enabled boolean DEFAULT false,
  flash_enabled boolean DEFAULT false,
  confetti_enabled boolean DEFAULT false,
  special_animation text, -- JSON for custom animations
  -- Audio effects
  music_url text,
  sound_effect_url text,
  -- Affected packs
  affects_free_pack boolean DEFAULT false,
  affects_standard_pack boolean DEFAULT false,
  affects_lucky_pack boolean DEFAULT false,
  affects_ultra_pack boolean DEFAULT false,
  -- Boost configuration (stored as JSON)
  rarity_boosts jsonb DEFAULT '{}', -- {"common": 1, "rare": 1.5, "epic": 2, "legendary": 3}
  global_multiplier numeric(4,2) DEFAULT 1.0,
  bonus_cards integer DEFAULT 0,
  -- Stacking limits
  max_stack integer DEFAULT 1,
  -- Metadata
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create event timeline segments for short events
CREATE TABLE public.event_timeline_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  segment_type text NOT NULL, -- 'music', 'visual', 'free_pack'
  start_offset_seconds integer NOT NULL DEFAULT 0,
  duration_seconds integer NOT NULL,
  config jsonb DEFAULT '{}', -- Segment-specific configuration
  created_at timestamp with time zone DEFAULT now()
);

-- Create event logs for auditing
CREATE TABLE public.event_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  action text NOT NULL, -- 'created', 'activated', 'deactivated', 'modified', 'deleted'
  admin_id uuid REFERENCES auth.users(id) NOT NULL,
  details jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_timeline_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_logs ENABLE ROW LEVEL SECURITY;

-- Events policies
CREATE POLICY "Anyone can view active events"
ON public.events FOR SELECT
USING (is_active = true AND is_draft = false);

CREATE POLICY "Admins can view all events"
ON public.events FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create events"
ON public.events FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update events"
ON public.events FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete events"
ON public.events FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Timeline segments policies
CREATE POLICY "Anyone can view segments of active events"
ON public.event_timeline_segments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.events 
    WHERE id = event_id AND is_active = true AND is_draft = false
  )
);

CREATE POLICY "Admins can view all segments"
ON public.event_timeline_segments FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage segments"
ON public.event_timeline_segments FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Event logs policies
CREATE POLICY "Admins can view event logs"
ON public.event_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create event logs"
ON public.event_logs FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX idx_events_active ON public.events(is_active, is_draft);
CREATE INDEX idx_events_timing ON public.events(start_at, end_at);
CREATE INDEX idx_event_timeline_event_id ON public.event_timeline_segments(event_id);
CREATE INDEX idx_event_logs_event_id ON public.event_logs(event_id);
CREATE INDEX idx_event_logs_created_at ON public.event_logs(created_at DESC);

-- Update trigger for events
CREATE TRIGGER update_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();