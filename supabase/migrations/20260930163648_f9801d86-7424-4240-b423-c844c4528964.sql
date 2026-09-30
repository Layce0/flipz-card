CREATE TABLE public.boosters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_url text,
  card_count integer NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.boosters TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.boosters TO authenticated;
GRANT ALL ON public.boosters TO service_role;
ALTER TABLE public.boosters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view boosters" ON public.boosters FOR SELECT USING (true);
CREATE POLICY "Admins manage boosters" ON public.boosters FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER update_boosters_updated_at BEFORE UPDATE ON public.boosters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.booster_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booster_id uuid NOT NULL REFERENCES public.boosters(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  rarity card_rarity NOT NULL DEFAULT 'common',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booster_id, card_id)
);
GRANT SELECT ON public.booster_cards TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.booster_cards TO authenticated;
GRANT ALL ON public.booster_cards TO service_role;
ALTER TABLE public.booster_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view booster cards" ON public.booster_cards FOR SELECT USING (true);
CREATE POLICY "Admins manage booster cards" ON public.booster_cards FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

ALTER TABLE public.cards ADD COLUMN booster_id uuid REFERENCES public.boosters(id) ON DELETE CASCADE;
CREATE INDEX idx_cards_booster_id ON public.cards(booster_id);