import { Checkbox } from "@/components/ui/checkbox";
import { Calculator, TrendingUp, Shield, Gauge, BarChart3, Wrench, FileCheck } from "lucide-react";

const AVAILABLE_TOOLS = [
  { id: "evm", name: "Earned Value Management", desc: "Analisis earned value proyek", icon: TrendingUp, modes: ["proyek"] },
  { id: "bid_calculator", name: "Bid Calculator", desc: "Kalkulator penawaran tender", icon: Calculator, modes: ["proyek", "profesi"] },
  { id: "risk_scoring", name: "Risk Scoring", desc: "Penilaian & matriks risiko", icon: Shield, modes: ["proyek"] },
  { id: "break_even", name: "Break Even Analyzer", desc: "Analisis titik impas proyek", icon: BarChart3, modes: ["proyek"] },
  { id: "productivity", name: "Productivity Checker", desc: "Cek produktivitas pekerja", icon: Gauge, modes: ["proyek"] },
  { id: "contract_trap", name: "Contract Trap Scanner", desc: "Deteksi klausul berisiko", icon: FileCheck, modes: ["proyek", "profesi"] },
  { id: "pancek_guide", name: "Panduan PANCEK", desc: "Pendampingan 6 pilar PANCEK", icon: Wrench, modes: ["pembelajaran"] },
  { id: "smap_guide", name: "Panduan SMAP", desc: "Implementasi ISO 37001", icon: Wrench, modes: ["pembelajaran"] },
  { id: "skk_checker", name: "SKK Requirements Checker", desc: "Cek persyaratan SKK per jabatan", icon: FileCheck, modes: ["profesi"] },
  { id: "sbu_checker", name: "SBU Requirements Checker", desc: "Cek persyaratan SBU per kualifikasi", icon: FileCheck, modes: ["profesi"] },
];

interface Props {
  selectedTools: string[];
  onSelectionChange: (tools: string[]) => void;
  mode: string;
}

export function ChatbotToolsStep({ selectedTools, onSelectionChange, mode }: Props) {
  const filteredTools = AVAILABLE_TOOLS.filter((t) => t.modes.includes(mode));

  const toggle = (id: string) => {
    onSelectionChange(
      selectedTools.includes(id)
        ? selectedTools.filter((x) => x !== id)
        : [...selectedTools, id]
    );
  };

  if (filteredTools.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        <p>Tidak ada tools khusus untuk mode ini.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Pilih tools yang bisa disarankan oleh chatbot (opsional):
      </p>
      {filteredTools.map((tool) => (
        <label
          key={tool.id}
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            selectedTools.includes(tool.id)
              ? "border-primary bg-primary/5"
              : "border-border hover:bg-accent/50"
          }`}
        >
          <Checkbox
            checked={selectedTools.includes(tool.id)}
            onCheckedChange={() => toggle(tool.id)}
            className="mt-0.5"
          />
          <tool.icon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{tool.name}</p>
            <p className="text-xs text-muted-foreground">{tool.desc}</p>
          </div>
        </label>
      ))}
    </div>
  );
}
