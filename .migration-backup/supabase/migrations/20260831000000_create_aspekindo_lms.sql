-- Native LMS for ASPEKINDO activities.
-- Intentionally separate from the legacy e-course tables and public agenda.

CREATE TABLE public.aspekindo_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  bujk_directory_id UUID REFERENCES public.bujk_directory(id) ON DELETE SET NULL,
  membership_number TEXT NOT NULL DEFAULT '',
  company_name TEXT NOT NULL DEFAULT '',
  membership_status TEXT NOT NULL DEFAULT 'active'
    CHECK (membership_status IN ('active', 'pending', 'expired', 'suspended')),
  joined_at DATE,
  expires_at DATE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX aspekindo_membership_number_unique
  ON public.aspekindo_members (membership_number)
  WHERE membership_number <> '';
CREATE UNIQUE INDEX aspekindo_member_one_record_per_user
  ON public.aspekindo_members (user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX aspekindo_members_company_idx ON public.aspekindo_members (company_name);

ALTER TABLE public.aspekindo_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view their own ASPEKINDO membership"
  ON public.aspekindo_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage ASPEKINDO memberships"
  ON public.aspekindo_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.aspekindo_member_obligations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.aspekindo_members(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  obligation_type TEXT NOT NULL DEFAULT 'administratif',
  siap_focus TEXT NOT NULL DEFAULT 'sertifikasi'
    CHECK (siap_focus IN ('legalitas', 'sertifikasi', 'tender', 'proyek', 'umum')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'fulfilled', 'waived')),
  due_date DATE,
  fulfilled_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX aspekindo_member_obligations_member_idx
  ON public.aspekindo_member_obligations (member_id, status, due_date);

ALTER TABLE public.aspekindo_member_obligations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view their own obligations"
  ON public.aspekindo_member_obligations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.aspekindo_members member
      WHERE member.id = member_id
        AND (member.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
    )
  );
CREATE POLICY "Admins can manage member obligations"
  ON public.aspekindo_member_obligations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.aspekindo_pub_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  activity_type TEXT NOT NULL DEFAULT 'webinar'
    CHECK (activity_type IN ('webinar', 'seminar', 'fgd', 'workshop', 'hybrid', 'other')),
  delivery_mode TEXT NOT NULL DEFAULT 'online'
    CHECK (delivery_mode IN ('online', 'in_person', 'hybrid', 'other')),
  description TEXT NOT NULL DEFAULT '',
  learning_outcomes TEXT NOT NULL DEFAULT '',
  siap_focus TEXT NOT NULL DEFAULT 'sertifikasi'
    CHECK (siap_focus IN ('legalitas', 'sertifikasi', 'tender', 'proyek', 'umum')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  location TEXT NOT NULL DEFAULT '',
  registration_url TEXT NOT NULL DEFAULT '',
  member_only BOOLEAN NOT NULL DEFAULT true,
  max_participants INTEGER,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT aspekindo_pub_activity_valid_dates CHECK (end_at IS NULL OR end_at >= start_at),
  CONSTRAINT aspekindo_pub_activity_safe_registration_url
    CHECK (registration_url = '' OR registration_url ~* '^https://'),
  CONSTRAINT aspekindo_pub_activity_positive_capacity
    CHECK (max_participants IS NULL OR max_participants > 0)
);

CREATE INDEX aspekindo_pub_activities_listing_idx
  ON public.aspekindo_pub_activities (status, start_at);

ALTER TABLE public.aspekindo_pub_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Eligible members can view published PUB activities"
  ON public.aspekindo_pub_activities FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      status = 'published'
      AND (
        member_only = false
        OR EXISTS (
          SELECT 1
          FROM public.aspekindo_members member
          WHERE member.user_id = auth.uid()
            AND member.membership_status = 'active'
        )
      )
    )
  );
CREATE POLICY "Admins can manage PUB activities"
  ON public.aspekindo_pub_activities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.aspekindo_activity_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.aspekindo_pub_activities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  material_type TEXT NOT NULL DEFAULT 'document'
    CHECK (material_type IN ('video', 'document', 'link', 'image', 'other')),
  storage_path TEXT NOT NULL DEFAULT '',
  external_url TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '',
  file_size BIGINT NOT NULL DEFAULT 0 CHECK (file_size >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT aspekindo_activity_material_has_source
    CHECK (storage_path <> '' OR external_url <> ''),
  CONSTRAINT aspekindo_activity_material_safe_external_url
    CHECK (external_url = '' OR external_url ~* '^https://')
);

CREATE INDEX aspekindo_activity_materials_activity_idx
  ON public.aspekindo_activity_materials (activity_id, is_published, sort_order);

ALTER TABLE public.aspekindo_activity_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Eligible members can view published activity materials"
  ON public.aspekindo_activity_materials FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      is_published = true
      AND EXISTS (
        SELECT 1
        FROM public.aspekindo_pub_activities activity
        WHERE activity.id = activity_id
          AND activity.status = 'published'
          AND (
            activity.member_only = false
            OR EXISTS (
              SELECT 1
              FROM public.aspekindo_members member
              WHERE member.user_id = auth.uid()
                AND member.membership_status = 'active'
            )
          )
      )
    )
  );
CREATE POLICY "Admins can manage activity materials"
  ON public.aspekindo_activity_materials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.aspekindo_activity_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.aspekindo_pub_activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered', 'attended', 'completed', 'withdrawn')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  UNIQUE (activity_id, user_id)
);

CREATE INDEX aspekindo_activity_enrollments_user_idx
  ON public.aspekindo_activity_enrollments (user_id, status, registered_at DESC);

ALTER TABLE public.aspekindo_activity_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view their own activity enrollments"
  ON public.aspekindo_activity_enrollments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Members can register for published activities"
  ON public.aspekindo_activity_enrollments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'registered'
    AND EXISTS (
      SELECT 1
      FROM public.aspekindo_pub_activities activity
      WHERE activity.id = activity_id
        AND activity.status = 'published'
        AND (
          activity.member_only = false
          OR EXISTS (
            SELECT 1
            FROM public.aspekindo_members member
            WHERE member.user_id = auth.uid()
              AND member.membership_status = 'active'
          )
        )
    )
  );
CREATE POLICY "Admins can manage activity enrollments"
  ON public.aspekindo_activity_enrollments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.aspekindo_activity_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID NOT NULL REFERENCES public.aspekindo_activity_enrollments(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.aspekindo_pub_activities(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.aspekindo_activity_materials(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed')),
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, material_id)
);

ALTER TABLE public.aspekindo_activity_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can manage their own activity progress"
  ON public.aspekindo_activity_progress FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.aspekindo_activity_enrollments enrollment
      WHERE enrollment.id = enrollment_id
        AND enrollment.user_id = auth.uid()
        AND enrollment.activity_id = activity_id
    )
  );
CREATE POLICY "Admins can view and manage activity progress"
  ON public.aspekindo_activity_progress FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.aspekindo_activity_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID NOT NULL REFERENCES public.aspekindo_activity_enrollments(id) ON DELETE CASCADE UNIQUE,
  activity_id UUID NOT NULL REFERENCES public.aspekindo_pub_activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT NOT NULL DEFAULT '',
  learning_reflection TEXT NOT NULL DEFAULT '',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.aspekindo_activity_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can manage their own activity evaluation"
  ON public.aspekindo_activity_evaluations FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.aspekindo_activity_enrollments enrollment
      WHERE enrollment.id = enrollment_id
        AND enrollment.user_id = auth.uid()
        AND enrollment.activity_id = activity_id
    )
  );
CREATE POLICY "Admins can view and manage activity evaluations"
  ON public.aspekindo_activity_evaluations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.aspekindo_activity_evidence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID NOT NULL REFERENCES public.aspekindo_activity_enrollments(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.aspekindo_pub_activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL DEFAULT 'completion'
    CHECK (evidence_type IN ('completion', 'attendance', 'reflection', 'attachment', 'other')),
  evidence_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  storage_path TEXT NOT NULL DEFAULT '',
  external_url TEXT NOT NULL DEFAULT '',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT aspekindo_activity_evidence_has_source
    CHECK (storage_path <> '' OR external_url <> '' OR evidence_type = 'completion'),
  CONSTRAINT aspekindo_activity_evidence_safe_external_url
    CHECK (external_url = '' OR external_url ~* '^https://'),
  UNIQUE (enrollment_id, evidence_type)
);

CREATE INDEX aspekindo_activity_evidence_user_idx
  ON public.aspekindo_activity_evidence (user_id, issued_at DESC);

ALTER TABLE public.aspekindo_activity_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view their own activity evidence"
  ON public.aspekindo_activity_evidence FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage activity evidence"
  ON public.aspekindo_activity_evidence FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.complete_aspekindo_activity(_activity_id UUID)
RETURNS public.aspekindo_activity_enrollments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  completed_enrollment public.aspekindo_activity_enrollments;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.aspekindo_activity_materials material
    WHERE material.activity_id = _activity_id
      AND material.is_published = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.aspekindo_activity_progress progress
        WHERE progress.material_id = material.id
          AND progress.user_id = auth.uid()
          AND progress.status = 'completed'
      )
  ) THEN
    RAISE EXCEPTION 'Selesaikan seluruh materi kegiatan terlebih dahulu';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.aspekindo_activity_evaluations evaluation
    WHERE evaluation.activity_id = _activity_id
      AND evaluation.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Isi evaluasi kegiatan terlebih dahulu';
  END IF;

  UPDATE public.aspekindo_activity_enrollments
  SET status = 'completed', completed_at = COALESCE(completed_at, now())
  WHERE activity_id = _activity_id
    AND user_id = auth.uid()
    AND status IN ('registered', 'attended');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment kegiatan tidak ditemukan atau sudah selesai';
  END IF;

  SELECT *
  INTO completed_enrollment
  FROM public.aspekindo_activity_enrollments
  WHERE activity_id = _activity_id
    AND user_id = auth.uid();

  INSERT INTO public.aspekindo_activity_evidence (
    enrollment_id, activity_id, user_id, evidence_type, evidence_number,
    title, description, created_by
  )
  SELECT
    completed_enrollment.id,
    _activity_id,
    auth.uid(),
    'completion',
    'PUB-' || upper(substr(replace(completed_enrollment.id::text, '-', ''), 1, 12)),
    activity.title || ' — Bukti Penyelesaian',
    'Bukti kegiatan PUB tercatat setelah peserta menyelesaikan kegiatan.',
    auth.uid()
  FROM public.aspekindo_pub_activities activity
  WHERE activity.id = _activity_id
  ON CONFLICT (enrollment_id, evidence_type) DO NOTHING;

  RETURN completed_enrollment;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_aspekindo_activity(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_aspekindo_members_updated_at
  BEFORE UPDATE ON public.aspekindo_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_aspekindo_member_obligations_updated_at
  BEFORE UPDATE ON public.aspekindo_member_obligations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_aspekindo_pub_activities_updated_at
  BEFORE UPDATE ON public.aspekindo_pub_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_aspekindo_activity_materials_updated_at
  BEFORE UPDATE ON public.aspekindo_activity_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_aspekindo_activity_progress_updated_at
  BEFORE UPDATE ON public.aspekindo_activity_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_aspekindo_activity_evaluations_updated_at
  BEFORE UPDATE ON public.aspekindo_activity_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'aspekindo-learning',
  'aspekindo-learning',
  false,
  524288000,
  ARRAY[
    'video/mp4', 'video/webm', 'video/quicktime',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg', 'image/png', 'image/webp'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  public = false;

CREATE POLICY "Admins can manage ASPEKINDO learning files"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'aspekindo-learning' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'aspekindo-learning' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Eligible members can read published ASPEKINDO learning files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'aspekindo-learning'
    AND EXISTS (
      SELECT 1
      FROM public.aspekindo_activity_materials material
      JOIN public.aspekindo_pub_activities activity ON activity.id = material.activity_id
      WHERE material.storage_path = name
        AND material.is_published = true
        AND activity.status = 'published'
        AND (
          activity.member_only = false
          OR EXISTS (
            SELECT 1
            FROM public.aspekindo_members member
            WHERE member.user_id = auth.uid()
              AND member.membership_status = 'active'
          )
        )
    )
  );