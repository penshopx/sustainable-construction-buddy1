
-- Table to log proposal status changes
CREATE TABLE public.innovation_proposal_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.innovation_proposals(id) ON DELETE CASCADE,
  old_status TEXT NOT NULL DEFAULT '',
  new_status TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  changed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.innovation_proposal_logs ENABLE ROW LEVEL SECURITY;

-- Users can view logs for their own proposals, admins can view all
CREATE POLICY "Users can view own proposal logs"
  ON public.innovation_proposal_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.innovation_proposals ip
      WHERE ip.id = proposal_id AND (ip.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
  );

-- Only system/trigger inserts logs
CREATE POLICY "System inserts proposal logs"
  ON public.innovation_proposal_logs
  FOR INSERT
  WITH CHECK (true);

-- Trigger to auto-log status changes
CREATE OR REPLACE FUNCTION public.log_innovation_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.innovation_proposal_logs (proposal_id, old_status, new_status, notes, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.admin_notes, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_innovation_status_log
  AFTER UPDATE ON public.innovation_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.log_innovation_status_change();

-- Backfill existing proposals with initial log entry
INSERT INTO public.innovation_proposal_logs (proposal_id, old_status, new_status, notes)
SELECT id, 'draft', status, admin_notes FROM public.innovation_proposals WHERE status != 'draft';
