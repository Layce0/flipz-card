-- Allow admins to insert cards for any user
CREATE POLICY "Admins can give cards to users"
ON public.user_cards
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));