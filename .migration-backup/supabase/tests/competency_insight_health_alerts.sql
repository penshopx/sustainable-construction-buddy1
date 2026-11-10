-- Run after all migrations. Every write is rolled back.
-- This exercises the real PostgreSQL transition function, lock boundary,
-- incident identity, admin targeting, and recovery scoping.
BEGIN;

DELETE FROM public.notifications
WHERE type = 'competency_insight_fallback';
DELETE FROM public.competency_insight_health
WHERE id = 'global';

SELECT public.record_competency_insight_health(
  'deterministic', 'timeout', '2099-01-01T00:00:00Z'
);
SELECT public.record_competency_insight_health(
  'deterministic', 'unavailable', '2099-01-01T00:01:00Z'
);

DO $$
BEGIN
  IF (SELECT alert_active FROM public.competency_insight_health WHERE id = 'global') THEN
    RAISE EXCEPTION 'Alert must not open before the third failure';
  END IF;
  IF (SELECT COUNT(*) FROM public.notifications
      WHERE type = 'competency_insight_fallback') <> 0 THEN
    RAISE EXCEPTION 'No alert may be sent before the third failure';
  END IF;
END;
$$;

SELECT public.record_competency_insight_health(
  'deterministic', 'timeout', '2099-01-01T00:02:00Z'
);

DO $$
DECLARE
  active_incident uuid;
  expected_admins bigint;
  alert_rows bigint;
BEGIN
  SELECT incident_id INTO active_incident
  FROM public.competency_insight_health
  WHERE id = 'global';

  SELECT COUNT(DISTINCT user_id) INTO expected_admins
  FROM public.user_roles
  WHERE public.has_role(user_id, 'admin'::public.app_role);

  SELECT COUNT(*) INTO alert_rows
  FROM public.notifications
  WHERE type = 'competency_insight_fallback'
    AND competency_insight_incident_id = active_incident
    AND is_read = false;

  IF active_incident IS NULL OR NOT (SELECT alert_active FROM public.competency_insight_health WHERE id = 'global') THEN
    RAISE EXCEPTION 'The third failure must open an incident';
  END IF;
  IF alert_rows <> expected_admins THEN
    RAISE EXCEPTION 'Exactly one unread alert per admin is required';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.notifications notifications
    WHERE notifications.type = 'competency_insight_fallback'
      AND NOT EXISTS (
        SELECT 1 FROM public.user_roles roles
        WHERE roles.user_id = notifications.user_id
          AND public.has_role(roles.user_id, 'admin'::public.app_role)
      )
  ) THEN
    RAISE EXCEPTION 'Non-admin users must never receive insight alerts';
  END IF;

  UPDATE public.notifications
  SET is_read = true
  WHERE type = 'competency_insight_fallback'
    AND competency_insight_incident_id = active_incident;

  IF expected_admins > 0 THEN
    BEGIN
      INSERT INTO public.notifications (
        user_id, type, title, message, competency_insight_incident_id
      )
      SELECT user_id, 'competency_insight_fallback', 'Duplicate test incident', 'Test',
             active_incident
      FROM public.user_roles
      WHERE public.has_role(user_id, 'admin'::public.app_role)
      LIMIT 1;
      RAISE EXCEPTION 'A read alert for the same incident must remain unique';
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END IF;

  UPDATE public.notifications
  SET is_read = false
  WHERE type = 'competency_insight_fallback'
    AND competency_insight_incident_id = active_incident;

  INSERT INTO public.notifications (
    user_id, type, title, message, competency_insight_incident_id
  )
  SELECT user_id, 'competency_insight_fallback', 'Unrelated test incident', 'Test',
         '00000000-0000-4000-8000-000000000499'::uuid
  FROM public.user_roles
  WHERE public.has_role(user_id, 'admin'::public.app_role)
  LIMIT 1
  ON CONFLICT DO NOTHING;
END;
$$;

-- A neutral deterministic probe must not close the active incident.
SELECT public.record_competency_insight_health(
  'deterministic', 'none', '2099-01-01T00:03:00Z'
);
DO $$
BEGIN
  IF NOT (SELECT alert_active FROM public.competency_insight_health WHERE id = 'global') THEN
    RAISE EXCEPTION 'Neutral deterministic probes must not close an incident';
  END IF;
END;
$$;

SELECT public.record_competency_insight_health(
  'connected', 'none', '2099-01-01T00:04:00Z'
);

DO $$
BEGIN
  IF (SELECT alert_active FROM public.competency_insight_health WHERE id = 'global') THEN
    RAISE EXCEPTION 'Connected recovery must close the active incident';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.notifications notifications
    JOIN public.competency_insight_health health ON health.id = 'global'
    WHERE notifications.type = 'competency_insight_fallback'
      AND notifications.competency_insight_incident_id <> '00000000-0000-4000-8000-000000000499'::uuid
      AND notifications.is_read = false
  ) THEN
    RAISE EXCEPTION 'Recovery must close every alert for the active incident';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE type = 'competency_insight_fallback'
      AND competency_insight_incident_id = '00000000-0000-4000-8000-000000000499'::uuid
      AND is_read = false
  ) THEN
    RAISE EXCEPTION 'Recovery must not close another incident';
  END IF;
END;
$$;

ROLLBACK;