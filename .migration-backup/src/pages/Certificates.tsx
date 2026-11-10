import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Award, Loader2 } from "lucide-react";
import CertificateLevelCard from "@/components/certificates/CertificateLevelCard";
import CertificateHistoryTable, { type Certificate } from "@/components/certificates/CertificateHistoryTable";
import GenerateCertDialog from "@/components/certificates/GenerateCertDialog";
import CertificatePreview from "@/components/certificates/CertificatePreview";
import CertificateStats from "@/components/certificates/CertificateStats";
import { downloadCertificateAsPng } from "@/lib/certificateCanvas";

const LEVELS = ["Pemula", "Muda", "Madya", "Utama"];

interface LevelStatus {
  level: string;
  totalModules: number;
  completedModules: number;
  hasCert: boolean;
}

export default function Certificates() {
  const { user } = useAuth();
  const [statuses, setStatuses] = useState<LevelStatus[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating] = useState<string | null>(null);
  const [dialogLevel, setDialogLevel] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;

    const [modulesRes, progressRes, certsRes] = await Promise.all([
      supabase.from("e_course_modules").select("id, level"),
      supabase.from("module_progress").select("module_id, status").eq("user_id", user.id),
      supabase.from("certificates").select("*").eq("user_id", user.id).order("issued_at", { ascending: false }),
    ]);

    const modules = modulesRes.data || [];
    const progress = progressRes.data || [];
    const certs = (certsRes.data || []) as Certificate[];

    const completedSet = new Set(
      progress.filter((p) => p.status === "completed").map((p) => p.module_id)
    );

    const certLevels = new Set(certs.map((c) => c.level));

    const result: LevelStatus[] = LEVELS.map((level) => {
      const levelModules = modules.filter((m) => m.level === level);
      return {
        level,
        totalModules: levelModules.length,
        completedModules: levelModules.filter((m) => completedSet.has(m.id)).length,
        hasCert: certLevels.has(level),
      };
    });

    setStatuses(result);
    setCertificates(certs);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
          <Award className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Sertifikat Digital</h1>
          <p className="text-sm text-muted-foreground">
            Kelola dan unduh sertifikat kompetensi Anda
          </p>
        </div>
      </div>

      {/* Stats */}
      <CertificateStats certificates={certificates} />

      {/* Preview */}
      <CertificatePreview />

      {/* Progress Cards */}
      <div>
        <h2 className="text-lg font-heading font-semibold text-foreground mb-3">Progress per Level</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statuses.map((s) => (
            <CertificateLevelCard
              key={s.level}
              status={s}
              generating={generating}
              onGenerate={(level) => setDialogLevel(level)}
            />
          ))}
        </div>
      </div>

      {/* History Table */}
      <div>
        <h2 className="text-lg font-heading font-semibold text-foreground mb-3">
          Riwayat Sertifikat ({certificates.length})
        </h2>
        <CertificateHistoryTable
          certificates={certificates}
          onDownload={downloadCertificateAsPng}
        />
      </div>

      {/* Generate Dialog */}
      {dialogLevel && (
        <GenerateCertDialog
          open={!!dialogLevel}
          level={dialogLevel}
          onOpenChange={(open) => !open && setDialogLevel(null)}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}