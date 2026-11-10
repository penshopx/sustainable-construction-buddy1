-- Attribute every native LMS course to exactly one 4 SIAP dimension.
-- Existing courses inherit the focus of their first linked PUB activity when available.

ALTER TABLE public.aspekindo_lms_courses
  ADD COLUMN siap_focus TEXT NOT NULL DEFAULT 'sertifikasi';

UPDATE public.aspekindo_lms_courses course
SET siap_focus = linked.siap_focus
FROM (
  SELECT DISTINCT ON (session.course_id)
    session.course_id,
    activity.siap_focus
  FROM public.aspekindo_lms_sessions session
  JOIN public.aspekindo_pub_activities activity
    ON activity.id = session.source_activity_id
  WHERE activity.siap_focus IN ('legalitas', 'sertifikasi', 'tender', 'proyek')
  ORDER BY session.course_id, session.sort_order, session.created_at
) linked
WHERE linked.course_id = course.id;

ALTER TABLE public.aspekindo_lms_courses
  ADD CONSTRAINT aspekindo_lms_courses_siap_focus
  CHECK (siap_focus IN ('legalitas', 'sertifikasi', 'tender', 'proyek'));

CREATE INDEX aspekindo_lms_courses_siap_focus_idx
  ON public.aspekindo_lms_courses (siap_focus, status);