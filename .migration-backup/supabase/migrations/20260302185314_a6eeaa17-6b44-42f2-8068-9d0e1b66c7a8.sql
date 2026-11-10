
-- Add KTA number and check-in/check-out timestamps to pub_program_participants
ALTER TABLE public.pub_program_participants
  ADD COLUMN IF NOT EXISTS kta_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS checked_in_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS checked_out_at timestamp with time zone;
