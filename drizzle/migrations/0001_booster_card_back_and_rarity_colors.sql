ALTER TABLE public.boosters ADD COLUMN card_back_url text;
ALTER TABLE public.boosters ADD COLUMN rarity_colors jsonb NOT NULL DEFAULT '{}'::jsonb;