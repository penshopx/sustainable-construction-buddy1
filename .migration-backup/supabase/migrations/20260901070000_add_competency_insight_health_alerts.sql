-- Make the global health transition, alert creation, and recovery atomic.
-- The advisory lock serializes concurrent probes so one incident can emit at
-- most one alert per admin.
ALTER TABLE public.competency_insight_health
  ADD COLUMN IF NOT EXISTS incident_id uuid,
  ADD COLUMN IF NOT EXISTS consecutive_failure_count integer NOT NULL DEFAULT 0
    CHECK (consecutive_failure_count >= 0),
  ADD COLUMN IF NOT EXISTS fallback_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS alert_active boolean NOT NULL DEFAULT false;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS competency_insight_incident_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_competency_insight_active_idx
  ON public.notifications (user_id, type, competency_insight_incident_id)
  WHERE type = 'competency_insight_fallback'
    AND competency_insight_incident_id IS NOT NULL
    AND is_read = false;

CREATE OR REPLACE FUNCTION public.record_competency_insight_health(
  p_status text,
  p_failure_reason text,
  p_probe_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  previous public.competency_insight_health%ROWTYPE;
  is_failure boolean;
  is_neutral boolean;
  was_failure boolean;
  next_count integer;
  next_started_at timestamptz;
  next_alert_active boolean;
  next_incident_id uuid;
  threshold_reached boolean;
BEGIN
  IF p_status NOT IN ('connected', 'deterministic')
     OR p_failure_reason NOT IN (
       'none', 'not_configured', 'authentication', 'timeout',
       'invalid_contract', 'unavailable', 'source_unavailable'
     ) THEN
    RAISE EXCEPTION 'Invalid competency insight health state';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('competency-insight-health:global', 0));

  SELECT *
  INTO previous
  FROM public.competency_insight_health
  WHERE id = 'global'
  FOR UPDATE;

  is_failure := p_status = 'deterministic' AND p_failure_reason <> 'none';
  is_neutral := p_status = 'deterministic' AND p_failure_reason = 'none';
  was_failure := COALESCE(
    previous.status = 'deterministic' AND previous.failure_reason <> 'none',
    false
  );

  next_started_at := CASE
    WHEN is_failure THEN CASE
      WHEN was_failure AND previous.fallback_started_at IS NOT NULL
        THEN previous.fallback_started_at
      ELSE p_probe_at
    END
    WHEN is_neutral THEN previous.fallback_started_at
    ELSE NULL
  END;

  next_count := CASE
    WHEN is_failure THEN CASE
      WHEN was_failure THEN COALESCE(previous.consecutive_failure_count, 0) + 1
      ELSE 1
    END
    WHEN is_neutral THEN COALESCE(previous.consecutive_failure_count, 0)
    ELSE 0
  END;

  threshold_reached := is_failure AND (
    next_count >= 3
    OR (
      next_started_at IS NOT NULL
      AND p_probe_at - next_started_at >= interval '15 minutes'
    )
  );

  next_alert_active := CASE
    WHEN is_failure THEN threshold_reached OR COALESCE(previous.alert_active, false)
    WHEN is_neutral THEN COALESCE(previous.alert_active, false)
    ELSE false
  END;

  next_incident_id := CASE
    WHEN is_failure THEN COALESCE(previous.incident_id, gen_random_uuid())
    WHEN is_neutral THEN previous.incident_id
    ELSE NULL
  END;

  INSERT INTO public.competency_insight_health (
    id, status, failure_reason, last_probe_at, updated_at,
    incident_id, consecutive_failure_count, fallback_started_at, alert_active
  )
  VALUES (
    'global', p_status, p_failure_reason, p_probe_at, p_probe_at,
    next_incident_id, next_count, next_started_at, next_alert_active
  )
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    failure_reason = EXCLUDED.failure_reason,
    last_probe_at = EXCLUDED.last_probe_at,
    updated_at = EXCLUDED.updated_at,
    incident_id = EXCLUDED.incident_id,
    consecutive_failure_count = EXCLUDED.consecutive_failure_count,
    fallback_started_at = EXCLUDED.fallback_started_at,
    alert_active = EXCLUDED.alert_active;

  IF threshold_reached AND NOT COALESCE(previous.alert_active, false) THEN
    INSERT INTO public.notifications (
      user_id, type, title, message, competency_insight_incident_id
    )
    SELECT DISTINCT
      roles.user_id,
      'competency_insight_fallback',
      'Insight kompetensi perlu diperiksa',
      'Fallback deterministik telah berlangsung melewati ambang operasional. Periksa status layanan insight.',
      next_incident_id
    FROM public.user_roles AS roles
    WHERE public.has_role(roles.user_id, 'admin'::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;

  IF p_status = 'connected'
     AND COALESCE(previous.alert_active, false)
     AND previous.incident_id IS NOT NULL THEN
    UPDATE public.notifications
    SET is_read = true
    WHERE type = 'competency_insight_fallback'
      AND competency_insight_incident_id = previous.incident_id
      AND is_read = false;
  END IF;

  RETURN jsonb_build_object(
    'status', p_status,
    'failureReason', p_failure_reason,
    'incidentId', next_incident_id,
    'alertActive', next_alert_active
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_competency_insight_health(text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_competency_insight_health(text, text, timestamptz)
  TO service_role;