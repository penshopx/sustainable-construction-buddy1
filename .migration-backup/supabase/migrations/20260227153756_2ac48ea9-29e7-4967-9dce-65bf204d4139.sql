
-- Recreate the view with security_definer so it bypasses base table RLS
DROP VIEW IF EXISTS public.questions_safe;

CREATE VIEW public.questions_safe
WITH (security_barrier = true) AS
SELECT q.id, q.question_text, q.options, q.difficulty, q.domain_id, q.created_at
FROM public.questions q;

-- Grant to authenticated (view owner is superuser so it bypasses RLS)
GRANT SELECT ON public.questions_safe TO authenticated;
REVOKE SELECT ON public.questions_safe FROM anon;
