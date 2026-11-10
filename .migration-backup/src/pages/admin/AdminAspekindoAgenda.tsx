import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  CalendarDays,
  ExternalLink,
  Eye,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getScheduleValidationMessage } from "@/lib/aspekindoCalendar";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type Agenda = Database["public"]["Tables"]["aspekindo_learning_agendas"]["Row"];
type AgendaStatus = Database["public"]["Tables"]["aspekindo_learning_agendas"]["Row"]["status"];
type LmsCourse = Database["public"]["Tables"]["aspekindo_lms_courses"]["Row"];

type AgendaForm = {
  title: string;
  category: string;
  description: string;
  audience: string;
  status: AgendaStatus;
  start_date: string;
  end_date: string;
  schedule: string;
  location: string;
  registration_url: string;
  registration_details: string;
  lms_course_id: string;
};

const EMPTY_FORM: AgendaForm = {
  title: "",
  category: "Sesi pembelajaran",
  description: "",
  audience: "",
  status: "draft",
  start_date: "",
  end_date: "",
  schedule: "",
  location: "",
  registration_url: "",
  registration_details: "",
  lms_course_id: "__none",
};

const STATUS_LABELS: Record<AgendaStatus, string> = {
  draft: "Draft",
  published: "Terbit",
  archived: "Diarsipkan",
};

const STATUS_STYLES: Record<AgendaStatus, string> = {
  draft: "border-amber-200 bg-amber-50 text-amber-800",
  published: "border-emerald-200 bg-emerald-50 text-emerald-800",
  archived: "border-slate-200 bg-slate-100 text-slate-600",
};

function formatDate(value: string | null) {
  if (!value) return "Tanggal belum ditentukan";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateRange(agenda: Agenda) {
  if (!agenda.end_date || agenda.end_date === agenda.start_date) return formatDate(agenda.start_date);
  return `${formatDate(agenda.start_date)} – ${formatDate(agenda.end_date)}`;
}

function isSecureRegistrationUrl(value: string) {
  if (!value) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export default function AdminAspekindoAgenda() {
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [lmsCourses, setLmsCourses] = useState<LmsCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Agenda | null>(null);
  const [form, setForm] = useState<AgendaForm>(EMPTY_FORM);
  const [statusFilter, setStatusFilter] = useState<AgendaStatus | "all">("all");
  const [saving, setSaving] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchAgendas = async () => {
    setLoadError(null);
    const [agendaResult, courseResult] = await Promise.all([
      supabase
        .from("aspekindo_learning_agendas")
        .select("*")
        .order("start_date", { ascending: true })
        .order("created_at", { ascending: false }),
      supabase
        .from("aspekindo_lms_courses")
        .select("*")
        .order("title", { ascending: true }),
    ]);

    if (agendaResult.error) {
      setLoadError(agendaResult.error.message);
      setAgendas([]);
    } else {
      setAgendas(agendaResult.data);
    }
    if (courseResult.error) {
      setLoadError((current) => current ?? courseResult.error.message);
    } else {
      setLmsCourses(courseResult.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchAgendas();
  }, []);

  const filteredAgendas = useMemo(
    () => statusFilter === "all" ? agendas : agendas.filter((agenda) => agenda.status === statusFilter),
    [agendas, statusFilter],
  );

  const updateForm = <K extends keyof AgendaForm>(key: K, value: AgendaForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (agenda: Agenda) => {
    setEditing(agenda);
    setForm({
      title: agenda.title,
      category: agenda.category,
      description: agenda.description,
      audience: agenda.audience,
      status: agenda.status,
      start_date: agenda.start_date,
      end_date: agenda.end_date ?? "",
      schedule: agenda.schedule,
      location: agenda.location,
      registration_url: agenda.registration_url,
      registration_details: agenda.registration_details,
      lms_course_id: lmsCourses.find((course) => course.agenda_id === agenda.id)?.id ?? "__none",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.description.trim() || !form.audience.trim() || !form.start_date) {
      toast({
        title: "Lengkapi data kegiatan",
        description: "Judul, deskripsi, sasaran peserta, dan tanggal mulai wajib diisi.",
        variant: "destructive",
      });
      return;
    }

    if (!isSecureRegistrationUrl(form.registration_url.trim())) {
      toast({
        title: "Tautan pendaftaran tidak valid",
        description: "Gunakan alamat lengkap yang diawali https://.",
        variant: "destructive",
      });
      return;
    }

    const scheduleValidationMessage = getScheduleValidationMessage(form.schedule);
    if (scheduleValidationMessage) {
      toast({
        title: "Format jam belum dapat dipetakan",
        description: scheduleValidationMessage,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      category: form.category.trim() || "Sesi pembelajaran",
      description: form.description.trim(),
      audience: form.audience.trim(),
      status: form.status,
      start_date: form.start_date,
      end_date: form.end_date || null,
      schedule: form.schedule.trim(),
      location: form.location.trim(),
      registration_url: form.registration_url.trim(),
      registration_details: form.registration_details.trim(),
    };

    const result = editing
      ? await supabase.from("aspekindo_learning_agendas").update(payload).eq("id", editing.id)
      : await supabase.from("aspekindo_learning_agendas").insert(payload).select("id").single();

    setSaving(false);
    if (result.error) {
      toast({ title: "Gagal menyimpan kegiatan", description: result.error.message, variant: "destructive" });
      return;
    }

    const agendaId = editing?.id ?? result.data?.id;
    if (agendaId) {
      const previouslyLinked = lmsCourses.find((course) => course.agenda_id === agendaId);
      if (previouslyLinked && previouslyLinked.id !== form.lms_course_id) {
        const { error: unlinkError } = await supabase
          .from("aspekindo_lms_courses")
          .update({ agenda_id: null })
          .eq("id", previouslyLinked.id);
        if (unlinkError) {
          if (!editing) await supabase.from("aspekindo_learning_agendas").delete().eq("id", agendaId);
          toast({ title: "Relasi LMS lama belum dilepas", description: unlinkError.message, variant: "destructive" });
          return;
        }
      }
      if (form.lms_course_id !== "__none") {
        const { error: linkError } = await supabase
          .from("aspekindo_lms_courses")
          .update({ agenda_id: agendaId })
          .eq("id", form.lms_course_id);
        if (linkError) {
          if (previouslyLinked) {
            await supabase.from("aspekindo_lms_courses").update({ agenda_id: agendaId }).eq("id", previouslyLinked.id);
          }
          if (!editing) await supabase.from("aspekindo_learning_agendas").delete().eq("id", agendaId);
          toast({ title: "Relasi LMS gagal disimpan", description: linkError.message, variant: "destructive" });
          return;
        }
      }
    }

    toast({ title: editing ? "Kegiatan diperbarui" : "Kegiatan ditambahkan" });
    setDialogOpen(false);
    await fetchAgendas();
  };

  const updateStatus = async (agenda: Agenda, status: AgendaStatus) => {
    setStatusUpdatingId(agenda.id);
    const { error } = await supabase
      .from("aspekindo_learning_agendas")
      .update({ status })
      .eq("id", agenda.id);
    setStatusUpdatingId(null);

    if (error) {
      toast({ title: "Gagal mengubah status", description: error.message, variant: "destructive" });
      return;
    }

    setAgendas((current) => current.map((item) => item.id === agenda.id ? { ...item, status } : item));
    toast({ title: `Kegiatan ${STATUS_LABELS[status].toLowerCase()}` });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pub-emerald/10">
            <CalendarDays className="h-5 w-5 text-pub-emerald" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">Agenda ASPEKINDO</h1>
            <p className="text-sm text-muted-foreground">
              Kelola kegiatan pembelajaran yang tampil di halaman publik.
            </p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Tambah kegiatan
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(["published", "draft", "archived"] as AgendaStatus[]).map((status) => (
          <Card key={status} className="shadow-card">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{STATUS_LABELS[status]}</p>
              <p className="mt-1 text-2xl font-bold font-heading text-foreground">
                {agendas.filter((agenda) => agenda.status === status).length}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Daftar kegiatan</CardTitle>
            <CardDescription>Hanya kegiatan berstatus Terbit yang terlihat di landing page.</CardDescription>
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as AgendaStatus | "all")}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Filter status agenda">
              <SelectValue placeholder="Semua status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua status</SelectItem>
              <SelectItem value="published">Terbit</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="archived">Diarsipkan</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Memuat agenda...
            </div>
          ) : loadError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
              <p className="font-semibold">Agenda belum dapat dimuat.</p>
              <p className="mt-1">{loadError}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void fetchAgendas()}>
                Coba lagi
              </Button>
            </div>
          ) : filteredAgendas.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium text-foreground">Belum ada kegiatan pada filter ini.</p>
              <p className="mt-1 text-sm text-muted-foreground">Tambahkan agenda baru untuk mulai mengisi kalender ASPEKINDO.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kegiatan</TableHead>
                    <TableHead>Jadwal</TableHead>
                    <TableHead>Sasaran</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAgendas.map((agenda) => (
                    <TableRow key={agenda.id}>
                      <TableCell className="min-w-[240px]">
                        <p className="font-semibold text-foreground">{agenda.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{agenda.category}</p>
                        {agenda.location && (
                          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" /> {agenda.location}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="min-w-[150px] text-sm">
                        <p>{formatDateRange(agenda)}</p>
                        {agenda.schedule && <p className="mt-1 text-xs text-muted-foreground">{agenda.schedule}</p>}
                      </TableCell>
                      <TableCell className="max-w-[200px] text-sm text-muted-foreground">{agenda.audience}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_STYLES[agenda.status]}>
                          {STATUS_LABELS[agenda.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" aria-label={`Edit ${agenda.title}`} onClick={() => openEdit(agenda)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {agenda.registration_url && (
                            <Button variant="ghost" size="icon" asChild aria-label={`Buka pendaftaran ${agenda.title}`}>
                              <a href={agenda.registration_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {agenda.status === "published" ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Arsipkan ${agenda.title}`}
                              disabled={statusUpdatingId === agenda.id}
                              onClick={() => void updateStatus(agenda, "archived")}
                            >
                              {statusUpdatingId === agenda.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={agenda.status === "archived" ? `Terbitkan kembali ${agenda.title}` : `Terbitkan ${agenda.title}`}
                              disabled={statusUpdatingId === agenda.id}
                              onClick={() => void updateStatus(agenda, "published")}
                            >
                              {statusUpdatingId === agenda.id ? <Loader2 className="h-4 w-4 animate-spin" /> : agenda.status === "archived" ? <RotateCcw className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Ubah kegiatan" : "Tambah kegiatan ASPEKINDO"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-4 sm:grid-cols-[1fr,220px]">
              <div className="space-y-2">
                <Label htmlFor="agenda-title">Judul kegiatan *</Label>
                <Input id="agenda-title" data-testid="agenda-title-input" value={form.title} onChange={(event) => updateForm("title", event.target.value)} placeholder="Contoh: Klinik Kesiapan BUJK" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agenda-category">Jenis kegiatan</Label>
                <Input id="agenda-category" value={form.category} onChange={(event) => updateForm("category", event.target.value)} placeholder="Sesi pembelajaran" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agenda-description">Deskripsi *</Label>
              <Textarea id="agenda-description" value={form.description} onChange={(event) => updateForm("description", event.target.value)} rows={3} placeholder="Jelaskan tujuan dan manfaat kegiatan." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agenda-audience">Sasaran peserta *</Label>
              <Input id="agenda-audience" value={form.audience} onChange={(event) => updateForm("audience", event.target.value)} placeholder="Anggota dan pengelola BUJK" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="agenda-start-date">Tanggal mulai *</Label>
                <Input id="agenda-start-date" type="date" value={form.start_date} onChange={(event) => updateForm("start_date", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agenda-end-date">Tanggal selesai</Label>
                <Input id="agenda-end-date" type="date" value={form.end_date} min={form.start_date || undefined} onChange={(event) => updateForm("end_date", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agenda-schedule">Jam / durasi</Label>
                <Input
                  id="agenda-schedule"
                  aria-describedby="agenda-schedule-help"
                  value={form.schedule}
                  onChange={(event) => updateForm("schedule", event.target.value)}
                  placeholder="09.00–12.00 WIB"
                />
                <p id="agenda-schedule-help" className="text-xs leading-relaxed text-muted-foreground">
                  Isi rentang lengkap HH.MM–HH.MM atau HH:MM–HH:MM beserta zona,
                  misalnya 09.00–12.00 WIB. Zona WIB, WITA, dan WIT tersedia.
                  Acara lintas tengah malam boleh ditulis 22:00–01:30 WIB.
                  Untuk agenda sehari penuh, kosongkan kolom atau tulis “Sehari penuh”.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agenda-location">Lokasi</Label>
              <Input id="agenda-location" value={form.location} onChange={(event) => updateForm("location", event.target.value)} placeholder="Online via Zoom atau lokasi kegiatan" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="agenda-registration-url">Tautan pendaftaran</Label>
                <Input id="agenda-registration-url" type="url" inputMode="url" value={form.registration_url} onChange={(event) => updateForm("registration_url", event.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agenda-status">Status publikasi</Label>
                <Select value={form.status} onValueChange={(value) => updateForm("status", value as AgendaStatus)}>
                  <SelectTrigger id="agenda-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft — belum tampil</SelectItem>
                    <SelectItem value="published">Terbit — tampil publik</SelectItem>
                    <SelectItem value="archived">Diarsipkan — disembunyikan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agenda-lms-course">Pembelajaran internal (opsional)</Label>
              <Select value={form.lms_course_id} onValueChange={(value) => updateForm("lms_course_id", value)}>
                <SelectTrigger id="agenda-lms-course"><SelectValue placeholder="Belum dihubungkan" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Belum dihubungkan</SelectItem>
                  {lmsCourses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title} · {STATUS_LABELS[course.status] ?? course.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Tombol “Masuk LMS” hanya tampil publik bila kursus yang dihubungkan sudah berstatus Terbit.
                Agenda tanpa relasi ini tetap menggunakan detail dan pendaftaran eksternal.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agenda-registration-details">Detail pendaftaran</Label>
              <Textarea id="agenda-registration-details" value={form.registration_details} onChange={(event) => updateForm("registration_details", event.target.value)} rows={3} placeholder="Contoh: Pendaftaran ditutup H-1. Kuota 30 peserta." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Simpan perubahan" : "Simpan kegiatan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}