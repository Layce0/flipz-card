-- Remove the public SELECT policy that exposes active reward codes to everyone
DROP POLICY "Anyone can view active reward codes" ON public.reward_codes;