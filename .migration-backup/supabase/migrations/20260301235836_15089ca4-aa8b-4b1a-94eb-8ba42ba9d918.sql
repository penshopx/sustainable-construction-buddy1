
-- Add summary column to chunks for per-chunk summaries
ALTER TABLE public.mentor_chunks ADD COLUMN summary TEXT NOT NULL DEFAULT '';

-- Add overall summary to knowledge base
ALTER TABLE public.mentor_knowledge_bases ADD COLUMN summary TEXT NOT NULL DEFAULT '';

-- Add keywords column for smart retrieval
ALTER TABLE public.mentor_chunks ADD COLUMN keywords TEXT NOT NULL DEFAULT '';
