-- Additive, idempotent migration for the existing Replit PostgreSQL database.
BEGIN;
ALTER TABLE clinic_cases ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;
-- Serialize the legacy snapshot with writers during rollout.
LOCK TABLE clinic_cases IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE IF NOT EXISTS clinic_case_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES clinic_cases(id),
  revision integer NOT NULL CHECK (revision >= 0),
  status text NOT NULL CHECK (status IN ('open','in_review','answered','closed')),
  operator_reply text NOT NULL,
  actor_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS clinic_case_history_case_revision ON clinic_case_history(case_id, revision);
-- No invented identity or reconstructed earlier replies for pre-history cases.
INSERT INTO clinic_case_history(case_id,revision,status,operator_reply,actor_id,created_at)
SELECT id,revision,status,operator_reply,NULL,updated_at FROM clinic_cases
ON CONFLICT (case_id,revision) DO NOTHING;
-- Only the server's database owner accesses this table; authorization lives in the API.
ALTER TABLE clinic_case_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON clinic_case_history FROM PUBLIC;
COMMIT;
