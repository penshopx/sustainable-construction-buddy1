
-- Drop the view - we'll use a function instead
DROP VIEW IF EXISTS public.questions_safe;

-- Create SECURITY DEFINER function to fetch questions safely
CREATE OR REPLACE FUNCTION public.get_questions_safe()
RETURNS TABLE (
  id uuid,
  question_text text,
  options jsonb,
  difficulty text,
  domain_id uuid,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.id, q.question_text, q.options, q.difficulty, q.domain_id, q.created_at
  FROM public.questions q
$$;

-- Now restrict base questions table to admins only
DROP POLICY IF EXISTS "Questions readable by authenticated" ON public.questions;
CREATE POLICY "Questions readable by admins only"
  ON public.questions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
