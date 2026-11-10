-- Fix seed function to not insert into generated column deviation_percent
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
  INSERT INTO public.projects (id, user_id, name, description, location, value_amount, duration_months, contract_type, risk_class, multidiscipline, complexity_score, status, bujk_name, started_at)
  VALUES
    (_proj1, _uid, 'Pembangunan Gedung Kantor 5 Lantai', 'Proyek konstruksi gedung kantor dengan luas total 3.500 m².', 'Jakarta Selatan, DKI Jakarta', 25000000000, 18, 'lumpsum', 'medium', true, 65, 'active', 'PT Maju Konstruksi Sejahtera', now() - interval '3 months'),
    (_proj2, _uid, 'Rehabilitasi Jalan Tol Ruas A-B', 'Perbaikan overlay jalan sepanjang 12 km.', 'Bekasi, Jawa Barat', 45000000000, 12, 'unit_price', 'high', false, 78, 'active', 'PT Infrastruktur Nusantara', now() - interval '1 month'),
    (_proj3, _uid, 'Pembangunan Sistem Drainase Kawasan Industri', 'Konstruksi saluran drainase primer & sekunder.', 'Karawang, Jawa Barat', 8000000000, 8, 'lumpsum', 'low', false, 35, 'completed', 'PT Bangun Cipta Mandiri', now() - interval '10 months');

  INSERT INTO public.risk_registers (user_id, project_id, risk_description, probability_score, impact_score, status, owner, mitigation_action, due_date)
  VALUES
    (_uid, _proj1, 'Keterlambatan pengiriman material baja', 4, 4, 'open', 'Manajer Pengadaan', 'Diversifikasi supplier', now() + interval '30 days'),
    (_uid, _proj2, 'Kenaikan harga aspal di atas 10%', 3, 5, 'open', 'Estimator', 'Negosiasi kontrak harga tetap', now() + interval '45 days');

  -- Fixed: removed deviation_percent (generated column)
  INSERT INTO public.budget_entries (user_id, project_id, category, period_month, planned_amount, actual_amount, notes, mitigation_plan)
  VALUES
    (_uid, _proj1, 'Material Struktur', '2025-01', 2500000000, 2650000000, 'Harga baja naik 5%', 'Negosiasi ulang'),
    (_uid, _proj1, 'Upah Tenaga Kerja', '2025-01', 1200000000, 1180000000, 'Efisiensi shift', ''),
    (_uid, _proj2, 'Material Aspal', '2025-01', 5000000000, 4800000000, 'Harga lebih baik', '');

  INSERT INTO public.k3_checklists (id, user_id, project_id, inspector_name, location, inspection_date, status, completed_items, total_items, score_percent, notes)
  VALUES (_k3_id, _uid, _proj1, 'Ir. Budi Santoso', 'Lantai 3 - Area Struktur', CURRENT_DATE - 7, 'completed', 8, 10, 80.0, 'Inspeksi rutin mingguan');

  INSERT INTO public.k3_checklist_items (checklist_id, category, item_text, is_compliant, finding, corrective_action, sort_order)
  VALUES
    (_k3_id, 'APD', 'Semua pekerja menggunakan helm safety', true, '', '', 1),
    (_k3_id, 'APD', 'Safety harness di ketinggian >2m', true, '', '', 2),
    (_k3_id, 'Lingkungan', 'Rambu K3 terpasang', false, 'Rambu belum terpasang', 'Pasang rambu', 3);

  INSERT INTO public.lkut_reports (user_id, report_year, status, sbu_number, sbu_type, sbu_expiry_date, tkk_replacement, equipment_commitment_fulfilled, smap_fulfilled, experience_records_complete, asset_value_current, asset_value_previous, sales_value, gross_profit, current_assets, short_term_liabilities, total_liabilities, total_equity, gcg_applied, smk3_applied, total_employees, trained_employees, contract_experts, permanent_experts, certifications, awards, notes)
  VALUES (_uid, 2024, 'draft', 'SBU-JK-2024-001234', 'perpanjangan', '2025-12-31', false, true, true, true, 15000000000, 12000000000, 35000000000, 5200000000, 8500000000, 3200000000, 6800000000, 8200000000, true, true, 185, 120, 15, 8, 'ISO 9001:2015, ISO 14001:2015', 'Kontraktor Terbaik 2023', 'Data demo LKUT 2024');

  INSERT INTO public.competency_scores (user_id, period, learning_points, project_points, toolkit_points, contribution_points, total_score)
  VALUES (_uid, '2025-Q1', 25, 35, 20, 10, 90);

  INSERT INTO public.performance_grades (user_id, period, financial_score, project_score, compliance_score, risk_score, total_score, grade, breakdown)
  VALUES (_uid, '2025-Q1', 82, 88, 75, 70, 78.75, 'B+', '{"financial": {"revenue_growth": 12}, "project": {"on_time": 85}, "compliance": {"sbu_valid": true}, "risk": {"open_risks": 3}}'::jsonb);

  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES
    (_uid, 'info', 'Selamat Datang di PUB ASPEKINDO! 🎉', 'Akun Anda berhasil dibuat. Data demo telah dimuat.');

  RETURN NEW;
END;
$function$;

-- Re-attach all triggers
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE TRIGGER on_profile_created_seed_demo
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.seed_demo_data_for_new_user();

CREATE OR REPLACE TRIGGER on_level_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_level_change();

CREATE OR REPLACE TRIGGER on_innovation_status_change
  AFTER UPDATE ON public.innovation_proposals
  FOR EACH ROW EXECUTE FUNCTION public.log_innovation_status_change();

CREATE OR REPLACE TRIGGER on_innovation_status_notify
  AFTER UPDATE ON public.innovation_proposals
  FOR EACH ROW EXECUTE FUNCTION public.notify_innovation_status();

CREATE OR REPLACE TRIGGER on_new_certificate
  AFTER INSERT ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_certificate();

CREATE OR REPLACE TRIGGER on_pancek_verification
  AFTER UPDATE ON public.pancek_assessments
  FOR EACH ROW EXECUTE FUNCTION public.notify_pancek_verification();

CREATE OR REPLACE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();