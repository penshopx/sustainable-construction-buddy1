
ALTER TABLE public.lkut_reports
  ADD COLUMN kta_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN kta_association TEXT NOT NULL DEFAULT '',
  ADD COLUMN kta_expiry_date DATE DEFAULT NULL;
