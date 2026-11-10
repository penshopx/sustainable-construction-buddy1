
-- Table for program participants/attendees
CREATE TABLE public.pub_program_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.pub_programs(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  position text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  attendance_status text NOT NULL DEFAULT 'registered',
  notes text NOT NULL DEFAULT '',
  registered_at timestamptz NOT NULL DEFAULT now(),
  attended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pub_program_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants publicly readable" ON public.pub_program_participants
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage participants" ON public.pub_program_participants
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
