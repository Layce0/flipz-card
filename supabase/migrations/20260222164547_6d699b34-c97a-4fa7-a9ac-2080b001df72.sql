
-- Add linking columns to global_gifs
ALTER TABLE public.global_gifs
  ADD COLUMN click_target_id uuid REFERENCES public.global_gifs(id) ON DELETE SET NULL,
  ADD COLUMN initially_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN auto_hide_after_ms integer;
