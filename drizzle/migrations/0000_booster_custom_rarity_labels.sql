ALTER TABLE public.boosters ADD COLUMN custom_rarities text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE public.booster_cards ADD COLUMN custom_rarity text;
ALTER TABLE public.booster_cards ADD CONSTRAINT booster_card_custom_rarity_length CHECK (custom_rarity IS NULL OR (length(trim(custom_rarity)) BETWEEN 1 AND 32));