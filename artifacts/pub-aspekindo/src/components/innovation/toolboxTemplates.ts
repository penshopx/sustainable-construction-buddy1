// Template data for all Toolbox (📦) and Toolkit (🧰) items

export interface TemplateSection {
  title: string;
  type: "checklist" | "table" | "form" | "guide" | "formula";
  items?: string[];
  columns?: string[];
  rows?: string[][];
  fields?: { label: string; placeholder?: string }[];
  content?: string;
}

export interface ToolboxTemplate {
  id: string;
  name: string;
  type: "toolbox" | "toolkit";
  objective: string;
  sections: TemplateSection[];
  tips?: string[];
}

export const toolboxTemplates: Record<string, ToolboxTemplate> = {
  // ===== STRATEGIC BUSINESS =====
  "Contingency Allocation Optimizer": {
    id: "contingency-alloc",
    name: "Contingency Allocation Optimizer",
    type: "toolbox",
    objective: "Menentukan cadangan biaya optimal berdasarkan profil risiko proyek",
    sections: [
      {
        title: "Data Proyek",
        type: "form",
        fields: [
          { label: "Nama Proyek", placeholder: "Proyek Gedung XYZ" },
          { label: "Nilai Kontrak (Rp)", placeholder: "10,000,000,000" },
          { label: "Durasi (bulan)", placeholder: "18" },
          { label: "Tipe Proyek", placeholder: "Gedung / Jalan / Jembatan / Irigasi" },
        ],
      },
      {
        title: "Checklist Faktor Risiko",
        type: "checklist",
        items: [
          "Lokasi proyek terpencil / akses sulit",
          "Pemilik proyek memiliki riwayat keterlambatan pembayaran",
          "Desain belum final / kemungkinan perubahan tinggi",
          "Material utama impor / harga fluktuatif",
          "Tenaga ahli terbatas / perlu mobilisasi dari luar",
          "Cuaca ekstrem (musim hujan panjang)",
          "Regulasi / perizinan kompleks",
          "Multi-subkontraktor (>5 sub)",
          "Proyek pertama di tipe/skala ini",
          "Kondisi tanah tidak pasti (belum ada soil test)",
        ],
      },
      {
        title: "Alokasi Contingency (% dari Nilai Kontrak)",
        type: "table",
        columns: ["Jumlah Risiko Tercentang", "Level Risiko", "% Contingency", "Nilai Cadangan"],
        rows: [
          ["0–2", "Rendah", "3–5%", "Rp ..."],
          ["3–5", "Sedang", "5–8%", "Rp ..."],
          ["6–8", "Tinggi", "8–12%", "Rp ..."],
          ["9–10", "Sangat Tinggi", "12–15%", "Rp ..."],
        ],
      },
    ],
    tips: [
      "Jangan pernah menawar tender tanpa contingency minimal 3%",
      "Alokasi contingency untuk material impor minimal 5% terpisah",
      "Review ulang contingency setiap quarter proyek berjalan",
    ],
  },

  "Competitor Intelligence System": {
    id: "competitor-intel",
    name: "Competitor Intelligence System",
    type: "toolbox",
    objective: "Database harga dan pola kompetitor untuk strategi penawaran lebih cerdas",
    sections: [
      {
        title: "Database Kompetitor",
        type: "table",
        columns: ["Nama Kompetitor", "Tipe Proyek", "Harga Penawaran", "Harga Pemenang", "Selisih %", "Catatan"],
        rows: [
          ["PT. ABC", "Gedung", "Rp ...", "Rp ...", "...%", "Agresif di harga"],
          ["PT. DEF", "Jalan", "Rp ...", "Rp ...", "...%", "Kuat di teknis"],
          ["PT. GHI", "Jembatan", "Rp ...", "Rp ...", "...%", "Sering joint venture"],
        ],
      },
      {
        title: "Checklist Analisis Sebelum Tender",
        type: "checklist",
        items: [
          "Identifikasi 3-5 kompetitor utama untuk tender ini",
          "Cek riwayat harga penawaran kompetitor di tender serupa",
          "Analisis pola margin kompetitor (agresif/konservatif)",
          "Periksa kapasitas aktual kompetitor saat ini",
          "Evaluasi keunggulan teknis kita vs kompetitor",
          "Tentukan strategi: bersaing harga atau diferensiasi teknis",
        ],
      },
    ],
    tips: [
      "Update database setiap selesai tender (menang atau kalah)",
      "Catat pola: kompetitor mana yang selalu menang di tipe proyek tertentu",
    ],
  },

  "Project Bankability Readiness Score": {
    id: "bankability-score",
    name: "Project Bankability Readiness Score",
    type: "toolkit",
    objective: "Menilai kesiapan proyek untuk pembiayaan bank atau investor",
    sections: [
      {
        title: "Kriteria Penilaian Bankability",
        type: "table",
        columns: ["Aspek", "Bobot", "Skor (1-5)", "Nilai"],
        rows: [
          ["Kelengkapan dokumen kontrak", "15%", "...", "..."],
          ["Track record perusahaan", "20%", "...", "..."],
          ["Cashflow projection realistis", "20%", "...", "..."],
          ["Jaminan / collateral tersedia", "15%", "...", "..."],
          ["Rasio utang terhadap ekuitas", "10%", "...", "..."],
          ["Pengalaman proyek serupa", "10%", "...", "..."],
          ["Kemampuan bayar (DSCR)", "10%", "...", "..."],
        ],
      },
      {
        title: "Checklist Dokumen Pembiayaan",
        type: "checklist",
        items: [
          "Salinan kontrak proyek yang sah",
          "Laporan keuangan 3 tahun terakhir (audited)",
          "Proyeksi cashflow proyek",
          "Company profile lengkap",
          "Daftar pengalaman proyek 5 tahun terakhir",
          "SBU & NIB aktif",
          "Surat referensi bank",
          "Rencana penggunaan dana",
        ],
      },
      {
        title: "Interpretasi Skor",
        type: "guide",
        content: "**Skor 4.0–5.0**: Proyek sangat bankable, siap diajukan ke bank.\n**Skor 3.0–3.9**: Perlu perbaikan di beberapa aspek sebelum pengajuan.\n**Skor 2.0–2.9**: Risiko tinggi, pertimbangkan joint venture atau penjaminan tambahan.\n**Skor <2.0**: Belum siap untuk pembiayaan bank.",
      },
    ],
  },

  // ===== FINANCIAL CONTROL =====
  "Profit Engineering Model": {
    id: "profit-engineering",
    name: "Profit Engineering Model",
    type: "toolbox",
    objective: "Strategi rekayasa biaya dan produktivitas untuk memaksimalkan laba",
    sections: [
      {
        title: "Analisis Komponen Biaya",
        type: "table",
        columns: ["Komponen", "Biaya Rencana", "Biaya Aktual", "Selisih", "Aksi Penghematan"],
        rows: [
          ["Material", "Rp ...", "Rp ...", "Rp ...", "Negosiasi volume"],
          ["Upah", "Rp ...", "Rp ...", "Rp ...", "Optimasi shift"],
          ["Alat", "Rp ...", "Rp ...", "Rp ...", "Utilitas >80%"],
          ["Subkon", "Rp ...", "Rp ...", "Rp ...", "Evaluasi vendor"],
          ["Overhead", "Rp ...", "Rp ...", "Rp ...", "Shared cost"],
        ],
      },
      {
        title: "Checklist Profit Engineering",
        type: "checklist",
        items: [
          "Identifikasi 3 item pekerjaan dengan margin terbesar",
          "Negosiasi ulang harga material dengan volume commitment",
          "Optimalkan metode kerja untuk mengurangi durasi",
          "Evaluasi penggantian material alternatif (value engineering)",
          "Minimalkan idle time alat berat (target utilisasi >80%)",
          "Review subkontraktor: ganti yang underperform",
          "Implementasi waste reduction di material (target <5%)",
          "Percepat pekerjaan jalur kritis untuk hindari denda",
        ],
      },
    ],
    tips: [
      "Fokus pada 20% item pekerjaan yang menyumbang 80% biaya",
      "Setiap 1% penghematan di material = dampak signifikan ke margin",
    ],
  },

  "Overhead Allocation Engine": {
    id: "overhead-alloc",
    name: "Overhead Allocation Engine",
    type: "toolbox",
    objective: "Distribusi biaya kantor pusat ke proyek secara adil dan akurat",
    sections: [
      {
        title: "Tabel Distribusi Overhead",
        type: "table",
        columns: ["Jenis Overhead", "Total Biaya/bln", "Proyek A (%)", "Proyek B (%)", "Proyek C (%)"],
        rows: [
          ["Gaji manajemen", "Rp ...", "...%", "...%", "...%"],
          ["Sewa kantor", "Rp ...", "...%", "...%", "...%"],
          ["IT & software", "Rp ...", "...%", "...%", "...%"],
          ["Legal & perizinan", "Rp ...", "...%", "...%", "...%"],
          ["Asuransi", "Rp ...", "...%", "...%", "...%"],
        ],
      },
      {
        title: "Metode Alokasi",
        type: "guide",
        content: "**Metode 1 - Proporsional Nilai Kontrak**: Overhead dialokasikan berdasarkan persentase nilai kontrak masing-masing proyek.\n\n**Metode 2 - Proporsional Durasi**: Dialokasikan berdasarkan sisa durasi proyek.\n\n**Metode 3 - Activity-Based**: Dialokasikan berdasarkan aktivitas aktual yang menggunakan sumber daya kantor pusat.\n\n**Rekomendasi**: Gunakan Metode 3 untuk akurasi tertinggi, Metode 1 untuk kemudahan.",
      },
    ],
  },

  "Cashflow Stress Testing Tool": {
    id: "cashflow-stress-template",
    name: "Cashflow Stress Testing Tool",
    type: "toolbox",
    objective: "Template simulasi kondisi ekstrem terhadap likuiditas perusahaan",
    sections: [
      {
        title: "Skenario Stress Test",
        type: "table",
        columns: ["Skenario", "Parameter", "Dampak Cashflow", "Bulan Bertahan"],
        rows: [
          ["Pembayaran mundur 60 hari", "Termin +60 hari", "Rp ...", "... bulan"],
          ["Material naik 15%", "Harga +15%", "Rp ...", "... bulan"],
          ["Proyek baru delay 3 bulan", "Revenue -3 bulan", "Rp ...", "... bulan"],
          ["Kombinasi terburuk", "Semua faktor", "Rp ...", "... bulan"],
        ],
      },
      {
        title: "Checklist Mitigasi",
        type: "checklist",
        items: [
          "Siapkan credit line darurat di bank",
          "Negosiasi termin pembayaran lebih cepat dengan owner",
          "Tunda pembelian non-kritis jika cashflow negatif",
          "Identifikasi aset yang bisa dijadikan jaminan darurat",
          "Siapkan jadwal penagihan proaktif mingguan",
        ],
      },
    ],
  },

  "Financial War Room Dashboard": {
    id: "financial-warroom",
    name: "Financial War Room Dashboard",
    type: "toolkit",
    objective: "Dashboard keuangan strategis untuk direksi dengan multi-project liquidity",
    sections: [
      {
        title: "KPI Dashboard Keuangan",
        type: "table",
        columns: ["KPI", "Target", "Aktual", "Status"],
        rows: [
          ["Current Ratio", ">1.5", "...", "🟢/🟡/🔴"],
          ["DSCR", ">1.2", "...", "🟢/🟡/🔴"],
          ["Gross Profit Margin", ">12%", "...", "🟢/🟡/🔴"],
          ["Rata-rata Collection Days", "<45 hari", "...", "🟢/🟡/🔴"],
          ["Cash Runway", ">6 bulan", "...", "🟢/🟡/🔴"],
          ["Utilisasi Overhead", "<8%", "...", "🟢/🟡/🔴"],
        ],
      },
      {
        title: "Checklist Review Bulanan Direksi",
        type: "checklist",
        items: [
          "Review cashflow seluruh proyek aktif",
          "Identifikasi proyek dengan margin di bawah target",
          "Cek status piutang jatuh tempo >30 hari",
          "Evaluasi kapasitas menerima proyek baru",
          "Review exposure risiko keuangan terbesar",
          "Update proyeksi laba rugi tahunan",
        ],
      },
    ],
  },

  // ===== PROJECT PLANNING =====
  "Critical Path Early Warning System": {
    id: "critical-path-ews",
    name: "Critical Path Early Warning System",
    type: "toolbox",
    objective: "Template alarm dini jika jalur kritis terancam mundur",
    sections: [
      {
        title: "Monitoring Jalur Kritis",
        type: "table",
        columns: ["Aktivitas Kritis", "Durasi Rencana", "Progress %", "Float (hari)", "Status"],
        rows: [
          ["Pekerjaan struktur Lt.1", "30 hari", "...%", "...", "🟢/🟡/🔴"],
          ["Pengecoran kolom utama", "14 hari", "...%", "...", "🟢/🟡/🔴"],
          ["Instalasi MEP utama", "21 hari", "...%", "...", "🟢/🟡/🔴"],
          ["Finishing area kritis", "28 hari", "...%", "...", "🟢/🟡/🔴"],
        ],
      },
      {
        title: "Checklist Early Warning",
        type: "checklist",
        items: [
          "Float <3 hari → Eskalasi ke Project Manager",
          "Float 0 hari → Rapat darurat & rencana percepatan",
          "Dependency material kritis sudah di-order",
          "Tenaga kerja tersedia untuk lembur jika diperlukan",
          "Subkontraktor jalur kritis dikonfirmasi siap",
          "Cuaca 7 hari ke depan sudah dicek",
        ],
      },
    ],
    tips: ["Update monitoring minimal 2x seminggu", "Trigger warning jika progress aktual <90% dari rencana"],
  },

  "Acceleration Cost Impact Simulator": {
    id: "accel-cost-sim",
    name: "Acceleration Cost Impact Simulator",
    type: "toolbox",
    objective: "Menghitung biaya tambahan akibat percepatan jadwal proyek",
    sections: [
      {
        title: "Parameter Percepatan",
        type: "form",
        fields: [
          { label: "Aktivitas yang dipercepat", placeholder: "Pekerjaan struktur Lt.3" },
          { label: "Durasi normal (hari)", placeholder: "30" },
          { label: "Durasi dipercepat (hari)", placeholder: "20" },
          { label: "Biaya normal (Rp)", placeholder: "500,000,000" },
        ],
      },
      {
        title: "Komponen Biaya Percepatan",
        type: "table",
        columns: ["Komponen", "Biaya Normal", "Biaya Percepatan", "Tambahan"],
        rows: [
          ["Lembur tenaga kerja", "Rp 0", "Rp ...", "Rp ..."],
          ["Shift tambahan (malam)", "Rp 0", "Rp ...", "Rp ..."],
          ["Alat berat tambahan", "Rp 0", "Rp ...", "Rp ..."],
          ["Material express delivery", "Rp 0", "Rp ...", "Rp ..."],
          ["Supervisi tambahan", "Rp 0", "Rp ...", "Rp ..."],
          ["TOTAL BIAYA PERCEPATAN", "—", "—", "Rp ..."],
        ],
      },
      {
        title: "Formula",
        type: "formula",
        content: "**Cost Slope** = (Crash Cost - Normal Cost) / (Normal Duration - Crash Duration)\n\n**Break-even**: Bandingkan Cost Slope vs Denda keterlambatan per hari.\nJika Cost Slope < Denda/hari → percepatan layak dilakukan.",
      },
    ],
  },

  "Risk Heatmap Planner": {
    id: "risk-heatmap",
    name: "Risk Heatmap Planner",
    type: "toolbox",
    objective: "Visualisasi tingkat risiko tiap aktivitas proyek",
    sections: [
      {
        title: "Matriks Risiko Aktivitas",
        type: "table",
        columns: ["Aktivitas", "Probabilitas (1-5)", "Dampak (1-5)", "Skor Risiko", "Level"],
        rows: [
          ["Galian tanah", "...", "...", "...", "🟢/🟡/🔴"],
          ["Pondasi", "...", "...", "...", "🟢/🟡/🔴"],
          ["Struktur", "...", "...", "...", "🟢/🟡/🔴"],
          ["MEP", "...", "...", "...", "🟢/🟡/🔴"],
          ["Finishing", "...", "...", "...", "🟢/🟡/🔴"],
          ["Landscape", "...", "...", "...", "🟢/🟡/🔴"],
        ],
      },
      {
        title: "Panduan Level Risiko",
        type: "guide",
        content: "**Skor 1–5 (Hijau)**: Risiko rendah, monitoring rutin.\n**Skor 6–12 (Kuning)**: Risiko sedang, siapkan mitigasi.\n**Skor 13–19 (Oranye)**: Risiko tinggi, mitigasi aktif diperlukan.\n**Skor 20–25 (Merah)**: Risiko kritis, eskalasi segera ke manajemen.",
      },
      {
        title: "Checklist Mitigasi per Level",
        type: "checklist",
        items: [
          "Semua risiko merah sudah punya rencana mitigasi tertulis",
          "Budget contingency dialokasikan untuk risiko oranye & merah",
          "PIC mitigasi ditunjuk untuk setiap risiko tinggi",
          "Review heatmap dilakukan setiap 2 minggu",
          "Eskalasi otomatis jika skor naik >5 poin",
        ],
      },
    ],
  },

  "Baseline Reliability Index": {
    id: "baseline-reliability",
    name: "Baseline Reliability Index",
    type: "toolkit",
    objective: "Menilai tingkat keandalan jadwal awal proyek",
    sections: [
      {
        title: "Kriteria Keandalan Baseline",
        type: "table",
        columns: ["Kriteria", "Bobot", "Skor (1-5)", "Nilai"],
        rows: [
          ["Logic relationship lengkap & benar", "20%", "...", "..."],
          ["Durasi berdasarkan data produktivitas histori", "20%", "...", "..."],
          ["Resource loaded (tenaga, alat, material)", "15%", "...", "..."],
          ["Critical path teridentifikasi jelas", "15%", "...", "..."],
          ["Buffer/float cukup di milestone kunci", "10%", "...", "..."],
          ["Constraint eksternal sudah diperhitungkan", "10%", "...", "..."],
          ["Review & approval dari stakeholder", "10%", "...", "..."],
        ],
      },
      {
        title: "Interpretasi",
        type: "guide",
        content: "**Skor 4.0–5.0**: Baseline sangat andal, siap digunakan sebagai acuan.\n**Skor 3.0–3.9**: Perlu perbaikan minor di beberapa aspek.\n**Skor 2.0–2.9**: Baseline kurang andal, risiko deviation tinggi.\n**Skor <2.0**: Baseline perlu dibuat ulang sebelum proyek dimulai.",
      },
    ],
  },

  "Procurement Lead-Time Optimizer": {
    id: "procurement-leadtime",
    name: "Procurement Lead-Time Optimizer",
    type: "toolkit",
    objective: "Perencanaan waktu pemesanan material kritis agar tidak terlambat",
    sections: [
      {
        title: "Tracking Material Kritis",
        type: "table",
        columns: ["Material", "Kebutuhan (tgl)", "Lead Time", "Order Deadline", "Status"],
        rows: [
          ["Baja struktur", "...", "... minggu", "...", "⏳"],
          ["Ready mix concrete", "...", "... minggu", "...", "⏳"],
          ["Formwork system", "...", "... minggu", "...", "⏳"],
          ["Kabel listrik", "...", "... minggu", "...", "⏳"],
          ["Pipa HDPE", "...", "... minggu", "...", "⏳"],
          ["Lift / elevator", "...", "... minggu", "...", "⏳"],
        ],
      },
      {
        title: "Checklist Procurement",
        type: "checklist",
        items: [
          "Semua material kritis sudah diidentifikasi dari jadwal",
          "Lead time vendor sudah dikonfirmasi tertulis",
          "Buffer waktu minimal 2 minggu ditambahkan",
          "Alternatif vendor sudah diidentifikasi untuk material kritis",
          "Approval sample/shop drawing sudah masuk timeline",
          "Koordinasi dengan gudang/logistik proyek",
        ],
      },
    ],
    tips: ["Material impor: tambahkan buffer 4-6 minggu untuk customs", "Konfirmasi lead time ulang 2 minggu sebelum order deadline"],
  },

  // ===== EXECUTION & SITE CONTROL =====
  "Lean Workflow Engine": {
    id: "lean-workflow",
    name: "Lean Workflow Engine",
    type: "toolbox",
    objective: "Template mengurangi pemborosan dalam alur kerja proyek",
    sections: [
      {
        title: "Identifikasi 7 Waste Konstruksi",
        type: "checklist",
        items: [
          "WAITING: Tenaga kerja menunggu material/instruksi → Solusi: Pre-planning harian",
          "TRANSPORT: Pergerakan material berlebihan → Solusi: Layout site optimal",
          "OVERPRODUCTION: Pekerjaan dilakukan sebelum waktunya → Solusi: Just-in-time",
          "DEFECTS: Pekerjaan ulang (rework) → Solusi: First-time quality checklist",
          "INVENTORY: Material menumpuk di site → Solusi: Delivery scheduling",
          "MOTION: Pergerakan pekerja tidak produktif → Solusi: Zoning area kerja",
          "OVERPROCESSING: Proses berlebihan → Solusi: Standardisasi metode kerja",
        ],
      },
      {
        title: "Template Waste Tracking Mingguan",
        type: "table",
        columns: ["Jenis Waste", "Insiden Minggu Ini", "Estimasi Kerugian (Rp)", "Root Cause", "Corrective Action"],
        rows: [
          ["Waiting", "...", "Rp ...", "...", "..."],
          ["Rework", "...", "Rp ...", "...", "..."],
          ["Material waste", "...", "Rp ...", "...", "..."],
          ["Idle equipment", "...", "Rp ...", "...", "..."],
        ],
      },
    ],
  },

  "Site Waste Reduction System": {
    id: "site-waste",
    name: "Site Waste Reduction System",
    type: "toolbox",
    objective: "Template pengurangan limbah material untuk efisiensi biaya",
    sections: [
      {
        title: "Monitoring Waste Material",
        type: "table",
        columns: ["Material", "Volume Pakai", "Volume Waste", "% Waste", "Target", "Status"],
        rows: [
          ["Beton", "... m³", "... m³", "...%", "<3%", "🟢/🔴"],
          ["Baja tulangan", "... kg", "... kg", "...%", "<5%", "🟢/🔴"],
          ["Bata/block", "... pcs", "... pcs", "...%", "<3%", "🟢/🔴"],
          ["Keramik/tile", "... m²", "... m²", "...%", "<5%", "🟢/🔴"],
          ["Kayu bekisting", "... m³", "... m³", "...%", "<8%", "🟢/🔴"],
        ],
      },
      {
        title: "Checklist Pengurangan Waste",
        type: "checklist",
        items: [
          "Cutting plan dibuat sebelum pemotongan material",
          "Sisa material dikumpulkan dan diinventaris untuk reuse",
          "Pekerja ditraining tentang handling material yang benar",
          "Storage area terlindung dari hujan dan kelembaban",
          "Bekisting dirancang untuk penggunaan berulang (min 3x)",
          "Volume order material sesuai BQ + waste allowance resmi",
        ],
      },
    ],
  },

  "Material Traceability System": {
    id: "material-trace",
    name: "Material Traceability System",
    type: "toolbox",
    objective: "Template melacak asal dan mutu material dari sumber sampai terpasang",
    sections: [
      {
        title: "Log Traceability Material",
        type: "table",
        columns: ["Material", "Supplier", "No. Batch", "Tgl Terima", "Hasil Test", "Lokasi Terpasang"],
        rows: [
          ["Ready mix K-350", "...", "...", "...", "✅/❌", "Kolom Lt.2"],
          ["Baja D16", "...", "...", "...", "✅/❌", "Balok Lt.3"],
          ["Pipa PVC 4\"", "...", "...", "...", "✅/❌", "Plumbing Lt.1"],
        ],
      },
      {
        title: "Checklist Penerimaan Material",
        type: "checklist",
        items: [
          "Sertifikat material / mill certificate tersedia",
          "Volume/quantity sesuai PO",
          "Kondisi fisik material baik (tidak rusak/cacat)",
          "Hasil uji lab memenuhi spesifikasi",
          "Dokumentasi foto saat penerimaan",
          "Material disimpan sesuai prosedur penyimpanan",
        ],
      },
    ],
  },

  "Field Compliance Audit Toolkit": {
    id: "field-audit",
    name: "Field Compliance Audit Toolkit",
    type: "toolbox",
    objective: "Template audit cepat kepatuhan teknis dan K3 di lapangan",
    sections: [
      {
        title: "Checklist Audit Lapangan",
        type: "checklist",
        items: [
          "APD lengkap dipakai semua pekerja (helm, rompi, sepatu)",
          "Rambu K3 terpasang di area berbahaya",
          "Scaffolding memenuhi standar keamanan",
          "Material berbahaya tersimpan sesuai MSDS",
          "Metode kerja sesuai dengan shop drawing approved",
          "Alat ukur (waterpass, theodolit) terkalibrasi",
          "Hasil uji material terdokumentasi",
          "Housekeeping area kerja tertib dan bersih",
          "Jalur evakuasi tidak terhalang",
          "P3K kit tersedia dan lengkap",
          "Izin kerja (work permit) berlaku untuk pekerjaan berbahaya",
          "Electrical grounding terpasang dengan benar",
        ],
      },
      {
        title: "Template Laporan Audit",
        type: "form",
        fields: [
          { label: "Tanggal Audit", placeholder: "DD/MM/YYYY" },
          { label: "Auditor", placeholder: "Nama auditor" },
          { label: "Area/Zona", placeholder: "Lantai 3 - Zona A" },
          { label: "Skor Kepatuhan (%)", placeholder: "85%" },
          { label: "Temuan Kritis", placeholder: "Deskripsi temuan" },
          { label: "Deadline Perbaikan", placeholder: "DD/MM/YYYY" },
        ],
      },
    ],
  },

  "Equipment Utilization Optimizer": {
    id: "equipment-util",
    name: "Equipment Utilization Optimizer",
    type: "toolkit",
    objective: "Meningkatkan produktivitas dan utilisasi alat berat di proyek",
    sections: [
      {
        title: "Monitoring Utilisasi Alat",
        type: "table",
        columns: ["Alat", "Jam Tersedia", "Jam Operasi", "Jam Idle", "Utilisasi %", "Target"],
        rows: [
          ["Excavator 20T", "10 jam", "... jam", "... jam", "...%", ">75%"],
          ["Tower Crane", "10 jam", "... jam", "... jam", "...%", ">70%"],
          ["Concrete Pump", "8 jam", "... jam", "... jam", "...%", ">65%"],
          ["Dump Truck", "10 jam", "... jam", "... jam", "...%", ">80%"],
        ],
      },
      {
        title: "Checklist Optimasi",
        type: "checklist",
        items: [
          "Jadwal pemakaian alat dibuat per minggu",
          "Alat idle >2 jam/hari → investigasi penyebab",
          "Maintenance preventif sesuai jadwal (tidak terlambat)",
          "Operator terlatih dan bersertifikat",
          "Utilisasi <60% → pertimbangkan sharing antar proyek",
          "Log operasi harian diisi lengkap oleh operator",
        ],
      },
    ],
  },

  "Defect Cost Impact Calculator": {
    id: "defect-cost-calc",
    name: "Defect Cost Impact Calculator",
    type: "toolkit",
    objective: "Menghitung dampak biaya akibat defect dan pekerjaan ulang",
    sections: [
      {
        title: "Log Defect & Biaya Rework",
        type: "table",
        columns: ["No", "Lokasi", "Jenis Defect", "Biaya Rework", "Biaya Delay", "Total Dampak", "Root Cause"],
        rows: [
          ["1", "...", "Retak beton", "Rp ...", "Rp ...", "Rp ...", "Mix design / curing"],
          ["2", "...", "Bocor atap", "Rp ...", "Rp ...", "Rp ...", "Workmanship"],
          ["3", "...", "Level lantai off", "Rp ...", "Rp ...", "Rp ...", "Survey error"],
        ],
      },
      {
        title: "Formula Dampak",
        type: "formula",
        content: "**Total Cost of Defect** = Direct Rework Cost + Delay Cost + Reputation Cost\n\n**Cost of Poor Quality (COPQ)** = Total Defect Cost / Total Project Cost × 100%\n\n**Target**: COPQ < 2% dari nilai proyek. Industri rata-rata: 5-10%.",
      },
      {
        title: "Checklist Pencegahan",
        type: "checklist",
        items: [
          "Inspection checklist diterapkan sebelum pengecoran",
          "Mock-up / sample disetujui sebelum produksi massal",
          "Training pekerja baru sebelum mulai kerja",
          "Material test dilakukan sebelum digunakan",
          "Hold point inspection oleh QC tidak dilewati",
        ],
      },
    ],
  },

  // ===== SUPPLY CHAIN =====
  "Joint Risk Sharing Contract Model": {
    id: "joint-risk",
    name: "Joint Risk Sharing Contract Model",
    type: "toolbox",
    objective: "Template pembagian risiko yang adil antara owner, kontraktor, dan supplier",
    sections: [
      {
        title: "Matriks Pembagian Risiko",
        type: "table",
        columns: ["Jenis Risiko", "Owner", "Kontraktor", "Subkon/Supplier", "Asuransi"],
        rows: [
          ["Force majeure", "70%", "20%", "—", "10%"],
          ["Kenaikan harga material", "50%", "50%", "—", "—"],
          ["Keterlambatan desain", "100%", "—", "—", "—"],
          ["Defect pekerjaan", "—", "70%", "30%", "—"],
          ["Keterlambatan pengiriman", "—", "30%", "70%", "—"],
          ["Perubahan regulasi", "60%", "40%", "—", "—"],
        ],
      },
      {
        title: "Checklist Negosiasi Kontrak",
        type: "checklist",
        items: [
          "Klausul eskalasi harga material sudah dimasukkan",
          "Batas waktu klaim perpanjangan waktu jelas",
          "Mekanisme dispute resolution tertulis",
          "Batasan denda keterlambatan (cap) sudah dinegosiasi",
          "Retensi dan jadwal pelepasan sudah disepakati",
          "Tanggung jawab asuransi CAR/TPL sudah jelas",
        ],
      },
    ],
  },

  "Vendor Lock-In Escape Planner": {
    id: "vendor-lockin",
    name: "Vendor Lock-In Escape Planner",
    type: "toolbox",
    objective: "Strategi menghindari ketergantungan berlebihan pada satu vendor",
    sections: [
      {
        title: "Assessment Ketergantungan Vendor",
        type: "checklist",
        items: [
          "Apakah >50% material kritis dari satu vendor? → Risiko tinggi",
          "Apakah vendor memiliki substitusi yang setara? → Cek alternatif",
          "Apakah switching cost ke vendor lain >5% nilai order? → Perlu strategi",
          "Apakah kontrak mencegah penggunaan vendor alternatif? → Review klausul",
          "Apakah lead time vendor terus meningkat? → Tanda warning",
        ],
      },
      {
        title: "Strategi Diversifikasi",
        type: "table",
        columns: ["Material/Jasa", "Vendor Utama", "Vendor Backup 1", "Vendor Backup 2", "% Alokasi"],
        rows: [
          ["Ready mix", "...", "...", "...", "60/25/15"],
          ["Baja tulangan", "...", "...", "...", "50/30/20"],
          ["Formwork", "...", "...", "...", "70/30/—"],
        ],
      },
    ],
  },

  "Last-Mile Delivery Optimizer": {
    id: "lastmile-delivery",
    name: "Last-Mile Delivery Optimizer",
    type: "toolkit",
    objective: "Meminimalkan biaya dan risiko pengiriman material ke proyek",
    sections: [
      {
        title: "Checklist Optimasi Pengiriman",
        type: "checklist",
        items: [
          "Jalur akses ke site sudah disurvei (lebar, tinggi, tonase jembatan)",
          "Jadwal delivery disesuaikan jam non-macet",
          "Koordinasi dengan security site untuk gate access",
          "Area unloading dan staging sudah disiapkan",
          "Alat bantu unloading (crane/forklift) tersedia di jadwal delivery",
          "Backup plan jika jalur utama terblokir",
        ],
      },
      {
        title: "Template Jadwal Delivery",
        type: "table",
        columns: ["Material", "Volume", "Asal", "Tgl Kirim", "Jam Tiba", "Gate", "PIC Terima"],
        rows: [
          ["Ready mix", "... m³", "...", "...", "...", "Gate ...", "..."],
          ["Baja", "... ton", "...", "...", "...", "Gate ...", "..."],
        ],
      },
    ],
  },

  // ===== HUMAN CAPITAL =====
  "Safety Culture Index": {
    id: "safety-culture",
    name: "Safety Culture Index",
    type: "toolbox",
    objective: "Mengukur budaya K3 di organisasi",
    sections: [
      {
        title: "Survey Budaya K3",
        type: "table",
        columns: ["Aspek", "Skor (1-5)", "Bobot", "Nilai"],
        rows: [
          ["Komitmen manajemen terhadap K3", "...", "20%", "..."],
          ["Partisipasi pekerja dalam toolbox meeting", "...", "15%", "..."],
          ["Pelaporan near-miss tanpa hukuman", "...", "20%", "..."],
          ["Ketersediaan APD lengkap", "...", "15%", "..."],
          ["Training K3 rutin dilaksanakan", "...", "15%", "..."],
          ["Investigasi insiden dilakukan segera", "...", "15%", "..."],
        ],
      },
      {
        title: "Interpretasi",
        type: "guide",
        content: "**Skor 4.0–5.0**: Budaya K3 matang. Pertahankan & jadikan benchmark.\n**Skor 3.0–3.9**: Cukup baik, perlu peningkatan di aspek tertentu.\n**Skor 2.0–2.9**: Budaya K3 lemah, risiko kecelakaan tinggi.\n**Skor <2.0**: Darurat! Perlu intervensi serius dan pelatihan massal.",
      },
    ],
  },

  "Talent Pipeline Builder": {
    id: "talent-pipeline",
    name: "Talent Pipeline Builder",
    type: "toolkit",
    objective: "Membangun jalur karir tenaga ahli dan sertifikasi SDM",
    sections: [
      {
        title: "Peta Karir & Sertifikasi",
        type: "table",
        columns: ["Level", "Posisi", "Sertifikasi Wajib", "Pengalaman Min", "Kompetensi Kunci"],
        rows: [
          ["Junior", "Site Engineer", "SKA Muda", "0-3 tahun", "Teknis dasar, AutoCAD"],
          ["Middle", "Project Engineer", "SKA Madya", "3-7 tahun", "Scheduling, cost control"],
          ["Senior", "Project Manager", "SKA Utama", "7-15 tahun", "Leadership, risk mgmt"],
          ["Expert", "Director/VP", "SKA Utama + MBA", "15+ tahun", "Strategic, business dev"],
        ],
      },
      {
        title: "Checklist Pengembangan SDM",
        type: "checklist",
        items: [
          "Setiap karyawan punya individual development plan (IDP)",
          "Budget training minimal 2% dari gaji tahunan",
          "Program mentoring senior-junior aktif berjalan",
          "Rotasi proyek untuk pengembangan kompetensi",
          "Sertifikasi kompetensi difasilitasi perusahaan",
          "Knowledge sharing session bulanan dilaksanakan",
        ],
      },
    ],
  },

  "Labor Productivity Dashboard": {
    id: "labor-productivity",
    name: "Labor Productivity Dashboard",
    type: "toolbox",
    objective: "Template monitoring produktivitas tenaga kerja harian",
    sections: [
      {
        title: "Tracking Produktivitas Harian",
        type: "table",
        columns: ["Pekerjaan", "Jumlah Pekerja", "Jam Kerja", "Output", "Produktivitas", "Target", "Status"],
        rows: [
          ["Pengecoran", "... org", "... jam", "... m³", "... m³/org/jam", "...", "🟢/🔴"],
          ["Pembesian", "... org", "... jam", "... kg", "... kg/org/jam", "...", "🟢/🔴"],
          ["Pasang bata", "... org", "... jam", "... m²", "... m²/org/jam", "...", "🟢/🔴"],
          ["Plester", "... org", "... jam", "... m²", "... m²/org/jam", "...", "🟢/🔴"],
        ],
      },
      {
        title: "Checklist Investigasi Produktivitas Rendah",
        type: "checklist",
        items: [
          "Material tersedia tepat waktu di area kerja?",
          "Gambar kerja & instruksi jelas?",
          "Pekerja memiliki skill yang sesuai?",
          "Alat bantu tersedia dan berfungsi?",
          "Cuaca/kondisi site mempengaruhi?",
          "Koordinasi antar trade tidak bentrok?",
        ],
      },
    ],
  },

  // ===== DIGITAL TRANSFORMATION =====
  "Digital Readiness Assessment": {
    id: "digital-readiness",
    name: "Digital Readiness Assessment",
    type: "toolbox",
    objective: "Mengukur kesiapan perusahaan untuk transformasi digital",
    sections: [
      {
        title: "Assessment Kesiapan Digital",
        type: "table",
        columns: ["Aspek", "Level Saat Ini (1-5)", "Target", "Gap"],
        rows: [
          ["Infrastruktur IT (hardware, internet)", "...", "4", "..."],
          ["Software manajemen proyek", "...", "4", "..."],
          ["Kompetensi digital SDM", "...", "3", "..."],
          ["Digitalisasi proses bisnis", "...", "4", "..."],
          ["Data analytics capability", "...", "3", "..."],
          ["Cybersecurity awareness", "...", "3", "..."],
          ["Budget IT / revenue", "...", "3", "..."],
        ],
      },
      {
        title: "Checklist Quick Wins",
        type: "checklist",
        items: [
          "Implementasi cloud storage untuk dokumen proyek",
          "Gunakan project management tool (min. scheduling digital)",
          "Daily report digital menggantikan kertas",
          "WhatsApp Group → platform kolaborasi terstruktur",
          "Spreadsheet → dashboard otomatis untuk cost control",
          "Training digital literacy untuk site team",
        ],
      },
    ],
  },

  "BIM ROI Calculator": {
    id: "bim-roi",
    name: "BIM ROI Calculator",
    type: "toolkit",
    objective: "Menghitung return on investment dari implementasi BIM",
    sections: [
      {
        title: "Komponen Biaya BIM",
        type: "table",
        columns: ["Komponen", "Biaya (Rp)", "Amortisasi", "Biaya/Proyek"],
        rows: [
          ["Software license (Revit/Tekla)", "Rp ...", "3 tahun", "Rp ..."],
          ["Hardware upgrade", "Rp ...", "5 tahun", "Rp ..."],
          ["Training team", "Rp ...", "1x", "Rp ..."],
          ["BIM Manager (gaji)", "Rp .../tahun", "—", "Rp ..."],
        ],
      },
      {
        title: "Manfaat Terukur BIM",
        type: "table",
        columns: ["Manfaat", "Penghematan %", "Nilai (Rp)", "Basis Perhitungan"],
        rows: [
          ["Pengurangan rework", "30-50%", "Rp ...", "% dari total rework cost"],
          ["Clash detection saving", "5-10%", "Rp ...", "% dari biaya MEP"],
          ["Percepatan jadwal", "5-15%", "Rp ...", "Penghematan overhead"],
          ["Akurasi estimasi", "3-5%", "Rp ...", "Pengurangan waste material"],
        ],
      },
      {
        title: "Formula ROI",
        type: "formula",
        content: "**ROI BIM** = (Total Penghematan - Total Biaya BIM) / Total Biaya BIM × 100%\n\n**Payback Period** = Total Investasi BIM / Penghematan per Proyek\n\n**Benchmark**: ROI BIM rata-rata industri = 300-600% dalam 3 tahun.",
      },
    ],
  },

  // ===== ENVIRONMENTAL & ESG =====
  "Circular Economy Score": {
    id: "circular-economy",
    name: "Circular Economy Score",
    type: "toolbox",
    objective: "Mengukur penerapan ekonomi sirkular di proyek konstruksi",
    sections: [
      {
        title: "Assessment Ekonomi Sirkular",
        type: "table",
        columns: ["Indikator", "Skor (1-5)", "Bobot", "Nilai"],
        rows: [
          ["% Material daur ulang yang digunakan", "...", "20%", "..."],
          ["% Waste yang di-recycle/reuse", "...", "20%", "..."],
          ["Desain untuk disassembly/reuse", "...", "15%", "..."],
          ["Penggunaan material lokal", "...", "15%", "..."],
          ["Efisiensi penggunaan air", "...", "15%", "..."],
          ["Pengurangan emisi transportasi material", "...", "15%", "..."],
        ],
      },
      {
        title: "Checklist Implementasi",
        type: "checklist",
        items: [
          "Identifikasi material yang bisa menggunakan konten daur ulang",
          "Pisahkan waste di site: kayu, besi, beton, plastik",
          "Kerjasama dengan recycler lokal untuk waste bernilai",
          "Gunakan air hujan untuk proses non-potable (curing, dust control)",
          "Prioritaskan material dari supplier radius <100km",
        ],
      },
    ],
  },

  "Community Impact Tracker": {
    id: "community-impact",
    name: "Community Impact Tracker",
    type: "toolkit",
    objective: "Monitoring dampak proyek terhadap masyarakat sekitar",
    sections: [
      {
        title: "Dashboard Dampak Komunitas",
        type: "table",
        columns: ["Indikator", "Target", "Aktual", "Trend"],
        rows: [
          ["Keluhan masyarakat/bulan", "<5", "...", "📈/📉"],
          ["Tenaga kerja lokal terserap", ">30%", "...%", "📈/📉"],
          ["Jalan rusak akibat proyek", "0", "...", "📈/📉"],
          ["Kebisingan (dB) di batas site", "<75dB", "... dB", "📈/📉"],
          ["CSR terlaksana", "100%", "...%", "📈/📉"],
        ],
      },
      {
        title: "Checklist Hubungan Masyarakat",
        type: "checklist",
        items: [
          "Sosialisasi proyek ke RT/RW terdekat sudah dilakukan",
          "Papan informasi proyek terpasang di lokasi",
          "Hotline pengaduan tersedia dan aktif",
          "Perbaikan jalan/infrastruktur terdampak dilakukan rutin",
          "Penyerapan tenaga kerja lokal terdokumentasi",
          "Kegiatan CSR bulanan terlaksana",
        ],
      },
    ],
  },

  // ===== POST-PROJECT =====
  "Post-Project Knowledge Capture": {
    id: "knowledge-capture",
    name: "Post-Project Knowledge Capture",
    type: "toolbox",
    objective: "Template mendokumentasikan lessons learned pasca proyek",
    sections: [
      {
        title: "Template Lessons Learned",
        type: "form",
        fields: [
          { label: "Nama Proyek", placeholder: "..." },
          { label: "Apa yang berjalan baik?", placeholder: "Deskripsi best practice..." },
          { label: "Apa yang bisa diperbaiki?", placeholder: "Deskripsi masalah dan akar penyebab..." },
          { label: "Surprise/unexpected events?", placeholder: "Kejadian tak terduga..." },
          { label: "Rekomendasi untuk proyek sejenis", placeholder: "Saran untuk tim selanjutnya..." },
        ],
      },
      {
        title: "Checklist Knowledge Capture",
        type: "checklist",
        items: [
          "As-built drawing lengkap dan ter-update",
          "Cost report final vs budget disusun",
          "Lessons learned meeting dengan seluruh tim",
          "Database harga aktual diupdate ke sistem",
          "Vendor/subkontraktor dievaluasi dan dirating",
          "Foto dokumentasi proyek terarsip digital",
          "Metode kerja inovatif didokumentasikan",
        ],
      },
    ],
  },

  "Client Satisfaction Engine": {
    id: "client-satisfaction",
    name: "Client Satisfaction Engine",
    type: "toolkit",
    objective: "Mengukur kepuasan klien untuk repeat business",
    sections: [
      {
        title: "Survey Kepuasan Klien",
        type: "table",
        columns: ["Aspek", "Skor (1-5)", "Catatan Klien"],
        rows: [
          ["Kualitas hasil pekerjaan", "...", "..."],
          ["Ketepatan waktu penyelesaian", "...", "..."],
          ["Responsivitas terhadap keluhan", "...", "..."],
          ["Komunikasi dan pelaporan", "...", "..."],
          ["Kebersihan dan ketertiban site", "...", "..."],
          ["Kepatuhan terhadap kontrak", "...", "..."],
          ["Kesiapan serah terima (PHO)", "...", "..."],
        ],
      },
      {
        title: "Tindak Lanjut",
        type: "checklist",
        items: [
          "Kirim survey kepuasan dalam 2 minggu setelah PHO",
          "Follow up skor rendah (<3) dengan rencana perbaikan",
          "Ucapan terima kasih resmi dari direksi",
          "Undang ke acara perusahaan untuk relationship building",
          "Minta testimonial jika skor tinggi (>4)",
          "Jadwalkan courtesy visit 6 bulan setelah FHO",
        ],
      },
    ],
  },
};

// Helper to find template by name (fuzzy match)
export function findTemplate(name: string): ToolboxTemplate | undefined {
  // Exact match first
  if (toolboxTemplates[name]) return toolboxTemplates[name];
  
  // Partial match
  const normalizedName = name.toLowerCase().trim();
  for (const [key, template] of Object.entries(toolboxTemplates)) {
    if (key.toLowerCase().includes(normalizedName) || normalizedName.includes(key.toLowerCase())) {
      return template;
    }
  }
  return undefined;
}
