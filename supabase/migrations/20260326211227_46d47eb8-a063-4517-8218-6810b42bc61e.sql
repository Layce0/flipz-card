
-- Table for storing pack probability tables (replaces hardcoded LUCK_TABLES, LUCKY_PACK_TABLES, ULTRA_LUCKY_PACK_TABLES)
CREATE TABLE public.pack_probability_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_type text NOT NULL,
  luck_multiplier numeric NOT NULL DEFAULT 1,
  common_rate numeric NOT NULL DEFAULT 0,
  rare_rate numeric NOT NULL DEFAULT 0,
  epic_rate numeric NOT NULL DEFAULT 0,
  legendary_rate numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (pack_type, luck_multiplier)
);

-- Enable RLS
ALTER TABLE public.pack_probability_tables ENABLE ROW LEVEL SECURITY;

-- Anyone can view (needed by edge functions and client)
CREATE POLICY "Anyone can view pack probabilities"
ON public.pack_probability_tables
FOR SELECT
TO public
USING (true);

-- Only admins can manage
CREATE POLICY "Admins can manage pack probabilities"
ON public.pack_probability_tables
FOR ALL
TO public
USING (public.has_role(auth.uid(), 'admin'));

-- Seed with default values
-- Standard pack tables
INSERT INTO public.pack_probability_tables (pack_type, luck_multiplier, common_rate, rare_rate, epic_rate, legendary_rate) VALUES
  ('standard', 1,   60, 25, 12, 3),
  ('standard', 1.5, 30, 47.5, 16.5, 6),
  ('standard', 2,   30, 40, 22, 8),
  ('standard', 2.5, 27, 35.5, 27.5, 10),
  ('standard', 3,   25, 30, 33, 12),
  ('standard', 3.5, 20, 27.5, 38.5, 14),
  ('standard', 4,   10, 30, 44, 16),
  -- Lucky pack tables
  ('lucky', 1,   30, 40, 22, 8),
  ('lucky', 1.5, 20, 35, 33, 12),
  ('lucky', 2,   15, 25, 44, 16),
  ('lucky', 2.5, 10, 15, 55, 20),
  ('lucky', 3,   2.5, 7.5, 66, 24),
  ('lucky', 3.5, 2.5, 2.5, 67, 28),
  ('lucky', 4,   0.5, 0.5, 67, 32),
  -- Ultra Lucky pack tables
  ('ultra_lucky', 1,   10, 15, 55, 20),
  ('ultra_lucky', 1.5, 2.5, 5, 62.5, 30),
  ('ultra_lucky', 2,   1, 1, 58, 40),
  ('ultra_lucky', 2.5, 0.5, 0.5, 49, 50),
  ('ultra_lucky', 3,   0.25, 0.25, 39.5, 60),
  ('ultra_lucky', 3.5, 0.1, 0.1, 29.8, 70),
  ('ultra_lucky', 4,   0.05, 0.05, 19.9, 80);
