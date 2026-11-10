-- PUB agendas and activities are rendered exclusively from the canonical
-- aspekindo_learning_agendas table. Retire any pre-existing agent drafts
-- collected from aspekindo.id before the crawler exclusion was introduced.
UPDATE public.information_articles AS article
SET status = 'rejected',
    updated_at = now()
FROM public.information_sources AS source
WHERE article.source_id = source.id
  AND source.domain = 'aspekindo.id'
  AND article.agent_run_id IS NOT NULL
  AND article.status IN ('draft', 'review', 'scheduled');

UPDATE public.information_candidates AS candidate
SET status = 'rejected',
    last_error = 'Kegiatan PUB memakai agenda kanonik; kandidat artikel otomatis dihentikan.',
    updated_at = now()
FROM public.information_sources AS source
WHERE candidate.source_id = source.id
  AND source.domain = 'aspekindo.id'
  AND candidate.status IN ('new', 'verified', 'drafted', 'duplicate', 'failed');