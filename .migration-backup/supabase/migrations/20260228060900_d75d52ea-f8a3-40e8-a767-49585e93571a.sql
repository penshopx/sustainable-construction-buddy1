
-- Add attachment columns to innovation_proposals
ALTER TABLE public.innovation_proposals
ADD COLUMN attachment_url text NOT NULL DEFAULT '',
ADD COLUMN attachment_name text NOT NULL DEFAULT '';

-- Create storage bucket for innovation attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('innovation-attachments', 'innovation-attachments', false);

-- Storage policies: users can upload to their own folder
CREATE POLICY "Users can upload own attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'innovation-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'innovation-attachments' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Users can delete own attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'innovation-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
