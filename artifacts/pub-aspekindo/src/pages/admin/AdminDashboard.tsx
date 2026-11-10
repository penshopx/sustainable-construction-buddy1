import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield, Users, ClipboardCheck, GraduationCap, Award, ShieldAlert, Lightbulb, CalendarDays,
  Activity, CheckCircle2, Clock3, RefreshCw, TriangleAlert, XCircle,
} from "lucide-react";
import AdminUsers from "./AdminUsers";
import AdminQuestions from "./AdminQuestions";
import AdminModules from "./AdminModules";
import AdminCertificates from "./AdminCertificates";
import AdminRoleConflicts from "./AdminRoleConflicts";
import AdminInnovationReview from "./AdminInnovationReview";
import AdminAspekindoAgenda from "./AdminAspekindoAgenda";
import AdminAspekindoLms from "./AdminAspekindoLms";
import AdminAiDiagnostics from "@/components/admin/AdminAiDiagnostics";

type InsightHealth = {
  status: "connected" | "deterministic";
  failureReason:
    | "none"
    | "not_configured"
    | "authentication"
    | "timeout"
    | "invalid_contract"
    | "unavailable"
    | "source_unavailable";
  lastProbeAt: string;
};

const failureReasonLabels: Record<InsightHealth["failureReason"], string> = {
  none: "Tidak ada kegagalan",
  not_configured: "Konfigurasi belum tersedia",
  authentication: "Autentikasi ditolak",
  timeout: "Waktu tunggu habis",
  invalid_contract: "Kontrak respons tidak valid",
  unavailable: "Layanan tidak dapat dijangkau",
  source_unavailable: "Sumber data insight tidak tersedia",
};

function formatProbeTime(value: string | null) {
  if (!value) return "Belum ada probe";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Waktu probe tidak tersedia"
    : new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function isInsightHealth(value: unknown): value is InsightHealth {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<InsightHealth>;
  const statuses: InsightHealth["status"][] = ["connected", "deterministic"];
  const failureReasons: InsightHealth["failureReason"][] = [
    "none",
    "not_configured",
    "authentication",
    "timeout",
    "invalid_contract",
    "unavailable",
    "source_unavailable",
  ];
  return statuses.includes(candidate.status as InsightHealth["status"])
    && failureReasons.includes(candidate.failureReason as InsightHealth["failureReason"])
    && typeof candidate.lastProbeAt === "string";
}

function InsightHealthCard() {
  const [health, setHealth] = useState<InsightHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchHealth = async () => {
    setLoading(true);
    setError(false);
    const { data, error: invokeError } = await supabase.functions.invoke("competency-insight", {
      body: { action: "health" },
    });
    if (invokeError || !data || typeof data !== "object" || !("health" in data)) {
      setError(true);
      setHealth(null);
    } else {
      const candidate = (data as { health?: unknown }).health;
      if (isInsightHealth(candidate)) {
        setHealth(candidate as InsightHealth);
      } else {
        setHealth(null);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchHealth();
  }, []);

  const isConnected = health?.status === "connected";
  return (
    <Card className="border-primary/15">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 pb-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Kesehatan insight kompetensi</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Status operasional terakhir tanpa menampilkan detail koneksi.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void fetchHealth()}
          disabled={loading}
          aria-label="Perbarui status insight"
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" /> Memuat status terakhir…
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <XCircle className="h-4 w-4" /> Status insight belum dapat dibaca.
          </div>
        ) : health ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Badge className={isConnected
              ? "gap-1 border-pub-emerald/30 bg-pub-emerald/10 text-pub-emerald"
              : "gap-1 border-pub-amber/30 bg-pub-amber/10 text-pub-amber"}
            >
              {isConnected ? <CheckCircle2 className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}
              {isConnected ? "Connected" : "Deterministic"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {failureReasonLabels[health.failureReason]}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" /> Probe terakhir {formatProbeTime(health.lastProbeAt)}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock3 className="h-4 w-4" /> Belum ada probe insight yang tercatat.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState("users");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Panel Admin</h1>
          <p className="text-sm text-muted-foreground">Kelola soal, modul, pengguna, dan sertifikat</p>
        </div>
      </div>

      <InsightHealthCard />
      <AdminAiDiagnostics />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="users" className="gap-2"><Users className="w-4 h-4" /> Pengguna</TabsTrigger>
          <TabsTrigger value="questions" className="gap-2"><ClipboardCheck className="w-4 h-4" /> Soal</TabsTrigger>
          <TabsTrigger value="modules" className="gap-2"><GraduationCap className="w-4 h-4" /> Modul</TabsTrigger>
          <TabsTrigger value="certificates" className="gap-2"><Award className="w-4 h-4" /> Sertifikat</TabsTrigger>
          <TabsTrigger value="conflicts" className="gap-2"><ShieldAlert className="w-4 h-4" /> Konflik Jabatan</TabsTrigger>
          <TabsTrigger value="innovation" className="gap-2"><Lightbulb className="w-4 h-4" /> Inovasi</TabsTrigger>
          <TabsTrigger value="agenda" className="gap-2"><CalendarDays className="w-4 h-4" /> Agenda ASPEKINDO</TabsTrigger>
          <TabsTrigger value="aspekindo-lms" className="gap-2"><CalendarDays className="w-4 h-4" /> Kegiatan PUB</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><AdminUsers /></TabsContent>
        <TabsContent value="questions"><AdminQuestions /></TabsContent>
        <TabsContent value="modules"><AdminModules /></TabsContent>
        <TabsContent value="certificates"><AdminCertificates /></TabsContent>
        <TabsContent value="conflicts"><AdminRoleConflicts /></TabsContent>
        <TabsContent value="innovation"><AdminInnovationReview /></TabsContent>
        <TabsContent value="agenda"><AdminAspekindoAgenda /></TabsContent>
        <TabsContent value="aspekindo-lms"><AdminAspekindoLms /></TabsContent>
      </Tabs>
    </div>
  );
}