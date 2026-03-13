-- 1. Remove user INSERT on winstreak_claims (edge function uses service role)
DROP POLICY IF EXISTS "Users can insert their own claims" ON public.winstreak_claims;

-- 2. Remove user INSERT and UPDATE on user_streaks (will be handled by edge function)
DROP POLICY IF EXISTS "Users can insert their own streak" ON public.user_streaks;
DROP POLICY IF EXISTS "Users can update their own streak" ON public.user_streaks;

-- 3. Remove user INSERT on code_redemptions (edge function uses service role)
DROP POLICY IF EXISTS "Users can insert their own redemptions" ON public.code_redemptions;