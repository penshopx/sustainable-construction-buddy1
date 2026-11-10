import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Award, Lock, CheckCircle2, Loader2 } from "lucide-react";

interface LevelStatus {
  level: string;
  totalModules: number;
  completedModules: number;
  hasCert: boolean;
}

const levelColors: Record<string, string> = {
  Pemula: "from-emerald-500 to-teal-600",
  Muda: "from-blue-500 to-indigo-600",
  Madya: "from-violet-500 to-purple-600",
  Utama: "from-amber-500 to-orange-600",
};

const levelBorderColors: Record<string, string> = {
  Pemula: "border-emerald-500/30",
  Muda: "border-blue-500/30",
  Madya: "border-violet-500/30",
  Utama: "border-amber-500/30",
};

interface Props {
  status: LevelStatus;
  generating: string | null;
  onGenerate: (level: string) => void;
}

export default function CertificateLevelCard({ status: s, generating, onGenerate }: Props) {
  const allDone = s.totalModules > 0 && s.completedModules >= s.totalModules;
  const noModules = s.totalModules === 0;

  return (
    <Card className={`relative overflow-hidden border-2 ${s.hasCert ? levelBorderColors[s.level] : "border-border"}`}>
      {s.hasCert && (
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${levelColors[s.level]}`} />
      )}
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          {s.hasCert ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : allDone ? (
            <Award className="w-5 h-5 text-accent" />
          ) : (
            <Lock className="w-5 h-5 text-muted-foreground" />
          )}
          Level {s.level}
        </CardTitle>
        <Badge variant={s.hasCert ? "default" : "secondary"}>
          {s.hasCert ? "Diterbitkan" : noModules ? "Belum tersedia" : `${s.completedModules}/${s.totalModules} modul`}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {!noModules && (
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className={`h-2 rounded-full bg-gradient-to-r ${levelColors[s.level]} transition-all`}
              style={{ width: `${(s.completedModules / s.totalModules) * 100}%` }}
            />
          </div>
        )}

        {s.hasCert ? (
          <p className="text-xs text-muted-foreground">Sertifikat sudah diterbitkan. Lihat di tabel di bawah untuk download.</p>
        ) : allDone ? (
          <Button
            onClick={() => onGenerate(s.level)}
            disabled={generating === s.level}
            className="w-full"
            size="sm"
          >
            {generating === s.level ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Membuat...</>
            ) : (
              <><Award className="w-4 h-4 mr-2" /> Terbitkan Sertifikat</>
            )}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            {noModules
              ? "Modul belum tersedia."
              : `Selesaikan ${s.totalModules - s.completedModules} modul lagi.`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
