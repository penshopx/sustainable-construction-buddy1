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
  _existing_lkut int;
BEGIN
  -- Skip if user already has data
  SELECT count(*) INTO _existing_lkut FROM public.lkut_reports WHERE user_id = _uid;
  IF _existing_lkut > 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.projects (id, user_id, name, description, location, value_amount, duration_months, contract_type, risk_class, multidiscipline, complexity_score, status, bujk_name, started_at)
  VALUES
    (_proj1, _uid, 'Pembangunan Gedung Kantor 5 Lantai', 'Proyek konstruksi gedung kantor.', 'Jakarta Selatan', 25000000000, 18, 'lumpsum', 'medium', true, 65, 'active', 'PT Maju Konstruksi', now() - interval '3 months'),
    (_proj2, _uid, 'Rehabilitasi Jalan Tol Ruas A-B', 'Perbaikan overlay jalan 12 km.', 'Bekasi', 45000000000, 12, 'unit_price', 'high', false, 78, 'active', 'PT Infrastruktur Nusantara', now() - interval '1 month'),
    (_proj3, _uid, 'Pembangunan Drainase Kawasan Industri', 'Saluran drainase 50 Ha.', 'Karawang', 8000000000, 8, 'lumpsum', 'low', false, 35, 'completed', 'PT Bangun Cipta', now() - interval '10 months');

  INSERT INTO public.risk_registers (user_id, project_id, risk_description, probability_score, impact_score, status, owner, mitigation_action, due_date)
  VALUES
    (_uid, _proj1, 'Keterlambatan material baja', 4, 4, 'open', 'Manajer Pengadaan', 'Diversifikasi supplier', now() + interval '30 days'),
    (_uid, _proj2, 'Kenaikan harga aspal >10%', 3, 5, 'open', 'Estimator', 'Kontrak harga tetap', now() + interval '45 days');

  INSERT INTO public.budget_entries (user_id, project_id, category, period_month, planned_amount, actual_amount, notes, mitigation_plan)
  VALUES
    (_uid, _proj1, 'Material Struktur', '2025-01', 2500000000, 2650000000, 'Harga baja naik', 'Negosiasi ulang'),
    (_uid, _proj1, 'Upah Tenaga Kerja', '2025-01', 1200000000, 1180000000, 'Efisiensi shift', ''),
    (_uid, _proj2, 'Material Aspal', '2025-01', 5000000000, 4800000000, 'Harga lebih baik', '');

  INSERT INTO public.k3_checklists (id, user_id, project_id, inspector_name, location, inspection_date, status, completed_items, total_items, notes)
  VALUES (_k3_id, _uid, _proj1, 'Ir. Budi Santoso', 'Lantai 3', CURRENT_DATE - 7, 'completed', 8, 10, 'Inspeksi rutin');

  INSERT INTO public.k3_checklist_items (checklist_id, category, item_text, is_compliant, finding, corrective_action, sort_order)
  VALUES
    (_k3_id, 'APD', 'Helm safety digunakan', true, '', '', 1),
    (_k3_id, 'APD', 'Safety harness >2m', true, '', '', 2),
    (_k3_id, 'Lingkungan', 'Rambu K3 terpasang', false, 'Belum terpasang', 'Pasang rambu', 3);

  INSERT INTO public.lkut_reports (user_id, report_year, status, sbu_number, sbu_type, sbu_expiry_date, tkk_replacement, equipment_commitment_fulfilled, smap_fulfilled, experience_records_complete, asset_value_current, asset_value_previous, sales_value, gross_profit, current_assets, short_term_liabilities, total_liabilities, total_equity, gcg_applied, smk3_applied, total_employees, trained_employees, contract_experts, permanent_experts, certifications, awards, notes)
  VALUES (_uid, 2024, 'draft', 'SBU-JK-2024-001234', 'perpanjangan', '2025-12-31', false, true, true, true, 15000000000, 12000000000, 35000000000, 5200000000, 8500000000, 3200000000, 6800000000, 8200000000, true, true, 185, 120, 15, 8, 'ISO 9001:2015', 'Kontraktor Terbaik 2023', 'Demo LKUT');

  INSERT INTO public.competency_scores (user_id, period, learning_points, project_points, toolkit_points, contribution_points, total_score)
  VALUES (_uid, '2025-Q1', 25, 35, 20, 10, 90);

  INSERT INTO public.performance_grades (user_id, period, financial_score, project_score, compliance_score, risk_score, total_score, grade, breakdown)
  VALUES (_uid, '2025-Q1', 82, 88, 75, 70, 78.75, 'B+', '{}'::jsonb);

  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (_uid, 'info', 'Selamat Datang! 🎉', 'Data demo telah dimuat.');

  RETURN NEW;
END;
$function$;