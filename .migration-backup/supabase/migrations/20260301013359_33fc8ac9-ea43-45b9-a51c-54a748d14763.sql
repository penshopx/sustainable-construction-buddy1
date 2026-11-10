
CREATE TABLE public.bujk_directory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_name text NOT NULL DEFAULT '',
  nib text NOT NULL DEFAULT '',
  npwp text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  province text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  qualification text NOT NULL DEFAULT 'menengah',
  sub_classification text NOT NULL DEFAULT '',
  sbu_number text NOT NULL DEFAULT '',
  sbu_expiry date,
  description text NOT NULL DEFAULT '',
  logo_url text NOT NULL DEFAULT '',
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bujk_directory ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view published entries
CREATE POLICY "Anyone can view published directory"
ON public.bujk_directory FOR SELECT
TO authenticated
USING (is_published = true OR auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- Users can insert their own entry
CREATE POLICY "Users can insert own directory entry"
ON public.bujk_directory FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own entry
CREATE POLICY "Users can update own directory entry"
ON public.bujk_directory FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- Users can delete their own entry
CREATE POLICY "Users can delete own directory entry"
ON public.bujk_directory FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
