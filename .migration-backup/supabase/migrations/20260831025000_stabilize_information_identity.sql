-- Store the version being replaced, not the replacement itself.
CREATE OR REPLACE FUNCTION public.record_information_article_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
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

-- These admin RPCs can safely run as invoker because RLS already grants table
-- mutations to admins and the functions also perform an explicit role check.
ALTER FUNCTION public.publish_information_article(UUID) SECURITY INVOKER;
ALTER FUNCTION public.archive_information_article(UUID) SECURITY INVOKER;
ALTER FUNCTION public.schedule_information_article(UUID, TIMESTAMPTZ) SECURITY INVOKER;

REVOKE ALL ON FUNCTION public.publish_information_article(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_information_article(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.schedule_information_article(UUID, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_information_article(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_information_article(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_information_article(UUID, TIMESTAMPTZ) TO authenticated;

REVOKE ALL ON FUNCTION public.publish_due_information_articles() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_due_information_articles() TO service_role;