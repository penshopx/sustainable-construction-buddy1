import { Card, CardContent } from "@/components/ui/card";
import { Award, TrendingUp, Calendar, FileText } from "lucide-react";
import type { Certificate } from "./CertificateHistoryTable";

interface Props {
  certificates: Certificate[];
}

const levelRank: Record<string, number> = { Pemula: 1, Muda: 2, Madya: 3, Utama: 4 };

export default function CertificateStats({ certificates }: Props) {
  const totalCerts = certificates.length;
  const highestLevel = certificates.reduce((best, c) => {
    return (levelRank[c.level] || 0) > (levelRank[best] || 0) ? c.level : best;
  }, "—");
  const lastIssued = certificates.length > 0
    ? new Date(certificates[0].issued_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  const stats = [
    { icon: FileText, label: "Total Sertifikat", value: totalCerts.toString(), color: "text-blue-500" },
    { icon: TrendingUp, label: "Level Tertinggi", value: highestLevel, color: "text-emerald-500" },
    { icon: Calendar, label: "Terakhir Dicetak", value: lastIssued, color: "text-violet-500" },
    { icon: Award, label: "Status", value: totalCerts >= 4 ? "Lengkap ✅" : `${totalCerts}/4 Level`, color: "text-amber-500" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((s) => (
        <Card key={s.label} className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{s.label}</p>
              <p className="text-sm font-bold text-foreground truncate">{s.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
