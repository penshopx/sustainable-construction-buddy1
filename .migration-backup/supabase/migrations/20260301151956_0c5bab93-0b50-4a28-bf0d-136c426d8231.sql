
-- Create storage bucket for LKUT documents
INSERT INTO storage.buckets (id, name, public) VALUES ('lkut-documents', 'lkut-documents', false);

-- Storage policies for lkut-documents bucket
CREATE POLICY "Users can upload own lkut docs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'lkut-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own lkut docs"
ON storage.objects FOR SELECT
USING (bucket_id = 'lkut-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own lkut docs"
ON storage.objects FOR DELETE
USING (bucket_id = 'lkut-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Table to track LKUT document attachments
CREATE TABLE public.lkut_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lkut_id UUID NOT NULL REFERENCES public.lkut_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  component TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  file_url TEXT NOT NULL DEFAULT '',
  file_size BIGINT NOT NULL DEFAULT 0,
  file_type TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lkut_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lkut documents"
ON public.lkut_documents FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own lkut documents"
ON public.lkut_documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own lkut documents"
ON public.lkut_documents FOR DELETE
USING (auth.uid() = user_id);
