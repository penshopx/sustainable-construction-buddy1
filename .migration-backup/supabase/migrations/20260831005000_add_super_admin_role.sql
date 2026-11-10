-- PostgreSQL requires a newly-added enum value to be committed before it is
-- used by another statement. Keep this migration separate from role seeding.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';