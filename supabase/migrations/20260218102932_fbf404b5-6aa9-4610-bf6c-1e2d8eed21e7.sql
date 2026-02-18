
-- Table to track user daily streaks
CREATE TABLE public.user_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  current_streak integer NOT NULL DEFAULT 0,
  last_streak_date date,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own streak"
ON public.user_streaks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own streak"
ON public.user_streaks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own streak"
ON public.user_streaks FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all streaks"
ON public.user_streaks FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Table for admin-defined winstreak rewards
CREATE TABLE public.winstreak_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_number integer NOT NULL UNIQUE CHECK (day_number >= 1 AND day_number <= 100),
  reward_type text NOT NULL,
  reward_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.winstreak_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view winstreak rewards"
ON public.winstreak_rewards FOR SELECT
USING (true);

CREATE POLICY "Admins can manage winstreak rewards"
ON public.winstreak_rewards FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Table to track claimed rewards
CREATE TABLE public.winstreak_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reward_id uuid NOT NULL REFERENCES public.winstreak_rewards(id) ON DELETE CASCADE,
  day_number integer NOT NULL,
  claimed_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, reward_id)
);

ALTER TABLE public.winstreak_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own claims"
ON public.winstreak_claims FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own claims"
ON public.winstreak_claims FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all claims"
ON public.winstreak_claims FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at on user_streaks
CREATE TRIGGER update_user_streaks_updated_at
BEFORE UPDATE ON public.user_streaks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on winstreak_rewards
CREATE TRIGGER update_winstreak_rewards_updated_at
BEFORE UPDATE ON public.winstreak_rewards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
