-- An insight incident has one notification per recipient for its entire
-- lifecycle. Read status must not allow the same incident to be inserted
-- again, otherwise a retry or future code path can create duplicate alerts.
DROP INDEX IF EXISTS public.notifications_competency_insight_active_idx;

CREATE UNIQUE INDEX notifications_competency_insight_incident_idx
  ON public.notifications (user_id, type, competency_insight_incident_id)
  WHERE type = 'competency_insight_fallback'
    AND competency_insight_incident_id IS NOT NULL;