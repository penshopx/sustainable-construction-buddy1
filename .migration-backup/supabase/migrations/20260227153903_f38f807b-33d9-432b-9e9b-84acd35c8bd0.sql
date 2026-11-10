
-- Drop the problematic view
DROP VIEW IF EXISTS public.questions_safe;

-- Recreate view with security_invoker (safe approach)
CREATE VIEW public.questions_safe
WITH (security_invoker = on) AS
SELECT q.id, q.question_text, q.options, q.difficulty, q.domain_id, q.created_at
FROM public.questions q;

-- Allow all authenticated users to SELECT from base table 
-- (the view will only expose safe columns)
DROP POLICY IF EXISTS "Questions readable by admins only" ON public.questions;
CREATE POLICY "Questions readable by authenticated"
  ON public.questions FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public.questions_safe TO authenticated;
REVOKE SELECT ON public.questions_safe FROM anon;
