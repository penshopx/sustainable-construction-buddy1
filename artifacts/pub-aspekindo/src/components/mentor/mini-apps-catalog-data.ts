import type { ElementType } from "react";
import {
  AlertTriangle, DollarSign, Shield, FileText, Wrench,
  Calculator, BarChart3, ClipboardCheck, Building2, Zap,
} from "lucide-react";

export interface MiniApp {
  id: string;
  name: string;
  description: string;
  icon: ElementType;
  color: string;
  category: "module" | "tool";
  route?: string;
  comingSoon?: boolean;
}

export const MINI_APPS: MiniApp[] = [
  {
    id: "risk-register",
    name: "Risk Register",
    description: "Identifikasi & mitigasi risiko proyek",
    icon: AlertTriangle,
    color: "text-red-500",
    category: "module",
    route: "/risk-register",
  },
  {
    id: "budget-tracker",
    name: "Budget Tracker",
    description: "Monitor anggaran & deviasi biaya",
    icon: DollarSign,
    color: "text-emerald-500",
    category: "module",
    route: "/budget-tracker",
  },
  {
    id: "k3-checklist",
    name: "K3 Checklist",
    description: "Inspeksi keselamatan & kepatuhan K3",
    icon: Shield,
    color: "text-blue-500",
    category: "module",
    route: "/k3-checklist",
  },
  {
    id: "lkut-report",
    name: "LKUT Report",
    description: "Laporan kegiatan usaha tahunan",
    icon: FileText,
    color: "text-purple-500",
    category: "module",
    route: "/lkut-report",
  },
  {
    id: "performance-grade",
    name: "Performance Grade",
    description: "Grading kinerja BUJK",
    icon: BarChart3,
    color: "text-amber-500",
    category: "module",
    route: "/performance-grade",
  },
  {
    id: "pancek",
    name: "PANCEK Assessment",
    description: "Penilaian anti-korupsi & etika kerja",
    icon: ClipboardCheck,
    color: "text-teal-500",
    category: "module",
    route: "/pancek-assessment",
  },
  {
    id: "company-directory",
    name: "Direktori BUJK",
    description: "Profil & portofolio perusahaan",
    icon: Building2,
    color: "text-indigo-500",
    category: "module",
    route: "/company-directory",
  },
  {
    id: "evm-calculator",
    name: "Kalkulator EVM",
    description: "Hitung CPI, SPI, EAC, ETC otomatis",
    icon: Calculator,
    color: "text-orange-500",
    category: "tool",
    comingSoon: true,
  },
  {
    id: "complexity-scorer",
    name: "Complexity Scorer",
    description: "Hitung skor kompleksitas proyek",
    icon: Zap,
    color: "text-yellow-500",
    category: "tool",
    route: "/projects",
  },
];