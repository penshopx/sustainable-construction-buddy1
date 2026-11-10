
-- Fix 8 error-level RLS issues: recreate SELECT policies as PERMISSIVE, targeting authenticated role only

-- 1. PROFILES
DROP POLICY IF EXISTS "Users can view own profile or admin" ON public.profiles;
CREATE POLICY "Users can view own profile or admin"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 2. CERTIFICATES
DROP POLICY IF EXISTS "Users can view own certificates" ON public.certificates;
CREATE POLICY "Users can view own certificates"
  ON public.certificates FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 3. PROJECTS
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
CREATE POLICY "Users can view own projects"
  ON public.projects FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 4. BUDGET_ENTRIES
DROP POLICY IF EXISTS "Users can view own budget" ON public.budget_entries;
CREATE POLICY "Users can view own budget"
  ON public.budget_entries FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 5. RISK_REGISTERS
DROP POLICY IF EXISTS "Users can view own risks" ON public.risk_registers;
CREATE POLICY "Users can view own risks"
  ON public.risk_registers FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 6. K3_CHECKLISTS
DROP POLICY IF EXISTS "Users can view own k3 checklists" ON public.k3_checklists;
CREATE POLICY "Users can view own k3 checklists"
  ON public.k3_checklists FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 7. PRE_TESTS
DROP POLICY IF EXISTS "Users see own pre_tests or admin" ON public.pre_tests;
CREATE POLICY "Users see own pre_tests or admin"
  ON public.pre_tests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 8. USER_SUBSCRIPTIONS
DROP POLICY IF EXISTS "Users can view own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
