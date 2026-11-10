
-- Table for PANCEK KPK self-assessments
-- Each assessment covers 6 pillars: Komitmen, Perencanaan, Pelaksanaan, Evaluasi, Perbaikan, Respon
CREATE TABLE public.pancek_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  period_year INTEGER NOT NULL,
  
  -- Company info snapshot
  company_name TEXT NOT NULL DEFAULT '',
  npwp TEXT NOT NULL DEFAULT '',
  nib TEXT NOT NULL DEFAULT '',
  
  -- Pillar scores (number of fulfilled indicators per pillar)
  komitmen_score INTEGER NOT NULL DEFAULT 0,
  komitmen_total INTEGER NOT NULL DEFAULT 15,
  perencanaan_score INTEGER NOT NULL DEFAULT 0,
  perencanaan_total INTEGER NOT NULL DEFAULT 6,
  pelaksanaan_score INTEGER NOT NULL DEFAULT 0,
  pelaksanaan_total INTEGER NOT NULL DEFAULT 20,
  evaluasi_score INTEGER NOT NULL DEFAULT 0,
  evaluasi_total INTEGER NOT NULL DEFAULT 8,
  perbaikan_score INTEGER NOT NULL DEFAULT 0,
  perbaikan_total INTEGER NOT NULL DEFAULT 6,
  respon_score INTEGER NOT NULL DEFAULT 0,
  respon_total INTEGER NOT NULL DEFAULT 4,
  
  -- Overall
  total_answered INTEGER NOT NULL DEFAULT 0,
  total_indicators INTEGER NOT NULL DEFAULT 59,
  completion_percent NUMERIC NOT NULL DEFAULT 0,
  
  -- Verification by association
  status TEXT NOT NULL DEFAULT 'draft',  -- draft, submitted, verified, rejected
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by TEXT NOT NULL DEFAULT '',
  verification_notes TEXT NOT NULL DEFAULT '',
  
  -- Checklist answers stored as JSONB (pillar -> indicator_code -> boolean)
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- One assessment per user per year
  UNIQUE(user_id, period_year)
);

-- Enable RLS
ALTER TABLE public.pancek_assessments ENABLE ROW LEVEL SECURITY;

-- Users can view their own or admin can view all
CREATE POLICY "Users can view own pancek assessments"
ON public.pancek_assessments FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Users can create own assessments
CREATE POLICY "Users can create own pancek assessments"
ON public.pancek_assessments FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update own draft assessments
CREATE POLICY "Users can update own pancek assessments"
ON public.pancek_assessments FOR UPDATE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Users can delete own draft assessments
CREATE POLICY "Users can delete own draft pancek"
ON public.pancek_assessments FOR DELETE
USING (auth.uid() = user_id AND status = 'draft');

-- Trigger for updated_at
CREATE TRIGGER update_pancek_assessments_updated_at
BEFORE UPDATE ON public.pancek_assessments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
