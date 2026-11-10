-- Expose only approved landing metadata instead of granting anonymous table access.

DROP POLICY IF EXISTS "Public can view enabled ASPEKINDO LMS landing metadata"
  ON public.aspekindo_lms_courses;

CREATE OR REPLACE FUNCTION public.get_public_aspekindo_lms_course(_slug TEXT)
RETURNS TABLE (
  id UUID,
  course_code TEXT,
  slug TEXT,
  title TEXT,
  description_markdown TEXT,
  audience TEXT,
  member_only BOOLEAN,
  siap_focus TEXT,
  published_at TIMESTAMPTZ,
  public_landing_enabled BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    course.id,
    course.course_code,
    course.slug,
    course.title,
    course.description_markdown,
    course.audience,
    course.member_only,
    course.siap_focus,
    course.published_at,
    course.public_landing_enabled
  FROM public.aspekindo_lms_courses course
  WHERE course.slug = _slug
    AND course.status = 'published'
    AND course.public_landing_enabled = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_aspekindo_lms_course(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_aspekindo_lms_course(TEXT) TO anon, authenticated;