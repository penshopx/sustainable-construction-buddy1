
-- Revoke anon SELECT access from all sensitive tables
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.certificates FROM anon;
REVOKE SELECT ON public.projects FROM anon;
REVOKE SELECT ON public.budget_entries FROM anon;
REVOKE SELECT ON public.risk_registers FROM anon;
REVOKE SELECT ON public.k3_checklists FROM anon;
REVOKE SELECT ON public.k3_checklist_items FROM anon;
REVOKE SELECT ON public.pre_tests FROM anon;
REVOKE SELECT ON public.pre_test_answers FROM anon;
REVOKE SELECT ON public.user_subscriptions FROM anon;
REVOKE SELECT ON public.user_roles FROM anon;
REVOKE SELECT ON public.competency_scores FROM anon;
REVOKE SELECT ON public.contributions FROM anon;
REVOKE SELECT ON public.module_progress FROM anon;
REVOKE SELECT ON public.notifications FROM anon;
REVOKE SELECT ON public.toolkit_activities FROM anon;
REVOKE SELECT ON public.rate_limits FROM anon;
