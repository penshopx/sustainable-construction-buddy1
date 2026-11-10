
-- Table to store BUJK performance grading history
CREATE TABLE public.performance_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period text NOT NULL, -- e.g. "2025-Q1" or "2024"
  
  -- Sub-scores (0-100 each)
  financial_score numeric NOT NULL DEFAULT 0,
  project_score numeric NOT NULL DEFAULT 0,
  compliance_score numeric NOT NULL DEFAULT 0,
  risk_score numeric NOT NULL DEFAULT 0,
  
  -- Weighted total (0-100)
  total_score numeric NOT NULL DEFAULT 0,
  
  -- Grade: AAA, AA, A, BBB, BB, B, CCC, CC, C, D, F
  grade text NOT NULL DEFAULT 'F',
  
  -- Breakdown JSON for audit trail
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, period)
);

ALTER TABLE public.performance_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own grades"
  ON public.performance_grades FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own grades"
  ON public.performance_grades FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own grades"
  ON public.performance_grades FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "No delete on grades"
  ON public.performance_grades FOR DELETE
  USING (false);
