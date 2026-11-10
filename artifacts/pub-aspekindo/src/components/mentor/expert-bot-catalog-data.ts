import type { ElementType } from "react";
import { Brain, Scale, HardHat, Shield, DollarSign } from "lucide-react";

export interface BuiltInBot {
  id: string;
  name: string;
  description: string;
  icon: ElementType;
  color: string;
  bgColor: string;
}

export const BUILT_IN_BOTS: BuiltInBot[] = [
  {
    id: "orchestrator",
    name: "Pakar Cerdas",
    description: "Orchestrator utama — tanyakan apapun, saya arahkan ke spesialis yang tepat",
    icon: Brain,
    color: "text-pub-amber",
    bgColor: "bg-pub-amber/10",
  },
  {
    id: "regulasi",
    name: "Pakar Regulasi",
    description: "PP 22/2020, UU Jasa Konstruksi, Permen PUPR, perizinan BUJK",
    icon: Scale,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    id: "manpro",
    name: "Pakar Manajemen Proyek",
    description: "WBS, scheduling, earned value, cost control, RAB",
    icon: HardHat,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    id: "k3",
    name: "Pakar K3 & Safety",
    description: "SMK3, ISO 45001, inspeksi keselamatan, mitigasi risiko K3",
    icon: Shield,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
  {
    id: "keuangan",
    name: "Pakar Keuangan BUJK",
    description: "Laporan keuangan, neraca, cash flow, LKUT, perpajakan",
    icon: DollarSign,
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
  },
];