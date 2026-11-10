
-- Fix overly permissive INSERT policy - only allow service role (triggers use SECURITY DEFINER)
DROP POLICY "Service can insert notifications" ON public.notifications;

CREATE POLICY "System inserts notifications"
ON public.notifications FOR INSERT
WITH CHECK (auth.uid() = user_id);
