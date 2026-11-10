import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import OnboardingStepCard from "@/components/onboarding/OnboardingStepCard";
import {
  LayoutDashboard,
  FolderKanban,
  ShieldAlert,
  DollarSign,
  HardHat,
  FileText,
  GraduationCap,
  TrendingUp,
  Lightbulb,
  Rocket,
  Sparkles,
} from "lucide-react";
import {
  WelcomeIllustration,
  DashboardIllustration,
  ProjectsIllustration,
  RiskIllustration,
  BudgetIllustration,
  K3Illustration,
  LkutIllustration,
  CoursesIllustration,
  GradingIllustration,
  InnovationIllustration,
  FinishIllustration,
} from "@/components/onboarding/OnboardingIllustrations";

const STEPS = [
  {
    id: "welcome",
    icon: Rocket,
    title: "Selamat Datang di PUB!",
    subtitle: "Platform Pengembangan Usaha Berkelanjutan",
    description:
      "Mari jelajahi fitur-fitur utama platform ini. Data demo sudah disiapkan agar Anda bisa langsung melihat setiap fitur bekerja.",
    color: "from-pub-amber to-amber-600",
    iconBg: "bg-pub-amber/20 text-pub-amber",
    tips: [
      "Data demo otomatis dimuat saat mendaftar",
      "Anda bisa menghapus/mengubah data demo kapan saja",
      "Gunakan sidebar kiri untuk navigasi antar modul",
    ],
    route: "/dashboard",
    illustration: <WelcomeIllustration />,
  },
  {
    id: "dashboard",
    icon: LayoutDashboard,
    title: "Dashboard Utama",
    subtitle: "Pusat kontrol bisnis Anda",
    description:
      "Dashboard menampilkan ringkasan keseluruhan: level kompetensi, skor kinerja, proyek aktif, dan notifikasi penting.",
    color: "from-blue-600 to-blue-500",
    iconBg: "bg-blue-500/20 text-blue-500",
    tips: [
      "4 Engine skor: Learning, Project, Toolkit, Contribution",
      "Widget proyek aktif menunjukkan status real-time",
      "Notifikasi SBU expiry muncul otomatis",
    ],
    route: "/dashboard",
    illustration: <DashboardIllustration />,
  },
  {
    id: "projects",
    icon: FolderKanban,
    title: "Manajemen Proyek",
    subtitle: "Kelola portofolio proyek konstruksi",
    description:
      "Catat dan pantau semua proyek. Setiap proyek terhubung dengan Risk Register, Budget Tracker, dan K3 Checklist.",
    color: "from-emerald-600 to-emerald-500",
    iconBg: "bg-emerald-500/20 text-emerald-500",
    tips: [
      "3 proyek demo: Gedung, Jalan Tol, Drainase",
      "Complexity Score dihitung otomatis",
      "Klik proyek untuk detail & toolkit terhubung",
    ],
    route: "/projects",
    illustration: <ProjectsIllustration />,
  },
  {
    id: "risk",
    icon: ShieldAlert,
    title: "Risk Register",
    subtitle: "Identifikasi & mitigasi risiko proyek",
    description:
      "Dokumentasikan risiko menggunakan matriks probabilitas × dampak. Tetapkan PIC dan rencana mitigasi.",
    color: "from-red-600 to-orange-500",
    iconBg: "bg-red-500/20 text-red-500",
    tips: [
      "Risk Matrix 5×5 menampilkan peta risiko visual",
      "4 risiko demo sudah terhubung ke proyek",
      "Filter berdasarkan proyek atau level risiko",
    ],
    route: "/risk-register",
    illustration: <RiskIllustration />,
  },
  {
    id: "budget",
    icon: DollarSign,
    title: "Budget Tracker",
    subtitle: "Monitor cashflow & deviasi anggaran",
    description:
      "Pantau realisasi vs rencana anggaran per kategori. Identifikasi deviasi dini dan catat rencana mitigasi.",
    color: "from-green-600 to-emerald-500",
    iconBg: "bg-green-500/20 text-green-500",
    tips: [
      "5 entri budget: Material, Upah, Peralatan",
      "Grafik deviasi menunjukkan tren per bulan",
      "Summary card: total planned vs actual",
    ],
    route: "/budget-tracker",
    illustration: <BudgetIllustration />,
  },
  {
    id: "k3",
    icon: HardHat,
    title: "K3 Checklist",
    subtitle: "Inspeksi Keselamatan & Kesehatan Kerja",
    description:
      "Lakukan inspeksi K3 dengan checklist terstruktur. Dokumentasikan temuan dan hitung skor kepatuhan otomatis.",
    color: "from-yellow-600 to-amber-500",
    iconBg: "bg-yellow-500/20 text-yellow-600",
    tips: [
      "1 inspeksi demo dengan skor 90%",
      "Kategori: APD, Lingkungan, Peralatan, Prosedur",
      "2 temuan minor sudah terisi sebagai contoh",
    ],
    route: "/k3-checklist",
    illustration: <K3Illustration />,
  },
  {
    id: "lkut",
    icon: FileText,
    title: "Laporan LKUT",
    subtitle: "Laporan Kegiatan Usaha Tahunan",
    description:
      "Buat laporan LKUT komprehensif mencakup SBU, keuangan, SDM, sertifikasi, dan penghargaan. Ekspor ke PDF.",
    color: "from-indigo-600 to-violet-500",
    iconBg: "bg-indigo-500/20 text-indigo-500",
    tips: [
      "1 laporan LKUT 2024 dengan data lengkap",
      "Data keuangan: aset, penjualan, laba, ekuitas",
      "Sertifikasi ISO & penghargaan sudah tercatat",
    ],
    route: "/lkut",
    illustration: <LkutIllustration />,
  },
  {
    id: "courses",
    icon: GraduationCap,
    title: "E-Learning & Assessment",
    subtitle: "Tingkatkan kompetensi melalui pembelajaran",
    description:
      "Akses modul e-learning per domain kompetensi. Pre-test menentukan level awal, kuis modul untuk sertifikat.",
    color: "from-purple-600 to-pink-500",
    iconBg: "bg-purple-500/20 text-purple-500",
    tips: [
      "Level: Pemula → Muda → Madya → Utama",
      "Skor ≥70% di kuis = sertifikat digital",
      "Bookmark modul favorit untuk akses cepat",
    ],
    route: "/courses",
    illustration: <CoursesIllustration />,
  },
  {
    id: "grading",
    icon: TrendingUp,
    title: "Performance Grading",
    subtitle: "Penilaian kinerja komprehensif",
    description:
      "Grading otomatis dari 4 pilar: Keuangan, Proyek, Kepatuhan, Risiko. Grade A+ sampai F sebagai tolok ukur.",
    color: "from-cyan-600 to-teal-500",
    iconBg: "bg-cyan-500/20 text-cyan-500",
    tips: [
      "Grade demo: B+ dengan skor 78.75",
      "4 pilar: Financial, Project, Compliance, Risk",
      "Tren grade per periode dalam grafik",
    ],
    route: "/grading",
    illustration: <GradingIllustration />,
  },
  {
    id: "innovation",
    icon: Lightbulb,
    title: "Inovasi & Marketplace",
    subtitle: "Kolaborasi dan jual-beli antar BUJK",
    description:
      "Ajukan proposal inovasi. Gunakan marketplace untuk jual-beli jasa, material, dan template antar anggota.",
    color: "from-orange-600 to-rose-500",
    iconBg: "bg-orange-500/20 text-orange-500",
    tips: [
      "Kategori: Teknologi, Manajemen, Keberlanjutan",
      "Marketplace: jasa konsultan & material",
      "Direktori BUJK menampilkan profil anggota",
    ],
    route: "/inovasi",
    illustration: <InnovationIllustration />,
  },
  {
    id: "finish",
    icon: Sparkles,
    title: "Anda Siap Memulai! 🎉",
    subtitle: "Semua fitur sudah siap digunakan",
    description:
      "Selamat! Anda telah mengenal semua fitur utama. Data demo tersedia di setiap modul. Mulailah dari Dashboard.",
    color: "from-pub-amber to-yellow-500",
    iconBg: "bg-pub-amber/20 text-pub-amber",
    tips: [
      "Eksplorasi setiap modul dengan data demo",
      "Tambahkan data proyek nyata kapan saja",
      "Hubungi Helpdesk AI jika ada pertanyaan",
    ],
    route: "/dashboard",
    illustration: <FinishIllustration />,
  },
];

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  const step = STEPS[currentStep];
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleFinish = () => {
    localStorage.setItem("pub_onboarding_done", "1");
    navigate("/dashboard");
  };

  const handleSkip = () => {
    localStorage.setItem("pub_onboarding_done", "1");
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="w-full px-4 md:px-8 py-3 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="text-sm font-heading font-bold text-foreground">PUB ASPEKINDO</span>
          <Badge variant="outline" className="text-[10px]">Onboarding</Badge>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {currentStep + 1} / {STEPS.length}
          </span>
          <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground text-xs">
            Lewati
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="px-4 md:px-8 pt-3">
        <Progress value={progress} className="h-1 max-w-2xl mx-auto" />
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <OnboardingStepCard
                step={step}
                isFirst={currentStep === 0}
                isLast={currentStep === STEPS.length - 1}
                onPrev={() => setCurrentStep((s) => s - 1)}
                onNext={() => setCurrentStep((s) => s + 1)}
                onFinish={handleFinish}
                onVisit={() => navigate(step.route)}
              />

              {/* Step dots */}
              <div className="flex justify-center gap-1.5 mt-5">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentStep(i)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === currentStep
                        ? "bg-primary w-6"
                        : i < currentStep
                        ? "bg-primary/40 w-1.5"
                        : "bg-muted-foreground/20 w-1.5"
                    }`}
                  />
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
