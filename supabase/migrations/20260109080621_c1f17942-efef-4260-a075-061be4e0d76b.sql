-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create table for configurable drop rates
CREATE TABLE public.drop_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rarity TEXT NOT NULL UNIQUE,
  rate INTEGER NOT NULL DEFAULT 25,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.drop_rates ENABLE ROW LEVEL SECURITY;

-- Everyone can view drop rates
CREATE POLICY "Anyone can view drop rates"
ON public.drop_rates
FOR SELECT
USING (true);

-- Only admins can update drop rates
CREATE POLICY "Admins can update drop rates"
ON public.drop_rates
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default drop rates
INSERT INTO public.drop_rates (rarity, rate) VALUES
  ('common', 60),
  ('rare', 25),
  ('epic', 12),
  ('legendary', 3);

-- Add trigger for updated_at
CREATE TRIGGER update_drop_rates_updated_at
BEFORE UPDATE ON public.drop_rates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();