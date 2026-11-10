-- Create storage bucket for PANCEK evidence documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('pancek-evidence', 'pancek-evidence', false);

-- RLS: Users can upload their own evidence files
CREATE POLICY "Users can upload own pancek evidence"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'pancek-evidence'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS: Users can view their own evidence files
CREATE POLICY "Users can view own pancek evidence"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'pancek-evidence'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

-- RLS: Users can delete their own evidence files
CREATE POLICY "Users can delete own pancek evidence"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'pancek-evidence'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS: Users can update their own evidence files
CREATE POLICY "Users can update own pancek evidence"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'pancek-evidence'
  AND auth.uid()::text = (storage.foldername(name))[1]
);