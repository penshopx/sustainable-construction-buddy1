-- Editorial information center for PUB ASPEKINDO.
-- Industry news is collected into a review queue; PUB activities remain
-- canonical in aspekindo_learning_agendas and are projected by the public UI.

CREATE TABLE public.information_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  base_url TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'official'
    CHECK (source_type IN ('official', 'institution', 'industry')),
  trust_level TEXT NOT NULL DEFAULT 'primary'
    CHECK (trust_level IN ('primary', 'secondary')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  check_interval_minutes INTEGER NOT NULL DEFAULT 60
    CHECK (check_interval_minutes BETWEEN 15 AND 10080),
  last_checked_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT information_sources_https_base_url CHECK (base_url ~* '^https://')
);

CREATE TABLE public.information_agent_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name TEXT NOT NULL
    CHECK (agent_name IN ('scout', 'verifier', 'editor', 'curator', 'publisher', 'change_monitor')),
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed', 'partial')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  items_found INTEGER NOT NULL DEFAULT 0 CHECK (items_found >= 0),
  items_created INTEGER NOT NULL DEFAULT 0 CHECK (items_created >= 0),
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.information_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel TEXT NOT NULL DEFAULT 'industry'
    CHECK (channel IN ('industry', 'pub')),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT 'Umum',
  source_id UUID REFERENCES public.information_sources(id) ON DELETE SET NULL,
  source_url TEXT NOT NULL,
  source_title TEXT NOT NULL DEFAULT '',
  source_published_at TIMESTAMPTZ,
  source_updated_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'scheduled', 'published', 'archived', 'rejected')),
  featured BOOLEAN NOT NULL DEFAULT false,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  agent_run_id UUID REFERENCES public.information_agent_runs(id) ON DELETE SET NULL,
  content_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT information_articles_https_source_url CHECK (source_url ~* '^https://'),
  CONSTRAINT information_articles_approval_pair CHECK (
    (approved_by IS NULL AND approved_at IS NULL) OR
    (approved_by IS NOT NULL AND approved_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX information_articles_content_hash_idx
  ON public.information_articles(content_hash)
  WHERE content_hash IS NOT NULL;

CREATE INDEX information_articles_public_feed_idx
  ON public.information_articles(status, published_at DESC, featured DESC);

CREATE INDEX information_articles_channel_topic_idx
  ON public.information_articles(channel, topic, updated_at DESC);

CREATE TABLE public.information_candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES public.information_sources(id) ON DELETE CASCADE,
  canonical_url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  excerpt TEXT NOT NULL DEFAULT '',
  fetched_content TEXT NOT NULL DEFAULT '',
  content_hash TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'verified', 'rejected', 'drafted', 'duplicate', 'failed')),
  article_id UUID REFERENCES public.information_articles(id) ON DELETE SET NULL,
  last_fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  agent_run_id UUID REFERENCES public.information_agent_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT information_candidates_https_url CHECK (canonical_url ~* '^https://')
);

CREATE INDEX information_candidates_processing_idx
  ON public.information_candidates(status, last_fetched_at DESC);

CREATE TABLE public.information_article_revisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID NOT NULL REFERENCES public.information_articles(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  change_reason TEXT NOT NULL DEFAULT 'Pembaruan editorial',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.enforce_information_article_publication()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('published', 'scheduled')
     AND (NEW.approved_by IS DISTINCT FROM auth.uid() OR NEW.approved_at IS NULL) THEN
    RAISE EXCEPTION 'Artikel harus disetujui melalui alur editorial sebelum diterbitkan';
  END IF;

  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;

  RETURN NEW;
END;
$$;

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
      NEW.id,
      jsonb_build_object(
        'title', NEW.title,
        'summary', NEW.summary,
        'body', NEW.body,
        'topic', NEW.topic,
        'source_url', NEW.source_url,
        'status', NEW.status,
        'updated_at', NEW.updated_at
      ),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_information_article(p_article_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Hanya admin yang dapat menerbitkan artikel';
  END IF;

  UPDATE public.information_articles
  SET
    status = 'published',
    approved_by = auth.uid(),
    approved_at = now(),
    published_at = COALESCE(published_at, now()),
    updated_at = now()
  WHERE id = p_article_id
    AND status IN ('draft', 'review', 'scheduled');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Artikel tidak ditemukan atau tidak berada dalam antrean review';
  END IF;

  RETURN p_article_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_information_article(p_article_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Hanya admin yang dapat mengarsipkan artikel';
  END IF;

  UPDATE public.information_articles
  SET status = 'archived', updated_at = now()
  WHERE id = p_article_id
    AND status IN ('published', 'scheduled', 'review', 'draft');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Artikel tidak ditemukan';
  END IF;

  RETURN p_article_id;
END;
$$;

CREATE TRIGGER enforce_information_article_publication_trigger
  BEFORE INSERT OR UPDATE ON public.information_articles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_information_article_publication();

CREATE TRIGGER record_information_article_revision_trigger
  AFTER UPDATE ON public.information_articles
  FOR EACH ROW EXECUTE FUNCTION public.record_information_article_revision();

CREATE TRIGGER update_information_sources_updated_at
  BEFORE UPDATE ON public.information_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_information_articles_updated_at
  BEFORE UPDATE ON public.information_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_information_candidates_updated_at
  BEFORE UPDATE ON public.information_candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.information_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.information_agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.information_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.information_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.information_article_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active information sources are public"
  ON public.information_sources FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins manage information sources"
  ON public.information_sources FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Published information is public"
  ON public.information_articles FOR SELECT
  USING (
    status = 'published'
    AND published_at IS NOT NULL
    AND published_at <= now()
  );

CREATE POLICY "Admins manage information articles"
  ON public.information_articles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins view agent runs"
  ON public.information_agent_runs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins view information candidates"
  ON public.information_candidates FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins view article revisions"
  ON public.information_article_revisions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

GRANT EXECUTE ON FUNCTION public.publish_information_article(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_information_article(UUID) TO authenticated;

INSERT INTO public.information_sources (name, domain, base_url, source_type, trust_level)
VALUES
  ('Kementerian Pekerjaan Umum', 'pu.go.id', 'https://pu.go.id', 'official', 'primary'),
  ('LPJK', 'lpjk.pu.go.id', 'https://lpjk.pu.go.id', 'official', 'primary'),
  ('LKPP', 'lkpp.go.id', 'https://lkpp.go.id', 'official', 'primary'),
  ('ASPEKINDO', 'aspekindo.id', 'https://aspekindo.id', 'institution', 'primary')
ON CONFLICT (domain) DO UPDATE
SET name = EXCLUDED.name,
    base_url = EXCLUDED.base_url,
    source_type = EXCLUDED.source_type,
    trust_level = EXCLUDED.trust_level,
    updated_at = now();