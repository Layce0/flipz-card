
INSERT INTO storage.buckets (id, name, public) VALUES ('winstreak-icons', 'winstreak-icons', true);

CREATE POLICY "Admins can upload winstreak icons" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'winstreak-icons' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete winstreak icons" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'winstreak-icons' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view winstreak icons" ON storage.objects
  FOR SELECT USING (bucket_id = 'winstreak-icons');
