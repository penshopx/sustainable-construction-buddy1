import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Award,
  CalendarDays,
  Download,
  ExternalLink,
  FileUp,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  UsersRound,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Activity = Tables<"aspekindo_pub_activities">;
type Material = Tables<"aspekindo_activity_materials">;
type Member = Tables<"aspekindo_members">;
type Obligation = Tables<"aspekindo_member_obligations">;
type Enrollment = Tables<"aspekindo_activity_enrollments">;
type Evidence = Tables<"aspekindo_activity_evidence">;
type Profile = Pick<Tables<"profiles">, "user_id" | "full_name" | "company">;

type ActivityForm = {
  title: string;
  activity_type: string;
  delivery_mode: string;
  description: string;
  learning_outcomes: string;
  siap_focus: string;
  status: string;
  start_at: string;
  end_at: string;
  location: string;
  registration_url: string;
  member_only: boolean;
  max_participants: string;
};

const EMPTY_ACTIVITY: ActivityForm = {
  title: "",
  activity_type: "webinar",
  delivery_mode: "online",
  description: "",
  learning_outcomes: "",
  siap_focus: "sertifikasi",
  status: "draft",
  start_at: "",
  end_at: "",
  location: "",
  registration_url: "",
  member_only: true,
  max_participants: "",
};

const ACTIVITY_TYPES = [
  ["webinar", "Webinar"],
  ["seminar", "Seminar tatap muka"],
  ["fgd", "FGD"],
  ["workshop", "Workshop"],
  ["hybrid", "Kegiatan hybrid"],
  ["other", "Kegiatan lainnya"],
] as const;

const SIAP_OPTIONS = [
  ["legalitas", "Siap Legalitas"],
  ["sertifikasi", "Siap Sertifikasi"],
  ["tender", "Siap Tender"],
  ["proyek", "Siap Proyek"],
  ["umum", "Lintas 4 SIAP"],
] as const;

const ALLOWED_FILE_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_FILE_SIZE = 500 * 1024 * 1024;

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export default function AdminAspekindoLms() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [activityForm, setActivityForm] = useState<ActivityForm>(EMPTY_ACTIVITY);
  const [materialActivity, setMaterialActivity] = useState<Activity | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialType, setMaterialType] = useState("document");
  const [materialUrl, setMaterialUrl] = useState("");
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [memberForm, setMemberForm] = useState({
    user_id: "",
    membership_number: "",
    company_name: "",
    membership_status: "active",
    joined_at: "",
    expires_at: "",
    notes: "",
  });
  const [obligationDialogOpen, setObligationDialogOpen] = useState(false);
  const [obligationForm, setObligationForm] = useState({
    member_id: "",
    title: "",
    description: "",
    obligation_type: "administratif",
    siap_focus: "sertifikasi",
    status: "pending",
    due_date: "",
    notes: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [activityResult, memberResult, profileResult, obligationResult, enrollmentResult, evidenceResult] = await Promise.all([
      supabase.from("aspekindo_pub_activities").select("*").order("start_at", { ascending: false }),
      supabase.from("aspekindo_members").select("*").order("company_name"),
      supabase.from("profiles").select("user_id, full_name, company").order("company"),
      supabase.from("aspekindo_member_obligations").select("*").order("due_date"),
      supabase.from("aspekindo_activity_enrollments").select("*"),
      supabase.from("aspekindo_activity_evidence").select("*").order("issued_at", { ascending: false }),
    ]);
    const firstError = [activityResult, memberResult, profileResult, obligationResult, enrollmentResult, evidenceResult].find((result) => result.error)?.error;
    if (firstError) toast({ title: "Sebagian data belum dapat dimuat", description: firstError.message, variant: "destructive" });
    setActivities(activityResult.data ?? []);
    setMembers(memberResult.data ?? []);
    setProfiles(profileResult.data ?? []);
    setObligations(obligationResult.data ?? []);
    setEnrollments(enrollmentResult.data ?? []);
    setEvidence(evidenceResult.data ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.user_id, profile])), [profiles]);
  const memberMap = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const activityMap = useMemo(() => new Map(activities.map((activity) => [activity.id, activity])), [activities]);

  const openCreateActivity = () => {
    setEditingActivity(null);
    setActivityForm(EMPTY_ACTIVITY);
    setActivityDialogOpen(true);
  };

  const openEditActivity = (activity: Activity) => {
    setEditingActivity(activity);
    setActivityForm({
      title: activity.title,
      activity_type: activity.activity_type,
      delivery_mode: activity.delivery_mode,
      description: activity.description,
      learning_outcomes: activity.learning_outcomes,
      siap_focus: activity.siap_focus,
      status: activity.status,
      start_at: toLocalInput(activity.start_at),
      end_at: toLocalInput(activity.end_at),
      location: activity.location,
      registration_url: activity.registration_url,
      member_only: activity.member_only,
      max_participants: activity.max_participants?.toString() ?? "",
    });
    setActivityDialogOpen(true);
  };

  const saveActivity = async () => {
    if (!activityForm.title.trim() || !activityForm.start_at) {
      toast({ title: "Lengkapi kegiatan", description: "Judul dan waktu mulai wajib diisi.", variant: "destructive" });
      return;
    }
    if (activityForm.registration_url && !activityForm.registration_url.startsWith("https://")) {
      toast({ title: "Tautan tidak aman", description: "Gunakan tautan yang diawali https://.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      ...activityForm,
      title: activityForm.title.trim(),
      description: activityForm.description.trim(),
      learning_outcomes: activityForm.learning_outcomes.trim(),
      start_at: new Date(activityForm.start_at).toISOString(),
      end_at: activityForm.end_at ? new Date(activityForm.end_at).toISOString() : null,
      registration_url: activityForm.registration_url.trim(),
      max_participants: activityForm.max_participants ? Number(activityForm.max_participants) : null,
      created_by: user?.id ?? null,
    };
    const result = editingActivity
      ? await supabase.from("aspekindo_pub_activities").update(payload).eq("id", editingActivity.id)
      : await supabase.from("aspekindo_pub_activities").insert(payload);
    setSaving(false);
    if (result.error) {
      toast({ title: "Kegiatan gagal disimpan", description: result.error.message, variant: "destructive" });
      return;
    }
    setActivityDialogOpen(false);
    toast({ title: editingActivity ? "Kegiatan diperbarui" : "Kegiatan ditambahkan" });
    await loadData();
  };

  const changeActivityStatus = async (activity: Activity, status: string) => {
    const { error } = await supabase.from("aspekindo_pub_activities").update({ status }).eq("id", activity.id);
    if (error) {
      toast({ title: "Status gagal diubah", description: error.message, variant: "destructive" });
      return;
    }
    setActivities((current) => current.map((item) => item.id === activity.id ? { ...item, status } : item));
  };

  const openMaterials = async (activity: Activity) => {
    setMaterialActivity(activity);
    setMaterialTitle("");
    setMaterialType("document");
    setMaterialUrl("");
    setMaterialFile(null);
    const { data, error } = await supabase
      .from("aspekindo_activity_materials")
      .select("*")
      .eq("activity_id", activity.id)
      .order("sort_order");
    if (error) toast({ title: "Materi gagal dimuat", description: error.message, variant: "destructive" });
    setMaterials(data ?? []);
  };

  const saveMaterial = async () => {
    if (!materialActivity || !user || !materialTitle.trim()) {
      toast({ title: "Judul materi wajib diisi", variant: "destructive" });
      return;
    }
    if (!materialFile && (!materialUrl || !materialUrl.startsWith("https://"))) {
      toast({ title: "Pilih file atau gunakan URL https://", variant: "destructive" });
      return;
    }
    if (materialFile && (!ALLOWED_FILE_TYPES.has(materialFile.type) || materialFile.size > MAX_FILE_SIZE)) {
      toast({ title: "File tidak didukung", description: "Gunakan video, PDF, Office, atau gambar dengan ukuran maksimal 500 MB.", variant: "destructive" });
      return;
    }

    setSaving(true);
    let storagePath = "";
    if (materialFile) {
      const safeName = materialFile.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
      storagePath = `${materialActivity.id}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await supabase.storage.from("aspekindo-learning").upload(storagePath, materialFile);
      if (error) {
        setSaving(false);
        toast({ title: "Upload gagal", description: error.message, variant: "destructive" });
        return;
      }
    }

    const { error } = await supabase.from("aspekindo_activity_materials").insert({
      activity_id: materialActivity.id,
      title: materialTitle.trim(),
      material_type: materialType,
      storage_path: storagePath,
      external_url: materialFile ? "" : materialUrl.trim(),
      file_name: materialFile?.name ?? "",
      mime_type: materialFile?.type ?? "",
      file_size: materialFile?.size ?? 0,
      sort_order: materials.length,
      created_by: user.id,
    });
    setSaving(false);
    if (error) {
      if (storagePath) await supabase.storage.from("aspekindo-learning").remove([storagePath]);
      toast({ title: "Materi gagal disimpan", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Materi ditambahkan" });
    await openMaterials(materialActivity);
  };

  const deleteMaterial = async (material: Material) => {
    setSaving(true);
    if (material.storage_path) {
      const { error } = await supabase.storage.from("aspekindo-learning").remove([material.storage_path]);
      if (error) {
        setSaving(false);
        toast({ title: "File gagal dihapus", description: error.message, variant: "destructive" });
        return;
      }
    }
    const { error } = await supabase.from("aspekindo_activity_materials").delete().eq("id", material.id);
    setSaving(false);
    if (error) {
      toast({ title: "Materi gagal dihapus", description: error.message, variant: "destructive" });
      return;
    }
    setMaterials((current) => current.filter((item) => item.id !== material.id));
  };

  const openMemberDialog = (member?: Member) => {
    setEditingMember(member ?? null);
    setMemberForm(member ? {
      user_id: member.user_id ?? "",
      membership_number: member.membership_number,
      company_name: member.company_name,
      membership_status: member.membership_status,
      joined_at: member.joined_at ?? "",
      expires_at: member.expires_at ?? "",
      notes: member.notes,
    } : {
      user_id: "",
      membership_number: "",
      company_name: "",
      membership_status: "active",
      joined_at: "",
      expires_at: "",
      notes: "",
    });
    setMemberDialogOpen(true);
  };

  const selectProfile = (userId: string) => {
    const profile = profileMap.get(userId);
    setMemberForm((current) => ({ ...current, user_id: userId, company_name: current.company_name || profile?.company || "" }));
  };

  const saveMember = async () => {
    if (!memberForm.company_name.trim()) {
      toast({ title: "Nama BUJK wajib diisi", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      ...memberForm,
      user_id: memberForm.user_id || null,
      company_name: memberForm.company_name.trim(),
      membership_number: memberForm.membership_number.trim(),
      joined_at: memberForm.joined_at || null,
      expires_at: memberForm.expires_at || null,
    };
    const result = editingMember
      ? await supabase.from("aspekindo_members").update(payload).eq("id", editingMember.id)
      : await supabase.from("aspekindo_members").insert(payload);
    setSaving(false);
    if (result.error) {
      toast({ title: "Data anggota gagal disimpan", description: result.error.message, variant: "destructive" });
      return;
    }
    setMemberDialogOpen(false);
    toast({ title: "Data anggota tersimpan" });
    await loadData();
  };

  const openObligationDialog = (member: Member) => {
    setObligationForm({
      member_id: member.id,
      title: "",
      description: "",
      obligation_type: "administratif",
      siap_focus: "sertifikasi",
      status: "pending",
      due_date: "",
      notes: "",
    });
    setObligationDialogOpen(true);
  };

  const saveObligation = async () => {
    if (!obligationForm.title.trim()) {
      toast({ title: "Judul kewajiban wajib diisi", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("aspekindo_member_obligations").insert({
      ...obligationForm,
      title: obligationForm.title.trim(),
      due_date: obligationForm.due_date || null,
      fulfilled_at: obligationForm.status === "fulfilled" ? new Date().toISOString() : null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Kewajiban gagal disimpan", description: error.message, variant: "destructive" });
      return;
    }
    setObligationDialogOpen(false);
    await loadData();
  };

  const updateObligationStatus = async (obligation: Obligation, status: string) => {
    const { error } = await supabase
      .from("aspekindo_member_obligations")
      .update({ status, fulfilled_at: status === "fulfilled" ? new Date().toISOString() : null })
      .eq("id", obligation.id);
    if (error) {
      toast({ title: "Status kewajiban gagal diubah", description: error.message, variant: "destructive" });
      return;
    }
    setObligations((current) => current.map((item) => item.id === obligation.id
      ? { ...item, status, fulfilled_at: status === "fulfilled" ? new Date().toISOString() : null }
      : item));
  };

  const exportEvidence = () => {
    const headers = ["Nomor evidence", "Kegiatan", "Peserta", "Perusahaan", "Jenis", "Diterbitkan"];
    const rows = evidence.map((item) => {
      const profile = profileMap.get(item.user_id);
      return [
        item.evidence_number,
        activityMap.get(item.activity_id)?.title ?? item.title,
        profile?.full_name ?? "-",
        profile?.company ?? "-",
        item.evidence_type,
        formatDate(item.issued_at),
      ];
    });
    const csv = [headers, ...rows].map((row) => row.map((value) => csvCell(value)).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    link.download = `rekap-evidence-pub-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (loading) {
    return <div className="flex justify-center py-20 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memuat operasi kegiatan...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold font-heading"><CalendarDays className="h-6 w-6 text-pub-emerald" /> Operasi Kegiatan PUB</h1>
          <p className="mt-1 text-sm text-muted-foreground">Kelola kegiatan PUB, materi multimedia, anggota, kewajiban, dan evidence.</p>
        </div>
        <Button onClick={openCreateActivity}><Plus className="mr-2 h-4 w-4" /> Tambah kegiatan</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Kegiatan</p><p className="mt-1 text-2xl font-bold">{activities.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Anggota aktif</p><p className="mt-1 text-2xl font-bold">{members.filter((item) => item.membership_status === "active").length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Peserta terdaftar</p><p className="mt-1 text-2xl font-bold">{enrollments.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Evidence</p><p className="mt-1 text-2xl font-bold">{evidence.length}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="activities">
        <TabsList className="grid h-auto w-full grid-cols-3">
          <TabsTrigger value="activities">Kegiatan & materi</TabsTrigger>
          <TabsTrigger value="members">Anggota & kewajiban</TabsTrigger>
          <TabsTrigger value="evidence">Rekap evidence</TabsTrigger>
        </TabsList>

        <TabsContent value="activities" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Daftar kegiatan PUB</CardTitle><CardDescription>Hanya kegiatan Terbit yang dapat diakses peserta sesuai status keanggotaan.</CardDescription></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Kegiatan</TableHead><TableHead>Jadwal</TableHead><TableHead>Peserta</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
                <TableBody>
                  {activities.length === 0 ? <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Belum ada kegiatan.</TableCell></TableRow> : activities.map((activity) => {
                    const participantCount = enrollments.filter((item) => item.activity_id === activity.id).length;
                    return (
                      <TableRow key={activity.id}>
                        <TableCell className="min-w-[240px]"><p className="font-semibold">{activity.title}</p><p className="mt-1 text-xs text-muted-foreground">{ACTIVITY_TYPES.find(([value]) => value === activity.activity_type)?.[1] ?? activity.activity_type}</p></TableCell>
                        <TableCell className="min-w-[160px] text-sm">{formatDate(activity.start_at)}</TableCell>
                        <TableCell>{participantCount}{activity.max_participants ? ` / ${activity.max_participants}` : ""}</TableCell>
                        <TableCell><Badge variant="outline">{activity.status}</Badge></TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" onClick={() => void openMaterials(activity)}><FileUp className="mr-1 h-4 w-4" /> Materi</Button>
                            <Button size="icon" variant="ghost" onClick={() => openEditActivity(activity)}><Pencil className="h-4 w-4" /></Button>
                            {activity.status === "published"
                              ? <Button size="icon" variant="ghost" onClick={() => void changeActivityStatus(activity, "archived")}><Archive className="h-4 w-4" /></Button>
                              : <Button size="icon" variant="ghost" onClick={() => void changeActivityStatus(activity, "published")}><RotateCcw className="h-4 w-4" /></Button>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="mt-4 space-y-4">
          <div className="flex justify-end"><Button onClick={() => openMemberDialog()}><Plus className="mr-2 h-4 w-4" /> Tambah anggota</Button></div>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5" /> Database anggota BUJK</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>BUJK</TableHead><TableHead>Nomor anggota</TableHead><TableHead>Status</TableHead><TableHead>Kewajiban</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
                <TableBody>
                  {members.length === 0 ? <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Belum ada anggota yang dihubungkan.</TableCell></TableRow> : members.map((member) => {
                    const memberObligations = obligations.filter((item) => item.member_id === member.id);
                    const fulfilled = memberObligations.filter((item) => item.status === "fulfilled").length;
                    return (
                      <TableRow key={member.id}>
                        <TableCell><p className="font-semibold">{member.company_name}</p><p className="text-xs text-muted-foreground">{member.user_id ? profileMap.get(member.user_id)?.full_name || "Akun terhubung" : "Belum terhubung ke akun"}</p></TableCell>
                        <TableCell>{member.membership_number || "-"}</TableCell>
                        <TableCell><Badge variant="outline">{member.membership_status}</Badge></TableCell>
                        <TableCell>{fulfilled}/{memberObligations.length} terpenuhi</TableCell>
                        <TableCell><div className="flex justify-end gap-1"><Button size="sm" variant="outline" onClick={() => openObligationDialog(member)}>Tambah kewajiban</Button><Button size="icon" variant="ghost" onClick={() => openMemberDialog(member)}><Pencil className="h-4 w-4" /></Button></div></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Daftar kewajiban anggota</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Anggota</TableHead><TableHead>Kewajiban</TableHead><TableHead>4 SIAP</TableHead><TableHead>Jatuh tempo</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {obligations.length === 0 ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Belum ada kewajiban.</TableCell></TableRow> : obligations.map((obligation) => (
                    <TableRow key={obligation.id}>
                      <TableCell>{memberMap.get(obligation.member_id)?.company_name ?? "-"}</TableCell>
                      <TableCell className="font-medium">{obligation.title}</TableCell>
                      <TableCell>{SIAP_OPTIONS.find(([value]) => value === obligation.siap_focus)?.[1]}</TableCell>
                      <TableCell>{obligation.due_date ? new Date(`${obligation.due_date}T00:00:00`).toLocaleDateString("id-ID") : "-"}</TableCell>
                      <TableCell><Select value={obligation.status} onValueChange={(value) => void updateObligationStatus(obligation, value)}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Belum dipenuhi</SelectItem><SelectItem value="in_progress">Sedang dipenuhi</SelectItem><SelectItem value="fulfilled">Terpenuhi</SelectItem><SelectItem value="waived">Dikecualikan</SelectItem></SelectContent></Select></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evidence" className="mt-4">
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><CardTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-pub-amber" /> Rekap bukti kegiatan</CardTitle><CardDescription>Data kerja untuk kebutuhan anggota dan persiapan LKUT resmi.</CardDescription></div>
              <Button variant="outline" disabled={evidence.length === 0} onClick={exportEvidence}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Nomor</TableHead><TableHead>Kegiatan</TableHead><TableHead>Peserta</TableHead><TableHead>Perusahaan</TableHead><TableHead>Diterbitkan</TableHead></TableRow></TableHeader>
                <TableBody>
                  {evidence.length === 0 ? <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Belum ada evidence kegiatan.</TableCell></TableRow> : evidence.map((item) => {
                    const profile = profileMap.get(item.user_id);
                    return <TableRow key={item.id}><TableCell className="font-mono text-xs">{item.evidence_number}</TableCell><TableCell>{activityMap.get(item.activity_id)?.title ?? item.title}</TableCell><TableCell>{profile?.full_name ?? "-"}</TableCell><TableCell>{profile?.company ?? "-"}</TableCell><TableCell>{formatDate(item.issued_at)}</TableCell></TableRow>;
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editingActivity ? "Ubah kegiatan PUB" : "Tambah kegiatan PUB"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div><Label htmlFor="pub-activity-title">Judul *</Label><Input id="pub-activity-title" value={activityForm.title} onChange={(event) => setActivityForm({ ...activityForm, title: event.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><Label>Jenis</Label><Select value={activityForm.activity_type} onValueChange={(value) => setActivityForm({ ...activityForm, activity_type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ACTIVITY_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Mode</Label><Select value={activityForm.delivery_mode} onValueChange={(value) => setActivityForm({ ...activityForm, delivery_mode: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="online">Online</SelectItem><SelectItem value="in_person">Tatap muka</SelectItem><SelectItem value="hybrid">Hybrid</SelectItem><SelectItem value="other">Lainnya</SelectItem></SelectContent></Select></div>
              <div><Label>Fokus 4 SIAP</Label><Select value={activityForm.siap_focus} onValueChange={(value) => setActivityForm({ ...activityForm, siap_focus: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SIAP_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div><Label>Deskripsi</Label><Textarea value={activityForm.description} onChange={(event) => setActivityForm({ ...activityForm, description: event.target.value })} /></div>
            <div><Label>Hasil pembelajaran</Label><Textarea value={activityForm.learning_outcomes} onChange={(event) => setActivityForm({ ...activityForm, learning_outcomes: event.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2"><div><Label>Mulai *</Label><Input type="datetime-local" value={activityForm.start_at} onChange={(event) => setActivityForm({ ...activityForm, start_at: event.target.value })} /></div><div><Label>Selesai</Label><Input type="datetime-local" value={activityForm.end_at} min={activityForm.start_at || undefined} onChange={(event) => setActivityForm({ ...activityForm, end_at: event.target.value })} /></div></div>
            <div className="grid gap-4 sm:grid-cols-2"><div><Label>Lokasi</Label><Input value={activityForm.location} onChange={(event) => setActivityForm({ ...activityForm, location: event.target.value })} /></div><div><Label>Kapasitas</Label><Input type="number" min={1} value={activityForm.max_participants} onChange={(event) => setActivityForm({ ...activityForm, max_participants: event.target.value })} /></div></div>
            <div><Label>Tautan pendaftaran</Label><Input type="url" placeholder="https://..." value={activityForm.registration_url} onChange={(event) => setActivityForm({ ...activityForm, registration_url: event.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2"><div><Label>Status</Label><Select value={activityForm.status} onValueChange={(value) => setActivityForm({ ...activityForm, status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Terbit</SelectItem><SelectItem value="archived">Diarsipkan</SelectItem></SelectContent></Select></div><div className="flex items-end gap-3 pb-2"><Switch checked={activityForm.member_only} onCheckedChange={(checked) => setActivityForm({ ...activityForm, member_only: checked })} /><Label>Khusus anggota aktif</Label></div></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setActivityDialogOpen(false)}>Batal</Button><Button onClick={() => void saveActivity()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(materialActivity)} onOpenChange={(open) => !open && setMaterialActivity(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Materi — {materialActivity?.title}</DialogTitle></DialogHeader>
          <div className="grid gap-4 rounded-xl border bg-muted/20 p-4">
            <div className="grid gap-4 sm:grid-cols-2"><div><Label>Judul materi *</Label><Input value={materialTitle} onChange={(event) => setMaterialTitle(event.target.value)} /></div><div><Label>Jenis</Label><Select value={materialType} onValueChange={setMaterialType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="video">Video</SelectItem><SelectItem value="document">Dokumen</SelectItem><SelectItem value="image">Gambar</SelectItem><SelectItem value="link">Tautan</SelectItem><SelectItem value="other">Lainnya</SelectItem></SelectContent></Select></div></div>
            <div><Label>Upload video, dokumen, atau gambar</Label><Input type="file" accept="video/mp4,video/webm,video/quicktime,application/pdf,.doc,.docx,.ppt,.pptx,image/jpeg,image/png,image/webp" onChange={(event) => setMaterialFile(event.target.files?.[0] ?? null)} /><p className="mt-1 text-xs text-muted-foreground">Maksimal 500 MB. File disimpan privat dan dibuka melalui tautan sementara.</p></div>
            <div><Label>Atau tautan eksternal</Label><Input type="url" placeholder="https://..." value={materialUrl} onChange={(event) => setMaterialUrl(event.target.value)} disabled={Boolean(materialFile)} /></div>
            <Button onClick={() => void saveMaterial()} disabled={saving}><FileUp className="mr-2 h-4 w-4" /> Tambah materi</Button>
          </div>
          <div className="space-y-2">
            {materials.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Belum ada materi.</p> : materials.map((material) => (
              <div key={material.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{material.title}</p><p className="text-xs text-muted-foreground">{material.file_name || material.external_url}</p></div>
                {material.external_url && <Button size="icon" variant="ghost" asChild><a href={material.external_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>}
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => void deleteMaterial(material)} disabled={saving}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingMember ? "Ubah data anggota" : "Tambah anggota BUJK"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div><Label>Hubungkan akun pengguna</Label><Select value={memberForm.user_id || "__none"} onValueChange={(value) => selectProfile(value === "__none" ? "" : value)}><SelectTrigger><SelectValue placeholder="Pilih akun" /></SelectTrigger><SelectContent><SelectItem value="__none">Belum dihubungkan</SelectItem>{profiles.map((profile) => <SelectItem key={profile.user_id} value={profile.user_id}>{profile.company || profile.full_name || profile.user_id}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-4 sm:grid-cols-2"><div><Label>Nama BUJK *</Label><Input value={memberForm.company_name} onChange={(event) => setMemberForm({ ...memberForm, company_name: event.target.value })} /></div><div><Label>Nomor anggota</Label><Input value={memberForm.membership_number} onChange={(event) => setMemberForm({ ...memberForm, membership_number: event.target.value })} /></div></div>
            <div className="grid gap-4 sm:grid-cols-3"><div><Label>Status</Label><Select value={memberForm.membership_status} onValueChange={(value) => setMemberForm({ ...memberForm, membership_status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Aktif</SelectItem><SelectItem value="pending">Menunggu</SelectItem><SelectItem value="expired">Kedaluwarsa</SelectItem><SelectItem value="suspended">Ditangguhkan</SelectItem></SelectContent></Select></div><div><Label>Mulai</Label><Input type="date" value={memberForm.joined_at} onChange={(event) => setMemberForm({ ...memberForm, joined_at: event.target.value })} /></div><div><Label>Berlaku sampai</Label><Input type="date" value={memberForm.expires_at} onChange={(event) => setMemberForm({ ...memberForm, expires_at: event.target.value })} /></div></div>
            <div><Label>Catatan internal</Label><Textarea value={memberForm.notes} onChange={(event) => setMemberForm({ ...memberForm, notes: event.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setMemberDialogOpen(false)}>Batal</Button><Button onClick={() => void saveMember()} disabled={saving}>Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={obligationDialogOpen} onOpenChange={setObligationDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Tambah kewajiban anggota</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div><Label>Judul *</Label><Input value={obligationForm.title} onChange={(event) => setObligationForm({ ...obligationForm, title: event.target.value })} /></div>
            <div><Label>Deskripsi</Label><Textarea value={obligationForm.description} onChange={(event) => setObligationForm({ ...obligationForm, description: event.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-3"><div><Label>Jenis</Label><Input value={obligationForm.obligation_type} onChange={(event) => setObligationForm({ ...obligationForm, obligation_type: event.target.value })} /></div><div><Label>Fokus 4 SIAP</Label><Select value={obligationForm.siap_focus} onValueChange={(value) => setObligationForm({ ...obligationForm, siap_focus: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SIAP_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div><Label>Jatuh tempo</Label><Input type="date" value={obligationForm.due_date} onChange={(event) => setObligationForm({ ...obligationForm, due_date: event.target.value })} /></div></div>
            <div><Label>Catatan internal</Label><Textarea value={obligationForm.notes} onChange={(event) => setObligationForm({ ...obligationForm, notes: event.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setObligationDialogOpen(false)}>Batal</Button><Button onClick={() => void saveObligation()} disabled={saving}>Simpan kewajiban</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}