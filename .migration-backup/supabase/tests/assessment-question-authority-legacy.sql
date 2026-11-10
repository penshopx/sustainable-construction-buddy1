-- Applied before the authority migration to exercise real legacy backfill.
INSERT INTO public.questions(id, correct_answer) VALUES ('00000000-0000-4000-8000-000000000201', 0);
INSERT INTO public.pre_tests(id, user_id, total_questions, status)
SELECT ('00000000-0000-4000-8000-00000000030' || n)::uuid,
  '00000000-0000-4000-8000-000000000003', CASE WHEN n = 2 THEN 2 ELSE 1 END, 'in_progress'
FROM generate_series(1, 3) n;
INSERT INTO public.assessment_drafts(pre_test_id, draft) VALUES
  ('00000000-0000-4000-8000-000000000301',
   '{"questions":[{"id":"00000000-0000-4000-8000-000000000201"}]}'::jsonb),
  ('00000000-0000-4000-8000-000000000302',
   '{"questions":[{"id":"00000000-0000-4000-8000-000000000201"},{"id":"00000000-0000-4000-8000-000000000201"}]}'::jsonb);
