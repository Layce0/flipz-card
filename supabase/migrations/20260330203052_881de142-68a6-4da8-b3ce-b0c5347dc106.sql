-- Add admin SELECT policy on purchase_transactions for support/fraud review
CREATE POLICY "Admins can view all transactions"
ON public.purchase_transactions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));