
-- Create comments table for innovation proposals
CREATE TABLE public.innovation_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.innovation_proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.innovation_comments ENABLE ROW LEVEL SECURITY;

-- Users can view comments on their own proposals; admins can view all
CREATE POLICY "Users can view comments on own proposals"
ON public.innovation_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.innovation_proposals ip
    WHERE ip.id = innovation_comments.proposal_id
    AND (ip.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Authenticated users can insert comments on proposals they own or admin
CREATE POLICY "Users can insert comments"
ON public.innovation_comments FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.innovation_proposals ip
    WHERE ip.id = innovation_comments.proposal_id
    AND (ip.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
ON public.innovation_comments FOR DELETE
USING (auth.uid() = user_id);
