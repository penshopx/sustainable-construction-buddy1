CREATE OR REPLACE FUNCTION public.enforce_information_article_publication()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('published', 'scheduled')
     AND NOT (
       NEW.approved_by = auth.uid()
       AND NEW.approved_at IS NOT NULL
     )
     AND NOT (
       TG_OP = 'UPDATE'
       AND OLD.status = 'scheduled'
       AND NEW.status = 'published'
       AND NEW.approved_by = OLD.approved_by
       AND NEW.approved_at = OLD.approved_at
     ) THEN
    RAISE EXCEPTION 'Artikel harus disetujui melalui alur editorial sebelum diterbitkan';
  END IF;

  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_information_article(
  p_article_id UUID,
  p_scheduled_at TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Hanya admin yang dapat menjadwalkan artikel';
  END IF;

  IF p_scheduled_at <= now() THEN
    RAISE EXCEPTION 'Jadwal publikasi harus berada di masa depan';
  END IF;

  UPDATE public.information_articles
  SET
    status = 'scheduled',
    scheduled_at = p_scheduled_at,
    approved_by = auth.uid(),
    approved_at = now(),
    updated_at = now()
  WHERE id = p_article_id
    AND status IN ('draft', 'review');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Artikel tidak ditemukan atau tidak dapat dijadwalkan';
  END IF;

  RETURN p_article_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_due_information_articles()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Operasi ini hanya tersedia untuk runner publikasi';
  END IF;

  UPDATE public.information_articles
  SET
    status = 'published',
    published_at = now(),
    updated_at = now()
  WHERE status = 'scheduled'
    AND scheduled_at IS NOT NULL
    AND scheduled_at <= now();

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

GRANT EXECUTE ON FUNCTION public.schedule_information_article(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_due_information_articles() TO service_role;