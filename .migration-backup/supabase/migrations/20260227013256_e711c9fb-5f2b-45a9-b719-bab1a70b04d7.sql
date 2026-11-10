
-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  position TEXT NOT NULL DEFAULT '',
  current_level TEXT NOT NULL DEFAULT 'Pemula' CHECK (current_level IN ('Pemula', 'Muda', 'Madya', 'Utama')),
  total_score INTEGER NOT NULL DEFAULT 0,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Competency domains
CREATE TABLE public.competency_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'BookOpen',
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.competency_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Domains are publicly readable" ON public.competency_domains FOR SELECT USING (true);

-- Seed competency domains
INSERT INTO public.competency_domains (name, description, icon, sort_order) VALUES
  ('Manajemen Proyek', 'Perencanaan, pelaksanaan, dan pengendalian proyek konstruksi', 'ClipboardCheck', 1),
  ('Manajemen Risiko', 'Identifikasi, analisis, dan mitigasi risiko proyek', 'Shield', 2),
  ('Keuangan & Cost Control', 'Pengelolaan anggaran, RAB, dan pengendalian biaya', 'DollarSign', 3),
  ('Pengadaan & Kontrak', 'Proses procurement, tender, dan manajemen kontrak', 'FileText', 4),
  ('K3 & Compliance', 'Keselamatan kerja, SMK3, dan kepatuhan regulasi', 'HardHat', 5),
  ('Governance & Leadership', 'Tata kelola organisasi, leadership, dan transformasi', 'Crown', 6);

-- Questions table
CREATE TABLE public.questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id UUID REFERENCES public.competency_domains(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  correct_answer INTEGER NOT NULL DEFAULT 0,
  difficulty TEXT NOT NULL DEFAULT 'Pemula' CHECK (difficulty IN ('Pemula', 'Muda', 'Madya', 'Utama')),
  explanation TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Questions readable by authenticated" ON public.questions FOR SELECT TO authenticated USING (true);

-- Pre-tests (assessment sessions)
CREATE TABLE public.pre_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  total_questions INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  determined_level TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.pre_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own pre_tests" ON public.pre_tests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own pre_tests" ON public.pre_tests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own pre_tests" ON public.pre_tests FOR UPDATE USING (auth.uid() = user_id);

-- Pre-test answers
CREATE TABLE public.pre_test_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pre_test_id UUID REFERENCES public.pre_tests(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  selected_answer INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pre_test_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own answers" ON public.pre_test_answers FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.pre_tests WHERE pre_tests.id = pre_test_answers.pre_test_id AND pre_tests.user_id = auth.uid())
);
CREATE POLICY "Users create own answers" ON public.pre_test_answers FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.pre_tests WHERE pre_tests.id = pre_test_answers.pre_test_id AND pre_tests.user_id = auth.uid())
);

-- E-course modules
CREATE TABLE public.e_course_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id UUID REFERENCES public.competency_domains(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT 'Pemula' CHECK (level IN ('Pemula', 'Muda', 'Madya', 'Utama')),
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.e_course_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Modules readable by authenticated" ON public.e_course_modules FOR SELECT TO authenticated USING (true);

-- Module progress
CREATE TABLE public.module_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  module_id UUID REFERENCES public.e_course_modules(id) ON DELETE CASCADE NOT NULL,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (user_id, module_id)
);

ALTER TABLE public.module_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own progress" ON public.module_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own progress" ON public.module_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own progress" ON public.module_progress FOR UPDATE USING (auth.uid() = user_id);

-- Seed sample questions (10 per domain-ish, covering multiple levels)
INSERT INTO public.questions (domain_id, question_text, options, correct_answer, difficulty, explanation) 
SELECT cd.id, q.question_text, q.options, q.correct_answer, q.difficulty, q.explanation
FROM public.competency_domains cd
CROSS JOIN LATERAL (VALUES
  ('Apa yang dimaksud dengan WBS (Work Breakdown Structure)?', '["Struktur organisasi proyek","Pemecahan pekerjaan menjadi elemen-elemen kecil","Jadwal pelaksanaan proyek","Rencana anggaran biaya"]'::jsonb, 1, 'Pemula', 'WBS adalah dekomposisi hierarkis dari total lingkup pekerjaan yang harus dilaksanakan oleh tim proyek.'),
  ('Metode jalur kritis (CPM) digunakan untuk?', '["Menghitung biaya proyek","Mengidentifikasi aktivitas kritis dalam jadwal","Mengelola sumber daya manusia","Membuat laporan keuangan"]'::jsonb, 1, 'Muda', 'CPM mengidentifikasi rangkaian aktivitas terpanjang yang menentukan durasi minimum proyek.'),
  ('Earned Value Management mengukur?', '["Produktivitas pekerja","Kinerja proyek terhadap baseline biaya dan jadwal","Kualitas material konstruksi","Kepuasan stakeholder"]'::jsonb, 1, 'Madya', 'EVM mengintegrasikan scope, schedule, dan cost baseline untuk mengukur kinerja proyek.'),
  ('Apa fungsi utama PMO dalam organisasi konstruksi?', '["Mengerjakan proyek langsung","Standardisasi dan governance manajemen proyek","Menggantikan project manager","Mengelola keuangan perusahaan"]'::jsonb, 1, 'Utama', 'PMO menyediakan framework, metodologi, dan governance untuk manajemen proyek organisasi.')
) AS q(question_text, options, correct_answer, difficulty, explanation)
WHERE cd.name = 'Manajemen Proyek';

INSERT INTO public.questions (domain_id, question_text, options, correct_answer, difficulty, explanation)
SELECT cd.id, q.question_text, q.options, q.correct_answer, q.difficulty, q.explanation
FROM public.competency_domains cd
CROSS JOIN LATERAL (VALUES
  ('Risk register adalah?', '["Daftar hadir pekerja","Dokumen yang mencatat risiko teridentifikasi","Laporan keuangan","Jadwal proyek"]'::jsonb, 1, 'Pemula', 'Risk register adalah dokumen yang berisi daftar risiko teridentifikasi beserta analisis dan rencana responsnya.'),
  ('Apa perbedaan risiko murni dan risiko spekulatif?', '["Tidak ada perbedaan","Murni hanya kerugian, spekulatif bisa untung/rugi","Murni lebih besar dari spekulatif","Spekulatif tidak perlu dimitigasi"]'::jsonb, 1, 'Muda', 'Risiko murni hanya menghasilkan kerugian, sedangkan risiko spekulatif dapat menghasilkan keuntungan atau kerugian.'),
  ('Monte Carlo simulation dalam manajemen risiko digunakan untuk?', '["Menghitung gaji pekerja","Simulasi probabilistik outcome proyek","Membuat desain struktur","Mengelola inventaris"]'::jsonb, 1, 'Madya', 'Monte Carlo simulation menggunakan distribusi probabilitas untuk mensimulasikan berbagai kemungkinan outcome proyek.'),
  ('Enterprise Risk Management (ERM) framework mencakup?', '["Hanya risiko finansial","Risiko operasional, strategis, finansial, dan compliance","Hanya risiko proyek","Hanya risiko keselamatan"]'::jsonb, 1, 'Utama', 'ERM adalah pendekatan holistik yang mencakup semua kategori risiko organisasi.')
) AS q(question_text, options, correct_answer, difficulty, explanation)
WHERE cd.name = 'Manajemen Risiko';

INSERT INTO public.questions (domain_id, question_text, options, correct_answer, difficulty, explanation)
SELECT cd.id, q.question_text, q.options, q.correct_answer, q.difficulty, q.explanation
FROM public.competency_domains cd
CROSS JOIN LATERAL (VALUES
  ('RAB singkatan dari?', '["Rencana Anggaran Biaya","Rangkuman Analisis Biaya","Rekapitulasi Alokasi Budget","Rincian Aktivitas Belanja"]'::jsonb, 0, 'Pemula', 'RAB (Rencana Anggaran Biaya) adalah perkiraan biaya yang diperlukan untuk melaksanakan suatu proyek.'),
  ('Cost variance (CV) positif menunjukkan?', '["Proyek over budget","Proyek under budget","Proyek terlambat","Proyek sesuai jadwal"]'::jsonb, 1, 'Muda', 'CV positif berarti biaya aktual lebih rendah dari yang direncanakan (under budget).'),
  ('Activity Based Costing dalam konstruksi bertujuan?', '["Menghitung gaji","Mengalokasikan biaya overhead berdasarkan aktivitas","Membuat jadwal proyek","Mengelola material"]'::jsonb, 1, 'Madya', 'ABC mengalokasikan biaya overhead ke aktivitas spesifik untuk akurasi perhitungan biaya yang lebih baik.'),
  ('Target costing dalam proyek konstruksi besar melibatkan?', '["Menentukan harga jual dulu baru mendesain","Mendesain dulu baru menentukan harga","Mengabaikan biaya overhead","Hanya menghitung biaya material"]'::jsonb, 0, 'Utama', 'Target costing dimulai dari harga pasar yang diinginkan, lalu mendesain produk/proyek sesuai target biaya tersebut.')
) AS q(question_text, options, correct_answer, difficulty, explanation)
WHERE cd.name = 'Keuangan & Cost Control';

INSERT INTO public.questions (domain_id, question_text, options, correct_answer, difficulty, explanation)
SELECT cd.id, q.question_text, q.options, q.correct_answer, q.difficulty, q.explanation
FROM public.competency_domains cd
CROSS JOIN LATERAL (VALUES
  ('Dokumen tender utama dalam pengadaan konstruksi adalah?', '["Surat lamaran kerja","Dokumen penawaran dan RKS","Laporan keuangan tahunan","Sertifikat ISO"]'::jsonb, 1, 'Pemula', 'Dokumen tender mencakup penawaran teknis, penawaran harga, dan Rencana Kerja & Syarat-syarat (RKS).'),
  ('Apa itu addendum kontrak?', '["Kontrak baru","Perubahan/tambahan terhadap kontrak yang sudah ada","Pembatalan kontrak","Perpanjangan kontrak otomatis"]'::jsonb, 1, 'Muda', 'Addendum adalah dokumen yang mengubah, menambah, atau mengurangi ketentuan dalam kontrak yang sudah ditandatangani.'),
  ('FIDIC Silver Book cocok untuk jenis kontrak?', '["Kontrak harga satuan","EPC/Turnkey projects","Kontrak cost-plus","Kontrak aliansi"]'::jsonb, 1, 'Madya', 'FIDIC Silver Book (EPC/Turnkey) menempatkan sebagian besar risiko pada kontraktor.'),
  ('Strategic sourcing dalam pengadaan konstruksi mencakup?', '["Membeli material termurah","Analisis total cost of ownership dan supplier relationship management","Hanya negosiasi harga","Procurement tanpa tender"]'::jsonb, 1, 'Utama', 'Strategic sourcing mempertimbangkan total value, bukan hanya harga, termasuk kualitas, reliabilitas, dan hubungan jangka panjang.')
) AS q(question_text, options, correct_answer, difficulty, explanation)
WHERE cd.name = 'Pengadaan & Kontrak';

INSERT INTO public.questions (domain_id, question_text, options, correct_answer, difficulty, explanation)
SELECT cd.id, q.question_text, q.options, q.correct_answer, q.difficulty, q.explanation
FROM public.competency_domains cd
CROSS JOIN LATERAL (VALUES
  ('APD singkatan dari?', '["Alat Pelindung Diri","Analisis Perencanaan Dasar","Aturan Pengawasan Daerah","Alokasi Pendanaan Darurat"]'::jsonb, 0, 'Pemula', 'APD (Alat Pelindung Diri) adalah peralatan keselamatan yang digunakan pekerja untuk melindungi dari bahaya kerja.'),
  ('Permit to work system bertujuan?', '["Mengurus izin usaha","Mengendalikan pekerjaan berisiko tinggi","Membuat jadwal kerja","Menghitung upah lembur"]'::jsonb, 1, 'Muda', 'Permit to work adalah sistem formal yang memastikan pekerjaan berbahaya dilakukan dengan aman dan terkendali.'),
  ('Bow-tie analysis dalam K3 konstruksi menggambarkan?', '["Struktur organisasi","Hubungan antara ancaman, kejadian, dan konsekuensi dengan barrier","Alur proses konstruksi","Jadwal pelatihan K3"]'::jsonb, 1, 'Madya', 'Bow-tie analysis memvisualisasikan risiko dengan menghubungkan ancaman dan konsekuensi melalui barrier pencegahan dan mitigasi.'),
  ('Sistem Manajemen K3 terintegrasi (ISO 45001) menekankan?', '["Hanya dokumentasi","Kepemimpinan top management dan partisipasi pekerja","Hanya audit eksternal","Hanya pelatihan safety"]'::jsonb, 1, 'Utama', 'ISO 45001 menekankan leadership commitment, worker participation, dan pendekatan berbasis risiko dalam OHSMS.')
) AS q(question_text, options, correct_answer, difficulty, explanation)
WHERE cd.name = 'K3 & Compliance';

INSERT INTO public.questions (domain_id, question_text, options, correct_answer, difficulty, explanation)
SELECT cd.id, q.question_text, q.options, q.correct_answer, q.difficulty, q.explanation
FROM public.competency_domains cd
CROSS JOIN LATERAL (VALUES
  ('Good Corporate Governance (GCG) terdiri dari prinsip?', '["Hanya transparansi","Transparansi, akuntabilitas, responsibilitas, independensi, fairness","Hanya profit maximization","Hanya kepatuhan hukum"]'::jsonb, 1, 'Pemula', 'GCG dibangun atas 5 prinsip: Transparency, Accountability, Responsibility, Independency, Fairness (TARIF).'),
  ('SOP dalam organisasi konstruksi berfungsi untuk?', '["Menambah birokrasi","Standardisasi proses dan menjamin konsistensi kualitas","Membatasi kreativitas","Mengurangi jumlah pekerja"]'::jsonb, 1, 'Muda', 'SOP memastikan proses dilakukan secara konsisten, efisien, dan sesuai standar yang ditetapkan.'),
  ('Balanced Scorecard dalam BUJK mengukur kinerja dari perspektif?', '["Hanya keuangan","Keuangan, pelanggan, proses internal, pembelajaran & pertumbuhan","Hanya produktivitas","Hanya kepuasan pelanggan"]'::jsonb, 1, 'Madya', 'BSC mengukur kinerja dari 4 perspektif yang saling terkait untuk memberikan gambaran menyeluruh.'),
  ('Digital transformation strategy untuk BUJK mencakup?', '["Hanya membeli software","Perubahan budaya, proses, teknologi, dan model bisnis","Hanya training IT","Hanya membuat website"]'::jsonb, 1, 'Utama', 'Transformasi digital adalah perubahan menyeluruh yang mencakup budaya organisasi, proses bisnis, adopsi teknologi, dan inovasi model bisnis.')
) AS q(question_text, options, correct_answer, difficulty, explanation)
WHERE cd.name = 'Governance & Leadership';

-- Seed e-course modules
INSERT INTO public.e_course_modules (domain_id, title, description, level, duration_minutes, sort_order)
SELECT cd.id, m.title, m.description, m.level, m.duration, m.sort_order
FROM public.competency_domains cd
CROSS JOIN LATERAL (VALUES
  ('Dasar Manajemen Proyek Konstruksi', 'Pengenalan konsep dasar manajemen proyek, siklus hidup proyek, dan peran project manager.', 'Pemula', 45, 1),
  ('Perencanaan & Penjadwalan Proyek', 'WBS, Gantt chart, CPM, dan teknik penjadwalan proyek konstruksi.', 'Muda', 60, 2),
  ('Pengendalian Proyek Lanjutan', 'Earned Value Management, change management, dan pengendalian mutu proyek.', 'Madya', 75, 3),
  ('Strategic Project Portfolio Management', 'Governance proyek, PMO setup, dan manajemen portofolio strategis.', 'Utama', 90, 4)
) AS m(title, description, level, duration, sort_order)
WHERE cd.name = 'Manajemen Proyek';

INSERT INTO public.e_course_modules (domain_id, title, description, level, duration_minutes, sort_order)
SELECT cd.id, m.title, m.description, m.level, m.duration, m.sort_order
FROM public.competency_domains cd
CROSS JOIN LATERAL (VALUES
  ('Pengenalan Manajemen Risiko', 'Konsep dasar risiko, identifikasi risiko, dan risk register.', 'Pemula', 40, 1),
  ('Analisis Risiko Kuantitatif & Kualitatif', 'Probability-impact matrix, decision tree, dan teknik analisis risiko.', 'Muda', 55, 2),
  ('Risk Response & Monitoring Lanjutan', 'Strategi respons risiko, Monte Carlo simulation, dan risk monitoring.', 'Madya', 70, 3),
  ('Enterprise Risk Management', 'ERM framework, risk appetite, dan integrasi risiko strategis organisasi.', 'Utama', 85, 4)
) AS m(title, description, level, duration, sort_order)
WHERE cd.name = 'Manajemen Risiko';

INSERT INTO public.e_course_modules (domain_id, title, description, level, duration_minutes, sort_order)
SELECT cd.id, m.title, m.description, m.level, m.duration, m.sort_order
FROM public.competency_domains cd
CROSS JOIN LATERAL (VALUES
  ('Dasar Estimasi & RAB', 'Teknik estimasi biaya, komponen RAB, dan analisis harga satuan.', 'Pemula', 45, 1),
  ('Cost Control & Cash Flow', 'Pengendalian biaya proyek, cash flow management, dan variance analysis.', 'Muda', 60, 2),
  ('Advanced Financial Management', 'Activity Based Costing, value engineering, dan life cycle costing.', 'Madya', 75, 3),
  ('Strategic Financial Planning', 'Target costing, financial modeling, dan capital budgeting untuk BUJK.', 'Utama', 90, 4)
) AS m(title, description, level, duration, sort_order)
WHERE cd.name = 'Keuangan & Cost Control';

INSERT INTO public.e_course_modules (domain_id, title, description, level, duration_minutes, sort_order)
SELECT cd.id, m.title, m.description, m.level, m.duration, m.sort_order
FROM public.competency_domains cd
CROSS JOIN LATERAL (VALUES
  ('Dasar Pengadaan Konstruksi', 'Proses pengadaan, dokumen tender, dan evaluasi penawaran.', 'Pemula', 40, 1),
  ('Manajemen Kontrak Konstruksi', 'Jenis kontrak, addendum, klaim, dan dispute resolution.', 'Muda', 55, 2),
  ('FIDIC & Kontrak Internasional', 'FIDIC contract forms, international procurement, dan compliance.', 'Madya', 70, 3),
  ('Strategic Procurement & Supply Chain', 'Strategic sourcing, supplier management, dan supply chain optimization.', 'Utama', 85, 4)
) AS m(title, description, level, duration, sort_order)
WHERE cd.name = 'Pengadaan & Kontrak';

INSERT INTO public.e_course_modules (domain_id, title, description, level, duration_minutes, sort_order)
SELECT cd.id, m.title, m.description, m.level, m.duration, m.sort_order
FROM public.competency_domains cd
CROSS JOIN LATERAL (VALUES
  ('Dasar K3 Konstruksi', 'APD, bahaya kerja, dan prosedur keselamatan dasar.', 'Pemula', 40, 1),
  ('Sistem Manajemen K3', 'SMK3, permit to work, JSA, dan investigasi kecelakaan.', 'Muda', 55, 2),
  ('K3 Lanjutan & Compliance', 'Bow-tie analysis, audit K3, dan regulatory compliance.', 'Madya', 70, 3),
  ('Integrated OHSMS & ISO 45001', 'Implementasi ISO 45001, continuous improvement, dan K3 strategis.', 'Utama', 85, 4)
) AS m(title, description, level, duration, sort_order)
WHERE cd.name = 'K3 & Compliance';

INSERT INTO public.e_course_modules (domain_id, title, description, level, duration_minutes, sort_order)
SELECT cd.id, m.title, m.description, m.level, m.duration, m.sort_order
FROM public.competency_domains cd
CROSS JOIN LATERAL (VALUES
  ('Dasar Tata Kelola BUJK', 'Good Corporate Governance, etika bisnis, dan struktur organisasi.', 'Pemula', 40, 1),
  ('SOP & Standarisasi Proses', 'Penyusunan SOP, process mapping, dan quality management system.', 'Muda', 55, 2),
  ('Leadership & Performance Management', 'Balanced Scorecard, KPI, dan leadership dalam organisasi konstruksi.', 'Madya', 70, 3),
  ('Digital Transformation & Strategy', 'Transformasi digital BUJK, change management, dan inovasi strategis.', 'Utama', 85, 4)
) AS m(title, description, level, duration, sort_order)
WHERE cd.name = 'Governance & Leadership';
