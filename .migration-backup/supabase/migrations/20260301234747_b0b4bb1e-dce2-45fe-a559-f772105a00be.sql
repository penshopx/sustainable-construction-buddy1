
-- Storage bucket for mentor uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('mentor-uploads', 'mentor-uploads', false);

-- Storage RLS policies
CREATE POLICY "Users can upload mentor files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'mentor-uploads' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can view own mentor files" ON storage.objects FOR SELECT USING (bucket_id = 'mentor-uploads' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete own mentor files" ON storage.objects FOR DELETE USING (bucket_id = 'mentor-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Knowledge bases (learning modules, project brains)
CREATE TABLE public.mentor_knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'learning', -- 'learning' | 'project_brain'
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  file_url TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  file_type TEXT NOT NULL DEFAULT '',
  file_size BIGINT NOT NULL DEFAULT 0,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'ready' | 'error'
  chunk_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mentor_knowledge_bases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own knowledge bases" ON public.mentor_knowledge_bases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own knowledge bases" ON public.mentor_knowledge_bases FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can update own knowledge bases" ON public.mentor_knowledge_bases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own knowledge bases" ON public.mentor_knowledge_bases FOR DELETE USING (auth.uid() = user_id);

-- Text chunks extracted from knowledge bases (RAG)
CREATE TABLE public.mentor_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id UUID NOT NULL REFERENCES public.mentor_knowledge_bases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mentor_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chunks" ON public.mentor_chunks FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "System can insert chunks" ON public.mentor_chunks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own chunks" ON public.mentor_chunks FOR DELETE USING (auth.uid() = user_id);

-- External chatbot links (for KM)
CREATE TABLE public.mentor_external_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'Bot',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mentor_external_bots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own bots" ON public.mentor_external_bots FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can view active bots" ON public.mentor_external_bots FOR SELECT USING (is_active = true);

-- Mentor conversations (all 3 types)
CREATE TABLE public.mentor_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  mentor_type TEXT NOT NULL DEFAULT 'learning', -- 'learning' | 'expert' | 'project'
  title TEXT NOT NULL DEFAULT '',
  knowledge_base_id UUID REFERENCES public.mentor_knowledge_bases(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mentor_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own mentor conversations" ON public.mentor_conversations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Mentor messages
CREATE TABLE public.mentor_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.mentor_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mentor_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own mentor messages" ON public.mentor_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own mentor messages" ON public.mentor_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own mentor messages" ON public.mentor_messages FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_mentor_chunks_kb ON public.mentor_chunks(knowledge_base_id);
CREATE INDEX idx_mentor_messages_conv ON public.mentor_messages(conversation_id);
CREATE INDEX idx_mentor_kb_user ON public.mentor_knowledge_bases(user_id, type);
CREATE INDEX idx_mentor_conv_user ON public.mentor_conversations(user_id, mentor_type);
