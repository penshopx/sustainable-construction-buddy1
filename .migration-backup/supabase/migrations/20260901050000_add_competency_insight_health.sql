-- Store only the safe operational state of the latest globally persisted
-- competency insight probe. This is not a per-member history.
-- Credentials, URLs, member payloads, and provider names never belong in this table.
CREATE TABLE IF NOT EXISTS public.competency_insight_health (
  id text PRIMARY KEY CHECK (id = 'global'),
  status text NOT NULL CHECK (status IN ('connected', 'deterministic')),
  failure_reason text NOT NULL CHECK (
    failure_reason IN (
      'none',
      'not_configured',
      'authentication',
      'timeout',
      'invalid_contract',
      'unavailable',
      'source_unavailable'
    )
  ),
  last_probe_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.competency_insight_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view competency insight health"
  ON public.competency_insight_health;
CREATE POLICY "Admins can view competency insight health"
  ON public.competency_insight_health
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE INSERT, UPDATE, DELETE ON public.competency_insight_health FROM authenticated;
GRANT SELECT ON public.competency_insight_health TO authenticated;