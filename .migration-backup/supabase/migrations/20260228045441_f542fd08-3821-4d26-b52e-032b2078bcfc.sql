
-- Remove old seed data and replace with richer 8-category content
DELETE FROM innovation_proposals;
DELETE FROM innovation_categories;

INSERT INTO innovation_categories (slug, name, icon, description, concepts, programs, benefits, stage, sort_order) VALUES
('legal-governance', 'Legal & Governance System', 'ShieldCheck',
 'Klinik legalitas digital dan dashboard kepatuhan proyek untuk mencegah kontraktor gagal tender akibat masalah administratif.',
 ARRAY['Pendaftaran SBU & SKK berbasis pendampingan online','Template kontrak konstruksi standar','Konsultasi regulasi jasa konstruksi','Monitoring masa berlaku sertifikat','Tracking kepatuhan K3','Monitoring pajak & administrasi','Reminder dokumen legal'],
 ARRAY['Klinik Legalitas Digital','Dashboard Kepatuhan Proyek','Sistem notifikasi masa berlaku sertifikat','Pendampingan regulasi jasa konstruksi'],
 ARRAY['Mencegah gagal tender akibat masalah administratif','Kepatuhan hukum meningkat','Efisiensi pengurusan dokumen legal','Transparansi status kepatuhan proyek'],
 1, 1),

('green-construction', 'Green Construction System', 'Leaf',
 'Mengintegrasikan prinsip ESG dalam operasional konstruksi melalui Green Material Database, Waste Management Tracker, dan Energy Efficiency Toolkit.',
 ARRAY['Green Material Database — data material ramah lingkungan','Kalkulator jejak karbon proyek','Panduan spesifikasi material rendah emisi','Monitoring limbah proyek','Sistem reuse & recycle material','Desain ventilasi alami','Simulasi efisiensi energi bangunan','Standar bangunan hemat energi'],
 ARRAY['Waste Management Tracker','Energy Efficiency Toolkit','Laporan sustainability proyek','Audit energi bangunan'],
 ARRAY['Mengintegrasikan prinsip ESG dalam operasional','Efisiensi biaya jangka panjang','Reputasi perusahaan meningkat','Selaras dengan standar Greenship / Green Building'],
 3, 2),

('lean-construction', 'Lean Construction Module', 'Timer',
 'Meningkatkan efisiensi biaya dan waktu proyek melalui Last Planner System Digital, Cost Control System, dan Productivity Dashboard.',
 ARRAY['Last Planner System Digital — perencanaan mingguan berbasis target','Monitoring deviasi pekerjaan','Evaluasi produktivitas harian','Monitoring realisasi vs RAB','Early warning overbudget','Analisa pemborosan (waste analysis)','Indeks kinerja tenaga kerja','Rasio efisiensi waktu'],
 ARRAY['Pelatihan Lean Project Management','Simulasi pengendalian waktu & biaya','Audit efisiensi proyek berjalan','Standarisasi SOP berbasis lean'],
 ARRAY['Mengurangi keterlambatan proyek','Menekan overbudget','Produktivitas tenaga kerja meningkat','Efisiensi biaya dan waktu proyek'],
 2, 3),

('erp-konstruksi', 'ERP Konstruksi Terintegrasi', 'Database',
 'Digitalisasi manajemen proyek dan perusahaan secara terintegrasi: Keuangan, Logistik, SDM, dan Project Monitoring.',
 ARRAY['Cash flow tracking','Manajemen termin pembayaran','Laporan keuangan real time','Monitoring stok material','Sistem pengadaan otomatis','Integrasi supplier','Absensi digital pekerja','Monitoring jam kerja','Perhitungan upah otomatis','Progres fisik vs rencana','Dokumentasi foto proyek','Approval digital'],
 ARRAY['Modul Keuangan Proyek','Modul Logistik & Material','Modul SDM','Project Monitoring System'],
 ARRAY['Transparansi dan akuntabilitas meningkat signifikan','Pengendalian risiko meningkat','Efisiensi operasional perusahaan','Data-driven decision making'],
 2, 4),

('bim-digital-twin', 'BIM & Digital Twin', 'Box',
 'Model digital 3D terintegrasi untuk desain, konstruksi, dan monitoring aset pasca konstruksi.',
 ARRAY['3D Modeling & Clash Detection','Identifikasi konflik desain sebelum konstruksi','Visualisasi proyek interaktif','Estimasi Biaya Otomatis (5D BIM)','Integrasi desain dan RAB','Simulasi perubahan desain','Asset Lifecycle Monitoring','Digital twin untuk pemeliharaan'],
 ARRAY['Pelatihan BIM untuk kontraktor lokal','Standarisasi penggunaan BIM pada proyek pemerintah','Kolaborasi arsitek–kontraktor berbasis model digital','Digital twin monitoring bangunan publik'],
 ARRAY['Mengurangi kesalahan desain','Menghindari konflik pekerjaan (clash detection)','Efisiensi biaya hingga 10–20%','Monitoring aset pasca konstruksi'],
 2, 5),

('business-market', 'Business & Market Access', 'Lightbulb',
 'E-Marketplace proyek konstruksi dan Tender Simulation Lab untuk meningkatkan akses pasar kontraktor lokal.',
 ARRAY['Database proyek daerah','Sistem subkontrak','Business matching kontraktor–developer','Simulasi e-procurement','Review dokumen penawaran','Pelatihan strategi tender'],
 ARRAY['E-Marketplace Proyek Konstruksi','Tender Simulation Lab','Business matching platform','Pelatihan strategi tender'],
 ARRAY['Meningkatkan daya saing kontraktor lokal','Akses pasar lebih luas','Efisiensi proses tender','Mengurangi risiko proyek mangkrak'],
 1, 6),

('financial-readiness', 'Pembiayaan & Financial Readiness', 'Recycle',
 'Skoring kelayakan kontraktor dan pendampingan pembiayaan proyek untuk kesiapan finansial.',
 ARRAY['Analisa kesehatan finansial','Rating risiko usaha','Pendampingan kredit modal kerja','Simulasi pembiayaan proyek','Skoring kelayakan kontraktor'],
 ARRAY['Klinik Bank Garansi','Skoring Kelayakan Kontraktor','Pendampingan kredit modal kerja','Simulasi pembiayaan proyek'],
 ARRAY['Kesiapan finansial kontraktor meningkat','Akses pembiayaan lebih mudah','Risiko gagal bayar menurun','Daya saing di tender meningkat'],
 1, 7),

('smart-sustainable', 'Smart & Sustainable Technology', 'Cpu',
 'Drone Monitoring, IoT Construction Monitoring, dan Prefabrication System untuk efisiensi dan keselamatan proyek.',
 ARRAY['Drone — pengawasan progres proyek','Dokumentasi visual berkala','Sensor getaran & struktur','Monitoring alat berat via IoT','Modul konstruksi siap pasang (prefab)','Efisiensi waktu pembangunan','3D printing untuk komponen bangunan'],
 ARRAY['Drone Monitoring','IoT Construction Monitoring','Prefabrication System','Smart site management'],
 ARRAY['Efisiensi pengawasan proyek','Keselamatan kerja meningkat','Waktu pembangunan lebih cepat','Kualitas konstruksi lebih konsisten'],
 3, 8);
