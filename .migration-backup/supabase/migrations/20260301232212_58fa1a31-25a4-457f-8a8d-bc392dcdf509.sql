
-- Add quiz_type to module_quiz_questions
ALTER TABLE public.module_quiz_questions 
  ADD COLUMN IF NOT EXISTS quiz_type text NOT NULL DEFAULT 'chapter_test';

-- Add quiz_type to module_quiz_results
ALTER TABLE public.module_quiz_results 
  ADD COLUMN IF NOT EXISTS quiz_type text NOT NULL DEFAULT 'chapter_test';

-- Update existing questions to chapter_test (already default)
-- No action needed since default handles it
