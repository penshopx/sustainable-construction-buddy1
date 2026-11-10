-- Update default values for pancek_assessments pillar totals to match 70 indicators
ALTER TABLE public.pancek_assessments ALTER COLUMN komitmen_total SET DEFAULT 17;
ALTER TABLE public.pancek_assessments ALTER COLUMN perencanaan_total SET DEFAULT 7;
ALTER TABLE public.pancek_assessments ALTER COLUMN pelaksanaan_total SET DEFAULT 23;
ALTER TABLE public.pancek_assessments ALTER COLUMN evaluasi_total SET DEFAULT 10;
ALTER TABLE public.pancek_assessments ALTER COLUMN perbaikan_total SET DEFAULT 7;
ALTER TABLE public.pancek_assessments ALTER COLUMN respon_total SET DEFAULT 6;
ALTER TABLE public.pancek_assessments ALTER COLUMN total_indicators SET DEFAULT 70;