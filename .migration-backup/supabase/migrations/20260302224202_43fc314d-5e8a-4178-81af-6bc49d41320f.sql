
-- Custom chatbots table
CREATE TABLE public.custom_chatbots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  avatar_url text NOT NULL DEFAULT '',
  mode text NOT NULL DEFAULT 'pembelajaran',
  persona text NOT NULL DEFAULT '',
  welcome_message text NOT NULL DEFAULT '',
  tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_public boolean NOT NULL DEFAULT false,
  share_token text UNIQUE DEFAULT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_chatbots ENABLE ROW LEVEL SECURITY;

-- Owner full access
CREATE POLICY "Users can CRUD own chatbots"
  ON public.custom_chatbots FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Public profesi bots visible to all authenticated
CREATE POLICY "Anyone can view public profesi bots"
  ON public.custom_chatbots FOR SELECT
  USING (is_public = true AND mode = 'profesi');

-- Shared bots via share_token visible to authenticated
CREATE POLICY "Shared bots visible via token"
  ON public.custom_chatbots FOR SELECT
  USING (share_token IS NOT NULL AND auth.uid() IS NOT NULL);

-- Admin can manage profesi bots
CREATE POLICY "Admins can manage all profesi bots"
  ON public.custom_chatbots FOR ALL
  USING (has_role(auth.uid(), 'admin') AND mode = 'profesi')
  WITH CHECK (has_role(auth.uid(), 'admin') AND mode = 'profesi');

-- Knowledge base links (many-to-many)
CREATE TABLE public.chatbot_knowledge_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid NOT NULL REFERENCES public.custom_chatbots(id) ON DELETE CASCADE,
  knowledge_base_id uuid NOT NULL REFERENCES public.mentor_knowledge_bases(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(chatbot_id, knowledge_base_id)
);

ALTER TABLE public.chatbot_knowledge_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own chatbot knowledge links"
  ON public.chatbot_knowledge_links FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.custom_chatbots c WHERE c.id = chatbot_id AND c.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.custom_chatbots c WHERE c.id = chatbot_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "View links for accessible chatbots"
  ON public.chatbot_knowledge_links FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.custom_chatbots c
    WHERE c.id = chatbot_id AND (
      c.user_id = auth.uid()
      OR (c.is_public = true AND c.mode = 'profesi')
      OR c.share_token IS NOT NULL
    )
  ));

-- Add chatbot_id to helpdesk_conversations
ALTER TABLE public.helpdesk_conversations
  ADD COLUMN chatbot_id uuid REFERENCES public.custom_chatbots(id) ON DELETE SET NULL DEFAULT NULL;

-- Storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('chatbot-avatars', 'chatbot-avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own chatbot avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chatbot-avatars' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view chatbot avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chatbot-avatars');

CREATE POLICY "Users can update own chatbot avatars"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'chatbot-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own chatbot avatars"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'chatbot-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Trigger for updated_at
CREATE TRIGGER update_custom_chatbots_updated_at
  BEFORE UPDATE ON public.custom_chatbots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
