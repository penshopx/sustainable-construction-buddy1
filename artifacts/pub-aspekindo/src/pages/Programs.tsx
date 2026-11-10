import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner-toast";
import {
  Calendar, MapPin, Plus, Trash2, Clock, Newspaper, Image as ImageIcon,
  CheckCircle2, PlayCircle, CalendarClock, FolderOpen, ArrowLeft, Filter,
  Users, UserCheck, UserX, Download, Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import {
  usePrograms, useProgramUpdates, useProgramGallery,
  useCreateProgram, useUpdateProgram, useDeleteProgram,
  useCreateProgramUpdate, useDeleteProgramUpdate,
  useCreateGalleryItem, useDeleteGalleryItem,
  type PubProgram, type ProgramPublicationStatus,
} from "@/hooks/usePrograms";
import {
  useParticipants, useCreateParticipant, useUpdateParticipant, useDeleteParticipant,
} from "@/hooks/useParticipants";
import { ParticipantImport } from "@/components/participants/ParticipantImport";

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  upcoming: { label: "Akan Datang", color: "bg-pub-amber/15 text-pub-amber", icon: CalendarClock },
  ongoing: { label: "Sedang Berjalan", color: "bg-pub-emerald/15 text-pub-emerald", icon: PlayCircle },
  completed: { label: "Selesai", color: "bg-muted text-muted-foreground", icon: CheckCircle2 },
};

const publicationConfig: Record<ProgramPublicationStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-pub-amber/15 text-pub-amber" },
  published: { label: "Published", color: "bg-pub-emerald/15 text-pub-emerald" },
  archived: { label: "Archived", color: "bg-muted text-muted-foreground" },
};

const attendanceLabels: Record<string, { label: string; color: string }> = {
  registered: { label: "Terdaftar", color: "bg-pub-sky/15 text-pub-sky" },
  attended: { label: "Hadir", color: "bg-pub-emerald/15 text-pub-emerald" },
  absent: { label: "Tidak Hadir", color: "bg-destructive/15 text-destructive" },
};

function ProgramForm({ onClose }: { onClose: () => void }) {
  const create = useCreateProgram();
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "program",
    status: "upcoming",
    publication_status: "draft" as ProgramPublicationStatus,
    location: "",
    start_date: "",
    end_date: "",
  });

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error("Judul wajib diisi");
      return;
    }
    try {
      await create.mutateAsync({
        ...form,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        progress_percent: 0,
        image_url: "",
        });
      toast.success("Program berhasil ditambahkan");
      onClose();
    } catch { toast.error("Gagal menambahkan program"); }
  };

  return (
    <div className="space-y-4">
      <Input placeholder="cth: Workshop Manajemen Proyek Konstruksi 2025" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <Textarea placeholder="cth: Workshop 2 hari tentang teknik penjadwalan proyek menggunakan Critical Path Method (CPM) dan penerapan Earned Value Management (EVM) untuk BUJK." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="program">Program</SelectItem>
            <SelectItem value="kegiatan">Kegiatan</SelectItem>
            <SelectItem value="pelatihan">Pelatihan</SelectItem>
            <SelectItem value="workshop">Workshop</SelectItem>
          </SelectContent>
        </Select>
        <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Akan Datang</SelectItem>
            <SelectItem value="ongoing">Sedang Berjalan</SelectItem>
            <SelectItem value="completed">Selesai</SelectItem>
          </SelectContent>
        </Select>
        <Select value={form.publication_status} onValueChange={(v) => setForm({ ...form, publication_status: v as ProgramPublicationStatus })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft — belum tampil publik</SelectItem>
            <SelectItem value="published">Published — tampil publik</SelectItem>
            <SelectItem value="archived">Archived — diarsipkan</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Input placeholder="cth: Hotel Grand Sahid Jaya, Jakarta Pusat" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Tanggal Mulai</label>
          <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Tanggal Selesai</label>
          <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
        </div>
      </div>
      <Button onClick={handleSubmit} disabled={create.isPending} className="w-full">
        {create.isPending ? "Menyimpan..." : "Tambah Program"}
      </Button>
    </div>
  );
}

function ProgramCard({ program, isAdmin }: { program: PubProgram; isAdmin: boolean }) {
  const navigate = useNavigate();
  const update = useUpdateProgram();
  const del = useDeleteProgram();
  const config = statusConfig[program.status] || statusConfig.upcoming;
  const publication = publicationConfig[program.publication_status] || publicationConfig.draft;
  const Icon = config.icon;

  return (
    <Card className="overflow-hidden cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate(`/admin/program-kegiatan/${program.id}`)}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${config.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm leading-tight">{program.title}</h3>
              <div className="mt-1 flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[10px] capitalize">{program.category}</Badge>
                <Badge className={`${publication.color} text-[10px]`}>{publication.label}</Badge>
              </div>
            </div>
          </div>
          <Badge className={`${config.color} text-xs shrink-0`}>{config.label}</Badge>
        </div>
        {program.description && <p className="text-xs text-muted-foreground line-clamp-2">{program.description}</p>}
        {program.status === "ongoing" && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{program.progress_percent}%</span>
            </div>
            <Progress value={program.progress_percent} className="h-2" />
          </div>
        )}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {program.start_date && (
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(program.start_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
          )}
          {program.location && (
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {program.location}</span>
          )}
        </div>
        {isAdmin && (
          <div className="flex gap-2 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
            {program.status === "ongoing" && (
              <Input
                type="number"
                min={0}
                max={100}
                className="w-20 h-8 text-xs"
                placeholder="%"
                defaultValue={program.progress_percent}
                onBlur={(e) => {
                  const val = Math.min(100, Math.max(0, Number(e.target.value)));
                  if (val !== program.progress_percent) {
                    update.mutate({ id: program.id, progress_percent: val });
                  }
                }}
              />
            )}
            <Select
              defaultValue={program.status}
              onValueChange={(v) => update.mutate({ id: program.id, status: v })}
            >
              <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="upcoming">Akan Datang</SelectItem>
                <SelectItem value="ongoing">Sedang Berjalan</SelectItem>
                <SelectItem value="completed">Selesai</SelectItem>
              </SelectContent>
            </Select>
            <Select
              defaultValue={program.publication_status}
              onValueChange={(v) => update.mutate({ id: program.id, publication_status: v as ProgramPublicationStatus })}
            >
              <SelectTrigger className="h-8 text-xs flex-1" aria-label="Status publikasi"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => {
              if (confirm("Hapus program ini?")) del.mutate(program.id);
            }}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UpdateForm({ programs, onClose }: { programs: PubProgram[]; onClose: () => void }) {
  const create = useCreateProgramUpdate();
  const [form, setForm] = useState({ program_id: "", title: "", content: "" });

  return (
    <div className="space-y-4">
      <Select value={form.program_id} onValueChange={(v) => setForm({ ...form, program_id: v })}>
        <SelectTrigger><SelectValue placeholder="Pilih Program" /></SelectTrigger>
        <SelectContent>
          {programs.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input placeholder="cth: Jadwal Hari ke-2 Diperbarui" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <Textarea placeholder="cth: Sesi pagi diganti ke topik Risk Management karena pembicara utama berhalangan. Peserta diharapkan membawa laptop untuk simulasi." value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={4} />
      <Button className="w-full" disabled={!form.program_id || !form.title.trim() || create.isPending} onClick={async () => {
        try {
          await create.mutateAsync(form);
          toast.success("Update berhasil ditambahkan");
          onClose();
        } catch { toast.error("Gagal menambahkan update"); }
      }}>
        {create.isPending ? "Menyimpan..." : "Posting Update"}
      </Button>
    </div>
  );
}

function GalleryUploadForm({ programs, onClose }: { programs: PubProgram[]; onClose: () => void }) {
  const create = useCreateGalleryItem();
  const [form, setForm] = useState({ program_id: "", caption: "" });
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleUpload = async () => {
    if (!file || !form.program_id) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${form.program_id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("program-images").upload(path, file);
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from("program-images").getPublicUrl(path);
      await create.mutateAsync({ program_id: form.program_id, image_url: publicUrl, caption: form.caption });
      toast.success("Foto berhasil diupload");
      onClose();
    } catch { toast.error("Gagal upload foto"); }
    setUploading(false);
  };

  return (
    <div className="space-y-4">
      <Select value={form.program_id} onValueChange={(v) => setForm({ ...form, program_id: v })}>
        <SelectTrigger><SelectValue placeholder="Pilih Program" /></SelectTrigger>
        <SelectContent>
          {programs.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <Input placeholder="cth: Foto bersama peserta Workshop hari ke-1" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
      <Button className="w-full" disabled={!file || !form.program_id || uploading} onClick={handleUpload}>
        {uploading ? "Mengupload..." : "Upload Foto"}
      </Button>
    </div>
  );
}

function ParticipantForm({ programs, onClose }: { programs: PubProgram[]; onClose: () => void }) {
  const create = useCreateParticipant();
  const [form, setForm] = useState({
    program_id: "", full_name: "", company: "", position: "", email: "", phone: "", notes: "", attendance_status: "registered",
  });

  return (
    <div className="space-y-4">
      <Select value={form.program_id} onValueChange={(v) => setForm({ ...form, program_id: v })}>
        <SelectTrigger><SelectValue placeholder="Pilih Program/Kegiatan" /></SelectTrigger>
        <SelectContent>
          {programs.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input placeholder="cth: Ir. Ahmad Wijaya, S.T." value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <Input placeholder="cth: PT Mitra Konstruksi" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
        <Input placeholder="cth: Project Manager" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input type="email" placeholder="cth: ahmad@mitracon.co.id" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input placeholder="cth: 0812-3456-7890" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <Select value={form.attendance_status} onValueChange={(v) => setForm({ ...form, attendance_status: v })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="registered">Terdaftar</SelectItem>
          <SelectItem value="attended">Hadir</SelectItem>
          <SelectItem value="absent">Tidak Hadir</SelectItem>
        </SelectContent>
      </Select>
      <Input placeholder="cth: Alergi makanan laut, butuh sertifikat kehadiran" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      <Button className="w-full" disabled={!form.program_id || !form.full_name.trim() || create.isPending} onClick={async () => {
        try {
          await create.mutateAsync(form);
          toast.success("Peserta berhasil ditambahkan");
          onClose();
        } catch { toast.error("Gagal menambahkan peserta"); }
      }}>
        {create.isPending ? "Menyimpan..." : "Tambah Peserta"}
      </Button>
    </div>
  );
}

export default function Programs() {
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();
  const { data: programs = [], isLoading: loadingPrograms } = usePrograms();
  const { data: updates = [], isLoading: loadingUpdates } = useProgramUpdates();
  const { data: gallery = [], isLoading: loadingGallery } = useProgramGallery();
  const { data: participants = [], isLoading: loadingParticipants } = useParticipants();
  const delUpdate = useDeleteProgramUpdate();
  const delGallery = useDeleteGalleryItem();
  const delParticipant = useDeleteParticipant();
  const updateParticipant = useUpdateParticipant();
  const [addProgramOpen, setAddProgramOpen] = useState(false);
  const [addUpdateOpen, setAddUpdateOpen] = useState(false);
  const [addGalleryOpen, setAddGalleryOpen] = useState(false);
  const [addParticipantOpen, setAddParticipantOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPublication, setFilterPublication] = useState("all");
  const [participantProgramFilter, setParticipantProgramFilter] = useState("all");
  const [participantSearch, setParticipantSearch] = useState("");

  const ongoing = programs.filter((p) => p.status === "ongoing");
  const upcoming = programs.filter((p) => p.status === "upcoming");
  const completed = programs.filter((p) => p.status === "completed");

  const filteredPrograms = programs.filter((p) => {
    if (filterCategory !== "all" && p.category !== filterCategory) return false;
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (filterPublication !== "all" && p.publication_status !== filterPublication) return false;
    return true;
  });

  const searchLower = participantSearch.toLowerCase();
  const filteredParticipants = participants.filter((p) => {
    if (participantProgramFilter !== "all" && p.program_id !== participantProgramFilter) return false;
    if (searchLower && !p.full_name.toLowerCase().includes(searchLower) && !p.company.toLowerCase().includes(searchLower)) return false;
    return true;
  });

  const programMap = Object.fromEntries(programs.map((p) => [p.id, p.title]));

  const attendedCount = filteredParticipants.filter((p) => p.attendance_status === "attended").length;
  const absentCount = filteredParticipants.filter((p) => p.attendance_status === "absent").length;

  const exportParticipantsCsv = () => {
    if (filteredParticipants.length === 0) return;
    const headers = ["Nama", "Perusahaan", "Jabatan", "Email", "Telepon", "Program", "Status Kehadiran", "Catatan"];
    const rows = filteredParticipants.map((p) => [
      p.full_name, p.company, p.position, p.email, p.phone,
      programMap[p.program_id] || "-",
      attendanceLabels[p.attendance_status]?.label || p.attendance_status,
      p.notes,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `peserta-kegiatan-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-heading">Program & Kegiatan PUB</h1>
            <p className="text-sm text-muted-foreground">Daftar program, jadwal, update berita, dan dokumentasi kegiatan</p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-pub-amber">{programs.length}</p><p className="text-xs text-muted-foreground">Total Program</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-pub-emerald">{ongoing.length}</p><p className="text-xs text-muted-foreground">Sedang Berjalan</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-pub-sky">{upcoming.length}</p><p className="text-xs text-muted-foreground">Akan Datang</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-muted-foreground">{completed.length}</p><p className="text-xs text-muted-foreground">Selesai</p></CardContent></Card>
      </div>

      <Tabs defaultValue="programs" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="programs" className="gap-1.5 text-xs"><FolderOpen className="w-3.5 h-3.5" /> Program</TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5 text-xs"><Clock className="w-3.5 h-3.5" /> Timeline</TabsTrigger>
          <TabsTrigger value="participants" className="gap-1.5 text-xs"><Users className="w-3.5 h-3.5" /> Peserta</TabsTrigger>
          <TabsTrigger value="updates" className="gap-1.5 text-xs"><Newspaper className="w-3.5 h-3.5" /> Update</TabsTrigger>
          <TabsTrigger value="gallery" className="gap-1.5 text-xs"><ImageIcon className="w-3.5 h-3.5" /> Galeri</TabsTrigger>
        </TabsList>

        {/* Programs Tab */}
        <TabsContent value="programs" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && (
              <Dialog open={addProgramOpen} onOpenChange={setAddProgramOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><Plus className="w-4 h-4" /> Tambah Program</Button>
                </DialogTrigger>
                <DialogContent><DialogHeader><DialogTitle>Tambah Program Baru</DialogTitle></DialogHeader>
                  <ProgramForm onClose={() => setAddProgramOpen(false)} />
                </DialogContent>
              </Dialog>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue placeholder="Kategori" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  <SelectItem value="program">Program</SelectItem>
                  <SelectItem value="kegiatan">Kegiatan</SelectItem>
                  <SelectItem value="pelatihan">Pelatihan</SelectItem>
                  <SelectItem value="workshop">Workshop</SelectItem>
                  <SelectItem value="seminar">Seminar</SelectItem>
                  <SelectItem value="sertifikasi">Sertifikasi</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="upcoming">Akan Datang</SelectItem>
                  <SelectItem value="ongoing">Sedang Berjalan</SelectItem>
                  <SelectItem value="completed">Selesai</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPublication} onValueChange={setFilterPublication}>
                <SelectTrigger className="h-8 text-xs w-[130px]" aria-label="Filter publikasi"><SelectValue placeholder="Publikasi" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Publikasi</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {loadingPrograms ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map((i) => <Skeleton key={i} className="h-48" />)}</div>
          ) : filteredPrograms.length === 0 ? (
            <Card className="p-8 text-center"><p className="text-muted-foreground">{programs.length === 0 ? "Belum ada program." : "Tidak ada program yang cocok dengan filter."}</p></Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPrograms.map((p) => <ProgramCard key={p.id} program={p} isAdmin={isAdmin} />)}
            </div>
          )}
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          {loadingPrograms ? (
            <div className="space-y-4">{[1,2,3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : programs.length === 0 ? (
            <Card className="p-8 text-center"><p className="text-muted-foreground">Belum ada jadwal.</p></Card>
          ) : (
            <div className="relative">
              <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-border" />
              <div className="space-y-6">
                {programs
                  .filter((p) => p.start_date)
                  .sort((a, b) => new Date(a.start_date!).getTime() - new Date(b.start_date!).getTime())
                  .map((p) => {
                    const config = statusConfig[p.status] || statusConfig.upcoming;
                    const Icon = config.icon;
                    return (
                      <div key={p.id} className="relative flex gap-4 items-start">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 shrink-0 ${config.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{p.title}</p>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(p.start_date!).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                              {p.end_date && ` — ${new Date(p.end_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`}
                            </span>
                            {p.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {p.location}</span>}
                          </div>
                          {p.status === "ongoing" && <Progress value={p.progress_percent} className="h-1.5 mt-2 max-w-xs" />}
                        </div>
                        <Badge className={`${config.color} text-[10px] shrink-0`}>{config.label}</Badge>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Participants Tab */}
        <TabsContent value="participants" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && (
              <>
                <Dialog open={addParticipantOpen} onOpenChange={setAddParticipantOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2"><Plus className="w-4 h-4" /> Tambah Peserta</Button>
                  </DialogTrigger>
                  <DialogContent><DialogHeader><DialogTitle>Tambah Peserta Kegiatan</DialogTitle></DialogHeader>
                    <ParticipantForm programs={programs} onClose={() => setAddParticipantOpen(false)} />
                  </DialogContent>
                </Dialog>
                <ParticipantImport programs={programs} />
              </>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Select value={participantProgramFilter} onValueChange={setParticipantProgramFilter}>
                <SelectTrigger className="h-8 text-xs w-[180px]"><SelectValue placeholder="Filter Program" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Program</SelectItem>
                  {programs.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
              {filteredParticipants.length > 0 && (
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={exportParticipantsCsv}>
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </Button>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama atau perusahaan..."
              value={participantSearch}
              onChange={(e) => setParticipantSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Participant summary */}
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1"><Users className="w-4 h-4 text-pub-sky" /></div>
              <p className="text-xl font-bold">{filteredParticipants.length}</p>
              <p className="text-[10px] text-muted-foreground">Total Peserta</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1"><UserCheck className="w-4 h-4 text-pub-emerald" /></div>
              <p className="text-xl font-bold text-pub-emerald">{attendedCount}</p>
              <p className="text-[10px] text-muted-foreground">Hadir</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1"><UserX className="w-4 h-4 text-destructive" /></div>
              <p className="text-xl font-bold text-destructive">{absentCount}</p>
              <p className="text-[10px] text-muted-foreground">Tidak Hadir</p>
            </CardContent></Card>
          </div>

          {loadingParticipants ? (
            <Skeleton className="h-40" />
          ) : filteredParticipants.length === 0 ? (
            <Card className="p-8 text-center"><p className="text-muted-foreground">Belum ada peserta terdaftar.</p></Card>
          ) : (
            <Card>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">No</TableHead>
                      <TableHead className="text-xs">Nama</TableHead>
                      <TableHead className="text-xs">Perusahaan</TableHead>
                      <TableHead className="text-xs">Jabatan</TableHead>
                      <TableHead className="text-xs">Kontak</TableHead>
                      <TableHead className="text-xs">Program</TableHead>
                      <TableHead className="text-xs">Kehadiran</TableHead>
                      {isAdmin && <TableHead className="text-xs w-20">Aksi</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredParticipants.map((p, idx) => {
                      const att = attendanceLabels[p.attendance_status] || attendanceLabels.registered;
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs">{idx + 1}</TableCell>
                          <TableCell className="text-xs font-medium">{p.full_name}</TableCell>
                          <TableCell className="text-xs">{p.company || "-"}</TableCell>
                          <TableCell className="text-xs">{p.position || "-"}</TableCell>
                          <TableCell className="text-xs">
                            {p.email && <div>{p.email}</div>}
                            {p.phone && <div className="text-muted-foreground">{p.phone}</div>}
                            {!p.email && !p.phone && "-"}
                          </TableCell>
                          <TableCell className="text-xs">{programMap[p.program_id] || "-"}</TableCell>
                          <TableCell>
                            {isAdmin ? (
                              <Select
                                defaultValue={p.attendance_status}
                                onValueChange={(v) => updateParticipant.mutate({
                                  id: p.id,
                                  attendance_status: v,
                                  attended_at: v === "attended" ? new Date().toISOString() : null,
                                })}
                              >
                                <SelectTrigger className="h-7 text-[10px] w-[110px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="registered">Terdaftar</SelectItem>
                                  <SelectItem value="attended">Hadir</SelectItem>
                                  <SelectItem value="absent">Tidak Hadir</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge className={`${att.color} text-[10px]`}>{att.label}</Badge>
                            )}
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                                onClick={() => { if (confirm("Hapus peserta?")) delParticipant.mutate(p.id); }}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Updates Tab */}
        <TabsContent value="updates" className="space-y-4">
          {isAdmin && (
            <Dialog open={addUpdateOpen} onOpenChange={setAddUpdateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="w-4 h-4" /> Posting Update</Button>
              </DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>Posting Update Baru</DialogTitle></DialogHeader>
                <UpdateForm programs={programs} onClose={() => setAddUpdateOpen(false)} />
              </DialogContent>
            </Dialog>
          )}
          {loadingUpdates ? (
            <div className="space-y-4">{[1,2].map((i) => <Skeleton key={i} className="h-32" />)}</div>
          ) : updates.length === 0 ? (
            <Card className="p-8 text-center"><p className="text-muted-foreground">Belum ada update.</p></Card>
          ) : (
            <div className="space-y-4">
              {updates.map((u) => (
                <Card key={u.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{u.title}</CardTitle>
                        {u.pub_programs && <p className="text-xs text-muted-foreground mt-0.5">Program: {u.pub_programs.title}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(u.published_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                        {isAdmin && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                            onClick={() => { if (confirm("Hapus update?")) delUpdate.mutate(u.id); }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{u.content}</p></CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Gallery Tab */}
        <TabsContent value="gallery" className="space-y-4">
          {isAdmin && (
            <Dialog open={addGalleryOpen} onOpenChange={setAddGalleryOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="w-4 h-4" /> Upload Foto</Button>
              </DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>Upload Foto Kegiatan</DialogTitle></DialogHeader>
                <GalleryUploadForm programs={programs} onClose={() => setAddGalleryOpen(false)} />
              </DialogContent>
            </Dialog>
          )}
          {loadingGallery ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{[1,2,3,4].map((i) => <Skeleton key={i} className="aspect-square" />)}</div>
          ) : gallery.length === 0 ? (
            <Card className="p-8 text-center"><p className="text-muted-foreground">Belum ada foto.</p></Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {gallery.map((g) => (
                <Card key={g.id} className="overflow-hidden group relative">
                  <img src={g.image_url} alt={g.caption} className="w-full aspect-square object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                    <p className="text-white text-xs">{g.caption || "Tanpa caption"}</p>
                    {g.pub_programs && <p className="text-white/70 text-[10px]">{g.pub_programs.title}</p>}
                    {isAdmin && (
                      <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-7 w-7 text-white hover:text-destructive"
                        onClick={() => { if (confirm("Hapus foto?")) delGallery.mutate(g.id); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
