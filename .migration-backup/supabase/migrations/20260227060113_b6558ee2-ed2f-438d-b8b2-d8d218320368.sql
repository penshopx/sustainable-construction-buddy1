
-- K3 Safety Checklist table
CREATE TABLE public.k3_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  inspector_name TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  total_items INTEGER NOT NULL DEFAULT 0,
  completed_items INTEGER NOT NULL DEFAULT 0,
  score_percent NUMERIC GENERATED ALWAYS AS (
    CASE WHEN total_items > 0 THEN ROUND((completed_items::numeric / total_items) * 100, 1) ELSE 0 END
  ) STORED,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- K3 checklist items
CREATE TABLE public.k3_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_id UUID NOT NULL REFERENCES public.k3_checklists(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT '',
  item_text TEXT NOT NULL DEFAULT '',
  is_compliant BOOLEAN NOT NULL DEFAULT false,
  finding TEXT NOT NULL DEFAULT '',
  corrective_action TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.k3_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.k3_checklist_items ENABLE ROW LEVEL SECURITY;

-- K3 checklist policies
CREATE POLICY "Users can view own k3 checklists" ON public.k3_checklists
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create own k3 checklists" ON public.k3_checklists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own k3 checklists" ON public.k3_checklists
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own k3 checklists" ON public.k3_checklists
  FOR DELETE USING (auth.uid() = user_id);

-- K3 items policies (via checklist ownership)
CREATE POLICY "Users can view own k3 items" ON public.k3_checklist_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.k3_checklists WHERE id = checklist_id AND (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)))
  );

CREATE POLICY "Users can create k3 items" ON public.k3_checklist_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.k3_checklists WHERE id = checklist_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can update k3 items" ON public.k3_checklist_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.k3_checklists WHERE id = checklist_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can delete k3 items" ON public.k3_checklist_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.k3_checklists WHERE id = checklist_id AND user_id = auth.uid())
  );

-- Updated_at trigger
CREATE TRIGGER update_k3_checklists_updated_at
  BEFORE UPDATE ON public.k3_checklists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
