
-- 1) Restrict pending_gifts UPDATE to only the 'seen' column
REVOKE UPDATE ON public.pending_gifts FROM authenticated, anon, PUBLIC;
GRANT UPDATE (seen) ON public.pending_gifts TO authenticated;

-- 2) Scope user_cards delete policy to authenticated role
DROP POLICY IF EXISTS "Users can delete their own cards" ON public.user_cards;
CREATE POLICY "Users can delete their own cards"
ON public.user_cards
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
