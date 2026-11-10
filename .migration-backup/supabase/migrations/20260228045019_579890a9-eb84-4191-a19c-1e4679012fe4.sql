
-- Table for innovation categories (the 7 innovation areas)
CREATE TABLE public.innovation_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'Lightbulb',
  description text NOT NULL DEFAULT '',
  concepts text[] NOT NULL DEFAULT '{}',
  programs text[] NOT NULL DEFAULT '{}',
  benefits text[] NOT NULL DEFAULT '{}',
  stage integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.innovation_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Innovation categories are publicly readable"
ON public.innovation_categories FOR SELECT
USING (true);

-- Only admins can manage categories
CREATE POLICY "Admins can manage innovation categories"
ON public.innovation_categories FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Table for user innovation proposals
CREATE TABLE public.innovation_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_id uuid REFERENCES public.innovation_categories(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  scope text NOT NULL DEFAULT '',
  expected_impact text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  admin_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.innovation_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own proposals"
ON public.innovation_proposals FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create own proposals"
ON public.innovation_proposals FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own proposals"
ON public.innovation_proposals FOR UPDATE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete own draft proposals"
ON public.innovation_proposals FOR DELETE
USING (auth.uid() = user_id AND status = 'draft');

-- Trigger for updated_at
CREATE TRIGGER update_innovation_proposals_updated_at
BEFORE UPDATE ON public.innovation_proposals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the 7 innovation categories
INSERT INTO public.innovation_categories (slug, name, icon, description, concepts, programs, benefits, stage, sort_order) VALUES
('green-construction', 'Green Construction', 'Leaf', 'Penerapan prinsip pembangunan ramah lingkungan dan efisiensi sumber daya.', 
  ARRAY['Penggunaan material ramah lingkungan (fly ash concrete, recycled material)', 'Desain bangunan hemat energi & ventilasi alami', 'Sistem pengelolaan limbah proyek', 'Pengurangan jejak karbon (low carbon construction)', 'Implementasi standar Greenship / Green Building'],
  ARRAY['Pelatihan Green Contractor Certification', 'Insentif untuk proyek ramah lingkungan', 'Pendampingan audit energi bangunan', 'Panduan teknis konstruksi rendah emisi'],
  ARRAY['Efisiensi biaya jangka panjang', 'Reputasi meningkat', 'Selaras ESG'], 3, 1),

('lean-construction', 'Lean Construction', 'Timer', 'Mengurangi pemborosan (waste) dan meningkatkan efisiensi proses proyek.',
  ARRAY['Just in Time material', 'Last Planner System', 'Continuous improvement', 'Value stream mapping'],
  ARRAY['Pelatihan Lean Project Management', 'Simulasi pengendalian waktu dan biaya', 'Audit efisiensi proyek berjalan', 'Standarisasi SOP berbasis lean'],
  ARRAY['Mengurangi keterlambatan proyek', 'Menekan overbudget', 'Produktivitas tenaga kerja meningkat'], 2, 2),

('erp-konstruksi', 'ERP Konstruksi', 'Database', 'Digitalisasi manajemen proyek dan perusahaan secara terintegrasi.',
  ARRAY['Manajemen proyek', 'Pengadaan & logistik material', 'Keuangan & akuntansi proyek', 'Manajemen SDM & tenaga kerja', 'Monitoring progres dan cash flow'],
  ARRAY['Subsidi implementasi ERP bagi kontraktor kecil', 'Pelatihan sistem ERP berbasis cloud', 'Integrasi ERP dengan e-procurement', 'Dashboard monitoring proyek daerah'],
  ARRAY['Transparansi meningkat', 'Akuntabilitas terjaga', 'Pengendalian risiko meningkat'], 2, 3),

('bim', 'BIM (Building Information Modeling)', 'Box', 'Model digital 3D terintegrasi untuk desain, konstruksi, dan operasional bangunan.',
  ARRAY['Model 3D terintegrasi', 'Clash detection otomatis', 'Digital twin untuk monitoring', 'Kolaborasi arsitek-kontraktor berbasis model digital'],
  ARRAY['Pelatihan BIM untuk kontraktor lokal', 'Standarisasi penggunaan BIM pada proyek pemerintah', 'Digital twin untuk monitoring bangunan publik'],
  ARRAY['Mengurangi kesalahan desain', 'Menghindari konflik pekerjaan', 'Efisiensi biaya hingga 10-20%'], 2, 4),

('smart-construction', 'Smart & Sustainable Construction', 'Cpu', 'Penerapan teknologi cerdas untuk pengawasan dan efisiensi konstruksi.',
  ARRAY['IoT untuk monitoring alat berat', 'Drone untuk pengawasan proyek', 'Sensor struktur untuk keamanan bangunan', 'Prefabrication & modular construction', '3D printing untuk komponen bangunan'],
  ARRAY['Pilot project IoT di proyek infrastruktur', 'Pelatihan drone survey', 'Standar modular construction'],
  ARRAY['Pengawasan real-time', 'Keselamatan meningkat', 'Waktu konstruksi lebih cepat'], 3, 5),

('circular-construction', 'Circular Construction', 'Recycle', 'Menggunakan kembali material dan meminimalkan limbah konstruksi.',
  ARRAY['Bank material konstruksi bekas', 'Reuse baja dan beton', 'Desain bangunan mudah dibongkar (design for deconstruction)'],
  ARRAY['Program bank material nasional', 'Insentif reuse material', 'Standar design for deconstruction'],
  ARRAY['Pengurangan limbah konstruksi', 'Penghematan biaya material', 'Dampak lingkungan berkurang'], 3, 6),

('esg-governance', 'ESG-Based Construction Governance', 'ShieldCheck', 'Tata kelola konstruksi berbasis Environmental, Social, and Governance.',
  ARRAY['Transparansi tender', 'Anti korupsi proyek', 'Standar keselamatan kerja tinggi', 'Pelaporan keberlanjutan perusahaan konstruksi'],
  ARRAY['Framework ESG untuk kontraktor', 'Audit tata kelola proyek', 'Pelaporan sustainability wajib'],
  ARRAY['Kepercayaan stakeholder meningkat', 'Akses pendanaan lebih mudah', 'Reputasi perusahaan terjaga'], 3, 7);
