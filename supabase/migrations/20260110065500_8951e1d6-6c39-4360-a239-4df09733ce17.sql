-- Allow users to delete their own cards (for trading)
CREATE POLICY "Users can delete their own cards"
ON public.user_cards
FOR DELETE
USING (auth.uid() = user_id);