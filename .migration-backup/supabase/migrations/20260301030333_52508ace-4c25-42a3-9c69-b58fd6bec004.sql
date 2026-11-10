
-- Module quiz questions table
CREATE TABLE public.module_quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES public.e_course_modules(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL DEFAULT '',
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer INTEGER NOT NULL DEFAULT 0,
  explanation TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.module_quiz_questions ENABLE ROW LEVEL SECURITY;

-- Readable by authenticated users
CREATE POLICY "Quiz questions readable by authenticated" ON public.module_quiz_questions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admins can manage
CREATE POLICY "Admins can manage quiz questions" ON public.module_quiz_questions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Module quiz results table
CREATE TABLE public.module_quiz_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  module_id UUID NOT NULL REFERENCES public.e_course_modules(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.module_quiz_results ENABLE ROW LEVEL SECURITY;

-- Users can view own results
CREATE POLICY "Users can view own quiz results" ON public.module_quiz_results
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Users can insert own results
CREATE POLICY "Users can insert own quiz results" ON public.module_quiz_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);
