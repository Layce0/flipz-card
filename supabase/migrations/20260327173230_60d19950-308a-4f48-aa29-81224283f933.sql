CREATE POLICY "Users can insert their own cards"
ON public.user_cards
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);