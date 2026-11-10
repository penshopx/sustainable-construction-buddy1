import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  BookOpenCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  PlayCircle,
  ShieldCheck,
  Star,
  UsersRound,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

type Activity = Tables<"aspekindo_pub_activities">;
type Material = Tables<"aspekindo_activity_materials">;
type Enrollment = Tables<"aspekindo_activity_enrollments">;
type MaterialProgress = Tables<"aspekindo_activity_progress">;
type Evidence = Tables<"aspekindo_activity_evidence">;
type Member = Tables<"aspekindo_members">;
type Obligation = Tables<"aspekindo_member_obligations">;

const TYPE_LABELS: Record<string, string> = {
  webinar: "Webinar",
  seminar: "Seminar tatap muka",
  fgd: "Focus Group Discussion",
  workshop: "Workshop",
  hybrid: "Kegiatan hybrid",
  other: "Kegiatan lainnya",
};

const SIAP_LABELS: Record<string, string> = {
  legalitas: "Siap Legalitas",
  sertifikasi: "Siap Sertifikasi",
  tender: "Siap Tender",
  proyek: "Siap Proyek",
  umum: "Lintas 4 SIAP",
};

const OBLIGATION_STATUS: Record<string, string> = {
  pending: "Belum dipenuhi",
  in_progress: "Sedang dipenuhi",
  fulfilled: "Terpenuhi",
  waived: "Dikecualikan",
};

function formatDate(value: string | null) {
  if (!value) return "Belum ditentukan";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function materialIcon(type: string) {
  if (type === "video") return PlayCircle;
  return FileText;
}

export default function AspekindoLms() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [member, setMember] = useState<Member | null>(null);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [activeActivity, setActiveActivity] = useState<Activity | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialProgress, setMaterialProgress] = useState<MaterialProgress[]>([]);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [reflection, setReflection] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [activityResult, enrollmentResult, evidenceResult, memberResult] = await Promise.all([
      supabase.from("aspekindo_pub_activities").select("*").order("start_at", { ascending: false }),
      supabase.from("aspekindo_activity_enrollments").select("*").eq("user_id", user.id),
      supabase.from("aspekindo_activity_evidence").select("*").eq("user_id", user.id).order("issued_at", { ascending: false }),
      supabase.from("aspekindo_members").select("*").eq("user_id", user.id).maybeSingle(),
    ]);

    if (activityResult.error) {
      toast({ title: "Kegiatan PUB belum dapat dimuat", description: activityResult.error.message, variant: "destructive" });
    }
    setActivities(activityResult.data ?? []);
    setEnrollments(enrollmentResult.data ?? []);
    setEvidence(evidenceResult.data ?? []);
    setMember(memberResult.data ?? null);

    if (memberResult.data) {
      const { data } = await supabase
        .from("aspekindo_member_obligations")
        .select("*")
        .eq("member_id", memberResult.data.id)
        .order("due_date", { ascending: true });
      setObligations(data ?? []);
    } else {
      setObligations([]);
    }
    setLoading(false);
  }, [toast, user]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const openActivity = async (activity: Activity) => {
    if (!user) return;
    setActiveActivity(activity);
    setDetailLoading(true);
    const enrollment = enrollments.find((item) => item.activity_id === activity.id);
    const [materialResult, progressResult, evaluationResult] = await Promise.all([
      supabase
        .from("aspekindo_activity_materials")
        .select("*")
        .eq("activity_id", activity.id)
        .eq("is_published", true)
        .order("sort_order"),
      enrollment
        ? supabase.from("aspekindo_activity_progress").select("*").eq("enrollment_id", enrollment.id)
        : Promise.resolve({ data: [] as MaterialProgress[], error: null }),
      enrollment
        ? supabase.from("aspekindo_activity_evaluations").select("*").eq("enrollment_id", enrollment.id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    setMaterials(materialResult.data ?? []);
    setMaterialProgress(progressResult.data ?? []);
    if (evaluationResult.data) {
      setRating(evaluationResult.data.rating);
      setFeedback(evaluationResult.data.feedback);
      setReflection(evaluationResult.data.learning_reflection);
    } else {
      setRating(5);
      setFeedback("");
      setReflection("");
    }
    setDetailLoading(false);
  };

  const register = async (activity: Activity) => {
    if (!user) return;
    setActionLoading(activity.id);
    const { data, error } = await supabase
      .from("aspekindo_activity_enrollments")
      .insert({ activity_id: activity.id, user_id: user.id })
      .select()
      .single();
    setActionLoading(null);
    if (error) {
      toast({ title: "Pendaftaran gagal", description: error.message, variant: "destructive" });
      return;
    }
    setEnrollments((current) => [...current, data]);
    toast({ title: "Terdaftar pada kegiatan", description: "Materi kegiatan sekarang dapat Anda pelajari." });
    await openActivity(activity);
  };

  const openMaterial = async (material: Material) => {
    const enrollment = enrollments.find((item) => item.activity_id === material.activity_id);
    if (!user || !enrollment) return;
    setActionLoading(material.id);

    let url = material.external_url;
    if (material.storage_path) {
      const { data, error } = await supabase.storage
        .from("aspekindo-learning")
        .createSignedUrl(material.storage_path, 60 * 30);
      if (error) {
        setActionLoading(null);
        toast({ title: "Materi tidak dapat dibuka", description: error.message, variant: "destructive" });
        return;
      }
      url = data.signedUrl;
    }

    if (url) window.open(url, "_blank", "noopener,noreferrer");

    const payload = {
      enrollment_id: enrollment.id,
      activity_id: material.activity_id,
      material_id: material.id,
      user_id: user.id,
      status: "completed",
      progress_percent: 100,
      completed_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("aspekindo_activity_progress")
      .upsert(payload, { onConflict: "enrollment_id,material_id" })
      .select()
      .single();
    setActionLoading(null);
    if (error) {
      toast({ title: "Progres belum tersimpan", description: error.message, variant: "destructive" });
      return;
    }
    setMaterialProgress((current) => [...current.filter((item) => item.material_id !== material.id), data]);
  };

  const saveEvaluation = async () => {
    if (!user || !activeActivity) return;
    const enrollment = enrollments.find((item) => item.activity_id === activeActivity.id);
    if (!enrollment || !reflection.trim()) {
      toast({ title: "Lengkapi refleksi pembelajaran", description: "Tuliskan hasil utama yang Anda peroleh.", variant: "destructive" });
      return;
    }
    setActionLoading("evaluation");
    const { error } = await supabase.from("aspekindo_activity_evaluations").upsert({
      enrollment_id: enrollment.id,
      activity_id: activeActivity.id,
      user_id: user.id,
      rating,
      feedback: feedback.trim(),
      learning_reflection: reflection.trim(),
      submitted_at: new Date().toISOString(),
    }, { onConflict: "enrollment_id" });
    setActionLoading(null);
    if (error) {
      toast({ title: "Evaluasi gagal disimpan", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Evaluasi tersimpan" });
  };

  const completeActivity = async () => {
    if (!activeActivity) return;
    setActionLoading("complete");
    const { data, error } = await supabase.rpc("complete_aspekindo_activity", { _activity_id: activeActivity.id });
    setActionLoading(null);
    if (error) {
      toast({ title: "Kegiatan belum dapat diselesaikan", description: error.message, variant: "destructive" });
      return;
    }
    setEnrollments((current) => current.map((item) => item.id === data.id ? data : item));
    toast({ title: "Kegiatan selesai", description: "Bukti penyelesaian sudah masuk ke rekap kegiatan PUB Anda." });
    await loadOverview();
  };

  const enrollmentByActivity = useMemo(
    () => new Map(enrollments.map((item) => [item.activity_id, item])),
    [enrollments],
  );
  const activeEnrollment = activeActivity ? enrollmentByActivity.get(activeActivity.id) : undefined;
  const completedMaterialIds = new Set(
    materialProgress.filter((item) => item.status === "completed").map((item) => item.material_id),
  );
  const progressPercent = materials.length
    ? Math.round((completedMaterialIds.size / materials.length) * 100)
    : activeEnrollment ? 100 : 0;
  const completedCount = enrollments.filter((item) => item.status === "completed").length;

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Memuat kegiatan PUB...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="overflow-hidden rounded-2xl bg-hero p-6 text-primary-foreground md:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">Kegiatan & bukti PUB</Badge>
            <h1 className="mt-4 text-3xl font-extrabold font-heading md:text-4xl">Kegiatan & pembelajaran anggota</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-primary-foreground/75 md:text-base">
              Ikuti webinar, seminar, FGD, dan pembelajaran PUB. Setiap penyelesaian dicatat sebagai evidence untuk rekap anggota dan persiapan LKUT.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link to="/courses"><BookOpenCheck className="mr-2 h-4 w-4" /> Pusat Pembelajaran PUB</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                <Link to="/agenda-pub"><CalendarDays className="mr-2 h-4 w-4" /> Agenda publik</Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/15 bg-white/10 px-5 py-4">
              <p className="text-xs text-primary-foreground/65">Kegiatan selesai</p>
              <p className="mt-1 text-2xl font-bold">{completedCount}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 px-5 py-4">
              <p className="text-xs text-primary-foreground/65">Evidence tersedia</p>
              <p className="mt-1 text-2xl font-bold">{evidence.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr,320px]">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold font-heading">Katalog kegiatan PUB</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ikuti kegiatan PUB dan simpan bukti keikutsertaan Anda di satu tempat.</p>
          </div>
          {activities.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <CalendarDays className="mx-auto h-9 w-9 text-muted-foreground/60" />
                <p className="mt-3 font-semibold">Belum ada kegiatan yang tersedia untuk akun ini.</p>
                <p className="mt-1 text-sm text-muted-foreground">Pastikan status keanggotaan aktif atau tunggu kegiatan diterbitkan admin.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {activities.map((activity) => {
                const enrollment = enrollmentByActivity.get(activity.id);
                return (
                  <Card key={activity.id} className="flex flex-col overflow-hidden shadow-card">
                    <div className="h-1.5 bg-gradient-to-r from-pub-sky via-pub-emerald to-pub-amber" />
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{TYPE_LABELS[activity.activity_type] ?? activity.activity_type}</Badge>
                        <Badge variant="outline">{SIAP_LABELS[activity.siap_focus] ?? activity.siap_focus}</Badge>
                      </div>
                      <CardTitle className="pt-2 text-lg">{activity.title}</CardTitle>
                      <CardDescription className="line-clamp-3">{activity.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="mt-auto space-y-4">
                      <div className="space-y-2 text-xs text-muted-foreground">
                        <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-pub-emerald" /> {formatDate(activity.start_at)}</p>
                        {activity.location && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-pub-emerald" /> {activity.location}</p>}
                      </div>
                      <Button className="w-full" variant={enrollment ? "default" : "outline"} onClick={() => enrollment ? void openActivity(activity) : void register(activity)} disabled={actionLoading === activity.id}>
                        {actionLoading === activity.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {enrollment?.status === "completed" ? "Lihat evidence" : enrollment ? "Lanjutkan pembelajaran" : "Daftar kegiatan"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-5 w-5 text-pub-sky" /> Konteks anggota BUJK</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-semibold">{member?.company_name || profile?.company || "Perusahaan belum terhubung"}</p>
                <p className="text-muted-foreground">{member?.membership_number || "Nomor anggota belum tersedia"}</p>
              </div>
              <Badge variant="outline" className={member?.membership_status === "active" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : ""}>
                {member?.membership_status === "active" ? "Keanggotaan aktif" : "Belum terverifikasi sebagai anggota aktif"}
              </Badge>
              {member?.expires_at && <p className="text-xs text-muted-foreground">Berlaku sampai {new Date(member.expires_at).toLocaleDateString("id-ID")}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-5 w-5 text-pub-emerald" /> Kewajiban anggota</CardTitle>
              <CardDescription>Ringkasan pemenuhan yang dikelola ASPEKINDO.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {obligations.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada kewajiban yang ditetapkan untuk akun ini.</p>
              ) : obligations.map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <Badge variant="outline" className="shrink-0 text-[10px]">{OBLIGATION_STATUS[item.status] ?? item.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{SIAP_LABELS[item.siap_focus] ?? item.siap_focus}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Award className="h-5 w-5 text-pub-amber" /> Evidence kegiatan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {evidence.length === 0 ? (
                <p className="text-sm text-muted-foreground">Selesaikan kegiatan untuk menghasilkan evidence.</p>
              ) : evidence.slice(0, 5).map((item) => (
                <div key={item.id} className="rounded-lg bg-muted/50 p-3">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">{item.evidence_number}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog open={Boolean(activeActivity)} onOpenChange={(open) => !open && setActiveActivity(null)}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{activeActivity?.title}</DialogTitle>
          </DialogHeader>
          {detailLoading || !activeActivity ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-muted/50 p-3 text-sm"><CalendarDays className="mb-2 h-4 w-4 text-pub-emerald" />{formatDate(activeActivity.start_at)}</div>
                <div className="rounded-lg bg-muted/50 p-3 text-sm"><MapPin className="mb-2 h-4 w-4 text-pub-sky" />{activeActivity.location || "Online"}</div>
                <div className="rounded-lg bg-muted/50 p-3 text-sm"><UsersRound className="mb-2 h-4 w-4 text-pub-amber" />{activeActivity.member_only ? "Khusus anggota aktif" : "Peserta terdaftar"}</div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold">Progres materi</span><span>{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} />
              </div>
              <div>
                <h3 className="flex items-center gap-2 font-bold"><BookOpenCheck className="h-5 w-5 text-pub-emerald" /> Materi pembelajaran</h3>
                <div className="mt-3 space-y-2">
                  {materials.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Belum ada materi yang diterbitkan.</p>
                  ) : materials.map((material) => {
                    const Icon = materialIcon(material.material_type);
                    const completed = completedMaterialIds.has(material.id);
                    return (
                      <button key={material.id} type="button" onClick={() => void openMaterial(material)} className="flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50">
                        <Icon className="h-5 w-5 text-pub-sky" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{material.title}</p>
                          <p className="text-xs capitalize text-muted-foreground">{material.material_type}</p>
                        </div>
                        {actionLoading === material.id ? <Loader2 className="h-4 w-4 animate-spin" /> : completed ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <ExternalLink className="h-4 w-4 text-muted-foreground" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              {activeEnrollment?.status === "completed" ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
                  <div className="flex items-center gap-2 font-bold"><Award className="h-5 w-5" /> Kegiatan sudah selesai</div>
                  <p className="mt-1 text-sm">Evidence kegiatan telah tersimpan pada rekap PUB Anda.</p>
                </div>
              ) : (
                <div className="space-y-4 rounded-xl border p-5">
                  <h3 className="flex items-center gap-2 font-bold"><Star className="h-5 w-5 text-pub-amber" /> Evaluasi kegiatan</h3>
                  <div>
                    <Label>Penilaian</Label>
                    <div className="mt-2 flex gap-1">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <Button key={value} type="button" size="icon" variant={value <= rating ? "default" : "outline"} onClick={() => setRating(value)}>{value}</Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="learning-reflection">Refleksi pembelajaran *</Label>
                    <Textarea id="learning-reflection" className="mt-1" value={reflection} onChange={(event) => setReflection(event.target.value)} placeholder="Apa hal utama yang dapat diterapkan pada BUJK Anda?" />
                  </div>
                  <div>
                    <Label htmlFor="activity-feedback">Saran untuk penyelenggara</Label>
                    <Textarea id="activity-feedback" className="mt-1" value={feedback} onChange={(event) => setFeedback(event.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button variant="outline" onClick={() => void saveEvaluation()} disabled={actionLoading === "evaluation"}>
                      {actionLoading === "evaluation" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan evaluasi
                    </Button>
                    <Button onClick={() => void completeActivity()} disabled={progressPercent < 100 || !reflection.trim() || actionLoading === "complete"}>
                      {actionLoading === "complete" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Selesaikan & buat evidence
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Seluruh materi dan evaluasi harus tersimpan sebelum evidence diterbitkan.</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}