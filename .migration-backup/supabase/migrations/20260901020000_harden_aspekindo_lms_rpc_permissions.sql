REVOKE EXECUTE ON FUNCTION public.submit_aspekindo_lms_quiz(UUID, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_aspekindo_lms_quiz(UUID, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_aspekindo_lms_quiz(UUID, JSONB) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.complete_aspekindo_lms_lesson(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_aspekindo_lms_lesson(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_aspekindo_lms_lesson(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.complete_aspekindo_lms_course(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_aspekindo_lms_course(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_aspekindo_lms_course(UUID) TO authenticated;