
DROP POLICY "System inserts proposal logs" ON public.innovation_proposal_logs;

-- Only allow inserts from authenticated users (trigger runs as definer anyway)
CREATE POLICY "Authenticated inserts proposal logs"
  ON public.innovation_proposal_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
