
-- Gallery table for company project photos
CREATE TABLE public.bujk_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_id uuid NOT NULL REFERENCES public.bujk_directory(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  image_url text NOT NULL DEFAULT '',
  caption text NOT NULL DEFAULT '',
  project_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bujk_gallery ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view gallery of published companies
CREATE POLICY "Anyone can view published gallery"
ON public.bujk_gallery FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bujk_directory d
    WHERE d.id = bujk_gallery.directory_id
    AND (d.is_published = true OR d.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);

CREATE POLICY "Users can insert own gallery"
ON public.bujk_gallery FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own gallery"
ON public.bujk_gallery FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Storage bucket for company gallery
INSERT INTO storage.buckets (id, name, public) VALUES ('bujk-gallery', 'bujk-gallery', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload gallery images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'bujk-gallery');

CREATE POLICY "Anyone can view gallery images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'bujk-gallery');

CREATE POLICY "Users can delete own gallery images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'bujk-gallery' AND (storage.foldername(name))[1] = auth.uid()::text);
