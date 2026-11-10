
-- Programs/Activities table
CREATE TABLE public.pub_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'program',
  status TEXT NOT NULL DEFAULT 'upcoming',
  start_date DATE,
  end_date DATE,
  location TEXT NOT NULL DEFAULT '',
  progress_percent INTEGER NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pub_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Programs are publicly readable" ON public.pub_programs
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage programs" ON public.pub_programs
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Program updates / news
CREATE TABLE public.pub_program_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID REFERENCES public.pub_programs(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pub_program_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Updates are publicly readable" ON public.pub_program_updates
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage updates" ON public.pub_program_updates
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Gallery
CREATE TABLE public.pub_program_gallery (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID REFERENCES public.pub_programs(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pub_program_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gallery is publicly readable" ON public.pub_program_gallery
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage gallery" ON public.pub_program_gallery
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket for program images
INSERT INTO storage.buckets (id, name, public) VALUES ('program-images', 'program-images', true);

CREATE POLICY "Anyone can view program images" ON storage.objects
  FOR SELECT USING (bucket_id = 'program-images');

CREATE POLICY "Admins can upload program images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'program-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update program images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'program-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete program images" ON storage.objects
  FOR DELETE USING (bucket_id = 'program-images' AND has_role(auth.uid(), 'admin'::app_role));

-- Triggers
CREATE TRIGGER update_pub_programs_updated_at
  BEFORE UPDATE ON public.pub_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
