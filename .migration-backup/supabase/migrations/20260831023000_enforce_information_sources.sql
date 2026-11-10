CREATE OR REPLACE FUNCTION public.validate_information_article_source()
RETURNS TRIGGER
LANGUAGE plpgsql
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

ALTER TABLE public.information_articles
  ALTER COLUMN source_id SET NOT NULL;

CREATE TRIGGER validate_information_article_source_trigger
  BEFORE INSERT OR UPDATE OF source_id, source_url ON public.information_articles
  FOR EACH ROW EXECUTE FUNCTION public.validate_information_article_source();