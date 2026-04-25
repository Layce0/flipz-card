ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_daily_card_at timestamp with time zone;
