-- Separate editorial visibility from the program's time status.
-- Existing programs were already public before this field existed, so preserve
-- that behavior while making every newly created program a draft by default.
ALTER TABLE public.pub_programs
  ADD COLUMN publication_status TEXT NOT NULL DEFAULT 'draft';

ALTER TABLE public.pub_programs
  ADD CONSTRAINT pub_programs_publication_status_check
  CHECK (publication_status IN ('draft', 'published', 'archived'));

UPDATE public.pub_programs
SET publication_status = 'published';

DROP POLICY IF EXISTS "Programs are publicly readable" ON public.pub_programs;
CREATE POLICY "Published programs are publicly readable" ON public.pub_programs
  FOR SELECT USING (publication_status = 'published');

DROP POLICY IF EXISTS "Updates are publicly readable" ON public.pub_program_updates;
CREATE POLICY "Updates of published programs are publicly readable" ON public.pub_program_updates
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.pub_programs
      WHERE pub_programs.id = pub_program_updates.program_id
        AND pub_programs.publication_status = 'published'
    )
  );

DROP POLICY IF EXISTS "Gallery is publicly readable" ON public.pub_program_gallery;
CREATE POLICY "Gallery of published programs is publicly readable" ON public.pub_program_gallery
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.pub_programs
      WHERE pub_programs.id = pub_program_gallery.program_id
        AND pub_programs.publication_status = 'published'
    )
  );