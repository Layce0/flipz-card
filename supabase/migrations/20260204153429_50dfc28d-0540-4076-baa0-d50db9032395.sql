-- Create purchase_transactions table for idempotency protection
CREATE TABLE public.purchase_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  card_count integer NOT NULL,
  pack_type text,
  processed_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchase_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions
CREATE POLICY "Users can view their own transactions"
ON public.purchase_transactions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Note: INSERT is handled by service role in edge function (bypasses RLS)