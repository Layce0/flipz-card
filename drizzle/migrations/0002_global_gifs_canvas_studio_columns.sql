ALTER TABLE public.global_gifs
  ADD COLUMN IF NOT EXISTS element_type text DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS content_text text DEFAULT '',
  ADD COLUMN IF NOT EXISTS font_color text DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS bg_color text DEFAULT 'transparent',
  ADD COLUMN IF NOT EXISTS font_size integer DEFAULT 16,
  ADD COLUMN IF NOT EXISTS percentage_val integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS z_index integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS action_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hide_selector text DEFAULT NULL;

COMMENT ON COLUMN public.global_gifs.element_type IS 'media, title, text, badge, stat, button, background';

COMMENT ON COLUMN public.global_gifs.action_url IS 'Lien de redirection au clic (ex: /shop, /packs, ou URL externe)';

COMMENT ON COLUMN public.global_gifs.hide_selector IS 'Sélecteur CSS de l''élément de page à masquer si remplacé';