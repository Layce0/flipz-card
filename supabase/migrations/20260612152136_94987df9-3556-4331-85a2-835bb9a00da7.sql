
-- 1) Remove direct DELETE policy on user_cards (server-side functions use service role)
DROP POLICY IF EXISTS "Users can delete their own cards" ON public.user_cards;
REVOKE DELETE ON public.user_cards FROM authenticated;

-- 2) Restrict pending_gifts UPDATE to only the 'seen' column via column-level GRANTs
REVOKE UPDATE ON public.pending_gifts FROM authenticated;
GRANT UPDATE (seen) ON public.pending_gifts TO authenticated;

-- Tighten the RLS UPDATE policy with WITH CHECK so user_id can't be changed
DROP POLICY IF EXISTS "Users can update their own pending gifts" ON public.pending_gifts;
CREATE POLICY "Users can mark their own pending gifts as seen"
ON public.pending_gifts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
