CREATE OR REPLACE FUNCTION public.enforce_information_article_publication()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.validate_information_article_source()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  allowed_domain TEXT;
  source_host TEXT;
BEGIN
  SELECT lower(domain)
  INTO allowed_domain
  FROM public.information_sources
  WHERE id = NEW.source_id
    AND is_active = true;

  IF allowed_domain IS NULL THEN
    RAISE EXCEPTION 'Artikel wajib memakai sumber aktif yang terdaftar';
  END IF;

  source_host := lower(substring(NEW.source_url FROM '^https://([^/:?#]+)'));
  IF source_host IS NULL
     OR NOT (
       source_host = allowed_domain
       OR source_host LIKE '%.' || allowed_domain
     ) THEN
    RAISE EXCEPTION 'URL artikel harus berada pada domain sumber yang terdaftar';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_information_article_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.title IS DISTINCT FROM NEW.title
     OR OLD.summary IS DISTINCT FROM NEW.summary
     OR OLD.body IS DISTINCT FROM NEW.body
     OR OLD.topic IS DISTINCT FROM NEW.topic
     OR OLD.source_url IS DISTINCT FROM NEW.source_url
     OR OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.information_article_revisions (article_id, snapshot, changed_by)
    VALUES (
      OLD.id,
      jsonb_build_object(
        'title', OLD.title,
        'summary', OLD.summary,
        'body', OLD.body,
        'topic', OLD.topic,
        'source_url', OLD.source_url,
        'status', OLD.status,
        'updated_at', OLD.updated_at
      ),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_information_article_publication() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_information_article_source() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_information_article_revision() FROM PUBLIC, anon, authenticated;