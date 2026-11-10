
-- LKUT (Laporan Kegiatan Usaha Tahunan) - Permen PUPR No. 7/2024
-- For BUJK kecil: simplified annual business activity report

CREATE TABLE public.lkut_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  report_year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, submitted, validated
  
  -- A. Data Kepatuhan Perizinan (Pasal 17 ayat 1)
  sbu_number TEXT NOT NULL DEFAULT '',
  sbu_type TEXT NOT NULL DEFAULT 'baru', -- baru, perpanjangan
  sbu_expiry_date DATE,
  
  tkk_replacement BOOLEAN DEFAULT false,
  tkk_replacement_date DATE,
  tkk_replacement_notes TEXT NOT NULL DEFAULT '',
  
  equipment_commitment_fulfilled BOOLEAN DEFAULT false,
  equipment_fulfillment_date DATE,
  
  smap_fulfilled BOOLEAN DEFAULT false,
  smap_report_date DATE,
  
  experience_records_complete BOOLEAN DEFAULT false,
  experience_pending_list TEXT NOT NULL DEFAULT '',
  
  -- B. Data Keuangan Perusahaan (Lampiran A.2)
  asset_value_current BIGINT NOT NULL DEFAULT 0,
  asset_value_previous BIGINT NOT NULL DEFAULT 0,
  sales_value BIGINT NOT NULL DEFAULT 0,
  gross_profit BIGINT NOT NULL DEFAULT 0,
  current_assets BIGINT NOT NULL DEFAULT 0,
  short_term_liabilities BIGINT NOT NULL DEFAULT 0,
  total_liabilities BIGINT NOT NULL DEFAULT 0,
  total_equity BIGINT NOT NULL DEFAULT 0,
  
  -- B. Data Kesehatan Organisasi
  gcg_applied BOOLEAN DEFAULT false,
  gcg_first_year INTEGER,
  certifications TEXT NOT NULL DEFAULT '', -- JSON array of certifications
  awards TEXT NOT NULL DEFAULT '', -- JSON array of awards
  smk3_applied BOOLEAN DEFAULT false,
  smk3_first_year INTEGER,
  
  -- B. Data SDM
  total_employees INTEGER NOT NULL DEFAULT 0,
  trained_employees INTEGER NOT NULL DEFAULT 0,
  contract_experts INTEGER NOT NULL DEFAULT 0,
  permanent_experts INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  submitted_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- One report per user per year
  UNIQUE(user_id, report_year)
);

-- Enable RLS
ALTER TABLE public.lkut_reports ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own LKUT reports"
  ON public.lkut_reports FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create own LKUT reports"
  ON public.lkut_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own LKUT reports"
  ON public.lkut_reports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own draft LKUT"
  ON public.lkut_reports FOR DELETE
  USING (auth.uid() = user_id AND status = 'draft');

-- Trigger for updated_at
CREATE TRIGGER update_lkut_reports_updated_at
  BEFORE UPDATE ON public.lkut_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- LKUT Project Performance Data (linked to existing projects)
CREATE TABLE public.lkut_project_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lkut_id UUID NOT NULL REFERENCES public.lkut_reports(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id),
  user_id UUID NOT NULL,
  
  -- Kinerja Proyek (Lampiran A.3)
  experts_required INTEGER NOT NULL DEFAULT 0,
  experts_available INTEGER NOT NULL DEFAULT 0,
  disciplines_required INTEGER NOT NULL DEFAULT 0,
  disciplines_available INTEGER NOT NULL DEFAULT 0,
  certifications_required INTEGER NOT NULL DEFAULT 0,
  certifications_available INTEGER NOT NULL DEFAULT 0,
  
  equipment_required INTEGER NOT NULL DEFAULT 0,
  equipment_available INTEGER NOT NULL DEFAULT 0,
  
  quality_score NUMERIC NOT NULL DEFAULT 0, -- TM percentage
  
  safety_incidents_minor INTEGER NOT NULL DEFAULT 0,
  safety_incidents_major INTEGER NOT NULL DEFAULT 0,
  total_workers INTEGER NOT NULL DEFAULT 0,
  
  contract_duration_days INTEGER NOT NULL DEFAULT 0,
  actual_duration_days INTEGER NOT NULL DEFAULT 0,
  additional_days INTEGER NOT NULL DEFAULT 0,
  
  progress_planned NUMERIC NOT NULL DEFAULT 0,
  progress_actual NUMERIC NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lkut_project_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own LKUT project data"
  ON public.lkut_project_data FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create own LKUT project data"
  ON public.lkut_project_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own LKUT project data"
  ON public.lkut_project_data FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own LKUT project data"
  ON public.lkut_project_data FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_lkut_project_data_updated_at
  BEFORE UPDATE ON public.lkut_project_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
