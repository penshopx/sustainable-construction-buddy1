-- Native LMS video materials and metadata-only public course landing pages.

ALTER TABLE public.aspekindo_lms_courses
  ADD COLUMN IF NOT EXISTS public_landing_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.aspekindo_lms_materials
  ADD COLUMN IF NOT EXISTS storage_path TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS file_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mime_type TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.aspekindo_lms_materials
  DROP CONSTRAINT IF EXISTS aspekindo_lms_materials_material_type_check,
  DROP CONSTRAINT IF EXISTS aspekindo_lms_materials_has_content,
  DROP CONSTRAINT IF EXISTS aspekindo_lms_materials_video_metadata;

ALTER TABLE public.aspekindo_lms_materials
  ADD CONSTRAINT aspekindo_lms_materials_material_type_check
    CHECK (material_type IN ('markdown', 'link', 'video')),
  ADD CONSTRAINT aspekindo_lms_materials_has_content
    CHECK (
      (
        material_type = 'markdown'
        AND content_markdown <> ''
        AND external_url = ''
        AND storage_path = ''
      )
      OR (
        material_type = 'link'
        AND external_url <> ''
        AND content_markdown = ''
        AND storage_path = ''
      )
      OR (
        material_type = 'video'
        AND storage_path <> ''
        AND content_markdown = ''
        AND external_url = ''
      )
    ),
  ADD CONSTRAINT aspekindo_lms_materials_video_metadata
    CHECK (
      (
        material_type = 'video'
        AND file_name <> ''
        AND mime_type IN ('video/mp4', 'video/webm')
        AND file_size_bytes > 0
        AND file_size_bytes <= 524288000
      )
      OR (
        material_type <> 'video'
        AND storage_path = ''
        AND file_name = ''
        AND mime_type = ''
        AND file_size_bytes = 0
      )
    );

CREATE INDEX IF NOT EXISTS aspekindo_lms_courses_public_landing_idx
  ON public.aspekindo_lms_courses (slug)
  WHERE status = 'published' AND public_landing_enabled = true;

DROP POLICY IF EXISTS "Public can view enabled ASPEKINDO LMS landing metadata"
  ON public.aspekindo_lms_courses;
CREATE POLICY "Public can view enabled ASPEKINDO LMS landing metadata"
  ON public.aspekindo_lms_courses FOR SELECT TO anon, authenticated
  USING (status = 'published' AND public_landing_enabled = true);

DROP POLICY IF EXISTS "Enrolled users can view native ASPEKINDO LMS storage"
  ON storage.objects;
CREATE POLICY "Enrolled users can view native ASPEKINDO LMS storage"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'aspekindo-learning'
    AND EXISTS (
      SELECT 1
      FROM public.aspekindo_lms_materials material
      JOIN public.aspekindo_lms_lessons lesson ON lesson.id = material.lesson_id
      JOIN public.aspekindo_lms_courses course ON course.id = lesson.course_id
      JOIN public.aspekindo_lms_enrollments enrollment
        ON enrollment.course_id = course.id
       AND enrollment.user_id = auth.uid()
       AND enrollment.status <> 'withdrawn'
      WHERE material.storage_path = storage.objects.name
        AND material.material_type = 'video'
        AND material.is_published = true
        AND lesson.is_published = true
        AND course.status = 'published'
        AND (
          course.member_only = false
          OR EXISTS (
            SELECT 1
            FROM public.aspekindo_members member
            WHERE member.user_id = auth.uid()
              AND member.membership_status = 'active'
          )
        )
    )
  );