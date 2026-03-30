
-- Fix 1: Remove insecure user self-insert policy on user_cards
DROP POLICY IF EXISTS "Users can insert their own cards" ON public.user_cards;

-- Fix 2: Remove user_cards from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.user_cards;
