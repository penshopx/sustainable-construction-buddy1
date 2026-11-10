
-- =====================================================
-- SPRINT 1: Foundation tables for new features
-- =====================================================

-- 1. Projects table (Project Workspace)
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bujk_name TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  contract_type TEXT NOT NULL DEFAULT 'lumpsum',
  value_amount BIGINT NOT NULL DEFAULT 0,
  duration_months INTEGER NOT NULL DEFAULT 0,
  multidiscipline BOOLEAN NOT NULL DEFAULT false,
  risk_class TEXT NOT NULL DEFAULT 'low',
  complexity_score INTEGER NOT NULL DEFAULT 0,
  location TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Risk Registers
CREATE TABLE public.risk_registers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  risk_description TEXT NOT NULL DEFAULT '',
  impact_score INTEGER NOT NULL DEFAULT 1,
  probability_score INTEGER NOT NULL DEFAULT 1,
  risk_level TEXT GENERATED ALWAYS AS (
    CASE 
      WHEN impact_score * probability_score >= 15 THEN 'critical'
      WHEN impact_score * probability_score >= 9 THEN 'high'
      WHEN impact_score * probability_score >= 4 THEN 'medium'
      ELSE 'low'
    END
  ) STORED,
  mitigation_action TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.risk_registers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own risks" ON public.risk_registers FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create own risks" ON public.risk_registers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own risks" ON public.risk_registers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own risks" ON public.risk_registers FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_risk_registers_updated_at BEFORE UPDATE ON public.risk_registers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Budget Entries (Cashflow Tracker)
CREATE TABLE public.budget_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT '',
  planned_amount BIGINT NOT NULL DEFAULT 0,
  actual_amount BIGINT NOT NULL DEFAULT 0,
  deviation_percent NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN planned_amount > 0 THEN ((actual_amount - planned_amount)::NUMERIC / planned_amount * 100) ELSE 0 END
  ) STORED,
  period_month TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  mitigation_plan TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own budget" ON public.budget_entries FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create own budget" ON public.budget_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budget" ON public.budget_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own budget" ON public.budget_entries FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_budget_entries_updated_at BEFORE UPDATE ON public.budget_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Toolkit Activities (tracking all toolkit usage for scoring)
CREATE TABLE public.toolkit_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  tool_type TEXT NOT NULL,
  entity_id UUID,
  completeness INTEGER NOT NULL DEFAULT 0,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.toolkit_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activities" ON public.toolkit_activities FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create own activities" ON public.toolkit_activities FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Contributions (sharing, SOP, mentoring, etc.)
CREATE TABLE public.contributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  evidence_url TEXT NOT NULL DEFAULT '',
  points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contributions" ON public.contributions FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create own contributions" ON public.contributions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. Competency Score Snapshots (monthly scoring)
CREATE TABLE public.competency_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  period TEXT NOT NULL,
  learning_points INTEGER NOT NULL DEFAULT 0,
  toolkit_points INTEGER NOT NULL DEFAULT 0,
  project_points INTEGER NOT NULL DEFAULT 0,
  contribution_points INTEGER NOT NULL DEFAULT 0,
  total_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, period)
);

ALTER TABLE public.competency_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scores" ON public.competency_scores FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "System can insert scores" ON public.competency_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "System can update scores" ON public.competency_scores FOR UPDATE USING (auth.uid() = user_id);

-- 7. User Subscriptions (Freemium)
CREATE TABLE public.user_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" ON public.user_subscriptions FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create own subscription" ON public.user_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subscription" ON public.user_subscriptions FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.user_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create free subscription on new user
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan)
  VALUES (NEW.id, 'free');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- Indexes for performance
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_risk_registers_project_id ON public.risk_registers(project_id);
CREATE INDEX idx_risk_registers_user_id ON public.risk_registers(user_id);
CREATE INDEX idx_budget_entries_project_id ON public.budget_entries(project_id);
CREATE INDEX idx_budget_entries_user_id ON public.budget_entries(user_id);
CREATE INDEX idx_toolkit_activities_user_id ON public.toolkit_activities(user_id);
CREATE INDEX idx_contributions_user_id ON public.contributions(user_id);
CREATE INDEX idx_competency_scores_user_id ON public.competency_scores(user_id);
