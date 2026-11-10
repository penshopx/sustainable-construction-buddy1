-- Preserve legacy agenda rows until their schedule is explicitly changed.
-- A CHECK constraint runs for every UPDATE, including status-only updates, so
-- schedule validation belongs in a column-specific trigger instead.
BEGIN;

ALTER TABLE public.aspekindo_learning_agendas
  DROP CONSTRAINT IF EXISTS aspekindo_learning_agendas_unambiguous_schedule;

CREATE OR REPLACE FUNCTION public.enforce_valid_aspekindo_learning_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_valid_aspekindo_learning_schedule(NEW.schedule) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'aspekindo_learning_agendas_unambiguous_schedule',
        MESSAGE = 'Agenda schedule must use an explicit time range and Indonesian timezone, or an accepted all-day value.';
    END IF;
  ELSIF NEW.schedule IS DISTINCT FROM OLD.schedule THEN
    IF NOT public.is_valid_aspekindo_learning_schedule(NEW.schedule) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'aspekindo_learning_agendas_unambiguous_schedule',
        MESSAGE = 'Agenda schedule must use an explicit time range and Indonesian timezone, or an accepted all-day value.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_aspekindo_learning_schedule
  ON public.aspekindo_learning_agendas;

CREATE TRIGGER enforce_aspekindo_learning_schedule
  BEFORE INSERT OR UPDATE OF schedule
  ON public.aspekindo_learning_agendas
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_valid_aspekindo_learning_schedule();

COMMENT ON TRIGGER enforce_aspekindo_learning_schedule
  ON public.aspekindo_learning_agendas
  IS 'Validates new schedules and explicit schedule changes while allowing metadata-only updates to legacy rows.';

COMMIT;