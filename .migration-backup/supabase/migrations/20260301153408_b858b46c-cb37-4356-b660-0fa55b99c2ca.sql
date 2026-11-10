
ALTER TABLE public.performance_grades 
  ADD COLUMN company_name text NOT NULL DEFAULT '',
  ADD COLUMN nib text NOT NULL DEFAULT '',
  ADD COLUMN sbu_number text NOT NULL DEFAULT '',
  ADD COLUMN bujk_qualification text NOT NULL DEFAULT '';
