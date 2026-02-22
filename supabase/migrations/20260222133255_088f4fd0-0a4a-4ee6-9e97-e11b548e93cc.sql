
-- Create global_gifs table
CREATE TABLE public.global_gifs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  x integer NOT NULL DEFAULT 100,
  y integer NOT NULL DEFAULT 100,
  width integer NOT NULL DEFAULT 150,
  height integer NOT NULL DEFAULT 150,
  visible boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.global_gifs ENABLE ROW LEVEL SECURITY;

-- Everyone can view visible GIFs
CREATE POLICY "Anyone can view visible gifs"
  ON public.global_gifs FOR SELECT
  USING (visible = true);

-- Admins can view all GIFs
CREATE POLICY "Admins can view all gifs"
  ON public.global_gifs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage GIFs
CREATE POLICY "Admins can insert gifs"
  ON public.global_gifs FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update gifs"
  ON public.global_gifs FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete gifs"
  ON public.global_gifs FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for GIF uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('global-gifs', 'global-gifs', true);

-- Storage policies
CREATE POLICY "Anyone can view global gifs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'global-gifs');

CREATE POLICY "Admins can upload global gifs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'global-gifs' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete global gifs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'global-gifs' AND public.has_role(auth.uid(), 'admin'::app_role));
