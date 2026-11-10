-- Track only aggregate operational state required to suppress transient alerts.
-- No provider, endpoint, credential, or member payload is stored here.
ALTER TABLE public.competency_insight_health
  ADD COLUMN IF NOT EXISTS consecutive_failure_count integer NOT NULL DEFAULT 0
    CHECK (consecutive_failure_count >= 0),
  ADD COLUMN IF NOT EXISTS fallback_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS alert_active boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.competency_insight_health.consecutive_failure_count
  IS 'Consecutive deterministic fallback probes for the global insight health state.';
COMMENT ON COLUMN public.competency_insight_health.fallback_started_at
  IS 'Start time of the current deterministic fallback incident.';
COMMENT ON COLUMN public.competency_insight_health.alert_active
  IS 'Whether the current global fallback incident has crossed the admin alert threshold.';