-- Reject ambiguous schedules at the database boundary while allowing existing
-- legacy rows to remain until they are edited and normalized by an admin.
CREATE OR REPLACE FUNCTION public.is_valid_aspekindo_learning_schedule(p_schedule TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog
AS $$
DECLARE
  normalized_schedule TEXT;
  time_parts TEXT[];
  start_hour INTEGER;
  start_minute INTEGER;
  end_hour INTEGER;
  end_minute INTEGER;
BEGIN
  normalized_schedule := regexp_replace(btrim(COALESCE(p_schedule, '')), '[[:space:]]+', ' ', 'g');

  IF normalized_schedule = ''
    OR normalized_schedule ~* '^((agenda|kegiatan)[[:space:]]+)?(sehari penuh|seharian([[:space:]]+penuh)?|sepanjang hari|full day|all day)$'
  THEN
    RETURN TRUE;
  END IF;

  time_parts := regexp_match(
    normalized_schedule,
    '^([0-9]{2})[.:]([0-9]{2})[[:space:]]*(am|pm)?[[:space:]]*(-|–|—|s[.]?[[:space:]]*d[.]?|sampai|hingga|to)[[:space:]]*([0-9]{2})[.:]([0-9]{2})[[:space:]]*(am|pm)?[[:space:]]*(WIB|WITA|WIT)$',
    'i'
  );

  IF time_parts IS NULL THEN
    RETURN FALSE;
  END IF;

  start_hour := time_parts[1]::INTEGER;
  start_minute := time_parts[2]::INTEGER;
  end_hour := time_parts[5]::INTEGER;
  end_minute := time_parts[6]::INTEGER;

  IF start_minute > 59 OR end_minute > 59 THEN
    RETURN FALSE;
  END IF;

  IF time_parts[3] IS NOT NULL THEN
    IF start_hour < 1 OR start_hour > 12 THEN
      RETURN FALSE;
    END IF;
    IF lower(time_parts[3]) = 'pm' AND start_hour < 12 THEN
      start_hour := start_hour + 12;
    ELSIF lower(time_parts[3]) = 'am' AND start_hour = 12 THEN
      start_hour := 0;
    END IF;
  ELSIF start_hour > 23 THEN
    RETURN FALSE;
  END IF;

  IF time_parts[7] IS NOT NULL THEN
    IF end_hour < 1 OR end_hour > 12 THEN
      RETURN FALSE;
    END IF;
    IF lower(time_parts[7]) = 'pm' AND end_hour < 12 THEN
      end_hour := end_hour + 12;
    ELSIF lower(time_parts[7]) = 'am' AND end_hour = 12 THEN
      end_hour := 0;
    END IF;
  ELSIF end_hour > 23 THEN
    RETURN FALSE;
  END IF;

  RETURN (start_hour * 60 + start_minute) <> (end_hour * 60 + end_minute);
END;
$$;

ALTER TABLE public.aspekindo_learning_agendas
  ADD CONSTRAINT aspekindo_learning_agendas_unambiguous_schedule
  CHECK (public.is_valid_aspekindo_learning_schedule(schedule))
  NOT VALID;

COMMENT ON CONSTRAINT aspekindo_learning_agendas_unambiguous_schedule
  ON public.aspekindo_learning_agendas
  IS 'New and updated rows must use an explicit time range and Indonesian timezone, or an accepted all-day value.';