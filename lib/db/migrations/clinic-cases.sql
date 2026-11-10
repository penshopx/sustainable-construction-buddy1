-- Additive migration for the existing Replit PostgreSQL database, not Supabase.
CREATE TABLE IF NOT EXISTS clinic_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  topic_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('consultation','feedback')),
  subject text NOT NULL,
  description text NOT NULL,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','answered','closed')),
  operator_reply text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clinic_cases_owner_created ON clinic_cases(owner_id, created_at);
