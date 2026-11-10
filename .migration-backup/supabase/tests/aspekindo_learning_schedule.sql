-- Run after all migrations. Every write is rolled back.
BEGIN;

INSERT INTO public.aspekindo_learning_agendas (
  id,
  title,
  description,
  audience,
  start_date,
  schedule
)
VALUES
  ('00000000-0000-4000-8000-000000000501', 'Valid WIB', 'Test', 'Test', '2099-01-01', '09.00–12.00 WIB'),
  ('00000000-0000-4000-8000-000000000502', 'Valid WITA', 'Test', 'Test', '2099-01-01', '13:15–16:45 WITA'),
  ('00000000-0000-4000-8000-000000000503', 'Valid WIT', 'Test', 'Test', '2099-01-01', '08.30–10.00 WIT'),
  ('00000000-0000-4000-8000-000000000504', 'Valid overnight', 'Test', 'Test', '2099-01-01', '22:00–01:30 WIB'),
  ('00000000-0000-4000-8000-000000000505', 'Valid all day', 'Test', 'Test', '2099-01-01', 'Sehari penuh');

DO $$
BEGIN
  BEGIN
    INSERT INTO public.aspekindo_learning_agendas (
      id,
      title,
      description,
      audience,
      start_date,
      schedule
    )
    VALUES (
      '00000000-0000-4000-8000-000000000506',
      'Ambiguous insert',
      'Test',
      'Test',
      '2099-01-01',
      'menyusul'
    );

    RAISE EXCEPTION 'Expected ambiguous INSERT to fail';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END;
$$;

ALTER TABLE public.aspekindo_learning_agendas
  DISABLE TRIGGER enforce_aspekindo_learning_schedule;

INSERT INTO public.aspekindo_learning_agendas (
  id,
  title,
  description,
  audience,
  start_date,
  schedule
)
VALUES (
  '00000000-0000-4000-8000-000000000507',
  'Legacy ambiguous row',
  'Test',
  'Test',
  '2099-01-01',
  'menyusul'
);

ALTER TABLE public.aspekindo_learning_agendas
  ENABLE TRIGGER enforce_aspekindo_learning_schedule;

-- Metadata-only updates must remain possible for legacy rows.
UPDATE public.aspekindo_learning_agendas
SET status = 'archived'
WHERE id = '00000000-0000-4000-8000-000000000507';

DO $$
BEGIN
  BEGIN
    UPDATE public.aspekindo_learning_agendas
    SET schedule = 'belum ditentukan'
    WHERE id = '00000000-0000-4000-8000-000000000507';

    RAISE EXCEPTION 'Expected ambiguous schedule UPDATE to fail';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END;
$$;

UPDATE public.aspekindo_learning_agendas
SET schedule = 'Sehari penuh'
WHERE id = '00000000-0000-4000-8000-000000000507';

ROLLBACK;