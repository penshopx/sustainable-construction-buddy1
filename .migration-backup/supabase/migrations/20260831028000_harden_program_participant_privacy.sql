-- Participant contact and attendance data is operational information.
-- Keep it available to administrators only; public program pages use
-- pub_programs, pub_program_updates, and pub_program_gallery.
DROP POLICY IF EXISTS "Participants publicly readable" ON public.pub_program_participants;