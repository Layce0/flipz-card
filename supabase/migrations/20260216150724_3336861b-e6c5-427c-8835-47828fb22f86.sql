
-- Table for reward codes created by admins
CREATE TABLE public.reward_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  reward_type TEXT NOT NULL, -- 'pack', 'card', 'boost_luck', 'boost_pack'
  reward_config JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  max_uses INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table for tracking code redemptions
CREATE TABLE public.code_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code_id UUID NOT NULL REFERENCES public.reward_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  boost_expires_at TIMESTAMPTZ,
  UNIQUE(code_id, user_id)
);

-- RLS for reward_codes
ALTER TABLE public.reward_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reward codes"
ON public.reward_codes
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active reward codes"
ON public.reward_codes
FOR SELECT
USING (is_active = true);

-- RLS for code_redemptions
ALTER TABLE public.code_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own redemptions"
ON public.code_redemptions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own redemptions"
ON public.code_redemptions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all redemptions"
ON public.code_redemptions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));
