CREATE OR REPLACE FUNCTION public.enforce_information_article_publication()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('published', 'scheduled')
     AND NOT (
       NEW.approved_by IS NOT DISTINCT FROM auth.uid()
       AND NEW.approved_by IS NOT NULL
       AND NEW.approved_at IS NOT NULL
     )
     AND NOT (
       TG_OP = 'UPDATE'
       AND OLD.status = 'scheduled'
       AND NEW.status = 'published'
       AND NEW.approved_by IS NOT NULL
       AND NEW.approved_by IS NOT DISTINCT FROM OLD.approved_by
       AND NEW.approved_at IS NOT DISTINCT FROM OLD.approved_at
     ) THEN
    RAISE EXCEPTION 'Artikel harus disetujui melalui alur editorial sebelum diterbitkan';
  END IF;

  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;

  IF TG_OP = 'INSERT' AND NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;