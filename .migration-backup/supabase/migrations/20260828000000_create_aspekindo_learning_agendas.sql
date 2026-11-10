-- Public agenda managed by ASPEKINDO admins.
-- This is intentionally separate from e_course_modules and pub_programs so
-- public learning announcements cannot be mixed with LMS content.
CREATE TABLE public.aspekindo_learning_agendas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Sesi pembelajaran',
  description TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  start_date DATE NOT NULL,
  end_date DATE,
  schedule TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  registration_url TEXT NOT NULL DEFAULT '',
  registration_details TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT aspekindo_learning_agendas_valid_dates CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT aspekindo_learning_agendas_safe_registration_url
    CHECK (registration_url = '' OR registration_url ~* '^https://')
);

CREATE INDEX aspekindo_learning_agendas_public_schedule_idx
  ON public.aspekindo_learning_agendas (status, start_date);

ALTER TABLE public.aspekindo_learning_agendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published ASPEKINDO agendas are publicly readable"
  ON public.aspekindo_learning_agendas
  FOR SELECT
  USING (status = 'published');

CREATE POLICY "Admins can manage ASPEKINDO agendas"
  ON public.aspekindo_learning_agendas
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_aspekindo_learning_agendas_updated_at
  BEFORE UPDATE ON public.aspekindo_learning_agendas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();