
-- Table for SMAP documents (Surat Pernyataan, Sertifikat ISO 37001, Pendidikan Anti Korupsi)
CREATE TABLE public.smap_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'surat_pernyataan',
  -- surat_pernyataan | sertifikat_iso | pendidikan_antikorupsi
  
  -- Common fields
  company_name TEXT NOT NULL DEFAULT '',
  document_number TEXT NOT NULL DEFAULT '',
  issued_date DATE,
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  -- draft | submitted | verified | expired
  notes TEXT NOT NULL DEFAULT '',
  
  -- Surat Pernyataan specific
  sbu_application_type TEXT NOT NULL DEFAULT '',
  -- baru (new SBU only)
  signatory_name TEXT NOT NULL DEFAULT '',
  signatory_position TEXT NOT NULL DEFAULT '',
  
  -- Sertifikat ISO 37001 specific
  issuing_body TEXT NOT NULL DEFAULT '',
  certificate_scope TEXT NOT NULL DEFAULT '',
  
  -- Pendidikan Anti Korupsi specific
  training_name TEXT NOT NULL DEFAULT '',
  training_provider TEXT NOT NULL DEFAULT '',
  training_hours INTEGER NOT NULL DEFAULT 0,
  participant_count INTEGER NOT NULL DEFAULT 0,
  
  -- File storage
  file_url TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  
  -- Verification
  verified_at TIMESTAMPTZ,
  verified_by TEXT NOT NULL DEFAULT '',
  verification_notes TEXT NOT NULL DEFAULT '',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.smap_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own smap docs"
  ON public.smap_documents FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create own smap docs"
  ON public.smap_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own smap docs"
  ON public.smap_documents FOR UPDATE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete own draft smap docs"
  ON public.smap_documents FOR DELETE
  USING (auth.uid() = user_id AND status = 'draft');

-- Trigger for updated_at
CREATE TRIGGER update_smap_documents_updated_at
  BEFORE UPDATE ON public.smap_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for SMAP documents
INSERT INTO storage.buckets (id, name, public) VALUES ('smap-documents', 'smap-documents', false)
ON CONFLICT DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload own smap docs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'smap-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own smap docs storage"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'smap-documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Users can delete own smap docs storage"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'smap-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
