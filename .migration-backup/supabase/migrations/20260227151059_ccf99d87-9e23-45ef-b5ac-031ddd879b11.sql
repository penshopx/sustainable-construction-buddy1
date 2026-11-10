
-- Add explicit DELETE denial policies for audit-critical tables
-- and allow user self-deletion for notifications

-- 1. certificates: no user deletion allowed
CREATE POLICY "No delete on certificates"
  ON public.certificates FOR DELETE TO authenticated
  USING (false);

-- 2. contributions: no deletion for audit integrity
CREATE POLICY "No delete on contributions"
  ON public.contributions FOR DELETE TO authenticated
  USING (false);

-- 3. toolkit_activities: no deletion for scoring integrity
CREATE POLICY "No delete on toolkit_activities"
  ON public.toolkit_activities FOR DELETE TO authenticated
  USING (false);

-- 4. pre_test_answers: no deletion for test integrity
CREATE POLICY "No delete on pre_test_answers"
  ON public.pre_test_answers FOR DELETE TO authenticated
  USING (false);

-- 5. pre_tests: no deletion for audit
CREATE POLICY "No delete on pre_tests"
  ON public.pre_tests FOR DELETE TO authenticated
  USING (false);

-- 6. competency_scores: no deletion for scoring history
CREATE POLICY "No delete on competency_scores"
  ON public.competency_scores FOR DELETE TO authenticated
  USING (false);

-- 7. module_progress: no deletion to protect learning history
CREATE POLICY "No delete on module_progress"
  ON public.module_progress FOR DELETE TO authenticated
  USING (false);

-- 8. notifications: users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 9. user_subscriptions: no deletion for billing integrity
CREATE POLICY "No delete on user_subscriptions"
  ON public.user_subscriptions FOR DELETE TO authenticated
  USING (false);
