
-- Create a public storage bucket for marketplace product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketplace-images', 'marketplace-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own images
CREATE POLICY "Users can upload marketplace images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'marketplace-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow anyone to view marketplace images (public bucket)
CREATE POLICY "Public can view marketplace images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'marketplace-images');

-- Allow users to delete their own images
CREATE POLICY "Users can delete own marketplace images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'marketplace-images' AND (storage.foldername(name))[1] = auth.uid()::text);
