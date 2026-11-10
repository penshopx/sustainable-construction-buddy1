
CREATE OR REPLACE FUNCTION public.seed_demo_data_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := NEW.user_id;
  _proj1 uuid := gen_random_uuid();
  _proj2 uuid := gen_random_uuid();
  _proj3 uuid := gen_random_uuid();
  _k3_id uuid := gen_random_uuid();
BEGIN
  -- ========== 3 DEMO PROJECTS ==========
  INSERT INTO public.projects (id, user_id, name, description, location, value_amount, duration_months, contract_type, risk_class, multidiscipline, complexity_score, status, bujk_name, started_at)
  VALUES
    (_proj1, _uid, 'Pembangunan Gedung Kantor 5 Lantai', 'Proyek konstruksi gedung kantor dengan luas total 3.500 m². Struktur beton bertulang, finishing premium.', 'Jakarta Selatan, DKI Jakarta', 25000000000, 18, 'lumpsum', 'medium', true, 65, 'active', 'PT Maju Konstruksi Sejahtera', now() - interval '3 months'),
    (_proj2, _uid, 'Rehabilitasi Jalan Tol Ruas A-B', 'Perbaikan overlay jalan sepanjang 12 km termasuk drainase dan penerangan jalan.', 'Bekasi, Jawa Barat', 45000000000, 12, 'unit_price', 'high', false, 78, 'active', 'PT Infrastruktur Nusantara', now() - interval '1 month'),
    (_proj3, _uid, 'Pembangunan Sistem Drainase Kawasan Industri', 'Konstruksi saluran drainase primer & sekunder untuk kawasan industri seluas 50 Ha.', 'Karawang, Jawa Barat', 8000000000, 8, 'lumpsum', 'low', false, 35, 'completed', 'PT Bangun Cipta Mandiri', now() - interval '10 months');

  -- ========== RISK REGISTERS ==========
  INSERT INTO public.risk_registers (user_id, project_id, risk_description, probability_score, impact_score, status, owner, mitigation_action, due_date)
  VALUES
    (_uid, _proj1, 'Keterlambatan pengiriman material baja dari supplier', 4, 4, 'open', 'Manajer Pengadaan', 'Diversifikasi supplier dan buat PO lebih awal 2 minggu dari jadwal', now() + interval '30 days'),
    (_uid, _proj1, 'Cuaca hujan berkepanjangan menghambat pekerjaan struktur', 3, 3, 'mitigated', 'Site Manager', 'Siapkan tenda pelindung dan jadwal kerja shift malam saat cuaca baik', now() + interval '14 days'),
    (_uid, _proj2, 'Kenaikan harga aspal di atas 10% dari estimasi RAB', 3, 5, 'open', 'Estimator', 'Negosiasi kontrak harga tetap dengan supplier aspal dan siapkan eskalasi ke owner', now() + interval '45 days'),
    (_uid, _proj2, 'Konflik lahan dengan warga sekitar ruas jalan', 2, 5, 'open', 'Legal & Community Relations', 'Koordinasi dengan pemda dan sosialisasi rutin ke warga terdampak', now() + interval '60 days');

  -- ========== BUDGET ENTRIES ==========
  INSERT INTO public.budget_entries (user_id, project_id, category, period_month, planned_amount, actual_amount, deviation_percent, notes, mitigation_plan)
  VALUES
    (_uid, _proj1, 'Material Struktur', '2025-01', 2500000000, 2650000000, 6.0, 'Harga baja naik 5% dari estimasi awal', 'Negosiasi ulang dengan supplier alternatif'),
    (_uid, _proj1, 'Upah Tenaga Kerja', '2025-01', 1200000000, 1180000000, -1.67, 'Efisiensi dari sistem kerja shift', ''),
    (_uid, _proj1, 'Peralatan & Sewa Alat', '2025-02', 800000000, 850000000, 6.25, 'Penambahan tower crane untuk percepatan', 'Evaluasi kebutuhan alat per minggu'),
    (_uid, _proj2, 'Material Aspal & Agregat', '2025-01', 5000000000, 4800000000, -4.0, 'Mendapat harga lebih baik dari kontrak volume', ''),
    (_uid, _proj2, 'Mobilisasi & Demobilisasi', '2025-02', 600000000, 620000000, 3.33, 'Jarak angkut lebih jauh dari rencana', 'Optimasi rute pengangkutan material');

  -- ========== K3 CHECKLIST ==========
  INSERT INTO public.k3_checklists (id, user_id, project_id, inspector_name, location, inspection_date, status, completed_items, total_items, score_percent, notes)
  VALUES (_k3_id, _uid, _proj1, 'Ir. Budi Santoso', 'Lantai 3 - Area Struktur Kolom', CURRENT_DATE - 7, 'completed', 18, 20, 90.0, 'Inspeksi rutin mingguan. 2 temuan minor terkait rambu K3.');

  INSERT INTO public.k3_checklist_items (checklist_id, category, item_text, is_compliant, finding, corrective_action, sort_order)
  VALUES
    (_k3_id, 'APD', 'Semua pekerja menggunakan helm safety', true, '', '', 1),
    (_k3_id, 'APD', 'Safety harness digunakan di ketinggian >2m', true, '', '', 2),
    (_k3_id, 'APD', 'Sepatu safety digunakan semua pekerja', true, '', '', 3),
    (_k3_id, 'Lingkungan', 'Area kerja bersih dan terorganisir', true, '', '', 4),
    (_k3_id, 'Lingkungan', 'Rambu K3 terpasang di semua titik rawan', false, 'Rambu peringatan di area bekisting belum terpasang', 'Pasang rambu peringatan tambahan hari ini', 5),
    (_k3_id, 'Peralatan', 'Scaffolding dalam kondisi baik dan stabil', true, '', '', 6),
    (_k3_id, 'Peralatan', 'APAR tersedia dan dalam masa berlaku', true, '', '', 7),
    (_k3_id, 'Peralatan', 'Alat berat memiliki sertifikat layak operasi', true, '', '', 8),
    (_k3_id, 'Prosedur', 'Toolbox meeting dilakukan pagi hari', true, '', '', 9),
    (_k3_id, 'Prosedur', 'Izin kerja (work permit) tersedia', false, 'Work permit untuk pekerjaan hot work belum diperbarui', 'Perbarui work permit sebelum pekerjaan pengelasan dilanjutkan', 10);

  -- ========== LKUT REPORT ==========
  INSERT INTO public.lkut_reports (user_id, report_year, status, sbu_number, sbu_type, sbu_expiry_date, tkk_replacement, equipment_commitment_fulfilled, smap_fulfilled, experience_records_complete, asset_value_current, asset_value_previous, sales_value, gross_profit, current_assets, short_term_liabilities, total_liabilities, total_equity, gcg_applied, smk3_applied, total_employees, trained_employees, contract_experts, permanent_experts, certifications, awards, notes)
  VALUES (_uid, 2024, 'draft', 'SBU-JK-2024-001234', 'perpanjangan', '2025-12-31', false, true, true, true, 15000000000, 12000000000, 35000000000, 5200000000, 8500000000, 3200000000, 6800000000, 8200000000, true, true, 185, 120, 15, 8, 'ISO 9001:2015, ISO 14001:2015, ISO 45001:2018', 'Kontraktor Terbaik DKI Jakarta 2023, Zero Accident Award 2024', 'Laporan LKUT tahun 2024 - data keuangan berdasarkan audit Q3');

  -- ========== COMPETENCY SCORE ==========
  INSERT INTO public.competency_scores (user_id, period, learning_points, project_points, toolkit_points, contribution_points, total_score)
  VALUES (_uid, '2025-Q1', 25, 35, 20, 10, 90);

  -- ========== PERFORMANCE GRADE ==========
  INSERT INTO public.performance_grades (user_id, period, financial_score, project_score, compliance_score, risk_score, total_score, grade, breakdown)
  VALUES (_uid, '2025-Q1', 82, 88, 75, 70, 78.75, 'B+', '{"financial": {"revenue_growth": 12, "profit_margin": 15, "cash_ratio": 2.6}, "project": {"on_time": 85, "quality_score": 92}, "compliance": {"sbu_valid": true, "k3_score": 90}, "risk": {"open_risks": 3, "mitigated": 1}}'::jsonb);

  -- ========== NOTIFICATIONS ==========
  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES
    (_uid, 'info', 'Selamat Datang di PUB ASPEKINDO! 🎉', 'Akun Anda telah berhasil dibuat. Data demo telah dimuat untuk membantu Anda memahami fitur-fitur platform. Silakan eksplorasi Dashboard, Proyek, dan toolkit lainnya.'),
    (_uid, 'reminder', 'SBU Akan Berakhir dalam 6 Bulan ⏰', 'SBU nomor SBU-JK-2024-001234 akan berakhir pada 31 Desember 2025. Segera siapkan dokumen perpanjangan.'),
    (_uid, 'info', 'Inspeksi K3 Selesai ✅', 'Inspeksi K3 untuk proyek Gedung Kantor 5 Lantai telah selesai dengan skor 90%. Terdapat 2 temuan minor yang perlu ditindaklanjuti.');

  RETURN NEW;
END;
$function$;

-- Create trigger on profiles table (fires after handle_new_user inserts profile)
DROP TRIGGER IF EXISTS on_new_profile_seed_demo ON public.profiles;
CREATE TRIGGER on_new_profile_seed_demo
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_demo_data_for_new_user();
